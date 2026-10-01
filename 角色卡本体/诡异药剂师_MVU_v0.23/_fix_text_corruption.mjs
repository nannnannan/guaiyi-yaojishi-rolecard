import fs from 'node:fs';
import path from 'node:path';

const eventsDir = 'src/events';
const files = ['E63', 'E65', 'E66', 'E67', 'E68', 'E69', 'E70'];

console.log('开始修复文本错乱...');

files.forEach(id => {
  const file = fs.readdirSync(eventsDir).find(f => f.startsWith(id + '_'));
  if (!file) {
    console.log(`${id}: 文件不存在，跳过`);
    return;
  }

  const filePath = path.join(eventsDir, file);
  const original = fs.readFileSync(filePath, 'utf8');

  // 备份原文件
  const backupPath = filePath + '.bak-fix';
  fs.writeFileSync(backupPath, original, 'utf8');

  // 修复 1：清理 CJK 字符间的空格（中文字符之间的空格）
  let fixed = original.replace(/([一-鿿])\s+([一-鿿])/g, '$1$2');

  // 修复 2：清理超长破折号（3 个以上连续——）改为标准——
  fixed = fixed.replace(/———+/g, '——');

  // 统计修复数量
  const cjkSpaceFixed = (original.match(/[一-鿿]\s+[一-鿿]/g) || []).length;
  const longDashFixed = (original.match(/———+/g) || []).length;

  // 写回修复后的内容
  fs.writeFileSync(filePath, fixed, 'utf8');

  console.log(`${id}: 修复 CJK 空格 ${cjkSpaceFixed} 处, 超长破折号 ${longDashFixed} 处, 备份到 ${path.basename(backupPath)}`);
});

console.log('修复完成');
