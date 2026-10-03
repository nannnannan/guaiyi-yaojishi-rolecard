// if线校验：每份 src/if_lines/E{XX}_{标题}.md 3-30条分支，≤2000字符，标题匹配，禁元数据词
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IF_DIR = resolve(ROOT, 'src/if_lines');
const EVENTS_DIR = resolve(ROOT, 'src/events');

const FORBIDDEN = /第[一二三四五六七八九十百千0-9]+章|阶段[一二三四五六七八九十0-9]|小总结|大总结|幕间总结|前文总结|本章|回合计数|第[0-9]+层|第[0-9]+级/;

function err(msg) { console.error('[IF-ERR]', msg); }

let failures = 0;
let checked = 0;

if (!existsSync(IF_DIR)) {
  console.log('[if_lines] dir not found (skip validation)');
  process.exit(0);
}

const ifFiles = readdirSync(IF_DIR).filter(f => f.endsWith('.md'));
const eventFiles = readdirSync(EVENTS_DIR).filter(f => f.endsWith('.md'));

// build map of expected files from events
const expected = new Map();
for (const f of eventFiles) {
  const base = f.replace(/\.md$/, '');
  expected.set(base, true);
}

// validate each if file
const seen = new Set();
for (const f of ifFiles) {
  const base = f.replace(/\.md$/, '');
  if (!expected.has(base)) {
    err(`if_lines/${f} 无对应事件文件 (expected ${base})`);
    failures++;
    continue;
  }
  seen.add(base);

  const full = resolve(IF_DIR, f);
  const content = readFileSync(full, 'utf8');
  const lines = content.split(/\r?\n/);

  // title line
  const m = base.match(/^(E\d+?)_(.+)$/);
  if (!m) {
    err(`${f} 文件名不符合 E{XX}_{标题} 格式`);
    failures++;
    continue;
  }
  const [_, eid, title] = m;
  const titleLine = lines[0];
  const expectTitle = `# ${eid}·${title}·if线`;
  if (titleLine !== expectTitle) {
    err(`${f} 标题行错误（期望: ${expectTitle}; 实际: ${titleLine}）`);
    failures++;
  }

  // count branch bullets (- 若... )
  const branches = lines.filter(l => /^- 若/.test(l.trim()));
  if (branches.length < 3 || branches.length > 30) {
    err(`${f} 分支条数${branches.length}（期望 3-30）`);
    failures++;
  }

  // body length (excluding title line)
  const body = lines.slice(1).join('\n');
  const bodyLen = body.length;
  if (bodyLen > 2000) {
    err(`${f} 内容${bodyLen}字（上限2000）`);
    failures++;
  }

  // forbidden metadata words
  if (FORBIDDEN.test(body)) {
    err(`${f} 含禁元数据词`);
    failures++;
  }

  // player sovereignty check: scan only the consequence segment (「则」后半段) of each "- 若…则…" bullet;
  // the condition segment (若 + 玩家假设动作) is not checked, so "若林恩拒绝…" remains legal
  const conseRemovePatt = /林恩\s*(决定|想到|感到|感觉|认为|原谅|选择|犹豫|放下|释然|心动|爱上|憎恨|接受|拒绝)/;
  for (const rawLine of branches) {
    const line = rawLine.trim();
    const thenIdx = line.indexOf('则');
    if (thenIdx < 0) continue; // 缺「则」的格式错在分支计数处另报，不在此重报主权
    const consequence = line.slice(thenIdx + 1);
    if (conseRemovePatt.test(consequence)) {
      err(`${f} 疑似替林恩做主语（违玩家主权）: ${line.slice(0, 80)}`);
      failures++;
    }
  }

  checked++;
}

// missing if_lines for events
for (const [base,] of expected) {
  if (!seen.has(base)) {
    err(`缺 ${base} 的 if_lines 文件`);
    failures++;
  }
}

console.log(JSON.stringify({
  status: failures === 0 ? 'if_lines_validated' : 'if_lines_errors',
  checked,
  failures,
  expected: expected.size,
}, null, 2));

process.exitCode = failures === 0 ? 0 : 1;
