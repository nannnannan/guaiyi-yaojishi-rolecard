#!/usr/bin/env node
// ============================================================
// import-card.mjs — 角色卡导入器（全流程自动化）
// ------------------------------------------------------------
// 一条命令完成：
//   1) 通过酒馆原生通道导入角色卡（JSON / PNG）
//   2) 处理「导入标签」弹窗（Import All / Existing / None）
//   3) 处理「卡内世界书」加载（导入为全局世界书并关联 / 跳过）
//   4) 处理酒馆助手脚本弹窗（勾选并确认 / 跳过）
//   5) 启用角色正则脚本（加入 character_allowed_regex）
//   6) 首次点进聊天（新聊天，或指定 --chat 打开已有聊天）
//   7) 修复性收尾：把角色卡文件补回完整数据（世界书/脚本/正则/聊天绑定），
//      避免页面保存浅层角色数据时把卡内世界书剥掉
//   8) 验证并输出报告
//
// 用法：
//   node 角色卡导入器/import-card.mjs <卡文件...> [选项]
//   npm run import-card -- <卡文件...>
//
// 选项：
//   --tags all|existing|none     标签弹窗选择（默认 all）
//   --worldbook yes|no           卡内世界书是否导入全局并关联（默认 yes）
//   --scripts yes|no             酒馆助手脚本是否启用（默认 yes）
//   --regex yes|no               是否启用角色正则（默认 yes）
//   --chat <聊天文件名>          导入后打开指定聊天（默认让酒馆开新聊天）
//   --keep-dialog-settings       不恢复弹窗设置（默认结束后恢复原值）
//   --json / --timeout ms / --headed / --url <地址>
// ============================================================
import { readFileSync, writeFileSync, existsSync, copyFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const session = await import(pathToFileURL(resolve(HERE, '../核心/tavern-session.mjs')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HELP = `
角色卡导入器 — 导入 + 标签 + 世界书/脚本/正则 + 首次进聊天

用法:
  node 角色卡导入器/import-card.mjs <卡文件...> [选项]

选项:
  --tags all|existing|none   标签弹窗选择（默认 all）
  --worldbook yes|no         卡内世界书导入全局并关联（默认 yes）
  --scripts yes|no           酒馆助手脚本启用（默认 yes）
  --regex yes|no             角色正则启用（默认 yes）
  --chat <聊天文件名>         导入后打开指定聊天
  --keep-dialog-settings     不恢复弹窗设置
  --json                     输出 JSON
  --timeout <毫秒>           弹窗/等待总超时（默认 180000）
  --headed                   显示浏览器窗口
  --url <地址>               酒馆地址（默认 http://127.0.0.1:8000）
`;

function parseArgs(argv) {
  const flags = {
    tags: 'all',
    worldbook: 'yes',
    scripts: 'yes',
    regex: 'yes',
    chat: null,
    keepDialogSettings: false,
    json: false,
    timeout: 180000,
    headed: false,
    url: process.env.ST_URL || 'http://127.0.0.1:8000',
  };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.json = true;
    else if (a === '--headed') flags.headed = true;
    else if (a === '--keep-dialog-settings') flags.keepDialogSettings = true;
    else if (a === '--tags') flags.tags = argv[++i];
    else if (a === '--worldbook') flags.worldbook = argv[++i];
    else if (a === '--scripts') flags.scripts = argv[++i];
    else if (a === '--regex') flags.regex = argv[++i];
    else if (a === '--chat') flags.chat = argv[++i];
    else if (a === '--timeout') flags.timeout = Number(argv[++i]);
    else if (a === '--url') flags.url = argv[++i];
    else if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0); }
    else if (a.startsWith('--')) throw new Error(`未知选项: ${a}`);
    else files.push(a);
  }
  if (!['all', 'existing', 'none'].includes(flags.tags)) throw new Error('--tags 只能是 all/existing/none');
  if (!['yes', 'no'].includes(flags.worldbook)) throw new Error('--worldbook 只能是 yes/no');
  if (!['yes', 'no'].includes(flags.scripts)) throw new Error('--scripts 只能是 yes/no');
  if (!['yes', 'no'].includes(flags.regex)) throw new Error('--regex 只能是 yes/no');
  if (files.length === 0) throw new Error(`没有指定卡文件\n${HELP}`);
  return { files, flags };
}

// ---------- 卡文件预检 ----------

function readCardData(filePath) {
  if (!existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`);
  const ext = filePath.split('.').pop().toLowerCase();
  if (ext === 'json') {
    return { card: JSON.parse(readFileSync(filePath, 'utf8')), summary: summarize(JSON.parse(readFileSync(filePath, 'utf8'))) };
  }
  if (ext === 'png') {
    const { card } = parsePngCard(filePath);
    return { card, summary: summarize(card) };
  }
  return { card: null, summary: { name: null, tags: [], characterBook: false, regexScripts: false, helperScripts: false, unparsed: ext } };
}

function parsePngCard(filePath) {
  const buf = readFileSync(filePath);
  const signature = buf.subarray(0, 8);
  const chunks = [];
  let off = 8;
  let chara = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    chunks.push({ type, raw: buf.subarray(off, off + 12 + len) });
    if (type === 'tEXt') {
      const tx = data.toString('latin1');
      const eq = tx.indexOf('\u0000');
      if (tx.slice(0, eq) === 'chara') chara = tx.slice(eq + 1);
    } else if (type === 'zTXt' || type === 'iTXt') {
      const tx = data.toString('latin1');
      const eq = tx.indexOf('\u0000');
      if (tx.slice(0, eq) === 'chara') chara = tx.slice(eq + 1);
    }
    off += 12 + len;
  }
  if (!chara) throw new Error(`PNG 中未找到 chara 数据块: ${filePath}`);
  const card = JSON.parse(Buffer.from(chara, 'base64').toString('utf8'));
  return { card, chunks, signature };
}

function summarize(card) {
  const data = card.data ?? card;
  return {
    name: card.name ?? data.name ?? null,
    tags: Array.isArray(card.tags) ? card.tags : [],
    characterBook: Boolean(data.character_book),
    regexScripts: Boolean(data.extensions?.regex_scripts?.length),
    helperScripts: Boolean(data.extensions?.tavern_helper?.scripts?.length),
    helperScriptNames: (data.extensions?.tavern_helper?.scripts ?? []).map((s) => s.name),
  };
}

// ---------- PNG 重建（补回完整卡数据） ----------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// 用新卡 JSON 重建 PNG：保留原头像图像块，在 IEND 之前写入 chara + ccv3 双文本块
// （与酒馆自身 write() 的格式一致：chara 存原卡、ccv3 存强制 v3 版本；酒馆读取优先用 ccv3）
function rebuildPngCard(signature, srcPngChunks, card) {
  const v3Card = { ...card, spec: 'chara_card_v3', spec_version: '3.0' };
  const textChunks = [
    ['chara', Buffer.from(JSON.stringify(card), 'utf8').toString('base64')],
    ['ccv3', Buffer.from(JSON.stringify(v3Card), 'utf8').toString('base64')],
  ];
  const out = [signature];
  let iendRaw = null;
  for (const c of srcPngChunks) {
    if (c.type === 'tEXt' || c.type === 'zTXt' || c.type === 'iTXt') continue;
    if (c.type === 'IEND') {
      iendRaw = c.raw;
      continue;
    }
    out.push(c.raw);
  }
  const keyBuf = Buffer.from('chara\u0000', 'latin1');
  for (const [keyword, b64] of textChunks) {
    const kBuf = Buffer.from(`${keyword}\u0000`, 'latin1');
    const dataBuf = Buffer.from(b64, 'utf8');
    const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(kBuf.length + dataBuf.length);
    const typeBuf = Buffer.from('tEXt', 'ascii');
    const body = Buffer.concat([lenBuf, typeBuf, kBuf, dataBuf]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, kBuf, dataBuf])));
    out.push(body, crcBuf);
  }
  if (iendRaw) out.push(iendRaw);
  return Buffer.concat(out);
}

// ---------- 弹窗处理 ----------

async function listVisiblePopups(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.popup'))
      .filter((e) => {
        const s = window.getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      })
      .map((p) => ({
        text: (p.innerText || '').slice(0, 600),
        buttons: Array.from(p.querySelectorAll('button, .menu_button, [class*="popup-button"], .result-control'))
          .filter((b) => {
            const s = window.getComputedStyle(b);
            return s.display !== 'none' && b.getBoundingClientRect().width > 0;
          })
          .map((b) => ({ text: (b.innerText || '').trim().slice(0, 50), cls: String(b.className).slice(0, 70) })),
        checkboxCount: p.querySelectorAll('input[type="checkbox"]').length,
      }));
  });
}

function decideAction(popup, flags) {
  const text = popup.text;
  const btns = popup.buttons.map((b) => b.text);
  if (btns.some((t) => t.startsWith('Import All')) || btns.some((t) => t.startsWith('Import Existing')) || btns.some((t) => t.startsWith('Import None'))) {
    const target = flags.tags === 'all' ? 'Import All' : flags.tags === 'existing' ? 'Import Existing' : 'Import None';
    return { kind: 'tags', click: btns.some((t) => t.startsWith(target)) ? target : btns.find((t) => t.startsWith('Import')) };
  }
  // 世界书导入确认框（本地化文案：「确定要导入 'X' 吗？」+ 确定/否）
  if (/确定要导入|确认要导入|are you sure you want to import/i.test(text)) {
    return flags.worldbook === 'yes'
      ? { kind: 'worldbook-confirm', clickOk: true }
      : { kind: 'worldbook-confirm', clickOk: false };
  }
  if (/world|worldbook|lorebook|world info|世界书|导入.*书/i.test(text)) {
    return flags.worldbook === 'yes'
      ? { kind: 'worldbook', clickOk: true }
      : { kind: 'worldbook', clickOk: false };
  }
  if (popup.checkboxCount > 0 && /script|脚本|酒馆助手|tavern|helper|插件/i.test(text)) {
    return flags.scripts === 'yes'
      ? { kind: 'scripts', checkAll: true, clickOk: true }
      : { kind: 'scripts', checkAll: false, clickOk: false };
  }
  if (popup.checkboxCount > 0) {
    return flags.scripts === 'yes'
      ? { kind: 'generic-check', checkAll: true, clickOk: true }
      : { kind: 'generic-check', checkAll: false, clickOk: false };
  }
  if (btns.some((t) => /^(yes|ok|确认|确定|是|安装|启用|应用|import|导入)$/i.test(t)) && !btns.some((t) => /^(no|cancel|取消|否|skip|跳过)$/i.test(t))) {
    return { kind: 'generic-ok', clickOk: true };
  }
  return null;
}

async function applyAction(page, action) {
  if (!action) return false;
  if (action.click) {
    await page.evaluate((target) => {
      const btns = Array.from(document.querySelectorAll('.popup button, .popup .menu_button, .popup [class*="popup-button"], .popup .result-control'));
      const hit = btns.find((b) => (b.innerText || '').trim().startsWith(target));
      if (hit) hit.click();
    }, action.click);
    return true;
  }
  if (action.checkAll === true) {
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.popup input[type="checkbox"]')).forEach((c) => {
        if (!c.checked) c.click();
      });
    });
  }
  await page.evaluate((ok) => {
    const popup = Array.from(document.querySelectorAll('.popup')).find((e) => {
      const s = window.getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return s.display !== 'none' && r.width > 0 && r.height > 0;
    });
    if (!popup) return;
    const sel = ok ? '.popup-button-ok' : '.popup-button-cancel, .popup-button-close';
    const btn = popup.querySelector(sel);
    if (btn) btn.click();
  }, action.clickOk);
  return true;
}

async function drainPopups(page, flags, log, quietMs = 1800) {
  const deadline = Date.now() + flags.timeout;
  let quietRounds = 0;
  while (Date.now() < deadline) {
    const popups = await listVisiblePopups(page);
    if (popups.length === 0) {
      quietRounds += 1;
      if (quietRounds * 350 >= quietMs) break;
      await sleep(350);
      continue;
    }
    quietRounds = 0;
    let acted = false;
    for (const popup of popups) {
      const action = decideAction(popup, flags);
      log.push({ popupText: popup.text.slice(0, 120), buttons: popup.buttons.map((b) => b.text), action: action ? action.kind : 'none' });
      if (action) {
        await applyAction(page, action);
        acted = true;
      }
    }
    if (!acted) await sleep(400);
  }
}

// ---------- 等待导入完成（按新头像文件判定，兼容同名替换） ----------

async function getAvatarList(page) {
  return page.evaluate(() => (SillyTavern.getContext().characters || []).map((ch) => ch.avatar));
}

async function waitForImported(page, beforeAvatars, flags, expectedName) {
  const deadline = Date.now() + flags.timeout;
  while (Date.now() < deadline) {
    const avatars = await getAvatarList(page);
    const fresh = avatars.find((a) => !beforeAvatars.includes(a));
    if (fresh) {
      const names = await page.evaluate(async () => await TavernHelper.getCharacterNames());
      const avatars2 = await getAvatarList(page);
      const idx = avatars2.indexOf(fresh);
      const name = idx >= 0 ? names[idx] : fresh.replace(/\.png$/, '');
      // 安全闸：已知目标卡名时，新头像对应的卡名必须一致；
      // 否则可能是用户并行操作产生的其他新卡，继续等待真正的导入结果。
      if (expectedName && name !== expectedName) {
        await sleep(500);
        continue;
      }
      return { avatar: fresh, name };
    }
    const replaced = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.toast')).some((t) => /Character (Replaced|Created)|角色.*(替换|创建)|已导入/i.test(t.textContent || ''));
    });
    if (replaced && beforeAvatars.length > 0) {
      return { avatar: beforeAvatars[beforeAvatars.length - 1], name: beforeAvatars[beforeAvatars.length - 1].replace(/\.png$/, '') };
    }
    await sleep(500);
  }
  throw new Error('等待导入角色超时：未检测到新角色文件');
}

// ---------- 导入后：世界书（全局导入并关联） ----------

async function openCharacterEditor(page, name) {
  await page.evaluate((n) => {
    const row = Array.from(document.querySelectorAll('.character_select')).find((e) => (e.textContent || '').includes(n));
    if (row) row.click();
  }, name);
  await sleep(1200);
}

async function importEmbeddedWorldViaMenu(page, name, flags, log) {
  // 先打开角色编辑面板，让 checkEmbeddedWorld 注入选项所需 chid 并触发世界书弹窗
  await openCharacterEditor(page, name);
  await drainPopups(page, flags, log);
  await page.evaluate(() => {
    const sel = document.querySelector('#char-management-dropdown');
    const opt = sel?.querySelector('option#import_character_info');
    if (sel && opt) {
      sel.selectedIndex = Array.from(sel.options).indexOf(opt);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await sleep(800);
  await drainPopups(page, flags, log);
  await sleep(1200);
}

// ---------- 收尾：直接把完整卡数据写回角色文件 ----------

async function finalizeCharacterFile(avatarPath, sourceCard, chatBinding, flags) {
  if (!existsSync(avatarPath)) throw new Error(`角色文件不存在: ${avatarPath}`);
  const { chunks, signature } = parsePngCard(avatarPath);
  // 以源卡为基准重建（保证 v3 结构、世界书、脚本、正则完整），只覆盖聊天绑定与世界书选择
  const finalCard = JSON.parse(JSON.stringify(sourceCard));
  const data = finalCard.data ?? finalCard;
  if (chatBinding) {
    finalCard.chat = chatBinding;
    data.chat = chatBinding;
  }
  if (flags.worldbook === 'no' && data.extensions) {
    delete data.extensions.world;
  }
  const rebuilt = rebuildPngCard(signature, chunks, finalCard);
  const backup = `${avatarPath}.bak-${Date.now()}`;
  copyFileSync(avatarPath, backup);
  const tmp = `${avatarPath}.tmp-${Date.now()}`;
  writeFileSync(tmp, rebuilt);
  renameSync(tmp, avatarPath);
  return { backup, bytes: rebuilt.length };
}

// ---------- 收尾读回校验：防页面浅层保存剥掉提示字段 ----------
// 已知缺陷：收尾重建角色文件后，页面可能在重建之后异步落一次「浅层角色数据」，
// 把 system_prompt / post_history_instructions 保存成空串（历史真机曾两次踩坑）。
// 本函数在重建后延时读回文件，若字段被剥空则立即以源卡重建，最多重试 3 次。

async function assertPromptFieldsAfterFinalize(avatarPath, sourceCard, chatBinding) {
  const pick = (card) => {
    const d = (card && (card.data ?? card)) || {};
    const str = (v) => (typeof v === 'string' ? v : '');
    return { system: str(d.system_prompt), post: str(d.post_history_instructions) };
  };
  const expect = pick(sourceCard);
  for (let attempt = 1; attempt <= 3; attempt++) {
    await sleep(2000 * attempt);
    let got = { system: null, post: null };
    try { got = pick(parsePngCard(avatarPath).card); } catch { /* 文件暂不可读，视为未通过 */ }
    const systemOk = expect.system ? got.system === expect.system : got.system === '';
    const postOk = expect.post ? got.post === expect.post : got.post === '';
    if (systemOk && postOk) return { ok: true, attempts: attempt };
    if (attempt < 3) {
      // 页面浅层保存覆盖了文件：以源卡为准重建（保留图像块与聊天绑定）
      const { chunks, signature } = parsePngCard(avatarPath);
      const finalCard = JSON.parse(JSON.stringify(sourceCard));
      const data = finalCard.data ?? finalCard;
      if (chatBinding) { finalCard.chat = chatBinding; data.chat = chatBinding; }
      const rebuilt = rebuildPngCard(signature, chunks, finalCard);
      writeFileSync(avatarPath, rebuilt);
    }
  }
  return { ok: false, attempts: 3 };
}

// ---------- 导入后验证 ----------

async function verifyAll(page, name, avatar, info, flags, log) {
  const result = { name, avatar, tags: null, worldbook: null, helperScripts: null, regex: null, chat: null };

  result.tags = await page.evaluate((n) => {
    const ch = (SillyTavern.getContext().characters || []).find((x) => x.name === n);
    return ch ? ch.tags : null;
  }, name);

  const worldState = await page.evaluate(async () => {
    const c = SillyTavern.getContext();
    const ch = (c.characters || []).find((x) => x.name === c.name2);
    const bookName = ch?.data?.character_book?.name || null;
    const linked = ch?.data?.extensions?.world || null;
    const worldNames = await TavernHelper.getWorldbookNames();
    return { bookName, linked, inWorldList: worldNames.includes(linked) };
  });
  result.worldbook = worldState;

  if (flags.worldbook === 'yes' && info.characterBook && !(worldState.linked && worldState.inWorldList)) {
    await importEmbeddedWorldViaMenu(page, name, flags, log);
    const after = await page.evaluate(async () => {
      const c = SillyTavern.getContext();
      const ch = (c.characters || []).find((x) => x.name === c.name2);
      const linked = ch?.data?.extensions?.world || null;
      const worldNames = await TavernHelper.getWorldbookNames();
      return { linked, inWorldList: worldNames.includes(linked) };
    });
    result.worldbook = after;
  }

  const thState = await page.evaluate(() => {
    const st = SillyTavern.getContext().extensionSettings?.tavern_helper?.script || {};
    const enabledChars = Array.isArray(st.enabled?.characters) ? st.enabled.characters : [];
    const scripts = Array.isArray(st.scripts) ? st.scripts.map((s) => s.name || s.scriptName || s.id) : [];
    return { enabledCharacters: enabledChars, installedScriptCount: scripts.length, installedScripts: scripts.slice(0, 15) };
  });
  result.helperScripts = thState;

  if (flags.regex === 'yes') {
    result.regex = await page.evaluate((avatar) => {
      const c = SillyTavern.getContext();
      const es = c.extensionSettings || {};
      if (!Array.isArray(es.character_allowed_regex)) es.character_allowed_regex = [];
      const enabled = es.character_allowed_regex.includes(avatar);
      if (!enabled) {
        es.character_allowed_regex.push(avatar);
        if (typeof window.saveSettingsDebounced === 'function') window.saveSettingsDebounced();
      }
      return { enabled: enabled || true, avatar };
    }, avatar);
  }

  if (flags.chat) {
    await session.switchCharacter(page, name, false);
    await page.evaluate((chatName) => SillyTavern.getContext().openCharacterChat(chatName), flags.chat);
    await sleep(2500);
  } else {
    await session.switchCharacter(page, name, false);
    await sleep(2500);
  }
  const chatState = await page.evaluate(() => {
    const c = SillyTavern.getContext();
    const last = c.chat[c.chat.length - 1];
    return {
      chatId: c.chatId,
      messageCount: c.chat.length,
      lastRole: last ? (last.is_user ? 'user' : 'assistant') : null,
      lastPreview: last ? String(last.mes).slice(0, 120) : null,
    };
  });
  result.chat = chatState;
  return result;
}

// ---------- 主流程 ----------

async function main() {
  const { files, flags } = parseArgs(process.argv.slice(2));
  const report = { url: flags.url, files: [], errors: [] };
  const { browser, page } = await session.connect(flags.url, flags);
  try {
    for (const file of files) {
      const fileReport = { file, info: null, actions: [], log: [], result: null };
      try {
        const { card: sourceCard, summary: info } = readCardData(file);
        fileReport.info = info;
        const beforeAvatars = await getAvatarList(page);

        // 1) 通过 UI 设置弹窗行为（标签=Ask、世界书对话框=开启），结束后恢复
        const dialogPrev = await page.evaluate(() => {
          const tagSel = document.querySelector('#tag_import_setting');
          const worldChk = document.querySelector('#world_import_dialog');
          const prev = { tag: tagSel ? tagSel.value : null, world: worldChk ? worldChk.checked : null };
          if (tagSel) { tagSel.value = '1'; tagSel.dispatchEvent(new Event('change', { bubbles: true })); }
          if (worldChk && !worldChk.checked) { worldChk.click(); }
          if (typeof window.saveSettingsDebounced === 'function') window.saveSettingsDebounced();
          return prev;
        });
        await sleep(1500);

        // 2) 触发导入
        await page.setInputFiles('#character_import_file', file);
        await drainPopups(page, flags, fileReport.log);
        const imported = await waitForImported(page, beforeAvatars, flags, info.name);
        if (info.name && imported.name !== info.name) {
          throw new Error(`导入目标校验失败：期望「${info.name}」，检测到「${imported.name}」，已中止以避免误操作`);
        }
        fileReport.imported = imported;
        await sleep(1500);
        // 选入角色后可能再弹世界书/脚本框，再排一轮
        await drainPopups(page, flags, fileReport.log);

        // 3) 验证 + 世界书兜底 + 正则 + 聊天
        const result = await verifyAll(page, imported.name, imported.avatar, info, flags, fileReport.log);
        fileReport.result = result;

        // 4) 收尾：把完整卡数据（含世界书/聊天绑定）直接写回角色文件
        const avatarPath = resolve(process.env.ST_DATA_DIR || join(homedir(), 'SillyTavern/data/default-user'), 'characters', imported.avatar);
        const finalize = await finalizeCharacterFile(avatarPath, sourceCard, result.chat?.chatId || flags.chat || null, flags);
        fileReport.finalized = finalize;

        // 4.1) 收尾读回校验：若页面浅层保存把提示字段剥空，自动以源卡重建
        const promptFields = await assertPromptFieldsAfterFinalize(avatarPath, sourceCard, result.chat?.chatId || flags.chat || null);
        fileReport.promptFields = promptFields;
        if (!promptFields.ok) {
          fileReport.warning = '收尾读回校验未通过：system_prompt / post_history_instructions 可能被页面浅层保存剥空，请以源卡手动重建角色文件并复核。';
          report.errors.push({ file, warning: fileReport.warning });
        }

        // 5) 恢复弹窗设置
        if (!flags.keepDialogSettings) {
          await page.evaluate((prev) => {
            const tagSel = document.querySelector('#tag_import_setting');
            const worldChk = document.querySelector('#world_import_dialog');
            if (tagSel && prev.tag !== null) { tagSel.value = prev.tag; tagSel.dispatchEvent(new Event('change', { bubbles: true })); }
            if (worldChk && prev.world !== null && worldChk.checked !== prev.world) worldChk.click();
            if (typeof window.saveSettingsDebounced === 'function') window.saveSettingsDebounced();
          }, dialogPrev);
        }
      } catch (e) {
        fileReport.errors = String(e && e.message || e);
        report.errors.push({ file, error: fileReport.errors });
      }
      report.files.push(fileReport);
    }
  } finally {
    await session.closeSession({ browser });
  }
  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const f of report.files) {
      console.log(`\n==== ${f.file} ====`);
      if (f.errors) { console.log(`错误: ${f.errors}`); continue; }
      console.log(`角色: ${f.result?.name}（${f.result?.avatar}）`);
      console.log(`弹窗动作: ${f.actions?.join(', ') || '（见 log）'}`);
      console.log(`标签: ${(f.result?.tags || []).join('、') || '（无）'}`);
      console.log(`世界书: ${JSON.stringify(f.result?.worldbook)}`);
      console.log(`TH 脚本: ${JSON.stringify(f.result?.helperScripts)}`);
      console.log(`正则: ${JSON.stringify(f.result?.regex)}`);
      console.log(`聊天: ${f.result?.chat?.chatId}（${f.result?.chat?.messageCount} 条）`);
      console.log(`文件收尾: ${JSON.stringify(f.finalized)}`);
      console.log(`提示字段校验: ${JSON.stringify(f.promptFields)}${f.warning ? `\n警告: ${f.warning}` : ''}`);
    }
  }
}

const isMain = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain) {
  main().catch((e) => {
    console.error(`[导入器] 错误: ${e.message || e}`);
    process.exit(1);
  });
}

export {
  parsePngCard,
  rebuildPngCard,
  finalizeCharacterFile,
  assertPromptFieldsAfterFinalize,
  drainPopups,
  importEmbeddedWorldViaMenu,
  readCardData,
};
