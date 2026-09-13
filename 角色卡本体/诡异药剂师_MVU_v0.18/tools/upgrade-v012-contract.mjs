// tools/upgrade-v012-contract.mjs
// 探针：把 v0.12 契约从 v0.11 基线（E01-E218/S0-S31/C691-C761/桥对217/封口E218）
// 升级到 v0.12（E01-E265/S0-S35/C762-C835/桥对264/封口E265）。
// 本次直接写盘（先备份），改动可追溯。
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = resolve(root, 'contract.json');
const backupPath = resolve(root, 'contract.json.bak-v011-baseline');
if (!existsSync(backupPath)) copyFileSync(contractPath, backupPath);
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));

const CHANGES = [];

// 1. 版本号（contract 内多处）
const versionBefore = contract.version;
contract.version = '0.12.0';
CHANGES.push(`version: ${versionBefore} -> 0.12.0`);

// 2. event_ids 扩展到 E265（保持 E01-E218 原样，追加 E219-E265）
const eventIds = contract.required.event_ids;
if (eventIds[eventIds.length - 1] !== 'E265') {
  for (let i = 219; i <= 265; i += 1) {
    const id = `E${String(i).padStart(2, '0')}`;
    if (!eventIds.includes(id)) eventIds.push(id);
  }
}
CHANGES.push(`event_ids: ${eventIds.length} 个（E01-E${eventIds[eventIds.length-1]}）`);

// 3. event_titles 有 E219-E265 占位（用暂定标题，稍后按重绘蓝图精确）
const eventTitles = contract.required.event_titles;
const placeholderTitles = {
  E219: '蜀都血肉动乱与七圣徒团灭', E220: '血娃娃摸鱼与弥赛亚复读',
  E221: '接通黑夜城与执念思路', E222: '全球审讯与一半人计划',
  E223: '寄生兽泄底与第一使徒真身', E224: '核武袭蜀与血肉壁垒救世',
  E225: '弥赛亚透支血脉与变秃变强', E226: '送走左左与魇魔登场',
  E227: '燕尾服与心灵抑制器', E228: '死缚殉爆与debuff雪球',
  E229: '巨像之心灾变与灭魇魔投影', E230: '九重梦魇与心灵分流',
  E231: '横断山脉与假召唤法阵', E232: '第一使徒被引动与弥赛亚被缚',
  E233: '弥赛亚割腕传信与恩师脸崩', E234: '口嗨啪树与最终决战开启',
  E235: '机械梯队轰炸与眼球定身', E236: '九重梦魇骰点5·永久诅咒',
  E237: '地缚灵骰点3失败与灌注精神力', E238: '撵走弥赛亚与生死对赌',
  E239: '雷霆审判与权柄剥夺肉体', E240: '左左断联与掘地三尺',
  E241: '舍弃血肉·锻造至高机体', E242: '机械之躯归来·我回来了',
  E243: '斩断血肉支配者投影', E244: '纳米吞噬者与灵能处理器',
  E245: '三位一体揭露与左左复归', E246: '跃迁追击与宣战血肉神教',
  E247: '灭尽救援者与第二躯体', E248: '审视二卡与温情相拥',
  E249: '血肉灾变与首次涩涩', E250: '现场直播与昏厥的左手',
  E251: '肉量加30%与权柄衰减', E252: '蓝星之盟与召唤黑夜城',
  E253: '小林恩诞生与心灵分流', E254: '全球核弹拦截与第二职业凭证',
  E255: '解密与同盟·公海禁地', E256: '普鲁斯之死与教会弥赛亚',
  E257: '娘化世界观与林樱', E258: '回家认亲·林镇南杨琳',
  E259: '修罗场与教学', E260: '血衣线·上·晓晴身世',
  E261: '血衣线·下·魔都复仇', E262: '复仇终局·攻略血衣',
  E263: '谢幕遗留·艳英', E264: '收束·情与家',
  E265: '公海前奏·克苏鲁注视'
};
for (const [id, title] of Object.entries(placeholderTitles)) {
  if (!eventTitles[id]) eventTitles[id] = title;
}
CHANGES.push(`event_titles: ${Object.keys(eventTitles).length} 个（含 E219-E265 占位）`);

// 4. phases（S0-S31 已有，追加 S32-S35）
const phases = contract.required.stage_ranges;
if (!phases.S32) { phases.S32 = ['E219','E220','E221','E222','E223','E224','E225','E226','E227','E228']; CHANGES.push('phases.S32 追加（E219-E228）'); }
if (!phases.S33) { phases.S33 = ['E229','E230','E231','E232','E233','E234','E235','E236','E237','E238','E239','E240','E241','E242']; CHANGES.push('phases.S33 追加（E229-E242）'); }
if (!phases.S34) { phases.S34 = ['E243','E244','E245','E246','E247','E248','E249','E250','E251','E252','E253','E254']; CHANGES.push('phases.S34 追加（E243-E254）'); }
if (!phases.S35) { phases.S35 = ['E255','E256','E257','E258','E259','E260','E261','E262','E263','E264','E265']; CHANGES.push('phases.S35 追加（E255-E265）'); }

// 5. concept_activation：概念总数/区间（C691-C761 -> C762-C835）
const ca = contract.required.concept_activation;
const beforeEnd = ca.concept_id_end;
ca.concept_id_end = 835;
ca.new_concept_id_start = 762;
ca.new_concept_id_end = 835;
ca.stage7_note = 'v0.12新增逻辑概念C762-C835共74条，世界书UID2071-2144；另原位更新既有概念正文与event_ids（增量更新不删旧）；事件UID918-964保持不变';
CHANGES.push(`concept_activation: concept_id_end ${beforeEnd}->835, new_concept_id_start ${ca.new_concept_id_start}, new_concept_id_end 835`);

// 6. worldbook（事件素材 UID 700-917 -> 918-964；世界书条目数 -> 712）
const wb = contract.required.event_context_windows;
const wbBefore = wb.material_entry_end;
wb.material_entry_end = 964;
contract.required.worldbook_entry_count = 712;
CHANGES.push(`event_context_windows: material_entry_end ${wbBefore}->964; worldbook_entry_count -> 712`);

// 7. terminal_hook_event：E218 -> E265（封口解除）
contract.required.terminal_hook_event = 'E265';
contract.acceptance.terminal_hook_event = 'E265';
CHANGES.push('terminal_hook_event: E218 -> E265（E218封口解除，E265为阶段八终局新封口）');

// 8. event_anchors / bridge_pairs_count / stage_scope 更新
const acc = contract.acceptance;
const accBeforeAnchors = acc.event_anchors;
acc.event_anchors = 265;
acc.bridge_pairs_count = 264;
acc.stage_scope = 'S0至S35；E01至E265';
CHANGES.push(`acceptance: event_anchors ${accBeforeAnchors}->265, bridge_pairs_count ->264, stage_scope -> S0至S35; E01至E265`);

// 9. source_boundary 更新（原著止于 1182，无缺章记录但保留防越界）
acc.source_boundary = '原著止于第1182章（E265封口）；第1016-1182章连续无缺章（P7-P10核实）；不得读取或泄漏第1183章及以后';
CHANGES.push('acceptance.source_boundary 更新（止于1182章）');

// 10. manifest/profile 版本同步（在另一步做，此处只记录）
writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
console.log('=== 契约升级已写盘（备份 contract.json.bak-v011-baseline）===');
console.log(`  - version: 0.12.0`);
console.log(`  - event_ids: ${eventIds.length}（E01-E${eventIds[eventIds.length-1]}）`);
console.log(`  - stage_ranges: S32-S35 已追加`);
console.log(`  - concept_activation: concept_id_end 835, new_concept_id_start 762, new_concept_id_end 835`);
console.log(`  - worldbook_entry_count: 712; material_entry_end: 964`);
console.log(`  - terminal_hook_event: E265`);
console.log(`  - acceptance: event_anchors 265, bridge_pairs_count 264, stage_scope S0至S35; E01至E265`);
