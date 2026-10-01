// v0.20 阶段十五接线：E541—E593 + 概念/人物/NPC + 注册表与校验边界
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = resolve(ROOT, '../../角色卡设定/v0.20工作区');
const EVENT_START = 541;
const EVENT_END = 593;
const EVENT_IDS = Array.from({ length: EVENT_END - EVENT_START + 1 }, (_, i) => `E${EVENT_START + i}`);
const PHASES = {
  S74: { name: '心灵之海与黑袍审判', start: 541, end: 547, line: '入海百年与法则示范后银幻反噬、船长半步落地；越阶决战至两败一放逐，嘲讽点燃向神拔刀，黑巾撕破身份全场公开。' },
  S75: { name: '地狱统一与根源军团', start: 548, end: 554, line: '动机坦白统一地狱；污染筛查掀入盟潮，五百拉练建军并公开分碎片；泰坦回收集体圆谎，巫神催婚把柄抛到门槛外。' },
  S76: { name: '主宇宙边疆与远征许可', start: 555, end: 561, line: '小小共死承诺后防线与狱卒原则性放行；绝密入幽冥海织锚点遇蓝发人影，登陆边缘世界留守必经之路。' },
  S77: { name: '边缘世界与血肉方舟', start: 562, end: 568, line: '机械神皇诈取星炬边王情报；无序生灵反噬后艾维儿归场指母利用；初诞路判堵死，五舟追至猩红之星工厂。' },
  S78: { name: '迷雾时间异变与血月入口', start: 569, end: 578, line: '可控无序崩核后迷雾幻象至错误道路碎神格；异时末日冻结、高塔双河破碎，共鸣破障踏入真实血月战场。' },
  S79: { name: '血月循环与魔躯传承', start: 579, end: 585, line: '血月重置揭红月机制与黑甲主母疑点；开门破循环承魔躯翼，横断斩瞳后魂灯突围，护航踏入天堂遗址血枢。' },
  S80: { name: '天堂遗产与无序走廊', start: 586, end: 593, line: '血枢封存后白焰成型对投影撤离；黑夜城降临碾压双星，王庭近卫复苏，无序走廊五廊汇合停于开放悬念。' },
};
const NEW_CONCEPT_UID_START = 2706;
const EVENT_UID_START = 1240;
const EVENT_INSERTION_START = 975;
const NEW_NPCS = [
  { name: '艾维儿', file: '艾维儿.md', entry_id: 324, extra_keys: ['蓝龙王女', '龙骑士'], src_dir: '新NPC' },
  { name: '弑莉叶', file: '弑莉叶.md', entry_id: 325, extra_keys: ['小丧服', '血肉幼女'], src_dir: '新NPC' },
  { name: '见习夜医', file: '见习夜医.md', entry_id: 326, extra_keys: ['纯白鸦嘴面具', '夜医学徒'], src_dir: '新NPC' },
  { name: '林蒙', file: '林蒙.md', entry_id: 327, extra_keys: ['暗金重铠', '元素老兵'], src_dir: '新NPC' },
  { name: '神皇', file: '神皇.md', entry_id: 328, extra_keys: ['神王分身', '耀日圣辉'], src_dir: '新NPC' },
  { name: '月儿兰', file: '月儿兰.md', entry_id: 329, extra_keys: ['精灵祭司', '银月流光'], src_dir: '新NPC' },
  { name: '血袍指挥官', file: '血袍指挥官.md', entry_id: 330, extra_keys: ['猩红方舟指挥官', '生体战甲'], src_dir: '新NPC' },
  { name: '黑甲主母', file: '黑甲主母.md', entry_id: 331, extra_keys: ['未来主母', '纳米玄黑战甲'], src_dir: '新NPC' },
  { name: '入梦者', file: '入梦者.md', entry_id: 332, extra_keys: ['西王代行者', '梦境气泡'], src_dir: '新NPC' },
  { name: '紫罗兰大君', file: '紫罗兰大君.md', entry_id: 333, extra_keys: ['深紫流火', '深渊魔君'], src_dir: '新NPC' },
];
const CHAR_TARGET = {
  人偶家: 'src/characters/人偶家/多阶段人设.md',
  以太: 'src/characters/以太/NPC.md',
  哭泣小丑: 'src/characters/哭泣小丑/多阶段人设.md',
  圣安娜: 'src/characters/圣安娜/NPC.md',
  夏娃: 'src/characters/夏娃/NPC.md',
  孽主: 'src/characters/孽主/NPC.md',
  小小: 'src/characters/小小/多阶段人设.md',
  左左: 'src/characters/左左/多阶段人设.md',
  巨像之脑: 'src/characters/巨像之脑/多阶段人设.md',
  巫神头颅: 'src/characters/巫神头颅/多阶段人设.md',
  康斯坦丁: 'src/characters/康斯坦丁/NPC.md',
  星轨: 'src/characters/星轨/NPC.md',
  泰坦头颅: 'src/characters/泰坦头颅/多阶段人设.md',
  自缚天使: 'src/characters/倒吊天使/多阶段人设.md',
  艾雯爵士: 'src/characters/艾雯爵士/多阶段人设.md',
  a01银色幻想: 'src/characters/a01银色幻想/多阶段人设.md',
  银色幻想: 'src/characters/a01银色幻想/多阶段人设.md',
};
const E540_TO_E541 = {
  trigger: 'E540已完成、变形、取消或活跃且收尾，E541尚未触发或处于预兆；黑夜城已「我们起航」，心灵之海大船破浪而出，入海试炼与百年时钟进入可观察阶段。',
  lead: '起航的轰鸣与波涛未平，前方心灵之海泛起奇异时空波动，初诞者三招试炼与百年修炼的门槛已在眼前。',
  omen: '只写当前心灵之海航行景象与前方时空波动，不提前结算百年修炼结果或展示神王级反噬。',
  causal: 'E540起航使心灵之海深潜与百年试炼成为现实可能；是否踏入修炼由玩家决定。',
};

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
  const candidates = [name];
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
function resolveConceptBase(item) {
  const prefixes = [
    '角色卡本体/诡异药剂师_MVU_v0.18/',
    '角色卡本体/诡异药剂师_MVU_v0.19/',
    '角色卡本体/诡异药剂师_MVU_v0.20/',
  ];
  if (item.base_path) {
    for (const prefix of prefixes) {
      if (item.base_path.startsWith(prefix)) {
        const rel = item.base_path.slice(prefix.length);
        if (existsSync(resolve(ROOT, rel))) return rel;
      }
    }
  }
  const files = allFiles(resolve(ROOT, 'src/concepts')).filter(f => {
    const name = f.split(/[/\\]/).pop();
    return name.startsWith(`${item.id}_`) && name.endsWith('.md');
  });
  if (!files[0]) throw new Error(`概念基线缺失：${item.id} ${item.base_path || ''}`);
  return relFrom(files[0]);
}
function coreNameOf(name) {
  if (name === '自缚天使') return '倒吊天使';
  if (name === '银色幻想') return 'a01银色幻想';
  return name;
}

const delivery = JSON.parse(readText(resolve(WORKSPACE, '交付清单.json')));
const summariesV020 = JSON.parse(readText(resolve(WORKSPACE, '摘要/事件摘要.json')));
const bridgesV020 = JSON.parse(readText(resolve(WORKSPACE, '摘要/衔接表.json')));
const summaryMap = new Map(summariesV020.map(s => [s.id, s]));
const conceptUpdates = delivery.concepts.filter(c => c.kind === 'update');
const conceptNews = delivery.concepts.filter(c => c.kind === 'new');
const NEW_CONCEPT_IDS = conceptNews.map(c => c.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

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

const EVENT_TITLES = Object.fromEntries(EVENT_IDS.map(id => [id, titleFromEventFile(id)]));
EVENT_TITLES.E540 = titleFromEventFile('E540');

console.log('[2/12] E540→E541 衔接…');
{
  const path = eventFileFor('E540');
  let text = readText(path);
  if (!text.includes('## 下一事件引入（E541·')) {
    const block = `\n## 下一事件引入（E541·${EVENT_TITLES.E541}）\n- 触发时机：${E540_TO_E541.trigger}\n- 剧情引子：${E540_TO_E541.lead}\n- 预兆写法：${E540_TO_E541.omen}\n- 承接因果：${E540_TO_E541.causal}\n`;
    text = replaceOnce(text, /\n<%_ \} _%>\s*$/, `${block}\n<%_ } _%>`, 'E540→E541 bridge');
  }
  text = text
    .replace(/本事件为阶段开放终点：停在已起航「我们起航」/g, '停在已起航「我们起航」并向E541承接')
    .replace(/本事件止于此。禁止写/g, '本事件正文止于此；向E541承接。禁止写')
    .replace(/开放终点＝已「我们起航」；砍地下入口/g, '起航承接E541；砍地下入口')
    .replace(/开放终点——已起航/g, '起航承接E541')
    .replace(/本文件不写后继桥段/g, '后继由下一事件引入段承接');
  writeText(path, text);
}

console.log('[3/12] 合并概念增量与新概念…');
for (const item of conceptUpdates) {
  const baseRel = resolveConceptBase(item);
  let base = readText(baseRel);
  const incr = readText(resolve(WORKSPACE, item.output)).trim();
  const heading = parseConceptHeading(base);
  const incrEvents = extractEventsFromText(incr);
  if (!heading) throw new Error(`无法解析概念标题：${baseRel}`);
  const mergedEvents = [...new Set([...heading.eventIds, ...incrEvents])]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const newHeading = `# 概念·${heading.category}·${heading.name}（事件${JSON.stringify(mergedEvents)}）`;
  base = base.replace(heading.full, newHeading);
  const blocks = incr.split(/(?=<%_ if )/g).map(s => s.trim()).filter(Boolean);
  let appended = base.trimEnd();
  for (const block of blocks) {
    const ev = block.match(/锚点状态\.(E\d+)/)?.[1];
    if (ev && appended.includes(`# ${item.id}·`) && appended.includes(`·${ev}`)) {
      const re = new RegExp(`# ${item.id}·[^\\n]*·${ev}\\b`);
      if (re.test(appended)) continue;
    }
    if (ev && appended.includes(`锚点状态.${ev}.状态`) && appended.includes(`# ${item.id}·`)) {
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
function appendCharacterIncrement(targetRel, sourceRel) {
  let target = existsSync(resolve(ROOT, targetRel)) ? readText(targetRel).trimEnd() : '';
  const source = readText(resolve(WORKSPACE, sourceRel)).trim();
  const blocks = source.split(/(?=<%_ if )/g).map(s => s.trim()).filter(Boolean);
  for (const block of blocks) {
    const ev = block.match(/锚点状态\.(E\d+)/)?.[1];
    if (!ev) continue;
    if (!target.includes(block)) target += `\n\n${block}\n`;
  }
  writeText(targetRel, `${target}\n`);
  return blocks;
}
for (const ch of delivery.characters) {
  const out = ch.output || '';
  if (!out.startsWith('人物增量/')) continue;
  const logicalName = ch.name.replace(/_[A-Z]$/, '');
  const target = CHAR_TARGET[logicalName] || CHAR_TARGET[coreNameOf(logicalName)];
  if (!target) throw new Error(`人物目标未映射：${ch.name} → ${logicalName}`);
  appendCharacterIncrement(target, out);
  const events = extractEventsFromText(readText(resolve(WORKSPACE, out)));
  const coreName = coreNameOf(logicalName);
  const prev = charEventAdds.get(coreName) || [];
  charEventAdds.set(coreName, [...new Set([...prev, ...events])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
  personaRecords.push({
    source: `角色卡设定/v0.20工作区/${out}`,
    target,
    events,
    mode: 'source_sync',
    adapted_events: [],
  });
}
for (const npc of NEW_NPCS) {
  const src = resolve(WORKSPACE, npc.src_dir || '新NPC', npc.file);
  const body = readText(src).trim();
  const out = `src/characters/${npc.name}/NPC.md`;
  writeText(out, `# ${npc.name}\n\n${body}\n`);
}

console.log('[5/12] schema / initvar / status…');
{
  let schema = readText('src/scripts/schema.js');
  schema = schema.replaceAll('诡异药剂师v0.19', '诡异药剂师v0.20')
    .replace("卡名: z.literal('《诡异药剂师》v0.19')", "卡名: z.literal('《诡异药剂师》v0.20')")
    .replace("版本: z.literal('0.19.0')", "版本: z.literal('0.20.0')");
  if (!schema.includes('S74:')) {
    const phaseLines = Object.entries(PHASES).map(([id, v]) => `  ${id}: '${v.name}',`).join('\n');
    schema = replaceOnce(schema, /(  S73: '[^']*',\n)(\};)/, `$1${phaseLines}\n$2`, 'schema phaseNames');
  }
  if (!schema.includes("E541: '")) {
    const titleLines = EVENT_IDS.map(id => `  ${id}: '${EVENT_TITLES[id]}',`).join('\n');
    schema = replaceOnce(schema, /(  E540: '[^']*',\n)(\};)/, `$1${titleLines}\n$2`, 'schema anchorTitles');
    const anchorLines = EVENT_IDS.map(id => `      ${id}: anchor,`).join('\n');
    schema = replaceOnce(schema, /(      E540: anchor,\n)(    \}\),)/, `$1${anchorLines}\n$2`, 'schema anchor map');
  }
  writeText('src/scripts/schema.js', schema);
}

function appendAnchors(value) {
  value.元数据.卡名 = '《诡异药剂师》v0.20';
  value.元数据.版本 = '0.20.0';
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
  status = status.replaceAll('《诡异药剂师》v0.19', '《诡异药剂师》v0.20')
    .replace(/\(540 锚点闭环\)/g, '(593 锚点闭环)')
    .replace('Array.from({ length: 540 }', 'Array.from({ length: 593 }');
  status = replaceOnce(status, /const FALLBACK_STATE = \{[\s\S]*?\};\s*let mvuAvailable/, `const FALLBACK_STATE = ${JSON.stringify(initial)};\n      let mvuAvailable`, 'status FALLBACK_STATE');
  if (!status.includes("from: 'E592', to: 'E593'")) {
    const pairs = [];
    for (let n = 540; n < EVENT_END; n += 1) {
      pairs.push(`        { from: 'E${n}', to: 'E${n + 1}', label: '结算并承接 E${n + 1}' },`);
    }
    status = replaceOnce(
      status,
      /(        \{ from: 'E539', to: 'E540', label: '结算并承接 E540' \},)/,
      `$1\n${pairs.join('\n')}`,
      'status bridge pairs',
    );
  }
  writeText('src/ui/status.html', status);
}

console.log('[6/12] 世界书事件/概念/NPC…');
{
  const book = readJson('src/worldbook.json');
  book.name = '《诡异药剂师》v0.20';
  book.description = '《诡异药剂师》v0.20 动态世界书（覆盖S0至S80、二十八名核心人物、三十三名可选NPC、五百九十三事件锚点与全量概念）';
  book.extensions = {
    ...(book.extensions ?? {}),
    tavernweave: { ...(book.extensions?.tavernweave ?? {}), id: 'weird-apothecary-worldbook', version: '0.20.0' },
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
  const e540idx = book.entries.findIndex(e => e.id === 1239);
  if (e540idx < 0) throw new Error('未找到 E540 UID1239');
  book.entries.splice(e540idx + 1, 0, ...newEventEntries);

  const usedKeys = new Set(book.entries.flatMap(e => e.keys ?? []));
  const newConceptEntries = [];
  for (const [index, logicalId] of NEW_CONCEPT_IDS.entries()) {
    const uid = NEW_CONCEPT_UID_START + index;
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

  for (const entry of book.entries) {
    const logicalId = entry.extensions?.tavernweave?.logical_id;
    if (!logicalId || !entry.content_file) continue;
    if (!conceptUpdates.some(c => c.id === logicalId)) continue;
    const parsed = parseConceptHeading(readText(entry.content_file));
    if (!parsed) continue;
    entry.comment = `[概念·${parsed.category}]${parsed.name}`;
    entry.extensions.tavernweave.event_ids = parsed.eventIds;
  }

  for (const npc of NEW_NPCS) {
    const content = readText(`src/characters/${npc.name}/NPC.md`);
    const event_ids = extractEventsFromText(content);
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
        tavernweave: { event_ids, route_kind: 'optional_npc', profile_format: 'compact_npc' },
      },
      secondary_keys: [],
    };
    book.entries = book.entries.filter(e => e.id !== npc.entry_id);
    const after = book.entries.findIndex(e => e.id === npc.entry_id - 1);
    book.entries.splice(after < 0 ? book.entries.length : after + 1, 0, entry);
  }

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
  contract.version = '0.20.0';
  contract.required.stage_scope = 'E01至E593；本版新增E541至E593，S0至S80，E593为当前开放终点。';
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
  contract.required.worldbook_version = '0.20.0';
  const wbCount = globalThis.__WB_COUNT__;
  contract.required.worldbook_entry_count = wbCount;
  contract.worldbook_entry_count = wbCount;
  contract.required.terminal_hook_event = 'E593';
  contract.required.terminal_hook_note = 'E593为S80（天堂遗产与无序走廊）开放终点：无序走廊五廊汇合停于开放悬念，后续事件不在本版展开。';
  contract.stage_scope = contract.required.stage_scope;
  contract.acceptance = {
    ...contract.acceptance,
    event_anchors: EVENT_END,
    stage_scope: 'S0至S80；E01至E593',
    terminal_hook_event: 'E593',
    bridge_pairs_count: EVENT_END - 1,
    source_boundary: '原著阶段十五范围至第2246章（E593封口）；不得读取或泄漏第2247章及以后',
  };

  contract.required.character_event_ids = contract.required.character_event_ids ?? {};
  contract.required.optional_characters = contract.required.optional_characters ?? {};
  for (const [name, events] of charEventAdds) {
    if (contract.required.core_characters.includes(name)) {
      contract.required.character_event_ids[name] = [...new Set([
        ...(contract.required.character_event_ids[name] ?? []),
        ...events,
      ])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    }
    if (contract.required.optional_characters[name]) {
      contract.required.optional_characters[name].event_ids = [...new Set([
        ...(contract.required.optional_characters[name].event_ids ?? []),
        ...events,
      ])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    }
  }

  for (const npc of NEW_NPCS) {
    const content = readText(`src/characters/${npc.name}/NPC.md`);
    contract.required.optional_characters[npc.name] = {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(content),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: 'v0.20新增NPC；按事件及关键词激活，具备生境六组件。',
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
    stage15_concept_count: NEW_CONCEPT_IDS.length,
    stage15_concept_ranges: [{
      logical_start: NEW_CONCEPT_IDS[0],
      logical_end: NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1],
      uid_start: NEW_CONCEPT_UID_START,
      uid_end: NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1,
      count: NEW_CONCEPT_IDS.length,
    }],
    stage15_note: `v0.20新增阶段十五概念${NEW_CONCEPT_IDS[0]}-${NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1]}共${NEW_CONCEPT_IDS.length}条，世界书UID${NEW_CONCEPT_UID_START}-${NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1}；另原位增量更新${conceptUpdates.length}份既有概念。`,
  };
  writeJson('contract.json', contract);

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

  const promptFiles = [
    'src/prompts/system.md',
    'src/prompts/world.md',
    'src/prompts/card_description.md',
    'src/prompts/mvu_update_rules.md',
  ];
  for (const p of promptFiles) {
    let t = readText(p);
    t = t.replaceAll('《诡异药剂师》v0.19', '《诡异药剂师》v0.20')
      .replaceAll('E01至E540', 'E01至E593')
      .replaceAll('E01-E540', 'E01-E593')
      .replaceAll('五百四十个', '五百九十三个')
      .replaceAll('五百四十', '五百九十三');
    t = t.replace(/E540是当前开放终点：[^\n]*/g, 'E593是当前开放终点：无序走廊五廊汇合停于开放悬念，不创建E594或引出后续。');
    t = t.replace(/E540为当前开放终点[^\n]*/g, 'E593为当前开放终点');
    t = t.replace(/E540是本版开放终点[^\n]*/g, 'E593是本版开放终点：无序走廊五廊汇合停于开放悬念，不创建E594或引出后续内容。');
    writeText(p, t);
  }

  let loader = readText('src/scripts/mvu_loader.js');
  loader = loader.replaceAll('诡异药剂师v0.19', '诡异药剂师v0.20');
  writeText('src/scripts/mvu_loader.js', loader);

  const helpers = readJson('src/tavern_helper_scripts.json');
  for (const script of helpers) {
    if (typeof script.name === 'string') script.name = script.name.replaceAll('v0.19', 'v0.20');
    if (typeof script.id === 'string') script.id = script.id.replaceAll('v0.19', 'v0.20');
    if (typeof script.info === 'string') {
      script.info = script.info
        .replaceAll('v0.19', 'v0.20')
        .replaceAll('五百四十', '五百九十三')
        .replaceAll('E01-E540', 'E01-E593')
        .replaceAll('S0-S73', 'S0-S80');
    }
  }
  writeJson('src/tavern_helper_scripts.json', helpers);

  let regex = readText('src/regex_scripts.json');
  regex = regex.replaceAll('v0.19', 'v0.20');
  writeText('src/regex_scripts.json', regex);
}

console.log('[8/12] mainline（追加E541—E593并改写E540终点）…');
{
  let text = readText('src/prompts/mainline.md');
  text = text.replace('## 七十四个宽阶段', '## 八十一个宽阶段')
    .replace('五百四十个事件锚点依次记录为E01至E540', '五百九十三个事件锚点依次记录为E01至E593');
  text = text.replace(/10\. E540是当前开放终点：[^\n]+/, '10. E593是当前开放终点：无序走廊五廊汇合停于开放悬念，不创建E594或引出后续。');

  if (!text.includes('- S74·')) {
    const lines = Object.entries(PHASES).map(([id, v]) => `- ${id}·${v.name}：${v.line}`).join('\n');
    text = replaceOnce(text, /(- S73·[^\n]+\n)/, `$1${lines}\n`, 'mainline stage list S73');
  }

  text = text.replace(
    /\{ id: 'E540', title: '地狱争霸与心灵之海计划', line: '[^']+' \},/,
    `{ id: 'E540', title: '地狱争霸与心灵之海计划', line: '起航进入幽暗心灵之海 → E541心灵之海百年修炼' },`,
  );

  const needCtx = EVENT_IDS.filter(id => !text.includes(`{ id: '${id}'`));
  if (needCtx.length) {
    const ctxObjects = needCtx.map(id => {
      const n = Number(id.slice(1));
      const next = n < EVENT_END ? `E${n + 1}` : null;
      const sum = summaryMap.get(id)?.text || EVENT_TITLES[id];
      const line = ctxLineFromBridge(id, EVENT_TITLES[id], next, next ? EVENT_TITLES[next] : '', sum).replaceAll("'", "\\'");
      return `  { id: '${id}', title: '${EVENT_TITLES[id].replaceAll("'", "\\'")}', line: '${line}' },`;
    }).join('\n');
    text = replaceOnce(text, /(  \{ id: 'E540',[^\n]+\n)\];/, `$1${ctxObjects}\n];`, 'mainline ctx tail');
  }

  const missingBridges = [];
  for (let n = 540; n < EVENT_END; n += 1) {
    const from = `E${n}`;
    const to = `E${n + 1}`;
    if (text.includes(`### ${from}→${to}`)) continue;
    missingBridges.push([from, to]);
  }
  if (missingBridges.length) {
    const bridges = [];
    for (const [from, to] of missingBridges) {
      let fields = from === 'E540' ? { ...E540_TO_E541 } : bridgeFields(from);
      if (![fields.trigger, fields.lead, fields.omen, fields.causal].every(Boolean)) {
        const pair = bridgesV020.pairs.find(p => p.from === from && p.to === to);
        if (pair) fields = { trigger: pair.trigger, lead: pair.lead, omen: pair.omen, causal: pair.causal };
      }
      if (![fields.trigger, fields.lead, fields.omen, fields.causal].every(Boolean)) {
        fields = {
          trigger: `${from}已完成、变形、取消或活跃且收尾，${to}尚未触发或处于预兆。`,
          lead: `${EVENT_TITLES[from] || titleFromEventFile(from)}收束后，现场出现通往${EVENT_TITLES[to] || titleFromEventFile(to)}的可观察变化。`,
          omen: `只写当前可观察线索，不提前结算${to}的核心结果。`,
          causal: `${from}留下的条件使${to}可以进入预兆；是否推进由玩家决定。`,
        };
      }
      const n = from.slice(1);
      const fromTitle = EVENT_TITLES[from] || titleFromEventFile(from);
      const toTitle = EVENT_TITLES[to] || titleFromEventFile(to);
      bridges.push(`<%_ const v20b${n}FromState = getvar("stat_data.事件.锚点状态.${from}.状态", { defaults: "未触发" }); const v20b${n}FromEnd = getvar("stat_data.事件.锚点状态.${from}.收尾", { defaults: false }); const v20b${n}ToState = getvar("stat_data.事件.锚点状态.${to}.状态", { defaults: "未触发" }); if ((v20b${n}FromState === "完成" || v20b${n}FromState === "变形" || (v20b${n}FromState === "活跃" && v20b${n}FromEnd === true)) && (v20b${n}ToState === "未触发" || v20b${n}ToState === "预兆")) { _%>\n### ${from}→${to} · ${fromTitle} → ${toTitle}\n- 触发时机：${fields.trigger}\n- 剧情引子：${fields.lead}\n- 预兆写法：${fields.omen}\n- 承接因果：${fields.causal}\n- 取消态守卫：若${from}为取消，先核对${to}必要因果与替代入口；状态栏不得自动推进。\n<%_ } _%>`);
    }
    const finalClose = text.lastIndexOf('\n<%_ } _%>');
    if (finalClose < 0) throw new Error('mainline 末尾闭合标记缺失');
    text = `${text.slice(0, finalClose)}\n\n${bridges.join('\n\n')}${text.slice(finalClose)}`;
  }
  writeText('src/prompts/mainline.md', text);
}

console.log('[9/12] card/manifest/profile/host_acceptance/SCAFFOLD/README/validators…');
{
  const card = readJson('src/card.json');
  card.name = '《诡异药剂师》v0.20';
  card.character_version = '0.20.0';
  card.creator_notes = 'v0.20 内部候选版。由 v0.19 升版，全量合入 E541-E593（S74-S80）共53个事件锚点、8份概念增量与48份新概念、核心人物增量与10名新NPC。E593为当前版本终点（无序走廊开放）；玩家始终掌握林恩的对白、行动、判断、记忆、内心与关系选择。需要 SillyTavern 1.17.0 与酒馆助手 4.9.1；真实宿主验收待执行。v1.0以前不公开发布。';
  writeJson('src/card.json', card);

  const manifest = readJson('manifest.json');
  manifest.id = 'tavernweave.weird-apothecary.v0.20';
  manifest.version = '0.20.0';
  if (manifest.worldbook) manifest.worldbook.version = '0.20.0';
  manifest.packed_json = 'dist/诡异药剂师_v0.20.json';
  if (manifest.card) manifest.card.display_name = '《诡异药剂师》v0.20';
  if (Array.isArray(manifest.deliverables)) manifest.deliverables = ['dist/诡异药剂师_v0.20.json'];
  for (const dep of manifest.runtime_dependencies ?? []) {
    if (dep.id === 'mvu-loader') {
      dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-loader-v0.20]';
    }
    if (dep.id === 'mvu-zod-schema') {
      dep.role = '验证 v0.20 状态结构';
      dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-schema-v0.20]';
    }
  }
  writeJson('manifest.json', manifest);

  const profile = readJson('profile.json');
  profile.id = 'tavernweave.weird-apothecary.v0.20';
  profile.version = '0.20.0';
  profile.display_name = '《诡异药剂师》v0.20';
  writeJson('profile.json', profile);

  const host = readJson('host_acceptance.json');
  host.version = '0.20.0';
  host.status = 'pending';
  host.artifact = 'dist/诡异药剂师_v0.20.json';
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
  host.notes = 'v0.20合入E541-E593、56份概念（8增量+48新）及16个人物增量与10名新NPC；真实宿主验收仍pending。';
  writeJson('host_acceptance.json', host);

  writeText('SCAFFOLD.md', `# v0.20 工程壳

- 建立时间：2026-09-25
- 基线：\`诡异药剂师_MVU_v0.19\`（冻结，勿回改）
- 状态：已集成 E541—E593（S74—S80）；版本 0.20.0
- 设定来源：\`角色卡设定/v0.20工作区\`
- 工作面：仅云端 \`/workspace/《诡异药剂师》同人角色卡制作计划\`
- 校验：\`npm run check\`（build + validate + validate-integration）
- 产物：\`dist/诡异药剂师_v0.20.json\`；host_acceptance 保持 pending
`);

  writeText('README.md', `# 《诡异药剂师》MVU v0.20

当前维护版本：0.20.0。包含 E01—E593 共593个事件锚点、S0—S80、世界书词条见 contract，28名核心关系人物保持不变，33名可选NPC。E593为开放终点（无序走廊五廊汇合）。

## 本版集成

- E541—E593共53个事件；56份概念（8份既有增量 + 48份新概念 C1421—C1468，UID 2706—2753）。
- 16个人物增量与10名新NPC（艾维儿、弑莉叶、见习夜医、林蒙、神皇、月儿兰、血袍指挥官、黑甲主母、入梦者、紫罗兰大君，具备AIRP生境六组件）。
- E593保持开放终点；幼态纯净亲情与玩家主权不变。
- 真机实测暂缓，host_acceptance 保持 pending。

## 构建与校验

在本目录运行 \`npm run check\`。生成物为 \`dist/诡异药剂师_v0.20.json\`，禁止直接修改。
`);

  writeText('AGENTS.md', `# 《诡异药剂师》MVU v0.20 接手指南

更新：2026-09-25。本目录为当前维护工程 0.20.0，剧情止于 E593；先读根目录版本与工作区索引及本目录 README.md。

## 权威与写入范围

用户当前要求 → 创作规划.yaml → contract.json → manifest.json → profile.json → src → dist。
保留v0.19及更早版本，不将历史报告改写为当前事实。dist只通过工程构建生成。
玩家独占林恩的对白、主动行动、决定、判断、记忆与内心；默认走向是可改变的事件因果。

## 当前覆盖

- 在 v0.19 基础上集成 v0.20 设定：新增 E541—E593 共 53 事件，S74—S80；总锚点 E01—E593。
- 全卡 593 事件、世界书条目见 contract、28 名核心关系人物，33 名可选 NPC。
- 本轮概念：8 既有增量 + 48 新增 C1421—C1468；运行 UID 2706—2753；事件素材 UID 1240—1292。
- 核心人物多阶段增量；新 NPC UID 324—333。
- E593 为开放终点（无序走廊五廊汇合）；幼态亲情守护；成人内容真实直白，无防御性叠甲。

## 创作与安全铁律

- 玩家独占林恩的对白、主动行动、决定、判断、记忆与内心；默认走向只供因果推演。
- 本书为色色风后宫文：成人角色的情色、生理反应与调教羁绊全面开放；成立则直接呈现动作、身体反应、过程与结果。玩家仍可拒绝、打断或改写林恩的回应。
- **色色直白化**：成人情节不回避、不占位、不用非性替代糊弄。
- **禁元数据词汇**：角色卡与世界书正文禁止出现"第X章、小总结、大总结、阶段几"等总结/原文词汇，来源与门控一律用 E 编号或 C 编号。
- 幼态外形角色严格固定纯净亲情守护与温馨治愈日常。
- 严禁加入任何说教式 AI 免责声明、道德评判或防御性叠甲。

## 工程契约

- MVU根为元数据、世界、林恩、事件、关系、角色关系、系统。
- 事件状态切换采用一条完整replace /事件；Schema、初始化、状态栏、调度与契约同步。
- 事件素材 UID700—1292 默认 disabled，UID1 负责事件全文注入。
- 人物/概念沿用事件窗口±1与原生关键词双路激活，同UID去重；双递归保护保留。
- 新增资料必须同步世界书event_ids、contract与路由兜底。

## 验收

源码修改后运行npm run check；实际断言次数与产物指纹记录在host_acceptance.json。
真实SillyTavern验收按作者要求暂缓，不自动导入、开聊天或运行宿主测试，status保持pending。
`);

  let plan = readText('创作规划.yaml');
  plan = plan
    .replaceAll('诡异药剂师_MVU_v0.19', '诡异药剂师_MVU_v0.20')
    .replaceAll('《诡异药剂师》v0.19', '《诡异药剂师》v0.20')
    .replaceAll('0.19.0', '0.20.0')
    .replaceAll('dist/诡异药剂师_v0.19.json', 'dist/诡异药剂师_v0.20.json')
    .replaceAll('诡异药剂师_MVU_v0.18（冻结基线）', '诡异药剂师_MVU_v0.19（冻结基线）');
  writeText('创作规划.yaml', plan);

  let validate = readText('tools/validate.mjs');
  validate = validate
    .replaceAll("dist/诡异药剂师_v0.19.json", "dist/诡异药剂师_v0.20.json")
    .replaceAll("《诡异药剂师》v0.19", "《诡异药剂师》v0.20")
    .replace("ok(EVENT_IDS.length === 540, '五百四十事件锚点');", "ok(EVENT_IDS.length === 593, '五百九十三事件锚点');")
    .replace("ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E540', '事件锚点范围为E01-E540');", "ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E593', '事件锚点范围为E01-E593');")
    .replace("ok(contract.required.terminal_hook_event === 'E540' || contract.required.terminal_hook_event?.id === 'E540', 'E540为本版开放终点');", "ok(contract.required.terminal_hook_event === 'E593' || contract.required.terminal_hook_event?.id === 'E593', 'E593为本版开放终点');")
    .replace("ok(conceptRouterContent.includes('E540'), '路由事件序列含E540');", "ok(conceptRouterContent.includes('E593'), '路由事件序列含E593');")
    .replace("  if (eventId === 'E540') ok(!content.includes('## 下一事件引入'), 'E540冻结终点不设下一事件引入');", "  if (eventId === 'E593') ok(!content.includes('## 下一事件引入'), 'E593冻结终点不设下一事件引入');")
    .replace("ok(helperSource.every(script => String(script.name ?? '').includes('v0.19')), '酒馆助手脚本命名含v0.19');", "ok(helperSource.every(script => String(script.name ?? '').includes('v0.20')), '酒馆助手脚本命名含v0.20');")
    .replace("ok(!statusUiText.includes(\"from: 'E540'\"), 'E540无推进按钮');", "ok(!statusUiText.includes(\"from: 'E593'\"), 'E593无推进按钮');")
    .replace("ok(bridgePairs.length === 539, '全卡桥共539对');", "ok(bridgePairs.length === 592, '全卡桥共592对');")
    .replace("ok(statusUiText.includes(\"from: 'E539', to: 'E540'\"), '状态栏桥对覆盖E539→E540');", "ok(statusUiText.includes(\"from: 'E592', to: 'E593'\"), '状态栏桥对覆盖E592→E593');")
    .replace('ok(statusBridgeCount === 539, `状态栏桥对共539对（实际${statusBridgeCount}）`);', 'ok(statusBridgeCount === 592, `状态栏桥对共592对（实际${statusBridgeCount}）`);')
    .replace("ok(EVENT_IDS.includes('E540'), '开放终态事件E540已纳入事件序列');", "ok(EVENT_IDS.includes('E593'), '开放终态事件E593已纳入事件序列');")
    .replace("ok(e492Content.includes('吃了') && e492Content.includes('## 下一事件引入（E493'), 'E492已引入E493');\nconst e540Content = await readText('src/events/E540_地狱争霸与心灵之海计划.md');\nok(e540Content.includes('我们起航') && !e540Content.includes('## 下一事件引入'), 'E540开放终点停在我们起航且不设下一事件引入');",
             "ok(e492Content.includes('吃了') && e492Content.includes('## 下一事件引入（E493'), 'E492已引入E493');\nconst e540Content = await readText('src/events/E540_地狱争霸与心灵之海计划.md');\nok(e540Content.includes('我们起航') && e540Content.includes('## 下一事件引入（E541'), 'E540已引入E541');\nconst e593Content = await readText('src/events/E593_无序走廊初探.md');\nok(e593Content.includes('无序走廊') && !e593Content.includes('## 下一事件引入'), 'E593开放终点停在无序走廊且不设下一事件引入');");
  writeText('tools/validate.mjs', validate);

  let integ = readText('tools/validate-integration.mjs');
  integ = integ
    .replaceAll('0.19.0', '0.20.0').replaceAll('v0.19', 'v0.20')
    .replace('for (let i = 349; i <= 540; i++) {', 'for (let i = 349; i <= 593; i++) {')
    .replace("ok(Object.keys(contract.required.optional_characters).length === 23, '应登记23名可选NPC');", "ok(Object.keys(contract.required.optional_characters).length === 33, '应登记33名可选NPC');")
    .replace('for (let current = 318; current <= 540; current++) {', 'for (let current = 318; current <= 593; current++) {')
    .replace("ok(typeof ejs.render(content, localsFor(540, state)) === 'string'", "ok(typeof ejs.render(content, localsFor(593, state)) === 'string'");
  writeText('tools/validate-integration.mjs', integ);

  let pkg = readJson('package.json');
  pkg.version = '0.20.0';
  writeJson('package.json', pkg);
}

console.log('[10/12] 合并记录…');
{
  const oldMap = readJson('合并记录/人物增量映射.json');
  const mergedRecords = [...(oldMap.records || []), ...personaRecords];
  writeJson('合并记录/人物增量映射.json', {
    date: '2026-09-25',
    source_count: mergedRecords.length,
    records: mergedRecords,
    note: '保留既有映射，并追加v0.20人物/NPC增量；新NPC见注册映射。',
  });

  const optional = readJson('合并记录/注册映射.json');
  optional.optional = {
    ...optional.optional,
    ...Object.fromEntries(NEW_NPCS.map(npc => [npc.name, {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(readText(`src/characters/${npc.name}/NPC.md`)),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: 'v0.20新增NPC，具备生境六组件',
      profile_format: 'compact_npc',
    }])),
  };
  for (const [name, events] of charEventAdds) {
    if (optional.optional[name]) {
      optional.optional[name].event_ids = [...new Set([
        ...(optional.optional[name].event_ids ?? []),
        ...events,
      ])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    }
  }
  optional.worldbookEntries = globalThis.__WB_COUNT__;
  optional.coreCharacterCount = 28;
  writeJson('合并记录/注册映射.json', optional);

  writeText('合并记录/v0.20事件合并.md', `# v0.20 事件合并

范围：E541—E593（53条），UID 1240—1292，insertion_order 975—1027。
来源：角色卡设定/v0.20工作区/事件/。
E540已改写下一事件引入至E541；E593为开放终点，无下一事件引入、无E594。
阶段：S74—S80（见 schema phaseNames / 摘要/阶段末总述.md）。
`);

  writeText('合并记录/v0.20概念合并.md', `# v0.20 概念合并

- update 8：按事件门控追加到既有 src/concepts 文件，保留早期变体，扩展标题事件数组。基线优先取卡内文件。
- new 48：C1421—C1468；运行 UID 2706—2753。
- 文件名保留工作区输出文件名并补全 # 概念· 标题行。
`);

  writeText('合并记录/v0.20人物合并.md', `# v0.20 人物合并

- 核心/可选人物增量：\`人物增量/*_D.md\` 追加到对应多阶段人设.md 或 NPC.md（银色幻想→a01银色幻想；自缚天使→倒吊天使）。
- 新NPC：艾维儿、弑莉叶、见习夜医、林蒙、神皇、月儿兰、血袍指挥官、黑甲主母、入梦者、紫罗兰大君（新NPC/）→ src/characters/<名>/NPC.md，世界书 UID 324—333。
- 幼态纯净亲情守护与玩家主权不变；不发明 E593 之后结局。
`);

  writeText('合并记录/待拍板.md', `# 待拍板

当前无阻塞项（已按规范自行决定）：

1. 阶段中文名：S74—S80 取自 \`摘要/阶段末总述.md\` 标题。
2. E540→E541 衔接：E540 引入段按 E541 前置条件与起航现场补写。
3. 新NPC：艾维儿等 10 名角色注册为可选NPC，世界书 UID 324—333。
4. 概念 UID：新概念按逻辑号排序后从 2706 连续分配，C1421=2706 … C1468=2753。
5. 可选NPC：在既有 23 名上新增 10 名，共 33 名。
6. 人物增量 \`*_D\` 文件名后缀剥离后映射 CHAR_TARGET。
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
