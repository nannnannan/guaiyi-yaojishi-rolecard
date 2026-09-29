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
const expectedIds = Array.from({ length: 218 }, (_, index) => `E${String(index + 1).padStart(2, '0')}`);
if (JSON.stringify(events.map(event => event.id)) !== JSON.stringify(expectedIds)) {
  throw new Error(`事件文件必须连续覆盖E01-E218，实际${events.length}条`);
}
const eventById = new Map(events.map(event => [event.id, event]));

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

function syncInitialState(state) {
  state.元数据 = { 卡名: '《诡异药剂师》v0.11', 版本: '0.11.0' };
  state.林恩.年龄 = 18;
  const priorAnchors = state.事件.锚点状态;
  state.事件.锚点状态 = Object.fromEntries(events.map(event => [event.id, {
    标题: event.title,
    状态: priorAnchors[event.id]?.状态 ?? '未触发',
    收尾: priorAnchors[event.id]?.收尾 ?? false,
  }]));
  for (const [name, boundary] of Object.entries(safetyBoundaries)) {
    if (state.关系[name]) state.关系[name].边界 = boundary;
  }
  for (const name of ['小小', '爱丽丝', '黑弦月', '喵喵', '林樱', '巨像之脑']) {
    for (const key of ['吸引', '涩涩度', '恶堕']) state.关系[name][key] = 0;
  }
  return state;
}

const initial = syncInitialState(await readJson('src/initial_variables.json'));
await writeJson('src/initial_variables.json', initial);
const alternateInitial = syncInitialState(await readJson('src/initial_variables_e25.json'));
await writeJson('src/initial_variables_e25.json', alternateInitial);

const initialJson = JSON.stringify(initial, null, 2);
let firstMessage = await readText('src/prompts/first_message.md');
firstMessage = firstMessage.replace(/<initvar>\s*[\s\S]*?\s*<\/initvar>/, `<initvar>\n${initialJson}\n</initvar>`);
firstMessage = firstMessage.replaceAll('《诡异药剂师》v0.10', '《诡异药剂师》v0.11').replaceAll('0.10.0', '0.11.0');
await writeText('src/prompts/first_message.md', firstMessage);

const alternateJson = JSON.stringify(alternateInitial, null, 2);
let alternateGreeting = await readText('src/prompts/alternate_greeting_e25.md');
alternateGreeting = alternateGreeting.replace(/<initvar>\s*[\s\S]*?\s*<\/initvar>/, `<initvar>\n${alternateJson}\n</initvar>`);
alternateGreeting = alternateGreeting.replaceAll('《诡异药剂师》v0.10', '《诡异药剂师》v0.11').replaceAll('0.10.0', '0.11.0');
await writeText('src/prompts/alternate_greeting_e25.md', alternateGreeting);

let status = await readText('src/ui/status.html');
status = status.replace(/const FALLBACK_STATE = \{[\s\S]*?\}\s*;\s*let mvuAvailable/, `const FALLBACK_STATE = ${initialJson}\n;\n      let mvuAvailable`);
status = status.replaceAll('《诡异药剂师》v0.10', '《诡异药剂师》v0.11').replaceAll('0.10.0', '0.11.0');

let schema = await readText('src/scripts/schema.js');
if (!schema.includes("S25: '咒瞳异变与蓝星召唤追查'")) {
  schema = schema.replace(
    "  S24: '蓝星救援与双生子悬崖期',\n};",
    [
      "  S24: '蓝星救援与双生子悬崖期',",
      "  S25: '咒瞳异变与蓝星召唤追查',",
      "  S26: '蓝星寄生危机与血肉运输拦截期',",
      "  S27: '离魂街与游魂巷反血肉据点清剿期',",
      "  S28: '蓝星返乡与根源保护冲突期',",
      "  S29: '跨界倒计时与返乡争夺',",
      "  S30: '蜀都寄生虫追查期',",
      "  S31: '蜀都封城与使徒对峙期',",
      '};',
    ].join('\n'),
  );
}
const titleLines = events.map(event => `  ${event.id}: '${jsString(event.title)}',`).join('\n');
schema = replaceBetween(schema, 'const anchorTitles = {', '\n};\n\nconst eventIds', `const anchorTitles = {\n${titleLines}`, 'schema anchorTitles');
const anchorLines = events.map(event => `      ${event.id}: anchor,`).join('\n');
schema = replaceBetween(schema, '    锚点状态: z.object({', '\n    }),\n    唯一活跃事件:', `    锚点状态: z.object({\n${anchorLines}`, 'schema anchors');
await writeText('src/scripts/schema.js', schema);

const contract = await readJson('contract.json');
contract.version = '0.11.0';
contract.required.stage_scope = 'E01至E218；本版新增E171至E218，止于七使徒包围与六人开始攻击的未决悬崖';
contract.required.event_ids = events.map(event => event.id);
contract.required.event_titles = Object.fromEntries(events.map(event => [event.id, event.title]));
Object.assign(contract.required.stage_ranges, {
  S25: events.filter(e => e.number >= 171 && e.number <= 178).map(e => e.id),
  S26: events.filter(e => e.number >= 179 && e.number <= 186).map(e => e.id),
  S27: events.filter(e => e.number >= 187 && e.number <= 194).map(e => e.id),
  S28: events.filter(e => e.number >= 195 && e.number <= 202).map(e => e.id),
  S29: events.filter(e => e.number >= 203 && e.number <= 210).map(e => e.id),
  S30: events.filter(e => e.number >= 211 && e.number <= 214).map(e => e.id),
  S31: events.filter(e => e.number >= 215 && e.number <= 218).map(e => e.id),
});
for (const event of events.filter(event => event.number >= 171)) {
  contract.required.event_dependencies[event.id] = {
    hard_all: [event.number === 171 ? 'E170' : `E${event.number - 1}`],
    hard_any: [],
    independent_fallback: '前件取消时检查本事件的局部前置与替代入口；不得机械推进或整链取消',
  };
}
contract.required.worldbook_version = '0.11.0';
contract.required.event_context_windows.material_entry_end = 917;
contract.required.terminal_hook_event = 'E218';

const routeAdds = {
  左左: ['E171','E173','E175','E180','E181','E182','E184','E185','E186','E187','E190','E191','E192','E193','E198','E200','E201','E202','E203','E204','E207','E208','E209','E210','E211','E212','E213','E214','E215','E216','E217','E218'],
  血锯: ['E179','E191','E192','E193','E194'],
  血衣女士: ['E176','E194','E198','E199'],
  小小: ['E195'],
  爱丽丝: ['E177','E178','E179','E180'],
  白逸: ['E200','E201','E202','E203','E204','E205','E206'],
  泰坦头颅: ['E172','E173','E181','E195','E199','E200','E203','E204','E205','E206'],
  巫神头颅: ['E172','E173','E181','E195','E199','E200','E203','E204','E205','E206'],
  白夜: ['E189','E190','E194','E195','E196','E197','E198','E199','E200'],
  哭泣小丑: ['E202'],
  艾雯爵士: ['E171','E172','E173','E174','E195','E199','E200','E203','E204','E205','E206'],
  羽毛笔: ['E201','E202','E205','E206'],
  欲望母树: ['E172','E174','E181','E195','E199','E200','E202','E203','E204','E205','E206'],
  巨像之脑: ['E171','E172','E173','E174','E195','E196','E199','E200','E203','E204','E205','E206'],
};
for (const [name, additions] of Object.entries(routeAdds)) {
  contract.required.character_event_ids[name] = [...new Set([...(contract.required.character_event_ids[name] ?? []), ...additions])]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}
contract.acceptance = {
  required_checks: 'npm run check',
  worldbook_entries: 'validate时由源码与打包产物实际派生',
  event_anchors: 218,
  stage_scope: 'S0至S31；E01至E218',
  terminal_hook_event: 'E218',
  bridge_pairs_count: 217,
  age_sync: '林恩18岁全链一致',
  source_boundary: '原著止于1015；第926章源文缺失；不得读取或泄漏后续',
  runtime_status: 'pending，真实宿主需所有者另行授权',
};

const book = await readJson('src/worldbook.json');
book.name = '《诡异药剂师》v0.11';
book.description = '《诡异药剂师》E01至E218世界书；二十八名核心人物、二百一十八事件与扩充概念按事件状态和关键词加载。';
book.extensions.tavernweave.version = '0.11.0';
book.entries = book.entries.filter(entry => !(entry.id >= 870 && entry.id <= 917));
for (const event of events.filter(event => event.number >= 171)) {
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
book.entries.sort((a, b) => (a.insertion_order ?? a.id) - (b.insertion_order ?? b.id) || a.id - b.id);
contract.required.worldbook_entry_count = book.entries.length;
await writeJson('src/worldbook.json', book);
await writeJson('contract.json', contract);

let router = await readText('src/prompts/concept_event_router.md');
router = router.replace(/const eventSequence = \[[^;]+\];/, `const eventSequence = ${JSON.stringify(events.map(event => event.id))};`);
const fallbackLines = Object.entries(contract.required.character_event_ids).map(([name, eventIds]) => {
  const uid = contract.required.character_entry_ids[name];
  return `    [${uid},${JSON.stringify(eventIds)}],`;
}).join('\n');
router = replaceBetween(router, '  // CHARACTER_EVENT_FALLBACK_START', '  // CHARACTER_EVENT_FALLBACK_END', `  // CHARACTER_EVENT_FALLBACK_START\n  const characterEventFallback = new Map([\n${fallbackLines}\n  ]);\n`, 'character fallback');
await writeText('src/prompts/concept_event_router.md', router);

let mainline = await readText('src/prompts/mainline.md');
mainline = mainline.replace('## 二十五个宽阶段', '## 三十二个宽阶段');
if (!mainline.includes('- S25·咒瞳异变与蓝星召唤追查')) {
  const phaseText = [
    '- S25·咒瞳异变与蓝星召唤追查：餐刀核查、咒瞳魔改、意识交易、夜医培训与古堡冷库线索。',
    '- S26·蓝星寄生危机与血肉运输拦截期：旧日疑报、双重污染、爬行者运输、寄生催熟与控制腔对峙。',
    '- S27·离魂街与游魂巷反血肉据点清剿期：样本接管、钟塔裂隙、白夜汇合、药店占领与人质线索。',
    '- S28·蓝星返乡与根源保护冲突期：根源法阵、鬼婴救援、血衣证言、返乡必要性、白逸失联与神性疑云。',
    '- S29·跨界倒计时与返乡争夺：强制召唤、羽毛笔停战、蓝星双召唤、西南祭场救援、群体急救与虫灾首战。',
    '- S30·蜀都寄生虫追查期：公路截车、废水工厂、灵肉绑定、一个月休眠缓冲与停车场临时基地。',
    '- S31·蜀都封城与使徒对峙期：全城迷雾、封城争议、医院救援、执念样本与七使徒未决围攻。',
  ].join('\n');
  mainline = mainline.replace('\n## 调度规则', `\n${phaseText}\n\n## 调度规则`);
}
mainline = mainline.replace(/1\. 一百七十个事件锚点[^\n]*/, '1. 二百一十八个事件锚点依次记录为E01至E218。时间线纯事件驱动，不记录日历；后续锚点按局部因果与替代入口解锁。');
mainline = mainline.replace(/9\. 系统任务链[^\n]*/, '9. 系统任务链从药店与夜医成长延伸至根源战争、命运权柄、跨世界救援、蓝星寄生虫灾与隐修会冲突；它是宏观因果引导而非锁链。');
mainline = mainline.replace(/10\. E170[^\n]*/, '10. E218是当前开放终点：七使徒完成包围、其余六名使徒已经开始攻击；林恩是否开启咒瞳只由玩家决定，任何攻击结果、伤亡、突围与胜负未知。');
if (!mainline.match(/\{ id: 'E171'/)) {
  const ctxLines = events.filter(event => event.number >= 171).map(event => {
    const impact = field(event.content, '结果影响').replace(/[`']/g, '').slice(0, 110);
    return `  { id: '${event.id}', title: '${jsString(event.title)}', line: '${jsString(impact)}' },`;
  }).join('\n');
  const ctxStart = mainline.indexOf('const ctx = [');
  const ctxEnd = mainline.indexOf('\n];', ctxStart);
  if (ctxStart < 0 || ctxEnd < 0) throw new Error('mainline ctx边界缺失');
  mainline = `${mainline.slice(0, ctxEnd)}\n${ctxLines}${mainline.slice(ctxEnd)}`;
}

let e170 = eventById.get('E170').content;
e170 = e170.replace(/## 下一事件引入（未知悬崖）[\s\S]*?(?=\n<%_ \} _%>)/,
`## 下一事件引入（E171·餐刀危机的降温与事实核查）
- 触发时机：E170形成结果后，刀锋尚未落下，现场出现拉开距离、移除锐器、呼叫第三方或核对事实的可执行窗口。
- 剧情引子：餐刀仍在危险距离内，左左与巨像之脑都没有义务立刻原谅；安全人员首先要求后撤、隔离锐器并分别记录记忆缺口。
- 预兆写法：只写危险降温、当事人拒绝权、独立证词与医疗见证，不提前宣布和解、伤害程度或责任结论。
- 承接因果：E170的未决暴力风险必须先转为安全隔离与事实核查，之后才可能讨论道歉、问责、分开居住或技术协作。`);
await writeText(`src/events/${eventById.get('E170').name}`, e170);
eventById.get('E170').content = e170;

const generatedBridgeHeading = mainline.indexOf('### E126→E127');
const generatedBridgeStart = generatedBridgeHeading >= 0 ? mainline.lastIndexOf('<%_', generatedBridgeHeading) : -1;
if (generatedBridgeStart >= 0) mainline = mainline.slice(0, generatedBridgeStart).trim();
{
  const bridgeBlocks = [];
  for (let number = 126; number <= 217; number += 1) {
    const from = eventById.get(`E${number}`);
    const to = eventById.get(`E${number + 1}`);
    const bridge = from.content.match(/## 下一事件引入（([^\n]+)）\n([\s\S]*?)(?=\n<%_ \} _%>)/);
    if (!bridge) throw new Error(`${from.id} 缺少下一事件引入`);
    bridgeBlocks.push(`<%_ const v11b${number}FromState = getvar("stat_data.事件.锚点状态.E${number}.状态", { defaults: "未触发" }); const v11b${number}FromEnd = getvar("stat_data.事件.锚点状态.E${number}.收尾", { defaults: false }); const v11b${number}ToState = getvar("stat_data.事件.锚点状态.E${number + 1}.状态", { defaults: "未触发" }); if ((v11b${number}FromState === "完成" || v11b${number}FromState === "变形" || (v11b${number}FromState === "活跃" && v11b${number}FromEnd === true)) && (v11b${number}ToState === "未触发" || v11b${number}ToState === "预兆")) { _%>\n### E${number}→E${number + 1} · ${from.title} → ${to.title}\n${bridge[2].trim()}\n<%_ } _%>`);
  }
  mainline = `${mainline.trim()}\n\n${bridgeBlocks.join('\n\n')}\n`;
}
await writeText('src/prompts/mainline.md', mainline);

const oldStatusBridgeStart = status.indexOf("        { from: 'E126', to: 'E127'");
if (oldStatusBridgeStart >= 0) {
  const oldStatusBridgeLast = status.indexOf("        { from: 'E169', to: 'E170'", oldStatusBridgeStart);
  if (oldStatusBridgeLast < 0) throw new Error('status v0.10桥尾缺失');
  const oldStatusBridgeEnd = status.indexOf('\n', oldStatusBridgeLast);
  status = `${status.slice(0, oldStatusBridgeStart)}${status.slice(oldStatusBridgeEnd + 1)}`;
}
{
  const additions = [];
  for (let number = 126; number <= 217; number += 1) {
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
  status: 'synced-v0.11-events',
  events: events.length,
  new_events: 48,
  worldbook_entries: book.entries.length,
  material_end: 917,
  terminal: 'E218',
}, null, 2));
