import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const workRoot = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const groupIndex = args.indexOf('--group');
const groupName = groupIndex >= 0 ? args[groupIndex + 1] : 'G2';
const completeMode = args.includes('--complete');
const groupRanges = {
  G1: [318, 323],
  G2: [324, 328],
  G3: [329, 333],
  G4: [334, 338],
  G5: [339, 343],
  G6: [344, 348],
};

if (!groupRanges[groupName]) {
  console.error(`未知分组：${groupName}`);
  process.exit(2);
}

const groupRoot = path.join(workRoot, '阶段10_精加工', groupName);
const eventRoot = path.join(groupRoot, '事件');
const conceptRoots = [path.join(groupRoot, '概念'), path.join(groupRoot, '新增概念')];
const errors = [];
const warnings = [];
let checks = 0;

function ok(condition, message) {
  checks += 1;
  if (!condition) errors.push(message);
}

function filesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dir, entry.name));
}

function chars(text) {
  return [...text].length;
}

function rel(file) {
  return path.relative(workRoot, file).replaceAll('\\', '/');
}

const requiredEventFields = [
  '玩家主权',
  '阶段',
  '地点',
  '前置条件',
  '参与者与动机',
  '默认走向',
  '紧迫度',
  '幕后停止点',
  '变形条件',
  '完成条件',
  '取消条件',
  '结果影响',
  '系统提示',
];
const nextFields = ['触发时机', '剧情引子', '预兆写法', '承接因果'];
const requiredConceptFields = [
  '类别',
  '事实门槛',
  '定义',
  '来源',
  '机制',
  '限制与代价',
  '未知项',
  '禁止外推',
];
const conceptCategories = new Set([
  '机制',
  '人物',
  '物品',
  '能力',
  '地点',
  '势力',
  '场景',
  '诅咒',
  '成就',
  '特殊',
  '事件',
  '生物',
]);
const forbiddenPatterns = [
  [/第\s*\d+\s*章/u, '原文章节号'],
  [/小总结/u, '小总结'],
  [/大总结/u, '大总结'],
  [/阶段(?:十|十一|十二|十三|十四|十五|十六|十七|十八)(?![九十])/u, '编辑阶段名'],
  [/\bP\d+\b/u, '原文分包编号'],
  [/分包/u, '分包元数据'],
  [/自愿/u, '基线禁词“自愿”'],
  [/(?:次日|翌日|第二天)/u, '滚动时间禁词'],
  [/候选稿/u, '候选稿制作口吻'],
  [/新事实从/u, '分包边界制作口吻'],
  [/原作参考/u, '原作来源制作口吻'],
  [/原文把/u, '原文来源制作口吻'],
  [/本事件是[^\n]*大事件/u, '大事件规格制作口吻'],
  [/这里先停/u, '场景调度制作口吻'],
  [/原作关系分支/u, '分支来源制作口吻'],
  [/原作后续/u, '后续来源制作口吻'],
  [/若原作事故/u, '原作事故制作口吻'],
  [/原作中的/u, '原作来源制作口吻'],
  [/只作E\d+预兆/u, '事件编排制作口吻'],
  [/这里必须停/u, '场景调度制作口吻'],
  [/虽明确成年/u, '年龄免责声明'],
  [/由C\d+[^。；\n]*(?:说明|承担)/u, '跨概念编辑说明'],
  [/见C\d+/u, '跨概念编辑引用'],
  [/本条只记录/u, '条目职责编辑口吻'],
  [/职责分离/u, '职责分离编辑口吻'],
  [/把边界写得很清楚/u, '编辑评价'],
  [/——/u, '破折号'],
  [/�/u, '替换字符'],
];

const eventFiles = filesIn(eventRoot)
  .filter((file) => /^E\d+_.+\.md$/u.test(path.basename(file)))
  .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
const [rangeStart, rangeEnd] = groupRanges[groupName];
const expectedEventIds = Array.from(
  { length: rangeEnd - rangeStart + 1 },
  (_, index) => `E${rangeStart + index}`,
);
const actualEventIds = [];
const eventLengths = [];

for (const file of eventFiles) {
  const fileRel = rel(file);
  const text = fs.readFileSync(file, 'utf8');
  const filenameMatch = path.basename(file).match(/^E(\d+)_/u);
  ok(Boolean(filenameMatch), `${fileRel}: 文件名缺少E编号`);
  if (!filenameMatch) continue;
  const eventNumber = Number(filenameMatch[1]);
  const eventId = `E${eventNumber}`;
  actualEventIds.push(eventId);

  ok(
    text.startsWith(
      `<%_ const s${eventNumber} = getvar("stat_data.事件.锚点状态.${eventId}.状态", { defaults: "未触发" }); if (s${eventNumber} === "未触发") { _%>`,
    ),
    `${fileRel}: EJS开头与编号不一致`,
  );
  ok(text.trimEnd().endsWith('<%_ } _%>'), `${fileRel}: EJS闭合缺失`);
  ok(
    (text.match(new RegExp(`^# ${eventId}·`, 'gmu')) ?? []).length >= 2,
    `${fileRel}: 完整与占位分支均须含事件标题`,
  );
  ok(text.includes('本事件尚未进入预兆，详情暂不公开'), `${fileRel}: 未触发占位缺失`);

  for (const field of requiredEventFields) {
    ok(new RegExp(`^- ${field}：`, 'mu').test(text), `${fileRel}: 缺少字段“${field}”`);
  }
  ok(/^- 引用概念：/mu.test(text), `${fileRel}: 缺少引用概念`);

  const direction = text.match(/^- 默认走向：([\s\S]*?)\r?\n- 紧迫度：/mu)?.[1]?.trim();
  ok(Boolean(direction), `${fileRel}: 无法提取默认走向`);
  if (direction) {
    const length = chars(direction);
    eventLengths.push({ eventId, length });
    ok(length >= 500, `${fileRel}: 默认走向${length}字，少于500`);
    ok(length <= 2200, `${fileRel}: 默认走向${length}字，超过大事件约2000字的容差上限2200`);
    if (length > 1000) warnings.push(`${fileRel}: 默认走向${length}字，须在报告中说明大事件判定`);
  }

  for (const [pattern, label] of forbiddenPatterns) {
    ok(!pattern.test(text), `${fileRel}: 命中禁用内容“${label}”`);
  }

  if (groupName === 'G6' && eventId === 'E348') {
    ok(!text.includes('## 下一事件引入'), fileRel + ': E348终点不得包含下一事件引入');
    continue;
  }
  const next = text.match(/^## 下一事件引入（E(\d+)·(.+)）$/mu);
  ok(Boolean(next), `${fileRel}: 缺少下一事件引入`);
  if (next) {
    ok(Number(next[1]) === eventNumber + 1, `${fileRel}: 下一事件应为E${eventNumber + 1}`);
    for (const field of nextFields) {
      ok(new RegExp(`^- ${field}：`, 'mu').test(text), `${fileRel}: 下一事件缺少“${field}”`);
    }
  }
}

ok(
  JSON.stringify(actualEventIds) === JSON.stringify(expectedEventIds),
  `${groupName}: 事件集合应为${expectedEventIds.join(',')}，实际为${actualEventIds.join(',') || '空'}`,
);

try {
  const projectRoot = path.resolve(workRoot, '..', '..');
  const require = createRequire(import.meta.url);
  const ejs = require(
    path.join(workRoot, 'node_modules', 'ejs'),
  );
  for (const file of eventFiles) {
    try {
      ejs.compile(fs.readFileSync(file, 'utf8'), { client: true, filename: file });
      ok(true, `${rel(file)}: EJS编译`);
    } catch (error) {
      ok(false, `${rel(file)}: EJS编译失败：${error.message}`);
    }
  }
} catch (error) {
  errors.push(`无法加载v0.13的EJS依赖：${error.message}`);
}

const conceptFiles = conceptRoots
  .flatMap(filesIn)
  .filter((file) => /^[CW]\d+_.+\.md$/u.test(path.basename(file)))
  .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
const seenConceptIds = new Map();

for (const file of conceptFiles) {
  const fileRel = rel(file);
  const text = fs.readFileSync(file, 'utf8');
  const conceptId = path.basename(file).match(/^([CW]\d+)_/u)?.[1];
  ok(Boolean(conceptId), `${fileRel}: 文件名缺少C/W编号`);
  if (!conceptId) continue;

  if (seenConceptIds.has(conceptId)) {
    errors.push(`${fileRel}: 逻辑编号${conceptId}与${seenConceptIds.get(conceptId)}重复`);
  } else {
    seenConceptIds.set(conceptId, fileRel);
  }

  ok(!text.startsWith('@@private'), `${fileRel}: 概念禁止@@private`);
  ok(!text.includes('@@private'), `${fileRel}: 概念正文不得出现@@private`);
  const firstLine = text.split(/\r?\n/u, 1)[0];
  const title = firstLine.match(/^# 概念·([^·]+)·(.+)（事件\[(.*)\]）$/u);
  ok(Boolean(title), `${fileRel}: 首行概念标题格式不正确`);
  if (title) {
    ok(conceptCategories.has(title[1]), `${fileRel}: 类别“${title[1]}”不在允许集合`);
    const eventIds = [...title[3].matchAll(/"(E\d+)"/gu)].map((match) => match[1]);
    ok(eventIds.length > 0, `${fileRel}: 标题事件数组为空`);
    for (const eventId of eventIds) {
      const number = Number(eventId.slice(1));
      ok(number >= 1 && number <= 798, `${fileRel}: 事件ID${eventId}越界`);
      if (groupName === 'G2') {
        ok(number <= 328, `${fileRel}: G2概念提前引用${eventId}，应留待后续分组`);
      }
      if (groupName === 'G3') {
        ok(number <= 333, `${fileRel}: G3概念提前引用${eventId}，应留待后续分组`);
      }
      if (groupName === 'G4') {
        ok(number <= 338, `${fileRel}: G4概念提前引用${eventId}，应留待后续分组`);
      }
      if (groupName === 'G5') {
        ok(number <= 343, `${fileRel}: G5概念提前引用${eventId}，应留待后续分组`);
      }
    }
  }

  for (const field of requiredConceptFields) {
    ok(new RegExp(`^- ${field}：`, 'mu').test(text), `${fileRel}: 缺少字段“${field}”`);
  }
  for (const [pattern, label] of forbiddenPatterns) {
    ok(!pattern.test(text), `${fileRel}: 命中禁用内容“${label}”`);
  }

  if (file.includes(`${path.sep}新增概念${path.sep}`) && groupName === 'G2') {
    const number = Number(conceptId.slice(1));
    ok(number >= 1193 && number <= 1198, `${fileRel}: G2新增概念必须使用C1193-C1198`);
  }
  if (file.includes(`${path.sep}新增概念${path.sep}`) && groupName === 'G3') {
    ok(Number(conceptId.slice(1)) >= 1199, `${fileRel}: G3新增概念必须从C1199起`);
  }
  if (file.includes(`${path.sep}新增概念${path.sep}`) && groupName === 'G4') {
    ok(Number(conceptId.slice(1)) >= 1200, `${fileRel}: G4新增概念必须从C1200起`);
  }
  if (file.includes(`${path.sep}新增概念${path.sep}`) && groupName === 'G5') {
    ok(Number(conceptId.slice(1)) >= 1202, `${fileRel}: G5新增概念必须从C1202起`);
  }
}

if (groupName === 'G2') {
  const actualNewIds = filesIn(path.join(groupRoot, '新增概念'))
    .map((file) => path.basename(file).match(/^(C\d+)_/u)?.[1])
    .filter(Boolean)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const expectedNewIds = ['C1193', 'C1194', 'C1195', 'C1196', 'C1197', 'C1198'];
  ok(
    JSON.stringify(actualNewIds) === JSON.stringify(expectedNewIds),
    `G2新增概念应为${expectedNewIds.join(',')}，实际为${actualNewIds.join(',') || '空'}`,
  );
}

if (groupName === 'G3') {
  const actualNewIds = filesIn(path.join(groupRoot, '新增概念'))
    .map((file) => path.basename(file).match(/^(C\d+)_/u)?.[1])
    .filter(Boolean)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  if (actualNewIds.length > 0) {
    const expectedNewIds = Array.from(
      { length: actualNewIds.length },
      (_, index) => `C${1199 + index}`,
    );
    ok(
      JSON.stringify(actualNewIds) === JSON.stringify(expectedNewIds),
      `G3新增概念必须从C1199连续分配，实际为${actualNewIds.join(',')}`,
    );
  }
}

if (groupName === 'G4') {
  const actualNewIds = filesIn(path.join(groupRoot, '新增概念'))
    .map((file) => path.basename(file).match(/^(C\d+)_/u)?.[1])
    .filter(Boolean)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  if (actualNewIds.length > 0) {
    const expectedNewIds = Array.from(
      { length: actualNewIds.length },
      (_, index) => `C${1200 + index}`,
    );
    ok(
      JSON.stringify(actualNewIds) === JSON.stringify(expectedNewIds),
      `G4新增概念必须从C1200连续分配，实际为${actualNewIds.join(',')}`,
    );
  }
}

if (groupName === 'G5') {
  const actualNewIds = filesIn(path.join(groupRoot, '新增概念'))
    .map((file) => path.basename(file).match(/^(C\d+)_/u)?.[1])
    .filter(Boolean)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  if (actualNewIds.length > 0) {
    const expectedNewIds = Array.from(
      { length: actualNewIds.length },
      (_, index) => `C${1202 + index}`,
    );
    ok(
      JSON.stringify(actualNewIds) === JSON.stringify(expectedNewIds),
      `G5新增概念必须从C1202连续分配，实际为${actualNewIds.join(',')}`,
    );
  }
}

if (completeMode) {
  ok(fs.existsSync(path.join(groupRoot, '报告.md')), `${groupName}: 完整验收缺少报告.md`);
}

const summary = {
  group: groupName,
  checks,
  errors: errors.length,
  warnings: warnings.length,
  events: eventFiles.length,
  eventLengths,
  concepts: conceptFiles.length,
  completeMode,
};

console.log(JSON.stringify(summary, null, 2));
for (const warning of warnings) console.warn(`警告：${warning}`);
for (const error of errors) console.error(`错误：${error}`);
process.exitCode = errors.length > 0 ? 1 : 0;
