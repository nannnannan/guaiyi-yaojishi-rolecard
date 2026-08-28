import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:\\Users\\huang\\.codex\\skills\\sillytavern-ai-bridge\\scripts\\runtime\\核心\\tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const avatar = process.env.ST_AVATAR || '《诡异药剂师》v0.5.png';
const evidencePath = resolve(here, '真机证据/runtime-new-test-chat.json');

const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url);
try {
  const targetId = await page.evaluate((targetAvatar) => {
    return SillyTavern.getContext().characters.findIndex((item) => item?.avatar === targetAvatar);
  }, avatar);
  if (targetId < 0) throw new Error(`找不到测试卡：${avatar}`);
  const selected = await page.evaluate(({ characterId, targetAvatar }) => {
    const context = SillyTavern.getContext();
    return String(context.characterId) === String(characterId)
      && context.characters?.[characterId]?.avatar === targetAvatar;
  }, { characterId: targetId, targetAvatar: avatar });
  if (!selected) {
    await page.waitForFunction(
      (characterId) => Boolean(document.querySelector(`#rm_print_characters_block .character_select[data-chid="${characterId}"]`)),
      targetId,
      { timeout: 60000 },
    );
    await page.evaluate((characterId) => {
      document.querySelector(`#rm_print_characters_block .character_select[data-chid="${characterId}"]`).click();
    }, targetId);
  }
  await page.waitForFunction(
    ({ characterId, targetAvatar }) => {
      const context = SillyTavern.getContext();
      return String(context.characterId) === String(characterId)
        && context.characters?.[characterId]?.avatar === targetAvatar
        && context.chatId !== null;
    },
    { characterId: targetId, targetAvatar: avatar },
    { timeout: 60000 },
  );
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
  const after = await page.evaluate(() => ({
    chatId: SillyTavern.getContext().chatId,
    messageCount: SillyTavern.getContext().chat.length,
    avatar: SillyTavern.getContext().characters?.[SillyTavern.getContext().characterId]?.avatar,
  }));
  const evidence = { createdAt: new Date().toISOString(), before, after };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ evidencePath, evidence }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
