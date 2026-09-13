import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const worldbookPath = resolve(projectRoot, 'src/worldbook.json');
const worldbook = JSON.parse(await readFile(worldbookPath, 'utf8'));

let updated = 0;
for (const entry of worldbook.entries) {
  if (entry.id < 400 || entry.id > 492 || !entry.content_file) continue;
  const contentPath = resolve(projectRoot, entry.content_file);
  const source = await readFile(contentPath, 'utf8');
  const eventIds = entry.extensions?.tavernweave?.event_ids ?? [];
  const categoryAndName = entry.comment.match(/^\[概念·(.+?)\](.+)$/);
  if (!categoryAndName) throw new Error(`概念注册标题格式错误：${entry.comment}`);
  const heading = `# 概念·${categoryAndName[1]}·${categoryAndName[2]}（事件${JSON.stringify(eventIds)}）`;
  const next = source.replace(/^# 概念·[^\r\n]+/u, heading);
  if (next === source && !source.startsWith(heading)) {
    throw new Error(`无法同步概念标题：${entry.content_file}`);
  }
  if (next !== source) {
    await writeFile(contentPath, next, 'utf8');
    updated += 1;
  }
}

console.log(`concept headings synchronized: ${updated}`);
