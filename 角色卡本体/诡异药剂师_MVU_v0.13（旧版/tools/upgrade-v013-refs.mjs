// tools/upgrade-v013-refs.mjs
// 集成：把 src 内残留的 v0.12 版本引用统一同步到 v0.13（不含内容文件 src/events、src/concepts、
// src/characters——那些正文引用旧版口径属内容既有事实，不在此步改写）。
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { root, backup, readJson, writeJson, readText, writeText } from './v013-common.mjs';

const updates = [];

// 1. src/card.json 已由 meta 脚本处理（跳过）
// 2. src/regex_scripts.json（脚本 id/name）
const regexPath = resolve(root, 'src/regex_scripts.json');
backup(regexPath);
const regex = readJson(regexPath);
let regexChanged = 0;
for (const s of regex) {
  if (typeof s.id === 'string' && s.id.includes('v0.12')) { s.id = s.id.replaceAll('v0.12', 'v0.13'); regexChanged += 1; }
  if (typeof s.scriptName === 'string' && s.scriptName.includes('v0.12')) { s.scriptName = s.scriptName.replaceAll('v0.12', 'v0.13'); regexChanged += 1; }
}
if (regexChanged) { writeJson(regexPath, regex); updates.push(`regex_scripts.json（${regexChanged} 处）`); }

// 3. src/worldbook.json name/description
const wbPath = resolve(root, 'src/worldbook.json');
backup(wbPath);
const wb = readJson(wbPath);
if (wb.name?.includes('v0.12')) { wb.name = wb.name.replaceAll('v0.12', 'v0.13'); updates.push('worldbook.json name'); }
if (wb.description?.includes('v0.12')) {
  wb.description = wb.description.replaceAll('v0.12', 'v0.13')
    .replace('二百六十五事件锚点', '三百一十七事件锚点')
    .replace('S0至S35全部三十六阶段', 'S0至S40全部四十一阶段');
  updates.push('worldbook.json description');
}
writeJson(wbPath, wb);

// 4. schema.js 卡名 literal + console 标签
const schemaPath = resolve(root, 'src/scripts/schema.js');
backup(schemaPath);
let schema = readText(schemaPath);
if (schema.includes("z.literal('《诡异药剂师》v0.12')")) { schema = schema.replaceAll("z.literal('《诡异药剂师》v0.12')", "z.literal('《诡异药剂师》v0.13')"); updates.push('schema.js 卡名 literal'); }
if (schema.includes('诡异药剂师v0.12')) { schema = schema.replaceAll('诡异药剂师v0.12', '诡异药剂师v0.13'); updates.push('schema.js console 标签'); }
writeText(schemaPath, schema);

// 5. mvu_loader.js console 标签
const loaderPath = resolve(root, 'src/scripts/mvu_loader.js');
backup(loaderPath);
let loader = readText(loaderPath);
if (loader.includes('诡异药剂师v0.12')) { loader = loader.replaceAll('诡异药剂师v0.12', '诡异药剂师v0.13'); updates.push('mvu_loader.js console 标签'); }
writeText(loaderPath, loader);

// 6. status.html 徽章文本
const statusPath = resolve(root, 'src/ui/status.html');
backup(statusPath);
let status = readText(statusPath);
if (status.includes('《诡异药剂师》v0.12')) { status = status.replaceAll('《诡异药剂师》v0.12', '《诡异药剂师》v0.13'); updates.push('status.html 徽章'); }
writeText(statusPath, status);

// 7. alternate_greeting_e25.md initvar 元数据
const altPath = resolve(root, 'src/prompts/alternate_greeting_e25.md');
backup(altPath);
let alt = readText(altPath);
if (alt.includes('《诡异药剂师》v0.12')) { alt = alt.replaceAll('《诡异药剂师》v0.12', '《诡异药剂师》v0.13'); updates.push('alternate_greeting_e25.md 元数据'); }
if (alt.includes('"版本": "0.12.0"')) { alt = alt.replaceAll('"版本": "0.12.0"', '"版本": "0.13.0"'); updates.push('alternate_greeting_e25.md 版本'); }
writeText(altPath, alt);

// 8. prompts 版本引用（system.md / world.md / card_description.md）
for (const f of ['src/prompts/system.md', 'src/prompts/world.md', 'src/prompts/card_description.md']) {
  const p = resolve(root, f);
  backup(p);
  let t = readText(p);
  const before = t;
  t = t.replaceAll('《诡异药剂师》v0.12', '《诡异药剂师》v0.13');
  t = t.replaceAll('E01至E265', 'E01至E317');
  t = t.replaceAll('二百六十五个重大事件锚点', '三百一十七个重大事件锚点');
  t = t.replace('E265是当前开放终点：炽天使魂灯点亮、克苏鲁注视；剧情严格止于梵蒂冈深层探索前，严禁越界创建E266或引出后续。', 'E317是当前开放终点：小树洞浮现、欲望母树臣服与园丁任务悬置；剧情严格止于林恩面对小树洞、尚未踏入，严禁越界创建E318或引出后续。');
  if (t !== before) { writeText(p, t); updates.push(f); }
}

console.log('=== v0.12 引用同步完成 ===');
console.log(updates.join('\n'));