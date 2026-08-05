#!/usr/bin/env node
// ============================================================
// st-bridge.mjs — AI 接入 SillyTavern 命令行桥（Playwright / Edge）
// ------------------------------------------------------------
// 入口定位：对应三件套中的「入口」。
// 它让 AI 代理（Codex 等）通过命令行连接本地酒馆，
// 读取聊天/角色/世界书、执行 Slash 命令、发送消息并等待回复。
// 所有酒馆操作复用 核心/tavern-session.mjs（CLI 与 API 共用）。
//
// 依赖：
//   - Node.js 18+
//   - Playwright（优先使用工具包依赖；必要时回退到 Codex bundled runtime）
//   - 浏览器：默认使用系统 Microsoft Edge（channel=msedge），无需下载
//     也可设置 ST_CHANNEL=chromium 并执行 `npx playwright install chromium`
//
// 环境变量：
//   ST_URL        酒馆地址（默认 http://127.0.0.1:8000）
//   ST_PASSWORD   白名单模式访问密码（仅登录表单可见时需要）
//   ST_CHANNEL    浏览器通道 msedge | chromium（默认 msedge）
//   ST_HEADED     设为 1 时显示浏览器窗口（默认无头）
//
// 用法：node 入口/st-bridge.mjs <命令> [参数...] [选项]
// 常用示例：
//   node 入口/st-bridge.mjs status
//   node 入口/st-bridge.mjs chat 10
//   node 入口/st-bridge.mjs characters
//   node 入口/st-bridge.mjs worldbook "Example Worldbook" --full
//   node 入口/st-bridge.mjs switch "Example Character"
//   node 入口/st-bridge.mjs send "你好，请继续剧情" --wait
//   node 入口/st-bridge.mjs exec "/echo hello"
//   node 入口/st-bridge.mjs eval "return ctx.chat.length"
// ============================================================

import { resolve } from 'node:path';
import * as session from '../核心/tavern-session.mjs';

const HELP = `
st-bridge — AI 接入 SillyTavern 命令行桥

用法:
  node 入口/st-bridge.mjs <命令> [参数...] [选项]

命令:
  status                     酒馆/助手版本、当前角色、聊天与连接状态
  chat [条数]                读取最近聊天（默认 20 条；--raw 输出完整正文）
  characters                 列出全部角色卡
  switch <角色名>            切换到指定角色的聊天（点击角色行）
  send <文本>                发送用户消息并触发 AI 生成
                             默认在同一进程内等待结束；--no-wait 仅入队后退出
  delete [数量]              删除末尾消息（默认 1 条），走酒馆核心删除事件
                             --dry-run 仅预览；删除会触发 MVU 回退
  regenerate                 点击酒馆内置“重新生成”并等待替代回复完成
                             选项: --timeout 毫秒；--dry-run 仅检查可用性
  wait [--timeout 毫秒]      仅等待当前页面已经存在的生成；无活动时立即返回
  stop                       仅停止当前页面已经存在的生成；无活动时拒绝误报
  worldbooks                 列出世界书
  worldbook <名称>           读取世界书条目摘要；--full 输出完整内容
  exec <slash命令>           执行酒馆 Slash 命令（如 "/echo hi"）
  eval <JS代码>              在酒馆页面执行 JS（ctx=SillyTavern.getContext(),
                             TH=window.TavernHelper 已注入，return 结果）
  screenshot [路径]          保存页面截图（默认当前目录 st-bridge-output/screenshots/）
  help                       显示本帮助

选项:
  --url <地址>               酒馆地址（默认 env ST_URL 或 http://127.0.0.1:8000）
  --json                     输出 JSON（供 AI 程序化消费）
  --timeout <毫秒>           等待超时（默认 180000）
  --headed                   显示浏览器窗口
  --channel <msedge|chromium> 浏览器通道（默认 env ST_CHANNEL 或 msedge）
  --character <角色名>       同一命令内切换到目标角色（send/delete/regenerate）
  --chat-id <聊天ID>         打开目标聊天；必须同时提供 --character
  --full                     世界书输出完整内容
  --raw                      聊天输出完整正文
  --dry-run                  只验证操作可达，不实际点击/发送
  --no-wait                  发送入队后立即退出；不能再靠新的 CLI 进程续接 wait/stop

环境变量: ST_URL / ST_PASSWORD / ST_CHANNEL / ST_HEADED
`;

function parseArgs(argv) {
  const flags = { url: process.env.ST_URL || 'http://127.0.0.1:8000' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.json = true;
    else if (a === '--full') flags.full = true;
    else if (a === '--raw') flags.raw = true;
    else if (a === '--headed') flags.headed = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--wait') flags.wait = true;
    else if (a === '--no-wait') flags.noWait = true;
    else if (a === '--url') flags.url = argv[++i];
    else if (a === '--timeout') flags.timeout = Number(argv[++i]);
    else if (a === '--channel') flags.channel = argv[++i];
    else if (a === '--character') flags.character = argv[++i];
    else if (a === '--chat-id') flags.chatId = argv[++i];
    else if (a.startsWith('--')) throw new Error(`未知选项: ${a}`);
    else positional.push(a);
  }
  const command = positional.shift() || 'help';
  return { command, args: positional, flags };
}

function out(obj, flags, render) {
  if (flags.json) {
    console.log(JSON.stringify(obj, null, 2));
  } else if (typeof render === 'function') {
    console.log(render(obj));
  } else {
    console.log(JSON.stringify(obj, null, 2));
  }
}

async function main() {
  const { command, args, flags } = parseArgs(process.argv.slice(2));
  if (command === 'help') {
    console.log(HELP);
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
        const d = await session.switchCharacter(page, args[0], !!flags.dryRun);
        out(d, flags, (x) => x.dryRun ? `已定位角色行（未点击）: ${x.character}` : `已切换: ${x.character}`);
        break;
      }
      case 'send': {
        if (flags.character || flags.chatId) {
          await session.selectCharacterChat(page, flags.character, flags.chatId);
        }
        const d = await session.sendAndWait(page, args.join(' '), {
          dryRun: !!flags.dryRun,
          wait: !flags.noWait,
          timeoutMs: flags.timeout || 180000,
        });
        out(d, flags, (x) => {
          if (x.dryRun) return `发送通道可用（未实际发送）: 输入框=${x.valueOk ? 'OK' : 'FAIL'} 发送键=${x.sendEnabled ? '可用' : '不可用'}`;
          const lines = [`已发送，新增消息 ${x.newMessages} 条。`];
          if (x.generation?.ended) lines.push('生成已结束。');
          else if (x.generation?.queued) lines.push('已触发生成（未等待）；本进程退出后不能用新的 wait/stop 续接。');
          else lines.push('等待超时，可再执行 wait 命令。');
          return lines.join('\n');
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
        const d = await session.regenerateLastMessage(page, {
          dryRun: !!flags.dryRun,
          timeoutMs: flags.timeout || 180000,
        });
        out(d, flags, (x) => {
          if (x.dryRun) {
            return x.available
              ? `[dry-run] 重新生成可用；当前末条为 [${x.last.index}] ${x.last.role} ${x.last.name || ''}`
              : '[dry-run] 当前没有可重新生成的角色/群组聊天';
          }
          return [
            `重新生成${x.generation?.ended ? '已完成' : '未完成（等待超时）'}。`,
            `消息数: ${x.before} → ${x.after}；生成类型: ${x.generation?.type || '未知'}`,
            x.last ? `新末条: [${x.last.index}] ${x.last.role} ${x.last.name || ''}\n${x.last.preview}` : '未得到新消息。',
          ].join('\n');
        });
        break;
      }
      case 'wait': {
        const state = await session.getGenerationState(page);
        const d = state.active
          ? await session.waitForGeneration(page, flags.timeout || 180000)
          : { ended: false, noActiveGeneration: true, state };
        out(d, flags, (x) => x.ended
          ? '生成已结束。'
          : x.noActiveGeneration ? '当前页面没有进行中的生成。' : '等待超时。');
        break;
      }
      case 'stop': {
        const d = await session.stopGeneration(page);
        out(d, flags, (x) => x.stopped ? '已请求停止生成。' : `无法停止: ${x.reason}`);
        break;
      }
      case 'worldbooks': {
        const d = await session.getWorldbooks(page);
        out(d, flags, (x) => [
          `当前角色: ${x.currentCharacter}`,
          `全局世界书: ${x.global.join('、') || '（无）'}`,
          `角色世界书: ${x.character ? JSON.stringify(x.character) : '（无）'}`,
          '',
          ...x.names.map((n) => `- ${n}`),
        ].join('\n'));
        break;
      }
      case 'worldbook': {
        const d = await session.getWorldbook(page, args[0], !!flags.full);
        out(d, flags, (x) => [
          `世界书: ${x.name}（${x.entryCount} 条）`,
          ...x.entries.map((e) => `- [${e.uid}] ${e.name || e.uid} | ${e.enabled ? '启用' : '禁用'} | ${e.strategy || '?'} | ${e.position || '?'} order=${e.order ?? '?'} | ${e.contentLength} 字${e.content !== undefined ? '\n' + e.content : ''}`),
        ].join('\n'));
        break;
      }
      case 'exec': {
        const d = await session.execSlash(page, args.join(' '));
        out(d, flags, (x) => x.ok ? `Slash: ${x.command}\n${x.result}` : `Slash 失败: ${x.command}\n${x.error}`);
        break;
      }
      case 'eval': {
        const d = await session.evalCode(page, args.join(' '));
        out(d, flags, (x) => x.ok ? `结果:\n${typeof x.result === 'string' ? x.result : JSON.stringify(x.result, null, 2)}` : `执行失败:\n${x.error}`);
        break;
      }
      case 'screenshot': {
        const target = args[0] || resolve(
          process.env.ST_OUTPUT_DIR || process.cwd(),
          'st-bridge-output',
          'screenshots',
          `st-${Date.now()}.png`,
        );
        const d = await session.takeScreenshot(page, target);
        out(d, flags, (x) => `截图已保存: ${x.path}`);
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
  console.error(`[st-bridge] 错误: ${e.message || e}`);
  process.exit(1);
});
