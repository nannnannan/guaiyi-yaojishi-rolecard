import fs from 'node:fs';
const wb = JSON.parse(fs.readFileSync('src/worldbook.json', 'utf8'));
const std = '- 事实门槛：只有对应事件锚点进入“完成”或“变形”、且聊天正文实际形成该条目的取得、使用或成立结果时，相应内容才成为当前事实；“预兆”“活跃”或“取消”不会自动兑现所列走向。玩家偏离时，以聊天中已经发生的事实为准。';
let count = 0;
for (const e of wb.entries.filter(x => x.id >= 493 && x.id <= 550)) {
  const t = fs.readFileSync(e.content_file, 'utf8');
  const m = t.match(/^- 事实门槛：(.+)$/m);
  if (!m) continue;
  const g = m[1];
  const pass = ['完成', '变形', '预兆', '活跃', '取消'].every(s => g.includes(s)) && /(聊天|正文)/.test(g);
  if (pass) continue;
  const updated = t.replace(/^- 事实门槛：.+$/m, std);
  fs.writeFileSync(e.content_file, updated, 'utf8');
  console.log(`[已统一事实门槛] UID${e.id} ${e.comment}`);
  count += 1;
}
console.log(`共处理 ${count} 个文件`);
