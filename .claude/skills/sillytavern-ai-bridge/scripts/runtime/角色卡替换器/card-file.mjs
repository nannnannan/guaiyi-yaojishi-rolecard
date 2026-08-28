import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let k = 0; k < 8; k++) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xFFFFFFFF;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xFF] ^ (value >>> 8);
  return (value ^ 0xFFFFFFFF) >>> 0;
}

function parseChunks(buffer) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('文件不是有效 PNG');
  }
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error('PNG 数据块长度越界');
    chunks.push({
      type: buffer.toString('ascii', offset + 4, offset + 8),
      data: buffer.subarray(offset + 8, offset + 8 + length),
      raw: buffer.subarray(offset, end),
    });
    offset = end;
  }
  if (!chunks.some((chunk) => chunk.type === 'IEND')) throw new Error('PNG 缺少 IEND 数据块');
  return chunks;
}

function decodeTextChunk(chunk) {
  const zero = chunk.data.indexOf(0);
  if (zero < 0) return null;
  const keyword = chunk.data.subarray(0, zero).toString('latin1');
  if (chunk.type === 'tEXt') {
    return { keyword, text: chunk.data.subarray(zero + 1).toString('latin1') };
  }
  if (chunk.type === 'zTXt') {
    const compressed = chunk.data.subarray(zero + 2);
    return { keyword, text: inflateSync(compressed).toString('utf8') };
  }
  if (chunk.type === 'iTXt') {
    let offset = zero + 1;
    const compressed = chunk.data[offset++] === 1;
    offset += 1; // compression method
    const languageEnd = chunk.data.indexOf(0, offset);
    if (languageEnd < 0) return null;
    offset = languageEnd + 1;
    const translatedEnd = chunk.data.indexOf(0, offset);
    if (translatedEnd < 0) return null;
    offset = translatedEnd + 1;
    const payload = chunk.data.subarray(offset);
    return { keyword, text: compressed ? inflateSync(payload).toString('utf8') : payload.toString('utf8') };
  }
  return null;
}

function decodeCardPayload(text, keyword) {
  try {
    return JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
  } catch (error) {
    throw new Error(`PNG 的 ${keyword} 角色卡数据无法解析：${error?.message || error}`);
  }
}

export function parsePngCardBuffer(buffer) {
  const chunks = parseChunks(buffer);
  const payloads = new Map();
  for (const chunk of chunks) {
    if (!['tEXt', 'zTXt', 'iTXt'].includes(chunk.type)) continue;
    const decoded = decodeTextChunk(chunk);
    if (decoded && (decoded.keyword === 'chara' || decoded.keyword === 'ccv3')) {
      payloads.set(decoded.keyword, decoded.text);
    }
  }
  const keyword = payloads.has('ccv3') ? 'ccv3' : payloads.has('chara') ? 'chara' : null;
  if (!keyword) throw new Error('PNG 中未找到 chara/ccv3 角色卡数据块');
  return { card: decodeCardPayload(payloads.get(keyword), keyword), chunks, keyword };
}

function makeTextChunk(keyword, text) {
  const type = Buffer.from('tEXt', 'ascii');
  const data = Buffer.concat([Buffer.from(`${keyword}\0`, 'latin1'), Buffer.from(text, 'utf8')]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}

export function embedCardInPng(basePng, card) {
  const chunks = parseChunks(basePng);
  const v3 = { ...card, spec: 'chara_card_v3', spec_version: '3.0' };
  const payloads = [
    makeTextChunk('chara', Buffer.from(JSON.stringify(card), 'utf8').toString('base64')),
    makeTextChunk('ccv3', Buffer.from(JSON.stringify(v3), 'utf8').toString('base64')),
  ];
  const output = [PNG_SIGNATURE];
  let iend = null;
  for (const chunk of chunks) {
    if (chunk.type === 'IEND') {
      iend = chunk.raw;
      continue;
    }
    if (['tEXt', 'zTXt', 'iTXt'].includes(chunk.type)) {
      const decoded = decodeTextChunk(chunk);
      if (decoded && (decoded.keyword === 'chara' || decoded.keyword === 'ccv3')) continue;
    }
    output.push(chunk.raw);
  }
  output.push(...payloads, iend);
  return Buffer.concat(output);
}

export function getCardData(card) {
  return card?.data && typeof card.data === 'object' ? card.data : card;
}

export function getCardName(card) {
  const data = getCardData(card);
  return String(data?.name || card?.name || '').trim();
}

export function getBoundWorldbookName(card) {
  const data = getCardData(card);
  return String(data?.extensions?.world || '').trim();
}

export function getEmbeddedWorldbook(card) {
  const data = getCardData(card);
  const book = data?.character_book;
  if (!book || typeof book !== 'object' || !Array.isArray(book.entries)) return null;
  const name = String(book.name || data.extensions?.world || '').trim();
  return name ? { name, entries: book.entries, entryCount: book.entries.length, raw: book } : null;
}

export function prepareReplacementCard(card, preservedChatId = null) {
  const cloned = structuredClone(card);
  const data = getCardData(cloned);
  const name = getCardName(cloned);
  if (!name) throw new Error('新角色卡缺少 name');
  cloned.name = name;
  data.name = name;
  if (preservedChatId) {
    cloned.chat = preservedChatId;
    data.chat = preservedChatId;
  }
  return cloned;
}

export function summarizeCard(card) {
  const data = getCardData(card);
  const book = getEmbeddedWorldbook(card);
  return {
    name: getCardName(card),
    version: String(data?.character_version || card?.character_version || ''),
    descriptionLength: String(data?.description || card?.description || '').length,
    firstMessageLength: String(data?.first_mes || card?.first_mes || '').length,
    alternateGreetingCount: Array.isArray(data?.alternate_greetings) ? data.alternate_greetings.length : 0,
    worldbookName: book?.name ?? String(data?.extensions?.world || ''),
    worldbookEntryCount: book?.entryCount ?? 0,
    regexCount: Array.isArray(data?.extensions?.regex_scripts) ? data.extensions.regex_scripts.length : 0,
    helperScriptCount: Array.isArray(data?.extensions?.tavern_helper?.scripts) ? data.extensions.tavern_helper.scripts.length : 0,
  };
}

export function loadCardFile(filePath) {
  const path = resolve(filePath);
  const extension = extname(path).toLowerCase();
  const bytes = readFileSync(path);
  let card;
  let sourcePng = null;
  if (extension === '.json') {
    try {
      card = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      throw new Error(`无法解析角色卡 JSON：${error?.message || error}`);
    }
  } else if (extension === '.png') {
    sourcePng = bytes;
    card = parsePngCardBuffer(bytes).card;
  } else {
    throw new Error('角色卡替换目前支持 .json 和 .png');
  }
  const name = getCardName(card);
  if (!name) throw new Error('文件不是有效角色卡：缺少 name');
  return {
    path,
    extension,
    bytes,
    sourcePng,
    card,
    summary: summarizeCard(card),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  return createHash('sha256').update(bytes).digest('hex');
}
