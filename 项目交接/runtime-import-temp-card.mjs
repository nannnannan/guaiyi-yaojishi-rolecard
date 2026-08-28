import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const targetName = process.env.ST_TEST_CARD_NAME;
const cardPath = resolve(process.env.ST_TEMP_CARD_PATH
  || `${here}/真机证据/e01-to-e06-regression-2026-08-10/诡异药剂师_v0.5_E06回归_临时卡.json`);
const evidenceDir = resolve(process.env.ST_EVIDENCE_DIR
  || `${here}/真机证据/e01-to-e06-regression-2026-08-10`);
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:/Users/huang/.codex/skills/sillytavern-ai-bridge/scripts/runtime/核心/tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';

if (!targetName) throw new Error('必须设置 ST_TEST_CARD_NAME');

const session = await import(pathToFileURL(bridgeSessionPath).href);

async function inspect(page) {
  return page.evaluate((name) => {
    const matches = SillyTavern.getContext().characters
      .filter((item) => item?.name === name)
      .map((item) => ({
        name: item.name,
        avatar: item.avatar,
        boundWorldbook: item.data?.extensions?.world ?? null,
        regexCount: item.data?.extensions?.regex_scripts?.length ?? 0,
        helperScriptCount: item.data?.extensions?.tavern_helper?.scripts?.length ?? 0,
      }));
    return { matches };
  }, targetName);
}

let first;
let second;
try {
  first = await session.connect(url);
  const before = await inspect(first.page);
  if (before.matches.length !== 0) throw new Error(`同名临时卡已存在：${JSON.stringify(before)}`);
  const imported = await session.importCharacterFile(first.page, cardPath);
  await first.page.waitForTimeout(2500);
  const writeSession = await inspect(first.page);
  second = await session.connect(url);
  const reloadSession = await inspect(second.page);
  const evidence = {
    importedAt: new Date().toISOString(),
    targetName,
    cardPath,
    imported,
    writeSession,
    reloadSession,
    assertions: {
      importedExpectedName: imported.name === targetName,
      oneCardInWriteSession: writeSession.matches.length === 1,
      oneCardAfterReload: reloadSession.matches.length === 1,
      boundWorldbookNamePersisted: reloadSession.matches[0]?.boundWorldbook === targetName,
      fiveRegexesPersisted: reloadSession.matches[0]?.regexCount === 5,
      twoHelperScriptsPersisted: reloadSession.matches[0]?.helperScriptCount === 2,
    },
  };
  await mkdir(evidenceDir, { recursive: true });
  const evidencePath = resolve(evidenceDir, 'runtime-e06-card-import.json');
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ evidencePath, ...evidence }, null, 2)}\n`);
  if (Object.values(evidence.assertions).some((value) => value !== true)) process.exitCode = 1;
} finally {
  if (second) await session.closeSession(second);
  if (first) await session.closeSession(first);
}
