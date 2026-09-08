// tools/fix-v012-variant-baseline.mjs
// 修复：变体概念必须在最后追加「兜底」块（v0.11 格式要求）。
// 处理：将 "<%_ } else { _%>\n## 变体·E前事件" 改为 "<%_ } else if (...E后事件未完成) { _%>\n## 变体·E前事件"
//       并在最终 "<%_ } _%>" 前追加 "<%_ } else { _%>\n## 变体·兜底\n- 门控：兜底（...）...\n<%_ } _%>"
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['C774_九重梦魇', 'C784_血肉权柄剥夺', 'C806_血衣身世与诅咒即魂', 'C820_蓝星旧宅与林家日常羁绊'];

for (const name of targets) {
  const file = `${root}/src/concepts/${name}.md`;
  let c = readFileSync(file, 'utf8');
  if (c.includes('## 变体·兜底')) { console.log(`${name}: 已有兜底，跳过`); continue; }

  // 1) else → else if（配合事件名）
  // 模式: "<%_ } else { _%>" 后跟 "## 变体·EXXX已完成"
  // 把第一个 else 改成 else if（条件是前事件的 状态 不是完成/变形——即落入 else 表示 E后事件 未完成，交由前事件）
  // 语义：if E后 → else if E前 → else 兜底。原代码 else 分支就是 E前事件，改为 else if 需条件 = E前事件完成/变形。
  const elseBlock = c.match(/<%_ \} else \{ _%>\n## 变体·(E\d+)已完成/);
  if (!elseBlock) { console.log(`${name}: 未找到 else 变体块，跳过`); continue; }
  const prevEvent = elseBlock[1];
  // 构造条件
  const cond = `["完成","变形"].includes(getvar("stat_data.事件.锚点状态.${prevEvent}.状态", { defaults: "未触发" }))`;
  c = c.replace(/<%_ \} else \{ _%>\n## 变体·E\d+已完成/, `<%_ } else if (${cond}) { _%>\n## 变体·E${prevEvent.slice(1)}已完成`);

  // 2) 在文件末尾 "<%_ } _%>" 前追加兜底
  const base = c.replace(/\n<%_ \} _%>\s*$/, '');
  c = `${base}\n\n<%_ } else { _%>\n## 变体·兜底\n- 门控：兜底（相关事件均未触发、预兆、活跃或取消）\n- 事件演进：本概念对应机制尚未在正文形成"完成"或"变形"事实，相关机制未在正文兑现。\n- 当前状态：尚未形成当前事实，机制未激活。\n- 人物关联：无（待事件推进）。\n\n<%_ } _%>\n`;
  writeFileSync(file, c, 'utf8');
  console.log(`${name}: 已补兜底（else if ${prevEvent} + else 兜底）`);
}
console.log('=== 完成 ===');