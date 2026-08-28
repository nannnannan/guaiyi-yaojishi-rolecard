import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [pngArg, jsonArg, outputArg] = process.argv.slice(2);
if (!pngArg || !jsonArg || !outputArg) {
  console.error('Usage: node reembed-card-png.mjs <source.png> <card.json> <output.png>');
  process.exit(2);
}
const pngPath = path.resolve(pngArg);
const jsonPath = path.resolve(jsonArg);
const outputPath = path.resolve(outputArg);
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite: ${outputPath}`);
if ([pngPath, jsonPath].includes(outputPath)) throw new Error('Output must not alias an input');
const source = fs.readFileSync(pngPath);
const jsonBytes = fs.readFileSync(jsonPath);
JSON.parse(jsonBytes.toString('utf8'));
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (!source.subarray(0, 8).equals(signature)) throw new Error('Invalid PNG signature');

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return out;
}

const chunks = [signature];
const replaced = [];
let offset = 8;
while (offset < source.length) {
  if (source.length - offset < 12) throw new Error(`Truncated PNG at ${offset}`);
  const length = source.readUInt32BE(offset);
  const type = source.subarray(offset + 4, offset + 8).toString('ascii');
  const dataStart = offset + 8;
  const dataEnd = dataStart + length;
  const next = dataEnd + 4;
  if (next > source.length) throw new Error(`Chunk ${type} exceeds source bounds`);
  const originalChunk = source.subarray(offset, next);
  const data = source.subarray(dataStart, dataEnd);
  const storedCrc = source.readUInt32BE(dataEnd);
  if (storedCrc !== crc32(source.subarray(offset + 4, dataEnd))) throw new Error(`CRC mismatch in source ${type}`);
  let outputChunk = originalChunk;
  if (type === 'tEXt') {
    const nul = data.indexOf(0);
    if (nul < 0) throw new Error('Malformed tEXt chunk');
    const keyword = data.subarray(0, nul).toString('latin1');
    if (['chara', 'ccv3'].includes(keyword)) {
      const payload = Buffer.from(jsonBytes.toString('base64'), 'ascii');
      const replacementData = Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), payload]);
      outputChunk = makeChunk(type, replacementData);
      replaced.push(keyword);
    }
  }
  chunks.push(outputChunk);
  offset = next;
  if (type === 'IEND') break;
}
if (offset !== source.length) throw new Error('Trailing bytes after IEND');
if (replaced.length === 0) throw new Error('No recognized tEXt card payload replaced');
const output = Buffer.concat(chunks);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, { flag: 'wx' });
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({
  source: { path: pngPath, bytes: source.length, sha256: sha256(source) },
  card: { path: jsonPath, bytes: jsonBytes.length, sha256: sha256(jsonBytes) },
  output: { path: outputPath, bytes: output.length, sha256: sha256(output) },
  replaced,
  byteIdenticalToSource: source.equals(output),
}, null, 2));
