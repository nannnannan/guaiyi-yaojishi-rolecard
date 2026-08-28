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

function regexFromLiteral(literal) {
  const match = literal.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
  if (!match) throw new Error(`无效正则字面量：${literal}`);
  return new RegExp(match[1], match[2]);
}

function compileEjsStatements(content, label) {
  const statements = [...content.matchAll(/<%[-_=]?([\s\S]*?)[-_]?%>/g)].map(match => match[1]).join('\n');
  if (!statements.trim()) return false;
  new Function('getvar', 'getEnabledWorldInfoEntries', 'activewi', `return (async () => {${statements}})();`);
  return true;
}

function assertSingleActive(stateTable, activeEvent) {
  const active = Object.entries(stateTable).filter(([, value]) => value.状态 === '活跃');
  if (activeEvent.状态 === '无') return active.length === 0
    && activeEvent.事件ID === ''
    && activeEvent.标题 === ''
    && activeEvent.地点 === ''
    && activeEvent.参与者.length === 0
    && activeEvent.紧迫度 === '无'
    && activeEvent.模糊期限 === ''
    && activeEvent.进展 === ''
    && activeEvent.幕后停止点 === '';
  return activeEvent.状态 === '活跃' && active.length === 1 && active[0][0] === activeEvent.事件ID;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateEventLedger(events) {
  const errors = [];
  const anchors = Object.entries(events.锚点状态);
  const activeAnchors = anchors.filter(([, value]) => value.状态 === '活跃');
  const premonitionAnchors = anchors.filter(([, value]) => value.状态 === '预兆');
  if (!assertSingleActive(events.锚点状态, events.唯一活跃事件)) errors.push('active-mismatch');

  const omen = events.近期预兆;
  const canonicalEmptyOmen = omen.事件ID === ''
    && omen.方向 === ''
    && omen.地点 === ''
    && omen.参与者.length === 0
    && omen.紧迫度 === '无'
    && omen.模糊期限 === '';
  if (!omen.事件ID) {
    if (premonitionAnchors.length !== 0 || !canonicalEmptyOmen) errors.push('empty-omen-not-canonical');
  } else if (premonitionAnchors.length !== 1 || premonitionAnchors[0][0] !== omen.事件ID) {
    errors.push('omen-mismatch');
  }

  for (const [eventId, anchor] of anchors) {
    if (['未触发', '预兆'].includes(anchor.状态) && anchor.收尾 !== false) errors.push(`${eventId}-premature-tail`);
    if (['变形', '完成', '取消'].includes(anchor.状态) && anchor.收尾 !== true) errors.push(`${eventId}-terminal-without-tail`);
  }
  const resultKeys = ['事件ID', '标题', '结果', '世界影响'];
  if (!Array.isArray(events.最近结果) || events.最近结果.length > 12) {
    errors.push('recent-results-invalid');
  } else {
    for (const item of events.最近结果) {
      const keys = item && typeof item === 'object' && !Array.isArray(item)
        ? Object.keys(item).sort()
        : [];
      const expectedKeys = [...resultKeys].sort();
      if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)
        || resultKeys.some(key => typeof item?.[key] !== 'string')) {
        errors.push('recent-results-invalid');
        break;
      }
    }
  }
  if (activeAnchors.length > 1) errors.push('multiple-active');
  return errors;
}

function applyReplaceOperation(document, path, value) {
  const next = cloneJson(document);
  const parts = path.split('/').slice(1).map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  let target = next;
  for (const part of parts.slice(0, -1)) target = target[part];
  target[parts.at(-1)] = cloneJson(value);
  return next;
}

const conceptKeywordAliases = {
  人皮拾荒者: ['拾荒者'],
  噬心魔: ['魔人协会会长', '脑魔会长'],
  夜医转职: ['夜医转职任务', '夜医任务图谱'],
  情报员024: ['024', '视界900号情报商'],
  械魔: ['魔人协会副会长'],
  猎神者: ['最强血肉造物', '猎神者傀儡'],
  '猎魔人·奥卡洛斯': ['奥卡洛斯', '猎魔人'],
  玥玥: ['黑蛾妖族骑士长', '黑蛾先锋官'],
  虚空折跃龟信使: ['虚空折跃龟', '折跃龟'],
  '45号闺房': ['血衣闺房', '45号二楼闺房'],
  人偶庄园庭院: ['人偶庭院', '庄园庭院'],
  倒吊塔地下基地: ['倒吊塔基地', '魔人协会地下基地'],
  独角鬼王神庙: ['鬼王神庙', '独角神庙'],
  系统商城: ['日常商城'],
  魂灯营业: ['魂灯', '魂灯庇护'],
  传说左轮: ['苍白狩魔者', '苍白狩魔者左轮'],
  剔骨刀: ['血锯剔骨刀'],
  夜魔刀: ['传说级手术刀'],
  '无皮尸傀·幽灵仆从': ['无皮尸傀', '幽灵仆从'],
  无面魔心脏: ['无面魔的心脏'],
  暴击药剂: ['闪光秃头药剂', '秃头药剂'],
  '机械重神·71': ['机械重神71', '机械重神'],
  猎杀者120型: ['120型猎杀者', '猎杀者120'],
  神圣之矛碎片: ['神圣之矛残片'],
  秘银头骨碎片: ['秘银头骨残片'],
  血肉增生药剂: ['增生药剂'],
  试做型巨像012号: ['巨像012号', '012号巨像'],
  钢牙: ['小小的钢牙', '机械钢牙'],
  黑弦月: ['第七人偶', '战斗人偶黑弦月'],
  不眠夜规则: ['不眠夜', '魂灯熄灭规则'],
  化解怨结: ['怨结任务', '血衣怨结'],
  幸福之家传闻: ['幸福之家', '离魂街古堡'],
  找妈妈任务: ['血娃娃找妈妈', '寻母任务'],
  棒医生称号: ['棒医生', '超级喜欢的棒医生'],
  狂猎榜: ['狂猎排名'],
  猪头屠夫放置之谜: ['猪头屠夫放置林恩', '林恩穿越线索'],
  相亲相爱一家人视界群: ['相亲相爱一家人', '血锯药剂店VIP群'],
  '鬼婴·小呀哒': ['小呀哒', '血衣之女'],
  心灵契约: ['泰坦族灵魂绑定', '契约印记'],
  聚焦之瞳: ['聚焦之瞳插件', '凝视诅咒插件'],
  '血肉变异·脑蛇': ['脑蛇', '三级血肉变异'],
  血肉灾变: ['9级血肉灾变', '九级血肉灾变'],
  过往遗念: ['完整形态再现', '再现过去形态'],
  限时诅咒清除: ['诅咒清除能力', '24小时诅咒清除'],
  随机诊断术: ['随机诊断', '赋予疾病'],
  鬼婴塑形: ['恶灵血婴塑形', '第一次塑形'],
  龙息之臂: ['龙息手臂', '龙炎插件'],
  恶灵血婴: ['未成型血婴', '恶灵寄生'],
  '泰坦诅咒削弱15%': ['泰坦诅咒', '诅咒削弱15%'],
  目光诅咒: ['地狱行者目光', '溶解面容诅咒'],
  血衣诅咒续费绑定: ['血衣诅咒', '诅咒续费绑定'],
  黑蝴蝶剧毒: ['黑蝴蝶毒', '黑气蝶影'],
};

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

ok(manifest.version === '0.5.0', 'manifest版本为0.5.0');
ok(profile.version === manifest.version, 'profile版本同步');
ok(contract.version === manifest.version, 'contract版本同步');
ok(cardSource.character_version === manifest.version, '角色卡版本同步');
ok(manifest.worldbook.version === manifest.version, '世界书版本同步');
ok(manifest.runtime_dependencies.find(item => item.id === 'tavern-helper')?.version === contract.required.host_versions.tavern_helper, 'manifest与contract酒馆助手版本同步');
ok(cardSource.creator_notes.includes('酒馆助手 4.9.1') && !cardSource.creator_notes.includes('4.8.19'), '角色卡备注使用当前酒馆助手版本');
ok(manifest.card.stable_id === 'weird-apothecary-blood-saw-shop', '卡片稳定ID保持不变');
ok(manifest.worldbook.stable_id === 'weird-apothecary-worldbook', '世界书稳定ID保持不变');
ok(manifest.packed_json === 'dist/诡异药剂师_v0.5.json', '产物文件名正确');
ok(cardSource.name === '《诡异药剂师》v0.5', '显示名正确');
ok(profile.ui_variant === 'death_realm_four_page', '四页死界UI配置正确');
ok(profile.update_protocol === 'UpdateVariable.JSONPatch', '更新协议正确');
ok(contract.required.internal_before_v1 === true, 'v1.0前内部版本已声明');
ok(contract.required.stage_scope === '第1至149章', '阶段范围已声明');
ok(contract.required.core_character_count === 8, '八名主要角色');
ok(contract.required.time_progression === '纯事件驱动，不维护天数计数', '纯事件驱动已声明');
ok(contract.required.evil_value_scope.includes('兼容恶堕字段') && contract.required.evil_value_scope.includes('小小') && contract.required.evil_value_scope.includes('恒为0'), '恶堕兼容字段与小小锁零边界已声明');
ok(contract.required.event_state_semantics.includes('only 活跃 is active') && contract.required.event_state_semantics.includes('变形 is a terminal'), '契约声明变形为稳定终态且仅活跃态占用活跃槽');
ok(contract.required.event_transition_patch.includes('replaces /事件 atomically'), '契约声明跨锚点迁移原子替换完整事件根');
ok(contract.required.empty_event_objects.includes('canonical fully cleared'), '契约声明活跃事件与预兆的规范空对象');
ok(contract.required.host_versions?.sillytavern === '1.17.0' && contract.required.host_versions?.tavern_helper === '4.9.1', '契约宿主版本与已测环境一致');
ok(!contract.forbidden.systems.includes('level') && contract.forbidden.systems.includes('level_progression_system'), '契约区分原文等级记录与禁用的等级成长系统');
ok(contract.required.concept_activation?.router_entry_id === 399, '概念事件路由ID契约固定');
ok(contract.required.concept_activation?.concept_count === 52, '概念双路激活契约覆盖52条');
ok(contract.required.concept_activation?.mode === 'event_window_or_native_green', '概念双路激活模式已声明');
ok(contract.required.concept_activation?.event_window_radius === 3, '概念事件窗口半径为3');
ok(JSON.stringify(contract.required.concept_activation?.native_chat_roles) === JSON.stringify(['user', 'assistant']), '原生绿灯聊天角色为user+assistant');
ok(contract.required.concept_activation?.inherit_global_scan_depth === true, '原生绿灯继承宿主全局扫描深度');
ok(contract.required.concept_activation?.deduplicate_by === 'world.uid', '双路激活按world.uid去重');
ok(profile.capabilities.includes('native_worldbook_keyword_activation'), 'profile声明酒馆原生关键词激活能力');
ok(profile.capabilities.includes('event_window_concept_activation'), 'profile声明事件窗口概念激活能力');
ok(hostAcceptance.version === manifest.version, '宿主验收记录版本同步');
ok(hostAcceptance.status === 'accepted-release', '真实宿主验收状态为 accepted-release');
ok(hostAcceptance.artifact === manifest.packed_json, '宿主验收记录指向当前产物');

const packedText = await readText(manifest.packed_json, false);
const packed = JSON.parse(packedText);
ok(packed.spec === 'chara_card_v3', '角色卡规范为chara_card_v3');
ok(packed.spec_version === '3.0', '角色卡规范版本为3.0');
ok(packed.data?.name === cardSource.name, 'data显示名正确');
ok(packed.data?.character_version === '0.5.0', 'data版本正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.id === manifest.worldbook.stable_id, '打包世界书稳定ID正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.version === '0.5.0', '打包世界书版本正确');
ok(packed.data?.scenario?.includes('E01已经完成'), '场景提示声明E01已经完成');
ok(packed.data?.scenario?.includes('E02处于收尾活跃态'), '场景提示声明E02收尾活跃');
ok(packed.data?.scenario?.includes('E03尚未触发'), '场景提示声明E03尚未触发');
ok(!packed.data?.scenario?.includes('E01处于收尾活跃态'), '场景提示不残留旧E01活跃口径');
ok(packed.data?.description?.includes('酒馆助手4.9.1') && !packed.data?.description?.includes('4.8.19'), '角色描述使用当前酒馆助手版本');

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
ok(packedBook.entries.length === 102, '世界书包含102条维护条目（49既有 + 1概念路由 + 52事件概念）');
const conceptRouter = sourceBook.entries.find(entry => entry.id === 399);
ok(Boolean(conceptRouter), '概念事件预处理路由ID 399存在');
ok(conceptRouter.comment === '[机制]概念事件激活路由', '概念事件预处理路由名称固定');
ok(conceptRouter.constant === false, '概念事件预处理路由不是常驻提示词');
ok(Array.isArray(conceptRouter.keys) && conceptRouter.keys.length === 0, '概念事件预处理路由无关键词');
ok(Array.isArray(conceptRouter.secondary_keys) && conceptRouter.secondary_keys.length === 0, '概念事件预处理路由无二级关键词');
const conceptRouterContent = await readText(conceptRouter.content_file);
ok(conceptRouterContent.startsWith('@@preprocessing\n<%_'), '概念事件路由在酒馆世界书扫描前执行');
ok((conceptRouterContent.match(/^@@preprocessing$/gm) ?? []).length === 1, '概念事件路由仅含一个@@preprocessing装饰器');
ok(conceptRouterContent.includes('await getEnabledWorldInfoEntries()'), '概念事件路由读取当前启用世界书条目');
ok(conceptRouterContent.includes('await activewi(entry.world, entry.uid, true)'), '概念事件路由强制激活同一世界书UID');
ok(conceptRouterContent.includes('Math.abs(eventIndex - __conceptCurrentIndex) <= 3'), '概念事件路由保持当前锚点±3窗口');
ok(conceptRouterContent.includes('String(entry?.content ?? "").match') && conceptRouterContent.includes('JSON.parse(titleMatch[1])'), '概念事件路由在真机元数据缺失时从正文标题回退解析事件数组');
const conceptRouterStatements = [...conceptRouterContent.matchAll(/<%_?([\s\S]*?)_?%>/g)].map(match => match[1]).join('\n');
const executeConceptRouter = new Function('getvar', 'getEnabledWorldInfoEntries', 'activewi', `return (async () => {${conceptRouterStatements}})();`);
ok(true, '概念事件预处理路由EJS语法可解析');
const conceptRouterVisibleText = conceptRouterContent.replace(/^@@preprocessing\s*/, '').replace(/<%_?[\s\S]*?_?%>/g, '').trim();
ok(conceptRouterVisibleText === '', '概念事件预处理路由不输出模型提示词');
const packedConceptRouter = packedBook.entries.find(entry => entry.id === 399);
ok(Boolean(packedConceptRouter), '概念事件预处理路由已打包');
ok(packedConceptRouter.constant === false && packedConceptRouter.keys.length === 0, '打包路由保持非绿灯且无关键词');
ok(packedConceptRouter.content === conceptRouterContent, '打包路由与维护源码一致');
const conceptEntries = sourceBook.entries.filter(entry => entry.id >= 400 && entry.id <= 451);
const runtimeConceptEntries = [];
ok(conceptEntries.length === 52, '事件概念ID 400-451共52条');
ok(Object.keys(conceptKeywordAliases).length === 52, '概念关键词契约覆盖52条');
for (const conceptEntry of conceptEntries) {
  const conceptContent = await readText(conceptEntry.content_file);
  runtimeConceptEntries.push({ uid: conceptEntry.id, world: sourceBook.name, content: conceptContent });
  const conceptTitle = conceptEntry.comment.replace(/^\[概念·[^\]]+\]/, '');
  const expectedKeys = [conceptTitle, ...(conceptKeywordAliases[conceptTitle] ?? [])];
  ok(conceptContent.startsWith('# 概念·'), `${conceptEntry.comment}正文为静态概念内容`);
  ok(!conceptContent.includes('@@private') && !conceptContent.includes('<%'), `${conceptEntry.comment}不残留旧@@private或事件EJS外壳`);
  ok(conceptEntry.constant === false, `${conceptEntry.comment}使用酒馆原生绿灯而非常驻`);
  ok(JSON.stringify(conceptEntry.keys) === JSON.stringify(expectedKeys), `${conceptEntry.comment}主关键词与固定清单一致`);
  ok(Array.isArray(conceptEntry.secondary_keys) && conceptEntry.secondary_keys.length === 0, `${conceptEntry.comment}不使用二级关键词`);
  const eventIds = conceptEntry.extensions?.tavernweave?.event_ids;
  ok(Array.isArray(eventIds) && eventIds.length > 0, `${conceptEntry.comment}声明事件关联数组`);
  ok(eventIds.every(eventId => contract.required.event_ids.includes(eventId)), `${conceptEntry.comment}事件关联只使用E01-E20`);
  const headingMatch = conceptContent.match(/^# 概念·[^·]+·(.+?)（事件(\[[^\n]+\])）$/m);
  ok(Boolean(headingMatch), `${conceptEntry.comment}标题保留事件数组`);
  ok(headingMatch[1] === conceptTitle, `${conceptEntry.comment}标题名称与注册表一致`);
  ok(JSON.stringify(JSON.parse(headingMatch[2])) === JSON.stringify(eventIds), `${conceptEntry.comment}标题事件数组与注册表元数据一致`);
  const packedConcept = packedBook.entries.find(entry => entry.id === conceptEntry.id);
  ok(Boolean(packedConcept), `${conceptEntry.comment}已打包`);
  ok(packedConcept.constant === false, `${conceptEntry.comment}打包后保持原生绿灯`);
  ok(packedConcept.selective === false, `${conceptEntry.comment}打包后不启用二级筛选`);
  ok(JSON.stringify(packedConcept.keys) === JSON.stringify(expectedKeys), `${conceptEntry.comment}打包关键词与源码一致`);
  ok(Array.isArray(packedConcept.secondary_keys) && packedConcept.secondary_keys.length === 0, `${conceptEntry.comment}打包后无二级关键词`);
  ok(packedConcept.extensions?.scan_depth === null, `${conceptEntry.comment}继承宿主全局扫描深度`);
  ok(packedConcept.extensions?.case_sensitive === null, `${conceptEntry.comment}继承宿主大小写规则`);
  ok(JSON.stringify(packedConcept.extensions?.tavernweave?.event_ids) === JSON.stringify(eventIds), `${conceptEntry.comment}打包后保留事件元数据`);
  ok(packedConcept.content === conceptContent, `${conceptEntry.comment}打包正文与静态源码一致`);
}

function resolveConceptCurrentIndex(stateTable, omenId = '') {
  const ids = contract.required.event_ids;
  const activeIndex = ids.findIndex(id => stateTable[id]?.状态 === '活跃');
  if (activeIndex >= 0) return activeIndex;
  const omenIndex = ids.indexOf(omenId);
  if (omenIndex >= 0) return omenIndex - 1;
  for (let index = ids.length - 1; index >= 0; index--) {
    if (['完成', '变形', '取消'].includes(stateTable[ids[index]]?.状态)) return index;
  }
  return 0;
}

function simulateConceptActivation(stateTable, omenId, messages) {
  const currentIndex = resolveConceptCurrentIndex(stateTable, omenId);
  const activated = new Set();
  for (const entry of conceptEntries) {
    if (entry.extensions.tavernweave.event_ids.some(eventId => Math.abs(contract.required.event_ids.indexOf(eventId) - currentIndex) <= 3)) {
      activated.add(entry.id);
    }
  }
  for (const message of messages) {
    if (!['user', 'assistant'].includes(message.role)) continue;
    for (const entry of conceptEntries) {
      if (entry.keys.some(key => message.content.includes(key))) activated.add(entry.id);
    }
  }
  return [...activated];
}

const farEventState = Object.fromEntries(contract.required.event_ids.map(id => [id, { 状态: id === 'E20' ? '活跃' : '未触发' }]));
ok(simulateConceptActivation(initial.事件.锚点状态, '', []).includes(400), '双路矩阵：仅事件窗口可激活E01概念');
ok(simulateConceptActivation(farEventState, '', [{ role: 'user', content: '我想寻找拾荒者' }]).includes(400), '双路矩阵：事件窗外user别称触发原生绿灯');
ok(simulateConceptActivation(farEventState, '', [{ role: 'assistant', content: '人皮拾荒者正在靠近' }]).includes(400), '双路矩阵：事件窗外AI完整标题触发原生绿灯');
ok(!simulateConceptActivation(farEventState, '', [{ role: 'user', content: '今晚街道十分安静' }]).includes(400), '双路矩阵：事件窗外且无关键词不激活');
ok(!simulateConceptActivation(farEventState, '', [{ role: 'system', content: '人皮拾荒者' }]).includes(400), '双路矩阵：普通system消息不作为原生聊天绿灯输入');
ok(simulateConceptActivation(initial.事件.锚点状态, '', [{ role: 'user', content: '拾荒者' }]).filter(id => id === 400).length === 1, '双路矩阵：事件与关键词同时命中同一UID只保留一次');
const runtimeRouterActivations = [];
await executeConceptRouter(
  (path, options = {}) => {
    const eventId = path.match(/锚点状态\.(E\d{2})\.状态$/)?.[1];
    if (eventId) return initial.事件.锚点状态[eventId]?.状态 ?? options.defaults;
    if (path.endsWith('近期预兆.事件ID')) return initial.事件.近期预兆.事件ID;
    return options.defaults;
  },
  async () => runtimeConceptEntries,
  async (world, uid, force) => { runtimeRouterActivations.push({ world, uid, force }); },
);
const expectedRuntimeRouterIds = simulateConceptActivation(initial.事件.锚点状态, '', []).sort((a, b) => a - b);
const actualRuntimeRouterIds = runtimeRouterActivations.map(item => item.uid).sort((a, b) => a - b);
ok(JSON.stringify(actualRuntimeRouterIds) === JSON.stringify(expectedRuntimeRouterIds), '真机形态模拟：剥离自定义extensions后仍从标题解析并激活完整事件窗口');
ok(runtimeRouterActivations.every(item => item.world === sourceBook.name && item.force === true), '真机形态模拟：标题回退仍强制激活同一世界书UID');
const packedSchedule = packedBook.entries.find(entry => entry.comment === '[核心]自主世界事件调度');
ok(Boolean(packedSchedule), '打包常驻调度条目存在');
ok(packedSchedule.content.includes('## 事件详情窗口（按状态展开）'), '打包条目含事件详情窗口');
ok(packedSchedule.content.includes("detailWindow.indexOf('E02')"), '事件详情窗口含E02展开块');
ok(packedSchedule.content.includes('## 即时衔接段'), '打包条目仍含即时衔接段');

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
  if (sourceEntry.comment === '[核心]自主世界事件调度') {
    const expected = await expectedEntryContent(sourceEntry);
    ok(packedEntry.content.startsWith(expected) && packedEntry.content.includes('## 事件详情窗口（按状态展开）'), `${sourceEntry.comment}源码与打包内容一致（含生成详情窗口）`);
  } else {
    ok(packedEntry.content === await expectedEntryContent(sourceEntry), `${sourceEntry.comment}源码与打包内容一致`);
  }
}

let ejsEntryCount = 0;
for (const sourceEntry of sourceBook.entries) {
  const content = await expectedEntryContent(sourceEntry);
  if (compileEjsStatements(content, sourceEntry.comment)) {
    ejsEntryCount += 1;
    ok(true, `${sourceEntry.comment}的EJS语句可解析`);
  }
}
ok(ejsEntryCount >= 40, '全世界书EJS语法扫描覆盖所有动态条目');
const sharedEjsContent = (await Promise.all(sourceBook.entries
  .filter(entry => entry.id !== 399)
  .map(entry => expectedEntryContent(entry))))
  .filter(content => content.includes('<%') && !content.startsWith('@@private\n'))
  .join('\n');
ok(compileEjsStatements(sharedEjsContent, '共享EJS作用域'), '非private动态条目可在共享EJS作用域共同解析且无重复声明');

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
  ok(content.includes(`# ${eventId}·`), `${eventId}源码标题正确`);
  ok((content.match(new RegExp(`# ${eventId}·`, 'g')) || []).length >= 2, `${eventId}完整分支含标题`);
  ok(content.includes('<%_') && content.includes('getvar("stat_data.事件.锚点状态.'), `${eventId}蓝灯含EJS状态门槛`);
  ok(content.includes('- 完成条件：') && content.includes('- 取消条件：'), `${eventId}含收束条件（完成/取消）`);
  ok(content.includes('- 玩家主权：以下“默认走向”仅作原作因果参考'), `${eventId}明确默认走向不替玩家行动`);
  ok(content.includes('替代结果已稳定形成时才以“变形”收束'), `${eventId}把变形限定为稳定终态`);
  const defaultLine = content.split('\n').find(line => line.startsWith('- 默认走向：')) ?? '';
  const defaultLen = defaultLine.length - '- 默认走向：'.length;
  ok(defaultLen >= 200 && defaultLen <= 500, `${eventId}默认走向200-500字（当前${defaultLen}）`);
  for (const marker of eventFieldMarkers) ok(content.includes(marker), `${eventId}包含${marker}`);
}

const e01Content = await readText(sourceBook.entries.find(entry => entry.id === 300).content_file);
for (const token of ['系统觉醒', '魂灯', '拾荒者', '血锯外出']) {
  ok(e01Content.includes(token), `E01包含开店阶段内容：${token}`);
}
const e02Content = await readText(sourceBook.entries.find(entry => entry.id === 301).content_file);
for (const token of ['右眼', '找妈妈', '小本生意，不接受肉偿', '完成度2%', '物理治疗', '洋娃娃']) {
  ok(e02Content.includes(token), `E02按原文包含：${token}`);
}
const e04Content = await readText(sourceBook.entries.find(entry => entry.id === 303).content_file);
ok(e04Content.includes('如果你能活过今夜') && !e04Content.includes('活到明天'), 'E04夜危警告使用事件相对夜间而非明天');
const e06Content = await readText(sourceBook.entries.find(entry => entry.id === 305).content_file);
ok(e06Content.includes('一次诡异兑换机会') && e06Content.includes('不建立刷新、余额、库存或购买结算'), 'E06商城仅作一次性场景且不建立经济状态');
ok(e06Content.includes('是否兑换由玩家决定'), 'E06兑换行为保持玩家主权');
const growthPotionConcept = await readText('src/concepts/物品/血肉增生药剂.md');
ok(growthPotionConcept.includes('本卡不因此建立商城、库存、余额或购买结算'), '血肉增生药剂概念不反向创建经济系统');
ok(growthPotionConcept.includes('只有玩家实际选择后才成为当前事实'), '血肉增生药剂默认因果不覆盖玩家选择');

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
ok(initial.事件.锚点状态.E01.状态 === '完成', 'E01初始完成（开场白已完成开店阶段）');
ok(initial.事件.锚点状态.E02.状态 === '活跃', 'E02初始活跃收尾（血娃娃诊疗已完成）');
ok(initial.事件.锚点状态.E01.收尾 === true, 'E01初始收尾');
ok(initial.事件.锚点状态.E02.收尾 === true, 'E02初始收尾（诊疗完成、线索待处置）');
ok(initial.事件.锚点状态.E03.状态 === '未触发', 'E03初始未触发（纯事件驱动）');
ok(initial.事件.唯一活跃事件.事件ID === 'E02', 'E02是初始唯一活跃事件');
ok(assertSingleActive(initial.事件.锚点状态, initial.事件.唯一活跃事件), '初始重大事件唯一活跃');
ok(initial.事件.唯一活跃事件.进展.includes('血娃娃找妈妈'), 'E02进展包含寻母任务');
ok(initial.事件.唯一活跃事件.进展.includes('右眼'), 'E02进展包含右眼抵押');
ok(initial.事件.近期预兆.事件ID === '', '初始没有未来预兆');
ok(!/(?:昨天|昨日|昨夜|今天|今日|今早|今晨|明天|明日|次日|翌日|第二天)/.test(JSON.stringify(initial)), '初始变量不把原文相对日期带入后续事件状态');
ok(JSON.stringify(initial.事件.近期预兆) === JSON.stringify({
  事件ID: '', 方向: '', 地点: '', 参与者: [], 紧迫度: '无', 模糊期限: '',
}), '初始预兆使用规范空对象且无旧详情');
ok(validateEventLedger(initial.事件).length === 0, '初始事件账本通过完整跨字段不变量');

const transitionedEvents = cloneJson(initial.事件);
transitionedEvents.锚点状态.E02 = { ...transitionedEvents.锚点状态.E02, 状态: '完成', 收尾: true };
transitionedEvents.锚点状态.E03 = { ...transitionedEvents.锚点状态.E03, 状态: '预兆', 收尾: false };
transitionedEvents.唯一活跃事件 = {
  事件ID: '', 标题: '', 地点: '', 参与者: [], 状态: '无', 紧迫度: '无', 模糊期限: '', 进展: '', 幕后停止点: '',
};
transitionedEvents.近期预兆 = {
  事件ID: 'E03', 方向: '门外传来沉重脚步', 地点: '血锯药剂店门外', 参与者: [], 紧迫度: '中', 模糊期限: '傍晚前',
};
ok(validateEventLedger(transitionedEvents).length === 0, '事件迁移夹具：完整E02完成→E03预兆状态合法');
const atomicTransition = applyReplaceOperation(initial, '/事件', transitionedEvents);
ok(validateEventLedger(atomicTransition.事件).length === 0, '原子迁移矩阵：一次replace /事件通过整对象不变量');
const splitTransition = applyReplaceOperation(initial, '/事件/锚点状态/E02/状态', '完成');
ok(validateEventLedger(splitTransition.事件).includes('active-mismatch'), '分拆迁移负例：先改单个锚点会形成非法中间态');
const staleActive = cloneJson(transitionedEvents);
staleActive.唯一活跃事件.进展 = '旧事件残留';
ok(validateEventLedger(staleActive).includes('active-mismatch'), '负例：无活跃事件时旧详情残留会失败');
const staleOmen = cloneJson(transitionedEvents);
staleOmen.近期预兆 = { 事件ID: '', 方向: '旧预兆', 地点: '', 参与者: [], 紧迫度: '无', 模糊期限: '' };
ok(validateEventLedger(staleOmen).includes('empty-omen-not-canonical'), '负例：无预兆时旧详情残留会失败');
const duplicateOmen = cloneJson(transitionedEvents);
duplicateOmen.锚点状态.E04.状态 = '预兆';
ok(validateEventLedger(duplicateOmen).includes('omen-mismatch'), '负例：多个预兆锚点会失败');
const terminalWithoutTail = cloneJson(transitionedEvents);
terminalWithoutTail.锚点状态.E02.收尾 = false;
ok(validateEventLedger(terminalWithoutTail).includes('E02-terminal-without-tail'), '负例：终态收尾为false会失败');
const stringRecentResult = cloneJson(transitionedEvents);
stringRecentResult.最近结果 = ['E02：血娃娃诊疗完成'];
ok(validateEventLedger(stringRecentResult).includes('recent-results-invalid'), '负例：最近结果字符串数组会拒绝整次事件迁移');
const objectRecentResult = cloneJson(transitionedEvents);
objectRecentResult.最近结果 = [{ 事件ID: 'E02', 标题: '血娃娃上门与找妈妈任务', 结果: '诊疗完成', 世界影响: '寻母线索成为长期支线' }];
ok(validateEventLedger(objectRecentResult).length === 0, '最近结果四字段对象通过事件账本校验');
ok(Array.isArray(initial.事件.最近结果) && initial.事件.最近结果.length === 0, '初始最近结果为空');
ok(initial.关系.血衣女士.可见迹象.some(cue => cue.includes('头发')), '血衣女士可见迹象含寻母线索');
ok(initial.关系.小宝贝.好感 === 5, '小宝贝初始好感按两年投喂语义映射为低值');
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
for (const token of ['《诡异药剂师》v0.5', '0.5.0', '收尾', '恶堕', '左左', '血锯', '血衣女士', '小小', '人偶夫人', '泰坦头颅', '巫神头颅', '小宝贝']) {
  ok(schemaText.includes(token), `schema包含：${token}`);
}
ok(!schemaText.includes('爱丽丝') && !schemaText.includes('黑弦月'), 'schema不含爱丽丝与黑弦月');
ok(schemaText.includes("状态: z.enum(['活跃', '无'])") && !schemaText.includes("状态: z.enum(['活跃', '变形', '无'])"), '唯一活跃事件只接受活跃或无');
ok(schemaText.includes("value.状态 === '活跃'") && !schemaText.includes("value.状态 === '活跃' || value.状态 === '变形'"), 'schema仅把活跃锚点计入活跃槽');
ok(schemaText.includes('activeEmptyIsCanonical') && schemaText.includes('omenEmptyIsCanonical'), 'schema校验活跃事件与预兆的规范空对象');
ok(schemaText.includes('omenAnchors.length === 1') && schemaText.includes('近期预兆必须唯一对应预兆锚点'), 'schema校验唯一预兆锚点与详情一致');
ok(schemaText.includes('进入终态时收尾必须为true'), 'schema校验终态收尾为true');
ok(schemaText.includes('不得写星期、精确日期、X天时长') && schemaText.includes('昨天/昨日/昨夜/今天/今日/今早/今晨/明天/明日/次日/翌日/第二天'), 'schema拒绝星期、精确日期、天数时长与相对日期');

const helperNames = helperSource.map(script => script.name).join('；');
ok(helperNames.includes('v0.5'), '酒馆助手脚本命名含v0.5');
ok(helperSource.length === 2, '内嵌酒馆助手脚本2个');
ok(regexSource.length === 5, '正则脚本5个（状态栏、变量块、思考块的提示词与显示隔离）');
const hideStatusRegex = regexSource.find(script => script.id === 'tavernweave-hide-status-prompt-v0.5');
ok(Boolean(hideStatusRegex), '存在对AI隐藏状态栏占位符正则');
ok(hideStatusRegex.promptOnly === true && hideStatusRegex.markdownOnly === false, '状态栏占位符只从提示词隐藏');
ok(hideStatusRegex.replaceString === '', '状态栏占位符提示词替换为空');
const hideThinkPrompt = regexSource.find(script => script.id === 'tavernweave-hide-think-prompt-v0.5');
const hideThinkDisplay = regexSource.find(script => script.id === 'tavernweave-hide-think-display-v0.5');
ok(Boolean(hideThinkPrompt) && Boolean(hideThinkDisplay), '思考块具有提示词历史与Markdown显示两条独立过滤器');
ok(hideThinkPrompt.promptOnly === true && hideThinkPrompt.markdownOnly === false, '思考块提示词过滤器只作用于模型历史');
ok(hideThinkDisplay.promptOnly === false && hideThinkDisplay.markdownOnly === true, '思考块显示过滤器只作用于Markdown显示');
for (const script of [hideThinkPrompt, hideThinkDisplay]) {
  const fixtureRegex = regexFromLiteral(script.findRegex);
  ok('<think>secret</think><p>answer</p>'.replace(fixtureRegex, '') === '<p>answer</p>', `${script.id}移除闭合think块且保留正文`);
  const ordinary = '<thinking>ordinary</thinking><p>answer</p>';
  ok(ordinary.replace(regexFromLiteral(script.findRegex), '') === ordinary, `${script.id}不误删thinking普通标签`);
  const unclosed = '<think>unfinished but visible';
  ok(unclosed.replace(regexFromLiteral(script.findRegex), '') === unclosed, `${script.id}不吞掉未闭合的普通回复`);
}
const packedRegexScripts = packed.data.extensions.regex_scripts;
ok(Array.isArray(packedRegexScripts) && packedRegexScripts.length === regexSource.length, '打包正则数量与源码一致');
for (const sourceRegex of regexSource) {
  const packedRegex = packedRegexScripts.find(script => script.id === sourceRegex.id);
  ok(Boolean(packedRegex), `正则已打包：${sourceRegex.id}`);
  ok(packedRegex.promptOnly === sourceRegex.promptOnly && packedRegex.markdownOnly === sourceRegex.markdownOnly, `正则作用域一致：${sourceRegex.id}`);
}

const srcFiles = await listFiles('src');
const allSrcText = (await Promise.all(srcFiles.map(file => readText(file, false)))).join('\n');
ok(srcFiles.length >= 150, `全卡源码扫描覆盖${srcFiles.length}个文件`);
ok(!allSrcText.includes('爱丽丝'), 'src源码不含爱丽丝残留引用');
ok(!allSrcText.includes('扮演20岁的林恩'), '全卡源码不残留20岁林恩冲突');
for (const staleText of ['E01的寻母线索', 'E12完成后不自动创建第149章', '紧贴林恩的感知、判断与情绪']) {
  ok(!allSrcText.includes(staleText), `全卡源码不残留旧口径：${staleText}`);
}
const modelVisibleSrcFiles = srcFiles.filter(file => /\.(?:md|txt|html)$/i.test(file));
const modelVisibleSrcText = (await Promise.all(modelVisibleSrcFiles.map(file => readText(file, false)))).join('\n');
const blackMoonCount = (modelVisibleSrcText.match(/黑弦月/g) ?? []).length;
ok(blackMoonCount > 0 && blackMoonCount <= 20, '黑弦月只保留为E20物品概念及受事件门控的到货/租借语境');
ok(!sourceBook.entries.some(entry => entry.comment.includes('[角色]黑弦月') || entry.comment.includes('[角色]爱丽丝')), '世界书注册表无爱丽丝/黑弦月角色词条');
ok(!Object.prototype.hasOwnProperty.call(initial.关系, '爱丽丝') && !Object.prototype.hasOwnProperty.call(initial.关系, '黑弦月'), '关系变量无爱丽丝/黑弦月');
ok(allSrcText.includes('<%_ if'), '角色蓝灯使用EJS条件分段');
const witchStageText = await readText('src/characters/巫神头颅/多阶段人设.md');
ok(witchStageText.indexOf('锚点状态.E16') < witchStageText.indexOf('猎神者打崩小小乳牙'), '巫神头颅E16战果先经过登场门控再出现');
ok(witchStageText.includes('## 未登场阶段') && witchStageText.includes('不得被写成已经到场'), '巫神头颅E16前有充足未登场占位');

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
ok(openingInitVar.事件.锚点状态.E01.状态 === '完成', '开场白initvar E01完成');
ok(openingInitVar.事件.锚点状态.E02.状态 === '活跃', '开场白initvar E02活跃收尾');
ok(openingInitVar.事件.锚点状态.E03.状态 === '未触发', '开场白initvar E03未触发');
ok(openingInitVar.事件.近期预兆.事件ID === '', '开场白initvar无未来预兆');
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
ok(!systemPromptText.includes('{{original}}'), '系统提示不依赖未注册original宏');
ok(systemPromptText.includes('MVU状态必须保持连续'), '系统提示含状态连续性规则');
ok(systemPromptText.includes('仅用一条`replace /事件`提交'), '系统提示要求事件身份迁移原子提交');
ok(systemPromptText.includes('任何“X天”时长') && systemPromptText.includes('昨天/昨日/昨夜/今天/今日/今早/今晨/明天/明日/次日/翌日/第二天') && systemPromptText.includes('持续已久') && systemPromptText.includes('不带日历单位'), '系统提示禁止天数时长与相对日期泄露并提供无日历单位替代写法');
ok(systemPromptText.includes('<dream_scene><date>') && systemPromptText.includes('觉醒日 周一'), '系统提示显式约束宿主日期栏与日历化反例');
ok(systemPromptText.includes('毫不犹豫') && systemPromptText.includes('心中已经判断'), '系统提示禁止给已声明动作附加玩家态度与内心定性');
ok(systemPromptText.includes('精准补刀') && systemPromptText.includes('仔细检查'), '系统提示禁止给已声明动作附加执行质量评价');
ok(systemPromptText.includes('玩家声明的一组动作兑现完毕后') && systemPromptText.includes('姿态、表情、视线、语气'), '系统提示限制玩家动作后的无声明续写');
ok(systemPromptText.includes('E02改为`完成`') && systemPromptText.includes('E03改为`预兆`') && systemPromptText.includes('非法半迁移'), '系统提示强制开场E02→E03同轮事务');
const worldPromptText = await readText('src/prompts/world.md');
ok(worldPromptText.includes('每轮强制输出协议') && worldPromptText.includes('<StatusPlaceHolderImpl/>') && worldPromptText.includes('<JSONPatch>'), '常驻世界书核心镜像状态栏与JSON Patch协议');
ok(worldPromptText.includes('不得自行补写坐回高脚凳') && worldPromptText.includes('面无表情') && worldPromptText.includes('静静等待'), '常驻世界书核心镜像玩家主语白名单');
ok(worldPromptText.includes('不得使用`<setvar>`') && worldPromptText.includes('未注入角色卡的`system_prompt`或`post_history`'), '常驻世界书核心防止兼容预设降级为setvar');
const postHistoryText = await readText('src/prompts/post_history.md');
ok(!postHistoryText.includes('{{original}}'), '后置历史提示不依赖未注册original宏');
ok(worldPromptText.includes('安静地等待') && worldPromptText.includes('留在位置上等待') && systemPromptText.includes('安静地留在位置上') && postHistoryText.includes('留在位置上等待'), '等待语义不得扩写玩家姿态的约束已镜像到关键注入层');
ok(worldPromptText.includes('结果化被动句') && worldPromptText.includes('腹腔被打开；血婴被完整取出；切口处理完毕') && systemPromptText.includes('没有丝毫迟疑') && postHistoryText.includes('不得拆成按住、持刀、戴手套、消毒'), '概括动作不得扩写程序细节的硬约束已镜像到关键注入层');
ok(postHistoryText.includes('状态连续性'), '后置历史协议含状态连续性规则');
ok(postHistoryText.includes('<date>E05收尾·黎明</date>') && postHistoryText.includes('<date>觉醒日 周一（推断）</date>'), '后置历史协议含日期栏正反例');
ok(postHistoryText.includes('不附加“毫不犹豫”') && postHistoryText.includes('心中已经判断'), '后置历史协议限制动作复述的附加定性');
ok(postHistoryText.includes('“精准补刀”') && postHistoryText.includes('“仔细检查”'), '后置历史协议限制动作复述的精准与仔细评价');
ok(postHistoryText.includes('玩家主语白名单自检') && postHistoryText.includes('端坐、双手交叉、面无表情、冷眼旁观'), '后置历史协议含玩家主语白名单与真机反例');
ok(postHistoryText.includes('E02=`完成`') && postHistoryText.includes('E03=`预兆`') && postHistoryText.includes('不能只在正文写门外来客'), '后置历史协议强制开场E02→E03原子迁移');
ok(systemPromptText.includes('`事件.最近结果`始终是对象数组') && worldPromptText.includes('禁止写成字符串数组') && postHistoryText.includes('四字段对象，绝不能写成字符串'), '最近结果对象契约镜像到系统、常驻世界书与后置协议');
ok(systemPromptText.includes('时间检查只能写“时间格式合规”') && postHistoryText.includes('否定式复述同样违规'), '系统与后置协议禁止在隐藏分析中否定式复述时间禁词');

const undeclaredPlayerStateRiskPattern = /(?:林恩|你)[^。！？\n]{0,24}(?:端坐|双手交叉|面无表情|冷眼旁观|毫无波澜|机械地等待)/;
for (const fixture of [
  { text: '你面无表情地坐回柜台后。', risky: true, name: '玩家未声明表情' },
  { text: '林恩双手交叉，冷眼旁观。', risky: true, name: '玩家未声明姿态' },
  { text: '门外的怪物捂住伤口，魂灯火苗向内收缩。', risky: false, name: '环境与NPC结果' },
]) {
  ok(undeclaredPlayerStateRiskPattern.test(fixture.text) === fixture.risky, `玩家主语风险夹具：${fixture.name}`);
}

const undeclaredActionQualityRiskPattern = /(?:(?:精准|飞快)(?:地)?(?:补刀|检查|操作|切开|拔出|安装|处理|清理|擦净|缝合)|仔细(?:地)?(?:检查|操作|处理|安装|观察))/;
for (const fixture of [
  { text: '剔骨刀精准补刀，威胁被清除。', risky: true, name: '补刀执行质量' },
  { text: '咬合与止痛效果得到了仔细检查。', risky: true, name: '检查执行质量' },
  { text: '切口被飞快地缝合完毕。', risky: true, name: '快速动作执行质量' },
  { text: '黑店传闻在游魂巷飞快地传开。', risky: false, name: '环境传播速度不属于玩家动作' },
  { text: '剔骨刀完成补刀，咬合与止痛效果检查完毕。', risky: false, name: '无评价的客观结果' },
]) {
  ok(undeclaredActionQualityRiskPattern.test(fixture.text) === fixture.risky, `玩家动作质量风险夹具：${fixture.name}`);
}

const forbiddenCalendarPattern = /(?:星期[一二三四五六日天]|周[一二三四五六日天]|(?:第\s*)?(?:\d+|[一二三四五六七八九十百千万]+|好几|好多|很多|数|几|多)\s*天|昨天|昨日|昨夜|今天|今日|今早|今晨|明天|(?<!黎)明日|次日|翌日|第二天|\d{4}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2}\s*日?|\d{1,2}月\d{1,2}日)/;
for (const fixture of [
  { text: '<dream_scene><date>E05收尾·黎明</date></dream_scene>', forbidden: false, name: '事件锚点相对时段' },
  { text: '<dream_scene><date>觉醒日 周一（推断）</date></dream_scene>', forbidden: true, name: '宿主日期栏周一' },
  { text: '<dream_scene><date>觉醒日 周二</date></dream_scene>', forbidden: true, name: '宿主日期栏周二' },
  { text: '第2天·清晨', forbidden: true, name: '第N天' },
  { text: '系统觉醒日次日·黎明', forbidden: true, name: '相对天数次日' },
  { text: '翌日清晨', forbidden: true, name: '相对天数翌日' },
  { text: '第二天傍晚', forbidden: true, name: '相对天数第二天' },
  { text: '昨天夜里进了一批新货', forbidden: true, name: '相对日期昨天' },
  { text: '今天早上开始腹痛', forbidden: true, name: '相对日期今天' },
  { text: '明天还会再来', forbidden: true, name: '相对日期明天' },
  { text: '昨夜吞下了异常血肉', forbidden: true, name: '相对日期昨夜' },
  { text: '明日再来复诊', forbidden: true, name: '相对日期明日' },
  { text: '黎明日常继续推进', forbidden: false, name: '黎明日常不误判为明日' },
  { text: '牙已经疼了好几天', forbidden: true, name: '模糊天数时长' },
  { text: '牙已经疼了很多天', forbidden: true, name: '很多天时长' },
  { text: '症状持续三天', forbidden: true, name: '中文数字天数时长' },
  { text: '牙疼已经持续一阵子', forbidden: false, name: '允许无日历单位时长' },
  { text: '能力持续24小时', forbidden: false, name: '允许能力小时限期' },
  { text: '今夜魂灯熄灭', forbidden: false, name: '允许事件相对夜间' },
  { text: '2026-08-10', forbidden: true, name: '精确日历日期' },
]) {
  ok(forbiddenCalendarPattern.test(fixture.text) === fixture.forbidden, `时间格式夹具：${fixture.name}`);
}

const mainlineText = await readText('src/prompts/mainline.md');
ok(mainlineText.includes('锚点优先于原创'), '事件调度含锚点优先规则');
ok(mainlineText.includes('不要用原创客人占位'), '事件调度禁止原创占位');
ok(mainlineText.includes('衔接优先'), '事件调度含衔接优先规则');
ok(mainlineText.includes('未满足时'), '调度规则含触发时机守卫');
ok(mainlineText.includes('强制事务：开场基线E02') && mainlineText.includes('唯一活跃事件=标准空对象') && mainlineText.includes('近期预兆.事件ID=`E03`'), '事件调度含开场E02→E03强制事务');
const updateRulesText = await readText('src/prompts/mvu_update_rules.md');
ok(worldPromptText.includes('昨天/昨日/昨夜/今天/今日/今早/今晨/明天/明日/次日/翌日/第二天') && systemPromptText.includes('系统觉醒日次日·黎明') && postHistoryText.includes('任何“X天”时长') && updateRulesText.includes('能力的24小时时限仍可使用') && worldPromptText.includes('持续已久') && postHistoryText.includes('不带日历单位') && updateRulesText.includes('一阵子'), '相对日与天数时长禁令及正向替代写法镜像到常驻提示及MVU更新规则');
ok(updateRulesText.includes('支线可以长期挂起'), '更新规则允许支线挂起');
ok(updateRulesText.includes('不要用原创客人占位'), '更新规则禁止原创占位');
ok(updateRulesText.includes('衔接优先'), '更新规则含衔接优先');
ok(updateRulesText.includes('第一轮推进语'), '更新规则含开场后第一轮推进语规则');
ok(updateRulesText.includes('未满足时'), '更新规则含触发时机守卫');
ok(updateRulesText.includes('"path":"/事件"') && updateRulesText.includes('禁止把一次事件迁移拆成多个'), '更新规则要求原子replace完整事件根');
ok(updateRulesText.includes('`变形`是替代结果已经稳定形成的收束态'), '更新规则明确变形为稳定终态');
ok(updateRulesText.includes('没有活跃事件') && updateRulesText.includes('没有预兆时'), '更新规则定义活跃事件与预兆规范空对象');
ok(updateRulesText.includes('开场基线特例是强制事务') && updateRulesText.includes('E02=`完成/收尾=true`') && updateRulesText.includes('近期预兆=指向E03'), '更新规则强制开场E02→E03完整迁移');
ok(updateRulesText.includes('类型固定为对象数组') && updateRulesText.includes('字符串数组代替'), '更新规则显式禁止最近结果字符串数组');
const outputFormatText = await readText('src/prompts/mvu_output_format.md');
ok(outputFormatText.includes('<StatusPlaceHolderImpl/>') && outputFormatText.includes('禁止使用`<setvar>`') && outputFormatText.includes('没有注入角色卡`post_history`'), '变量输出格式兼容省略post-history的预设');
ok(outputFormatText.includes('`最近结果`必须始终是对象数组') && outputFormatText.includes('绝不能把它简写成字符串数组'), '输出格式显式保留最近结果四字段对象契约');
ok(outputFormatText.includes('时间检查只写“时间格式合规”') && outputFormatText.includes('不得在`Analysis`中复述'), '输出格式把时间自检限定为无禁词短句');
const systemPromptRules = await readText('src/prompts/system.md');
ok(systemPromptRules.includes('锚点优先于原创'), '系统提示含锚点优先规则');
ok(systemPromptRules.includes('衔接优先'), '系统提示含衔接优先规则');
ok(systemPromptRules.includes('第一轮推进语'), '系统提示含开场后第一轮推进语规则');
ok(systemPromptRules.includes('未满足时'), '系统提示含触发时机守卫');
ok(systemPromptRules.includes('默认走向') && systemPromptRules.includes('绝不能把其中的林恩对白'), '系统提示保护玩家对林恩的叙事主权');
ok(mainlineText.includes('同步把对应锚点`状态`置为`预兆`'), '调度规则要求预兆同步锚点状态');
ok(updateRulesText.includes('在待提交的完整`事件`对象内') && updateRulesText.includes('对应锚点状态置为`预兆`'), '更新规则要求在完整事件对象中同步预兆锚点状态');
ok(systemPromptRules.includes('同步把对应锚点`状态`置为`预兆`'), '系统提示要求预兆同步锚点状态');
ok(updateRulesText.includes('二十个锚点状态'), '更新规则锚点计数为二十个');
ok(!updateRulesText.includes('十二个锚点'), '更新规则无旧版十二个锚点残留');

for (let index = 0; index < 19; index += 1) {
  const eventId = contract.required.event_ids[index];
  const eventContent = await readText(sourceBook.entries.find(entry => entry.id === 300 + index).content_file);
  ok(eventContent.includes('## 下一事件引入'), `${eventId}蓝灯含下一事件引入段`);
}
const e01Bridge = await readText(sourceBook.entries.find(entry => entry.id === 300).content_file);
ok(e01Bridge.includes('## 下一事件引入（E02'), 'E01引入段指向E02');
const e20Content = await readText(sourceBook.entries.find(entry => entry.id === 319).content_file);
ok(!e20Content.includes('## 下一事件引入'), 'E20不含后续引入段（不设计续接）');
ok(mainlineText.includes('事件上下文窗口（常驻·按状态定位）'), '调度规则含事件上下文窗口');
ok(mainlineText.includes('cur - 3'), '上下文窗口前后各3个事件');
ok(mainlineText.includes('◆当前'), '上下文窗口标注当前事件');
ok(mainlineText.includes('detailWindow'), '上下文窗口计算事件详情窗口');
ok(mainlineText.includes('E20收束后不设计续接'), '上下文窗口明确E20收束边界');
ok(mainlineText.includes('## 即时衔接段（常驻·按状态渲染）'), '常驻即时衔接段存在');
ok(mainlineText.includes('getvar("stat_data.事件.锚点状态.'), '衔接段使用getvar状态门控');
ok(mainlineText.includes('"活跃"') && mainlineText.includes('"变形"') && mainlineText.includes('"完成"') && mainlineText.includes('"取消"') && mainlineText.includes('"未触发"') && mainlineText.includes('"预兆"'), '衔接段门控覆盖六态');
ok(mainlineText.includes('收尾'), '衔接门控含收尾标记');
const bridgePairs = [['E01','E02'],['E02','E03'],['E03','E04'],['E04','E05'],['E05','E06'],['E06','E07'],['E07','E08'],['E08','E09'],['E09','E10'],['E10','E11'],['E11','E12'],['E12','E13'],['E13','E14'],['E14','E15'],['E15','E16'],['E16','E17'],['E17','E18'],['E18','E19'],['E19','E20']];
for (const [from, to] of bridgePairs) {
  ok(mainlineText.includes(`### ${from}→${to}`), `即时衔接段包含${from}→${to}`);
}
ok(!mainlineText.includes('### E20→'), '衔接段不包含E20后续');
ok(mainlineText.includes('洋娃娃') && mainlineText.includes('断臂'), 'E01→E02引子token齐全');
ok(mainlineText.includes('猪类') && mainlineText.includes('拍门'), 'E02→E03引子token齐全');
ok(mainlineText.includes('求援信'), 'E14→E15引子token齐全');
ok(mainlineText.includes('空白信纸') && mainlineText.includes('是否发送均未决定'), 'E14→E15停在玩家可决定的求援节点');
ok(mainlineText.includes('茧囊路径') && mainlineText.includes('是否进入、如何使用药剂'), 'E11→E12停在玩家可决定的灾变节点');
ok(updateRulesText.includes('下一事件引入'), '更新规则引用蓝灯引入段');
ok(updateRulesText.includes('收尾'), '更新规则含收尾标记规则');
ok(systemPromptRules.includes('下一事件引入'), '系统提示引用蓝灯引入段');

const statusUiText = await readText('src/ui/status.html', false);
ok(statusUiText.includes('FALLBACK_STATE'), '状态栏内嵌初始状态回退');
ok(statusUiText.trimStart().startsWith('<body>'), '状态栏含酒馆助手可识别的body前端标记');
ok(statusUiText.includes('data-wa-status-root'), '状态栏使用稳定根节点标记');
for (const character of characters) {
  ok(statusUiText.includes(`"${character}":`), `状态栏回退状态包含：${character}`);
}
ok(statusUiText.includes('"恶堕":  0'), '状态栏回退状态恶堕值初始为0');
ok(statusUiText.includes('"E01":') && statusUiText.includes('"状态":  "完成"'), '状态栏回退状态E01完成');
ok(statusUiText.includes('"E02":') && statusUiText.includes('"状态":  "活跃"'), '状态栏回退状态E02活跃');
ok(statusUiText.includes('"E03":') && statusUiText.includes('"状态":  "未触发"'), '状态栏回退状态E03未触发');
ok(statusUiText.includes('"事件ID":  "E02"'), '状态栏回退有活跃事件');
ok(statusUiText.includes('"事件ID":  ""'), '状态栏回退近期预兆为空');
ok(statusUiText.includes('17岁'), '状态栏年龄标签为17岁');
ok(statusUiText.includes('wa-advance-btn'), '状态栏含手动推进按钮');
ok(statusUiText.includes('推进：'), '状态栏按钮含推进文案');
ok(statusUiText.includes('replaceMvuData'), '状态栏按钮使用MVU写入接口');
ok(statusUiText.includes("message_id: 'latest'"), '状态栏推进只从latest读取并写回latest');
ok(statusUiText.includes('persistLatestMessageData') && statusUiText.includes('setChatMessages'), '状态栏把推进结果同步到最新消息变量');
ok(statusUiText.includes('orderedHosts') && statusUiText.includes('saveChat'), '状态栏优先通过父宿主等待聊天落盘');
ok(statusUiText.includes('currentIsLatest'), '状态栏区分最新楼层与历史楼层');
ok(statusUiText.includes('历史楼层只读'), '状态栏明确禁用历史楼层写入');
ok(statusUiText.includes('persistedDataReady'), '状态栏区分API就绪与持久变量就绪');
ok(statusUiText.includes('等待变量初始化'), '状态栏未初始化时显示明确状态');
ok(statusUiText.includes("waitGlobalInitialized('Mvu')"), '状态栏通过酒馆助手等待MVU全局注入');
ok(statusUiText.includes('waitForMvuBridge'), '状态栏会等待酒馆助手握手函数延迟就绪');
ok(statusUiText.includes('writeInFlight'), '状态栏具备单次写入锁');
ok(statusUiText.includes('uiAbortController.abort()'), '状态栏卸载时清理交互监听');
ok(statusUiText.includes('subscriptions.length = 0'), '状态栏卸载时清理MVU订阅');
ok(statusUiText.includes('findReadyPair'), '状态栏含事件就绪判定');
ok(statusUiText.includes('收尾'), '状态栏按钮就绪含收尾判定');
ok(statusUiText.includes("toState === '未触发'") && statusUiText.includes('已有近期预兆'), '状态栏不重复推进已存在的预兆并在写前二次防守');
ok(statusUiText.includes("anchor => anchor.状态 === '活跃'"), '状态栏只把活跃锚点计入唯一活跃事件');
ok(statusUiText.includes('activeSource') && statusUiText.includes('hasActive') && statusUiText.includes('暂无活跃事件详情'), '状态栏规范化无活跃事件并隐藏旧详情');
ok(statusUiText.includes('omenSource') && statusUiText.includes('hasOmen') && statusUiText.includes('暂无近期预兆'), '状态栏规范化无预兆并隐藏旧详情');
ok(statusUiText.includes("['完成', '变形', '取消'].includes(fromAnchor.状态)) fromAnchor.收尾 = true"), '状态栏推进同步终态收尾标记');
ok(statusUiText.includes('wa-tab-system'), '状态栏含系统页');
const statusScripts = [...statusUiText.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
ok(statusScripts.length === 1, '状态栏只有一个内联脚本');
for (const script of statusScripts) {
  new Function(script);
  ok(true, '状态栏内联脚本语法可解析');
}

const schemaValidation = initial.事件.锚点状态;
for (const eventId of contract.required.event_ids) {
  ok(['未触发', '预兆', '活跃', '变形', '完成', '取消'].includes(schemaValidation[eventId].状态), `${eventId}状态合法`);
  ok(typeof schemaValidation[eventId].收尾 === 'boolean', `${eventId}收尾标记合法`);
}

const sha256 = createHash('sha256').update(packedText).digest('hex');
const bytes = Buffer.byteLength(packedText);

console.log(JSON.stringify({
  status: 'validated',
  offline_validation: 'passed',
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
