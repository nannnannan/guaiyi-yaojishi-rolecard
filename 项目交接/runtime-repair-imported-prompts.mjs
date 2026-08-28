import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(here, '..');
const artifactPath = resolve(
  process.env.CARD_ARTIFACT
    || `${workspace}/角色卡本体/诡异药剂师_MVU_v0.5/dist/诡异药剂师_v0.5.json`,
);
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:\\Users\\huang\\.codex\\skills\\sillytavern-ai-bridge\\scripts\\runtime\\核心\\tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const avatar = process.env.ST_AVATAR || '《诡异药剂师》v0.5.png';
const evidencePath = resolve(here, '真机证据/runtime-imported-prompt-repair.json');

const artifactText = await readFile(artifactPath, 'utf8');
const artifact = JSON.parse(artifactText);
const expected = {
  system_prompt: artifact.data.system_prompt,
  post_history_instructions: artifact.data.post_history_instructions,
};
if (!expected.system_prompt || !expected.post_history_instructions) {
  throw new Error('产物提示字段不完整');
}

const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url);
try {
  const before = await page.evaluate((targetAvatar) => {
    const matches = SillyTavern.getContext().characters.filter((item) => item?.avatar === targetAvatar);
    if (matches.length !== 1) throw new Error(`头像槽必须唯一，实际 ${matches.length}`);
    const data = matches[0].data || matches[0];
    return {
      name: matches[0].name,
      avatar: matches[0].avatar,
      systemPromptLength: String(data.system_prompt || '').length,
      postHistoryLength: String(data.post_history_instructions || '').length,
    };
  }, avatar);

  const save = await page.evaluate(async ({ targetAvatar, expectedPrompts }) => {
    const context = SillyTavern.getContext();
    const matches = context.characters.filter((item) => item?.avatar === targetAvatar);
    if (matches.length !== 1) throw new Error(`头像槽必须唯一，实际 ${matches.length}`);
    const response = await fetch('/api/characters/merge-attributes', {
      method: 'POST',
      headers: context.getRequestHeaders(),
      body: JSON.stringify({ avatar: targetAvatar, data: expectedPrompts }),
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`提示字段写回失败：HTTP ${response.status} ${responseText}`);
    return { status: response.status, responseText };
  }, { targetAvatar: avatar, expectedPrompts: expected });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.SillyTavern?.getContext), null, { timeout: 60000 });
  await page.waitForFunction(
    (targetAvatar) => SillyTavern.getContext().characters?.some((item) => item?.avatar === targetAvatar),
    avatar,
    { timeout: 60000 },
  );
  const after = await page.evaluate(({ targetAvatar, expectedPrompts }) => {
    const matches = SillyTavern.getContext().characters.filter((item) => item?.avatar === targetAvatar);
    if (matches.length !== 1) throw new Error(`重载后头像槽必须唯一，实际 ${matches.length}`);
    const data = matches[0].data || matches[0];
    return {
      systemPromptLength: String(data.system_prompt || '').length,
      postHistoryLength: String(data.post_history_instructions || '').length,
      systemPromptExact: data.system_prompt === expectedPrompts.system_prompt,
      postHistoryExact: data.post_history_instructions === expectedPrompts.post_history_instructions,
    };
  }, { targetAvatar: avatar, expectedPrompts: expected });

  const assertions = {
    sourceHadSystemPrompt: expected.system_prompt.length > 0,
    sourceHadPostHistory: expected.post_history_instructions.length > 0,
    persistedSystemPromptExact: after.systemPromptExact,
    persistedPostHistoryExact: after.postHistoryExact,
  };
  const evidence = {
    repairedAt: new Date().toISOString(),
    artifact: artifactPath,
    artifactSha256: createHash('sha256').update(artifactText).digest('hex'),
    target: { avatar, name: before.name },
    before,
    save,
    after,
    assertions,
  };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  if (Object.values(assertions).some((value) => value !== true)) {
    throw new Error(`导入提示字段修复失败：${JSON.stringify({ assertions, evidencePath })}`);
  }
  process.stdout.write(`${JSON.stringify({ evidencePath, before, after, assertions }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
