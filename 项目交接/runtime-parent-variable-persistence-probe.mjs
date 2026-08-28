import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:\\Users\\huang\\.codex\\skills\\sillytavern-ai-bridge\\scripts\\runtime\\核心\\tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const avatar = process.env.ST_AVATAR || '《诡异药剂师》v0.5.png';
const evidencePath = resolve(here, '真机证据/runtime-parent-variable-persistence-probe.json');

const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url);
try {
  const id = await page.evaluate((targetAvatar) => {
    return SillyTavern.getContext().characters.findIndex((item) => item?.avatar === targetAvatar);
  }, avatar);
  if (id < 0) throw new Error(`找不到测试卡：${avatar}`);
  await page.evaluate((characterId) => {
    document.querySelector(`#rm_print_characters_block .character_select[data-chid="${characterId}"]`)?.click();
  }, id);
  await page.waitForFunction(
    ({ characterId, targetAvatar }) => {
      const context = SillyTavern.getContext();
      return String(context.characterId) === String(characterId)
        && context.characters?.[characterId]?.avatar === targetAvatar
        && context.chat?.[0]?.variables?.[0]?.stat_data;
    },
    { characterId: id, targetAvatar: avatar },
    { timeout: 60000 },
  );
  const result = await page.evaluate(async () => {
    const context = SillyTavern.getContext();
    const messageId = context.chat.length - 1;
    const swipeId = context.chat[messageId].swipe_id ?? 0;
    const original = JSON.parse(JSON.stringify(context.chat[messageId].variables[swipeId]));
    const probe = JSON.parse(JSON.stringify(original));
    const marker = `__AGENT_B_PERSIST_PROBE_${Date.now()}__`;
    probe.stat_data.系统.事件通知 = marker;
    await TavernHelper.setChatMessages([{ message_id: messageId, data: probe }], { refresh: 'none' });
    await context.saveChat();
    await context.reloadCurrentChat();
    const afterProbe = SillyTavern.getContext().chat[messageId]?.variables?.[swipeId]?.stat_data?.系统?.事件通知;
    await TavernHelper.setChatMessages([{ message_id: messageId, data: original }], { refresh: 'none' });
    await SillyTavern.getContext().saveChat();
    await SillyTavern.getContext().reloadCurrentChat();
    const afterRestore = SillyTavern.getContext().chat[messageId]?.variables?.[swipeId]?.stat_data?.系统?.事件通知;
    return {
      chatId: SillyTavern.getContext().chatId,
      messageId,
      marker,
      afterProbe,
      afterRestore,
      originalNotice: original.stat_data.系统.事件通知,
      probePersisted: afterProbe === marker,
      restorePersisted: afterRestore === original.stat_data.系统.事件通知,
    };
  });
  if (!result.probePersisted || !result.restorePersisted) {
    throw new Error(`父页面变量持久化探针失败：${JSON.stringify(result)}`);
  }
  const evidence = { capturedAt: new Date().toISOString(), result };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ evidencePath, evidence }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
