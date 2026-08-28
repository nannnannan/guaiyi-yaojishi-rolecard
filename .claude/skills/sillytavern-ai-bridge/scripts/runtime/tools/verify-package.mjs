#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const toolsDir = dirname(fileURLToPath(import.meta.url));
const toolkitDir = resolve(toolsDir, '..');
const skillDir = resolve(toolkitDir, '..', '..');
const checks = [];

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail });
}

function walk(dir) {
  const output = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) output.push(...walk(path));
    else if (stat.isFile()) output.push(path);
  }
  return output;
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: toolkitDir,
    encoding: 'utf8',
    windowsHide: true,
  });
}

const required = [
  'SKILL.md',
  'README.md',
  'agents/openai.yaml',
  'assets/调试测试卡.json',
  'assets/调试世界书.json',
  'references/card-operations.md',
  'references/command-reference.md',
  'references/privacy-and-safety.md',
  'references/runtime-compatibility.md',
  'references/setup.md',
  'scripts/audit-privacy.mjs',
  'scripts/bridge-runner.mjs',
  'scripts/runtime/package.json',
  'scripts/runtime/package-lock.json',
  'scripts/runtime/入口/st-bridge.mjs',
  'scripts/runtime/入口/st-config.mjs',
  'scripts/runtime/入口/st-debug.mjs',
  'scripts/runtime/核心/tavern-session.mjs',
  'scripts/runtime/角色卡导入器/import-card.mjs',
  'scripts/runtime/角色卡替换器/card-file.mjs',
  'scripts/runtime/角色卡替换器/replace-card.mjs',
  'scripts/runtime/提示词监听/prompt-capture.mjs',
  'scripts/runtime/tools/probe.mjs',
  'scripts/runtime/tools/start-sillytavern.mjs',
  'scripts/runtime/tools/verify-package.mjs',
  'scripts/runtime/tools/verify-live.mjs',
  'scripts/runtime/tools/verify-replace-card.mjs',
];

const missing = required.filter((path) => !existsSync(join(skillDir, path)));
check('required files', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : `${required.length} present`);
const extraneousDocs = ['INSTALLATION_GUIDE.md', 'QUICK_REFERENCE.md', 'CHANGELOG.md']
  .filter((path) => existsSync(join(skillDir, path)));
check(
  'no unrelated top-level docs',
  extraneousDocs.length === 0,
  extraneousDocs.length ? `remove: ${extraneousDocs.join(', ')}` : 'none',
);

let packageJson = null;
try {
  packageJson = JSON.parse(readFileSync(join(toolkitDir, 'package.json'), 'utf8'));
  check(
    'package manifest',
    packageJson.name === 'sillytavern-ai-bridge-runtime'
      && packageJson.type === 'module'
      && packageJson.dependencies?.playwright,
    packageJson.name || 'unreadable',
  );
} catch (error) {
  check('package manifest', false, String(error?.message || error));
}

const files = walk(skillDir);
const textExtensions = new Set(['.md', '.mjs', '.json', '.yaml', '.yml', '.txt']);
const textFiles = files.filter((path) => textExtensions.has(extname(path).toLowerCase()));
const privacyPatterns = [
  { label: 'Windows user home', regex: /[A-Za-z]:\\Users\\(?!<|\{)[^\\/\s"']+/g },
  { label: 'Unix user home', regex: /\/(?:Users|home)\/(?!<|\{)[^/\s"']+/g },
  { label: 'email address', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { label: 'OpenAI-style key', regex: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { label: 'bearer token', regex: /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}=*/gi },
  { label: 'static ISO date', regex: /\b20\d{2}-\d{2}-\d{2}\b/g },
  { label: 'SillyTavern chat timestamp', regex: /@\d{1,2}h\d{1,2}m\d{1,2}s\d{1,3}ms/g },
  { label: 'static SHA-256 value', regex: /\b[a-f0-9]{64}\b/gi },
];
const localTestTerms = [
  ['本', '机'].join(''),
  ['实', '机'].join(''),
  ['实', '测', '环境'].join(''),
  ['探', '测', '日期'].join(''),
  ['git', 'Revision'].join(''),
];
const externalDenylist = String(process.env.ST_SKILL_PRIVACY_DENYLIST || '')
  .split('|')
  .map((item) => item.trim())
  .filter(Boolean);
const placeholderMarker = ['TO', 'DO'].join('');
const findings = [];
for (const path of textFiles) {
  const text = readFileSync(path, 'utf8');
  const rel = relative(skillDir, path);
  for (const { label, regex } of privacyPatterns) {
    regex.lastIndex = 0;
    const matches = [...text.matchAll(regex)].map((match) => match[0]);
    if (matches.length) findings.push(`${rel}: ${label} (${matches.length})`);
  }
  for (const term of [...localTestTerms, ...externalDenylist]) {
    if (term && text.includes(term)) findings.push(`${rel}: denied term`);
  }
  if (text.includes(placeholderMarker)) findings.push(`${rel}: unfinished placeholder`);
}
for (const path of files) {
  const rel = relative(skillDir, path);
  if (/(^|[\\/])(captures|backups|screenshots|logs)([\\/]|$)/i.test(rel)) {
    findings.push(`${rel}: runtime artifact directory`);
  }
}
check('privacy audit', findings.length === 0, findings.length ? findings.join('; ') : `${textFiles.length} text files scanned`);

const mjsFiles = files.filter((path) => extname(path).toLowerCase() === '.mjs');
const syntaxFailures = [];
for (const path of mjsFiles) {
  const result = runNode(['--check', path]);
  if (result.status !== 0) syntaxFailures.push(`${relative(skillDir, path)}: ${result.stderr.trim()}`);
}
check('JavaScript syntax', syntaxFailures.length === 0, syntaxFailures.length ? syntaxFailures.join('; ') : `${mjsFiles.length} files`);

const smokeCommands = [
  [join(skillDir, 'scripts', 'bridge-runner.mjs'), 'help'],
  [join(toolkitDir, '入口', 'st-bridge.mjs'), 'help'],
  [join(toolkitDir, '入口', 'st-config.mjs'), 'help'],
  [join(toolkitDir, '入口', 'st-debug.mjs'), 'help'],
  [join(toolkitDir, '角色卡导入器', 'import-card.mjs'), '--help'],
  [join(toolkitDir, '角色卡替换器', 'replace-card.mjs'), 'help'],
];
const smokeFailures = [];
for (const args of smokeCommands) {
  const result = runNode(args);
  if (result.status !== 0) smokeFailures.push(`${relative(skillDir, args[0])}: ${(result.stderr || result.stdout).trim()}`);
}
check('CLI help smoke tests', smokeFailures.length === 0, smokeFailures.length ? smokeFailures.join('; ') : `${smokeCommands.length} commands`);

const passed = checks.every((item) => item.passed);
for (const item of checks) {
  console.log(`${item.passed ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
}
console.log(`\nResult: ${checks.filter((item) => item.passed).length}/${checks.length} passed`);
if (!passed) process.exit(1);
