import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// 本草稿预期复制到“角色卡本体/<v0.11项目>/tools/”后执行。
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(projectRoot, '..', '..', '角色卡设定', 'v0.11工作区');
const conceptRoot = resolve(projectRoot, 'src', 'concepts');
const worldbookPath = resolve(projectRoot, 'src', 'worldbook.json');
const contractPath = resolve(projectRoot, 'contract.json');

const packets = [
  { packet: 'A', directory: '概念草稿_A', registry: '注册表_A.json', updates: '更新表_A.json' },
  { packet: 'B', directory: '概念草稿_B', registry: '注册表_B.json', updates: '更新表_B.json' },
  { packet: 'C', directory: '概念草稿_C', registry: '注册表_C.json', updates: '更新表_C.json' },
];
const expectedNewIds = Array.from({ length: 66 }, (_, index) => 'C' + (691 + index));
const expectedNewUids = Array.from({ length: 66 }, (_, index) => 2000 + index);
const expectedUpdateIds = [
  'C641', 'C642', 'C648', 'C649', 'C650', 'C651', 'C652', 'C654',
  'C656', 'C657', 'C660', 'C662', 'C663', 'C664', 'C665', 'C667',
  'C671', 'C672', 'C673', 'C675', 'C683', 'C686', 'C688', 'C689',
];
const requiredSections = ['类别', '事实门槛', '定义', '来源', '机制', '限制与代价', '未知项', '禁止外推'];
const runtimeMetadata = /第\s*\d+\s*章|小总结|大总结|阶段[一二三四五六七八九十百]+|v0\.11|V0\.11|本版|原文第\s*\d+\s*行/;
const unsafePhrases = /萝莉控|师生\s*play|先啪后杀|以身相报|攻略成功|恶堕奖励|调教奖励|\brbq\b/i;
const stage7UidStart = 2000;
const stage7UidEnd = 2065;
const reservedEventUidStart = 870;
const reservedEventUidEnd = 917;

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function logicalNumber(id, label) {
  const match = String(id ?? '').match(/^C(\d+)$/);
  if (!match) throw new Error(label + ' 的逻辑ID无效：' + id);
  return Number(match[1]);
}

function eventNumbers(ids, label, minimum, maximum) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error(label + ' event_ids必须是非空数组');
  }
  const numbers = ids.map(id => {
    if (!/^E(?:0[1-9]|[1-9]\d{1,2})$/.test(String(id))) {
      throw new Error(label + ' 含无效事件ID：' + id);
    }
    return Number(String(id).slice(1));
  });
  if (numbers.some((number, index) => number < minimum || number > maximum
    || (index > 0 && number <= numbers[index - 1]))) {
    throw new Error(label + ' event_ids必须升序唯一且位于E' + minimum + '—E' + maximum);
  }
  return numbers;
}

function pathIsInside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
}

function parseHeading(content, label) {
  const heading = content.match(/^# 概念·([^·]+)·(.+?)（事件(\[[^\n]+\])）$/m);
  if (!heading) throw new Error(label + ' 首行标题格式错误');
  let headingEvents;
  try {
    headingEvents = JSON.parse(heading[3]);
  } catch {
    throw new Error(label + ' 标题事件数组不是JSON');
  }
  return {
    category: heading[1],
    title: heading[2],
    eventIds: headingEvents,
  };
}

async function readJson(path, label) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(label + ' 不是有效JSON：' + error.message);
  }
  return parsed;
}

async function readDraftConcept(packetRoot, record, label) {
  const inputName = basename(String(record.content_file ?? ''));
  if (!inputName || inputName !== record.content_file) {
    throw new Error(label + ' content_file必须是当前概念包内的文件名');
  }
  const inputPath = resolve(packetRoot, inputName);
  const raw = await readFile(inputPath, 'utf8');
  const content = raw.replace(/\r\n/g, '\n').trim();
  if (content.includes('\uFFFD')) throw new Error(label + ' 含UTF-8替换字符');
  if (content.includes('<%')) throw new Error(label + ' 静态概念正文不得含EJS');
  if (runtimeMetadata.test(content)) throw new Error(label + ' 含运行正文禁用元数据');
  if (unsafePhrases.test(content)) throw new Error(label + ' 含禁用性化或奖励化短语');
  const nonWhitespace = content.replace(/\s/g, '').length;
  if (nonWhitespace < 900) throw new Error(label + ' 正文低于900个非空白字符');
  for (const section of requiredSections) {
    const count = (content.match(new RegExp('^- ' + section + '：', 'gm')) ?? []).length;
    if (count !== 1) {
      throw new Error(label + ' 必须且只能包含一个“' + section + '”字段');
    }
  }
  const heading = parseHeading(content, label);
  if (heading.category !== record.category || heading.title !== record.title) {
    throw new Error(label + ' 标题或类别与注册表不一致');
  }
  if (!sameArray(heading.eventIds, record.event_ids)) {
    throw new Error(label + ' 标题事件数组与注册表不一致');
  }
  return { inputName, inputPath, raw, content, heading, nonWhitespace };
}

function rangeSnapshot(entries, start, end) {
  return entries
    .filter(entry => entry.id >= start && entry.id <= end)
    .sort((left, right) => left.id - right.id)
    .map(entry => JSON.stringify(entry));
}

const newRecords = [];
const updateRecords = [];
for (const packet of packets) {
  const packetRoot = resolve(workspaceRoot, packet.directory);
  const registry = await readJson(resolve(packetRoot, packet.registry), packet.registry);
  const updates = await readJson(resolve(packetRoot, packet.updates), packet.updates);
  if (!Array.isArray(registry) || registry.length !== 22) {
    throw new Error(packet.registry + ' 必须恰好包含22条新增概念');
  }
  if (!Array.isArray(updates) || updates.length !== 8) {
    throw new Error(packet.updates + ' 必须恰好包含8条既有概念更新');
  }
  for (const record of registry) newRecords.push({ ...record, packetRoot, packet: packet.packet });
  for (const record of updates) updateRecords.push({ ...record, packetRoot, packet: packet.packet });
}

newRecords.sort((left, right) => logicalNumber(left.id, '新增概念') - logicalNumber(right.id, '新增概念'));
updateRecords.sort((left, right) => logicalNumber(left.id, '更新概念') - logicalNumber(right.id, '更新概念'));
if (!sameArray(newRecords.map(record => record.id), expectedNewIds)) {
  throw new Error('新增概念逻辑ID必须恰好为C691—C756');
}
if (!sameArray(newRecords.map(record => record.uid), expectedNewUids)) {
  throw new Error('新增概念世界书UID必须与C691—C756逐项映射为2000—2065');
}
if (!sameArray(updateRecords.map(record => record.id), expectedUpdateIds)) {
  throw new Error('既有概念更新集合必须恰好为冻结的24条');
}

const worldbook = await readJson(worldbookPath, 'src/worldbook.json');
if (!Array.isArray(worldbook.entries)) throw new Error('src/worldbook.json 缺少entries数组');
const sourceIds = worldbook.entries.map(entry => entry.id);
if (sourceIds.some(id => !Number.isInteger(id)) || new Set(sourceIds).size !== sourceIds.length) {
  throw new Error('导入前世界书UID必须为唯一整数');
}

const reservedBefore = rangeSnapshot(worldbook.entries, reservedEventUidStart, reservedEventUidEnd);
const newUidSet = new Set(expectedNewUids);
const baseEntries = worldbook.entries.filter(entry => !newUidSet.has(entry.id));
const baseKeys = new Map();
for (const entry of baseEntries) {
  for (const key of Array.isArray(entry.keys) ? entry.keys : []) {
    if (!baseKeys.has(key)) baseKeys.set(key, entry.id);
  }
}

const newKeys = new Map();
const newEntries = [];
const contentWrites = [];
for (let index = 0; index < newRecords.length; index += 1) {
  const record = newRecords[index];
  const label = record.packet + '/' + record.id;
  const numericId = logicalNumber(record.id, label);
  if (numericId !== 691 + index || record.uid !== stage7UidStart + index) {
    throw new Error(label + ' 逻辑ID与世界书UID映射不连续');
  }
  if (!record.title || !record.category) throw new Error(label + ' 缺标题或类别');
  if (!Array.isArray(record.keys) || record.keys.length < 2 || record.keys.length > 5) {
    throw new Error(label + ' keys必须为2—5项');
  }
  if (new Set(record.keys).size !== record.keys.length) throw new Error(label + ' 内部key重复');
  eventNumbers(record.event_ids, label, 171, 218);

  for (const key of record.keys) {
    if (typeof key !== 'string' || !key.trim()) throw new Error(label + ' 含空key');
    if (baseKeys.has(key)) {
      throw new Error(label + ' key与既有世界书UID' + baseKeys.get(key) + '冲突：' + key);
    }
    if (newKeys.has(key)) {
      throw new Error(label + ' key与' + newKeys.get(key) + '冲突：' + key);
    }
    newKeys.set(key, label);
  }

  const draft = await readDraftConcept(record.packetRoot, record, label);
  if (!draft.inputName.startsWith(record.id + '_')) {
    throw new Error(label + ' 正文文件名必须以逻辑ID开头');
  }
  const expectedContentFile = 'src/concepts/' + draft.inputName;
  const previous = worldbook.entries.find(entry => entry.id === record.uid);
  if (previous && (previous.content_file !== expectedContentFile
    || previous.comment !== '[概念·' + record.category + ']' + record.title)) {
    throw new Error(label + ' 的UID' + record.uid + '已被其他条目占用');
  }
  const fileOwner = worldbook.entries.find(entry => entry.id !== record.uid
    && entry.content_file === expectedContentFile);
  if (fileOwner) {
    throw new Error(label + ' 的正文路径已由世界书UID' + fileOwner.id + '占用');
  }
  const outputPath = resolve(conceptRoot, draft.inputName);
  if (!pathIsInside(conceptRoot, outputPath)) throw new Error(label + ' 输出越过src/concepts');

  newEntries.push({
    id: record.uid,
    comment: '[概念·' + record.category + ']' + record.title,
    keys: [...record.keys],
    secondary_keys: [],
    constant: false,
    enabled: false,
    insertion_order: record.uid,
    content_file: expectedContentFile,
    extensions: {
      exclude_recursion: true,
      prevent_recursion: true,
      tavernweave: {
        logical_id: record.id,
        event_ids: [...record.event_ids],
      },
    },
  });
  contentWrites.push({ label, outputPath, raw: draft.raw });
}

const updatePlans = [];
for (const record of updateRecords) {
  const label = record.packet + '/更新' + record.id;
  const numericId = logicalNumber(record.id, label);
  if (numericId >= reservedEventUidStart && numericId <= reservedEventUidEnd) {
    throw new Error(label + ' 不得落入事件UID保留区');
  }
  const matches = worldbook.entries.filter(entry => entry.id === numericId);
  if (matches.length !== 1) throw new Error(label + ' 必须唯一命中既有世界书条目');
  const existing = matches[0];
  if (!Array.isArray(existing.keys)) throw new Error(label + ' 既有keys缺失');
  const expectedComment = '[概念·' + record.category + ']' + record.title;
  if (existing.comment !== expectedComment) {
    throw new Error(label + ' 标题或类别与既有世界书条目不一致');
  }
  const existingPath = resolve(projectRoot, existing.content_file);
  if (!pathIsInside(conceptRoot, existingPath)) {
    throw new Error(label + ' 既有正文不在src/concepts内');
  }
  const expectedFile = basename(existing.content_file);
  if (record.content_file !== expectedFile) {
    throw new Error(label + ' 必须保留既有文件名' + expectedFile);
  }

  const existingRaw = await readFile(existingPath, 'utf8');
  const existingContent = existingRaw.replace(/\r\n/g, '\n').trim();
  const existingHeading = parseHeading(existingContent, label + '/既有正文');
  if (existingHeading.category !== record.category || existingHeading.title !== record.title) {
    throw new Error(label + ' 必须保留既有正文标题与类别');
  }
  const draft = await readDraftConcept(record.packetRoot, record, label);
  eventNumbers(record.event_ids, label, 1, 218);
  const oldEvents = existing.extensions?.tavernweave?.event_ids ?? existingHeading.eventIds;
  for (const oldId of oldEvents) {
    if (!record.event_ids.includes(oldId)) throw new Error(label + ' 删除了既有事件' + oldId);
  }
  if (!record.event_ids.some(id => Number(id.slice(1)) >= 171)) {
    throw new Error(label + ' 未追加本阶段事件');
  }
  if (draft.nonWhitespace < existingContent.replace(/\s/g, '').length) {
    throw new Error(label + ' 更新正文短于既有正文');
  }

  updatePlans.push({
    id: numericId,
    record,
    before: existing,
    outputPath: existingPath,
    raw: draft.raw,
  });
  contentWrites.push({ label, outputPath: existingPath, raw: draft.raw });
}
if (updatePlans.length !== 24) throw new Error('既有概念更新必须恰好为24条');
if (new Set(contentWrites.map(plan => plan.outputPath)).size !== contentWrites.length) {
  throw new Error('概念正文写入目标重复');
}

const updateById = new Map(updatePlans.map(plan => [plan.id, plan]));
const plannedEntries = worldbook.entries
  .filter(entry => !newUidSet.has(entry.id))
  .map(entry => {
    const plan = updateById.get(entry.id);
    if (!plan) return entry;
    return {
      ...entry,
      extensions: {
        ...(entry.extensions ?? {}),
        tavernweave: {
          ...(entry.extensions?.tavernweave ?? {}),
          event_ids: [...plan.record.event_ids],
        },
      },
    };
  });
plannedEntries.push(...newEntries);
plannedEntries.sort((left, right) =>
  (left.insertion_order ?? left.id) - (right.insertion_order ?? right.id) || left.id - right.id);

const plannedIds = plannedEntries.map(entry => entry.id);
if (new Set(plannedIds).size !== plannedIds.length) throw new Error('导入后世界书UID重复');
const plannedStage7 = plannedEntries.filter(entry => entry.id >= stage7UidStart && entry.id <= stage7UidEnd);
if (plannedStage7.length !== 66 || !sameArray(plannedStage7.map(entry => entry.id), expectedNewUids)) {
  throw new Error('导入后必须恰好包含UID2000—2065共66条新概念');
}
const reservedAfter = rangeSnapshot(plannedEntries, reservedEventUidStart, reservedEventUidEnd);
if (!sameArray(reservedBefore, reservedAfter)) {
  throw new Error('概念导入计划触碰了事件UID870—917，已拒绝写入');
}

for (const plan of updatePlans) {
  const after = plannedEntries.find(entry => entry.id === plan.id);
  for (const field of ['id', 'comment', 'keys', 'constant', 'enabled', 'insertion_order', 'content_file']) {
    if (JSON.stringify(plan.before[field]) !== JSON.stringify(after[field])) {
      throw new Error(plan.record.id + ' 更新不得改变既有字段' + field);
    }
  }
  if (!sameArray(after.extensions?.tavernweave?.event_ids, plan.record.event_ids)) {
    throw new Error(plan.record.id + ' event_ids未按更新表替换');
  }
}

const plannedWorldbook = { ...worldbook, entries: plannedEntries };
const contract = await readJson(contractPath, 'contract.json');
if (!contract.required?.concept_activation) throw new Error('contract缺required.concept_activation');
const plannedContract = JSON.parse(JSON.stringify(contract));
const activation = plannedContract.required.concept_activation;
activation.concept_id_end = 756;
activation.stage7_concept_id_start = 691;
activation.stage7_concept_id_end = 756;
activation.stage7_concept_uid_start = stage7UidStart;
activation.stage7_concept_uid_end = stage7UidEnd;
activation.stage7_note = 'v0.11新增逻辑概念C691-C756共66条，世界书UID2000-2065；另原位更新24条既有概念正文与event_ids，保留既有key、标题、类别和UID；事件UID870-917保持不变';
plannedContract.required.worldbook_entry_count = plannedEntries.length;

// 所有注册表、正文、UID、保留区与契约断言通过后才开始写入。
await mkdir(conceptRoot, { recursive: true });
for (const plan of contentWrites) {
  await writeFile(plan.outputPath, plan.raw, 'utf8');
}
await writeFile(worldbookPath, JSON.stringify(plannedWorldbook, null, 2) + '\n', 'utf8');
await writeFile(contractPath, JSON.stringify(plannedContract, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  status: 'imported-v0.11-concepts',
  workspace_root: workspaceRoot,
  new_concepts: newEntries.length,
  updated_concepts: updatePlans.length,
  logical_range: 'C691-C756',
  uid_range: '2000-2065',
  preserved_event_uid_range: '870-917',
  preserved_event_entries: reservedAfter.length,
  unique_new_keys: newKeys.size,
  worldbook_entries: plannedEntries.length,
}, null, 2));
