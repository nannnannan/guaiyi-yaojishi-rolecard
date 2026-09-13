// tools/fix-v012-concept-files.mjs
// 修复：概念文件首行必须是 "# 概念·..." 标题行。
// 重解析草稿：每条 = `# 概念·标题` 行 + 后续直到 `---` 的正文。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRAFT = 'C:/Users/huang/Desktop/《诡异药剂师》同人角色卡制作计划/角色卡设定/v0.12工作区/概念草稿_全部.md';
const conceptsDir = resolve(root, 'src/concepts');

const draft = readFileSync(DRAFT, 'utf8');
const lines = draft.split('\n');

// 重新解析：标题行 "# 概念·..." 开块；"---" 或 "$---" 或文件尾 结束当前块
const blocks = [];
let cur = null;
const flush = () => { if (cur) { blocks.push(cur); cur = null; } };
for (const line of lines) {
  const t = line.trim();
  if (t.startsWith('# 概念·')) {
    flush();
    cur = { title: t.slice(2).trim(), body: [] }; // 去掉 '# '，保留 "概念·..."
    continue;
  }
  if (cur && (t === '---' || t === '$---')) { flush(); continue; }
  if (cur) cur.body.push(line);
}
flush();

console.log(`重解析到概念块: ${blocks.length}`);
if (blocks.length !== 74) { console.error(`期望74，实际${blocks.length}，中止`); process.exit(1); }

// 每条写入文件（首行 "# 概念·..." + '\n' + body）
let rewritten = 0;
const existing = readdirSync(conceptsDir).filter(f => f.endsWith('.md'));
for (let i = 0; i < blocks.length; i += 1) {
  const logicalId = `C${762 + i}`;
  const file = existing.find(f => f.startsWith(`${logicalId}_`));
  if (!file) { console.error(`找不到 ${logicalId} 文件`); continue; }
  const content = `# ${blocks[i].title}\n\n${blocks[i].body.join('\n').replace(/^\n+|\n+$/g, '')}\n`;
  writeFileSync(join(conceptsDir, file), content, 'utf8');
  rewritten += 1;
}
console.log(`已重写 ${rewritten} 个概念文件（首行均为 # 概念·）`);