// 从 _review_work/batch{NN}_E..._原文.txt 中按章边界切片，按 src/events/E{XX}_{title}.md
// 的 S 阶段/phase 映射把每事件 default 走向对应的章节区间切到 slices/E{XX}_slice.txt。
// 当前硬编码表只覆盖 E117–E126；到时再扩展。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REVIEW = resolve(ROOT, '_review_work');
const CARD = resolve(ROOT, '角色卡本体/诡异药剂师_MVU_v0.23');
const OUT = resolve(CARD, 'slices');
mkdirSync(OUT, { recursive: true });

// 简单版：按「第 N 章」切分，然后按事件->章区间映射产出
const SPLITS = [
  { batch: 'batch04_E121-E160_原文.txt', events: { E117: { startCh: 541, endCh: 544 } } },
];

function extractChapters(text) {
  // 按「第 X 章」切分
  const re = /第\s*(\d+)\s*章/g;
  const marks = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    marks.push({ ch: Number(m[1]), idx: m.index });
  }
  const chapters = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].idx;
    const end = (i + 1 < marks.length) ? marks[i + 1].idx : text.length;
    chapters.push({ ch: marks[i].ch, text: text.slice(start, end) });
  }
  return chapters;
}

for (const s of SPLITS) {
  const src = readFileSync(resolve(REVIEW, s.batch), 'utf8');
  const chapters = extractChapters(src);
  const chMap = new Map(chapters.map(c => [c.ch, c.text]));
  for (const [ev, range] of Object.entries(s.events)) {
    let slice = '';
    for (let ch = range.startCh; ch <= range.endCh; ch++) {
      if (chMap.has(ch)) slice += chMap.get(ch) + '\n';
    }
    if (slice.length > 0) {
      const outPath = resolve(OUT, `${ev}_slice.txt`);
      writeFileSync(outPath, slice, 'utf8');
      console.log(`${ev} -> ${outPath} (${slice.length} chars)`);
    } else {
      console.log(`${ev}: no content for chapters ${range.startCh}-${range.endCh}`);
    }
  }
}
