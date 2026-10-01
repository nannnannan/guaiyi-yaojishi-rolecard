// 修复"变体块无门控EJS"的概念文件：
// 1) 按标题行事件数组从新到旧重排变体块
// 2) 生成 if/else if/else 门控链（只认完成/变形，末块兜底）
// 3) 每块插入门控行
// 4) 删除前缀中占位的"事件演进/当前状态"行
// 5) 缺块/多块的文件跳过并报告，由人工先补内容
import fs from 'node:fs';
import path from 'node:path';

const contract = JSON.parse(fs.readFileSync('contract.json', 'utf8'));
const eventOrder = new Map(contract.required.event_ids.map((id, i) => [id, i]));

const targets = [
  'src/concepts/机制/人偶充能与情感开发度.md',
  'src/concepts/机制/以M之拳与充能体系.md',
  'src/concepts/机制/喵化诅咒.md',
  'src/concepts/机制/机械信息同调.md',
  'src/concepts/机制/根源降临限制.md',
  'src/concepts/机制/死亡凋零.md',
  'src/concepts/机制/跨世界召唤四阶段与靶向规则.md',
];

for (const file of targets) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/);
  const titleLine = lines[0];
  const titleMatch = titleLine.match(/（事件(\[[^\]]*\])）$/);
  if (!titleMatch) { console.log(`[跳过] ${file} 标题行无事件数组`); continue; }
  const titleEvents = JSON.parse(titleMatch[1]);
  const parts = raw.split(/^## 变体·/gm);
  const prefix = parts.shift() ?? '';
  if (parts.length === 0) { console.log(`[跳过] ${file} 无变体块`); continue; }
  const blocks = parts.map(body => `## 变体·${body}`);
  const gates = blocks.map(block => {
    const heading = block.match(/^## 变体·([^\r\n]*)/)?.[1] ?? '';
    const gate = heading.match(/E\d{2}/)?.[0] ?? (heading.startsWith('兜底') ? '__baseline__' : '');
    return { block, heading, gate };
  });
  const nonBaselineGates = gates.filter(g => g.gate !== '__baseline__').map(g => g.gate);
  const missing = titleEvents.filter(id => !nonBaselineGates.includes(id));
  const extra = nonBaselineGates.filter(id => !titleEvents.includes(id));
  const baseline = gates.filter(g => g.gate === '__baseline__');
  if (missing.length || extra.length || baseline.length !== 1) {
    console.log(`[跳过] ${file} 缺块:${missing.join(',') || '无'} 多块:${extra.join(',') || '无'} 兜底:${baseline.length}`);
    continue;
  }
  const ordered = [...gates].sort((a, b) => {
    if (a.gate === '__baseline__') return 1;
    if (b.gate === '__baseline__') return -1;
    return eventOrder.get(b.gate) - eventOrder.get(a.gate);
  });
  const orderedGates = ordered.filter(g => g.gate !== '__baseline__').map(g => g.gate);
  const cleanedPrefix = prefix
    .split(/\r?\n/)
    .filter(line => !/^-\s*(事件演进|当前状态)：/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  const out = [cleanedPrefix];
  ordered.forEach((g, index) => {
    let body = g.block;
    const heading = body.split(/\r?\n/)[0];
    const rest = body.slice(heading.length).replace(/^\r?\n/, '');
    const gateLine = g.gate === '__baseline__'
      ? `- 门控：兜底（${titleEvents.join('、')}均未触发、预兆、活跃或取消）`
      : `- 门控：${g.gate}完成或变形`;
    const cleaned = rest
      .split(/\r?\n/)
      .filter(line => !/^-\s*门控：/.test(line))
      .join('\n')
      .trim();
    if (g.gate === '__baseline__') {
      out.push(`<%_ } else { _%>\n## 变体·兜底\n${gateLine}\n${cleaned}`);
    } else if (index === 0) {
      out.push(`<%_ if (["完成","变形"].includes(getvar("stat_data.事件.锚点状态.${g.gate}.状态", { defaults: "未触发" }))) { _%>\n## 变体·${g.heading}\n${gateLine}\n${cleaned}`);
    } else {
      out.push(`<%_ } else if (["完成","变形"].includes(getvar("stat_data.事件.锚点状态.${g.gate}.状态", { defaults: "未触发" }))) { _%>\n## 变体·${g.heading}\n${gateLine}\n${cleaned}`);
    }
  });
  out.push('<%_ } _%>');
  fs.writeFileSync(file, out.join('\n\n') + '\n', 'utf8');
  console.log(`[已修复] ${file} 门控顺序 ${orderedGates.join('→')} → 兜底`);
}
