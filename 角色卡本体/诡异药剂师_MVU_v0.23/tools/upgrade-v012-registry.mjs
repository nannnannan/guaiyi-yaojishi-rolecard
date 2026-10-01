// tools/upgrade-v012-registry.mjs
// 集成：把 E219-E265 注册进 schema.js / initial_variables.json / status.html / worldbook.json（事件素材部分）。
// 概念部分（UID 2071-2144）等概念路交付后单独注册。
// 全部带备份，可回滚。
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backup = (p) => {
  const b = `${p}.bak-v011-baseline`;
  if (!existsSync(b)) copyFileSync(p, b);
};

// v0.12 新增事件的标题（与 contract.json 占位一致）
const TITLES = {
  E219:'蜀都血肉动乱与七圣徒团灭',E220:'血娃娃摸鱼与弥赛亚复读',E221:'接通黑夜城与执念思路',E222:'全球审讯与一半人计划',
  E223:'寄生兽泄底与第一使徒真身',E224:'核武袭蜀与血肉壁垒救世',E225:'弥赛亚透支血脉与变秃变强',E226:'送走左左与魇魔登场',
  E227:'燕尾服与心灵抑制器',E228:'死缚殉爆与厄运雪球',E229:'巨像之心灾变与灭魇魔投影',E230:'九重梦魇与心灵分流',
  E231:'横断山脉与假召唤法阵',E232:'第一使徒被引动与弥赛亚被缚',E233:'弥赛亚割腕传信与恩师脸崩',E234:'口嗨啪树与最终决战开启',
  E235:'机械梯队轰炸与眼球定身',E236:'九重梦魇骰点5永久诅咒',E237:'地缚灵骰点3失败与灌注精神力',E238:'撵走弥赛亚与生死对赌',
  E239:'雷霆审判与权柄剥夺肉体',E240:'左左断联与掘地三尺',E241:'舍弃血肉锻造至高机体',E242:'机械之躯归来我回来了',
  E243:'斩断血肉支配者投影',E244:'纳米吞噬者与灵能处理器',E245:'三位一体揭露与左左复归',E246:'跃迁追击与宣战血肉神教',
  E247:'灭尽救援者与第二躯体',E248:'审视二卡与温情相拥',E249:'血肉灾变与首次涩涩',E250:'现场直播与昏厥的左手',
  E251:'肉量加30与权柄衰减',E252:'蓝星之盟与召唤黑夜城',E253:'小林恩诞生与心灵分流',E254:'全球核弹拦截与第二职业凭证',
  E255:'解密与同盟公海禁地',E256:'普鲁斯之死与教会弥赛亚',E257:'娘化世界观与林樱',E258:'回家认亲林镇南杨琳',
  E259:'修罗场与教学',E260:'血衣线上晓晴身世',E261:'血衣线下魔都复仇',E262:'复仇终局攻略血衣',
  E263:'谢幕遗留艳英',E264:'收束情与家',E265:'公海前奏克苏鲁注视',
};
const NEW_IDS = Object.keys(TITLES); // E219..E265

// ========== 1. schema.js：anchorTitles + 锚点状态 ==========
const schemaPath = resolve(root, 'src/scripts/schema.js');
backup(schemaPath);
let schema = readFileSync(schemaPath, 'utf8');
if (!schema.includes("E219:")) {
  // anchorTitles 追加（在 "E218: '...',\n};" 前插入）
  const titleLines = NEW_IDS.map(id => `  ${id}: '${TITLES[id]}',`).join('\n');
  const titleRe = /(  E218: '[^']*',\n)(\};)/;
  schema = schema.replace(titleRe, `$1${titleLines}\n$2`);
  // 锚点状态对象追加（在 "      E218: anchor,\n    })," 前插入）
  const anchorLines = NEW_IDS.map(id => `      ${id}: anchor,`).join('\n');
  const anchorRe = /(      E218: anchor,\n)(    \}\)\,)/;
  schema = schema.replace(anchorRe, `$1${anchorLines}\n$2`);
  writeFileSync(schemaPath, schema, 'utf8');
  console.log('schema.js：anchorTitles + 锚点状态 已追加 E219-E265');
} else {
  console.log('schema.js 已含 E219（跳过）');
}

// ========== 2. initial_variables.json：锚点状态追加 ==========
const ivPath = resolve(root, 'src/initial_variables.json');
backup(ivPath);
const iv = JSON.parse(readFileSync(ivPath, 'utf8'));
if (!iv.事件.锚点状态.E219) {
  for (const id of NEW_IDS) {
    iv.事件.锚点状态[id] = { 标题: TITLES[id], 状态: '未触发', 收尾: false };
  }
  writeFileSync(ivPath, `${JSON.stringify(iv, null, 2)}\n`, 'utf8');
  console.log('initial_variables.json：锚点状态已追加 E219-E265（未触发/收尾false）');
} else {
  console.log('initial_variables.json 已含 E219（跳过）');
}

// ========== 3. status.html：ADVANCE_PAIRS 追加 ==========
const statusPath = resolve(root, 'src/ui/status.html');
backup(statusPath);
let status = readFileSync(statusPath, 'utf8');
if (!status.includes("from: 'E218', to: 'E219'")) {
  const pairLines = [];
  for (let i = 0; i < NEW_IDS.length - 1; i += 1) {
    const from = NEW_IDS[i]; const to = NEW_IDS[i + 1];
    pairLines.push(`        { from: '${from}', to: '${to}', label: '结算并承接 ${to}' }`);
  }
  // 在 ADVANCE_PAIRS 数组结尾 "E217→E218" 后、"      ];" 前插入
  const re = /(        \{ from: 'E217', to: 'E218', label: '结算并承接 E218' \}\n)(      \];)/;
  status = status.replace(re, `$1${pairLines.join('\n')}\n$2`);
  writeFileSync(statusPath, status, 'utf8');
  console.log('status.html：ADVANCE_PAIRS 已追加 E218→E265');
} else {
  console.log('status.html 已含 E218→E219（跳过）');
}

// ========== 4. worldbook.json：事件素材 UID 918-964 ==========
const wbPath = resolve(root, 'src/worldbook.json');
backup(wbPath);
const wb = JSON.parse(readFileSync(wbPath, 'utf8'));
if (!wb.entries.some(e => e.id === 918)) {
  const eventDir = resolve(root, 'src/events');
  const names = readdirSync(eventDir);
  const materialEntries = [];
  for (let i = 0; i < NEW_IDS.length; i += 1) {
    const id = NEW_IDS[i]; // E219...
    const file = names.find(n => n.startsWith(`${id}_`));
    if (!file) throw new Error(`事件文件缺失: ${id}`);
    materialEntries.push({
      id: 918 + i,
      comment: `[事件]${id}·${TITLES[id]}`,
      keys: [id],
      enabled: false,
      constant: false,
      insertion_order: 700 + i,
      content_file: `src/events/${file}`,
      extensions: { exclude_recursion: true, prevent_recursion: true },
    });
  }
  wb.entries.push(...materialEntries);
  writeFileSync(wbPath, `${JSON.stringify(wb, null, 2)}\n`, 'utf8');
  console.log(`worldbook.json：事件素材 UID 918-964 已注册（${materialEntries.length} 条）`);
} else {
  console.log('worldbook.json 已含 UID918（跳过）');
}

console.log('=== registry 集成完成 ===');