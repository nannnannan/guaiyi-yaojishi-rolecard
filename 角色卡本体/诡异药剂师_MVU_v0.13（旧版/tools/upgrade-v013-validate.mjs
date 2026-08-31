// tools/upgrade-v013-validate.mjs
// 升级 validate.mjs 断言基准：v0.12（E01-E265/S0-S35/C762-C835/264桥对/E265封口/707条目/74概念）
//  → v0.13（E01-E317/S0-S40/C836-C1007/316桥对/E317封口/946条目/172概念）
// 逐条精确替换（带备份）；策略：动态常量尽量从 contract 派生，硬编码断言更新为 v0.13 数值。
import { resolve } from 'node:path';
import { root, backup, readText, writeText } from './v013-common.mjs';

const vPath = resolve(root, 'tools/validate.mjs');
backup(vPath);
let v = readText(vPath);

let n = 0;
const rep = (from, to, label) => {
  const c = v.split(from).length - 1;
  if (c === 0) { console.log(`  ! 未命中: ${label}`); return; }
  v = v.split(from).join(to);
  n += c;
  console.log(`  ✓ (x${c}) ${label}`);
};

// === 1. 事件数/范围/封口 ===
rep("ok(EVENT_IDS.length === 265, '二百六十五事件锚点');", "ok(EVENT_IDS.length === 317, '三百一十七事件锚点');", '事件数 265→317');
rep("ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E265', '事件锚点范围为E01-E265');", "ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E317', '事件锚点范围为E01-E317');", '事件范围 E01-E265→E01-E317');
rep("ok(contract.required.terminal_hook_event === 'E265' || contract.required.terminal_hook_event?.id === 'E265', 'E265为本版开放终点');", "ok(contract.required.terminal_hook_event === 'E317' || contract.required.terminal_hook_event?.id === 'E317', 'E317为本版开放终点');", 'terminal_hook E265→E317');
rep("ok(conceptRouterContent.includes('E265'), '路由事件序列含E265');", "ok(conceptRouterContent.includes('E317'), '路由事件序列含E317');", '路由含E265→E317');
rep("if (eventId === 'E265') ok(!content.includes('## 下一事件引入'), 'E265冻结终点不设下一事件引入');", "if (eventId === 'E317') ok(!content.includes('## 下一事件引入'), 'E317冻结终点不设下一事件引入');", 'E265→E317冻结终点');

// === 1b. 产物文件名/显示名 ===
rep("ok(manifest.packed_json === 'dist/诡异药剂师_v0.12.json', '产物文件名正确');", "ok(manifest.packed_json === 'dist/诡异药剂师_v0.13.json', '产物文件名正确');", '产物文件名 v0.12→v0.13');
rep("ok(DISPLAY_NAME === '《诡异药剂师》v0.12', '显示名正确');", "ok(DISPLAY_NAME === '《诡异药剂师》v0.13', '显示名正确');", '显示名 v0.12→v0.13');
rep("ok(helperSource.every(script => String(script.name ?? '').includes('v0.12')), '酒馆助手脚本命名含v0.12');", "ok(helperSource.every(script => String(script.name ?? '').includes('v0.13')), '酒馆助手脚本命名含v0.13');", '酒馆助手脚本命名 v0.12→v0.13');

// === 2. 概念（v0.12 74条段保持；新增 v0.13 172条段）===
rep("ok(stage7ConceptEntries.length === 74, `v0.12概念UID", "ok(stage7ConceptEntries.length === 74, `v0.12概念UID", 'v0.12概念74条保持（消息不变）');
// 在 v0.12 概念断言后追加 v0.13 断言（通过替换其尾行追加）
rep("ok(stage7ConceptEntries.every((entry, index) => entry.id === 2071 + index\n  && entry.extensions?.tavernweave?.logical_id === `C${762 + index}`), 'v0.12概念逻辑ID C762-C835与UID2071-2144逐项对应');",
  "ok(stage7ConceptEntries.every((entry, index) => entry.id === 2071 + index\n  && entry.extensions?.tavernweave?.logical_id === `C${762 + index}`), 'v0.12概念逻辑ID C762-C835与UID2071-2144逐项对应');\n" +
  "const STAGE9_CONCEPT_UID_START = contract.required.concept_activation.stage9_concept_uid_start;\n" +
  "const STAGE9_CONCEPT_UID_END = contract.required.concept_activation.stage9_concept_uid_end;\n" +
  "const stage9ConceptEntries = sourceBook.entries.filter(entry => entry.id >= STAGE9_CONCEPT_UID_START && entry.id <= STAGE9_CONCEPT_UID_END);\n" +
  "ok(stage9ConceptEntries.length === 172, `v0.13概念UID${STAGE9_CONCEPT_UID_START}-${STAGE9_CONCEPT_UID_END}共172条（实际${stage9ConceptEntries.length}）`);\n" +
  "ok(stage9ConceptEntries.every((entry, index) => entry.id === 2160 + index\n  && entry.extensions?.tavernweave?.logical_id === `C${836 + index}`), 'v0.13概念逻辑ID C836-C1007与UID2160-2331逐项对应');",
  'v0.12概念断言后追加 v0.13 概念断言');

// === 3. 桥对 ===
rep("ok(bridgePairs.length === 264, '全卡桥共264对');", "ok(bridgePairs.length === 316, '全卡桥共316对');", '桥对总数 264→316');
rep("ok(statusUiText.includes(\"from: 'E264', to: 'E265'\"), '状态栏桥对覆盖E264→E265');", "ok(statusUiText.includes(\"from: 'E316', to: 'E317'\"), '状态栏桥对覆盖E316→E317');", '桥对覆盖 E264→E265→E316→E317');
rep("ok(statusBridgeCount === 264, `状态栏桥对共264对（实际${statusBridgeCount}）`);", "ok(statusBridgeCount === 316, `状态栏桥对共316对（实际${statusBridgeCount}）`);", '状态栏桥对计数 264→316');
rep("ok(!statusUiText.includes(\"from: 'E265'\"), 'E265无推进按钮');", "ok(!statusUiText.includes(\"from: 'E317'\"), 'E317无推进按钮');", 'E265→E317无推进按钮');

// === 4. 开放终态 ===
rep("ok(EVENT_IDS.includes('E265'), '开放终态事件E265已纳入事件序列');", "ok(EVENT_IDS.includes('E317'), '开放终态事件E317已纳入事件序列');", '开放终态 E265→E317');

// === 5. 封口内容断言（E265 → E317）===
rep("const e265Content = await readText('src/events/E265_公海前奏克苏鲁注视.md');", "const e317Content = await readText('src/events/E317_小树洞阶段九收束.md');", '封口事件文件 E265→E317');
rep("e265Content.includes('炽天使的魂灯')", "e317Content.includes('小树洞')", '封口内容断言#1');
rep("e265Content.includes('克苏鲁的注视')", "e317Content.includes('母树')", '封口内容断言#2');
rep("e265Content.includes('终局封口')", "e317Content.includes('终局封口')", '封口内容断言#3');
rep("e265Content.includes('严禁引出后续事件'),", "e317Content.includes('严禁引出后续事件'),", '封口内容断言#4');
rep("'E265严格停在梵蒂冈深层探索前、魂灯点亮且未越入旧日核心',", "'E317严格停在玩家面对小树洞、尚未踏入且未越入母树契约执行',", '封口断言消息');
rep("ok(!e265Content.includes('E266') && !e265Content.includes('下一事件引入'), 'E265未越界创建E266或后继引入');", "ok(!e317Content.includes('E318') && !e317Content.includes('下一事件引入'), 'E317未越界创建E318或后继引入');", 'E265→E317未越界断言');

// === 6. BIG_ANCHORS 追加阶段九大事件 ===
rep("const BIG_ANCHORS = new Set(['E47', 'E60', 'E61', 'E63', 'E77', 'E80', 'E94', 'E224', 'E226', 'E228', 'E236', 'E239', 'E242', 'E245', 'E253', 'E254', 'E257', 'E260', 'E261', 'E265']);",
  "const BIG_ANCHORS = new Set(['E47', 'E60', 'E61', 'E63', 'E77', 'E80', 'E94', 'E224', 'E226', 'E228', 'E236', 'E239', 'E242', 'E245', 'E253', 'E254', 'E257', 'E260', 'E261', 'E265', 'E268', 'E272', 'E274', 'E283', 'E287', 'E297', 'E307', 'E314', 'E315', 'E317']);",
  'BIG_ANCHORS 追加阶段九大事件');

// === 7. 人物事件关联断言消息更新（"E01-E218" → "E01-E317"）===
rep("ok(Object.values(characterEventIds).every(eventIds => Array.isArray(eventIds)\n  && eventIds.length > 0\n  && eventIds.every(eventId => EVENT_IDS.includes(eventId))), '人物事件关联仅使用E01-E218且均非空');",
  "ok(Object.values(characterEventIds).every(eventIds => Array.isArray(eventIds)\n  && eventIds.length > 0\n  && eventIds.every(eventId => EVENT_IDS.includes(eventId))), '人物事件关联仅使用E01-E317且均非空');",
  '人物事件关联断言消息 E01-E218→E01-E317');
rep("ok(eventIds.every(eventId => EVENT_IDS.includes(eventId)), `${character}事件元数据只使用E01-E218`);", "ok(eventIds.every(eventId => EVENT_IDS.includes(eventId)), `${character}事件元数据只使用E01-E317`);", '人物事件元数据断言消息 E01-E218→E01-E317');

// === 8. 概念事件数组断言消息（E01-E218 → E01-E317）===
rep("ok(Array.isArray(eventIds) && eventIds.length > 0 && eventIds.every(id => EVENT_IDS.includes(id)), `${conceptEntry.comment}事件关联非空且只使用E01-E218`);", "ok(Array.isArray(eventIds) && eventIds.length > 0 && eventIds.every(id => EVENT_IDS.includes(id)), `${conceptEntry.comment}事件关联非空且只使用E01-E317`);", '概念事件数组断言消息 E01-E218→E01-E317');

// === 9. 全部概念条目集合追加 stage9 ===
rep("const allConceptEntries = [...stage1ConceptEntries, ...stage3ConceptEntries, ...stage4ConceptEntries, ...stage6ConceptEntries, ...stage7ConceptEntries];",
  "const allConceptEntries = [...stage1ConceptEntries, ...stage3ConceptEntries, ...stage4ConceptEntries, ...stage6ConceptEntries, ...stage7ConceptEntries, ...stage9ConceptEntries];",
  'allConceptEntries 追加 stage9');

// === 10. 概念 keys 冲突检查追加 stage9 ===
rep("const stage7KeyCollisions = [...new Set(stage7ConceptKeys.filter(key => preV011ConceptKeys.has(key)))];\nif (stage7KeyCollisions.length > 0) remainingFailures.push(`v0.11概念keys冲突（新增vs既有）：${stage7KeyCollisions.join('、')}`);\nok(new Set(stage7ConceptKeys).size === stage7ConceptKeys.length, 'v0.11新增概念keys包内唯一');",
  "const stage7KeyCollisions = [...new Set(stage7ConceptKeys.filter(key => preV011ConceptKeys.has(key)))];\nif (stage7KeyCollisions.length > 0) remainingFailures.push(`v0.11概念keys冲突（新增vs既有）：${stage7KeyCollisions.join('、')}`);\nok(new Set(stage7ConceptKeys).size === stage7ConceptKeys.length, 'v0.11新增概念keys包内唯一');\n" +
  "const preV012ConceptKeys = new Set([...preV011ConceptKeys, ...stage7ConceptKeys]);\n" +
  "const stage9ConceptKeys = stage9ConceptEntries.flatMap(entry => entry.keys);\n" +
  "const stage9KeyCollisions = [...new Set(stage9ConceptKeys.filter(key => preV012ConceptKeys.has(key)))];\n" +
  "if (stage9KeyCollisions.length > 0) remainingFailures.push(`v0.13概念keys冲突（新增vs既有）：${stage9KeyCollisions.join('、')}`);\n" +
  "ok(new Set(stage9ConceptKeys).size === stage9ConceptKeys.length, 'v0.13新增概念keys包内唯一');",
  '概念 keys 冲突检查追加 stage9');

// === 11. 静态正文下限（v0.13 概念用 350 字符下限，与静态一致）===
// 无独立断言；在 stage7 的 900 非空白字符断言后追加 stage9 同款
rep("if (conceptEntry.id >= STAGE7_CONCEPT_UID_START && conceptEntry.id <= STAGE7_CONCEPT_UID_END) {\n      ok(conceptContent.replace(/\\s/g, '').length >= 900, `${conceptEntry.comment}v0.11详细正文至少900非空白字符`);\n    }",
  "if (conceptEntry.id >= STAGE7_CONCEPT_UID_START && conceptEntry.id <= STAGE7_CONCEPT_UID_END) {\n      ok(conceptContent.replace(/\\s/g, '').length >= 900, `${conceptEntry.comment}v0.11详细正文至少900非空白字符`);\n    }\n    if (conceptEntry.id >= STAGE9_CONCEPT_UID_START && conceptEntry.id <= STAGE9_CONCEPT_UID_END) {\n      ok(conceptContent.replace(/\\s/g, '').length >= 350, `${conceptEntry.comment}v0.13概念正文至少350非空白字符`);\n    }",
  'v0.13 概念静态正文下限追加');

writeText(vPath, v);
console.log(`\n=== validate.mjs 升级完成：${n} 处替换 ===`);