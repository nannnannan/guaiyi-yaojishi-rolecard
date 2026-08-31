// v0.7 机械终检：可自动化的硬性问题全量扫描（只读，输出问题清单）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}
const srcFiles = walk(path.join(ROOT, 'src'));
const allSrcText = srcFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const issues = [];
const report = (severity, where, msg) => issues.push(`[${severity}] ${where}: ${msg}`);

// 1) 旧口径残留词
const stalePatterns = [
  ['大哔哔', 'P0', '遮蔽词'],
  ['禁止色色', 'P0', '禁色表述'],
  ['禁止性化', 'P0', '禁色表述'],
  ['幼态外观期间恶堕恒为0', 'P0', '爱丽丝旧锁'],
  ['幼态外观下恶堕固定为0', 'P0', '爱丽丝旧锁'],
  ['吸引与恶堕仍为0', 'P0', '左左旧锁'],
  ['未确认独立成年形态', 'P0', '左左旧锁'],
  ['十七名核心人物', 'P1', '人数旧口径'],
  ['17名核心人物', 'P1', '人数旧口径'],
  ['十七人关系', 'P1', '人数旧口径'],
  ['三十五', 'P1', '事件数旧口径'],
  ['35个', 'P1', '事件数旧口径'],
  ['第1至276章', 'P1', '范围旧口径'],
  ['第150至276章', 'P1', '范围旧口径'],
  ['E35是本版终点', 'P0', '终点旧口径'],
  ['不创建E36', 'P1', '旧E36禁语（E36已存在）'],
  ['阶段2', 'P2', '阶段二表述（视上下文）'],
  ['v0.6', 'P1', '版本残留（需人工判断是否历史叙述）'],
  ['0.6.0', 'P1', '版本残留'],
];
const spoilerRe = /(?:羽毛笔|欲望母树|母树)[\s\S]{0,40}(?:上辈子|前世)/;
for (const f of srcFiles) {
  const t = fs.readFileSync(f, 'utf8');
  if (spoilerRe.test(t)) report('P0', path.relative(ROOT, f), '用户剧透词（母树/羽毛笔+前世）');
}
for (const [term, sev, label] of stalePatterns) {
  for (const f of srcFiles) {
    const t = fs.readFileSync(f, 'utf8');
    if (t.includes(term)) {
      const rel = path.relative(ROOT, f);
      // 排除合法的历史叙述上下文：AGENTS/README 已更新；tools 内脚本与 backup 不属 src
      const lines = t.split('\n');
      const hits = lines.map((l, i) => l.includes(term) ? i + 1 : 0).filter(Boolean);
      report(sev, `${rel} L${hits.join(',')}`, `${label}：${term}`);
    }
  }
}

// 2) worldbook 一致性
const wb = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/worldbook.json'), 'utf8'));
const ids = wb.entries.map(e => e.id);
if (new Set(ids).size !== ids.length) report('P0', 'worldbook', '条目ID重复');
const conceptEntries = wb.entries.filter(e => e.id >= 493 && e.id <= 550);
for (const e of conceptEntries) {
  const t = fs.readFileSync(path.join(ROOT, e.content_file), 'utf8');
  const title = t.split(/\r?\n/)[0] ?? '';
  const m = title.match(/^# 概念·[^·]+·(.+?)（事件(\[[^\]]*\])）$/);
  const ev = e.extensions?.tavernweave?.event_ids ?? [];
  if (!m) {
    if (!(e.comment.includes('术语速查'))) report('P1', `UID${e.id} ${e.comment}`, '标题行无事件数组');
  } else if (JSON.stringify(JSON.parse(m[2])) !== JSON.stringify(ev)) {
    report('P0', `UID${e.id} ${e.comment}`, '标题事件数组与元数据不一致');
  }
}
const charEntries = wb.entries.filter(e => /^\[角色\]/.test(String(e.comment ?? '')));
for (const e of charEntries) {
  for (const cf of (e.content_files ?? [])) {
    if (!fs.existsSync(path.join(ROOT, cf))) report('P0', `${e.comment}`, `组件缺失：${cf}`);
  }
  const ev = e.extensions?.tavernweave?.event_ids ?? [];
  for (const id of ev) if (!/^E\d{2}$/.test(id) || Number(id.slice(1)) > 64) report('P0', `${e.comment}`, `事件ID非法：${id}`);
  if (!e.extensions?.exclude_recursion || !e.extensions?.prevent_recursion) report('P0', `${e.comment}`, '缺双递归保护');
}
const matEntries = wb.entries.filter(e => e.id >= 335 && e.id <= 363);
for (const e of matEntries) {
  if (e.enabled !== false) report('P0', `${e.comment}`, '事件素材未禁用');
  if (!fs.existsSync(path.join(ROOT, e.content_file))) report('P0', `${e.comment}`, `素材缺失：${e.content_file}`);
}

// 3) 事件文件桥
for (let n = 36; n <= 63; n++) {
  const f = path.join(ROOT, 'src/events', `E${String(n).padStart(2, '0')}_` + '*.md');
  const matches = walk(path.join(ROOT, 'src/events')).filter(p => p.includes(`E${String(n).padStart(2, '0')}_`) && p.endsWith('.md'));
  if (matches.length !== 1) { report('P0', `E${n}`, `素材文件数异常：${matches.length}`); continue; }
  const t = fs.readFileSync(matches[0], 'utf8');
  const next = `E${String(n + 1).padStart(2, '0')}`;
  if (!t.includes(`## 下一事件引入（${next}`)) report('P0', `E${n}`, `缺指向${next}的引入段`);
}
const e64File = walk(path.join(ROOT, 'src/events')).find(p => p.includes('E64_'));
const e64t = fs.readFileSync(e64File, 'utf8');
if (e64t.includes('## 下一事件引入')) report('P0', 'E64', '不应含引入段');

// 4) mainline 桥
const mainline = fs.readFileSync(path.join(ROOT, 'src/prompts/mainline.md'), 'utf8');
for (let n = 1; n <= 63; n++) {
  const from = `E${String(n).padStart(2, '0')}`;
  const to = `E${String(n + 1).padStart(2, '0')}`;
  if (!mainline.includes(`### ${from}→${to}`)) report('P0', 'mainline', `缺桥段 ${from}→${to}`);
}
if (mainline.includes('### E64→')) report('P0', 'mainline', 'E64 不应有后续桥');

// 5) 契约结构
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contract.json'), 'utf8'));
if (contract.required.event_ids.length !== 64) report('P0', 'contract', `事件数${contract.required.event_ids.length}`);
if (contract.required.core_character_count !== 24) report('P0', 'contract', '人数非24');
const entryIds = Object.values(contract.required.character_entry_ids);
if (entryIds.some(id => id >= 300 && id <= 363)) report('P0', 'contract', '人物UID占用素材区间300-363');
if (new Set(entryIds).size !== entryIds.length) report('P0', 'contract', '人物UID重复');

console.log(issues.length ? issues.join('\n') : '【机械终检】未发现硬性问题');
