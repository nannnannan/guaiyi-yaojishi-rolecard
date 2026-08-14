// ============================================================
// prompt-capture.mjs — 每轮问答全量监听（提示词透视镜的 CLI 版）
// ------------------------------------------------------------
// 原理：酒馆会把「最终发给模型的完整负载」通过代理接口
//   /api/backends/chat-completions/generate 转发给模型。
// 本模块在页面里挂钩 fetch，直接快照这个请求的完整 body
//   （包含 system 提示、预设注入、世界书、正则处理后的历史、玩家输入）
//   和流式响应（AI 回答全文、usage、finish_reason），
//   每轮写入 JSON 文件；另附一份 viewer.html 可直接打开的兼容导出。
//
// 用法（由 入口/st-debug.mjs 集成）：
//   npm run debug -- talk <角色> <文本> --capture
//   npm run debug -- send <文本> --wait --capture
//   npm run debug -- test <卡文件> --capture
// ============================================================
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CAPTURE_DIR = join(HERE, 'captures');

// ---------- 页面挂钩 ----------

/**
 * 在页面里安装 fetch 挂钩：捕获酒馆代理接口的请求 body 与完整响应文本。
 * 只记录该接口；不读取任何 API Key / 请求头。
 */
export async function installPromptCapture(page) {
  return page.evaluate(() => {
    if (window.__promptCaptureInstalled) return { installed: true };
    window.__promptCapture = null;
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = String(args[0]);
      if (!/(chat-completions\/generate|chat\/completions|backends)/i.test(url)) {
        return origFetch(...args);
      }
      let requestBody = null;
      try {
        const raw = args[1] && args[1].body ? String(args[1].body) : null;
        if (raw) requestBody = JSON.parse(raw);
      } catch {
        requestBody = null;
      }
      const started = Date.now();
      try {
        const resp = await origFetch(...args);
        let responseText = null;
        try {
          responseText = await resp.clone().text();
        } catch {
          responseText = null;
        }
        window.__promptCapture = {
          url,
          status: resp.status,
          requestBody,
          responseText,
          ms: Date.now() - started,
        };
        return resp;
      } catch (error) {
        window.__promptCapture = {
          url,
          status: 0,
          requestBody,
          responseText: null,
          error: String(error && error.message || error),
          ms: Date.now() - started,
        };
        throw error;
      }
    };
    window.__promptCaptureInstalled = true;
    return { installed: true };
  });
}

export async function clearPromptCapture(page) {
  await page.evaluate(() => {
    window.__promptCapture = null;
  }).catch(() => {});
}

// ---------- 解析 ----------

export function parseSse(text) {
  let content = '';
  let reasoning = '';
  let usage = null;
  let finishReason = null;
  let chunkCount = 0;
  if (!text) return { content, reasoning, usage, finishReason, chunkCount };
  for (const line of String(text).split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const json = JSON.parse(payload);
      const choice = json.choices && json.choices[0];
      const delta = choice && choice.delta;
      if (delta && typeof delta.content === 'string' && delta.content) {
        content += delta.content;
        chunkCount += 1;
      }
      if (delta && typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
        reasoning += delta.reasoning_content;
      }
      if (choice && choice.finish_reason) finishReason = choice.finish_reason;
      if (json.usage) usage = json.usage;
    } catch {
      // 跳过非 JSON 行
    }
  }
  return { content, reasoning, usage, finishReason, chunkCount };
}

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 1.5);
}

function sanitizeName(name) {
  return String(name || '角色').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}

// ---------- 世界书命中启发式（参考提示词透视镜多探针） ----------

async function probeWorldbook(page, messagesText) {
  return page.evaluate(async (targetText) => {
    const c = SillyTavern.getContext();
    const ch = (c.characters || []).find((x) => x.name === c.name2);
    let book = null;
    try {
      if (typeof TavernHelper.getLorebooks === 'function') {
        const all = await TavernHelper.getLorebooks();
        const linked = ch?.data?.extensions?.world;
        if (Array.isArray(all)) book = all.find((b) => b.name === linked) || null;
      }
    } catch {
      book = null;
    }
    if (!book) book = ch?.data?.character_book || null;
    const entries = book?.entries;
    if (!entries) return { name: book?.name || ch?.data?.extensions?.world || '', injected: [] };
    const list = Array.isArray(entries) ? entries : Object.values(entries);
    const normalized = targetText.replace(/\s+/g, ' ');
    const injected = list
      .filter((entry) => entry && entry.enabled !== false)
      .map((entry) => {
        const plain = String(entry.content || '')
          .replace(/<%[\s\S]*?%>/g, '')
          .split('\n')
          .map((line) => line.replace(/\s+/g, ' ').trim())
          .filter((line) => line.length >= 15);
        const probes = plain.length
          ? plain
          : [String(entry.content || '').replace(/<%[\s\S]*?%>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)];
        const hit = probes.some((probe) => probe.length > 10 && normalized.includes(probe));
        return {
          comment: entry.comment || entry.name || '',
          keys: Array.isArray(entry.keys) ? entry.keys : [],
          hit,
        };
      });
    return { name: book.name || ch?.data?.extensions?.world || '', injected };
  }, messagesText);
}

// ---------- 取轮次记录 ----------

/**
 * 读取页面里捕获到的一轮记录并组装成标准 turn。
 * @param {import('playwright').Page} page
 * @param {{char?: string, chatId?: string, input?: string}} meta
 */
export async function takePromptCapture(page, meta = {}) {
  const raw = await page.evaluate(() => window.__promptCapture || null).catch(() => null);
  if (!raw) return null;
  const messages = Array.isArray(raw.requestBody?.messages)
    ? raw.requestBody.messages.map((m) => ({
        role: m.role ?? 'unknown',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
      }))
    : [];
  const promptText = messages.map((m) => m.content).join('\n');
  const sse = parseSse(raw.responseText);
  const params = { ...(raw.requestBody || {}) };
  delete params.messages;
  const preset = {};
  for (const key of ['temperature', 'top_p', 'top_k', 'min_p', 'top_a', 'repetition_penalty', 'frequency_penalty', 'presence_penalty', 'max_tokens', 'stream', 'reasoning_effort', 'seed', 'n']) {
    if (params[key] !== undefined) preset[key] = params[key];
  }
  if (params.model) preset.model = params.model;
  if (params.chat_completion_source) preset.chat_completion_source = params.chat_completion_source;
  const worldbook = await probeWorldbook(page, promptText).catch(() => ({ name: '', injected: [] }));
  const reply = sse.content || '';
  const id = Date.now();
  return {
    id,
    time: new Date().toISOString(),
    char: meta.char ?? '',
    chat: meta.chatId ?? '',
    input: meta.input ?? '',
    messages,
    promptChars: promptText.length,
    promptTokens: estimateTokens(promptText),
    request: {
      url: raw.url,
      status: raw.status,
      ms: raw.ms,
      model: raw.requestBody?.model ?? '',
      max_tokens: raw.requestBody?.max_tokens ?? null,
      params,
      error: raw.error ?? null,
    },
    worldbook: {
      name: worldbook.name,
      injected: worldbook.injected,
      hitCount: worldbook.injected.filter((item) => item.hit).length,
    },
    preset,
    reply,
    replyChars: reply.length,
    reasoning: sse.reasoning,
    response: {
      status: raw.status,
      usage: sse.usage,
      finishReason: sse.finishReason,
      chunkCount: sse.chunkCount,
      rawLength: raw.responseText ? raw.responseText.length : 0,
    },
    note: raw.error ? `请求失败：${raw.error}` : '',
  };
}

// ---------- 落盘 ----------

/**
 * 写入捕获文件：
 *  1) captures/<角色>-<时间戳>.json          —— 本轮完整记录（本工具格式）
 *  2) captures/prompt-scope-viewer.json      —— 追加到 viewer.html 兼容格式
 * @returns {{file: string, viewerFile: string, turn: object}}
 */
export function writeCaptureFiles(turn, dir = DEFAULT_CAPTURE_DIR) {
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `${sanitizeName(turn.char)}-${stamp}.json`);
  writeFileSync(file, JSON.stringify({ version: 1, created: turn.time, turn }, null, 2), 'utf8');

  const viewerFile = join(dir, 'prompt-scope-viewer.json');
  let store = { version: 1, created: turn.time, turns: [] };
  if (existsSync(viewerFile)) {
    try {
      store = JSON.parse(readFileSync(viewerFile, 'utf8'));
      if (!Array.isArray(store.turns)) store.turns = [];
    } catch {
      store = { version: 1, created: turn.time, turns: [] };
    }
  }
  store.turns.unshift({
    id: turn.id,
    time: turn.time,
    char: turn.char,
    chat: turn.chat,
    messages: turn.messages,
    promptChars: turn.promptChars,
    promptTokens: turn.promptTokens,
    worldbook: turn.worldbook,
    preset: turn.preset,
    reply: turn.reply,
    replyChars: turn.replyChars,
    note: turn.note,
  });
  if (store.turns.length > 200) store.turns.length = 200;
  writeFileSync(viewerFile, JSON.stringify(store, null, 2), 'utf8');
  return { file, viewerFile, turn };
}

export function summarizeCapture(turn) {
  const worldbookHits = turn.worldbook?.hitCount ?? 0;
  return {
    file: null, // 由调用方补充
    char: turn.char,
    model: turn.request?.model ?? '',
    messages: turn.messages.length,
    roles: [...new Set(turn.messages.map((m) => m.role))],
    promptChars: turn.promptChars,
    promptTokens: turn.promptTokens,
    worldbook: turn.worldbook?.name || '',
    worldbookHits,
    replyChars: turn.replyChars,
    replyPreview: turn.reply.replace(/\s+/g, ' ').slice(0, 120),
    usage: turn.response?.usage ?? null,
  };
}

export function listCaptures(dir = DEFAULT_CAPTURE_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse();
}

export { DEFAULT_CAPTURE_DIR as defaultCaptureDir };
