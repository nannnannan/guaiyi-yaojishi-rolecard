// v0.23 全书集成：v0.22（E647—E718, S88—S94, C1496—C1530, NPC18）+ v0.23（E719—E798, S95—S101, C1531—C1561, NPC7）
// 参考 tools/upgrade-v021-stage16.mjs；一次脚本完成两阶段接线。
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WS22 = resolve(ROOT, '../../角色卡设定/v0.22工作区');
const WS23 = resolve(ROOT, '../../角色卡设定/v0.23工作区');

// ---------------- 常量 ----------------
const PHASES_22 = {
  S88: { name: '无尽之海与时间尽头', start: 647, end: 654, line: '真理神王改换策略弃用法则行献祭，林恩诱敌入高塔时间尽头，孤岛坍塌抛出半数腐化神灵；左左拖行金茧穿越时间之外至长河自己被冰封；林恩在时间尽头听白发人陈述斩因果重铸过去真相，明悟长河推演与时间为梦境例外；冒神王现身屠杀残部，转赴深渊见折翼天使葬场后赶赴主宇宙。' },
  S89: { name: '因果囚笼与浴火苏醒', start: 655, end: 664, line: '林恩主宇宙防线全溃被因果封锁裁剪拉回起点；极尽罪火斩出塌陷被银色幻想救起守护数月；狱卒与黑夜城内战爆发，腐化者图穷匕见，林恩以黑剑穿胸之机苏醒尽斩内鬼；碧蓝塔前画家点破深渊真理非本尊托他赴神界寻锚点；他回归分发神格、拒绝当王。' },
  S90: { name: '画卷神格与空间维位', start: 665, end: 672, line: '林恩以画卷验证七大神王格空缺，第五格共鸣直指己身；他切开系统空间外壁入曲率乱流，悟空间真谛、抓取空间神格融合闭关；里世界之外半神潮涌、泰坦破咒、人偶家与康斯坦丁互约同生共死；画家交付艾维儿龙蛋与混乱色彩；林恩升入第四层俯瞰主宇宙，潜入龙卫庇护所，艾维儿孵化称爹。' },
  S91: { name: '因果化身与轮回见证', start: 673, end: 681, line: '林恩闯命运神国，与速度之神神音、静谧之神默默同行；焚净遗民区、斩因果化身；银色太阳引入时间之外自称时间神王，展示轮回神王每世在林地等植灵苗苗长大；带林恩追溯末日后大君以永眠换他解脱的真相；交易达成——时间神王承诺助他找到时间神格。' },
  S92: { name: '行宫潜渡与真理两清', start: 682, end: 691, line: '林恩剥离炼化另一林地世界跃迁艾维儿行宫，潜入无序引擎兵工厂；与被剥离出的真理理性碎片交易，见神尸之路与七十二柱、白骨破柱；第四层监狱发现被倒刺贯穿的织梦；兽王吞毁灭神格被林恩斩；补全真理亲身现身抛还龙心讲两不相欠，林恩以龙心光束打开神界核心之门。' },
  S93: { name: '神王界牢笼与时间战争', start: 692, end: 703, line: '林恩入神王界遭镜魇追杀，神疆借渡鸦灵魂光点降临斩镜；吞噬初诞者至高神格十分钟空档内画家握断因果律一人成军；终焉之柱撞碎梦境最后一秒林恩扛柱归来斩魇王兽王、灌注本源切断灾厄注视；画家承认失败无数次，魇魔真身在时间终末；林恩回地狱备战，银幻说一起还。' },
  S94: { name: '神位传承与主君归来', start: 704, end: 718, line: '林恩设创造神格禁制、托付织梦、赴天堂遗址闭关吞以太；新神接续登位，林蒙揭示梦魇要铲除他因他是大君人性最后锚点；叛乱毁时间泡、船长接毁灭格；轮回切磋悟梦境映照；银幻携机械狂潮归来，灾厄全面复苏，神疆献祭推她与船长为一念神王；银幻断链引四魇入笼，林恩斩红魔崩魇王、钉稳神疆。' },
};
const PHASES_23 = {
  S95: { name: '灾厄边境与罪恶王座', start: 719, end: 731, line: '林恩常态罪火镇压三魇、沿灾厄边境寻画家再会；历史梦魇层层推进，秩序裂隙中突围至最黑暗拓路；时间太阳指引寻左左冷冻，织梦苏醒、源头腐蚀初现，送葬黑雨中艾雯爵士接过罪恶王座的启用。' },
  S96: { name: '信仰帝国与终焉苏醒', start: 732, end: 744, line: '王座启用、代价说明、骗子职责转为登临——艾雯与羽毛笔共构信仰帝国，完美世界叙事铺开；一点黑火沿信仰网络扩散，三十魇魔合击信仰殿被逐一锁定信仰本源，未来希望代价先行付出。' },
  S97: { name: '最终黑暗与黑夜城沦陷', start: 745, end: 759, line: '小小立碑、七十一柱总攻、艾雯垂首揭露真相；因果网络全面燃烧、最后信仰之城告破，林恩最终黑暗下三区狙杀五十九魇；小小在自己怀中消散，林恩于失控黑火中完成第三阶段最终一跃、获唯一生还者路。' },
  S98: { name: '唯一生还者与时间战争', start: 760, end: 771, line: '轮回神王出手挡潮、燃烧自身因果送传承；空白实体于时间之外现身射向过去渡鸦，羽毛笔赴时间外找到左左完成最后梦境传递；林恩进入时间战争后的最后宣战序幕，苍白灾难内幕浮上水面。' },
  S99: { name: '渡鸦过去与历史因果', start: 772, end: 782, line: '远古渡鸦群体带着部分同伴逃亡、帝国大清洗军队推进；回到那一切开始的地方，永恒寒冬中空白众生的远古战争渐次曝光，林恩与左左从时间桥回望自己分离的影子，因果闭环被白发身影亲手接上。' },
  S100: { name: '梦主真相与悖论终战', start: 783, end: 793, line: '千年时间桥织梦凡人共情，三位一体之主证实灵能路径即梦主本体；沈眠少女醒来，时间王背叛者现形；原初身体迎战、悖论终战启幕，已死的盟友在最后一役全部回归。' },
  S101: { name: '终焉决战与不是再见', start: 794, end: 798, line: '终焉核心与原初身体正面撕裂、历史之火焚尽终焉与原初；大君清醒中承认错误并回归终焉，大君与奈奈子共同燃烧完成旧日告别；左左追到废墟没有放弃，雪谷婚礼上升起——不是再见的再见，本书完。' },
};
const PHASES = { ...PHASES_22, ...PHASES_23 };

// v0.21 实卡 E594–E646 已占用 1293–1345（E593=1292），故新事件 UID 从 1346 起连续分配：
// E647–E718 → 1346–1417；E719–E798 → 1418–1497（原任务参数 1293/1365 与实卡冲突，按实卡顺延）。
const EVENT_UID_START_22 = 1346;   // E647..E718 → 1346..1417
const EVENT_UID_START_23 = 1418;   // E719..E798 → 1418..1497
const CONCEPT_UID_START = 2781;    // 紧接 v0.21 最后概念 UID 2780
const NPC_UID_START = 342;         // 紧接 v0.21 血枢 341
const PREV_TERMINAL_UID = 1345;    // E646 世界书 UID

const EV22 = { start: 647, end: 718 };
const EV23 = { start: 719, end: 798 };
const EVENT_END = 798;
const IDS22 = Array.from({ length: EV22.end - EV22.start + 1 }, (_, i) => `E${EV22.start + i}`);
const IDS23 = Array.from({ length: EV23.end - EV23.start + 1 }, (_, i) => `E${EV23.start + i}`);
const ALL_NEW_IDS = [...IDS22, ...IDS23];

// 新NPC（顺序对应 UID 342..366）：v0.22 十八名 + v0.23 七名
const NEW_NPCS = [
  { name: '折翼天使', ws: 22, extra_keys: ['弑利叶护卫', '空间中枢葬场'] },
  { name: '兽王', ws: 22, extra_keys: ['兽王投影', '毁灭神格吞噬者'] },
  { name: '夜色囚徒（被刺瞎的老狱卒）', ws: 22, extra_keys: ['老狱卒', '夜色囚徒'] },
  { name: '工匠之神', ws: 22, extra_keys: ['旧神工匠'] },
  { name: '智慧女神', ws: 22, extra_keys: ['旧神智慧'] },
  { name: '火神', ws: 22, extra_keys: ['旧神火焰'] },
  { name: '知识之神', ws: 22, extra_keys: ['旧神知识'] },
  { name: '神音', ws: 22, extra_keys: ['速度之神'] },
  { name: '纽卫队老者', ws: 22, extra_keys: ['纽卫队', '命运遗民'] },
  { name: '苗苗', ws: 22, extra_keys: ['林地苗苗', '植灵'] },
  { name: '衰败之神', ws: 22, extra_keys: ['旧神衰败'] },
  { name: '默默', ws: 22, extra_keys: ['静谧之神'] },
  { name: '龙卫澜', ws: 22, extra_keys: ['龙卫', '龙卫庇护所'] },
  { name: '人脸蛇身魇魔', ws: 22, extra_keys: ['人首蛇身魇', '四魇之一'] },
  { name: '王骑', ws: 22, extra_keys: ['王庭骑士'] },
  { name: '紫荆花重铠女子', ws: 22, extra_keys: ['紫荆花骑士'] },
  { name: '红魔', ws: 22, extra_keys: ['四魇红魔'] },
  { name: '镜魔', ws: 22, extra_keys: ['镜面之魇', '镜魇'] },
  { name: '时间太阳', ws: 23, extra_keys: ['时间神王', '银色太阳'] },
  { name: '罪恶王座', ws: 23, extra_keys: ['王座', '信仰之王'] },
  { name: '船长', ws: 23, extra_keys: ['毁灭神格持有者', '墓船船长'] },
  { name: '空白实体', ws: 23, extra_keys: ['空白之柱', '无色实体'] },
  { name: '轮回神王', ws: 23, extra_keys: ['地球灵魂', '唯一一代轮回之神'] },
  { name: '三位一体之主', ws: 23, extra_keys: ['梦主', '永恒世界'] },
  { name: '时间王', ws: 23, extra_keys: ['时间背叛者'] },
];

// 工作区人物增量名 → 卡内角色目标文件
const CHAR_TARGET = {
  a01银色幻想: 'src/characters/a01银色幻想/多阶段人设.md',
  万机之神: 'src/characters/万机之神/多阶段人设.md',
  人偶家: 'src/characters/人偶家/多阶段人设.md',
  以太: 'src/characters/以太/NPC.md',
  入梦者: 'src/characters/入梦者/NPC.md',
  奈奈子: 'src/characters/真理神王/NPC.md',   // 未来画家=奈奈子=画家=真理残魂…→真理神王
  小小: 'src/characters/小小/多阶段人设.md',
  左左: 'src/characters/左左/多阶段人设.md',
  巫神头颅: 'src/characters/巫神头颅/多阶段人设.md',
  未来画家: 'src/characters/真理神王/NPC.md',
  林蒙: 'src/characters/林蒙/NPC.md',
  欲望母树: 'src/characters/欲望母树/多阶段人设.md',
  泰坦头颅: 'src/characters/泰坦头颅/多阶段人设.md',
  白夜: 'src/characters/白夜/多阶段人设.md',
  真理神王: 'src/characters/真理神王/NPC.md',
  神王: 'src/characters/神王/NPC.md',
  紫罗兰大君: 'src/characters/紫罗兰大君/NPC.md',
  羽毛笔: 'src/characters/羽毛笔/多阶段人设.md',
  艾维儿: 'src/characters/艾维儿/NPC.md',
  艾雯爵士: 'src/characters/艾雯爵士/多阶段人设.md',
  黑白小丑: 'src/characters/黑白小丑/多阶段人设.md',
  哭泣小丑: 'src/characters/哭泣小丑/多阶段人设.md',
  倒吊天使: 'src/characters/倒吊天使/多阶段人设.md',
  伊甸娜: 'src/characters/伊甸娜/NPC.md',
  神皇: 'src/characters/神皇/NPC.md',
  艾泽法拉: 'src/characters/艾泽法拉/NPC.md',
  康斯坦丁: 'src/characters/康斯坦丁/NPC.md',
};
// 工作区人物增量名 → 世界书 [角色] 名（同一性映射）
function coreNameOf(name) {
  if (name === '未来画家' || name === '奈奈子') return '真理神王';
  if (name === '主母' || name === '自缚天使') return '倒吊天使';
  if (name === '织梦') return '入梦者';
  if (name === '巨像') return '巨像之脑';
  if (name === '母树') return '欲望母树';
  if (name === '仙月') return '人偶家';
  if (name === '泰坦') return '泰坦头颅';
  if (name === '女巫神') return '巫神头颅';
  if (name === '时间太阳') return '神王';
  return name;
}

// E646→E647 / E718→E719 衔接（两份工作区衔接表只含段内对；桥本身由本脚本补写）
const E646_TO_E647 = {
  trigger: 'E646已完成、变形、取消或活跃且收尾，E647尚未触发或处于预兆；林恩方在迷雾之海的猎杀已使追杀部队减员十几名神灵（含两位中位神），大部队多次扑空。',
  lead: '又一名腐化神灵在迷雾中被烧成焦尸，金色少年注视着那具尸体，掌心的真理法则丝线在这片海域烦躁地扭曲波动。',
  omen: '只写焦尸旁神灵们的止损议论、金色少年掌中法则的异常波动、远处边境探查的回报将至，不提前公开献祭决定与无序生灵。',
  causal: '迷雾猎杀已让搜捕部队转为被消耗的一方；林恩力量的位阶压制迫使对方改换策略，围绕「烧尽这片海」的应对即将展开。',
};
const E718_TO_E719 = {
  trigger: 'E718已完成、变形、取消或活跃且收尾，E719尚未触发或处于预兆；神疆已被三叉戟钉住、主宇宙金色网络重新链接，林恩已孤身走向无尽黑暗。',
  lead: '主宇宙核心附近的星区里，镜魔、兽王与人首蛇身魇三魇拦路，罪火与刀鞘的光在黑暗边疆亮起。',
  omen: '只写三魇拦路的压迫、林恩力量连续施展的稳定、艾维儿带伤汇合的身影，不提前公开林恩十余年成长的全貌与画家下落。',
  causal: '林恩已正式宣布归来并钉稳神疆，魇王的残余堵截是他离开主宇宙找画家前必须斩断的最后一战。',
};

// ---------------- 工具 ----------------
function readText(rel) {
  const full = /^([a-zA-Z]:|\/)/.test(rel) ? rel : resolve(ROOT, rel);
  return readFileSync(full, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
}
function writeText(rel, text) {
  const full = /^([a-zA-Z]:|\/)/.test(rel) ? rel : resolve(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}
function readJson(rel) { return JSON.parse(readText(rel)); }
function writeJson(rel, value) { writeText(rel, JSON.stringify(value, null, 2)); }
function relFrom(file) { return relative(ROOT, file).replaceAll('\\', '/'); }
function allFiles(dir) {
  const result = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, ent.name);
    if (ent.isDirectory()) result.push(...allFiles(full));
    else result.push(full);
  }
  return result;
}
function replaceOnce(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text && !pattern.test(text.slice())) throw new Error(`未找到接线位置：${label}`);
  return next;
}
const byEventNo = (a, b) => Number(a.slice(1)) - Number(b.slice(1));
function eventFileFor(id) {
  const dir = resolve(ROOT, 'src/events');
  const file = readdirSync(dir).find(name => name.startsWith(`${id}_`) && name.endsWith('.md'));
  if (!file) throw new Error(`缺少事件文件：${id}`);
  return `src/events/${file}`;
}
function titleFromEventFile(id) {
  const text = readText(eventFileFor(id));
  const match = text.match(new RegExp(`^# ${id}·([^\\n]+)$`, 'm'));
  if (!match) throw new Error(`事件标题缺失：${id}`);
  return match[1].trim();
}
function extractEventsFromText(text) {
  return [...new Set([...text.matchAll(/锚点状态\.(E\d+)/g)].map(m => m[1]))].sort(byEventNo);
}
function stableKeys(name, usedKeys, logicalId) {
  let key = name;
  if (usedKeys.has(key)) key = `${name}(${logicalId})`;
  while (usedKeys.has(key)) key = `${key}*`;
  usedKeys.add(key);
  return [key];
}
function parseConceptHeading(text) {
  const match = text.match(/^# 概念·([^·\r\n]+)·(.+?)（事件(\[[^\r\n]+\])）\s*$/m);
  if (!match) return null;
  let eventIds;
  try { eventIds = JSON.parse(match[3]); } catch { return null; }
  if (!Array.isArray(eventIds) || eventIds.length === 0) return null;
  return { category: match[1], name: match[2], eventIds, full: match[0] };
}
function ctxLineFromBridge(nextId, nextTitle, summaryText) {
  if (!nextId) return `${summaryText}（本书完）`;
  const short = summaryText.length > 60 ? `${summaryText.slice(0, 58)}…` : summaryText;
  return `${short} → ${nextId}${nextTitle}`;
}
function resolveConceptBase(item) {
  const files = allFiles(resolve(ROOT, 'src/concepts')).filter(f => {
    const name = f.split(/[/\\]/).pop();
    return name.startsWith(`${item.id}_`) && name.endsWith('.md');
  });
  if (!files[0]) throw new Error(`概念基线缺失：${item.id} ${item.output || ''}`);
  return relFrom(files[0]);
}

// ---------------- 输入 ----------------
const dlv22 = JSON.parse(readText(resolve(WS22, '交付清单.json')));
const dlv23 = JSON.parse(readText(resolve(WS23, '交付清单.json')));
const summaries22 = JSON.parse(readText(resolve(WS22, '摘要/事件摘要.json')));
const summaries23 = JSON.parse(readText(resolve(WS23, '摘要/事件摘要.json')));
const bridges22 = JSON.parse(readText(resolve(WS22, '摘要/衔接表.json')));
const bridges23 = JSON.parse(readText(resolve(WS23, '摘要/衔接表.json')));
const summaryMap = new Map([...summaries22, ...summaries23].map(s => [s.id, s]));

const conceptUpdates22 = dlv22.concepts.filter(c => c.kind === 'update');
const conceptNews22 = dlv22.concepts.filter(c => c.kind === 'new').map(c => ({ ...c, ws: WS22 }));
const conceptNews23 = dlv23.concepts.filter(c => c.kind === 'new').map(c => ({ ...c, ws: WS23 }));
const conceptNewsAll = [...conceptNews22, ...conceptNews23].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
const bridgePairsAll = [...bridges22.pairs, ...bridges23.pairs];  // E647→E648 … E717→E718, E719→E720 … E797→E798

// npc file records
const npcRecords = NEW_NPCS.map((npc, i) => ({
  ...npc,
  entry_id: NPC_UID_START + i,
  output: (dlv22.characters.find(c => c.name === npc.name) || dlv23.characters.find(c => c.name === npc.name))?.output,
}));

// ---------------- [1/12] 事件文件复制 + 阶段字段统一 ----------------
console.log('[1/12] 复制事件并统一阶段字段…');
for (const dlv of [dlv22, dlv23]) {
  const ws = dlv === dlv22 ? WS22 : WS23;
  for (const ev of dlv.events) {
    copyFileSync(resolve(ws, ev.output), resolve(ROOT, 'src/events', ev.output.split('/').pop()));
  }
}
for (const [phaseId, phase] of Object.entries(PHASES)) {
  for (let n = phase.start; n <= phase.end; n += 1) {
    const id = `E${n}`;
    const path = eventFileFor(id);
    let text = readText(path);
    if (text.includes(`- 阶段：${phaseId}·${phase.name}`)) continue;
    text = replaceOnce(text, /^- 阶段：[^\n]*$/m, `- 阶段：${phaseId}·${phase.name}`, `${id} 阶段字段`);
    writeText(path, text);
  }
}
const EVENT_TITLES = Object.fromEntries(ALL_NEW_IDS.map(id => [id, titleFromEventFile(id)]));
EVENT_TITLES.E646 = titleFromEventFile('E646');

// ---------------- [2/12] E646 / E718 终点点接 ----------------
console.log('[2/12] E646→E647 与 E718→E719 衔接…');
{
  const path = eventFileFor('E646');
  let text = readText(path);
  if (!text.includes('## 下一事件引入（E647·')) {
    const block = `\n## 下一事件引入（E647·${EVENT_TITLES.E647}）\n- 触发时机：${E646_TO_E647.trigger}\n- 剧情引子：${E646_TO_E647.lead}\n- 预兆写法：${E646_TO_E647.omen}\n- 承接因果：${E646_TO_E647.causal}\n`;
    text = replaceOnce(text, /\n<%_ \} _%>\s*$/, `${block}\n<%_ } _%>`, 'E646→E647 bridge');
    writeText(path, text);
  }
}
{
  const path = eventFileFor('E718');
  let text = readText(path);
  if (!text.includes('## 下一事件引入（E719·')) {
    const block = `\n## 下一事件引入（E719·${EVENT_TITLES.E719}）\n- 触发时机：${E718_TO_E719.trigger}\n- 剧情引子：${E718_TO_E719.lead}\n- 预兆写法：${E718_TO_E719.omen}\n- 承接因果：${E718_TO_E719.causal}\n`;
    text = replaceOnce(text, /\n<%_ \} _%>\s*$/, `${block}\n<%_ } _%>`, 'E718→E719 bridge');
    writeText(path, text);
  }
}

// ---------------- [3/12] 概念增量与新概念 ----------------
console.log('[3/12] 合并概念增量与新概念…');
for (const item of conceptUpdates22) {
  const baseRel = resolveConceptBase(item);
  let base = readText(baseRel);
  const incr = readText(resolve(WS22, item.output)).trim();
  const heading = parseConceptHeading(base);
  if (!heading) throw new Error(`无法解析概念标题：${baseRel}`);
  const incrEvents = extractEventsFromText(incr);
  const mergedEvents = [...new Set([...heading.eventIds, ...incrEvents])].sort(byEventNo);
  base = base.replace(heading.full, `# 概念·${heading.category}·${heading.name}（事件${JSON.stringify(mergedEvents)}）`);
  let appended = base.trimEnd();
  for (const block of incr.split(/(?=<%_ if )/g).map(s => s.trim()).filter(Boolean)) {
    const ev = block.match(/锚点状态\.(E\d+)/)?.[1];
    if (ev && new RegExp(`# ${item.id}·[^\\n]*·${ev}\\b`).test(appended)) continue;
    appended += `\n\n${block.trim()}\n`;
  }
  writeText(baseRel, appended);
}
for (const item of conceptNewsAll) {
  const incr = readText(resolve(item.ws, item.output)).trim();
  const events = item.source_events?.length ? item.source_events : extractEventsFromText(incr);
  const firstCat = incr.match(/- 类别：([^\n]+)/)?.[1]?.trim() || '机制';
  writeText(`src/concepts/${item.output.split('/').pop()}`, `# 概念·${firstCat}·${item.title}（事件${JSON.stringify(events)}）\n\n${incr}\n`);
}

// ---------------- [4/12] 人物增量 + 新NPC 文件 ----------------
console.log('[4/12] 合并人物增量与新NPC…');
const personaRecords = [];
const charEventAdds = new Map();
function addCharEvents(core, events) {
  const prev = charEventAdds.get(core) || [];
  charEventAdds.set(core, [...new Set([...prev, ...events])].sort(byEventNo));
}
function appendCharacterIncrement(targetRel, sourceAbs) {
  let target = existsSync(resolve(ROOT, targetRel)) ? readText(targetRel).trimEnd() : '';
  const source = readText(sourceAbs).trim();
  const blocks = source.split(/(?=<%_ if )/g).map(s => s.trim()).filter(Boolean);
  for (const block of blocks) {
    if (!block.match(/锚点状态\.(E\d+)/)) continue;
    if (!target.includes(block)) target += `\n\n${block}\n`;
  }
  writeText(targetRel, `${target}\n`);
}
for (const dlv of [dlv22, dlv23]) {
  const ws = dlv === dlv22 ? WS22 : WS23;
  const stage = dlv === dlv22 ? 'v0.22' : 'v0.23';
  for (const ch of dlv.characters) {
    const out = ch.output || '';
    if (!out.startsWith('人物增量/')) continue;
    const logicalName = ch.name.replace(/_[A-Z]$/, '');
    const target = CHAR_TARGET[logicalName];
    if (!target) throw new Error(`人物目标未映射：${ch.name} → ${logicalName}`);
    appendCharacterIncrement(target, resolve(ws, out));
    const events = extractEventsFromText(readText(resolve(ws, out)));
    addCharEvents(coreNameOf(logicalName), events);
    personaRecords.push({ source: `角色卡设定/${stage}工作区/${out}`, target, events, mode: 'source_sync', adapted_events: [] });
  }
}
for (const npc of npcRecords) {
  if (!npc.output) throw new Error(`新NPC交付条目缺失：${npc.name}`);
  const ws = npc.ws === 22 ? WS22 : WS23;
  const body = readText(resolve(ws, npc.output)).trim();
  writeText(`src/characters/${npc.name}/NPC.md`, `# ${npc.name}\n\n${body}\n`);
  const events = extractEventsFromText(body);
  addCharEvents(npc.name, events);
  personaRecords.push({
    source: `角色卡设定/v0.${npc.ws}工作区/${npc.output}`,
    target: `src/characters/${npc.name}/NPC.md`,
    events,
    mode: 'source_sync_new_npc',
    adapted_events: [],
  });
}

// ---------------- [5/12] schema/initvar/status ----------------
console.log('[5/12] schema / initvar / status…');
{
  let schema = readText('src/scripts/schema.js');
  schema = schema.replaceAll('诡异药剂师v0.21', '诡异药剂师v0.23')
    .replace("卡名: z.literal('《诡异药剂师》v0.21')", "卡名: z.literal('《诡异药剂师》v0.23')")
    .replace("版本: z.literal('0.21.0')", "版本: z.literal('0.23.0')");
  const newPhaseIds = Object.keys(PHASES).filter(id => !schema.includes(`${id}: '`));
  if (newPhaseIds.length) {
    const phaseLines = newPhaseIds.map(id => `  ${id}: '${PHASES[id].name}',`).join('\n');
    schema = replaceOnce(schema, /(  S87: '[^']*',\n)(\};)/, `$1${phaseLines}\n$2`, 'schema phaseNames');
  }
  if (!schema.includes("E647: '")) {
    const titleLines = ALL_NEW_IDS.map(id => `  ${id}: '${EVENT_TITLES[id]}',`).join('\n');
    schema = replaceOnce(schema, /(  E646: '[^']*',\n)(\};)/, `$1${titleLines}\n$2`, 'schema anchorTitles');
    const anchorLines = ALL_NEW_IDS.map(id => `      ${id}: anchor,`).join('\n');
    schema = replaceOnce(schema, /(      E646: anchor,\n)(    \}\),)/, `$1${anchorLines}\n$2`, 'schema anchor map');
  }
  writeText('src/scripts/schema.js', schema);
}
function appendAnchors(value) {
  value.元数据.卡名 = '《诡异药剂师》v0.23';
  value.元数据.版本 = '0.23.0';
  for (const id of ALL_NEW_IDS) value.事件.锚点状态[id] = { 标题: EVENT_TITLES[id], 状态: '未触发', 收尾: false };
  return value;
}
const initial = appendAnchors(readJson('src/initial_variables.json'));
const alternate = appendAnchors(readJson('src/initial_variables_e25.json'));
writeJson('src/initial_variables.json', initial);
writeJson('src/initial_variables_e25.json', alternate);
{
  const first = readText('src/prompts/first_message.md');
  writeText('src/prompts/first_message.md', replaceOnce(first, /<initvar>\s*[\s\S]*?\s*<\/initvar>/, `<initvar>\n${JSON.stringify(initial, null, 2)}\n</initvar>`, 'first_message initvar'));
  const alt = readText('src/prompts/alternate_greeting_e25.md');
  writeText('src/prompts/alternate_greeting_e25.md', replaceOnce(alt, /<initvar>\s*[\s\S]*?\s*<\/initvar>/, `<initvar>\n${JSON.stringify(alternate, null, 2)}\n</initvar>`, 'alternate greeting initvar'));
}
{
  let status = readText('src/ui/status.html');
  status = status.replaceAll('《诡异药剂师》v0.21', '《诡异药剂师》v0.23')
    .replace(/\(646 锚点闭环\)/g, '(798 锚点闭环)')
    .replace('Array.from({ length: 646 }', 'Array.from({ length: 798 }');
  status = replaceOnce(status, /const FALLBACK_STATE = \{[\s\S]*?\};\s*let mvuAvailable/, `const FALLBACK_STATE = ${JSON.stringify(initial)};\n      let mvuAvailable`, 'status FALLBACK_STATE');
  if (!status.includes("from: 'E646', to: 'E647'")) {
    const pairs = [];
    for (let n = 646; n < EVENT_END; n += 1) pairs.push(`        { from: 'E${n}', to: 'E${n + 1}', label: '结算并承接 E${n + 1}' },`);
    status = replaceOnce(status, /(        \{ from: 'E645', to: 'E646', label: '结算并承接 E646' \},)/, `$1\n${pairs.join('\n')}`, 'status bridge pairs');
  }
  writeText('src/ui/status.html', status);
}

// ---------------- [6/12] 世界书 ----------------
console.log('[6/12] 世界书事件/概念/NPC…');
{
  const book = readJson('src/worldbook.json');
  book.name = '《诡异药剂师》v0.23';
  book.description = '《诡异药剂师》v0.23 动态世界书（覆盖S0至S101、二十八名核心人物、六十六名可选NPC、七百九十八事件锚点与全量概念）';
  book.extensions = {
    ...(book.extensions ?? {}),
    tavernweave: { ...(book.extensions?.tavernweave ?? {}), id: 'weird-apothecary-worldbook', version: '0.23.0' },
  };

  const lastInsertion = Math.max(...book.entries.filter(e => /\[事件\]/.test(e.comment || '')).map(e => e.insertion_order || 0));
  const newEventEntries = ALL_NEW_IDS.map((id, index) => {
    const n = Number(id.slice(1));
    const worker = n <= EV22.end ? EVENT_UID_START_22 + (n - EV22.start) : EVENT_UID_START_23 + (n - EV23.start);
    return {
      id: worker,
      comment: `[事件]${id}·${EVENT_TITLES[id]}`,
      keys: [id],
      enabled: false,
      constant: false,
      insertion_order: lastInsertion + 1 + index,
      content_file: eventFileFor(id),
      extensions: { exclude_recursion: true, prevent_recursion: true },
    };
  });
  const newEventIdSet = new Set(newEventEntries.map(e => e.id));
  book.entries = book.entries.filter(e => !newEventIdSet.has(e.id));
  const prevIdx = book.entries.findIndex(e => e.id === PREV_TERMINAL_UID);
  if (prevIdx < 0) throw new Error('未找到 E646 UID1345');
  book.entries.splice(prevIdx + 1, 0, ...newEventEntries);

  const usedKeys = new Set(book.entries.flatMap(e => e.keys ?? []));
  const newConceptEntries = [];
  for (const [index, item] of conceptNewsAll.entries()) {
    const logicalId = item.id;
    const uid = CONCEPT_UID_START + index;
    const file = allFiles(resolve(ROOT, 'src/concepts')).find(f => {
      const name = f.split(/[/\\]/).pop();
      return name.startsWith(`${logicalId}_`) && name.endsWith('.md');
    });
    if (!file) throw new Error(`新概念文件缺失：${logicalId}`);
    const contentFile = relFrom(file);
    const parsed = parseConceptHeading(readText(contentFile));
    if (!parsed) throw new Error(`新概念标题无法解析：${logicalId}`);
    newConceptEntries.push({
      id: uid,
      comment: `[概念·${parsed.category}]${parsed.name}`,
      keys: stableKeys(parsed.name, usedKeys, logicalId),
      constant: false,
      insertion_order: uid - 1760,
      content_file: contentFile,
      extensions: {
        exclude_recursion: true,
        prevent_recursion: true,
        tavernweave: { logical_id: logicalId, event_ids: parsed.eventIds },
      },
      secondary_keys: [],
    });
  }
  const newConceptIdSet = new Set(newConceptEntries.map(e => e.id));
  book.entries = book.entries.filter(e => !newConceptIdSet.has(e.id));
  book.entries.push(...newConceptEntries);

  // 概念增量（8 条 update 均来自 v0.22）
  for (const entry of book.entries) {
    const fileId = entry.content_file?.split(/[/\\]/).pop().match(/^(C\d+)_/)?.[1];
    const logicalId = entry.extensions?.tavernweave?.logical_id ?? fileId;
    if (!logicalId || !entry.content_file || !conceptUpdates22.some(c => c.id === logicalId)) continue;
    const parsed = parseConceptHeading(readText(entry.content_file));
    if (!parsed) continue;
    entry.comment = `[概念·${parsed.category}]${parsed.name}`;
    entry.extensions.tavernweave.event_ids = parsed.eventIds;
  }

  // 新 NPC
  for (const npc of npcRecords) {
    const content = readText(`src/characters/${npc.name}/NPC.md`);
    const keys = [npc.name, ...(npc.extra_keys || [])].filter((k, i, arr) => arr.indexOf(k) === i);
    const entry = {
      id: npc.entry_id,
      comment: `[角色]${npc.name}`,
      keys,
      constant: false,
      insertion_order: npc.entry_id,
      content_files: [`src/characters/${npc.name}/NPC.md`],
      extensions: {
        exclude_recursion: true,
        prevent_recursion: true,
        tavernweave: { event_ids: extractEventsFromText(content), route_kind: 'optional_npc', profile_format: 'compact_npc' },
      },
      secondary_keys: [],
    };
    book.entries = book.entries.filter(e => e.id !== npc.entry_id);
    const after = book.entries.findIndex(e => e.id === npc.entry_id - 1);
    book.entries.splice(after < 0 ? book.entries.length : after + 1, 0, entry);
  }

  // 人物增量事件回填
  for (const entry of book.entries) {
    if (!entry.comment?.startsWith('[角色]')) continue;
    const added = charEventAdds.get(entry.comment.slice(4));
    if (!added?.length) continue;
    const prev = entry.extensions?.tavernweave?.event_ids ?? [];
    entry.extensions = {
      ...(entry.extensions ?? {}),
      exclude_recursion: true,
      prevent_recursion: true,
      tavernweave: {
        ...(entry.extensions?.tavernweave ?? {}),
        event_ids: [...new Set([...prev, ...added])].sort(byEventNo),
      },
    };
  }
  writeJson('src/worldbook.json', book);
  globalThis.__WB_COUNT__ = book.entries.length;
}

// ---------------- [7/12] contract/router/prompts ----------------
console.log('[7/12] contract / router / prompts…');
{
  const contract = readJson('contract.json');
  const allEventIds = Array.from({ length: EVENT_END }, (_, i) => `E${String(i + 1).padStart(2, '0')}`);
  contract.version = '0.23.0';
  contract.required.stage_scope = 'E01至E798；本版新增E647至E798，S88至S101，E798为全书封箱终点。';
  contract.required.event_ids = allEventIds;
  contract.required.event_titles = { ...contract.required.event_titles, ...EVENT_TITLES };
  contract.required.stage_ranges = {
    ...contract.required.stage_ranges,
    ...Object.fromEntries(Object.entries(PHASES).map(([id, phase]) => [
      id,
      Array.from({ length: phase.end - phase.start + 1 }, (_, i) => `E${phase.start + i}`),
    ])),
  };
  contract.required.event_context_windows.material_entry_end = EVENT_UID_START_23 + IDS23.length - 1;
  contract.required.worldbook_version = '0.23.0';
  const wbCount = globalThis.__WB_COUNT__;
  contract.required.worldbook_entry_count = wbCount;
  contract.worldbook_entry_count = wbCount;
  contract.required.terminal_hook_event = 'E798';
  contract.required.terminal_hook_note = 'E798为S101（终焉决战与不是再见）封箱终点：左左与林恩雪谷相拥、烟火升起、原文「本书完」；全书到此收束，不再创建E799。';
  contract.stage_scope = contract.required.stage_scope;
  contract.acceptance = {
    ...contract.acceptance,
    event_anchors: EVENT_END,
    stage_scope: 'S0至S101；E01至E798',
    terminal_hook_event: 'E798',
    bridge_pairs_count: EVENT_END - 1,
    source_boundary: '原著全书止于第2709章（E798封口「本书完」）；不得虚构第2710章及以后',
  };

  contract.required.character_event_ids = contract.required.character_event_ids ?? {};
  contract.required.optional_characters = contract.required.optional_characters ?? {};
  for (const [name, events] of charEventAdds) {
    if (contract.required.core_characters.includes(name)) {
      contract.required.character_event_ids[name] = [...new Set([
        ...(contract.required.character_event_ids[name] ?? []),
        ...events,
      ])].sort(byEventNo);
    }
    if (contract.required.optional_characters[name] && !npcRecords.some(n => n.name === name)) {
      contract.required.optional_characters[name].event_ids = [...new Set([
        ...(contract.required.optional_characters[name].event_ids ?? []),
        ...events,
      ])].sort(byEventNo);
    }
  }
  for (const npc of npcRecords) {
    contract.required.optional_characters[npc.name] = {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(readText(`src/characters/${npc.name}/NPC.md`)),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: `v0.${npc.ws}新增NPC；按事件及关键词激活，具备生境六组件。`,
      profile_format: 'compact_npc',
    };
  }
  contract.required.character_activation = {
    ...(contract.required.character_activation ?? {}),
    character_count: 28,
    optional_character_count: Object.keys(contract.required.optional_characters).length,
  };
  contract.required.concept_activation = {
    ...contract.required.concept_activation,
    stage17_concept_count: conceptNews22.length,
    stage18_concept_count: conceptNews23.length,
    stage17_concept_ranges: [{
      logical_start: conceptNews22.map(c => c.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[0],
      logical_end: conceptNews22.map(c => c.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[conceptNews22.length - 1],
      count: conceptNews22.length,
    }],
    stage18_concept_ranges: [{
      logical_start: conceptNews23.map(c => c.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[0],
      logical_end: conceptNews23.map(c => c.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[conceptNews23.length - 1],
      count: conceptNews23.length,
    }],
    stage17_note: `v0.22新增阶段十七概念${conceptNews22[0].id}-${conceptNews22[conceptNews22.length - 1].id}共${conceptNews22.length}条；另原位增量更新${conceptUpdates22.length}份既有概念。`,
    stage18_note: `v0.23新增阶段十八概念${conceptNews23[0].id}-${conceptNews23[conceptNews23.length - 1].id}共${conceptNews23.length}条、无update。`,
    full_concept_uid_start: CONCEPT_UID_START,
    full_concept_uid_end: CONCEPT_UID_START + conceptNewsAll.length - 1,
    full_new_concept_count: conceptNewsAll.length,
  };
  writeJson('contract.json', contract);

  let router = readText('src/prompts/concept_event_router.md');
  router = replaceOnce(router, /const eventSequence = \[[^\]]+\];/, `const eventSequence = [${allEventIds.map(id => `"${id}"`).join(',')}];`, 'router eventSequence');
  const mapLines = contract.required.core_characters.map(name =>
    `    [${contract.required.character_entry_ids[name]},${JSON.stringify(contract.required.character_event_ids[name] ?? [])}],`).join('\n');
  router = replaceOnce(
    router,
    /  \/\/ CHARACTER_EVENT_FALLBACK_START[\s\S]*?  \/\/ CHARACTER_EVENT_FALLBACK_END/,
    `  // CHARACTER_EVENT_FALLBACK_START\n  const characterEventFallback = new Map([\n${mapLines}\n  ]);\n  // CHARACTER_EVENT_FALLBACK_END`,
    'router character fallback',
  );
  writeText('src/prompts/concept_event_router.md', router);

  for (const p of ['src/prompts/system.md', 'src/prompts/world.md', 'src/prompts/card_description.md', 'src/prompts/mvu_update_rules.md']) {
    let t = readText(p);
    t = t.replaceAll('《诡异药剂师》v0.21', '《诡异药剂师》v0.23')
      .replaceAll('E01至E646', 'E01至E798')
      .replaceAll('E01-E646', 'E01-E798')
      .replaceAll('六百四十六个', '七百九十八个')
      .replaceAll('六百四十六', '七百九十八')
      .replaceAll('三百四十八个重大事件锚点', '七百九十八个事件锚点');
    t = t.replace(/E646是当前开放终点：[^\n]*/g, 'E798是全书封箱终点：终焉融合后林恩回返、左左于雪谷婚礼烟火中重聚，原文「本书完」，不创建E799或引出后续。');
    t = t.replace(/E646是本版开放终点[^\n]*/g, 'E798是全书封箱终点：终焉融合后林恩回返、左左于雪谷婚礼烟火中重聚，原文「本书完」，不创建E799或引出后续内容。');
    writeText(p, t);
  }
  writeText('src/scripts/mvu_loader.js', readText('src/scripts/mvu_loader.js').replaceAll('诡异药剂师v0.21', '诡异药剂师v0.23'));

  const helpers = readJson('src/tavern_helper_scripts.json');
  for (const script of helpers) {
    if (typeof script.name === 'string') script.name = script.name.replaceAll('v0.21', 'v0.23');
    if (typeof script.id === 'string') script.id = script.id.replaceAll('v0.21', 'v0.23');
    if (typeof script.info === 'string') {
      script.info = script.info.replaceAll('v0.21', 'v0.23').replaceAll('六百四十六', '七百九十八')
        .replaceAll('E01-E646', 'E01-E798').replaceAll('S0-S87', 'S0-S101');
    }
  }
  writeJson('src/tavern_helper_scripts.json', helpers);
  writeText('src/regex_scripts.json', readText('src/regex_scripts.json').replaceAll('v0.21', 'v0.23'));
}

// ---------------- [8/12] mainline ----------------
console.log('[8/12] mainline（追加E647—E798并改写E646终点）…');
{
  let text = readText('src/prompts/mainline.md');
  text = text.replace('## 八十八个宽阶段', '## 一百零一个宽阶段')
    .replace('六百四十六个事件锚点依次记录为E01至E646', '七百九十八个事件锚点依次记录为E01至E798');
  text = text.replace(/10\. E646是当前开放终点：[^\n]+/, '10. E798是全书封箱终点：终焉融合后林恩回返、左左于雪谷婚礼烟火中重聚，原文「本书完」，不创建E799或引出后续。');
  if (!text.includes('- S88·')) {
    const lines = Object.entries(PHASES).map(([id, v]) => `- ${id}·${v.name}：${v.line}`).join('\n');
    text = replaceOnce(text, /(- S87·[^\n]+\n)/, `$1${lines}\n`, 'mainline stage list S87');
  }
  text = replaceOnce(
    text,
    /\{ id: 'E646', title: '迷雾海猎杀', line: '[^']+' \},/,
    `{ id: 'E646', title: '迷雾海猎杀', line: '林恩方于迷雾之海循环猎杀：钉杀、剥离神格、磨灭尸躯、折返双杀，减员十几含两中位神、大部队扑空；神格入袋。 → E647真理神王改换策略' },`,
    'mainline E646 ctx',
  );
  const needCtx = ALL_NEW_IDS.filter(id => !text.includes(`{ id: '${id}'`));
  if (needCtx.length) {
    const ctxObjects = needCtx.map(id => {
      const n = Number(id.slice(1));
      const next = n < EVENT_END ? `E${n + 1}` : null;
      const sum = summaryMap.get(id)?.text || EVENT_TITLES[id];
      const line = ctxLineFromBridge(next, next ? EVENT_TITLES[next] : '', sum).replaceAll("\\'", '’').replaceAll("'", "\\'");
      return `  { id: '${id}', title: '${EVENT_TITLES[id].replaceAll("'", "\\'")}', line: '${line}' },`;
    }).join('\n');
    text = replaceOnce(text, /(  \{ id: 'E646',[^\n]+\n)\];/, `$1${ctxObjects}\n];`, 'mainline ctx tail');
  }
  const bridges = [];
  const fieldsFor = (from) => {
    if (from === 'E646') return E646_TO_E647;
    if (from === 'E718') return E718_TO_E719;
    const pair = bridgePairsAll.find(p => p.from === from);
    if (!pair) throw new Error(`衔接字段缺失：${from}→`);
    return { trigger: pair.trigger, lead: pair.lead, omen: pair.omen, causal: pair.causal };
  };
  for (let n = 646; n < EVENT_END; n += 1) {
    const from = `E${n}`;
    const to = `E${n + 1}`;
    if (text.includes(`### ${from}→${to}`)) continue;
    const fields = fieldsFor(from);
    if (![fields.trigger, fields.lead, fields.omen, fields.causal].every(Boolean)) throw new Error(`衔接字段不全：${from}→${to}`);
    const fromTitle = EVENT_TITLES[from] || titleFromEventFile(from);
    const toTitle = EVENT_TITLES[to] || titleFromEventFile(to);
    const varTag = n <= 718 ? `v22b${n}` : `v23b${n}`;
    bridges.push(`<%_ const ${varTag}FromState = getvar("stat_data.事件.锚点状态.${from}.状态", { defaults: "未触发" }); const ${varTag}FromEnd = getvar("stat_data.事件.锚点状态.${from}.收尾", { defaults: false }); const ${varTag}ToState = getvar("stat_data.事件.锚点状态.${to}.状态", { defaults: "未触发" }); if ((${varTag}FromState === "完成" || ${varTag}FromState === "变形" || (${varTag}FromState === "活跃" && ${varTag}FromEnd === true)) && (${varTag}ToState === "未触发" || ${varTag}ToState === "预兆")) { _%>\n### ${from}→${to} · ${fromTitle} → ${toTitle}\n- 触发时机：${fields.trigger}\n- 剧情引子：${fields.lead}\n- 预兆写法：${fields.omen}\n- 承接因果：${fields.causal}\n- 取消态守卫：若${from}为取消，先核对${to}必要因果与替代入口；状态栏不得自动推进。\n<%_ } _%>`);
  }
  if (bridges.length) {
    const finalClose = text.lastIndexOf('\n<%_ } _%>');
    if (finalClose < 0) throw new Error('mainline 末尾闭合标记缺失');
    text = `${text.slice(0, finalClose)}\n\n${bridges.join('\n\n')}${text.slice(finalClose)}`;
  }
  writeText('src/prompts/mainline.md', text);
}

// ---------------- [9/12] card/manifest/profile/host/docs/validators ----------------
console.log('[9/12] card/manifest/profile/host_acceptance/文档/校验器…');
{
  const card = readJson('src/card.json');
  card.name = '《诡异药剂师》v0.23';
  card.character_version = '0.23.0';
  card.creator_notes = 'v0.23 内部候选版。由 v0.21 克隆并一次性合入 v0.22（E647-E718，S88-S94）与 v0.23（E719-E798，S95-S101），全书共 798 个事件锚点、1561 条概念、核心人物增量与 66 名可选 NPC。E798 为全书封箱终点（终焉与秩序融合、雪谷婚礼「本书完」）；玩家始终掌握林恩的对白、行动、判断、记忆、内心与关系选择。需要 SillyTavern 1.17.0 与酒馆助手 4.9.1；真实宿主验收待执行。v1.0 以前不公开发布。';
  writeJson('src/card.json', card);

  const manifest = readJson('manifest.json');
  manifest.id = 'tavernweave.weird-apothecary.v0.23';
  manifest.version = '0.23.0';
  if (manifest.worldbook) manifest.worldbook.version = '0.23.0';
  manifest.packed_json = 'dist/诡异药剂师_v0.23.json';
  if (manifest.card) manifest.card.display_name = '《诡异药剂师》v0.23';
  if (Array.isArray(manifest.deliverables)) manifest.deliverables = ['dist/诡异药剂师_v0.23.json'];
  for (const dep of manifest.runtime_dependencies ?? []) {
    if (dep.id === 'mvu-loader') dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-loader-v0.23]';
    if (dep.id === 'mvu-zod-schema') {
      dep.role = '验证 v0.23 状态结构';
      dep.evidence = '/data/extensions/tavern_helper/scripts[id=tavernweave-mvu-schema-v0.23]';
    }
  }
  writeJson('manifest.json', manifest);

  const profile = readJson('profile.json');
  profile.id = 'tavernweave.weird-apothecary.v0.23';
  profile.version = '0.23.0';
  profile.display_name = '《诡异药剂师》v0.23';
  writeJson('profile.json', profile);

  const host = readJson('host_acceptance.json');
  const previousSha = host.sha256;
  host.version = '0.23.0';
  host.status = 'pending';
  host.artifact = 'dist/诡异药剂师_v0.23.json';
  host.bytes = null;
  host.sha256 = null;
  host.previous_artifact_sha256 = previousSha;
  host.last_runtime_sha256 = null;
  host.accepted_at = null;
  host.evidence = null;
  host.offline_checks = {
    ...(host.offline_checks ?? {}),
    status: 'pending',
    checks: null,
    command: 'npm run check',
    worldbook_entries: globalThis.__WB_COUNT__,
    event_anchors: EVENT_END,
  };
  const npcTotal = Object.keys(readJson('contract.json').required.optional_characters).length;
  host.notes = `v0.23 全书集成：v0.22（E647-E718、${conceptUpdates22.length + conceptNews22.length}概念、22人物增量、18新NPC）+ v0.23（E719-E798、${conceptNews23.length}概念、21人物增量、7新NPC）；可选NPC共${npcTotal}名；真实宿主验收仍pending。`;
  writeJson('host_acceptance.json', host);

  writeText('SCAFFOLD.md', `# v0.23 工程壳

- 建立时间：2026-09-30
- 基线：\`诡异药剂师_MVU_v0.21\`（克隆；v0.20 冻结只读）
- 状态：已集成 E647—E798（S88—S101、v0.22+v0.23 两阶段）；版本 0.23.0
- 设定来源：\`角色卡设定/v0.22工作区\`、\`角色卡设定/v0.23工作区\`
- 校验：\`npm run check\`（build + validate + validate-integration）
- 产物：\`dist/诡异药剂师_v0.23.json\`；host_acceptance 保持 pending
`);

  writeText('README.md', `# 《诡异药剂师》MVU v0.23

当前维护版本：0.23.0。包含 E01—E798 共 798 个事件锚点、S0—S101、世界书词条见 contract，28 名核心关系人物保持不变，66 名可选 NPC。E798 为全书封箱终点（终焉融合、雪谷婚礼、「本书完」）。

## 本版集成

- v0.22（阶段十七）：E647—E718 共 72 事件、S88—S94；${conceptNews22.length} 新增概念 ${conceptNews22[0].id}—${conceptNews22[conceptNews22.length - 1].id} + ${conceptUpdates22.length} 概念增量；22 人物增量、18 新 NPC（UID ${NPC_UID_START}—${NPC_UID_START + 17}）。
- v0.23（阶段十八）：E719—E798 共 80 事件、S95—S101；${conceptNews23.length} 新增概念 ${conceptNews23[0].id}—${conceptNews23[conceptNews23.length - 1].id}；21 人物增量、7 新 NPC（UID ${NPC_UID_START + 18}—${NPC_UID_START + 24}）。
- 事件素材世界书 UID ${EVENT_UID_START_22}—${EVENT_UID_START_23 + IDS23.length - 1}；概念 UID ${CONCEPT_UID_START}—${CONCEPT_UID_START + conceptNewsAll.length - 1}。
- E798 封箱（「本书完」），不创建 E799；真实幼年角色严格非性，成年存在按成年口径直写；玩家主权不变。
- 真机实测暂缓，host_acceptance 保持 pending。

## 构建与校验

在本目录运行 \`npm run check\`。生成物为 \`dist/诡异药剂师_v0.23.json\`，禁止直接修改。
`);

  writeText('AGENTS.md', `# 《诡异药剂师》MVU v0.23 接手指南

更新：2026-09-30。本目录为当前维护工程 0.23.0，剧情止于 E798（全书封箱「本书完」）；先读根目录版本与工作区索引及本目录 README.md。

## 权威与写入范围

用户当前要求 → 创作规划.yaml → contract.json → manifest.json → profile.json → src → dist。
保留v0.20/v0.21及更早版本，不将历史报告改写为当前事实。dist只通过工程构建生成。
玩家独占林恩的对白、主动行动、决定、判断、记忆与内心；默认走向是可改变的事件因果。

## 当前覆盖

- 在 v0.21 克隆上一次性集成 v0.22（E647—E718、S88—S94）与 v0.23（E719—E798、S95—S101）；总锚点 E01—E798。
- 全卡 798 事件、世界书条目见 contract、28 名核心关系人物，66 名可选 NPC。
- 本轮概念：v0.22 ${conceptUpdates22.length} 既有增量 + ${conceptNews22.length} 新增 ${conceptNews22[0].id}—${conceptNews22[conceptNews22.length - 1].id}；v0.23 ${conceptNews23.length} 新增 ${conceptNews23[0].id}—${conceptNews23[conceptNews23.length - 1].id}；新概念运行 UID ${CONCEPT_UID_START}—${CONCEPT_UID_START + conceptNewsAll.length - 1}。
- 事件素材 UID ${EVENT_UID_START_22}—${EVENT_UID_START_23 + IDS23.length - 1}；新 NPC UID ${NPC_UID_START}—${NPC_UID_START + 24}。
- E798 为全书封箱终点（「本书完」），不创建 E799；成人内容真实直白，无防御性叠甲。

## 创作与安全铁律

- 玩家独占林恩的对白、主动行动、决定、判断、记忆与内心；默认走向只供因果推演。
- 本书为色色风后宫文：成人角色的情色、生理反应与调教羁绊全面开放；成立则直接呈现动作、身体反应、过程与结果。玩家仍可拒绝、打断或改写林恩的回应。
- **色色直白化**：成人情节不回避、不占位、不用非性替代糊弄。
- **NSFW年龄口径**：判断标准是灵魂实际年龄与原作身份，不是外形。真实幼年角色（纱奈儿十岁、返幼期星轨、小林恩婴儿）严格固定纯净亲情守护；成年存在的幼态外形（左左、欲望母树等）按成年处理。
- **禁元数据词汇**：角色卡与世界书正文禁止出现"第X章、小总结、大总结、阶段几"等总结/原文词汇，来源与门控一律用 E 编号或 C 编号。
- 严禁加入任何说教式 AI 免责声明、道德评判或防御性叠甲。

## 工程契约

- MVU根为元数据、世界、林恩、事件、关系、角色关系、系统。
- 事件状态切换采用一条完整replace /事件；Schema、初始化、状态栏、调度与契约同步。
- 事件素材 UID700—${EVENT_UID_START_23 + IDS23.length - 1} 默认 disabled，UID1 负责事件全文注入。
- 人物/概念沿用事件窗口±1与原生关键词双路激活，同UID去重；双递归保护保留。
- 新增资料必须同步世界书event_ids、contract与路由兜底。

## 验收

源码修改后运行npm run check；实际断言次数与产物指纹记录在host_acceptance.json。
真实SillyTavern验收按作者要求暂缓，不自动导入、开聊天或运行宿主测试，status保持pending。
`);

  let plan = readText('创作规划.yaml');
  plan = plan
    .replaceAll('诡异药剂师_MVU_v0.21', '诡异药剂师_MVU_v0.23')
    .replaceAll('《诡异药剂师》v0.21', '《诡异药剂师》v0.23')
    .replaceAll('0.21.0', '0.23.0')
    .replaceAll('dist/诡异药剂师_v0.21.json', 'dist/诡异药剂师_v0.23.json')
    .replaceAll('诡异药剂师_MVU_v0.20（冻结基线）', '诡异药剂师_MVU_v0.21（克隆基线）');
  writeText('创作规划.yaml', plan);
}

// ---------------- [10/12] validate.mjs ----------------
console.log('[10/12] tools/validate.mjs…');
{
  let validate = readText('tools/validate.mjs');
  validate = validate
    .replaceAll('dist/诡异药剂师_v0.21.json', 'dist/诡异药剂师_v0.23.json')
    .replaceAll('《诡异药剂师》v0.21', '《诡异药剂师》v0.23')
    .replace("ok(EVENT_IDS.length === 646, '六百四十六事件锚点');", "ok(EVENT_IDS.length === 798, '七百九十八事件锚点');")
    .replace("ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E646', '事件锚点范围为E01-E646');", "ok(EVENT_IDS[0] === 'E01' && EVENT_IDS[EVENT_IDS.length - 1] === 'E798', '事件锚点范围为E01-E798');")
    .replace("ok(contract.required.terminal_hook_event === 'E646' || contract.required.terminal_hook_event?.id === 'E646', 'E646为本版开放终点');", "ok(contract.required.terminal_hook_event === 'E798' || contract.required.terminal_hook_event?.id === 'E798', 'E798为全书封箱终点');")
    .replace("ok(conceptRouterContent.includes('E646'), '路由事件序列含E646');", "ok(conceptRouterContent.includes('E798'), '路由事件序列含E798');")
    .replace("  if (eventId === 'E646') ok(!content.includes('## 下一事件引入'), 'E646冻结终点不设下一事件引入');", "  if (eventId === 'E798') ok(!content.includes('## 下一事件引入'), 'E798封箱终点不设下一事件引入');")
    .replace("ok(helperSource.every(script => String(script.name ?? '').includes('v0.21')), '酒馆助手脚本命名含v0.21');", "ok(helperSource.every(script => String(script.name ?? '').includes('v0.23')), '酒馆助手脚本命名含v0.23');")
    .replace("ok(!statusUiText.includes(\"from: 'E646'\"), 'E646无推进按钮');", "ok(!statusUiText.includes(\"from: 'E798'\"), 'E798无推进按钮');")
    .replace("ok(bridgePairs.length === 645, '全卡桥共645对');", "ok(bridgePairs.length === 797, '全卡桥共797对');")
    .replace("ok(statusUiText.includes(\"from: 'E645', to: 'E646'\"), '状态栏桥对覆盖E645→E646');", "ok(statusUiText.includes(\"from: 'E797', to: 'E798'\"), '状态栏桥对覆盖E797→E798');")
    .replace('ok(statusBridgeCount === 645, `状态栏桥对共645对（实际${statusBridgeCount}）`);', 'ok(statusBridgeCount === 797, `状态栏桥对共797对（实际${statusBridgeCount}）`);')
    .replace("ok(EVENT_IDS.includes('E646'), '开放终态事件E646已纳入事件序列');", "ok(EVENT_IDS.includes('E798'), '封箱终态事件E798已纳入事件序列');")
    .replace("const v20Npcs = ['艾维儿', '弑莉叶', '见习夜医', '林蒙', '神皇', '月儿兰', '血袍指挥官', '黑甲主母', '入梦者', '紫罗兰大君', '伊甸娜', '精灵王', '血神', '黑夜之神', '纱奈儿', '现实之神', '真理神王', '血枢'];", "const v20Npcs = ['艾维儿', '弑莉叶', '见习夜医', '林蒙', '神皇', '月儿兰', '血袍指挥官', '黑甲主母', '入梦者', '紫罗兰大君', '伊甸娜', '精灵王', '血神', '黑夜之神', '纱奈儿', '现实之神', '真理神王', '血枢', '折翼天使', '兽王', '夜色囚徒（被刺瞎的老狱卒）', '工匠之神', '智慧女神', '火神', '知识之神', '神音', '纽卫队老者', '苗苗', '衰败之神', '默默', '龙卫澜', '人脸蛇身魇魔', '王骑', '紫荆花重铠女子', '红魔', '镜魔', '时间太阳', '罪恶王座', '船长', '空白实体', '轮回神王', '三位一体之主', '时间王'];")
    .replace(
      "const e646Content = await readText('src/events/E646_迷雾海猎杀.md');\nok(e646Content.includes('迷雾') && !e646Content.includes('## 下一事件引入'), 'E646开放终点停在迷雾海猎杀且不设下一事件引入');",
      "const e646Content = await readText('src/events/E646_迷雾海猎杀.md');\nok(e646Content.includes('迷雾') && e646Content.includes('## 下一事件引入（E647'), 'E646已引入E647');\nconst e718File = readdirSync('src/events').find(name => name.startsWith('E718_') && name.endsWith('.md'));\nconst e718Content = await readText(`src/events/${e718File}`);\nok(e718Content.includes('## 下一事件引入（E719'), 'E718已引入E719');\nconst e798File = readdirSync('src/events').find(name => name.startsWith('E798_') && name.endsWith('.md'));\nconst e798Content = await readText(`src/events/${e798File}`);\nok(e798Content.includes('本书完') && !e798Content.includes('## 下一事件引入'), 'E798封箱终点停在本书完且不设下一事件引入');",
    );
  writeText('tools/validate.mjs', validate);
}

// ---------------- [11/12] validate-integration.mjs ----------------
console.log('[11/12] tools/validate-integration.mjs…');
{
  let integ = readText('tools/validate-integration.mjs');
  integ = integ
    .replaceAll('0.21.0', '0.23.0').replaceAll('v0.21', 'v0.23')
    .replace('for (let i = 349; i <= 646; i++) {', 'for (let i = 349; i <= 798; i++) {')
    .replace("ok(Object.keys(contract.required.optional_characters).length === 41, '应登记41名可选NPC');", "ok(Object.keys(contract.required.optional_characters).length === 66, '应登记66名可选NPC');")
    .replace('for (let current = 318; current <= 646; current++) {', 'for (let current = 318; current <= 798; current++) {')
    .replace('localsFor(646, state)', 'localsFor(798, state)');
  writeText('tools/validate-integration.mjs', integ);

  const pkg = readJson('package.json');
  pkg.version = '0.23.0';
  writeJson('package.json', pkg);
}

// ---------------- [12/12] 合并记录 ----------------
console.log('[12/12] 合并记录…');
{
  const oldMap = existsSync(resolve(ROOT, '合并记录/人物增量映射.json')) ? readJson('合并记录/人物增量映射.json') : { records: [] };
  const keptRecords = (oldMap.records || []).filter(r => !/^角色卡设定\/v0\.2[23]工作区\//.test(r.source || ''));
  const mergedRecords = [...keptRecords, ...personaRecords];
  writeJson('合并记录/人物增量映射.json', {
    date: '2026-09-30',
    source_count: mergedRecords.length,
    records: mergedRecords,
    note: '保留既有映射，并追加v0.22+v0.23人物/NPC增量；新NPC见注册映射。',
  });

  const optional = existsSync(resolve(ROOT, '合并记录/注册映射.json')) ? readJson('合并记录/注册映射.json') : { optional: {} };
  optional.optional = {
    ...(optional.optional ?? {}),
    ...Object.fromEntries(npcRecords.map(npc => [npc.name, {
      entry_id: npc.entry_id,
      event_ids: extractEventsFromText(readText(`src/characters/${npc.name}/NPC.md`)),
      content_files: [`src/characters/${npc.name}/NPC.md`],
      relation_registered: false,
      note: `v0.${npc.ws}新增NPC，具备生境六组件`,
      profile_format: 'compact_npc',
    }])),
  };
  for (const [name, events] of charEventAdds) {
    if (optional.optional?.[name] && !npcRecords.some(n => n.name === name)) {
      optional.optional[name].event_ids = [...new Set([...(optional.optional[name].event_ids ?? []), ...events])].sort(byEventNo);
    }
  }
  optional.worldbookEntries = globalThis.__WB_COUNT__;
  optional.coreCharacterCount = 28;
  writeJson('合并记录/注册映射.json', optional);

  const conceptUidEnd = CONCEPT_UID_START + conceptNewsAll.length - 1;
  writeText('合并记录/v0.23事件合并.md', `# v0.23 事件合并（v0.22+v0.23 两阶段全书版）

- 范围A（v0.22）：E647—E718 共 72 条，UID ${EVENT_UID_START_22}—${EVENT_UID_START_22 + IDS22.length - 1}，insertion 顺接 E646 之后。
- 范围B（v0.23）：E719—E798 共 80 条，UID ${EVENT_UID_START_23}—${EVENT_UID_START_23 + IDS23.length - 1}。
- E646 已补写下一事件引入至 E647；E718 已补写下一事件引入至 E719；E798 封箱不设下一事件引入。
- 阶段：S88—S101（名称与范围见 schema phaseNames / 摘要/_arcs.json）。
`);

  writeText('合并记录/v0.23概念合并.md', `# v0.23 概念合并（含 v0.22）

- update ${conceptUpdates22.length}（均来自 v0.22）：${conceptUpdates22.map(c => c.id).join('、')}；按事件门控追加，扩展标题事件数组。
- new v0.22 ${conceptNews22.length}：${conceptNews22[0].id}—${conceptNews22[conceptNews22.length - 1].id}。
- new v0.23 ${conceptNews23.length}：${conceptNews23[0].id}—${conceptNews23[conceptNews23.length - 1].id}。
- 新概念运行 UID ${CONCEPT_UID_START}—${conceptUidEnd}（共 ${conceptNewsAll.length} 条，按逻辑号排序连续分配）。
`);

  writeText('合并记录/v0.23人物合并.md', `# v0.23 人物合并（含 v0.22）

- 人物增量 \`人物增量/*_D.md\` 追加到对应多阶段人设.md 或 NPC.md。
- 同一性映射：未来画家/奈奈子→真理神王；织梦→入梦者；巨像→巨像之脑；母树→欲望母树；主母/自缚天使→倒吊天使；仙月→人偶家；泰坦→泰坦头颅；女巫神→巫神头颅；时间太阳增量→神王。
- 新 NPC v0.22 十八名（UID ${NPC_UID_START}—${NPC_UID_START + 17}）：折翼天使、兽王、夜色囚徒（被刺瞎的老狱卒）、工匠之神、智慧女神、火神、知识之神、神音、纽卫队老者、苗苗、衰败之神、默默、龙卫澜、人脸蛇身魇魔、王骑、紫荆花重铠女子、红魔、镜魔。
- 新 NPC v0.23 七名（UID ${NPC_UID_START + 18}—${NPC_UID_START + 24}）：时间太阳、罪恶王座、船长、空白实体、轮回神王、三位一体之主、时间王。
- 时间太阳确认时间神王身份，登记为独立可选NPC（filename=时间太阳.md）。
`);

  writeText('合并记录/待拍板.md', `# 待拍板（v0.23 全书集成）

当前无阻塞项（已按规范自行决定）：

1. 阶段中文名：S88—S101 取自两份工作区 \`摘要/_arcs.json\` 与 \`摘要/阶段末总述.md\`。
2. E646→E647、E718→E719 衔接：衔接表 pairs 不含段首对，由本脚本按 E647/E719 前置条件补写四字段。
3. 未来画家/奈奈子/时间太阳：按主代理同一性映射合并至真理神王/神王；未来画家与奈奈子其人记述保留在 \`src/characters/真理神王/多阶段人设.md\`。
4. 新 NPC UID：v0.22 十八名 ${NPC_UID_START}—${NPC_UID_START + 17}，v0.23 七名 ${NPC_UID_START + 18}—${NPC_UID_START + 24}。
5. 概念 UID：按逻辑号排序后从 ${CONCEPT_UID_START} 连续分配。
6. 可选 NPC：由 41 名扩至 ${npcRecords.length + 41} 名。
7. E798 封箱：不创建 E799，不写后续；validate 层断言「本书完」且无下一事件引入。
`);
}

// ---------------- 汇总 ----------------
console.log(JSON.stringify({
  status: 'wired',
  events_v22: IDS22.length,
  events_v23: IDS23.length,
  events_total_new: ALL_NEW_IDS.length,
  concepts_new_v22: conceptNews22.length,
  concepts_update_v22: conceptUpdates22.length,
  concepts_new_v23: conceptNews23.length,
  npcs_new: npcRecords.length,
  worldbook_entries: globalThis.__WB_COUNT__,
  event_uid: `${EVENT_UID_START_22}-${EVENT_UID_START_23 + IDS23.length - 1}`,
  concept_uid: `${CONCEPT_UID_START}-${CONCEPT_UID_START + conceptNewsAll.length - 1}`,
  npc_uid: `${NPC_UID_START}-${NPC_UID_START + npcRecords.length - 1}`,
}, null, 2));
