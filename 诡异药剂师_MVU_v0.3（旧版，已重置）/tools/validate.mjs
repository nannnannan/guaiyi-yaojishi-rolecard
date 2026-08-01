import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;

function ok(condition, message) {
  checks += 1;
  if (!condition) throw new Error(`验证失败：${message}`);
}

function sourcePath(relativePath) {
  ok(typeof relativePath === 'string' && relativePath.trim() && !isAbsolute(relativePath), `安全相对路径：${String(relativePath)}`);
  const fullPath = resolve(projectRoot, relativePath);
  const rel = relative(projectRoot, fullPath);
  ok(!rel.startsWith('..') && !isAbsolute(rel), `路径未越出工程：${relativePath}`);
  return fullPath;
}

async function readText(relativePath, trim = true) {
  const text = await readFile(sourcePath(relativePath), 'utf8');
  ok(!text.includes('\uFFFD'), `${relativePath} 不含UTF-8替换字符`);
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return trim ? normalized.trim() : normalized;
}

async function readJson(relativePath) {
  const parsed = JSON.parse(await readText(relativePath));
  ok(parsed !== null && typeof parsed === 'object', `${relativePath} 是JSON对象或数组`);
  return parsed;
}

async function listFiles(relativeDir) {
  const result = [];
  async function walk(current) {
    for (const entry of await readdir(sourcePath(current), { withFileTypes: true })) {
      const child = `${current}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else result.push(child);
    }
  }
  await walk(relativeDir);
  return result;
}

function exactKeys(object, expected, label) {
  const actual = Object.keys(object).sort();
  const wanted = [...expected].sort();
  ok(JSON.stringify(actual) === JSON.stringify(wanted), `${label}字段精确匹配`);
}

function collectKeys(value, output = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, output);
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    output.push(key);
    collectKeys(child, output);
  }
  return output;
}

function assertSingleActive(stateTable, activeEvent) {
  const active = Object.entries(stateTable).filter(([, value]) => ['活跃', '变形'].includes(value.状态));
  if (activeEvent.状态 === '无') return active.length === 0 && activeEvent.事件ID === '';
  return active.length === 1 && active[0][0] === activeEvent.事件ID;
}

async function expectedEntryContent(entry) {
  if (entry.content_json_file) return JSON.stringify(await readJson(entry.content_json_file), null, 2);
  if (entry.content_files) return (await Promise.all(entry.content_files.map(file => readText(file)))).join('\n\n');
  if (entry.content_file) return readText(entry.content_file);
  return entry.content ?? '';
}

const manifest = await readJson('manifest.json');
const [profile, contract, hostAcceptance, cardSource, sourceBook, initial, helperSource, regexSource] = await Promise.all([
  readJson('profile.json'),
  readJson('contract.json'),
  readJson(manifest.host_acceptance),
  readJson('src/card.json'),
  readJson('src/worldbook.json'),
  readJson('src/initial_variables.json'),
  readJson('src/tavern_helper_scripts.json'),
  readJson('src/regex_scripts.json'),
]);

ok(manifest.version === '0.3.0', 'manifest版本为0.3.0');
ok(profile.version === manifest.version, 'profile版本同步');
ok(contract.version === manifest.version, 'contract版本同步');
ok(cardSource.character_version === manifest.version, '角色卡版本同步');
ok(manifest.worldbook.version === manifest.version, '世界书版本同步');
ok(manifest.card.stable_id === 'weird-apothecary-blood-saw-shop', '卡片稳定ID保持不变');
ok(manifest.worldbook.stable_id === 'weird-apothecary-worldbook', '世界书稳定ID保持不变');
ok(manifest.packed_json === 'dist/诡异药剂师_v0.3.json', '产物文件名正确');
ok(cardSource.name === '《诡异药剂师》v0.3', '显示名正确');
ok(profile.ui_variant === 'death_realm_three_page', '三页死界UI配置正确');
ok(profile.update_protocol === 'UpdateVariable.JSONPatch', '更新协议正确');
ok(contract.required.internal_before_v1 === true, 'v1.0前内部版本已声明');
ok(contract.required.stage_scope === '第1至149章', '阶段范围已声明');
ok(hostAcceptance.version === manifest.version, '真实宿主验收记录版本同步');
ok(hostAcceptance.status === 'accepted-release', '所有者已确认真实宿主验收');
ok(hostAcceptance.artifact === manifest.packed_json, '宿主验收记录指向当前产物');

const packedText = await readText(manifest.packed_json, false);
const packed = JSON.parse(packedText);
ok(packed.spec === 'chara_card_v3', '角色卡规范为chara_card_v3');
ok(packed.spec_version === '3.0', '角色卡规范版本为3.0');
ok(packed.data?.name === cardSource.name, 'data显示名正确');
ok(packed.data?.character_version === '0.3.0', 'data版本正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.id === manifest.worldbook.stable_id, '打包世界书稳定ID正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.version === '0.3.0', '打包世界书版本正确');

for (const field of [
  'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes',
  'system_prompt', 'post_history_instructions', 'alternate_greetings', 'tags', 'creator',
  'character_version', 'extensions',
]) {
  ok(JSON.stringify(packed[field]) === JSON.stringify(packed.data[field]), `顶层与data镜像：${field}`);
}

ok(!packedText.includes('"character_version": "0.2.0"'), '产物不残留旧角色卡版本面');
ok(!packedText.includes('《诡异药剂师：血锯药剂店》v0.2'), '产物不残留旧显示名');
ok(!packedText.includes('\uFFFD'), '产物不含UTF-8替换字符');

const packedBook = packed.data.character_book;
ok(packedBook.name === sourceBook.name, '打包世界书名称与源码一致');
ok(packedBook.description === sourceBook.description, '打包世界书描述与源码一致');
ok(packedBook.entries.length === sourceBook.entries.length, '打包世界书条目数与源码一致');
ok(packedBook.entries.length === 50, '世界书包含50条维护条目');

const sourceIds = sourceBook.entries.map(entry => entry.id);
ok(new Set(sourceIds).size === sourceIds.length, '源码条目ID唯一');
const packedIds = packedBook.entries.map(entry => entry.id);
ok(new Set(packedIds).size === packedIds.length, '打包条目ID唯一');

for (const sourceEntry of sourceBook.entries) {
  ok(sourceEntry.extensions?.exclude_recursion === true, `${sourceEntry.comment}源码开启exclude_recursion`);
  ok(sourceEntry.extensions?.prevent_recursion === true, `${sourceEntry.comment}源码开启prevent_recursion`);
  const packedEntry = packedBook.entries.find(entry => entry.id === sourceEntry.id);
  ok(Boolean(packedEntry), `${sourceEntry.comment}已打包`);
  ok(packedEntry.extensions?.exclude_recursion === true, `${sourceEntry.comment}打包开启exclude_recursion`);
  ok(packedEntry.extensions?.prevent_recursion === true, `${sourceEntry.comment}打包开启prevent_recursion`);
  ok(packedEntry.extensions?.delay_until_recursion === false, `${sourceEntry.comment}未开启延迟递归`);
  ok(packedEntry.content === await expectedEntryContent(sourceEntry), `${sourceEntry.comment}源码与打包内容一致`);
}

const characters = contract.required.core_characters;
const components = contract.required.component_matrix;
ok(characters.length === 10, '十名主要角色');
ok(components.length === 6, '每名角色六个组件');

const componentFiles = {
  角色速览: '角色速览.md',
  基础信息: '基础信息.md',
  性格调色盘: '性格调色盘.md',
  三面性: '三面性.md',
  多阶段人设: '多阶段人设.md',
  二次解释: '二次解释.md',
};

for (const [index, character] of characters.entries()) {
  const entry = sourceBook.entries.find(item => item.comment === `[角色]${character}`);
  ok(Boolean(entry), `${character}有运行时角色词条`);
  ok(entry.id === 100 + index * 10, `${character}运行时ID顺序固定`);
  ok(entry.constant === false, `${character}是姓名蓝灯而非常驻`);
  ok(entry.keys.includes(character), `${character}姓名是触发关键词`);
  ok(entry.content_files?.length === 6, `${character}运行时合并六个组件`);
  for (const component of components) {
    const path = `src/characters/${character}/${componentFiles[component]}`;
    const content = await readText(path);
    ok(content.length >= 80, `${character}/${component}内容充足`);
    ok(entry.content_files.includes(path), `${character}/${component}进入运行时合并`);
  }
  const runtimeEntry = packedBook.entries.find(item => item.id === entry.id);
  ok(runtimeEntry.content === await expectedEntryContent(entry), `${character}合并结果精确一致`);
}

for (const character of contract.required.non_romantic_characters) {
  ok(initial.关系[character].吸引 === 0, `${character}初始吸引为0`);
  ok(initial.关系[character].边界.includes('非恋爱') || initial.关系[character].边界.includes('非成人'), `${character}非恋爱边界可见`);
}

const stageFactRequirements = {
  泰坦头颅: ['小小的父亲', '15%', '复杂认可', '结拜', '清醒'],
  巫神头颅: ['小小的母亲', '自我催眠', '心灵契约', '试探', '认可'],
  小宝贝: ['巨像部件', '巨型舌头', '血肉傀儡'],
  小小: ['泰坦头颅', '巫神头颅', '金发碧眼', '心灵契约', '固定非恋爱'],
};
for (const [character, tokens] of Object.entries(stageFactRequirements)) {
  const runtimeEntry = packedBook.entries.find(item => item.comment === `[角色]${character}`);
  for (const token of tokens) ok(runtimeEntry.content.includes(token), `${character}阶段1资料包含：${token}`);
}

const categoryMap = [
  ['factions', contract.required.factions, '[势力]'],
  ['mechanisms', contract.required.mechanisms, '[机制]'],
  ['locations', contract.required.locations, '[地点]'],
];
for (const [directory, names, prefix] of categoryMap) {
  for (const name of names) {
    const path = `src/${directory}/${name}.md`;
    const content = await readText(path);
    ok(content.length >= 120, `${name}源码存在且内容充足`);
    const entry = sourceBook.entries.find(item => item.comment === `${prefix}${name}`);
    ok(Boolean(entry), `${name}有独立世界书条目`);
    ok(entry.content_file === path, `${name}条目指向正确源码`);
  }
}

const sightEntry = packedBook.entries.find(item => item.comment === '[机制]视界系统').content;
for (const token of ['至高意志', '区域', '频道', '情报交易', '直播', '自动扩容']) {
  ok(sightEntry.includes(token), `视界系统包含阶段1事实：${token}`);
}
const nightDoctorEntry = packedBook.entries.find(item => item.comment === '[势力]夜医').content;
for (const token of ['守序善良', '万物都有病', '制造', '治疗']) {
  ok(nightDoctorEntry.includes(token), `夜医包含阶段1事实：${token}`);
}
const giantEntry = packedBook.entries.find(item => item.comment === '[机制]巨像及血肉机械技术').content;
for (const token of ['三千年前', '血肉与机械', '小宝贝', '巨像部件', '巨像计划']) {
  ok(giantEntry.includes(token), `巨像技术包含阶段1事实：${token}`);
}

const eventFieldMarkers = [
  '- 阶段：', '- 地点：', '- 前置条件：', '- 参与者与动机：', '- 默认走向：',
  '- 紧迫度：', '- 幕后停止点：', '- 变形条件：', '- 结果影响：', '- 系统提示：',
];
for (const [index, eventId] of contract.required.event_ids.entries()) {
  const entry = sourceBook.entries.find(item => item.id === 300 + index);
  ok(Boolean(entry), `${eventId}运行时事件词条存在`);
  ok(entry.comment.startsWith(`[事件]${eventId}·`), `${eventId}条目名称正确`);
  ok(entry.keys.includes(eventId), `${eventId}可由事件ID触发`);
  ok(entry.constant === false, `${eventId}是蓝灯词条`);
  const content = await readText(entry.content_file);
  ok(content.startsWith(`# ${eventId}·`), `${eventId}源码标题正确`);
  for (const marker of eventFieldMarkers) ok(content.includes(marker), `${eventId}包含${marker}`);
}

exactKeys(initial, ['元数据', '世界', '林恩', '事件', '关系', '角色关系', '系统'], 'MVU根');
ok(!Object.prototype.hasOwnProperty.call(initial, '病例'), '已删除病例根');
exactKeys(initial.世界, ['阶段编号', '阶段名称', '模糊阶段进度', '当前场景时间', '地点', '氛围'], '世界');
exactKeys(initial.林恩, ['年龄', '身体状况', '当前身份', '关键诅咒或契约', '当前明确目标', '最近明确指令'], '林恩');
exactKeys(initial.事件, ['锚点状态', '唯一活跃事件', '近期预兆', '最近结果', '阶段总结', '原创重大事件待定队列'], '事件');
ok(initial.林恩.年龄 === 20, '林恩年龄为20');
ok(initial.世界.阶段编号 === 'S0', '初始阶段为S0');
ok(initial.事件.唯一活跃事件.事件ID === 'E01', 'E01是初始唯一活跃事件');
ok(assertSingleActive(initial.事件.锚点状态, initial.事件.唯一活跃事件), '初始重大事件唯一活跃');
ok(initial.事件.近期预兆.事件ID === '', '初始没有未来预兆');
ok(Array.isArray(initial.角色关系) && initial.角色关系.length === 0, '角色关系按需建立而非全矩阵');

const requiredRelationFields = [
  '解锁', '在场', '生存状态', '位置', '处境', '关系类型', '人物阶段', '信任', '亲近',
  '戒备', '吸引', '关系创伤', '可见迹象', '边界', '关键记忆', '最近互动',
];
exactKeys(initial.关系, characters, '十人关系');
for (const character of characters) {
  exactKeys(initial.关系[character], requiredRelationFields, `${character}关系`);
  ok(['活动', '受伤', '失联', '受困', '休眠', '暂离', '敌对'].includes(initial.关系[character].生存状态), `${character}使用受保护生存状态`);
}

for (const [eventId, event] of Object.entries(initial.事件.锚点状态)) {
  ok(contract.required.event_ids.includes(eventId), `${eventId}在固定锚点表`);
  ok(contract.required.event_states.includes(event.状态), `${eventId}使用六态枚举`);
  ok(typeof event.标题 === 'string' && event.标题.length > 0, `${eventId}包含标题`);
}

const schema = await readText('src/scripts/schema.js');
const updateRules = await readText('src/prompts/mvu_update_rules.md');
const outputFormat = await readText('src/prompts/mvu_output_format.md');
for (const root of ['元数据', '世界', '林恩', '事件', '关系', '角色关系', '系统']) {
  ok(schema.includes(`${root}: z.`), `Schema包含${root}根`);
  ok(updateRules.includes(root), `更新规则包含${root}`);
}
ok(!schema.includes('病例:'), 'Schema没有病例根');
ok(schema.includes("z.enum(['未触发', '预兆', '活跃', '变形', '完成', '取消'])"), 'Schema声明事件六态');
ok(schema.includes("z.literal('《诡异药剂师》v0.3')"), 'Schema锁定卡名');
ok(schema.includes("z.literal('0.3.0')"), 'Schema锁定版本');
ok(schema.includes('.superRefine((data, ctx)'), 'Schema使用superRefine校验跨字段不变量');
ok(schema.includes('阶段编号与阶段名称不匹配'), 'Schema校验阶段编号名称配对');
ok(schema.includes('重大事件必须唯一活跃，并与锚点状态一致'), 'Schema真实校验单一活跃事件');
ok(schema.includes('标题必须保持稳定'), 'Schema锁定十二锚点标题');
ok(schema.includes('近期预兆必须指向处于预兆状态的锚点'), 'Schema校验预兆状态一致');
for (const character of characters) ok(schema.includes(`${character}: relationship`), `Schema包含${character}`);
for (const character of contract.required.non_romantic_characters) {
  ok(schema.includes(`${character}: relationship(z.literal(0))`), `Schema锁定${character}吸引为0`);
}
for (const token of ['同时只能有一个', '事件ID', '下一轮', '林恩缺席', '不自行变化', '永久死亡', '原创重大事件待定队列']) {
  ok(updateRules.includes(token), `更新规则包含：${token}`);
}
ok(outputFormat.includes('<UpdateVariable>'), '输出格式包含UpdateVariable');
ok(outputFormat.includes('<JSONPatch>'), '输出格式包含JSONPatch');
ok(outputFormat.includes('[]'), '输出格式支持空更新');

const schemaSyntax = spawnSync(process.execPath, ['--check', sourcePath('src/scripts/schema.js')], { encoding: 'utf8' });
ok(schemaSyntax.status === 0, `Schema脚本语法正确：${schemaSyntax.stderr.trim()}`);
const loaderSyntax = spawnSync(process.execPath, ['--check', sourcePath('src/scripts/mvu_loader.js')], { encoding: 'utf8' });
ok(loaderSyntax.status === 0, `MVU加载器语法正确：${loaderSyntax.stderr.trim()}`);

ok(helperSource.length === 2, '内嵌两条酒馆助手脚本');
ok(regexSource.length === 2, '内嵌两条正则脚本');
for (const script of helperSource) {
  ok(script.enabled === true, `${script.id}已启用`);
  ok(script.id.endsWith('-v0.3'), `${script.id}使用v0.3版本化ID`);
}
for (const script of regexSource) {
  ok(script.disabled === false, `${script.id}已启用`);
  ok(script.id.endsWith('-v0.3'), `${script.id}使用v0.3版本化ID`);
}
const helperPacked = packed.data.extensions.tavern_helper.scripts;
ok(helperPacked.length === helperSource.length, '酒馆助手脚本打包数量一致');
ok(packed.data.extensions.regex_scripts.length === regexSource.length, '正则脚本打包数量一致');

for (const dependency of manifest.runtime_dependencies) {
  ok(typeof dependency.id === 'string' && dependency.id.length > 0, '运行依赖具有ID');
  ok(['host_required', 'embedded_required', 'remote_runtime', 'development_only'].includes(dependency.class), `${dependency.id}依赖类别有效`);
}
const mvuDependency = manifest.runtime_dependencies.find(item => item.id === 'magvarupdate');
const bridgeDependency = manifest.runtime_dependencies.find(item => item.id === 'mvu-zod-bridge');
ok(mvuDependency.ref === 'b42817925d0391c15fa242a8238d2bbe28eb6319', 'MVU固定提交未迁移');
ok(bridgeDependency.ref === '7f29257de3ffbd83d63bc37ca09f4d4ecad6ca0f', 'Zod桥接固定提交未迁移');
ok(!manifest.runtime_dependencies.some(item => /ejs/i.test(item.id)), '没有新增EJS依赖');

const broadKeywords = new Set(['神庙', '情报', '观察者', '传信者', '街坊', '候诊者', '诊断', '治疗', '共生者', '庄园女主人', '地窖生物']);
for (const entry of sourceBook.entries.filter(item => !item.constant)) {
  for (const key of entry.keys ?? []) ok(!broadKeywords.has(key), `${entry.comment}不使用过宽关键词：${key}`);
}

const ui = await readText('src/ui/status.html');
for (const page of contract.required.ui_pages) ok(ui.includes(`>${page}<`), `UI包含${page}页`);
for (const token of [
  'wa-breathe', 'wa-alert', 'prefers-reduced-motion', 'Mvu', 'getMvuData', 'SillyTavern',
  'variables', 'wa-meter', 'wa-person', '唯一活跃事件', '近期预兆', '最近结果',
]) {
  ok(ui.includes(token), `UI包含：${token}`);
}
ok(ui.includes('textContent'), 'UI使用安全文本渲染');
ok(!ui.includes('.innerHTML'), 'UI不使用innerHTML');
ok(!ui.includes('eval('), 'UI不使用eval');
ok(!ui.includes('幕后停止点') && !ui.includes('wa-event-stop'), 'UI不向玩家泄露幕后停止点');
ok(ui.indexOf('const hasContact') < ui.indexOf('body.append(meta, situation)'), '未接触人物不会追加位置、阶段和处境');
ok(ui.includes('ArrowLeft') && ui.includes('ArrowRight') && ui.includes('Home') && ui.includes('End'), '页签支持键盘操作');
const uiScript = ui.match(/<script>([\s\S]*?)<\/script>/)?.[1];
ok(Boolean(uiScript), 'UI包含内嵌脚本');
let uiSyntaxError = '';
try {
  new Function(uiScript);
} catch (error) {
  uiSyntaxError = error.message;
}
ok(!uiSyntaxError, `UI脚本语法正确：${uiSyntaxError}`);

const openingV03 = await readFile(sourcePath('src/prompts/first_message.md'));
const openingV02 = await readFile(resolve(projectRoot, '..', '诡异药剂师_MVU_v0.2', 'src', 'prompts', 'first_message.md'));
ok(openingV03.equals(openingV02), 'v0.3开场与v0.2逐字节一致');
const openingText = openingV03.toString('utf8');
ok(openingText.includes('血娃娃'), '开场病患仍为血娃娃');
ok(openingText.includes('<StatusPlaceHolderImpl/>'), '开场保留状态栏占位符');
ok(openingText.includes('门栓没有自行打开'), '开场没有替林恩开门');
ok(openingText.includes('下一步完整地留给了林恩'), '开场明确保留玩家选择');

const distFiles = await readdir(sourcePath('dist'));
ok(JSON.stringify(distFiles.sort()) === JSON.stringify(['诡异药剂师_v0.3.json']), 'v0.3 dist只保留本版候选产物');

const authoredFiles = (await listFiles('src')).filter(file => /\.(md|json|js|html)$/.test(file));
for (const file of authoredFiles) {
  const content = await readText(file, false);
  ok(!content.includes('\uFFFD'), `${file}编码完整`);
  if (file.endsWith('.md')) {
    ok(!content.includes('——'), `${file}不使用禁用破折号`);
    ok(!content.includes('{{user}}'), `${file}不使用旧user宏`);
  }
}

const forbiddenRootKeys = new Set(['病例', '战斗', '等级', '阶位', '攻击', '防御', '血量', '技能树', '装备', '库存', '货币', '经营']);
const allStateKeys = collectKeys(initial);
for (const key of forbiddenRootKeys) ok(!allStateKeys.includes(key), `变量结构不含禁用字段：${key}`);

ok(assertSingleActive(
  { E01: { 状态: '活跃' }, E02: { 状态: '活跃' } },
  { 事件ID: 'E01', 状态: '活跃' },
) === false, '负向夹具能拒绝双活跃事件');
ok(assertSingleActive(
  { E01: { 状态: '完成' }, E02: { 状态: '未触发' } },
  { 事件ID: '', 状态: '无' },
) === true, '负向夹具允许无活跃事件');
ok(sourceBook.entries.every(entry => entry.extensions?.exclude_recursion && entry.extensions?.prevent_recursion), '递归保护总夹具通过');
ok(characters.every(character => Object.keys(initial.关系).includes(character)), '关系人物覆盖总夹具通过');

const bytes = Buffer.byteLength(packedText);
const sha256 = createHash('sha256').update(packedText).digest('hex');
ok(hostAcceptance.bytes === bytes, '宿主验收记录产物大小一致');
ok(hostAcceptance.sha256 === sha256, '宿主验收记录产物哈希一致');
console.log(JSON.stringify({
  status: 'validated',
  candidate: 'offline-validation-passed',
  card_type: profile.primary_card_type,
  artifact: manifest.packed_json,
  worldbook_entries: packedBook.entries.length,
  main_characters: characters.length,
  event_anchors: contract.required.event_ids.length,
  checks,
  bytes,
  sha256,
  real_host_acceptance: hostAcceptance.status,
}, null, 2));
