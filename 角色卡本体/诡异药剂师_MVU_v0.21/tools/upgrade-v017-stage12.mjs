// v0.17 阶段十二接线：E397—E434 + 概念/人物/NPC + 注册表与校验边界
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = resolve(ROOT, '../../角色卡设定/v0.17工作区');
const WORKSPACE_V016 = resolve(ROOT, '../../角色卡设定/v0.16工作区');
const EVENT_START = 397;
const EVENT_END = 434;
const EVENT_IDS = Array.from({ length: EVENT_END - EVENT_START + 1 }, (_, i) => `E${EVENT_START + i}`);
const BACKFILL_START = 349;
const BACKFILL_END = 396;
const BACKFILL_IDS = Array.from({ length: BACKFILL_END - BACKFILL_START + 1 }, (_, i) => `E${BACKFILL_START + i}`);
const PHASES = {
  S53: { name: '残魂与新生来客', start: 397, end: 401, line: '渡鸦残躯读取、夏娃降临与家庭接触、血肉分析私人订制与血谷定位。' },
  S54: { name: '蠕动之城与四线战场', start: 402, end: 405, line: '第九根源与蠕动之城、命运羽毛笔干涉、狱卒尸骸爆破与四线战场展开。' },
  S55: { name: '血肉陨落与船长约言', start: 406, end: 410, line: '旧书牵制与孽主退出、渡鸦屏障、血肉支配者陨落、诸天狱卒康斯坦丁与旧日血肉之核。' },
  S56: { name: '深渊遗产与自然蜕变', start: 411, end: 415, line: '无尽深渊与往昔、古老堕落之心、母树自然蜕变、无序三柱与第二职业旧身体。' },
  S57: { name: '时间裂隙与罪孽城', start: 416, end: 420, line: '时间污染者、裂隙任务、未来苍蓝身影、罪孽城招募与公开惩罚。' },
  S58: { name: '血族诅咒与时间战争', start: 421, end: 429, line: '血族诅咒压制、紫黑病变、鲜血孽灵、黑夜城增援、未来林恩、时间战争、孽主反应与无尽海域起航。' },
  S59: { name: '深海遗忘与八旗围困', start: 430, end: 434, line: '深海吞噬者、西海叛乱、遗忘法则、深海电码与第二渡鸦、灭绝令与八旗牢笼。' },
};
const NEW_CONCEPT_START = 1284;
const NEW_CONCEPT_END = 1320;
const NEW_CONCEPT_UID_START = 2573;
const NEW_NPCS = [
  { name: '夏娃', file: '夏娃.md', entry_id: 307 },
  { name: '康斯坦丁', file: '康斯坦丁.md', entry_id: 308 },
  { name: '第一使徒', file: '第一使徒.md', entry_id: 309 },
  { name: '孽主', file: '孽主.md', entry_id: 310 },
  { name: '弑利亚', file: '弑利亚.md', entry_id: 311 },
  { name: '大黑彘', file: '大黑彘.md', entry_id: 312 },
  { name: '血娃娃与母亲', file: '血娃娃与母亲.md', entry_id: 313 },
  { name: '未来画家', file: '未来画家.md', entry_id: 314 },
  { name: '艾泽法拉', file: '艾泽法拉_深海联络.md', entry_id: 315 },
];

function readText(rel) {
  const full = rel.startsWith('/') ? rel : resolve(ROOT, rel);
  return readFileSync(full, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}
function writeText(rel, text) {
  const full = rel.startsWith('/') ? rel : resolve(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}
function readJson(rel) { return JSON.parse(readText(rel)); }
function writeJson(rel, value) { writeText(rel, JSON.stringify(value, null, 2)); }
function relFrom(file) { return relative(ROOT, file).replaceAll('\\', '/'); }
function allFiles(dir) {
  const result = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, ent.name);
    if (ent.isDirectory()) result.push(...allFiles(full));
    else result.push(full);
  }
  return result;
}
function replaceOnce(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`未找到接线位置：${label}`);
  return next;
}
function eventFileFor(id) {
  const dir = resolve(ROOT, 'src/events');
  const file = readdirSync(dir).find(name => name.startsWith(`${id}_`) && name.endsWith('.md'));
  if (!file) throw new Error(`缺少事件文件：${id}`);
  return `src/events/${file}`;
}
function titleFromEventFile(id) {
  const text = readText(eventFileFor(id));
  const match = text.match(new RegExp(`^# ${id}·([^\\n]+)$`, 'm'));
  if (!match) throw new Error(`事件标题缺失：${id}`);
  return match[1].trim();
}
function extractEventsFromText(text) {
  return [...new Set([...text.matchAll(/锚点状态\.(E\d+)/g)].map(m => m[1]))]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}
function stableKeys(name, usedKeys, logicalId) {
  const candidates = name.length <= 6 ? [name] : [name.slice(0, 6), name];
  return candidates.map(candidate => {
    let key = candidate;
    if (usedKeys.has(key)) key = `${candidate}(${logicalId})`;
    while (usedKeys.has(key)) key = `${key}*`;
    usedKeys.add(key);
    return key;
  });
}
function parseConceptHeading(text) {
  const match = text.match(/^# 概念·([^·\r\n]+)·(.+?)（事件(\[[^\r\n]+\])）\s*$/m);
  if (!match) return null;
  let eventIds;
  try { eventIds = JSON.parse(match[3]); } catch { return null; }
  if (!Array.isArray(eventIds) || eventIds.length === 0) return null;
  return { category: match[1], name: match[2], eventIds, full: match[0] };
}
function bridgeFields(fromId) {
  const source = readText(eventFileFor(fromId));
  const section = source.match(/## 下一事件引入[^\n]*\n([\s\S]*?)(?=\n<%_|$)/)?.[1] ?? '';
  const get = label => section.match(new RegExp(`^- ${label}：([^\\n]*)`, 'm'))?.[1]?.trim();
  return {
    trigger: get('触发时机'),
    lead: get('剧情引子'),
    omen: get('预兆写法'),
    causal: get('承接因果'),
  };
}
function ctxLineFromBridge(id, title, nextId, nextTitle, summaryText) {
  if (!nextId) return `${summaryText}（本版终点）`;
  const short = summaryText.length > 60 ? `${summaryText.slice(0, 58)}…` : summaryText;
  return `${short} → ${nextId}${nextTitle}`;
}

const delivery = JSON.parse(readText(resolve(WORKSPACE, '交付清单.json')));
const summariesV017 = JSON.parse(readText(resolve(WORKSPACE, '摘要/事件摘要.json')));
const bridgesV017 = JSON.parse(readText(resolve(WORKSPACE, '摘要/衔接表.json')));
const summariesV016 = existsSync(resolve(WORKSPACE_V016, '摘要/事件摘要.json'))
  ? JSON.parse(readText(resolve(WORKSPACE_V016, '摘要/事件摘要.json')))
  : [];
const summaryMap = new Map([...summariesV016, ...summariesV017].map(s => [s.id, s]));

console.log('[1/12] 复制事件并统一阶段字段…');
for (const ev of delivery.events) {
  const src = resolve(WORKSPACE, ev.output);
  const dest = resolve(ROOT, 'src/events', ev.output.split('/').pop());
  copyFileSync(src, dest);
}
for (const [phaseId, phase] of Object.entries(PHASES)) {
  for (let n = phase.start; n <= phase.end; n += 1) {
    const id = `E${n}`;
    const path = eventFileFor(id);
    let text = readText(path);
    if (text.includes(`- 阶段：${phaseId}·${phase.name}`)) continue;
    text = replaceOnce(text, /^- 阶段：[^\n]*$/m, `- 阶段：${phaseId}·${phase.name}`, `${id} 阶段字段`);
    writeText(path, text);
  }
}

const EVENT_TITLES = Object.fromEntries(
  [...BACKFILL_IDS, ...EVENT_IDS].map(id => [id, titleFromEventFile(id)]),
);

console.log('[2/12] E396→E397 衔接…');
{
  const path = eventFileFor('E396');
  let text = readText(path);
  const bridge = bridgesV017;
  const lead = '渡鸦残魂仍在，巨像之脑感知到同源微光；住宅内出现继续读取的机会。';
  const omen = '只写残魂微光、承载余温与同伴戒备，不提前展开旧日战争影像或夏娃来客。';
  const causal = 'E396确认的血肉承载与力量适应，为继续接触渡鸦残魂与细胞记忆提供条件；是否读取仍由玩家决定。';
  const trigger = 'E396已完成、变形、取消或活跃且收尾，E397尚未触发或处于预兆；渡鸦残魂仍可接触，玩家愿意检查或巨像之脑提示其气息。';
  if (!text.includes('## 下一事件引入（E397·')) {
    const block = `\n## 下一事件引入（E397·${EVENT_TITLES.E397}）\n- 触发时机：${trigger}\n- 剧情引子：${lead}\n- 预兆写法：${omen}\n- 承接因果：${causal}\n`;
    text = replaceOnce(text, /\n<%_ \} _%>\s*$/, `${block}\n<%_ } _%>`, 'E396→E397 bridge');
  }
  text = text
    .replace(/本版终点|开放终点|后续事件不在本版/g, (m) => m.includes('终点') ? '阶段收束' : m)
    .replace(/不创建E397[^\n]*/g, 'E397由下一事件引入段承接。');
  // soften any freeze wording without inventing metadata leaks
  writeText(path, text);
}

console.log('[3/12] 合并概念增量与新概念…');
const conceptUpdates = delivery.concepts.filter(c => c.kind === 'update');
const conceptNews = delivery.concepts.filter(c => c.kind === 'new');
for (const item of conceptUpdates) {
  const baseRel = item.base_path.replace('角色卡本体/诡异药剂师_MVU_v0.16/', '');
  const basePath = resolve(ROOT, baseRel);
  if (!existsSync(basePath)) throw new Error(`概念基线缺失：${baseRel}`);
  let base = readText(basePath);
  const incr = readText(resolve(WORKSPACE, item.output)).trim();
  const heading = parseConceptHeading(base);
  const incrEvents = extractEventsFromText(incr);
  if (!heading) throw new Error(`无法解析概念标题：${baseRel}`);
  const mergedEvents = [...new Set([...heading.eventIds, ...incrEvents])]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const newHeading = `# 概念·${heading.category}·${heading.name}（事件${JSON.stringify(mergedEvents)}）`;
  base = base.replace(heading.full, newHeading);
  for (const ev of incrEvents) {
    if (base.includes(`锚点状态.${ev}.状态`)) continue;
  }
  // append only blocks not already present (by event id marker)
  const blocks = incr.split(/(?=<%_ if )/g).map(s => s.trim()).filter(Boolean);
  let appended = base.trimEnd();
  for (const block of blocks) {
    const ev = block.match(/锚点状态\.(E\d+)/)?.[1];
    if (ev && appended.includes(`# ${item.id}·`) && appended.includes(`·${ev}`)) {
      // already has this event section
      const marker = `·${ev}\n`;
      if (appended.includes(`# ${item.id}·`) && appended.includes(marker)) continue;
    }
    if (ev && appended.includes(`锚点状态.${ev}.状态`) && appended.includes(`# ${item.id}·`)) {
      // heuristic: if same event gate for this concept id exists, skip
      const re = new RegExp(`# ${item.id}·[^\\n]*·${ev}\\b`);
      if (re.test(appended)) continue;
    }
    appended += `\n\n${block.trim()}\n`;
  }
  writeText(baseRel, appended);
}
for (const item of conceptNews) {
  const incr = readText(resolve(WORKSPACE, item.output)).trim();
  const events = item.source_events?.length ? item.source_events : extractEventsFromText(incr);
  const firstCat = incr.match(/- 类别：([^\n]+)/)?.[1]?.trim() || '机制';
  const heading = `# 概念·${firstCat}·${item.title}（事件${JSON.stringify(events)}）\n\n`;
  const outName = item.output.split('/').pop();
  writeText(`src/concepts/${outName}`, heading + incr + '\n');
}

console.log('[4/12] 合并人物增量与新NPC…');
const personaRecords = [];
const charEventAdds = new Map();
function appendCharacterIncrement(targetRel, sourceRel, events) {
  let target = existsSync(resolve(ROOT, targetRel)) ? readText(targetRel).trimEnd() : '';
  const source = readText(resolve(WORKSPACE, sourceRel)).trim();
  const blocks = source.split(/(?=<%_ if )/g).map(s => s.trim()).filter(Boolean);
  for (const block of blocks) {
    const ev = block.match(/锚点状态\.(E\d+)/)?.[1];
    if (!ev) continue;
    if (target.includes(block.slice(0, Math.min(80, block.length))) && target.includes(`锚点状态.${ev}.状态`)) {
      // already present
      continue;
    }
    // if event section already in target for similar heading, still append if exact block missing
    if (!target.includes(block)) target += `\n\n${block}\n`;
  }
  writeText(targetRel, target + '\n');
  return blocks;
}
const CHAR_TARGET = {
  巨像之脑: 'src/characters/巨像之脑/多阶段人设.md',
  艾雯爵士: 'src/characters/艾雯爵士/多阶段人设.md',
  自缚天使: 'src/characters/倒吊天使/多阶段人设.md',
  人偶家: 'src/characters/人偶家/多阶段人设.md',
  喵喵: 'src/characters/喵喵/多阶段人设.md',
  小小: 'src/characters/小小/多阶段人设.md',
  血锯: 'src/characters/血锯/多阶段人设.md',
  黑弦月: 'src/characters/黑弦月/多阶段人设.md',
  爱丽丝: 'src/characters/爱丽丝/多阶段人设.md',
  血肉支配者: 'src/characters/血肉支配者/多阶段人设.md',
  泰坦头颅: 'src/characters/泰坦头颅/多阶段人设.md',
  巫神头颅: 'src/characters/巫神头颅/多阶段人设.md',
  哭泣小丑: 'src/characters/哭泣小丑/多阶段人设.md',
  欲望母树: 'src/characters/欲望母树/多阶段人设.md',
  左左: 'src/characters/左左/多阶段人设.md',
};
for (const ch of delivery.characters) {
  if ((ch.output || '').startsWith('人物增量/')) {
    const target = CHAR_TARGET[ch.name];
    if (!target) throw new Error(`人物目标未映射：${ch.name}`);
    appendCharacterIncrement(target, ch.output, ch.source_events || []);
    const events = extractEventsFromText(readText(resolve(WORKSPACE, ch.output)));
    const coreName = ch.name === '自缚天使' ? '倒吊天使' : ch.name;
    const prev = charEventAdds.get(coreName) || [];
    charEventAdds.set(coreName, [...new Set([...prev, ...events])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
    personaRecords.push({
      source: `角色卡设定/v0.17工作区/${ch.output}`,
      target,
      events,
      mode: 'source_sync',
      adapted_events: [],
    });
  }
}
for (const npc of NEW_NPCS) {
  const src = resolve(WORKSPACE, 'NPC', npc.file);
  const body = readText(src).trim();
  const out = `src/characters/${npc.name}/NPC.md`;
  writeText(out, `# ${npc.name}\n\n${body}\n`);
}

console.log('[5/12] schema / initvar / status…');
{
  let schema = readText('src/scripts/schema.js');
  schema = schema.replaceAll('诡异药剂师v0.16', '诡异药剂师v0.17')
    .replace("卡名: z.literal('《诡异药剂师》v0.16')", "卡名: z.literal('《诡异药剂师》v0.17')")
    .replace("版本: z.literal('0.16.0')", "版本: z.literal('0.17.0')");
  if (!schema.includes('S53:')) {
    const phaseLines = Object.entries(PHASES).map(([id, v]) => `  ${id}: '${v.name}',`).join('\n');
    schema = replaceOnce(schema, /(  S52: '[^']*',\n)(\};)/, `$1${phaseLines}\n$2`, 'schema phaseNames');
  }
  if (!schema.includes('E397:')) {
    const allNew = [...BACKFILL_IDS.filter(id => !schema.includes(`  ${id}:`)), ...EVENT_IDS];
    // only add E397+ if E349 already present; else add both
    const missing = [...BACKFILL_IDS, ...EVENT_IDS].filter(id => !schema.includes(`  ${id}: '`));
    if (missing.length) {
      const titleLines = missing.map(id => `  ${id}: '${EVENT_TITLES[id]}',`).join('\n');
      const lastExisting = [...BACKFILL_IDS, ...EVENT_IDS].reverse().find(id => schema.includes(`  ${id}: '`)) 
        || 'E396';
      // find last anchor title line among E348-E396
      let anchor = 'E396';
      for (let n = 396; n >= 348; n -= 1) {
        if (schema.includes(`  E${n}: '`)) { anchor = `E${n}`; break; }
      }
      schema = replaceOnce(schema, new RegExp(`(  ${anchor}: '[^']*',\\n)(\\};)`), `$1${titleLines}\n$2`, 'schema anchorTitles');
      const mapAnchor = anchor;
      const anchorLines = missing.map(id => `      ${id}: anchor,`).join('\n');
      schema = replaceOnce(schema, new RegExp(`(      ${mapAnchor}: anchor,\\n)(    \\}\\),)`), `$1${anchorLines}\n$2`, 'schema anchor map');
    }
  }
  writeText('src/scripts/schema.js', schema);
}

function appendAnchors(value) {
  value.元数据.卡名 = '《诡异药剂师》v0.17';
  value.元数据.版本 = '0.17.0';
  for (const id of EVENT_IDS) {
    value.事件.锚点状态[id] = { 标题: EVENT_TITLES[id], 状态: '未触发', 收尾: false };
  }
  return value;
}
const initial = appendAnchors(readJson('src/initial_variables.json'));
const alternate = appendAnchors(readJson('src/initial_variables_e25.json'));
writeJson('src/initial_variables.json', initial);
writeJson('src/initial_variables_e25.json', alternate);
{
  const first = readText('src/prompts/first_message.md');
  writeText('src/prompts/first_message.md', replaceOnce(first, /<initvar>\s*[\s\S]*?\s*<\/initvar>/, `<initvar>\n${JSON.stringify(initial, null, 2)}\n</initvar>`, 'first_message initvar'));
  const alt = readText('src/prompts/alternate_greeting_e25.md');
  writeText('src/prompts/alternate_greeting_e25.md', replaceOnce(alt, /<initvar>\s*[\s\S]*?\s*<\/initvar>/, `<initvar>\n${JSON.stringify(alternate, null, 2)}\n</initvar>`, 'alternate greeting initvar'));
}

{
  let status = readText('src/ui/status.html');
  status = status.replaceAll('《诡异药剂师》v0.16', '《诡异药剂师》v0.17')
    .replaceAll('《诡异药剂师》v0.17', '《诡异药剂师》v0.17')
    .replace(/\(396 锚点闭环\)/g, '(434 锚点闭环)')
    .replace('Array.from({ length: 396 }', 'Array.from({ length: 434 }');
  status = replaceOnce(status, /const FALLBACK_STATE = \{[\s\S]*?\};\s*let mvuAvailable/, `const FALLBACK_STATE = ${JSON.stringify(initial)};\n      let mvuAvailable`, 'status FALLBACK_STATE');
  if (!status.includes("from: 'E433', to: 'E434'")) {
    const pairs = [];
    for (let n = 396; n < EVENT_END; n += 1) {
      pairs.push(`        { from: 'E${n}', to: 'E${n + 1}', label: '结算并承接 E${n + 1}' },`);
    }
    status = replaceOnce(
      status,
      /(        \{ from: 'E395', to: 'E396', label: '结算并承接 E396' \},)/,
      `$1\n${pairs.join('\n')}`,
      'status bridge pairs',
    );
  }
  writeText('src/ui/status.html', status);
}

console.log('[6/12] 世界书事件/概念/NPC…');
{
  const book = readJson('src/worldbook.json');
  book.name = '《诡异药剂师》v0.17';
  book.description = '《诡异药剂师》v0.17 动态世界书（覆盖S0至S59、二十八名核心人物、可选NPC、四百三十四事件锚点与全量概念）';
  book.extensions = {
    ...(book.extensions ?? {}),
    tavernweave: { ...(book.extensions?.tavernweave ?? {}), id: 'weird-apothecary-worldbook', version: '0.17.0' },
  };

  // events 1096-1133
  const newEventEntries = EVENT_IDS.map((id, index) => ({
    id: 1096 + index,
    comment: `[事件]${id}·${EVENT_TITLES[id]}`,
    keys: [id],
    enabled: false,
    constant: false,
    insertion_order: 831 + index,
    content_file: eventFileFor(id),
    extensions: { exclude_recursion: true, prevent_recursion: true },
  }));
  const newEventIds = new Set(newEventEntries.map(e => e.id));
  book.entries = book.entries.filter(e => !newEventIds.has(e.id));
  const e396idx = book.entries.findIndex(e => e.id === 1095);
  if (e396idx < 0) throw new Error('未找到 E396 UID1095');
  book.entries.splice(e396idx + 1, 0, ...newEventEntries);

  // concepts 2573-2609
  const usedKeys = new Set(book.entries.flatMap(e => e.keys ?? []));
  const newConceptEntries = [];
  for (let n = NEW_CONCEPT_START, uid = NEW_CONCEPT_UID_START; n <= NEW_CONCEPT_END; n += 1, uid += 1) {
    const logicalId = `C${n}`;
    const files = allFiles(resolve(ROOT, 'src/concepts')).filter(f => f.includes(`/${logicalId}_`) || f.includes(`\\${logicalId}_`));
    const file = files[0];
    if (!file) throw new Error(`新概念文件缺失：${logicalId}`);
    const contentFile = relFrom(file);
    const parsed = parseConceptHeading(readText(contentFile));
    if (!parsed) throw new Error(`新概念标题无法解析：${logicalId}`);
    newConceptEntries.push({
      id: uid,
      comment: `[概念·${parsed.category}]${parsed.name}`,
      keys: stableKeys(parsed.name, usedKeys, logicalId),
      constant: false,
      insertion_order: uid - 1760,
      content_file: contentFile,
      extensions: {
        exclude_recursion: true,
        prevent_recursion: true,
        tavernweave: { logical_id: logicalId, event_ids: parsed.eventIds },
      },
      secondary_keys: [],
    });
  }
  const newConceptIdSet = new Set(newConceptEntries.map(e => e.id));
  book.entries = book.entries.filter(e => !newConceptIdSet.has(e.id));
  book.entries.push(...newConceptEntries);

  // refresh updated concepts' event_ids in worldbook
  for (const entry of book.entries) {
    const logicalId = entry.extensions?.tavernweave?.logical_id;
    if (!logicalId || !entry.content_file) continue;
    if (!conceptUpdates.some(c => c.id === logicalId)) continue;
    const parsed = parseConceptHeading(readText(entry.content_file));
    if (!parsed) continue;
    entry.comment = `[概念·${parsed.category}]${parsed.name}`;
    entry.extensions.tavernweave.event_ids = parsed.eventIds;
  }

  // NPC entries
  for (const npc of NEW_NPCS) {
    const content = readText(`src/characters/${npc.name}/NPC.md`);
    const event_ids = extractEventsFromText(content);
    const entry = {
      id: npc.entry_id,
      comment: `[角色]${npc.name}`,
      keys: [npc.name],
      constant: false,
      insertion_order: npc.entry_id,
      content_file: `src/characters/${npc.name}/NPC.md`,
      extensions: {
        exclude_recursion: true,
        prevent_recursion: true,
        tavernweave: { event_ids, route_kind: 'optional_npc', profile_format: 'compact_npc' },
      },
      secondary_keys: [],
    };
    book.entries = book.entries.filter(e => e.id !== npc.entry_id);
    const after = book.entries.findIndex(e => e.id === 306);
    book.entries.splice(after < 0 ? book.entries.length : after + 1, 0, entry);
  }

  // update core character event_ids for those we appended
  for (const entry of book.entries) {
    if (!entry.comment?.startsWith('[角色]')) continue;
    const name = entry.comment.slice(4);
    const added = charEventAdds.get(name);
    if (!added?.length) continue;
    const prev = entry.extensions?.tavernweave?.event_ids ?? [];
    entry.extensions = {
      ...(entry.extensions ?? {}),
      exclude_recursion: true,
      prevent_recursion: true,
      tavernweave: {
        ...(entry.extensions?.tavernweave ?? {}),
        event_ids: [...new Set([...prev, ...added])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
      },
    };
  }

  writeJson('src/worldbook.json', book);
  globalThis.__WB_COUNT__ = book.entries.length;
}

console.log('[7/12] contract / router / prompts…');
{
  const contract = readJson('contract.json');
  const allEventIds = Array.from({ length: EVENT_END }, (_, i) => `E${String(i + 1).padStart(2, '0')}`);
  contract.version = '0.17.0';
  contract.required.stage_scope = 'E01至E434；本版新增E397至E434，S0至S59，E434为当前开放终点。';
  contract.required.event_ids = allEventIds;
  contract.required.event_titles = { ...contract.required.event_titles, ...EVENT_TITLES };
  contract.required.stage_ranges = {
    ...contract.required.stage_ranges,
    ...Object.fromEntries(Object.entries(PHASES).map(([id, phase]) => [
      id,
      Array.from({ length: phase.end - phase.start + 1 }, (_, i) => `E${phase.start + i}`),
    ])),
  };
  contract.required.event_context_windows.material_entry_end = 1133;
  contract.required.worldbook_version = '0.17.0';
  const wbCount = globalThis.__WB_COUNT__;
  contract.required.worldbook_entry_count = wbCount;
  contract.worldbook_entry_count = wbCount;
  contract.required.terminal_hook_event = 'E434';
  contract.required.terminal_hook_note = 'E434为S59（深海遗忘与八旗围困）开放终点：灭绝令与八旗牢笼；后续事件不在本版展开。';
  contract.stage_scope = contract.required.stage_scope;
  contract.acceptance = {
    ...contract.acceptance,
    event_anchors: EVENT_END,
    stage_scope: 'S0至S59；E01至E434',
    terminal_hook_event: 'E434',
    bridge_pairs_count: EVENT_END - 1,
    source_boundary: '原著阶段十二范围至第1767章（E434封口）；不得读取或泄漏第1768章及以后',
  };

  // character_event_ids
  contract.required.character_event_ids = contract.required.character_event_ids ?? {};
  for (const [name, events] of charEventAdds) {
    if (!contract.required.core_characters.includes(name) && name !== '人偶家') {
      // 人偶家 is optional
    }
    if (contract.required.core_characters.includes(name)) {
      contract.required.character_event_ids[name] = [...new Set([
        ...(contract.required.character_event_ids[name] ?? []),
        ...events,
      ])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    }
  }
  // 人偶家 optional
  if (charEventAdds.has('人偶家') && contract.required.optional_characters?.人偶家) {
    contract.required.optional_characters.人偶家.event_ids = [...new Set([
      ...contract.required.optional_characters.人偶家.event_ids,
      ...charEventAdds.get('人偶家'),
    ])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  }

  contract.required.optional_characters = contract.required.optional_characters ?? {};
  for (const npc of NEW_NPCS) {
    const content = readText(`src/characters/${npc.name}/NPC.md`);
    contract.required.optional_characters[npc.name] = {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(content),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: 'v0.17精简NPC；按事件及关键词激活，不进入核心关系矩阵。',
      profile_format: 'compact_npc',
    };
  }
  contract.required.character_activation = {
    ...(contract.required.character_activation ?? {}),
    character_count: 28,
    optional_character_count: Object.keys(contract.required.optional_characters).length,
  };

  contract.required.concept_activation = {
    ...contract.required.concept_activation,
    stage12_concept_count: 37,
    stage12_concept_ranges: [{
      logical_start: 'C1284',
      logical_end: 'C1320',
      uid_start: 2573,
      uid_end: 2609,
      count: 37,
    }],
    stage12_note: 'v0.17新增阶段十二概念C1284-C1320共37条，世界书UID2573-2609；另原位增量更新19份既有概念。',
  };
  writeJson('contract.json', contract);

  // router
  let router = readText('src/prompts/concept_event_router.md');
  const sequence = `[${allEventIds.map(id => `"${id}"`).join(',')}]`;
  router = replaceOnce(router, /const eventSequence = \[[^\]]+\];/, `const eventSequence = ${sequence};`, 'router eventSequence');
  const mapLines = contract.required.core_characters.map(name =>
    `    [${contract.required.character_entry_ids[name]},${JSON.stringify(contract.required.character_event_ids[name] ?? [])}],`).join('\n');
  router = replaceOnce(
    router,
    /  \/\/ CHARACTER_EVENT_FALLBACK_START[\s\S]*?  \/\/ CHARACTER_EVENT_FALLBACK_END/,
    `  // CHARACTER_EVENT_FALLBACK_START\n  const characterEventFallback = new Map([\n${mapLines}\n  ]);\n  // CHARACTER_EVENT_FALLBACK_END`,
    'router character fallback',
  );
  writeText('src/prompts/concept_event_router.md', router);

  // prompt version strings
  const promptFiles = [
    'src/prompts/system.md',
    'src/prompts/world.md',
    'src/prompts/card_description.md',
    'src/prompts/mvu_update_rules.md',
  ];
  for (const p of promptFiles) {
    let t = readText(p);
    t = t.replaceAll('《诡异药剂师》v0.16', '《诡异药剂师》v0.17')
      .replaceAll('诡异药剂师》v0.16', '诡异药剂师》v0.17')
      .replaceAll('E01至E396', 'E01至E434')
      .replaceAll('E01-E396', 'E01-E434')
      .replaceAll('三百九十六个', '四百三十四个')
      .replaceAll('三百九十六', '四百三十四');
    // terminal wording
    t = t.replace(/E396是当前开放终点[^\n]*/g, 'E434是当前开放终点：灭绝令与八旗牢笼悬置；剧情严格止于八旗封锁与突围选择，不创建E435或引出后续。');
    t = t.replace(/E396为当前开放终点[^\n]*/g, 'E434为当前开放终点');
    t = t.replace(/E348是当前开放终点[^\n]*/g, 'E434是当前开放终点：灭绝令与八旗牢笼悬置；剧情严格止于八旗封锁与突围选择，不创建E435或引出后续。');
    t = t.replace(/E348是本版开放终点[^\n]*/g, 'E434是本版开放终点：灭绝令与八旗牢笼悬置；剧情严格止于此引用边界，不创建E435或引出后续内容。');
    writeText(p, t);
  }
}

console.log('[8/12] mainline（回填E349—E396并追加E397—E434）…');
{
  let text = readText('src/prompts/mainline.md');
  text = text.replace('## 四十六个宽阶段', '## 六十个宽阶段')
    .replace('## 五十二个宽阶段', '## 六十个宽阶段')
    .replace('三百四十八个事件锚点依次记录为E01至E348', '四百三十四个事件锚点依次记录为E01至E434')
    .replace('三百九十六个事件锚点依次记录为E01至E396', '四百三十四个事件锚点依次记录为E01至E434');
  text = text.replace(/10\. E348是当前开放终点：[^\n]+/, '10. E434是当前开放终点：灭绝令与八旗牢笼悬置；剧情严格止于八旗封锁与突围选择，不创建E435或引出后续。');
  text = text.replace(/10\. E396是当前开放终点：[^\n]+/, '10. E434是当前开放终点：灭绝令与八旗牢笼悬置；剧情严格止于八旗封锁与突围选择，不创建E435或引出后续。');

  if (!text.includes('- S53·')) {
    const lines = Object.entries(PHASES).map(([id, v]) => `- ${id}·${v.name}：${v.line}`).join('\n');
    // try append after S52 or S45
    if (text.includes('- S52·')) {
      text = replaceOnce(text, /(- S52·[^\n]+\n)/, `$1${lines}\n`, 'mainline stage list S52');
    } else if (text.includes('- S45·')) {
      text = replaceOnce(text, /(- S45·[^\n]+\n)/, `$1${lines}\n`, 'mainline stage list S45');
    } else {
      throw new Error('mainline 未找到阶段列表插入点');
    }
  }

  // ctx objects for missing events E349-E434
  const needCtx = [...BACKFILL_IDS, ...EVENT_IDS].filter(id => !text.includes(`{ id: '${id}'`));
  if (needCtx.length) {
    const ctxObjects = needCtx.map((id, idx, arr) => {
      const n = Number(id.slice(1));
      const next = n < EVENT_END ? `E${n + 1}` : null;
      const sum = summaryMap.get(id)?.text || EVENT_TITLES[id];
      const line = ctxLineFromBridge(id, EVENT_TITLES[id], next, next ? EVENT_TITLES[next] : '', sum).replaceAll("'", "\\'");
      return `  { id: '${id}', title: '${EVENT_TITLES[id].replaceAll("'", "\\'")}', line: '${line}' },`;
    }).join('\n');
    // update E348 line if still terminal wording
    text = text.replace(
      /\{ id: 'E348', title: '自由与有人要见你', line: '[^']+' \},/,
      `{ id: 'E348', title: '自由与有人要见你', line: '轮回旧影、碎戒同归与预置分魂；自由警告及废塔囚徒获召见 → E349病中醒转与左左质问' },`,
    );
    text = replaceOnce(text, /(  \{ id: 'E348',[^\n]+\n)\];/, `$1${ctxObjects}\n];`, 'mainline ctx tail');
  }

  // bridges
  const missingBridges = [];
  for (let n = BACKFILL_START - 1; n < EVENT_END; n += 1) {
    const from = `E${n}`;
    const to = `E${n + 1}`;
    if (text.includes(`### ${from}→${to}`)) continue;
    missingBridges.push([from, to]);
  }
  if (missingBridges.length) {
    const bridges = [];
    for (const [from, to] of missingBridges) {
      let fields = bridgeFields(from);
      if (![fields.trigger, fields.lead, fields.omen, fields.causal].every(Boolean)) {
        // try v0.17 bridge table
        const pair = bridgesV017.pairs.find(p => p.from === from && p.to === to);
        if (pair) fields = { trigger: pair.trigger, lead: pair.lead, omen: pair.omen, causal: pair.causal };
      }
      if (![fields.trigger, fields.lead, fields.omen, fields.causal].every(Boolean)) {
        // synthesize minimal from titles
        fields = {
          trigger: `${from}已完成、变形、取消或活跃且收尾，${to}尚未触发或处于预兆。`,
          lead: `${EVENT_TITLES[from]}收束后，现场出现通往${EVENT_TITLES[to]}的可观察变化。`,
          omen: `只写当前可观察线索，不提前结算${to}的核心结果。`,
          causal: `${from}留下的条件使${to}可以进入预兆；是否推进由玩家决定。`,
        };
      }
      const n = from.slice(1);
      bridges.push(`<%_ const v17b${n}FromState = getvar("stat_data.事件.锚点状态.${from}.状态", { defaults: "未触发" }); const v17b${n}FromEnd = getvar("stat_data.事件.锚点状态.${from}.收尾", { defaults: false }); const v17b${n}ToState = getvar("stat_data.事件.锚点状态.${to}.状态", { defaults: "未触发" }); if ((v17b${n}FromState === "完成" || v17b${n}FromState === "变形" || (v17b${n}FromState === "活跃" && v17b${n}FromEnd === true)) && (v17b${n}ToState === "未触发" || v17b${n}ToState === "预兆")) { _%>\n### ${from}→${to} · ${EVENT_TITLES[from] || titleFromEventFile(from)} → ${EVENT_TITLES[to] || titleFromEventFile(to)}\n- 触发时机：${fields.trigger}\n- 剧情引子：${fields.lead}\n- 预兆写法：${fields.omen}\n- 承接因果：${fields.causal}\n- 取消态守卫：若${from}为取消，先核对${to}必要因果与替代入口；状态栏不得自动推进。\n<%_ } _%>`);
    }
    const finalClose = text.lastIndexOf('\n<%_ } _%>');
    if (finalClose < 0) throw new Error('mainline 末尾闭合标记缺失');
    text = `${text.slice(0, finalClose)}\n\n${bridges.join('\n\n')}${text.slice(finalClose)}`;
  }
  writeText('src/prompts/mainline.md', text);
}

console.log('[9/12] card/manifest/profile/host_acceptance/SCAFFOLD/README…');
{
  const card = readJson('src/card.json');
  card.name = '《诡异药剂师》v0.17';
  card.character_version = '0.17.0';
  card.creator_notes = 'v0.17 内部候选版。由 v0.16 升版，全量合入 E397-E434（S53-S59）共38个事件锚点、19份概念增量与37份新概念、核心人物增量与精简NPC。E434为当前版本终点；玩家始终掌握林恩的对白、行动、判断、记忆、内心与关系选择。需要 SillyTavern 1.17.0 与酒馆助手 4.9.1；真实宿主验收待执行。v1.0以前不公开发布。';
  writeJson('src/card.json', card);

  const manifest = readJson('manifest.json');
  manifest.version = '0.17.0';
  if (manifest.worldbook) manifest.worldbook.version = '0.17.0';
  writeJson('manifest.json', manifest);

  const profile = readJson('profile.json');
  profile.version = '0.17.0';
  profile.display_name = '《诡异药剂师》v0.17';
  writeJson('profile.json', profile);

  const host = readJson('host_acceptance.json');
  host.version = '0.17.0';
  host.status = 'pending';
  host.artifact = 'dist/诡异药剂师_v0.17.json';
  host.bytes = null;
  host.sha256 = null;
  host.last_runtime_sha256 = null;
  host.accepted_at = null;
  host.evidence = null;
  host.offline_checks = {
    ...(host.offline_checks ?? {}),
    status: 'pending',
    checks: null,
    command: 'npm run check',
    worldbook_entries: globalThis.__WB_COUNT__,
    event_anchors: EVENT_END,
  };
  host.notes = 'v0.17合入E397-E434、56份概念（19增量+37新）及人物/NPC来源；真实宿主验收仍pending。';
  delete host.note_scaffold;
  writeJson('host_acceptance.json', host);

  writeText('SCAFFOLD.md', `# v0.17 工程壳

- 建立时间：2026-09-13
- 基线：\`诡异药剂师_MVU_v0.16\`（冻结，勿回改）
- 状态：已集成 E397—E434（S53—S59）；版本 0.17.0
- 设定来源：\`角色卡设定/v0.17工作区\`
- 工作面：仅云端 \`/workspace/《诡异药剂师》同人角色卡制作计划\`
- 校验：\`npm run check\`（build + validate + validate-integration）
- 产物：\`dist/诡异药剂师_v0.17.json\`；host_acceptance 保持 pending
`);

  writeText('README.md', `# 《诡异药剂师》MVU v0.17

当前维护版本：0.17.0。包含 E01—E434 共434个事件锚点、S0—S59、世界书词条见 contract，28名核心关系人物保持不变。E434为开放终点（八旗围困）。

## 本版集成

- E397—E434共38个事件；56份概念（19份既有增量 + 37份新概念 C1284—C1320，UID 2573—2609）。
- 核心人物增量与精简NPC（夏娃、孽主、弑利亚、康斯坦丁、大黑彘、第一使徒、血娃娃与母亲、未来画家、艾泽法拉等）。
- E432后身份失效隔离已随设定稿接入；E400/E420/E434含已授权 NSFW 主线内容。
- 真机实测暂缓，host_acceptance 保持 pending。

## 构建与校验

在本目录运行 \`npm run check\`。生成物为 \`dist/诡异药剂师_v0.17.json\`，禁止直接修改。
`);
}

console.log('[10/12] 合并记录…');
{
  const oldMap = readJson('合并记录/人物增量映射.json');
  const mergedRecords = [...(oldMap.records || []), ...personaRecords];
  writeJson('合并记录/人物增量映射.json', {
    date: '2026-09-13',
    source_count: mergedRecords.length,
    records: mergedRecords,
    note: '保留v0.16的27份映射，并追加v0.17人物增量；NPC精简条目见注册映射。',
  });

  const optional = readJson('合并记录/注册映射.json');
  optional.optional = {
    ...optional.optional,
    ...Object.fromEntries(NEW_NPCS.map(npc => [npc.name, {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(readText(`src/characters/${npc.name}/NPC.md`)),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: 'v0.17精简NPC',
      profile_format: 'compact_npc',
    }])),
  };
  optional.worldbookEntries = globalThis.__WB_COUNT__;
  optional.coreCharacterCount = 28;
  writeJson('合并记录/注册映射.json', optional);

  writeText('合并记录/v0.17事件合并.md', `# v0.17 事件合并

范围：E397—E434（38条），UID 1096—1133，insertion_order 831—868。
来源：角色卡设定/v0.17工作区/事件/。
E396已改写下一事件引入至E397；E434为开放终点，无下一事件引入。
阶段：S53—S59（见 schema phaseNames）。
另：mainline 同步回填了既有 E349—E396 的 ctx/桥（v0.16遗留缺口），并追加 E397—E434。
`);

  writeText('合并记录/v0.17概念合并.md', `# v0.17 概念合并

- update 19：按事件门控追加到既有 src/concepts 文件，保留早期变体，扩展标题事件数组。
- new 37：C1284—C1320，运行 UID 2573—2609。
- 文件名保留基线命名；新概念使用工作区输出文件名并补全 # 概念· 标题行。
`);

  writeText('合并记录/v0.17人物合并.md', `# v0.17 人物合并

- 核心/可选人物增量：追加到对应多阶段人设.md（自缚天使→倒吊天使）。
- 新精简NPC：夏娃、康斯坦丁、第一使徒、孽主、弑利亚、大黑彘、血娃娃与母亲、未来画家、艾泽法拉 → src/characters/<名>/NPC.md，世界书 UID 307—315。
- E432后身份失效：大黑彘等设定稿已含门控，事件 E429—E431 含失效分支。
`);

  writeText('合并记录/待拍板.md', `# 待拍板

当前无阻塞项（已按 v0.16 惯例自行决定）：

1. mainline 回填 E349—E396 ctx/桥：v0.16 卡体事件已存在但 mainline 未接线；为保证上下文窗口连续，本版一并回填。
2. 可选NPC数量：新增9名精简NPC（含血娃娃与母亲、未来画家、艾泽法拉），世界书条目相应增加。
3. 阶段中文名：S53—S59 由摘要/事件内容归纳（见 schema phaseNames）。
`);
}

console.log(JSON.stringify({
  status: 'wired',
  events: EVENT_IDS.length,
  concepts_new: 37,
  concepts_update: 19,
  npcs: NEW_NPCS.length,
  worldbook_entries: globalThis.__WB_COUNT__,
  event_uid: '1096-1133',
  concept_uid: '2573-2609',
}, null, 2));
