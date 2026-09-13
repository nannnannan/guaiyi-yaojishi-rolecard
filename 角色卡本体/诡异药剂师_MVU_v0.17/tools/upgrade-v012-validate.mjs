// tools/upgrade-v012-validate.mjs
// 升级 validate.mjs 断言基准：v0.11（E01-E218/S0-S31/C691-C761/217桥对/E218封口）
//  → v0.12（E01-E265/S0-S35/C762-C835/264桥对/E265封口/707条目/145概念）
// 逐条精确替换（带备份）。
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vPath = resolve(root, 'tools/validate.mjs');
const backup = `${vPath}.bak-v011-baseline`;
if (!existsSync(backup)) copyFileSync(vPath, backup);
let v = readFileSync(vPath, 'utf8');

// 统计替换次数
let n = 0;
const rep = (from, to, label) => {
  const c = v.split(from).length - 1;
  if (c === 0) { console.log(`  ! 未命中: ${label}`); return; }
  v = v.split(from).join(to);
  n += c;
  console.log(`  ✓ (x${c}) ${label}`);
};

// === 事件范围与封口 ===
rep("ok(EVENT_IDS.length === 218, '二百一十八事件锚点');", "ok(EVENT_IDS.length === 265, '二百六十五事件锚点');", '事件数 218→265');
rep("ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E218', '事件锚点范围为E01-E218');", "ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E265', '事件锚点范围为E01-E265');", '事件范围 E01-E218→E01-E265');
rep("ok(contract.required.terminal_hook_event === 'E218' || contract.required.terminal_hook_event?.id === 'E218', 'E218为本版开放终点');", "ok(contract.required.terminal_hook_event === 'E265' || contract.required.terminal_hook_event?.id === 'E265', 'E265为本版开放终点');", 'terminal_hook E218→E265');
rep("ok(conceptRouterContent.includes('E218'), '路由事件序列含E218');", "ok(conceptRouterContent.includes('E265'), '路由事件序列含E265');", '路由含E218→E265');
rep("if (eventId === 'E218') ok(!content.includes('## 下一事件引入'), 'E218冻结终点不设下一事件引入');", "if (eventId === 'E265') ok(!content.includes('## 下一事件引入'), 'E265冻结终点不设下一事件引入');", 'E218→E265冻结终点');

// === 概念 UID ===
rep("ok(stage7ConceptEntries.length === 71, `v0.11概念UID", "ok(stage7ConceptEntries.length === 74, `v0.12概念UID", '概念数 71→74');
rep("ok(stage7ConceptEntries.every((entry, index) => entry.id === 2000 + index\n  && entry.extensions?.tavernweave?.logical_id === `C${691 + index}`), 'v0.11概念逻辑ID C691-C761与UID2000-2070逐项对应');", "ok(stage7ConceptEntries.every((entry, index) => entry.id === 2071 + index\n  && entry.extensions?.tavernweave?.logical_id === `C${762 + index}`), 'v0.12概念逻辑ID C762-C835与UID2071-2144逐项对应');", '概念 UID 2000-2070→2071-2144 / C691-C761→C762-C835');

// === 桥对 ===
rep("ok(bridgePairs.length === 217, '全卡桥共217对');", "ok(bridgePairs.length === 264, '全卡桥共264对');", '桥对总数 217→264');
rep("ok(statusUiText.includes(\"from: 'E217', to: 'E218'\"), '状态栏桥对覆盖E217→E218');", "ok(statusUiText.includes(\"from: 'E264', to: 'E265'\"), '状态栏桥对覆盖E264→E265');", '桥对覆盖 E217→E218→E264→E265');
rep("ok(statusBridgeCount === 217, `状态栏桥对共217对（实际${statusBridgeCount}）`);", "ok(statusBridgeCount === 264, `状态栏桥对共264对（实际${statusBridgeCount}）`);", '状态栏桥对计数 217→264');
rep("ok(!statusUiText.includes(\"from: 'E218'\"), 'E218无推进按钮');", "ok(!statusUiText.includes(\"from: 'E265'\"), 'E265无推进按钮');", 'E218→E265无推进按钮');

// === 开放终态 ===
rep("ok(EVENT_IDS.includes('E218'), '开放终态事件E218已纳入事件序列');", "ok(EVENT_IDS.includes('E265'), '开放终态事件E265已纳入事件序列');", '开放终态 E218→E265');

// === 封口内容断言（E218→E265）===
rep("const e218Content = await readText('src/events/E218_地狱来客自白与七使徒围攻.md');", "const e265Content = await readText('src/events/E265_公海前奏克苏鲁注视.md');", '封口事件文件 E218→E265');
rep("e218Content.includes('七使徒已经完成包围')", "e265Content.includes('炽天使的魂灯')", '封口内容断言#1');
rep("e218Content.includes('六名使徒发动进攻')", "e265Content.includes('克苏鲁的注视')", '封口内容断言#2');
rep("e218Content.includes('玩家明确选择后开启咒瞳')", "e265Content.includes('终局封口')", '封口内容断言#3');
rep("e218Content.includes('任何攻击结果、伤亡、突围与胜负均尚未发生'),", "e265Content.includes('严禁引出E266'),", '封口内容断言#4');
rep("'E218严格停在七使徒包围、六人进攻、咒瞳玩家选择且战果未知',", "'E265严格停在梵蒂冈深层探索前、魂灯点亮且未越入旧日核心',", '封口断言消息');
rep("ok(!e218Content.includes('E219') && !e218Content.includes('下一事件引入'), 'E218未越界创建E219或后继引入');", "ok(!e265Content.includes('E266') && !e265Content.includes('下一事件引入'), 'E265未越界创建E266或后继引入');", 'E218→E265未越界断言');

// === 事件迭代的上限（默认走向字数上限 500→1500/BIG_ANCHORS 800→1500）===
// 保留 BIG_ANCHORS 集合不变（E47/E60/E61/E63/E77/E80/E94），追加 S34 大事件
rep("const BIG_ANCHORS = new Set(['E47', 'E60', 'E61', 'E63', 'E77', 'E80', 'E94']);", "const BIG_ANCHORS = new Set(['E47', 'E60', 'E61', 'E63', 'E77', 'E80', 'E94', 'E224', 'E228', 'E236', 'E239', 'E242', 'E245', 'E253', 'E254', 'E257', 'E260', 'E261', 'E265']);", 'BIG_ANCHORS 追加 S34/S35 大事件');

writeFileSync(vPath, v, 'utf8');
console.log(`\n=== validate.mjs 升级完成：${n} 处替换 ===`);