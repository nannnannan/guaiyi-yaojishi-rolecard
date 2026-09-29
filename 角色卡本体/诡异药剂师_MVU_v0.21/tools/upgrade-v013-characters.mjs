// tools/upgrade-v013-characters.mjs
// 集成：为 5 位阶段九深度角色（弥赛亚/左左/巨像之脑/林樱/a01银色幻想）把阶段九事件 E266-E317
// 追加进 contract.required.character_event_ids 与 worldbook 人物条目 extensions.tavernweave.event_ids，
// 与多阶段人设的阶段九增量段（E26x+ 锚点）对齐。
// 阶段九角色在场覆盖：以下事件按各角色多阶段人设增量段实际锚点（读取多阶段人设.md 中的 E26x+ 引用）。
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { root, backup, readJson, writeJson, readText } from './v013-common.mjs';

const CHARS = ['弥赛亚', '左左', '巨像之脑', '林樱', 'a01银色幻想'];
const contractPath = resolve(root, 'contract.json');
backup(contractPath);
const contract = readJson(contractPath);
const cei = contract.required.character_event_ids;

const wbPath = resolve(root, 'src/worldbook.json');
backup(wbPath);
const wb = readJson(wbPath);

let changed = 0;
for (const name of CHARS) {
  // 从多阶段人设.md 提取阶段九锚点（E266-E317 引用，去重排序）
  const profilePath = resolve(root, `src/characters/${name}/多阶段人设.md`);
  const content = readText(profilePath);
  const stage9 = new Set();
  for (const m of content.matchAll(/E(\d{2,3})/g)) {
    const n = Number(m[1]);
    if (n >= 266 && n <= 317) stage9.add(`E${n}`);
  }
  const stage9Sorted = [...stage9].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  // contract
  if (!cei[name]) { console.log(`contract 缺 ${name} 条目（跳过）`); continue; }
  const merged = [...cei[name]];
  for (const id of stage9Sorted) if (!merged.includes(id)) merged.push(id);
  cei[name] = merged;
  // worldbook 人物条目
  const entry = wb.entries.find(e => e.comment === `[角色]${name}`);
  if (!entry) { console.log(`worldbook 缺 [角色]${name}（跳过）`); continue; }
  const eids = entry.extensions?.tavernweave?.event_ids ?? [];
  for (const id of stage9Sorted) if (!eids.includes(id)) eids.push(id);
  if (!entry.extensions) entry.extensions = {};
  if (!entry.extensions.tavernweave) entry.extensions.tavernweave = {};
  entry.extensions.tavernweave.event_ids = eids;
  console.log(`${name}: 阶段九锚点 ${stage9Sorted.length} 个（${stage9Sorted[0]}-${stage9Sorted.at(-1)}）→ contract ${cei[name].length} / worldbook ${eids.length}`);
  changed += 1;
}
if (changed > 0) {
  writeJson(contractPath, contract);
  writeJson(wbPath, wb);
  console.log(`=== 角色事件对齐完成：${changed} 位角色 ===`);
} else {
  console.log('=== 无需变更 ===');
}