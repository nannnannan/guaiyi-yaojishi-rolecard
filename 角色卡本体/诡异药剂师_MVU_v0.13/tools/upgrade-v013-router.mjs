// tools/upgrade-v013-router.mjs
// 集成：concept_event_router.md 的事件序列 eventSequence 扩至 E317；
// characteristics fallback（人物事件兜底映射）扩展 5 位阶段九角色（弥赛亚/左左/巨像之脑/林樱/a01银色幻想）
// 的事件范围到 E317（人物条目在 worldbook 中的 extensions.event_ids 仍按契约；router 兜底用于使人物在
// 新事件窗口 ±1 内也能被事件窗口强启）。
import { resolve } from 'node:path';
import { root, backup, readText, writeText } from './v013-common.mjs';

const routerPath = resolve(root, 'src/prompts/concept_event_router.md');
backup(routerPath);
let r = readText(routerPath);

// 1. eventSequence 扩至 E317
if (!r.includes('"E266"')) {
  const newSeq = [];
  for (let i = 266; i <= 317; i += 1) newSeq.push(`"E${i}"`);
  r = r.replace(/"E263","E264","E265"\]/, `"E263","E264","E265",${newSeq.join(',')}]`);
  console.log('router：eventSequence 扩至 E317');
} else {
  console.log('router 已含 E266（跳过）');
}

// 2. CHARACTER_EVENT_FALLBACK 扩展：5 位角色追加 E266-E317 全集（人物窗口路由兜底）
//    fallback Map 键为人物 UID：弥赛亚 298 / 左左 100 / 巨像之脑 296 / 林樱 290 / a01银色幻想 293
const fallbackKeys = {
  100: '左左',
  290: '林樱',
  293: 'a01银色幻想',
  296: '巨像之脑',
  298: '弥赛亚',
};
const STAGE9_EVENTS = [];
for (let i = 266; i <= 317; i += 1) STAGE9_EVENTS.push(`"E${i}"`);
const append = STAGE9_EVENTS.join(',');
let changed = 0;
for (const [uid, name] of Object.entries(fallbackKeys)) {
  // 找到对应 fallback 行尾 `],` 并在其数组内追加
  const re = new RegExp(`(\\[${uid},\\[[^\\]]*\\])(\\],)`);
  const m = r.match(re);
  if (m && !r.match(new RegExp(`\\[${uid},\\[[^\\]]*"E266"`))) {
    r = r.replace(re, `$1,${append}$2`);
    changed += 1;
    console.log(`router：人物兜底 UID${uid}（${name}）追加 E266-E317`);
  } else if (!m) {
    console.log(`router：未找到 UID${uid} fallback 行（跳过）`);
  } else {
    console.log(`router：UID${uid}（${name}）已含 E266（跳过）`);
  }
}
if (changed === 0) console.log('router：人物兜底无需变更');

writeText(routerPath, r);
console.log('=== router 集成完成 ===');