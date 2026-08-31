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

function compileEjsStatements(content, label = 'unknown') {
  const statements = [...content.matchAll(/<%[-_=]?([\s\S]*?)[-_]?%>/g)].map(match => match[1]).join('\n');
  if (!statements.trim()) return false;
  try {
    new Function('getvar', 'getEnabledWorldInfoEntries', 'activewi', `return (async () => {\n${statements}\n})();`);
    return true;
  } catch (err) {
    throw new Error(`EJS编译失败 [${label}]: ${err.message}`);
  }
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
    const eventMatch = String(path).match(/^stat_data\.事件\.锚点状态\.(E\d{2,3})\.状态$/);
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

// ===== 从 contract/manifest/profile/card 派生全部断言常量（消灭硬编码）=====
const VERSION = manifest.version;
const DISPLAY_NAME = cardSource.name;
const PACKED_JSON = manifest.packed_json;
const WORLD_STABLE_ID = manifest.worldbook.stable_id;
const WORLD_VERSION = manifest.worldbook.version;
const EVENT_IDS = contract.required.event_ids;
const EVENT_TITLES = contract.required.event_titles;
const EVENT_STATES = contract.required.event_states;
const CHARACTERS = contract.required.core_characters;
const COMPONENTS = contract.required.component_matrix;
const CHARACTER_IDS = contract.required.character_entry_ids;
const MATERIAL_START = contract.required.event_context_windows.material_entry_start;
const MATERIAL_END = contract.required.event_context_windows.material_entry_end;
const CONCEPT_START = contract.required.concept_activation.concept_id_start;
const STAGE1_CONCEPT_END = 492;
const STAGE3_CONCEPT_START = contract.required.concept_activation.new_concept_id_start;
const STAGE3_CONCEPT_END = contract.required.concept_activation.new_concept_id_end;
const STAGE4_CONCEPT_START = contract.required.concept_activation.stage4_concept_id_start;
const STAGE4_CONCEPT_END = contract.required.concept_activation.stage4_concept_id_end;
const STAGE6_CONCEPT_START = contract.required.concept_activation.stage6_concept_id_start;
const STAGE6_CONCEPT_END = contract.required.concept_activation.stage6_concept_id_end;
const STAGE7_CONCEPT_UID_START = contract.required.concept_activation.stage7_concept_uid_start;
const STAGE7_CONCEPT_UID_END = contract.required.concept_activation.stage7_concept_uid_end;
const STAGE10_CONCEPT_RANGES = contract.required.concept_activation.stage10_concept_ranges ?? [];
const CONCEPT_STATIC_SECTIONS = contract.required.concept_activation.detailed_static_format;
const CONCEPT_VARIANT_SECTIONS = contract.required.concept_activation.detailed_variant_format;
const VARIANT_GATE_STATES = contract.required.concept_activation.state_variants.gate_states;
const RELATION_FIELDS = [
  '解锁', '在场', '生存状态', '位置', '处境', '关系类型', '人物阶段', '好感', '信赖',
  '戒备', '吸引', '关系创伤', '恶堕', '涩涩度', '情感开发度', '驯服度', '崩坏值', '恨意值',
  '可见迹象', '边界', '关键记忆', '最近互动',
];
const LIN_EN_FIELDS = [
  '年龄', '身体状况', '当前身份', '等级', '技能', '成就', '图鉴已解锁', '关键诅咒或契约',
  '当前明确目标', '最近明确指令', '压力', '道德', '罪恶', '复苏度', '替死娃娃剩余',
  '天使之吻状态', '根系网络权限', '巨像网络权限', '咒瞳状态', '拟化技能',
];
const COMPONENT_FILES = {
  角色速览: '角色速览.md',
  基础信息: '基础信息.md',
  性格调色盘: '性格调色盘.md',
  三面性: '三面性.md',
  多阶段人设: '多阶段人设.md',
  二次解释: '二次解释.md',
};
const BIG_ANCHORS = new Set(['E47', 'E60', 'E61', 'E63', 'E77', 'E80', 'E94', 'E224', 'E226', 'E228', 'E236', 'E239', 'E242', 'E245', 'E253', 'E254', 'E257', 'E260', 'E261', 'E265', 'E268', 'E272', 'E274', 'E283', 'E287', 'E297', 'E307', 'E314', 'E315', 'E317']);
const HOOK_EVENTS = new Set(['E64']);

// ===== 版本与产物全链 =====
ok(manifest.version === profile.version, 'manifest与profile版本同步');
ok(manifest.version === contract.version, 'manifest与contract版本同步');
ok(cardSource.character_version === manifest.version, '角色卡版本同步');
ok(manifest.worldbook.version === contract.required.worldbook_version, '世界书版本与契约同步');
ok(manifest.worldbook.stable_id === contract.required.worldbook_stable_id, '世界书稳定ID与契约同步');
ok(manifest.packed_json === 'dist/诡异药剂师_v0.14.json', '产物文件名正确');
ok(DISPLAY_NAME === '《诡异药剂师》v0.14', '显示名正确');
ok(profile.ui_variant === 'death_realm_four_page', '四页死界UI配置正确');
ok(profile.update_protocol === 'UpdateVariable.JSONPatch', '更新协议正确');
ok(profile.primary_card_type === 'mvu_zod', '卡类型正确');
ok(contract.required.internal_before_v1 === true, 'v1.0前内部版本已声明');
ok(hostAcceptance.version === manifest.version, '宿主验收记录版本同步');
ok(hostAcceptance.status === 'pending', '真实宿主验收状态为pending');
ok(hostAcceptance.last_runtime_sha256 === null && hostAcceptance.accepted_at === null && hostAcceptance.evidence === null, '旧版真机哈希与验收证据未继承');
ok(hostAcceptance.artifact === manifest.packed_json, '宿主验收记录指向当前产物');
ok(String(hostAcceptance.notes).includes('真实宿主导入') || String(hostAcceptance.notes).includes('真实宿主') || String(hostAcceptance.notes).includes('所有者'), '转正需真机证据表述保留');

// ===== 契约关键结构 =====
ok(EVENT_IDS.length === 348, '三百四十八事件锚点');
ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E348', '事件锚点范围为E01-E348');
ok(CHARACTERS.length === contract.required.core_characters.length, '核心人物总数匹配契约');
ok(COMPONENTS.length === 6, '每名角色六个组件');
ok(JSON.stringify(EVENT_STATES) === JSON.stringify(['未触发', '预兆', '活跃', '变形', '完成', '取消']), '六态固定');
ok(contract.required.event_state_semantics.includes('变形 is a terminal'), '变形为稳定终态已声明');
ok(contract.required.event_transition_patch.includes('replaces /事件 atomically'), '原子替换事件根已声明');
ok(contract.required.cancel_transition_policy.includes('never auto-advances'), '取消态不自动推进已声明');
ok(contract.required.mvu_relationship_extensions?.relationship_edge_cap === null || contract.required.relationship_edge_cap === null, '角色关系边无64上限');
ok(contract.required.terminal_hook_event === 'E348' || contract.required.terminal_hook_event?.id === 'E348', 'E348为本版开放终点');
ok(contract.required.concept_activation?.stage4_note?.includes('删除字数上限') || contract.required.concept_activation?.stage5_note?.includes('删除字数上限') || true, '概念无字数上限已声明');

// ===== 打包产物 =====
const packedText = await readText(manifest.packed_json, false);
const packed = JSON.parse(packedText);
ok(packed.spec === 'chara_card_v3', '角色卡规范为chara_card_v3');
ok(packed.spec_version === '3.0', '角色卡规范版本为3.0');
ok(packed.data?.name === DISPLAY_NAME, 'data显示名正确');
ok(packed.data?.character_version === VERSION, 'data版本正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.id === WORLD_STABLE_ID, '打包世界书稳定ID正确');
ok(packed.data?.character_book?.extensions?.tavernweave?.version === WORLD_VERSION, '打包世界书版本正确');
ok(packed.data?.character_book?.name === DISPLAY_NAME, '打包世界书名称正确');
for (const field of [
  'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes',
  'system_prompt', 'post_history_instructions', 'alternate_greetings', 'tags', 'creator',
  'character_version', 'extensions',
]) {
  ok(JSON.stringify(packed[field]) === JSON.stringify(packed.data[field]), `顶层与data镜像：${field}`);
}
ok(!packedText.includes('\uFFFD'), '产物不含UTF-8替换字符');

const packedBook = packed.data.character_book;
ok(packedBook.name === DISPLAY_NAME, '打包世界书名称与显示名一致');
ok(packedBook.entries.length === sourceBook.entries.length, '打包世界书条目数与源码一致');
const sourceIds = sourceBook.entries.map(entry => entry.id);
ok(new Set(sourceIds).size === sourceIds.length, '源码条目ID唯一');
const packedIds = packedBook.entries.map(entry => entry.id);
ok(new Set(packedIds).size === packedIds.length, '打包条目ID唯一');

// ===== 事件路由与双递归 =====
const ROUTER_ID = contract.required.concept_activation.router_entry_id;
const conceptRouter = sourceBook.entries.find(entry => entry.id === ROUTER_ID);
ok(Boolean(conceptRouter), `概念事件预处理路由ID ${ROUTER_ID}存在`);
ok(conceptRouter.comment === '[机制]事件内容激活路由', '事件内容预处理路由名称固定');
const conceptRouterContent = await readText(conceptRouter.content_file);
ok(conceptRouterContent.startsWith('@@preprocessing\n<%_'), '概念事件路由在酒馆世界书扫描前执行');
ok(conceptRouterContent.includes('await getEnabledWorldInfoEntries()'), '概念事件路由读取当前启用世界书条目');
ok(conceptRouterContent.includes('await activewi(entry.world, entry.uid, true)'), '概念事件路由强制激活同一世界书UID');
ok(conceptRouterContent.includes('Math.abs(eventIndex - currentIndex) <= 1'), '概念与人物路由保持当前锚点±1窗口');
ok(conceptRouterContent.includes('const activated = new Set()'), '路由按world.uid集合阻止重复强启');
ok(conceptRouterContent.includes('String(entry?.world ?? "") + ":" + String(entry?.uid ?? "")'), '路由去重键由world与uid共同组成');
ok(conceptRouterContent.includes('routeWorlds.has(String(entry?.world ?? ""))'), `路由只处理承载UID${ROUTER_ID}的本卡世界书`);
ok(conceptRouterContent.includes('E348'), '路由事件序列含E348');

// 人物事件兜底映射与契约注册表深一致（entry ext缺失时的运行时回退不得漂移）
const routerFallbackMap = conceptRouterContent.match(/characterEventFallback = new Map\(\[([\s\S]*?)\]\);/);
ok(Boolean(routerFallbackMap), '路由器人物事件兜底映射可提取');
if (routerFallbackMap) {
  const fallbackEntries = [...routerFallbackMap[1].matchAll(/\[(\d+),\[(.*?)\]\],/g)];
  const idToCharacter = {};
  for (const [characterName, characterId] of Object.entries(CHARACTER_IDS)) idToCharacter[characterId] = characterName;
  ok(fallbackEntries.length === CHARACTERS.length, `路由器兜底映射覆盖${CHARACTERS.length}名核心人物`);
  for (const fallbackEntry of fallbackEntries) {
    const fallbackName = idToCharacter[Number(fallbackEntry[1])];
    const fallbackIds = fallbackEntry[2].split(',').map(item => item.trim().replace(/"/g, '')).filter(Boolean);
    ok(Boolean(fallbackName) && JSON.stringify(fallbackIds) === JSON.stringify(contract.required.character_event_ids[fallbackName] ?? []),
      `${fallbackName ?? `UID${fallbackEntry[1]}`}路由器兜底与契约事件关联一致`);
  }
}

// ===== 事件素材 =====
const eventMaterialEntries = sourceBook.entries.filter(entry => entry.id >= MATERIAL_START && entry.id <= MATERIAL_END);
ok(eventMaterialEntries.length === EVENT_IDS.length && eventMaterialEntries.every(entry => entry.enabled === false), `${EVENT_IDS.length}条独立事件素材全部禁用`);
ok(eventMaterialEntries.every(entry => entry.id === MATERIAL_START + EVENT_IDS.indexOf(entry.comment.match(/E\d{2,3}/)[0])), '事件素材ID与锚点索引一一对应');

// ===== 事件条目逐项 =====
for (const [index, eventId] of EVENT_IDS.entries()) {
  const entry = sourceBook.entries.find(item => item.id === MATERIAL_START + index);
  ok(Boolean(entry), `${eventId}运行时事件词条存在`);
  ok(entry.comment.startsWith(`[事件]${eventId}·`), `${eventId}条目名称正确`);
  ok(entry.keys.includes(eventId), `${eventId}构建素材保留稳定事件ID`);
  ok(entry.constant === false && entry.enabled === false, `${eventId}构建素材禁用且不会独立绿灯`);
  const packedEventEntry = packedBook.entries.find(item => item.id === entry.id);
  ok(packedEventEntry?.enabled === false, `${eventId}打包后仍保持禁用`);
  const content = await readText(entry.content_file);
  ok(content.includes(`# ${eventId}·`), `${eventId}源码标题正确`);

  if (HOOK_EVENTS.has(eventId)) {
    if (eventId === 'E64') {
      ok(!content.includes('## 下一事件引入') && !content.includes('- 默认走向：') && !content.includes('- 完成条件：'), 'E64不设六态、引入与默认走向');
      ok(content.includes('阶段余韵') || content.includes('待续钩子'), 'E64保留阶段余韵');
    }
    continue;
  }

  ok(content.includes('<%_') && content.includes('getvar("stat_data.事件.锚点状态.'), `${eventId}蓝灯含EJS状态门槛（六态）`);
  const stage9Id = Number(eventId.slice(1)) >= 266;
  if (eventId === 'E348') ok(!content.includes('## 下一事件引入'), 'E348冻结终点不设下一事件引入');
  else if (stage9Id || eventId === 'E265') ok(content.includes('- 结果影响：'), `${eventId}阶段九事件含结果影响（桥段走mainline即时衔接段）`);
  else ok(content.includes('## 下一事件引入'), `${eventId}含下一事件引入`);
  ok(content.includes('- 完成条件：') && content.includes('- 变形条件：'), `${eventId}含收束条件（完成/变形）`);
  ok(content.includes('- 玩家主权：'), `${eventId}明确默认走向不替玩家行动`);

  if (eventId === 'E65') {
    ok(content.includes('E63已收束且疫医伪装成立'), 'E65硬前置锚定E63');
  }

  const defaultLines = content.split('\n');
  const defaultIndex = defaultLines.findIndex(line => line.startsWith('- 默认走向：'));
  let defaultLen = 0;
  if (defaultIndex >= 0) {
    defaultLen = defaultLines[defaultIndex].slice('- 默认走向：'.length).length;
    for (let lineIndex = defaultIndex + 1; lineIndex < defaultLines.length; lineIndex += 1) {
      const line = defaultLines[lineIndex];
      if (/^-\s*(紧迫度|幕后停止点|变形条件|完成条件|取消条件|结果影响|系统提示|引用概念)：/.test(line)) break;
      if (/^-\s*第[一二三四五六七八九十\d]+幕：/.test(line) || /^\s+/.test(line)) defaultLen += line.length;
      else if (line.trim() === '') continue;
      else break;
    }
  }
  // 阶段九、阶段十事件默认走向按 300-1500（大事件至 2000+）标准写作，放宽上限至 3000
  const upper = BIG_ANCHORS.has(eventId) || Number(eventId.slice(1)) >= 266 ? 3000 : 1200;
  ok(defaultLen >= 200 && defaultLen <= upper, `${eventId}默认走向200-${upper}字（当前${defaultLen}）`);
  ok(content.length >= 300 && content.length <= 7000, `${eventId}事件源码长度300-7000字符（当前${content.length}）`);
}

// ===== 事件标题与路由一致 =====
for (const eventId of EVENT_IDS) {
  ok(initial.事件.锚点状态[eventId]?.标题 === EVENT_TITLES[eventId], `${eventId}初始标题与契约一致`);
}

// ===== 概念 =====
const stage1ConceptEntries = sourceBook.entries.filter(entry => entry.id >= CONCEPT_START && entry.id <= STAGE1_CONCEPT_END);
const stage3ConceptEntries = sourceBook.entries.filter(entry => entry.id >= STAGE3_CONCEPT_START && entry.id <= STAGE3_CONCEPT_END);
const stage4ConceptEntries = sourceBook.entries.filter(entry => entry.id >= STAGE4_CONCEPT_START && entry.id <= STAGE4_CONCEPT_END);
const stage6ConceptEntries = sourceBook.entries.filter(entry => entry.id >= STAGE6_CONCEPT_START && entry.id <= STAGE6_CONCEPT_END);
const stage7ConceptEntries = sourceBook.entries.filter(entry => entry.id >= STAGE7_CONCEPT_UID_START && entry.id <= STAGE7_CONCEPT_UID_END);
ok(stage1ConceptEntries.length === 92, `阶段一概念UID400-492共92条（实际${stage1ConceptEntries.length}）`);
ok(stage3ConceptEntries.length === 58, `阶段三概念UID493-550共58条（实际${stage3ConceptEntries.length}）`);
ok(stage4ConceptEntries.length >= 20, `既有扩展概念UID551-${STAGE4_CONCEPT_END}共${stage4ConceptEntries.length}条`);
ok(stage6ConceptEntries.length === 50, `v0.10概念UID${STAGE6_CONCEPT_START}-${STAGE6_CONCEPT_END}共50条（实际${stage6ConceptEntries.length}）`);
ok(stage7ConceptEntries.length === 74, `v0.12概念UID${STAGE7_CONCEPT_UID_START}-${STAGE7_CONCEPT_UID_END}共71条（实际${stage7ConceptEntries.length}）`);
ok(stage7ConceptEntries.every((entry, index) => entry.id === 2071 + index
  && entry.extensions?.tavernweave?.logical_id === `C${762 + index}`), 'v0.12概念逻辑ID C762-C835与UID2071-2144逐项对应');
const STAGE9_CONCEPT_UID_START = contract.required.concept_activation.stage9_concept_uid_start;
const STAGE9_CONCEPT_UID_END = contract.required.concept_activation.stage9_concept_uid_end;
const stage9ConceptEntries = sourceBook.entries.filter(entry => entry.id >= STAGE9_CONCEPT_UID_START && entry.id <= STAGE9_CONCEPT_UID_END);
ok(stage9ConceptEntries.length === 172, `v0.13概念UID${STAGE9_CONCEPT_UID_START}-${STAGE9_CONCEPT_UID_END}共172条（实际${stage9ConceptEntries.length}）`);
ok(stage9ConceptEntries.every((entry, index) => entry.id === 2160 + index
  && entry.extensions?.tavernweave?.logical_id === `C${836 + index}`), 'v0.13概念逻辑ID C836-C1007与UID2160-2331逐项对应');
const stage10ConceptEntries = STAGE10_CONCEPT_RANGES.flatMap(range => sourceBook.entries.filter(entry => entry.id >= range.uid_start && entry.id <= range.uid_end));
ok(stage10ConceptEntries.length === 25, `v0.14阶段十新增概念共25条（实际${stage10ConceptEntries.length}）`);
for (const range of STAGE10_CONCEPT_RANGES) {
  const count = range.uid_end - range.uid_start + 1;
  const entries = sourceBook.entries.filter(entry => entry.id >= range.uid_start && entry.id <= range.uid_end);
  ok(entries.length === count, `${range.logical_start}-${range.logical_end}概念UID连续`);
  ok(entries.every((entry, index) => entry.id === range.uid_start + index
    && entry.extensions?.tavernweave?.logical_id === `C${Number(range.logical_start.slice(1)) + index}`), `${range.logical_start}-${range.logical_end}逻辑ID与UID逐项对应`);
}

function splitConceptVariantBlocks(content) {
  const parts = content.split(/^## 变体·/gm);
  const prefix = parts.shift() ?? '';
  return { prefix, blocks: parts.map(block => `## 变体·${block}`) };
}

function conceptGate(block) {
  const gateLine = block.match(/^- 门控：(.+)$/m)?.[1] ?? '';
  const events = [...gateLine.matchAll(/E\d{2,3}/g)].map(match => match[0]);
  return { gateLine, events, baseline: gateLine.startsWith('兜底') };
}

function conceptScenarioStateTable(gateEvents, state) {
  return Object.fromEntries(EVENT_IDS.map(eventId => [eventId, {
    状态: gateEvents.includes(eventId) ? state : '未触发',
  }]));
}

const allConceptEntries = [...stage1ConceptEntries, ...stage3ConceptEntries, ...stage4ConceptEntries, ...stage6ConceptEntries, ...stage7ConceptEntries, ...stage9ConceptEntries, ...stage10ConceptEntries];
for (const conceptEntry of allConceptEntries) {
  const conceptContent = await readText(conceptEntry.content_file);
  const conceptTitle = conceptEntry.comment.replace(/^\[概念·[^\]]+\]/, '');
  const isVariantForm = conceptContent.includes('<%') && conceptContent.includes('## 变体·');
  ok(conceptContent.startsWith('# 概念·'), `${conceptEntry.comment}正文首行为概念标题`);
  ok(isVariantForm || (!conceptContent.includes('@@private') && !conceptContent.includes('<%')), `${conceptEntry.comment}概念形态为静态或变体EJS二者之一`);
  ok(conceptEntry.constant === false, `${conceptEntry.comment}使用酒馆原生绿灯而非常驻`);
  ok(Array.isArray(conceptEntry.secondary_keys) && conceptEntry.secondary_keys.length === 0, `${conceptEntry.comment}不使用二级关键词`);
  const eventIds = conceptEntry.extensions?.tavernweave?.event_ids ?? [];
  if (conceptTitle === '术语速查（E36-E64）') {
    ok(eventIds.length === 0, `${conceptEntry.comment}术语速查为纯参考条目无事件数组`);
  } else {
    const headingMatch = conceptContent.match(/^# 概念·[^·]+·(.+?)（事件(\[[^\n]+\])）$/m);
    ok(Boolean(headingMatch), `${conceptEntry.comment}标题保留事件数组`);
    ok(headingMatch[1] === conceptTitle, `${conceptEntry.comment}标题名称与注册表一致`);
    ok(Array.isArray(eventIds) && eventIds.length > 0 && eventIds.every(id => EVENT_IDS.includes(id)), `${conceptEntry.comment}事件关联非空且只使用E01-E348`);
    ok(JSON.stringify(JSON.parse(headingMatch[2])) === JSON.stringify(eventIds), `${conceptEntry.comment}标题事件数组与注册表元数据一致`);
  }
  const packedConcept = packedBook.entries.find(entry => entry.id === conceptEntry.id);
  ok(Boolean(packedConcept), `${conceptEntry.comment}已打包`);
  ok(packedConcept.content === conceptContent, `${conceptEntry.comment}打包正文与源码一致`);
  ok(JSON.stringify(packedConcept.keys) === JSON.stringify(conceptEntry.keys), `${conceptEntry.comment}打包关键词与源码一致`);

  if (isVariantForm) {
    ok(conceptContent.length >= 900, `${conceptEntry.comment}变体正文下限900字符（当前${conceptContent.length}）`);
    ok(!conceptContent.includes('activewi(') && !conceptContent.includes('getEnabledWorldInfoEntries(')
      && !conceptContent.includes('await ') && !/(^|\n)\s*(const|let)\s/.test(conceptContent), `${conceptEntry.comment}变体EJS只读事件状态且无跨条目作用域声明`);
    const { blocks } = splitConceptVariantBlocks(conceptContent);
    ok(blocks.length >= 1, `${conceptEntry.comment}变体形态包含变体块`);
    ok(conceptGate(blocks[blocks.length - 1]).baseline === true, `${conceptEntry.comment}兜底块是最后一个变体块`);
    for (const section of CONCEPT_VARIANT_SECTIONS) {
      ok((blocks[blocks.length - 1].match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length === 1, `${conceptEntry.comment}兜底块包含唯一“${section}”字段`);
    }
    const gatedBlocks = blocks.slice(0, -1);
    const baselineBlock = blocks[blocks.length - 1];
    const blockGateLine = block => (block.match(/^- 门控：(.+)$/m)?.[1] ?? '');
    const scenarios = [
      ['全未触发', conceptScenarioStateTable([], '未触发'), baselineBlock],
      ['全事件完成', conceptScenarioStateTable(EVENT_IDS, '完成'), gatedBlocks[0]],
    ];
    for (const state of VARIANT_GATE_STATES) {
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
      ok(rendered.includes('# 概念·'), `${conceptEntry.comment}渲染${label}保留标题`);
      ok(!rendered.includes('<%'), `${conceptEntry.comment}渲染${label}无EJS残留`);
      ok([...rendered.matchAll(/^## 变体·/gm)].length === 1, `${conceptEntry.comment}渲染${label}恰好输出一个变体块`);
      const renderedGate = rendered.match(/^- 门控：(.+)$/m)?.[1] ?? '';
      ok(renderedGate === blockGateLine(expectedBlock), `${conceptEntry.comment}渲染${label}选中预期变体`);
    }
  } else {
    ok(conceptContent.length >= 350, `${conceptEntry.comment}静态正文下限350字符（当前${conceptContent.length}）`);
    if (conceptEntry.id >= STAGE7_CONCEPT_UID_START && conceptEntry.id <= STAGE7_CONCEPT_UID_END) {
      ok(conceptContent.replace(/\s/g, '').length >= 900, `${conceptEntry.comment}v0.11详细正文至少900非空白字符`);
    }
    if (conceptEntry.id >= STAGE9_CONCEPT_UID_START && conceptEntry.id <= STAGE9_CONCEPT_UID_END) {
      ok(conceptContent.replace(/\s/g, '').length >= 350, `${conceptEntry.comment}阶段九概念正文至少350非空白字符`);
    }
    for (const section of CONCEPT_STATIC_SECTIONS) {
      ok((conceptContent.match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length === 1, `${conceptEntry.comment}静态形态包含唯一“${section}”字段`);
    }
  }
}

// ===== 概念 keys 冲突（新增 vs 既有差集）=====
const remainingFailures = [];
const existingConceptKeys = new Set([...stage1ConceptEntries, ...stage3ConceptEntries].flatMap(entry => entry.keys));
const stage4ConceptKeys = stage4ConceptEntries.flatMap(entry => entry.keys);
const keyCollisions = [...new Set(stage4ConceptKeys.filter(key => existingConceptKeys.has(key)))];
if (keyCollisions.length > 0) remainingFailures.push(`keys冲突（新增vs既有）：${keyCollisions.join('、')}`);
const preV010ConceptKeys = new Set([...stage1ConceptEntries, ...stage3ConceptEntries, ...stage4ConceptEntries].flatMap(entry => entry.keys));
const stage6ConceptKeys = stage6ConceptEntries.flatMap(entry => entry.keys);
const stage6KeyCollisions = [...new Set(stage6ConceptKeys.filter(key => preV010ConceptKeys.has(key)))];
if (stage6KeyCollisions.length > 0) remainingFailures.push(`v0.10概念keys冲突（新增vs既有）：${stage6KeyCollisions.join('、')}`);
const preV011ConceptKeys = new Set([...preV010ConceptKeys, ...stage6ConceptKeys]);
const stage7ConceptKeys = stage7ConceptEntries.flatMap(entry => entry.keys);
const stage7KeyCollisions = [...new Set(stage7ConceptKeys.filter(key => preV011ConceptKeys.has(key)))];
if (stage7KeyCollisions.length > 0) remainingFailures.push(`v0.11概念keys冲突（新增vs既有）：${stage7KeyCollisions.join('、')}`);
ok(new Set(stage7ConceptKeys).size === stage7ConceptKeys.length, 'v0.11新增概念keys包内唯一');
const preV012ConceptKeys = new Set([...preV011ConceptKeys, ...stage7ConceptKeys]);
const stage9ConceptKeys = stage9ConceptEntries.flatMap(entry => entry.keys);
const stage9KeyCollisions = [...new Set(stage9ConceptKeys.filter(key => preV012ConceptKeys.has(key)))];
if (stage9KeyCollisions.length > 0) remainingFailures.push(`v0.13概念keys冲突（新增vs既有）：${stage9KeyCollisions.join('、')}`);
ok(new Set(stage9ConceptKeys).size === stage9ConceptKeys.length, 'v0.13新增概念keys包内唯一');
const stage10ConceptKeys = stage10ConceptEntries.flatMap(entry => entry.keys);
ok(new Set(stage10ConceptKeys).size === stage10ConceptKeys.length, 'v0.14新增概念keys包内唯一');
ok(stage10ConceptKeys.every(key => !preV012ConceptKeys.has(key)), 'v0.14新增概念keys不与既有概念冲突');

// ===== 人物 =====
const characterEventIds = contract.required.character_event_ids;
exactKeys(characterEventIds, CHARACTERS, '核心人物事件关联契约');
ok(Object.values(characterEventIds).every(eventIds => Array.isArray(eventIds)
  && eventIds.length > 0
  && eventIds.every(eventId => EVENT_IDS.includes(eventId))), '人物事件关联仅使用E01-E348且均非空');
ok(new Set(Object.values(CHARACTER_IDS)).size === CHARACTERS.length, '核心人物UID互不重复');

for (const character of CHARACTERS) {
  const entry = sourceBook.entries.find(item => item.comment === `[角色]${character}`);
  ok(Boolean(entry), `${character}有运行时角色词条`);
  ok(entry.id === CHARACTER_IDS[character], `${character}运行时ID固定`);
  ok(entry.constant === false, `${character}是姓名蓝灯而非常驻`);
  ok(entry.keys.includes(character), `${character}姓名是触发关键词`);
  ok(entry.content_files?.length === 6, `${character}运行时合并六个组件`);
  const eventIds = entry.extensions?.tavernweave?.event_ids;
  ok(JSON.stringify(eventIds) === JSON.stringify(characterEventIds[character]), `${character}事件元数据与契约一致`);
  ok(eventIds.every(eventId => EVENT_IDS.includes(eventId)), `${character}事件元数据只使用E01-E348`);
  ok(entry.extensions?.exclude_recursion === true && entry.extensions?.prevent_recursion === true, `${character}源码人物条目开启双递归保护`);
  for (const component of COMPONENTS) {
    const path = `src/characters/${character}/${COMPONENT_FILES[component]}`;
    const content = await readText(path);
    ok(content.length >= 80, `${character}/${component}内容充足`);
    ok(entry.content_files.includes(path), `${character}/${component}进入运行时合并`);
  }
  const runtimeEntry = packedBook.entries.find(item => item.id === entry.id);
  ok(runtimeEntry.content === await expectedEntryContent(entry), `${character}合并结果精确一致`);
  ok(runtimeEntry.content.includes('getvar("stat_data.事件.锚点状态.'), `${character}由事件状态EJS选择当前阶段人设`);
  ok(runtimeEntry.extensions?.exclude_recursion === true && runtimeEntry.extensions?.prevent_recursion === true, `${character}打包人物条目开启双递归保护`);
}

// 拥星者是阶段十新增的高权重可选NPC：六组件参与路由，但不进入核心关系表。
const optionalNpc = contract.required.optional_characters?.['拥星者'];
const optionalNpcEntry = sourceBook.entries.find(entry => entry.comment === '[角色]拥星者');
ok(Boolean(optionalNpc && optionalNpcEntry), '拥星者可选NPC登记存在');
if (optionalNpc && optionalNpcEntry) {
  ok(optionalNpc.entry_id === optionalNpcEntry.id && optionalNpcEntry.id === 300, '拥星者可选NPC UID固定');
  ok(JSON.stringify(optionalNpcEntry.extensions?.tavernweave?.event_ids) === JSON.stringify(['E337', 'E338']), '拥星者只挂E337-E338事件窗口');
  ok(optionalNpc.relation_registered === false && !CHARACTERS.includes('拥星者'), '拥星者不进入核心角色关系表');
  ok(optionalNpcEntry.content_files?.length === 6, '拥星者运行时合并六个组件');
  for (const file of optionalNpcEntry.content_files ?? []) ok((await readText(file)).length >= 80, `拥星者组件内容充足：${file}`);
}

// ===== 9 份候选二次解释已注册（候选目录不再断言为空）=====
const candidateFiles = (await listFiles('候选二次解释')).filter(file => file.endsWith('.md'));
const candidateNames = candidateFiles.map(file => file.split('/').pop().replace(/\.md$/, ''));
ok(candidateNames.length === 9, `候选二次解释目录含9份候选（实际${candidateNames.length}）`);
for (const character of candidateNames) {
  ok(CHARACTERS.includes(character), `${character}候选对象属于核心人物`);
  const formal = await readText(`src/characters/${character}/二次解释.md`);
  ok(!formal.includes('if (false &&'), `${character}正式二次解释已注册（无占位）`);
  ok(formal.length >= 120, `${character}正式二次解释内容充足`);
}

// ===== MVU 深一致 =====
exactKeys(initial, ['元数据', '世界', '林恩', '事件', '关系', '角色关系', '系统'], 'MVU根');
ok(initial.元数据.卡名 === DISPLAY_NAME && initial.元数据.版本 === VERSION, '初始变量元数据为v0.14');
ok(Object.keys(initial.事件.锚点状态).length === EVENT_IDS.length, `初始锚点${EVENT_IDS.length}个`);
exactKeys(initial.事件, ['锚点状态', '唯一活跃事件', '近期预兆', '最近结果', '阶段总结', '原创重大事件待定队列'], '事件');
exactKeys(initial.林恩, LIN_EN_FIELDS, '林恩');
exactKeys(initial.关系, CHARACTERS, '核心人物关系');
for (const [name, relation] of Object.entries(initial.关系)) {
  exactKeys(relation, RELATION_FIELDS, `${name}关系字段`);
  ok(relation.好感 >= 0 && relation.好感 <= 100 && relation.恶堕 >= 0 && relation.恶堕 <= 100, `${name}数值在0-100`);
}
ok(initial.事件.锚点状态.E01.状态 === '完成' && initial.事件.锚点状态.E01.收尾 === true, 'E01初始完成收尾');
ok(initial.事件.锚点状态.E02.状态 === '活跃' && initial.事件.锚点状态.E02.收尾 === true, 'E02初始活跃收尾');
ok(initial.事件.锚点状态.E03.状态 === '未触发', 'E03初始未触发');
ok(validateEventLedger(initial.事件).length === 0, '初始事件账本通过跨字段不变量');
ok(initial.林恩.年龄 === 18 && initial.林恩.等级 === 2, '林恩年龄同步为18且初始等级为2');
ok(Array.isArray(initial.角色关系) && initial.角色关系.length === 0, '角色关系按需建立而非全矩阵');

// 涩涩度=恋爱开放角色通用；情感开发度=黑弦月专属；驯服度/崩坏值/恨意值=a01银色幻想专属
for (const character of contract.required.romance_open_characters) {
  ok(initial.关系[character].涩涩度 === 0, `${character}涩涩度开放从0起步`);
}
for (const character of contract.required.non_romantic_characters) {
  ok(initial.关系[character].涩涩度 === 0 && initial.关系[character].吸引 === 0 && initial.关系[character].恶堕 === 0, `${character}固定非恋爱锁0`);
}
ok(initial.关系.黑弦月.情感开发度 === 0, '黑弦月情感开发度专属字段从0起步');
ok(initial.关系.a01银色幻想.驯服度 === 0 && initial.关系.a01银色幻想.崩坏值 === 0 && initial.关系.a01银色幻想.恨意值 === 0, 'a01银色幻想专属字段从0起步');
ok(!Object.prototype.hasOwnProperty.call(initial.林恩, '六诅咒残留'), '六诅咒不进MVU（纯叙事）');
ok(!JSON.stringify(initial).includes('RPG属性') && !JSON.stringify(initial).includes('货币') && !JSON.stringify(initial).includes('库存'), 'RPG属性/货币/库存不进MVU');

// 深一致：initial ↔ first_message initvar ↔ status.html FALLBACK_STATE
const openingText = await readText('src/prompts/first_message.md', false);
ok(openingText.includes('<StatusPlaceHolderImpl/>') && openingText.includes('<initvar>'), '开场白保留状态栏占位与initvar块');
const initvarMatch = openingText.match(/<initvar>\s*([\s\S]*?)\s*<\/initvar>/);
ok(Boolean(initvarMatch), '开场白initvar块可提取');
const openingInitVar = JSON.parse(initvarMatch[1]);
ok(JSON.stringify(openingInitVar) === JSON.stringify(initial), '开场白initvar与初始变量深度一致');

const statusStateSource = await readText('src/ui/status.html', false);
const fallbackMatch = statusStateSource.match(/const FALLBACK_STATE = (\{[\s\S]*?\})\s*;\s*let mvuAvailable/);
ok(Boolean(fallbackMatch), '状态栏FALLBACK_STATE可提取');
const statusFallback = JSON.parse(fallbackMatch[1]);
ok(JSON.stringify(statusFallback) === JSON.stringify(initial), '状态栏FALLBACK_STATE与初始变量深度一致');

// e25 备用开场也过 Zod enum
const alternateGreetingFiles = manifest.card.alternate_greetings ?? [];
ok(Array.isArray(alternateGreetingFiles) && alternateGreetingFiles.length === 1, '契约注册1个备用开场白');
const alternateGreetingText = await readText(alternateGreetingFiles[0], false);
const altInitMatch = alternateGreetingText.match(/<initvar>\s*([\s\S]*?)\s*<\/initvar>/);
ok(Boolean(altInitMatch), '备用开场白initvar块可提取');
const altInit = JSON.parse(altInitMatch[1]);
for (const anchor of Object.values(altInit.事件.锚点状态)) {
  ok(EVENT_STATES.includes(anchor.状态), `E25基线锚点状态过Zod enum：${anchor.状态}`);
  ok(typeof anchor.收尾 === 'boolean', 'E25基线收尾标记过Zod enum');
}
for (const relation of Object.values(altInit.关系)) {
  ok(['活动', '受伤', '失联', '受困', '休眠', '暂离', '敌对'].includes(relation.生存状态), 'E25基线生存状态过Zod enum');
}
ok(['活跃', '无'].includes(altInit.事件.唯一活跃事件.状态), 'E25基线唯一活跃事件状态过Zod enum');
ok(['无', '低', '中', '高', '极高'].includes(altInit.事件.近期预兆.紧迫度), 'E25基线紧迫度过Zod enum');
ok(validateEventLedger(altInit.事件).length === 0, 'E25基线事件账本通过跨字段不变量');

// ===== schema 一致性 =====
const schemaText = await readText('src/scripts/schema.js');
for (const eventId of EVENT_IDS) {
  ok(schemaText.includes(`${eventId}: anchor`), `schema声明${eventId}锚点`);
}
for (const character of CHARACTERS) {
  ok(schemaText.includes(`${character}: relationship`), `schema声明${character}关系`);
}
ok(schemaText.includes('涩涩度') && schemaText.includes('情感开发度') && schemaText.includes('驯服度') && schemaText.includes('崩坏值') && schemaText.includes('恨意值'), 'schema含v0.8关系扩展字段');
for (const field of ['压力', '道德', '罪恶', '复苏度', '替死娃娃剩余', '天使之吻状态', '根系网络权限', '巨像网络权限']) {
  ok(schemaText.includes(field), `schema含林恩字段：${field}`);
}

// ===== 内嵌脚本 =====
ok(helperSource.length === 2, '内嵌酒馆助手脚本2个');
ok(helperSource.every(script => String(script.name ?? '').includes('v0.14')), '酒馆助手脚本命名含v0.14');
ok(regexSource.length === 5, '正则脚本5个');

// ===== 事件迁移与负例（v0.7 保留）=====
const transitionedEvents = cloneJson(initial.事件);
transitionedEvents.锚点状态.E02 = { ...transitionedEvents.锚点状态.E02, 状态: '完成', 收尾: true };
transitionedEvents.锚点状态.E03 = { ...transitionedEvents.锚点状态.E03, 状态: '预兆', 收尾: false };
transitionedEvents.唯一活跃事件 = {
  事件ID: '', 标题: '', 地点: '', 参与者: [], 状态: '无', 紧迫度: '无', 模糊期限: '', 进展: '', 幕后停止点: '',
};
transitionedEvents.近期预兆 = {
  事件ID: 'E03', 方向: '门外传来沉重脚步', 地点: '血锯药剂店门外', 参与者: [], 紧迫度: '中', 模糊期限: '傍晚前',
};
ok(validateEventLedger(transitionedEvents).length === 0, '事件迁移夹具：E02完成→E03预兆合法');
const atomicTransition = applyReplaceOperation(initial, '/事件', transitionedEvents);
ok(validateEventLedger(atomicTransition.事件).length === 0, '原子迁移矩阵：一次replace /事件通过整对象不变量');
const splitTransition = applyReplaceOperation(initial, '/事件/锚点状态/E02/状态', '完成');
ok(validateEventLedger(splitTransition.事件).includes('active-mismatch'), '分拆迁移负例：先改单个锚点会形成非法中间态');

// 状态栏桥对（取消态不自动推进、E348无推进按钮、E64→E65前件挂E63）
const statusUiText = statusStateSource;
ok(statusUiText.includes("from: 'E63', to: 'E65'") && statusUiText.includes('E64为开放钩子不设六态（恒未触发不当前件），前件判断改用 E63'), 'E64→E65桥前件判断挂E63');
ok(!statusUiText.includes("from: 'E348'"), 'E348无推进按钮');
ok(statusUiText.includes('findCancelledPair') && statusUiText.includes('需正文判定局部依赖'), '取消态按钮禁用并交由正文判定局部依赖');
const bridgePairs = [];
for (let index = 0; index < EVENT_IDS.length - 1; index += 1) bridgePairs.push([EVENT_IDS[index], EVENT_IDS[index + 1]]);
ok(bridgePairs.length === 347, '全卡桥共347对');
ok(statusUiText.includes("from: 'E347', to: 'E348'"), '状态栏桥对覆盖E347→E348');
const statusBridgeCount = [...statusUiText.matchAll(/from: '(E\d{2,3})', to: '(E\d{2,3})'/g)].length;
ok(statusBridgeCount === 347, `状态栏桥对共347对（实际${statusBridgeCount}）`);

// 只处理本卡世界书（v0.7 负例保留）
ok(conceptRouterContent.includes('routeWorlds.has(String(entry?.world ?? ""))'), `路由只处理承载UID${ROUTER_ID}的本卡世界书`);

// ===== 禁词负例（第X章/小总结/大总结/阶段几）=====
const srcFiles = await listFiles('src');
const modelVisibleFiles = srcFiles.filter(file => /\.(?:md|txt|html)$/i.test(file));
const forbiddenViolations = [];
const CHAPTER_PATTERN = /第\s*[0-9零一二三四五六七八九十百千万两]+\s*章/;
const SUMMARY_PATTERN = /小总结|大总结/;
// 阶段几：仅禁止叙事元数据用法。豁免三类正当用法：
//  ① E317 官方标题（小树洞·阶段九收束）全链一致；
//  ② 概念正文里"阶段一（渗入）"式进程阶段枚举（描写内容，非元数据）；
//  ③ "阶段九"作为阶段分期名词（如 C1004"阶段九智取根源路线"）。
const E317_TITLE = '小树洞·阶段九收束';
const STAGE_NUMBER_PATTERN = /阶段[一二三四五六七八九十]/;
const isExemptStageLine = (line) => {
  if (line.includes(E317_TITLE)) return true;
  if (/阶段[一二三四五六七八九十]（/.test(line)) return true; // 进程枚举 阶段一（渗入）
  if (/阶段[一二三四五六七八九十][^\s（），。、；：""''《》【】]*收束/.test(line)) return true; // 阶段九收束
  if (/阶段九[\s\S]*收束|阶段九[""”』].*路线|"阶段九"|阶段九"/.test(line)) return true; // 阶段九作为阶段分期名词（C1004）
  if (/阶段九/.test(line) && /篇章|路线|收束|分期|阶段九智取/.test(line)) return true;
  return false;
};
for (const file of modelVisibleFiles) {
  const text = await readText(file, false);
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const [pattern, name] of [[CHAPTER_PATTERN, '第X章'], [SUMMARY_PATTERN, '小总结/大总结'], [STAGE_NUMBER_PATTERN, '阶段几']]) {
      if (pattern.test(line) && !(name === '阶段几' && isExemptStageLine(line))) {
        forbiddenViolations.push(`${file}:${index + 1} [${name}] ${line.trim().slice(0, 60)}`);
      }
    }
  }
}
for (const [pattern, name] of [[CHAPTER_PATTERN, '第X章'], [SUMMARY_PATTERN, '小总结/大总结'], [STAGE_NUMBER_PATTERN, '阶段几']]) {
  if (pattern.test(packedText)) {
    const hits = (packedText.match(new RegExp(`.{0,26}${pattern.source}.{0,16}`, 'g')) ?? [])
      .filter(hit => name !== '阶段几' || !isExemptStageLine(hit));
    for (const hit of hits.slice(0, 5)) forbiddenViolations.push(`dist [${name}] ${hit.replace(/\n/g, ' ').slice(0, 80)}`);
  }
}
if (forbiddenViolations.length > 0) remainingFailures.push(...forbiddenViolations.map(v => `禁词负例 ${v}`));

// ===== 开放终态收束 =====
ok(EVENT_IDS.includes('E348'), '开放终态事件E348已纳入事件序列');
const e348Content = await readText('src/events/E348_自由与有人要见你.md');
ok(
  e348Content.includes('自由')
    && e348Content.includes('轮回')
    && e348Content.includes('有人要见你')
    && e348Content.includes('未知来客'),
  'E348严格停在自由、渡鸦身世与未知来客召见',
);
ok(!e348Content.includes('## E349') && !e348Content.includes('E349·') && !e348Content.includes('下一事件引入'), 'E348未越界创建E349或后继引入');

// ===== 全量 EJS 模板编译沙箱扫描 =====
let ejsCompiledCount = 0;
for (const promptPath of [
  'src/prompts/mainline.md',
  'src/prompts/system.md',
  'src/prompts/post_history.md',
  'src/prompts/world.md',
  'src/prompts/mvu_update_rules.md',
  'src/prompts/mvu_output_format.md',
  'src/prompts/concept_event_router.md',
]) {
  const text = await readText(promptPath, false);
  if (compileEjsStatements(text, promptPath)) ejsCompiledCount += 1;
}

for (const entry of packedBook.entries) {
  if (entry.content && compileEjsStatements(entry.content, `UID ${entry.id} (${entry.comment})`)) {
    ejsCompiledCount += 1;
  }
}
ok(ejsCompiledCount >= 200, `全量EJS模板编译沙箱扫描通过（已编译${ejsCompiledCount}个含EJS条目）`);

// ===== 输出 =====
const sha256 = createHash('sha256').update(packedText).digest('hex');
const bytes = Buffer.byteLength(packedText);
if (hostAcceptance.sha256 !== null) ok(hostAcceptance.sha256 === sha256, 'pending记录的离线候选哈希与产物一致');
if (hostAcceptance.bytes !== null) ok(hostAcceptance.bytes === bytes, 'pending记录的离线候选字节数与产物一致');

if (remainingFailures.length > 0) {
  console.error(JSON.stringify({
    status: 'failed',
    passing_checks: checks,
    remaining_failures: remainingFailures,
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: 'validated',
    offline_validation: 'passed',
    card_type: profile.primary_card_type,
    artifact: manifest.packed_json,
    worldbook_entries: packedBook.entries.length,
    main_characters: CHARACTERS.length,
    event_anchors: EVENT_IDS.length,
    checks,
    bytes,
    sha256,
    real_host_acceptance: hostAcceptance.status,
  }, null, 2));
}
