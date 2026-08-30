const fs = require('fs');
const dirPath = 'C:/Users/huang/Desktop/《诡异药剂师》同人角色卡制作计划/角色卡本体/诡异药剂师_MVU_v0.12';
const html = fs.readFileSync(dirPath + '/src/ui/status.html', 'utf8');

console.log('status.html length:', html.length, 'bytes');

// Check bridge definitions
const bridges = [...html.matchAll(/from:\s*'(E\d{2,3})',\s*to:\s*'(E\d{2,3})'/g)];
console.log('Bridges count:', bridges.length);
console.log('First bridge:', bridges[0]?.[0]);
console.log('Last bridge:', bridges[bridges.length - 1]?.[0]);

// Check external resources (http://, https://)
const externalUrls = [...html.matchAll(/https?:\/\/[^\s"'<>]+/g)].map(m => m[0]);
console.log('External URLs found in status.html:', externalUrls);

// Check for event IDs range
const eventIdMatches = new Set([...html.matchAll(/E\d{2,3}/g)].map(m => m[0]));
console.log('Distinct event IDs referenced in status.html:', eventIdMatches.size);
console.log('Has E01:', eventIdMatches.has('E01'), 'Has E218:', eventIdMatches.has('E218'), 'Has E265:', eventIdMatches.has('E265'));

// Check phase definitions in status.html
const phaseMatches = [...html.matchAll(/S\d{1,2}/g)].map(m => m[0]);
console.log('Distinct phase IDs referenced in status.html:', new Set(phaseMatches));

// Check character rendering logic in status.html
const charNames = [
  '左左', '血锯', '血衣女士', '小小', '人偶夫人', '爱丽丝', '白逸', '泰坦头颅',
  '巫神头颅', '小宝贝', '倒吊天使', '白夜', '渡鸦', '黑颅', '猪头屠夫',
  '哭泣小丑', '黑白小丑', '黑弦月', '喵喵', '林樱', '艾雯爵士', '羽毛笔',
  'a01银色幻想', '欲望母树', '万机之神', '巨像之脑', '血肉支配者', '弥赛亚'
];
console.log('\nChecking character specific logic in status.html:');
for (const char of charNames) {
  const present = html.includes(char);
  if (!present) {
    console.log(`Character ${char} NOT found in status.html`);
  }
}
