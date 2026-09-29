import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),workspace=path.resolve(root,'../..');
if(fs.existsSync(path.join(root,'来源台账.json')))throw new Error('台账已冻结，不覆盖');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=fs.readFileSync(path.resolve(root,'../原文.txt'),'utf8').replace(/^﻿/,'').replace(/\r\n/g,'\n');
const lines=source.split('\n'),heads=[];
// Scan 2247–2408 so chapter 2407 has a known end line (start of 2408 − 1).
// 原文行186399的「第2262章」是错标（实为2162章标题，位于2161与2163之间），v0.20 台账已登记；本范围只取行号≥193313的标题。
lines.forEach((line,i)=>{const m=line.match(/^第(\d+)章/);if(m&&+m[1]>=2247&&+m[1]<=2408&&i+1>=193313)heads.push({chapter:+m[1],line:i+1,title:line});});
const KNOWN_GAPS=new Set([]); // 2247—2407 无缺章标题
for(let n=2247;n<=2408;n++){
  const c=heads.filter(x=>x.chapter===n).length;
  if(KNOWN_GAPS.has(n)){if(c!==0)throw new Error('已知缺章却出现标题 '+n);continue;}
  if(c!==1)throw new Error('章节异常 '+n+' count='+c);
}
// missing n → start line of next existing chapter (empty gap at n)
const lineOf=n=>{
  const exact=heads.find(x=>x.chapter===n);
  if(exact)return exact.line;
  const next=heads.find(x=>x.chapter>n);
  if(!next)throw new Error('lineOf 越界 '+n);
  return next.line;
};
const groups=[
  {id:'A',chapters:[2247,2300],events:[594,611]},
  {id:'B',chapters:[2301,2354],events:[612,629]},
  {id:'C',chapters:[2355,2407],events:[630,646]},
];
const packets=[];
for(const g of groups)for(let first=g.chapters[0],i=1;first<=g.chapters[1];first+=5,i++){
  const last=Math.min(first+4,g.chapters[1]),range=[lineOf(first),lineOf(last+1)-1];
  const gaps=[...KNOWN_GAPS].filter(n=>n>=first&&n<=last);
  packets.push({id:g.id+i,group:g.id,chapters:[first,last],lines:range,sha256:sha(lines.slice(range[0]-1,range[1]).join('\n')+'\n'),read_status:'pending',report:`核对记录/${g.id+i}.md`,...(gaps.length?{known_chapter_gaps:gaps}:{})});
}
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>['node_modules','.git'].includes(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]).sort();
const baselines=['角色卡本体/诡异药剂师_MVU_v0.20','角色卡设定/v0.20工作区','角色卡设定/阶段十至阶段十八_概念事件切片/阶段16_第2247-2407章'].map(rel=>{
 const dir=path.join(workspace,rel),files=walk(dir),hash=crypto.createHash('sha256');let bytes=0;
 for(const f of files){const body=fs.readFileSync(f);bytes+=body.length;hash.update(path.relative(dir,f).replaceAll('\\','/')+'\0');hash.update(body);hash.update('\0');}
 return {root:rel,files:files.length,bytes,sha256:hash.digest('hex')};
});
const candidate='角色卡设定/阶段十至阶段十八_概念事件切片/阶段16_第2247-2407章/事件';
const events=fs.readdirSync(path.join(workspace,candidate)).filter(f=>/^E\d+_/.test(f)).sort((a,b)=>+(a.match(/^E(\d+)/)[1])-+(b.match(/^E(\d+)/)[1])).map(f=>{
 const body=fs.readFileSync(path.join(workspace,candidate,f),'utf8'),id=f.match(/^E\d+/)[0],num=+id.slice(1);
 const g=groups.find(g=>num>=g.events[0]&&num<=g.events[1]);
 if(!g)throw new Error('事件越界 '+id);
 return {id,title:f.replace(/^E\d+_/,'').replace(/\.md$/,''),stage:body.match(/- 阶段：(S\d+)/)?.[1],group:g.id,candidate:`${candidate}/${f}`,output:`事件/${f}`,status:'pending',source_chapters:[],source_lines:[]};
});
for(const d of ['事件','概念','人物增量','NPC','新NPC','摘要','核对记录'])fs.mkdirSync(path.join(root,d),{recursive:true});
const ledger={source:'角色卡设定/原文.txt',normalization:'UTF-8 remove BOM; CRLF to LF; packet ends in LF',normalized_sha256:sha(source),chapter_range:[2247,2407],line_range:[lineOf(2247),lineOf(2408)-1],known_chapter_gaps:[...KNOWN_GAPS].sort((a,b)=>a-b),groups,packets,baselines,events};
fs.writeFileSync(path.join(root,'来源台账.json'),JSON.stringify(ledger,null,2)+'\n');
fs.writeFileSync(path.join(root,'事件蓝图.json'),JSON.stringify({status:'candidate_boundaries_to_verify',scope:[594,646],groups,events:events.map(({id,title,stage,group,candidate,output})=>({id,title,stage,group,candidate,output,previous:+id.slice(1)===594?'E593':`E${+id.slice(1)-1}`,next:+id.slice(1)===646?null:`E${+id.slice(1)+1}`,boundary_rule:'本组逐包核实后记录精确原文边界，不把后件揭示倒灌前件'}))},null,2)+'\n');
console.log(JSON.stringify({packets:packets.length,groups,lines:ledger.line_range,events:events.length,gaps:ledger.known_chapter_gaps},null,2));
