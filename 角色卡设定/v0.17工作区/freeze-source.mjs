import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),workspace=path.resolve(root,'../..');
if(fs.existsSync(path.join(root,'来源台账.json')))throw new Error('台账已冻结，不覆盖');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=fs.readFileSync(path.resolve(root,'../原文.txt'),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const lines=source.split('\n'),heads=[];
lines.forEach((line,i)=>{const m=line.match(/^第(\d+)章/);if(m&&+m[1]>=1611&&+m[1]<=1768)heads.push({chapter:+m[1],line:i+1,title:line});});
for(let n=1611;n<=1768;n++)if(heads.filter(x=>x.chapter===n).length!==1)throw new Error('章节异常 '+n);
const lineOf=n=>heads.find(x=>x.chapter===n).line;
const groups=[{id:'A',chapters:[1611,1669],events:[397,408]},{id:'B',chapters:[1670,1716],events:[409,418]},{id:'C',chapters:[1717,1767],events:[419,434]}];
const packets=[];
for(const g of groups)for(let first=g.chapters[0],i=1;first<=g.chapters[1];first+=5,i++){
  const last=Math.min(first+4,g.chapters[1]),range=[lineOf(first),lineOf(last+1)-1];
  packets.push({id:g.id+i,group:g.id,chapters:[first,last],lines:range,sha256:sha(lines.slice(range[0]-1,range[1]).join('\n')+'\n'),read_status:'pending',report:`核对记录/${g.id+i}.md`});
}
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>['node_modules','.git'].includes(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]).sort();
const baselines=['角色卡本体/诡异药剂师_MVU_v0.16','角色卡设定/v0.16工作区','角色卡设定/阶段十至阶段十八_概念事件切片/阶段12_第1611-1767章'].map(rel=>{
 const dir=path.join(workspace,rel),files=walk(dir),hash=crypto.createHash('sha256');let bytes=0;
 for(const f of files){const body=fs.readFileSync(f);bytes+=body.length;hash.update(path.relative(dir,f).replaceAll('\\','/')+'\0');hash.update(body);hash.update('\0');}
 return {root:rel,files:files.length,bytes,sha256:hash.digest('hex')};
});
const candidate='角色卡设定/阶段十至阶段十八_概念事件切片/阶段12_第1611-1767章/事件';
const events=fs.readdirSync(path.join(workspace,candidate)).filter(f=>/^E\d+_/.test(f)).sort().map(f=>{
 const body=fs.readFileSync(path.join(workspace,candidate,f),'utf8'),id=f.match(/^E\d+/)[0],num=+id.slice(1);
 return {id,title:f.replace(/^E\d+_/,'').replace(/\.md$/,''),stage:body.match(/- 阶段：(S\d+)/)?.[1],group:groups.find(g=>num>=g.events[0]&&num<=g.events[1]).id,candidate:`${candidate}/${f}`,output:`事件/${f}`,status:'pending',source_chapters:[],source_lines:[]};
});
for(const d of ['事件','概念','人物增量','NPC','摘要','核对记录'])fs.mkdirSync(path.join(root,d),{recursive:true});
const ledger={source:'角色卡设定/原文.txt',normalization:'UTF-8 remove BOM; CRLF to LF; packet ends in LF',normalized_sha256:sha(source),chapter_range:[1611,1767],line_range:[lineOf(1611),lineOf(1768)-1],groups,packets,baselines,events};
fs.writeFileSync(path.join(root,'来源台账.json'),JSON.stringify(ledger,null,2)+'\n');
fs.writeFileSync(path.join(root,'事件蓝图.json'),JSON.stringify({status:'candidate_boundaries_to_verify',scope:[397,434],groups,events:events.map(({id,title,stage,group,candidate,output})=>({id,title,stage,group,candidate,output,previous:+id.slice(1)===397?'E396':`E${+id.slice(1)-1}`,next:+id.slice(1)===434?null:`E${+id.slice(1)+1}`,boundary_rule:'本组逐包核实后记录精确原文边界，不把后件揭示倒灌前件'}))},null,2)+'\n');
console.log(JSON.stringify({packets:packets.length,groups,lines:ledger.line_range,events:events.length,baselines},null,2));
