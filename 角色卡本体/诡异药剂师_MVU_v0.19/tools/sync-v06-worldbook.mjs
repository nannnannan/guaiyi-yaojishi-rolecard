import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const worldbookPath = resolve(root, 'src/worldbook.json');
const contract = JSON.parse(await readFile(resolve(root, 'contract.json'), 'utf8'));
const worldbook = JSON.parse(await readFile(worldbookPath, 'utf8'));

const eventFiles = {
  E21: 'E21_魔鬼训练与首次独立出诊.md', E22: 'E22_幸福之家的血肉晚宴.md', E23: 'E23_异域同乡与爱丽丝初愈.md',
  E24: 'E24_诅咒复燃与古堡围猎.md', E25: 'E25_双面伯爵与心脑之汤.md', E26: 'E26_爱丽丝重生与母女终局.md',
  E27: 'E27_白逸遣返与九州异变.md', E28: 'E28_爱丽丝日常与十四病战蜥.md', E29: 'E29_传奇赠药与夜医启程.md',
  E30: 'E30_血月狼群与寂静镇试诊.md', E31: 'E31_哭泣小丑与血肉灾变.md', E32: 'E32_小丑余波与夜医接纳.md',
  E33: 'E33_夜医试炼与白夜旧梦.md', E34: 'E34_倒吊天使与夜医授职.md', E35: 'E35_左左拟化与蓝星鬼袭.md',
};

const characters = {
  爱丽丝: { id: 150, keys: ['爱丽丝', '幸福之家爱丽丝', '地缚灵爱丽丝'] },
  白逸: { id: 160, keys: ['白逸', '九州白逸', '异域同乡'] },
  倒吊天使: { id: 200, keys: ['倒吊天使', '十二翼倒吊天使', '夜医主母', '夜医主脑'] },
  白夜: { id: 210, keys: ['白夜', '八字元勋白夜', '汪涛'] },
  渡鸦: { id: 220, keys: ['渡鸦', '夜医渡鸦', '鸦人渡鸦'] },
  黑颅: { id: 230, keys: ['黑颅', '夜医黑颅', '黑颅前辈'] },
  猪头屠夫: { id: 240, keys: ['猪头屠夫', '古堡屠夫', '屠夫厨房'] },
  哭泣小丑: { id: 250, keys: ['哭泣小丑', '小丑替代人格', '哭泣小丑显化体'] },
  黑白小丑: { id: 260, keys: ['黑白小丑', '黑白小丑本体', '弹簧小丑'] },
};

const characterEventIds = {
  左左: ['E11','E12','E18','E20','E22','E23','E24','E26','E33','E35'],
  血锯: ['E01','E18','E20','E21','E26','E29'],
  血衣女士: ['E07','E09','E11','E12','E13'],
  小小: ['E05','E15','E16','E17','E18','E19','E34'],
  人偶夫人: ['E15','E18','E20'],
  爱丽丝: ['E22','E23','E24','E25','E26','E28'],
  白逸: ['E22','E23','E24','E25','E26','E27','E35'],
  泰坦头颅: ['E15','E16','E17','E18','E19','E34'],
  巫神头颅: ['E15','E16','E17','E19','E34'],
  小宝贝: ['E01','E11'],
  倒吊天使: ['E34'],
  白夜: ['E33','E34'],
  渡鸦: ['E30','E31','E32','E33'],
  黑颅: ['E30','E31','E32'],
  猪头屠夫: ['E25','E26','E32'],
  哭泣小丑: ['E25','E28','E30','E31','E32','E34'],
  黑白小丑: ['E32'],
};

const concepts = [
  [452,'势力','疫医',['E30','E32'],['疫医','夜医叛徒','瘟疫医生']],
  [453,'势力','九州超自然调查机构',['E27','E35'],['九州超自然调查机构','超自然调查总局','专项调查组','九州调查局']],
  [454,'场景','离魂街',['E21','E22','E23','E24','E25','E26'],['离魂街','幸福之家所在街区','断头女鬼街口']],
  [455,'场景','九州魔都与第九国立医院',['E23','E27','E35'],['九州魔都与第九国立医院','九州魔都','第九国立医院','蓝星魔都','白逸医院']],
  [456,'场景','诅咒之领·寂静镇',['E30','E31','E32'],['诅咒之领·寂静镇','诅咒之领','寂静镇','神圣遗民镇']],
  [457,'场景','黑夜之城',['E32','E33','E34','E35'],['黑夜之城','夜医大本营','群星之下','视界87331']],
  [458,'场景','夜医试炼大厅与幻想间',['E33'],['夜医试炼大厅与幻想间','夜医试炼大厅','幻想间','痛觉机器','夜医考核室']],
  [459,'物品','猪头屠夫的食谱',['E26'],['猪头屠夫的食谱','血肉药膳','隐秘食谱']],
  [460,'物品','未完成的心与脑之汤',['E25'],['未完成的心与脑之汤','心与脑之汤','爱丽丝心脏汤','屠夫浓汤']],
  [461,'物品','咒瞳',['E26'],['咒瞳','诅咒之眼','记录诅咒']],
  [462,'物品','幸福之家结算物与产权',['E26'],['幸福之家结算物与产权','魔女面巾','极恶之心','幸福之家产权','古堡传送锚点']],
  [463,'物品','白逸的手机与跨界召唤凭证',['E27','E35'],['白逸的手机与跨界召唤凭证','白逸的手机','跨界召唤凭证','血肉信标','召唤仪式笔记','白逸家书']],
  [464,'物品','传奇增幅药剂组',['E29'],['传奇增幅药剂组','精神增幅药剂','体质增幅药剂','血锯赠药']],
  [465,'物品','自缚天使的怜悯',['E30','E34'],['自缚天使的怜悯','被缚天使的怜悯','夜医史诗药剂']],
  [466,'物品','蛭病毒',['E30'],['蛭病毒','渡鸦病毒','血蛭毒']],
  [467,'物品','破损圣杯与十二翼吊坠',['E31','E34'],['破损圣杯与十二翼吊坠','破损圣杯','十二翼倒吊天使吊坠','寂静镇圣遗物','神圣镇压物组']],
  [468,'物品','小丑的假面',['E31'],['小丑的假面','小丑假面','哭泣小丑面具']],
  [469,'物品','唯一品质夜医套装',['E34'],['唯一品质夜医套装','夜医鸟嘴面具','夜医长袍','夜医手套','夜医长靴']],
  [470,'物品','天使之血',['E34'],['天使之血','天使圣血','倒吊天使之血','金色血纹']],
  [471,'能力','血锯手术训练体系',['E21','E33'],['血锯手术训练体系','电锯开膛术','剔骨手术刀法','两指换眼法','人锯合一']],
  [472,'能力','再造活人技术',['E23','E26'],['再造活人技术','再造活人','内脏重装','恶灵切除','血肉重建']],
  [473,'能力','地缚灵与恶灵填充',['E22','E23','E24','E25','E26'],['地缚灵与恶灵填充','地缚灵','恶灵填充','傀儡家人','地界束缚']],
  [474,'能力','机械改造知识',['E25','E27'],['机械改造知识','中级机械改造','机械修复']],
  [475,'能力','特定生物跨界召唤',['E27','E35'],['特定生物跨界召唤','特定生物召唤','反向召唤','邪神召唤契约']],
  [476,'能力','夜医切割缝合疗法',['E30','E32'],['夜医切割缝合疗法','夜医疗法','切割缝合','强制治疗']],
  [477,'能力','以M之名',['E33'],['以M之名','痛觉转快感','200级痛觉','抖M被动']],
  [478,'能力','现实灾变·拟化',['E34','E35'],['现实灾变·拟化','现实灾变拟化','拟化','左左人形化']],
  [479,'能力','天使之吻',['E34'],['天使之吻','天使祝福','24小时祝福']],
  [480,'诅咒','哭泣小丑诅咒',['E25','E28','E30','E31','E34'],['哭泣小丑诅咒','小丑替代人格','诊断赋病','哭泣轮廓']],
  [481,'诅咒','色欲诅咒',['E34'],['色欲诅咒','欲望失控','第二人格失控']],
  [482,'诅咒','倒吊天使的锁链诅咒',['E34'],['倒吊天使的锁链诅咒','倒吊天使诅咒','主母锁链','十二翼天使诅咒']],
  [483,'诅咒','血月狼人诅咒',['E30'],['血月狼人诅咒','狼人诅咒','血月狼人','血月狂暴']],
  [484,'特殊设定','视界出诊订单机制',['E21'],['视界出诊订单机制','视界出诊','出诊订单','订单地图']],
  [485,'特殊设定','平行世界与异域家乡',['E23','E27','E35'],['平行世界与异域家乡','异域的家乡','地球上海','九州蓝星']],
  [486,'特殊设定','幸福之家真相',['E25','E26'],['幸福之家真相','玛丽夫人诅咒','爱丽丝惨案','古堡肢解真相']],
  [487,'特殊设定','心灵的洗涤',['E26','E28'],['心灵的洗涤','爱丽丝恨意','爱丽丝家人承诺']],
  [488,'特殊设定','汪涛事件与心锚',['E33','E35'],['汪涛事件与心锚','第三国中大火','王思玥','怨魔','心锚']],
  [489,'特殊设定','灵媒与死界反向标记',['E33','E35'],['灵媒与死界反向标记','灵媒','死界','反向标记']],
  [490,'特殊设定','柏拉图三部走',['E34'],['柏拉图三部走','柏拉图之恋','倒吊天使攻略']],
  [491,'特殊设定','复苏度与体内的“祂”',['E31','E32','E34'],['复苏度与体内的“祂”','复苏度与体内的祂','复苏度','体内意识','体内的祂']],
  [492,'特殊设定','神圣世界与十三圣遗物',['E30','E31','E34'],['神圣世界与十三圣遗物','神圣世界','十三圣遗物','神圣远征军']],
];

const guards = { exclude_recursion: true, prevent_recursion: true };
const byId = new Map(worldbook.entries.map(entry => [entry.id, entry]));
worldbook.name = '《诡异药剂师》v0.6';
worldbook.description = '《诡异药剂师》第1至276章世界书；十七名核心人物、三十五事件与九十三条概念按事件状态和关键词加载。';
worldbook.extensions.tavernweave.version = '0.6.0';
const indexEntry = byId.get(3);
indexEntry.comment = '[角色索引]十七人路由索引';
const routeEntry = byId.get(399);
if (!routeEntry) throw new Error('缺少统一事件内容激活路由UID 399');
routeEntry.comment = '[机制]事件内容激活路由';
routeEntry.keys = [];
routeEntry.secondary_keys = [];
routeEntry.constant = false;
routeEntry.content_file = 'src/prompts/concept_event_router.md';
routeEntry.extensions = { ...(routeEntry.extensions ?? {}), ...guards };

for (const [name, spec] of Object.entries(characters)) {
  byId.set(spec.id, {
    id: spec.id,
    comment: `[角色]${name}`,
    keys: spec.keys,
    secondary_keys: [],
    constant: false,
    insertion_order: spec.id,
    content_files: ['角色速览','基础信息','性格调色盘','三面性','多阶段人设','二次解释'].map(part => `src/characters/${name}/${part}.md`),
    extensions: { ...guards, tavernweave: { event_ids: characterEventIds[name] } },
  });
}

for (const [name, id] of Object.entries(contract.required.character_entry_ids)) {
  const entry = byId.get(id);
  if (!entry) throw new Error(`缺少人物UID ${id}（${name}）`);
  const eventIds = characterEventIds[name];
  if (!Array.isArray(eventIds)) throw new Error(`缺少人物事件映射 ${name}`);
  entry.extensions = {
    ...(entry.extensions ?? {}),
    ...guards,
    tavernweave: { ...(entry.extensions?.tavernweave ?? {}), event_ids: eventIds },
  };
}

for (const [id, filename] of Object.entries(eventFiles)) {
  const number = Number(id.slice(1));
  const title = contract.required.event_titles[id];
  byId.set(299 + number, {
    id: 299 + number,
    comment: `[事件]${id}·${title}`,
    keys: [id, `事件${id}`, title],
    constant: false,
    enabled: false,
    insertion_order: 299 + number,
    content_file: `src/events/${filename}`,
    extensions: { ...guards },
  });
}

for (let index = 0; index < contract.required.event_ids.length; index += 1) {
  const eventEntry = byId.get(300 + index);
  if (!eventEntry) throw new Error(`缺少事件构建素材UID ${300 + index}`);
  eventEntry.enabled = false;
}

for (const [id, type, name, eventIds, keys] of concepts) {
  byId.set(id, {
    id,
    comment: `[概念·${type}]${name}`,
    keys,
    secondary_keys: [],
    constant: false,
    insertion_order: id,
    content_file: `src/concepts/${type}/${id === 491 ? '复苏度与体内的祂' : name}.md`,
    extensions: { ...guards, tavernweave: { event_ids: eventIds } },
  });
}

for (const [idText, eventIds] of Object.entries(contract.required.existing_concept_event_extensions)) {
  const entry = byId.get(Number(idText));
  if (!entry) throw new Error(`缺少既有概念UID ${idText}`);
  entry.extensions = { ...entry.extensions, ...guards, tavernweave: { event_ids: eventIds } };
}
for (const entry of byId.values()) entry.extensions = { ...(entry.extensions ?? {}), ...guards };

worldbook.entries = [...byId.values()].sort((a, b) => a.insertion_order - b.insertion_order || a.id - b.id);
await writeFile(worldbookPath, `${JSON.stringify(worldbook, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'synced', entries: worldbook.entries.length, events: worldbook.entries.filter(e => e.id >= 300 && e.id <= 334).length, characters: Object.keys(contract.required.character_entry_ids).length, concepts: worldbook.entries.filter(e => e.id >= 400 && e.id <= 492).length }, null, 2));
