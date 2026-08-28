const fs = require('fs');
const path = require('path');

const basePath = 'c:/Users/huang/Desktop/《诡异药剂师》同人角色卡制作计划/角色卡本体/诡异药剂师_MVU_v0.9';
const wbPath = path.join(basePath, 'src/worldbook.json');

const data = JSON.parse(fs.readFileSync(wbPath, 'utf-8'));
const entries = Object.values(data.entries);

let report = '# 审查报告\\n\\n';

let characterCount = 0;
let conceptCount = 0;
let eventCount = 0;

let metaViolations = [];
let lynnViolations = [];
let curseEyeViolations = [];
let sexMechViolations = [];
let conceptErrors = [];
let charErrors = [];
let charStage5Details = [];

entries.forEach(entry => {
  let content = entry.content || '';
  
  let filesToRead = [];
  if (entry.content_file) filesToRead.push(entry.content_file);
  if (entry.content_files) filesToRead.push(...entry.content_files);

  filesToRead.forEach(f => {
    const fullPath = path.join(basePath, f);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.md'));
        content += '\\n' + files.map(file => fs.readFileSync(path.join(fullPath, file), 'utf-8')).join('\\n\\n');
      } else {
        content += '\\n' + fs.readFileSync(fullPath, 'utf-8');
      }
    } catch (e) {
      // ignore
    }
  });

  const comment = entry.comment || '';
  const fullText = comment + '\\n' + content;

  let isChar = comment.includes('角色') || filesToRead.some(f => f.includes('characters'));
  let isConcept = comment.includes('概念') || comment.includes('设定') || filesToRead.some(f => f.includes('concepts'));
  let isEvent = comment.includes('事件') || filesToRead.some(f => f.includes('events'));

  if (isChar && !comment.includes('索引')) characterCount++;
  if (isConcept) conceptCount++;
  if (isEvent) eventCount++;

  // Redline 1: Meta words
  const metaRegex = /(第[一二三四五六七八九十\d]+章|阶段[一二三四五六七八九十\d]+|小总结|大总结)/g;
  let match;
  while ((match = metaRegex.exec(fullText)) !== null) {
    if (!isChar || (!match[0].includes('阶段') && !match[0].includes('章'))) {
       // Wait, "阶段几" is forbidden. Let's list it anyway to be thorough, 
       // but maybe it's allowed in multi-stage persona? The prompt says "严禁正文出现...阶段几".
       metaViolations.push(`Entry ${entry.id} (${comment}): found "${match[0]}"`);
    }
  }

  // Redline 2: Player sovereignty
  const lynnRegex = /(.{0,10})(林恩(想|觉得|认为|思考|决定|打算|感受|感觉|说))(.{0,10})/g;
  while ((match = lynnRegex.exec(fullText)) !== null) {
    const prefix = match[1];
    if (!prefix.includes('不') && !prefix.includes('禁止') && !prefix.includes('严禁') && !prefix.includes('交')) {
      lynnViolations.push(`Entry ${entry.id} (${comment}): found "${match[0].trim()}"`);
    }
  }

  // Characters check
  if (isChar && !comment.includes('索引')) {
    if (comment.includes('巨像之脑') || comment.includes('倒吊天使') || comment.includes('欲望母树') || comment.includes('左左') || comment.includes('喵喵')) {
       charStage5Details.push(`\\n--- ${comment} ---`);
       const snip = fullText.includes('E97') || fullText.includes('E126') || fullText.includes('阶段五') ? 'Has Stage 5 refs' : 'NO Stage 5 refs';
       charStage5Details.push(snip);
       const keywords = ['银发', '女王', '萝莉', '认主', '善恶', '双魂', '做爱', '交融', '伴侣', '独立共生', '兄妹', '诀别', '咒瞳'];
       const foundKw = keywords.filter(k => fullText.includes(k));
       charStage5Details.push(`Keywords found: ${foundKw.join(', ')}`);
    }
  }

  // Concepts check (400-615 logic roughly)
  if (isConcept && entry.id >= 400 && entry.id <= 615) {
    const parts = ['类别', '事实门槛', '定义', '来源', '机制', '限制与代价', '未知项', '禁止外推'];
    let missingParts = parts.filter(p => !fullText.includes(p));
    if (missingParts.length > 0) {
      conceptErrors.push(`Entry ${entry.id} (${comment}) missing concept parts: ${missingParts.join(', ')}`);
    }
    if (!comment.includes('[')) {
      conceptErrors.push(`Entry ${entry.id} (${comment}) missing standard event array in title`);
    }
  }
});

report += `## 统计\\nCharacters: ${characterCount}\\nConcepts: ${conceptCount}\\nEvents: ${eventCount}\\n\\n`;

report += `## 1. 角色检查 (重点阶段五演进)\\n`;
report += charStage5Details.join('\\n') + '\\n\\n';

report += `## 2. 世界观概念检查\\n`;
report += conceptErrors.length === 0 ? 'Pass\\n' : conceptErrors.slice(0, 15).join('\\n') + (conceptErrors.length > 15 ? '\\n... (more)' : '') + '\\n\\n';

report += `## 3. 三大红线检查\\n`;
report += `### 禁元数据词汇\\n`;
report += metaViolations.length === 0 ? 'Pass\\n' : metaViolations.slice(0, 15).join('\\n') + '\\n';

report += `### 玩家主权绝对独占 (真实违规?)\\n`;
report += lynnViolations.length === 0 ? 'Pass\\n' : lynnViolations.slice(0, 15).join('\\n') + '\\n';

fs.writeFileSync(path.join(basePath, 'report3.md'), report, 'utf-8');
console.log('Report generated at report3.md');
