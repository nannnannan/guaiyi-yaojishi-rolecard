import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readText = async path => (await readFile(resolve(root, path), 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const readJson = async path => JSON.parse(await readText(path));
const writeText = async (path, value) => writeFile(resolve(root, path), value.endsWith('\n') ? value : `${value}\n`, 'utf8');
const writeJson = async (path, value) => writeText(path, JSON.stringify(value, null, 2));

function mapStrings(value, transform) {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map(item => mapStrings(item, transform));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, mapStrings(child, transform)]));
  }
  return value;
}

const versionTransform = value => value
  .replaceAll('v0.10', 'v0.11')
  .replaceAll('0.10.0', '0.11.0');

const manifest = mapStrings(await readJson('manifest.json'), versionTransform);
manifest.id = 'tavernweave.weird-apothecary.v0.11';
manifest.version = '0.11.0';
manifest.packed_json = 'dist/诡异药剂师_v0.11.json';
manifest.card.display_name = '《诡异药剂师》v0.11';
manifest.worldbook.version = '0.11.0';
manifest.deliverables = ['dist/诡异药剂师_v0.11.json'];
await writeJson('manifest.json', manifest);

const profile = await readJson('profile.json');
profile.version = '0.11.0';
profile.display_name = '《诡异药剂师》v0.11';
await writeJson('profile.json', profile);

const packageJson = await readJson('package.json');
packageJson.version = '0.11.0';
await writeJson('package.json', packageJson);
const packageLock = await readJson('package-lock.json');
packageLock.version = '0.11.0';
if (packageLock.packages?.['']) packageLock.packages[''].version = '0.11.0';
await writeJson('package-lock.json', packageLock);

const card = await readJson('src/card.json');
card.name = '《诡异药剂师》v0.11';
card.character_version = '0.11.0';
card.creator_notes = 'v0.11 内部候选版。完整继承并冻结 v0.10 基线，在 E170 后新增 E171-E218 共48个事件锚点，剧情严格止于七使徒完成包围、其余六名使徒开始攻击的未决悬崖；咒瞳是否开启只由玩家决定，任何攻击结果、伤亡、突围与胜负均未知。新增66条详细概念并原位扩展24条既有概念，补齐人物、关系、世界观、势力、地点、机制、医疗、分支与未决项。林恩全链统一为18岁且对白、行动、判断、记忆、内心与关系选择均由玩家独占；未成年、幼态、年龄不明或失能主体固定非性。需要 SillyTavern 1.17.0 与酒馆助手 4.9.1；真实宿主验收待执行。v1.0以前不公开发布。';
await writeJson('src/card.json', card);

let helpers = mapStrings(await readJson('src/tavern_helper_scripts.json'), versionTransform);
const schemaHelper = helpers.find(script => String(script.id).includes('mvu-schema'));
if (schemaHelper) schemaHelper.info = '注册 v0.11 二十七人关系、二百一十八事件、E171-E218事件群与四页状态栏状态结构；不包含战斗、经济、库存或日历系统。';
await writeJson('src/tavern_helper_scripts.json', helpers);
const regexes = mapStrings(await readJson('src/regex_scripts.json'), versionTransform);
await writeJson('src/regex_scripts.json', regexes);

let loader = await readText('src/scripts/mvu_loader.js');
loader = versionTransform(loader);
await writeText('src/scripts/mvu_loader.js', loader);

let schema = await readText('src/scripts/schema.js');
schema = versionTransform(schema);
await writeText('src/scripts/schema.js', schema);

let system = await readText('src/prompts/system.md');
system = system.replace('你正在运行《诡异药剂师》v0.10。', '你正在运行《诡异药剂师》v0.11。');
system = system.replace(/本版世界资料覆盖E01至E170/, '本版世界资料覆盖E01至E218');
system = system.replace(/8\. E170是当前开放终点：[^\n]*/, '8. E218是当前开放终点：七使徒已经完成包围，其余六名使徒开始攻击；林恩是否开启咒瞳只由玩家决定，任何攻击结果、伤亡、突围与胜负均未知。不得创建E219、不得越过未决悬崖。');
await writeText('src/prompts/system.md', system);

let world = await readText('src/prompts/world.md');
world = world.replace('《诡异药剂师》v0.10', '《诡异药剂师》v0.11').replace('世界书覆盖E01至E170', '世界书覆盖E01至E218');
world = world.replace(/4\. E170是本版封口：[^\n]*/, '4. E218是本版封口：七使徒完成包围、其余六名使徒开始攻击；咒瞳开启必须等待玩家选择，攻击结果、伤亡、突围与胜负全部未知。');
await writeText('src/prompts/world.md', world);

let description = await readText('src/prompts/card_description.md');
description = description.replace('《诡异药剂师》v0.10', '《诡异药剂师》v0.11');
description = description.replace(/E01至E170共一百七十个重大事件锚点/, 'E01至E218共二百一十八个重大事件锚点');
description = description.replace(/E170是当前开放终点：[^\n]*/, 'E218是当前开放终点：七使徒完成包围、其余六名使徒开始攻击；是否开启咒瞳只由玩家决定，攻击结果、伤亡、突围与胜负全部未知。不得续写E219或未收录结果。');
description = description.replace('v0.10只保证新聊天', 'v0.11只保证新聊天');
await writeText('src/prompts/card_description.md', description);

let updateRules = await readText('src/prompts/mvu_update_rules.md');
updateRules = updateRules.replace('二十五阶段固定为S0至S24', '三十二阶段固定为S0至S31');
updateRules = updateRules.replace('一百七十个锚点状态', '二百一十八个锚点状态');
updateRules = updateRules.replace(/14\. E64保留为早期开放钩子[^\n]*/, '14. E64保留为早期开放钩子，恒未触发且不作当前件；E64→E65桥的前件判断挂E63。E65至E218均为正式六态锚点，E96已转为正式事件。E218是当前开放终点且没有推进按钮；不得创建E219或补写七使徒围攻后的结果。');
await writeText('src/prompts/mvu_update_rules.md', updateRules);

const hostAcceptance = {
  id: 'tavernweave.weird-apothecary.host-acceptance',
  version: '0.11.0',
  status: 'pending',
  accepted_at: null,
  accepted_by: null,
  tested_at: new Date().toISOString(),
  last_runtime_tested_at: null,
  last_runtime_sha256: null,
  tested_by: 'Codex offline validation pending',
  evidence: null,
  host: { sillytavern: null, tavern_helper: null },
  artifact: 'dist/诡异药剂师_v0.11.json',
  bytes: null,
  sha256: null,
  offline_checks: {
    command: 'npm run check',
    status: 'pending',
    checks: null,
    event_anchors: 218,
    worldbook_entries: 580,
  },
  notes: 'v0.11 内部候选：冻结 v0.10 基线，新增 E171-E218、66条概念并更新24条既有概念，林恩统一18岁；真实宿主导入验收仍需所有者另行授权。',
};
await writeJson('host_acceptance.json', hostAcceptance);

console.log(JSON.stringify({
  status: 'synced-v0.11-version',
  version: manifest.version,
  display_name: card.name,
  artifact: manifest.packed_json,
  host_acceptance: hostAcceptance.status,
}, null, 2));
