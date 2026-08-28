import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(here, '..');
const artifactPath = resolve(
  process.env.CARD_ARTIFACT
    || `${workspace}/角色卡本体/诡异药剂师_MVU_v0.5/dist/诡异药剂师_v0.5.json`,
);
const evidenceDir = resolve(
  process.env.ST_EVIDENCE_DIR
    || `${here}/真机证据/concept-dual-route-2026-08-09`,
);
const evidencePath = resolve(evidenceDir, 'runtime-concept-dual-route-acceptance.json');
const cleanupEvidencePath = resolve(evidenceDir, 'runtime-concept-dual-route-cleanup.json');
const tempCardPath = resolve(evidenceDir, '诡异药剂师_v0.5_概念双路验收_临时卡.json');
const tempName = process.env.ST_TEST_CARD_NAME
  || '《诡异药剂师》v0.5-概念双路验收-20260809-A';
const tempWorldbookPath = resolve(evidenceDir, `${tempName}.json`);
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:/Users/huang/.codex/skills/sillytavern-ai-bridge/scripts/runtime/核心/tavern-session.mjs';
const promptCapturePath = process.env.ST_PROMPT_CAPTURE_MODULE
  || 'C:/Users/huang/.codex/skills/sillytavern-ai-bridge/scripts/runtime/提示词监听/prompt-capture.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const command = process.argv[2] || 'run';
const extraCleanupWorldbooks = process.env.ST_EXTRA_WORLDBOOKS
  ? JSON.parse(process.env.ST_EXTRA_WORLDBOOKS)
  : [];

const targetTitle = '人皮拾荒者';
const targetAlias = '拾荒者';
const targetBodyMarker = '游魂巷最神秘的以物易物者，身份来历不明，立场友善但帮忙有限。';
const fatalRuntimePattern = /Identifier .*already been declared|already been declared|activewi is not defined|getEnabledWorldInfoEntries is not defined|EJS.*(?:error|failed)|world.?info.*(?:error|failed)|世界书.*(?:异常|失败)|预处理.*(?:异常|失败)/i;

const clone = (value) => structuredClone(value);
const countText = (text, needle) => {
  let count = 0;
  let from = 0;
  while (needle && (from = String(text).indexOf(needle, from)) >= 0) {
    count += 1;
    from += needle.length;
  }
  return count;
};

async function prepareTempCard() {
  const artifactText = await readFile(artifactPath, 'utf8');
  const card = JSON.parse(artifactText);
  card.name = tempName;
  card.data.name = tempName;
  for (const extensions of [card.extensions, card.data.extensions]) {
    if (!extensions) continue;
    extensions.world = tempName;
    extensions.mvu_worldbook_name = tempName;
  }
  if (!card.data.character_book) throw new Error('最终产物缺少内嵌世界书');
  card.data.character_book.name = tempName;
  await mkdir(evidenceDir, { recursive: true });
  const tempText = `${JSON.stringify(card, null, 2)}\n`;
  const tempWorldbookText = `${JSON.stringify(card.data.character_book, null, 2)}\n`;
  await writeFile(tempCardPath, tempText, 'utf8');
  await writeFile(tempWorldbookPath, tempWorldbookText, 'utf8');
  const prepared = {
    preparedAt: new Date().toISOString(),
    tempName,
    tempCardPath,
    tempWorldbookPath,
    sourceArtifact: artifactPath,
    sourceBytes: Buffer.byteLength(artifactText),
    sourceSha256: createHash('sha256').update(artifactText).digest('hex'),
    tempBytes: Buffer.byteLength(tempText),
    tempSha256: createHash('sha256').update(tempText).digest('hex'),
    tempWorldbookBytes: Buffer.byteLength(tempWorldbookText),
    tempWorldbookSha256: createHash('sha256').update(tempWorldbookText).digest('hex'),
    worldbookEntries: card.data.character_book.entries?.length ?? 0,
  };
  await writeFile(resolve(evidenceDir, 'runtime-concept-dual-route-prepared.json'), `${JSON.stringify(prepared, null, 2)}\n`, 'utf8');
  return prepared;
}

async function inspectLiveAssets(page) {
  return page.evaluate(async (name) => {
    const context = SillyTavern.getContext();
    const characterNames = await TavernHelper.getCharacterNames();
    const characters = context.characters
      .filter((item) => item?.name === name)
      .map((item) => ({ name: item.name, avatar: item.avatar, boundWorldbook: item.data?.extensions?.world ?? null }));
    if (characters.length === 0 && characterNames.includes(name)) {
      characters.push({ name, avatar: null, boundWorldbook: null });
    }
    const worldbooks = await TavernHelper.getWorldbookNames();
    return {
      matchingCharacters: characters,
      worldbookPresent: worldbooks.includes(name),
      worldbookMatches: worldbooks.filter((item) => item === name).length,
    };
  }, tempName);
}

async function cleanupLiveAssets(page, session, reason) {
  const before = await inspectLiveAssets(page);
  let characterDelete = null;
  let worldbookDelete = null;
  if (before.matchingCharacters.length > 0) {
    characterDelete = await session.deleteCharacterCard(page, tempName);
  }
  const afterCharacter = await inspectLiveAssets(page);
  if (afterCharacter.worldbookPresent) {
    worldbookDelete = await page.evaluate(async (name) => {
      try {
        const result = await TavernHelper.deleteWorldbook(name);
        return { ok: true, result };
      } catch (error) {
        return { ok: false, error: String(error?.stack || error) };
      }
    }, tempName);
  }
  const extraWorldbookDeletes = [];
  for (const extraName of extraCleanupWorldbooks) {
    const result = await page.evaluate(async (name) => {
      const names = await TavernHelper.getWorldbookNames();
      if (!names.includes(name)) return { name, presentBefore: false, deleted: false };
      await TavernHelper.deleteWorldbook(name);
      const afterNames = await TavernHelper.getWorldbookNames();
      return { name, presentBefore: true, deleted: !afterNames.includes(name) };
    }, extraName);
    extraWorldbookDeletes.push(result);
  }
  const after = await inspectLiveAssets(page);
  let localTempDeleted = false;
  let localTempWorldbookDeleted = false;
  try {
    await unlink(tempCardPath);
    localTempDeleted = true;
  } catch (error) {
    if (error?.code === 'ENOENT') localTempDeleted = true;
    else throw error;
  }
  try {
    await unlink(tempWorldbookPath);
    localTempWorldbookDeleted = true;
  } catch (error) {
    if (error?.code === 'ENOENT') localTempWorldbookDeleted = true;
    else throw error;
  }
  const evidence = {
    cleanedAt: new Date().toISOString(),
    reason,
    target: { card: tempName, worldbook: tempName, localTempArtifacts: [tempCardPath, tempWorldbookPath] },
    before,
    characterDelete,
    afterCharacter,
    worldbookDelete,
    extraWorldbookDeletes,
    after,
    localTempDeleted,
    localTempWorldbookDeleted,
    assertions: {
      cardAbsent: after.matchingCharacters.length === 0,
      worldbookAbsent: !after.worldbookPresent,
      exactWorldbookMultiplicityZero: after.worldbookMatches === 0,
      localTempArtifactAbsent: localTempDeleted,
      localTempWorldbookArtifactAbsent: localTempWorldbookDeleted,
    },
  };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(cleanupEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidence;
}

async function waitForMvuState(page) {
  await page.waitForFunction(() => {
    const context = SillyTavern.getContext();
    const latest = context.chat?.at(-1);
    const swipeId = latest?.swipe_id ?? 0;
    return Boolean(latest?.variables?.[swipeId]?.stat_data?.事件);
  }, null, { timeout: 60000 });
}

async function createIsolatedChat(page) {
  const before = await page.evaluate(() => ({
    chatId: SillyTavern.getContext().chatId,
    messageCount: SillyTavern.getContext().chat.length,
  }));
  await page.evaluate(async () => {
    const { doNewChat } = await import('/script.js');
    await doNewChat({ deleteCurrentChat: false });
  });
  await page.waitForFunction(
    (oldChatId) => {
      const context = SillyTavern.getContext();
      return context.chatId && context.chatId !== oldChatId && context.chat.length === 1;
    },
    before.chatId,
    { timeout: 60000 },
  );
  await waitForMvuState(page);
  return page.evaluate(() => ({
    chatId: SillyTavern.getContext().chatId,
    messageCount: SillyTavern.getContext().chat.length,
  }));
}

async function setCurrentEvent(page, eventId) {
  return page.evaluate(async (targetEventId) => {
    const context = SillyTavern.getContext();
    const messageId = context.chat.length - 1;
    const latest = context.chat[messageId];
    const swipeId = latest?.swipe_id ?? 0;
    const data = structuredClone(latest?.variables?.[swipeId] ?? {});
    const event = data?.stat_data?.事件;
    if (!event?.锚点状态?.[targetEventId]) throw new Error(`缺少 ${targetEventId} 事件状态`);
    for (const [id, anchor] of Object.entries(event.锚点状态)) {
      anchor.状态 = id === targetEventId ? '活跃' : (id === 'E01' && targetEventId === 'E02' ? '完成' : '未触发');
      anchor.收尾 = id === targetEventId && id === 'E02';
    }
    const target = event.锚点状态[targetEventId];
    const active = structuredClone(event.唯一活跃事件 || {});
    active.事件ID = targetEventId;
    active.标题 = target.标题;
    active.状态 = '活跃';
    active.进展 = `真机验收临时状态：${targetEventId}`;
    event.唯一活跃事件 = active;
    if (event.近期预兆) {
      event.近期预兆.事件ID = '';
      event.近期预兆.方向 = '暂无';
    }
    event.最近结果 = [];
    const neutralOpening = '【双路验收中性开局】柜台后的灯光保持稳定，室内暂时没有新的专名或线索。';
    await TavernHelper.setChatMessages([{ message_id: messageId, message: neutralOpening, data }], { refresh: 'affected' });
    await context.saveChat();
    const readback = context.chat[messageId]?.variables?.[swipeId]?.stat_data?.事件;
    return {
      messageId,
      chatId: context.chatId,
      activeId: readback?.唯一活跃事件?.事件ID ?? null,
      targetStatus: readback?.锚点状态?.[targetEventId]?.状态 ?? null,
      opening: String(context.chat[messageId]?.mes ?? ''),
    };
  }, eventId);
}

async function addAssistantKeyword(page, session) {
  const text = `【双路验收前置助手楼】${targetAlias}曾在这里留下痕迹。`;
  const slash = `/sendas name="${tempName.replaceAll('"', '\\"')}" ${text}`;
  const before = await page.evaluate(() => SillyTavern.getContext().chat.length);
  const result = await session.execSlash(page, slash);
  await page.waitForFunction((oldCount) => SillyTavern.getContext().chat.length === oldCount + 1, before, { timeout: 30000 });
  const readback = await page.evaluate(() => {
    const message = SillyTavern.getContext().chat.at(-1);
    return {
      role: message?.is_user ? 'user' : message?.is_system ? 'system' : 'assistant',
      text: String(message?.mes ?? ''),
    };
  });
  return { slashResult: result, readback };
}

async function runMatrix(page, session, promptCapture) {
  const definitions = [
    {
      id: 'event_only',
      eventId: 'E02',
      input: '【双路验收】请继续描写柜台边一分钟内的光影变化，不引入新人物或新物品。',
      addAssistantKeyword: false,
      expectedMarkerCount: 1,
    },
    {
      id: 'user_keyword_only',
      eventId: 'E20',
      input: `【双路验收】林恩想起${targetAlias}，但不采取额外行动。`,
      addAssistantKeyword: false,
      expectedMarkerCount: 1,
    },
    {
      id: 'assistant_keyword_only',
      eventId: 'E20',
      input: '【双路验收】请继续描写柜台边一分钟内的光影变化，不引入新人物或新物品。',
      addAssistantKeyword: true,
      expectedMarkerCount: 1,
    },
    {
      id: 'neither_route',
      eventId: 'E20',
      input: '【双路验收】请继续描写柜台边一分钟内的光影变化，不引入新人物或新物品。',
      addAssistantKeyword: false,
      expectedMarkerCount: 0,
    },
    {
      id: 'both_routes_once',
      eventId: 'E02',
      input: `【双路验收】请描写${targetTitle}的传闻，但不推进事件。`,
      addAssistantKeyword: false,
      expectedMarkerCount: 1,
    },
  ];
  const results = [];
  for (const definition of definitions) {
    const chat = await createIsolatedChat(page);
    const event = await setCurrentEvent(page, definition.eventId);
    const assistantKeyword = definition.addAssistantKeyword
      ? await addAssistantKeyword(page, session)
      : null;
    await promptCapture.clearPromptCapture(page);
    await promptCapture.installPromptCapture(page);
    const send = await session.sendAndWait(page, definition.input, { wait: true, timeoutMs: 240000 });
    await page.waitForTimeout(2500);
    const turn = await promptCapture.takePromptCapture(page, {
      char: tempName,
      chatId: chat.chatId,
      input: definition.input,
    });
    if (!turn) throw new Error(`${definition.id} 未捕获到真实请求载荷`);
    const captureDir = resolve(evidenceDir, 'request-captures');
    const captureFiles = promptCapture.writeCaptureFiles(turn, captureDir);
    const promptText = turn.messages.map((message) => message.content).join('\n');
    const markerCount = countText(promptText, targetBodyMarker);
    const assistantKeywordPromptMarker = '【双路验收前置助手楼】';
    const chatSummary = await page.evaluate(() => {
      const context = SillyTavern.getContext();
      const latest = context.chat.at(-1);
      const swipeId = latest?.swipe_id ?? 0;
      return {
        chatId: context.chatId,
        messageCount: context.chat.length,
        latestRole: latest?.is_user ? 'user' : latest?.is_system ? 'system' : 'assistant',
        latestHasMvu: Boolean(latest?.variables?.[swipeId]?.stat_data),
        latestHasStatusPlaceholder: String(latest?.mes ?? '').includes('<StatusPlaceHolderImpl'),
      };
    });
    results.push({
      id: definition.id,
      event,
      inputRole: 'user',
      assistantKeyword,
      expectedMarkerCount: definition.expectedMarkerCount,
      actualMarkerCount: markerCount,
      markerInjected: markerCount > 0,
      generationEnded: send.generation?.ended === true,
      newMessages: send.newMessages,
      request: {
        captureFile: captureFiles.file,
        model: turn.request?.model ?? '',
        status: turn.request?.status ?? null,
        messageRoles: turn.messages.map((message) => message.role),
        promptChars: turn.promptChars,
        targetTitleOccurrences: countText(promptText, targetTitle),
        targetAliasOccurrences: countText(promptText, targetAlias),
        targetBodyMarkerOccurrences: markerCount,
      },
      chat: chatSummary,
      assertions: {
        eventStateReadback: event.activeId === definition.eventId && event.targetStatus === '活跃',
        neutralOpeningContainsNoTargetKey: !event.opening.includes(targetTitle) && !event.opening.includes(targetAlias),
        assistantKeywordRoleIsAssistant: !definition.addAssistantKeyword
          || (assistantKeyword?.readback?.role === 'assistant' && assistantKeyword.readback.text.includes(targetAlias)),
        assistantKeywordReachedRequest: !definition.addAssistantKeyword || promptText.includes(assistantKeywordPromptMarker),
        requestCaptured: turn.messages.length > 0 && turn.request?.status === 200,
        markerCountMatches: markerCount === definition.expectedMarkerCount,
        generationEnded: send.generation?.ended === true,
        assistantGenerated: send.newMessages >= 2 && chatSummary.latestRole === 'assistant',
        mvuPersistedOnLatest: chatSummary.latestHasMvu,
        statusPlaceholderPresent: chatSummary.latestHasStatusPlaceholder,
      },
    });
  }
  return results;
}

async function inspectWorldbookContract(page) {
  return page.evaluate(async ({ name, title }) => {
    const context = SillyTavern.getContext();
    const characterMatches = context.characters.filter((item) => item?.name === name);
    const character = characterMatches[0];
    const entries = await TavernHelper.getLorebookEntries(name);
    const { loadWorldInfo } = await import('/scripts/world-info.js');
    const rawWorldbook = await loadWorldInfo(name);
    const rawEntries = Object.values(rawWorldbook?.entries || {}).filter(
      (entry) => entry && typeof entry === 'object' && ('content' in entry),
    );
    const byUid = new Map(entries.map((entry) => [Number(entry.uid ?? entry.id), entry]));
    const rawByUid = new Map(rawEntries.map((entry) => [Number(entry.uid ?? entry.id), entry]));
    const router = byUid.get(399);
    const concepts = Array.from({ length: 52 }, (_, index) => byUid.get(400 + index)).filter(Boolean);
    const target = concepts.find((entry) => String(entry.comment ?? entry.name ?? '').includes(title));
    const rawTarget = target ? rawByUid.get(Number(target.uid)) : null;
    const keysOf = (entry) => Array.isArray(entry?.keys) ? entry.keys : Array.isArray(entry?.key) ? entry.key : [];
    return {
      characterMatches: characterMatches.length,
      avatar: character?.avatar ?? null,
      boundWorldbook: character?.data?.extensions?.world ?? null,
      entryCount: entries.length,
      router: router ? {
        type: router.type,
        keys: keysOf(router),
        startsWithPreprocessing: String(router.content ?? '').startsWith('@@preprocessing'),
        containsActivewi: String(router.content ?? '').includes('activewi(entry.world, entry.uid, true)'),
      } : null,
      concepts: {
        count: concepts.length,
        selectiveCount: concepts.filter((entry) => entry.type === 'selective' && keysOf(entry).length > 0).length,
        eventMetadataCount: concepts.filter((entry) => {
          const rawEntry = rawByUid.get(Number(entry.uid));
          return Array.isArray(rawEntry?.extensions?.tavernweave?.event_ids)
            && rawEntry.extensions.tavernweave.event_ids.length > 0;
        }).length,
        noSecondaryKeysCount: concepts.filter((entry) => Array.isArray(entry.filters) && entry.filters.length === 0).length,
        recursionGuardCount: concepts.filter((entry) => entry.exclude_recursion === true && entry.prevent_recursion === true).length,
      },
      target: target ? {
        uid: Number(target.uid ?? target.id),
        type: target.type,
        keys: keysOf(target),
        eventIds: rawTarget?.extensions?.tavernweave?.event_ids ?? null,
        scanDepth: target.scan_depth,
        caseSensitive: target.case_sensitive,
      } : null,
    };
  }, { name: tempName, title: targetTitle });
}

async function verifyReloadPersistence(page, session) {
  const before = await page.evaluate(() => {
    const context = SillyTavern.getContext();
    const latest = context.chat.at(-1);
    const swipeId = latest?.swipe_id ?? 0;
    return {
      chatId: context.chatId,
      messageCount: context.chat.length,
      latestHasMvu: Boolean(latest?.variables?.[swipeId]?.stat_data),
    };
  });
  const verificationPagePromise = page.context().waitForEvent('page', { timeout: 60000 });
  await page.evaluate((targetUrl) => window.open(targetUrl, '_blank'), url);
  const verificationPage = await verificationPagePromise;
  let after;
  try {
    await verificationPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await verificationPage.waitForFunction(
      async (name) => {
        if (!window.SillyTavern || !window.TavernHelper) return false;
        const names = await TavernHelper.getCharacterNames();
        return names.includes(name);
      },
      tempName,
      { timeout: 90000 },
    );
    await verificationPage.evaluate(async ({ name, chatId }) => {
      const { getCharacters, selectCharacterById, openCharacterChat } = await import('/script.js');
      const worldInfo = await import('/scripts/world-info.js');
      for (let attempt = 0; attempt < 100 && !Array.isArray(worldInfo.world_names); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!Array.isArray(worldInfo.world_names)) throw new Error('新页面世界书列表尚未初始化');
      await getCharacters();
      let characterId = -1;
      for (let attempt = 0; attempt < 50; attempt++) {
        characterId = SillyTavern.getContext().characters.findIndex((item) => item?.name === name);
        if (characterId >= 0) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (characterId < 0) throw new Error(`新页面找不到角色：${name}`);
      await selectCharacterById(characterId, { switchMenu: false });
      await openCharacterChat(chatId);
    }, { name: tempName, chatId: before.chatId });
    await verificationPage.waitForFunction(
      ({ chatId, messageCount }) => {
        const context = SillyTavern.getContext();
        return context.chatId === chatId && context.chat.length === messageCount;
      },
      before,
      { timeout: 60000 },
    );
    await waitForMvuState(verificationPage);
    after = await verificationPage.evaluate(() => {
      const context = SillyTavern.getContext();
      const latest = context.chat.at(-1);
      const swipeId = latest?.swipe_id ?? 0;
      const statusFrames = [...document.querySelectorAll('iframe')].filter((frame) => {
        try { return Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]')); } catch { return false; }
      });
      return {
        chatId: context.chatId,
        messageCount: context.chat.length,
        latestHasMvu: Boolean(latest?.variables?.[swipeId]?.stat_data),
        statusFrameCount: statusFrames.length,
      };
    });
  } finally {
    await verificationPage.close().catch(() => {});
  }
  return {
    before,
    after,
    assertions: {
      sameChat: after.chatId === before.chatId,
      messageCountPersisted: after.messageCount === before.messageCount,
      mvuPersisted: before.latestHasMvu && after.latestHasMvu,
    },
  };
}

async function loadCapturedMatrix() {
  const captureDir = resolve(evidenceDir, 'request-captures');
  const files = (await readdir(captureDir))
    .filter((name) => name.endsWith('.json') && name !== 'prompt-scope-viewer.json')
    .sort();
  if (files.length !== 5) throw new Error(`正式矩阵捕获应为 5 份，实际为 ${files.length}`);
  const definitions = [
    { id: 'event_only', eventId: 'E02', expectedMarkerCount: 1 },
    { id: 'user_keyword_only', eventId: 'E20', expectedMarkerCount: 1 },
    { id: 'assistant_keyword_only', eventId: 'E20', expectedMarkerCount: 1 },
    { id: 'neither_route', eventId: 'E20', expectedMarkerCount: 0 },
    { id: 'both_routes_once', eventId: 'E02', expectedMarkerCount: 1 },
  ];
  const matrix = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const definition = definitions[index];
    const capture = JSON.parse(await readFile(resolve(captureDir, file), 'utf8'));
    const turn = capture.turn;
    const promptText = turn.messages.map((message) => message.content).join('\n');
    const markerCount = countText(promptText, targetBodyMarker);
    matrix.push({
      ...definition,
      captureFile: resolve(captureDir, file),
      input: turn.input,
      requestStatus: turn.request?.status ?? null,
      replyChars: turn.replyChars,
      promptChars: turn.promptChars,
      messageRoles: turn.messages.map((message) => message.role),
      actualMarkerCount: markerCount,
      eventStateVisible: promptText.includes(`真机验收临时状态：${definition.eventId}`),
      assistantKeywordHistoryVisible: promptText.includes('【双路验收前置助手楼】'),
      assertions: {
        requestSucceeded: turn.request?.status === 200,
        responseCaptured: turn.replyChars > 0,
        markerCountMatches: markerCount === definition.expectedMarkerCount,
        eventStateVisible: promptText.includes(`真机验收临时状态：${definition.eventId}`),
        assistantKeywordHistoryCorrect: definition.id === 'assistant_keyword_only'
          ? promptText.includes('【双路验收前置助手楼】')
          : !promptText.includes('【双路验收前置助手楼】'),
      },
    });
  }
  return matrix;
}

async function runResumeAcceptance() {
  const matrix = await loadCapturedMatrix();
  const session = await import(pathToFileURL(bridgeSessionPath).href);
  const promptCapture = await import(pathToFileURL(promptCapturePath).href);
  const { browser, page } = await session.connect(url);
  const consoleEntries = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleEntries.push({ at: new Date().toISOString(), type: message.type(), text: message.text().slice(0, 2000) });
    }
  });
  page.on('pageerror', (error) => {
    consoleEntries.push({ at: new Date().toISOString(), type: 'pageerror', text: String(error?.stack || error).slice(0, 2000) });
  });
  let primaryError = null;
  try {
    const liveAssets = await inspectLiveAssets(page);
    if (liveAssets.matchingCharacters.length !== 1 || !liveAssets.worldbookPresent) {
      throw new Error(`临时卡或绑定世界书未正确导入：${JSON.stringify(liveAssets)}`);
    }
    await session.switchCharacter(page, tempName, false);
    const status = await session.getStatus(page);
    const worldbook = await inspectWorldbookContract(page);

    const regressionChat = await createIsolatedChat(page);
    const regressionEvent = await setCurrentEvent(page, 'E02');
    await promptCapture.clearPromptCapture(page);
    await promptCapture.installPromptCapture(page);
    const regressionInput = '【双路最终回归】继续描写柜台边的灯光变化，不引入新专名。';
    const regressionSend = await session.sendAndWait(page, regressionInput, { wait: true, timeoutMs: 240000 });
    await page.waitForTimeout(2500);
    const regressionTurn = await promptCapture.takePromptCapture(page, {
      char: tempName,
      chatId: regressionChat.chatId,
      input: regressionInput,
    });
    if (!regressionTurn) throw new Error('最终回归未捕获到请求载荷');
    const regressionCapture = promptCapture.writeCaptureFiles(
      regressionTurn,
      resolve(evidenceDir, 'regression-request-capture'),
    );
    const regressionPromptText = regressionTurn.messages.map((message) => message.content).join('\n');
    const regressionMarkerCount = countText(regressionPromptText, targetBodyMarker);
    await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((frame) => {
      try { return Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]')); } catch { return false; }
    }), null, { timeout: 60000 });
    const regressionStatusFrameCount = await page.evaluate(() => [...document.querySelectorAll('iframe')].filter((frame) => {
      try { return Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]')); } catch { return false; }
    }).length);
    const reload = await verifyReloadPersistence(page, session);
    const fatalRuntimeErrors = consoleEntries.filter((entry) => fatalRuntimePattern.test(entry.text));
    const assertions = {
      runtimeVersions: status.tavernVersion === '1.17.0' && status.helperVersion === '4.9.1',
      uniqueTemporaryCard: worldbook.characterMatches === 1,
      boundWorldbookExact: worldbook.boundWorldbook === tempName,
      worldbookEntryCount: worldbook.entryCount === 102,
      routerContract: worldbook.router?.type === 'selective'
        && worldbook.router.keys.length === 0
        && worldbook.router.startsWithPreprocessing
        && worldbook.router.containsActivewi,
      conceptContract: worldbook.concepts.count === 52
        && worldbook.concepts.selectiveCount === 52
        && worldbook.concepts.eventMetadataCount === 52
        && worldbook.concepts.noSecondaryKeysCount === 52
        && worldbook.concepts.recursionGuardCount === 52,
      targetContract: worldbook.target?.type === 'selective'
        && JSON.stringify(worldbook.target.keys) === JSON.stringify([targetTitle, targetAlias])
        && JSON.stringify(worldbook.target.eventIds) === JSON.stringify(['E01'])
        && worldbook.target.scanDepth === 'same_as_global',
      fiveCaseMatrixPassed: matrix.every((item) => Object.values(item.assertions).every(Boolean)),
      matrixCountsExact: JSON.stringify(matrix.map((item) => item.actualMarkerCount)) === JSON.stringify([1, 1, 1, 0, 1]),
      regressionGenerationEnded: regressionSend.generation?.ended === true,
      regressionEventState: regressionEvent.activeId === 'E02' && regressionEvent.targetStatus === '活跃',
      regressionRequestCaptured: regressionTurn.request?.status === 200 && regressionTurn.replyChars > 0,
      regressionEventRouteInjectedOnce: regressionMarkerCount === 1,
      regressionStatusRendered: regressionStatusFrameCount >= 1,
      reloadRegression: Object.values(reload.assertions).every(Boolean),
      noFatalRuntimeErrors: fatalRuntimeErrors.length === 0,
    };
    const artifactBuffer = await readFile(artifactPath);
    const evidence = {
      acceptedAt: new Date().toISOString(),
      target: { card: tempName, worldbook: tempName, concept: targetTitle, marker: targetBodyMarker },
      runtime: { tavernVersion: status.tavernVersion, helperVersion: status.helperVersion, url },
      artifact: {
        path: artifactPath,
        bytes: artifactBuffer.byteLength,
        sha256: createHash('sha256').update(artifactBuffer).digest('hex'),
      },
      worldbook,
      matrix,
      regression: {
        chat: regressionChat,
        event: regressionEvent,
        input: regressionInput,
        generationEnded: regressionSend.generation?.ended === true,
        requestStatus: regressionTurn.request?.status ?? null,
        replyChars: regressionTurn.replyChars,
        markerCount: regressionMarkerCount,
        statusFrameCount: regressionStatusFrameCount,
        captureFile: regressionCapture.file,
      },
      reload,
      console: {
        warningOrErrorCount: consoleEntries.length,
        fatalRuntimeErrors,
        entries: consoleEntries,
      },
      assertions,
    };
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (Object.values(assertions).some((value) => value !== true)) {
      throw new Error(`真机双路汇总验收失败：${JSON.stringify(assertions)}`);
    }
    return evidence;
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      const cleanup = await cleanupLiveAssets(page, session, primaryError ? 'resume-acceptance-failed' : 'resume-acceptance-complete');
      if (Object.values(cleanup.assertions).some((value) => value !== true) && !primaryError) {
        throw new Error(`真机清理不完整：${JSON.stringify(cleanup.assertions)}`);
      }
    } finally {
      await session.closeSession({ browser });
    }
  }
}

async function runAcceptance() {
  const session = await import(pathToFileURL(bridgeSessionPath).href);
  const promptCapture = await import(pathToFileURL(promptCapturePath).href);
  const { browser, page } = await session.connect(url);
  const consoleEntries = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleEntries.push({ at: new Date().toISOString(), type: message.type(), text: message.text().slice(0, 2000) });
    }
  });
  page.on('pageerror', (error) => {
    consoleEntries.push({ at: new Date().toISOString(), type: 'pageerror', text: String(error?.stack || error).slice(0, 2000) });
  });
  let cleanup = null;
  let primaryError = null;
  try {
    const liveAssets = await inspectLiveAssets(page);
    if (liveAssets.matchingCharacters.length !== 1 || !liveAssets.worldbookPresent) {
      throw new Error(`临时卡或绑定世界书未正确导入：${JSON.stringify(liveAssets)}`);
    }
    await session.switchCharacter(page, tempName, false);
    const status = await session.getStatus(page);
    const worldbook = await inspectWorldbookContract(page);
    const matrix = await runMatrix(page, session, promptCapture);
    const reload = await verifyReloadPersistence(page, session);
    const fatalRuntimeErrors = consoleEntries.filter((entry) => fatalRuntimePattern.test(entry.text));
    const assertions = {
      runtimeVersions: status.tavernVersion === '1.17.0' && status.helperVersion === '4.9.1',
      uniqueTemporaryCard: worldbook.characterMatches === 1,
      boundWorldbookExact: worldbook.boundWorldbook === tempName,
      worldbookEntryCount: worldbook.entryCount === 102,
      routerContract: worldbook.router?.type === 'selective'
        && worldbook.router.keys.length === 0
        && worldbook.router.startsWithPreprocessing
        && worldbook.router.containsActivewi,
      conceptContract: worldbook.concepts.count === 52
        && worldbook.concepts.selectiveCount === 52
        && worldbook.concepts.eventMetadataCount === 52
        && worldbook.concepts.noSecondaryKeysCount === 52
        && worldbook.concepts.recursionGuardCount === 52,
      targetContract: worldbook.target?.type === 'selective'
        && JSON.stringify(worldbook.target.keys) === JSON.stringify([targetTitle, targetAlias])
        && JSON.stringify(worldbook.target.eventIds) === JSON.stringify(['E01'])
        && worldbook.target.scanDepth === 'same_as_global',
      matrixPassed: matrix.every((item) => Object.values(item.assertions).every(Boolean)),
      eventOnlyInjected: matrix.find((item) => item.id === 'event_only')?.actualMarkerCount === 1,
      userKeywordInjected: matrix.find((item) => item.id === 'user_keyword_only')?.actualMarkerCount === 1,
      assistantKeywordInjected: matrix.find((item) => item.id === 'assistant_keyword_only')?.actualMarkerCount === 1,
      neitherRouteDidNotInject: matrix.find((item) => item.id === 'neither_route')?.actualMarkerCount === 0,
      bothRoutesDeduplicated: matrix.find((item) => item.id === 'both_routes_once')?.actualMarkerCount === 1,
      reloadRegression: Object.values(reload.assertions).every(Boolean),
      noFatalRuntimeErrors: fatalRuntimeErrors.length === 0,
    };
    const evidence = {
      acceptedAt: new Date().toISOString(),
      target: { card: tempName, worldbook: tempName, concept: targetTitle, marker: targetBodyMarker },
      runtime: { tavernVersion: status.tavernVersion, helperVersion: status.helperVersion, url },
      artifact: {
        path: artifactPath,
        bytes: (await readFile(artifactPath)).byteLength,
        sha256: createHash('sha256').update(await readFile(artifactPath)).digest('hex'),
      },
      worldbook,
      matrix,
      reload,
      console: {
        warningOrErrorCount: consoleEntries.length,
        fatalRuntimeErrors,
        entries: consoleEntries,
      },
      assertions,
    };
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (Object.values(assertions).some((value) => value !== true)) {
      throw new Error(`真机双路验收失败：${JSON.stringify(assertions)}`);
    }
    return evidence;
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      cleanup = await cleanupLiveAssets(page, session, primaryError ? 'acceptance-failed' : 'acceptance-complete');
      if (Object.values(cleanup.assertions).some((value) => value !== true) && !primaryError) {
        throw new Error(`真机清理不完整：${JSON.stringify(cleanup.assertions)}`);
      }
    } finally {
      await session.closeSession({ browser });
    }
  }
}

if (command === 'prepare') {
  process.stdout.write(`${JSON.stringify(await prepareTempCard(), null, 2)}\n`);
} else if (command === 'cleanup') {
  const session = await import(pathToFileURL(bridgeSessionPath).href);
  const { browser, page } = await session.connect(url);
  try {
    process.stdout.write(`${JSON.stringify(await cleanupLiveAssets(page, session, 'manual-cleanup'), null, 2)}\n`);
  } finally {
    await session.closeSession({ browser });
  }
} else if (command === 'run') {
  const evidence = await runAcceptance();
  process.stdout.write(`${JSON.stringify({ evidencePath, cleanupEvidencePath, assertions: evidence.assertions }, null, 2)}\n`);
} else if (command === 'resume') {
  const evidence = await runResumeAcceptance();
  process.stdout.write(`${JSON.stringify({ evidencePath, cleanupEvidencePath, assertions: evidence.assertions }, null, 2)}\n`);
} else {
  throw new Error(`未知命令：${command}；可用 prepare / run / resume / cleanup`);
}
