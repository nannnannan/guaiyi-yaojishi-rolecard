import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(workspace, '..', '..');
const v010Root = resolve(projectRoot, '角色卡本体', '诡异药剂师_MVU_v0.10(3.7f');
const sourceBook = JSON.parse(await readFile(resolve(v010Root, 'src', 'worldbook.json'), 'utf8'));
const failures = [];
const requiredSections = ['类别', '事实门槛', '定义', '来源', '机制', '限制与代价', '未知项', '禁止外推'];
const packetSpecs = {
  A: { start: 691, end: 712, uidStart: 2000, updates: [641, 648, 649, 651, 652, 654, 656, 657] },
  B: { start: 713, end: 734, uidStart: 2022, updates: [660, 662, 663, 664, 665, 667, 671, 673] },
  C: { start: 735, end: 756, uidStart: 2044, updates: [642, 650, 672, 675, 683, 686, 688, 689] },
};
const runtimeMetadata = /第\s*\d+\s*章|小总结|大总结|阶段[一二三四五六七八九十百]+|v0\.11|V0\.11|本版|原文第\s*\d+\s*行/;
const unsafePhrases = /萝莉控|师生\s*play|先啪后杀|以身相报|攻略成功|恶堕奖励|调教奖励|\brbq\b/i;
const existingKeys = new Set(sourceBook.entries.flatMap(entry => Array.isArray(entry.keys) ? entry.keys : []));
const existingUids = new Set(sourceBook.entries.map(entry => entry.id));
const newKeys = new Map();
const newRecords = [];
const updateRecords = [];

function eventNumbers(ids) {
  return ids.map(id => Number(String(id).slice(1)));
}

function isSortedUnique(numbers) {
  return numbers.every((number, index) => Number.isInteger(number)
    && (index === 0 || number > numbers[index - 1]));
}

async function readConcept(packetRoot, record, label) {
  const file = basename(String(record.content_file ?? ''));
  if (!file || file !== record.content_file) {
    failures.push(`${label} content_file必须是当前包内文件名`);
    return { file, content: '', heading: null };
  }
  let content = '';
  try {
    content = (await readFile(resolve(packetRoot, file), 'utf8')).replace(/\r\n/g, '\n').trim();
  } catch {
    failures.push(`${label} 缺正文文件${file}`);
    return { file, content, heading: null };
  }
  if (content.includes('\uFFFD')) failures.push(`${label} 含UTF-8替换字符`);
  if (content.includes('<%')) failures.push(`${label} 详细静态概念不得含EJS`);
  if (runtimeMetadata.test(content)) failures.push(`${label} 含运行正文禁用元数据`);
  if (unsafePhrases.test(content)) failures.push(`${label} 含禁用性化或奖励化短语`);
  const nonWhitespace = content.replace(/\s/g, '').length;
  if (nonWhitespace < 900) failures.push(`${label} 正文${nonWhitespace}非空白字符，低于900`);
  for (const section of requiredSections) {
    const count = (content.match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length;
    if (count !== 1) failures.push(`${label} 字段${section}应恰好1次，实际${count}`);
  }
  const heading = content.match(/^# 概念·([^·]+)·(.+?)（事件(\[[^\n]+\])）$/m);
  if (!heading) failures.push(`${label} 首行标题格式错误`);
  return { file, content, heading, nonWhitespace };
}

for (const [packet, spec] of Object.entries(packetSpecs)) {
  const packetRoot = resolve(workspace, `概念草稿_${packet}`);
  let names = [];
  try {
    names = await readdir(packetRoot);
  } catch {
    failures.push(`缺概念草稿_${packet}`);
    continue;
  }
  let registry;
  let updates;
  try {
    registry = JSON.parse(await readFile(resolve(packetRoot, `注册表_${packet}.json`), 'utf8'));
  } catch (error) {
    failures.push(`注册表_${packet}.json 无效：${error.message}`);
    continue;
  }
  try {
    updates = JSON.parse(await readFile(resolve(packetRoot, `更新表_${packet}.json`), 'utf8'));
  } catch (error) {
    failures.push(`更新表_${packet}.json 无效：${error.message}`);
    continue;
  }
  if (!Array.isArray(registry) || registry.length !== 22) failures.push(`注册表_${packet}应有22条`);
  if (!Array.isArray(updates) || updates.length !== 8) failures.push(`更新表_${packet}应有8条`);
  if (!Array.isArray(registry) || !Array.isArray(updates)) continue;

  const expectedIds = Array.from({ length: 22 }, (_, index) => `C${spec.start + index}`);
  if (JSON.stringify(registry.map(record => record.id)) !== JSON.stringify(expectedIds)) {
    failures.push(`注册表_${packet} ID必须为${expectedIds[0]}—${expectedIds.at(-1)}`);
  }
  const expectedUpdateIds = spec.updates.map(number => `C${number}`);
  if (JSON.stringify(updates.map(record => record.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))))
    !== JSON.stringify([...expectedUpdateIds].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))))) {
    failures.push(`更新表_${packet} ID集合错误`);
  }

  for (let index = 0; index < registry.length; index += 1) {
    const record = registry[index];
    const label = `${packet}/${record.id ?? `#${index}`}`;
    const expectedUid = spec.uidStart + index;
    if (record.uid !== expectedUid) failures.push(`${label} UID应为${expectedUid}`);
    if (existingUids.has(record.uid)) failures.push(`${label} UID${record.uid}与v0.10条目冲突`);
    if (!record.title || !record.category) failures.push(`${label} 缺标题或类别`);
    if (!Array.isArray(record.keys) || record.keys.length < 2 || record.keys.length > 5) failures.push(`${label} keys须2—5项`);
    if (!Array.isArray(record.event_ids) || record.event_ids.length === 0) failures.push(`${label} event_ids不能为空`);
    const nums = Array.isArray(record.event_ids) ? eventNumbers(record.event_ids) : [];
    if (!isSortedUnique(nums) || nums.some(number => number < 171 || number > 218)) failures.push(`${label} event_ids须为升序唯一E171—E218`);
    for (const key of record.keys ?? []) {
      if (typeof key !== 'string' || !key.trim()) failures.push(`${label} 含空key`);
      if (existingKeys.has(key)) failures.push(`${label} key与v0.10冲突：${key}`);
      if (newKeys.has(key)) failures.push(`${label} key与${newKeys.get(key)}冲突：${key}`);
      newKeys.set(key, label);
    }
    const { heading } = await readConcept(packetRoot, record, label);
    if (heading) {
      if (heading[1] !== record.category || heading[2] !== record.title) failures.push(`${label} 标题/类别与注册表不一致`);
      try {
        if (JSON.stringify(JSON.parse(heading[3])) !== JSON.stringify(record.event_ids)) failures.push(`${label} 标题事件数组不一致`);
      } catch { failures.push(`${label} 标题事件数组不是JSON`); }
    }
    newRecords.push(record);
  }

  for (const record of updates) {
    const label = `${packet}/更新${record.id}`;
    const numericId = Number(String(record.id).slice(1));
    const existing = sourceBook.entries.find(entry => entry.id === numericId);
    if (!existing) {
      failures.push(`${label} 找不到v0.10世界书条目`);
      continue;
    }
    const existingContent = await readFile(resolve(v010Root, existing.content_file), 'utf8');
    const existingHeading = existingContent.match(/^# 概念·([^·]+)·(.+?)（事件(\[[^\n]+\])）$/m);
    if (!existingHeading) {
      failures.push(`${label} 既有标题格式异常`);
      continue;
    }
    const expectedFile = basename(existing.content_file);
    if (record.content_file !== expectedFile) failures.push(`${label} 必须保留文件名${expectedFile}`);
    if (record.title !== existingHeading[2] || record.category !== existingHeading[1]) failures.push(`${label} 必须保留既有标题与类别`);
    if (!Array.isArray(record.event_ids)) failures.push(`${label} event_ids必须为数组`);
    const nums = Array.isArray(record.event_ids) ? eventNumbers(record.event_ids) : [];
    if (!isSortedUnique(nums) || nums.some(number => number < 1 || number > 218)) failures.push(`${label} event_ids须为升序唯一E01—E218`);
    const oldEvents = existing.extensions?.tavernweave?.event_ids ?? JSON.parse(existingHeading[3]);
    for (const oldId of oldEvents) if (!record.event_ids?.includes(oldId)) failures.push(`${label} 删除了既有事件${oldId}`);
    if (!record.event_ids?.some(id => Number(id.slice(1)) >= 171)) failures.push(`${label} 未追加本阶段事件`);
    const { content, heading, nonWhitespace } = await readConcept(packetRoot, record, label);
    if (nonWhitespace < existingContent.replace(/\s/g, '').length) failures.push(`${label} 更新正文短于既有正文`);
    if (heading) {
      if (heading[1] !== record.category || heading[2] !== record.title) failures.push(`${label} 标题/类别与更新表不一致`);
      try {
        if (JSON.stringify(JSON.parse(heading[3])) !== JSON.stringify(record.event_ids)) failures.push(`${label} 标题事件数组不一致`);
      } catch { failures.push(`${label} 标题事件数组不是JSON`); }
    }
    updateRecords.push({ ...record, existingFile: expectedFile, contentLength: content.length });
  }

  const registeredFiles = new Set([...registry, ...updates].map(record => record.content_file));
  const unregisteredMd = names.filter(name => name.endsWith('.md') && !registeredFiles.has(name));
  if (unregisteredMd.length) failures.push(`概念草稿_${packet} 有未注册正文：${unregisteredMd.join(',')}`);
}

const expectedNewIds = Array.from({ length: 66 }, (_, index) => `C${691 + index}`);
const actualNewIds = newRecords.map(record => record.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
if (JSON.stringify(actualNewIds) !== JSON.stringify(expectedNewIds)) failures.push('新增概念必须连续覆盖C691—C756');
const newUids = newRecords.map(record => record.uid);
if (new Set(newUids).size !== newUids.length) failures.push('新增概念UID重复');
if (updateRecords.length !== 24) failures.push(`既有概念更新应为24条，实际${updateRecords.length}`);

if (failures.length) {
  console.error(JSON.stringify({ status: 'failed', new_concepts: newRecords.length, updates: updateRecords.length, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: 'passed',
    new_concepts: newRecords.length,
    updates: updateRecords.length,
    logical_range: 'C691-C756',
    uid_range: '2000-2065',
    unique_new_keys: newKeys.size,
  }, null, 2));
}
