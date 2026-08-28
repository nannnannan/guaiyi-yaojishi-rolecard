import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:\\Users\\huang\\.codex\\skills\\sillytavern-ai-bridge\\scripts\\runtime\\核心\\tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const avatar = process.env.ST_AVATAR || '《诡异药剂师》v0.5.png';
const evidencePath = resolve(here, '真机证据/runtime-status-acceptance.json');
const debugPath = resolve(here, '真机证据/runtime-status-acceptance-debug.json');
const transactionCheckpointPath = resolve(here, '真机证据/runtime-status-transaction-checkpoint.json');
const mobileScreenshotPath = resolve(here, '真机证据/runtime-status-acceptance-mobile.png');

const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url);
const consoleEntries = [];
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) {
    consoleEntries.push({ at: new Date().toISOString(), type: message.type(), text: message.text().slice(0, 1200) });
  }
});
page.on('pageerror', (error) => {
  consoleEntries.push({ at: new Date().toISOString(), type: 'pageerror', text: String(error?.stack || error).slice(0, 1200) });
});

function stableJson(value) {
  return JSON.stringify(value);
}

function equal(valueA, valueB) {
  return stableJson(valueA) === stableJson(valueB);
}

function omit(object, keys) {
  return Object.fromEntries(Object.entries(object || {}).filter(([key]) => !keys.includes(key)));
}

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  const characterId = await page.evaluate((targetAvatar) => {
    const context = SillyTavern.getContext();
    return context.characters.findIndex((item) => item?.avatar === targetAvatar);
  }, avatar);
  if (characterId < 0) throw new Error(`找不到验收卡头像槽：${avatar}`);
  const currentMatches = await page.evaluate(({ targetId, targetAvatar }) => {
    const context = SillyTavern.getContext();
    return String(context.characterId) === String(targetId)
      && context.characters?.[targetId]?.avatar === targetAvatar
      && context.chatId !== null;
  }, { targetId: characterId, targetAvatar: avatar });
  if (!currentMatches) {
    await page.waitForFunction(
      (targetId) => Boolean(document.querySelector(`#rm_print_characters_block .character_select[data-chid="${targetId}"]`)),
      characterId,
      { timeout: 60000 },
    );
    await page.evaluate((targetId) => {
      document.querySelector(`#rm_print_characters_block .character_select[data-chid="${targetId}"]`).click();
    }, characterId);
  }
  await page.waitForFunction(
    ({ targetId, targetAvatar }) => {
      const context = SillyTavern.getContext();
      return String(context.characterId) === String(targetId)
        && context.characters?.[targetId]?.avatar === targetAvatar
        && context.chatId !== null;
    },
    { targetId: characterId, targetAvatar: avatar },
    { timeout: 60000 },
  );

  await page.waitForFunction(() => {
    return [...document.querySelectorAll('iframe')].some((frame) => {
      try {
        const root = frame.contentDocument?.querySelector('[data-wa-status-root]');
        const mvu = frame.contentWindow?.Mvu;
        const data = mvu?.getMvuData?.({ type: 'message', message_id: 'latest' });
        const button = root?.querySelector('#wa-advance-btn');
        return Boolean(root && data?.stat_data && button && !button.disabled);
      } catch {
        return false;
      }
    });
  }, null, { timeout: 60000 });

  const initial = await page.evaluate(() => {
    const frames = [...document.querySelectorAll('iframe')].filter((frame) => {
      try { return Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]')); } catch { return false; }
    });
    const frame = frames.at(-1);
    if (!frame) throw new Error('未找到状态栏 iframe');
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    const mvu = win.Mvu;
    const data = mvu.getMvuData({ type: 'message', message_id: 'latest' });
    const button = doc.querySelector('#wa-advance-btn');
    return {
      chatId: SillyTavern.getContext().chatId,
      messageCount: SillyTavern.getContext().chat.length,
      frameName: frame.name,
      state: JSON.parse(JSON.stringify(data.stat_data)),
      event: {
        e01: data.stat_data.事件.锚点状态.E01,
        e02: data.stat_data.事件.锚点状态.E02,
        e03: data.stat_data.事件.锚点状态.E03,
        active: data.stat_data.事件.唯一活跃事件,
        omen: data.stat_data.事件.近期预兆,
      },
      button: { text: button.textContent.trim(), disabled: button.disabled, title: button.title },
      visibleError: doc.querySelector('#wa-error:not([hidden])')?.textContent?.trim() || null,
    };
  });

  if (initial.event.e01.状态 !== '完成'
    || initial.event.e02.状态 !== '活跃'
    || initial.event.e02.收尾 !== true
    || initial.event.e03.状态 !== '未触发') {
    throw new Error(`初始事件状态不符合契约：${JSON.stringify(initial.event)}`);
  }

  let statusFrame = null;
  for (const candidate of page.frames()) {
    try {
      if (await candidate.locator('[data-wa-status-root]').count()) statusFrame = candidate;
    } catch {
      // 正在重绘的 iframe 会被忽略。
    }
  }
  if (!statusFrame) throw new Error('点击前状态栏 iframe 丢失');
  await statusFrame.evaluate(() => {
    const mvu = globalThis.Mvu;
    const original = mvu.replaceMvuData;
    globalThis.__waAcceptance = { writes: [], clicks: 0, original };
    document.querySelector('#wa-advance-btn').addEventListener('click', () => {
      globalThis.__waAcceptance.clicks += 1;
    });
    mvu.replaceMvuData = async function patchedReplace(data, options) {
      globalThis.__waAcceptance.writes.push({
        options: JSON.parse(JSON.stringify(options)),
        event: JSON.parse(JSON.stringify(data?.stat_data?.事件 || null)),
      });
      return original.call(this, data, options);
    };
  });
  await statusFrame.locator('#wa-tab-events').click();
  await statusFrame.locator('#wa-advance-btn').click();
  await statusFrame.evaluate(() => document.querySelector('#wa-advance-btn').click());

  try {
    await statusFrame.waitForFunction(() => {
      try {
        const data = globalThis.Mvu?.getMvuData?.({ type: 'message', message_id: 'latest' });
        const button = document.querySelector('#wa-advance-btn');
        return data?.stat_data?.事件?.锚点状态?.E02?.状态 === '完成'
          && data?.stat_data?.事件?.锚点状态?.E03?.状态 === '预兆'
          && button
          && !button.textContent.includes('正在推进');
      } catch {
        return false;
      }
    }, null, { timeout: 30000 });
  } catch (error) {
    const diagnostics = await statusFrame.evaluate(() => {
      const data = globalThis.Mvu?.getMvuData?.({ type: 'message', message_id: 'latest' });
      const button = document.querySelector('#wa-advance-btn');
      return {
        clicks: globalThis.__waAcceptance?.clicks ?? null,
        writes: globalThis.__waAcceptance?.writes ?? null,
        event: data?.stat_data?.事件 ?? null,
        button: button ? { text: button.textContent.trim(), disabled: button.disabled, title: button.title } : null,
        visibleError: document.querySelector('#wa-error:not([hidden])')?.textContent?.trim() || null,
      };
    }).catch((frameError) => ({ frameError: String(frameError?.message || frameError) }));
    await mkdir(dirname(debugPath), { recursive: true });
    await writeFile(debugPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), diagnostics, consoleEntries }, null, 2)}\n`, 'utf8');
    throw new Error(`推进未生效：${JSON.stringify({ diagnostics, debugPath })}`, { cause: error });
  }

  const after = await statusFrame.evaluate(() => {
    const mvu = globalThis.Mvu;
    const data = mvu.getMvuData({ type: 'message', message_id: 'latest' });
    const writes = JSON.parse(JSON.stringify(globalThis.__waAcceptance?.writes || []));
    if (globalThis.__waAcceptance?.original) mvu.replaceMvuData = globalThis.__waAcceptance.original;
    delete globalThis.__waAcceptance;
    const button = document.querySelector('#wa-advance-btn');
    return {
      state: JSON.parse(JSON.stringify(data.stat_data)),
      writes,
      button: { text: button.textContent.trim(), disabled: button.disabled, title: button.title },
      visibleError: document.querySelector('#wa-error:not([hidden])')?.textContent?.trim() || null,
    };
  });

  const unchangedRoots = ['元数据', '世界', '林恩', '关系', '角色关系'];
  const unchangedRootResults = Object.fromEntries(
    unchangedRoots.map((root) => [root, equal(initial.state[root], after.state[root])]),
  );
  const eventOtherFieldsUnchanged = equal(
    omit(initial.state.事件, ['锚点状态', '唯一活跃事件', '近期预兆']),
    omit(after.state.事件, ['锚点状态', '唯一活跃事件', '近期预兆']),
  );
  const systemOtherFieldsUnchanged = equal(
    omit(initial.state.系统, ['事件通知']),
    omit(after.state.系统, ['事件通知']),
  );
  const writeContractPassed = after.writes.length === 1
    && after.writes[0]?.options?.type === 'message'
    && after.writes[0]?.options?.message_id === 'latest';
  if (Object.values(unchangedRootResults).some((passed) => !passed)
    || !eventOtherFieldsUnchanged
    || !systemOtherFieldsUnchanged
    || !writeContractPassed
    || after.visibleError) {
    throw new Error(`推进事务越界：${JSON.stringify({ unchangedRootResults, eventOtherFieldsUnchanged, systemOtherFieldsUnchanged, writes: after.writes })}`);
  }
  await mkdir(dirname(transactionCheckpointPath), { recursive: true });
  await writeFile(transactionCheckpointPath, `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    initial,
    after,
    assertions: { unchangedRootResults, eventOtherFieldsUnchanged, systemOtherFieldsUnchanged, writeContractPassed },
  }, null, 2)}\n`, 'utf8');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.SillyTavern?.getContext && window.TavernHelper), null, { timeout: 60000 });
  await page.waitForFunction(
    (targetAvatar) => SillyTavern.getContext().characters?.some((item) => item?.avatar === targetAvatar),
    avatar,
    { timeout: 60000 },
  );
  const reloadedId = await page.evaluate(
    (targetAvatar) => SillyTavern.getContext().characters.findIndex((item) => item?.avatar === targetAvatar),
    avatar,
  );
  const reloadedMatches = await page.evaluate(({ targetId, targetAvatar }) => {
    const context = SillyTavern.getContext();
    return String(context.characterId) === String(targetId)
      && context.characters?.[targetId]?.avatar === targetAvatar
      && context.chatId !== null;
  }, { targetId: reloadedId, targetAvatar: avatar });
  if (!reloadedMatches) {
    await page.waitForFunction(
      (targetId) => Boolean(document.querySelector(`#rm_print_characters_block .character_select[data-chid="${targetId}"]`)),
      reloadedId,
      { timeout: 60000 },
    );
    await page.evaluate((targetId) => {
      document.querySelector(`#rm_print_characters_block .character_select[data-chid="${targetId}"]`).click();
    }, reloadedId);
  }
  await page.waitForFunction(
    ({ targetId, targetAvatar }) => {
      const context = SillyTavern.getContext();
      return String(context.characterId) === String(targetId)
        && context.characters?.[targetId]?.avatar === targetAvatar
        && context.chatId !== null;
    },
    { targetId: reloadedId, targetAvatar: avatar },
    { timeout: 60000 },
  );
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('iframe')].some((frame) => {
      try {
        const data = frame.contentWindow?.Mvu?.getMvuData?.({ type: 'message', message_id: 'latest' });
        return data?.stat_data?.事件?.锚点状态?.E02?.状态 === '完成'
          && data?.stat_data?.事件?.锚点状态?.E03?.状态 === '预兆';
      } catch {
        return false;
      }
    });
  }, null, { timeout: 60000 });
  const persisted = await page.evaluate(() => {
    const frame = [...document.querySelectorAll('iframe')].find((item) => {
      try { return Boolean(item.contentDocument?.querySelector('[data-wa-status-root]') && item.contentWindow?.Mvu); } catch { return false; }
    });
    const data = frame.contentWindow.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    return {
      avatar: SillyTavern.getContext().characters?.[SillyTavern.getContext().characterId]?.avatar,
      e02: data.stat_data.事件.锚点状态.E02,
      e03: data.stat_data.事件.锚点状态.E03,
      notice: data.stat_data.系统.事件通知,
      buttonText: frame.contentDocument.querySelector('#wa-advance-btn')?.textContent?.trim() || null,
      buttonDisabled: frame.contentDocument.querySelector('#wa-advance-btn')?.disabled ?? null,
    };
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  const mobile = await page.evaluate(() => {
    const frame = [...document.querySelectorAll('iframe')].find((item) => {
      try { return Boolean(item.contentDocument?.querySelector('[data-wa-status-root]')); } catch { return false; }
    });
    const doc = frame.contentDocument;
    const currentTab = doc.querySelector('#wa-tab-current');
    currentTab.focus();
    currentTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const selectedAfterArrow = doc.querySelector('[role="tab"][aria-selected="true"]')?.id || null;
    const root = doc.querySelector('[data-wa-status-root]');
    const rect = root.getBoundingClientRect();
    return {
      frameName: frame.name,
      selectedAfterArrow,
      rootWidth: Math.round(rect.width),
      iframeWidth: Math.round(frame.getBoundingClientRect().width),
      documentClientWidth: doc.documentElement.clientWidth,
      documentScrollWidth: doc.documentElement.scrollWidth,
      noHorizontalOverflow: doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1,
    };
  });
  await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
  if (mobile.selectedAfterArrow !== 'wa-tab-people' || !mobile.noHorizontalOverflow) {
    throw new Error(`窄屏或键盘验收失败：${JSON.stringify(mobile)}`);
  }

  const evidence = {
    acceptedAt: new Date().toISOString(),
    target: { avatar, characterId },
    initial,
    after,
    assertions: {
      unchangedRootResults,
      eventOtherFieldsUnchanged,
      systemOtherFieldsUnchanged,
      writeContractPassed,
      e02Completed: after.state.事件.锚点状态.E02.状态 === '完成',
      e03BecameOmen: after.state.事件.锚点状态.E03.状态 === '预兆',
      buttonDisabledAfterAdvance: after.button.disabled,
    },
    persisted,
    mobile,
    consoleEntries,
  };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ evidencePath, mobileScreenshotPath, summary: evidence.assertions, persisted, mobile }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
