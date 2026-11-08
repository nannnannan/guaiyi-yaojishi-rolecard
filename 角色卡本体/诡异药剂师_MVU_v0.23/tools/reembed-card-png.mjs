import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const distJson = path.join(ROOT, 'dist/诡异药剂师_v0.23.json');
const distPng = path.join(ROOT, 'dist/诡异药剂师_v0.23.png');
const tmpPng = path.join(ROOT, 'dist/诡异药剂师_v0.23.tmp.png');
const reembedScript = path.resolve(ROOT, '../../项目交接/样例卡_道渊_超级大卡逆向_2026-08-09/tools/reembed-card-png.mjs');

if (fs.existsSync(tmpPng)) {
  fs.unlinkSync(tmpPng);
}

console.log('Re-embedding dist/诡异药剂师_v0.23.json into dist/诡异药剂师_v0.23.png...');
const stdout = execSync(`node "${reembedScript}" "${distPng}" "${distJson}" "${tmpPng}"`, { encoding: 'utf8' });
console.log('Reembed tool output:\n', stdout.trim());

// Atomically overwrite target PNG
fs.copyFileSync(tmpPng, distPng);
fs.unlinkSync(tmpPng);

// Verify extraction parity
const jsonBuffer = fs.readFileSync(distJson);
const pngBuffer = fs.readFileSync(distPng);

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const jsonSha256 = sha256(jsonBuffer);
const pngSha256 = sha256(pngBuffer);

const b64Json = Buffer.from(jsonBuffer.toString('base64'), 'ascii');
const pngContainsJson = pngBuffer.includes(b64Json);

let offset = 8;
let extractedPayload = null;
while (offset < pngBuffer.length) {
  const length = pngBuffer.readUInt32BE(offset);
  const type = pngBuffer.subarray(offset + 4, offset + 8).toString('ascii');
  const dataStart = offset + 8;
  const dataEnd = dataStart + length;
  if (type === 'tEXt') {
    const data = pngBuffer.subarray(dataStart, dataEnd);
    const nul = data.indexOf(0);
    const keyword = data.subarray(0, nul).toString('latin1');
    if (keyword === 'chara') {
      const b64Text = data.subarray(nul + 1).toString('ascii');
      extractedPayload = Buffer.from(b64Text, 'base64');
    }
  }
  offset = dataEnd + 4;
  if (type === 'IEND') break;
}

const parity = extractedPayload && extractedPayload.equals(jsonBuffer);
const extractedSha256 = extractedPayload ? sha256(extractedPayload) : null;

console.log(JSON.stringify({
  status: parity && pngContainsJson ? 'parity_verified' : 'parity_failed',
  distJson: {
    size: jsonBuffer.length,
    sha256: jsonSha256
  },
  distPng: {
    size: pngBuffer.length,
    sha256: pngSha256
  },
  extractedPayload: {
    size: extractedPayload ? extractedPayload.length : 0,
    sha256: extractedSha256,
    byteIdentical: parity
  },
  pngContainsBase64: pngContainsJson
}, null, 2));

if (!parity || !pngContainsJson) {
  console.error('ERROR: Extraction parity verification failed!');
  process.exit(1);
} else {
  console.log('SUCCESS: Byte-for-byte extraction parity verified 100%!');
}
