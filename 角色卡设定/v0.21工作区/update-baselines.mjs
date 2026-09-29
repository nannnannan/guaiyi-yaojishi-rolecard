import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const workspace = path.resolve(root, '../..');
const walk = dir => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => ['node_modules', '.git'].includes(e.name) ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]).sort();

const ledger = JSON.parse(fs.readFileSync('来源台账.json', 'utf8'));
ledger.baselines = ledger.baselines.map(b => {
  const dir = path.join(workspace, b.root);
  const files = walk(dir);
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  for (const f of files) {
    const body = fs.readFileSync(f);
    bytes += body.length;
    hash.update(path.relative(dir, f).replaceAll('\\', '/') + '\0');
    hash.update(body);
    hash.update('\0');
  }
  return { root: b.root, files: files.length, bytes, sha256: hash.digest('hex') };
});

fs.writeFileSync('来源台账.json', JSON.stringify(ledger, null, 2) + '\n');
console.log('Baselines updated successfully:', ledger.baselines);
