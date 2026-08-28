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
const avatar = process.env.ST_AVATAR || '《诡异药剂师》v0.png';
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:\\Users\\huang\\.codex\\skills\\sillytavern-ai-bridge\\scripts\\runtime\\核心\\tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const evidencePath = resolve(here, '真机证据/live-status-regex-patch.json');

const artifactText = await readFile(artifactPath, 'utf8');
const artifact = JSON.parse(artifactText);
const statusRegex = artifact.data.extensions.regex_scripts.find(
  (script) => script.id === 'tavernweave-status-ui-v0.5',
);
if (!statusRegex) throw new Error('最终包缺少状态栏正则');
if (!statusRegex.replaceString.includes("waitGlobalInitialized('Mvu')")) {
  throw new Error('最终包状态栏尚未包含MVU等待握手');
}

const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url);
try {
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

  const result = await page.evaluate(async ({ targetAvatar, replacementRegexes }) => {
    const context = SillyTavern.getContext();
    const current = context.characters?.[context.characterId];
    if (current?.avatar !== targetAvatar) {
      throw new Error(`当前头像槽校验失败：${current?.avatar || '无'}`);
    }
    const before = current.data?.extensions?.regex_scripts || [];
    const beforeStatus = before.find((script) => script.id === 'tavernweave-status-ui-v0.5');
    if (!beforeStatus) throw new Error('当前测试卡缺少状态栏正则');
    const response = await fetch('/api/characters/merge-attributes', {
      method: 'POST',
      headers: context.getRequestHeaders(),
      body: JSON.stringify({
        avatar: targetAvatar,
        data: { extensions: { regex_scripts: replacementRegexes } },
      }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`按头像保存角色正则失败：HTTP ${response.status} ${responseText}`);
    }
    const afterStatus = replacementRegexes.find((script) => script.id === 'tavernweave-status-ui-v0.5');
    return {
      characterId: context.characterId,
      character: context.name2,
      avatar: current.avatar,
      chatId: context.chatId,
      saveStatus: response.status,
      saveResponse: responseText,
      regexCount: replacementRegexes.length,
      beforeReplacementLength: String(beforeStatus.replaceString || '').length,
      afterReplacementLength: String(afterStatus?.replaceString || '').length,
      hasMvuHandshake: String(afterStatus?.replaceString || '').includes("waitGlobalInitialized('Mvu')"),
    };
  }, { targetAvatar: avatar, replacementRegexes: artifact.data.extensions.regex_scripts });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => Boolean(window.SillyTavern?.getContext && window.TavernHelper),
    { timeout: 60000 },
  );
  await page.waitForFunction(
    (targetAvatar) => SillyTavern.getContext().characters?.some((item) => item?.avatar === targetAvatar),
    avatar,
    { timeout: 60000 },
  );
  const reloadedId = await page.evaluate(
    (targetAvatar) => SillyTavern.getContext().characters.findIndex((item) => item?.avatar === targetAvatar),
    avatar,
  );
  const alreadySelected = await page.evaluate(
    ({ characterId, targetAvatar }) => {
      const context = SillyTavern.getContext();
      return String(context.characterId) === String(characterId)
        && context.characters?.[characterId]?.avatar === targetAvatar
        && context.chatId !== null;
    },
    { characterId: reloadedId, targetAvatar: avatar },
  );
  if (!alreadySelected) {
    await page.waitForFunction(
      (characterId) => Boolean(document.querySelector(`#rm_print_characters_block .character_select[data-chid="${characterId}"]`)),
      reloadedId,
      { timeout: 60000 },
    );
    await page.evaluate((characterId) => {
      document.querySelector(`#rm_print_characters_block .character_select[data-chid="${characterId}"]`).click();
    }, reloadedId);
  }
  await page.waitForFunction(
    ({ characterId, targetAvatar }) => {
      const context = SillyTavern.getContext();
      return String(context.characterId) === String(characterId)
        && context.characters?.[characterId]?.avatar === targetAvatar
        && context.chatId !== null;
    },
    { characterId: reloadedId, targetAvatar: avatar },
    { timeout: 60000 },
  );
  await page.waitForTimeout(12000);
  const persisted = await page.evaluate((targetAvatar) => {
    const context = SillyTavern.getContext();
    const current = context.characters?.[context.characterId];
    if (current?.avatar !== targetAvatar) throw new Error('重载后头像槽校验失败');
    const regexes = current.data?.extensions?.regex_scripts || [];
    const status = regexes.find((script) => script.id === 'tavernweave-status-ui-v0.5');
    const frame = Array.from(document.querySelectorAll('iframe')).find((item) => {
      try { return Boolean(item.contentDocument?.querySelector('[data-wa-status-root]')); } catch { return false; }
    });
    const doc = frame?.contentDocument;
    const button = doc?.querySelector('#wa-advance-btn');
    return {
      characterId: context.characterId,
      avatar: current.avatar,
      regexCount: regexes.length,
      replacementLength: String(status?.replaceString || '').length,
      hasMvuHandshake: String(status?.replaceString || '').includes("waitGlobalInitialized('Mvu')"),
      frameName: frame?.name || null,
      frameHasMvu: Boolean(frame?.contentWindow?.Mvu),
      eventButtonText: button?.textContent?.trim() || null,
      eventButtonDisabled: button ? button.disabled : null,
      visibleError: doc?.querySelector('[data-status-error]')?.textContent?.trim() || null,
    };
  }, avatar);
  if (!persisted.hasMvuHandshake || persisted.regexCount !== artifact.data.extensions.regex_scripts.length) {
    throw new Error(`重载后正则未持久化：${JSON.stringify(persisted)}`);
  }
  const evidence = {
    patchedAt: new Date().toISOString(),
    artifact: artifactPath,
    artifactSha256: createHash('sha256').update(artifactText).digest('hex'),
    statusRegexId: statusRegex.id,
    target,
    result,
    persisted,
  };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ evidencePath, evidence }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
