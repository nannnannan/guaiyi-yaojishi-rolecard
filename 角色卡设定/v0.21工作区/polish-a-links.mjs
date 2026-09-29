import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),ledger=JSON.parse(fs.readFileSync(path.join(root,'来源台账.json'),'utf8'));
const rules=JSON.parse(fs.readFileSync(path.join(root,'核对记录/A组衔接审定.json'),'utf8'));
for(const r of rules){const event=ledger.events.find(e=>e.id===r.from),next=ledger.events.find(e=>e.id===r.to),file=path.join(root,event.output);let body=fs.readFileSync(file,'utf8');
 body=body.replace(/^- 变形条件：.*$/m,`- 变形条件：${r.variant}`).replace(/^- 取消条件：.*$/m,`- 取消条件：${r.cancel}`);
 const bridge=`## 下一事件引入（${r.to}·${next.title}）\n- 触发时机：${r.from}已完成、变形、取消或活跃且收尾，${r.to}尚未触发或处于预兆；${r.trigger}\n- 剧情引子：${r.lead}\n- 预兆写法：${r.omen}\n- 承接因果：${r.causal}\n<%_ } _%>\n`;
 body=body.replace(/## 下一事件引入[\s\S]*$/,bridge);fs.writeFileSync(file,body);
}
console.log(`已应用${rules.length}条审定桥接与分支条件`);
