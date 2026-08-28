import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { TextDecoder } from 'node:util';

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  console.error('Usage: node png-card-audit.mjs <input.png> <output-dir>');
  process.exit(2);
}

const input = path.resolve(inputArg);
const output = path.resolve(outputArg);
const inputDir = path.dirname(input);
if (output === input || output === inputDir || input.startsWith(`${output}${path.sep}`)) {
  throw new Error('Output must be separate from the input and its directory');
}
if (!fs.statSync(input).isFile() || path.extname(input).toLowerCase() !== '.png') {
  throw new Error(`Not a PNG file: ${input}`);
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const utf8 = new TextDecoder('utf-8', { fatal: true });
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readNullTerminated(buffer, start, encoding = 'latin1') {
  const end = buffer.indexOf(0, start);
  if (end < 0) throw new Error('Malformed PNG text chunk: missing NUL terminator');
  return { value: buffer.subarray(start, end).toString(encoding), next: end + 1 };
}

function decodeTextChunk(type, data) {
  const keywordField = readNullTerminated(data, 0);
  const keyword = keywordField.value;
  if (type === 'tEXt') {
    return { keyword, text: data.subarray(keywordField.next).toString('latin1'), compressed: false };
  }
  if (type === 'zTXt') {
    const method = data[keywordField.next];
    if (method !== 0) throw new Error(`Unsupported zTXt compression method: ${method}`);
    const text = zlib.inflateSync(data.subarray(keywordField.next + 1)).toString('latin1');
    return { keyword, text, compressed: true, compressionMethod: method };
  }
  if (type === 'iTXt') {
    const compressionFlag = data[keywordField.next];
    const compressionMethod = data[keywordField.next + 1];
    let cursor = keywordField.next + 2;
    const language = readNullTerminated(data, cursor, 'ascii');
    cursor = language.next;
    const translated = readNullTerminated(data, cursor, 'utf8');
    cursor = translated.next;
    if (![0, 1].includes(compressionFlag)) {
      throw new Error(`Invalid iTXt compression flag: ${compressionFlag}`);
    }
    if (compressionFlag === 1 && compressionMethod !== 0) {
      throw new Error(`Unsupported iTXt compression method: ${compressionMethod}`);
    }
    const body = data.subarray(cursor);
    const bytes = compressionFlag === 1 ? zlib.inflateSync(body) : body;
    return {
      keyword,
      text: utf8.decode(bytes),
      compressed: compressionFlag === 1,
      compressionMethod,
      languageTag: language.value,
      translatedKeyword: translated.value,
    };
  }
  throw new Error(`Unsupported text chunk: ${type}`);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function decodeCardPayload(text, keyword) {
  const compact = text.replace(/\s+/g, '');
  if (!compact || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new Error(`Recognized payload ${keyword} is not valid base64`);
  }
  const raw = Buffer.from(compact, 'base64');
  const roundtrip = raw.toString('base64').replace(/=+$/, '');
  if (roundtrip !== compact.replace(/=+$/, '')) {
    throw new Error(`Recognized payload ${keyword} failed strict base64 round trip`);
  }
  const jsonText = utf8.decode(raw);
  const parsed = JSON.parse(jsonText);
  return { raw, jsonText, parsed };
}

function atomicWrite(file, data) {
  if (fs.existsSync(file)) throw new Error(`Refusing to overwrite existing file: ${file}`);
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
}

const source = fs.readFileSync(input);
if (source.length < 20 || !source.subarray(0, 8).equals(pngSignature)) {
  throw new Error('Invalid PNG signature');
}

const chunks = [];
const textChunks = [];
let offset = 8;
let sawIend = false;
while (offset < source.length) {
  if (source.length - offset < 12) throw new Error(`Truncated chunk header at offset ${offset}`);
  const start = offset;
  const length = source.readUInt32BE(offset);
  const type = source.subarray(offset + 4, offset + 8).toString('ascii');
  const dataStart = offset + 8;
  const dataEnd = dataStart + length;
  const crcOffset = dataEnd;
  const next = crcOffset + 4;
  if (!/^[A-Za-z]{4}$/.test(type)) throw new Error(`Invalid chunk type at offset ${offset}: ${type}`);
  if (next > source.length) throw new Error(`Chunk ${type} at offset ${offset} exceeds file bounds`);
  const data = source.subarray(dataStart, dataEnd);
  const storedCrc = source.readUInt32BE(crcOffset);
  const computedCrc = crc32(source.subarray(offset + 4, dataEnd));
  const crcValid = storedCrc === computedCrc;
  if (!crcValid) throw new Error(`CRC mismatch in ${type} chunk at offset ${offset}`);
  chunks.push({
    index: chunks.length,
    type,
    offset: start,
    length,
    storedCrc: storedCrc.toString(16).padStart(8, '0'),
    computedCrc: computedCrc.toString(16).padStart(8, '0'),
    crcValid,
  });
  if (['tEXt', 'zTXt', 'iTXt'].includes(type)) {
    const decoded = decodeTextChunk(type, data);
    textChunks.push({
      chunkIndex: chunks.length - 1,
      type,
      keyword: decoded.keyword,
      compressed: decoded.compressed,
      compressionMethod: decoded.compressionMethod ?? null,
      languageTag: decoded.languageTag ?? null,
      translatedKeyword: decoded.translatedKeyword ?? null,
      textLength: decoded.text.length,
      textSha256: sha256(Buffer.from(decoded.text, 'utf8')),
      text: decoded.text,
    });
  }
  offset = next;
  if (type === 'IEND') {
    if (length !== 0) throw new Error('IEND chunk must be empty');
    sawIend = true;
    break;
  }
}

if (chunks[0]?.type !== 'IHDR') throw new Error('IHDR is not the first PNG chunk');
if (!sawIend) throw new Error('PNG has no terminal IEND chunk');
if (offset !== source.length) throw new Error(`PNG has ${source.length - offset} trailing bytes after IEND`);

const recognized = textChunks.filter((entry) => ['chara', 'ccv3'].includes(entry.keyword));
for (const keyword of ['chara', 'ccv3']) {
  if (recognized.filter((entry) => entry.keyword === keyword).length > 1) {
    throw new Error(`Duplicate recognized payload keyword: ${keyword}`);
  }
}
if (recognized.length === 0) throw new Error('No recognized chara or ccv3 payload found');

const payloads = recognized.map((entry) => ({ ...entry, decoded: decodeCardPayload(entry.text, entry.keyword) }));
const semanticDigests = payloads.map((payload) => sha256(Buffer.from(JSON.stringify(canonical(payload.decoded.parsed)))));
if (new Set(semanticDigests).size > 1) {
  throw new Error('Recognized card payloads disagree semantically');
}

fs.mkdirSync(output, { recursive: true });
const outputFiles = [];
for (let i = 0; i < payloads.length; i += 1) {
  const payload = payloads[i];
  const base = `payload-${payload.keyword}`;
  const rawPath = path.join(output, `${base}.raw.json`);
  const normalizedPath = path.join(output, `${base}.normalized.json`);
  atomicWrite(rawPath, payload.decoded.raw);
  atomicWrite(normalizedPath, `${JSON.stringify(payload.decoded.parsed, null, 2)}\n`);
  outputFiles.push({
    keyword: payload.keyword,
    sourceChunkIndex: payload.chunkIndex,
    raw: path.basename(rawPath),
    rawSha256: sha256(payload.decoded.raw),
    normalized: path.basename(normalizedPath),
    normalizedSha256: sha256(fs.readFileSync(normalizedPath)),
    semanticSha256: semanticDigests[i],
    spec: payload.decoded.parsed?.spec ?? null,
    specVersion: payload.decoded.parsed?.spec_version ?? null,
  });
}

const stat = fs.statSync(input);
const manifest = {
  extractor: {
    id: 'png-card-audit.mjs',
    version: 1,
    node: process.version,
    arguments: { input, output },
  },
  source: {
    basename: path.basename(input),
    absolutePath: input,
    bytes: source.length,
    mtimeUtc: stat.mtime.toISOString(),
    sha256: sha256(source),
  },
  png: {
    signatureValid: true,
    crcValid: true,
    terminalIend: true,
    chunkCount: chunks.length,
    chunks,
  },
  textualPayloads: textChunks.map(({ text, ...entry }) => ({ ...entry, recognized: ['chara', 'ccv3'].includes(entry.keyword) })),
  cardPayloads: outputFiles,
  semanticAgreement: new Set(semanticDigests).size === 1,
};

const manifestPath = path.join(output, 'png-audit-manifest.json');
atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  sourceSha256: manifest.source.sha256,
  sourceBytes: manifest.source.bytes,
  chunkCount: manifest.png.chunkCount,
  textPayloads: manifest.textualPayloads.map(({ keyword, type, textLength, recognized }) => ({ keyword, type, textLength, recognized })),
  cardPayloads: manifest.cardPayloads,
  manifest: manifestPath,
}, null, 2));
