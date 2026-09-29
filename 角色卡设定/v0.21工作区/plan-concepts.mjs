import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
if(fs.existsSync(path.join(root,'概念分工.json')))throw new Error('已分配，不覆盖');
const index=JSON.parse(fs.readFileSync(path.join(root,'核对记录/既有逻辑编号.json'),'utf8'));
const maxId=Math.max(...index.map(x=>+x.id.slice(1)));
// v0.18 concept rows are filled after event cross-review; bootstrap ships empty plan shell only.
const rows=[];
const items=rows.map(([group,id,title])=>{const old=index.find(x=>x.id===id);return {group,id,title,kind:old?'update':'new',base_path:old?.file||null,output:`概念/${id}_${title}.md`,status:'planned'};});
const plan={status:'等待事件复核后编写',runtime_uid:'not_allocated',prior_max_id:`C${maxId}`,new_id_range_hint:[`C${maxId+1}`,'待分配'],rules:['先核查既有同义概念；编号是逻辑标识，不是运行UID','逐事件完成或变形后开放该事件实际事实，不按整组一次开放','NSFW：事实成立则直写；事实不足才留白；不写占位、叠甲、回避话术或非性替代；幼态/幼年体外形固定非性','正文只用E/C编号；章节行号放核对记录'],items};
fs.writeFileSync(path.join(root,'概念分工.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({total:items.length,updates:0,new:0,prior_max_id:maxId,note:'empty shell; fill after event review'}));
