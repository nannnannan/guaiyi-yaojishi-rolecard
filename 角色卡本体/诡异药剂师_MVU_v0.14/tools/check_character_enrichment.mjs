import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const CHARACTERS = ['血衣女士', '喵喵', '小小', '人偶夫人', '林樱', '羽毛笔', '血锯', '小宝贝'];
const FILES = ['角色速览.md', '基础信息.md', '性格调色盘.md', '三面性.md', '多阶段人设.md', '二次解释.md'];

const CHAPTER_PATTERN = /第\s*[0-9零一二三四五六七八九十百千万两]+\s*章/;
const SUMMARY_PATTERN = /小总结|大总结/;
const STAGE_NUMBER_PATTERN = /阶段[一二三四五六七八九十]/;

let hasErrors = false;

function splitIntoEjsBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let currentTag = 'TOP_LEVEL';
  let currentLines = [];

  for (const line of lines) {
    if (/<%[-_=]?\s*(if|else\s+if|else|\})\b/.test(line)) {
      if (currentLines.length > 0) {
        const blockText = currentLines.join('\n').trim();
        if (blockText.length > 0) {
          blocks.push({ tag: currentTag, text: blockText, length: blockText.length });
        }
        currentLines = [];
      }
      currentTag = line.trim();
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    const blockText = currentLines.join('\n').trim();
    if (blockText.length > 0) {
      blocks.push({ tag: currentTag, text: blockText, length: blockText.length });
    }
  }
  return blocks;
}

console.log('====================================================');
console.log('8 核心角色组件丰富度与 EJS 分支字数 (200~900) 校验');
console.log('====================================================');

const targetChar = process.argv[2];
const charsToCheck = targetChar ? [targetChar] : CHARACTERS;

for (const char of charsToCheck) {
  console.log(`\n################ 角色：${char} ################`);
  for (const file of FILES) {
    const filePath = join('src/characters', char, file);
    const content = readFileSync(filePath, 'utf8');
    const totalChars = content.length;

    // Check forbidden words
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (CHAPTER_PATTERN.test(line)) {
        console.error(`[禁词错误] ${filePath}:${idx+1} [第X章]: ${line.trim()}`);
        hasErrors = true;
      }
      if (SUMMARY_PATTERN.test(line)) {
        console.error(`[禁词错误] ${filePath}:${idx+1} [小总结/大总结]: ${line.trim()}`);
        hasErrors = true;
      }
      if (STAGE_NUMBER_PATTERN.test(line)) {
        console.error(`[禁词错误] ${filePath}:${idx+1} [阶段几]: ${line.trim()}`);
        hasErrors = true;
      }
    });

    const blocks = splitIntoEjsBlocks(content);
    console.log(`  - ${file}: 总字符 ${totalChars}, 块数 ${blocks.length}`);
    for (const [i, b] of blocks.entries()) {
      if (b.tag !== 'TOP_LEVEL' && !b.tag.startsWith('#')) {
        const isLengthOk = b.length >= 200 && b.length <= 900;
        const status = isLengthOk ? '✅' : '❌';
        console.log(`     [${status}] 块 ${i} [${b.length}字] Tag: ${b.tag.slice(0, 45)} -> ${b.text.slice(0, 35).replace(/\n/g, ' ')}...`);
        if (!isLengthOk) {
          console.warn(`       ⚠️ 警告: 字数 ${b.length} 超出 200~900 范围！`);
        }
      }
    }
  }
}

if (hasErrors) {
  console.error('\n❌ 存在禁词校验失败项！');
} else {
  console.log('\n✅ 禁词校验通过！');
}
