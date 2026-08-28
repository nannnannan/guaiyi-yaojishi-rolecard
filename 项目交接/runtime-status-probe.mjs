import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:\\Users\\huang\\.codex\\skills\\sillytavern-ai-bridge\\scripts\\runtime\\核心\\tavern-session.mjs';
const outputDir = resolve(process.env.PROBE_OUTPUT_DIR || '项目交接/真机证据');
const runLabel = process.env.PROBE_LABEL || new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const character = process.env.ST_CHARACTER || '《诡异药剂师》v0.5';
const avatar = process.env.ST_AVATAR || '';
const listenMs = Number(process.env.PROBE_LISTEN_MS || 15000);
const width = Number(process.env.PROBE_WIDTH || 1440);
const height = Number(process.env.PROBE_HEIGHT || 900);

await mkdir(outputDir, { recursive: true });
const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url, { headed: process.env.ST_HEADED === '1' });

try {
  await page.setViewportSize({ width, height });
  const earlyConsole = [];
  page.on('console', (message) => {
    earlyConsole.push({
      at: new Date().toISOString(),
      type: message.type(),
      text: message.text().slice(0, 1500),
    });
  });
  page.on('pageerror', (error) => {
    earlyConsole.push({
      at: new Date().toISOString(),
      type: 'pageerror',
      text: String(error?.stack || error).slice(0, 1500),
    });
  });

  const observed = [];
  const listenPromise = session.listen(page, {
    timeoutMs: listenMs,
    onEntry: (entry) => observed.push(entry),
  });
  let selected;
  if (avatar) {
    const target = await page.evaluate((targetAvatar) => {
      const context = SillyTavern.getContext();
      const characterId = context.characters.findIndex((item) => item?.avatar === targetAvatar);
      if (characterId < 0) throw new Error(`角色头像槽不存在：${targetAvatar}`);
      return { characterId, name: context.characters[characterId].name };
    }, avatar);
    await page.evaluate((characterId) => {
      const row = document.querySelector(`#rm_print_characters_block .character_select[data-chid="${characterId}"]`);
      if (!row) throw new Error(`角色列表行不存在：${characterId}`);
      row.click();
    }, target.characterId);
    try {
      await page.waitForFunction(
        ({ characterId, targetAvatar }) => {
          const context = SillyTavern.getContext();
          return String(context.characterId) === String(characterId)
            && context.characters?.[characterId]?.avatar === targetAvatar
            && context.chatId !== null;
        },
        { characterId: target.characterId, targetAvatar: avatar },
        { timeout: 60000 },
      );
    } catch (error) {
      const diagnostics = await page.evaluate((characterId) => {
        const context = SillyTavern.getContext();
        const row = document.querySelector(`#rm_print_characters_block .character_select[data-chid="${characterId}"]`);
        return {
          expectedCharacterId: characterId,
          currentCharacterId: context.characterId ?? null,
          currentName: context.name2 ?? null,
          currentChatId: context.chatId ?? null,
          currentMessageCount: Array.isArray(context.chat) ? context.chat.length : null,
          targetAvatar: context.characters?.[characterId]?.avatar ?? null,
          rowExists: Boolean(row),
          rowClass: row?.className ?? null,
          visiblePopups: [...document.querySelectorAll('.popup')]
            .filter((popup) => {
              const style = getComputedStyle(popup);
              return style.display !== 'none' && style.visibility !== 'hidden';
            })
            .map((popup) => popup.textContent.replace(/\s+/g, ' ').trim().slice(0, 500)),
          toasts: [...document.querySelectorAll('#toast-container > *')]
            .map((toast) => toast.textContent.replace(/\s+/g, ' ').trim().slice(0, 300)),
        };
      }, target.characterId);
      const failurePath = resolve(outputDir, `${runLabel}-selection-failure.json`);
      const failureScreenshot = resolve(outputDir, `${runLabel}-selection-failure.png`);
      await writeFile(failurePath, `${JSON.stringify({ diagnostics, earlyConsole }, null, 2)}\n`, 'utf8');
      await page.screenshot({ path: failureScreenshot, fullPage: true });
      throw new Error(`角色头像槽选择超时：${JSON.stringify({ diagnostics, failurePath, failureScreenshot })}`, { cause: error });
    }
    await page.waitForTimeout(800);
    selected = await page.evaluate(() => {
      const context = SillyTavern.getContext();
      return {
        character: context.name2 ?? null,
        characterId: context.characterId ?? null,
        avatar: context.characters?.[context.characterId]?.avatar ?? null,
        chatId: context.chatId ?? null,
        messageCount: Array.isArray(context.chat) ? context.chat.length : 0,
      };
    });
  } else {
    selected = await session.selectCharacterChat(page, character);
  }
  await page.waitForTimeout(5000);
  const listener = await listenPromise;

  const host = await page.evaluate(() => {
    const context = SillyTavern.getContext();
    const currentCharacter = context.characters?.[context.characterId];
    return {
      character: context.name2 ?? null,
      characterId: context.characterId ?? null,
      avatar: currentCharacter?.avatar ?? null,
      chatId: context.chatId ?? null,
      messageCount: Array.isArray(context.chat) ? context.chat.length : 0,
      messageKinds: Array.isArray(context.chat)
        ? context.chat.map((message, index) => ({
          index,
          isUser: Boolean(message?.is_user),
          isSystem: Boolean(message?.is_system),
          swipeId: message?.swipe_id ?? null,
          hasVariables: Boolean(message?.variables),
        }))
        : [],
      iframeCount: document.querySelectorAll('iframe').length,
      rendererSettings: context.extensionSettings?.tavern_helper?.render ?? null,
      regexScripts: (currentCharacter?.data?.extensions?.regex_scripts
        ?? currentCharacter?.extensions?.regex_scripts
        ?? []).map((script) => ({
        id: script.id,
        name: script.scriptName,
        disabled: script.disabled,
        markdownOnly: script.markdownOnly,
        promptOnly: script.promptOnly,
        findRegex: script.findRegex,
        replaceStart: String(script.replaceString ?? '').slice(0, 80),
        replacementLength: String(script.replaceString ?? '').length,
        hasMvuHandshake: String(script.replaceString ?? '').includes("waitGlobalInitialized('Mvu')"),
      })),
      renderedMessages: [...document.querySelectorAll('#chat > .mes')].map((message) => ({
        messageId: message.getAttribute('mesid'),
        preBlocks: [...message.querySelectorAll('.mes_text pre')].map((pre) => {
          const content = pre.textContent ?? '';
          return {
            length: content.length,
            hasBodyMarker: content.includes('<body>'),
            hasStatusRoot: content.includes('data-wa-status-root'),
            start: content.slice(0, 160),
          };
        }),
        hasRenderWrapper: Boolean(message.querySelector('.TH-render')),
        iframeNames: [...message.querySelectorAll('iframe')].map((frame) => frame.name || frame.id || ''),
      })),
      messageFrameNames: [...document.querySelectorAll('iframe')]
        .map((frame) => frame.name || frame.id || '')
        .filter((name) => name.includes('TH-message--')),
    };
  });

  const frames = [];
  for (const frame of page.frames()) {
    const snapshot = await frame.evaluate(() => {
      const root = document.querySelector('[aria-label="诡异药剂师死界状态栏"]');
      const frameName = globalThis.name || '';
      const match = String(frameName).match(/^TH-message--(\d+)--/);
      const messageId = match ? Number(match[1]) : null;
      let mvu;
      for (const candidate of [globalThis, globalThis.parent, globalThis.top]) {
        try {
          if (candidate?.Mvu?.getMvuData) {
            mvu = candidate.Mvu;
            break;
          }
        } catch {
          // Cross-origin host; keep looking.
        }
      }
      let data;
      let readError = null;
      if (mvu && messageId !== null) {
        try {
          data = mvu.getMvuData({ type: 'message', message_id: messageId });
        } catch (error) {
          readError = String(error?.message || error);
        }
      }
      const events = data?.stat_data?.事件;
      const button = root?.querySelector('#wa-advance-btn');
      const error = root?.querySelector('#wa-error');
      const rect = root?.getBoundingClientRect();
      return {
        frameName,
        url: location.href,
        messageId,
        hasStatusRoot: Boolean(root),
        statusClass: root?.className ?? null,
        hasMvu: Boolean(mvu),
        mvuReadError: readError,
        hasPersistedData: Boolean(data?.stat_data),
        stateRoots: data?.stat_data ? Object.keys(data.stat_data) : [],
        event: events ? {
          activeId: events.唯一活跃事件?.事件ID ?? null,
          activeState: events.唯一活跃事件?.状态 ?? null,
          omenId: events.近期预兆?.事件ID ?? null,
          e01: events.锚点状态?.E01?.状态 ?? null,
          e02: events.锚点状态?.E02?.状态 ?? null,
          e02Wrap: events.锚点状态?.E02?.收尾 ?? null,
          e03: events.锚点状态?.E03?.状态 ?? null,
        } : null,
        button: button ? {
          text: button.textContent?.trim() ?? '',
          disabled: button.disabled,
          title: button.title,
        } : null,
        visibleError: error && !error.hidden ? error.textContent?.trim() ?? '' : null,
        size: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
        bodyText: root ? root.textContent.replace(/\s+/g, ' ').trim().slice(0, 800) : '',
      };
    }).catch((error) => ({ frameName: frame.name(), evaluateError: String(error?.message || error) }));
    if (snapshot.hasStatusRoot || snapshot.frameName?.includes('TH-message--') || snapshot.evaluateError) {
      frames.push(snapshot);
    }
  }

  const evidence = {
    capturedAt: new Date().toISOString(),
    viewport: { width, height },
    selected,
    host,
    frames,
    listener,
    earlyConsole,
  };
  const jsonPath = resolve(outputDir, `${runLabel}.json`);
  const screenshotPath = resolve(outputDir, `${runLabel}.png`);
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  process.stdout.write(`${JSON.stringify({ jsonPath, screenshotPath, evidence }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
