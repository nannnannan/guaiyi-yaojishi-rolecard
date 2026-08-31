import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(projectRoot, '..', '..', '角色卡设定', 'v0.10工作区');
const conceptRoot = resolve(projectRoot, 'src', 'concepts');
const packets = [
  ['概念草稿_A', '注册表_A.json'],
  ['概念草稿_B', '注册表_B.json'],
  ['概念草稿_C', '注册表_C.json'],
];

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const registries = [];
for (const [directory, registryFile] of packets) {
  const packetRoot = resolve(workspaceRoot, directory);
  const records = await readJson(resolve(packetRoot, registryFile));
  if (!Array.isArray(records)) throw new Error(`${registryFile} 必须是数组`);
  for (const record of records) registries.push({ ...record, packetRoot });
}

registries.sort((a, b) => Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)));
const expectedIds = Array.from({ length: 50 }, (_, index) => `C${index + 641}`);
const actualIds = registries.map(record => record.id);
if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
  throw new Error(`概念ID必须恰好为C641-C690：${actualIds.join(', ')}`);
}

const seenKeys = new Map();
const entries = [];
for (const record of registries) {
  const numericId = Number(String(record.id).slice(1));
  if (!Number.isInteger(numericId)) throw new Error(`${record.id} 不是有效概念ID`);
  if (!record.title || !record.category) throw new Error(`${record.id} 缺标题或类别`);
  if (!Array.isArray(record.keys) || record.keys.length < 2 || record.keys.length > 5) {
    throw new Error(`${record.id} keys必须为2-5项`);
  }
  if (!Array.isArray(record.event_ids) || record.event_ids.length === 0
    || record.event_ids.some(id => !/^E(?:\d{2}|1\d{2})$/.test(id) || Number(id.slice(1)) > 170)) {
    throw new Error(`${record.id} event_ids无效`);
  }
  const inputName = basename(record.content_file);
  const inputPath = resolve(record.packetRoot, inputName);
  const content = (await readFile(inputPath, 'utf8')).replace(/\r\n/g, '\n').trim();
  const heading = content.match(/^# 概念·([^·]+)·(.+?)（事件(\[[^\n]+\])）$/m);
  if (!heading) throw new Error(`${record.id} 标题格式错误`);
  if (heading[1] !== record.category || heading[2] !== record.title) {
    throw new Error(`${record.id} 标题/类别与注册表不一致`);
  }
  const headingEvents = JSON.parse(heading[3]);
  if (JSON.stringify(headingEvents) !== JSON.stringify(record.event_ids)) {
    throw new Error(`${record.id} 标题事件数组与注册表不一致`);
  }
  for (const section of ['类别', '事实门槛', '定义', '来源', '机制', '限制与代价', '未知项', '禁止外推']) {
    if ((content.match(new RegExp(`^- ${section}：`, 'gm')) ?? []).length !== 1) {
      throw new Error(`${record.id} 必须且只能包含一个“${section}”字段`);
    }
  }
  if (/第\s*[0-9零一二三四五六七八九十百千万两]+\s*章|小总结|大总结|阶段[一二三四五六七八九十]/.test(content)) {
    throw new Error(`${record.id} 含运行正文禁用元数据`);
  }
  if (/\bv0\.10\b|\bV0\.10\b|本版/.test(content)) {
    throw new Error(`${record.id} 含制作版本元数据`);
  }
  for (const key of record.keys) {
    if (typeof key !== 'string' || !key.trim()) throw new Error(`${record.id} 含空key`);
    const owner = seenKeys.get(key);
    if (owner) throw new Error(`v0.10概念key重复：${key} (${owner}/${record.id})`);
    seenKeys.set(key, record.id);
  }
  const outputName = inputName;
  await copyFile(inputPath, resolve(conceptRoot, outputName));
  entries.push({
    id: numericId,
    comment: `[概念·${record.category}]${record.title}`,
    keys: record.keys,
    secondary_keys: [],
    constant: false,
    enabled: false,
    insertion_order: numericId,
    content_file: `src/concepts/${outputName}`,
    extensions: {
      exclude_recursion: true,
      prevent_recursion: true,
      tavernweave: { event_ids: record.event_ids },
    },
  });
}

const worldbookPath = resolve(projectRoot, 'src', 'worldbook.json');
const worldbook = await readJson(worldbookPath);
worldbook.entries = worldbook.entries.filter(entry => entry.id < 641 || entry.id > 690);
worldbook.entries.push(...entries);
worldbook.entries.sort((a, b) => (a.insertion_order ?? a.id) - (b.insertion_order ?? b.id) || a.id - b.id);
await writeFile(worldbookPath, `${JSON.stringify(worldbook, null, 2)}\n`, 'utf8');

const contractPath = resolve(projectRoot, 'contract.json');
const contract = await readJson(contractPath);
const activation = contract.required.concept_activation;
activation.concept_id_end = 690;
activation.stage6_concept_id_start = 641;
activation.stage6_concept_id_end = 690;
activation.stage6_note = 'v0.10新增C641-C690共50条；概念正文无字数上限，事实门槛与未知项必须保留';
contract.required.worldbook_entry_count = worldbook.entries.length;
contract.required.opening_source_verbatim = false;
await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  status: 'imported-v0.10-concepts',
  concepts: entries.length,
  first: entries[0].comment,
  last: entries.at(-1).comment,
  worldbook_entries: worldbook.entries.length,
}, null, 2));
