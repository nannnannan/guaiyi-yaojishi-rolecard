import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const json=f=>JSON.parse(read(f));
const write=(f,x)=>fs.writeFileSync(path.join(root,f),JSON.stringify(x,null,2)+'\n');
const ledger=json('来源台账.json');
for(const group of ['A','B','C']){
 const f=`核对记录/事件登记_${group}.json`;if(!fs.existsSync(path.join(root,f)))continue;
 const raw=json(f),entries=Array.isArray(raw)?raw:raw.events;
 for(const entry of entries){
  const old=ledger.events.find(x=>x.id===entry.id);if(!old||old.group!==group)throw new Error(`错组 ${entry.id}`);
  for(const key of ['title','stage','output','status','source_chapters','source_lines','extra_source_lines','packets','summary','corrections','blank_ranges','major','length_exception'])if(entry[key]!==undefined)old[key]=entry[key];
 }
}
for(const event of ledger.events){
 if(!fs.existsSync(path.join(root,event.output)))continue;
 const body=read(event.output);if(body.trim()){
  event.title=[...body.matchAll(/^# E\d+·([^\r\n]+)/gm)].at(-1)?.[1]||event.title;
  event.stage=body.match(/- 阶段：(S\d+)/)?.[1]||event.stage;
  event.concept_refs=[...new Set(body.match(/\bC\d+\b/g)||[])];
 }
}
for(const p of ledger.packets)if(fs.existsSync(path.join(root,p.report)))p.read_status='read_and_recorded';
const nonblank=ledger.events.filter(e=>e.status!=='blank');
for(let i=0;i<nonblank.length;i++)nonblank[i].next_event=nonblank[i+1]?.id||null;
write('来源台账.json',ledger);
const blueprint=json('事件蓝图.json');
blueprint.events=ledger.events.map(({id,title,stage,group,candidate,output,source_chapters,source_lines,next_event,status})=>({id,title,stage,group,candidate,output,source_chapters,source_lines,next:next_event,status}));
blueprint.status=ledger.events.every(e=>['authored','reviewed','blank'].includes(e.status))?'source_boundaries_recorded':'reading';
write('事件蓝图.json',blueprint);
console.log(JSON.stringify({packets:ledger.packets.filter(p=>p.read_status==='read_and_recorded').length,events:ledger.events.filter(e=>e.status!=='pending').length,blank:ledger.events.filter(e=>e.status==='blank').map(e=>e.id)}));
