// tavern-session.mjs — 酒馆连接会话模块（CLI 与 API 共用）
// 封装：浏览器连接、登录、就绪等待、生成监听、以及全部酒馆操作。
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);

const SENSITIVE_CONFIG_KEY = /(?:api[_-]?key|authorization|password|passwd|secret|access[_-]?token|refresh[_-]?token|cookie)/i;

function redactSensitiveConfig(value) {
  if (Array.isArray(value)) return value.map((item) => redactSensitiveConfig(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_CONFIG_KEY.test(key) ? '[已遮蔽]' : redactSensitiveConfig(item),
  ]));
}

export function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const fallback = join(
      process.env.USERPROFILE || homedir(),
      '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
    );
    return require(fallback);
  }
}

export async function connect(url, opts = {}) {
  const { chromium } = loadPlaywright();
  const headless = !(opts.headed || process.env.ST_HEADED === '1');
  const channel = opts.channel || process.env.ST_CHANNEL || 'msedge';
  const browser = await chromium.launch({ channel, headless });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // 等待核心 + Tavern Helper + 聊天数组就绪（扩展异步加载）
  await page.waitForFunction(
    () =>
      window.SillyTavern &&
      typeof window.SillyTavern.getContext === 'function' &&
      window.TavernHelper &&
      typeof window.TavernHelper.getTavernVersion === 'function' &&
      Array.isArray(SillyTavern.getContext().chat),
    null,
    { timeout: 30000 },
  );
  await page.waitForFunction(() => !!document.querySelector('#send_form'), null, { timeout: 15000 });
  // 等聊天真正加载完成：消息数 > 0，或已绑定具体聊天 ID（空聊天）
  const chatDeadline = Date.now() + 12000;
  while (Date.now() < chatDeadline) {
    const loaded = await page.evaluate(() => {
      const ctx = SillyTavern.getContext();
      return (Array.isArray(ctx.chat) && ctx.chat.length > 0) || ctx.chatId !== null;
    });
    if (loaded) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  // 角色列表异步加载（大卡文件多时较慢），等待就绪后再操作
  const charDeadline = Date.now() + 20000;
  while (Date.now() < charDeadline) {
    const loaded = await page.evaluate(() => {
      const ctx = SillyTavern.getContext();
      return Array.isArray(ctx.characters) && ctx.characters.length > 0;
    });
    if (loaded) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  await page.waitForTimeout(500);
  await handleLogin(page);
  await ensureApiConnected(page);
  return { browser, page };
}

// 酒馆按连接状态隐藏发送按钮（RossAscends-mods：未连接时 #send_but 加 displayNone）。
// 无头会话的 autoConnect 通常为 false，这里主动点 OpenAI 连接按钮并等待连接就绪，
// 否则 send/talk 会报「发送按钮不可见」。
export async function ensureApiConnected(page) {
  const state = await page.evaluate(() => {
    const btn = document.querySelector('#send_but');
    const sendVisible = btn
      ? window.getComputedStyle(btn).display !== 'none' && btn.getBoundingClientRect().width > 0
      : false;
    return { sendVisible, hasConnectBtn: !!document.querySelector('#api_button_openai') };
  });
  if (state.sendVisible || !state.hasConnectBtn) return { connected: state.sendVisible };
  await page.evaluate(() => {
    const btn = document.querySelector('#api_button_openai');
    if (btn) btn.click();
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const now = await page.evaluate(() => {
      const btn = document.querySelector('#send_but');
      return btn
        ? window.getComputedStyle(btn).display !== 'none' && btn.getBoundingClientRect().width > 0
        : false;
    });
    if (now) return { connected: true };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { connected: false, reason: '点击连接后发送按钮仍未出现（可能缺 API Key 或连接失败）' };
}

export async function handleLogin(page) {
  const visible = await page.evaluate(() => {
    const el = document.querySelector('#login-form, #form_login');
    if (!el) return false;
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  });
  if (!visible) return;
  const password = process.env.ST_PASSWORD;
  if (!password) {
    throw new Error('酒馆开启了访问密码（白名单模式）。请设置环境变量 ST_PASSWORD 后重试。');
  }
  await page.fill('#login-form input[type="password"], #form_login input[type="password"]', password);
  await page.click('#login-form button[type="submit"], #form_login button[type="submit"], #login-form .btn, #form_login .btn');
  await page.waitForFunction(() => {
    const el = document.querySelector('#login-form, #form_login');
    if (!el) return true;
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display === 'none' || r.height === 0;
  }, null, { timeout: 15000 });
}

// ---------- 生成等待 ----------

export async function installGenListeners(page) {
  await page.evaluate(() => {
    const ctx = SillyTavern.getContext();
    const et = ctx.eventTypes;
    if (window.__stBridgeCleanup) window.__stBridgeCleanup();
    window.__stBridgeGenStarted = false;
    window.__stBridgeGenEnded = false;
    window.__stBridgeGenType = null;
    window.__stBridgeDeletionEvents = 0;
    window.__stBridgeAfterDeletion = null;
    const fingerprint = (value) => {
      const text = JSON.stringify(value ?? null);
      let hash = 2166136261;
      for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return { chars: text.length, hash: (hash >>> 0).toString(16).padStart(8, '0') };
    };
    window.__stBridgeOnStart = (type) => {
      const live = SillyTavern.getContext();
      const last = Array.isArray(live.chat) ? live.chat[live.chat.length - 1] : null;
      window.__stBridgeGenStarted = true;
      window.__stBridgeGenType = type ?? null;
      window.__stBridgeGenStartChatLen = Array.isArray(live.chat) ? live.chat.length : 0;
      window.__stBridgeGenStartLastSignature = last
        ? JSON.stringify([last.is_user, last.is_system, last.send_date, last.swipe_id, last.mes])
        : null;
    };
    window.__stBridgeOnEnd = (type) => {
      window.__stBridgeGenEnded = true;
      if (window.__stBridgeGenType === null) window.__stBridgeGenType = type ?? null;
    };
    window.__stBridgeOnDeleted = () => {
      const live = SillyTavern.getContext();
      const last = Array.isArray(live.chat) ? live.chat[live.chat.length - 1] : null;
      window.__stBridgeDeletionEvents += 1;
      window.__stBridgeAfterDeletion = {
        messageCount: Array.isArray(live.chat) ? live.chat.length : 0,
        lastRole: last ? (last.is_user ? 'user' : last.is_system ? 'system' : 'assistant') : null,
        mvu: fingerprint(last?.variables?.[0]?.stat_data),
      };
    };
    ctx.eventSource.on(et.GENERATION_STARTED, window.__stBridgeOnStart);
    ctx.eventSource.on(et.GENERATION_ENDED, window.__stBridgeOnEnd);
    ctx.eventSource.on(et.MESSAGE_DELETED, window.__stBridgeOnDeleted);
    window.__stBridgeCleanup = () => {
      ctx.eventSource.removeListener(et.GENERATION_STARTED, window.__stBridgeOnStart);
      ctx.eventSource.removeListener(et.GENERATION_ENDED, window.__stBridgeOnEnd);
      ctx.eventSource.removeListener(et.MESSAGE_DELETED, window.__stBridgeOnDeleted);
    };
  });
}

export async function clearGenListeners(page) {
  await page.evaluate(() => {
    if (typeof window.__stBridgeCleanup === 'function') window.__stBridgeCleanup();
  }).catch(() => {});
}

export async function waitForGeneration(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const baseLen = await page.evaluate(() => SillyTavern.getContext().chat.length);
  let stableCount = 0;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const ctx = SillyTavern.getContext();
      const last = Array.isArray(ctx.chat) ? ctx.chat[ctx.chat.length - 1] : null;
      const lastSignature = last
        ? JSON.stringify([last.is_user, last.is_system, last.send_date, last.swipe_id, last.mes])
        : null;
      return {
        started: window.__stBridgeGenStarted === true,
        ended: window.__stBridgeGenEnded === true,
        type: window.__stBridgeGenType ?? null,
        deletionEvents: window.__stBridgeDeletionEvents ?? 0,
        afterDeletion: window.__stBridgeAfterDeletion ?? null,
        chatLen: Array.isArray(ctx.chat) ? ctx.chat.length : 0,
        stopping: !!document.querySelector('#stop_generating'),
        lastIsAssistant: Boolean(last && !last.is_user && !last.is_system),
        lastHasContent: Boolean(last && !['', '...'].includes(String(last.mes ?? '').trim())),
        lastFinished: Boolean(last?.gen_finished),
        lastChanged: lastSignature !== (window.__stBridgeGenStartLastSignature ?? null),
      };
    });
    if (s.ended) {
      return {
        ended: true,
        type: s.type,
        messageCount: s.chatLen,
        fallback: false,
        deletionEvents: s.deletionEvents,
        afterDeletion: s.afterDeletion,
      };
    }
    // 兜底：必须已收到 GENERATION_STARTED，且末条已变成新的非空助手消息。
    // 不能只看消息数增加：普通发送会先加入用户消息，旧判据会误判完成并关闭浏览器。
    if (s.started && !s.stopping && s.lastIsAssistant && s.lastHasContent && s.lastFinished && s.lastChanged) {
      stableCount += 1;
      if (stableCount >= 5) {
        await page.evaluate(async () => {
          const ctx = SillyTavern.getContext();
          if (typeof ctx.saveChat === 'function') await ctx.saveChat();
        });
        return {
          ended: true,
          type: s.type,
          messageCount: s.chatLen,
          fallback: true,
          deletionEvents: s.deletionEvents,
          afterDeletion: s.afterDeletion,
        };
      }
    } else {
      stableCount = 0;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  const observed = await page.evaluate(() => ({
    type: window.__stBridgeGenType ?? null,
    deletionEvents: window.__stBridgeDeletionEvents ?? 0,
    afterDeletion: window.__stBridgeAfterDeletion ?? null,
  })).catch(() => ({ type: null, deletionEvents: 0, afterDeletion: null }));
  return { ended: false, timeout: true, ...observed, messageCount: baseLen };
}

// ---------- 只读操作 ----------

export async function getStatus(page) {
  return page.evaluate(async () => {
    const ctx = SillyTavern.getContext();
    const names = typeof TavernHelper.getWorldbookNames === 'function' ? await TavernHelper.getWorldbookNames() : [];
    const charNames = typeof TavernHelper.getCharacterNames === 'function' ? await TavernHelper.getCharacterNames() : [];
    return {
      url: location.origin,
      tavernVersion: await TavernHelper.getTavernVersion(),
      helperVersion: await TavernHelper.getTavernHelperVersion(),
      currentCharacter: ctx.name2 ?? null,
      chatId: ctx.chatId ?? null,
      messageCount: Array.isArray(ctx.chat) ? ctx.chat.length : null,
      onlineStatus: ctx.onlineStatus ?? null,
      characters: charNames.length,
      worldbooks: names.length,
    };
  });
}

export async function getChat(page, n, raw) {
  const count = n !== undefined ? Number(n) : 20;
  return page.evaluate(({ n, raw }) => {
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const start = n > 0 && n < chat.length ? chat.length - n : 0;
    return chat.slice(start).map((m, idx) => {
      const base = {
        index: start + idx,
        role: m.is_user ? 'user' : m.is_system ? 'system' : 'assistant',
        name: m.name ?? null,
        sendDate: m.send_date ?? null,
      };
      if (raw) base.mes = m.mes;
      else {
        const t = String(m.mes || '');
        base.mes = t.length > 400 ? t.slice(0, 400) + `…（共 ${t.length} 字，--raw 看全文）` : t;
      }
      return base;
    });
  }, { n: count, raw });
}

export async function getCharacters(page) {
  return page.evaluate(async () => {
    const names = await TavernHelper.getCharacterNames();
    const ctx = SillyTavern.getContext();
    return { current: ctx.name2 ?? null, names: Array.isArray(names) ? names : [] };
  });
}

export async function switchCharacter(page, name, dryRun) {
  const found = await page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('#rm_print_characters_block .character_select'));
    const row = rows.find((r) => r.querySelector('.ch_name')?.textContent.trim() === target);
    return row ? { found: true, dataChid: row.getAttribute('data-chid') } : { found: false };
  }, name);
  if (!found.found) throw new Error(`角色未找到: ${name}`);
  if (dryRun) return { dryRun: true, character: name, row: found };
  await page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('#rm_print_characters_block .character_select'));
    const row = rows.find((r) => r.querySelector('.ch_name')?.textContent.trim() === target);
    if (row) row.click();
  }, name);
  await page.waitForFunction((target) => SillyTavern.getContext().name2 === target, name, { timeout: 15000 });
  return { switched: true, character: name };
}

// CLI 每次使用独立浏览器上下文，不会继承上一条命令的当前角色/聊天。
// 写操作必须在同一会话中显式定位目标，避免误落到系统欢迎页或其他聊天。
export async function selectCharacterChat(page, character, chatId = null, dryRun = false) {
  if (!character) throw new Error('指定 --chat-id 时必须同时提供 --character');
  const switched = await switchCharacter(page, character, dryRun);
  if (dryRun) {
    return { dryRun: true, character, chatId, switched };
  }

  if (chatId) {
    const opened = await page.evaluate(async (targetChatId) => {
      const ctx = SillyTavern.getContext();
      if (typeof ctx.openCharacterChat !== 'function') {
        throw new Error('ctx.openCharacterChat 不可用');
      }
      await ctx.openCharacterChat(targetChatId);
      return true;
    }, chatId);
    if (!opened) throw new Error(`无法打开聊天: ${chatId}`);
    await page.waitForFunction(
      (targetChatId) => SillyTavern.getContext().chatId === targetChatId,
      chatId,
      { timeout: 15000 },
    );
  } else {
    await page.waitForFunction(
      () => SillyTavern.getContext().chatId !== null,
      null,
      { timeout: 15000 },
    );
  }
  await page.waitForTimeout(800);
  const state = await page.evaluate(() => {
    const ctx = SillyTavern.getContext();
    return {
      character: ctx.name2 ?? null,
      chatId: ctx.chatId ?? null,
      messageCount: Array.isArray(ctx.chat) ? ctx.chat.length : 0,
    };
  });
  if (state.character !== character) throw new Error(`角色定位失败：当前为 ${state.character || '（无）'}`);
  if (chatId && state.chatId !== chatId) throw new Error(`聊天定位失败：当前为 ${state.chatId || '（无）'}`);
  return state;
}

export async function getWorldbooks(page) {
  return page.evaluate(async () => {
    const ctx = SillyTavern.getContext();
    const names = await TavernHelper.getWorldbookNames();
    const global = await TavernHelper.getGlobalWorldbookNames();
    const char = await TavernHelper.getCharWorldbookNames();
    return {
      currentCharacter: ctx.name2 ?? null,
      names: Array.isArray(names) ? names : [],
      global: Array.isArray(global) ? global : [],
      character: char ?? null,
    };
  });
}

export async function getWorldbook(page, name, full) {
  return page.evaluate(async ({ name, full }) => {
    const w = await TavernHelper.getWorldbook(name);
    if (!w || typeof w !== 'object') return { name, entries: null, error: '未找到世界书' };
    const keys = Object.keys(w).filter((k) => typeof w[k] === 'object' && w[k] !== null && 'content' in w[k]);
    const entries = keys.map((k) => {
      const e = w[k];
      const base = {
        uid: e.uid ?? k,
        name: e.name ?? e.comment ?? '',
        enabled: !!e.enabled,
        strategy: e.strategy?.type ?? null,
        position: e.position?.type ?? null,
        order: e.position?.order ?? null,
        contentLength: String(e.content || '').length,
      };
      if (full) base.content = String(e.content || '');
      return base;
    }).sort((a, b) => Number(a.uid) - Number(b.uid));
    return { name, entryCount: entries.length, entries };
  }, { name, full });
}

// Runtime authority: SillyTavern 1.17.0 + Tavern Helper 4.9.1, verified in the
// connected page context. These readers return stored configuration objects directly;
// they do not inspect or reconstruct a generated prompt payload.
export async function getPresetConfig(page, opts = {}) {
  const requestedName = String(opts.name || 'in_use');
  const full = !!opts.full;
  const listOnly = !!opts.listOnly;
  const result = await page.evaluate(async ({ requestedName, full, listOnly }) => {
    const TH = window.TavernHelper;
    if (typeof TH?.getPreset !== 'function' || typeof TH?.getLoadedPresetName !== 'function') {
      throw new Error('当前 Tavern Helper 不支持 getPreset/getLoadedPresetName');
    }
    const loadedName = await TH.getLoadedPresetName();
    const names = typeof TH.getPresetNames === 'function' ? await TH.getPresetNames() : [];
    if (listOnly) {
      return { requestedName, loadedName, names: Array.isArray(names) ? names : [] };
    }

    const preset = await TH.getPreset(requestedName);
    if (!preset || typeof preset !== 'object') throw new Error(`预设不存在或不可读：${requestedName}`);
    const promptArrays = ['prompts', 'prompts_unused'].filter((key) => Array.isArray(preset[key]));
    const prompts = promptArrays.flatMap((bucket) => preset[bucket].map((prompt, index) => ({
      bucket,
      index,
      id: prompt?.identifier ?? prompt?.id ?? null,
      name: prompt?.name ?? prompt?.identifier ?? prompt?.id ?? `${bucket}[${index}]`,
      role: prompt?.role ?? null,
      enabled: prompt?.enabled !== false,
      contentLength: String(prompt?.content ?? prompt?.prompt ?? '').length,
    })));
    const base = {
      requestedName,
      loadedName,
      selectedName: requestedName === 'in_use' ? loadedName : requestedName,
      availablePresetCount: Array.isArray(names) ? names.length : null,
      keys: Object.keys(preset),
      settingKeys: Object.keys(preset.settings ?? {}),
      promptCount: prompts.length,
      prompts,
    };
    if (full) base.preset = preset;
    return base;
  }, { requestedName, full, listOnly });
  return redactSensitiveConfig(result);
}

export async function getRegexConfigs(page, opts = {}) {
  const scope = String(opts.scope || (opts.character ? 'character' : 'global'));
  const enableState = String(opts.enableState || 'all');
  const character = opts.character ? String(opts.character) : null;
  const full = !!opts.full;
  if (!['all', 'global', 'character'].includes(scope)) {
    throw new Error('--scope 只能是 all、global 或 character');
  }
  if (!['all', 'enabled', 'disabled'].includes(enableState)) {
    throw new Error('--state 只能是 all、enabled 或 disabled');
  }
  if ((scope === 'all' || scope === 'character') && !character) {
    throw new Error('读取角色正则时必须提供 --character <角色名>');
  }

  const result = await page.evaluate(async ({ scope, enableState, character, full }) => {
    const TH = window.TavernHelper;
    if (typeof TH?.getTavernRegexes !== 'function') {
      throw new Error('当前 Tavern Helper 不支持 getTavernRegexes');
    }
    const entries = [];
    if (scope === 'all' || scope === 'global') {
      const globalEntries = await TH.getTavernRegexes({ scope: 'global', enable_state: 'all' });
      if (Array.isArray(globalEntries)) entries.push(...globalEntries.map((item) => ({ ...item, scope: 'global' })));
    }
    if (scope === 'all' || scope === 'character') {
      if (typeof TH.getCharacter !== 'function') throw new Error('当前 Tavern Helper 不支持 getCharacter');
      const card = await TH.getCharacter(character);
      if (!card || typeof card !== 'object') throw new Error(`角色不存在或不可读：${character}`);
      const extensions = card.data?.extensions ?? card.extensions ?? {};
      const characterEntries = extensions.regex_scripts ?? [];
      if (!Array.isArray(characterEntries)) throw new Error(`角色正则格式异常：${character}`);
      entries.push(...characterEntries.map((item) => ({ ...item, scope: 'character', character })));
    }
    const isEnabled = (item) => item?.enabled !== false && item?.disabled !== true;
    const filtered = entries.filter((item) => enableState === 'all'
      || (enableState === 'enabled' ? isEnabled(item) : !isEnabled(item)));
    const summaries = filtered.map((item, index) => ({
      index,
      scope: item.scope ?? null,
      character: item.character ?? null,
      id: item.id ?? null,
      name: item.script_name ?? item.name ?? item.id ?? `regex[${index}]`,
      enabled: isEnabled(item),
      source: item.source ?? null,
      destination: item.destination ?? null,
      runOnEdit: item.run_on_edit ?? null,
      minDepth: item.min_depth ?? null,
      maxDepth: item.max_depth ?? null,
      findLength: String(item.find_regex ?? item.findRegex ?? item.regex ?? '').length,
      replaceLength: String(item.replace_string ?? item.replaceString ?? item.replacement ?? '').length,
    }));
    const base = { scope, enableState, character, itemCount: filtered.length, entries: summaries };
    if (full) base.regexes = filtered;
    return base;
  }, { scope, enableState, character, full });
  return redactSensitiveConfig(result);
}

export async function getHelperScriptConfigs(page, opts = {}) {
  const scope = String(opts.scope || (opts.character ? 'character' : 'global'));
  const enableState = String(opts.enableState || 'all');
  const character = opts.character ? String(opts.character) : null;
  const full = !!opts.full;
  if (!['all', 'global', 'character'].includes(scope)) {
    throw new Error('--scope 只能是 all、global 或 character');
  }
  if (!['all', 'enabled', 'disabled'].includes(enableState)) {
    throw new Error('--state 只能是 all、enabled 或 disabled');
  }
  if ((scope === 'all' || scope === 'character') && !character) {
    throw new Error('读取角色酒馆助手脚本时必须提供 --character <角色名>');
  }

  const result = await page.evaluate(async ({ scope, enableState, character, full }) => {
    const TH = window.TavernHelper;
    if (typeof TH?.getScriptTrees !== 'function') {
      throw new Error('当前 Tavern Helper 不支持 getScriptTrees');
    }
    const entries = [];
    if (scope === 'all' || scope === 'global') {
      const globalEntries = await TH.getScriptTrees({ type: 'global' });
      if (Array.isArray(globalEntries)) entries.push(...globalEntries.map((item) => ({ ...item, scope: 'global' })));
    }
    if (scope === 'all' || scope === 'character') {
      if (typeof TH.getCharacter !== 'function') throw new Error('当前 Tavern Helper 不支持 getCharacter');
      const card = await TH.getCharacter(character);
      if (!card || typeof card !== 'object') throw new Error(`角色不存在或不可读：${character}`);
      const extensions = card.data?.extensions ?? card.extensions ?? {};
      const characterEntries = extensions.tavern_helper?.scripts ?? [];
      if (!Array.isArray(characterEntries)) throw new Error(`角色酒馆助手脚本格式异常：${character}`);
      entries.push(...characterEntries.map((item) => ({ ...item, scope: 'character', character })));
    }
    const isEnabled = (item) => item?.enabled !== false && item?.disabled !== true;
    const filtered = entries.filter((item) => enableState === 'all'
      || (enableState === 'enabled' ? isEnabled(item) : !isEnabled(item)));
    const summaries = filtered.map((item, index) => ({
      index,
      scope: item.scope ?? null,
      character: item.character ?? null,
      id: item.id ?? null,
      name: item.name ?? item.scriptName ?? item.id ?? `script[${index}]`,
      type: item.type ?? null,
      enabled: isEnabled(item),
      info: item.info ?? null,
      contentLength: String(item.content ?? item.script ?? item.code ?? '').length,
      buttonCount: Array.isArray(item.button) ? item.button.length : (item.button ? 1 : 0),
    }));
    const base = { scope, enableState, character, itemCount: filtered.length, entries: summaries };
    if (full) base.scripts = filtered;
    return base;
  }, { scope, enableState, character, full });
  return redactSensitiveConfig(result);
}

export async function execSlash(page, command) {
  return page.evaluate(async (cmd) => {
    try {
      const r = await TavernHelper.triggerSlash(cmd);
      return { command: cmd, ok: true, result: typeof r === 'string' ? r : JSON.stringify(r) };
    } catch (e) {
      return { command: cmd, ok: false, error: String(e && e.message || e) };
    }
  }, command);
}

export async function evalCode(page, code) {
  return page.evaluate(async (src) => {
    const ctx = SillyTavern.getContext();
    const TH = window.TavernHelper;
    const fn = new Function('ctx', 'TH', `"use strict"; return (async () => { ${src} })();`);
    try {
      const r = await fn(ctx, TH);
      return { ok: true, result: r === undefined ? null : r };
    } catch (e) {
      return { ok: false, error: String(e && e.stack || e) };
    }
  }, code);
}

// ---------- 写操作 ----------

export async function sendAndWait(page, text, opts = {}) {
  if (!text) throw new Error('发送内容为空');
  const before = await page.evaluate(() => SillyTavern.getContext().chat.length);
  if (opts.dryRun) {
    await page.fill('#send_textarea', text);
    const state = await page.evaluate(() => {
      const ta = document.querySelector('#send_textarea');
      const btn = document.querySelector('#send_but');
      const visible = btn
        ? window.getComputedStyle(btn).display !== 'none' && btn.getBoundingClientRect().width > 0
        : false;
      return { value: ta?.value, sendEnabled: !!ta, sendButtonVisible: visible };
    });
    await page.fill('#send_textarea', '');
    return { dryRun: true, valueOk: state.value === text, sendEnabled: state.sendEnabled, sendButtonVisible: state.sendButtonVisible };
  }
  await installGenListeners(page);
  await page.fill('#send_textarea', text);

  // 触发发送：按钮可见则点击；否则派发回车（不依赖按钮可见性）
  const tryClick = async () => {
    const visible = await page.evaluate(() => {
      const btn = document.querySelector('#send_but');
      return btn
        ? window.getComputedStyle(btn).display !== 'none' && window.getComputedStyle(btn).visibility !== 'hidden' && btn.getBoundingClientRect().width > 0
        : false;
    });
    if (visible) {
      await page.click('#send_but', { timeout: 3000 }).catch(() => {});
      return true;
    }
    return false;
  };
  const tryEnter = async () => {
    // 酒馆的 Enter 发送要求输入框聚焦 + 真实按键事件（RossAscends 热键处理）
    await page.focus('#send_textarea').catch(() => {});
    await page.keyboard.press('Enter');
  };
  const waitSendStart = async (ms) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => ({
        len: SillyTavern.getContext().chat.length,
        stopping: !!document.querySelector('#stop_generating'),
        started: window.__stBridgeGenStarted === true,
      }));
      if (s.len > before || s.stopping || s.started) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };

  const clicked = await tryClick();
  let started = await waitSendStart(4000);
  if (!started) {
    await tryEnter();
    started = await waitSendStart(4000);
  }
  if (!started && clicked) {
    // 按钮点击过但未触发：再次尝试（可能第一次落在隐藏瞬间）
    await tryClick();
    started = await waitSendStart(4000);
  }
  if (!started) {
    // 兜底：按钮被样式隐藏时仍可派发原生 click（jQuery 事件照常触发）
    await page.evaluate(() => {
      const btn = document.querySelector('#send_but');
      if (btn) btn.click();
    });
    started = await waitSendStart(4000);
  }
  if (!started) {
    await clearGenListeners(page);
    throw new Error('发送失败：发送按钮不可见且回车未触发消息发送。');
  }

  const waitMs = opts.timeoutMs || 180000;
  const generation = opts.wait ? await waitForGeneration(page, waitMs) : { queued: true };
  await clearGenListeners(page);
  const after = await page.evaluate(() => SillyTavern.getContext().chat.length);
  return {
    sent: text,
    before,
    after,
    newMessages: after - before,
    generation,
  };
}

export async function stopGeneration(page) {
  return page.evaluate(async () => {
    const ctx = SillyTavern.getContext();
    if (typeof ctx.stopGeneration === 'function') {
      await ctx.stopGeneration();
      return { stopped: true };
    }
    return { stopped: false, reason: 'stopGeneration 不可用' };
  });
}

// Runtime authority (verified against the connected ST 1.17.0 script.js):
// - ctx.deleteMessage(id, swipeIndex, askConfirmation) persists the chat and emits MESSAGE_DELETED.
// - MVU listens to the host deletion lifecycle; mutating ctx.chat directly would bypass that rollback chain.
export async function deleteLastMessages(page, count = 1, dryRun = false) {
  const requested = Number(count);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error('删除数量必须是大于等于 1 的整数');
  }

  return page.evaluate(async ({ count: n, dryRun: previewOnly }) => {
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const capabilities = {
      deleteMessage: typeof ctx.deleteMessage === 'function',
      saveChat: typeof ctx.saveChat === 'function',
      messageDeletedEvent: Boolean(ctx.eventTypes?.MESSAGE_DELETED && ctx.eventSource),
    };
    const activeChat = ctx.chatId !== null && ctx.chatId !== undefined;
    const activeCharacter = ctx.characterId !== null && ctx.characterId !== undefined;
    const activeGroup = ctx.groupId !== null && ctx.groupId !== undefined;
    const available = Object.values(capabilities).every(Boolean)
      && activeChat
      && (activeCharacter || activeGroup)
      && chat.length >= n;

    const summarize = (message, index) => ({
      index,
      role: message?.is_user ? 'user' : message?.is_system ? 'system' : 'assistant',
      name: message?.name ?? null,
      preview: String(message?.mes ?? '').slice(0, 120),
      hasVariables: Array.isArray(message?.variables) && message.variables.length > 0,
      hasMvuData: Boolean(message?.variables?.[0]?.stat_data),
    });
    const from = Math.max(0, chat.length - n);
    const targets = chat.slice(from).map((message, offset) => summarize(message, from + offset));

    if (previewOnly) {
      return {
        dryRun: true,
        available,
        capabilities,
        reason: available ? null : !activeChat
          ? '当前没有已保存的角色/群组聊天'
          : !(activeCharacter || activeGroup)
            ? '当前不是角色或群组聊天'
            : chat.length < n
              ? `当前只有 ${chat.length} 条消息，不能删除 ${n} 条`
              : '当前酒馆缺少所需删除/保存/事件接口',
        chatId: ctx.chatId ?? null,
        before: chat.length,
        count: n,
        from,
        targets,
      };
    }

    if (!available) {
      if (!activeChat) throw new Error('当前没有已保存的角色/群组聊天，拒绝删除系统欢迎页消息');
      if (!(activeCharacter || activeGroup)) throw new Error('当前不是角色或群组聊天');
      if (chat.length < n) throw new Error(`当前只有 ${chat.length} 条消息，不能删除 ${n} 条`);
      throw new Error('当前酒馆缺少 ctx.deleteMessage / ctx.saveChat / MESSAGE_DELETED 接口');
    }
    if (document.querySelector('#stop_generating')) {
      throw new Error('当前仍在生成，停止生成后才能删除消息');
    }

    // deleteMessage requires the target message to be present in the rendered DOM.
    const missing = [];
    for (let id = chat.length - 1; id >= from; id--) {
      if (!document.querySelector(`.mes[mesid="${id}"]`)) missing.push(id);
    }
    if (missing.length > 0) {
      throw new Error(`待删除消息未渲染（${missing.join('、')}），请先滚动到聊天底部后重试`);
    }

    let deletionEvents = 0;
    const eventName = ctx.eventTypes.MESSAGE_DELETED;
    const onDeleted = () => { deletionEvents += 1; };
    ctx.eventSource.on(eventName, onDeleted);
    try {
      for (let id = chat.length - 1; id >= from; id--) {
        const beforeOne = ctx.chat.length;
        await ctx.deleteMessage(id, undefined, false);
        if (ctx.chat.length !== beforeOne - 1) {
          throw new Error(`消息 ${id} 未被酒馆核心删除`);
        }
      }
      await ctx.saveChat();
    } finally {
      ctx.eventSource.removeListener(eventName, onDeleted);
    }

    return {
      deleted: n,
      from,
      before: from + n,
      after: ctx.chat.length,
      chatId: ctx.chatId ?? null,
      deletionEvents,
      targets,
      last: ctx.chat.length > 0 ? summarize(ctx.chat[ctx.chat.length - 1], ctx.chat.length - 1) : null,
    };
  }, { count: requested, dryRun: Boolean(dryRun) });
}

// The built-in #option_regenerate handler is the authoritative entry point: it sets the
// host generation lock, handles groups, supplies connection-specific arguments, calls
// Generate('regenerate'), removes the previous assistant message, and emits MESSAGE_DELETED.
export async function regenerateLastMessage(page, opts = {}) {
  const timeoutMs = opts.timeoutMs || 180000;
  const dryRun = Boolean(opts.dryRun);
  const before = await page.evaluate(() => {
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const last = chat[chat.length - 1];
    const summarize = (message, index) => message ? {
      index,
      role: message.is_user ? 'user' : message.is_system ? 'system' : 'assistant',
      name: message.name ?? null,
      preview: String(message.mes ?? '').slice(0, 120),
      hasVariables: Array.isArray(message.variables) && message.variables.length > 0,
      hasMvuData: Boolean(message.variables?.[0]?.stat_data),
    } : null;
    const activeChat = ctx.chatId !== null && ctx.chatId !== undefined;
    const activeCharacter = ctx.characterId !== null && ctx.characterId !== undefined;
    const activeGroup = ctx.groupId !== null && ctx.groupId !== undefined;
    const hasButton = Boolean(document.querySelector('#option_regenerate'));
    return {
      available: activeChat && (activeCharacter || activeGroup) && chat.length > 0 && hasButton,
      activeChat,
      activeCharacter,
      activeGroup,
      hasButton,
      chatId: ctx.chatId ?? null,
      count: chat.length,
      last: summarize(last, chat.length - 1),
      generating: Boolean(document.querySelector('#stop_generating')),
    };
  });

  if (dryRun) return { dryRun: true, ...before };
  if (!before.activeChat) throw new Error('当前没有已保存的角色/群组聊天，无法重新生成');
  if (!(before.activeCharacter || before.activeGroup)) throw new Error('当前不是角色或群组聊天');
  if (before.count < 1) throw new Error('当前聊天没有可重新生成的消息');
  if (!before.hasButton) throw new Error('当前酒馆缺少内置重新生成按钮 #option_regenerate');
  if (before.generating) throw new Error('当前已有生成任务，不能重复触发重新生成');

  const connection = await ensureApiConnected(page);
  if (!connection.connected) {
    throw new Error(connection.reason || 'API 未连接，无法重新生成');
  }

  await installGenListeners(page);
  try {
    await page.evaluate(() => {
      const button = document.querySelector('#option_regenerate');
      if (!button) throw new Error('重新生成按钮不存在');
      button.click();
    });

    const startDeadline = Date.now() + Math.min(timeoutMs, 10000);
    let started = false;
    while (Date.now() < startDeadline) {
      started = await page.evaluate(() => window.__stBridgeGenStarted === true || Boolean(document.querySelector('#stop_generating')));
      if (started) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!started) throw new Error('点击重新生成后未观察到 GENERATION_STARTED');

    const generation = await waitForGeneration(page, timeoutMs);
    let mvuSettled = !before.last?.hasMvuData;
    if (before.last?.hasMvuData && generation.ended) {
      const mvuDeadline = Date.now() + 12000;
      while (Date.now() < mvuDeadline) {
        mvuSettled = await page.evaluate(() => {
          const ctx = SillyTavern.getContext();
          const last = Array.isArray(ctx.chat) ? ctx.chat[ctx.chat.length - 1] : null;
          return Boolean(last?.variables?.[0]?.stat_data);
        });
        if (mvuSettled) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (mvuSettled) {
        await page.evaluate(async () => {
          const ctx = SillyTavern.getContext();
          if (typeof ctx.saveChat === 'function') await ctx.saveChat();
        });
      }
    }
    const after = await page.evaluate(() => {
      const ctx = SillyTavern.getContext();
      const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
      const message = chat[chat.length - 1];
      return {
        count: chat.length,
        last: message ? {
          index: chat.length - 1,
          role: message.is_user ? 'user' : message.is_system ? 'system' : 'assistant',
          name: message.name ?? null,
          preview: String(message.mes ?? '').slice(0, 240),
          hasVariables: Array.isArray(message.variables) && message.variables.length > 0,
          hasMvuData: Boolean(message.variables?.[0]?.stat_data),
        } : null,
      };
    });
    return {
      chatId: before.chatId,
      before: before.count,
      after: after.count,
      replacedAssistant: before.last?.role === 'assistant' && after.count === before.count,
      generatedAfterUser: before.last?.role === 'user' && after.count === before.count + 1,
      previous: before.last,
      last: after.last,
      mvuSettled,
      generation,
    };
  } finally {
    await clearGenListeners(page);
  }
}

export async function takeScreenshot(page, path) {
  await page.screenshot({ path });
  return { path };
}

// ---------- 角色卡原位替换：备份 / 覆盖 / 校验 ----------

export async function captureCharacterReplacementState(page, targetName, extraWorldbookNames = []) {
  return page.evaluate(async ({ targetName, extraWorldbookNames }) => {
    const ctx = SillyTavern.getContext();
    const TH = window.TavernHelper;
    const raw = (ctx.characters || []).find((character) => character.name === targetName);
    if (!raw) throw new Error(`目标角色卡不存在：${targetName}`);
    if (typeof TH.getChatHistoryBrief !== 'function' || typeof TH.getChatHistoryDetail !== 'function') {
      throw new Error('当前 Tavern Helper 不支持聊天历史备份接口');
    }
    if (typeof TH.getCharAvatarPath !== 'function') {
      throw new Error('当前 Tavern Helper 不支持角色头像原文件读取接口');
    }

    let normalized = null;
    try {
      normalized = await TH.getCharacter(targetName);
    } catch {
      // Some minimal/legacy cards cannot be normalized by Tavern Helper even though
      // their raw SillyTavern record is valid. Replacement only needs the raw record.
    }
    const rawExtensions = raw.data?.extensions ?? raw.extensions ?? {};
    const chatBrief = await TH.getChatHistoryBrief(targetName) || [];
    const chats = await TH.getChatHistoryDetail(chatBrief) || {};
    const rawBoundWorldbook = typeof rawExtensions.world === 'string' ? rawExtensions.world.trim() : '';
    const normalizedBoundWorldbook = typeof normalized?.worldbook === 'string' ? normalized.worldbook.trim() : '';
    const oldWorldbookName = rawBoundWorldbook || normalizedBoundWorldbook;
    const embeddedWorldbookName = String(raw.data?.character_book?.name || '').trim();
    const worldbookBindings = (ctx.characters || []).map((character) => {
      const extensions = character.data?.extensions ?? character.extensions ?? {};
      const worldbook = typeof extensions.world === 'string' ? extensions.world.trim() : '';
      return worldbook ? { name: character.name, avatar: character.avatar, worldbook } : null;
    }).filter(Boolean);
    const worldbookNames = await TH.getWorldbookNames();
    const requestedBooks = [...new Set([oldWorldbookName, ...extraWorldbookNames].filter(Boolean))];
    const worldbooks = {};
    for (const name of requestedBooks) {
      if (!worldbookNames.includes(name)) continue;
      let worldbook = null;
      for (let attempt = 0; attempt < 20; attempt++) {
        worldbook = await TH.getWorldbook(name);
        if (worldbook && typeof worldbook === 'object') break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      worldbooks[name] = worldbook;
    }

    const avatarPath = TH.getCharAvatarPath(targetName);
    const response = await fetch(avatarPath, { cache: 'no-store' });
    if (!response.ok) throw new Error(`读取旧角色卡 PNG 失败：HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }

    return {
      versions: {
        tavern: await TH.getTavernVersion(),
        helper: await TH.getTavernHelperVersion(),
      },
      target: {
        name: raw.name,
        avatar: raw.avatar,
        chatId: raw.chat ?? raw.data?.chat ?? null,
        oldWorldbookName,
        embeddedWorldbookName,
        normalizedWorldbookName: normalized?.worldbook ?? null,
        regexCount: Array.isArray(normalized?.extensions?.regex_scripts)
          ? normalized.extensions.regex_scripts.length
          : Array.isArray(rawExtensions.regex_scripts) ? rawExtensions.regex_scripts.length : 0,
        helperScriptCount: Array.isArray(normalized?.extensions?.tavern_helper?.scripts)
          ? normalized.extensions.tavern_helper.scripts.length
          : Array.isArray(rawExtensions.tavern_helper?.scripts) ? rawExtensions.tavern_helper.scripts.length : 0,
      },
      current: {
        name: ctx.name2 ?? null,
        chatId: ctx.chatId ?? null,
        messageCount: Array.isArray(ctx.chat) ? ctx.chat.length : 0,
      },
      characterNames: await TH.getCharacterNames(),
      worldbookNames,
      worldbookBindings,
      chatBrief,
      chats,
      worldbooks,
      avatarPngBase64: btoa(binary),
    };
  }, { targetName, extraWorldbookNames });
}

async function waitForRuntimeAfterReload(page) {
  await page.waitForFunction(
    () => window.SillyTavern
      && typeof window.SillyTavern.getContext === 'function'
      && window.TavernHelper
      && Array.isArray(SillyTavern.getContext().characters),
    null,
    { timeout: 30000 },
  );
  await page.waitForFunction(() => SillyTavern.getContext().characters.length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(800);
}

export async function importCharacterPngInPlace(page, opts) {
  const {
    targetName,
    expectedAvatar,
    newName,
    pngBase64,
    embeddedWorldbook = null,
    preservedChatId = null,
  } = opts;
  if (!targetName || !expectedAvatar || !newName || !pngBase64) throw new Error('角色卡原位替换参数不完整');

  const preflight = await page.evaluate(({ targetName, expectedAvatar, newName }) => {
    const characters = SillyTavern.getContext().characters || [];
    const target = characters.find((item) => item.name === targetName && item.avatar === expectedAvatar);
    const duplicate = characters.find((item) => item.name === newName && item.avatar !== expectedAvatar);
    return { targetFound: !!target, duplicate: duplicate ? { name: duplicate.name, avatar: duplicate.avatar } : null };
  }, { targetName, expectedAvatar, newName });
  if (!preflight.targetFound) throw new Error(`目标角色卡已变化，拒绝覆盖：${targetName} / ${expectedAvatar}`);
  if (preflight.duplicate) {
    throw new Error(`新角色名已被另一张卡占用：${newName}（${preflight.duplicate.avatar}）`);
  }

  const slotName = expectedAvatar.replace(/\.png$/i, '');
  const invoked = await page.evaluate(async ({ slotName, pngBase64 }) => {
    const TH = window.TavernHelper;
    if (typeof TH?.importRawCharacter !== 'function') {
      return { ok: false, error: '当前 Tavern Helper 不支持 importRawCharacter' };
    }
    const binary = atob(pngBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    try {
      const response = await TH.importRawCharacter(slotName, bytes);
      return {
        ok: response?.ok !== false,
        status: response?.status ?? null,
        statusText: response?.statusText ?? null,
      };
    } catch (error) {
      // The helper may throw during its post-import refresh when the display name changed.
      // Reload + exact avatar/name verification below determines whether the import itself succeeded.
      return { ok: false, error: String(error?.message || error) };
    }
  }, { slotName, pngBase64 });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForRuntimeAfterReload(page);
  const observed = await page.evaluate(({ expectedAvatar, newName }) => {
    const characters = SillyTavern.getContext().characters || [];
    const byAvatar = characters.find((item) => item.avatar === expectedAvatar);
    return {
      matched: byAvatar?.name === newName,
      byAvatar: byAvatar ? { name: byAvatar.name, avatar: byAvatar.avatar, chatId: byAvatar.chat ?? byAvatar.data?.chat ?? null } : null,
    };
  }, { expectedAvatar, newName });
  if (!observed.matched) {
    throw new Error(`角色卡覆盖后身份校验失败：${JSON.stringify({ invoked, observed })}`);
  }

  if (embeddedWorldbook?.name && Array.isArray(embeddedWorldbook.entries)) {
    await page.evaluate(async (book) => {
      const TH = window.TavernHelper;
      const ctx = SillyTavern.getContext();
      if (typeof ctx.convertCharacterBook !== 'function' || typeof ctx.saveWorldInfo !== 'function') {
        throw new Error('当前 SillyTavern 不支持 convertCharacterBook/saveWorldInfo');
      }
      const names = await TH.getWorldbookNames();
      if (!names.includes(book.name)) await TH.createWorldbook(book.name);
      const rawBook = book.raw && typeof book.raw === 'object'
        ? book.raw
        : { name: book.name, entries: book.entries };
      const converted = ctx.convertCharacterBook(rawBook);
      await ctx.saveWorldInfo(book.name, converted, true);
    }, embeddedWorldbook);
  }

  let chatRestore = null;
  if (preservedChatId) {
    await switchCharacter(page, newName, false);
    await page.evaluate((chatId) => {
      const ctx = SillyTavern.getContext();
      if (typeof ctx.openCharacterChat !== 'function') throw new Error('ctx.openCharacterChat 不可用');
      void ctx.openCharacterChat(chatId).catch((error) => console.error('[st-bridge] 恢复聊天失败', error));
      return true;
    }, preservedChatId);
    await page.waitForFunction((chatId) => SillyTavern.getContext().chatId === chatId, preservedChatId, { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.evaluate(async ({ expectedAvatar, preservedChatId }) => {
      const ctx = SillyTavern.getContext();
      const raw = (ctx.characters || []).find((item) => item.avatar === expectedAvatar);
      if (!raw) throw new Error(`恢复聊天指针时找不到头像槽位：${expectedAvatar}`);
      const response = await fetch('/api/characters/merge-attributes', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({ avatar: expectedAvatar, chat: preservedChatId }),
      });
      if (!response.ok) throw new Error(`保存聊天指针失败：HTTP ${response.status} ${await response.text()}`);
      raw.chat = preservedChatId;
      if (raw.data && typeof raw.data === 'object') raw.data.chat = preservedChatId;
    }, { expectedAvatar, preservedChatId });
    chatRestore = await page.evaluate(() => {
      const ctx = SillyTavern.getContext();
      const raw = (ctx.characters || []).find((item) => item.name === ctx.name2);
      return {
        name: ctx.name2 ?? null,
        chatId: ctx.chatId ?? null,
        storedChatId: raw?.chat ?? raw?.data?.chat ?? null,
        messageCount: Array.isArray(ctx.chat) ? ctx.chat.length : 0,
      };
    });
  }

  return { invoked, observed, slotName, worldbook: embeddedWorldbook?.name ?? null, chatRestore };
}

export async function restoreWorldbookSnapshots(page, snapshots, deleteIfAbsent = []) {
  return page.evaluate(async ({ snapshots, deleteIfAbsent }) => {
    const TH = window.TavernHelper;
    const restored = [];
    const deleted = [];
    for (const [name, worldbook] of Object.entries(snapshots || {})) {
      const entries = Object.values(worldbook || {}).filter((entry) => entry && typeof entry === 'object' && 'content' in entry);
      await TH.createOrReplaceWorldbook(name, entries, { render: 'immediate' });
      restored.push({ name, entries: entries.length });
    }
    const names = await TH.getWorldbookNames();
    for (const name of deleteIfAbsent || []) {
      if (name && names.includes(name) && !Object.hasOwn(snapshots || {}, name)) {
        await TH.deleteWorldbook(name);
        deleted.push(name);
      }
    }
    return { restored, deleted };
  }, { snapshots, deleteIfAbsent });
}

export async function deleteReplacedCardWorldbook(page, opts = {}) {
  const oldWorldbookName = String(opts.oldWorldbookName || '').trim();
  const newWorldbookName = String(opts.newWorldbookName || '').trim();
  if (!oldWorldbookName) return { deleted: false, reason: '旧卡没有绑定世界书' };
  if (oldWorldbookName === newWorldbookName) {
    return { deleted: false, reason: '新旧卡绑定同名世界书，已原位更新，不能删除' };
  }
  return page.evaluate(async ({ oldWorldbookName, newWorldbookName }) => {
    const TH = window.TavernHelper;
    const ctx = SillyTavern.getContext();
    const bindingRefs = (ctx.characters || []).map((character) => {
      const extensions = character.data?.extensions ?? character.extensions ?? {};
      const worldbook = typeof extensions.world === 'string' ? extensions.world.trim() : '';
      return worldbook === oldWorldbookName
        ? { name: character.name, avatar: character.avatar }
        : null;
    }).filter(Boolean);
    if (bindingRefs.length > 0) {
      throw new Error(`旧世界书仍被其他角色卡绑定，拒绝删除：${oldWorldbookName} → ${bindingRefs.map((item) => `${item.name}（${item.avatar}）`).join('、')}`);
    }
    let names = await TH.getWorldbookNames();
    if (newWorldbookName && !names.includes(newWorldbookName)) {
      throw new Error(`新卡绑定的世界书尚未加载，拒绝删除旧世界书：${newWorldbookName}`);
    }
    if (!names.includes(oldWorldbookName)) {
      return { deleted: false, reason: '旧世界书原本不存在', oldWorldbookName, newWorldbookName };
    }
    await TH.deleteWorldbook(oldWorldbookName);
    for (let attempt = 0; attempt < 30; attempt++) {
      names = await TH.getWorldbookNames();
      if (!names.includes(oldWorldbookName)) {
        return { deleted: true, oldWorldbookName, newWorldbookName };
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`旧世界书删除后仍存在：${oldWorldbookName}`);
  }, { oldWorldbookName, newWorldbookName });
}

// ---------- 制卡调试闭环：导入 / 删除 / 监听 ----------

export async function importCharacterFile(page, filePath) {
  const before = await page.evaluate(async () => await TavernHelper.getCharacterNames());
  await page.setInputFiles('#character_import_file', filePath);
  const deadline = Date.now() + 30000;
  let name = null;
  while (Date.now() < deadline) {
    const names = await page.evaluate(async () => await TavernHelper.getCharacterNames());
    name = names.find((n) => !before.includes(n)) || null;
    if (name) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!name) {
    throw new Error('导入角色卡超时：未检测到新角色（文件可能无效，或同名卡被替换而非新增）');
  }
  // 关闭 ST 自动弹出的「导入标签」确认框（默认不导入标签）
  await page.evaluate(() => {
    const popup = Array.from(document.querySelectorAll('.popup')).find((e) => {
      const s = window.getComputedStyle(e);
      return s.display !== 'none' && e.getBoundingClientRect().width > 0;
    });
    const btn = popup?.querySelector('.popup-button-cancel') || popup?.querySelector('.popup-button-close');
    if (btn) btn.click();
  }).catch(() => {});
  await page.waitForTimeout(500);
  return { name };
}

export async function importWorldbookFile(page, filePath) {
  const before = await page.evaluate(async () => await TavernHelper.getWorldbookNames());
  await page.setInputFiles('#world_import_file', filePath);
  const deadline = Date.now() + 30000;
  let name = null;
  while (Date.now() < deadline) {
    const names = await page.evaluate(async () => await TavernHelper.getWorldbookNames());
    name = names.find((n) => !before.includes(n)) || null;
    if (name) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!name) {
    throw new Error('导入世界书超时：未检测到新世界书（文件可能无效）');
  }
  return { name };
}

export async function deleteCharacterCard(page, name) {
  // 酒馆核心删除「当前打开的角色」可能失败（需先关闭当前聊天），
  // 因此先切到其他角色再删除。
  const currentName = await page.evaluate(() => SillyTavern.getContext().name2 ?? null);
  if (currentName === name) {
    const list = await page.evaluate(async () => await TavernHelper.getCharacterNames());
    const others = list.filter((n) => n !== name);
    if (others.length > 0) {
      try {
        await switchCharacter(page, others[0], false);
      } catch { /* 切换失败不阻断后续删除尝试 */ }
    }
  }

  const ret = await page.evaluate(async (target) => {
    try {
      return { ok: true, ret: await TavernHelper.deleteCharacter(target) };
    } catch (e) {
      return { ok: false, err: String(e && e.message || e) };
    }
  }, name);
  if (!ret.ok) return ret;

  const names = async () => page.evaluate(async () => await TavernHelper.getCharacterNames());
  const waitGone = async () => {
    for (let i = 0; i < 30; i++) {
      const list = await names();
      if (!list.includes(name)) return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  };

  if (await waitGone()) return { ok: true, ret: ret.ret };

  // 删除的是当前打开的角色时，酒馆内存列表可能残留：先切到其他角色再确认
  const list = await names();
  const others = list.filter((n) => n !== name);
  let switchedAway = false;
  if (others.length > 0) {
    try {
      await switchCharacter(page, others[0], false);
      switchedAway = true;
    } catch { /* 忽略切换失败 */ }
  }
  if (await waitGone()) return { ok: true, ret: ret.ret, switchedAway };

  // 兜底：整页刷新，让酒馆重新加载角色列表并释放聊天文件句柄
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.SillyTavern && window.TavernHelper && Array.isArray(SillyTavern.getContext().chat),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  if (await waitGone()) return { ok: true, ret: ret.ret, reloaded: true };
  return { ok: false, ret: ret.ret, err: '删除后角色列表仍包含该名字' };
}

function safePayload(v, depth = 0) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'function') return '[function]';
    if (typeof v === 'string' && v.length > 500) return v.slice(0, 500) + `…(${v.length}字)`;
    return v;
  }
  if (depth > 2) return '[deep]';
  if (Array.isArray(v)) return v.slice(0, 10).map((x) => safePayload(x, depth + 1));
  const out = {};
  for (const k of Object.keys(v).slice(0, 12)) {
    try { out[k] = safePayload(v[k], depth + 1); } catch { out[k] = '[err]'; }
  }
  return out;
}

export const DEBUG_EVENTS = [
  'MESSAGE_SENT',
  'MESSAGE_RECEIVED',
  'GENERATION_STARTED',
  'GENERATION_ENDED',
  'GENERATION_STOPPED',
  'CHARACTER_MESSAGE_RENDERED',
  'USER_MESSAGE_RENDERED',
  'STREAM_TOKEN_RECEIVED',
  'TOOL_CALLS_PERFORMED',
  'TOOL_CALLS_RENDERED',
  'WORLDINFO_ENTRIES_LOADED',
  'WORLDINFO_SCAN_DONE',
  'CHAT_CHANGED',
  'MESSAGE_DELETED',
];

export async function listen(page, { events = DEBUG_EVENTS, timeoutMs = 30000, onEntry = () => {}, stopSignal = null } = {}) {
  await page.evaluate((eventNames) => {
    const ctx = SillyTavern.getContext();
    const et = ctx.eventTypes;
    window.__stDebugQueue = window.__stDebugQueue || [];
    if (window.__stDebugCleanup) window.__stDebugCleanup();

    // 页面内可用的安全序列化（不能引用 Node 侧函数）
    const safePayload = (v, depth = 0) => {
      if (v === null || typeof v !== 'object') {
        if (typeof v === 'function') return '[function]';
        if (typeof v === 'string' && v.length > 500) return v.slice(0, 500) + '…(' + v.length + '字)';
        return v;
      }
      if (depth > 2) return '[deep]';
      if (Array.isArray(v)) return v.slice(0, 10).map((x) => safePayload(x, depth + 1));
      const out = {};
      for (const k of Object.keys(v).slice(0, 12)) {
        try { out[k] = safePayload(v[k], depth + 1); } catch { out[k] = '[err]'; }
      }
      return out;
    };

    const push = (entry) => {
      if (window.__stDebugQueue.length < 2000) window.__stDebugQueue.push(entry);
    };

    const handlers = {};
    for (const name of eventNames) {
      if (!et[name]) continue;
      handlers[name] = (...args) => {
        let payload = args.slice(0, 2).map((a) => safePayload(a));
        // 世界书载荷巨大，压缩为摘要（uid/世界/条目名/开关/触发策略）
        if (name === 'WORLDINFO_ENTRIES_LOADED' || name === 'WORLDINFO_SCAN_DONE') {
          const compact = (arr) => (Array.isArray(arr) ? arr.map((e) => ({
            uid: e.uid ?? e.key ?? null,
            world: e.world ?? null,
            comment: e.comment ?? null,
            constant: e.constant ?? null,
            selective: e.selective ?? null,
          })).slice(0, 30) : null);
          const first = args[0] || {};
          const second = args[1] || {};
          payload = [{
            globalLore: compact(first.globalLore),
            characterLore: compact(first.characterLore),
            chatLore: compact(first.chatLore),
            personaLore: compact(first.personaLore),
            activated: second.activated ?? null,
            budget: second.budget ?? null,
          }];
        }
        push({ t: new Date().toISOString(), kind: 'event', name, payload });
      };
      ctx.eventSource.on(et[name], handlers[name]);
    }

    // 监听酒馆 toast（错误/提示），参考 toast 容器 DOM
    let toastObserver = null;
    const toastRoot = document.querySelector('#toast-container');
    if (toastRoot && typeof MutationObserver === 'function') {
      toastObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              const text = (node.textContent || '').trim().slice(0, 300);
              if (text) push({ t: new Date().toISOString(), kind: 'toast', payload: text });
            }
          }
        }
      });
      toastObserver.observe(toastRoot, { childList: true });
    }

    window.__stDebugCleanup = () => {
      for (const name of eventNames) {
        if (handlers[name] && et[name]) {
          try { ctx.eventSource.removeListener(et[name], handlers[name]); } catch { /* 忽略 */ }
        }
      }
      if (toastObserver) toastObserver.disconnect();
      window.__stDebugCleanup = null;
    };
  }, events);

  const consoleEntries = [];
  const onConsole = (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleEntries.push({ t: new Date().toISOString(), kind: 'console', level: msg.type(), payload: msg.text().slice(0, 500) });
    }
  };
  const onPageError = (err) => {
    consoleEntries.push({ t: new Date().toISOString(), kind: 'pageerror', payload: String(err && err.stack || err).slice(0, 500) });
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  let lastIndex = 0;
  let lastConsoleIndex = 0;
  const deadline = Date.now() + timeoutMs;
  const entries = [];
  let stopped = false;
  if (stopSignal) {
    stopSignal.then(() => { stopped = true; }).catch(() => { stopped = true; });
  }
  while (Date.now() < deadline) {
    const queue = await page.evaluate(() => window.__stDebugQueue || []);
    for (let i = lastIndex; i < queue.length; i++) {
      const e = queue[i];
      entries.push(e);
      onEntry(e);
    }
    lastIndex = queue.length;
    for (let i = lastConsoleIndex; i < consoleEntries.length; i++) {
      const e = consoleEntries[i];
      entries.push(e);
      onEntry(e);
    }
    lastConsoleIndex = consoleEntries.length;
    if (stopped) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  await page.evaluate(() => {
    if (window.__stDebugCleanup) window.__stDebugCleanup();
    window.__stDebugQueue = [];
  }).catch(() => {});
  return { count: entries.length, entries };
}

// ---------- 会话管理 ----------

export async function closeSession({ browser }) {
  if (browser) await browser.close().catch(() => {});
}
