// 运行时探测脚本：连接本地 SillyTavern，输出真实 API 表面（供开发与手册校对）。
// 用法: node tools/probe.mjs [url]
// 依赖: Playwright（优先使用本机已装包，其次 Bundled Runtime 自带包）
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
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
        title: document.title,
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
            role: m.role,
            name: m.name,
            message: typeof m.message === 'string' ? m.message.slice(0, 60) : null,
            mes: typeof m.mes === 'string' ? m.mes.slice(0, 60) : null,
          };
        }
        out.currentCharacter = {
          name: ctx.name2 || null,
          characterId: ctx.characterId ?? null,
        };
        out.chatFile = ctx.chatMetadata ? Object.keys(ctx.chatMetadata).slice(0, 20) : null;
        out.worldInfoCount = Array.isArray(ctx.worldInfo) ? ctx.worldInfo.length : null;
        if (Array.isArray(ctx.worldInfo) && ctx.worldInfo.length > 0) {
          const w = ctx.worldInfo[0];
          out.firstWorldInfo = {
            keys: Object.keys(w),
            uid: w.uid,
            comment: w.comment,
          };
        }
        out.eventSource = has(ctx.eventSource) ? {
          hasOn: typeof ctx.eventSource.on,
          hasEmit: typeof ctx.eventSource.emit,
        } : null;
        out.eventTypes = has(ctx.eventTypes)
          ? Object.keys(ctx.eventTypes).slice(0, 200)
          : null;
        out.characters = Array.isArray(ctx.characters)
          ? ctx.characters.map((c) => ({ name: c.name, avatar: !!c.avatar, id: c.id ?? null })).slice(0, 30)
          : null;
        out.chatId = ctx.chatId ?? null;
        out.worldInfo = Array.isArray(ctx.worldInfo)
          ? ctx.worldInfo.map((w) => ({ uid: w.uid, comment: w.comment, enabled: w.enabled })).slice(0, 30)
          : null;
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
          placeholder: i.placeholder,
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
