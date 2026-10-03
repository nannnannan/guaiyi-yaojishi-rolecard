import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ledger = JSON.parse(fs.readFileSync('来源台账.json', 'utf8'));

const results = [];
for (const event of ledger.events) {
  if (!fs.existsSync(event.output)) {
    results.push({ id: event.id, status: 'missing' });
    continue;
  }
  const body = fs.readFileSync(event.output, 'utf8');
  const prose = body.match(/- 默认走向：([\s\S]*?)\r?\n- 紧迫度：/)?.[1] || '';
  const count = [...prose.replace(/\s/g, '')].length;
  const beeps = [...body.matchAll(/哔/g)].map(m => m[0]);
  const hasMeta = /第\s*[\d一二三四五六七八九十百千]+\s*章|小总结|阶段[一二三四五六七八九十]/u.test(body);
  const playerSovereigntyIssues = [...prose.matchAll(/林恩(?:心中|暗想|心想|决定|感到|意识到|认为|打算)/g)].map(m => m[0]);
  
  results.push({
    id: event.id,
    title: event.title,
    chars: count,
    major: !!event.major,
    needExpand: count < 1000,
    beeps: beeps.length,
    hasMeta,
    playerSovereigntyIssues
  });
}

console.log(JSON.stringify(results, null, 2));
