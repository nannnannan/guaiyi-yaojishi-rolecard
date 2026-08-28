import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [cardArg, stateArg, unpackedArg, analysisArg] = process.argv.slice(2);
if (!cardArg || !stateArg || !unpackedArg || !analysisArg) {
  console.error('Usage: node analyze-card.mjs <card.json> <state.json> <unpacked-dir> <analysis-dir>');
  process.exit(2);
}

const cardPath = path.resolve(cardArg);
const statePath = path.resolve(stateArg);
const unpackedRoot = path.resolve(unpackedArg);
const analysisRoot = path.resolve(analysisArg);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const cardBytes = fs.readFileSync(cardPath);
const card = JSON.parse(cardBytes.toString('utf8'));
const state = readJson(statePath);
const data = card.data ?? {};
const entries = data.character_book?.entries ?? [];
const regexes = data.extensions?.regex_scripts ?? [];
const scripts = data.extensions?.tavern_helper?.scripts ?? [];

if (!Array.isArray(entries) || !Array.isArray(regexes) || !Array.isArray(scripts)) {
  throw new Error('Unexpected card extension or worldbook shape');
}
if (entries.length !== 319) throw new Error(`Expected 319 entries, found ${entries.length}`);

fs.mkdirSync(analysisRoot, { recursive: true });
const planned = [
  'card-inventory.json',
  'worldbook-entry-index.json',
  'worldbook-entry-index.csv',
  'ejs-usage.json',
  'runtime-dependency-ledger.json',
  'component-mapping.json',
  'integrity-manifest.json',
];
for (const name of planned) {
  if (fs.existsSync(path.join(analysisRoot, name))) throw new Error(`Refusing to overwrite ${name}`);
}

const normalizeText = (text) => String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const semanticText = (text) => normalizeText(text).replace(/\n$/, '');
const countBy = (items, getter) => Object.fromEntries(
  [...items.reduce((map, item) => {
    const key = String(getter(item));
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map()).entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN')),
);
const unique = (items) => [...new Set(items)];
const sum = (items) => items.reduce((a, b) => a + b, 0);
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function extractMatches(text, regex, group = 1) {
  return unique([...String(text ?? '').matchAll(regex)].map((match) => match[group]).filter(Boolean));
}

function classifyEntry(entry) {
  const label = `${entry.comment ?? ''}\n${String(entry.content ?? '').slice(0, 1200)}`;
  if (/InitVar|变量更新|变量列表|变量输出|MVU|stat_data|UpdateVariable/i.test(label)) return 'MVU与变量协议';
  if (/写作|文风|回复格式|叙事|思维链|规则|禁止|剧情|演绎|扮演|输出/i.test(label)) return '叙事与生成协议';
  if (/详细人物|人物详情|角色信息|NPC|人物生成|关键人物|绝色榜/i.test(label)) return '人物与NPC';
  if (/境界|修为|炼气|筑基|金丹|元婴|化神|炼虚|合体|大乘|渡劫|真仙|玄仙|金仙|仙帝/i.test(label)) return '境界与力量体系';
  if (/宗门|势力|家族|组织|天庭|协会|魔宫|圣地/i.test(label)) return '势力与组织';
  if (/地点|地图|界域|仙界|玄天界|秘境|遗迹|城|山|宫|谷|海域/i.test(label)) return '地点与世界结构';
  if (/功法|神通|器物|法宝|灵根|丹药|炼丹|炼器|阵法|符箓|气运|机制/i.test(label)) return '机制、物品与能力';
  if (/生成|随机|遭遇|事件|机遇|任务/i.test(label)) return '动态生成与事件';
  return '其他设定';
}

const manifestEntries = Object.values(state.entryManifest?.unknown ?? {});
const byDisplayIndex = new Map(manifestEntries.map((entry) => [entry.display_index, entry]));
const entryIndex = entries.map((entry, arrayIndex) => {
  const ext = entry.extensions ?? {};
  const content = normalizeText(entry.content ?? '');
  const stateEntry = byDisplayIndex.get(ext.display_index);
  const outputParts = stateEntry?.path
    ? [{ kind: 'file', value: stateEntry.path }]
    : (stateEntry?.contents ?? []).map((part) => part.file
      ? { kind: 'file', value: part.file }
      : { kind: 'inline', value: String(part.content ?? '') });
  const outputFiles = outputParts.filter((part) => part.kind === 'file').map((part) => {
    const absolutePath = path.resolve(unpackedRoot, part.value);
    const exists = fs.existsSync(absolutePath);
    const bytes = exists ? fs.readFileSync(absolutePath) : null;
    return {
      relativePath: part.value,
      exists,
      sha256: bytes ? sha256(bytes) : null,
      bytes: bytes?.length ?? null,
      text: bytes?.toString('utf8') ?? null,
    };
  });
  let fileCursor = 0;
  const outputText = outputParts.length === 0 ? null : outputParts.map((part) => {
    if (part.kind === 'inline') return part.value;
    const value = outputFiles[fileCursor]?.text ?? '';
    fileCursor += 1;
    return value;
  }).join('\n');
  const outputExists = outputParts.length > 0 && outputFiles.every((file) => file.exists);
  const decorators = extractMatches(content, /^@@([A-Za-z_][\w-]*)(?:\s+[^\n]*)?$/gm);
  const getvarPaths = extractMatches(content, /\bgetvar\s*\(\s*(['"`])([^'"`]+)\1/g, 2);
  const getwiTargets = unique([
    ...extractMatches(content, /\bgetwi\s*\(\s*(['"`])([^'"`]+)\1/g, 2),
    ...extractMatches(content, /\bgetwi\s*\(\s*[^,\n]+,\s*(['"`])([^'"`]+)\1/g, 2),
  ]);
  const activewiTargets = extractMatches(content, /\bactivewi\s*\(\s*(['"`])([^'"`]+)\1/g, 2);
  const defineTargets = extractMatches(content, /\bdefine\s*\(\s*(['"`])([^'"`]+)\1/g, 2);
  const calls = unique([
    ...extractMatches(content, /\b(getvar|setvar|incvar|decvar|getwi|activewi|define|injectPrompt|getPromptsInjected|activateRegex|matchChatMessages|patchVariables|jsonPatch)\s*\(/g),
  ]);
  return {
    componentId: `worldbook-entry-${String(entry.id ?? arrayIndex).padStart(3, '0')}`,
    arrayIndex,
    id: entry.id ?? null,
    comment: entry.comment ?? '',
    category: classifyEntry(entry),
    enabled: entry.enabled,
    constant: entry.constant,
    selective: entry.selective,
    keys: entry.keys ?? [],
    secondaryKeys: entry.secondary_keys ?? [],
    insertionOrder: entry.insertion_order,
    position: entry.position,
    extensionPosition: ext.position ?? null,
    depth: ext.depth ?? null,
    displayIndex: ext.display_index ?? null,
    probability: ext.probability ?? null,
    useProbability: ext.useProbability ?? null,
    group: ext.group ?? '',
    groupOverride: ext.group_override ?? false,
    groupWeight: ext.group_weight ?? null,
    excludeRecursion: ext.exclude_recursion ?? null,
    preventRecursion: ext.prevent_recursion ?? null,
    vectorized: ext.vectorized ?? null,
    sticky: ext.sticky ?? null,
    cooldown: ext.cooldown ?? null,
    delay: ext.delay ?? null,
    ignoreBudget: ext.ignore_budget ?? null,
    contentCharacters: [...content].length,
    contentUtf8Bytes: Buffer.byteLength(content),
    contentLines: content === '' ? 0 : content.split('\n').length,
    contentSha256: sha256(Buffer.from(content)),
    features: {
      ejs: /<%[-_=]?|%>/.test(content),
      decorators,
      calls,
      getvarPaths,
      getwiTargets,
      activewiTargets,
      defineTargets,
      updateVariable: /<UpdateVariable>|<updatevariable>|JSON\s*Patch|json\s*patch/i.test(content),
      initVar: /<initvar>|\[InitVar\]/i.test(content) || /\[InitVar\]/i.test(entry.comment ?? ''),
      mvuRoutingPlot: /\[mvu_plot\]/i.test(entry.comment ?? ''),
      mvuRoutingUpdate: /\[mvu_update\]/i.test(entry.comment ?? ''),
      remoteUrls: extractMatches(content, /(https?:\/\/[^\s'"<>]+)/g),
    },
    source: {
      jsonPointer: `/data/character_book/entries/${arrayIndex}`,
      selector: { id: entry.id ?? null, comment: entry.comment ?? '', displayIndex: ext.display_index ?? null },
    },
    output: {
      relativePath: outputFiles.length === 1 ? outputFiles[0].relativePath : null,
      relativePaths: outputFiles.map((file) => file.relativePath),
      parts: outputParts.map((part) => part.kind === 'inline' ? { kind: 'inline', characters: [...part.value].length } : { kind: 'file', relativePath: part.value }),
      exists: outputExists,
      sha256: outputText === null ? null : sha256(Buffer.from(outputText)),
      bytes: outputFiles.length ? sum(outputFiles.map((file) => file.bytes ?? 0)) : null,
      files: outputFiles.map(({ text, ...file }) => file),
      semanticTextEqual: outputText === null ? null : semanticText(content) === semanticText(outputText),
    },
  };
});

const scriptIndex = scripts.map((script, index) => {
  const content = normalizeText(script.content ?? '');
  const stateScript = state.extensions?.tavern_helper?.scripts?.[script.name] ?? null;
  const relativePath = stateScript?.script_file ?? null;
  const outputPath = relativePath ? path.resolve(unpackedRoot, relativePath) : null;
  const outputBytes = outputPath && fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null;
  return {
    componentId: `helper-script-${script.id ?? index}`,
    index,
    name: script.name,
    id: script.id,
    type: script.type,
    enabled: script.enabled,
    contentCharacters: [...content].length,
    contentSha256: sha256(Buffer.from(content)),
    imports: extractMatches(content, /(?:import\s+(?:[^'";]+?\s+from\s+)?|import\s*\()\s*['"]([^'"]+)['"]/g),
    registersMvuSchema: /registerMvuSchema\s*\(/.test(content),
    source: { jsonPointer: `/data/extensions/tavern_helper/scripts/${index}` },
    output: {
      relativePath,
      exists: Boolean(outputBytes),
      sha256: outputBytes ? sha256(outputBytes) : null,
      bytes: outputBytes?.length ?? null,
      inlineInState: Boolean(stateScript && !relativePath && typeof stateScript.content === 'string'),
    },
  };
});

const regexIndex = regexes.map((regex, index) => {
  const stateRegex = state.regex_scripts?.[regex.scriptName] ?? null;
  const relativePath = stateRegex?.replace_file ?? null;
  const outputPath = relativePath ? path.resolve(unpackedRoot, relativePath) : null;
  const outputBytes = outputPath && fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null;
  return {
    componentId: `regex-${regex.id ?? index}`,
    index,
    id: regex.id,
    name: regex.scriptName,
    disabled: regex.disabled,
    runOnEdit: regex.runOnEdit,
    findRegex: regex.findRegex,
    placement: regex.placement,
    markdownOnly: regex.markdownOnly,
    promptOnly: regex.promptOnly,
    replaceCharacters: [...String(regex.replaceString ?? '')].length,
    source: { jsonPointer: `/data/extensions/regex_scripts/${index}` },
    output: {
      relativePath,
      exists: Boolean(outputBytes),
      sha256: outputBytes ? sha256(outputBytes) : null,
      bytes: outputBytes?.length ?? null,
      inlineInState: Boolean(stateRegex && !relativePath && typeof stateRegex.replaceString === 'string'),
    },
  };
});

const openingSource = [data.first_mes ?? '', ...(data.alternate_greetings ?? [])];
const openingIndex = openingSource.map((content, index) => {
  const relativePath = state.first_messages?.[index] ?? null;
  const outputPath = relativePath ? path.resolve(unpackedRoot, relativePath) : null;
  const outputBytes = outputPath && fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null;
  return {
    componentId: `opening-${index}`,
    index,
    contentCharacters: [...normalizeText(content)].length,
    contentSha256: sha256(Buffer.from(normalizeText(content))),
    containsInitVar: /<initvar>/i.test(content),
    containsUpdateVariable: /<UpdateVariable>/i.test(content),
    source: { jsonPointer: index === 0 ? '/data/first_mes' : `/data/alternate_greetings/${index - 1}` },
    output: {
      relativePath,
      exists: Boolean(outputBytes),
      sha256: outputBytes ? sha256(outputBytes) : null,
      bytes: outputBytes?.length ?? null,
      semanticTextEqual: outputBytes ? semanticText(content) === semanticText(outputBytes.toString('utf8')) : null,
    },
  };
});

const mirrorFields = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'];
const mirrorComparison = Object.fromEntries(mirrorFields.map((field) => [field, card[field] === data[field]]));
const enabledEntries = entryIndex.filter((entry) => entry.enabled);
const disabledEntries = entryIndex.filter((entry) => !entry.enabled);
const nativeAlwaysOn = entryIndex.filter((entry) => entry.enabled && entry.constant);
const nativeKeyword = entryIndex.filter((entry) => entry.enabled && !entry.constant && entry.keys.length > 0);
const nativeUntriggerable = entryIndex.filter((entry) => entry.enabled && !entry.constant && entry.keys.length === 0);
const ejsEntries = entryIndex.filter((entry) => entry.features.ejs || entry.features.decorators.length > 0);
const allGetvarPaths = unique(entryIndex.flatMap((entry) => entry.features.getvarPaths)).sort();
const allRemoteUrls = unique([
  ...entryIndex.flatMap((entry) => entry.features.remoteUrls),
  ...scriptIndex.flatMap((script) => script.imports),
]);

const inventory = {
  identity: {
    spec: card.spec,
    specVersion: card.spec_version,
    name: data.name,
    characterVersion: data.character_version ?? null,
    creator: data.creator ?? null,
    createDate: card.create_date ?? null,
    worldbookName: data.character_book?.name ?? null,
    rawJsonBytes: cardBytes.length,
    rawJsonSha256: sha256(cardBytes),
    topLevelKeys: Object.keys(card),
    dataKeys: Object.keys(data),
    compatibilityMirrorsEqual: mirrorComparison,
  },
  cardText: {
    descriptionCharacters: [...String(data.description ?? '')].length,
    personalityCharacters: [...String(data.personality ?? '')].length,
    scenarioCharacters: [...String(data.scenario ?? '')].length,
    firstMessageCharacters: [...String(data.first_mes ?? '')].length,
    alternateGreetingCount: (data.alternate_greetings ?? []).length,
    alternateGreetingCharacters: sum((data.alternate_greetings ?? []).map((text) => [...String(text)].length)),
  },
  worldbook: {
    entries: entryIndex.length,
    totalContentCharacters: sum(entryIndex.map((entry) => entry.contentCharacters)),
    totalContentUtf8Bytes: sum(entryIndex.map((entry) => entry.contentUtf8Bytes)),
    enabled: enabledEntries.length,
    disabled: disabledEntries.length,
    nativeAlwaysOn: nativeAlwaysOn.length,
    nativeKeywordActivated: nativeKeyword.length,
    nativeEnabledWithoutConstantOrKeys: nativeUntriggerable.length,
    constant: entryIndex.filter((entry) => entry.constant).length,
    selective: entryIndex.filter((entry) => entry.selective).length,
    ejsOrDecorator: ejsEntries.length,
    initVarEntries: entryIndex.filter((entry) => entry.features.initVar).length,
    updateProtocolEntries: entryIndex.filter((entry) => entry.features.updateVariable).length,
    categories: countBy(entryIndex, (entry) => entry.category),
    positions: countBy(entryIndex, (entry) => entry.position),
    depths: countBy(entryIndex, (entry) => entry.depth),
    insertionOrders: countBy(entryIndex, (entry) => entry.insertionOrder),
    groups: countBy(entryIndex, (entry) => entry.group || '(empty)'),
    probabilityUsage: countBy(entryIndex, (entry) => `${entry.useProbability}:${entry.probability}`),
    recursionProtection: {
      excludeRecursionTrue: entryIndex.filter((entry) => entry.excludeRecursion === true).length,
      preventRecursionTrue: entryIndex.filter((entry) => entry.preventRecursion === true).length,
    },
    duplicateComments: Object.entries(countBy(entryIndex, (entry) => entry.comment)).filter(([, count]) => count > 1),
    duplicateIds: Object.entries(countBy(entryIndex, (entry) => entry.id)).filter(([, count]) => count > 1),
  },
  extensions: {
    keys: Object.keys(data.extensions ?? {}),
    regexCount: regexIndex.length,
    regexEnabled: regexIndex.filter((regex) => !regex.disabled).length,
    helperScriptCount: scriptIndex.length,
    helperScriptsEnabled: scriptIndex.filter((script) => script.enabled).length,
    helperScriptNames: scriptIndex.map((script) => script.name),
    helperScriptIds: Object.fromEntries(scriptIndex.map((script) => [script.name, script.id])),
  },
  detection: {
    primaryType: scriptIndex.some((script) => script.registersMvuSchema) && scriptIndex.some((script) => /MVU/i.test(script.name)) ? 'mvu_zod' : 'unknown',
    capabilityFlags: [
      ...(regexIndex.length ? ['regex'] : []),
      ...(scriptIndex.length ? ['tavern_helper'] : []),
      ...(ejsEntries.length ? ['ejs'] : []),
      ...(allRemoteUrls.length ? ['remote_loader'] : []),
      ...(regexIndex.some((regex) => /状态栏|HTML|XML|开局/.test(regex.name)) ? ['embedded_ui'] : []),
    ],
    forgeDetectedMvu: state.mvu,
    actualZodRegistrationDetected: scriptIndex.some((script) => script.registersMvuSchema),
  },
};

const ejsUsage = {
  entries: ejsEntries.map((entry) => ({
    id: entry.id,
    comment: entry.comment,
    enabled: entry.enabled,
    constant: entry.constant,
    keys: entry.keys,
    decorators: entry.features.decorators,
    calls: entry.features.calls,
    getvarPaths: entry.features.getvarPaths,
    getwiTargets: entry.features.getwiTargets,
    activewiTargets: entry.features.activewiTargets,
    defineTargets: entry.features.defineTargets,
    source: entry.source,
  })),
  entryCount: ejsEntries.length,
  getvarPaths: allGetvarPaths,
  functionUsageCounts: countBy(entryIndex.flatMap((entry) => entry.features.calls), (name) => name),
  decorators: countBy(entryIndex.flatMap((entry) => entry.features.decorators), (name) => name),
};

const runtimeLedger = [
  {
    id: 'host-tavern-helper', role: 'execute character-local helper scripts and expose runtime APIs', class: 'host_required', required: true,
    delivery: 'host installation', evidence: '/data/extensions/tavern_helper/scripts', enabledPolicy: 'installed and enabled', versionOrRef: 'runtime probe required',
    failureMode: 'MVU, schema registration, configuration helper and Wiki loader do not execute', validationOwner: 'runtime debug',
  },
  {
    id: 'host-st-prompt-template', role: 'evaluate EJS in worldbook/prompt content', class: 'host_required', required: ejsEntries.length > 0,
    delivery: 'host installation', evidence: `${ejsEntries.length} entries contain EJS/decorators`, enabledPolicy: 'installed with relevant generation/preload features enabled', versionOrRef: 'runtime probe required',
    failureMode: 'conditional routing and dynamic prompt code remain literal or inactive', validationOwner: 'runtime debug',
  },
  ...scriptIndex.map((script) => ({
    id: `embedded-script-${script.id}`,
    role: script.registersMvuSchema ? 'card-specific Zod schema and schema registration' : `Tavern Helper script: ${script.name}`,
    class: 'embedded_required',
    required: script.enabled,
    delivery: 'character card /data/extensions/tavern_helper/scripts',
    evidence: { name: script.name, id: script.id, jsonPointer: script.source.jsonPointer },
    enabledPolicy: script.enabled ? 'enabled' : 'disabled',
    versionOrRef: null,
    failureMode: script.registersMvuSchema ? 'MVU state is not validated/coerced by the card schema' : `${script.name} feature unavailable`,
    validationOwner: 'artifact and runtime debug',
  })),
  ...scriptIndex.flatMap((script) => script.imports.map((url, index) => ({
    id: `remote-${script.id}-${index}`,
    role: `remote runtime imported by ${script.name}`,
    class: 'remote_runtime',
    required: script.enabled,
    delivery: url,
    evidence: { scriptName: script.name, scriptId: script.id, jsonPointer: script.source.jsonPointer },
    enabledPolicy: 'loaded when owning helper script runs',
    versionOrRef: /@([^/]+)/.exec(url)?.[1] ?? (/\/prod\/latest\//.test(url) ? 'latest (mutable)' : 'unversioned'),
    fallback: null,
    failureMode: `${script.name} remote feature fails to initialize`,
    validationOwner: 'runtime debug',
  }))),
  {
    id: 'embedded-character-regexes', role: 'message/prompt transformations and embedded UI adapters', class: 'embedded_required', required: true,
    delivery: '/data/extensions/regex_scripts', evidence: `${regexIndex.length} character-local regexes`, enabledPolicy: 'preserve each packed disabled state',
    versionOrRef: null, failureMode: 'update blocks leak into prompts or UI/adapters fail', validationOwner: 'artifact and runtime debug',
  },
];

const componentMapping = {
  source: { cardPath, sha256: sha256(cardBytes) },
  adapter: { id: 'tavern-cards-forge unpack + analyze-card.mjs', node: process.version },
  components: [...entryIndex, ...scriptIndex, ...regexIndex, ...openingIndex].map((component) => ({
    componentId: component.componentId,
    logicalKind: component.componentId.startsWith('worldbook') ? 'worldbook entry' : component.componentId.startsWith('helper') ? 'helper script' : component.componentId.startsWith('regex') ? 'regex' : 'opening message',
    source: component.source,
    output: component.output,
    identity: component.componentId.startsWith('worldbook') ? { id: component.id, comment: component.comment, displayIndex: component.displayIndex } : component.componentId.startsWith('helper') ? { id: component.id, name: component.name } : component.componentId.startsWith('regex') ? { id: component.id, name: component.name } : { index: component.index },
  })),
};

function writeJson(name, value) {
  fs.writeFileSync(path.join(analysisRoot, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
writeJson('card-inventory.json', inventory);
writeJson('worldbook-entry-index.json', entryIndex);
writeJson('ejs-usage.json', ejsUsage);
writeJson('runtime-dependency-ledger.json', runtimeLedger);
writeJson('component-mapping.json', componentMapping);

const csvColumns = ['id', 'comment', 'category', 'enabled', 'constant', 'selective', 'keys', 'position', 'depth', 'insertionOrder', 'characters', 'ejs', 'decorators', 'getvarPaths', 'relativePath'];
const csvRows = entryIndex.map((entry) => [
  entry.id, entry.comment, entry.category, entry.enabled, entry.constant, entry.selective, entry.keys.join('|'), entry.position, entry.depth,
  entry.insertionOrder, entry.contentCharacters, entry.features.ejs, entry.features.decorators.join('|'), entry.features.getvarPaths.join('|'), entry.output.relativePaths.join('|'),
]);
fs.writeFileSync(path.join(analysisRoot, 'worldbook-entry-index.csv'), `${csvColumns.map(csvCell).join(',')}\n${csvRows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, { flag: 'wx' });

const generatedFiles = planned.filter((name) => name !== 'integrity-manifest.json').map((name) => {
  const bytes = fs.readFileSync(path.join(analysisRoot, name));
  return { path: name, bytes: bytes.length, sha256: sha256(bytes) };
});
const integrity = {
  source: { card: cardPath, cardSha256: sha256(cardBytes), state: statePath, stateSha256: sha256(fs.readFileSync(statePath)) },
  counts: { worldbookEntries: entryIndex.length, regexes: regexIndex.length, scripts: scriptIndex.length, openings: openingIndex.length },
  extractionChecks: {
    allEntriesMapped: entryIndex.every((entry) => entry.output.exists),
    allEntrySemanticTextEqual: entryIndex.every((entry) => entry.output.semanticTextEqual),
    allOpeningsMapped: openingIndex.every((opening) => opening.output.exists),
    allOpeningSemanticTextEqual: openingIndex.every((opening) => opening.output.semanticTextEqual),
    helperScriptsAccountedFor: scriptIndex.every((script) => script.output.exists || script.output.inlineInState),
    regexesAccountedFor: regexIndex.every((regex) => regex.output.exists || regex.output.inlineInState),
    idsUnique: new Set(entryIndex.map((entry) => entry.id)).size === entryIndex.length,
    commentsUnique: new Set(entryIndex.map((entry) => entry.comment)).size === entryIndex.length,
  },
  generatedFiles,
};
writeJson('integrity-manifest.json', integrity);

console.log(JSON.stringify({ inventory, integrity, analysisRoot }, null, 2));
