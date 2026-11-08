// if线校验：每份 src/if_lines/E{XX}_{标题}.md 3-30条分支，≤2000字符，标题匹配，禁元数据词
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IF_DIR = resolve(ROOT, 'src/if_lines');
const EVENTS_DIR = resolve(ROOT, 'src/events');

const FORBIDDEN = /第[一二三四五六七八九十百千0-9]+章|阶段[一二三四五六七八九十0-9]|小总结|大总结|幕间总结|前文总结|本章|回合计数|第[0-9]+层|第[0-9]+级/;

function err(msg) { console.error('[IF-ERR]', msg); }

let failures = 0;
let checked = 0;

if (!existsSync(IF_DIR)) {
  console.log('[if_lines] dir not found (skip validation)');
  process.exit(0);
}

const ifFiles = readdirSync(IF_DIR).filter(f => f.endsWith('.md'));
const eventFiles = readdirSync(EVENTS_DIR).filter(f => f.endsWith('.md'));

// build map of expected files from events
const expected = new Map();
for (const f of eventFiles) {
  const base = f.replace(/\.md$/, '');
  expected.set(base, true);
}

// validate each if file
const seen = new Set();
for (const f of ifFiles) {
  const base = f.replace(/\.md$/, '');
  if (!expected.has(base)) {
    err(`if_lines/${f} 无对应事件文件 (expected ${base})`);
    failures++;
    continue;
  }
  seen.add(base);

  const full = resolve(IF_DIR, f);
  const content = readFileSync(full, 'utf8');
  const lines = content.split(/\r?\n/);

  // title line
  const m = base.match(/^(E\d+?)_(.+)$/);
  if (!m) {
    err(`${f} 文件名不符合 E{XX}_{标题} 格式`);
    failures++;
    continue;
  }
  const [_, eid, title] = m;
  const titleLine = lines[0];
  const expectTitle = `# ${eid}·${title}·if线`;
  if (titleLine !== expectTitle) {
    err(`${f} 标题行错误（期望: ${expectTitle}; 实际: ${titleLine}）`);
    failures++;
  }

  // count branch bullets (- 若... )
  const branches = lines.filter(l => /^- 若/.test(l.trim()));
  if (branches.length < 3 || branches.length > 30) {
    err(`${f} 分支条数${branches.length}（期望 3-30）`);
    failures++;
  }

  // body length (excluding title line)
  const body = lines.slice(1).join('\n');
  const bodyLen = body.length;
  if (bodyLen > 2000) {
    err(`${f} 内容${bodyLen}字（上限2000）`);
    failures++;
  }

  // forbidden metadata words
  if (FORBIDDEN.test(body)) {
    err(`${f} 含禁元数据词`);
    failures++;
  }

  // player sovereignty check: scan only the consequence segment (「则」后半段) of each "- 若…则…" bullet;
  // the condition segment (若 + 玩家假设动作) is not checked, so "若林恩拒绝…" remains legal
  const conseRemovePatt = /(?:(?:让|使|令|促使)?林恩[^\n，。？！；]{0,15}?(?:说[「\"“]|道[「\"“]|喊[「\"“]|决定|选择|犹豫|感到|感觉|觉得|认为|认定|断定|意识到|明白|体会|察觉|后悔|自责|愧疚|心动|爱上|憎恨|原谅|放下|释然|内心|心底|心中|心口|心头|思索|回忆|倒吸|深知|看清|洞悉|感同身受|共鸣|恨之入骨|认清|认可|脊背发凉|展颜一笑|咬牙|指节发白|骨节发白)|(?:^|[，、；\s(（])(?:[^\n，。？！；]{0,15}?的)?他[^\n，。？！；]{0,15}?(?:决定|选择|犹豫|感到|感觉|觉得|认为|认定|断定|意识到|明白|体会|察觉|内心|心底|心中|心口|心头|发誓|明悟|预感|挣扎|警铃大作|如遭重锤|倒吸|深知|看清|洞悉|感同身受|共鸣|恨之入骨|认清|认可|脊背发凉|展颜一笑|咬牙|指节发白|骨节发白|浑身剧震|震惊|无比清楚|眼神中|高喊|满心欢喜|流着血泪)|在?他心[底中口头]|被他[^\n，。？！；]{0,8}?心底|心口某处|(?:指节|骨节)发白|脊背发凉|展颜一笑|生出了[^\n，。？！；]{0,10}?共鸣|从[^\n，。？！；]{0,15}?感受到|抓住了[^\n，。？！；]{0,15}?拐点|有了[^\n，。？！；]{0,15}?理解|做好了[^\n，。？！；]{0,15}?准备|恨之入骨|高喊|满心欢喜|流着血泪|偏过头用脸颊|[眼双]瞳[^\n，。？！；]{0,6}?流[下出]|被锁在王座上的(?:嘴角|他)|咬破舌尖|^\s*在?心[底中口头]|(?:^|[，、；\s(（])(?:心底|心中|心口|心头|脊背发凉|咬牙|展颜一笑|深知|看清|洞悉|感同身受)|(?:^|，)暗下决心|(?:^|，)后背惊出一层冷汗)/;

  const nonBreachPatt = /(?:产生共鸣|(?:法则|灵能|信仰法阵|灵魂)共鸣|对林恩[^\n，。？！；]{0,15}?认可|被(?:[^\n，。？！；]{0,8}?)认可|被(?:[^\n，。？！；]{0,6}?)认为|被认定为|林恩心口那支|落在[^\n，。？！；]{0,15}?林恩心口|打向心口侧|直刺心口|藏在心口|贴在心口|在咒瞳视野里看清|提前[^\n，。？！；]{0,6}?看清|(?:不会|未能?|未及|未曾)看清|看见白骨[^\n，。？！；]{0,6}?没看清|从旁观视角看清|作为唯一目击者看清|他把[^\n，。？！；]{0,10}?看得更清楚|被震惊)/;

  const npcSubjPatt = /^(?!(?:他|林恩)的)(?:[^\n，。？！；]{0,6}?)(?:左左|艾雯|织梦|以太|灭绝者|银色幻想|银幻|血衣|主母|母树|奈奈子|画家|白夜|林蒙|爱丽丝|羽毛笔|小丑|泰坦|巨像|执政官|神皇|众人|全场|守军|守卫|生灵|努斯|血娃娃|小小|她|它|祂|谁|城墙守军|三位一体机)/;

  const explicitLynnBreachPatt = /(?:让林恩[^\n，。？！；]{0,10}?展颜一笑|在?他心[头口底中]|被他[^\n，。？！；]{0,8}?心底|他在权柄空门|他对[^\n。？！；]{0,35}?(?:共鸣|恨之入骨|感同身受))/;

  for (const rawLine of branches) {
    const line = rawLine.trim();
    let thenIdx = line.search(/[，,——\s]则/);
    if (thenIdx >= 0) {
      thenIdx = line.indexOf('则', thenIdx);
    } else {
      thenIdx = line.indexOf('则');
    }
    if (thenIdx < 0) continue; // 缺「则」的格式错在分支计数处另报，不在此重报主权
    const consequence = line.slice(thenIdx + 1);
    if (conseRemovePatt.test(consequence)) {
      if (nonBreachPatt.test(consequence)) {
        continue;
      }
      if (npcSubjPatt.test(consequence.trim()) && !explicitLynnBreachPatt.test(consequence)) {
        continue;
      }
      err(`${f} 疑似替林恩做主语（违玩家主权）: ${line.slice(0, 80)}`);
      failures++;
    }
  }

  checked++;
}

// missing if_lines for events
for (const [base,] of expected) {
  if (!seen.has(base)) {
    err(`缺 ${base} 的 if_lines 文件`);
    failures++;
  }
}

console.log(JSON.stringify({
  status: failures === 0 ? 'if_lines_validated' : 'if_lines_errors',
  checked,
  failures,
  expected: expected.size,
}, null, 2));

process.exitCode = failures === 0 ? 0 : 1;
