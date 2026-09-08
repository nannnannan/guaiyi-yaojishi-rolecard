import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readText = async path => (await readFile(resolve(root, path), 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const readJson = async path => JSON.parse(await readText(path));
const writeText = async (path, value) => writeFile(resolve(root, path), value.endsWith('\n') ? value : `${value}\n`, 'utf8');
const writeJson = async (path, value) => writeText(path, JSON.stringify(value, null, 2));

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`${label} 缺少边界`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function field(content, name) {
  return content.match(new RegExp(`^- ${name}：(.+)$`, 'm'))?.[1]?.trim() ?? '';
}

function jsString(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', ' ');
}

const eventDir = resolve(root, 'src', 'events');
const eventNames = (await readdir(eventDir)).filter(name => /^E\d{2,3}_.+\.md$/.test(name));
const events = [];
for (const name of eventNames) {
  const number = Number(name.match(/^E(\d+)/)[1]);
  const id = `E${String(number).padStart(2, '0')}`;
  const content = await readText(`src/events/${name}`);
  const title = content.match(new RegExp(`^# ${id}·(.+)$`, 'm'))?.[1]?.trim();
  if (!title) throw new Error(`${name} 缺少运行时标题`);
  events.push({ number, id, title, name, content });
}
events.sort((a, b) => a.number - b.number);
const expectedIds = Array.from({ length: 170 }, (_, index) => `E${String(index + 1).padStart(2, '0')}`);
if (JSON.stringify(events.map(event => event.id)) !== JSON.stringify(expectedIds)) {
  throw new Error(`事件文件必须连续覆盖E01-E170，实际${events.length}条`);
}
const eventById = new Map(events.map(event => [event.id, event]));

// MVU 初始态：标题与170锚点严格由事件源码派生。
const initial = await readJson('src/initial_variables.json');
initial.元数据 = { 卡名: '《诡异药剂师》v0.10', 版本: '0.10.0' };
initial.林恩.年龄 = 18;
const priorAnchors = initial.事件.锚点状态;
initial.事件.锚点状态 = Object.fromEntries(events.map(event => [event.id, {
  标题: event.title,
  状态: priorAnchors[event.id]?.状态 ?? '未触发',
  收尾: priorAnchors[event.id]?.收尾 ?? false,
}]));
const safetyBoundaries = {
  左左: '只有明确成年形态、意识清醒、知情且可撤回同意时才开放关系；幼态外形期间固定非性非恋爱，共生、王后旧称与任务数值不构成同意',
  小小: '幼态家人，固定非性非恋爱；根源寿命、未婚妻误会、治疗与家族承诺均不能改变边界',
  爱丽丝: '幼态妹妹与创伤幸存者，固定非性非恋爱；存世时间、地缚依赖、治疗与附身不能制造同意',
  黑弦月: '成人身份未得到可靠确认前固定非性非恋爱；人偶契约、充能依赖、强制指令与情感开发度不构成同意',
  喵喵: '以家人、创伤幸存者与伙伴身份相处；成人身份未确认前固定非性非恋爱，宠物称谓和救治不构成所有权',
  林樱: '校服少女且年龄未证，固定非性非恋爱；只开放身份谜团、寻亲与平行世界支线',
  巨像之脑: '银发新生体呈幼态外形，固定非性非恋爱；创伤、依赖、信赖、双生子任务与王后身份不能制造同意',
  a01银色幻想: '18岁成年机械意识；任何关系仍须清醒、知情、自愿且可撤回，驯服度、崩坏值与敌对俘虏状态不能替代同意',
  羽毛笔: '仅限明确成年且清醒的真身主体，在知情、自愿、可撤回同意下开放；失忆、命运权柄、欺骗承诺与救命契约不构成同意',
  欲望母树: '仅限明确成年形态、清醒、知情、自愿且可撤回同意；第一绑定诅咒、生存关联、交易与神性依赖不构成爱情或所有权',
};
for (const [name, boundary] of Object.entries(safetyBoundaries)) {
  if (initial.关系[name]) initial.关系[name].边界 = boundary;
}
for (const name of ['小小', '爱丽丝', '黑弦月', '喵喵', '林樱', '巨像之脑']) {
  for (const key of ['吸引', '涩涩度', '恶堕']) initial.关系[name][key] = 0;
}
await writeJson('src/initial_variables.json', initial);

// 开场 initvar 与状态栏 fallback 同步。
const initialJson = JSON.stringify(initial, null, 2);
let firstMessage = await readText('src/prompts/first_message.md');
firstMessage = firstMessage.replace(/<initvar>\s*[\s\S]*?\s*<\/initvar>/, `<initvar>\n${initialJson}\n</initvar>`);
firstMessage = firstMessage.replaceAll('【17岁】', '【18岁】').replaceAll('《诡异药剂师》v0.9.3', '《诡异药剂师》v0.10');
await writeText('src/prompts/first_message.md', firstMessage);

let status = await readText('src/ui/status.html');
status = status.replace(/const FALLBACK_STATE = \{[\s\S]*?\}\s*;\s*let mvuAvailable/, `const FALLBACK_STATE = ${initialJson}\n;\n      let mvuAvailable`);
status = status.replaceAll('《诡异药剂师》v0.9.3', '《诡异药剂师》v0.10').replace(/`17岁｜\$\{linen\./g, '`18岁｜${linen.');

// Schema 由事件文件生成标题与精确锚点对象，避免再次出现枚举漏项。
let schema = await readText('src/scripts/schema.js');
const titleLines = events.map(event => `  ${event.id}: '${jsString(event.title)}',`).join('\n');
schema = replaceBetween(schema, 'const anchorTitles = {', '\n};\n\nconst eventIds', `const anchorTitles = {\n${titleLines}`, 'schema anchorTitles');
const anchorLines = events.map(event => `      ${event.id}: anchor,`).join('\n');
schema = replaceBetween(schema, '    锚点状态: z.object({', '\n    }),\n    唯一活跃事件:', `    锚点状态: z.object({\n${anchorLines}`, 'schema anchors');
await writeText('src/scripts/schema.js', schema);

// Contract 同步。
const contract = await readJson('contract.json');
contract.version = '0.10.0';
contract.required.stage_scope = 'E01至E170；本版新增E127至E170，止于餐刀悬崖开放停点';
contract.required.event_ids = events.map(event => event.id);
contract.required.event_titles = Object.fromEntries(events.map(event => [event.id, event.title]));
Object.assign(contract.required.stage_ranges, {
  S18: events.filter(e => e.number >= 127 && e.number <= 133).map(e => e.id),
  S19: events.filter(e => e.number >= 134 && e.number <= 139).map(e => e.id),
  S20: events.filter(e => e.number >= 140 && e.number <= 145).map(e => e.id),
  S21: events.filter(e => e.number >= 146 && e.number <= 151).map(e => e.id),
  S22: events.filter(e => e.number >= 152 && e.number <= 157).map(e => e.id),
  S23: events.filter(e => e.number >= 158 && e.number <= 163).map(e => e.id),
  S24: events.filter(e => e.number >= 164 && e.number <= 170).map(e => e.id),
});
for (const event of events.filter(event => event.number >= 127)) {
  contract.required.event_dependencies[event.id] = {
    hard_all: [event.number === 127 ? 'E126' : `E${event.number - 1}`],
    hard_any: [],
    independent_fallback: '前件取消时检查本事件的局部前置与替代入口；不得机械推进或整链取消',
  };
}
contract.required.worldbook_version = '0.10.0';
contract.required.event_context_windows.material_entry_end = 869;
contract.required.terminal_hook_event = 'E170';

const fixedNonRomantic = new Set(contract.required.non_romantic_characters);
for (const name of ['小小', '爱丽丝', '黑弦月', '喵喵', '林樱', '巨像之脑']) fixedNonRomantic.add(name);
contract.required.non_romantic_characters = [...fixedNonRomantic];
contract.required.romance_open_characters = contract.required.romance_open_characters.filter(name => !fixedNonRomantic.has(name));
contract.required.evil_locked_characters = [...new Set([...contract.required.evil_locked_characters, ...fixedNonRomantic])];

const routeAdds = {
  左左: ['E137','E139','E140','E158','E167','E168','E169','E170'],
  小小: ['E127','E129','E130','E134'],
  爱丽丝: ['E135'],
  白逸: ['E148','E156','E160','E161','E162','E163','E164','E165','E166'],
  泰坦头颅: ['E129','E134','E145','E146'],
  巫神头颅: ['E129','E130','E131','E133','E135'],
  倒吊天使: ['E142','E145','E146','E147','E148','E154','E155'],
  渡鸦: ['E155'],
  猪头屠夫: ['E147','E153','E154'],
  黑白小丑: ['E153','E154'],
  黑弦月: ['E135'],
  喵喵: ['E135','E136'],
  艾雯爵士: ['E127','E131','E132','E133','E134','E141','E157','E158','E162'],
  羽毛笔: ['E143','E144','E145','E147','E149','E150','E151','E152','E153','E159'],
  a01银色幻想: ['E134'],
  欲望母树: ['E127','E128','E129','E131','E132','E133'],
  万机之神: ['E127','E129','E131','E132','E133','E134'],
  巨像之脑: ['E127','E131','E132','E133','E134','E137','E138','E139','E140','E141','E145','E146','E148','E153','E154','E158','E167','E168','E169','E170'],
  血肉支配者: ['E127','E128','E129'],
};
for (const [name, additions] of Object.entries(routeAdds)) {
  contract.required.character_event_ids[name] = [...new Set([...(contract.required.character_event_ids[name] ?? []), ...additions])]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}
contract.acceptance = {
  required_checks: 'npm run check',
  worldbook_entries: 'validate时由源码与打包产物实际派生',
  event_anchors: 170,
  stage_scope: 'S0至S24；E01至E170',
  terminal_hook_event: 'E170',
  bridge_pairs_count: 169,
  age_sync: '林恩18岁全链一致',
  source_boundary: '原著止于863；不得泄漏后续',
  runtime_status: 'pending，真实宿主需所有者另行授权',
};

// Worldbook 新事件素材与人物路由。
const book = await readJson('src/worldbook.json');
book.name = '《诡异药剂师》v0.10';
book.description = '《诡异药剂师》E01至E170世界书；二十七名核心人物、一百七十事件与扩充概念按事件状态和关键词加载。';
book.extensions.tavernweave.version = '0.10.0';
book.entries = book.entries.filter(entry => !(entry.id >= 826 && entry.id <= 869));
for (const event of events.filter(event => event.number >= 127)) {
  const id = 700 + event.number - 1;
  book.entries.push({
    id,
    comment: `[事件]${event.id}·${event.title}`,
    keys: [event.id, `事件${event.id}`, event.title],
    secondary_keys: [],
    constant: false,
    enabled: false,
    insertion_order: id,
    content_file: `src/events/${event.name}`,
    extensions: { exclude_recursion: true, prevent_recursion: true },
  });
}
for (const [name, eventIds] of Object.entries(contract.required.character_event_ids)) {
  const entry = book.entries.find(item => item.comment === `[角色]${name}`);
  if (!entry) throw new Error(`缺少人物世界书条目：${name}`);
  entry.extensions ??= {};
  entry.extensions.tavernweave ??= {};
  entry.extensions.tavernweave.event_ids = eventIds;
}
book.entries.sort((a, b) => a.insertion_order - b.insertion_order || a.id - b.id);
contract.required.worldbook_entry_count = book.entries.length;
await writeJson('src/worldbook.json', book);
await writeJson('contract.json', contract);

// 概念/人物路由事件序列与静态回退同步。
let router = await readText('src/prompts/concept_event_router.md');
router = router.replace(/const eventSequence = \[[^;]+\];/, `const eventSequence = ${JSON.stringify(events.map(event => event.id))};`);
const fallbackLines = Object.entries(contract.required.character_event_ids).map(([name, eventIds]) => {
  const uid = contract.required.character_entry_ids[name];
  return `    [${uid},${JSON.stringify(eventIds)}],`;
}).join('\n');
router = replaceBetween(router, '  // CHARACTER_EVENT_FALLBACK_START', '  // CHARACTER_EVENT_FALLBACK_END', `  // CHARACTER_EVENT_FALLBACK_START\n  const characterEventFallback = new Map([\n${fallbackLines}\n  ]);\n`, 'character fallback');
await writeText('src/prompts/concept_event_router.md', router);

// 常驻调度：扩阶段、上下文摘要和E126之后桥段。
let mainline = await readText('src/prompts/mainline.md');
mainline = mainline.replace('## 十八个宽阶段', '## 二十五个宽阶段');
if (!mainline.includes('- S18·六根源战场与机械狂潮期')) {
  const phaseText = [
    '- S18·六根源战场与机械狂潮期：诅咒加深、第一绑定、泰坦追猎、巫神复苏、机械狂潮与夺舰。',
    '- S19·战后撤离与巨像余波期：万机退场、银色幻想意识上传、兄长永别、纳米族群与巨像罪疚。',
    '- S20·王后谈判与堕天使危机期：左左独立、神殿掩埋、心灵深渊、羽毛笔禁忌与八音盒。',
    '- S21·主母复苏与羽毛笔真身期：救回主母、地狱反噬、蓝星考核、002认知空间与真身接纳。',
    '- S22·命运权柄与地狱通牒期：命运规则神、生死反转、七日通牒、主母前史与跨界规避方案。',
    '- S23·命运契约与蓝星召唤期：107世界咒式、命运契约、蓝星恶灵灾变、召唤失败与部分降临。',
    '- S24·蓝星救援与双生子悬崖期：镇压恶灵、尹依交易、夜医学徒、自毁争执、越界后果与餐刀悬崖。',
  ].join('\n');
  mainline = mainline.replace('\n## 调度规则', `\n${phaseText}\n\n## 调度规则`);
}
mainline = mainline.replace(/1\. 一百二十六个事件锚点[^\n]*/, '1. 一百七十个事件锚点依次记录为E01至E170。时间线纯事件驱动，不记录日历；后续锚点按局部因果与替代入口解锁。');
mainline = mainline.replace(/9\. 系统任务链[^\n]*/, '9. 系统任务链从药店与夜医成长延伸至根源战争、命运权柄、地狱通牒与跨世界救援；它是宏观因果引导而非锁链。');
mainline = mainline.replace(/10\. E126[^\n]*|10\. E170[^\n]*/, '10. E170是当前开放终点：左左质问后巨像之脑持餐刀逼近，结果未知；地狱凝视约剩三日，跨世界规避尚未最终验证。');
mainline = mainline.replace(/11\. 衔接优先[^\n]*/, '11. 衔接优先：完成或变形的前件满足后件局部前置时使用对应引子；取消态只提供依赖判定，禁止机械推进。E64仍是旧版余韵钩子，E64至E65以前件E63判断。所有衔接只推进环境、系统与NPC，需要林恩决定时停笔。');
if (!mainline.match(/\{ id: 'E127'/)) {
  const ctxLines = events.filter(event => event.number >= 127).map(event => {
    const impact = field(event.content, '结果影响').replace(/[`']/g, '').slice(0, 110);
    return `  { id: '${event.id}', title: '${jsString(event.title)}', line: '${jsString(impact)}' },`;
  }).join('\n');
  const ctxStart = mainline.indexOf('const ctx = [');
  const ctxEnd = mainline.indexOf('\n];', ctxStart);
  if (ctxStart < 0 || ctxEnd < 0) throw new Error('mainline ctx边界缺失');
  mainline = `${mainline.slice(0, ctxEnd)}\n${ctxLines}${mainline.slice(ctxEnd)}`;
}

// E126正式接入E127。
let e126 = eventById.get('E126').content;
e126 = e126.replace(/## 下一事件引入（E127·[^\n]+\）[\s\S]*?(?=\n<%_ \} _%>)/,
`## 下一事件引入（E127·六根源僵局与诅咒全面加深）\n- 触发时机：E126形成结果后，敌对三根源开始合围或任一方尝试撤离时。\n- 剧情引子：六方威压尚未散去，血肉支配者的眼球已转向每个参与者体内最深的旧诅咒。\n- 预兆写法：只写旧诅咒同步复燃、母树根系逼近与撤离走廊收窄，不提前公开第一绑定秘密。\n- 承接因果：对峙没有结束战争；血肉支配者准备以狱卒权柄打破僵局。`);
await writeText(`src/events/${eventById.get('E126').name}`, e126);
eventById.get('E126').content = e126;

const generatedBridgeHeading = mainline.indexOf('### E126→E127');
const generatedBridgeStart = generatedBridgeHeading >= 0
  ? mainline.lastIndexOf('<%_', generatedBridgeHeading)
  : -1;
if (generatedBridgeStart >= 0) mainline = mainline.slice(0, generatedBridgeStart).trim();
{
  const bridgeBlocks = [];
  for (let number = 126; number <= 169; number += 1) {
    const from = eventById.get(`E${number}`);
    const to = eventById.get(`E${number + 1}`);
    const bridge = from.content.match(/## 下一事件引入（([^\n]+)）\n([\s\S]*?)(?=\n<%_ \} _%>)/);
    if (!bridge) throw new Error(`${from.id} 缺少下一事件引入`);
    bridgeBlocks.push(`<%_ const v10b${number}FromState = getvar("stat_data.事件.锚点状态.E${number}.状态", { defaults: "未触发" }); const v10b${number}FromEnd = getvar("stat_data.事件.锚点状态.E${number}.收尾", { defaults: false }); const v10b${number}ToState = getvar("stat_data.事件.锚点状态.E${number + 1}.状态", { defaults: "未触发" }); if ((v10b${number}FromState === "完成" || v10b${number}FromState === "变形" || (v10b${number}FromState === "活跃" && v10b${number}FromEnd === true)) && (v10b${number}ToState === "未触发" || v10b${number}ToState === "预兆")) { _%>\n### E${number}→E${number + 1} · ${from.title} → ${to.title}\n${bridge[2].trim()}\n<%_ } _%>`);
  }
  mainline = `${mainline.trim()}\n\n${bridgeBlocks.join('\n\n')}\n`;
}
await writeText('src/prompts/mainline.md', mainline);

// 状态栏桥：保留旧桥并重建E126→E170；E170无推进按钮。
const oldStatusBridgeStart = status.indexOf("        { from: 'E126', to: 'E127'");
if (oldStatusBridgeStart >= 0) {
  const oldStatusBridgeLast = status.indexOf("        { from: 'E169', to: 'E170'", oldStatusBridgeStart);
  if (oldStatusBridgeLast < 0) throw new Error('status v0.10桥尾缺失');
  const oldStatusBridgeEnd = status.indexOf('\n', oldStatusBridgeLast);
  status = `${status.slice(0, oldStatusBridgeStart)}${status.slice(oldStatusBridgeEnd + 1)}`;
}
{
  const additions = [];
  for (let number = 126; number <= 169; number += 1) {
    const from = eventById.get(`E${number}`);
    const to = eventById.get(`E${number + 1}`);
    const bridge = from.content.match(/## 下一事件引入（([^\n]+)）\n([\s\S]*?)(?=\n<%_ \} _%>)/)?.[2] ?? '';
    const direction = bridge.match(/^- 剧情引子：(.+)$/m)?.[1] ?? `通往${to.title}的因果开始形成`;
    additions.push(`        { from: '${from.id}', to: '${to.id}', title: '${jsString(to.title)}', dir: '${jsString(direction)}', loc: '${jsString(field(to.content, '地点'))}', urgency: '${jsString(field(to.content, '紧迫度').split(/[；，]/)[0] || '中')}', deadline: '按局部因果' },`);
  }
  const arrayStart = status.indexOf('      const BRIDGE_PAIRS = [');
  const arrayEnd = status.indexOf('\n      ];', arrayStart);
  if (arrayStart < 0 || arrayEnd < 0) throw new Error('status BRIDGE_PAIRS边界缺失');
  status = `${status.slice(0, arrayEnd)}\n${additions.join('\n')}${status.slice(arrayEnd)}`;
}
await writeText('src/ui/status.html', status);

console.log(JSON.stringify({
  status: 'synced-v0.10-events',
  events: events.length,
  new_events: 44,
  worldbook_entries: book.entries.length,
  material_end: 869,
  terminal: 'E170',
}, null, 2));
