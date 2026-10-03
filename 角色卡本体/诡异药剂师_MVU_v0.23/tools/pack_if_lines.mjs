// 在 build.mjs 前运行：把 src/if_lines/{eventfile}.md 追加到 src/worldbook.json 对应事件条目的 content_file 链
// 用法: node tools/pack_if_lines.mjs  (在 build 之前调用)
// 只做一件事：读 worldbook.json → 对每个事件条目，若存在 if_lines/{same basename}.md → 在 content_files 数组末尾追加该路径；若条目单 content_file→改为 content_files=[原,if_lines...]；然后把结果写回 src/worldbook.json。
// 已校验：所有路径在 src/ 下，不往 src 之外写。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORLDBOOK = resolve(ROOT, 'src/worldbook.json');
const IF_DIR = resolve(ROOT, 'src/if_lines');

if (!existsSync(IF_DIR)) {
  console.log('[pack_if_lines] src/if_lines not found, skip');
  process.exit(0);
}

const wb = JSON.parse(readFileSync(WORLDBOOK, 'utf8'));
let patched = 0;
let skipped = 0;

for (const entry of wb.entries) {
  // 事件条目：content_file 指向 src/events/E{XX}_{标题}.md
  const cf = entry.content_file ?? null;
  if (!cf || typeof cf !== 'string') continue;
  if (!cf.startsWith('src/events/')) continue;

  const eventFileBase = basename(cf, '.md');  // e.g., E01_系统觉醒与开店
  const ifPath = `src/if_lines/${eventFileBase}.md`;
  const ifFullPath = resolve(ROOT, ifPath);
  if (!existsSync(ifFullPath)) {
    skipped++;
    continue;
  }

  // 已存在 content_files 数组则直接追加；否则把单 content_file 改为 content_files
  if (Array.isArray(entry.content_files)) {
    if (!entry.content_files.includes(ifPath)) {
      entry.content_files.push(ifPath);
      patched++;
    }
    // 移除单 content_file 防止重复
    if (entry.content_file) delete entry.content_file;
  } else {
    entry.content_files = [cf, ifPath];
    delete entry.content_file;
    patched++;
  }
}

writeFileSync(WORLDBOOK, JSON.stringify(wb, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ status: 'patched', patched, skipped, total_events: wb.entries.length }, null, 2));
