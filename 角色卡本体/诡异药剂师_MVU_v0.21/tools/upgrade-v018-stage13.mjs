// v0.18 阶段十三接线：E435—E492 + 概念/人物/NPC + 注册表与校验边界
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = resolve(ROOT, '../../角色卡设定/v0.18工作区');
const EVENT_START = 435;
const EVENT_END = 492;
const EVENT_IDS = Array.from({ length: EVENT_END - EVENT_START + 1 }, (_, i) => `E${EVENT_START + i}`);
const PHASES = {
  S60: { name: '西海突围与王戟继承', start: 435, end: 442, line: '无序撕开八旗封锁后转入深海王庭与紫罗兰葬所；王戟落入可使用窗口，王兽净化、母树留种与第二渡鸦交付把西海决战推到可反击边缘。' },
  S61: { name: '失却之海到天空城权柄', start: 443, end: 450, line: '捏爆渡鸦夺控失却之海并覆灭导航者后，战线转入天空之城；王骑接戟隔绝外宇，王兽重誓与三叉戟永久归属打开内界与搬空天空城窗口。' },
  S62: { name: '戟内训练与七神开战', start: 451, end: 458, line: '艾泽法拉救援与三叉戟内界确认狱卒转化可能；黄金泰坦与灵能课把底子推到可测，死兆评定未过即接七神宣战，纳米风暴改写战争假说。' },
  S63: { name: '纳米囚笼与献祭反转', start: 459, end: 466, line: '战略撤退转入戟内整备与火山潜入；六棱笼镇压巨像，数学魔方困住救援，饲养无序替换人牲后外部代行者反向脱困，幽灵潜入打开光宴终端入口。' },
  S64: { name: '光宴内应与七神内战', start: 467, end: 474, line: '伪造过去与原子革命把光宴转为可谈判意志；替身入队后七十二小时协议与巨像诱饵线索并行，龙首谎言公开内战，学者模因罗网进入可布置窗口。' },
  S65: { name: '模因爆发与以太成型', start: 475, end: 484, line: '光宴重组埋下格式模因；复燃火种把银色幻想从猎杀线偏到会合线。以太狂潮吞噬巢都，伪身陷阱激活全网模因，三方汇合在智脑撕票下被迫有限合作。' },
  S66: { name: '围猎巨像与开放终点', start: 485, end: 492, line: '并肩逃杀中遗产钥匙暴露；定位矩阵与最终防火墙把巨像线逼到必须现实破门，门前确认守门者为以太、容器空，停在「吃了」。' },
};
const NEW_CONCEPT_UID_START = 2610;
const EVENT_UID_START = 1134;
const EVENT_INSERTION_START = 869;
const NEW_NPCS = [
  { name: '雷蒙·冬语', file: '雷蒙·冬语_王骑.md', entry_id: 316, extra_keys: ['王骑'] },
  { name: '以太', file: '以太.md', entry_id: 317, extra_keys: [] },
  { name: '光宴', file: '光宴.md', entry_id: 318, extra_keys: [] },
];
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
  a01银色幻想: 'src/characters/a01银色幻想/多阶段人设.md',
  银色幻想: 'src/characters/a01银色幻想/多阶段人设.md',
  康斯坦丁: 'src/characters/康斯坦丁/NPC.md',
  艾泽法拉: 'src/characters/艾泽法拉/NPC.md',
  弑利亚: 'src/characters/弑利亚/NPC.md',
  智脑: 'src/characters/智脑/NPC.md',
};
const E434_TO_E435 = {
  trigger: 'E434已完成、变形、取消或活跃且收尾，E435尚未触发或处于预兆；八旗封锁仍在，玩家具备接近海底蚀痕与时间之外的棺椁的条件。',
  lead: '海平面持续下降，海底蚀痕深处有无死亡概念的无序生物在暗处扩张，镇旗与法则兵器开始失去意义。',
  omen: '只写海面下降、蚀痕无光与物质坍塌的可观察变化，不提前公开骑乘无序、撞毁镇旗或金蝉脱壳。',
  causal: 'E434确认的八旗封锁与海水湮灭把突围窗口压到极限；无序生物的出现使镇旗结界出现可被撞毁的条件。是否接近由玩家决定。',
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
function resolveConceptBase(item) {
  const prefixes = [
    '角色卡本体/诡异药剂师_MVU_v0.17/',
    '角色卡本体/诡异药剂师_MVU_v0.18/',
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
const summariesV018 = JSON.parse(readText(resolve(WORKSPACE, '摘要/事件摘要.json')));
const bridgesV018 = JSON.parse(readText(resolve(WORKSPACE, '摘要/衔接表.json')));
const summaryMap = new Map(summariesV018.map(s => [s.id, s]));
const conceptUpdates = delivery.concepts.filter(c => c.kind === 'update');
const conceptNews = delivery.concepts.filter(c => c.kind === 'new' && c.id !== 'C1359' && c.id !== 'C1360');
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
EVENT_TITLES.E434 = titleFromEventFile('E434');

console.log('[2/12] E434→E435 衔接…');
{
  const path = eventFileFor('E434');
  let text = readText(path);
  if (!text.includes('## 下一事件引入（E435·')) {
    const block = `\n## 下一事件引入（E435·${EVENT_TITLES.E435}）\n- 触发时机：${E434_TO_E435.trigger}\n- 剧情引子：${E434_TO_E435.lead}\n- 预兆写法：${E434_TO_E435.omen}\n- 承接因果：${E434_TO_E435.causal}\n`;
    text = replaceOnce(text, /\n<%_ \} _%>\s*$/, `${block}\n<%_ } _%>`, 'E434→E435 bridge');
  }
  text = text
    .replace(/本版终点|开放终点|后续事件不在本版/g, (m) => m.includes('终点') ? '阶段收束' : m)
    .replace(/不创建E435[^\n]*/g, 'E435由下一事件引入段承接。');
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
  if (out.startsWith('人物增量/') || (ch.kind === 'update' && out.startsWith('NPC/'))) {
    const target = CHAR_TARGET[ch.name];
    if (!target) throw new Error(`人物目标未映射：${ch.name}`);
    appendCharacterIncrement(target, out);
    const events = extractEventsFromText(readText(resolve(WORKSPACE, out)));
    const coreName = coreNameOf(ch.name);
    const prev = charEventAdds.get(coreName) || [];
    charEventAdds.set(coreName, [...new Set([...prev, ...events])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
    personaRecords.push({
      source: `角色卡设定/v0.18工作区/${out}`,
      target,
      events,
      mode: 'source_sync',
      adapted_events: [],
    });
  }
}
for (const npc of NEW_NPCS) {
  const src = resolve(WORKSPACE, '新NPC', npc.file);
  const body = readText(src).trim();
  const out = `src/characters/${npc.name}/NPC.md`;
  writeText(out, `# ${npc.name}\n\n${body}\n`);
}

console.log('[5/12] schema / initvar / status…');
{
  let schema = readText('src/scripts/schema.js');
  schema = schema.replaceAll('诡异药剂师v0.17', '诡异药剂师v0.18')
    .replace("卡名: z.literal('《诡异药剂师》v0.17')", "卡名: z.literal('《诡异药剂师》v0.18')")
    .replace("版本: z.literal('0.17.0')", "版本: z.literal('0.18.0')");
  if (!schema.includes('S60:')) {
    const phaseLines = Object.entries(PHASES).map(([id, v]) => `  ${id}: '${v.name}',`).join('\n');
    schema = replaceOnce(schema, /(  S59: '[^']*',\n)(\};)/, `$1${phaseLines}\n$2`, 'schema phaseNames');
  }
  if (!schema.includes("E435: '")) {
    const titleLines = EVENT_IDS.map(id => `  ${id}: '${EVENT_TITLES[id]}',`).join('\n');
    schema = replaceOnce(schema, /(  E434: '[^']*',\n)(\};)/, `$1${titleLines}\n$2`, 'schema anchorTitles');
    const anchorLines = EVENT_IDS.map(id => `      ${id}: anchor,`).join('\n');
    schema = replaceOnce(schema, /(      E434: anchor,\n)(    \}\),)/, `$1${anchorLines}\n$2`, 'schema anchor map');
  }
  writeText('src/scripts/schema.js', schema);
}

function appendAnchors(value) {
  value.元数据.卡名 = '《诡异药剂师》v0.18';
  value.元数据.版本 = '0.18.0';
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
  status = status.replaceAll('《诡异药剂师》v0.17', '《诡异药剂师》v0.18')
    .replace(/\(434 锚点闭环\)/g, '(492 锚点闭环)')
    .replace('Array.from({ length: 434 }', 'Array.from({ length: 492 }');
  status = replaceOnce(status, /const FALLBACK_STATE = \{[\s\S]*?\};\s*let mvuAvailable/, `const FALLBACK_STATE = ${JSON.stringify(initial)};\n      let mvuAvailable`, 'status FALLBACK_STATE');
  if (!status.includes("from: 'E491', to: 'E492'")) {
    const pairs = [];
    for (let n = 434; n < EVENT_END; n += 1) {
      pairs.push(`        { from: 'E${n}', to: 'E${n + 1}', label: '结算并承接 E${n + 1}' },`);
    }
    status = replaceOnce(
      status,
      /(        \{ from: 'E433', to: 'E434', label: '结算并承接 E434' \},)/,
      `$1\n${pairs.join('\n')}`,
      'status bridge pairs',
    );
  }
  writeText('src/ui/status.html', status);
}

console.log('[6/12] 世界书事件/概念/NPC…');
{
  const book = readJson('src/worldbook.json');
  book.name = '《诡异药剂师》v0.18';
  book.description = '《诡异药剂师》v0.18 动态世界书（覆盖S0至S66、二十八名核心人物、可选NPC、四百九十二事件锚点与全量概念）';
  book.extensions = {
    ...(book.extensions ?? {}),
    tavernweave: { ...(book.extensions?.tavernweave ?? {}), id: 'weird-apothecary-worldbook', version: '0.18.0' },
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
  const e434idx = book.entries.findIndex(e => e.id === 1133);
  if (e434idx < 0) throw new Error('未找到 E434 UID1133');
  book.entries.splice(e434idx + 1, 0, ...newEventEntries);

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
      content_file: `src/characters/${npc.name}/NPC.md`,
      extensions: {
        exclude_recursion: true,
        prevent_recursion: true,
        tavernweave: { event_ids, route_kind: 'optional_npc', profile_format: 'compact_npc' },
      },
      secondary_keys: [],
    };
    book.entries = book.entries.filter(e => e.id !== npc.entry_id);
    const after = book.entries.findIndex(e => e.id === 315);
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
  contract.version = '0.18.0';
  contract.required.stage_scope = 'E01至E492；本版新增E435至E492，S0至S66，E492为当前开放终点。';
  contract.required.event_ids = allEventIds;
  contract.required.event_titles = { ...contract.required.event_titles, ...EVENT_TITLES };
  contract.required.stage_ranges = {
    ...contract.required.stage_ranges,
    ...Object.fromEntries(Object.entries(PHASES).map(([id, phase]) => [
      id,
      Array.from({ length: phase.end - phase.start + 1 }, (_, i) => `E${phase.start + i}`),
    ])),
  };
  contract.required.event_context_windows.material_entry_end = 1191;
  contract.required.worldbook_version = '0.18.0';
  const wbCount = globalThis.__WB_COUNT__;
  contract.required.worldbook_entry_count = wbCount;
  contract.worldbook_entry_count = wbCount;
  contract.required.terminal_hook_event = 'E492';
  contract.required.terminal_hook_note = 'E492为S66（围猎巨像与开放终点）开放终点：以太「吃了」；门前胜负与巨像尽噬未闭合，后续事件不在本版展开。';
  contract.stage_scope = contract.required.stage_scope;
  contract.acceptance = {
    ...contract.acceptance,
    event_anchors: EVENT_END,
    stage_scope: 'S0至S66；E01至E492',
    terminal_hook_event: 'E492',
    bridge_pairs_count: EVENT_END - 1,
    source_boundary: '原著阶段十三范围至第1926章（E492封口）；不得读取或泄漏第1927章及以后',
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
      note: 'v0.18精简NPC；按事件及关键词激活，不进入核心关系矩阵。',
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
    stage13_concept_count: NEW_CONCEPT_IDS.length,
    stage13_concept_ranges: [{
      logical_start: NEW_CONCEPT_IDS[0],
      logical_end: NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1],
      uid_start: NEW_CONCEPT_UID_START,
      uid_end: NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1,
      count: NEW_CONCEPT_IDS.length,
    }],
    stage13_note: `v0.18新增阶段十三概念${NEW_CONCEPT_IDS[0]}-${NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1]}共${NEW_CONCEPT_IDS.length}条（跳过merged C1359/C1360），世界书UID${NEW_CONCEPT_UID_START}-${NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1}；另原位增量更新${conceptUpdates.length}份既有概念。`,
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
    t = t.replaceAll('《诡异药剂师》v0.17', '《诡异药剂师》v0.18')
      .replaceAll('《诡异药剂师》v0.16', '《诡异药剂师》v0.18')
      .replaceAll('《诡异药剂师》v0.15', '《诡异药剂师》v0.18')
      .replaceAll('E01至E434', 'E01至E492')
      .replaceAll('E01-E434', 'E01-E492')
      .replaceAll('E01至E396', 'E01至E492')
      .replaceAll('E01至E348', 'E01至E492')
      .replaceAll('四百三十四个', '四百九十二个')
      .replaceAll('四百三十四', '四百九十二');
    t = t.replace(/E434是当前开放终点：[^\n]*/g, 'E492是当前开放终点：以太「吃了」悬置；剧情严格止于门前对峙与自称尽噬，不创建E493或引出后续。');
    t = t.replace(/E434为当前开放终点[^\n]*/g, 'E492为当前开放终点');
    t = t.replace(/E434是本版开放终点[^\n]*/g, 'E492是本版开放终点：以太「吃了」悬置；剧情严格止于此引用边界，不创建E493或引出后续内容。');
    t = t.replace(/E396是当前开放终点：[^\n]*/g, 'E492是当前开放终点：以太「吃了」悬置；剧情严格止于门前对峙与自称尽噬，不创建E493或引出后续。');
    writeText(p, t);
  }

  let loader = readText('src/scripts/mvu_loader.js');
  loader = loader.replaceAll('诡异药剂师v0.17', '诡异药剂师v0.18');
  writeText('src/scripts/mvu_loader.js', loader);

  const helpers = readJson('src/tavern_helper_scripts.json');
  for (const script of helpers) {
    if (typeof script.name === 'string') script.name = script.name.replaceAll('v0.17', 'v0.18');
    if (typeof script.id === 'string') script.id = script.id.replaceAll('v0.17', 'v0.18');
    if (typeof script.info === 'string') {
      script.info = script.info
        .replaceAll('v0.17', 'v0.18')
        .replaceAll('四百三十四', '四百九十二')
        .replaceAll('E01-E434', 'E01-E492')
        .replaceAll('S0-S59', 'S0-S66');
    }
  }
  writeJson('src/tavern_helper_scripts.json', helpers);
}

console.log('[8/12] mainline（追加E435—E492并改写E434终点）…');
{
  let text = readText('src/prompts/mainline.md');
  text = text.replace('## 六十个宽阶段', '## 六十七个宽阶段')
    .replace('四百三十四个事件锚点依次记录为E01至E434', '四百九十二个事件锚点依次记录为E01至E492');
  text = text.replace(/10\. E434是当前开放终点：[^\n]+/, '10. E492是当前开放终点：以太「吃了」悬置；剧情严格止于门前对峙与自称尽噬，不创建E493或引出后续。');

  if (!text.includes('- S60·')) {
    const lines = Object.entries(PHASES).map(([id, v]) => `- ${id}·${v.name}：${v.line}`).join('\n');
    text = replaceOnce(text, /(- S59·[^\n]+\n)/, `$1${lines}\n`, 'mainline stage list S59');
  }

  text = text.replace(
    /\{ id: 'E434', title: '灭绝令与八旗牢笼', line: '[^']+' \},/,
    `{ id: 'E434', title: '灭绝令与八旗牢笼', line: '灭绝与八旗若已形成围困，只确认节点守卫、共享视野和不到两分钟的互援压力 → E435无序飙车与八旗防线' },`,
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
    text = replaceOnce(text, /(  \{ id: 'E434',[^\n]+\n)\];/, `$1${ctxObjects}\n];`, 'mainline ctx tail');
  }

  const missingBridges = [];
  for (let n = 434; n < EVENT_END; n += 1) {
    const from = `E${n}`;
    const to = `E${n + 1}`;
    if (text.includes(`### ${from}→${to}`)) continue;
    missingBridges.push([from, to]);
  }
  if (missingBridges.length) {
    const bridges = [];
    for (const [from, to] of missingBridges) {
      let fields = from === 'E434' ? { ...E434_TO_E435 } : bridgeFields(from);
      if (![fields.trigger, fields.lead, fields.omen, fields.causal].every(Boolean)) {
        const pair = bridgesV018.pairs.find(p => p.from === from && p.to === to);
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
      bridges.push(`<%_ const v18b${n}FromState = getvar("stat_data.事件.锚点状态.${from}.状态", { defaults: "未触发" }); const v18b${n}FromEnd = getvar("stat_data.事件.锚点状态.${from}.收尾", { defaults: false }); const v18b${n}ToState = getvar("stat_data.事件.锚点状态.${to}.状态", { defaults: "未触发" }); if ((v18b${n}FromState === "完成" || v18b${n}FromState === "变形" || (v18b${n}FromState === "活跃" && v18b${n}FromEnd === true)) && (v18b${n}ToState === "未触发" || v18b${n}ToState === "预兆")) { _%>\n### ${from}→${to} · ${fromTitle} → ${toTitle}\n- 触发时机：${fields.trigger}\n- 剧情引子：${fields.lead}\n- 预兆写法：${fields.omen}\n- 承接因果：${fields.causal}\n- 取消态守卫：若${from}为取消，先核对${to}必要因果与替代入口；状态栏不得自动推进。\n<%_ } _%>`);
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
  card.name = '《诡异药剂师》v0.18';
  card.character_version = '0.18.0';
  card.creator_notes = 'v0.18 内部候选版。由 v0.17 升版，全量合入 E435-E492（S60-S66）共58个事件锚点、7份概念增量与66份新概念、核心人物增量与精简NPC。E492为当前版本终点（以太「吃了」开放）；玩家始终掌握林恩的对白、行动、判断、记忆、内心与关系选择。需要 SillyTavern 1.17.0 与酒馆助手 4.9.1；真实宿主验收待执行。v1.0以前不公开发布。';
  writeJson('src/card.json', card);

  const manifest = readJson('manifest.json');
  manifest.id = 'tavernweave.weird-apothecary.v0.18';
  manifest.version = '0.18.0';
  if (manifest.worldbook) manifest.worldbook.version = '0.18.0';
  manifest.packed_json = 'dist/诡异药剂师_v0.18.json';
  if (manifest.card) manifest.card.display_name = '《诡异药剂师》v0.18';
  if (Array.isArray(manifest.deliverables)) manifest.deliverables = ['dist/诡异药剂师_v0.18.json'];
  for (const dep of manifest.runtime_dependencies ?? []) {
    if (dep.id === 'mvu-loader') {
      dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-loader-v0.18]';
    }
    if (dep.id === 'mvu-zod-schema') {
      dep.role = '验证 v0.18 状态结构';
      dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-schema-v0.18]';
    }
  }
  writeJson('manifest.json', manifest);

  const profile = readJson('profile.json');
  profile.id = 'tavernweave.weird-apothecary.v0.18';
  profile.version = '0.18.0';
  profile.display_name = '《诡异药剂师》v0.18';
  writeJson('profile.json', profile);

  const host = readJson('host_acceptance.json');
  host.version = '0.18.0';
  host.status = 'pending';
  host.artifact = 'dist/诡异药剂师_v0.18.json';
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
  host.notes = 'v0.18合入E435-E492、73份概念（7增量+66新，跳过merged C1359/C1360）及人物/NPC来源；真实宿主验收仍pending。';
  writeJson('host_acceptance.json', host);

  writeText('SCAFFOLD.md', `# v0.18 工程壳

- 建立时间：2026-09-13
- 基线：\`诡异药剂师_MVU_v0.17\`（冻结，勿回改）
- 状态：已集成 E435—E492（S60—S66）；版本 0.18.0
- 设定来源：\`角色卡设定/v0.18工作区\`
- 工作面：仅云端 \`/workspace/《诡异药剂师》同人角色卡制作计划\`
- 校验：\`npm run check\`（build + validate + validate-integration）
- 产物：\`dist/诡异药剂师_v0.18.json\`；host_acceptance 保持 pending
`);

  writeText('README.md', `# 《诡异药剂师》MVU v0.18

当前维护版本：0.18.0。包含 E01—E492 共492个事件锚点、S0—S66、世界书词条见 contract，28名核心关系人物保持不变。E492为开放终点（以太「吃了」）。

## 本版集成

- E435—E492共58个事件；73份概念（7份既有增量 + 66份新概念 C1321—C1388，跳过 merged C1359/C1360，UID 2610—2675）。
- 核心人物增量与精简NPC（雷蒙·冬语／王骑、以太、光宴）；弑利亚等既有NPC按增量追加。
- E448幼态非性机制结算不得性化；E492保持开放终点。
- 真机实测暂缓，host_acceptance 保持 pending。

## 构建与校验

在本目录运行 \`npm run check\`。生成物为 \`dist/诡异药剂师_v0.18.json\`，禁止直接修改。
`);

  let agents = readText('AGENTS.md');
  agents = agents
    .replaceAll('v0.17', 'v0.18')
    .replaceAll('0.17.0', '0.18.0')
    .replaceAll('E434', 'E492')
    .replaceAll('E397—E492', 'E435—E492')
    .replaceAll('E01—E492', 'E01—E492')
    .replaceAll('S53—S59', 'S60—S66')
    .replaceAll('S0—S59', 'S0—S66')
    .replaceAll('1179', String(globalThis.__WB_COUNT__))
    .replaceAll('C1284—C1320', 'C1321—C1388')
    .replaceAll('2573—2609', '2610—2675')
    .replaceAll('1096—1133', '1134—1191')
    .replaceAll('UID 307—315', 'UID 316—318')
    .replaceAll('v0.16 基础上集成 v0.18', 'v0.17 基础上集成 v0.18')
    .replaceAll('从 `诡异药剂师_MVU_v0.16` 复制建立', '从 `诡异药剂师_MVU_v0.17` 复制建立')
    .replaceAll('../../角色卡设定/v0.17工作区', '../../角色卡设定/v0.18工作区');
  // fix accidental over-replace of historical E434 mentions that should remain as the previous terminal
  writeText('AGENTS.md', agents);

  let plan = readText('创作规划.yaml');
  plan = plan
    .replaceAll('诡异药剂师_MVU_v0.17', '诡异药剂师_MVU_v0.18')
    .replaceAll('《诡异药剂师》v0.17', '《诡异药剂师》v0.18')
    .replaceAll('0.17.0', '0.18.0')
    .replaceAll('dist/诡异药剂师_v0.17.json', 'dist/诡异药剂师_v0.18.json')
    .replaceAll('诡异药剂师_MVU_v0.16（冻结基线）', '诡异药剂师_MVU_v0.17（冻结基线）');
  writeText('创作规划.yaml', plan);

  // validators: move frozen terminal from E434 to E492, widen counts
  let validate = readText('tools/validate.mjs');
  validate = validate
    .replaceAll("dist/诡异药剂师_v0.17.json", "dist/诡异药剂师_v0.18.json")
    .replaceAll("《诡异药剂师》v0.17", "《诡异药剂师》v0.18")
    .replace("ok(EVENT_IDS.length === 434, '四百三十四事件锚点');", "ok(EVENT_IDS.length === 492, '四百九十二事件锚点');")
    .replace("ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E434', '事件锚点范围为E01-E434');", "ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E492', '事件锚点范围为E01-E492');")
    .replace("ok(contract.required.terminal_hook_event === 'E434' || contract.required.terminal_hook_event?.id === 'E434', 'E434为本版开放终点');", "ok(contract.required.terminal_hook_event === 'E492' || contract.required.terminal_hook_event?.id === 'E492', 'E492为本版开放终点');")
    .replace("ok(conceptRouterContent.includes('E434'), '路由事件序列含E434');", "ok(conceptRouterContent.includes('E492'), '路由事件序列含E492');")
    .replace("  if (eventId === 'E434') ok(!content.includes('## 下一事件引入'), 'E434冻结终点不设下一事件引入');", "  if (eventId === 'E492') ok(!content.includes('## 下一事件引入'), 'E492冻结终点不设下一事件引入');")
    .replace("ok(helperSource.every(script => String(script.name ?? '').includes('v0.17')), '酒馆助手脚本命名含v0.17');", "ok(helperSource.every(script => String(script.name ?? '').includes('v0.18')), '酒馆助手脚本命名含v0.18');")
    .replace("ok(!statusUiText.includes(\"from: 'E434'\"), 'E434无推进按钮');", "ok(!statusUiText.includes(\"from: 'E492'\"), 'E492无推进按钮');")
    .replace("ok(bridgePairs.length === 433, '全卡桥共433对');", "ok(bridgePairs.length === 491, '全卡桥共491对');")
    .replace("ok(statusUiText.includes(\"from: 'E433', to: 'E434'\"), '状态栏桥对覆盖E433→E434');", "ok(statusUiText.includes(\"from: 'E491', to: 'E492'\"), '状态栏桥对覆盖E491→E492');")
    .replace('ok(statusBridgeCount === 433, `状态栏桥对共433对（实际${statusBridgeCount}）`);', 'ok(statusBridgeCount === 491, `状态栏桥对共491对（实际${statusBridgeCount}）`);')
    .replace("ok(EVENT_IDS.includes('E434'), '开放终态事件E434已纳入事件序列');", "ok(EVENT_IDS.includes('E492'), '开放终态事件E492已纳入事件序列');")
    .replace("ok(!e434Content.includes('## E435') && !e434Content.includes('E435·') && !e434Content.includes('下一事件引入'), 'E434未越界创建E435或后继引入');", "ok(e434Content.includes('## 下一事件引入（E435'), 'E434已引入E435');\nconst e492Content = await readText('src/events/E492_巨像位置与以太夺取.md');\nok(e492Content.includes('吃了') && !e492Content.includes('## 下一事件引入'), 'E492开放终点停在以太吃了且不设下一事件引入');")
    .replace("const upper = BIG_ANCHORS.has(eventId) || Number(eventId.slice(1)) >= 266 ? 3000 : 1200;", "const nEv = Number(eventId.slice(1));\n  const upper = BIG_ANCHORS.has(eventId) || nEv >= 435 ? 4000 : nEv >= 266 ? 3000 : 1200;");
  writeText('tools/validate.mjs', validate);

  let integ = readText('tools/validate-integration.mjs');
  integ = integ
    .replace(".replaceAll('0.15.0', '0.17.0').replaceAll('v0.15', 'v0.17')", ".replaceAll('0.15.0', '0.18.0').replaceAll('v0.15', 'v0.18')")
    .replace('for (let i = 349; i <= 434; i++) {', 'for (let i = 349; i <= 492; i++) {')
    .replace("ok(Object.keys(contract.required.optional_characters).length === 15, '应登记15名可选NPC');", "ok(Object.keys(contract.required.optional_characters).length === 18, '应登记18名可选NPC');")
    .replace('for (let current = 318; current <= 434; current++) {', 'for (let current = 318; current <= 492; current++) {')
    .replace("ok(typeof ejs.render(content, localsFor(434, state)) === 'string'", "ok(typeof ejs.render(content, localsFor(492, state)) === 'string'");
  writeText('tools/validate-integration.mjs', integ);
}

console.log('[10/12] 合并记录…');
{
  const oldMap = readJson('合并记录/人物增量映射.json');
  const mergedRecords = [...(oldMap.records || []), ...personaRecords];
  writeJson('合并记录/人物增量映射.json', {
    date: '2026-09-13',
    source_count: mergedRecords.length,
    records: mergedRecords,
    note: '保留既有映射，并追加v0.18人物/NPC增量；新精简NPC见注册映射。',
  });

  const optional = readJson('合并记录/注册映射.json');
  optional.optional = {
    ...optional.optional,
    ...Object.fromEntries(NEW_NPCS.map(npc => [npc.name, {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(readText(`src/characters/${npc.name}/NPC.md`)),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: 'v0.18精简NPC',
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

  writeText('合并记录/v0.18事件合并.md', `# v0.18 事件合并

范围：E435—E492（58条），UID 1134—1191，insertion_order 869—926。
来源：角色卡设定/v0.18工作区/事件/。
E434已改写下一事件引入至E435；E492为开放终点，无下一事件引入。
阶段：S60—S66（见 schema phaseNames / 摘要/_arcs.json）。
`);

  writeText('合并记录/v0.18概念合并.md', `# v0.18 概念合并

- update 7：C787、C891、C914、C987、C1251、C1292、C1318。按事件门控追加到既有 src/concepts 文件，保留早期变体，扩展标题事件数组。C914 基线取卡内 \`C914_狱卒.md\`（交付清单 base_path 指向 v0.17 工作区增量稿，不覆盖整条）。
- new 66：C1321—C1388，跳过 merged C1359→C1357、C1360→C1358；运行 UID 2610—2675。
- 文件名保留工作区输出文件名并补全 # 概念· 标题行。
`);

  writeText('合并记录/v0.18人物合并.md', `# v0.18 人物合并

- 核心/可选人物增量：追加到对应多阶段人设.md 或 NPC.md（银色幻想→a01银色幻想）。
- 弑利亚：工作区 \`NPC/弑利亚.md\` 为增量门控块，已追加到既有 \`src/characters/弑利亚/NPC.md\`，未整文件替换。
- 新精简NPC：雷蒙·冬语（来源 雷蒙·冬语_王骑.md，附加关键词「王骑」）、以太、光宴 → src/characters/<名>/NPC.md，世界书 UID 316—318。
- E448 左左亲密只结算机制因果，不得性化。
`);

  writeText('合并记录/待拍板.md', `# 待拍板

当前无阻塞项（已按 v0.17 惯例自行决定，自行决定标记）：

1. 阶段中文名：S60—S66 取自 \`摘要/_arcs.json\` 标题（与事件 \`- 阶段：\` 字段及阶段总结一致）。
2. E434→E435 衔接：衔接表只从 E435 起对；E434 引入段按 E435 前置条件与八旗封锁现场自行补写（触发/引子/预兆/因果见脚本 E434_TO_E435）。
3. 新NPC命名：\`雷蒙·冬语_王骑.md\` 注册为「雷蒙·冬语」，附加关键词「王骑」；不升格六组件。
4. 弑利亚：按增量追加，不替换 v0.17 NPC.md。
5. 概念 UID：新概念按逻辑号排序后从 2610 连续分配（跳过 merged C1359/C1360），C1321=2610 … C1388=2675。
6. 默认走向上限：E435+ 放宽至 4000 字（E445/E449 为 length_exception 大场面）。
7. 可选NPC：在既有 15 名上新增 3 名，共 18 名。
8. C914 增量合并到卡内 \`C914_狱卒.md\`，不把 v0.17 工作区概念稿当作覆盖基线。
`);
}

console.log(JSON.stringify({
  status: 'wired',
  events: EVENT_IDS.length,
  concepts_new: NEW_CONCEPT_IDS.length,
  concepts_update: conceptUpdates.length,
  npcs: NEW_NPCS.length,
  worldbook_entries: globalThis.__WB_COUNT__,
  event_uid: '1134-1191',
  concept_uid: `${NEW_CONCEPT_UID_START}-${NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1}`,
}, null, 2));
