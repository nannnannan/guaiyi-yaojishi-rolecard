import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const STAGE_NUMBER_PATTERN = /(?:阶段[一二三四五六七八九十0-9]+)/;
const SUMMARY_PATTERN = /(?:(?:小|大)总结)/;
const CHAPTER_PATTERN = /(?:第[0-9一二三四五六七八九十百千]+章)/;

const worldbook = JSON.parse(readFileSync('src/worldbook.json', 'utf8'));

export function splitConceptVariantBlocks(content) {
  const parts = content.split(/^## 变体·/gm);
  const prefix = parts.shift() ?? '';
  return { prefix, blocks: parts.map(block => `## 变体·${block}`) };
}

export function conceptGate(block) {
  const gateLine = block.match(/^- 门控：(.+)$/m)?.[1] ?? '';
  const events = [...gateLine.matchAll(/E\d{2}/g)].map(match => match[0]);
  return { gateLine, events, baseline: gateLine.startsWith('兜底') };
}

export function renderEjsForEventStates(content, stateTable) {
  const source = content.replace(/^@@private\s*/, '');
  let code = 'let __out = "";\n';
  let cursor = 0;
  for (const match of source.matchAll(/<%([-_=]?)([\s\S]*?)[-_]?%>/g)) {
    const index = match.index ?? 0;
    code += `__out += ${JSON.stringify(source.slice(cursor, index))};\n`;
    if (match[1] === '=' || match[1] === '-') code += `__out += String(${match[2]});\n`;
    else code += `${match[2]}\n`;
    cursor = index + match[0].length;
  }
  code += `__out += ${JSON.stringify(source.slice(cursor))};\nreturn __out;`;
  const getvar = (path, options = {}) => {
    const eventMatch = String(path).match(/^stat_data\.事件\.锚点状态\.(E\d{2})\.状态$/);
    if (eventMatch) return stateTable[eventMatch[1]]?.状态 ?? options.defaults;
    return options.defaults;
  };
  return new Function('getvar', code)(getvar);
}

export function testConcept(conceptContent, conceptEntry) {
  const conceptTitle = conceptEntry.comment.replace(/^\[概念·[^\]]+\]/, '');
  const isVariantForm = conceptContent.includes('<%') && conceptContent.includes('## 变体·');
  if (!conceptContent.startsWith('# 概念·')) throw new Error(`${conceptEntry.comment}正文首行为概念标题`);
  if (!isVariantForm) throw new Error(`${conceptEntry.comment}必须为EJS变体形态`);

  const eventIds = conceptEntry.extensions?.tavernweave?.event_ids ?? [];
  const headingMatch = conceptContent.match(/^# 概念·[^·]+·(.+?)（事件(\[[^\n]+\])）$/m);
  if (!headingMatch) throw new Error(`${conceptEntry.comment}标题保留事件数组格式不匹配`);
  if (headingMatch[1] !== conceptTitle) throw new Error(`${conceptEntry.comment}标题名称与注册表不一致：${headingMatch[1]} vs ${conceptTitle}`);
  if (JSON.stringify(JSON.parse(headingMatch[2])) !== JSON.stringify(eventIds)) {
    throw new Error(`${conceptEntry.comment}标题事件数组与注册表元数据不一致：${headingMatch[2]} vs ${JSON.stringify(eventIds)}`);
  }

  // Forbidden words check
  const lines = conceptContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (CHAPTER_PATTERN.test(line)) throw new Error(`${conceptEntry.comment}:${i+1} 包含禁词[第X章]: ${line}`);
    if (SUMMARY_PATTERN.test(line)) throw new Error(`${conceptEntry.comment}:${i+1} 包含禁词[小/大总结]: ${line}`);
    if (STAGE_NUMBER_PATTERN.test(line)) throw new Error(`${conceptEntry.comment}:${i+1} 包含禁词[阶段几]: ${line}`);
  }

  if (conceptContent.length < 900) throw new Error(`${conceptEntry.comment}变体正文下限900字符（当前${conceptContent.length}）`);
  if (conceptContent.includes('activewi(') || conceptContent.includes('getEnabledWorldInfoEntries(')
    || conceptContent.includes('await ') || /(^|\n)\s*(const|let)\s/.test(conceptContent)) {
    throw new Error(`${conceptEntry.comment}变体EJS只读事件状态且无跨条目作用域声明`);
  }

  const { blocks } = splitConceptVariantBlocks(conceptContent);
  if (blocks.length < 1) throw new Error(`${conceptEntry.comment}变体形态包含变体块`);
  const baselineBlock = blocks[blocks.length - 1];
  if (!conceptGate(baselineBlock).baseline) throw new Error(`${conceptEntry.comment}兜底块必须是最后一个变体块`);

  for (const block of blocks) {
    if ((block.match(/^- 事件演进：/gm) ?? []).length !== 1) throw new Error(`${conceptEntry.comment}变体块必须包含唯一“- 事件演进：”`);
    if ((block.match(/^- 当前状态：/gm) ?? []).length !== 1) throw new Error(`${conceptEntry.comment}变体块必须包含唯一“- 当前状态：”`);
  }

  const gatedBlocks = blocks.slice(0, -1);
  const blockGateLine = block => (block.match(/^- 门控：(.+)$/m)?.[1] ?? '');

  const allEventIds = Array.from({length: 126}, (_, i) => `E${String(i+1).padStart(2, '0')}`);
  const makeTable = (gateEvents, state) => Object.fromEntries(allEventIds.map(id => [id, { 状态: gateEvents.includes(id) ? state : '未触发' }]));

  const scenarios = [
    ['全未触发', makeTable([], '未触发'), baselineBlock],
    ['全事件完成', makeTable(allEventIds, '完成'), gatedBlocks[0] || baselineBlock],
  ];

  for (const state of ['完成', '变形']) {
    for (const block of gatedBlocks) {
      const gateEvent = conceptGate(block).events[0];
      scenarios.push([`${gateEvent}=${state}`, makeTable([gateEvent], state), block]);
    }
  }
  for (const state of ['取消', '活跃', '预兆']) {
    for (const block of gatedBlocks) {
      const gateEvent = conceptGate(block).events[0];
      scenarios.push([`${gateEvent}=${state}`, makeTable([gateEvent], state), baselineBlock]);
    }
  }

  for (const [label, stateTable, expectedBlock] of scenarios) {
    const rendered = renderEjsForEventStates(conceptContent, stateTable);
    if (!rendered.includes('# 概念·')) throw new Error(`${conceptEntry.comment}渲染${label}未保留标题`);
    if (rendered.includes('<%')) throw new Error(`${conceptEntry.comment}渲染${label}有EJS残留`);
    const count = [...rendered.matchAll(/^## 变体·/gm)].length;
    if (count !== 1) throw new Error(`${conceptEntry.comment}渲染${label}输出${count}个变体块（预期1个）`);
    const renderedGate = rendered.match(/^- 门控：(.+)$/m)?.[1] ?? '';
    if (renderedGate !== blockGateLine(expectedBlock)) {
      throw new Error(`${conceptEntry.comment}渲染${label}门控不匹配：\n实际: ${renderedGate}\n预期: ${blockGateLine(expectedBlock)}`);
    }
  }
  return true;
}

if (process.argv[1]?.endsWith('test_concept_integrity.mjs')) {
  const startId = parseInt(process.argv[2] || '400', 10);
  const endId = parseInt(process.argv[3] || '500', 10);
  let passed = 0;
  for (const entry of worldbook.entries) {
    if (entry.id >= startId && entry.id <= endId) {
      try {
        const text = readFileSync(entry.content_file, 'utf8');
        testConcept(text, entry);
        passed++;
      } catch (err) {
        console.error(`[FAIL] UID ${entry.id} (${entry.comment}): ${err.message}`);
      }
    }
  }
  console.log(`Tested UID ${startId}-${endId}: ${passed} passed.`);
}
