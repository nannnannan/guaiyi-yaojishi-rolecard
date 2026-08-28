import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputRoot = path.resolve(scriptDir, '..');
const projectRoot = path.resolve(outputRoot, '..', '..');
const completeMode = process.argv.includes('--complete');
const require = createRequire(import.meta.url);
const ejs = require(path.join(
  projectRoot,
  '角色卡本体',
  '诡异药剂师_MVU_v0.13',
  'node_modules',
  'ejs',
));

const errors = [];
let checks = 0;

function ok(condition, message) {
  checks += 1;
  if (!condition) errors.push(message);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function relative(file) {
  return path.relative(outputRoot, file).replaceAll('\\', '/');
}

const allFiles = walk(outputRoot);
const eventFiles = allFiles.filter((file) =>
  /[\\/]事件[\\/]E\d+_.+\.md$/u.test(file),
);
const registryPath = path.join(outputRoot, '概念候选', 'concept_registry.json');
const conceptRegistry = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  : { updates: [], new: [] };
const conceptRecords = [...conceptRegistry.updates, ...conceptRegistry.new];
const conceptRecordsByEvent = new Map();
for (const record of conceptRecords) {
  if (!String(record.logical_id).startsWith('C')) continue;
  for (const eventId of record.event_ids.map(String)) {
    if (!conceptRecordsByEvent.has(eventId)) conceptRecordsByEvent.set(eventId, []);
    conceptRecordsByEvent.get(eventId).push(record);
  }
}
const conceptRecordByPath = new Map(
  conceptRecords.map((record) => [path.resolve(record.output_path), record]),
);
const conceptFiles = [...conceptRecordByPath.keys()].filter((file) => fs.existsSync(file));
const pendingConceptFiles = [...conceptRecordByPath.keys()].filter((file) => !fs.existsSync(file));
const unexpectedConceptFiles = allFiles.filter(
  (file) => /[\\/]概念[\\/].+\.md$/u.test(file) && !conceptRecordByPath.has(path.resolve(file)),
);
if (completeMode) {
  ok(pendingConceptFiles.length === 0, `概念文件尚缺${pendingConceptFiles.length}个`);
}
ok(unexpectedConceptFiles.length === 0, `存在${unexpectedConceptFiles.length}个未注册概念文件`);

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

const requiredConceptFields = [
  '类别',
  '事实门槛',
  '定义',
  '来源',
  '机制',
  '补充事实',
  '限制与代价',
  '未知项',
  '禁止外推',
];

const forbiddenRuntimePatterns = [
  [/第\s*\d+\s*章/u, '章节号'],
  [/小总结/u, '小总结'],
  [/大总结/u, '大总结'],
  [/阶段(?:十|十一|十二|十三|十四|十五|十六|十七|十八)(?![九十])/u, '编辑阶段名'],
  [/(?:下一|本)阶段/u, '编辑阶段指代'],
  [/阶段(?:封口|尾|终点)/u, '编辑阶段边界'],
  [/\bStage\s*\d+\b/iu, 'Stage编号'],
  [/成人内容/u, '成人内容'],
  [/自愿/u, '自愿'],
  [/不要理解成/u, '不要理解成'],
  [/知情同意/u, '知情同意'],
  [/固定非性/u, '固定非性'],
  [/非性诊疗/u, '非性诊疗'],
  [/伦理审查/u, '伦理审查'],
  [/免责声明/u, '免责声明'],
  [/新增事实/u, '新增事实'],
  [/事件增量/u, '事件增量'],
  [/变形结果成立/u, '变形结果占位'],
  [/具体分支保留/u, '具体分支保留'],
  [/对应分支/u, '对应分支占位'],
  [/事件事实待定/u, '事件事实待定'],
  [/阶段(?:一|二|三|四|五|六|七|八|九)(?![十百千万])/u, '正文阶段编号'],
  [/(?:。；|；；|。。)/u, '机械重复标点'],
  [/——/u, '破折号'],
  [/�/u, '替换字符'],
];

const eventRows = [];
for (const file of eventFiles) {
  const rel = relative(file);
  const text = fs.readFileSync(file, 'utf8');
  const filenameMatch = path.basename(file).match(/^E(\d+)_/u);
  ok(Boolean(filenameMatch), `${rel}: 文件名缺少E编号`);
  if (!filenameMatch) continue;
  const eventNumber = Number(filenameMatch[1]);
  const eventId = `E${eventNumber}`;

  ok(
    new RegExp(
      `^<%_ const s${eventNumber} = getvar\\("stat_data\\.事件\\.锚点状态\\.${eventId}\\.状态", \\{ defaults: "未触发" \\}\\); if \\(s${eventNumber} === "未触发"\\) \\{ _%>`,
      'u',
    ).test(text),
    `${rel}: EJS开头与文件编号不一致`,
  );
  ok(text.trimEnd().endsWith('<%_ } _%>'), `${rel}: EJS闭合缺失`);
  ok(
    text.includes('本事件尚未进入预兆，详情暂不公开'),
    `${rel}: 未触发占位缺失`,
  );
  const titleMatch = text.match(new RegExp(`^# ${eventId}·(.+)$`, 'mu'));
  ok(Boolean(titleMatch), `${rel}: 事件标题缺失或编号不一致`);
  const title = titleMatch?.[1]?.trim() ?? '';

  for (const field of requiredEventFields) {
    ok(
      new RegExp(`^- ${field}：`, 'mu').test(text),
      `${rel}: 缺少字段“${field}”`,
    );
  }

  const direction = text.match(
    /- 默认走向：([\s\S]*?)\r?\n- 紧迫度：/u,
  )?.[1]?.trim();
  ok(Boolean(direction), `${rel}: 无法提取默认走向`);
  if (direction) {
    const chars = [...direction].length;
    ok(chars >= 300, `${rel}: 默认走向仅${chars}字，少于300`);
    ok(chars <= 2000, `${rel}: 默认走向${chars}字，超过2000`);
  }

  for (const [pattern, label] of forbiddenRuntimePatterns) {
    ok(!pattern.test(text), `${rel}: 命中禁用内容“${label}”`);
  }

  const referenceMatch = text.match(/^- 引用概念：(.+)$/mu);
  const actualReferences = referenceMatch
    ? [...referenceMatch[1].matchAll(/\b(C\d+)\b/gu)].map((match) => match[1])
    : [];
  const expectedReferences = (conceptRecordsByEvent.get(eventId) ?? [])
    .map((record) => String(record.logical_id))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  ok(Boolean(referenceMatch), `${rel}: 缺少引用概念字段`);
  ok(
    JSON.stringify(actualReferences) === JSON.stringify(expectedReferences),
    `${rel}: 引用概念集合与registry不一致`,
  );

  try {
    ejs.compile(text, { client: true, filename: file });
    ok(true, `${rel}: EJS编译`);
  } catch (error) {
    ok(false, `${rel}: EJS编译失败: ${error.message}`);
  }

  const next = text.match(/^## 下一事件引入（E(\d+)·(.+)）$/mu);
  const isTerminal = /^- 终局封口：/mu.test(text);
  if (isTerminal) {
    ok(eventNumber === 798, `${rel}: 只有E798可以声明终局封口`);
    ok(!next, `${rel}: 终局封口不得包含下一事件引入`);
  } else {
    ok(Boolean(next), `${rel}: 缺少下一事件引入`);
  }
  if (next && !isTerminal) {
    ok(
      Number(next[1]) === eventNumber + 1,
      `${rel}: 下一事件不是E${eventNumber + 1}`,
    );
    for (const field of ['触发时机', '剧情引子', '预兆写法', '承接因果']) {
      ok(
        new RegExp(`^- ${field}：`, 'mu').test(text),
        `${rel}: 下一事件缺少“${field}”`,
      );
    }
  }

  eventRows.push({
    eventNumber,
    rel,
    title,
    nextTitle: next?.[2]?.trim() ?? '',
    isTerminal,
  });
}

eventRows.sort((a, b) => a.eventNumber - b.eventNumber);
for (let index = 1; index < eventRows.length; index += 1) {
  ok(
    eventRows[index].eventNumber === eventRows[index - 1].eventNumber + 1,
    `事件编号断裂: ${eventRows[index - 1].rel} -> ${eventRows[index].rel}`,
  );
}
for (let index = 0; index < eventRows.length - 1; index += 1) {
  const current = eventRows[index];
  const following = eventRows[index + 1];
  if (following.eventNumber !== current.eventNumber + 1 || current.isTerminal) continue;
  ok(
    current.nextTitle === following.title,
    `${current.rel}: 后继标题“${current.nextTitle}”与${following.rel}的“${following.title}”不一致`,
  );
}

function parseEventArrayFromHeading(text) {
  const match = text.match(/^# 概念·.+（事件\[(.*?)\]）$/mu);
  if (!match) return null;
  try {
    const values = JSON.parse(`[${match[1]}]`);
    return values.map(String);
  } catch {
    return null;
  }
}

function originalEventIds(record) {
  if (!record.source_file || !fs.existsSync(record.source_file)) return [];
  return parseEventArrayFromHeading(fs.readFileSync(record.source_file, 'utf8')) ?? [];
}

for (const file of conceptFiles) {
  const rel = relative(file);
  const text = fs.readFileSync(file, 'utf8');
  const record = conceptRecordByPath.get(path.resolve(file));
  ok(Boolean(record), `${rel}: 概念未注册`);
  if (!record) continue;
  const conceptId = String(record.logical_id);
  ok(
    path.basename(file).startsWith(`${conceptId}_`),
    `${rel}: 文件名与逻辑编号${conceptId}不一致`,
  );
  const headingEventIds = parseEventArrayFromHeading(text);
  ok(Boolean(headingEventIds), `${rel}: 概念标题或事件数组格式错误`);
  if (headingEventIds) {
    const uniqueHeading = [...new Set(headingEventIds)];
    ok(uniqueHeading.length === headingEventIds.length, `${rel}: 标题事件数组有重复`);
    const registryIds = record.event_ids.map(String);
    const requiredIds = record.source_file
      ? [...new Set([...originalEventIds(record), ...registryIds])]
      : registryIds;
    for (const eventId of requiredIds) {
      ok(headingEventIds.includes(eventId), `${rel}: 标题事件数组缺少${eventId}`);
    }
    if (!record.source_file) {
      ok(
        headingEventIds.length === registryIds.length,
        `${rel}: NEW标题事件数组与registry不一致`,
      );
    }
  }
  for (const field of requiredConceptFields) {
    ok(
      new RegExp(`^- ${field}：`, 'mu').test(text),
      `${rel}: 缺少字段“${field}”`,
    );
  }
  for (const [pattern, label] of forbiddenRuntimePatterns) {
    ok(!pattern.test(text), `${rel}: 命中禁用内容“${label}”`);
  }
  ok(
    text.includes('"完成"') || text.includes('“完成”'),
    `${rel}: 事实门槛缺少完成态`,
  );
  ok(
    text.includes('"变形"') || text.includes('“变形”'),
    `${rel}: 事实门槛缺少变形态`,
  );
  ok([...text].length >= 300, `${rel}: 概念正文少于300字`);
  const gatedEventIds = new Set(
    [...text.matchAll(/stat_data\.事件\.锚点状态\.(E\d+)\.状态/gu)].map((match) => match[1]),
  );
  const hasDynamicEventFactMap =
    /const\s+eventFactMap\s*=/u.test(text) &&
    text.includes('stat_data.事件.锚点状态.${eventId}.状态');
  if (hasDynamicEventFactMap) {
    ok(/^@@private\r?\n/u.test(text), `${rel}: eventFactMap缺少首行@@private`);
    const contentAfterPrivate = text.replace(/^@@private\r?\n/u, '');
    ok(
      /^# 概念/u.test(contentAfterPrivate),
      `${rel}: @@private后必须先输出概念标题`,
    );
    ok(
      text.indexOf('# 概念') < text.indexOf('const eventFactMap'),
      `${rel}: eventFactMap不得出现在概念标题之前`,
    );
    for (const match of text.matchAll(/["'](E\d+)["']\s*:/gu)) {
      gatedEventIds.add(match[1]);
    }
  }
  for (const eventId of record.event_ids.map(String)) {
    ok(gatedEventIds.has(eventId), `${rel}: EJS门控缺少registry事件${eventId}`);
  }
  try {
    ejs.compile(text, { client: true, filename: file });
    ok(true, `${rel}: EJS编译`);
  } catch (error) {
    ok(false, `${rel}: EJS编译失败: ${error.message}`);
  }
}

if (conceptFiles.length > 0) {
  const combinedConceptEjs = conceptFiles
    .map((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return text.replace(/^@@private\r?\n/u, '<%_ { _%>\n') + '\n<%_ } _%>';
    })
    .join('\n');
  try {
    ejs.compile(combinedConceptEjs, { client: true, filename: 'all-concept-slices.ejs' });
    ok(true, '全概念私有作用域联合EJS编译');
  } catch (error) {
    ok(false, `全概念私有作用域联合EJS编译失败: ${error.message}`);
  }
}

const worldbookSlicePath = path.join(outputRoot, '世界书注册切片.json');
if (completeMode) ok(fs.existsSync(worldbookSlicePath), '缺少世界书注册切片.json');
if (fs.existsSync(worldbookSlicePath)) {
  const slice = JSON.parse(fs.readFileSync(worldbookSlicePath, 'utf8'));
  const entries = Array.isArray(slice.entries) ? slice.entries : [];
  ok(entries.length === eventFiles.length + conceptRecords.length, '世界书切片条目总数错误');
  ok(new Set(entries.map((entry) => entry.id)).size === entries.length, '世界书切片ID重复');
  ok(
    new Set(entries.map((entry) => entry.content_file)).size === entries.length,
    '世界书切片content_file重复',
  );
  const sourceWorldbook = JSON.parse(
    fs.readFileSync(path.join(projectRoot, '角色卡本体', '诡异药剂师_MVU_v0.13', 'src', 'worldbook.json'), 'utf8'),
  );
  const sourceIds = new Set(sourceWorldbook.entries.map((entry) => entry.id));
  const sliceById = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    ok(
      entry.extensions?.exclude_recursion === true && entry.extensions?.prevent_recursion === true,
      `世界书ID${entry.id}: 双递归保护未开启`,
    );
    ok(
      fs.existsSync(path.join(projectRoot, ...String(entry.content_file).split('/'))),
      `世界书ID${entry.id}: content_file不存在`,
    );
    if (entry.operation === 'add') {
      ok(!sourceIds.has(entry.id), `世界书ID${entry.id}: add与v0.13冲突`);
    } else if (entry.operation === 'replace') {
      ok(sourceIds.has(entry.id), `世界书ID${entry.id}: replace目标不存在`);
    } else {
      ok(false, `世界书ID${entry.id}: operation非法`);
    }
  }
  for (const eventRow of eventRows) {
    const id = eventRow.eventNumber + 699;
    const entry = sliceById.get(id);
    ok(Boolean(entry), `事件${eventRow.eventNumber}: 世界书注册缺失`);
    if (!entry) continue;
    ok(entry.operation === 'add', `世界书ID${id}: 事件必须add`);
    ok(entry.enabled === false && entry.constant === false, `世界书ID${id}: 事件启用状态错误`);
    ok(entry.keys?.includes(`E${eventRow.eventNumber}`), `世界书ID${id}: 事件关键词缺失`);
    ok(entry.comment === `[事件]E${eventRow.eventNumber}·${eventRow.title}`, `世界书ID${id}: 事件标题不匹配`);
  }
  for (const record of conceptRecords) {
    const entry = sliceById.get(Number(record.worldbook_id));
    ok(Boolean(entry), `${record.logical_id}: 世界书注册缺失`);
    if (!entry) continue;
    const isNew = !record.source_file;
    ok(entry.operation === (isNew ? 'add' : 'replace'), `${record.logical_id}: operation错误`);
    if (isNew) {
      ok(entry.enabled === true, `${record.logical_id}: NEW概念必须enabled=true`);
      ok(
        entry.extensions?.tavernweave?.logical_id === record.logical_id,
        `${record.logical_id}: logical_id注册错误`,
      );
    }
    const headerIds = parseEventArrayFromHeading(fs.readFileSync(record.output_path, 'utf8')) ?? [];
    ok(
      JSON.stringify(entry.extensions?.tavernweave?.event_ids ?? []) === JSON.stringify(headerIds),
      `${record.logical_id}: 注册event_ids与标题不一致`,
    );
  }
}

console.log(
  JSON.stringify(
    {
      outputRoot,
      eventFiles: eventFiles.length,
      conceptFiles: conceptFiles.length,
      conceptFilesExpected: conceptRecords.length,
      conceptFilesPending: pendingConceptFiles.length,
      checks,
      errors: errors.length,
    },
    null,
    2,
  ),
);

if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${checks} checks`);
}
