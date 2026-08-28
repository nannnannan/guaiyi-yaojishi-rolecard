import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:\\Users\\huang\\.codex\\skills\\sillytavern-ai-bridge\\scripts\\runtime\\核心\\tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const avatar = process.env.ST_AVATAR || '《诡异药剂师》v0.5.png';
const evidencePath = resolve(here, '真机证据/runtime-status-mobile-visual.json');
const screenshotPath = resolve(here, '真机证据/runtime-status-mobile-panel.png');

const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url);
try {
  await page.setViewportSize({ width: 390, height: 844 });
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
        && context.chat.length >= 1;
    },
    { targetId: characterId, targetAvatar: avatar },
    { timeout: 60000 },
  );
  await page.evaluate(() => {
    const icon = document.querySelector('#rightNavDrawerIcon');
    if (icon?.classList.contains('openIcon')) icon.click();
  });
  await page.waitForTimeout(600);

  const latestAssistantId = await page.evaluate(() => {
    const chat = SillyTavern.getContext().chat;
    for (let index = chat.length - 1; index >= 0; index -= 1) {
      if (!chat[index]?.is_user && !chat[index]?.is_system) return index;
    }
    return -1;
  });
  if (latestAssistantId < 0) throw new Error('当前聊天没有助手楼层');

  const frameName = `TH-message--${latestAssistantId}--0`;
  await page.waitForFunction(
    (targetName) => [...document.querySelectorAll('iframe')].some((frame) => {
      try {
        return frame.name === targetName
          && Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]'))
          && Boolean(frame.contentWindow?.Mvu);
      } catch { return false; }
    }),
    frameName,
    { timeout: 60000 },
  );

  const statusFrame = page.frames().find((frame) => frame.name() === frameName);
  if (!statusFrame) throw new Error(`找不到状态栏 iframe：${frameName}`);
  const root = statusFrame.locator('[data-wa-status-root]');
  await root.waitFor({ state: 'visible', timeout: 30000 });
  const iframeElement = page.locator(`iframe[name="${frameName}"]`);
  await iframeElement.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(6000);
  const metrics = await root.evaluate((element) => {
    const button = element.querySelector('#wa-advance-btn');
    const latestData = window.Mvu?.getMvuData?.({ type: 'message', message_id: 'latest' });
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowFree: element.scrollWidth <= element.clientWidth,
      activeTab: element.querySelector('[role="tab"][aria-selected="true"]')?.id || null,
      button: button ? { text: button.textContent.trim(), disabled: button.disabled } : null,
      hasMvu: Boolean(window.Mvu),
      hasStatData: Boolean(latestData?.stat_data),
      errorText: element.querySelector('#wa-error:not([hidden])')?.textContent?.trim() || null,
    };
  });
  await mkdir(dirname(screenshotPath), { recursive: true });
  await iframeElement.screenshot({ path: screenshotPath });
  const evidence = {
    capturedAt: new Date().toISOString(),
    viewport: { width: 390, height: 844 },
    avatar,
    latestAssistantId,
    frameName,
    metrics,
    assertions: {
      narrowWidth: metrics.clientWidth <= 390,
      noHorizontalOverflow: metrics.overflowFree,
      mvuReady: metrics.hasMvu,
      persistedDataReady: metrics.hasStatData,
      noVisibleError: metrics.errorText === null,
    },
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  if (Object.values(evidence.assertions).some((value) => value !== true)) {
    throw new Error(`窄屏状态栏验收失败：${JSON.stringify(evidence)}`);
  }
  process.stdout.write(`${JSON.stringify({ evidencePath, screenshotPath, evidence }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
