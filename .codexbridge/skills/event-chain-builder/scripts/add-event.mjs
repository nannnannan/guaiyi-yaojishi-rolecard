#!/usr/bin/env node
// 事件链脚手架：为 MVU Zod 角色卡版本目录生成新事件文件，并输出全链路同步片段。
// 用法：
//   node add-event.mjs <版本目录> <E13> <事件标题> [--dry-run]
// 例：
//   node add-event.mjs 诡异药剂师_MVU_v0.3.3.1 E13 新事件标题 --dry-run

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function fail(message) {
  console.error(`[add-event] 错误：${message}`);
  console.error('用法：node add-event.mjs <版本目录> <E13> <事件标题> [--dry-run]');
  process.exit(1);
}

if (args.length < 3) fail('参数不足');

const [versionDirArg, eventId, titleArg] = args;
const dryRun = args.includes('--dry-run');
const versionDir = path.resolve(versionDirArg);
const title = titleArg.trim();

if (!/^E\d+$/i.test(eventId)) fail('事件ID必须形如 E13');
if (!title) fail('事件标题不能为空');

const num = Number(eventId.slice(1).toUpperCase());
if (!Number.isInteger(num) || num < 1) fail('事件序号必须为正整数');

const prevId = `E${String(num - 1).padStart(2, '0')}`;
const nextId = `E${String(num + 1).padStart(2, '0')}`;
const varName = `s${num}`;
const endName = `e${num}End`;
const prevEndName = `e${num - 1}End`;
const prevVar = `e${num - 1}s`;
const fileName = `${eventId}_${title.replace(/[\\/:*?"<>|]/g, '').trim()}.md`;
const eventsDir = path.join(versionDir, 'src', 'events');

const eventFile = [
  `<%_ const ${varName} = getvar("stat_data.事件.锚点状态.${eventId}.状态", { defaults: "未触发" }); if (${varName} === "未触发") { _%>`,
  `# ${eventId}·${title}`,
  '（本事件尚未进入预兆，详情暂不公开；触发时机见常驻「即时衔接段」。）',
  `<%_ } else { _%>`,
  `# ${eventId}·${title}`,
  '',
  '- 阶段：',
  '- 地点：',
  '- 前置条件：',
  '- 参与者与动机：',
  '- 默认走向：',
  '- 紧迫度：',
  '- 幕后停止点：',
  '- 变形条件：',
  '- 完成条件：',
  '- 取消条件：',
  '- 结果影响：',
  '- 系统提示：',
  '',
  `## 下一事件引入（${nextId}·待定）`,
  '- 触发时机：',
  '- 剧情引子：',
  '- 预兆写法：',
  '- 承接因果：',
  '<%_ } _%>',
  '',
].join('\n');

const outPath = path.join(eventsDir, fileName);

if (!dryRun) {
  if (!fs.existsSync(eventsDir)) fail(`找不到事件目录：${eventsDir}`);
  if (fs.existsSync(outPath)) fail(`文件已存在：${outPath}`);
  fs.writeFileSync(outPath, eventFile, 'utf8');
  console.log(`[add-event] 已生成：${outPath}`);
} else {
  console.log(`[add-event] DRY-RUN：将生成 ${outPath}`);
}

const snippetLines = [
  '',
  '=== 以下为全链路同步片段（按需粘贴后补全内容） ===',
  '',
  '1) src/prompts/mainline.md · ctx 数组追加：',
  `  { id: '${eventId}', title: '${title}', line: '因果摘要（写事件时补）' },`,
  '',
  `2) src/prompts/mainline.md · 新增桥段（${prevId}→${eventId}，需 ${prevVar} 已在前面声明）：`,
  `<%_ const ${prevEndName} = getvar("stat_data.事件.锚点状态.${prevId}.收尾", { defaults: false }); const ${varName} = getvar("stat_data.事件.锚点状态.${eventId}.状态", { defaults: "未触发" }); if ((${prevVar} === "完成" || ${prevVar} === "变形" || ${prevVar} === "取消" || (${prevVar} === "活跃" && ${prevEndName} === true)) && (${varName} === "未触发" || ${varName} === "预兆")) { _%>`,
  `### ${prevId}→${eventId} · 前一事件标题 → ${title}`,
  '- 触发时机：',
  '- 剧情引子：',
  '- 预兆写法：',
  '- 承接因果：',
  '<%_ } _%>',
  '',
  `3) src/prompts/mainline.md · 新增桥段（${eventId}→${nextId}，需 ${varName} 已在上面声明）：`,
  `<%_ const ${endName} = getvar("stat_data.事件.锚点状态.${eventId}.收尾", { defaults: false }); const s${num + 1} = getvar("stat_data.事件.锚点状态.${nextId}.状态", { defaults: "未触发" }); if ((${varName} === "完成" || ${varName} === "变形" || ${varName} === "取消" || (${varName} === "活跃" && ${endName} === true)) && (s${num + 1} === "未触发" || s${num + 1} === "预兆")) { _%>`,
  `### ${eventId}→${nextId} · ${title} → 待定`,
  '- 触发时机：',
  '- 剧情引子：',
  '- 预兆写法：',
  '- 承接因果：',
  '<%_ } _%>',
  '',
  `4) src/ui/status.html · BRIDGE_PAIRS 追加：`,
  `  { from: '${prevId}', to: '${eventId}', title: '${title}', dir: '预兆方向一句话', loc: '地点', urgency: '中', deadline: '期限' },`,
  `  { from: '${eventId}', to: '${nextId}', title: '待定', dir: '预兆方向一句话', loc: '地点', urgency: '中', deadline: '期限' },`,
  '',
  `5) src/scripts/schema.js · anchorTitles 追加：`,
  `  ${eventId}: '${title}',`,
  '',
  `6) src/initial_variables.json · 锚点状态追加（再重新生成 first_message.md 的 initvar）：`,
  `  "${eventId}": {"标题": "${title}", "状态": "未触发", "收尾": false},`,
  '',
  `7) src/worldbook.json · 蓝灯注册（id = 300 + 序号 = ${300 + num}）：`,
  JSON.stringify({
    id: 300 + num,
    comment: `[事件]${eventId}·${title}`,
    keys: [`${eventId}`, `事件${eventId}`, '关键词'],
    constant: false,
    insertion_order: 300 + num,
    content_file: `src/events/${fileName}`,
    extensions: { exclude_recursion: true, prevent_recursion: true },
  }, null, 2),
  '',
  '8) tools/validate.mjs：bridgePairs 数组补新对；事件循环范围 12→13；',
  '   若 E13 接在 E12 之后，还需更新 E12 无引入段断言与“### E12→”边界断言。',
  '',
  '9) 完成后：重建 initvar → npm run check → 同步 README/AGENTS/host_acceptance 基线。',
  '',
];

console.log(snippetLines.join('\n'));
