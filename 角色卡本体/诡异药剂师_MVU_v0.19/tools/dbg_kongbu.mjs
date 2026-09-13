import fs from 'node:fs';
const t = fs.readFileSync('src/concepts/物品/恐怖书籍.md', 'utf8').replace(/\r\n/g, '\n');
const blocks = [...t.matchAll(/<%([-_=]?)([\s\S]*?)[-_]?%>/g)];
console.log('EJS块数:', blocks.length);
const code = 'let __out = "";\n' + blocks.map(x => x[2]).join('\n');
try {
  new Function('getvar', code);
  console.log('语句拼接 OK');
} catch (e) {
  console.log('FAIL:', e.message);
  blocks.forEach((x, i) => console.log(`---块${i}---`, JSON.stringify(x[0]), '=>', JSON.stringify(x[2])));
}
