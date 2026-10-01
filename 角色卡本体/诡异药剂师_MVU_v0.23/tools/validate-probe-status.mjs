// tools/validate-probe-status.mjs
// 探针验收：验证「契约/版本/元数据层已全量同步到 0.12」，内容层（E219-E265 事件、C762-C835 概念、
// 新角色、712 条目）待填充。这是探针的通过报告，不是正式 validate.mjs。
// 正式 validate.mjs 将在内容填充后由「内容填充轮」按契约派生常量升级。
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

let pass = 0; let fail = 0;
const ok = (cond, msg) => { if (cond) { pass += 1; console.log(`  ✓ ${msg}`); } else { fail += 1; console.log(`  ✗ ${msg}`); } };

const manifest = J('manifest.json');
const profile = J('profile.json');
const contract = J('contract.json');
const card = J('src/card.json');
const worldbook = J('src/worldbook.json');
const hostAcceptance = J('host_acceptance.json');
const schema = readFileSync(resolve(root, 'src/scripts/schema.js'), 'utf8');

console.log('=== v0.12 工程探针验收报告（契约/版本/元数据层）===\n');

// 版本层
ok(manifest.version === '0.12.0', 'manifest 版本 0.12.0');
ok(profile.version === '0.12.0', 'profile 版本 0.12.0');
ok(contract.version === '0.12.0', 'contract 版本 0.12.0');
ok(card.character_version === '0.12.0', 'card 版本 0.12.0');
ok(worldbook.extensions.tavernweave.version === '0.12.0', 'worldbook 版本 0.12.0');
ok(hostAcceptance.version === '0.12.0', 'host_acceptance 版本 0.12.0');

// 产物层
ok(manifest.packed_json === 'dist/诡异药剂师_v0.12.json', `manifest 产物 ${manifest.packed_json}`);
ok(manifest.deliverables[0] === 'dist/诡异药剂师_v0.12.json', 'manifest deliverables 指向 v0.12');
ok(manifest.card.display_name === '《诡异药剂师》v0.12', 'manifest 显示名 v0.12');
ok(profile.display_name === '《诡异药剂师》v0.12', 'profile 显示名 v0.12');

// 契约扩容层
ok(contract.required.event_ids.length === 265, `事件锚点契约 265（实际${contract.required.event_ids.length}）`);
ok(contract.required.event_ids[0] === 'E01' && contract.required.event_ids[264] === 'E265', '事件范围 E01-E265');
ok(contract.required.event_titles.E219 && contract.required.event_titles.E265, '事件标题含 E219/E265 占位');
ok(contract.required.stage_ranges.S32 && contract.required.stage_ranges.S35, '阶段 S32-S35 已注册');
ok(contract.required.concept_activation.new_concept_id_start === 762
   && contract.required.concept_activation.new_concept_id_end === 835, '概念 C762-C835 已注册');
ok(contract.required.worldbook_entry_count === 712, `世界书条目契约 712`);
ok(contract.required.event_context_windows.material_entry_end === 964, '事件素材 UID 至 964');
ok(contract.required.terminal_hook_event === 'E265', '终局封口 E265（E218 已解除）');
ok(contract.acceptance.event_anchors === 265, '验收 event_anchors 265');
ok(contract.acceptance.bridge_pairs_count === 264, '验收桥对 264');
ok(contract.acceptance.stage_scope.includes('S0至S35'), '验收阶段 S0-S35');

// schema 层
ok(schema.includes("S32: '蜀都核爆与脱裤救世'"), 'schema phaseNames 含 S32');
ok(schema.includes("S33: '跨界逆召与三位一体'"), 'schema phaseNames 含 S33');
ok(schema.includes("S34: '使徒决战与神圣破防'"), 'schema phaseNames 含 S34');
ok(schema.includes("S35: '圣殿覆灭与蓝星家庭'"), 'schema phaseNames 含 S35');

// 内容层（诚实标注待填充）
console.log('\n=== 内容层（待填充，探针不校验）===');
const evtDir = resolve(root, 'src/events');
const evtCount = readdirSync(evtDir).filter(f => /^E\d{2,3}_/.test(f)).length;
console.log(`  - 事件文件：${evtCount} 个（契约期望 265，差 ${265 - evtCount} 待填）`);
console.log(`  - worldbook 条目：${worldbook.entries.length}（契约期望 712，差 ${712 - worldbook.entries.length} 待填）`);
console.log(`  - 概念条目：${worldbook.entries.filter(e => e.id >= 2000 && e.id <= 2070).length}（v0.11 71 条）`);

console.log(`\n=== 探针结论：契约/版本/元数据层 ${fail === 0 ? '全部通过 (✓' + pass + ')' : '存在失败 (✗' + fail + ')'} ===`);
process.exitCode = fail === 0 ? 0 : 1;
