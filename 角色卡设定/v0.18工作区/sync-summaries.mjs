import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const write=(f,x)=>fs.writeFileSync(path.join(root,f),typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');
const ledger=json('来源台账.json');
const summaries=json('摘要/事件摘要.json').map(s=>{const e=ledger.events.find(e=>e.id===s.id);return {...s,title:e.title,phase:e.stage,blank:e.status==='blank'};});
write('摘要/事件摘要.json',summaries);
const nonblank=ledger.events.filter(e=>e.status!=='blank');
const field=(body,key)=>body.match(new RegExp(`^- ${key}：(.*)$`,'m'))?.[1]?.trim();
const pairs=nonblank.slice(0,-1).map((event,i)=>{
 const body=read(event.output).split('## 下一事件引入')[1]||'';
 return {from:event.id,to:nonblank[i+1].id,trigger:field(body,'触发时机'),lead:field(body,'剧情引子'),omen:field(body,'预兆写法'),causal:field(body,'承接因果')};
});
if(pairs.some(p=>!p.trigger||!p.lead||!p.omen||!p.causal))throw new Error('桥字段未齐 '+JSON.stringify(pairs.filter(p=>!p.trigger||!p.lead||!p.omen||!p.causal)));
write('摘要/衔接表.json',{previous_terminal:'E434',entry:'E435',blank_events:ledger.events.filter(e=>e.status==='blank').map(e=>e.id),pairs,terminal:'E492',future_event:null});
const gate=id=>`["完成","变形"].includes(getvar("stat_data.事件.锚点状态.${id}.状态", { defaults: "未触发" }))`;
const condition=s=>[gate(s.id),...(s.hidden_after||[]).map(id=>`!${gate(id)}`)].join(' && ');
const stageText=[...new Set(summaries.map(s=>s.phase))].map(stage=>{
 const records=summaries.filter(s=>s.phase===stage&&!s.blank);
 return `<%_ if (${records.map(s=>`(${condition(s)})`).join(' || ')}) { _%>\n# ${stage}\n`+records.map(s=>`<%_ if (${condition(s)}) { _%>\n- ${s.id}：${s.text}\n<%_ } _%>`).join('\n')+'\n<%_ } _%>\n';
}).join('\n');
write('摘要/阶段总结.md',stageText);
const arcs=JSON.parse(read('摘要/_arcs.json'));
write('摘要/阶段末总述.md',arcs.map(a=>`<%_ if (${a.ids.map(gate).join(' && ')}) { _%>\n# ${a.title}\n\n${a.text} 来源：${a.ids.join('、')}。\n<%_ } _%>\n`).join('\n'));
console.log(JSON.stringify({summaries:summaries.length,bridges:pairs.length,stages:[...new Set(summaries.map(s=>s.phase))].length,arcs:arcs.length}));
