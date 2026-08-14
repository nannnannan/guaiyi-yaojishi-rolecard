#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const denyTerms = [];
for (let index = 2; index < process.argv.length; index++) {
  if (process.argv[index] !== '--deny' || !process.argv[index + 1]) {
    console.error('Usage: node scripts/audit-privacy.mjs [--deny <text>]...');
    process.exit(2);
  }
  denyTerms.push(process.argv[++index]);
}

const forbiddenDirs = new Set(['node_modules', 'backups', 'screenshots', 'captures', 'logs']);
const textExtensions = new Set(['', '.md', '.mjs', '.js', '.json', '.yaml', '.yml', '.txt', '.example']);
const findings = [];

function visit(path) {
  for (const name of readdirSync(path)) {
    const fullPath = join(path, name);
    const rel = relative(skillRoot, fullPath);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (forbiddenDirs.has(name)) findings.push({ file: rel, issue: 'generated/private directory is packaged' });
      else visit(fullPath);
      continue;
    }
    if (!textExtensions.has(extname(name).toLowerCase())) continue;
    const text = readFileSync(fullPath, 'utf8');
    if (/[A-Za-z]:[\\/]+Users[\\/]+(?!<[^>]+>)[^\\/\r\n"'`]+/i.test(text)) {
      findings.push({ file: rel, issue: 'absolute Windows user path' });
    }
    if (/(?:^|[\s"'`])\/(?:home|Users)\/(?!<[^>]+>)[^/\s"'`]+/m.test(text)) {
      findings.push({ file: rel, issue: 'absolute POSIX user path' });
    }
    if (/\b[a-f0-9]{64}\b/i.test(text)) findings.push({ file: rel, issue: 'stored SHA-256-like fingerprint' });
    for (const term of denyTerms) {
      if (term && text.includes(term)) findings.push({ file: rel, issue: `deny term found: ${term}` });
    }
  }
}

visit(skillRoot);
if (findings.length) {
  console.error(JSON.stringify({ passed: false, findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ passed: true, scannedRoot: '.', denyTerms: denyTerms.length }, null, 2));
