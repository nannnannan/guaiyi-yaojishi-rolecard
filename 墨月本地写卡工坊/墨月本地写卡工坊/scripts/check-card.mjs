import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

const root = process.cwd();
const name = process.argv.slice(2).filter(arg => arg !== '--').join(' ').trim();

if (!name) {
  console.error('请提供角色卡名，例如：pnpm check:card -- "雾港来信"');
  process.exit(1);
}

const cardDir = path.join(root, 'src', name);
const indexFile = path.join(cardDir, 'index.yaml');
const errors = [];
const warnings = [];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function resolveReference(reference) {
  const base = path.join(cardDir, reference);
  const candidates = path.extname(base)
    ? [base]
    : [base, ...['.txt', '.md', '.yaml', '.yml', '.json', '.html', '.js', '.ts', '.vue'].map(ext => base + ext)];
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

function collectFileReferences(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectFileReferences(item, output));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === '文件' && typeof child === 'string') output.push(child);
      else collectFileReferences(child, output);
    }
  }
  return output;
}

if (!(await exists(indexFile))) {
  console.error(`找不到角色卡配置：src/${name}/index.yaml`);
  process.exit(1);
}

let card;
try {
  card = YAML.parse(await readFile(indexFile, 'utf8'));
} catch (error) {
  console.error(`index.yaml 无法解析：${error.message}`);
  process.exit(1);
}

for (const reference of new Set(collectFileReferences(card))) {
  if (!(await resolveReference(reference))) errors.push(`找不到引用文件：${reference}`);
}

if (!(await exists(path.join(cardDir, '项目状态.md')))) errors.push('缺少项目状态.md');
if (!(await exists(path.join(cardDir, '创作台.md')))) errors.push('缺少创作台.md');
if (!Array.isArray(card?.第一条消息) || card.第一条消息.length === 0) errors.push('至少需要保留一个开场白入口');
if (!card?.角色描述 && (!Array.isArray(card?.条目) || card.条目.length === 0)) warnings.push('人物正文和世界书目前都是空的');

if (typeof card?.头像 === 'string' && card.头像.trim()) {
  const avatar = path.join(cardDir, card.头像);
  const candidates = path.extname(avatar) ? [avatar] : [avatar, `${avatar}.png`];
  if (!(await Promise.any(candidates.map(file => access(file))).then(() => true).catch(() => false))) {
    errors.push(`找不到头像：${card.头像}`);
  }
} else {
  warnings.push('尚未设置 PNG 头像；打包时会导出 JSON，不会伪装成 PNG');
}

warnings.forEach(message => console.warn(`提醒：${message}`));
if (errors.length) {
  errors.forEach(message => console.error(`错误：${message}`));
  process.exit(1);
}

console.info(`检查通过：${name}`);
