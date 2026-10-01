// 一次性 codemod：为 src/concepts/**/*.md 追加「大纲路由」静态补块。
// 设计约束（来自 tools/validate.mjs 断言）：
//   - 变体形态：兜底块须含「事件演进」「当前状态」各一次；渲染后恰好一个「## 变体·」；EJS 只读事件状态。
//   - 增量形态：正文 ≥350 字符；EJS 只读事件状态。
//   - 静态形态：含 detailed_static_format 七字段各一次。
// 因此补块必须是：纯静态 markdown、无 `<%`、无 `##` 标题（用 `###`）、无长破折号变体关键字。
// 路由数据全部来自真实出处的 NER：概念名 / 角色名 / 势力名 / 场景名 / 世界书 event_ids。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const MARKER = '<!-- tavernweave:routing v1 -->';

function walk(d) {
  let r = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) r = r.concat(walk(p));
    else if (e.name.endsWith('.md')) r.push(p);
  }
  return r;
}

const wb = JSON.parse(readFileSync('src/worldbook.json', 'utf8'));
const concepts = wb.entries.filter(e => (e.comment || '').startsWith('[概念'));

// content_file -> { name, eventIds }
const fileMeta = new Map();
for (const e of concepts) {
  fileMeta.set(e.content_file, {
    name: e.comment.replace(/^\[概念·[^\]]+\]/, '').trim(),
    eventIds: e.extensions?.tavernweave?.event_ids ?? [],
  });
}

// 概念名集合（去自身、去重、按长度降序便于优先匹配长名）
const conceptNames = [...new Set([...fileMeta.values()].map(v => v.name))];
const conceptNamesSorted = conceptNames.sort((a, b) => b.length - a.length);

// 角色 / 势力 / 场景名录
const charNames = new Set();
for (const e of wb.entries) {
  const m = (e.comment || '').match(/^\[角色\](.+)$/);
  if (m) charNames.add(m[1].trim());
}
for (const d of readdirSync('src/characters', { withFileTypes: true })) {
  if (d.isDirectory()) charNames.add(d.name.trim());
}
const factionNames = readdirSync('src/concepts/势力').map(f => f.replace(/\.md$/, ''));
const sceneNames = readdirSync('src/concepts/场景').map(f => f.replace(/\.md$/, ''));

const charList = [...charNames].sort((a, b) => b.length - a.length);
const factionList = factionNames.sort((a, b) => b.length - a.length);
const sceneList = sceneNames.sort((a, b) => b.length - a.length);

// EJS 剥离：分析正文时不计门控内部重复出现造成的虚假命中
function stripEjs(text) {
  return text.replace(/<%[\s\S]*?%>/g, ' ');
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let n = 0, i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n += 1; i += needle.length; }
  return n;
}

function topMatches(text, names, exclude, cap) {
  const hits = [];
  for (const name of names) {
    if (exclude.has(name)) continue;
    const n = countOccurrences(text, name);
    if (n > 0) hits.push([name, n]);
  }
  hits.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  return hits.slice(0, cap).map(h => h[0]);
}

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > -1 ? process.argv.slice(i + 1) : null; })();

const files = walk('src/concepts').filter(f => !ONLY || ONLY.some(o => f.includes(o)));
let updated = 0, skipped = 0, untouched = 0;
const previews = [];
const failures = [];

for (const file of files) {
  const meta = fileMeta.get(file);
  if (!meta) { skipped += 1; failures.push(`no worldbook entry: ${file}`); continue; }
  const raw = readFileSync(file, 'utf8');
  if (raw.includes(MARKER)) { untouched += 1; continue; }

  const body = stripEjs(raw);
  const selfName = meta.name;
  const excludeSelf = new Set([selfName]);

  const relConcepts = topMatches(body, conceptNamesSorted, excludeSelf, 8);
  const relChars = topMatches(body, charList, excludeSelf, 6);
  const relFactions = topMatches(body, factionList, excludeSelf, 4);
  const relScenes = topMatches(body, sceneList, excludeSelf, 4);
  const relEvents = meta.eventIds.slice(0, 20);

  const lines = [];
  lines.push('');
  lines.push(MARKER);
  lines.push('### 大纲路由');
  lines.push('');
  lines.push('- 使用指引：本路由供大纲层面联想调用；仅在正文已实际出现或对应事件已完成/变形后引用，禁止把路由写成必然展开。林恩的对白、动作与选择由玩家主权独占。');
  lines.push(`- 相关事件：${relEvents.length ? relEvents.join('、') : '（暂无登记）'}`);
  lines.push(`- 相关概念：${relConcepts.length ? relConcepts.join('、') : '（正文暂未见其他概念互引）'}`);
  lines.push(`- 相关人物：${relChars.length ? relChars.join('、') : '（正文暂未具名登场角色）'}`);
  lines.push(`- 相关势力：${relFactions.length ? relFactions.join('、') : '（正文暂未具名势力）'}`);
  lines.push(`- 相关场景：${relScenes.length ? relScenes.join('、') : '（正文暂未具名场景）'}`);

  const trimmed = raw.replace(/\s+$/, '');
  const block = trimmed + '\n' + lines.join('\n') + '\n';
  if (DRY_RUN) {
    previews.push({ file, form: raw.includes('## 变体·') ? 'variant' : raw.includes('<%') ? 'increment' : 'static', appended: lines.join('\n') });
  } else {
    writeFileSync(file, block, 'utf8');
  }
  updated += 1;
}

console.log(JSON.stringify({ dryRun: DRY_RUN, updated, skipped, untouched, total: files.length, failures: failures.slice(0, 5) }, null, 2));
if (DRY_RUN) {
  for (const p of previews) {
    console.log('=== ' + p.file + ' [' + p.form + '] ===');
    console.log(p.appended);
  }
}
