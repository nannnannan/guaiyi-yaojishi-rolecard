// v0.7 世界书同步脚本（一次性迁移）
// 职责：
// 1) 删除旧「[概念·物品]黑弦月」条目（内容已并入新人设 UID270）
// 2) id3 索引 comment 更新为二十四人
// 3) 既有角色条目按锚点参与扩展 tavernweave.event_ids（按 comment 精确匹配）
// 4) id452 疫医 event_ids 同步为 E30,E32,E48,E52,E54,E60
// 5) id485 平行世界与异域家乡 event_ids 追加 E37,E40,E42,E43
// 6) 插入事件素材条目 id335-363（E36-E64，enabled:false）
// 7) diff v0.6/v0.7 概念目录，新增概念按类别分配 UID493-550 并解析标题行事件数组
// 8) 插入 7 位新人物条目（UID270/280/290/291/292/293/294，六组件 content_files）
// 9) 冲突检测 + 排序 + 备份 + 写回
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WB_PATH = path.join(ROOT, 'src', 'worldbook.json');
const V06_CONCEPTS = path.join(ROOT, '..', '诡异药剂师_MVU_v0.6', 'src', 'concepts');
const V07_CONCEPTS = path.join(ROOT, 'src', 'concepts');
const EVENTS_DIR = path.join(ROOT, 'src', 'events');
const CHARACTERS_DIR = path.join(ROOT, 'src', 'characters');

// ---------- 静态数据 ----------
// 新人物：UID -> { name, keys, eventIds }
const NEW_CHARACTERS = [
  { id: 270, name: '黑弦月', keys: ['黑弦月', '第七人偶', '哥特萝莉人偶'], eventIds: ['E51', 'E52', 'E53', 'E57', 'E61', 'E62', 'E63', 'E64'] },
  { id: 280, name: '喵喵', keys: ['喵喵', '狗耳娘', '猫耳娘喵喵'], eventIds: ['E48', 'E49', 'E50', 'E55', 'E63'] },
  { id: 290, name: '林樱', keys: ['林樱'], eventIds: ['E42', 'E64'] },
  { id: 291, name: '艾雯爵士', keys: ['艾雯爵士', '艾雯', '至高之魂'], eventIds: ['E45', 'E49', 'E54', 'E59'] },
  { id: 292, name: '羽毛笔', keys: ['羽毛笔', '必须写点东西的羽毛笔'], eventIds: ['E48', 'E57'] },
  { id: 293, name: 'a01银色幻想', keys: ['a01', '银色幻想', 'a01银色幻想'], eventIds: ['E58', 'E59'] },
  { id: 294, name: '欲望母树', keys: ['欲望母树'], eventIds: ['E58', 'E63'] },
];

// 既有角色：comment 名 -> 追加事件（合并去重，保持既有顺序在前）
const EXISTING_CHAR_EVENT_ADD = {
  '左左': ['E36', 'E43', 'E45', 'E46', 'E48', 'E49', 'E50', 'E52', 'E55', 'E57', 'E60', 'E61', 'E62', 'E63', 'E64'],
  '白逸': ['E37', 'E38', 'E41', 'E42'],
  '小小': ['E59'],
  '人偶夫人': ['E51', 'E53'],
  '白夜': ['E49', 'E57', 'E58', 'E59', 'E60', 'E61'],
  '倒吊天使': ['E43', 'E44', 'E45', 'E47', 'E49', 'E54', 'E57', 'E59'],
  '小宝贝': ['E57', 'E61'],
  '泰坦头颅': ['E59'],
  '巫神头颅': ['E59'],
};

// 概念别名（文件名 -> 附加关键词，不含文件名本身）
const CONCEPT_ALIAS = {
  '以M之拳与充能体系': ['以M之拳', '以M之力'],
  '无瞳法阵': ['无瞳之眼'],
  '喵化诅咒': ['异常性猫化诅咒'],
  '欲望母树派系': ['欲望教派'],
  '恐惧尖啸与深度恐惧': ['恐惧尖啸', '深度恐惧'],
};

const CONCEPT_CATEGORY_ORDER = ['机制', '势力', '场景', '物品', '特殊设定', '人物'];

// ---------- 工具函数 ----------
function listFilesRecursive(dir) {
  const out = [];
  const walk = (d, rel) => {
    for (const name of fs.readdirSync(d)) {
      const abs = path.join(d, name);
      const r = rel ? path.join(rel, name) : name;
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs, r);
      else out.push(r);
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return out;
}

function parseTitleEventIds(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const m = firstLine.match(/（事件(\[[^\]]*\])）$/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[1]);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function dedupe(arr) {
  return [...new Set(arr)];
}

// ---------- 主流程 ----------
const wb = JSON.parse(fs.readFileSync(WB_PATH, 'utf8'));
const entries = wb.entries;
const errors = [];
const changes = [];

const existingIds = new Set(entries.map(e => Number(e.id)));

// 冲突预检
const plannedIds = [
  ...NEW_CHARACTERS.map(c => c.id),
  ...Array.from({ length: 29 }, (_, i) => 335 + i),
  ...Array.from({ length: 58 }, (_, i) => 493 + i),
];
for (const id of plannedIds) {
  if (existingIds.has(id)) errors.push(`UID冲突：${id} 已被既有条目占用`);
}
const idDup = new Set(plannedIds.filter((v, i, a) => a.indexOf(v) !== i));
for (const id of idDup) errors.push(`新分配UID重复：${id}`);

// 1) 删除旧黑弦月物品概念
const before = entries.length;
wb.entries = entries.filter(e => String(e.comment ?? '') !== '[概念·物品]黑弦月');
if (wb.entries.length !== before) changes.push('删除[概念·物品]黑弦月');
else errors.push('未找到待删除的[概念·物品]黑弦月条目');

// 2) id3 索引 comment
const idx3 = wb.entries.find(e => Number(e.id) === 3);
if (idx3) {
  if (idx3.comment !== '[角色索引]二十四人路由索引') {
    idx3.comment = '[角色索引]二十四人路由索引';
    changes.push('id3 comment -> 二十四人路由索引');
  }
} else errors.push('未找到 id3 路由索引条目');

// 3) 既有角色事件扩展
for (const [name, addEvents] of Object.entries(EXISTING_CHAR_EVENT_ADD)) {
  const entry = wb.entries.find(e => String(e.comment ?? '') === `[角色]${name}`);
  if (!entry) { errors.push(`未找到既有角色条目：${name}`); continue; }
  const ex = entry.extensions ?? (entry.extensions = {});
  const tw = ex.tavernweave ?? (ex.tavernweave = {});
  const cur = Array.isArray(tw.event_ids) ? tw.event_ids : [];
  const merged = dedupe([...cur, ...addEvents]);
  if (JSON.stringify(merged) !== JSON.stringify(cur)) {
    tw.event_ids = merged;
    changes.push(`角色${name} event_ids += ${addEvents.join(',')}`);
  }
}

// 4) id452 疫医
const yiyi = wb.entries.find(e => Number(e.id) === 452);
if (yiyi) {
  const want = ['E30', 'E32', 'E48', 'E52', 'E54', 'E60'];
  if (JSON.stringify(yiyi.extensions?.tavernweave?.event_ids) !== JSON.stringify(want)) {
    yiyi.extensions.tavernweave.event_ids = want;
    changes.push('id452 疫医 event_ids -> E30,E32,E48,E52,E54,E60');
  }
} else errors.push('未找到 id452 疫医条目');

// 5) id485 平行世界与异域家乡
const pw = wb.entries.find(e => Number(e.id) === 485);
if (pw) {
  const ex = pw.extensions ?? (pw.extensions = {});
  const tw = ex.tavernweave ?? (ex.tavernweave = {});
  const cur = Array.isArray(tw.event_ids) ? tw.event_ids : [];
  const merged = dedupe([...cur, 'E37', 'E40', 'E42', 'E43']);
  if (JSON.stringify(merged) !== JSON.stringify(cur)) {
    tw.event_ids = merged;
    changes.push('id485 平行世界与异域家乡 event_ids += E37,E40,E42,E43');
  }
} else errors.push('未找到 id485 平行世界与异域家乡条目');

// 6) 事件素材 335-363
const eventFiles = listFilesRecursive(EVENTS_DIR).filter(f => /^E(3[6-9]|[4-5][0-9]|6[0-4])_.*\.md$/.test(f));
const byNum = new Map();
for (const f of eventFiles) {
  const num = Number(f.match(/^E(\d+)_/)[1]);
  byNum.set(num, f);
}
for (let n = 36; n <= 64; n++) {
  const f = byNum.get(n);
  if (!f) { errors.push(`缺少事件素材文件 E${n}`); continue; }
  const title = f.replace(/^E\d+_/, '').replace(/\.md$/, '');
  wb.entries.push({
    id: 335 + (n - 36),
    comment: `[事件]E${String(n).padStart(2, '0')}·${title}`,
    keys: [`E${String(n).padStart(2, '0')}`, `事件E${String(n).padStart(2, '0')}`, title],
    constant: false,
    enabled: false,
    insertion_order: 335 + (n - 36),
    content_file: `src/events/${f}`,
    extensions: { exclude_recursion: true, prevent_recursion: true },
  });
}
changes.push(`插入事件素材条目 335-363（E36-E64，共${64 - 36 + 1}条）`);

// 7) 概念 diff + UID 分配
const v06 = new Set(listFilesRecursive(V06_CONCEPTS).map(p => p.replace(/\\/g, '/')));
const v07Files = listFilesRecursive(V07_CONCEPTS).map(p => p.replace(/\\/g, '/'));
const newConceptFiles = v07Files.filter(p => !v06.has(p) && p.endsWith('.md'));
const byCategory = {};
for (const rel of newConceptFiles) {
  const parts = rel.split('/');
  const cat = parts[0];
  if (!CONCEPT_CATEGORY_ORDER.includes(cat)) { errors.push(`概念类别不在白名单：${rel}`); continue; }
  (byCategory[cat] ??= []).push(rel);
}
let nextUid = 493;
let conceptCount = 0;
for (const cat of CONCEPT_CATEGORY_ORDER) {
  const list = (byCategory[cat] ?? []).sort((a, b) => a.localeCompare(b, 'zh'));
  for (const rel of list) {
    const abs = path.join(V07_CONCEPTS, ...rel.split('/'));
    const eventIds = parseTitleEventIds(abs);
    if (!eventIds) errors.push(`概念标题行无法解析事件数组：${rel}`);
    const name = path.basename(rel, '.md');
    const keys = [name, ...(CONCEPT_ALIAS[name] ?? [])];
    wb.entries.push({
      id: nextUid,
      comment: `[概念·${cat}]${name}`,
      keys,
      secondary_keys: [],
      constant: false,
      insertion_order: nextUid,
      content_file: `src/concepts/${rel}`,
      extensions: {
        exclude_recursion: true,
        prevent_recursion: true,
        tavernweave: { event_ids: eventIds ?? [] },
      },
    });
    changes.push(`概念 UID${nextUid} [${cat}] ${name} (${eventIds?.join(',') ?? '无事件'})`);
    nextUid += 1;
    conceptCount += 1;
  }
}
if (conceptCount !== 58) errors.push(`概念数量异常：期望58，实际${conceptCount}`);

// 8) 新人物条目
for (const c of NEW_CHARACTERS) {
  const dir = path.join(CHARACTERS_DIR, c.name);
  const comps = ['角色速览', '基础信息', '性格调色盘', '三面性', '多阶段人设', '二次解释'];
  const contentFiles = comps.map(x => `src/characters/${c.name}/${x}.md`);
  for (const cf of contentFiles) {
    if (!fs.existsSync(path.join(ROOT, cf))) errors.push(`人物组件缺失：${cf}`);
  }
  wb.entries.push({
    id: c.id,
    comment: `[角色]${c.name}`,
    keys: c.keys,
    secondary_keys: [],
    constant: false,
    insertion_order: c.id,
    content_files: contentFiles,
    extensions: {
      exclude_recursion: true,
      prevent_recursion: true,
      tavernweave: { event_ids: c.eventIds },
    },
  });
  changes.push(`人物 UID${c.id} ${c.name} (${c.eventIds.join(',')})`);
}

// 9) 排序 + 备份 + 写回
if (errors.length > 0) {
  console.error('【同步中止】存在错误：');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
wb.entries.sort((a, b) => Number(a.insertion_order ?? 0) - Number(b.insertion_order ?? 0));
fs.copyFileSync(WB_PATH, path.join(ROOT, 'tools', 'worldbook_backup_v06.json'));
fs.writeFileSync(WB_PATH, JSON.stringify(wb, null, 2) + '\n', 'utf8');
console.log('【同步完成】条目总数：' + wb.entries.length);
for (const c of changes) console.log('  + ' + c);
