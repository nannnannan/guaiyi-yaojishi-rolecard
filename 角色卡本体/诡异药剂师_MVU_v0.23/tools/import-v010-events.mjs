import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(projectRoot, '..', '..', '角色卡设定', 'v0.10工作区');
const eventRoot = resolve(projectRoot, 'src', 'events');
const draftFiles = [
  '事件草稿_P1_E127-E133.md',
  '事件草稿_P2_E134-E139.md',
  '事件草稿_P3_E140-E145.md',
  '事件草稿_P4_E146-E151.md',
  '事件草稿_P5_E152-E157.md',
  '事件草稿_P6_E158-E163.md',
  '事件草稿_P7_E164-E170.md',
];

function safeTitle(value) {
  return value.replace(/[<>:"/\\|?*]/g, '').trim();
}

const imported = [];
for (const draftFile of draftFiles) {
  const draft = (await readFile(resolve(workspaceRoot, draftFile), 'utf8')).replace(/\r\n/g, '\n');
  // Each draft may place Markdown separators or editorial notes between event
  // blocks.  The outer EJS guard is the stable boundary, so capture through its
  // own closing tag instead of assuming the next token is another guard.
  const blocks = [...draft.matchAll(/(<%_ const s(\d+) = getvar\("stat_data\.事件\.锚点状态\.E\2\.状态"[\s\S]*?\n<%_ \} _%>)/g)];
  if (blocks.length === 0) throw new Error(`${draftFile} 未提取到事件块`);
  for (const match of blocks) {
    const content = `${match[1].trim()}\n`;
    const eventId = `E${match[2]}`;
    const title = content.match(new RegExp(`^# ${eventId}·(.+)$`, 'm'))?.[1]?.trim();
    if (!title) throw new Error(`${draftFile} 的 ${eventId} 缺少标题`);
    const output = resolve(eventRoot, `${eventId}_${safeTitle(title)}.md`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, content, 'utf8');
    imported.push({ eventId, title, draftFile, output });
  }
}

imported.sort((a, b) => Number(a.eventId.slice(1)) - Number(b.eventId.slice(1)));
const expected = Array.from({ length: 44 }, (_, index) => `E${index + 127}`);
const actual = imported.map(item => item.eventId);
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`事件序列不连续：${actual.join(', ')}`);
}

console.log(JSON.stringify({ status: 'imported', events: imported.length, first: imported[0], last: imported.at(-1) }, null, 2));
