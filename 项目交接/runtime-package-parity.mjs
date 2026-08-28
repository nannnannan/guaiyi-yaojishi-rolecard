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
const cardName = process.env.ST_CARD_NAME || '《诡异药剂师》v0.5';
const evidencePath = resolve(here, '真机证据/runtime-package-parity.json');

const artifactText = await readFile(artifactPath, 'utf8');
const artifact = JSON.parse(artifactText);
const comparedFields = [
  'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example',
  'system_prompt', 'post_history_instructions', 'character_version',
];
const expected = {
  fields: Object.fromEntries(comparedFields.map((field) => [field, artifact.data[field]])),
  regexScripts: artifact.data.extensions.regex_scripts,
  helperScripts: artifact.data.extensions.tavern_helper,
  embeddedWorldbook: artifact.data.character_book,
  worldbookName: artifact.data.extensions.world,
};

const session = await import(pathToFileURL(bridgeSessionPath).href);
const { browser, page } = await session.connect(url);
try {
  const live = await page.evaluate(async ({ targetAvatar, targetName, expectedData }) => {
    const context = SillyTavern.getContext();
    const avatarMatches = context.characters.filter((item) => item?.avatar === targetAvatar);
    const nameMatches = context.characters.filter((item) => item?.name === targetName);
    const character = avatarMatches[0];
    if (!character) throw new Error(`找不到角色槽：${targetAvatar}`);
    const data = character.data || character;
    let rawCard = null;
    try {
      rawCard = typeof character.json_data === 'string' ? JSON.parse(character.json_data) : character.json_data;
    } catch { rawCard = null; }
    const rawData = rawCard?.data || rawCard || {};
    const normalizeText = (value) => String(value ?? '').replace(/\r\n/g, '\n');
    const fieldDiagnostics = Object.fromEntries(
      Object.entries(expectedData.fields).map(([field, value]) => [field, {
        exact: JSON.stringify(data[field]) === JSON.stringify(value),
        normalized: normalizeText(data[field]) === normalizeText(value),
        actualLength: String(data[field] ?? '').length,
        expectedLength: String(value ?? '').length,
      }]),
    );
    const expectedHelperScripts = expectedData.helperScripts?.scripts || [];
    const liveHelperScripts = data.extensions?.tavern_helper?.scripts || [];
    const helperScriptSemanticMatches = expectedHelperScripts.length === liveHelperScripts.length
      && expectedHelperScripts.every((expectedScript) => {
        const actualScript = liveHelperScripts.find((item) => item?.id === expectedScript.id);
        return actualScript
          && actualScript.name === expectedScript.name
          && actualScript.enabled === expectedScript.enabled
          && normalizeText(actualScript.content) === normalizeText(expectedScript.content);
      });
    const rawWorldbook = await TavernHelper.getWorldbook(expectedData.worldbookName);
    const entries = Object.values(rawWorldbook || {}).filter(
      (entry) => entry && typeof entry === 'object' && 'content' in entry,
    );
    const concepts = entries.filter((entry) => {
      const id = Number(entry.uid ?? entry.id);
      return id >= 400 && id <= 451;
    });
    return {
      avatarMatches: avatarMatches.length,
      nameMatches: nameMatches.length,
      boundWorldbook: data.extensions?.world || null,
      fieldDiagnostics,
      regexExact: JSON.stringify(data.extensions?.regex_scripts) === JSON.stringify(expectedData.regexScripts),
      helperScriptsExact: JSON.stringify(data.extensions?.tavern_helper) === JSON.stringify(expectedData.helperScripts),
      helperScriptCount: liveHelperScripts.length,
      helperScriptSemanticMatches,
      embeddedWorldbookExact: JSON.stringify(data.character_book) === JSON.stringify(expectedData.embeddedWorldbook),
      embeddedWorldbookName: data.character_book?.name || null,
      embeddedWorldbookEntryCount: data.character_book?.entries?.length ?? 0,
      structure: {
        characterKeys: Object.keys(character).sort(),
        dataKeys: Object.keys(data).sort(),
        nestedDataKeys: data.data && typeof data.data === 'object' ? Object.keys(data.data).sort() : [],
        rawCardKeys: rawCard && typeof rawCard === 'object' ? Object.keys(rawCard).sort() : [],
        rawDataKeys: rawData && typeof rawData === 'object' ? Object.keys(rawData).sort() : [],
        promptLengths: {
          characterSystemPrompt: String(character.system_prompt ?? '').length,
          dataSystemPrompt: String(data.system_prompt ?? '').length,
          nestedSystemPrompt: String(data.data?.system_prompt ?? '').length,
          characterPostHistory: String(character.post_history_instructions ?? '').length,
          dataPostHistory: String(data.post_history_instructions ?? '').length,
          nestedPostHistory: String(data.data?.post_history_instructions ?? '').length,
          rawSystemPrompt: String(rawData.system_prompt ?? '').length,
          rawPostHistory: String(rawData.post_history_instructions ?? '').length,
        },
      },
      worldbook: {
        entryCount: entries.length,
        conceptCount: concepts.length,
        privateConceptCount: concepts.filter((entry) => String(entry.content).startsWith('@@private\n<%_')).length,
        conceptIds: concepts.map((entry) => Number(entry.uid ?? entry.id)).sort((a, b) => a - b),
      },
    };
  }, { targetAvatar: avatar, targetName: cardName, expectedData: expected });

  const assertions = {
    uniqueAvatarSlot: live.avatarMatches === 1,
    uniqueCardName: live.nameMatches === 1,
    boundWorldbookMatches: live.boundWorldbook === expected.worldbookName,
    coreFieldsNormalized: Object.values(live.fieldDiagnostics).every((item) => item.normalized),
    regexExact: live.regexExact,
    helperScriptsSemantic: live.helperScriptSemanticMatches && live.helperScriptCount === 2,
    embeddedWorldbookSemantic: live.embeddedWorldbookName === expected.worldbookName
      && live.embeddedWorldbookEntryCount === 101,
    worldbookEntryCount: live.worldbook.entryCount === 101,
    conceptCount: live.worldbook.conceptCount === 52,
    allConceptsPrivate: live.worldbook.privateConceptCount === 52,
    conceptIdRangeExact: JSON.stringify(live.worldbook.conceptIds)
      === JSON.stringify(Array.from({ length: 52 }, (_, index) => 400 + index)),
  };
  const evidence = {
    checkedAt: new Date().toISOString(),
    artifact: artifactPath,
    artifactBytes: Buffer.byteLength(artifactText),
    artifactSha256: createHash('sha256').update(artifactText).digest('hex'),
    live,
    assertions,
  };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  if (Object.values(assertions).some((value) => value !== true)) {
    throw new Error(`真机包一致性校验失败：${JSON.stringify({ assertions, evidencePath })}`);
  }
  process.stdout.write(`${JSON.stringify({ evidencePath, artifactBytes: evidence.artifactBytes, artifactSha256: evidence.artifactSha256, assertions }, null, 2)}\n`);
} finally {
  await session.closeSession({ browser });
}
