import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];

function safePath(relativePath) {
  if (typeof relativePath !== 'string' || isAbsolute(relativePath)) throw new Error(`非法路径：${relativePath}`);
  const fullPath = resolve(projectRoot, relativePath);
  const rel = relative(projectRoot, fullPath);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`路径越界：${relativePath}`);
  return fullPath;
}

async function text(relativePath) {
  const value = (await readFile(safePath(relativePath), 'utf8')).replace(/^\uFEFF/, '');
  assert(!value.includes('\uFFFD'), `${relativePath} 不含 UTF-8 替换字符`);
  return value;
}

async function json(relativePath) {
  return JSON.parse(await text(relativePath));
}

function assert(condition, label) {
  if (!condition) throw new Error(`验证失败：${label}`);
  checks.push(label);
}

function parseRegexLiteral(value) {
  const match = /^\/([\s\S]*)\/([a-z]*)$/.exec(value);
  if (!match) throw new Error(`不是正则字面量字符串：${value}`);
  return new RegExp(match[1], match[2]);
}

const componentFileNames = {
  基础: '基础信息',
  性格: '性格调色盘',
  三面性: '三面性',
  二次解释: '二次解释',
};

function parseCharacterEntry(entry) {
  const match = /^\[角色:(基础|性格|三面性|二次解释)\](.+)$/.exec(entry.comment);
  return match ? { component: match[1], name: match[2] } : null;
}

function runCoreContract(card, contract, manifest, { record = true } = {}) {
  const check = (condition, label) => {
    if (!condition) throw new Error(label);
    if (record) checks.push(label);
  };
  const data = card.data;
  const entries = data.character_book.entries;
  const scripts = data.extensions.tavern_helper.scripts;
  const initialEntry = entries.find(entry => entry.comment === '[initvar]初始变量（默认禁用）');
  const initial = JSON.parse(initialEntry.content);
  const characterEntries = entries
    .map(entry => ({ entry, parsed: parseCharacterEntry(entry) }))
    .filter(item => item.parsed);
  const characterNames = [...new Set(characterEntries.map(item => item.parsed.name))];
  const characterComponents = Object.fromEntries(contract.required.core_characters.map(name => [
    name,
    characterEntries.filter(item => item.parsed.name === name).map(item => item.parsed.component),
  ]));

  check(card.spec === 'chara_card_v3' && card.spec_version === '3.0', '角色卡符合 chara_card_v3 / 3.0');
  check(characterNames.length === contract.required.core_character_count, '恰好打包七名核心角色');
  check(JSON.stringify(characterNames) === JSON.stringify(contract.required.core_characters), '七名核心角色名称与顺序固定');
  check(contract.required.core_characters.every(name =>
    JSON.stringify(characterComponents[name]) === JSON.stringify(contract.required.core_character_components[name])
  ), '七名核心角色组件矩阵完整且顺序固定');
  check(entries.some(entry => entry.comment === '[角色速览]七人关系索引' && entry.constant), '角色速览常驻且已嵌入');
  check(Object.entries(contract.required.supporting_cast_groups).every(([group, names]) => {
    const entry = entries.find(candidate => candidate.comment === `[NPC群像]${group}`);
    return entry && names.every(name => entry.content.includes(name));
  }), '两条配角群像覆盖所有声明人物');
  check(characterEntries.every(({ entry }) => entry.keys.length > 0 && entry.keys.every(key => [...key].length >= 2)), '角色关键词均为两个以上汉字');
  check(JSON.stringify(Object.keys(initial.关系)) === JSON.stringify(contract.required.core_characters), '初始关系表恰好包含七名角色');
  check(initialEntry.enabled === false && initialEntry.constant === false, 'initvar 条目默认禁用');
  check(data.character_book.extensions.tavernweave.id === manifest.worldbook.stable_id, '内嵌世界书稳定 ID 正确');
  check(data.character_book.extensions.tavernweave.version === manifest.worldbook.version, '内嵌世界书版本正确');
  check(scripts.some(script => script.id === 'tavernweave-mvu-loader-v0.2' && script.enabled), 'MVU 固定版本加载器已嵌入并启用');
  check(scripts.some(script => script.id === 'tavernweave-mvu-schema-v0.2' && script.enabled), 'MVU Zod Schema 已嵌入并启用');

  const forbiddenRoots = ['战斗', '等级', '阶位', '战斗属性', '技能树', '装备', '库存', '货币', '经营'];
  const roots = Object.keys(initial);
  check(forbiddenRoots.every(root => !roots.includes(root)), '初始变量没有战斗或经济根字段');
  check(data.first_mes.includes(contract.required.opening_marker), '开场包含状态栏占位符');
  check(data.first_mes.includes('【可选方向】') && data.first_mes.includes('自由行动：'), '开场提供三个建议与自由行动');
  check(data.system_prompt.includes('独占林恩的对白、主动动作、选择、意图、判断、记忆与内心'), '系统提示声明玩家主权');
  check(data.system_prompt.includes('本版本没有战斗系统'), '系统提示明确无战斗系统');
}

const manifest = await json('manifest.json');
const profile = await json(manifest.profile);
const contract = await json(manifest.contract);
const card = await json(manifest.packed_json);
const packedText = await text(manifest.packed_json);

assert(manifest.version === profile.version && manifest.version === contract.version, '配置版本一致');
assert(profile.primary_card_type === contract.required.card_type, '卡型为 mvu_zod');
assert(manifest.deliverables.length === 1 && manifest.deliverables[0] === manifest.packed_json, 'v0.2 只声明 JSON 交付物');
for (const declaredPath of [
  manifest.profile,
  manifest.contract,
  manifest.card.metadata,
  manifest.card.system_prompt,
  manifest.card.post_history_instructions,
  manifest.card.first_message,
  manifest.card.example_dialogue,
  manifest.card.description,
  manifest.worldbook.source,
  manifest.tavern_helper_scripts,
  manifest.regex_scripts,
  manifest.initial_variables,
  manifest.packed_json,
]) {
  safePath(declaredPath);
}
assert(true, 'manifest 所有声明路径均限制在项目目录内');

runCoreContract(card, contract, manifest);

const mirroredFields = [
  'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example',
  'creator_notes', 'system_prompt', 'post_history_instructions', 'alternate_greetings',
  'tags', 'creator', 'character_version',
];
assert(mirroredFields.every(field => JSON.stringify(card[field]) === JSON.stringify(card.data[field])), '顶层与 data 核心字段完全镜像');

const entries = card.data.character_book.entries;
const worldbookSource = await json(manifest.worldbook.source);
for (const sourceEntry of worldbookSource.entries) {
  const packedEntry = entries.find(entry => entry.id === sourceEntry.id);
  assert(Boolean(packedEntry), `世界书条目 ${sourceEntry.id} 已打包`);
  if (sourceEntry.content_file) {
    assert((await text(sourceEntry.content_file)).trim() === packedEntry.content, `世界书条目 ${sourceEntry.id} 与文本源码一致`);
  }
  if (sourceEntry.content_json_file) {
    assert(JSON.stringify(await json(sourceEntry.content_json_file), null, 2) === packedEntry.content, `世界书条目 ${sourceEntry.id} 与 JSON 源码一致`);
  }
  if (Object.hasOwn(sourceEntry, 'content')) {
    assert(sourceEntry.content === packedEntry.content, `世界书条目 ${sourceEntry.id} 与内联源码一致`);
  }
}

const updateRule = entries.find(entry => entry.comment === '[mvu_update]变量更新规则');
const currentVariable = entries.find(entry => entry.comment === '[mvu_update]当前变量');
const outputFormat = entries.find(entry => entry.comment === '[mvu_update]变量输出格式');
assert([updateRule, currentVariable, outputFormat].every(Boolean), '三条 mvu_update 世界书条目齐全');
assert([updateRule, currentVariable, outputFormat].every(entry => entry.enabled && entry.constant), '三条 mvu_update 条目常驻启用');
assert([updateRule, currentVariable, outputFormat].every(entry => entry.extensions.position === 4 && entry.extensions.depth === 0), '三条 mvu_update 条目位于 depth 0');
assert(currentVariable.content.includes('{{format_message_variable::stat_data}}'), '当前变量条目读取 stat_data');
assert(outputFormat.content.includes('<UpdateVariable>') && outputFormat.content.includes('<JSONPatch>'), '输出协议包含 UpdateVariable.JSONPatch');

const scripts = card.data.extensions.tavern_helper.scripts;
const loader = scripts.find(script => script.id === 'tavernweave-mvu-loader-v0.2');
const schema = scripts.find(script => script.id === 'tavernweave-mvu-schema-v0.2');
assert(loader.content.includes('@b42817925d0391c15fa242a8238d2bbe28eb6319/'), 'MagVarUpdate 远程加载固定到精确提交');
assert(schema.content.includes('@7f29257de3ffbd83d63bc37ca09f4d4ecad6ca0f/'), 'Zod 桥接远程加载固定到精确提交');
assert(schema.content.includes('registerMvuSchema(Schema)'), 'Schema 使用 registerMvuSchema 注册');
assert(!/\b(import|require)\s*\(?['"]zod['"]/.test(schema.content), 'Schema 使用酒馆助手注入的 z，不要求单独安装 Zod');
assert(JSON.stringify(card.data.extensions.tavernweave.runtime_dependencies) === JSON.stringify(manifest.runtime_dependencies), '打包运行依赖账本与 manifest 一致');
const dependencyClasses = Object.fromEntries(manifest.runtime_dependencies.map(item => [item.id, item.class]));
assert(dependencyClasses.sillytavern === 'host_required' && dependencyClasses['tavern-helper'] === 'host_required', '宿主依赖分类正确');
assert(dependencyClasses['mvu-loader'] === 'embedded_required' && dependencyClasses['mvu-zod-schema'] === 'embedded_required', '卡内脚本依赖分类正确');
assert(dependencyClasses.magvarupdate === 'remote_runtime' && dependencyClasses['mvu-zod-bridge'] === 'remote_runtime', '远程运行时依赖分类正确');
assert(dependencyClasses.node === 'development_only', 'Node 仅列为开发依赖');

for (const scriptPath of ['src/scripts/mvu_loader.js', 'src/scripts/schema.js']) {
  const result = spawnSync(process.execPath, ['--check', safePath(scriptPath)], { encoding: 'utf8' });
  assert(result.status === 0, `${scriptPath} JavaScript 语法检查通过`);
}

const regexScripts = card.data.extensions.regex_scripts;
for (const regexScript of regexScripts) {
  parseRegexLiteral(regexScript.findRegex);
}
assert(true, '所有嵌入正则可编译');
const statusRegex = regexScripts.find(script => script.id === 'tavernweave-status-ui-v0.2');
const hideRegex = regexScripts.find(script => script.id === 'tavernweave-hide-mvu-v0.2');
assert(statusRegex && !statusRegex.disabled && statusRegex.replaceString.includes('<section class="wa-panel"'), '状态栏正则已嵌入并启用');
assert(hideRegex && !hideRegex.disabled && hideRegex.replaceString === '', '变量块隐藏正则已嵌入并启用');
assert(statusRegex.replaceString.includes('textContent') && !statusRegex.replaceString.includes('.innerHTML'), '状态栏只用安全文本节点渲染变量');
assert(statusRegex.replaceString.includes('VARIABLE_INITIALIZED') && statusRegex.replaceString.includes('VARIABLE_UPDATE_ENDED'), '状态栏监听 MVU 初始化与更新结束事件');
assert(statusRegex.replaceString.includes('host.SillyTavern') && statusRegex.replaceString.includes('message?.variables'), '状态栏可从宿主聊天消息直接读取已保存的 MVU 变量');
assert(statusRegex.replaceString.includes('host.Mvu?.getMvuData'), '状态栏可从父页面兼容获取 MVU 接口');
assert(statusRegex.replaceString.includes('void bootstrap()'), '状态栏通过异步启动流程读取并订阅 MVU');
assert(statusRegex.replaceString.includes('MVU 未就绪，正文仍可使用'), '状态栏提供可读降级提示');
assert(statusRegex.replaceString.includes('当前状态') && statusRegex.replaceString.includes('人物与事件'), '状态栏包含两个约定页面');
assert(!statusRegex.replaceString.includes('关系.信任') && statusRegex.replaceString.includes('隐藏关系数值不会展示'), '状态栏不展示隐藏关系数字');

const initialSource = await json(manifest.initial_variables);
const initEntry = entries.find(entry => entry.comment.startsWith('[initvar]'));
assert(JSON.stringify(initialSource) === JSON.stringify(JSON.parse(initEntry.content)), '初始变量源码与内嵌副本语义一致');

for (const name of contract.required.core_characters) {
  for (const component of contract.required.core_character_components[name]) {
    const characterFile = `src/characters/${name}/${componentFileNames[component]}.md`;
    const expected = (await text(characterFile)).trim();
    const packed = entries.find(entry => entry.comment === `[角色:${component}]${name}`).content;
    assert(expected === packed, `${name}/${component}人物组件与源码一致`);
  }
}

for (const [group, names] of Object.entries(contract.required.supporting_cast_groups)) {
  const groupFile = `src/npcs/${group}.md`;
  const expected = (await text(groupFile)).trim();
  const packed = entries.find(entry => entry.comment === `[NPC群像]${group}`);
  assert(packed?.content === expected, `${group}群像与源码一致`);
  assert(names.every(name => packed.keys.includes(name) || packed.content.includes(name)), `${group}群像关键词或正文覆盖声明人物`);
}

const authoredEntries = entries.filter(entry => parseCharacterEntry(entry) || entry.comment.startsWith('[NPC群像]'));
const bannedWritingPatterns = ['——', '仿佛', '宛如', '心湖泛起涟漪', '嘴角微微上扬', '眼中闪过一丝', '详见'];
assert(authoredEntries.every(entry => bannedWritingPatterns.every(pattern => !entry.content.includes(pattern))), '人物文本通过禁词与跨条目引用扫描');
assert(entries.find(entry => entry.comment === '[核心]v0.2 主线')?.content.includes('小小的夜间牙科'), '早期主线覆盖小小夜间牙科与命名边界');
assert(!packedText.includes('v0.1'), '打包卡片没有面向用户的 v0.1 残留文本');
assert(!/[“”"]林恩(?:说|答|点头|摇头|走|拿|决定|想到|觉得)/.test(card.data.first_mes), '开场未替林恩编造对白、动作、决定或内心');
assert((card.data.first_mes.match(/^\d\./gm) ?? []).length === 3, '开场恰好列出三条建议');

const staleManifest = structuredClone(manifest);
staleManifest.worldbook.version = '0.0.9';
let staleRejected = false;
try {
  runCoreContract(card, contract, staleManifest, { record: false });
} catch {
  staleRejected = true;
}
assert(staleRejected, '负向夹具：旧世界书版本会被拒绝');

const missingDependency = structuredClone(card);
missingDependency.data.extensions.tavern_helper.scripts = missingDependency.data.extensions.tavern_helper.scripts.filter(script => script.id !== 'tavernweave-mvu-loader-v0.2');
let missingRejected = false;
try {
  runCoreContract(missingDependency, contract, manifest, { record: false });
} catch {
  missingRejected = true;
}
assert(missingRejected, '负向夹具：缺失 MVU 加载器会被拒绝');

const missingCharacterComponent = structuredClone(card);
missingCharacterComponent.data.character_book.entries = missingCharacterComponent.data.character_book.entries
  .filter(entry => entry.comment !== '[角色:性格]左左');
let missingCharacterComponentRejected = false;
try {
  runCoreContract(missingCharacterComponent, contract, manifest, { record: false });
} catch {
  missingCharacterComponentRejected = true;
}
assert(missingCharacterComponentRejected, '负向夹具：缺失核心角色组件会被拒绝');

const forbiddenState = structuredClone(card);
const forbiddenInit = forbiddenState.data.character_book.entries.find(entry => entry.comment.startsWith('[initvar]'));
const forbiddenVariables = JSON.parse(forbiddenInit.content);
forbiddenVariables.战斗 = {};
forbiddenInit.content = JSON.stringify(forbiddenVariables);
let forbiddenRejected = false;
try {
  runCoreContract(forbiddenState, contract, manifest, { record: false });
} catch {
  forbiddenRejected = true;
}
assert(forbiddenRejected, '负向夹具：战斗根字段会被拒绝');

const hash = createHash('sha256').update(packedText).digest('hex');
console.log(JSON.stringify({
  status: 'offline-candidate',
  card_type: profile.primary_card_type,
  capabilities: profile.capabilities,
  checks_passed: checks.length,
  artifact: manifest.packed_json,
  bytes: Buffer.byteLength(packedText),
  sha256: hash,
  real_host_acceptance: 'pending',
}, null, 2));
