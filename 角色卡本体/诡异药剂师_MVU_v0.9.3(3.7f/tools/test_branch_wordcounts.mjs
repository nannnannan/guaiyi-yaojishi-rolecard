import fs from 'node:fs';
import path from 'node:path';

const chars = [
  '白逸', '泰坦头颅', '巫神头颅', '倒吊天使', '白夜', '渡鸦', '黑颅',
  '猪头屠夫', '哭泣小丑', '黑白小丑', '艾雯爵士', '万机之神', '巨像之脑', '血肉支配者'
];

const compFiles = ['角色速览.md', '基础信息.md', '性格调色盘.md', '三面性.md', '多阶段人设.md', '二次解释.md'];

// Forbidden word patterns
const CHAPTER_PATTERN = /第\s*[0-9零一二三四五六七八九十百千万两]+\s*章/;
const SUMMARY_PATTERN = /小总结|大总结/;
const STAGE_NUMBER_PATTERN = /阶段[一二三四五六七八九十]/;

function extractBranches(content, filePath) {
  const branches = [];
  const lines = content.split('\n');
  let currentBranchHeader = null;
  let currentBranchLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isIf = /<%_\s*if\s*\(/.test(line);
    const isElseIf = /<%_\s*\}\s*else\s+if\s*\(/.test(line);
    const isElse = /<%_\s*\}\s*else\s*\{/.test(line);
    const isEnd = /<%_\s*\}\s*_%>/g.test(line);

    if (isIf || isElseIf || isElse) {
      if (currentBranchHeader && currentBranchLines.length > 0) {
        const text = currentBranchLines.join('\n').replace(/<%_[\s\S]*?_%>/g, '').trim();
        if (text.length > 0) {
          branches.push({ header: currentBranchHeader, text, len: text.length });
        }
      }
      currentBranchHeader = line.trim();
      currentBranchLines = [];
    } else if (isEnd) {
      if (currentBranchHeader && currentBranchLines.length > 0) {
        const text = currentBranchLines.join('\n').replace(/<%_[\s\S]*?_%>/g, '').trim();
        if (text.length > 0) {
          branches.push({ header: currentBranchHeader, text, len: text.length });
        }
      }
      currentBranchHeader = null;
      currentBranchLines = [];
    } else {
      if (currentBranchHeader) {
        currentBranchLines.push(line);
      }
    }
  }
  if (currentBranchHeader && currentBranchLines.length > 0) {
    const text = currentBranchLines.join('\n').replace(/<%_[\s\S]*?_%>/g, '').trim();
    if (text.length > 0) {
      branches.push({ header: currentBranchHeader, text, len: text.length });
    }
  }
  return branches;
}

let totalErrors = 0;
for (const char of chars) {
  console.log(`\n==================== ${char} ====================`);
  for (const comp of compFiles) {
    const p = path.join('src', 'characters', char, comp);
    if (!fs.existsSync(p)) {
      console.log(`[MISSING] ${p}`);
      totalErrors++;
      continue;
    }
    const text = fs.readFileSync(p, 'utf8');
    
    // Check forbidden words
    const mChapter = text.match(CHAPTER_PATTERN);
    const mSummary = text.match(SUMMARY_PATTERN);
    const mStage = text.match(STAGE_NUMBER_PATTERN);
    if (mChapter) { console.log(`[FORBIDDEN] ${p}: contains ${mChapter[0]}`); totalErrors++; }
    if (mSummary) { console.log(`[FORBIDDEN] ${p}: contains ${mSummary[0]}`); totalErrors++; }
    if (mStage) { console.log(`[FORBIDDEN] ${p}: contains ${mStage[0]}`); totalErrors++; }

    // Check branches
    const branches = extractBranches(text, p);
    if (branches.length === 0) {
      const cleanText = text.replace(/<%_[\s\S]*?_%>/g, '').trim();
      console.log(`  ${comp} (Static, ${cleanText.length} chars)`);
    } else {
      console.log(`  ${comp} (${branches.length} branches):`);
      for (const b of branches) {
        const status = (b.len >= 200 && b.len <= 900) ? 'OK' : `FAIL (${b.len} chars)`;
        if (status.startsWith('FAIL')) totalErrors++;
        console.log(`    - [${status}] ${b.header.slice(0, 50)}... (${b.len} chars)`);
      }
    }
  }
}

console.log(`\nTotal Validation Issues: ${totalErrors}`);
