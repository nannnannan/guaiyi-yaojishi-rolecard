#!/usr/bin/env node
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const HELP = `
start-sillytavern — 启动或确认本地 SillyTavern 服务

用法:
  node tools/start-sillytavern.mjs [--root <安装目录>] [--url <地址>] [--json]

选项:
  --root <目录>       SillyTavern 安装目录；也可设置 ST_ROOT
  --url <地址>        服务地址；默认 ST_URL 或 http://127.0.0.1:8000
  --log-dir <目录>    stdout/stderr 日志目录；也可设置 ST_LOG_DIR
  --timeout <毫秒>    启动等待时间，默认 30000
  --json              输出 JSON

安装目录解析顺序: --root、ST_ROOT、由 ST_DATA_DIR 反推、~/SillyTavern。
日志默认写入 <ST_DATA_DIR>/bridge-logs；可用 debug terminal-log 读取。
`;

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--root') flags.root = argv[++i];
    else if (arg === '--url') flags.url = argv[++i];
    else if (arg === '--log-dir') flags.logDir = argv[++i];
    else if (arg === '--timeout') flags.timeout = Number(argv[++i]);
    else if (arg === 'help' || arg === '--help' || arg === '-h') flags.help = true;
    else throw new Error(`未知选项: ${arg}`);
  }
  return flags;
}

async function isOnline(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

function output(value, json) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else if (value.alreadyOnline) console.log(`SillyTavern 已在线: ${value.url}`);
  else {
    console.log(`SillyTavern ${value.ready ? '已启动' : '启动后未在时限内就绪'}: ${value.url}`);
    console.log(`PID: ${value.pid}`);
    console.log(`stdout: ${value.logs.stdout}`);
    console.log(`stderr: ${value.logs.stderr}`);
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(HELP);
    return;
  }

  const url = flags.url || process.env.ST_URL || 'http://127.0.0.1:8000';
  if (await isOnline(url)) {
    output({ url, alreadyOnline: true, started: false, ready: true }, flags.json);
    return;
  }

  const dataDir = process.env.ST_DATA_DIR ? resolve(process.env.ST_DATA_DIR) : null;
  const root = resolve(
    flags.root
      || process.env.ST_ROOT
      || (dataDir ? join(dataDir, '..', '..') : join(homedir(), 'SillyTavern')),
  );
  const server = join(root, 'server.js');
  if (!existsSync(server)) {
    throw new Error(`未找到 SillyTavern server.js: ${server}；请设置 ST_ROOT 或 --root`);
  }

  const effectiveDataDir = dataDir || join(root, 'data', 'default-user');
  const logDir = resolve(flags.logDir || process.env.ST_LOG_DIR || join(effectiveDataDir, 'bridge-logs'));
  mkdirSync(logDir, { recursive: true });
  const stdoutPath = join(logDir, 'sillytavern.stdout.log');
  const stderrPath = join(logDir, 'sillytavern.stderr.log');
  const stdoutFd = openSync(stdoutPath, 'a');
  const stderrFd = openSync(stderrPath, 'a');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    detached: true,
    windowsHide: true,
    env: process.env,
    stdio: ['ignore', stdoutFd, stderrFd],
  });
  child.unref();
  closeSync(stdoutFd);
  closeSync(stderrFd);

  const timeout = Number.isFinite(flags.timeout) && flags.timeout > 0 ? flags.timeout : 30000;
  const deadline = Date.now() + timeout;
  let ready = false;
  while (Date.now() < deadline) {
    if (await isOnline(url)) {
      ready = true;
      break;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  const result = {
    url,
    alreadyOnline: false,
    started: true,
    ready,
    pid: child.pid,
    root,
    logs: { stdout: stdoutPath, stderr: stderrPath },
  };
  output(result, flags.json);
  if (!ready) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[start-sillytavern] 错误: ${error.message || error}`);
  process.exit(1);
});
