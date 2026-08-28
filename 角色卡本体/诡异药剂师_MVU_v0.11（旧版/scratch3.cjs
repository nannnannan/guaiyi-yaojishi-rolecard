const html = require('fs').readFileSync('src/ui/status.html', 'utf8');
const schema = require('fs').readFileSync('src/scripts/schema.js', 'utf8');

const bridgeMatch = html.match(/const BRIDGE_PAIRS = \[([\s\S]*?)\];/);
const pairs = [];
if(bridgeMatch){
  // eval the array carefully, since it's just JS object literals
  const str = bridgeMatch[1].replace(/\/\/.*$/gm, '');
  const items = str.split('},').map(s => s.trim() + (s.includes('}') ? '' : '}')).filter(s => s.includes('title:'));
  for(const item of items) {
    const titleMatch = item.match(/title:\s*['"](.*?)['"]/);
    const toMatch = item.match(/to:\s*['"](.*?)['"]/);
    if(titleMatch && toMatch) pairs.push({id: toMatch[1], title: titleMatch[1]});
  }
}

const anchorMatch = schema.match(/const anchorTitles = \{([\s\S]*?)\};/);
const anchors = {};
if (anchorMatch) {
  const lines = anchorMatch[1].split('\n');
  for(const line of lines) {
    const m = line.match(/(E\d+):\s*['"](.*?)['"]/);
    if (m) anchors[m[1]] = m[2];
  }
}

const mismatches = [];
for (const p of pairs) {
  if (anchors[p.id] && anchors[p.id] !== p.title) {
    mismatches.push(`ID: ${p.id}, status: '${p.title}', schema: '${anchors[p.id]}'`);
  }
}

console.log('Mismatches:');
console.log(mismatches.join('\n'));
