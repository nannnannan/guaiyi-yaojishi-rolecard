// 把物品/特殊设定 agent 的"无横线字段"风格转换为标准十字段格式：
// 1) 行首字段名加 "- " 前缀
// 2) 变体块标题后插入门控行（事件从块标题或标题行事件数组推导）
// 3) 删除前缀中的"事件演进/当前状态"占位字段块
// 4) 静态文件缺 7 字段的只报告不生成内容
import fs from 'node:fs';

const FIELD_NAMES = ['类别', '事实门槛', '定义', '来源', '机制', '限制与代价', '未知项', '禁止外推', '事件演进', '当前状态', '人物关联'];
const fieldLineRe = new RegExp(`^(${FIELD_NAMES.join('|')})：`);
const stripRe = /^(事件演进|当前状态)：/;

const targets = [
  'src/concepts/物品/逗猫棒.md',
  'src/concepts/物品/夺萃之镰.md',
  'src/concepts/物品/反扫描殖装虫.md',
  'src/concepts/物品/秽体史莱姆拟化形态药剂.md',
  'src/concepts/物品/恐怖书籍.md',
  'src/concepts/物品/猫娘药剂.md',
  'src/concepts/物品/赛博机械蓝图.md',
  'src/concepts/物品/替死娃娃.md',
  'src/concepts/物品/镇魂铃.md',
  'src/concepts/物品/重装生化手雷xp1.md',
  'src/concepts/物品/主母的红茶包.md',
  'src/concepts/物品/自缚天使的怜悯（盗版）.md',
  'src/concepts/特殊设定/术语速查（E36-E64）.md',
];

function stripPlaceholderBlock(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (stripRe.test(line)) {
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (/^(?:- |  |\t)/.test(next) && next.trim() !== '') { i += 1; continue; }
        if (next.trim() === '') { i += 1; continue; }
        break;
      }
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out;
}

function prefixLines(prefix, titleEvents) {
  const lines = prefix.split('\n');
  const stripped = stripPlaceholderBlock(lines);
  return stripped.map(line => (fieldLineRe.test(line) ? `- ${line}` : line));
}

function variantLines(body, titleEvents, gateSource) {
  const lines = body.split('\n');
  const heading = lines[0];
  const headMatch = heading.match(/^## 变体·(E\d{2})/);
  const isBaseline = /^## 变体·兜底/.test(heading);
  const out = [];
  out.push(heading);
  const gateEvent = headMatch ? headMatch[1] : (gateSource ?? '');
  if (isBaseline) {
    out.push(`- 门控：兜底（${(titleEvents ?? []).join('、')}均未触发、预兆、活跃或取消）`);
  } else if (gateEvent) {
    out.push(`- 门控：${gateEvent}完成或变形`);
  } else {
    out.push('- 门控：兜底（事件状态未明）');
  }
  for (const line of lines.slice(1)) {
    out.push(fieldLineRe.test(line) ? `- ${line}` : line);
  }
  return out.join('\n');
}

for (const file of targets) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');
  const titleMatch = lines[0].match(/（事件(\[[^\]]*\])）$/);
  const titleEvents = titleMatch ? JSON.parse(titleMatch[1]) : [];
  const variantIndex = lines.findIndex(line => line.startsWith('## 变体·'));
  if (variantIndex === -1) {
    // 静态：只加横线；检查 7 字段
    const converted = lines.map(line => (fieldLineRe.test(line) ? `- ${line}` : line)).join('\n');
    const missing = ['事实门槛', '定义', '来源', '机制', '限制与代价', '未知项', '禁止外推']
      .filter(s => (converted.match(new RegExp(`^- ${s}：`, 'gm')) ?? []).length !== 1);
    if (missing.length) {
      console.log(`[跳过静态] ${file} 缺字段：${missing.join('、')}（需人工补内容）`);
      continue;
    }
    fs.writeFileSync(file, converted.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf8');
    console.log(`[已转换静态] ${file}`);
    continue;
  }
  const prefix = lines.slice(0, variantIndex).join('\n');
  let rest = lines.slice(variantIndex).join('\n');
  const blocks = rest.split(/^## 变体·/gm).slice(1);
  const newPrefix = prefixLines(prefix, titleEvents).join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  const convertedBlocks = blocks.map(b => variantLines(`## 变体·${b}`, titleEvents));
  fs.writeFileSync(file, `${newPrefix}\n\n${convertedBlocks.join('\n\n')}\n`, 'utf8');
  console.log(`[已转换变体] ${file}（${convertedBlocks.length}块）`);
}
