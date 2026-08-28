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
const evidenceDir = resolve(
  process.env.ST_EVIDENCE_DIR
    || `${here}/真机证据/e01-to-e06-regression-2026-08-10`,
);
const targetName = process.env.ST_TEST_CARD_NAME;
const templateName = process.env.ST_TEMPLATE_WORLDBOOK || '《诡异药剂师》v0.5';
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:/Users/huang/.codex/skills/sillytavern-ai-bridge/scripts/runtime/核心/tavern-session.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';

if (!targetName) throw new Error('必须设置 ST_TEST_CARD_NAME');

const artifactBuffer = await readFile(artifactPath);
const artifact = JSON.parse(artifactBuffer.toString('utf8'));
const sourceEntries = artifact.data?.character_book?.entries ?? [];
if (sourceEntries.length !== 102) throw new Error(`源码世界书条目数错误：${sourceEntries.length}`);

const session = await import(pathToFileURL(bridgeSessionPath).href);

function summarize(entries) {
  return {
    count: entries.length,
    constants: entries.filter((entry) => entry.strategy?.type === 'constant').length,
    selective: entries.filter((entry) => entry.strategy?.type === 'selective').length,
    hasEventTransactionRule: entries.some((entry) => entry.content?.includes('强制事务：开场基线E02')),
    hasFallbackOutputProtocol: entries.some((entry) => entry.content?.includes('每轮强制输出协议')),
    hasSetvarBan: entries.some((entry) => entry.content?.includes('不得使用`<setvar>`')),
    router: entries.filter((entry) => entry.uid === 399).map((entry) => ({
      uid: entry.uid,
      name: entry.name,
      type: entry.strategy?.type,
      keys: entry.strategy?.keys,
      preprocessing: entry.content?.startsWith('@@preprocessing') === true,
    })),
  };
}

let firstSession;
let secondSession;
try {
  firstSession = await session.connect(url);
  const writeResult = await firstSession.page.evaluate(async ({ targetName, templateName, sourceEntries }) => {
    const templateEntries = await TavernHelper.getWorldbook(templateName);
    if (!templateEntries.length) throw new Error(`模板世界书为空：${templateName}`);
    const templateByUid = new Map(templateEntries.map((entry) => [entry.uid, entry]));
    const convert = (entry) => {
      const converted = structuredClone(templateByUid.get(entry.id) ?? templateEntries[0]);
      const ext = entry.extensions ?? {};
      converted.uid = entry.id;
      converted.name = entry.comment;
      converted.enabled = entry.enabled !== false;
      converted.strategy = {
        type: entry.constant ? 'constant' : 'selective',
        keys: [...(entry.keys ?? [])],
        keys_secondary: { logic: 'and_any', keys: [...(entry.secondary_keys ?? [])] },
        scan_depth: ext.scan_depth == null ? 'same_as_global' : ext.scan_depth,
      };
      converted.position = {
        type: entry.position === 'after_char'
          ? 'after_character_definition'
          : 'before_character_definition',
        role: 'system',
        depth: ext.depth ?? 4,
        order: entry.insertion_order ?? 100,
      };
      converted.content = entry.content ?? '';
      converted.probability = ext.probability ?? 100;
      converted.recursion = {
        prevent_incoming: ext.exclude_recursion === true,
        prevent_outgoing: ext.prevent_recursion === true,
        delay_until: ext.delay_until_recursion ? 0 : null,
      };
      converted.effect = {
        sticky: ext.sticky > 0 ? ext.sticky : null,
        cooldown: ext.cooldown > 0 ? ext.cooldown : null,
        delay: ext.delay > 0 ? ext.delay : null,
      };
      converted.addMemo = true;
      converted.matchPersonaDescription = ext.match_persona_description === true;
      converted.matchCharacterDescription = ext.match_character_description === true;
      converted.matchCharacterPersonality = ext.match_character_personality === true;
      converted.matchCharacterDepthPrompt = ext.match_character_depth_prompt === true;
      converted.matchScenario = ext.match_scenario === true;
      converted.matchCreatorNotes = ext.match_creator_notes === true;
      converted.group = ext.group ?? '';
      converted.groupOverride = ext.group_override === true;
      converted.groupWeight = ext.group_weight ?? 100;
      converted.caseSensitive = ext.case_sensitive ?? null;
      converted.matchWholeWords = ext.match_whole_words ?? null;
      converted.useGroupScoring = ext.use_group_scoring === true;
      converted.automationId = ext.automation_id ?? '';
      converted.ignoreBudget = ext.ignore_budget === true;
      converted.outletName = ext.outlet_name ?? '';
      converted.triggers = [...(ext.triggers ?? [])];
      return converted;
    };
    const normalized = sourceEntries.map(convert);
    const names = await TavernHelper.getWorldbookNames();
    if (names.includes(targetName)) await TavernHelper.deleteWorldbook(targetName);
    await TavernHelper.createOrReplaceWorldbook(targetName, normalized, { render: 'immediate' });
    await new Promise((resolveWait) => setTimeout(resolveWait, 4000));
    return await TavernHelper.getWorldbook(targetName);
  }, { targetName, templateName, sourceEntries });
  await session.closeSession(firstSession);
  firstSession = null;

  secondSession = await session.connect(url);
  const persisted = await secondSession.page.evaluate(async (name) => ({
    matches: (await TavernHelper.getWorldbookNames()).filter((item) => item === name).length,
    entries: await TavernHelper.getWorldbook(name),
  }), targetName);
  const result = {
    importedAt: new Date().toISOString(),
    targetName,
    templateName,
    artifact: artifactPath,
    artifactBytes: artifactBuffer.byteLength,
    artifactSha256: createHash('sha256').update(artifactBuffer).digest('hex'),
    writeSession: summarize(writeResult),
    reloadSession: {
      matches: persisted.matches,
      ...summarize(persisted.entries),
    },
  };
  result.assertions = {
    oneExactWorldbook: result.reloadSession.matches === 1,
    allEntriesPersisted: result.reloadSession.count === 102,
    eventTransactionRulePersisted: result.reloadSession.hasEventTransactionRule,
    fallbackOutputProtocolPersisted: result.reloadSession.hasFallbackOutputProtocol,
    setvarBanPersisted: result.reloadSession.hasSetvarBan,
    onePreprocessingRouter: result.reloadSession.router.length === 1
      && result.reloadSession.router[0].preprocessing === true,
  };
  if (Object.values(result.assertions).some((value) => value !== true)) {
    throw new Error(`世界书持久化断言失败：${JSON.stringify(result.assertions)}`);
  }
  await mkdir(evidenceDir, { recursive: true });
  const evidencePath = resolve(evidenceDir, 'runtime-e06-worldbook-import.json');
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ ...result, evidencePath }, null, 2)}\n`);
} finally {
  if (firstSession) await session.closeSession(firstSession);
  if (secondSession) await session.closeSession(secondSession);
}
