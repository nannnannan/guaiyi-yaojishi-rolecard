import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

const root = process.cwd();
const errors = [];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function requirePath(relative) {
  if (!(await exists(path.join(root, relative)))) errors.push(`缺少：${relative}`);
}

for (const required of [
  'AGENTS.md',
  '开始写卡.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursor/rules/00_墨月入口.mdc',
  '必读/00_AI工作总则.md',
  '必读/01_大白话拆解与项目推进.md',
  '必读/02_专项路由.md',
  '初始模板/墨月角色卡/index.yaml',
  '初始模板/项目状态.md',
  '初始模板/创作台.md',
  'tavern_sync.mjs',
  'tavern_sync.yaml',
]) {
  await requirePath(required);
}

const skillRoot = path.join(root, '.agents', 'skills');
for (const entry of await readdir(skillRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const skillDir = path.join(skillRoot, entry.name);
  const skillFile = path.join(skillDir, 'SKILL.md');
  const metadataFile = path.join(skillDir, 'agents', 'openai.yaml');
  if (!(await exists(skillFile))) {
    errors.push(`Skill 缺少入口：${entry.name}/SKILL.md`);
    continue;
  }
  if (!(await exists(metadataFile))) errors.push(`Skill 缺少界面信息：${entry.name}/agents/openai.yaml`);

  const content = await readFile(skillFile, 'utf8');
  for (const match of content.matchAll(/`((?:\.\.\/){3}[^`]+)`/gu)) {
    const target = path.resolve(skillDir, match[1]);
    if (!(await exists(target))) errors.push(`${entry.name} 引用了不存在的资料：${match[1]}`);
  }
}

const interfaceIndex = path.join(root, '知识库', '写卡知识库', '酒馆助手接口', '00_索引_先看这个.txt');
const interfaceText = await readFile(interfaceIndex, 'utf8');
for (const match of interfaceText.matchAll(/→\s*([^\r\n]+)/gu)) {
  const target = path.join(path.dirname(interfaceIndex), match[1].trim());
  if (!(await exists(target))) errors.push(`酒馆助手接口索引指向不存在的文件：${match[1].trim()}`);
}

const template = YAML.parse(await readFile(path.join(root, '初始模板', '墨月角色卡', 'index.yaml'), 'utf8'));
if ((template?.条目?.length ?? 0) !== 0) errors.push('空白角色卡模板不应预装世界书条目');
if ((template?.扩展字段?.正则?.length ?? 0) !== 0) errors.push('空白角色卡模板不应预装正则');
if ((template?.扩展字段?.酒馆助手?.脚本库?.length ?? 0) !== 0) errors.push('空白角色卡模板不应预装脚本');

if (errors.length) {
  errors.forEach(message => console.error(`错误：${message}`));
  process.exit(1);
}

console.info('工坊检查通过：入口、必读路由、Skill 引用、接口索引和空白模板均完整');
