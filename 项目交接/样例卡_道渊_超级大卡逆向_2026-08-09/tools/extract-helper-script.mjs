import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [cardArg, scriptName, outputArg] = process.argv.slice(2);
if (!cardArg || !scriptName || !outputArg) {
  console.error('Usage: node extract-helper-script.mjs <card.json> <script-name> <output-file>');
  process.exit(2);
}

const cardPath = path.resolve(cardArg);
const outputPath = path.resolve(outputArg);
if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite: ${outputPath}`);
const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
const scripts = card.data?.extensions?.tavern_helper?.scripts ?? [];
const matches = scripts.filter((script) => script.name === scriptName);
if (matches.length !== 1) throw new Error(`Expected one script named ${scriptName}, found ${matches.length}`);
const content = String(matches[0].content ?? '');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, content, { flag: 'wx' });
console.log(JSON.stringify({
  name: scriptName,
  id: matches[0].id ?? null,
  enabled: matches[0].enabled ?? null,
  source: `/data/extensions/tavern_helper/scripts/${scripts.indexOf(matches[0])}/content`,
  output: outputPath,
  bytes: Buffer.byteLength(content),
  sha256: crypto.createHash('sha256').update(content).digest('hex'),
}, null, 2));
