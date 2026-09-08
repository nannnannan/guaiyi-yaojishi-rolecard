import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 本草稿预期复制到“角色卡本体/<v0.11项目>/tools/”后执行。
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(projectRoot, '..', '..', '角色卡设定', 'v0.11工作区');
const eventRoot = resolve(projectRoot, 'src', 'events');
const draftFiles = [
  '事件草稿_P1_E171-E178.md',
  '事件草稿_P2_E179-E186.md',
  '事件草稿_P3_E187-E194.md',
  '事件草稿_P4_E195-E202.md',
  '事件草稿_P5_E203-E210.md',
  '事件草稿_P6_E211-E218.md',
];

const eventBlockPattern = /(<%_ const s(\d{3}) = getvar\("stat_data\.事件\.锚点状态\.E\2\.状态"[\s\S]*?\n<%_ \} _%>)/g;
const expectedIds = Array.from({ length: 48 }, (_, index) => 'E' + (index + 171));

function safeTitle(value) {
  return value.replace(/[<>:"/\\|?*]/g, '').trim();
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const imported = [];
const seenIds = new Set();

for (const draftFile of draftFiles) {
  const draftPath = resolve(workspaceRoot, draftFile);
  const draft = (await readFile(draftPath, 'utf8')).replace(/\r\n/g, '\n');
  const blocks = [...draft.matchAll(eventBlockPattern)];
  if (blocks.length !== 8) {
    throw new Error(draftFile + ' 应提取8个事件块，实际' + blocks.length);
  }

  const range = draftFile.match(/_E(\d+)-E(\d+)\.md$/);
  if (!range) throw new Error(draftFile + ' 文件名缺少事件范围');
  const fileExpected = Array.from(
    { length: Number(range[2]) - Number(range[1]) + 1 },
    (_, index) => 'E' + (Number(range[1]) + index),
  );
  const fileActual = [];

  for (const match of blocks) {
    const eventId = 'E' + match[2];
    if (seenIds.has(eventId)) throw new Error('事件ID重复：' + eventId);
    seenIds.add(eventId);
    fileActual.push(eventId);

    const content = match[1].trim() + '\n';
    const title = content.match(new RegExp('^# ' + eventId + '·(.+)$', 'm'))?.[1]?.trim();
    if (!title) throw new Error(draftFile + ' 的 ' + eventId + ' 缺少标题');
    const headingCount = (content.match(new RegExp('^# ' + eventId + '·', 'gm')) ?? []).length;
    if (headingCount < 2) {
      throw new Error(draftFile + ' 的 ' + eventId + ' 未同时保留遮罩标题与运行标题');
    }
    const outputTitle = safeTitle(title);
    if (!outputTitle) throw new Error(draftFile + ' 的 ' + eventId + ' 标题无法生成安全文件名');

    if (eventId === 'E218') {
      if (/E219|下一事件引入/.test(content)) {
        throw new Error('E218 是冻结终点，不得包含后继事件或下一事件引入');
      }
    } else {
      const nextId = 'E' + (Number(match[2]) + 1);
      if (!content.includes('## 下一事件引入（' + nextId + '·')) {
        throw new Error(eventId + ' 缺少指向' + nextId + '的下一事件引入');
      }
    }

    const outputName = eventId + '_' + outputTitle + '.md';
    imported.push({
      eventId,
      title,
      draftFile,
      outputName,
      output: resolve(eventRoot, outputName),
      content,
    });
  }

  if (!sameArray(fileActual, fileExpected)) {
    throw new Error(draftFile + ' 内事件范围不连续：' + fileActual.join(', '));
  }
}

imported.sort((left, right) => Number(left.eventId.slice(1)) - Number(right.eventId.slice(1)));
const actualIds = imported.map(item => item.eventId);
if (!sameArray(actualIds, expectedIds)) {
  throw new Error('事件序列必须恰好为E171—E218：' + actualIds.join(', '));
}
if (imported.length !== 48) throw new Error('事件总数必须为48，实际' + imported.length);

let existingNames = [];
try {
  existingNames = await readdir(eventRoot);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
for (const item of imported) {
  const sameIdFiles = existingNames.filter(name => name.startsWith(item.eventId + '_'));
  const conflicts = sameIdFiles.filter(name => name !== item.outputName);
  if (conflicts.length > 0) {
    throw new Error(item.eventId + ' 已存在不同标题文件，拒绝留下重复事件：' + conflicts.join(', '));
  }
}

// 所有来源、范围、标题与终点均通过后才开始写入。
await mkdir(eventRoot, { recursive: true });
for (const item of imported) {
  await writeFile(item.output, item.content, 'utf8');
}

console.log(JSON.stringify({
  status: 'imported-v0.11-events',
  workspace_root: workspaceRoot,
  events: imported.length,
  first: {
    event_id: imported[0].eventId,
    title: imported[0].title,
    draft_file: imported[0].draftFile,
    output: imported[0].output,
  },
  last: {
    event_id: imported.at(-1).eventId,
    title: imported.at(-1).title,
    draft_file: imported.at(-1).draftFile,
    output: imported.at(-1).output,
  },
}, null, 2));
