// tools/upgrade-v012-concepts.mjs
// 集成：把概念草稿（C762-C835，74条）解析并注册进 v0.12：
//   1) 每条写入 src/concepts/C7XX_标题.md
//   2) worldbook.json 追加 UID 2071-2144（对照 v0.11 的 C691-C761 注册样式）
// 草稿源：角色卡设定/v0.12工作区/概念草稿_全部.md
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRAFT = 'C:/Users/huang/Desktop/《诡异药剂师》同人角色卡制作计划/角色卡设定/v0.12工作区/概念草稿_全部.md';
const backup = (p) => { const b = `${p}.bak-v011-baseline`; if (!existsSync(b)) copyFileSync(p, b); };

const draft = readFileSync(DRAFT, 'utf8');

// 解析：找所有 "# 概念·" 开头的标题行，用下一个 "---" 或文件尾切分正文
const lines = draft.split('\n');
const blocks = [];
let current = { title: null, body: [] };
const titleRe = /^# 概念·(.+)$/;
for (const line of lines) {
  const m = line.match(titleRe);
  if (m) {
    if (current.title) blocks.push(current);
    current = { title: m[1], body: [] };
  } else if (current.title) {
    current.body.push(line);
  }
}
if (current.title) blocks.push(current);
console.log(`解析到概念块: ${blocks.length}`);
if (blocks.length !== 74) { console.error(`期望74条，实际${blocks.length}，中止`); process.exit(1); }

// 从标题提取编号（C762...）与分类
function parseTitle(title) {
  // title 形如 "机制·命运的骰子机制详述（事件["E228",...]）"
  const idMatch = title.match(/^(机制|生物|世界观|设定|人物|势力|地点|物品|特殊设定|能力|诅咒|场景)/);
  const name = title.replace(/（事件\[.*\]）$/, '').replace(/^[^·]+·/, '');
  return { name, category: idMatch?.[1] ?? '机制' };
}

const conceptsDir = resolve(root, 'src/concepts');
mkdirSync(conceptsDir, { recursive: true });

const entries = []; // worldbook entries
const filesWritten = [];
for (let i = 0; i < blocks.length; i += 1) {
  const logicalId = `C${762 + i}`; // C762..C835
  const { name, category } = parseTitle(blocks[i].title);
  // 生成文件名（去掉特殊字符）
  const safe = name.replace(/[\\/:*?"<>|]/g, '_');
  const fname = `${logicalId}_${safe}.md`;
  const content = blocks[i].body.join('\n').replace(/^\n+|\n+$/g, '') + '\n';
  // 写入概念文件
  writeFileSync(join(conceptsDir, fname), content, 'utf8');
  filesWritten.push(fname);
  // keys：从标题词拆分（取标题中 2-6 字关键词）；简化：先取 name 前 4 字 + 常见别名留待人工
  const keys = name.length <= 6 ? [name] : [name.slice(0, 6), name];
  entries.push({
    id: 2071 + i, // UID 2071..2144
    comment: `[概念·${category}]${name}`,
    keys,
    constant: false,
    insertion_order: 2200 + i,
    content_file: `src/concepts/${fname}`,
    extensions: { exclude_recursion: true, prevent_recursion: true },
  });
}

// 写入 worldbook.json
const wbPath = resolve(root, 'src/worldbook.json');
backup(wbPath);
const wb = JSON.parse(readFileSync(wbPath, 'utf8'));
if (!wb.entries.some(e => e.id === 2071)) {
  wb.entries.push(...entries);
  writeFileSync(wbPath, `${JSON.stringify(wb, null, 2)}\n`, 'utf8');
  console.log(`worldbook.json：概念 UID 2071-2144 已注册（${entries.length} 条）；总条目 ${wb.entries.length}`);
} else {
  console.log('worldbook.json 已含 UID2071（跳过）');
}
console.log(`概念文件写入 ${filesWritten.length} 个 → src/concepts/`);
console.log(filesWritten.slice(0, 3).join('\n'));
console.log('...');
console.log(filesWritten.slice(-3).join('\n'));