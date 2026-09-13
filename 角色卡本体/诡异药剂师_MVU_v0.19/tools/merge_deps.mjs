// 把 v0.6 契约的 E21-E35 依赖表合并回 v0.7 契约（E36-E64 之前）
import fs from 'node:fs';
const v06 = JSON.parse(fs.readFileSync('../诡异药剂师_MVU_v0.6/contract.json', 'utf8'));
const v07 = JSON.parse(fs.readFileSync('contract.json', 'utf8'));
const oldDeps = v06.required.event_dependencies;
const newDeps = {};
for (const id of Object.keys(oldDeps).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
  if (Number(id.slice(1)) <= 35) newDeps[id] = oldDeps[id];
}
for (const [id, dep] of Object.entries(v07.required.event_dependencies)) newDeps[id] = dep;
v07.required.event_dependencies = newDeps;
fs.writeFileSync('contract.json', JSON.stringify(v07, null, 4) + '\n', 'utf8');
console.log('依赖表合并完成：', Object.keys(newDeps).join(','));
