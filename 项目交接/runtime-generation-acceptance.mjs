import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:\\Users\\huang\\.codex\\skills\\sillytavern-ai-bridge\\scripts\\runtime\\核心\\tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const avatar = process.env.ST_AVATAR || '《诡异药剂师》v0.5.png';
const prompt = process.env.ST_TEST_PROMPT
  || '林恩留在柜台后，先观察门外的动静，不主动离店，也不要替他做额外决定。请继续场景，并按卡内协议更新变量。';
const evidencePath = resolve(here, '真机证据/runtime-generation-acceptance.json');
const screenshotPath = resolve(here, '真机证据/runtime-generation-acceptance.png');

const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url);
const consoleEntries = [];
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) {
    consoleEntries.push({ at: new Date().toISOString(), type: message.type(), text: message.text().slice(0, 1600) });
  }
});
page.on('pageerror', (error) => {
  consoleEntries.push({ at: new Date().toISOString(), type: 'pageerror', text: String(error?.stack || error).slice(0, 1600) });
});

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  const characterId = await page.evaluate((targetAvatar) => {
    return SillyTavern.getContext().characters.findIndex((item) => item?.avatar === targetAvatar);
  }, avatar);
  if (characterId < 0) throw new Error(`找不到验收卡：${avatar}`);
  await page.evaluate((targetId) => {
    document.querySelector(`#rm_print_characters_block .character_select[data-chid="${targetId}"]`)?.click();
  }, characterId);
  await page.waitForFunction(
    ({ targetId, targetAvatar }) => {
      const context = SillyTavern.getContext();
      return String(context.characterId) === String(targetId)
        && context.characters?.[targetId]?.avatar === targetAvatar
        && context.chatId !== null
        && context.chat.length >= 1;
    },
    { targetId: characterId, targetAvatar: avatar },
    { timeout: 60000 },
  );
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('iframe')].some((frame) => {
      try { return Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]') && frame.contentWindow?.Mvu); } catch { return false; }
    });
  }, null, { timeout: 60000 });

  const before = await page.evaluate(() => {
    const context = SillyTavern.getContext();
    const latest = context.chat.at(-1);
    const data = latest?.variables?.[latest.swipe_id ?? 0];
    return {
      chatId: context.chatId,
      messageCount: context.chat.length,
      event: data?.stat_data?.事件 ?? null,
      rawLatestHasStatusPlaceholder: String(latest?.mes || '').includes('<StatusPlaceHolderImpl'),
    };
  });

  const observed = [];
  let stopListener;
  const stopSignal = new Promise((resolveStop) => { stopListener = resolveStop; });
  const listenPromise = session.listen(page, {
    timeoutMs: 245000,
    stopSignal,
    onEntry: (entry) => observed.push(entry),
  });
  let send;
  try {
    send = await session.sendAndWait(page, prompt, { wait: true, timeoutMs: 240000 });
  } finally {
    stopListener();
  }
  const listener = await listenPromise;
  await page.waitForTimeout(3000);

  await page.waitForFunction(() => {
    const context = SillyTavern.getContext();
    const assistantIds = context.chat
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => !message?.is_user && !message?.is_system)
      .map(({ index }) => index);
    const frames = [...document.querySelectorAll('iframe')].filter((frame) => {
      try { return Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]')); } catch { return false; }
    });
    const frameIds = frames.map((frame) => Number(String(frame.name).match(/^TH-message--(\d+)--/)?.[1]));
    return assistantIds.length >= 2
      && assistantIds.every((id) => frameIds.includes(id))
      && frames.every((frame) => Boolean(frame.contentWindow?.Mvu));
  }, null, { timeout: 60000 });

  const after = await page.evaluate(async () => {
    const context = SillyTavern.getContext();
    const messages = context.chat.map((message, index) => ({
      index,
      role: message?.is_user ? 'user' : message?.is_system ? 'system' : 'assistant',
      length: String(message?.mes || '').length,
      preview: String(message?.mes || '').slice(0, 260),
      hasStatusPlaceholder: String(message?.mes || '').includes('<StatusPlaceHolderImpl'),
      hasUpdateVariable: String(message?.mes || '').includes('<UpdateVariable>'),
      hasVariables: Boolean(message?.variables?.[message?.swipe_id ?? 0]?.stat_data),
    }));
    const statusFrames = [...document.querySelectorAll('iframe')]
      .map((frame) => {
        try {
          const root = frame.contentDocument?.querySelector('[data-wa-status-root]');
          const id = Number(String(frame.name).match(/^TH-message--(\d+)--/)?.[1]);
          if (!root || !Number.isInteger(id)) return null;
          const mvu = frame.contentWindow?.Mvu;
          const data = mvu?.getMvuData?.({ type: 'message', message_id: id });
          const button = root.querySelector('#wa-advance-btn');
          return {
            frameName: frame.name,
            messageId: id,
            event: data?.stat_data?.事件 ? {
              e02: data.stat_data.事件.锚点状态?.E02?.状态,
              e03: data.stat_data.事件.锚点状态?.E03?.状态,
              activeId: data.stat_data.事件.唯一活跃事件?.事件ID,
              omenId: data.stat_data.事件.近期预兆?.事件ID,
            } : null,
            button: button ? { text: button.textContent.trim(), disabled: button.disabled, title: button.title } : null,
            error: root.querySelector('#wa-error:not([hidden])')?.textContent?.trim() || null,
          };
        } catch (error) {
          return { frameName: frame.name, error: String(error?.message || error) };
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.messageId - b.messageId);
    const oldFrame = [...document.querySelectorAll('iframe')].find((frame) => frame.name.startsWith('TH-message--0--'));
    const latestFrame = [...document.querySelectorAll('iframe')]
      .filter((frame) => {
        try { return Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]')); } catch { return false; }
      })
      .sort((a, b) => Number(a.name.match(/^TH-message--(\d+)--/)?.[1]) - Number(b.name.match(/^TH-message--(\d+)--/)?.[1]))
      .at(-1);
    const latestMvu = latestFrame.contentWindow.Mvu;
    const beforeOldClick = JSON.stringify(latestMvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data);
    const oldButton = oldFrame.contentDocument.querySelector('#wa-advance-btn');
    const oldButtonBefore = { text: oldButton.textContent.trim(), disabled: oldButton.disabled, title: oldButton.title };
    oldButton.disabled = false;
    oldButton.click();
    await new Promise((resolve) => setTimeout(resolve, 800));
    const afterOldClick = JSON.stringify(latestMvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data);
    return {
      chatId: context.chatId,
      messageCount: context.chat.length,
      messages,
      statusFrames,
      oldFloorGuard: {
        oldButtonBefore,
        latestUnchangedAfterForcedOldClick: beforeOldClick === afterOldClick,
      },
    };
  });

  await page.evaluate(() => document.querySelector('#chat')?.lastElementChild?.scrollIntoView({ block: 'end' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const fatalPatterns = /Identifier .*already been declared|__ids.*declared|getvar is not defined|detailWindow is not defined|EJS.*(?:error|failed)|脚本.*加载失败/i;
  const listenerText = listener.entries.map((entry) => JSON.stringify(entry)).join('\n');
  const consoleText = consoleEntries.map((entry) => entry.text).join('\n');
  const fatalRuntimeErrors = [listenerText, consoleText]
    .flatMap((text) => text.split('\n'))
    .filter((line) => fatalPatterns.test(line));
  const assistantMessages = after.messages.filter((message) => message.role === 'assistant');
  const latestAssistant = assistantMessages.at(-1);
  const assertions = {
    generationEnded: send.generation?.ended === true,
    createdUserAndAssistant: send.newMessages >= 2 && after.messageCount >= before.messageCount + 2,
    latestAssistantHasStatusPlaceholder: latestAssistant?.hasStatusPlaceholder === true,
    latestAssistantHasVariables: latestAssistant?.hasVariables === true,
    openingBecameHistoricalReadOnly: after.oldFloorGuard.oldButtonBefore.disabled === true
      && after.oldFloorGuard.oldButtonBefore.text.includes('历史楼层只读'),
    forcedOldFloorClickDidNotChangeLatest: after.oldFloorGuard.latestUnchangedAfterForcedOldClick,
    noFatalEjsRuntimeErrors: fatalRuntimeErrors.length === 0,
  };
  const evidence = {
    acceptedAt: new Date().toISOString(),
    target: { avatar, characterId },
    prompt,
    before,
    send,
    after,
    assertions,
    fatalRuntimeErrors,
    listener,
    consoleEntries,
  };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  if (Object.values(assertions).some((passed) => !passed)) {
    throw new Error(`真机生成验收失败：${JSON.stringify({ assertions, evidencePath })}`);
  }
  process.stdout.write(`${JSON.stringify({ evidencePath, screenshotPath, assertions, send, frames: after.statusFrames }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
