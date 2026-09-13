// tools/upgrade-v013-state-mirrors.mjs
// 集成：把 initial_variables.json 的 元数据 卡名/版本 更新为 v0.13，并把
// first_message.md 的 <initvar> 块与 status.html 的 FALLBACK_STATE 深度同步为同一对象。
// 保持三处深一致（validate 断言 JSON.stringify 相等）。
import { resolve } from 'node:path';
import { root, backup, readJson, writeJson, readText, writeText } from './v013-common.mjs';

// 1. initial_variables.json 元数据
const ivPath = resolve(root, 'src/initial_variables.json');
backup(ivPath);
const iv = readJson(ivPath);
iv.元数据.卡名 = '《诡异药剂师》v0.13';
iv.元数据.版本 = '0.13.0';
writeJson(ivPath, iv);
console.log('initial_variables.json：元数据 卡名/版本 -> v0.13');

// 2. first_message.md initvar 块替换
const fmPath = resolve(root, 'src/prompts/first_message.md');
backup(fmPath);
let fm = readText(fmPath);
const fmRe = /<initvar>\s*([\s\S]*?)\s*<\/initvar>/;
const fmMatch = fm.match(fmRe);
if (!fmMatch) throw new Error('first_message.md 未找到 <initvar> 块');
fm = fm.replace(fmRe, `<initvar>\n${JSON.stringify(iv, null, 2)}\n</initvar>`);
writeText(fmPath, fm);
console.log('first_message.md：initvar 块深度同步 v0.13');

// 3. status.html FALLBACK_STATE 替换（紧凑 JSON）
const statusPath = resolve(root, 'src/ui/status.html');
backup(statusPath);
let status = readText(statusPath);
const fbRe = /const FALLBACK_STATE = (\{[\s\S]*?\})\s*;\s*let mvuAvailable/;
const fbMatch = status.match(fbRe);
if (!fbMatch) throw new Error('status.html 未找到 FALLBACK_STATE');
const compact = JSON.stringify(iv);
status = status.replace(fbRe, `const FALLBACK_STATE = ${compact};\n      let mvuAvailable`);
writeText(statusPath, status);
console.log('status.html：FALLBACK_STATE 深度同步 v0.13');

console.log('=== 三处状态镜像同步完成 ===');