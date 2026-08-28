#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const runtimeDir = join(scriptsDir, 'runtime');
const nodeModules = join(runtimeDir, 'node_modules');

const tools = {
  start: ['tools', 'start-sillytavern.mjs'],
  bridge: ['入口', 'st-bridge.mjs'],
  config: ['入口', 'st-config.mjs'],
  debug: ['入口', 'st-debug.mjs'],
  'import-card': ['角色卡导入器', 'import-card.mjs'],
  'replace-card': ['角色卡替换器', 'replace-card.mjs'],
  probe: ['tools', 'probe.mjs'],
  verify: ['tools', 'verify-package.mjs'],
  'verify-live': ['tools', 'verify-live.mjs'],
  'verify-replace': ['tools', 'verify-replace-card.mjs'],
};

function printHelp() {
  console.log(`SillyTavern AI Bridge Skill

Usage:
  node scripts/bridge-runner.mjs setup
  node scripts/bridge-runner.mjs <tool> [arguments]

Tools:
  start, bridge, config, debug, import-card, replace-card, probe,
  verify, verify-live, verify-replace

Run a tool with "help" or "--help" for its detailed options.`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    stdio: 'inherit',
    shell: options.shell ?? false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

const [command = 'help', ...args] = process.argv.slice(2);
if (command === 'help' || command === '--help' || command === '-h') {
  printHelp();
} else if (command === 'setup') {
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const npmArgs = ['ci', '--ignore-scripts', '--cache', join(tmpdir(), 'sillytavern-ai-bridge-npm-cache')];
  const bundledNpmAvailable = existsSync(npmCli);
  run(bundledNpmAvailable ? process.execPath : 'npm', bundledNpmAvailable ? [npmCli, ...npmArgs] : npmArgs, {
    cwd: runtimeDir,
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
    shell: process.platform === 'win32' && !bundledNpmAvailable,
  });
} else if (!Object.hasOwn(tools, command)) {
  console.error(`Unknown tool: ${command}`);
  printHelp();
  process.exitCode = 2;
} else if (!existsSync(nodeModules) && !['verify', 'start'].includes(command)) {
  console.error('Dependencies are missing. Run: node scripts/bridge-runner.mjs setup');
  process.exitCode = 2;
} else {
  run(process.execPath, [join(runtimeDir, ...tools[command]), ...args]);
}
