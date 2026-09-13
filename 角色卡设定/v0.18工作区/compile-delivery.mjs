import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const write=(f,x)=>fs.writeFileSync(path.join(root,f),JSON.stringify(x,null,2)+'\n');
const ledger=json('来源台账.json'),plan=json('概念分工.json');
const groups=['A','B','C'].map(g=>json(`核对记录/条目登记_${g}.json`));
const concepts=groups.flatMap(g=>g.concepts),characters=groups.flatMap(g=>g.characters);
if(new Set(concepts.map(x=>x.id)).size!==concepts.length)throw new Error('概念编号重复');
for(const item of plan.items.filter(i=>i.status!=='merged'))if(!concepts.some(c=>c.id===item.id&&c.output===item.output))throw new Error('未按分工交付 '+item.id);
for(const event of ledger.events){
 if(event.status==='blank'){event.concept_refs=[];continue;}
 const related={};
 const refs=concepts.filter(c=>c.source_events.includes(event.id)||(related[event.id]||[]).includes(c.id));
 if(!refs.length)throw new Error(`${event.id}没有已核概念`);
 const body=read(event.output).replace(/^- 引用概念：.*$/m,'- 引用概念：'+refs.map(c=>`${c.id} ${c.title}`).join('；'));
 fs.writeFileSync(path.join(root,event.output),body);
 event.concept_refs=refs.map(c=>c.id);
 event.status='reviewed';
}
write('来源台账.json',ledger);
const blueprint=json('事件蓝图.json');
blueprint.status='events_cross_reviewed';
blueprint.events=ledger.events.map(({id,title,stage,group,candidate,output,source_chapters,source_lines,next_event,status})=>({id,title,stage,group,candidate,output,source_chapters,source_lines,next:next_event,status}));
write('事件蓝图.json',blueprint);
const aliases={};
const conceptCoverage={};
const coverage=json('核对记录/既有人物筛查.json').map(person=>{
 const names=aliases[person.name]||[person.name];
 const matched=characters.filter(c=>names.includes(c.name)||names.some(name=>path.basename(c.output).startsWith(name+'_')));
 if(conceptCoverage[person.name])return {...person,status:'covered_by_concept_increment',outputs:concepts.filter(c=>conceptCoverage[person.name].includes(c.id)).map(c=>c.output),basis:'新事实已在相应概念中逐事件登记'};
 return {...person,status:matched.length?'increment_authored':'no_new_independent_increment',outputs:matched.map(c=>c.output),basis:'逐包人物事实筛查；仅有称呼、旧状态延续或未到场者不另造增量'};
});
write('核对记录/既有人物筛查.json',coverage);
const summaries=['摘要/事件摘要.json','摘要/衔接表.json','摘要/阶段总结.md','摘要/阶段末总述.md'];
const reviewed_files=[...ledger.events.map(e=>e.output),...concepts.map(c=>c.output),...characters.map(c=>c.output),...summaries].sort();
const hash=crypto.createHash('sha256');
for(const file of reviewed_files){hash.update(file+'\0');hash.update(fs.readFileSync(path.join(root,file)));hash.update('\0');}
const review_reports=['核对记录/交叉复核_A_by_C.md','核对记录/交叉复核_B_by_A.md','核对记录/交叉复核_C_by_B.md','核对记录/主代理边界复核.md'];
const previous=fs.existsSync(path.join(root,'交付清单.json'))?json('交付清单.json'):{};
const manifest={target_label:'v0.18设定候选',runtime_base:'0.17.0',scope:{chapters:[1768,1926],events:['E435','E492']},events:ledger.events,concepts,characters,character_coverage:coverage,summaries,review_status:'pending_final_check',review_reports:[...new Set([...review_reports,...(previous.review_reports||[])])],reviewed_files,reviewed_content_sha256:hash.digest('hex'),integrated:false,packaged:false,pushed:false,real_host:'deferred'};
write('交付清单.json',manifest);
console.log(JSON.stringify({events:ledger.events.length,concepts:concepts.length,updates:concepts.filter(c=>c.kind==='update').length,new:concepts.filter(c=>c.kind==='new').length,characters:characters.length,review_status:manifest.review_status}));
