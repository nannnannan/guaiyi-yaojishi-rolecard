import { createHash } from 'node:crypto';
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

ok(manifest.version === '0.32.0', 'manifest版本为0.32.0');
ok(profile.version === manifest.version, 'profile版本同步');
ok(contract.version === manifest.version, 'contract版本同步');
ok(cardSource.character_version === manifest.version, '角色卡版本同步');
ok(manifest.worldbook.version === manifest.version, '世界书版本同步');
ok(manifest.card.stable_id === 'weird-apothecary-blood-saw-shop', '卡片稳定ID保持不变');
ok(manifest.worldbook.stable_id === 'weird-apothecary-worldbook', '世界书稳定ID保持不变');
ok(manifest.packed_json === 'dist/诡异药剂师_v0.32.json', '产物文件名正确');
ok(cardSource.name === '《诡异药剂师》v0.32', '显示名正确');
ok(profile.ui_variant === 'death_realm_four_page', '四页死界UI配置正确');
ok(profile.update_protocol === 'UpdateVariable.JSONPatch', '更新协议正确');
ok(contract.required.internal_before_v1 === true, 'v1.0前内部版本已声明');
ok(contract.required.stage_scope === '第1至149章', '阶段范围已声明');
ok(contract.required.core_character_count === 8, '八名主要角色');
ok(contract.required.time_progression === '纯事件驱动，不维护天数计数', '纯事件驱动已声明');
ok(contract.required.evil_value_scope.includes('初始0') && contract.required.evil_value_scope.includes('不锁定'), '恶堕值初始0且不锁定已声明');
ok(hostAcceptance.version === manifest.version, '宿主验收记录版本同步');
ok(hostAcceptance.status === 'candidate', '当前为候选版（等待真实宿主验收）');
ok(hostAcceptance.artifact === manifest.packed_json, '宿主验收记录指向当前产物');

const packedText = await readText(manifest.packed_json, false);
const packed = JSON.parse(packedText);
ok(packed.spec === 'chara_card_v3', '角色卡规范为chara_card_v3');
ok(packed.spec_version === '3.0', '角色卡规范版本为3.0');
ok(packed.data?.name === cardSource.name, 'data显示名正确');
ok(packed.data?.character_version === '0.32.0', 'data版本正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.id === manifest.worldbook.stable_id, '打包世界书稳定ID正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.version === '0.32.0', '打包世界书版本正确');

for (const field of [
  'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes',
  'system_prompt', 'post_history_instructions', 'alternate_greetings', 'tags', 'creator',
  'character_version', 'extensions',
]) {
  ok(JSON.stringify(packed[field]) === JSON.stringify(packed.data[field]), `顶层与data镜像：${field}`);
}

ok(!packedText.includes('"character_version": "0.31.0"'), '产物不残留旧角色卡版本面');
ok(!packedText.includes('\uFFFD'), '产物不含UTF-8替换字符');

const packedBook = packed.data.character_book;
ok(packedBook.name === sourceBook.name, '打包世界书名称与源码一致');
ok(packedBook.description === sourceBook.description, '打包世界书描述与源码一致');
ok(packedBook.entries.length === sourceBook.entries.length, '打包世界书条目数与源码一致');
ok(packedBook.entries.length === 41, '世界书包含41条维护条目');

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
ok(characters.length === 8, '八名主要角色');
ok(components.length === 6, '每名角色六个组件');
ok(!characters.includes('爱丽丝') && !characters.includes('黑弦月'), '爱丽丝与黑弦月不在角色阵容');

const characterIds = {
  左左: 100,
  血锯: 110,
  血衣女士: 120,
  小小: 130,
  人偶夫人: 140,
  泰坦头颅: 170,
  巫神头颅: 180,
  小宝贝: 190,
};

const componentFiles = {
  角色速览: '角色速览.md',
  基础信息: '基础信息.md',
  性格调色盘: '性格调色盘.md',
  三面性: '三面性.md',
  多阶段人设: '多阶段人设.md',
  二次解释: '二次解释.md',
};

for (const character of characters) {
  const entry = sourceBook.entries.find(item => item.comment === `[角色]${character}`);
  ok(Boolean(entry), `${character}有运行时角色词条`);
  ok(entry.id === characterIds[character], `${character}运行时ID固定`);
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
  if (character !== '血锯') {
    ok(runtimeEntry.content.includes('<%_ if'), `${character}蓝灯包含事件条件分段`);
  }
}

for (const character of contract.required.non_romantic_characters) {
  ok(initial.关系[character].吸引 === 0, `${character}初始吸引为0`);
}
ok(initial.关系.左左.吸引 === 0, '左左初始吸引为0（未确认独立成年形态）');
ok(initial.关系.小小.恶堕 === 0 && initial.关系.小小.吸引 === 0, '小小恶堕与吸引恒为0');

const femaleCharacters = ['左左', '血衣女士', '人偶夫人', '巫神头颅'];
for (const character of femaleCharacters) {
  ok(initial.关系[character].恶堕 === 0, `${character}恶堕值初始为0`);
  ok(Object.prototype.hasOwnProperty.call(initial.关系[character], '恶堕'), `${character}建有恶堕值变量`);
}
ok(initial.关系.血衣女士.边界.includes('恶堕值只随玩家明确行动推进'), '血衣女士恶堕推进规则可见');
ok(initial.关系.人偶夫人.边界.includes('恶堕值只随玩家明确行动推进'), '人偶夫人恶堕推进规则可见');

const stageFactRequirements = {
  泰坦头颅: ['小小的父亲', '触手', '护短'],
  巫神头颅: ['小小的母亲', '自我催眠', '心灵契约', '试探'],
  小宝贝: ['巨像部件', '巨型舌头', '地窖'],
  小小: ['泰坦头颅', '巫神头颅', '钢牙', '固定非性'],
  血衣女士: ['45号', '寻子', '红衣'],
  人偶夫人: ['人偶庄园', '血源诅咒', '黑弦月'],
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
for (const token of ['至高意志', '区域', '频道', '情报交易', '自动扩容', '情报员024']) {
  ok(sightEntry.includes(token), `视界系统包含阶段1事实：${token}`);
}
const nightDoctorEntry = packedBook.entries.find(item => item.comment === '[势力]夜医').content;
for (const token of ['守序善良', '万物都有病', '制造', '治疗']) {
  ok(nightDoctorEntry.includes(token), `夜医包含阶段1事实：${token}`);
}
const giantEntry = packedBook.entries.find(item => item.comment === '[机制]巨像及血肉机械技术').content;
for (const token of ['三千年前', '血肉与机械', '小宝贝', '巨像计划', '血锯']) {
  ok(giantEntry.includes(token), `巨像技术包含阶段1事实：${token}`);
}
const residentsEntry = packedBook.entries.find(item => item.comment === '[势力]游魂巷居民').content;
for (const token of ['血娃娃', '猪头魔', '玥玥', '不眠夜', '拒绝赊账']) {
  ok(residentsEntry.includes(token), `游魂巷居民并入来客群像：${token}`);
}
const associationEntry = packedBook.entries.find(item => item.comment === '[势力]魔人协会').content;
for (const token of ['械魔', '噬心魔', '倒吊塔', '情报员024']) {
  ok(associationEntry.includes(token), `魔人协会并入配角：${token}`);
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

const e01Content = await readText(sourceBook.entries.find(entry => entry.id === 300).content_file);
for (const token of ['右眼', '找妈妈', '小本生意，不接受肉偿', '完成度2%', '物理治疗', '洋娃娃']) {
  ok(e01Content.includes(token), `E01按原文包含：${token}`);
}

exactKeys(initial, ['元数据', '世界', '林恩', '事件', '关系', '角色关系', '系统'], 'MVU根');
ok(!Object.prototype.hasOwnProperty.call(initial, '病例'), '已删除病例根');
ok(!Object.prototype.hasOwnProperty.call(initial.世界, '天数'), '不维护天数计数');
exactKeys(initial.世界, ['阶段编号', '阶段名称', '模糊阶段进度', '当前场景时间', '地点', '氛围', '大局线索'], '世界');
exactKeys(initial.林恩, ['年龄', '身体状况', '当前身份', '等级', '技能', '成就', '图鉴已解锁', '关键诅咒或契约', '当前明确目标', '最近明确指令'], '林恩');
exactKeys(initial.事件, ['锚点状态', '唯一活跃事件', '近期预兆', '最近结果', '阶段总结', '原创重大事件待定队列'], '事件');
exactKeys(initial.系统, ['当前任务', '任务阶段', '任务状态', '任务说明', '图鉴', '成就', '最近提示', '事件通知', '更新模式'], '系统');
ok(initial.林恩.年龄 === 17, '林恩年龄为17（原文面板）');
ok(initial.林恩.等级 === 2, '林恩等级为2（原文面板）');
ok(initial.世界.阶段编号 === 'S0', '初始阶段为S0');
ok(initial.事件.唯一活跃事件.事件ID === 'E01', 'E01是初始唯一活跃事件');
ok(assertSingleActive(initial.事件.锚点状态, initial.事件.唯一活跃事件), '初始重大事件唯一活跃');
ok(initial.事件.唯一活跃事件.进展.includes('血娃娃找妈妈'), 'E01进展包含寻母任务');
ok(initial.事件.唯一活跃事件.进展.includes('右眼'), 'E01进展包含右眼抵押');
ok(initial.关系.血衣女士.可见迹象.some(cue => cue.includes('头发')), '血衣女士可见迹象含寻母线索');
ok(initial.关系.小宝贝.好感 === 5, '小宝贝初始好感按两年投喂语义映射为低值');
ok(initial.事件.近期预兆.事件ID === '', '初始没有未来预兆');
ok(initial.事件.锚点状态.E02.状态 === '未触发', 'E02初始未触发（纯事件驱动）');
ok(Array.isArray(initial.角色关系) && initial.角色关系.length === 0, '角色关系按需建立而非全矩阵');

const requiredRelationFields = [
  '解锁', '在场', '生存状态', '位置', '处境', '关系类型', '人物阶段', '好感', '信赖',
  '戒备', '吸引', '关系创伤', '恶堕', '可见迹象', '边界', '关键记忆', '最近互动',
];
exactKeys(initial.关系, characters, '八人关系');
for (const [name, relation] of Object.entries(initial.关系)) {
  exactKeys(relation, requiredRelationFields, `${name}关系字段`);
  ok(relation.好感 >= 0 && relation.好感 <= 100, `${name}好感在0-100`);
  ok(relation.恶堕 >= 0 && relation.恶堕 <= 100, `${name}恶堕在0-100`);
}

const schemaText = await readText('src/scripts/schema.js');
for (const token of ['《诡异药剂师》v0.32', '0.32.0', '恶堕', '左左', '血锯', '血衣女士', '小小', '人偶夫人', '泰坦头颅', '巫神头颅', '小宝贝']) {
  ok(schemaText.includes(token), `schema包含：${token}`);
}
ok(!schemaText.includes('爱丽丝') && !schemaText.includes('黑弦月'), 'schema不含爱丽丝与黑弦月');

const helperNames = helperSource.map(script => script.name).join('；');
ok(helperNames.includes('v0.32'), '酒馆助手脚本命名含v0.32');
ok(helperSource.length === 2, '内嵌酒馆助手脚本2个');
ok(regexSource.length === 2, '正则脚本2个');

const srcFiles = await listFiles('src');
const allSrcText = (await Promise.all(srcFiles.map(file => readText(file, false)))).join('\n');
ok(!allSrcText.includes('爱丽丝'), 'src源码不含爱丽丝残留引用');
const blackMoonCount = (allSrcText.match(/黑弦月/g) ?? []).length;
ok(blackMoonCount > 0 && blackMoonCount <= 12, '黑弦月仅以“未登场/租借在途”语境保留');
ok(!sourceBook.entries.some(entry => entry.comment.includes('[角色]黑弦月') || entry.comment.includes('[角色]爱丽丝')), '世界书注册表无爱丽丝/黑弦月角色词条');
ok(!Object.prototype.hasOwnProperty.call(initial.关系, '爱丽丝') && !Object.prototype.hasOwnProperty.call(initial.关系, '黑弦月'), '关系变量无爱丽丝/黑弦月');
ok(allSrcText.includes('<%_ if'), '角色蓝灯使用EJS条件分段');

const openingText = await readText('src/prompts/first_message.md', false);
const openingSourceText = await readText('src/prompts/opening_source.txt', false);
function normalizeForCompare(text) {
  return text
    .replace(/^\uFEFF/, '')
    .split('\n')
    .map(line => line.replace(/^\u3000+/, '').replace(/^#\s+/, '').replace(/^\s+/, '').replace(/\s+$/, ''))
    .filter(line => line.length > 0)
    .join('\n');
}
const openingBody = openingText.replace(/<StatusPlaceHolderImpl\/>[\s\S]*$/, '');
ok(normalizeForCompare(openingBody) === normalizeForCompare(openingSourceText), '开场白正文与原文逐字一致（仅允许格式调整）');
ok(openingText.includes('<StatusPlaceHolderImpl/>'), '开场白保留状态栏占位符');
ok(openingText.includes('<UpdateVariable>') && openingText.includes('<initvar>') && openingText.includes('</initvar>'), '开场白内嵌initvar块');
const initvarMatch = openingText.match(/<initvar>\s*([\s\S]*?)\s*<\/initvar>/);
ok(Boolean(initvarMatch), '开场白initvar块可提取');
const openingInitVar = JSON.parse(initvarMatch[1]);
ok(JSON.stringify(openingInitVar) === JSON.stringify(initial), '开场白initvar与初始变量深度一致');
ok(openingInitVar.事件.锚点状态.E01.状态 === '活跃', '开场白initvar E01活跃');
ok(openingInitVar.关系.小小.恶堕 === 0, '开场白initvar小小恶堕为0');
ok(openingInitVar.林恩.年龄 === 17, '开场白initvar林恩17岁');
ok(openingInitVar.林恩.等级 === 2, '开场白initvar林恩等级2');

const initVarEntry = sourceBook.entries.find(entry => entry.comment === '[initvar]初始变量');
ok(Boolean(initVarEntry), 'initvar世界书条目存在');
ok(initVarEntry.enabled === true, 'initvar条目已启用（双通道初始化）');
ok(initVarEntry.content_json_file === 'src/initial_variables.json', 'initvar条目指向初始变量源码');
const currentVariableEntry = sourceBook.entries.find(entry => entry.id === 920);
ok(currentVariableEntry.content.includes('{{format_message_variable::stat_data}}'), '当前变量条目使用状态宏');
ok(currentVariableEntry.content.includes('不得重置'), '当前变量条目含空值连续性提示');

const systemPromptText = await readText('src/prompts/system.md');
ok(systemPromptText.includes('MVU状态必须保持连续'), '系统提示含状态连续性规则');
const postHistoryText = await readText('src/prompts/post_history.md');
ok(postHistoryText.includes('状态连续性'), '后置历史协议含状态连续性规则');

const mainlineText = await readText('src/prompts/mainline.md');
ok(mainlineText.includes('锚点优先于原创'), '事件调度含锚点优先规则');
ok(mainlineText.includes('不要用原创客人占位'), '事件调度禁止原创占位');
const updateRulesText = await readText('src/prompts/mvu_update_rules.md');
ok(updateRulesText.includes('支线可以长期挂起'), '更新规则允许支线挂起');
ok(updateRulesText.includes('不要用原创客人占位'), '更新规则禁止原创占位');
const systemPromptRules = await readText('src/prompts/system.md');
ok(systemPromptRules.includes('锚点优先于原创'), '系统提示含锚点优先规则');

for (let index = 0; index < 11; index += 1) {
  const eventId = contract.required.event_ids[index];
  const eventContent = await readText(sourceBook.entries.find(entry => entry.id === 300 + index).content_file);
  ok(eventContent.includes('## 下一事件引入'), `${eventId}蓝灯含下一事件引入段`);
}
const e01Bridge = await readText(sourceBook.entries.find(entry => entry.id === 300).content_file);
ok(e01Bridge.includes('## 下一事件引入（E02'), 'E01引入段指向E02');
const e12Content = await readText(sourceBook.entries.find(entry => entry.id === 311).content_file);
ok(!e12Content.includes('## 下一事件引入'), 'E12不含后续引入段（不设计续接）');
ok(mainlineText.includes('事件因果链（常驻）'), '调度规则含常驻事件因果链');
ok(mainlineText.includes('E12收束后不设计续接'), '因果链明确E12收束边界');
ok(updateRulesText.includes('下一事件引入'), '更新规则引用蓝灯引入段');
ok(systemPromptRules.includes('下一事件引入'), '系统提示引用蓝灯引入段');

const statusUiText = await readText('src/ui/status.html', false);
ok(statusUiText.includes('FALLBACK_STATE'), '状态栏内嵌初始状态回退');
for (const character of characters) {
  ok(statusUiText.includes(`"${character}":`), `状态栏回退状态包含：${character}`);
}
ok(statusUiText.includes('"恶堕": 0'), '状态栏回退状态恶堕值初始为0');
ok(statusUiText.includes('"E01": { "标题": "血娃娃上门", "状态": "活跃" }'), '状态栏回退状态E01活跃');
ok(statusUiText.includes('wa-tab-system'), '状态栏含系统页');
ok(statusUiText.includes('暂显示初始状态'), '状态栏具备初始状态提示路径');

const schemaValidation = initial.事件.锚点状态;
for (const eventId of contract.required.event_ids) {
  ok(['未触发', '预兆', '活跃', '变形', '完成', '取消'].includes(schemaValidation[eventId].状态), `${eventId}状态合法`);
}

const sha256 = createHash('sha256').update(packedText).digest('hex');
const bytes = Buffer.byteLength(packedText);

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
