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
write('摘要/衔接表.json',{previous_terminal:'E396',entry:'E397',blank_events:ledger.events.filter(e=>e.status==='blank').map(e=>e.id),pairs,terminal:'E434',future_event:null});
const gate=id=>`["完成","变形"].includes(getvar("stat_data.事件.锚点状态.${id}.状态", { defaults: "未触发" }))`;
const condition=s=>[gate(s.id),...(s.hidden_after||[]).map(id=>`!${gate(id)}`)].join(' && ');
const stageText=[...new Set(summaries.map(s=>s.phase))].map(stage=>{
 const records=summaries.filter(s=>s.phase===stage&&!s.blank);
 return `<%_ if (${records.map(s=>`(${condition(s)})`).join(' || ')}) { _%>\n# ${stage}\n`+records.map(s=>`<%_ if (${condition(s)}) { _%>\n- ${s.id}：${s.text}\n<%_ } _%>`).join('\n')+'\n<%_ } _%>\n';
}).join('\n');
write('摘要/阶段总结.md',stageText);
const arcs=[
 {title:'残魂与新生来客',ids:['E397','E398','E399','E400','E401'],text:'残魂提供断续旧日画面，承载不足仍会造成过载；声音相似不替玩家决定自身身份。夏娃的来历、弱基因联系和对同伴的态度须分别确认。炼药室中的标本感应与粉色药剂失控须按实际接触与处置记录；她分享的标本感应可以引出血谷定位，但也存在反向暴露；临场编造的解释没有获得世界真相地位。'},
 {title:'移动城市与旧日战场',ids:['E402','E403','E404','E405','E406','E407','E408'],text:'出击依赖实际集结、运输、命运窗口和有限尸骸资源。枢纽损毁、战场分割、孽主退出和最终击杀是不同结果。完整巨像只是暂时聚合，旧书无法单凭爆眼杀死根源，原初屏障也不是可无限吸收的奖品。若最终击杀成立，诅咒庇护、生命维持、机体超载与战斗奖励各按实际状态保留。'},
 {title:'战后遗产与条件合作',ids:['E409','E410','E411','E412','E413'],text:'船长的灵体与深海本体分开，救助承诺依玩家回应。任务奖励血核、秘门身份检验、魂灵机器和旧日影像逐项形成证据，残魂有其未修复的关系与立场。堕落之心仍有小丑意识，接受利用不等于放弃狂信。自然移植可以推进到结茧迟滞，此处没有自动苏醒结果。'},
 {title:'旧时空与未来警告',ids:['E414','E415','E416','E417','E418'],text:'三柱与时间因果仍区分证词和已验证机制。进入旧身体后，资源、技能和肉体负担重新受实际条件约束；第一道裂隙关闭不能代替清除剩余污染源。未来画家的警告没有解释所有代词与动机，回归后同伴只知道玩家实际分享的内容。职业装备与鸦鸣能力按领取和使用分别记录，未来身份没有剥夺当前选择。'},
 {title:'罪孽城与家人的回应',ids:['E419','E420','E421','E422','E423','E424','E425','E426','E427'],text:'孽主的诅咒、公开惩罚、短暂压制和日常个性并存；催情强制与当众体罚按实际选择成立。相似的孽灵没有让未来死法成为不可改变的定论。求援、裂隙修补和城市损伤各自结算，未来来客须经玩家允许才借躯行动，其力量不归当前玩家所有。三位一体仍是尚未接受的极端困境提案，闭门哭声也不能替代实际探访所得。'},
 {title:'西海消息与八旗围困',ids:['E428','E429','E430','E431','E432','E433','E434'],text:'远征受边境红霆、幻境、无序和残余污染共同限制。清醒不等于彻底治愈，主动投敌者与被侵蚀者保有差异。记录抹除留下可观察空缺，不能通过系统空间自动恢复；小丑是否自愿同行按真实接触成立。电码提供艾泽法拉的联络，三叉戟与第二渡鸦仍有未证部分。八旗和王兽若已封锁海域，终点只停在节点互援压力与突围选择。'}
];
write('摘要/阶段末总述.md',arcs.map(a=>`<%_ if (${a.ids.map(gate).join(' && ')}) { _%>\n# ${a.title}\n\n${a.text} 来源：${a.ids.join('、')}。\n<%_ } _%>\n`).join('\n'));
console.log(JSON.stringify({summaries:summaries.length,bridges:pairs.length,stages:7,arcs:arcs.length}));
