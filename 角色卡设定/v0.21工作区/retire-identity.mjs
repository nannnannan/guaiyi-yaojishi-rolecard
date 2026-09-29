import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const ledger=JSON.parse(fs.readFileSync(path.join(root,'来源台账.json'),'utf8'));
// v0.21：按需为「记录失效后须匿名化」的事件增加隐藏分支。
// 用法：在 replacements 中登记 {事件ID: {guard_event, closing}}，guard_event 为导致前件记录失效的后置事件。
const replacements={
 // 示例：E594:{guard_event:'E600',closing:'# E594·……\n\n……林恩记得什么由玩家说明。'}
};
for(const [id,{guard_event,closing}] of Object.entries(replacements)){
 const guard=`<%_ if (["完成","变形"].includes(getvar("stat_data.事件.锚点状态.${guard_event}.状态", { defaults: "未触发" }))) { _%>`;
 const event=ledger.events.find(e=>e.id===id),file=path.join(root,event.output),body=fs.readFileSync(file,'utf8');
 if(!body.startsWith(guard))fs.writeFileSync(file,`${guard}\n${closing}\n<%_ } else { _%>\n${body.trimEnd()}\n<%_ } _%>\n`);
 event.hidden_after=[...(event.hidden_after||[]),guard_event];
}
fs.writeFileSync(path.join(root,'来源台账.json'),JSON.stringify(ledger,null,2)+'\n');
console.log(`已为${Object.keys(replacements).length}条事件增加记录失效后的匿名分支`);
