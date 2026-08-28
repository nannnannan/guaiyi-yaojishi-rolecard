// 运行时探测脚本：连接 SillyTavern，输出经过隐私收敛的 API 能力表面。
// 用法: node tools/probe.mjs [url]
// 依赖: Playwright（优先使用工具包依赖，其次 Codex bundled runtime）
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const url = process.argv[2] || 'http://127.0.0.1:8000';

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    // Bundled runtime 回退
    const fallback = join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    return require(fallback);
  }
}

const { chromium } = loadPlaywright();

async function probe() {
  console.log(`[probe] connecting ${url} (Edge headless)...`);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const report = await page.evaluate(async () => {
      const out = {};
      const has = (v) => typeof v !== 'undefined';

      // 认证状态
      out.auth = {
        loginForm: !!document.querySelector('#login-form, #form_login, input[type="password"]'),
      };

      // 核心全局
      out.globals = {
        SillyTavern: typeof window.SillyTavern,
        getContext: has(window.SillyTavern) ? typeof window.SillyTavern.getContext : 'n/a',
        characters: typeof window.characters,
        chat: typeof window.chat,
        eventSource: typeof window.eventSource,
        executeSlashCommands: typeof window.executeSlashCommands,
        getContext_executeSlash: has(window.SillyTavern) && has(window.SillyTavern.getContext)
          ? typeof window.SillyTavern.getContext().executeSlashCommands
          : 'n/a',
        getContext_generate: has(window.SillyTavern) && has(window.SillyTavern.getContext)
          ? typeof window.SillyTavern.getContext().generate
          : 'n/a',
      };

      if (has(window.SillyTavern)) {
        out.SillyTavernVersion = window.SillyTavern.version || null;
        out.SillyTavernKeys = Object.keys(window.SillyTavern).slice(0, 120);
      }

      const ctx = has(window.SillyTavern) && has(window.SillyTavern.getContext)
        ? window.SillyTavern.getContext()
        : null;
      if (ctx) {
        out.contextKeys = Object.keys(ctx).slice(0, 200);
        out.chatCount = Array.isArray(ctx.chat) ? ctx.chat.length : null;
        if (Array.isArray(ctx.chat) && ctx.chat.length > 0) {
          const m = ctx.chat[0];
          out.firstMessage = {
            keys: Object.keys(m),
          };
        }
        out.currentCharacter = {
          present: Boolean(ctx.name2),
          characterIdPresent: ctx.characterId !== null && ctx.characterId !== undefined,
        };
        out.chatMetadataKeyCount = ctx.chatMetadata ? Object.keys(ctx.chatMetadata).length : null;
        out.worldInfoCount = Array.isArray(ctx.worldInfo) ? ctx.worldInfo.length : null;
        if (Array.isArray(ctx.worldInfo) && ctx.worldInfo.length > 0) {
          const w = ctx.worldInfo[0];
          out.firstWorldInfo = {
            keys: Object.keys(w),
          };
        }
        out.eventSource = has(ctx.eventSource) ? {
          hasOn: typeof ctx.eventSource.on,
          hasEmit: typeof ctx.eventSource.emit,
        } : null;
        out.eventTypes = has(ctx.eventTypes)
          ? Object.keys(ctx.eventTypes).slice(0, 200)
          : null;
        out.characterCount = Array.isArray(ctx.characters) ? ctx.characters.length : null;
        out.characterKeys = Array.isArray(ctx.characters) && ctx.characters[0]
          ? Object.keys(ctx.characters[0])
          : null;
        out.chatIdPresent = ctx.chatId !== null && ctx.chatId !== undefined;
        out.helpers = {
          TavernHelper: typeof window.TavernHelper,
          getScriptId: typeof window.getScriptId,
          Mvu: typeof window.Mvu,
        };
      }

      // UI 选择器
      const loginVisible = (() => {
        const els = document.querySelectorAll('#login-form, #form_login');
        for (const el of els) {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0) {
            return true;
          }
        }
        return false;
      })();
      out.ui = {
        sendForm: !!document.querySelector('#send_form'),
        sendTextarea: !!document.querySelector('#send_form textarea'),
        sendButton: !!document.querySelector('#send_but'),
        stopButton: !!document.querySelector('#stop_generating'),
        charNameHeader: !!document.querySelector('#character_name, .character_name'),
        chatInput: !!document.querySelector('#send_textarea'),
        loginVisible,
        loginInputs: Array.from(document.querySelectorAll('#login-form input, #form_login input')).map((i) => ({
          id: i.id,
          type: i.type,
        })),
      };

      return out;
    });

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

probe().catch((e) => {
  console.error('[probe] FAILED:', e);
  process.exit(1);
});
