import fs from 'node:fs';
const files = ['主母的红茶包', '逗猫棒', '秽体史莱姆拟化形态药剂', '自缚天使的怜悯（盗版）', '猫娘药剂'];
const reIf = /<% if \(getvar\("stat_data\.事件\.锚点状态\.(E\d\d)\.状态", \{ defaults: "未触发" \}\) === "完成" \|\| getvar\("stat_data\.事件\.锚点状态\.E\d\d\.状态", \{ defaults: "未触发" \}\) === "变形"\) \{ %>/g;
const reElseIf = /<% \} else if \(getvar\("stat_data\.事件\.锚点状态\.(E\d\d)\.状态", \{ defaults: "未触发" \}\) === "完成" \|\| getvar\("stat_data\.事件\.锚点状态\.E\d\d\.状态", \{ defaults: "未触发" \}\) === "变形"\) \{ %>/g;
const reElse = /<% \} else \{ %>/g;
const reClose = /<% \} %>/g;
for (const f of files) {
  const p = `src/concepts/物品/${f}.md`;
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  t = t.replace(reIf, '<%_ if (["完成","变形"].includes(getvar("stat_data.事件.锚点状态.$1.状态", { defaults: "未触发" }))) { _%>');
  t = t.replace(reElseIf, '<%_ } else if (["完成","变形"].includes(getvar("stat_data.事件.锚点状态.$1.状态", { defaults: "未触发" }))) { _%>');
  t = t.replace(reElse, '<%_ } else { _%>');
  t = t.replace(reClose, '<%_ } _%>');
  if (t !== before) {
    fs.writeFileSync(p, t, 'utf8');
    console.log(`[已统一门控] ${f}`);
  } else {
    console.log(`[无变化] ${f}`);
  }
}
