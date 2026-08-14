#!/usr/bin/env node
// ============================================================
// st-debug.mjs — 制卡调试闭环 CLI（Playwright / Edge）
// ------------------------------------------------------------
// 让 Codex 亲自参与制卡测试：
//   1) 自动导入角色卡/世界书到酒馆（走酒馆真实导入通道）
//   2) 放置文件到酒馆数据目录的特定位置
//   3) 切换角色、发送测试消息、等待生成
//   4) 监听事件 / 控制台错误 / 酒馆 toast（JSONL 输出）
//   5) 一键闭环 test：导入→测试→监听→清理，恢复原状
//
// 事件和页面 API 随宿主版本变化；不确定时先运行 tools/probe.mjs。
//
// 环境变量：
//   ST_URL        酒馆地址（默认 http://127.0.0.1:8000）
//   ST_DATA_DIR   酒馆数据目录（默认 ~/SillyTavern/data/default-user，可覆盖）
//   ST_PASSWORD / ST_CHANNEL / ST_HEADED  同 st-bridge
// ============================================================

import { readFileSync, existsSync, statSync, mkdirSync, copyFileSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join, resolve, sep, basename } from 'node:path';
import { homedir } from 'node:os';
import * as session from '../核心/tavern-session.mjs';
import * as promptCapture from '../提示词监听/prompt-capture.mjs';

const ST_DATA_DIR = process.env.ST_DATA_DIR || join(homedir(), 'SillyTavern/data/default-user');

const PLACE_ROOTS = [
  'characters',
  'worlds',
  'chats',
  'group chats',
  'QuickReplies',
  'backgrounds',
  'user',
  'extensions',
  'instruct',
  'sysprompt',
  'themes',
  'OpenAI Settings',
  'TextGen Settings',
];

const HELP = `
st-debug — 制卡调试闭环（Codex 亲测酒馆新卡）

用法:
  node 入口/st-debug.mjs <命令> [参数...] [选项]

命令:
  status / chat [n] / characters / switch <角色名>
                              基础接入命令（与 st-bridge 一致）
  talk <角色名> <文本>         同一次连接内切换角色、发送并等待回复（不清理）
  send <文本>                 发送测试消息并默认等待生成；--no-wait 仅入队
  delete [数量]               删除末尾消息（默认 1 条）；--dry-run 仅预览
                               通过 MESSAGE_DELETED 保留酒馆/MVU 原生回退链
  regenerate                  触发内置重新生成并等待完成；支持 --capture
  import <文件...>            自动导入角色卡/世界书（JSON/PNG/YAML/charx/byaf）
  place <文件> <目标>          放置文件到酒馆数据目录指定位置
                              目标示例: worlds/名字.json  chats/角色/聊天.jsonl
  listen [--timeout 毫秒]      监听事件/控制台/toast，JSONL 实时输出
                              --events 事件名,逗号分隔（默认全部）
  test <卡文件>                一键闭环：导入→切换→发送→监听→报告→清理
                              --prompt 测试文本 / --timeout 毫秒 / --keep 不清理
  cleanup <角色名>             删除测试角色卡（--purge-chats 同时删除聊天目录）
  log [行数]                  读取酒馆服务端日志尾部（默认 50 行）
  terminal-log [行数]         读取 start 保存的 stdout/stderr 尾部（默认 50 行）
  help                        显示本帮助

选项:
  --url <地址>  --json  --timeout <毫秒>  --headed  --channel <msedge|chromium>
  --character <角色名>  --chat-id <聊天ID>（send/delete/regenerate 显式定位）
  --dry-run（import/place/send 支持）
  --capture                   捕获本轮完整请求负载（系统提示/预设/世界书/历史/输入）
                              与模型回复，写入 ST_CAPTURE_DIR 或当前目录输出区

环境变量: ST_URL / ST_DATA_DIR / ST_PASSWORD / ST_CHANNEL / ST_HEADED /
          ST_OUTPUT_DIR / ST_CAPTURE_DIR / ST_LOG_DIR
`;

function parseArgs(argv) {
  const flags = { url: process.env.ST_URL || 'http://127.0.0.1:8000' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.json = true;
    else if (a === '--headed') flags.headed = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--wait') flags.wait = true;
    else if (a === '--no-wait') flags.noWait = true;
    else if (a === '--keep') flags.keep = true;
    else if (a === '--raw') flags.raw = true;
    else if (a === '--purge-chats') flags.purgeChats = true;
    else if (a === '--capture') flags.capture = true;
    else if (a === '--url') flags.url = argv[++i];
    else if (a === '--timeout') flags.timeout = Number(argv[++i]);
    else if (a === '--channel') flags.channel = argv[++i];
    else if (a === '--events') flags.events = argv[++i];
    else if (a === '--prompt') flags.prompt = argv[++i];
    else if (a === '--character') flags.character = argv[++i];
    else if (a === '--chat-id') flags.chatId = argv[++i];
    else if (a.startsWith('--')) throw new Error(`未知选项: ${a}`);
    else positional.push(a);
  }
  const command = positional.shift() || 'help';
  return { command, args: positional, flags };
}

function out(obj, flags, render) {
  if (flags.json) console.log(JSON.stringify(obj, null, 2));
  else if (typeof render === 'function') console.log(render(obj));
  else console.log(JSON.stringify(obj, null, 2));
}

function absPath(p) {
  return resolve(p);
}

// 捕获本轮完整请求/回复并落盘（send/talk/test 共用）
async function finishCapture(page, meta, flags, waitMs = 6000) {
  const deadline = Date.now() + waitMs;
  let turn = null;
  while (Date.now() < deadline) {
    turn = await promptCapture.takePromptCapture(page, meta);
    if (turn) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!turn) return { captured: false, reason: '未捕获到模型请求（可能未触发生成或请求未走代理接口）' };
  const paths = promptCapture.writeCaptureFiles(
    turn,
    flags.captureDir || process.env.ST_CAPTURE_DIR || promptCapture.defaultCaptureDir,
  );
  const summary = promptCapture.summarizeCapture(turn);
  summary.file = paths.file;
  return { captured: true, file: paths.file, viewerFile: paths.viewerFile, summary };
}

// ---------- 文件类型识别 ----------

function detectCardType(filePath) {
  const ext = basename(filePath).split('.').pop()?.toLowerCase();
  if (ext === 'png' || ext === 'yaml' || ext === 'yml' || ext === 'charx' || ext === 'byaf') {
    return { type: 'character', ext };
  }
  if (ext === 'json') {
    let data = null;
    try {
      data = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      throw new Error(`无法解析 JSON 文件: ${filePath}`);
    }
    if (data && typeof data === 'object' && !Array.isArray(data) && 'entries' in data) {
      return { type: 'worldbook', ext, data };
    }
    if (data && typeof data === 'object' && typeof data.name === 'string') {
      return { type: 'character', ext, data };
    }
    throw new Error('无法识别文件类型：JSON 既不是角色卡（含 name），也不是世界书（含 entries）');
  }
  if (ext === 'jsonl') {
    throw new Error('聊天文件（.jsonl）暂不支持自动导入，请使用 place 放置到 chats/ 目录');
  }
  throw new Error(`不支持的文件类型: .${ext || '?'}`);
}

// ---------- 放置到酒馆特定位置 ----------

function validateDataDir() {
  if (!existsSync(ST_DATA_DIR)) {
    throw new Error(`酒馆数据目录不存在: ${ST_DATA_DIR}（请设置 ST_DATA_DIR）`);
  }
  return resolve(ST_DATA_DIR);
}

function resolvePlaceTarget(target) {
  const dataDir = validateDataDir();
  const parts = target.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`目标格式应为 <目录>/<相对路径>，如 worlds/名字.json（可用目录: ${PLACE_ROOTS.join('、')}）`);
  }
  const root = parts[0];
  if (!PLACE_ROOTS.includes(root)) {
    throw new Error(`不支持的放置目录: ${root}（可用: ${PLACE_ROOTS.join('、')}）`);
  }
  const rel = parts.slice(1).join(sep);
  const final = resolve(dataDir, root, rel);
  if (!final.startsWith(resolve(dataDir) + sep)) {
    throw new Error('目标路径越界，已拒绝');
  }
  return { dataDir, final, root, rel };
}

function placeFile(filePath, target, dryRun) {
  const src = absPath(filePath);
  if (!existsSync(src)) throw new Error(`源文件不存在: ${src}`);
  const { final } = resolvePlaceTarget(target);
  if (dryRun) {
    return { dryRun: true, src, target: final, exists: existsSync(final) };
  }
  mkdirSync(dirname(final), { recursive: true });
  if (existsSync(final)) {
    const bak = `${final}.bak-${Date.now()}`;
    copyFileSync(final, bak);
  }
  copyFileSync(src, final);
  return { placed: true, src, target: final, size: statSync(final).size };
}

// ---------- 日志 ----------

function tailLog(lines) {
  const logPath = join(validateDataDir(), 'content.log');
  if (!existsSync(logPath)) throw new Error(`服务端日志不存在: ${logPath}`);
  const text = readFileSync(logPath, 'utf8');
  const all = text.split(/\r?\n/);
  return all.slice(-lines).join('\n');
}

function tailTextFile(path, lines) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8').split(/\r?\n/).slice(-lines).join('\n');
}

function tailTerminalLogs(lines) {
  const logDir = resolve(process.env.ST_LOG_DIR || join(validateDataDir(), 'bridge-logs'));
  const stdoutPath = join(logDir, 'sillytavern.stdout.log');
  const stderrPath = join(logDir, 'sillytavern.stderr.log');
  return {
    lines,
    stdout: { path: stdoutPath, content: tailTextFile(stdoutPath, lines) },
    stderr: { path: stderrPath, content: tailTextFile(stderrPath, lines) },
  };
}

// ---------- 聊天目录清理（仅限明确指定的角色） ----------

async function purgeChatDir(characterName, dryRun) {
  const dataDir = validateDataDir();
  const dir = resolve(dataDir, 'chats', characterName);
  if (!dir.startsWith(resolve(dataDir, 'chats') + sep)) {
    throw new Error('聊天目录路径越界，已拒绝');
  }
  if (!existsSync(dir)) return { purged: false, reason: '目录不存在' };
  if (dryRun) return { dryRun: true, target: dir, files: readdirSync(dir).length };
  // 酒馆可能仍持有文件句柄，重试几次；失败只告警不中断
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return { purged: true, target: dir };
    } catch (e) {
      if (attempt === 3) return { purged: false, reason: String(e && e.message || e) };
      await sleep(800);
    }
  }
  return { purged: false, reason: '未知错误' };
}

// 删除角色卡前先把聊天目录备份到酒馆 backups/（防止 TH.deleteCharacter 连聊天一起删）
function backupChatDir(characterName) {
  const dataDir = validateDataDir();
  const src = resolve(dataDir, 'chats', characterName);
  if (!existsSync(src)) return { backedUp: false, reason: '聊天目录不存在' };
  const backupsDir = resolve(dataDir, 'backups');
  mkdirSync(backupsDir, { recursive: true });
  const dest = join(backupsDir, `chat-${characterName}-${Date.now()}`);
  cpSync(src, dest, { recursive: true });
  return { backedUp: true, target: dest };
}

// ---------- 主流程 ----------

async function main() {
  const { command, args, flags } = parseArgs(process.argv.slice(2));
  if (command === 'help') {
    console.log(HELP);
    return;
  }
  if (command === 'log') {
    const lines = Number(args[0]) || 50;
    const text = tailLog(lines);
    if (flags.json) console.log(JSON.stringify({ lines, content: text }));
    else console.log(text);
    return;
  }
  if (command === 'terminal-log') {
    const result = tailTerminalLogs(Number(args[0]) || 50);
    out(result, flags, (x) => [
      `[stdout] ${x.stdout.path}\n${x.stdout.content ?? '（日志文件不存在）'}`,
      `[stderr] ${x.stderr.path}\n${x.stderr.content ?? '（日志文件不存在）'}`,
    ].join('\n\n'));
    return;
  }
  const { browser, page } = await session.connect(flags.url, flags);
  try {
    switch (command) {
      case 'status': {
        const d = await session.getStatus(page);
        out(d, flags, (x) => [
          `酒馆:       ${x.tavernVersion} (${x.url})`,
          `Tavern Helper: ${x.helperVersion}`,
          `当前角色:   ${x.currentCharacter}`,
          `聊天 ID:    ${x.chatId}`,
          `消息数:     ${x.messageCount}`,
          `连接状态:   ${x.onlineStatus}`,
          `角色卡数:   ${x.characters}   世界书数: ${x.worldbooks}`,
        ].join('\n'));
        break;
      }
      case 'chat': {
        const d = await session.getChat(page, args[0], flags.raw);
        out({ count: d.length, messages: d }, flags, (x) => {
          const lines = x.messages.map((m) => `[${m.index}] ${m.role}${m.name ? ` (${m.name})` : ''} ${m.sendDate || ''}\n${m.mes}`);
          return [`聊天共 ${x.count} 条：`, ...lines].join('\n\n');
        });
        break;
      }
      case 'characters': {
        const d = await session.getCharacters(page);
        out(d, flags, (x) => [`当前角色: ${x.current}`, '', ...x.names.map((n) => `- ${n}`)].join('\n'));
        break;
      }
      case 'switch': {
        if (!args[0]) throw new Error('用法: switch <角色名>');
        const d = await session.switchCharacter(page, args[0], !!flags.dryRun);
        out(d, flags, (x) => x.dryRun ? `已定位角色行（未点击）: ${x.character}` : `已切换: ${x.character}`);
        break;
      }
      case 'send': {
        if (flags.character || flags.chatId) {
          await session.selectCharacterChat(page, flags.character, flags.chatId);
        }
        if (flags.capture && !flags.dryRun) await promptCapture.installPromptCapture(page);
        const shouldWait = !flags.noWait;
        const d = await session.sendAndWait(page, args.join(' '), {
          dryRun: !!flags.dryRun,
          wait: shouldWait,
          timeoutMs: flags.timeout || 180000,
        });
        if (flags.capture && !flags.dryRun) {
          d.capture = await finishCapture(page, {
            char: await page.evaluate(() => SillyTavern.getContext().name2 ?? ''),
            chatId: d.after ? await page.evaluate(() => SillyTavern.getContext().chatId ?? '') : '',
            input: args.join(' '),
          }, flags, shouldWait ? 3000 : 8000);
        }
        out(d, flags, (x) => {
          if (x.dryRun) return `发送通道可用（未实际发送）: 输入框=${x.valueOk ? 'OK' : 'FAIL'} 发送键=${x.sendEnabled ? '可用' : '不可用'}`;
          const captureLine = x.capture?.captured
            ? `\n[提示词监听] ${x.capture.file}\n  模型 ${x.capture.summary.model}｜${x.capture.summary.messages} 条消息（${x.capture.summary.roles.join('/')}）｜提示 ${x.capture.summary.promptTokens} token｜回复 ${x.capture.summary.replyChars} 字符｜世界书命中 ${x.capture.summary.worldbookHits}`
            : '';
          return `已发送，新增消息 ${x.newMessages} 条。${x.generation?.ended ? '生成已结束。' : x.generation?.queued ? '已触发生成（未等待）。' : '等待超时。'}${captureLine}`;
        });
        break;
      }
      case 'delete': {
        if (flags.character || flags.chatId) {
          await session.selectCharacterChat(page, flags.character, flags.chatId);
        }
        const count = args[0] === undefined ? 1 : Number(args[0]);
        const d = await session.deleteLastMessages(page, count, !!flags.dryRun);
        out(d, flags, (x) => {
          if (x.dryRun) {
            const targets = x.targets.map((m) => `[${m.index}] ${m.role} ${m.name || ''}`).join('、') || '（无）';
            return x.available
              ? `[dry-run] 将删除末尾 ${x.count} 条消息：${targets}`
              : `[dry-run] 当前不可删除：${x.reason}`;
          }
          return [
            `已删除末尾 ${x.deleted} 条消息（${x.before} → ${x.after}）。`,
            `酒馆 MESSAGE_DELETED 事件: ${x.deletionEvents} 次（MVU 可据此回退）。`,
            x.last ? `当前末条: [${x.last.index}] ${x.last.role} ${x.last.name || ''}` : '当前聊天已空。',
          ].join('\n');
        });
        break;
      }
      case 'regenerate': {
        if (flags.character || flags.chatId) {
          await session.selectCharacterChat(page, flags.character, flags.chatId);
        }
        if (flags.capture && !flags.dryRun) await promptCapture.installPromptCapture(page);
        const d = await session.regenerateLastMessage(page, {
          dryRun: !!flags.dryRun,
          timeoutMs: flags.timeout || 180000,
        });
        if (flags.capture && !flags.dryRun) {
          d.capture = await finishCapture(page, {
            char: await page.evaluate(() => SillyTavern.getContext().name2 ?? ''),
            chatId: d.chatId || '',
            input: '[regenerate]',
          }, flags, 3000);
        }
        out(d, flags, (x) => {
          if (x.dryRun) {
            return x.available
              ? `[dry-run] 重新生成可用；当前末条为 [${x.last.index}] ${x.last.role} ${x.last.name || ''}`
              : '[dry-run] 当前没有可重新生成的角色/群组聊天';
          }
          const lines = [
            `重新生成${x.generation?.ended ? '已完成' : '未完成（等待超时）'}。`,
            `消息数: ${x.before} → ${x.after}；生成类型: ${x.generation?.type || '未知'}`,
            x.last ? `新末条: [${x.last.index}] ${x.last.role} ${x.last.name || ''}\n${x.last.preview}` : '未得到新消息。',
          ];
          if (x.capture?.captured) {
            lines.push(`[提示词监听] ${x.capture.file}`);
          }
          return lines.join('\n');
        });
        break;
      }
      case 'talk': {
        if (args.length < 2) throw new Error('用法: talk <角色名> <文本>');
        const name = args[0];
        const text = args.slice(1).join(' ');
        if (flags.chatId) await session.selectCharacterChat(page, name, flags.chatId);
        else await session.switchCharacter(page, name, false);
        if (flags.capture) await promptCapture.installPromptCapture(page);
        const send = await session.sendAndWait(page, text, {
          wait: true,
          timeoutMs: flags.timeout || 180000,
        });
        const actualNew = Math.max(0, (await page.evaluate(() => SillyTavern.getContext().chat.length)) - send.before);
        let messages = [];
        if (actualNew > 0) {
          const chat = await session.getChat(page, actualNew + 1, true);
          messages = chat.slice(-actualNew);
        }
        const talkResult = {
          character: name,
          sent: text,
          newMessages: actualNew,
          generationEnded: send.generation?.ended === true,
          generationTimeout: send.generation?.timeout === true,
          messages,
        };
        if (flags.capture) {
          talkResult.capture = await finishCapture(page, {
            char: name,
            chatId: await page.evaluate(() => SillyTavern.getContext().chatId ?? ''),
            input: text,
          }, flags, 3000);
        }
        out(talkResult, flags, (x) => {
          const lines = [`角色: ${x.character}`, `我发: ${x.sent}`, `新增消息: ${x.newMessages} 条${x.generationTimeout ? '（生成超时）' : ''}`];
          for (const m of x.messages) {
            lines.push(`\n[${m.role}] ${m.name || ''}\n${m.mes}`);
          }
          if (x.capture?.captured) {
            lines.push(`\n[提示词监听] ${x.capture.file}`);
            lines.push(`  模型 ${x.capture.summary.model}｜${x.capture.summary.messages} 条消息（${x.capture.summary.roles.join('/')}）｜提示 ${x.capture.summary.promptTokens} token｜回复 ${x.capture.summary.replyChars} 字符｜世界书命中 ${x.capture.summary.worldbookHits}`);
          }
          return lines.join('\n');
        });
        break;
      }
      case 'import': {
        if (!args.length) throw new Error('用法: import <文件...>');
        const results = [];
        for (const file of args) {
          const src = absPath(file);
          if (!existsSync(src)) throw new Error(`文件不存在: ${src}`);
          const { type } = detectCardType(src);
          if (flags.dryRun) {
            results.push({ dryRun: true, file: src, type });
            continue;
          }
          const r = type === 'character'
            ? await session.importCharacterFile(page, src)
            : await session.importWorldbookFile(page, src);
          results.push({ file: src, type, ...r });
        }
        out(results, flags, (arr) => arr.map((r) => r.dryRun
          ? `[dry-run] ${r.file} → ${r.type}`
          : `已导入 ${r.type}: ${r.name}（来源 ${r.file}）`).join('\n'));
        break;
      }
      case 'place': {
        if (args.length < 2) throw new Error('用法: place <文件> <目标>');
        const d = placeFile(args[0], args[1], !!flags.dryRun);
        out(d, flags, (x) => x.dryRun
          ? `[dry-run] ${x.src} → ${x.target}${x.exists ? '（目标已存在，将先备份）' : ''}`
          : `已放置: ${x.src} → ${x.target}（${x.size} 字节）`);
        break;
      }
      case 'listen': {
        const events = flags.events ? flags.events.split(',').map((s) => s.trim()).filter(Boolean) : session.DEBUG_EVENTS;
        const timeoutMs = flags.timeout || 30000;
        console.log(JSON.stringify({ t: new Date().toISOString(), kind: 'listen-start', events, timeoutMs }));
        const r = await session.listen(page, {
          events,
          timeoutMs,
          onEntry: (e) => console.log(JSON.stringify(e)),
        });
        console.log(JSON.stringify({ t: new Date().toISOString(), kind: 'listen-end', count: r.count }));
        break;
      }
      case 'test': {
        if (!args[0]) throw new Error('用法: test <卡文件> [--prompt 文本]');
        const cardFile = absPath(args[0]);
        if (!existsSync(cardFile)) throw new Error(`卡文件不存在: ${cardFile}`);
        const prompt = flags.prompt || '（调试测试）请回复 OK，确认你在正常工作。';
        const report = { cardFile, steps: {} };

        // 1) 导入
        const imp = await session.importCharacterFile(page, cardFile);
        report.steps.import = imp;
        console.log(JSON.stringify({ t: new Date().toISOString(), kind: 'step', step: 'import', ...imp }));

        // 2) 切换
        await session.switchCharacter(page, imp.name, false);
        report.steps.switch = { character: imp.name };
        console.log(JSON.stringify({ t: new Date().toISOString(), kind: 'step', step: 'switch', character: imp.name }));

        // 3) 发送 + 监听（并行）
        const done = {};
        const stopSignal = new Promise((resolve) => { done.resolve = resolve; });
        if (flags.capture) await promptCapture.installPromptCapture(page);
        const listenPromise = session.listen(page, {
          timeoutMs: (flags.timeout || 120000) + 5000,
          stopSignal,
          onEntry: (e) => console.log(JSON.stringify(e)),
        });
        const send = await session.sendAndWait(page, prompt, {
          wait: true,
          timeoutMs: flags.timeout || 120000,
        });
        report.steps.send = {
          prompt,
          newMessages: send.newMessages,
          generationEnded: send.generation?.ended === true,
          generationTimeout: send.generation?.timeout === true,
        };
        console.log(JSON.stringify({ t: new Date().toISOString(), kind: 'step', step: 'send', ...report.steps.send }));
        done.resolve();
        const listened = await listenPromise;
        const errors = listened.entries.filter((e) => e.kind === 'console' || e.kind === 'pageerror');
        const toasts = listened.entries.filter((e) => e.kind === 'toast');
        report.listen = { total: listened.count, errors: errors.length, toasts: toasts.length };
        report.errors = errors.slice(0, 10);
        report.toasts = toasts.slice(0, 10);
        if (flags.capture) {
          report.capture = await finishCapture(page, {
            char: imp.name,
            chatId: await page.evaluate(() => SillyTavern.getContext().chatId ?? ''),
            input: prompt,
          }, flags, 3000);
        }

        // 4) 读取新消息（等待助手消息渲染完成，最多 10 秒）
        let lastAssistant = null;
        const afterCount = await page.evaluate(() => SillyTavern.getContext().chat.length);
        const actualNew = afterCount - (send.before ?? afterCount);
        if (actualNew > 0) {
          const deadline = Date.now() + 10000;
          while (Date.now() < deadline) {
            const chat = await session.getChat(page, actualNew + 1, true);
            const newOnes = chat.slice(-actualNew);
            const found = [...newOnes].reverse().find((m) => m.role === 'assistant');
            if (found) {
              lastAssistant = found;
              break;
            }
            await sleep(500);
          }
        }
        report.steps.read = {
          newMessages: actualNew,
          lastAssistant: lastAssistant ? String(lastAssistant.mes).slice(0, 600) : null,
        };
        console.log(JSON.stringify({ t: new Date().toISOString(), kind: 'step', step: 'read', ...report.steps.read }));

        // 5) 清理（除非 --keep）
        if (!flags.keep) {
          const del = await session.deleteCharacterCard(page, imp.name);
          report.steps.cleanup = { deleted: del.ok, detail: del.ok ? del.ret : del.err };
          if (flags.purgeChats) {
            report.steps.cleanup.purgedChats = await purgeChatDir(imp.name, false);
          }
          console.log(JSON.stringify({ t: new Date().toISOString(), kind: 'step', step: 'cleanup', ...report.steps.cleanup }));
        }

        out(report, flags, (r) => [
          `卡文件:   ${r.cardFile}`,
          `导入:     ${r.steps.import?.name || '失败'}`,
          `发送:     ${r.steps.send?.newMessages} 条新消息，生成${r.steps.send?.generationEnded ? '结束' : '未完成'}`,
          `监听:     ${r.listen?.total} 条事件 / ${r.listen?.errors} 个错误 / ${r.listen?.toasts} 条提示`,
          `回复:     ${r.steps.read?.lastAssistant ? String(r.steps.read.lastAssistant).slice(0, 120) + '…' : '（无助手回复）'}`,
          `清理:     ${r.steps.cleanup?.deleted ? '已删除测试卡' : (r.steps.cleanup?.detail || '未清理（--keep）')}`,
        ].join('\n'));
        break;
      }
      case 'cleanup': {
        if (!args[0]) throw new Error('用法: cleanup <角色名>');
        const name = args[0];
        const chatBackup = backupChatDir(name);
        const del = await session.deleteCharacterCard(page, name);
        let chats = null;
        if (flags.purgeChats) chats = await purgeChatDir(name, !!flags.dryRun);
        out({ name, deleted: del.ok, detail: del.ok ? del.ret : del.err, chats, chatBackup }, flags, (x) => [
          `角色卡 ${x.name}: ${x.deleted ? '已删除' : '删除失败：' + (x.detail || '')}`,
          x.chats ? `聊天目录: ${x.chats.purged ? '已清理' : JSON.stringify(x.chats)}` : '',
          x.chatBackup?.backedUp ? `聊天已备份: ${x.chatBackup.target}` : '',
        ].filter(Boolean).join('\n'));
        break;
      }
      default:
        throw new Error(`未知命令: ${command}\n${HELP}`);
    }
  } finally {
    await session.closeSession({ browser });
  }
}

main().catch((e) => {
  console.error(`[st-debug] 错误: ${e.message || e}`);
  process.exit(1);
});
