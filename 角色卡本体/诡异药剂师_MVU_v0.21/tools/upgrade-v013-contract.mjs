// tools/upgrade-v013-contract.mjs
// 集成：把 contract.json 从 v0.12（E01-E265/S0-S35/C691-C835/桥对264/封口E265）
// 升级到 v0.13（E01-E317/S0-S40/C691-C1007/桥对316/封口E317）。
import { resolve } from 'node:path';
import { root, backup, readJson, writeJson, readText, eventTitlesFromFiles, STAGE9_NAMES, STAGE9_EVENTS } from './v013-common.mjs';

const contractPath = resolve(root, 'contract.json');
backup(contractPath);
const contract = readJson(contractPath);
const CHANGES = [];

// 1. 版本
const versionBefore = contract.version;
contract.version = '0.13.0';
CHANGES.push(`version: ${versionBefore} -> 0.13.0`);

// 2. event_ids 扩展到 E317
const eventIds = contract.required.event_ids;
const beforeCount = eventIds.length;
for (let i = 266; i <= 317; i += 1) {
  const id = `E${String(i).padStart(2, '0')}`;
  if (!eventIds.includes(id)) eventIds.push(id);
}
CHANGES.push(`event_ids: ${beforeCount} -> ${eventIds.length}（E01-E${eventIds.at(-1)}）`);

// 3. event_titles 补 E266-E317（从事件文件读取精确标题）
const eventTitles = contract.required.event_titles;
const titles = eventTitlesFromFiles();
let addedTitles = 0;
for (const [id, title] of Object.entries(titles)) {
  if (!eventTitles[id]) { eventTitles[id] = title; addedTitles += 1; }
  else if (eventTitles[id] !== title) { eventTitles[id] = title; addedTitles += 1; } // 用精确标题覆盖占位
}
CHANGES.push(`event_titles: ${Object.keys(eventTitles).length} 个（新增/覆盖 ${addedTitles}）`);

// 4. stage_ranges 追加 S36-S40
const phases = contract.required.stage_ranges;
for (const [stage, evs] of Object.entries(STAGE9_EVENTS)) {
  if (!phases[stage]) { phases[stage] = evs; CHANGES.push(`stage_ranges.${stage} 追加（${evs[0]}-${evs.at(-1)}）`); }
}

// 5. concept_activation：追加阶段九段落（concept_id_end 语义=旧"概念编号上限"，v0.12 时=761；
//    阶段九用独立 stage9_* 字段表达 C836-C1007，避免污染 stage1-7 区间语义）
const ca = contract.required.concept_activation;
ca.stage9_concept_id_start = 836;
ca.stage9_concept_id_end = 1007;
ca.stage9_concept_uid_start = 2160;
ca.stage9_concept_uid_end = 2331;
ca.stage9_note = 'v0.13新增阶段九逻辑概念C836-C1007共172条，世界书UID2160-2331（C836→2160偏移+1324，与v0.12 C691-C835↔2000-2144偏移+1309两段并存）；事件素材UID965-1016保持新增52条不变';
CHANGES.push('concept_activation: stage9 段落已追加（concept_id_end 保持 761 语义不变）');

// 5b. worldbook_version 同步 0.13.0
contract.required.worldbook_version = '0.13.0';
CHANGES.push('required.worldbook_version: 0.12.0 -> 0.13.0');

// 6. worldbook 事件素材上限 964 -> 1016；条目数 722 -> 946
const wb = contract.required.event_context_windows;
const wbBefore = wb.material_entry_end;
wb.material_entry_end = 1016;
contract.required.worldbook_entry_count = 946;
CHANGES.push(`event_context_windows: material_entry_end ${wbBefore}->1016; worldbook_entry_count -> 946`);

// 7. terminal_hook_event：E265 -> E317
contract.required.terminal_hook_event = 'E317';
contract.acceptance.terminal_hook_event = 'E317';
contract.required.terminal_hook_note = 'E317为S40（机械神教终局与母树收服）终局封口：小树洞是否被踏入由玩家决定，卡面不预写任何走向，严禁创建E318';
CHANGES.push('terminal_hook_event: E265 -> E317');

// 8. acceptance 指标
const acc = contract.acceptance;
const accBeforeAnchors = acc.event_anchors;
acc.event_anchors = 317;
acc.bridge_pairs_count = 316;
acc.stage_scope = 'S0至S40；E01至E317';
CHANGES.push(`acceptance: event_anchors ${accBeforeAnchors}->317, bridge_pairs_count -> 316, stage_scope -> S0至S40; E01至E317`);

// 9. source_boundary 更新（原著止于 1350 章）
acc.source_boundary = '原著止于第1350章（E317封口）；第1183-1350章连续（P11-P15核实）；不得读取或泄漏第1351章及以后';
CHANGES.push('acceptance.source_boundary 更新（止于1350章）');

// 10. 顶层残留陈旧字段同步（v0.12 遗留的顶层 worldbook_entry_count/stage_scope 同步到 v0.13）
if (contract.worldbook_entry_count) { contract.worldbook_entry_count = 946; CHANGES.push('顶层 worldbook_entry_count -> 946'); }
if (contract.stage_scope && contract.stage_scope.includes('E01至E265')) {
  contract.stage_scope = 'E01至E317；本版新增E266至E317，S0至S40，止于E317小树洞终局封口。';
  CHANGES.push('顶层 stage_scope -> E01至E317');
}

writeJson(contractPath, contract);
console.log('=== 契约升级已写盘（备份 contract.json.bak-v012-baseline）===');
console.log(CHANGES.join('\n'));