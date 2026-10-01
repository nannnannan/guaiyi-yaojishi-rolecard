// Scan E2xx events, count CJK chars in 默认走向 field, list those < 1000 sorted ascending
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'C:/Users/huang/Desktop/诡异药剂师_v0.20/角色卡本体/诡异药剂师_MVU_v0.23/src/events';
const files = readdirSync(dir).filter(f => /^E2\d{2}_/.test(f)).sort();

function cjkCount(s) {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0x20000 && cp <= 0x2A6DF)) n++;
  }
  return n;
}

const rows = [];
for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8');
  // match "- 默认走向：xxx" up to next "- " list item
  const m = text.match(/- 默认走向：([\s\S]*?)(?=\n- )/);
  if (!m) { rows.push({ file: f, err: 'no field' }); continue; }
  const body = m[1].replace(/\s+/g, '');
  const n = cjkCount(body);
  // detect if major (next-event section has many lines)
  const major = /重大|高潮|大战|决战|危机|封王|王座|黑火/.test(text) ? '' : '';
  rows.push({ file: f, n });
}

const under = rows.filter(r => !r.err && r.n < 1000).sort((a, b) => a.n - b.n);
console.log(`TOTAL E2xx files: ${files.length}`);
console.log(`UNDER 1000 CJK: ${under.length}`);
for (const r of under) console.log(`${String(r.n).padStart(5)}  ${r.file}`);
