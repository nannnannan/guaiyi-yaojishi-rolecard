// tools/upgrade-v013-registry.mjs
// 集成：把 E266-E317（52 个事件）注册进 v0.13 工程链。
//   1) src/scripts/schema.js：anchorTitles 追加 E266-E317 + 锚点状态对象追加
//   2) src/initial_variables.json：事件.锚点状态 追加 E266-E317（标题/未触发/收尾false）
//   3) src/ui/status.html：ADVANCE_PAIRS 追加 E265→E266 ... E316→E317；FALLBACK_STATE 锚点追加；
//      UI 阶段徽章（STAGE BADGES）追加 S36-S40
//   4) src/worldbook.json 事件素材：UID 965-1016（52 条）
// 全部带备份（*.bak-v012-baseline），可回滚。
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { root, backup, readJson, writeJson, readText, writeText, eventTitlesFromFiles, STAGE9_NAMES, STAGE9_EVENTS } from './v013-common.mjs';

const TITLES = eventTitlesFromFiles();
const NEW_IDS = Object.keys(TITLES); // E266..E317 共 52
console.log(`事件标题提取：${NEW_IDS.length} 个（E${NEW_IDS[0].slice(1)}-E${NEW_IDS.at(-1).slice(1)}）`);
if (NEW_IDS.length !== 52) throw new Error(`期望 52 个事件，实际 ${NEW_IDS.length}`);

// ========== 1. schema.js ==========
const schemaPath = resolve(root, 'src/scripts/schema.js');
backup(schemaPath);
let schema = readText(schemaPath);
if (!schema.includes('E266:')) {
  const titleLines = NEW_IDS.map(id => `  ${id}: '${TITLES[id]}',`).join('\n');
  // anchorTitles 对象尾：E265 行 + 换行（保持缩进）
  const titleRe = /(  E265: '[^']*',\n)(\};)/;
  if (!titleRe.test(schema)) throw new Error('schema.js anchorTitles 未找到 E265 尾行');
  schema = schema.replace(titleRe, `$1${titleLines}\n$2`);
  // 锚点状态对象尾：E265: anchor,
  const anchorRe = /(      E265: anchor,\n)(    \}\)\,)/;
  if (!anchorRe.test(schema)) throw new Error('schema.js 锚点状态未找到 E265: anchor');
  const anchorLines = NEW_IDS.map(id => `      ${id}: anchor,`).join('\n');
  schema = schema.replace(anchorRe, `$1${anchorLines}\n$2`);
  // phaseNames 扩展 S36-S40（追加到 S35 后）；若无 phaseNames 则跳过
  if (schema.includes("S35:")) {
    const s36 = Object.entries(STAGE9_NAMES).map(([s, n]) => `  ${s}: '${n}',`).join('\n');
    const phaseRe = /(  S35: '[^']*',\n)(\};)/;
    if (phaseRe.test(schema)) schema = schema.replace(phaseRe, `$1${s36}\n$2`);
  }
  writeText(schemaPath, schema);
  console.log('schema.js：anchorTitles + 锚点状态 + phaseNames 已追加 E266-E317 / S36-S40');
} else {
  console.log('schema.js 已含 E266（跳过）');
}

// ========== 2. initial_variables.json ==========
const ivPath = resolve(root, 'src/initial_variables.json');
backup(ivPath);
const iv = readJson(ivPath);
if (!iv.事件.锚点状态.E266) {
  for (const id of NEW_IDS) {
    iv.事件.锚点状态[id] = { 标题: TITLES[id], 状态: '未触发', 收尾: false };
  }
  writeJson(ivPath, iv);
  console.log('initial_variables.json：锚点状态已追加 E266-E317');
} else {
  console.log('initial_variables.json 已含 E266（跳过）');
}

// ========== 3. status.html ==========
const statusPath = resolve(root, 'src/ui/status.html');
backup(statusPath);
let status = readText(statusPath);

// 3a. ADVANCE_PAIRS 追加（E265→E266 ... E316→E317）
if (!status.includes("from: 'E265', to: 'E266'")) {
  const pairLines = [];
  for (let n = 265; n <= 316; n += 1) {
    const from = `E${n}`; const to = `E${n + 1}`;
    pairLines.push(`        { from: '${from}', to: '${to}', label: '结算并承接 ${to}' },`);
  }
  const needle = `        { from: 'E264', to: 'E265', label: '结算并承接 E265' },`;
  if (!status.includes(needle)) throw new Error('status.html 未找到 E264→E265 桥行');
  status = status.replace(needle, `${needle}\n${pairLines.join('\n')}`);
  console.log('status.html：ADVANCE_PAIRS 追加 E265→E266 ... E316→E317');
} else {
  console.log('status.html 已含 E265→E266（跳过）');
}

// 3b. FALLBACK_STATE 锚点追加（保持与 initial_variables.json 深度一致）
// 在 "E265":{...} 结尾后、"}},"（事件根闭合）前插入
if (!status.includes('"E266"')) {
  const tailRe = /"E265":\{"标题":"[^"]*","状态":"未触发","收尾":false\}\},"唯一活跃事件"/;
  const m = status.match(tailRe);
  if (!m) throw new Error('status.html FALLBACK_STATE 未找到 E265 锚点串');
  const newAnchors = NEW_IDS.filter(id => id !== 'E265')
    .map(id => `"${id}":{"标题":"${TITLES[id]}","状态":"未触发","收尾":false}`)
    .join(',');
  status = status.replace(tailRe, `"E265":{"标题":"${TITLES.E265}","状态":"未触发","收尾":false},${newAnchors}},"唯一活跃事件"`);
  console.log('status.html：FALLBACK_STATE 锚点追加 E266-E317');
}

// 3c. 阶段徽章 UI（若存在 S35 徽章结构，追加 S36-S40）；无结构则跳过
if (status.includes('S35') && status.includes('阶段徽章') === false) {
  // status.html 徽章以「宽阶段」渲染，未发现独立徽章数组，跳过（仅记录）
  console.log('status.html：未发现独立阶段徽章数组（跳过 UI 徽章）');
}
const stageInUi = [...status.matchAll(/'S\d{2}'/g)].map(m => m[0]);
console.log(`status.html 含阶段标记：${[...new Set(stageInUi)].join(' ')}`);

writeText(statusPath, status);
console.log('status.html 写入完成');

// ========== 4. worldbook.json 事件素材 UID 965-1016 ==========
const wbPath = resolve(root, 'src/worldbook.json');
backup(wbPath);
const wb = readJson(wbPath);
if (!wb.entries.some(e => e.id === 965)) {
  const eventDir = resolve(root, 'src/events');
  const names = readdirSync(eventDir);
  const materialEntries = [];
  for (let i = 0; i < NEW_IDS.length; i += 1) {
    const id = NEW_IDS[i];
    const file = names.find(n => n.startsWith(`${id}_`));
    if (!file) throw new Error(`事件文件缺失: ${id}`);
    materialEntries.push({
      id: 965 + i,
      comment: `[事件]${id}·${TITLES[id]}`,
      keys: [id],
      enabled: false,
      constant: false,
      insertion_order: 700 + i,
      content_file: `src/events/${file}`,
      extensions: { exclude_recursion: true, prevent_recursion: true },
    });
  }
  wb.entries.push(...materialEntries);
  writeJson(wbPath, wb);
  console.log(`worldbook.json：事件素材 UID 965-1016 已注册（${materialEntries.length} 条），总条目 ${wb.entries.length}`);
} else {
  console.log('worldbook.json 已含 UID965（跳过）');
}

console.log('=== registry(事件) 集成完成 ===');