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

function renderEjsForEventStates(content, stateTable) {
  const source = content.replace(/^@@private\s*/, '');
  let code = 'let __out = "";\n';
  let cursor = 0;
  for (const match of source.matchAll(/<%([-_=]?)([\s\S]*?)[-_]?%>/g)) {
    const index = match.index ?? 0;
    code += `__out += ${JSON.stringify(source.slice(cursor, index))};\n`;
    if (match[1] === '=' || match[1] === '-') code += `__out += String(${match[2]});\n`;
    else code += `${match[2]}\n`;
    cursor = index + match[0].length;
  }
  code += `__out += ${JSON.stringify(source.slice(cursor))};\nreturn __out;`;
  const getvar = (path, options = {}) => {
    const eventMatch = String(path).match(/^stat_data\.事件\.锚点状态\.(E\d{2})\.状态$/);
    if (eventMatch) return stateTable[eventMatch[1]]?.状态 ?? options.defaults;
    return options.defaults;
  };
  return new Function('getvar', code)(getvar);
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

const legacyConceptKeywordAliases = {
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

const conceptKeywordAliases = {};

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

ok(manifest.version === '0.7.0', 'manifest版本为0.7.0');
ok(profile.version === manifest.version, 'profile版本同步');
ok(contract.version === manifest.version, 'contract版本同步');
ok(cardSource.character_version === manifest.version, '角色卡版本同步');
ok(manifest.worldbook.version === manifest.version, '世界书版本同步');
ok(manifest.runtime_dependencies.find(item => item.id === 'tavern-helper')?.version === contract.required.host_versions.tavern_helper, 'manifest与contract酒馆助手版本同步');
ok(cardSource.creator_notes.includes('酒馆助手 4.9.1') && !cardSource.creator_notes.includes('4.8.19'), '角色卡备注使用当前酒馆助手版本');
ok(manifest.card.stable_id === 'weird-apothecary-blood-saw-shop', '卡片稳定ID保持不变');
ok(manifest.worldbook.stable_id === 'weird-apothecary-worldbook', '世界书稳定ID保持不变');
ok(manifest.packed_json === 'dist/诡异药剂师_v0.7.json', '产物文件名正确');
ok(cardSource.name === '《诡异药剂师》v0.7', '显示名正确');
ok(profile.ui_variant === 'death_realm_four_page', '四页死界UI配置正确');
ok(profile.update_protocol === 'UpdateVariable.JSONPatch', '更新协议正确');
ok(contract.required.internal_before_v1 === true, 'v1.0前内部版本已声明');
ok(contract.required.stage_scope.includes('第1至431章') && contract.required.stage_scope.includes('第277至431章') && contract.required.stage_scope.includes('小总结14至20'), '阶段范围已声明');
ok(contract.required.core_character_count === 24, '二十四名核心人物');
ok(contract.required.event_ids.length === 64, '六十四事件锚点');
ok(contract.required.time_progression.includes('纯事件驱动'), '纯事件驱动已声明');
ok(contract.required.evil_value_scope.includes('恶堕全面开放无锁') && contract.required.evil_value_scope.includes('固定非恋爱男性角色') && !contract.required.evil_value_scope.includes('幼态'), '女性恶堕全面开放、固定非恋爱男性锁定0已声明且无幼态锁残留');
ok(contract.required.event_state_semantics.includes('only 活跃 is active') && contract.required.event_state_semantics.includes('变形 is a terminal'), '契约声明变形为稳定终态且仅活跃态占用活跃槽');
ok(contract.required.event_transition_patch.includes('replaces /事件 atomically'), '契约声明跨锚点迁移原子替换完整事件根');
ok(contract.required.empty_event_objects.includes('canonical fully cleared'), '契约声明活跃事件与预兆的规范空对象');
ok(contract.required.host_versions?.sillytavern === '1.17.0' && contract.required.host_versions?.tavern_helper === '4.9.1', '契约宿主版本与已测环境一致');
ok(!contract.forbidden.systems.includes('level') && contract.forbidden.systems.includes('level_progression_system'), '契约区分原文等级记录与禁用的等级成长系统');
ok(contract.required.concept_activation?.router_entry_id === 399, '概念事件路由ID契约固定');
ok(contract.required.concept_activation?.concept_id_start === 400
  && contract.required.concept_activation?.concept_id_end === 550
  && contract.required.concept_activation?.new_concept_id_start === 493
  && contract.required.concept_activation?.new_concept_id_end === 550, '概念UID契约覆盖既有400-492与新增493-550');
ok(contract.required.concept_activation?.mode === 'event_window_or_native_green', '概念双路激活模式已声明');
ok(contract.required.concept_activation?.event_window_radius === 1, '概念事件窗口半径为1');
ok(JSON.stringify(contract.required.concept_activation?.native_chat_roles) === JSON.stringify(['user', 'assistant']), '原生绿灯聊天角色为user+assistant');
ok(contract.required.concept_activation?.inherit_global_scan_depth === true, '原生绿灯继承宿主全局扫描深度');
ok(contract.required.concept_activation?.deduplicate_by === 'world.uid', '双路激活按world.uid去重');
ok(contract.required.concept_activation?.stage1_enriched_concept_start === 400
  && contract.required.concept_activation?.stage1_enriched_concept_end === 451, '阶段一详写契约覆盖UID400-451共52条');
ok(JSON.stringify(contract.required.concept_activation?.detailed_static_format) === JSON.stringify(['事实门槛', '定义', '来源', '机制', '限制与代价', '未知项', '禁止外推']), '概念静态字段契约固定');
ok(JSON.stringify(contract.required.concept_activation?.detailed_variant_format) === JSON.stringify(['事件演进', '当前状态']), '概念变体必含字段契约固定');
ok(contract.required.concept_activation?.state_variants?.mode === 'event_state_gated_variants', '概念状态变体模式已声明');
ok(contract.required.concept_activation?.state_variants?.gate_source === 'stat_data.事件.锚点状态.<事件ID>.状态', '概念变体门控来源为事件锚点状态');
ok(JSON.stringify(contract.required.concept_activation?.state_variants?.gate_states) === JSON.stringify(['完成', '变形']), '概念变体只认完成与变形');
ok(contract.required.concept_activation?.state_variants?.baseline_required === true, '概念变体兜底必带');
ok(JSON.stringify(contract.required.concept_activation?.state_variants?.variant_required_fields) === JSON.stringify(['事件演进', '当前状态']), '概念变体必含字段与契约一致');
ok(contract.required.concept_activation?.state_variants?.static_form_allowed === true, '概念静态形态仍允许');
ok(contract.required.event_context_windows?.detail_radius === 1, '事件详情窗口半径保持1');
ok(contract.required.event_context_windows?.summary_radius === 3, '事件摘要与衔接上下文窗口半径保持3');
ok(contract.required.event_context_windows?.detail_source_uid === 1, '事件全文唯一运行时来源为UID1');
ok(contract.required.event_context_windows?.material_entry_start === 300
  && contract.required.event_context_windows?.material_entry_end === 363
  && contract.required.event_context_windows?.material_entries_enabled === false, 'UID300-363仅作禁用构建素材');
ok(contract.required.character_activation?.router_entry_id === 399, '人物与概念复用预处理路由ID 399');
ok(contract.required.character_activation?.character_count === 24, '人物事件路由覆盖24名核心人物');
ok(contract.required.character_activation?.mode === 'event_cast_window_or_native_green', '人物事件与原生姓名双路模式已声明');
ok(contract.required.character_activation?.event_window_radius === 1, '人物事件窗口半径为1');
ok(JSON.stringify(contract.required.character_activation?.native_chat_roles) === JSON.stringify(['user', 'assistant']), '人物原生绿灯聊天角色为user+assistant');
ok(contract.required.character_activation?.inherit_global_scan_depth === true, '人物原生绿灯继承宿主全局扫描深度');
ok(contract.required.character_activation?.deduplicate_by === 'world.uid', '人物双路激活按world.uid去重');
ok(contract.required.character_activation?.route_kind === 'character', '人物路由类型固定为character');
ok(profile.capabilities.includes('native_worldbook_keyword_activation'), 'profile声明酒馆原生关键词激活能力');
ok(profile.capabilities.includes('event_window_concept_activation'), 'profile声明事件窗口概念激活能力');
ok(profile.capabilities.includes('event_window_character_activation'), 'profile声明事件窗口人物激活能力');
ok(hostAcceptance.version === manifest.version, '宿主验收记录版本同步');
ok(hostAcceptance.status === 'pending', '真实宿主验收状态为pending');
ok(hostAcceptance.last_runtime_sha256 === null && hostAcceptance.accepted_at === null && hostAcceptance.evidence === null, '旧版真机哈希与验收证据未继承');
ok(hostAcceptance.artifact === manifest.packed_json, '宿主验收记录指向当前产物');

const packedText = await readText(manifest.packed_json, false);
const packed = JSON.parse(packedText);
ok(packed.spec === 'chara_card_v3', '角色卡规范为chara_card_v3');
ok(packed.spec_version === '3.0', '角色卡规范版本为3.0');
ok(packed.data?.name === cardSource.name, 'data显示名正确');
ok(packed.data?.character_version === '0.7.0', 'data版本正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.id === manifest.worldbook.stable_id, '打包世界书稳定ID正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.version === '0.7.0', '打包世界书版本正确');
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
ok(packedBook.entries.length === contract.required.worldbook_entry_count, '世界书包含260条维护条目');
const conceptRouter = sourceBook.entries.find(entry => entry.id === 399);
ok(Boolean(conceptRouter), '概念事件预处理路由ID 399存在');
ok(conceptRouter.comment === '[机制]事件内容激活路由', '事件内容预处理路由名称固定');
ok(conceptRouter.constant === false, '概念事件预处理路由不是常驻提示词');
ok(Array.isArray(conceptRouter.keys) && conceptRouter.keys.length === 0, '概念事件预处理路由无关键词');
ok(Array.isArray(conceptRouter.secondary_keys) && conceptRouter.secondary_keys.length === 0, '概念事件预处理路由无二级关键词');
const conceptRouterContent = await readText(conceptRouter.content_file);
ok(conceptRouterContent.startsWith('@@preprocessing\n<%_'), '概念事件路由在酒馆世界书扫描前执行');
ok((conceptRouterContent.match(/^@@preprocessing$/gm) ?? []).length === 1, '概念事件路由仅含一个@@preprocessing装饰器');
ok(conceptRouterContent.includes('await getEnabledWorldInfoEntries()'), '概念事件路由读取当前启用世界书条目');
ok(conceptRouterContent.includes('await activewi(entry.world, entry.uid, true)'), '概念事件路由强制激活同一世界书UID');
ok(conceptRouterContent.includes('Math.abs(eventIndex - currentIndex) <= 1'), '概念与人物路由保持当前锚点±1窗口');
ok(conceptRouterContent.includes('const characterEventFallback = new Map(['), '人物路由内置UID到事件数组回退');
ok(conceptRouterContent.includes('const activated = new Set()') && conceptRouterContent.includes('activated.has(activationKey)'), '路由按world.uid集合阻止重复强启');
ok(conceptRouterContent.includes('String(entry?.world ?? "") + ":" + String(entry?.uid ?? "")'), '路由去重键由world与uid共同组成');
ok(conceptRouterContent.includes('const routeWorlds = new Set(entries')
  && conceptRouterContent.includes('Number(entry?.uid) === 399')
  && conceptRouterContent.includes('routeWorlds.has(String(entry?.world ?? ""))'), '路由只处理承载UID399的本卡世界书，避免其他世界书同UID碰撞');
ok(!conceptRouterContent.includes('new Set([486])') && !conceptRouterContent.includes('delta > 0'), '概念±1路由不保留旧±3前向特例');
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
const conceptEntries = sourceBook.entries.filter(entry => entry.id >= 400 && entry.id <= 492);
const characterRouteEntries = sourceBook.entries.filter(entry => Object.values(contract.required.character_entry_ids).includes(entry.id));
const runtimeConceptEntries = [];
const staticConceptEntries = [];
const variantConceptEntries = [];
ok(conceptEntries.length === 92, '事件概念ID 400-492共92条（黑弦月物品条目已删除）');
const conceptStaticSections = contract.required.concept_activation.detailed_static_format;
const conceptVariantSections = contract.required.concept_activation.detailed_variant_format;
const legacyConceptSections = ['事实门槛', '定义', '来源', '事件演进', '机制', '限制与代价', '当前状态', '人物关联', '未知项', '禁止外推'];

function splitConceptVariantBlocks(content) {
  const parts = content.split(/^## 变体·/gm);
  const prefix = parts.shift() ?? '';
  return { prefix, blocks: parts.map(block => `## 变体·${block}`) };
}

function conceptGate(block) {
  const gateLine = block.match(/^- 门控：(.+)$/m)?.[1] ?? '';
  const events = [...gateLine.matchAll(/E\d{2}/g)].map(match => match[0]);
  return { gateLine, events, baseline: gateLine.startsWith('兜底') };
}

for (const conceptEntry of conceptEntries) {
  const conceptContent = await readText(conceptEntry.content_file);
  runtimeConceptEntries.push({ uid: conceptEntry.id, world: sourceBook.name, content: conceptContent });
  const conceptTitle = conceptEntry.comment.replace(/^\[概念·[^\]]+\]/, '');
  const expectedKeys = conceptEntry.keys;
  const isVariantForm = conceptContent.includes('<%') && conceptContent.includes('## 变体·');
  ok(conceptContent.startsWith('# 概念·'), `${conceptEntry.comment}正文首行为概念标题`);
  ok(isVariantForm || (!conceptContent.includes('@@private') && !conceptContent.includes('<%')), `${conceptEntry.comment}概念形态为静态或变体EJS二者之一`);
  if (isVariantForm) variantConceptEntries.push({ entry: conceptEntry, content: conceptContent });
  else staticConceptEntries.push({ entry: conceptEntry, content: conceptContent });
  ok(conceptEntry.constant === false, `${conceptEntry.comment}使用酒馆原生绿灯而非常驻`);
  ok(conceptEntry.keys.includes(conceptTitle) && conceptEntry.keys.every(key => typeof key === 'string' && key.length >= 2), `${conceptEntry.comment}主关键词含标题且无单汉字`);
  if (conceptEntry.id <= 451) {
    ok(JSON.stringify(conceptEntry.keys) === JSON.stringify([conceptTitle, ...(legacyConceptKeywordAliases[conceptTitle] ?? [])]), `${conceptEntry.comment}保留阶段一原关键词及顺序`);
  }
  ok(Array.isArray(conceptEntry.secondary_keys) && conceptEntry.secondary_keys.length === 0, `${conceptEntry.comment}不使用二级关键词`);
  const eventIds = conceptEntry.extensions?.tavernweave?.event_ids;
  ok(Array.isArray(eventIds) && eventIds.length > 0, `${conceptEntry.comment}声明事件关联数组`);
  ok(eventIds.every(eventId => contract.required.event_ids.includes(eventId)), `${conceptEntry.comment}事件关联只使用E01-E64`);
  if (Object.prototype.hasOwnProperty.call(contract.required.existing_concept_event_extensions ?? {}, String(conceptEntry.id))) {
    ok(JSON.stringify(eventIds) === JSON.stringify(contract.required.existing_concept_event_extensions[String(conceptEntry.id)]), `${conceptEntry.comment}跨阶段事件扩展与契约一致`);
  }
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
  ok(packedConcept.content === conceptContent, `${conceptEntry.comment}打包正文与源码一致`);
}

const stage3ConceptEntries = sourceBook.entries.filter(entry => entry.id >= 493 && entry.id <= 550);
ok(stage3ConceptEntries.length === 58, '阶段三新增概念UID493-550共58条');
const stage3ConceptKeywordAliases = {
  以M之拳与充能体系: ['以M之拳', '以M之力'],
  无瞳法阵: ['无瞳之眼'],
  喵化诅咒: ['异常性猫化诅咒'],
  欲望母树派系: ['欲望教派'],
  恐惧尖啸与深度恐惧: ['恐惧尖啸', '深度恐惧'],
};
for (const conceptEntry of stage3ConceptEntries) {
  const conceptContent = await readText(conceptEntry.content_file);
  const conceptTitle = conceptEntry.comment.replace(/^\[概念·[^\]]+\]/, '');
  const isVariantForm = conceptContent.includes('<%') && conceptContent.includes('## 变体·');
  ok(conceptContent.startsWith('# 概念·'), `${conceptEntry.comment}正文首行为概念标题`);
  ok(isVariantForm || (!conceptContent.includes('@@private') && !conceptContent.includes('<%')), `${conceptEntry.comment}概念形态为静态或变体EJS二者之一`);
  ok(conceptEntry.constant === false, `${conceptEntry.comment}使用酒馆原生绿灯而非常驻`);
  ok(JSON.stringify(conceptEntry.keys) === JSON.stringify([conceptTitle, ...(stage3ConceptKeywordAliases[conceptTitle] ?? [])]), `${conceptEntry.comment}关键词为主标题加别名`);
  ok(conceptEntry.keys.every(key => typeof key === 'string' && key.length >= 2), `${conceptEntry.comment}关键词均为长度>=2的字符串`);
  ok(Array.isArray(conceptEntry.secondary_keys) && conceptEntry.secondary_keys.length === 0, `${conceptEntry.comment}不使用二级关键词`);
  const eventIds = conceptEntry.extensions?.tavernweave?.event_ids ?? [];
  if (conceptTitle === '阶段三术语速查') {
    ok(eventIds.length === 0, `${conceptEntry.comment}术语速查为纯参考条目无事件数组`);
  } else {
    ok(eventIds.length > 0 && eventIds.every(eventId => contract.required.event_ids.includes(eventId)), `${conceptEntry.comment}事件关联非空且只使用E01-E64`);
    const headingMatch = conceptContent.match(/^# 概念·[^·]+·(.+?)（事件(\[[^\n]+\])）$/m);
    ok(Boolean(headingMatch), `${conceptEntry.comment}标题保留事件数组`);
    ok(headingMatch[1] === conceptTitle, `${conceptEntry.comment}标题名称与注册表一致`);
    ok(JSON.stringify(JSON.parse(headingMatch[2])) === JSON.stringify(eventIds), `${conceptEntry.comment}标题事件数组与注册表元数据一致`);
  }
  if (isVariantForm) {
    const { blocks } = splitConceptVariantBlocks(conceptContent);
    ok(blocks.length >= 1, `${conceptEntry.comment}变体形态包含变体块`);
    ok(blocks.filter(block => !conceptGate(block).baseline).length >= 1, `${conceptEntry.comment}变体形态至少一个非兜底门控变体`);
    ok(conceptGate(blocks[blocks.length - 1]).baseline === true, `${conceptEntry.comment}兜底块是最后一个变体块`);
    ok(!conceptContent.includes('activewi(') && !conceptContent.includes('getEnabledWorldInfoEntries(')
      && !conceptContent.includes('await ') && !/(^|\n)\s*(const|let)\s/.test(conceptContent), `${conceptEntry.comment}变体EJS只读事件状态且无跨条目作用域声明`);
    const gateIndices = [];
    blocks.forEach((block, index) => {
      const gate = conceptGate(block);
      ok(Boolean(gate.gateLine), `${conceptEntry.comment}变体块${index + 1}含门控行`);
      if (!gate.baseline) {
        ok(gate.events.length === 1 && contract.required.event_ids.includes(gate.events[0]), `${conceptEntry.comment}变体块${index + 1}门控为单一事件且属于E01-E64`);
        gateIndices.push(contract.required.event_ids.indexOf(gate.events[0]));
      }
      for (const section of conceptVariantSections) {
        ok((block.match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length === 1, `${conceptEntry.comment}变体块${index + 1}包含唯一“${section}”字段`);
      }
    });
    for (let index = 1; index < gateIndices.length; index += 1) {
      ok(gateIndices[index] < gateIndices[index - 1], `${conceptEntry.comment}变体门控事件从新到旧排列`);
    }
    const fullState = Object.fromEntries(contract.required.event_ids.map(id => [id, { 状态: '完成' }]));
    const emptyState = Object.fromEntries(contract.required.event_ids.map(id => [id, { 状态: '未触发' }]));
    for (const [label, stateTable, blockIndex] of [['全完成', fullState, 0], ['全未触发', emptyState, blocks.length - 1]]) {
      const rendered = renderEjsForEventStates(conceptContent, stateTable);
      ok(rendered.includes('# 概念·') && !rendered.includes('<%'), `${conceptEntry.comment}渲染${label}无EJS残留`);
      const renderedGate = rendered.match(/^- 门控：(.+)$/m)?.[1] ?? '';
      ok(renderedGate === (blocks[blockIndex].match(/^- 门控：(.+)$/m)?.[1] ?? ''), `${conceptEntry.comment}渲染${label}选中预期变体`);
    }
  } else {
    ok(conceptContent.length >= 350 && conceptContent.length <= 3000, `${conceptEntry.comment}静态正文350-3000字符（当前${conceptContent.length}）`);
    for (const section of conceptStaticSections) {
      ok((conceptContent.match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length === 1, `${conceptEntry.comment}静态形态包含唯一“${section}”字段`);
    }
    const factGate = conceptContent.match(/^- 事实门槛：(.+)$/m)?.[1] ?? '';
    ok(['完成', '变形', '预兆', '活跃', '取消'].every(state => factGate.includes(state)) && /聊天|正文/.test(factGate), `${conceptEntry.comment}事实门槛区分终态、进行态与聊天事实`);
  }
}

for (const { entry: conceptEntry, content: conceptContent } of staticConceptEntries) {
  ok(conceptContent.length >= 350 && conceptContent.length <= 1100, `${conceptEntry.comment}静态正文350-1100字符（当前${conceptContent.length}）`);
  for (const section of legacyConceptSections) {
    ok((conceptContent.match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length === 1, `${conceptEntry.comment}静态形态包含唯一“${section}”字段`);
  }
  const factGate = conceptContent.match(/^- 事实门槛：(.+)$/m)?.[1] ?? '';
  ok(['完成', '变形', '预兆', '活跃', '取消'].every(state => factGate.includes(state)) && /聊天|正文/.test(factGate), `${conceptEntry.comment}事实门槛区分终态、进行态与聊天事实`);
}

const variantGateStates = contract.required.concept_activation.state_variants.gate_states;
for (const { entry: conceptEntry, content: conceptContent } of variantConceptEntries) {
  const { prefix, blocks } = splitConceptVariantBlocks(conceptContent);
  ok(blocks.length >= 1, `${conceptEntry.comment}变体形态包含变体块`);
  ok(blocks.filter(block => !conceptGate(block).baseline).length >= 1, `${conceptEntry.comment}变体形态至少一个非兜底门控变体`);
  for (const section of conceptStaticSections) {
    ok((prefix.match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length === 1, `${conceptEntry.comment}变体形态静态“${section}”字段恰好一次`);
  }
  for (const section of conceptVariantSections) {
    ok((prefix.match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length === 0, `${conceptEntry.comment}变体形态“${section}”只出现在变体块内`);
  }
  const prefixPersona = (prefix.match(/^- 人物关联：/gm) ?? []).length;
  ok(prefixPersona === 0 || prefixPersona === 1, `${conceptEntry.comment}人物关联在块外至多一次`);
  ok(conceptContent.length >= 900 && conceptContent.length <= 4500, `${conceptEntry.comment}变体形态正文900-4500字符（当前${conceptContent.length}）`);
  ok(!conceptContent.includes('activewi(') && !conceptContent.includes('getEnabledWorldInfoEntries(')
    && !conceptContent.includes('await ') && !/(^|\n)\s*(const|let)\s/.test(conceptContent), `${conceptEntry.comment}变体EJS只读事件状态且无跨条目作用域声明`);
  const factGate = prefix.match(/^- 事实门槛：(.+)$/m)?.[1] ?? '';
  ok(['完成', '变形', '预兆', '活跃', '取消'].every(state => factGate.includes(state)) && /聊天|正文/.test(factGate), `${conceptEntry.comment}事实门槛区分终态、进行态与聊天事实`);
  const allGateEvents = [];
  const firstGateIndices = [];
  blocks.forEach((block, index) => {
    const gate = conceptGate(block);
    ok(Boolean(gate.gateLine), `${conceptEntry.comment}变体块${index + 1}含门控行`);
    if (!gate.baseline) {
      ok(gate.events.length === 1, `${conceptEntry.comment}变体块${index + 1}门控为单一事件`);
      ok(contract.required.event_ids.includes(gate.events[0]), `${conceptEntry.comment}变体块${index + 1}门控事件只使用E01-E64`);
      allGateEvents.push(gate.events[0]);
      firstGateIndices.push(contract.required.event_ids.indexOf(gate.events[0]));
    }
    ok(gate.baseline === (index === blocks.length - 1), `${conceptEntry.comment}兜底块必须是最后一个变体块`);
    for (const section of conceptVariantSections) {
      ok((block.match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length === 1, `${conceptEntry.comment}变体块${index + 1}包含唯一“${section}”字段`);
    }
    const blockPersona = (block.match(/^- 人物关联：/gm) ?? []).length;
    ok(blockPersona === 1 || (blockPersona === 0 && prefixPersona === 1), `${conceptEntry.comment}人物关联静态一次或每个变体块一次`);
  });
  for (let index = 1; index < firstGateIndices.length; index += 1) {
    ok(firstGateIndices[index] < firstGateIndices[index - 1], `${conceptEntry.comment}变体门控事件从新到旧排列`);
  }
  const ejsStateRefs = [...conceptContent.matchAll(/锚点状态\.(E\d{2})\.状态/g)].map(match => match[1]);
  ok(allGateEvents.every(eventId => ejsStateRefs.includes(eventId)), `${conceptEntry.comment}全部门控事件都在EJS条件中引用`);
}

function conceptScenarioStateTable(gateEvents, state) {
  return Object.fromEntries(contract.required.event_ids.map(eventId => [eventId, {
    状态: gateEvents.includes(eventId) ? state : '未触发',
  }]));
}

for (const { entry: conceptEntry, content: conceptContent } of variantConceptEntries) {
  const { blocks } = splitConceptVariantBlocks(conceptContent);
  const baselineBlock = blocks[blocks.length - 1];
  const gatedBlocks = blocks.slice(0, -1);
  const blockGateLine = block => (block.match(/^- 门控：(.+)$/m)?.[1] ?? '');
  const scenarios = [
    ['全未触发', conceptScenarioStateTable([], '未触发'), baselineBlock],
    ['全事件完成', conceptScenarioStateTable(contract.required.event_ids, '完成'), gatedBlocks[0]],
  ];
  for (const state of variantGateStates) {
    for (const block of gatedBlocks) {
      const gateEvent = conceptGate(block).events[0];
      scenarios.push([`${gateEvent}=${state}`, conceptScenarioStateTable([gateEvent], state), block]);
    }
  }
  for (const state of ['取消', '活跃', '预兆']) {
    for (const block of gatedBlocks) {
      const gateEvent = conceptGate(block).events[0];
      scenarios.push([`${gateEvent}=${state}`, conceptScenarioStateTable([gateEvent], state), baselineBlock]);
    }
  }
  for (const [label, stateTable, expectedBlock] of scenarios) {
    const rendered = renderEjsForEventStates(conceptContent, stateTable);
    ok(rendered.includes(`# 概念·`), `${conceptEntry.comment}渲染${label}保留标题`);
    ok(!rendered.includes('<%'), `${conceptEntry.comment}渲染${label}无EJS残留`);
    ok([...rendered.matchAll(/^## 变体·/gm)].length === 1, `${conceptEntry.comment}渲染${label}恰好输出一个变体块`);
    const renderedGate = rendered.match(/^- 门控：(.+)$/m)?.[1] ?? '';
    ok(renderedGate === blockGateLine(expectedBlock), `${conceptEntry.comment}渲染${label}选中预期变体`);
  }
}
const happinessTruthContent = await readText(sourceBook.entries.find(entry => entry.id === 486).content_file);
ok(happinessTruthContent.includes('E25之前不得作为林恩的知识') && happinessTruthContent.includes('“预兆”“活跃”或“取消”不会自动揭底'), '幸福之家真相同时锁定事件阶段与林恩知识边界');
const clownCurseContent = await readText(sourceBook.entries.find(entry => entry.id === 480).content_file);
ok(!clownCurseContent.includes('15日') && !clownCurseContent.includes('天使之血') && !clownCurseContent.includes('圣血'), '哭泣小丑机制条不提前泄露天使血压制详情');
const angelBloodContent = await readText(sourceBook.entries.find(entry => entry.id === 470).content_file);
ok(angelBloodContent.includes('15日压制') && angelBloodContent.includes('不构成根除'), '天使之血独立承载十五日压制与非根治限制');

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
    if (entry.extensions.tavernweave.event_ids.some(eventId => {
      const delta = contract.required.event_ids.indexOf(eventId) - currentIndex;
      return Math.abs(delta) <= 1;
    })) {
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

function simulateCharacterActivation(stateTable, omenId, messages, useMetadata = true) {
  const currentIndex = resolveConceptCurrentIndex(stateTable, omenId);
  const activated = new Set();
  for (const entry of characterRouteEntries) {
    const character = entry.comment.replace(/^\[角色\]/, '');
    const eventIds = useMetadata ? entry.extensions?.tavernweave?.event_ids : contract.required.character_event_ids[character];
    if (eventIds.some(eventId => Math.abs(contract.required.event_ids.indexOf(eventId) - currentIndex) <= 1)) activated.add(entry.id);
  }
  for (const message of messages) {
    if (!['user', 'assistant'].includes(message.role)) continue;
    for (const entry of characterRouteEntries) {
      if (entry.keys.some(key => message.content.includes(key))) activated.add(entry.id);
    }
  }
  return [...activated];
}

const farEventState = Object.fromEntries(contract.required.event_ids.map(id => [id, { 状态: id === 'E61' ? '活跃' : '未触发' }]));
ok(simulateConceptActivation(initial.事件.锚点状态, '', []).includes(400), '双路矩阵：仅事件窗口可激活E01概念');
ok(simulateConceptActivation(farEventState, '', [{ role: 'user', content: '我想寻找拾荒者' }]).includes(400), '双路矩阵：事件窗外user别称触发原生绿灯');
ok(simulateConceptActivation(farEventState, '', [{ role: 'assistant', content: '人皮拾荒者正在靠近' }]).includes(400), '双路矩阵：事件窗外AI完整标题触发原生绿灯');
ok(!simulateConceptActivation(farEventState, '', [{ role: 'user', content: '今晚街道十分安静' }]).includes(400), '双路矩阵：事件窗外且无关键词不激活');
ok(!simulateConceptActivation(farEventState, '', [{ role: 'system', content: '人皮拾荒者' }]).includes(400), '双路矩阵：普通system消息不作为原生聊天绿灯输入');
ok(simulateConceptActivation(initial.事件.锚点状态, '', [{ role: 'user', content: '拾荒者' }]).filter(id => id === 400).length === 1, '双路矩阵：事件与关键词同时命中同一UID只保留一次');
const e25EventState = Object.fromEntries(contract.required.event_ids.map(id => [id, { 状态: id === 'E25' ? '活跃' : '未触发' }]));
ok(simulateCharacterActivation(e25EventState, '', []).filter(id => id === 150).length === 1, '人物双路矩阵：仅事件窗口激活爱丽丝一次');
ok(simulateCharacterActivation(farEventState, '', [{ role: 'user', content: '爱丽丝正在门外' }]).filter(id => id === 150).length === 1, '人物双路矩阵：事件窗外user姓名激活爱丽丝一次');
ok(simulateCharacterActivation(farEventState, '', [{ role: 'assistant', content: '地缚灵爱丽丝暂时隐去身形' }]).filter(id => id === 150).length === 1, '人物双路矩阵：事件窗外AI别名激活爱丽丝一次');
ok(!simulateCharacterActivation(farEventState, '', [{ role: 'user', content: '今晚街道十分安静' }]).includes(150), '人物双路矩阵：事件窗外且无姓名不激活爱丽丝');
ok(simulateCharacterActivation(e25EventState, '', [{ role: 'user', content: '爱丽丝' }]).filter(id => id === 150).length === 1, '人物双路矩阵：事件与姓名同时命中同一人物UID只保留一次');
const e22EventState = Object.fromEntries(contract.required.event_ids.map(id => [id, { 状态: id === 'E22' ? '活跃' : '未触发' }]));
ok(!simulateConceptActivation(e22EventState, '', []).includes(486), '剧透负例：E22事件窗口不激活幸福之家完整真相');
ok(simulateConceptActivation(e22EventState, '', [{ role: 'user', content: '幸福之家真相' }]).includes(486), '原生绿灯正例：玩家主动点名完整真相仍可激活条目');
const e24EventState = Object.fromEntries(contract.required.event_ids.map(id => [id, { 状态: id === 'E24' ? '活跃' : '未触发' }]));
ok(simulateConceptActivation(e24EventState, '', []).includes(486), '严格±1正例：E24窗口包含E25幸福之家真相概念');
const runtimeCharacterEntries = await Promise.all(characterRouteEntries.map(async entry => ({
  uid: entry.id,
  world: sourceBook.name,
  content: await expectedEntryContent(entry),
})));
const runtimeRouterActivations = [];
const foreignCollisionEntries = [
  { uid: 100, world: '其他世界书', content: '' },
  { uid: 400, world: '其他世界书', content: '# 概念·物品·外部碰撞（事件["E01"]）' },
];
await executeConceptRouter(
  (path, options = {}) => {
    const eventId = path.match(/锚点状态\.(E\d{2})\.状态$/)?.[1];
    if (eventId) return initial.事件.锚点状态[eventId]?.状态 ?? options.defaults;
    if (path.endsWith('近期预兆.事件ID')) return initial.事件.近期预兆.事件ID;
    return options.defaults;
  },
  async () => [
    { uid: 399, world: sourceBook.name, comment: '[机制]事件内容激活路由', content: conceptRouterContent },
    ...runtimeConceptEntries,
    ...runtimeCharacterEntries,
    ...foreignCollisionEntries,
  ],
  async (world, uid, force) => { runtimeRouterActivations.push({ world, uid, force }); },
);
const expectedRuntimeRouterIds = [...new Set([
  ...simulateConceptActivation(initial.事件.锚点状态, '', []),
  ...simulateCharacterActivation(initial.事件.锚点状态, '', [], false),
])].sort((a, b) => a - b);
const actualRuntimeRouterIds = runtimeRouterActivations.map(item => item.uid).sort((a, b) => a - b);
ok(JSON.stringify(actualRuntimeRouterIds) === JSON.stringify(expectedRuntimeRouterIds), '真机形态模拟：剥离自定义extensions后概念标题与人物UID回退仍激活±1事件窗口');
ok(new Set(runtimeRouterActivations.map(item => `${item.world}:${item.uid}`)).size === runtimeRouterActivations.length, '真机形态模拟：同一world.uid最多调用一次activewi');
ok(runtimeRouterActivations.every(item => item.world === sourceBook.name && item.force === true), '真机形态模拟：双类回退仍强制激活同一世界书UID');
ok(!runtimeRouterActivations.some(item => item.world === '其他世界书'), '真机形态模拟：其他启用世界书的同UID人物或概念不会被本卡路由误激活');
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
ok(characters.length === 24, '二十四名核心人物');
ok(components.length === 6, '每名角色六个组件');
ok(characters.includes('爱丽丝') && characters.includes('黑弦月') && characters.includes('欲望母树'), '爱丽丝、黑弦月与欲望母树均进入角色阵容');

const characterIds = contract.required.character_entry_ids;
const characterEventIds = contract.required.character_event_ids;
exactKeys(characterEventIds, characters, '二十四人事件关联契约');
ok(Object.values(characterEventIds).every(eventIds => Array.isArray(eventIds)
  && eventIds.length > 0
  && eventIds.every(eventId => contract.required.event_ids.includes(eventId))), '人物事件关联仅使用E01-E64且均非空');
ok(new Set(Object.values(characterIds)).size === 24, '二十四名人物UID互不重复');
for (const id of Object.values(characterIds)) {
  ok(id >= 100 && id <= 294 && !(id >= 300 && id <= 363), `${id}人物UID不占用事件素材区间300-363`);
}

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
  ok(entry.secondary_keys === undefined || (Array.isArray(entry.secondary_keys) && entry.secondary_keys.length === 0), `${character}不使用二级关键词`);
  ok(entry.content_files?.length === 6, `${character}运行时合并六个组件`);
  const eventIds = entry.extensions?.tavernweave?.event_ids;
  ok(JSON.stringify(eventIds) === JSON.stringify(characterEventIds[character]), `${character}事件元数据与契约一致`);
  ok(eventIds.every(eventId => contract.required.event_ids.includes(eventId)), `${character}事件元数据只使用E01-E64`);
  ok(entry.extensions?.exclude_recursion === true && entry.extensions?.prevent_recursion === true, `${character}源码人物条目开启双递归保护`);
  for (const component of components) {
    const path = `src/characters/${character}/${componentFiles[component]}`;
    const content = await readText(path);
    ok(content.length >= 80, `${character}/${component}内容充足`);
    ok(entry.content_files.includes(path), `${character}/${component}进入运行时合并`);
  }
  const runtimeEntry = packedBook.entries.find(item => item.id === entry.id);
  ok(runtimeEntry.content === await expectedEntryContent(entry), `${character}合并结果精确一致`);
  ok(runtimeEntry.content.includes('getvar("stat_data.事件.锚点状态.'), `${character}自动注入后仍由事件状态EJS选择当前阶段人设`);
  ok(JSON.stringify(runtimeEntry.extensions?.tavernweave?.event_ids) === JSON.stringify(eventIds), `${character}打包后保留人物事件元数据`);
  ok(runtimeEntry.extensions?.exclude_recursion === true && runtimeEntry.extensions?.prevent_recursion === true, `${character}打包人物条目开启双递归保护`);
  if (character !== '血锯') {
    ok(runtimeEntry.content.includes('<%_ if'), `${character}蓝灯包含事件条件分段`);
  }
}

for (const character of contract.required.candidate_rephrase_characters) {
  const candidatePath = `候选二次解释/${character}.md`;
  const candidate = await readText(candidatePath);
  ok(candidate.length >= 120, `${character}候选二次解释内容充足`);
  ok(!sourceBook.entries.some(entry => entry.content_file === candidatePath || entry.content_files?.includes(candidatePath)), `${character}候选二次解释未注册到运行时`);
  const formalRephrase = await readText(`src/characters/${character}/二次解释.md`);
  ok(formalRephrase.includes('if (false &&') && formalRephrase.includes('等待用户逐条确认候选稿'), `${character}正式二次解释保持不可达占位`);
}
const allCharacterSource = (await Promise.all(characters.flatMap(character => Object.values(componentFiles)
  .map(file => readText(`src/characters/${character}/${file}`))))).join('\n');
const allCandidateSource = (await Promise.all(contract.required.candidate_rephrase_characters
  .map(character => readText(`候选二次解释/${character}.md`)))).join('\n');
for (const forbiddenTerm of ['八十字勋章', '八级元勋', '汪思悦']) {
  ok(!allCharacterSource.includes(forbiddenTerm) && !allCandidateSource.includes(forbiddenTerm), `人物与候选稿不含错误名词：${forbiddenTerm}`);
}
const blackWhiteClownEntry = sourceBook.entries.find(item => item.comment === '[角色]黑白小丑');
const blackWhiteClownSource = await expectedEntryContent(blackWhiteClownEntry);
ok(blackWhiteClownSource.includes('E32.状态') && !blackWhiteClownSource.includes('E31.状态'), '黑白小丑只由E32幕后镜头解锁，不随E31显化体提前开放');
for (const [character, requiredEvents] of Object.entries({
  左左: ['E22', 'E24', 'E26', 'E33', 'E35'],
  血锯: ['E21', 'E26', 'E29'],
  小小: ['E34'],
})) {
  const characterEntry = sourceBook.entries.find(item => item.comment === `[角色]${character}`);
  const characterSource = await expectedEntryContent(characterEntry);
  for (const eventId of requiredEvents) ok(characterSource.includes(`${eventId}.状态`), `${character}阶段二人设包含${eventId}门控`);
}
const puppetSource = await expectedEntryContent(sourceBook.entries.find(item => item.comment === '[角色]人偶夫人'));
ok(puppetSource.includes('实体已到店') && puppetSource.includes('封装') && puppetSource.includes('未启用'), '人偶夫人保持黑弦月已到店封装且未启用的连续性');

for (const character of contract.required.non_romantic_characters) {
  ok(initial.关系[character].吸引 === 0, `${character}初始吸引为0（固定非恋爱锁）`);
  ok(initial.关系[character].恶堕 === 0, `${character}初始恶堕为0（固定非恋爱锁）`);
}
for (const character of contract.required.romance_open_characters) {
  ok(initial.关系[character].恶堕 === 0, `${character}恶堕值初始为0（开放字段从0起步）`);
  ok(Object.prototype.hasOwnProperty.call(initial.关系[character], '恶堕'), `${character}建有恶堕值变量`);
}
ok(initial.关系.左左.边界.includes('全面开放') && !initial.关系.左左.边界.includes('吸引与恶堕仍为0'), '左左边界为独立意识全面开放且无旧锁残留');
ok(initial.关系.小小.边界.includes('全面开放') && !initial.关系.小小.边界.includes('恒为0') && initial.关系.小小.边界.includes('未婚妻'), '小小边界为根源级泰坦未婚妻全面开放且无旧锁残留');
ok(initial.关系.爱丽丝.边界.includes('全面开放') && !initial.关系.爱丽丝.边界.includes('非性') && !initial.关系.爱丽丝.边界.includes('幼态'), '爱丽丝边界全面开放且无幼态锁残留');
ok(initial.关系.倒吊天使.边界.includes('不代表玩家接受关系'), '倒吊天使开放关系仍需玩家明确接受');
ok(initial.关系.血衣女士.边界.includes('恶堕值只随玩家明确行动推进'), '血衣女士恶堕推进规则可见');
ok(initial.关系.人偶夫人.边界.includes('恶堕值只随玩家明确行动推进'), '人偶夫人恶堕推进规则可见');
ok(initial.关系.黑弦月.边界.includes('恶堕') && !initial.关系.黑弦月.边界.includes('恒为0'), '黑弦月边界开放无锁');
ok(initial.关系.喵喵.边界.includes('恶堕') && !initial.关系.喵喵.边界.includes('恒为0'), '喵喵边界开放无锁');
ok(initial.关系.林樱.边界.includes('恶堕') && !initial.关系.林樱.边界.includes('恒为0'), '林樱边界开放无锁');
ok(initial.关系.羽毛笔.边界.includes('恶堕') && !initial.关系.羽毛笔.边界.includes('恒为0'), '羽毛笔边界开放无锁');
ok(initial.关系.a01银色幻想.边界.includes('恶堕') && !initial.关系.a01银色幻想.边界.includes('恒为0'), 'a01银色幻想边界开放无锁');
ok(initial.关系.欲望母树.边界.includes('恶堕') && !initial.关系.欲望母树.边界.includes('恒为0'), '欲望母树边界开放无锁');
ok(initial.关系.艾雯爵士.边界.includes('非恋爱'), '艾雯爵士维持义兄师长非恋爱边界');

const stageFactRequirements = {
  泰坦头颅: ['小小的父亲', '触手', '护短'],
  巫神头颅: ['小小的母亲', '自我催眠', '心灵契约', '试探'],
  小宝贝: ['巨像部件', '舌状身体', '地窖'],
  小小: ['泰坦头颅', '巫神头颅', '钢牙'],
  血衣女士: ['45号', '寻子', '红衣'],
  人偶夫人: ['人偶庄园', '血源诅咒', '黑弦月'],
};
for (const [character, tokens] of Object.entries(stageFactRequirements)) {
  const runtimeEntry = packedBook.entries.find(item => item.comment === `[角色]${character}`);
  for (const token of tokens) ok(runtimeEntry.content.includes(token), `${character}阶段1资料包含：${token}`);
}

const stagedPersonaCases = [
  ['血锯', 'E01', ['夜医身份:', '公开倒吊塔调查'], ['临时外出']],
  ['血锯', 'E21', [], ['夜医身份:']],
  ['小小', 'E05', ['根源级泰坦幼女', '约三千年前', '幼年遭斩首'], ['巨大牙科病患']],
  ['小小', 'E18', ['约三千年前', '幼年遭斩首'], ['根源级泰坦幼女']],
  ['小小', 'E20', [], ['约三千年前', '幼年遭斩首']],
  ['小宝贝', 'E01', ['舌状身体', '巨像部件'], ['地窖里的生物']],
  ['小宝贝', 'E12', ['巨像部件'], ['舌状身体']],
  ['小宝贝', 'E21', [], ['巨像部件']],
  ['左左', 'E11', ['共生忠诚', '傲娇毒舌', '关于独立与共生'], ['控制权争夺']],
  ['左左', 'E13', [], ['共生忠诚', '关于独立与共生']],
  ['黑颅', 'E30', ['哭泣小丑', '生前女性肉身'], ['观察']],
  ['黑颅', 'E31', ['生前女性肉身'], ['哭泣小丑']],
  ['渡鸦', 'E30', ['启用天使吊坠', '维持夜医指挥链'], ['试诊领队']],
  ['渡鸦', 'E31', ['维持夜医指挥链'], ['启用天使吊坠']],
  ['猪头屠夫', 'E24', ['幸福之家厨师', '某位存在'], ['资料未解锁']],
  ['猪头屠夫', 'E25', [], ['幸福之家厨师']],
];
for (const [character, currentEvent, forbiddenTokens, requiredTokens] of stagedPersonaCases) {
  const entry = sourceBook.entries.find(item => item.comment === `[角色]${character}`);
  const eventIndex = contract.required.event_ids.indexOf(currentEvent);
  const stateTable = Object.fromEntries(contract.required.event_ids.map((eventId, index) => [eventId, {
    状态: index < eventIndex ? '完成' : (index === eventIndex ? '活跃' : '未触发'),
  }]));
  const rendered = renderEjsForEventStates(await expectedEntryContent(entry), stateTable);
  for (const token of forbiddenTokens) ok(!rendered.includes(token), `${character}/${currentEvent}不提前输出：${token}`);
  for (const token of requiredTokens) ok(rendered.includes(token), `${character}/${currentEvent}输出当前阶段事实：${token}`);
}

const categoryMap = [
  ['factions', ['魔人协会', '猎头者家族', '人偶庄园', '夜医', '独角恶鬼族', '游魂巷居民'], '[势力]'],
  ['mechanisms', ['视界系统', '诅咒与医疗', '巨像及血肉机械技术'], '[机制]'],
  ['locations', ['血锯药剂店', '45号血衣住所', '凄凉荒野与倒吊塔', '独角鬼王神庙', '人偶庄园'], '[地点]'],
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

const stage3CategoryConceptMap = {
  血肉神教: '势力', 机械神教: '势力', 疫医: '势力', 欲望母树派系: '势力', 超自然总局: '势力', 龙虎山: '势力',
  以M之拳: '机制',
  诅咒之城: '场景', 畸变堡垒: '场景', 黑夜城仪式塔: '场景', 群星圣堂: '场景', 不正常生物接诊中心: '场景', 蓝星魔都: '场景',
};
const stage3CategoryConceptFiles = {
  以M之拳: '以M之拳与充能体系',
  黑夜城仪式塔: '仪式塔',
  蓝星魔都: '蓝星·魔都',
};
for (const [contractName, cat] of Object.entries(stage3CategoryConceptMap)) {
  const fileName = stage3CategoryConceptFiles[contractName] ?? contractName;
  const content = await readText(`src/concepts/${cat}/${fileName}.md`);
  ok(content.length >= 120, `阶段三${cat}${contractName}概念源码存在且内容充足`);
  ok(Boolean(sourceBook.entries.find(item => item.comment === `[概念·${cat}]${fileName}`)), `阶段三${cat}${contractName}有独立概念条目`);
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
  ok(entry.keys.includes(eventId), `${eventId}构建素材保留稳定事件ID`);
  ok(entry.constant === false && entry.enabled === false, `${eventId}构建素材禁用且不会独立绿灯`);
  const packedEventEntry = packedBook.entries.find(item => item.id === entry.id);
  ok(packedEventEntry?.enabled === false, `${eventId}打包后仍保持禁用`);
  const content = await readText(entry.content_file);
  ok(content.includes(`# ${eventId}·`), `${eventId}源码标题正确`);
  ok((content.match(new RegExp(`# ${eventId}·`, 'g')) || []).length >= 2, `${eventId}完整分支含标题`);
  ok(content.includes('<%_') && content.includes('getvar("stat_data.事件.锚点状态.'), `${eventId}蓝灯含EJS状态门槛`);
  if (eventId === 'E64') {
    ok(!content.includes('## 下一事件引入') && !content.includes('- 默认走向：') && !content.includes('- 完成条件：'), 'E64不设六态、引入与默认走向');
    ok(content.includes('阶段4待续钩子') && content.includes('不创建E65') && content.includes('阶段四融合'), 'E64开放钩子与阶段四融合且不创建E65');
    continue;
  }
  ok(content.includes('- 完成条件：') && content.includes('- 取消条件：'), `${eventId}含收束条件（完成/取消）`);
  ok(content.includes('- 玩家主权：以下') && content.includes('仅作原作因果参考'), `${eventId}明确默认走向不替玩家行动`);
  if (index >= 20) {
    const deformationLine = content.split('\n').find(line => line.startsWith('- 变形条件：')) ?? '';
    ok(deformationLine.includes('收束') && !deformationLine.includes('预兆') && !deformationLine.includes('活跃'), `${eventId}把变形限定为收束态`);
  }
  const defaultLines = content.split('\n');
  const defaultIndex = defaultLines.findIndex(line => line.startsWith('- 默认走向：'));
  let defaultLen = 0;
  if (defaultIndex >= 0) {
    defaultLen = defaultLines[defaultIndex].slice('- 默认走向：'.length).length;
    for (let lineIndex = defaultIndex + 1; lineIndex < defaultLines.length; lineIndex += 1) {
      const line = defaultLines[lineIndex];
      if (/^-\s*第[一二三四五六七八九十\d]+幕：/.test(line)) defaultLen += line.length;
      else if (line.trim() === '') continue;
      else break;
    }
  }
  const grandAnchor = ['E47', 'E60', 'E61', 'E63'].includes(eventId);
  ok(defaultLen >= 200 && defaultLen <= (grandAnchor ? 800 : 500), `${eventId}默认走向200-${grandAnchor ? '800（大锚点多幕）' : '500'}字（当前${defaultLen}）`);
  if (index >= 20 && index < 35) ok(content.length >= 1150 && content.length <= 1800, `${eventId}完整事件源码保持v0.5同量级（当前${content.length}）`);
  if (index >= 35) ok(content.length >= 900 && content.length <= 3000, `${eventId}阶段三事件源码900-3000字符（当前${content.length}）`);
  for (const marker of eventFieldMarkers) ok(content.includes(marker), `${eventId}包含${marker}`);
}

const eventMaterialEntries = sourceBook.entries.filter(entry => entry.id >= 300 && entry.id <= 363);
ok(eventMaterialEntries.length === 64 && eventMaterialEntries.every(entry => entry.enabled === false), '64条独立事件素材全部禁用');
for (const probe of ['E02', contract.required.event_titles.E02, '小小', '心灵契约']) {
  const selected = eventMaterialEntries.filter(entry => entry.enabled !== false
    && entry.keys.some(key => String(probe).includes(String(key))));
  ok(selected.length === 0, `事件素材重复注入负例：${probe}不会选择独立事件UID`);
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

const dependencyTable = contract.required.event_dependencies;
exactKeys(dependencyTable, contract.required.event_ids.slice(20), 'E21-E64局部依赖表');
for (const [eventId, dependency] of Object.entries(dependencyTable)) {
  exactKeys(dependency, ['hard_all', 'hard_any', 'independent_fallback'], `${eventId}局部依赖字段`);
  ok([dependency.hard_all, dependency.hard_any, dependency.independent_fallback].every(Array.isArray), `${eventId}局部依赖使用数组`);
}
ok(dependencyTable.E28.hard_any.includes('爱丽丝术后日常') && dependencyTable.E28.hard_any.includes('战蜥来店'), '局部级联正例：E28两条支线有独立入口');
ok(dependencyTable.E35.hard_any.some(item => item.includes('拟化')) && dependencyTable.E35.hard_any.some(item => item.includes('白逸')), '局部级联正例：E35拟化与蓝星线有独立入口');
ok(dependencyTable.E31.hard_all.includes('哭泣小丑已入体'), '局部级联负例：未感染时E31失去必要因果');
ok(dependencyTable.E24.hard_all.includes('玛丽深层诅咒明确复燃'), '局部级联负例：无玛丽复燃不得机械启动E24');

const requiredRelationFields = [
  '解锁', '在场', '生存状态', '位置', '处境', '关系类型', '人物阶段', '好感', '信赖',
  '戒备', '吸引', '关系创伤', '恶堕', '可见迹象', '边界', '关键记忆', '最近互动',
];
exactKeys(initial.关系, characters, '二十四人关系');
for (const [name, relation] of Object.entries(initial.关系)) {
  exactKeys(relation, requiredRelationFields, `${name}关系字段`);
  ok(relation.好感 >= 0 && relation.好感 <= 100, `${name}好感在0-100`);
  ok(relation.恶堕 >= 0 && relation.恶堕 <= 100, `${name}恶堕在0-100`);
}

const schemaText = await readText('src/scripts/schema.js');
for (const token of ['《诡异药剂师》v0.7', '0.7.0', '收尾', '恶堕', ...characters]) {
  ok(schemaText.includes(token), `schema包含：${token}`);
}
ok(schemaText.includes('爱丽丝') && schemaText.includes('黑弦月') && schemaText.includes('欲望母树'), 'schema含爱丽丝、黑弦月与欲望母树');
ok(schemaText.includes("状态: z.enum(['活跃', '无'])") && !schemaText.includes("状态: z.enum(['活跃', '变形', '无'])"), '唯一活跃事件只接受活跃或无');
ok(schemaText.includes("value.状态 === '活跃'") && !schemaText.includes("value.状态 === '活跃' || value.状态 === '变形'"), 'schema仅把活跃锚点计入活跃槽');
ok(schemaText.includes('activeEmptyIsCanonical') && schemaText.includes('omenEmptyIsCanonical'), 'schema校验活跃事件与预兆的规范空对象');
ok(schemaText.includes('omenAnchors.length === 1') && schemaText.includes('近期预兆必须唯一对应预兆锚点'), 'schema校验唯一预兆锚点与详情一致');
ok(schemaText.includes('进入终态时收尾必须为true'), 'schema校验终态收尾为true');
ok(schemaText.includes('不得写星期、精确日期、X天时长') && schemaText.includes('昨天/昨日/昨夜/今天/今日/今早/今晨/明天/明日/次日/翌日/第二天'), 'schema拒绝星期、精确日期、天数时长与相对日期');
for (const [eventId, anchorState] of Object.entries(initial.事件.锚点状态)) {
  ok(schemaText.includes(`${eventId}: anchor`), `schema声明${eventId}锚点`);
  ok(anchorState.标题 === contract.required.event_titles[eventId], `${eventId}初始标题与契约一致`);
}
for (const phase of Object.keys(contract.required.stage_ranges)) {
  ok(schemaText.includes(`${phase}:`) && schemaText.includes(`'${phase}'`), `schema声明阶段${phase}`);
}

const helperNames = helperSource.map(script => script.name).join('；');
ok(helperNames.includes('v0.7'), '酒馆助手脚本命名含v0.7');
ok(helperSource.length === 2, '内嵌酒馆助手脚本2个');
ok(regexSource.length === 5, '正则脚本5个（状态栏、变量块、思考块的提示词与显示隔离）');
const hideStatusRegex = regexSource.find(script => script.id === 'tavernweave-hide-status-prompt-v0.7');
ok(Boolean(hideStatusRegex), '存在对AI隐藏状态栏占位符正则');
ok(hideStatusRegex.promptOnly === true && hideStatusRegex.markdownOnly === false, '状态栏占位符只从提示词隐藏');
ok(hideStatusRegex.replaceString === '', '状态栏占位符提示词替换为空');
const hideThinkPrompt = regexSource.find(script => script.id === 'tavernweave-hide-think-prompt-v0.7');
const hideThinkDisplay = regexSource.find(script => script.id === 'tavernweave-hide-think-display-v0.7');
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
ok(srcFiles.length >= 210, `全卡源码扫描覆盖${srcFiles.length}个文件`);
ok(allSrcText.includes('爱丽丝'), 'src源码包含阶段二爱丽丝资料');
ok(!allSrcText.includes('扮演20岁的林恩'), '全卡源码不残留20岁林恩冲突');
for (const staleText of ['E01的寻母线索', 'E12完成后不自动创建第149章', '紧贴林恩的感知、判断与情绪']) {
  ok(!allSrcText.includes(staleText), `全卡源码不残留旧口径：${staleText}`);
}
ok(!allSrcText.includes('大哔哔') && allSrcText.includes('大鸡巴'), '色色口径直写大鸡巴且无“大哔哔”遮蔽');
ok(!allSrcText.includes('禁止色色') && !allSrcText.includes('禁止性化'), '全卡源码无禁色表述残留');
ok(!allSrcText.includes('幼态外观期间恶堕恒为0') && !allSrcText.includes('吸引与恶堕仍为0'), '全卡源码无旧幼态/左左锁零表述残留');
ok(!/羽毛笔[\s\S]{0,40}(?:上辈子|前世)/.test(allSrcText) && !/欲望母树[\s\S]{0,40}(?:上辈子|前世|与林恩[^\n]{0,20}(?:交|床))/.test(allSrcText), '全卡源码不含用户私下剧透（羽毛笔前世、母树后续）');
const modelVisibleSrcFiles = srcFiles.filter(file => /\.(?:md|txt|html)$/i.test(file));
const modelVisibleSrcText = (await Promise.all(modelVisibleSrcFiles.map(file => readText(file, false)))).join('\n');
const blackMoonCount = (modelVisibleSrcText.match(/黑弦月/g) ?? []).length;
ok(blackMoonCount > 0, '黑弦月资料存在于源码');
ok(!sourceBook.entries.some(entry => entry.comment === '[概念·物品]黑弦月'), '旧黑弦月物品概念条目已删除');
ok(sourceBook.entries.some(entry => entry.comment === '[角色]黑弦月'), '世界书已注册黑弦月角色条目');
ok(Object.prototype.hasOwnProperty.call(initial.关系, '黑弦月'), '关系变量含黑弦月');
const blackMoonCharacterSource = await expectedEntryContent(sourceBook.entries.find(entry => entry.comment === '[角色]黑弦月'));
for (const gate of ['E51', 'E52', 'E53', 'E61', 'E62', 'E63']) {
  ok(blackMoonCharacterSource.includes(`${gate}.状态`), `黑弦月人设包含${gate}门控`);
}
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

const alternateGreetingFiles = manifest.card.alternate_greetings ?? [];
ok(Array.isArray(alternateGreetingFiles) && alternateGreetingFiles.length === 1, '契约注册1个备用开场白');
const alternateGreetingText = await readText(alternateGreetingFiles[0], false);
ok(alternateGreetingText.includes('<StatusPlaceHolderImpl/>') && alternateGreetingText.includes('<UpdateVariable>') && alternateGreetingText.includes('<initvar>'), '备用开场白含状态栏占位与initvar块');
const altInitMatch = alternateGreetingText.match(/<initvar>\s*([\s\S]*?)\s*<\/initvar>/);
ok(Boolean(altInitMatch), '备用开场白initvar块可提取');
const altInit = JSON.parse(altInitMatch[1]);
const e25Baseline = await readJson('src/initial_variables_e25.json');
ok(JSON.stringify(altInit) === JSON.stringify(e25Baseline), '备用开场白initvar与E25预兆基线深度一致');
exactKeys(altInit, ['元数据', '世界', '林恩', '事件', '关系', '角色关系', '系统'], 'E25预兆基线MVU根');
exactKeys(altInit.关系, characters, 'E25预兆基线二十四人关系');
ok(altInit.事件.锚点状态.E01.状态 === '完成' && altInit.事件.锚点状态.E24.状态 === '完成' && altInit.事件.锚点状态.E24.收尾 === true, 'E25预兆基线E01-E24完成收尾');
ok(altInit.事件.锚点状态.E25.状态 === '预兆' && altInit.事件.锚点状态.E25.收尾 === false, 'E25预兆基线E25预兆未收尾');
ok(altInit.事件.锚点状态.E26.状态 === '未触发' && altInit.事件.锚点状态.E64.状态 === '未触发', 'E25预兆基线E26起未触发');
ok(altInit.事件.唯一活跃事件.事件ID === '' && altInit.事件.唯一活跃事件.状态 === '无', 'E25预兆基线唯一活跃事件规范空');
ok(altInit.事件.近期预兆.事件ID === 'E25' && altInit.事件.近期预兆.紧迫度 === '极高', 'E25预兆基线近期预兆指向E25');
ok(validateEventLedger(altInit.事件).length === 0, 'E25预兆基线事件账本通过跨字段不变量');
ok(altInit.关系.爱丽丝.解锁 === true && altInit.关系.爱丽丝.处境.includes('隐去身形'), 'E25预兆基线爱丽丝已解锁且隐去未消散');
ok(altInit.关系.白逸.解锁 === true && altInit.关系.白逸.在场 === true, 'E25预兆基线白逸解锁在场');
ok(altInit.关系.猪头屠夫.解锁 === true && altInit.关系.猪头屠夫.位置 === '幸福之家厨房', 'E25预兆基线猪头屠夫以厨师身份解锁');
ok(altInit.世界.地点 === '幸福之家古堡' && altInit.世界.阶段编号 === 'S5', 'E25预兆基线世界状态为幸福之家');
ok(Array.isArray(packed.data?.alternate_greetings) && packed.data.alternate_greetings.length === alternateGreetingFiles.length && packed.data.alternate_greetings[0] === alternateGreetingText.trim(), '备用开场白已打包且与源码一致');

const statusStateSource = await readText('src/ui/status.html', false);
const fallbackMatch = statusStateSource.match(/const FALLBACK_STATE = (\{[\s\S]*?\})\s*;\s*let mvuAvailable/);
ok(Boolean(fallbackMatch), '状态栏FALLBACK_STATE可提取');
const statusFallback = JSON.parse(fallbackMatch[1]);
ok(JSON.stringify(statusFallback) === JSON.stringify(initial), '状态栏FALLBACK_STATE与初始变量深度一致');

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
ok(systemPromptText.includes('开场E02到E03') && systemPromptText.includes('原子迁移'), '系统提示强制开场E02→E03同轮事务');
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
ok(postHistoryText.includes('开场E02到E03') && postHistoryText.includes('单条`replace /事件`'), '后置历史协议强制开场E02→E03原子迁移');
ok(systemPromptText.includes('`事件.最近结果`始终是对象数组') && worldPromptText.includes('禁止写成字符串数组') && postHistoryText.includes('四字段对象') && postHistoryText.includes('必须仍为对象数组'), '最近结果对象契约镜像到系统、常驻世界书与后置协议');
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
ok(compileEjsStatements(mainlineText, '自主世界事件调度'), '自主世界事件调度EJS语句可在独立作用域解析');
ok(mainlineText.includes('锚点优先于原创'), '事件调度含锚点优先规则');
ok(mainlineText.includes('不要用原创客人占位'), '事件调度禁止原创占位');
ok(mainlineText.includes('衔接优先'), '事件调度含衔接优先规则');
ok(mainlineText.includes('未满足触发时机时') && mainlineText.includes('下一事件的完整引子仍不渲染'), '调度规则含触发时机守卫');
ok(mainlineText.includes('强制事务：开场基线E02') && mainlineText.includes('唯一活跃事件=标准空对象') && mainlineText.includes('近期预兆.事件ID=`E03`'), '事件调度含开场E02→E03强制事务');
const updateRulesText = await readText('src/prompts/mvu_update_rules.md');
ok(worldPromptText.includes('昨天/昨日/昨夜/今天/今日/今早/今晨/明天/明日/次日/翌日/第二天') && systemPromptText.includes('系统觉醒日次日·黎明') && postHistoryText.includes('任何“X天”时长') && updateRulesText.includes('能力的24小时时限仍可使用') && worldPromptText.includes('持续已久') && postHistoryText.includes('不带日历单位') && updateRulesText.includes('一阵子'), '相对日与天数时长禁令及正向替代写法镜像到常驻提示及MVU更新规则');
ok(updateRulesText.includes('支线可以长期挂起'), '更新规则允许支线挂起');
ok(updateRulesText.includes('不要用原创客人占位'), '更新规则禁止原创占位');
ok(updateRulesText.includes('衔接优先'), '更新规则含衔接优先');
ok(updateRulesText.includes('玩家写出继续营业') && updateRulesText.includes('E03=`预兆/收尾=false`'), '更新规则含开场推进触发语与事务');
ok(updateRulesText.includes('后件局部前置') && updateRulesText.includes('必要因果与替代入口'), '更新规则含触发时机守卫');
ok(updateRulesText.includes('"path":"/事件"') && updateRulesText.includes('禁止把一次事件迁移拆成多个'), '更新规则要求原子replace完整事件根');
ok(updateRulesText.includes('`变形`是替代结果已经稳定形成的收束态'), '更新规则明确变形为稳定终态');
ok(updateRulesText.includes('没有活跃事件') && updateRulesText.includes('没有预兆时'), '更新规则定义活跃事件与预兆规范空对象');
ok(updateRulesText.includes('开场基线特例是强制事务') && updateRulesText.includes('E02=`完成/收尾=true`') && updateRulesText.includes('近期预兆=指向E03'), '更新规则强制开场E02→E03完整迁移');
ok(updateRulesText.includes('类型固定为对象数组') && updateRulesText.includes('字符串数组代替'), '更新规则显式禁止最近结果字符串数组');
const outputFormatText = await readText('src/prompts/mvu_output_format.md');
ok(outputFormatText.includes('<StatusPlaceHolderImpl/>') && outputFormatText.includes('禁止使用`<setvar>`') && outputFormatText.includes('没有注入角色卡`post_history`'), '变量输出格式兼容省略post-history的预设');
ok(outputFormatText.includes('`最近结果`必须始终是四字段对象数组'), '输出格式显式保留最近结果四字段对象契约');
ok(outputFormatText.includes('时间检查只写“时间格式合规”') && outputFormatText.includes('不得在`Analysis`中复述'), '输出格式把时间自检限定为无禁词短句');
const systemPromptRules = await readText('src/prompts/system.md');
ok(systemPromptRules.includes('锚点优先于原创'), '系统提示含锚点优先规则');
ok(systemPromptRules.includes('衔接优先'), '系统提示含衔接优先规则');
ok(systemPromptRules.includes('玩家首次推进营业') && systemPromptRules.includes('开场E02到E03'), '系统提示含开场后第一轮推进规则');
ok(systemPromptRules.includes('后件局部前置成立') && systemPromptRules.includes('必要因果与替代入口'), '系统提示含触发时机守卫');
ok(systemPromptRules.includes('默认走向') && systemPromptRules.includes('绝不能把其中的林恩对白'), '系统提示保护玩家对林恩的叙事主权');
ok(mainlineText.includes('对应锚点`状态`置为`预兆`'), '调度规则要求预兆同步锚点状态');
ok(updateRulesText.includes('在完整`事件`对象中同时更新近期预兆与对应锚点'), '更新规则要求在完整事件对象中同步预兆锚点状态');
ok(systemPromptRules.includes('写预兆，并用单条`replace /事件`同步状态'), '系统提示要求预兆同步锚点状态');
ok(updateRulesText.includes('六十四个锚点状态'), '更新规则锚点计数为六十四个');
ok(!updateRulesText.includes('十二个锚点'), '更新规则无旧版十二个锚点残留');

for (let index = 0; index < contract.required.event_ids.length - 1; index += 1) {
  const eventId = contract.required.event_ids[index];
  const eventContent = await readText(sourceBook.entries.find(entry => entry.id === 300 + index).content_file);
  ok(eventContent.includes('## 下一事件引入'), `${eventId}蓝灯含下一事件引入段`);
}
const e01Bridge = await readText(sourceBook.entries.find(entry => entry.id === 300).content_file);
ok(e01Bridge.includes('## 下一事件引入（E02'), 'E01引入段指向E02');
const e20Content = await readText(sourceBook.entries.find(entry => entry.id === 319).content_file);
ok(e20Content.includes('## 下一事件引入（E21'), 'E20含E21正式订单桥');
const e35Content = await readText(sourceBook.entries.find(entry => entry.id === 334).content_file);
ok(e35Content.includes('## 下一事件引入（E36'), 'E35含E36阶段三入口桥');
const e64Content = await readText(sourceBook.entries.find(entry => entry.id === 363).content_file);
ok(!e64Content.includes('## 下一事件引入') && e64Content.includes('阶段4待续钩子') && e64Content.includes('不创建E65'), 'E64为开放钩子且不创建E65');
ok(mainlineText.includes('事件上下文窗口（常驻·按状态定位）'), '调度规则含事件上下文窗口');
ok(mainlineText.includes('cur - 3'), '上下文窗口前后各3个事件');
ok(mainlineText.includes('cur + 3'), '上下文摘要后向窗口为3个事件');
ok(mainlineText.includes('◆当前'), '上下文窗口标注当前事件');
ok(mainlineText.includes('detailWindow'), '上下文窗口计算事件详情窗口');
ok(mainlineText.includes('if (cur > 0) detailWindow.push(ctx[cur - 1].id)')
  && mainlineText.includes('if (cur < ctx.length - 1) detailWindow.push(ctx[cur + 1].id)'), '事件详情窗口严格保持当前±1');
ok(mainlineText.includes('E64') && mainlineText.includes('E63→E64'), '上下文窗口明确E64阶段三边界');
ok(mainlineText.includes('## 即时衔接段（常驻·按状态渲染）'), '常驻即时衔接段存在');
ok(mainlineText.includes('getvar("stat_data.事件.锚点状态.'), '衔接段使用getvar状态门控');
ok(mainlineText.includes('"活跃"') && mainlineText.includes('"变形"') && mainlineText.includes('"完成"') && mainlineText.includes('"取消"') && mainlineText.includes('"未触发"') && mainlineText.includes('"预兆"'), '衔接段门控覆盖六态');
ok(mainlineText.includes('收尾'), '衔接门控含收尾标记');
const bridgePairs = contract.required.event_ids.slice(0, -1).map((id, index) => [id, contract.required.event_ids[index + 1]]);
for (const [from, to] of bridgePairs) {
  ok(mainlineText.includes(`### ${from}→${to}`), `即时衔接段包含${from}→${to}`);
}
ok(bridgePairs.length === 63, '即时衔接段共63对');
ok(mainlineText.includes('### E63→E64') && !mainlineText.includes('### E64→'), '衔接段到E63→E64为止且E64无后续');
ok(mainlineText.includes('洋娃娃') && mainlineText.includes('断臂'), 'E01→E02引子token齐全');
ok(mainlineText.includes('猪类') && mainlineText.includes('拍门'), 'E02→E03引子token齐全');
ok(mainlineText.includes('求援信'), 'E14→E15引子token齐全');
ok(mainlineText.includes('空白信纸') && mainlineText.includes('是否发送均未决定'), 'E14→E15停在玩家可决定的求援节点');
ok(mainlineText.includes('茧囊路径') && mainlineText.includes('是否进入、如何使用药剂'), 'E11→E12停在玩家可决定的灾变节点');
ok(updateRulesText.includes('下一事件引入'), '更新规则引用蓝灯引入段');
ok(updateRulesText.includes('收尾'), '更新规则含收尾标记规则');
ok(systemPromptRules.includes('下一事件引入'), '系统提示引用蓝灯引入段');

const statusUiText = await readText('src/ui/status.html', false);
ok(statusUiText === statusStateSource, '状态栏验证使用同一源码快照');
ok(statusUiText.includes('FALLBACK_STATE'), '状态栏内嵌初始状态回退');
ok(statusUiText.trimStart().startsWith('<body>'), '状态栏含酒馆助手可识别的body前端标记');
ok(statusUiText.includes('data-wa-status-root'), '状态栏使用稳定根节点标记');
for (const character of characters) {
  ok(statusUiText.includes(`"${character}":`), `状态栏回退状态包含：${character}`);
}
ok(statusUiText.includes('"恶堕": 0'), '状态栏回退状态恶堕值初始为0');
ok(statusUiText.includes('"E01":') && statusUiText.includes('"状态": "完成"'), '状态栏回退状态E01完成');
ok(statusUiText.includes('"E02":') && statusUiText.includes('"状态": "活跃"'), '状态栏回退状态E02活跃');
ok(statusUiText.includes('"E03":') && statusUiText.includes('"状态": "未触发"'), '状态栏回退状态E03未触发');
ok(statusUiText.includes('"E64":'), '状态栏回退状态包含E64锚点');
ok(statusUiText.includes("from: 'E63', to: 'E64'"), '状态栏桥对覆盖E63→E64');
ok(!statusUiText.includes("from: 'E64'"), 'E64无推进按钮');
ok(statusUiText.includes("'E36'"), '状态栏桥对覆盖阶段三入口E36');
for (const [from, to] of bridgePairs) {
  ok(statusUiText.includes(`from: '${from}', to: '${to}'`), `状态栏桥对与契约一致：${from}→${to}`);
}
ok(statusUiText.includes('"事件ID": "E02"'), '状态栏回退有活跃事件');
ok(statusUiText.includes('"事件ID": ""'), '状态栏回退近期预兆为空');
ok(statusUiText.includes('17岁'), '状态栏年龄标签为17岁');
ok(statusUiText.includes('wa-advance-btn'), '状态栏含手动推进按钮');
ok(statusUiText.includes('推进：'), '状态栏按钮含推进文案');
ok(statusUiText.includes('replaceMvuData'), '状态栏按钮使用MVU写入接口');
ok(statusUiText.includes("message_id: 'latest'"), '状态栏推进只从latest读取并写回latest');
ok((statusUiText.match(/replaceMvuData\(/g) ?? []).length === 1, '状态栏推进只通过一次MVU完整替换写入');
ok(!statusUiText.includes('persistLatestMessageData') && !statusUiText.includes('setChatMessages') && !statusUiText.includes('saveChat'), '状态栏不再追加第二套聊天保存，避免部分提交');
ok(statusUiText.includes('mvuWritable') && statusUiText.includes("typeof mvu?.replaceMvuData === 'function'"), '状态栏单独检查MVU写入能力');
ok(statusUiText.includes('MVU 写入后复核不一致') && statusUiText.includes('已重新读取最新状态'), '状态栏写后复核并在异常时重新对齐宿主状态');
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
ok(statusUiText.includes('findCancelledPair') && statusUiText.includes('需正文判定局部依赖'), '取消态按钮禁用并交由正文判定局部依赖');
ok(!statusUiText.includes("fromState === '取消'\n            || (fromState === '活跃'"), '取消态不进入自动推进门槛');
ok(statusUiText.includes('收尾'), '状态栏按钮就绪含收尾判定');
ok(statusUiText.includes("toState === '未触发'") && statusUiText.includes('已有近期预兆'), '状态栏不重复推进已存在的预兆并在写前二次防守');
ok(statusUiText.indexOf("} else if (omenId) {") < statusUiText.indexOf("} else if (pair) {"), '状态栏已有预兆时优先禁用推进按钮');
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
if (hostAcceptance.sha256 !== null) ok(hostAcceptance.sha256 === sha256, 'pending记录的离线候选哈希与产物一致');
if (hostAcceptance.bytes !== null) ok(hostAcceptance.bytes === bytes, 'pending记录的离线候选字节数与产物一致');

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
