// v0.14 阶段十接线脚本
// 负责把已经完成的 E318-E348、阶段十概念与六组件人设接入维护源码。
// 事件/概念/角色正文由并行写作代理提供；本脚本只负责注册表、状态镜像和运行时接线。
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVENT_START = 318;
const EVENT_END = 348;
const EVENT_IDS = Array.from({ length: EVENT_END - EVENT_START + 1 }, (_, i) => `E${EVENT_START + i}`);
const PHASES = {
  S41: { name: '母树核心与界门坠落', start: 318, end: 323, line: '母树核心、自然之泉、离狱抵押、七神分化、银幻格式化、蜂巢隔离、血肉投毒、界门崩解与荒地坠落。' },
  S42: { name: '失忆修复与母树服从', start: 324, end: 329, line: '左左母树救援、银幻护魂、数据丢失、爱人定义、疫医黑粉、主仆欲望、根系吞噬与母树迁移准备。' },
  S43: { name: '战舰调查与银幻决裂', start: 330, end: 334, line: '战舰遗念、SS威胁、上传修复、七神重组、母树迁回、黑夜城权柄异变与羽毛笔预言。' },
  S44: { name: '和谈陷阱与黑夜城沦陷', start: 335, end: 340, line: '和谈契约、变节者、血肉陷阱、黑夜城围攻、视界战场、人偶家族回援、衔尾复苏、蜂巢复苏与蓝星法阵。' },
  S45: { name: '灭狱豪赌与渡鸦身世', start: 341, end: 348, line: '黑夜城余烬、最后消息、送葬魂灯、灭狱赌局、苍蓝法师塔、古老记忆、紫罗兰大君自抹、黑海初见与自由悬念。' },
};
const NEW_CONCEPT_RANGES = [
  { start: 1008, end: 1014, uidStart: 2332, uidEnd: 2338 },
  { start: 1193, end: 1210, uidStart: 2517, uidEnd: 2534 },
];
const NEW_CONCEPT_UIDS = new Map();
for (const range of NEW_CONCEPT_RANGES) {
  for (let n = range.start, uid = range.uidStart; n <= range.end; n += 1, uid += 1) NEW_CONCEPT_UIDS.set(`C${n}`, { uid, insertion_order: uid - 1760 });
}
const OPTIONAL_NPC = '拥星者';
const COMPONENT_FILES = ['角色速览.md', '基础信息.md', '性格调色盘.md', '三面性.md', '多阶段人设.md', '二次解释.md'];

function readText(rel) { return readFileSync(resolve(ROOT, rel), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'); }
function writeText(rel, text) { writeFileSync(resolve(ROOT, rel), text.endsWith('\n') ? text : `${text}\n`, 'utf8'); }
function readJson(rel) { return JSON.parse(readText(rel)); }
function writeJson(rel, value) { writeText(rel, JSON.stringify(value, null, 2)); }
function rel(file) { return relative(ROOT, file).replaceAll('\\', '/'); }
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
  const before = text;
  const next = text.replace(pattern, replacement);
  if (next === before && !pattern.test(before)) throw new Error(`未找到接线位置：${label}`);
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
const EVENT_TITLES = Object.fromEntries(EVENT_IDS.map(id => [id, titleFromEventFile(id)]));

function parseConceptHeading(text) {
  const match = text.match(/^# 概念·([^·\r\n]+)·(.+?)（事件(\[[^\r\n]+\])）\s*$/m);
  if (!match) return null;
  let eventIds;
  try { eventIds = JSON.parse(match[3]); } catch { return null; }
  if (!Array.isArray(eventIds) || eventIds.length === 0) return null;
  return { category: match[1], name: match[2], eventIds };
}

function updateEventStageLines() {
  for (const [phaseId, phase] of Object.entries(PHASES)) {
    for (let n = phase.start; n <= phase.end; n += 1) {
      const id = `E${n}`;
      const path = eventFileFor(id);
      const text = readText(path);
      if (text.includes(`- 阶段：${phaseId}·${phase.name}`)) continue;
      const next = replaceOnce(text, /^- 阶段：[^\n]*$/m, `- 阶段：${phaseId}·${phase.name}`, `${id} 阶段字段`);
      writeText(path, next);
    }
  }
}

function updateSchema() {
  const path = 'src/scripts/schema.js';
  let text = readText(path);
  if (!text.includes('S41:')) {
    const phaseLines = Object.entries(PHASES).map(([id, value]) => `  ${id}: '${value.name}',`).join('\n');
    text = replaceOnce(text, /(  S40: '[^']*',\n)(\};)/, `$1${phaseLines}\n$2`, 'schema phaseNames');
  }
  if (!text.includes('E318:')) {
    const titleLines = EVENT_IDS.map(id => `  ${id}: '${EVENT_TITLES[id]}',`).join('\n');
    text = replaceOnce(text, /(  E317: '[^']*',\n)(\};)/, `$1${titleLines}\n$2`, 'schema anchorTitles');
    const anchorLines = EVENT_IDS.map(id => `      ${id}: anchor,`).join('\n');
    text = replaceOnce(text, /(      E317: anchor,\n)(    \}\),)/, `$1${anchorLines}\n$2`, 'schema anchor map');
  }
  text = text.replaceAll('诡异药剂师v0.13', '诡异药剂师v0.14')
    .replace("卡名: z.literal('《诡异药剂师》v0.13')", "卡名: z.literal('《诡异药剂师》v0.14')")
    .replace("版本: z.literal('0.13.0')", "版本: z.literal('0.14.0')");
  writeText(path, text);
}

function appendAnchors(value) {
  value.元数据.卡名 = '《诡异药剂师》v0.14';
  value.元数据.版本 = '0.14.0';
  for (const id of EVENT_IDS) value.事件.锚点状态[id] = { 标题: EVENT_TITLES[id], 状态: '未触发', 收尾: false };
  return value;
}

function syncVariableMirrors() {
  const initial = appendAnchors(readJson('src/initial_variables.json'));
  const alternate = appendAnchors(readJson('src/initial_variables_e25.json'));
  writeJson('src/initial_variables.json', initial);
  writeJson('src/initial_variables_e25.json', alternate);
  const first = readText('src/prompts/first_message.md');
  writeText('src/prompts/first_message.md', replaceOnce(first, /<initvar>\s*[\s\S]*?\s*<\/initvar>/, `<initvar>\n${JSON.stringify(initial, null, 2)}\n</initvar>`, 'first_message initvar'));
  const altPath = 'src/prompts/alternate_greeting_e25.md';
  const alt = readText(altPath);
  writeText(altPath, replaceOnce(alt, /<initvar>\s*[\s\S]*?\s*<\/initvar>/, `<initvar>\n${JSON.stringify(alternate, null, 2)}\n</initvar>`, 'alternate greeting initvar'));
  return { initial, alternate };
}

function updateE317() {
  const path = 'src/events/E317_小树洞阶段九收束.md';
  let text = readText(path);
  text = text.replace(/本事件为全剧终局封口：[\s\S]*?卡面不提供任何预写走向。/, '本事件是S40阶段收束节点：玩家仍拥有是否踏入小树洞、如何处置机械神教与智械小姐余波的绝对主权；E318从树洞后的母树核心线承接，卡面不替林恩行动。');
  text = text.replace(/- 幕后停止点：[^\n]*/, '- 幕后停止点：停在林恩面对已开启的小树洞、尚未踏入的节点；玩家尚未决定如何开始压制诅咒或处理余波时，E317保持收束态，E318只通过下一事件引入段进入预兆。');
  text = text.replace(/- 变形条件：[^\n]*/, '- 变形条件：玩家可以选择踏入小树洞、转身离开或向母树追加条件；这些选择只记录当前分支，不替玩家写出树洞内部行动，E318仍按母树核心与离狱抵押的局部前置接续。');
  text = text.replace(/- 取消条件：[^\n]*/, '- 取消条件：本事件不因玩家在树洞前的分支选择而取消；若S40中途提前中断整条线（例如E314选择当场相认、E316选择放弃母树），则本收束事件只记录已经形成的事实，阶段收束记录保留。');
  text = text.replace(/- 完成条件：[^\n]*/, '- 完成条件：小树洞开启并悬置；S40的机械神教、智械小姐与母树余波完成记录；玩家明确做出踏入、驻足或转身的当前选择后，E317完成，E318可按局部前置进入预兆。');
  text = text.replace(/- 结果影响：[^\n]*/, '- 结果影响：S40以小树洞前的一步完成阶段收束；欲望母树臣服、园丁任务与自然神性驾驭力继续入账，E318承接母树核心、自然之泉与离狱抵押。');
  text = text.replace(/- 系统提示：[^\n]*/, '- 系统提示：报告树洞气息、母树等待与战场余响，不替林恩决定；E317只记录S40阶段收束，E318负责树洞内部与母树核心的新因果，未发生的星空坐标不得虚构。');
  text = text.replace(/^- 终局封口：[^\n]*/m, '- 阶段收束：E317完成S40阶段收束；小树洞是否被踏入、压制诅咒的方式与余波处置仍由玩家决定，下一事件E318从母树核心与离狱抵押接续。');
  text = text.replaceAll('严禁越界创建E318或引出后续。', 'E318由下一事件引入段承接。')
    .replaceAll('本版至此止步，不创建E318。', 'E318为本版下一事件。')
    .replaceAll('没有下一个事件：', '下一事件为E318：');
  if (!text.includes('## 下一事件引入（E318·')) {
    const bridge = `\n## 下一事件引入（E318·${EVENT_TITLES.E318}）\n- 触发时机：E317完成或变形后，小树洞仍保持开启，且玩家进入、观察或询问树洞内部；或母树核心与外部机械攻坚同时出现明确波动。\n- 剧情引子：树洞深处传来水声与根系搏动，黑红病变沿树皮缝隙收缩，洁净水潭的反光在幽暗里短暂亮起。\n- 预兆写法：只写水声、根系搏动与水潭反光，不提前写出柳枝少女、离狱请求或抵押兑现。\n- 承接因果：小树洞从S40收束入口转为母树核心入口；E318接管自然之泉、神魂接触与离狱交易的局部因果。\n`;
    text = replaceOnce(text, /\n<%_ \} _%>\s*$/, `${bridge}\n<%_ } _%>`, 'E317→E318 bridge slot');
  }
  writeText(path, text);
}

function updateStatus(initial) {
  const path = 'src/ui/status.html';
  let text = readText(path);
  text = text.replaceAll('《诡异药剂师》v0.13', '《诡异药剂师》v0.14')
    .replace('(317 锚点闭环)', '(348 锚点闭环)')
    .replace('Array.from({ length: 317 }', 'Array.from({ length: 348 }');
  text = replaceOnce(text, /const FALLBACK_STATE = \{[\s\S]*?\};\s*let mvuAvailable/, `const FALLBACK_STATE = ${JSON.stringify(initial)};\n      let mvuAvailable`, 'status FALLBACK_STATE');
  if (!text.includes("from: 'E317', to: 'E318'")) {
    const pairs = [];
    for (let n = 317; n < EVENT_END; n += 1) pairs.push(`        { from: 'E${n}', to: 'E${n + 1}', label: '结算并承接 E${n + 1}' },`);
    text = replaceOnce(text, /(        \{ from: 'E316', to: 'E317', label: '结算并承接 E317' \},)/, `$1\n${pairs.join('\n')}`, 'status bridge pairs');
  }
  writeText(path, text);
}

function conceptFilesById() {
  const map = new Map();
  for (const file of allFiles(resolve(ROOT, 'src/concepts'))) {
    const match = file.match(/[\\/]C(\d+)_/);
    if (!match) continue;
    const id = `C${match[1]}`;
    if (map.has(id)) throw new Error(`概念文件逻辑ID重复：${id}`);
    map.set(id, rel(file));
  }
  return map;
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

function updateWorldbook(characterEventIds) {
  const path = 'src/worldbook.json';
  const book = readJson(path);
  book.name = '《诡异药剂师》v0.14';
  book.description = '《诡异药剂师》v0.14 动态世界书（覆盖S0至S45全部四十六阶段、二十八名核心人物、一名可选NPC、三百四十八事件锚点与全量概念）';
  book.extensions = { ...(book.extensions ?? {}), tavernweave: { ...(book.extensions?.tavernweave ?? {}), id: 'weird-apothecary-worldbook', version: '0.14.0' } };

  const conceptMap = conceptFilesById();
  const newLogicalIds = new Set(NEW_CONCEPT_UIDS.keys());
  const usedKeys = new Set(book.entries
    .filter(entry => !newLogicalIds.has(entry.extensions?.tavernweave?.logical_id))
    .flatMap(entry => entry.keys ?? []));
  for (const entry of book.entries) {
    const logicalId = entry.extensions?.tavernweave?.logical_id;
    if (NEW_CONCEPT_UIDS.has(logicalId) || !entry.content_file) continue;
    const content = entry.content_file ? readText(entry.content_file) : '';
    const parsed = parseConceptHeading(content);
    if (!parsed || !parsed.eventIds.some(id => Number(id.slice(1)) >= EVENT_START)) continue;
    entry.comment = `[概念·${parsed.category}]${parsed.name}`;
    entry.extensions.tavernweave.event_ids = parsed.eventIds;
  }

  const newConceptEntries = [];
  for (const [logicalId, meta] of NEW_CONCEPT_UIDS) {
    const contentFile = conceptMap.get(logicalId);
    if (!contentFile) throw new Error(`新增概念文件缺失：${logicalId}`);
    const parsed = parseConceptHeading(readText(contentFile));
    if (!parsed) throw new Error(`新增概念标题无法解析：${logicalId}`);
    newConceptEntries.push({
      id: meta.uid,
      comment: `[概念·${parsed.category}]${parsed.name}`,
      keys: stableKeys(parsed.name, usedKeys, logicalId),
      constant: false,
      insertion_order: meta.insertion_order,
      content_file: contentFile,
      extensions: {
        exclude_recursion: true,
        prevent_recursion: true,
        tavernweave: { logical_id: logicalId, event_ids: parsed.eventIds },
      },
      secondary_keys: [],
    });
  }
  const newConceptIds = new Set(newConceptEntries.map(entry => entry.id));
  book.entries = book.entries.filter(entry => !newConceptIds.has(entry.id));
  book.entries.push(...newConceptEntries);

  const newEventEntries = EVENT_IDS.map((id, index) => ({
    id: 1017 + index,
    comment: `[事件]${id}·${EVENT_TITLES[id]}`,
    keys: [id],
    enabled: false,
    constant: false,
    insertion_order: 752 + index,
    content_file: eventFileFor(id),
    extensions: { exclude_recursion: true, prevent_recursion: true },
  }));
  const newEventIds = new Set(newEventEntries.map(entry => entry.id));
  book.entries = book.entries.filter(entry => !newEventIds.has(entry.id));
  const eventTail = book.entries.findIndex(entry => entry.id === 1016);
  if (eventTail < 0) throw new Error('worldbook 未找到 E317 素材 UID1016');
  book.entries.splice(eventTail + 1, 0, ...newEventEntries);

  const charUpdates = new Map();
  for (const entry of book.entries) {
    const name = entry.comment?.startsWith('[角色]') ? entry.comment.slice(4) : '';
    if (!name || !characterEventIds[name]) continue;
    entry.extensions = { ...(entry.extensions ?? {}), exclude_recursion: true, prevent_recursion: true, tavernweave: { ...(entry.extensions?.tavernweave ?? {}), event_ids: characterEventIds[name] } };
    charUpdates.set(name, entry);
  }
  for (const [name, eventIds] of Object.entries(characterEventIds)) {
    if (!charUpdates.has(name)) throw new Error(`核心角色世界书词条缺失：${name}`);
  }

  const npcFiles = COMPONENT_FILES.map(file => `src/characters/${OPTIONAL_NPC}/${file}`);
  const npcEntry = {
    id: 300,
    comment: `[角色]${OPTIONAL_NPC}`,
    keys: [OPTIONAL_NPC],
    constant: false,
    insertion_order: 300,
    content_files: npcFiles,
    extensions: {
      exclude_recursion: true,
      prevent_recursion: true,
      tavernweave: { event_ids: ['E337', 'E338'], route_kind: 'optional_npc' },
    },
    secondary_keys: [],
  };
  book.entries = book.entries.filter(entry => entry.id !== npcEntry.id);
  const routerIndex = book.entries.findIndex(entry => entry.id === 299);
  book.entries.splice(routerIndex < 0 ? 0 : routerIndex + 1, 0, npcEntry);
  writeJson(path, book);
  return { worldbookEntries: book.entries.length, newConceptEntries, npcEntry };
}

function updateContract() {
  const path = 'contract.json';
  const contract = readJson(path);
  const allEventIds = [...Array.from({ length: EVENT_END }, (_, i) => `E${String(i + 1).padStart(2, '0')}`)];
  const allTitles = { ...contract.required.event_titles, ...EVENT_TITLES };
  const stageRanges = {
    ...contract.required.stage_ranges,
    ...Object.fromEntries(Object.entries(PHASES).map(([id, phase]) => [id, Array.from({ length: phase.end - phase.start + 1 }, (_, i) => `E${phase.start + i}`)])),
  };
  contract.version = '0.14.0';
  contract.required.stage_scope = 'E01至E348；本版新增E318至E348，S0至S45，E348为当前开放终点。';
  contract.required.event_ids = allEventIds;
  contract.required.event_titles = allTitles;
  contract.required.stage_ranges = stageRanges;
  contract.required.event_context_windows.material_entry_end = 1047;
  contract.required.worldbook_version = '0.14.0';
  contract.required.worldbook_entry_count = 1003;
  contract.required.terminal_hook_event = 'E348';
  contract.required.terminal_hook_note = 'E348为S45（灭狱豪赌与渡鸦身世）开放终点：自由、外宇灾厄警告与未知来客悬置；后续事件不在本版展开。';
  contract.required.character_event_ids = contract.required.character_event_ids ?? {};
  for (const name of contract.required.core_characters) {
    const file = `src/characters/${name}/多阶段人设.md`;
    const text = readText(file);
    const appended = [...new Set([...text.matchAll(/\bE(\d{2,3})\b/g)].map(match => Number(match[1])).filter(n => n >= EVENT_START && n <= EVENT_END).map(n => `E${n}`))];
    contract.required.character_event_ids[name] = [...new Set([...(contract.required.character_event_ids[name] ?? []), ...appended])]
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  }
  contract.required.character_activation = { ...(contract.required.character_activation ?? {}), character_count: 28, optional_character_count: 1 };
  contract.required.optional_characters = {
    [OPTIONAL_NPC]: {
      entry_id: 300,
      event_ids: ['E337', 'E338'],
      content_files: COMPONENT_FILES.map(file => `src/characters/${OPTIONAL_NPC}/${file}`),
      relation_registered: false,
      note: '高权重可选NPC；通过角色世界书词条和事件窗口激活，不进入28名核心关系表。',
    },
  };
  contract.required.concept_activation = {
    ...contract.required.concept_activation,
    stage10_concept_count: 25,
    stage10_concept_ranges: NEW_CONCEPT_RANGES.map(range => ({ logical_start: `C${range.start}`, logical_end: `C${range.end}`, uid_start: range.uidStart, uid_end: range.uidEnd, count: range.end - range.start + 1 })),
    stage10_note: 'v0.14新增阶段十概念仅注册C1008-C1014与C1193-C1210；保留全球注册表为后续版本预留的C1015-C1192，不提前写入本卡。',
  };
  contract.acceptance = {
    ...contract.acceptance,
    event_anchors: EVENT_END,
    stage_scope: 'S0至S45；E01至E348',
    terminal_hook_event: 'E348',
    bridge_pairs_count: EVENT_END - 1,
    source_boundary: '原著阶段十范围至第1452章（E348封口）；阶段十使用第1351-1452章；不得读取或泄漏第1453章及以后',
  };
  contract.worldbook_entry_count = 1003;
  contract.stage_scope = 'E01至E348；本版新增E318至E348，S0至S45，止于E348自由与未知来客悬置。';
  writeJson(path, contract);
  return contract;
}

function updateRouter(contract) {
  const path = 'src/prompts/concept_event_router.md';
  let text = readText(path);
  const sequence = `[${Array.from({ length: EVENT_END }, (_, i) => `"E${String(i + 1).padStart(2, '0')}"`).join(',')}]`;
  text = replaceOnce(text, /const eventSequence = \[[^\]]+\];/, `const eventSequence = ${sequence};`, 'router eventSequence');
  const mapLines = contract.required.core_characters.map(name => `    [${contract.required.character_entry_ids[name]},${JSON.stringify(contract.required.character_event_ids[name])}],`).join('\n');
  text = replaceOnce(text, /  \/\/ CHARACTER_EVENT_FALLBACK_START[\s\S]*?  \/\/ CHARACTER_EVENT_FALLBACK_END/, `  // CHARACTER_EVENT_FALLBACK_START\n  const characterEventFallback = new Map([\n${mapLines}\n  ]);\n  // 可选NPC拥星者使用其世界书词条extensions.tavernweave.event_ids，不进入核心兜底映射。\n  // CHARACTER_EVENT_FALLBACK_END`, 'router character fallback');
  writeText(path, text);
}

function updateMainline() {
  const path = 'src/prompts/mainline.md';
  let text = readText(path);
  text = text.replace('## 四十一个宽阶段', '## 四十六个宽阶段');
  if (!text.includes('- S41·')) {
    const lines = Object.entries(PHASES).map(([id, value]) => `- ${id}·${value.name}：${value.line}`).join('\n');
    text = replaceOnce(text, /(- S40·[^\n]+\n)(\n## 调度规则)/, `$1${lines}\n$2`, 'mainline stage list');
  }
  text = text.replace('三百一十七个事件锚点依次记录为E01至E317', '三百四十八个事件锚点依次记录为E01至E348')
    .replace('10. E317是当前开放终点：小树洞浮现、欲望母树臣服与园丁任务悬置；剧情严格止于林恩面对小树洞、尚未踏入，严禁越界创建E318或引出后续。', '10. E348是当前开放终点：自由、轮回与未知来客悬置；剧情严格止于“有人要见你”的召见，不创建E349或引出后续。');
  const ctxLines = {
    E318: '母树核心与自然之泉显现、离狱抵押成立 → E319七神分化与银幻格式化',
    E319: '七神意识分化、银幻格式化与蜂巢隔离 → E320母树意识反击与蜂巢隔离',
    E320: '母树意识反击、血肉投毒与核心隔离 → E321内部界门与根系危机',
    E321: '血肉投毒、内部界门与黑锁链压制 → E322银幻拦截与界门崩解',
    E322: '银色幻想拦截、光武与根源战刃显现 → E323荒地坠落与小丑诅咒',
    E323: '界门崩解、荒地坠落与小丑诅咒升级 → E324左左母树救援与银幻护魂',
    E324: '左左进入母树核心、银幻护魂与时间魂媒启动 → E325银幻修复与坦白',
    E325: '银幻修复、数据缺口与小冰箱坦白 → E326数据丢失与爱人定义',
    E326: '数据丢失、白花加密与爱人定义 → E327疫医黑粉与遗蜕线索',
    E327: '疫医黑粉、遗蜕线索与荒地血肉回收 → E328主仆欲望与根系吞噬',
    E328: '主仆欲望、M百连击与根系吞噬推进 → E329母树迁移与战舰残骸',
    E329: '母树迁移准备、战舰残骸与旗舰数据库 → E330战舰遗念与SS威胁',
    E330: '战舰遗念、SS威胁与上传修复压力 → E331银幻决裂',
    E331: '上传修复、银幻决裂与七神重组 → E332母树迁回与神教重组',
    E332: '七神重组、母树迁回与契约余波 → E333黑夜城权柄与花粉异变',
    E333: '黑夜城权柄、红花花粉与群体污染 → E334羽毛笔预言与和谈前夜',
    E334: '羽毛笔预言、旧神消息与和谈前夜 → E335和谈契约与独行准备',
    E335: '和谈契约、视界担保与独行准备 → E336变节者与血肉陷阱',
    E336: '变节者现身、违约天谴与血肉陷阱 → E337黑夜城围攻与视界战场',
    E337: '黑夜城围攻、拥星者围猎与视界战场 → E338人偶家族回援',
    E338: '人偶家族回援、控线扰乱与七神战场 → E339错误衔尾与大君复苏',
    E339: '错误衔尾、复苏信号与灭狱战争号角 → E340蜂巢复苏与蓝星法阵',
    E340: '蜂巢复苏、灭狱坐标与蓝星法阵启动 → E341黑夜城余烬与母树沉寂',
    E341: '黑夜城余烬、母树沉寂与最后消息 → E342黑夜城旧景',
    E342: '黑夜城旧景、旧关系与最后消息 → E343送葬魂灯与灭狱赌局',
    E343: '送葬魂灯、灭狱坐标与十秒扳机 → E344苍蓝法师塔',
    E344: '外部灾厄、苍蓝法师塔与月儿兰花园 → E345混乱色彩与古老记忆',
    E345: '混乱色彩、苍蓝引路者与古老记忆 → E346紫罗兰大君自抹',
    E346: '紫罗兰大君自抹、破碎戒指与黑夜城复生 → E347黑海初见',
    E347: '苏醒、黑海初见与轮回记录 → E348自由与有人要见你',
    E348: '自由、最后一只渡鸦与未知来客召见（本版终点）',
  };
  const ctxObjects = EVENT_IDS.map(id => `  { id: '${id}', title: '${EVENT_TITLES[id].replaceAll("'", "\\'")}', line: '${ctxLines[id].replaceAll("'", "\\'")}' },`).join('\n');
  if (!text.includes("  { id: 'E348'")) {
    text = replaceOnce(text, /  \{ id: 'E317',[^\n]+\n\];/, `  { id: 'E317', title: '小树洞·阶段九收束', line: '小树洞前的S40阶段收束、母树臣服与机械神教余波 → E318母树核心与离狱抵押' },\n${ctxObjects}\n];`, 'mainline ctx tail');
  }
  if (!text.includes('### E317→E318')) {
    const bridges = [];
    bridges.push(`<%_ const v14b317FromState = getvar("stat_data.事件.锚点状态.E317.状态", { defaults: "未触发" }); const v14b317FromEnd = getvar("stat_data.事件.锚点状态.E317.收尾", { defaults: false }); const v14b317ToState = getvar("stat_data.事件.锚点状态.E318.状态", { defaults: "未触发" }); if ((v14b317FromState === "完成" || v14b317FromState === "变形" || (v14b317FromState === "活跃" && v14b317FromEnd === true)) && (v14b317ToState === "未触发" || v14b317ToState === "预兆")) { _%>\n### E317→E318 · 小树洞·阶段九收束 → ${EVENT_TITLES.E318}\n- 触发时机：E317完成或变形后，小树洞保持开启，且玩家进入、观察或询问树洞内部；或母树核心与外部机械攻坚同时出现明确波动。\n- 剧情引子：树洞深处传来水声与根系搏动，黑红病变沿树皮缝隙收缩，洁净水潭的反光在幽暗里短暂亮起。\n- 预兆写法：只写水声、根系搏动与水潭反光，不提前写出柳枝少女、离狱请求或抵押兑现。\n- 承接因果：小树洞从S40收束入口转为母树核心入口；E318接管自然之泉、神魂接触与离狱交易的局部因果。\n- 取消态守卫：若E317为取消，先核对E318进入条件与替代入口；状态栏不得自动推进。\n<%_ } _%>`);
    for (let n = EVENT_START; n < EVENT_END; n += 1) {
      const from = `E${n}`;
      const to = `E${n + 1}`;
      const source = readText(eventFileFor(from));
      const section = source.match(/## 下一事件引入[^\n]*\n([\s\S]*?)(?=\n<%_|$)/)?.[1] ?? '';
      const get = label => section.match(new RegExp(`^- ${label}：([^\\n]*)`, 'm'))?.[1]?.trim();
      const trigger = get('触发时机');
      const lead = get('剧情引子');
      const omen = get('预兆写法');
      const causal = get('承接因果');
      if (![trigger, lead, omen, causal].every(Boolean)) throw new Error(`${from} 下一事件引入字段不完整`);
      bridges.push(`<%_ const v14b${n}FromState = getvar("stat_data.事件.锚点状态.${from}.状态", { defaults: "未触发" }); const v14b${n}FromEnd = getvar("stat_data.事件.锚点状态.${from}.收尾", { defaults: false }); const v14b${n}ToState = getvar("stat_data.事件.锚点状态.${to}.状态", { defaults: "未触发" }); if ((v14b${n}FromState === "完成" || v14b${n}FromState === "变形" || (v14b${n}FromState === "活跃" && v14b${n}FromEnd === true)) && (v14b${n}ToState === "未触发" || v14b${n}ToState === "预兆")) { _%>\n### ${from}→${to} · ${EVENT_TITLES[from]} → ${EVENT_TITLES[to]}\n- 触发时机：${trigger}\n- 剧情引子：${lead}\n- 预兆写法：${omen}\n- 承接因果：${causal}\n- 取消态守卫：若${from}为取消，先核对${to}必要因果与替代入口；状态栏不得自动推进。\n<%_ } _%>`);
    }
    const finalClose = text.lastIndexOf('\n<%_ } _%>');
    if (finalClose < 0) throw new Error('mainline 末尾闭合标记缺失');
    text = `${text.slice(0, finalClose)}\n\n${bridges.join('\n\n')}${text.slice(finalClose)}`;
  }
  writeText(path, text);
}

function updatePromptSummaries() {
  const replacements = [
    ['src/prompts/system.md', [
      ['你正在运行《诡异药剂师》v0.13。', '你正在运行《诡异药剂师》v0.14。'],
      ['E01至E317', 'E01至E348'],
      ['E317是当前开放终点：小树洞浮现、欲望母树臣服与园丁任务悬置；剧情严格止于林恩面对小树洞、尚未踏入，严禁越界创建E318或引出后续。', 'E348是当前开放终点：自由、轮回与未知来客悬置；剧情严格止于“有人要见你”的召见，不创建E349或引出后续。'],
      ['二十八名核心人物按各自事件事实记录状态。', '二十八名核心人物按各自事件事实记录状态；拥星者作为E337-E338可选NPC接入，不进入核心关系表。'],
    ]],
    ['src/prompts/world.md', [
      ['《诡异药剂师》v0.13', '《诡异药剂师》v0.14'],
      ['E01至E317', 'E01至E348'],
      ['E317是本版封口：阶段九收束节点（E316母树臣服成就、E317小树洞开启；星空坐标未点亮），剧情严格止于此引用边界，严禁越界创建E318或引出后续内容。', 'E348是本版开放终点：阶段十收束节点（自由、轮回、渡鸦身世与未知来客召见），剧情严格止于此引用边界，不创建E349或引出后续内容。'],
      ['左左、血锯、血衣女士、小小、人偶夫人、爱丽丝、白逸、泰坦头颅、巫神头颅、小宝贝、倒吊天使、白夜、渡鸦、黑颅、猪头屠夫、哭泣小丑、黑白小丑、黑弦月、喵喵、林樱、艾雯爵士、羽毛笔、a01银色幻想、欲望母树、万机之神、巨像之脑、血肉支配者、弥赛亚均有独立人物条目。', '左左、血锯、血衣女士、小小、人偶夫人、爱丽丝、白逸、泰坦头颅、巫神头颅、小宝贝、倒吊天使、白夜、渡鸦、黑颅、猪头屠夫、哭泣小丑、黑白小丑、黑弦月、喵喵、林樱、艾雯爵士、羽毛笔、a01银色幻想、欲望母树、万机之神、巨像之脑、血肉支配者、弥赛亚均有独立核心人物条目；拥星者是E337-E338可选NPC条目，不自动建立核心关系。'],
    ]],
    ['src/prompts/card_description.md', [
      ['《诡异药剂师》v0.13', '《诡异药剂师》v0.14'],
      ['E01至E317共三百一十七个', 'E01至E348共三百四十八个'],
      ['E317是当前开放终点：小树洞浮现、欲望母树臣服与园丁任务悬置；剧情严格止于林恩面对小树洞、尚未踏入，严禁越界创建E318或引出后续。', 'E348是当前开放终点：自由、轮回、渡鸦身世与未知来客召见；剧情严格止于召见悬念，不创建E349或引出后续。'],
      ['v0.13只保证', 'v0.14只保证'],
    ]],
    ['src/prompts/mvu_update_rules.md', [
      ['三百一十七个锚点', '三百四十八个锚点'],
      ['E01-E317', 'E01-E348'],
      ['E317为当前开放终点', 'E348为当前开放终点'],
    ]],
  ];
  for (const [path, pairs] of replacements) {
    let text = readText(path);
    for (const [from, to] of pairs) text = text.replaceAll(from, to);
    writeText(path, text);
  }
}

function updateRoleIndex() {
  const path = 'src/characters/角色速览.md';
  let text = readText(path).replace('# 二十八人路由索引', '# 二十八人核心与可选NPC路由索引');
  if (!text.includes(`- ${OPTIONAL_NPC}（可选NPC）`)) {
    text = text.replace(/\n解锁规则：/, `\n- ${OPTIONAL_NPC}（可选NPC）：机械神教七神之一的高权重显化体。E337黑夜城围攻时进入围猎，E338受人偶家族回援干扰；资料按E337-E338事件状态解锁，不写入核心关系表。\n\n解锁规则：`);
  }
  writeText(path, text);
}

function updateHostAcceptance() {
  const path = 'host_acceptance.json';
  const value = readJson(path);
  value.version = '0.14.0';
  value.status = 'pending';
  value.artifact = 'dist/诡异药剂师_v0.14.json';
  value.bytes = null;
  value.sha256 = null;
  value.last_runtime_sha256 = null;
  value.accepted_at = null;
  value.evidence = null;
  value.offline_checks = { ...(value.offline_checks ?? {}), status: 'pending', checks: null, command: 'npm run check', worldbook_entries: null, event_anchors: EVENT_END };
  writeJson(path, value);
}

updateEventStageLines();
updateSchema();
const mirrors = syncVariableMirrors();
updateE317();
updatePromptSummaries();
updateMainline();
const contract = updateContract();
updateRouter(contract);
updateStatus(mirrors.initial);
updateRoleIndex();
const characterEventIds = contract.required.character_event_ids;
const book = updateWorldbook(characterEventIds);
updateHostAcceptance();
console.log(JSON.stringify({ status: 'integrated', events: EVENT_IDS.length, phases: Object.keys(PHASES).length, concepts: 25, worldbook_entries: book.worldbookEntries, optional_npc: OPTIONAL_NPC }, null, 2));
