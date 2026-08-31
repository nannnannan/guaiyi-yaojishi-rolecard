// tools/upgrade-v013-concepts.mjs
// 集成：把 C836-C1007（172 条新概念）注册进 v0.13 worldbook.json（UID 2160-2331）。
// 概念文件已由内容管线写入 src/concepts/C8XX_*.md（v0.12 格式，8 分类目录）。
// 每条注册：
//   id = 2160 + i（C836→2160，偏移 +1324）
//   comment = [概念·<类别>]<名称>
//   keys = 从概念标题拆词（名称截断与完整名双 key）
//   enabled:false / constant:false / insertion_order 400+i / content_file / 双递归保护
// 只读取概念文件（不改写内容）；C830-C835 旧文件不重复注册。
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { root, backup, readJson, writeJson, readText } from './v013-common.mjs';

const wbPath = resolve(root, 'src/worldbook.json');
backup(wbPath);
const wb = readJson(wbPath);
if (wb.entries.some(e => e.id === 2160)) {
  console.log('worldbook.json 已含 UID2160（跳过）');
} else {
  // 收集 C836-C1007 文件（排除 C830-C835）
  const conceptDir = resolve(root, 'src/concepts');
  const files = readdirSync(conceptDir)
    .filter(f => /^C(\d+)_/.test(f))
    .map(f => ({ file: f, num: Number(f.match(/^C(\d+)_/)[1]) }))
    .filter(x => x.num >= 836 && x.num <= 1007)
    .sort((a, b) => a.num - b.num);
  if (files.length !== 172) throw new Error(`期望 172 个概念文件，实际 ${files.length}`);
  // 连续性校验
  for (let i = 0; i < files.length; i += 1) {
    if (files[i].num !== 836 + i) throw new Error(`概念编号不连续：期望 C${836 + i}，实际 C${files[i].num}`);
  }

  const entries = [];
  // 既有全部概念 keys（去重注册时避让；阶段九属增量扩展，同名旧条目已注册，需消歧）
  const existingKeys = new Set(
    wb.entries
      .filter(e => e.id < 2160)
      .flatMap(e => e.keys ?? []),
  );
  for (let i = 0; i < files.length; i += 1) {
    const num = files[i].num;
    const logicalId = `C${num}`;
    const fname = files[i].file;
    const content = readText(resolve(conceptDir, fname));
    // 从正文首行提取标题：# 概念·机制·克苏鲁的注视（事件[...]）
    const heading = content.match(/^# 概念·([^\n]+)$/m)?.[1] ?? '';
    const titlePart = heading.replace(/（事件\[[^\]]+\]）\s*$/, '');
    const category = titlePart.includes('·') ? titlePart.split('·')[0] : '机制';
    const name = titlePart.includes('·') ? titlePart.split('·').slice(1).join('·') : titlePart;
    // keys：名称（若过长则截断 6 字 + 完整名）；与既有 keys 冲突时用 C 编号消歧
    let keys = name.length <= 6 ? [name] : [name.slice(0, 6), name];
    keys = keys.map(k => (existingKeys.has(k) ? `${k}(${logicalId})` : k));
    // 事件数组（从标题提取，供 tavernweave.event_ids 注册）
    const eventArrMatch = content.match(/（事件(\[[^\n]+\])）\s*$/m);
    let eventIds = [];
    if (eventArrMatch) { try { eventIds = JSON.parse(eventArrMatch[1]); } catch {} }
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      throw new Error(`概念 ${logicalId} 标题缺事件数组: ${heading}`);
    }
    entries.push({
      id: 2160 + i,
      comment: `[概念·${category}]${name}`,
      keys,
      constant: false,
      insertion_order: 400 + i,
      content_file: `src/concepts/${fname}`,
      extensions: {
        exclude_recursion: true,
        prevent_recursion: true,
        tavernweave: { logical_id: logicalId, event_ids: eventIds },
      },
      secondary_keys: [],
    });
  }

  wb.entries.push(...entries);
  writeJson(wbPath, wb);
  console.log(`worldbook.json：概念 UID 2160-2331 已注册（${entries.length} 条），总条目 ${wb.entries.length}`);
  // 抽检头尾
  console.log('首条:', JSON.stringify(entries[0]));
  console.log('末条:', JSON.stringify(entries.at(-1)));
}

console.log('=== concepts 集成完成 ===');