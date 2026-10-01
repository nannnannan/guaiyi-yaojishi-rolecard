import fs from 'node:fs';
const tp='src/characters/真理神王/NPC.md';
const fp='src/characters/未来画家/NPC.md';
let t=fs.readFileSync(tp,'utf8');
// 找所有 "# 未来画家·" 节：节起点=标题前最近的 "<%_ if"；
const titles=[];
let i=0;
while((i=t.indexOf('\n# 未来画家·',i+1))>-1)titles.push(i+1);
const blocks=[];
// 逐个提取：从节前的 <%_ if 到下一个 <%_ if 或文件尾；对最后一节 特殊处理（到其 <%_ } _%> 文件尾不乱剪后续真理神王内容）
for(const start of titles){
  // 节标题起点往前找最近的 <%_ if（不是 EJS close）
  let gateStart=t.lastIndexOf('<%_ if',start-1);
  if(gateStart<0){console.log('跳过起始找不到 if:',start);continue;}
  // 终点：标题后的下一个 <%_ if （节与节之间）
  let nextGate=t.indexOf('<%_ if',start+1);
  if(nextGate<0)nextGate=t.length;
  // 但须确保不剪到下一个不是未来画家的节——我们只收 {gateStart,nextGate} 块
  blocks.push({gateStart,nextGate});
}
blocks.sort((a,b)=>a.gateStart-b.gateStart);
// 合并相邻/重叠——应该有 26 个独立块
console.log('识别块:',blocks.length);
// 出抽拼接
let future='';
let cum=0;
for(const b of blocks){
  future+=t.slice(cum,b.gateStart);
  cum=b.nextGate;
}
// 太复杂，改用事件锚点号化：对每个块只保留它本属于自己的两段闭合 —
// 简化：直接按 title-list 分段，找每个节的 <%_ if 起到该节的第二个 <%_ } _%>
function extractSection(sIdx,eIdx){
  // 把节标题行到下一节标题或文件尾都拿出来
  let seg=t.slice(sIdx,eIdx);
  // 往前补 `<%_ if ...` 完整门（ 需要找到段首的完整 <%_ if ）
  let gateOpen=t.lastIndexOf('<%_ if',sIdx-1);
  return t.slice(gateOpen,eIdx);
}
let moved='';
for(let k=0;k<titles.length;k++){
  const s=titles[k];
  const e=(k+1<titles.length)?titles[k+1]:t.length;
  moved+=extractSection(s,e)+'\n\n';
}
// 从真理神王去掉这些块：把 titles 区段都去掉
let truth='';
let c=0;
for(const s of titles){
  const gateOpen=t.lastIndexOf('<%_ if',s-1);
  truth+=t.slice(c,gateOpen);
  c=s;
}
truth+=t.slice(c);
// E697 乱码修复（已移到 future 里）
moved=moved.replace(/她的眼睛，也是一颗玄月的=+/g,'她的眼睛，也是一双含泪却坚定的眼睛');
fs.writeFileSync(tp,truth);
let f=fs.readFileSync(fp,'utf8');
if(!f.endsWith('\n'))f+='\n';
f+='\n';
f+=moved;
fs.writeFileSync(fp,f);
console.log('移动完成: 26 节');
// 校验配对
function count(name,s){const open=(s.match(/<%_/g)||[]).length,close=(s.match(/_%>/g)||[]).length;console.log(name,'<%_:',open,'_%>:',close);}
count('真理神王',truth);count('未来画家',fs.readFileSync(fp,'utf8'));
console.log('真理神王 残留画家计数:',(truth.match(/# 未来画家/g)||[]).length);
console.log('未来画家 节数:',(fs.readFileSync(fp,'utf8').match(/^# 未来画家/gm)||[]).length);
