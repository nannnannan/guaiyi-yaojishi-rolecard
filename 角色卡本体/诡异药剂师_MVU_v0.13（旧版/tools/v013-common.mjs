// tools/v013-common.mjs — v0.13 集成共享工具（备份 + 事件/概念元数据提取）
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 备份：同一文件只备份一次（*.bak-v012-baseline）
export function backup(p) {
  const b = `${p}.bak-v012-baseline`;
  if (!existsSync(b)) copyFileSync(p, b);
}

export function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }
export function writeJson(p, obj) { writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8'); }
export function readText(p) { return readFileSync(p, 'utf8'); }
export function writeText(p, s) { writeFileSync(p, s, 'utf8'); }

// 从事件文件提取标题（如 E266: '魂灯入城·圣城通讯与猫娘军团'）
export function eventTitlesFromFiles() {
  const dir = resolve(root, 'src/events');
  const out = {};
  const files = readdirSync(dir);
  for (const f of files) {
    const m = f.match(/^(E\d{2,3})_.*\.md$/);
    if (!m) continue;
    const id = m[1];
    const num = Number(id.slice(1));
    if (num < 266 || num > 317) continue;
    const content = readText(join(dir, f));
    const t = content.match(/# E\d+·([^\n]+)/);
    if (!t) throw new Error(`事件文件缺标题: ${f}`);
    out[id] = t[1].trim();
  }
  // 按编号排序
  return Object.fromEntries(Object.entries(out).sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))));
}

export const STAGE9_NAMES = {
  S36: '梵蒂冈沦陷与旧神觉醒',
  S37: '地狱之门与星空豪赌',
  S38: '视界之主与机械神教',
  S39: '机械神教潜入',
  S40: '机械神教终局与母树收服',
};

export const STAGE9_EVENTS = {
  S36: ['E266','E267','E268','E269','E270','E271','E272','E273','E274','E275'],
  S37: ['E276','E277','E278','E279','E280','E281','E282','E283','E284','E285','E286','E287'],
  S38: ['E288','E289','E290','E291','E292','E293','E294','E295','E296','E297'],
  S39: ['E298','E299','E300','E301','E302','E303','E304','E305','E306','E307'],
  S40: ['E308','E309','E310','E311','E312','E313','E314','E315','E316','E317'],
};