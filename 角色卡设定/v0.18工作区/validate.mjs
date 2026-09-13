import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),workspace=path.resolve(root,'../..');
const require=createRequire(path.join(workspace,'角色卡本体/诡异药剂师_MVU_v0.17/package.json'));
const ejs=require('ejs');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const json=f=>JSON.parse(read(f));
const exists=f=>fs.existsSync(path.join(root,f));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const ledger=json('来源台账.json');
const strict=process.argv.includes('--complete');
let checks=0;const errors=[],warnings=[];
const ok=(value,label)=>{checks++;if(!value)errors.push(label);};
const walk=d=>!fs.existsSync(d)?[]:fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>['node_modules','.git'].includes(e.name)?[]:e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]).sort();
const digestFiles=(dir,files)=>{const hash=crypto.createHash('sha256');let bytes=0;for(const file of files){const body=fs.readFileSync(file);bytes+=body.length;hash.update(path.relative(dir,file).replaceAll('\\','/')+'\0');hash.update(body);hash.update('\0');}return {bytes,sha256:hash.digest('hex')};};
const source=fs.readFileSync(path.join(workspace,ledger.source),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'),lines=source.split('\n');
ok(sha(source)===ledger.normalized_sha256,'原文全文指纹不变');
ok(JSON.stringify(ledger.chapter_range)==='[1768,1926]'&&JSON.stringify(ledger.line_range)==='[153712,165860]','原文范围冻结');
let nextLine=153712,nextChapter=1768;
for(const p of ledger.packets){
 ok(p.lines[0]===nextLine&&p.lines[1]>=p.lines[0],`${p.id}包行连续`);
 ok(p.chapters[0]===nextChapter&&p.chapters[1]-p.chapters[0]<5,`${p.id}包章连续且不超过5章`);
 ok(lines[p.lines[0]-1].startsWith(`第${p.chapters[0]}章`),`${p.id}包起点`);
 ok(sha(lines.slice(p.lines[0]-1,p.lines[1]).join('\n')+'\n')===p.sha256,`${p.id}原文包指纹`);
 if(strict)ok(p.read_status==='read_and_recorded'&&exists(p.report),`${p.id}完整精读报告`);
 nextLine=p.lines[1]+1;nextChapter=p.chapters[1]+1;
}
ok(nextLine===165861&&nextChapter===1927,'33包无空洞覆盖完整');
for(const b of ledger.baselines){const dir=path.join(workspace,b.root),files=walk(dir),current=digestFiles(dir,files);ok(files.length===b.files&&current.bytes===b.bytes&&current.sha256===b.sha256,`只读基线：${b.root}`);}
ok(ledger.events.length===58&&ledger.events.every((x,i)=>x.id===`E${435+i}`),'事件编号连续');
const fields=['玩家主权','阶段','地点','前置条件','参与者与动机','默认走向','紧迫度','幕后停止点','变形条件','完成条件','取消条件','结果影响','系统提示','引用概念'];
const states=['未触发','预兆','活跃','完成','变形','取消'];
const bodyBan=/NSFW|叠甲|非露骨|此处略|略去|淡出|安全词|免责声明|内容留白|涉及成人/u;
const metadataBan=/第\s*[\d一二三四五六七八九十百千]+\s*章|小总结|大总结|阶段[一二三四五六七八九十]|v0\.1[678]|编制说明|来源台账|核对记录|原作/u;
const contentFiles=['事件','概念','人物增量','NPC','新NPC'].flatMap(d=>walk(path.join(root,d)).filter(f=>f.endsWith('.md')));
const eventFiles=contentFiles.filter(f=>path.relative(root,f).startsWith('事件'));
ok(new Set(eventFiles.map(f=>path.basename(f).match(/^E\d+/)?.[0])).size===eventFiles.length,'事件ID没有重复');
for(const f of contentFiles){const body=fs.readFileSync(f,'utf8'),rel=path.relative(root,f);ok(!body.includes('\uFFFD'),`${rel}编码`);ok(!bodyBan.test(body),`${rel}正文无NSFW及包装话术`);ok(!metadataBan.test(body),`${rel}无编制元数据`);}
const eventStats=[];
for(const event of ledger.events){
 if(!exists(event.output)){if(strict)ok(false,`${event.id}文件存在`);continue;}
 const body=read(event.output),blank=!body.trim();
 if(blank){ok(event.status==='blank',`${event.id}零字节留白登记`);ok(Buffer.byteLength(body)===0,`${event.id}留空不写占位`);eventStats.push({id:event.id,blank:true,chars:0});continue;}
 if(strict)ok(event.status==='reviewed',`${event.id}完成事实复核`);
 for(const field of fields)ok(body.includes(`- ${field}：`),`${event.id}字段${field}`);
 const prose=body.match(/- 默认走向：([\s\S]*?)\r?\n- 紧迫度：/)?.[1]||'';
 const count=[...prose.replace(/\s/g,'')].length;
 const target=event.major?[1800,2200]:[500,1000];
 if(count<target[0]||count>target[1]){if(strict)ok(Boolean(event.length_exception),`${event.id}字数${count}须有事实或留白例外`);else warnings.push(`${event.id}字数${count}`);}
 eventStats.push({id:event.id,blank:false,chars:count,length_exception:event.length_exception||null});
 for(const state of states){try{const out=ejs.render(body,{getvar:key=>key===`stat_data.事件.锚点状态.${event.id}.状态`?state:'未触发'});ok(out.includes(`# ${event.id}·`),`${event.id}/${state}标题`);ok(out.includes('- 默认走向：')===(state!=='未触发'),`${event.id}/${state}显隐`);}catch(err){ok(false,`${event.id}/${state}渲染：${err.message}`);}}
 for(const sunset of event.hidden_after||[])for(const later of ['完成','变形'])for(const state of states){
  try{const out=ejs.render(body,{getvar:key=>key===`stat_data.事件.锚点状态.${sunset}.状态`?later:key===`stat_data.事件.锚点状态.${event.id}.状态`?state:'未触发'});
   ok(out.includes(`# ${event.id}·`)&&!out.includes('- 默认走向：'),`${event.id}/${state}/${sunset}/${later}匿名分支`);
   ok(!/大黑彘|深海吞噬者|战骑|C1312/.test(out),`${event.id}失效后不泄露专属身份`);
  }catch(err){ok(false,`${event.id}匿名分支渲染：${err.message}`);}
 }
 if(event.id==='E492')ok(!body.includes('下一事件引入')&&!body.includes('E493'),'E492开放终点');
 else {for(const field of ['触发时机','剧情引子','预兆写法','承接因果'])ok(body.includes(`- ${field}：`),`${event.id}桥字段${field}`);if(strict)ok(body.includes(`## 下一事件引入（${event.next_event}·`),`${event.id}后继一致`);}
 if(strict){ok(Array.isArray(event.source_lines)&&event.source_lines[0]>=153712&&event.source_lines[1]<=165860,`${event.id}原文行证据`);ok(event.source_chapters?.[0]>=1768&&event.source_chapters?.[1]<=1926,`${event.id}章节证据`);}
}
if(strict){let line=153712;for(const event of ledger.events){ok(event.source_lines?.[0]===line,`${event.id}事件原文覆盖连续`);line=event.source_lines?.[1]+1;}ok(line===165861,'全部事件源行覆盖终点');}
const manifest=exists('交付清单.json')?json('交付清单.json'):null;
if(strict)ok(Boolean(manifest),'交付清单存在');
if(manifest){
 const registered=[...manifest.concepts,...manifest.characters];
 const oldIds=new Set(json('核对记录/既有逻辑编号.json').map(x=>x.id));
 ok(new Set(manifest.concepts.map(x=>x.id)).size===manifest.concepts.length,'概念逻辑编号唯一');
 ok(new Set(registered.map(x=>x.output)).size===registered.length,'非事件文件登记唯一');
 for(const item of registered){
  ok(exists(item.output),`${item.output}存在`);if(!exists(item.output))continue;
  const body=read(item.output),gates=[...new Set([...body.matchAll(/锚点状态\.(E\d+)\.状态/g)].map(m=>m[1]))];
  ok(item.source_events.length>0&&item.source_events.every(id=>ledger.events.some(e=>e.id===id)),`${item.output}来源事件范围`);
  const hiddenAfter=item.hidden_after||[];
  ok(JSON.stringify([...gates].sort())===JSON.stringify([...new Set([...item.source_events,...hiddenAfter])].sort()),`${item.output}门槛与来源对应`);
  ok(item.source_lines.length>0&&item.source_lines.every(s=>s[0]>=153712&&s[1]<=165860&&s[1]>=s[0]),`${item.output}原文行范围`);
  if(item.id){
   for(const field of ['类别','定义','来源','机制','限制与代价','未知项','禁止外推'])ok(body.includes(`- ${field}：`),`${item.id}字段${field}`);
   ok(item.kind==='update'?Boolean(item.base_path)&&fs.existsSync(path.join(workspace,item.base_path)):!oldIds.has(item.id),`${item.id}新增/既有归属`);
   ok(item.kind==='update'||Number(item.id.slice(1))>=1321,`${item.id}新增编号不沿用旧切片`);
  }
  let render;try{render=ejs.compile(body);}catch(err){ok(false,`${item.output}编译：${err.message}`);continue;}
  for(const event of ledger.events)for(const state of states){try{const out=render({getvar:key=>key===`stat_data.事件.锚点状态.${event.id}.状态`?state:'未触发'}).trim();ok(Boolean(out)===(item.source_events.includes(event.id)&&!hiddenAfter.includes(event.id)&&['完成','变形'].includes(state)),`${item.output}/${event.id}/${state}独立门控`);}catch(err){ok(false,`${item.output}渲染：${err.message}`);}}
  for(const sunset of hiddenAfter)for(const state of ['预兆','活跃','完成','变形','取消']){
   const out=render({getvar:key=>key===`stat_data.事件.锚点状态.${sunset}.状态`?state:'完成'}).trim();
   ok(Boolean(out)===!['完成','变形'].includes(state),`${item.output}/${sunset}/${state}记录失效门槛`);
  }
 }
 const realNonEvents=contentFiles.filter(f=>!path.relative(root,f).startsWith('事件')).map(f=>path.relative(root,f).replaceAll('\\','/')).sort();
 ok(JSON.stringify(realNonEvents)===JSON.stringify(registered.map(x=>x.output).sort()),'所有概念人物文件已登记');
 const availableIds=new Set([...oldIds,...manifest.concepts.map(x=>x.id)]);
 for(const event of ledger.events.filter(e=>e.status!=='blank'&&exists(e.output))){const refs=[...new Set(read(event.output).match(/\bC\d+\b/g)||[])];ok(refs.length>0&&refs.every(id=>availableIds.has(id)),`${event.id}概念引用可解析`);}
 if(strict){
  ok(manifest.review_status==='passed','独立复核已通过');
  ok(manifest.review_reports?.length>=4&&manifest.review_reports.every(exists),'独立复核及主代理收口报告');
  const files=manifest.reviewed_files.map(f=>path.join(root,f)).sort();
  ok(digestFiles(root,files).sha256===manifest.reviewed_content_sha256,'复核指纹匹配当前内容');
  ok(manifest.character_coverage?.length===43&&manifest.character_coverage.every(x=>x.status!=='pending'),'43名既有人物已筛查');
 }
}
if(exists('摘要/事件摘要.json')){
 const summaries=json('摘要/事件摘要.json'),bridges=json('摘要/衔接表.json'),nonblank=ledger.events.filter(e=>e.status!=='blank');
 ok(summaries.length===58&&summaries.every((s,i)=>s.id===ledger.events[i].id&&(s.blank?s.text==='':Boolean(s.text))),'58条摘要与留白一致');
 ok(bridges.pairs.length===nonblank.length-1&&bridges.pairs.every((p,i)=>p.from===nonblank[i].id&&p.to===nonblank[i+1].id&&p.trigger&&p.lead&&p.omen&&p.causal),'全部非空事件桥接连续');
 ok(bridges.terminal==='E492'&&!JSON.stringify(bridges).includes('E493'),'衔接终点封口');
 for(const f of ['摘要/阶段总结.md','摘要/阶段末总述.md']){
  const body=read(f);ok(!bodyBan.test(body)&&!metadataBan.test(body),`${f}正文措辞`);
  for(const state of states)try{ok(Boolean(ejs.render(body,{getvar:()=>state}).trim())===['完成','变形'].includes(state),`${f}/${state}显隐`);}catch(err){ok(false,`${f}渲染：${err.message}`);}
 }
}else if(strict)ok(false,'三层摘要与衔接存在');
const report={status:errors.length?'failed':'passed',checks,errors,warnings,planned_events:58,written_events:eventStats.filter(x=>!x.blank).length,blank_events:eventStats.filter(x=>x.blank).map(x=>x.id),events:eventStats,concepts:manifest?.concepts.length||0,characters:manifest?.characters.length||0,complete:strict&&!errors.length,integrated:false,real_host:'deferred'};
fs.writeFileSync(path.join(root,'核对记录/验收摘要.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
