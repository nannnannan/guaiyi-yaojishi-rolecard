#!/usr/bin/env node
// SillyTavern 配置直读器：直接读取预设、正则和酒馆助手脚本的存储对象。
// 不启动生成、不监听提示词，也不修改任何酒馆数据。
import * as session from '../核心/tavern-session.mjs';

const HELP = `
st-config — SillyTavern 配置直读器（只读）

用法:
  node 入口/st-config.mjs preset [预设名] [--list] [--full]
  node 入口/st-config.mjs regex [--scope global|character|all] [--character 角色名] [--state all|enabled|disabled] [--full]
  node 入口/st-config.mjs scripts [--scope global|character|all] [--character 角色名] [--state all|enabled|disabled] [--full]

命令:
  preset                    读取当前加载预设；也可在后面指定预设名
  regex                     读取全局或指定角色的正则脚本
  scripts                   读取全局或指定角色的酒馆助手脚本

选项:
  --list                    preset 仅列出全部预设名
  --scope <范围>            global（默认）/ character / all
                            提供 --character 且不写 --scope 时默认 character
  --character <角色名>      读取该角色卡内嵌的正则或酒馆助手脚本
  --state <状态>            all（默认）/ enabled / disabled
  --full                    输出完整配置正文；敏感凭据字段仍会自动遮蔽
  --json                    输出 JSON，便于 AI 程序化读取
  --url <地址>              酒馆地址（默认 env ST_URL 或 http://127.0.0.1:8000）
  --headed                  显示浏览器窗口
  --channel <通道>          msedge（默认）或 chromium
  help                      显示本帮助

示例:
  npm run config -- preset
  npm run config -- preset --full --json
  npm run config -- regex --character "Example Character" --full --json
  npm run config -- scripts --scope all --character "Example Character" --full --json
`;

function parseArgs(argv) {
  const flags = {
    url: process.env.ST_URL || 'http://127.0.0.1:8000',
    enableState: 'all',
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--full') flags.full = true;
    else if (arg === '--list') flags.listOnly = true;
    else if (arg === '--headed') flags.headed = true;
    else if (arg === '--url') flags.url = argv[++i];
    else if (arg === '--channel') flags.channel = argv[++i];
    else if (arg === '--scope') flags.scope = argv[++i];
    else if (arg === '--character') flags.character = argv[++i];
    else if (arg === '--state') flags.enableState = argv[++i];
    else if (arg.startsWith('--')) throw new Error(`未知选项：${arg}`);
    else positional.push(arg);
  }
  return { command: positional.shift() || 'help', args: positional, flags };
}

function renderPreset(data, flags) {
  if (flags.full) return JSON.stringify(data, null, 2);
  if (flags.listOnly) {
    return [
      `当前加载预设：${data.loadedName || '（无）'}`,
      `预设总数：${data.names.length}`,
      ...data.names.map((name) => `- ${name}`),
    ].join('\n');
  }
  return [
    `预设：${data.selectedName || data.requestedName}`,
    `当前加载：${data.loadedName || '（无）'}`,
    `提示词块：${data.promptCount}`,
    `设置字段：${data.settingKeys.join('、') || '（无）'}`,
    ...data.prompts.map((prompt) => `- [${prompt.enabled ? '启用' : '禁用'}] ${prompt.name} | ${prompt.role || '?'} | ${prompt.contentLength} 字`),
  ].join('\n');
}

function renderRegex(data, flags) {
  if (flags.full) return JSON.stringify(data, null, 2);
  return [
    `正则：${data.itemCount} 条 | 范围 ${data.scope} | 状态 ${data.enableState}${data.character ? ` | 角色 ${data.character}` : ''}`,
    ...data.entries.map((item) => `- [${item.enabled ? '启用' : '禁用'}] ${item.name} | ${item.scope} | 匹配 ${item.findLength} 字 / 替换 ${item.replaceLength} 字`),
  ].join('\n');
}

function renderScripts(data, flags) {
  if (flags.full) return JSON.stringify(data, null, 2);
  return [
    `酒馆助手脚本：${data.itemCount} 个 | 范围 ${data.scope} | 状态 ${data.enableState}${data.character ? ` | 角色 ${data.character}` : ''}`,
    ...data.entries.map((item) => `- [${item.enabled ? '启用' : '禁用'}] ${item.name} | ${item.scope} | ${item.contentLength} 字 | 按钮 ${item.buttonCount}`),
  ].join('\n');
}

async function main() {
  const { command, args, flags } = parseArgs(process.argv.slice(2));
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }
  if (!['preset', 'regex', 'scripts'].includes(command)) {
    throw new Error(`未知命令：${command}\n${HELP}`);
  }
  if (command !== 'preset' && args.length > 0) throw new Error(`${command} 不接受位置参数，请使用 --character/--scope`);
  if (command === 'preset' && args.length > 1) throw new Error('preset 最多接受一个预设名');
  if (flags.listOnly && command !== 'preset') throw new Error('--list 仅适用于 preset');

  const { browser, page } = await session.connect(flags.url, flags);
  try {
    let data;
    let render;
    if (command === 'preset') {
      data = await session.getPresetConfig(page, {
        name: args[0] || 'in_use',
        full: flags.full,
        listOnly: flags.listOnly,
      });
      render = renderPreset;
    } else if (command === 'regex') {
      data = await session.getRegexConfigs(page, flags);
      render = renderRegex;
    } else {
      data = await session.getHelperScriptConfigs(page, flags);
      render = renderScripts;
    }
    console.log(flags.json ? JSON.stringify(data, null, 2) : render(data, flags));
  } finally {
    await session.closeSession({ browser });
  }
}

main().catch((error) => {
  console.error(`[st-config] 错误：${error?.message || error}`);
  process.exit(1);
});
