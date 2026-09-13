import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const ledger=JSON.parse(fs.readFileSync(path.join(root,'来源台账.json'),'utf8'));
const guard='<%_ if (["完成","变形"].includes(getvar("stat_data.事件.锚点状态.E432.状态", { defaults: "未触发" }))) { _%>';
const replacements={
 E429:'# E429·暗海遭遇的记忆空缺\n\n海域中的具体遭遇对象无法从现存记录重新辨认。只沿用当前仍可说明的航行、伏击与追杀背景；林恩记得什么由玩家说明。',
 E430:'# E430·海域遭遇留下的空缺\n\n同伴无法从现存纸石记录辨认遭遇中的个体，仍记得遭到伏击与追杀。林恩的记忆由玩家说明。',
 E431:'# E431·未能保存的同行记录\n\n与当前局面有关的伏击、围堵和追杀背景仍然存在，身份空缺无法据现存材料补全。小丑对记忆空缺的反应按当前状态呈现；林恩是否记得及记得哪些内容由玩家说明。'
};
for(const [id,closing] of Object.entries(replacements)){
 const event=ledger.events.find(e=>e.id===id),file=path.join(root,event.output),body=fs.readFileSync(file,'utf8');
 if(!body.startsWith(guard))fs.writeFileSync(file,`${guard}\n${closing}\n<%_ } else { _%>\n${body.trimEnd()}\n<%_ } _%>\n`);
 event.hidden_after=['E432'];
}
fs.writeFileSync(path.join(root,'来源台账.json'),JSON.stringify(ledger,null,2)+'\n');
console.log('E429、E430、E431增加记录失效后的匿名分支');
