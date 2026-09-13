// v0.19 阶段十四接线：E493—E540 + 概念/人物/NPC + 注册表与校验边界
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = resolve(ROOT, '../../角色卡设定/v0.19工作区');
const EVENT_START = 493;
const EVENT_END = 540;
const EVENT_IDS = Array.from({ length: EVENT_END - EVENT_START + 1 }, (_, i) => `E${EVENT_START + i}`);
const PHASES = {
  S67: { name: '原子革命与至臻机体', start: 493, end: 499, line: '以太口头坐实学者吞噬并点燃祭品飞升式原子革命；银幻以遗产换上传空档，芯片脱险后无序冲心夺控将军。权限争夺推至至臻机体与半魂代价，绝境开门把二人逼入奇异世界逃生窗口。' },
  S68: { name: '莫比乌斯逃生与恒星封印', start: 500, end: 506, line: '莫比乌斯环放逐与泉水解伤后，海嗣汇合与灭绝者有条件合作砸出裂口；银幻吞噬升七神并重设计恒星矩阵。五台巨构与棺椁破界接通乱流，银幻断后开出现实桥头堡，船长与主母落地接战。' },
  S69: { name: '升神风暴到心灵之海门前', start: 507, end: 513, line: '暂时升神与原子风暴压过母树危机，五台局部封印城周以太却引来西部银潮与初诞光晕泥潭。人偶军团扩张巨构抽出巨像之脑；渡鸦尸体成执行锚，左左携尸登顶心灵之海，残魂仍锁未应答。' },
  S70: { name: '三位一体封印与时间战争', start: 514, end: 520, line: '左左登顶启动矩阵，万机归位与苍蓝进食把以太本体逼入可封窗口；三位一体临时容器与银幻归心并行，巨像醒转点评入队模型。奈奈子具名后第二次大坠落成事实，时间战争成为可核成长轴。' },
  S71: { name: '新神计划到留在过去', start: 521, end: 526, line: '五十四次回返揭开新神计划与珠窥视捷径；左左灌输与鲜血孽灵禁术突破后转入渡鸦墓地。三招赌约成立却未兑现，因果压制逼出「方法不对」；修炼路线从莽神王改为过去久留。' },
  S72: { name: '规则分化与银幻归心', start: 527, end: 533, line: '二十一万年前墓地造碑闭环钉进历史，空间规则萌芽后神王关系转为条件性已得答案。黑袍人现身与私藏试探把身份逼到露脸；创规则镜像决斗令银幻跨过创造门槛，归心与关系明确打开。' },
  S73: { name: '坠落者联盟到我们起航', start: 534, end: 540, line: '关系伪装抬升公开层敌意，知情层同盟日常化后南方坠落者联盟可核却卡在亲自过来。主母之战与光暗横扫后第二只渡鸦误导成立；争霸战报打压顶尖战力，碎片集中登船停在「我们起航」。' },
};
const NEW_CONCEPT_UID_START = 2676;
const EVENT_UID_START = 1192;
const EVENT_INSERTION_START = 927;
const NEW_NPCS = [
  { name: '卡伦', file: '卡伦.md', entry_id: 319, extra_keys: [], src_dir: '新NPC' },
  { name: '圣安娜', file: '圣安娜.md', entry_id: 320, extra_keys: [], src_dir: '新NPC' },
  { name: '星轨', file: '星轨.md', entry_id: 321, extra_keys: [], src_dir: '新NPC' },
  { name: '神王', file: '神王.md', entry_id: 322, extra_keys: [], src_dir: '新NPC' },
  { name: '灭绝者', file: '灭绝者.md', entry_id: 323, extra_keys: [], src_dir: 'NPC' },
];
const CHAR_TARGET = {
  人偶家: 'src/characters/人偶家/多阶段人设.md',
  以太: 'src/characters/以太/NPC.md',
  光宴: 'src/characters/光宴/NPC.md',
  哭泣小丑: 'src/characters/哭泣小丑/多阶段人设.md',
  夏娃: 'src/characters/夏娃/NPC.md',
  奈奈子: 'src/characters/奈奈子/多阶段人设.md',
  孽主: 'src/characters/孽主/NPC.md',
  左左: 'src/characters/左左/多阶段人设.md',
  巨像之脑: 'src/characters/巨像之脑/多阶段人设.md',
  巫神头颅: 'src/characters/巫神头颅/多阶段人设.md',
  康斯坦丁: 'src/characters/康斯坦丁/NPC.md',
  欲望母树: 'src/characters/欲望母树/多阶段人设.md',
  泰坦头颅: 'src/characters/泰坦头颅/多阶段人设.md',
  猪头屠夫: 'src/characters/猪头屠夫/多阶段人设.md',
  羽毛笔: 'src/characters/羽毛笔/多阶段人设.md',
  自缚天使: 'src/characters/倒吊天使/多阶段人设.md',
  艾泽法拉: 'src/characters/艾泽法拉/NPC.md',
  艾雯爵士: 'src/characters/艾雯爵士/多阶段人设.md',
  a01银色幻想: 'src/characters/a01银色幻想/多阶段人设.md',
  银色幻想: 'src/characters/a01银色幻想/多阶段人设.md',
  黑弦月: 'src/characters/黑弦月/多阶段人设.md',
};
const E492_TO_E493 = {
  trigger: 'E492已完成、变形、取消或活跃且收尾，E493尚未触发或处于预兆；以太自称「吃了」仍悬置未验尸，门前第一波交火未分胜负，夏娃／巫神头颅／人偶家仍可在场。',
  lead: '门前对峙未散，以太手玩数据魔方，学者吞噬与祭品飞升式原子革命的信息压迫把战场从物理交火推向共振启动窗口。',
  omen: '只写门前未散的对峙、以太戏谑余波与可观察的信息压迫，不提前公开原子革命启动、上传空档或追杀银幻令。',
  causal: 'E492留下的「吃了」自称、开空容器与学者规则锁使学者吞噬与祭品飞升真相可以当场揭开；是否逼问与对峙口径由玩家决定。',
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
function firstEventsPerBlock(text) {
  const blocks = text.match(/<%_ if[\s\S]*?<%_ \} _%>/gu) ?? [];
  return blocks.map(block => block.match(/锚点状态\.(E\d+)\.状态/u)[1]);
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
    '角色卡本体/诡异药剂师_MVU_v0.19/',
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
const summariesV019 = JSON.parse(readText(resolve(WORKSPACE, '摘要/事件摘要.json')));
const bridgesV019 = JSON.parse(readText(resolve(WORKSPACE, '摘要/衔接表.json')));
const summaryMap = new Map(summariesV019.map(s => [s.id, s]));
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
EVENT_TITLES.E492 = titleFromEventFile('E492');

console.log('[2/12] E492→E493 衔接…');
{
  const path = eventFileFor('E492');
  let text = readText(path);
  if (!text.includes('## 下一事件引入（E493·')) {
    const block = `\n## 下一事件引入（E493·${EVENT_TITLES.E493}）\n- 触发时机：${E492_TO_E493.trigger}\n- 剧情引子：${E492_TO_E493.lead}\n- 预兆写法：${E492_TO_E493.omen}\n- 承接因果：${E492_TO_E493.causal}\n`;
    text = replaceOnce(text, /\n<%_ \} _%>\s*$/, `${block}\n<%_ } _%>`, 'E492→E493 bridge');
  }
  text = text
    .replace(/本版终点|后续事件不在本版/g, (m) => m.includes('终点') ? '阶段收束' : m)
    .replace(/不创建E493[^\n]*/g, 'E493由下一事件引入段承接。')
    .replace(/不写下一事件编号或后续未编正文/g, 'E493由下一事件引入段承接；不写E493完成后的后续未编正文。');
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
    source: `角色卡设定/v0.19工作区/${out}`,
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
  schema = schema.replaceAll('诡异药剂师v0.18', '诡异药剂师v0.19')
    .replace("卡名: z.literal('《诡异药剂师》v0.18')", "卡名: z.literal('《诡异药剂师》v0.19')")
    .replace("版本: z.literal('0.18.0')", "版本: z.literal('0.19.0')");
  if (!schema.includes('S67:')) {
    const phaseLines = Object.entries(PHASES).map(([id, v]) => `  ${id}: '${v.name}',`).join('\n');
    schema = replaceOnce(schema, /(  S66: '[^']*',\n)(\};)/, `$1${phaseLines}\n$2`, 'schema phaseNames');
  }
  if (!schema.includes("E493: '")) {
    const titleLines = EVENT_IDS.map(id => `  ${id}: '${EVENT_TITLES[id]}',`).join('\n');
    schema = replaceOnce(schema, /(  E492: '[^']*',\n)(\};)/, `$1${titleLines}\n$2`, 'schema anchorTitles');
    const anchorLines = EVENT_IDS.map(id => `      ${id}: anchor,`).join('\n');
    schema = replaceOnce(schema, /(      E492: anchor,\n)(    \}\),)/, `$1${anchorLines}\n$2`, 'schema anchor map');
  }
  writeText('src/scripts/schema.js', schema);
}

function appendAnchors(value) {
  value.元数据.卡名 = '《诡异药剂师》v0.19';
  value.元数据.版本 = '0.19.0';
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
  status = status.replaceAll('《诡异药剂师》v0.18', '《诡异药剂师》v0.19')
    .replace(/\(492 锚点闭环\)/g, '(540 锚点闭环)')
    .replace('Array.from({ length: 492 }', 'Array.from({ length: 540 }');
  status = replaceOnce(status, /const FALLBACK_STATE = \{[\s\S]*?\};\s*let mvuAvailable/, `const FALLBACK_STATE = ${JSON.stringify(initial)};\n      let mvuAvailable`, 'status FALLBACK_STATE');
  if (!status.includes("from: 'E539', to: 'E540'")) {
    const pairs = [];
    for (let n = 492; n < EVENT_END; n += 1) {
      pairs.push(`        { from: 'E${n}', to: 'E${n + 1}', label: '结算并承接 E${n + 1}' },`);
    }
    status = replaceOnce(
      status,
      /(        \{ from: 'E491', to: 'E492', label: '结算并承接 E492' \},)/,
      `$1\n${pairs.join('\n')}`,
      'status bridge pairs',
    );
  }
  writeText('src/ui/status.html', status);
}

console.log('[6/12] 世界书事件/概念/NPC…');
{
  const book = readJson('src/worldbook.json');
  book.name = '《诡异药剂师》v0.19';
  book.description = '《诡异药剂师》v0.19 动态世界书（覆盖S0至S73、二十八名核心人物、可选NPC、五百四十事件锚点与全量概念）';
  book.extensions = {
    ...(book.extensions ?? {}),
    tavernweave: { ...(book.extensions?.tavernweave ?? {}), id: 'weird-apothecary-worldbook', version: '0.19.0' },
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
  const e492idx = book.entries.findIndex(e => e.id === 1191);
  if (e492idx < 0) throw new Error('未找到 E492 UID1191');
  book.entries.splice(e492idx + 1, 0, ...newEventEntries);

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
    const after = book.entries.findIndex(e => e.id === 318);
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
  contract.version = '0.19.0';
  contract.required.stage_scope = 'E01至E540；本版新增E493至E540，S0至S73，E540为当前开放终点。';
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
  contract.required.worldbook_version = '0.19.0';
  const wbCount = globalThis.__WB_COUNT__;
  contract.required.worldbook_entry_count = wbCount;
  contract.worldbook_entry_count = wbCount;
  contract.required.terminal_hook_event = 'E540';
  contract.required.terminal_hook_note = 'E540为S73（坠落者联盟到我们起航）开放终点：已「我们起航」；海中事与身份纠偏未闭合，后续事件不在本版展开。';
  contract.stage_scope = contract.required.stage_scope;
  contract.acceptance = {
    ...contract.acceptance,
    event_anchors: EVENT_END,
    stage_scope: 'S0至S73；E01至E540',
    terminal_hook_event: 'E540',
    bridge_pairs_count: EVENT_END - 1,
    source_boundary: '原著阶段十四范围至第2086章（E540封口）；不得读取或泄漏第2087章及以后',
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
      note: 'v0.19精简NPC；按事件及关键词激活，不进入核心关系矩阵。',
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
    stage14_concept_count: NEW_CONCEPT_IDS.length,
    stage14_concept_ranges: [{
      logical_start: NEW_CONCEPT_IDS[0],
      logical_end: NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1],
      uid_start: NEW_CONCEPT_UID_START,
      uid_end: NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1,
      count: NEW_CONCEPT_IDS.length,
    }],
    stage14_note: `v0.19新增阶段十四概念${NEW_CONCEPT_IDS[0]}-${NEW_CONCEPT_IDS[NEW_CONCEPT_IDS.length - 1]}共${NEW_CONCEPT_IDS.length}条（缺号C1414/C1418），世界书UID${NEW_CONCEPT_UID_START}-${NEW_CONCEPT_UID_START + NEW_CONCEPT_IDS.length - 1}；另原位增量更新${conceptUpdates.length}份既有概念。`,
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
    t = t.replaceAll('《诡异药剂师》v0.18', '《诡异药剂师》v0.19')
      .replaceAll('《诡异药剂师》v0.17', '《诡异药剂师》v0.19')
      .replaceAll('《诡异药剂师》v0.16', '《诡异药剂师》v0.19')
      .replaceAll('《诡异药剂师》v0.15', '《诡异药剂师》v0.19')
      .replaceAll('E01至E492', 'E01至E540')
      .replaceAll('E01-E492', 'E01-E540')
      .replaceAll('E01至E434', 'E01至E540')
      .replaceAll('E01-E434', 'E01-E540')
      .replaceAll('E01至E396', 'E01至E540')
      .replaceAll('E01至E348', 'E01至E540')
      .replaceAll('四百九十二个', '五百四十个')
      .replaceAll('四百九十二', '五百四十')
      .replaceAll('四百三十四个', '五百四十个')
      .replaceAll('四百三十四', '五百四十');
    t = t.replace(/E492是当前开放终点：[^\n]*/g, 'E540是当前开放终点：已「我们起航」；剧情严格止于登船起航，不创建E541或引出后续。');
    t = t.replace(/E492为当前开放终点[^\n]*/g, 'E540为当前开放终点');
    t = t.replace(/E492是本版开放终点[^\n]*/g, 'E540是本版开放终点：已「我们起航」；剧情严格止于此引用边界，不创建E541或引出后续内容。');
    t = t.replace(/E434是当前开放终点：[^\n]*/g, 'E540是当前开放终点：已「我们起航」；剧情严格止于登船起航，不创建E541或引出后续。');
    t = t.replace(/E396是当前开放终点：[^\n]*/g, 'E540是当前开放终点：已「我们起航」；剧情严格止于登船起航，不创建E541或引出后续。');
    writeText(p, t);
  }

  let loader = readText('src/scripts/mvu_loader.js');
  loader = loader.replaceAll('诡异药剂师v0.18', '诡异药剂师v0.19').replaceAll('诡异药剂师v0.17', '诡异药剂师v0.19');
  writeText('src/scripts/mvu_loader.js', loader);

  const helpers = readJson('src/tavern_helper_scripts.json');
  for (const script of helpers) {
    if (typeof script.name === 'string') script.name = script.name.replaceAll('v0.18', 'v0.19').replaceAll('v0.17', 'v0.19');
    if (typeof script.id === 'string') script.id = script.id.replaceAll('v0.18', 'v0.19').replaceAll('v0.17', 'v0.19');
    if (typeof script.info === 'string') {
      script.info = script.info
        .replaceAll('v0.18', 'v0.19')
        .replaceAll('v0.17', 'v0.19')
        .replaceAll('四百九十二', '五百四十')
        .replaceAll('四百三十四', '五百四十')
        .replaceAll('E01-E492', 'E01-E540')
        .replaceAll('E01-E434', 'E01-E540')
        .replaceAll('S0-S66', 'S0-S73')
        .replaceAll('S0-S59', 'S0-S73');
    }
  }
  writeJson('src/tavern_helper_scripts.json', helpers);

  let regex = readText('src/regex_scripts.json');
  regex = regex.replaceAll('v0.18', 'v0.19');
  writeText('src/regex_scripts.json', regex);
}

console.log('[8/12] mainline（追加E493—E540并改写E492终点）…');
{
  let text = readText('src/prompts/mainline.md');
  text = text.replace('## 六十七个宽阶段', '## 七十四个宽阶段')
    .replace('## 六十个宽阶段', '## 七十四个宽阶段')
    .replace('四百九十二个事件锚点依次记录为E01至E492', '五百四十个事件锚点依次记录为E01至E540')
    .replace('四百三十四个事件锚点依次记录为E01至E434', '五百四十个事件锚点依次记录为E01至E540');
  text = text.replace(/10\. E492是当前开放终点：[^\n]+/, '10. E540是当前开放终点：已「我们起航」；剧情严格止于登船起航，不创建E541或引出后续。');
  text = text.replace(/10\. E434是当前开放终点：[^\n]+/, '10. E540是当前开放终点：已「我们起航」；剧情严格止于登船起航，不创建E541或引出后续。');

  if (!text.includes('- S67·')) {
    const lines = Object.entries(PHASES).map(([id, v]) => `- ${id}·${v.name}：${v.line}`).join('\n');
    text = replaceOnce(text, /(- S66·[^\n]+\n)/, `$1${lines}\n`, 'mainline stage list S66');
  }

  text = text.replace(
    /\{ id: 'E492', title: '巨像位置与以太夺取', line: '[^']+' \},/,
    `{ id: 'E492', title: '巨像位置与以太夺取', line: '门前第一波与以太「吃了」若已成立，只确认开空容器与学者规则锁压力 → E493原子革命启动与学者吞噬' },`,
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
    text = replaceOnce(text, /(  \{ id: 'E492',[^\n]+\n)\];/, `$1${ctxObjects}\n];`, 'mainline ctx tail');
  }

  const missingBridges = [];
  for (let n = 492; n < EVENT_END; n += 1) {
    const from = `E${n}`;
    const to = `E${n + 1}`;
    if (text.includes(`### ${from}→${to}`)) continue;
    missingBridges.push([from, to]);
  }
  if (missingBridges.length) {
    const bridges = [];
    for (const [from, to] of missingBridges) {
      let fields = from === 'E492' ? { ...E492_TO_E493 } : bridgeFields(from);
      if (![fields.trigger, fields.lead, fields.omen, fields.causal].every(Boolean)) {
        const pair = bridgesV019.pairs.find(p => p.from === from && p.to === to);
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
      bridges.push(`<%_ const v19b${n}FromState = getvar("stat_data.事件.锚点状态.${from}.状态", { defaults: "未触发" }); const v19b${n}FromEnd = getvar("stat_data.事件.锚点状态.${from}.收尾", { defaults: false }); const v19b${n}ToState = getvar("stat_data.事件.锚点状态.${to}.状态", { defaults: "未触发" }); if ((v19b${n}FromState === "完成" || v19b${n}FromState === "变形" || (v19b${n}FromState === "活跃" && v19b${n}FromEnd === true)) && (v19b${n}ToState === "未触发" || v19b${n}ToState === "预兆")) { _%>\n### ${from}→${to} · ${fromTitle} → ${toTitle}\n- 触发时机：${fields.trigger}\n- 剧情引子：${fields.lead}\n- 预兆写法：${fields.omen}\n- 承接因果：${fields.causal}\n- 取消态守卫：若${from}为取消，先核对${to}必要因果与替代入口；状态栏不得自动推进。\n<%_ } _%>`);
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
  card.name = '《诡异药剂师》v0.19';
  card.character_version = '0.19.0';
  card.creator_notes = 'v0.19 内部候选版。由 v0.18 升版，全量合入 E493-E540（S67-S73）共48个事件锚点、34份概念增量与30份新概念、核心人物增量与精简NPC。E540为当前版本终点（「我们起航」开放）；玩家始终掌握林恩的对白、行动、判断、记忆、内心与关系选择。需要 SillyTavern 1.17.0 与酒馆助手 4.9.1；真实宿主验收待执行。v1.0以前不公开发布。';
  writeJson('src/card.json', card);

  const manifest = readJson('manifest.json');
  manifest.id = 'tavernweave.weird-apothecary.v0.19';
  manifest.version = '0.19.0';
  if (manifest.worldbook) manifest.worldbook.version = '0.19.0';
  manifest.packed_json = 'dist/诡异药剂师_v0.19.json';
  if (manifest.card) manifest.card.display_name = '《诡异药剂师》v0.19';
  if (Array.isArray(manifest.deliverables)) manifest.deliverables = ['dist/诡异药剂师_v0.19.json'];
  for (const dep of manifest.runtime_dependencies ?? []) {
    if (dep.id === 'mvu-loader') {
      dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-loader-v0.19]';
    }
    if (dep.id === 'mvu-zod-schema') {
      dep.role = '验证 v0.19 状态结构';
      dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-schema-v0.19]';
    }
  }
  writeJson('manifest.json', manifest);

  const profile = readJson('profile.json');
  profile.id = 'tavernweave.weird-apothecary.v0.19';
  profile.version = '0.19.0';
  profile.display_name = '《诡异药剂师》v0.19';
  writeJson('profile.json', profile);

  const host = readJson('host_acceptance.json');
  host.version = '0.19.0';
  host.status = 'pending';
  host.artifact = 'dist/诡异药剂师_v0.19.json';
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
  host.notes = 'v0.19合入E493-E540、64份概念（34增量+30新）及人物/NPC来源；真实宿主验收仍pending。';
  writeJson('host_acceptance.json', host);

  writeText('SCAFFOLD.md', `# v0.19 工程壳

- 建立时间：2026-09-13
- 基线：\`诡异药剂师_MVU_v0.18\`（冻结，勿回改）
- 状态：已集成 E493—E540（S67—S73）；版本 0.19.0
- 设定来源：\`角色卡设定/v0.19工作区\`
- 工作面：仅云端 \`/workspace/《诡异药剂师》同人角色卡制作计划\`
- 校验：\`npm run check\`（build + validate + validate-integration）
- 产物：\`dist/诡异药剂师_v0.19.json\`；host_acceptance 保持 pending
`);

  writeText('README.md', `# 《诡异药剂师》MVU v0.19

当前维护版本：0.19.0。包含 E01—E540 共540个事件锚点、S0—S73、世界书词条见 contract，28名核心关系人物保持不变。E540为开放终点（「我们起航」）。

## 本版集成

- E493—E540共48个事件；64份概念（34份既有增量 + 30份新概念 C1389—C1420，缺号C1414/C1418，UID 2676—2705）。
- 核心人物增量与精简NPC（卡伦、圣安娜、星轨、神王、灭绝者）；既有NPC按增量追加。
- E540保持开放终点；幼态非性与玩家主权不变。
- 真机实测暂缓，host_acceptance 保持 pending。

## 构建与校验

在本目录运行 \`npm run check\`。生成物为 \`dist/诡异药剂师_v0.19.json\`，禁止直接修改。
`);

  writeText('AGENTS.md', `# 《诡异药剂师》MVU v0.19 接手指南

更新：2026-09-13。本目录为当前维护工程 0.19.0，剧情止于 E540；先读根目录版本与工作区索引及本目录 README.md。

## 权威与写入范围

用户当前要求 → 创作规划.yaml → contract.json → manifest.json → profile.json → src → dist。
保留v0.18及更早版本，不将历史报告改写为当前事实。dist只通过工程构建生成。
玩家独占林恩的对白、主动行动、决定、判断、记忆与内心；默认走向是可改变的事件因果。

## 当前覆盖

- 在 v0.18 基础上集成 v0.19 设定：新增 E493—E540 共 48 事件，S67—S73；总锚点 E01—E540。
- 全卡 540 事件、世界书条目见 contract、28 名核心关系人物。
- 本轮概念：34 既有增量 + 30 新增 C1389—C1420（缺号 C1414/C1418；运行 UID 2676—2705）；事件素材 UID 1192—1239。
- 核心人物多阶段增量；新精简 NPC UID 319—323（卡伦、圣安娜、星轨、神王、灭绝者；无新增六组件）。
- E540 为开放终点（「我们起航」）；E448 幼态非性机制结算；E432 后身份失效隔离保留。

## 创作与安全铁律

- 玩家独占林恩的对白、主动行动、决定、判断、记忆与内心；默认走向只供因果推演。
- 本书为色色风后宫文：明确成年角色的情色、性行为与恶堕路线全面开放；内容一旦由事件事实、NPC主动行为或玩家输入成立，直接呈现动作、身体反应、过程与结果。玩家仍可拒绝、打断或改写林恩的回应。
- **色色直白化**：原文色色暗语/隐喻直接翻译成明语写入，包括性行为过程；不设分级词表。机制三等价：以M=快感冲击（媚药；可唤起性欲；对根源级同样有用）、性行为=解咒途径、恶堕=性调教路径。
- **禁元数据词汇**：角色卡与世界书正文禁止出现"第X章、小总结、大总结、阶段几"等总结/原文词汇，来源与门控一律用 E 编号或 C 编号。
- 幼态/幼年体外形固定非性。
- 严禁加入任何说教式 AI 免责声明、道德评判或与原著相背的非性化强制限制。

## 工程契约

- MVU根为元数据、世界、林恩、事件、关系、角色关系、系统。
- 事件状态切换采用一条完整replace /事件；Schema、初始化、状态栏、调度与契约同步。
- 事件素材 UID700—1239 默认 disabled，UID1 负责事件全文注入。
- 人物/概念沿用事件窗口±1与原生关键词双路激活，同UID去重；双递归保护保留。
- E349之后人设继续使用逐事件EJS门控；新增资料必须同步世界书event_ids、contract与路由兜底。

## 验收

源码修改后运行npm run check；实际断言次数与产物指纹记录在host_acceptance.json。
真实SillyTavern验收按作者要求暂缓，不自动导入、开聊天或运行宿主测试，status保持pending。

## v0.19 工程说明

- 本目录从 \`诡异药剂师_MVU_v0.18\` 复制建立，版本元数据为 \`0.19.0\`。
- **E493—E540 已集成；开放终点为 E540。**
- 集成来源：\`../../角色卡设定/v0.19工作区\`。
- 工作只在云端进行；禁止写用户 Windows 桌面路径。
- 墨月入口：\`../../墨月本地写卡工坊/墨月本地写卡工坊/\`，先读 \`src/诡异药剂师/项目状态.md\`。
`);

  let plan = readText('创作规划.yaml');
  plan = plan
    .replaceAll('诡异药剂师_MVU_v0.18', '诡异药剂师_MVU_v0.19')
    .replaceAll('《诡异药剂师》v0.18', '《诡异药剂师》v0.19')
    .replaceAll('0.18.0', '0.19.0')
    .replaceAll('dist/诡异药剂师_v0.18.json', 'dist/诡异药剂师_v0.19.json')
    .replaceAll('诡异药剂师_MVU_v0.17（冻结基线）', '诡异药剂师_MVU_v0.18（冻结基线）');
  writeText('创作规划.yaml', plan);

  let validate = readText('tools/validate.mjs');
  validate = validate
    .replaceAll("dist/诡异药剂师_v0.18.json", "dist/诡异药剂师_v0.19.json")
    .replaceAll("《诡异药剂师》v0.18", "《诡异药剂师》v0.19")
    .replace("ok(EVENT_IDS.length === 492, '四百九十二事件锚点');", "ok(EVENT_IDS.length === 540, '五百四十事件锚点');")
    .replace("ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E492', '事件锚点范围为E01-E492');", "ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E540', '事件锚点范围为E01-E540');")
    .replace("ok(contract.required.terminal_hook_event === 'E492' || contract.required.terminal_hook_event?.id === 'E492', 'E492为本版开放终点');", "ok(contract.required.terminal_hook_event === 'E540' || contract.required.terminal_hook_event?.id === 'E540', 'E540为本版开放终点');")
    .replace("ok(conceptRouterContent.includes('E492'), '路由事件序列含E492');", "ok(conceptRouterContent.includes('E540'), '路由事件序列含E540');")
    .replace("  if (eventId === 'E492') ok(!content.includes('## 下一事件引入'), 'E492冻结终点不设下一事件引入');", "  if (eventId === 'E540') ok(!content.includes('## 下一事件引入'), 'E540冻结终点不设下一事件引入');")
    .replace("ok(helperSource.every(script => String(script.name ?? '').includes('v0.18')), '酒馆助手脚本命名含v0.18');", "ok(helperSource.every(script => String(script.name ?? '').includes('v0.19')), '酒馆助手脚本命名含v0.19');")
    .replace("ok(!statusUiText.includes(\"from: 'E492'\"), 'E492无推进按钮');", "ok(!statusUiText.includes(\"from: 'E540'\"), 'E540无推进按钮');")
    .replace("ok(bridgePairs.length === 491, '全卡桥共491对');", "ok(bridgePairs.length === 539, '全卡桥共539对');")
    .replace("ok(statusUiText.includes(\"from: 'E491', to: 'E492'\"), '状态栏桥对覆盖E491→E492');", "ok(statusUiText.includes(\"from: 'E539', to: 'E540'\"), '状态栏桥对覆盖E539→E540');")
    .replace('ok(statusBridgeCount === 491, `状态栏桥对共491对（实际${statusBridgeCount}）`);', 'ok(statusBridgeCount === 539, `状态栏桥对共539对（实际${statusBridgeCount}）`);')
    .replace("ok(EVENT_IDS.includes('E492'), '开放终态事件E492已纳入事件序列');", "ok(EVENT_IDS.includes('E540'), '开放终态事件E540已纳入事件序列');")
    .replace("ok(e434Content.includes('## 下一事件引入（E435'), 'E434已引入E435');\nconst e492Content = await readText('src/events/E492_巨像位置与以太夺取.md');\nok(e492Content.includes('吃了') && !e492Content.includes('## 下一事件引入'), 'E492开放终点停在以太吃了且不设下一事件引入');",
             "ok(e434Content.includes('## 下一事件引入（E435'), 'E434已引入E435');\nconst e492Content = await readText('src/events/E492_巨像位置与以太夺取.md');\nok(e492Content.includes('吃了') && e492Content.includes('## 下一事件引入（E493'), 'E492已引入E493');\nconst e540Content = await readText('src/events/E540_地狱争霸与心灵之海计划.md');\nok(e540Content.includes('我们起航') && !e540Content.includes('## 下一事件引入'), 'E540开放终点停在我们起航且不设下一事件引入');")
    .replace("const nEv = Number(eventId.slice(1));\n  const upper = BIG_ANCHORS.has(eventId) || nEv >= 435 ? 4000 : nEv >= 266 ? 3000 : 1200;",
             "const nEv = Number(eventId.slice(1));\n  const upper = BIG_ANCHORS.has(eventId) || nEv >= 435 ? 4000 : nEv >= 266 ? 3000 : 1200;");
  writeText('tools/validate.mjs', validate);

  let integ = readText('tools/validate-integration.mjs');
  integ = integ
    .replace(".replaceAll('0.15.0', '0.18.0').replaceAll('v0.15', 'v0.18')", ".replaceAll('0.15.0', '0.19.0').replaceAll('v0.15', 'v0.19')")
    .replace(".replaceAll('0.15.0', '0.19.0').replaceAll('v0.15', 'v0.19')", ".replaceAll('0.15.0', '0.19.0').replaceAll('v0.15', 'v0.19')")
    .replace('for (let i = 349; i <= 492; i++) {', 'for (let i = 349; i <= 540; i++) {')
    .replace("ok(Object.keys(contract.required.optional_characters).length === 18, '应登记18名可选NPC');", "ok(Object.keys(contract.required.optional_characters).length === 23, '应登记23名可选NPC');")
    .replace('for (let current = 318; current <= 492; current++) {', 'for (let current = 318; current <= 540; current++) {')
    .replace("ok(typeof ejs.render(content, localsFor(492, state)) === 'string'", "ok(typeof ejs.render(content, localsFor(540, state)) === 'string'");
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
    note: '保留既有映射，并追加v0.19人物/NPC增量；新精简NPC见注册映射。',
  });

  const optional = readJson('合并记录/注册映射.json');
  optional.optional = {
    ...optional.optional,
    ...Object.fromEntries(NEW_NPCS.map(npc => [npc.name, {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(readText(`src/characters/${npc.name}/NPC.md`)),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: 'v0.19精简NPC',
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

  writeText('合并记录/v0.19事件合并.md', `# v0.19 事件合并

范围：E493—E540（48条），UID 1192—1239，insertion_order 927—974。
来源：角色卡设定/v0.19工作区/事件/。
E492已改写下一事件引入至E493；E540为开放终点，无下一事件引入、无E541。
阶段：S67—S73（见 schema phaseNames / 摘要/_arcs.json）。
`);

  writeText('合并记录/v0.19概念合并.md', `# v0.19 概念合并

- update 34：按事件门控追加到既有 src/concepts 文件，保留早期变体，扩展标题事件数组。基线优先取卡内文件（交付清单 base_path 指向 v0.18）。
- new 30：C1389—C1420（缺号 C1414、C1418）；运行 UID 2676—2705。
- 文件名保留工作区输出文件名并补全 # 概念· 标题行。
`);

  writeText('合并记录/v0.19人物合并.md', `# v0.19 人物合并

- 核心/可选人物增量：\`人物增量/*_D.md\` 追加到对应多阶段人设.md 或 NPC.md（银色幻想→a01银色幻想；自缚天使→倒吊天使；夏娃→夏娃/NPC.md）。
- 新精简NPC：卡伦、圣安娜、星轨、神王（新NPC/）与灭绝者（NPC/）→ src/characters/<名>/NPC.md，世界书 UID 319—323。
- 幼态非性与玩家主权不变；不发明 E540 之后结局。
`);

  writeText('合并记录/待拍板.md', `# 待拍板

当前无阻塞项（已按 v0.18 惯例自行决定，自行决定标记）：

1. 阶段中文名：S67—S73 取自 \`摘要/_arcs.json\` 标题。
2. E492→E493 衔接：衔接表只从 E493 起对；E492 引入段按 E493 前置条件与「吃了」悬置现场自行补写（见脚本 E492_TO_E493）。
3. 新NPC：卡伦／圣安娜／星轨／神王／灭绝者注册为精简NPC，不升格六组件；UID 319—323。
4. 概念 UID：新概念按逻辑号排序后从 2676 连续分配（缺号 C1414/C1418 不占位），C1389=2676 … C1420=2705。
5. 默认走向上限：E435+ 继续放宽至 4000 字。
6. 可选NPC：在既有 18 名上新增 5 名，共 23 名。
7. 人物增量 \`*_D\` 文件名后缀剥离后映射 CHAR_TARGET。
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
