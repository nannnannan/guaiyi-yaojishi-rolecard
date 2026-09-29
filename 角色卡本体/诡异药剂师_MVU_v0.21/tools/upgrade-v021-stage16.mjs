// v0.21 阶段十六接线：E594—E646 + 概念/人物/NPC + 注册表与校验边界
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = resolve(ROOT, '../../角色卡设定/v0.21工作区');
const EVENT_START = 594;
const EVENT_END = 646;
const EVENT_IDS = Array.from({ length: EVENT_END - EVENT_START + 1 }, (_, i) => `E${EVENT_START + i}`);
const PHASES = {
  S81: { name: '深渊战争与无序引擎', start: 594, end: 600, line: '五廊汇合窃听揭开破碎神界远征序幕；无序引擎拓路、缴获回撤，林恩闭关改造深渊，银幻孤身殉爆九座引擎阻击，魇被八音盒封入。' },
  S82: { name: '法则防线与双神陨落', start: 601, end: 608, line: '艾维儿归来挡住血神，全位面活化法则防线、机械狂潮参战；血神神格被拘禁、黑夜之神自裁；战后揭夺天之才与真理神王复苏之讯，主母深夜长谈。' },
  S83: { name: '时间小屋与半神狂潮', start: 609, end: 615, line: '时间小屋量产，人偶家、精灵王接连登半神，母树携双法则新生、伊甸娜重融入盟；巨像遭法则排斥，血枢残魂现身，林恩立家规并远征天堂之战遗址。' },
  S84: { name: '天堂遗产与紫罗兰远征', start: 616, end: 623, line: '遗址三路各得机缘，银幻升华、艾雯灵能失控；织梦现身收走艾雯；六人小队远征紫罗兰，冬泉谷认祖、织梦即入梦者，蓝龙启程。' },
  S85: { name: '织梦训练与真理降临', start: 624, end: 630, line: '月儿兰幻城揭容器计划；林恩罢工掀桌后以自我了断逼织梦让步；织梦授白烬三形态与星寂增幅拳；纱奈儿波动引来七神，真理神王降临紫罗兰。' },
  S86: { name: '七神阻击与画家降临', start: 631, end: 637, line: '七神分工阻击，林恩首战白烬加星寂弑现实之神，艾维儿解放本质后被画家接管；织梦最后一课，林恩被放逐；归返深渊公布织梦身份，黑弦月参战，天鹰座封印破碎之眼。' },
  S87: { name: '神王围猎与迷雾撤退', start: 638, end: 646, line: '全宇宙闪电战封五十余座破碎之眼；三王警告后深渊撤离陷落，织梦罪火断后，巨像三位一体融合、白烬常态化；林恩于迷雾之海循环猎杀，去向悬于迷雾。' },
};
const NEW_CONCEPT_UID_START = 2754;
const EVENT_UID_START = 1293;
const EVENT_INSERTION_START = 1028;
const PREV_LAST_EVENT_UID = 1292;
const NEW_NPCS = [
  { name: '伊甸娜', file: '伊甸娜.md', entry_id: 334, extra_keys: ['炽天使', '重生天使'], src_dir: '新NPC' },
  { name: '精灵王', file: '精灵王.md', entry_id: 335, extra_keys: ['星轨之父', '第三位半神'], src_dir: '新NPC' },
  { name: '血神', file: '血神.md', entry_id: 336, extra_keys: ['血之神', '血神神格'], src_dir: '新NPC' },
  { name: '黑夜之神', file: '黑夜之神.md', entry_id: 337, extra_keys: ['夜之神', '暗影神格'], src_dir: '新NPC' },
  { name: '纱奈儿', file: '纱奈儿.md', entry_id: 338, extra_keys: ['容器纱奈儿', '十岁少女'], src_dir: '新NPC' },
  { name: '现实之神', file: '现实之神.md', entry_id: 339, extra_keys: ['现实神格', '七神'], src_dir: '新NPC' },
  { name: '真理神王', file: '真理神王.md', entry_id: 340, extra_keys: ['真理之名', '金红巨手'], src_dir: '新NPC' },
  { name: '血枢', file: '血枢_D.md', entry_id: 341, extra_keys: ['血枢残魂', '外来者血枢'], src_dir: '人物增量' },
];
const NPC_INCREMENT_ONLY = new Set(['血枢']);
const CHAR_TARGET = {
  人偶家: 'src/characters/人偶家/多阶段人设.md',
  以太: 'src/characters/以太/NPC.md',
  左左: 'src/characters/左左/多阶段人设.md',
  巨像: 'src/characters/巨像之脑/多阶段人设.md',
  康斯坦丁: 'src/characters/康斯坦丁/NPC.md',
  星轨: 'src/characters/星轨/NPC.md',
  自缚天使: 'src/characters/倒吊天使/多阶段人设.md',
  主母: 'src/characters/倒吊天使/多阶段人设.md',
  艾雯爵士: 'src/characters/艾雯爵士/多阶段人设.md',
  银色幻想: 'src/characters/a01银色幻想/多阶段人设.md',
  母树: 'src/characters/欲望母树/多阶段人设.md',
  黑弦月: 'src/characters/黑弦月/多阶段人设.md',
  艾维儿: 'src/characters/艾维儿/NPC.md',
  织梦: 'src/characters/入梦者/NPC.md',
  入梦者: 'src/characters/入梦者/NPC.md',
};
const E593_TO_E594 = {
  trigger: 'E593已完成、变形、取消或活跃且收尾，E594尚未触发或处于预兆；五廊汇合处隐匿窃听已成，重伤大魔正独自冲向走廊更深处。',
  lead: '重伤大魔拨开同伴独自没入走廊深处，无序力量随其脚步愈发浓稠，前方乱流中隐约有星球般的黑影缓缓移动。',
  omen: '只写大魔独自深入的背影、无序浓度攀升与远处巨型黑影的轮廓，不提前公开引擎构造、拓路阵列或林恩出手的结果。',
  causal: 'E593窃听到的撤军令与天父投影未降的疑点，使尾随重伤大魔查明走廊尽头成为可选行动；是否尾随由玩家决定。',
};

function readText(rel) {
  const full = /^([a-zA-Z]:|\/)/.test(rel) ? rel : resolve(ROOT, rel);
  return readFileSync(full, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
}
function writeText(rel, text) {
  const full = /^([a-zA-Z]:|\/)/.test(rel) ? rel : resolve(ROOT, rel);
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
const byEventNo = (a, b) => Number(a.slice(1)) - Number(b.slice(1));
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
  return [...new Set([...text.matchAll(/锚点状态\.(E\d+)/g)].map(m => m[1]))].sort(byEventNo);
}
function stableKeys(name, usedKeys, logicalId) {
  let key = name;
  if (usedKeys.has(key)) key = `${name}(${logicalId})`;
  while (usedKeys.has(key)) key = `${key}*`;
  usedKeys.add(key);
  return [key];
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
  return { trigger: get('触发时机'), lead: get('剧情引子'), omen: get('预兆写法'), causal: get('承接因果') };
}
function ctxLineFromBridge(nextId, nextTitle, summaryText) {
  if (!nextId) return `${summaryText}（本版终点）`;
  const short = summaryText.length > 60 ? `${summaryText.slice(0, 58)}…` : summaryText;
  return `${short} → ${nextId}${nextTitle}`;
}
function resolveConceptBase(item) {
  const files = allFiles(resolve(ROOT, 'src/concepts')).filter(f => {
    const name = f.split(/[/\\]/).pop();
    return name.startsWith(`${item.id}_`) && name.endsWith('.md');
  });
  if (!files[0]) throw new Error(`概念基线缺失：${item.id} ${item.base_path || ''}`);
  return relFrom(files[0]);
}
// 工作区人物增量名 → 卡内运行时角色名（世界书 [角色]X / 契约核心人物名）
function coreNameOf(name) {
  if (name === '自缚天使' || name === '主母') return '倒吊天使';
  if (name === '银色幻想') return 'a01银色幻想';
  if (name === '巨像') return '巨像之脑';
  if (name === '母树') return '欲望母树';
  if (name === '织梦') return '入梦者';
  return name;
}

const delivery = JSON.parse(readText(resolve(WORKSPACE, '交付清单.json')));
const summaries = JSON.parse(readText(resolve(WORKSPACE, '摘要/事件摘要.json')));
const bridgesV021 = JSON.parse(readText(resolve(WORKSPACE, '摘要/衔接表.json')));
const summaryMap = new Map(summaries.map(s => [s.id, s]));
const conceptUpdates = delivery.concepts.filter(c => c.kind === 'update');
const conceptNews = delivery.concepts.filter(c => c.kind === 'new');
const NEW_CONCEPT_IDS = conceptNews.map(c => c.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

console.log('[1/10] 复制事件并统一阶段字段…');
for (const ev of delivery.events) {
  copyFileSync(resolve(WORKSPACE, ev.output), resolve(ROOT, 'src/events', ev.output.split('/').pop()));
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
const EVENT_TITLES = Object.fromEntries(EVENT_IDS.map(id => [id, titleFromEventFile(id)]));
EVENT_TITLES.E593 = titleFromEventFile('E593');

console.log('[2/10] E593→E594 衔接…');
{
  const path = eventFileFor('E593');
  let text = readText(path);
  if (!text.includes('## 下一事件引入（E594·')) {
    const block = `\n## 下一事件引入（E594·${EVENT_TITLES.E594}）\n- 触发时机：${E593_TO_E594.trigger}\n- 剧情引子：${E593_TO_E594.lead}\n- 预兆写法：${E593_TO_E594.omen}\n- 承接因果：${E593_TO_E594.causal}\n`;
    text = replaceOnce(text, /\n<%_ \} _%>\s*$/, `${block}\n<%_ } _%>`, 'E593→E594 bridge');
  }
  text = text
    .replace(/\*\*本事件止于此。本阶段开放终点＝五廊汇合处隐匿窃听未收束。/g, '**本事件正文止于此；向E594承接。')
    .replace(/本事件止于此。本阶段开放终点＝五廊汇合处隐匿窃听未收束。/g, '本事件正文止于此；向E594承接。')
    .replace(/即开放终点；不开打、不毁点、不写引擎全貌，不向下交接编号。/g, '；不开打、不毁点、不写引擎全貌，后继由下一事件引入段承接。')
    .replace(/本事件＝阶段开放终点。/g, '本事件＝阶段收束点，向E594承接。')
    .replace(/不写后继桥段、不毁点、不暴露引擎。/g, '后继桥段由下一事件引入段承接；不毁点、不暴露引擎。');
  writeText(path, text);
}

console.log('[3/10] 合并概念增量与新概念…');
for (const item of conceptUpdates) {
  const baseRel = resolveConceptBase(item);
  let base = readText(baseRel);
  const incr = readText(resolve(WORKSPACE, item.output)).trim();
  const heading = parseConceptHeading(base);
  if (!heading) throw new Error(`无法解析概念标题：${baseRel}`);
  const incrEvents = extractEventsFromText(incr);
  const mergedEvents = [...new Set([...heading.eventIds, ...incrEvents])].sort(byEventNo);
  base = base.replace(heading.full, `# 概念·${heading.category}·${heading.name}（事件${JSON.stringify(mergedEvents)}）`);
  let appended = base.trimEnd();
  for (const block of incr.split(/(?=<%_ if )/g).map(s => s.trim()).filter(Boolean)) {
    const ev = block.match(/锚点状态\.(E\d+)/)?.[1];
    if (ev && new RegExp(`# ${item.id}·[^\\n]*·${ev}\\b`).test(appended)) continue;
    appended += `\n\n${block.trim()}\n`;
  }
  writeText(baseRel, appended);
}
for (const item of conceptNews) {
  const incr = readText(resolve(WORKSPACE, item.output)).trim();
  const events = item.source_events?.length ? item.source_events : extractEventsFromText(incr);
  const firstCat = incr.match(/- 类别：([^\n]+)/)?.[1]?.trim() || '机制';
  writeText(`src/concepts/${item.output.split('/').pop()}`, `# 概念·${firstCat}·${item.title}（事件${JSON.stringify(events)}）\n\n${incr}\n`);
}

console.log('[4/10] 合并人物增量与新NPC…');
const personaRecords = [];
const charEventAdds = new Map();
function appendCharacterIncrement(targetRel, sourceRel) {
  let target = existsSync(resolve(ROOT, targetRel)) ? readText(targetRel).trimEnd() : '';
  const source = readText(resolve(WORKSPACE, sourceRel)).trim();
  const blocks = source.split(/(?=<%_ if )/g).map(s => s.trim()).filter(Boolean);
  for (const block of blocks) {
    if (!block.match(/锚点状态\.(E\d+)/)) continue;
    if (!target.includes(block)) target += `\n\n${block}\n`;
  }
  writeText(targetRel, `${target}\n`);
}
for (const ch of delivery.characters) {
  const out = ch.output || '';
  if (!out.startsWith('人物增量/')) continue;
  const logicalName = ch.name.replace(/_[A-Z]$/, '');
  if (NPC_INCREMENT_ONLY.has(logicalName)) continue;
  const target = CHAR_TARGET[logicalName];
  if (!target) throw new Error(`人物目标未映射：${ch.name} → ${logicalName}`);
  appendCharacterIncrement(target, out);
  const events = extractEventsFromText(readText(resolve(WORKSPACE, out)));
  const coreName = coreNameOf(logicalName);
  const prev = charEventAdds.get(coreName) || [];
  charEventAdds.set(coreName, [...new Set([...prev, ...events])].sort(byEventNo));
  personaRecords.push({ source: `角色卡设定/v0.21工作区/${out}`, target, events, mode: 'source_sync', adapted_events: [] });
}
for (const npc of NEW_NPCS) {
  const body = readText(resolve(WORKSPACE, npc.src_dir, npc.file)).trim();
  writeText(`src/characters/${npc.name}/NPC.md`, `# ${npc.name}\n\n${body}\n`);
  if (NPC_INCREMENT_ONLY.has(npc.name)) {
    personaRecords.push({
      source: `角色卡设定/v0.21工作区/${npc.src_dir}/${npc.file}`,
      target: `src/characters/${npc.name}/NPC.md`,
      events: extractEventsFromText(body),
      mode: 'source_sync_new_npc',
      adapted_events: [],
    });
  }
}

console.log('[5/10] schema / initvar / status…');
{
  let schema = readText('src/scripts/schema.js');
  schema = schema.replaceAll('诡异药剂师v0.20', '诡异药剂师v0.21')
    .replace("卡名: z.literal('《诡异药剂师》v0.20')", "卡名: z.literal('《诡异药剂师》v0.21')")
    .replace("版本: z.literal('0.20.0')", "版本: z.literal('0.21.0')");
  if (!schema.includes('S81:')) {
    const phaseLines = Object.entries(PHASES).map(([id, v]) => `  ${id}: '${v.name}',`).join('\n');
    schema = replaceOnce(schema, /(  S80: '[^']*',\n)(\};)/, `$1${phaseLines}\n$2`, 'schema phaseNames');
  }
  if (!schema.includes("E594: '")) {
    const titleLines = EVENT_IDS.map(id => `  ${id}: '${EVENT_TITLES[id]}',`).join('\n');
    schema = replaceOnce(schema, /(  E593: '[^']*',\n)(\};)/, `$1${titleLines}\n$2`, 'schema anchorTitles');
    const anchorLines = EVENT_IDS.map(id => `      ${id}: anchor,`).join('\n');
    schema = replaceOnce(schema, /(      E593: anchor,\n)(    \}\),)/, `$1${anchorLines}\n$2`, 'schema anchor map');
  }
  writeText('src/scripts/schema.js', schema);
}
function appendAnchors(value) {
  value.元数据.卡名 = '《诡异药剂师》v0.21';
  value.元数据.版本 = '0.21.0';
  for (const id of EVENT_IDS) value.事件.锚点状态[id] = { 标题: EVENT_TITLES[id], 状态: '未触发', 收尾: false };
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
  status = status.replaceAll('《诡异药剂师》v0.20', '《诡异药剂师》v0.21')
    .replace(/\(593 锚点闭环\)/g, '(646 锚点闭环)')
    .replace('Array.from({ length: 593 }', 'Array.from({ length: 646 }');
  status = replaceOnce(status, /const FALLBACK_STATE = \{[\s\S]*?\};\s*let mvuAvailable/, `const FALLBACK_STATE = ${JSON.stringify(initial)};\n      let mvuAvailable`, 'status FALLBACK_STATE');
  if (!status.includes("from: 'E645', to: 'E646'")) {
    const pairs = [];
    for (let n = 593; n < EVENT_END; n += 1) pairs.push(`        { from: 'E${n}', to: 'E${n + 1}', label: '结算并承接 E${n + 1}' },`);
    status = replaceOnce(status, /(        \{ from: 'E592', to: 'E593', label: '结算并承接 E593' \},)/, `$1\n${pairs.join('\n')}`, 'status bridge pairs');
  }
  writeText('src/ui/status.html', status);
}

console.log('[6/10] 世界书事件/概念/NPC…');
{
  const book = readJson('src/worldbook.json');
  book.name = '《诡异药剂师》v0.21';
  book.description = '《诡异药剂师》v0.21 动态世界书（覆盖S0至S87、二十八名核心人物、四十一名可选NPC、六百四十六事件锚点与全量概念）';
  book.extensions = {
    ...(book.extensions ?? {}),
    tavernweave: { ...(book.extensions?.tavernweave ?? {}), id: 'weird-apothecary-worldbook', version: '0.21.0' },
  };

  const newEventEntries = EVENT_IDS.map((id, index) => ({
    id: EVENT_UID_START + index,
    comment: `[事件]${id}·${EVENT_TITLES[id]}`,
    keys: [id],
    enabled: false,
    constant: false,
    insertion_order: EVENT_INSERTION_START + index,
    content_file: eventFileFor(id),
    extensions: { exclude_recursion: true, prevent_recursion: true },
  }));
  const newEventIds = new Set(newEventEntries.map(e => e.id));
  book.entries = book.entries.filter(e => !newEventIds.has(e.id));
  const e593idx = book.entries.findIndex(e => e.id === PREV_LAST_EVENT_UID);
  if (e593idx < 0) throw new Error('未找到 E593 UID1292');
  book.entries.splice(e593idx + 1, 0, ...newEventEntries);

  const usedKeys = new Set(book.entries.flatMap(e => e.keys ?? []));
  const newConceptEntries = [];
  for (const [index, logicalId] of NEW_CONCEPT_IDS.entries()) {
    const uid = NEW_CONCEPT_UID_START + index;
    const file = allFiles(resolve(ROOT, 'src/concepts')).find(f => f.includes(`/${logicalId}_`) || f.includes(`\\${logicalId}_`));
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

  for (const entry of book.entries) {
    // 早期概念（如C592）注册表条目无 logical_id，按文件名前缀回退匹配
    const fileId = entry.content_file?.split(/[/\]/).pop().match(/^(Cd+)_/)?.[1];
    const logicalId = entry.extensions?.tavernweave?.logical_id ?? fileId;
    if (!logicalId || !entry.content_file || !conceptUpdates.some(c => c.id === logicalId)) continue;
    const parsed = parseConceptHeading(readText(entry.content_file));
    if (!parsed) continue;
    entry.comment = `[概念·${parsed.category}]${parsed.name}`;
    entry.extensions.tavernweave.event_ids = parsed.eventIds;
  }

  for (const npc of NEW_NPCS) {
    const content = readText(`src/characters/${npc.name}/NPC.md`);
    const keys = [npc.name, ...(npc.extra_keys || [])].filter((k, i, arr) => arr.indexOf(k) === i);
    const entry = {
      id: npc.entry_id,
      comment: `[角色]${npc.name}`,
      keys,
      constant: false,
      insertion_order: npc.entry_id,
      content_files: [`src/characters/${npc.name}/NPC.md`],
      extensions: {
        exclude_recursion: true,
        prevent_recursion: true,
        tavernweave: { event_ids: extractEventsFromText(content), route_kind: 'optional_npc', profile_format: 'compact_npc' },
      },
      secondary_keys: [],
    };
    book.entries = book.entries.filter(e => e.id !== npc.entry_id);
    const after = book.entries.findIndex(e => e.id === npc.entry_id - 1);
    book.entries.splice(after < 0 ? book.entries.length : after + 1, 0, entry);
  }

  for (const entry of book.entries) {
    if (!entry.comment?.startsWith('[角色]')) continue;
    const added = charEventAdds.get(entry.comment.slice(4));
    if (!added?.length) continue;
    const prev = entry.extensions?.tavernweave?.event_ids ?? [];
    entry.extensions = {
      ...(entry.extensions ?? {}),
      exclude_recursion: true,
      prevent_recursion: true,
      tavernweave: {
        ...(entry.extensions?.tavernweave ?? {}),
        event_ids: [...new Set([...prev, ...added])].sort(byEventNo),
      },
    };
  }
  writeJson('src/worldbook.json', book);
  globalThis.__WB_COUNT__ = book.entries.length;
}

console.log('[7/10] contract / router / prompts…');
{
  const contract = readJson('contract.json');
  const allEventIds = Array.from({ length: EVENT_END }, (_, i) => `E${String(i + 1).padStart(2, '0')}`);
  contract.version = '0.21.0';
  contract.required.stage_scope = 'E01至E646；本版新增E594至E646，S0至S87，E646为当前开放终点。';
  contract.required.event_ids = allEventIds;
  contract.required.event_titles = { ...contract.required.event_titles, ...EVENT_TITLES };
  contract.required.stage_ranges = {
    ...contract.required.stage_ranges,
    ...Object.fromEntries(Object.entries(PHASES).map(([id, phase]) => [
      id,
      Array.from({ length: phase.end - phase.start + 1 }, (_, i) => `E${phase.start + i}`),
    ])),
  };
  contract.required.event_context_windows.material_entry_end = EVENT_UID_START + EVENT_IDS.length - 1;
  contract.required.worldbook_version = '0.21.0';
  const wbCount = globalThis.__WB_COUNT__;
  contract.required.worldbook_entry_count = wbCount;
  contract.worldbook_entry_count = wbCount;
  contract.required.terminal_hook_event = 'E646';
  contract.required.terminal_hook_note = 'E646为S87（神王围猎与迷雾撤退）开放终点：迷雾海猎杀止于烧尽尸躯、大部队扑空的开放收束，后续事件不在本版展开。';
  contract.stage_scope = contract.required.stage_scope;
  contract.acceptance = {
    ...contract.acceptance,
    event_anchors: EVENT_END,
    stage_scope: 'S0至S87；E01至E646',
    terminal_hook_event: 'E646',
    bridge_pairs_count: EVENT_END - 1,
    source_boundary: '原著阶段十六范围至第2407章（E646封口）；不得读取或泄漏第2408章及以后',
  };

  contract.required.character_event_ids = contract.required.character_event_ids ?? {};
  contract.required.optional_characters = contract.required.optional_characters ?? {};
  for (const [name, events] of charEventAdds) {
    if (contract.required.core_characters.includes(name)) {
      contract.required.character_event_ids[name] = [...new Set([
        ...(contract.required.character_event_ids[name] ?? []),
        ...events,
      ])].sort(byEventNo);
    }
    if (contract.required.optional_characters[name]) {
      contract.required.optional_characters[name].event_ids = [...new Set([
        ...(contract.required.optional_characters[name].event_ids ?? []),
        ...events,
      ])].sort(byEventNo);
    }
  }
  for (const npc of NEW_NPCS) {
    contract.required.optional_characters[npc.name] = {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(readText(`src/characters/${npc.name}/NPC.md`)),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: 'v0.21新增NPC；按事件及关键词激活，具备生境六组件。',
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
    stage16_concept_count: NEW_CONCEPT_IDS.length,
    stage16_concept_ranges: [{
      logical_start: NEW_CONCEPT_IDS[0],
      logical_end: NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1],
      uid_start: NEW_CONCEPT_UID_START,
      uid_end: NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1,
      count: NEW_CONCEPT_IDS.length,
    }],
    stage16_note: `v0.21新增阶段十六概念${NEW_CONCEPT_IDS[0]}-${NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1]}共${NEW_CONCEPT_IDS.length}条，世界书UID${NEW_CONCEPT_UID_START}-${NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1}；另原位增量更新${conceptUpdates.length}份既有概念。`,
  };
  writeJson('contract.json', contract);

  let router = readText('src/prompts/concept_event_router.md');
  router = replaceOnce(router, /const eventSequence = \[[^\]]+\];/, `const eventSequence = [${allEventIds.map(id => `"${id}"`).join(',')}];`, 'router eventSequence');
  const mapLines = contract.required.core_characters.map(name =>
    `    [${contract.required.character_entry_ids[name]},${JSON.stringify(contract.required.character_event_ids[name] ?? [])}],`).join('\n');
  router = replaceOnce(
    router,
    /  \/\/ CHARACTER_EVENT_FALLBACK_START[\s\S]*?  \/\/ CHARACTER_EVENT_FALLBACK_END/,
    `  // CHARACTER_EVENT_FALLBACK_START\n  const characterEventFallback = new Map([\n${mapLines}\n  ]);\n  // CHARACTER_EVENT_FALLBACK_END`,
    'router character fallback',
  );
  writeText('src/prompts/concept_event_router.md', router);

  for (const p of ['src/prompts/system.md', 'src/prompts/world.md', 'src/prompts/card_description.md', 'src/prompts/mvu_update_rules.md']) {
    let t = readText(p);
    t = t.replaceAll('《诡异药剂师》v0.20', '《诡异药剂师》v0.21')
      .replaceAll('E01至E593', 'E01至E646')
      .replaceAll('E01-E593', 'E01-E646')
      .replaceAll('五百九十三个', '六百四十六个')
      .replaceAll('五百九十三', '六百四十六');
    t = t.replace(/E593是当前开放终点：[^\n]*/g, 'E646是当前开放终点：迷雾海猎杀止于烧尽尸躯、大部队扑空的开放收束，不创建E647或引出后续。');
    t = t.replace(/E593是本版开放终点[^\n]*/g, 'E646是本版开放终点：迷雾海猎杀止于烧尽尸躯、大部队扑空的开放收束，不创建E647或引出后续内容。');
    writeText(p, t);
  }
  writeText('src/scripts/mvu_loader.js', readText('src/scripts/mvu_loader.js').replaceAll('诡异药剂师v0.20', '诡异药剂师v0.21'));

  const helpers = readJson('src/tavern_helper_scripts.json');
  for (const script of helpers) {
    if (typeof script.name === 'string') script.name = script.name.replaceAll('v0.20', 'v0.21');
    if (typeof script.id === 'string') script.id = script.id.replaceAll('v0.20', 'v0.21');
    if (typeof script.info === 'string') {
      script.info = script.info.replaceAll('v0.20', 'v0.21').replaceAll('五百九十三', '六百四十六')
        .replaceAll('E01-E593', 'E01-E646').replaceAll('S0-S80', 'S0-S87');
    }
  }
  writeJson('src/tavern_helper_scripts.json', helpers);
  writeText('src/regex_scripts.json', readText('src/regex_scripts.json').replaceAll('v0.20', 'v0.21'));
}

console.log('[8/10] mainline（追加E594—E646并改写E593终点）…');
{
  let text = readText('src/prompts/mainline.md');
  text = text.replace('## 八十一个宽阶段', '## 八十八个宽阶段')
    .replace('五百九十三个事件锚点依次记录为E01至E593', '六百四十六个事件锚点依次记录为E01至E646');
  text = text.replace(/10\. E593是当前开放终点：[^\n]+/, '10. E646是当前开放终点：迷雾海猎杀止于烧尽尸躯、大部队扑空的开放收束，不创建E647或引出后续。');
  if (!text.includes('- S81·')) {
    const lines = Object.entries(PHASES).map(([id, v]) => `- ${id}·${v.name}：${v.line}`).join('\n');
    text = replaceOnce(text, /(- S80·[^\n]+\n)/, `$1${lines}\n`, 'mainline stage list S80');
  }
  text = replaceOnce(
    text,
    /\{ id: 'E593', title: '无序走廊初探', line: '[^']+' \},/,
    `{ id: 'E593', title: '无序走廊初探', line: '五廊汇合处隐匿窃听，重伤大魔独入走廊深处 → E594无序引擎暴露' },`,
    'mainline E593 ctx',
  );
  const needCtx = EVENT_IDS.filter(id => !text.includes(`{ id: '${id}'`));
  if (needCtx.length) {
    const ctxObjects = needCtx.map(id => {
      const n = Number(id.slice(1));
      const next = n < EVENT_END ? `E${n + 1}` : null;
      const sum = summaryMap.get(id)?.text || EVENT_TITLES[id];
      const line = ctxLineFromBridge(next, next ? EVENT_TITLES[next] : '', sum).replaceAll("'", "\\'");
      return `  { id: '${id}', title: '${EVENT_TITLES[id].replaceAll("'", "\\'")}', line: '${line}' },`;
    }).join('\n');
    text = replaceOnce(text, /(  \{ id: 'E593',[^\n]+\n)\];/, `$1${ctxObjects}\n];`, 'mainline ctx tail');
  }
  const bridges = [];
  for (let n = 593; n < EVENT_END; n += 1) {
    const from = `E${n}`;
    const to = `E${n + 1}`;
    if (text.includes(`### ${from}→${to}`)) continue;
    let fields = from === 'E593' ? { ...E593_TO_E594 } : bridgeFields(from);
    if (![fields.trigger, fields.lead, fields.omen, fields.causal].every(Boolean)) {
      const pair = bridgesV021.pairs.find(p => p.from === from && p.to === to);
      if (pair) fields = { trigger: pair.trigger, lead: pair.lead, omen: pair.omen, causal: pair.causal };
    }
    if (![fields.trigger, fields.lead, fields.omen, fields.causal].every(Boolean)) throw new Error(`衔接字段缺失：${from}→${to}`);
    const fromTitle = EVENT_TITLES[from] || titleFromEventFile(from);
    const toTitle = EVENT_TITLES[to] || titleFromEventFile(to);
    bridges.push(`<%_ const v21b${n}FromState = getvar("stat_data.事件.锚点状态.${from}.状态", { defaults: "未触发" }); const v21b${n}FromEnd = getvar("stat_data.事件.锚点状态.${from}.收尾", { defaults: false }); const v21b${n}ToState = getvar("stat_data.事件.锚点状态.${to}.状态", { defaults: "未触发" }); if ((v21b${n}FromState === "完成" || v21b${n}FromState === "变形" || (v21b${n}FromState === "活跃" && v21b${n}FromEnd === true)) && (v21b${n}ToState === "未触发" || v21b${n}ToState === "预兆")) { _%>\n### ${from}→${to} · ${fromTitle} → ${toTitle}\n- 触发时机：${fields.trigger}\n- 剧情引子：${fields.lead}\n- 预兆写法：${fields.omen}\n- 承接因果：${fields.causal}\n- 取消态守卫：若${from}为取消，先核对${to}必要因果与替代入口；状态栏不得自动推进。\n<%_ } _%>`);
  }
  if (bridges.length) {
    const finalClose = text.lastIndexOf('\n<%_ } _%>');
    if (finalClose < 0) throw new Error('mainline 末尾闭合标记缺失');
    text = `${text.slice(0, finalClose)}\n\n${bridges.join('\n\n')}${text.slice(finalClose)}`;
  }
  writeText('src/prompts/mainline.md', text);
}

console.log('[9/10] card/manifest/profile/host_acceptance/文档/校验器…');
{
  const card = readJson('src/card.json');
  card.name = '《诡异药剂师》v0.21';
  card.character_version = '0.21.0';
  card.creator_notes = 'v0.21 内部候选版。由 v0.20 升版，全量合入 E594-E646（S81-S87）共53个事件锚点、8份概念增量与27份新概念、核心人物增量与8名新NPC。E646为当前版本终点（迷雾海猎杀开放）；玩家始终掌握林恩的对白、行动、判断、记忆、内心与关系选择。需要 SillyTavern 1.17.0 与酒馆助手 4.9.1；真实宿主验收待执行。v1.0以前不公开发布。';
  writeJson('src/card.json', card);

  const manifest = readJson('manifest.json');
  manifest.id = 'tavernweave.weird-apothecary.v0.21';
  manifest.version = '0.21.0';
  if (manifest.worldbook) manifest.worldbook.version = '0.21.0';
  manifest.packed_json = 'dist/诡异药剂师_v0.21.json';
  if (manifest.card) manifest.card.display_name = '《诡异药剂师》v0.21';
  if (Array.isArray(manifest.deliverables)) manifest.deliverables = ['dist/诡异药剂师_v0.21.json'];
  for (const dep of manifest.runtime_dependencies ?? []) {
    if (dep.id === 'mvu-loader') dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-loader-v0.21]';
    if (dep.id === 'mvu-zod-schema') {
      dep.role = '验证 v0.21 状态结构';
      dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-schema-v0.21]';
    }
  }
  writeJson('manifest.json', manifest);

  const profile = readJson('profile.json');
  profile.id = 'tavernweave.weird-apothecary.v0.21';
  profile.version = '0.21.0';
  profile.display_name = '《诡异药剂师》v0.21';
  writeJson('profile.json', profile);

  const host = readJson('host_acceptance.json');
  const previousSha = host.sha256;
  host.version = '0.21.0';
  host.status = 'pending';
  host.artifact = 'dist/诡异药剂师_v0.21.json';
  host.bytes = null;
  host.sha256 = null;
  host.previous_artifact_sha256 = previousSha;
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
  host.notes = `v0.21合入E594-E646、${conceptUpdates.length + conceptNews.length}份概念（${conceptUpdates.length}增量+${conceptNews.length}新）及16个人物增量与8名新NPC；真实宿主验收仍pending。`;
  writeJson('host_acceptance.json', host);

  writeText('SCAFFOLD.md', `# v0.21 工程壳

- 建立时间：2026-09-29
- 基线：\`诡异药剂师_MVU_v0.20\`（冻结，勿回改）
- 状态：已集成 E594—E646（S81—S87）；版本 0.21.0
- 设定来源：\`角色卡设定/v0.21工作区\`
- 校验：\`npm run check\`（build + validate + validate-integration）
- 产物：\`dist/诡异药剂师_v0.21.json\`；host_acceptance 保持 pending
`);

  writeText('README.md', `# 《诡异药剂师》MVU v0.21

当前维护版本：0.21.0。包含 E01—E646 共646个事件锚点、S0—S87、世界书词条见 contract，28名核心关系人物保持不变，41名可选NPC。E646为开放终点（迷雾海猎杀）。

## 本版集成

- E594—E646共53个事件；${conceptUpdates.length + conceptNews.length}份概念（${conceptUpdates.length}份既有增量 + ${conceptNews.length}份新概念 ${NEW_CONCEPT_IDS[0]}—${NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1]}，UID ${NEW_CONCEPT_UID_START}—${NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1}）。
- 16个人物增量与8名新NPC（伊甸娜、精灵王、血神、黑夜之神、纱奈儿、现实之神、真理神王、血枢）。
- E646保持开放终点；真实幼年角色（纱奈儿、返幼期星轨）严格非性，成年存在按成年口径直写；玩家主权不变。
- 真机实测暂缓，host_acceptance 保持 pending。

## 构建与校验

在本目录运行 \`npm run check\`。生成物为 \`dist/诡异药剂师_v0.21.json\`，禁止直接修改。
`);

  writeText('AGENTS.md', `# 《诡异药剂师》MVU v0.21 接手指南

更新：2026-09-29。本目录为当前维护工程 0.21.0，剧情止于 E646；先读根目录版本与工作区索引及本目录 README.md。

## 权威与写入范围

用户当前要求 → 创作规划.yaml → contract.json → manifest.json → profile.json → src → dist。
保留v0.20及更早版本，不将历史报告改写为当前事实。dist只通过工程构建生成。
玩家独占林恩的对白、主动行动、决定、判断、记忆与内心；默认走向是可改变的事件因果。

## 当前覆盖

- 在 v0.20 基础上集成 v0.21 设定：新增 E594—E646 共 53 事件，S81—S87；总锚点 E01—E646。
- 全卡 646 事件、世界书条目见 contract、28 名核心关系人物，41 名可选 NPC。
- 本轮概念：${conceptUpdates.length} 既有增量 + ${conceptNews.length} 新增 ${NEW_CONCEPT_IDS[0]}—${NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1]}；运行 UID ${NEW_CONCEPT_UID_START}—${NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1}；事件素材 UID ${EVENT_UID_START}—${EVENT_UID_START + EVENT_IDS.length - 1}。
- 核心人物多阶段增量；新 NPC UID 334—341。
- E646 为开放终点（迷雾海猎杀）；成人内容真实直白，无防御性叠甲。

## 创作与安全铁律

- 玩家独占林恩的对白、主动行动、决定、判断、记忆与内心；默认走向只供因果推演。
- 本书为色色风后宫文：成人角色的情色、生理反应与调教羁绊全面开放；成立则直接呈现动作、身体反应、过程与结果。玩家仍可拒绝、打断或改写林恩的回应。
- **色色直白化**：成人情节不回避、不占位、不用非性替代糊弄。
- **NSFW年龄口径**：判断标准是灵魂实际年龄与原作身份，不是外形。真实幼年角色（纱奈儿十岁、返幼期星轨、小林恩婴儿）严格固定纯净亲情守护；成年存在的幼态外形（左左、欲望母树等）按成年处理。
- **禁元数据词汇**：角色卡与世界书正文禁止出现"第X章、小总结、大总结、阶段几"等总结/原文词汇，来源与门控一律用 E 编号或 C 编号。
- 严禁加入任何说教式 AI 免责声明、道德评判或防御性叠甲。

## 工程契约

- MVU根为元数据、世界、林恩、事件、关系、角色关系、系统。
- 事件状态切换采用一条完整replace /事件；Schema、初始化、状态栏、调度与契约同步。
- 事件素材 UID700—${EVENT_UID_START + EVENT_IDS.length - 1} 默认 disabled，UID1 负责事件全文注入。
- 人物/概念沿用事件窗口±1与原生关键词双路激活，同UID去重；双递归保护保留。
- 新增资料必须同步世界书event_ids、contract与路由兜底。

## 验收

源码修改后运行npm run check；实际断言次数与产物指纹记录在host_acceptance.json。
真实SillyTavern验收按作者要求暂缓，不自动导入、开聊天或运行宿主测试，status保持pending。
`);

  let plan = readText('创作规划.yaml');
  plan = plan
    .replaceAll('诡异药剂师_MVU_v0.20', '诡异药剂师_MVU_v0.21')
    .replaceAll('《诡异药剂师》v0.20', '《诡异药剂师》v0.21')
    .replaceAll('0.20.0', '0.21.0')
    .replaceAll('dist/诡异药剂师_v0.20.json', 'dist/诡异药剂师_v0.21.json')
    .replaceAll('诡异药剂师_MVU_v0.19（冻结基线）', '诡异药剂师_MVU_v0.20（冻结基线）');
  writeText('创作规划.yaml', plan);

  let validate = readText('tools/validate.mjs');
  validate = validate
    .replaceAll('dist/诡异药剂师_v0.20.json', 'dist/诡异药剂师_v0.21.json')
    .replaceAll('《诡异药剂师》v0.20', '《诡异药剂师》v0.21')
    .replace("ok(EVENT_IDS.length === 593, '五百九十三事件锚点');", "ok(EVENT_IDS.length === 646, '六百四十六事件锚点');")
    .replace("ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E593', '事件锚点范围为E01-E593');", "ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E646', '事件锚点范围为E01-E646');")
    .replace("ok(contract.required.terminal_hook_event === 'E593' || contract.required.terminal_hook_event?.id === 'E593', 'E593为本版开放终点');", "ok(contract.required.terminal_hook_event === 'E646' || contract.required.terminal_hook_event?.id === 'E646', 'E646为本版开放终点');")
    .replace("ok(conceptRouterContent.includes('E593'), '路由事件序列含E593');", "ok(conceptRouterContent.includes('E646'), '路由事件序列含E646');")
    .replace("  if (eventId === 'E593') ok(!content.includes('## 下一事件引入'), 'E593冻结终点不设下一事件引入');", "  if (eventId === 'E646') ok(!content.includes('## 下一事件引入'), 'E646冻结终点不设下一事件引入');")
    .replace("ok(helperSource.every(script => String(script.name ?? '').includes('v0.20')), '酒馆助手脚本命名含v0.20');", "ok(helperSource.every(script => String(script.name ?? '').includes('v0.21')), '酒馆助手脚本命名含v0.21');")
    .replace("ok(!statusUiText.includes(\"from: 'E593'\"), 'E593无推进按钮');", "ok(!statusUiText.includes(\"from: 'E646'\"), 'E646无推进按钮');")
    .replace("ok(bridgePairs.length === 592, '全卡桥共592对');", "ok(bridgePairs.length === 645, '全卡桥共645对');")
    .replace("ok(statusUiText.includes(\"from: 'E592', to: 'E593'\"), '状态栏桥对覆盖E592→E593');", "ok(statusUiText.includes(\"from: 'E645', to: 'E646'\"), '状态栏桥对覆盖E645→E646');")
    .replace('ok(statusBridgeCount === 592, `状态栏桥对共592对（实际${statusBridgeCount}）`);', 'ok(statusBridgeCount === 645, `状态栏桥对共645对（实际${statusBridgeCount}）`);')
    .replace("ok(EVENT_IDS.includes('E593'), '开放终态事件E593已纳入事件序列');", "ok(EVENT_IDS.includes('E646'), '开放终态事件E646已纳入事件序列');")
    .replace("const v20Npcs = ['艾维儿', '弑莉叶', '见习夜医', '林蒙', '神皇', '月儿兰', '血袍指挥官', '黑甲主母', '入梦者', '紫罗兰大君'];", "const v20Npcs = ['艾维儿', '弑莉叶', '见习夜医', '林蒙', '神皇', '月儿兰', '血袍指挥官', '黑甲主母', '入梦者', '紫罗兰大君', '伊甸娜', '精灵王', '血神', '黑夜之神', '纱奈儿', '现实之神', '真理神王', '血枢'];");
  validate = replaceOnce(
    validate,
    /const e593Content = await readText\('src\/events\/E593_无序走廊初探\.md'\);\nok\(e593Content\.includes\('无序走廊'\) && !e593Content\.includes\('## 下一事件引入'\), '[^']*'\);/,
    "const e593Content = await readText('src/events/E593_无序走廊初探.md');\nok(e593Content.includes('无序走廊') && e593Content.includes('## 下一事件引入（E594'), 'E593已引入E594');\nconst e646Content = await readText('src/events/E646_迷雾海猎杀.md');\nok(e646Content.includes('迷雾') && !e646Content.includes('## 下一事件引入'), 'E646开放终点停在迷雾海猎杀且不设下一事件引入');",
    'validate E593/E646 terminal check',
  );
  writeText('tools/validate.mjs', validate);

  let integ = readText('tools/validate-integration.mjs');
  integ = integ
    .replaceAll('0.20.0', '0.21.0').replaceAll('v0.20', 'v0.21')
    .replace('for (let i = 349; i <= 593; i++) {', 'for (let i = 349; i <= 646; i++) {')
    .replace("ok(Object.keys(contract.required.optional_characters).length === 33, '应登记33名可选NPC');", "ok(Object.keys(contract.required.optional_characters).length === 41, '应登记41名可选NPC');")
    .replace('for (let current = 318; current <= 593; current++) {', 'for (let current = 318; current <= 646; current++) {')
    .replace("localsFor(593, state)", "localsFor(646, state)");
  writeText('tools/validate-integration.mjs', integ);

  const pkg = readJson('package.json');
  pkg.version = '0.21.0';
  writeJson('package.json', pkg);
}

console.log('[10/10] 合并记录…');
{
  const oldMap = readJson('合并记录/人物增量映射.json');
  const mergedRecords = [...(oldMap.records || []), ...personaRecords];
  writeJson('合并记录/人物增量映射.json', {
    date: '2026-09-29',
    source_count: mergedRecords.length,
    records: mergedRecords,
    note: '保留既有映射，并追加v0.21人物/NPC增量；新NPC见注册映射。',
  });

  const optional = readJson('合并记录/注册映射.json');
  optional.optional = {
    ...optional.optional,
    ...Object.fromEntries(NEW_NPCS.map(npc => [npc.name, {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(readText(`src/characters/${npc.name}/NPC.md`)),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: 'v0.21新增NPC，具备生境六组件',
      profile_format: 'compact_npc',
    }])),
  };
  for (const [name, events] of charEventAdds) {
    if (optional.optional[name]) {
      optional.optional[name].event_ids = [...new Set([...(optional.optional[name].event_ids ?? []), ...events])].sort(byEventNo);
    }
  }
  optional.worldbookEntries = globalThis.__WB_COUNT__;
  optional.coreCharacterCount = 28;
  writeJson('合并记录/注册映射.json', optional);

  writeText('合并记录/v0.21事件合并.md', `# v0.21 事件合并

范围：E594—E646（53条），UID ${EVENT_UID_START}—${EVENT_UID_START + EVENT_IDS.length - 1}，insertion_order ${EVENT_INSERTION_START}—${EVENT_INSERTION_START + EVENT_IDS.length - 1}。
来源：角色卡设定/v0.21工作区/事件/。
E593已改写下一事件引入至E594；E646为开放终点，无下一事件引入、无E647。
阶段：S81—S87（见 schema phaseNames / 摘要/阶段末总述.md）。
`);
  writeText('合并记录/v0.21概念合并.md', `# v0.21 概念合并

- update ${conceptUpdates.length}：按事件门控追加到既有 src/concepts 文件，保留早期变体，扩展标题事件数组。基线取卡内文件。
- new ${conceptNews.length}：${NEW_CONCEPT_IDS[0]}—${NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1]}；运行 UID ${NEW_CONCEPT_UID_START}—${NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1}。
- 文件名保留工作区输出文件名并补全 # 概念· 标题行。
`);
  writeText('合并记录/v0.21人物合并.md', `# v0.21 人物合并

- 人物增量 \`人物增量/*_D.md\` 追加到对应多阶段人设.md 或 NPC.md。映射：银色幻想→a01银色幻想；自缚天使、主母→倒吊天使（C592：主母即倒吊天使守序善面）；巨像→巨像之脑；母树→欲望母树；织梦、入梦者→入梦者（织梦即入梦者）。
- 新NPC：伊甸娜、精灵王、血神、黑夜之神、纱奈儿、现实之神、真理神王 → src/characters/<名>/NPC.md，世界书 UID 334—340。
- 血枢：卡内原无独立角色，\`血枢_D\` 作为新可选NPC注册（UID 341），内容为事件门控增量。
- 纱奈儿（真十岁）与返幼期星轨严格非性；成年存在的幼态外形按成年口径。不发明 E646 之后结局。
`);
  writeText('合并记录/待拍板.md', `# 待拍板

当前无阻塞项（已按规范自行决定）：

1. 阶段中文名：S81—S87 取自 \`摘要/阶段末总述.md\` 标题。
2. E593→E594 衔接：E593 引入段按 E594 前置条件补写（重伤大魔独入走廊深处）。
3. 主母→倒吊天使、织梦→入梦者、巨像→巨像之脑、母树→欲望母树：按卡内既有角色同一性映射。
4. 血枢：卡内无对应角色，注册为第 8 名新可选NPC（UID 341）。
5. 概念 UID：新概念按逻辑号排序后从 ${NEW_CONCEPT_UID_START} 连续分配。
6. 可选NPC：在既有 33 名上新增 8 名，共 41 名。
`);
}

console.log(JSON.stringify({
  status: 'wired',
  events: EVENT_IDS.length,
  concepts_new: NEW_CONCEPT_IDS.length,
  concepts_update: conceptUpdates.length,
  npcs: NEW_NPCS.length,
  worldbook_entries: globalThis.__WB_COUNT__,
  event_uid: `${EVENT_UID_START}-${EVENT_UID_START + EVENT_IDS.length - 1}`,
  concept_uid: `${NEW_CONCEPT_UID_START}-${NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1}`,
}, null, 2));
