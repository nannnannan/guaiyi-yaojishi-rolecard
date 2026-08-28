import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('.', import.meta.url));
const summaryRoot = resolve(workspace, '总结同步');
const specs = [
  ['大总结', 'v0.11_大总结_阶段7末.md', 24000],
  ['小总结', 'v0.11_小总结_41-47.md', 35000],
  ['阶段总结', 'v0.11_阶段总结_阶段7末.md', 24000],
];
const failures = [];
const documents = new Map();

for (const [label, file, minimum] of specs) {
  let text = '';
  try {
    text = (await readFile(resolve(summaryRoot, file), 'utf8')).replace(/\r\n/g, '\n');
  } catch (error) {
    failures.push(`${label}缺文件${file}：${error.message}`);
    continue;
  }
  documents.set(label, text);
  if (text.includes('\uFFFD')) failures.push(`${label}含UTF-8替换字符`);
  if (text.length < minimum) failures.push(`${label}仅${text.length}字符，低于完整同步门槛${minimum}`);
  if (!/林恩[^\n]{0,12}18岁|18岁的林恩/.test(text)) failures.push(`${label}未明确林恩18岁`);
  if (/E219|第\s*1016\s*章/.test(text)) failures.push(`${label}越过E218／原文1015封口`);
  for (let number = 171; number <= 218; number += 1) {
    if (!text.includes(`E${number}`)) failures.push(`${label}缺E${number}`);
  }
  for (const keyword of ['条件', '未知', '失败']) {
    if (!text.includes(keyword)) failures.push(`${label}缺“${keyword}”事实分层`);
  }
  if (!(text.includes('六名使徒') || text.includes('其余六名使徒') || text.includes('六人开始攻击'))) {
    failures.push(`${label}未记录E218六使徒已开始攻击的精确终点`);
  }
  if (!/咒瞳[^\n]{0,60}(玩家|选择|未决|等待)/.test(text)) failures.push(`${label}未保留咒瞳开启的玩家选择门`);
}

const small = documents.get('小总结') ?? '';
const smallHeadingOffsets = [];
for (let number = 41; number <= 47; number += 1) {
  const match = new RegExp(`^### 小总结\\s*${number}[：:]`, 'm').exec(small);
  if (!match) failures.push(`小总结缺编号${number}`);
  else smallHeadingOffsets.push([number, match.index]);
}
if (smallHeadingOffsets.length === 7
  && smallHeadingOffsets.some(([, offset], index) => index > 0 && offset <= smallHeadingOffsets[index - 1][1])) {
  failures.push(`小总结编号顺序必须为41→47，实际${smallHeadingOffsets
    .sort((a, b) => a[1] - b[1]).map(([number]) => number).join('→')}`);
}
for (const [start, end, first, last] of [
  [864, 888, 171, 178],
  [889, 913, 179, 186],
  [914, 939, 187, 194],
  [940, 964, 195, 202],
  [965, 989, 203, 210],
  [990, 1002, 211, 214],
  [1003, 1015, 215, 218],
]) {
  if (!small.includes(String(start)) || !small.includes(String(end))) failures.push(`小总结缺原文坐标${start}—${end}`);
  if (!small.includes(`E${first}`) || !small.includes(`E${last}`)) failures.push(`小总结缺事件映射E${first}—E${last}`);
}
if (!/926[^\n]{0,80}(缺|缺失|未提供|空缺)/.test(small)) failures.push('小总结未记录原文第926章缺失证据边界');

if (failures.length) {
  console.error(JSON.stringify({ status: 'failed', files: documents.size, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: 'passed',
    files: specs.length,
    event_range: 'E171-E218',
    chapter_range: '864-1015',
    terminal: 'E218',
    characters: Object.fromEntries([...documents].map(([label, text]) => [label, text.length])),
  }, null, 2));
}
