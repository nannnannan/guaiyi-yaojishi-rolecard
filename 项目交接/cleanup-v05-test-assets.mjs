import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:\\Users\\huang\\.codex\\skills\\sillytavern-ai-bridge\\scripts\\runtime\\核心\\tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const worldbook = process.env.ST_WORLDBOOK || '《诡异药剂师》v0.5';
const evidencePath = resolve(here, '真机证据/cleanup-v05-test-assets.json');

const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url);
try {
  const result = await page.evaluate(async (targetWorldbook) => {
    const beforeWorldbooks = await TavernHelper.getWorldbookNames();
    const matchingCardsBefore = SillyTavern.getContext().characters
      .filter((item) => item?.name === targetWorldbook)
      .map((item) => ({ name: item.name, avatar: item.avatar }));
    let deletedWorldbook = false;
    if (beforeWorldbooks.includes(targetWorldbook)) {
      await TavernHelper.deleteWorldbook(targetWorldbook);
      deletedWorldbook = true;
    }
    const afterWorldbooks = await TavernHelper.getWorldbookNames();
    const matchingCardsAfter = SillyTavern.getContext().characters
      .filter((item) => item?.name === targetWorldbook)
      .map((item) => ({ name: item.name, avatar: item.avatar }));
    return {
      targetWorldbook,
      deletedWorldbook,
      worldbookPresentBefore: beforeWorldbooks.includes(targetWorldbook),
      worldbookPresentAfter: afterWorldbooks.includes(targetWorldbook),
      matchingCardsBefore,
      matchingCardsAfter,
    };
  }, worldbook);
  if (result.worldbookPresentAfter || result.matchingCardsAfter.length) {
    throw new Error(`测试资产清理未完成：${JSON.stringify(result)}`);
  }
  const evidence = { cleanedAt: new Date().toISOString(), ...result };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ evidencePath, evidence }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
