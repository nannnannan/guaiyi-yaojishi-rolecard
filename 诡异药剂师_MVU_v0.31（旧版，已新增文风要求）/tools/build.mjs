import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sourcePath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim() || isAbsolute(relativePath)) {
    throw new Error(`无效的相对路径：${String(relativePath)}`);
  }
  const fullPath = resolve(projectRoot, relativePath);
  const rel = relative(projectRoot, fullPath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`路径越出项目目录：${relativePath}`);
  }
  return fullPath;
}

async function readText(relativePath) {
  const text = await readFile(sourcePath(relativePath), 'utf8');
  if (text.includes('\uFFFD')) throw new Error(`文件包含 UTF-8 替换字符：${relativePath}`);
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

const defaultEntryExtensions = {
  position: 0,
  exclude_recursion: true,
  display_index: 0,
  probability: 100,
  useProbability: true,
  depth: 4,
  selectiveLogic: 0,
  outlet_name: '',
  group: '',
  group_override: false,
  group_weight: 100,
  prevent_recursion: true,
  delay_until_recursion: false,
  scan_depth: null,
  match_whole_words: null,
  use_group_scoring: false,
  case_sensitive: null,
  automation_id: '',
  role: 0,
  vectorized: false,
  sticky: 0,
  cooldown: 0,
  delay: 0,
  match_persona_description: false,
  match_character_description: false,
  match_character_personality: false,
  match_character_depth_prompt: false,
  match_scenario: false,
  match_creator_notes: false,
  triggers: [],
  ignore_budget: false,
};

async function materializeWorldbook(relativePath) {
  const source = await readJson(relativePath);
  const entries = [];
  for (const rawEntry of source.entries) {
    const {
      content_file: contentFile,
      content_files: contentFiles,
      content_json_file: contentJsonFile,
      position_number: positionNumber = 0,
      depth = 4,
      ...entry
    } = rawEntry;

    let content = entry.content ?? '';
    if (contentFile) content = await readText(contentFile);
    if (contentFiles) {
      if (!Array.isArray(contentFiles) || contentFiles.length === 0) {
        throw new Error(`content_files 必须是非空数组：${entry.comment ?? entry.id}`);
      }
      content = (await Promise.all(contentFiles.map(readText))).join('\n\n');
    }
    if (contentJsonFile) content = JSON.stringify(await readJson(contentJsonFile), null, 2);

    entries.push({
      id: entry.id,
      keys: entry.keys ?? [],
      secondary_keys: entry.secondary_keys ?? [],
      comment: entry.comment ?? '',
      content,
      constant: entry.constant ?? false,
      selective: entry.selective ?? false,
      insertion_order: entry.insertion_order ?? 100,
      enabled: entry.enabled ?? true,
      position: positionNumber === 0 ? 'before_char' : 'after_char',
      use_regex: entry.use_regex ?? false,
      extensions: {
        ...defaultEntryExtensions,
        ...(entry.extensions ?? {}),
        position: positionNumber,
        depth,
      },
    });
  }
  return {
    name: source.name,
    description: source.description ?? '',
    extensions: source.extensions ?? {},
    entries,
  };
}

async function materializeHelperScripts(relativePath) {
  const scripts = await readJson(relativePath);
  return Promise.all(scripts.map(async rawScript => {
    const { content_file: contentFile, ...script } = rawScript;
    return { ...script, content: await readText(contentFile) };
  }));
}

async function materializeRegexScripts(relativePath) {
  const scripts = await readJson(relativePath);
  return Promise.all(scripts.map(async rawScript => {
    const { replace_file: replaceFile, ...script } = rawScript;
    if (!replaceFile) return script;
    const html = await readText(replaceFile);
    return { ...script, replaceString: `\`\`\`html\n${html}\n\`\`\`` };
  }));
}

const manifest = await readJson('manifest.json');
const profile = await readJson(manifest.profile);
const contract = await readJson(manifest.contract);
const cardSource = await readJson(manifest.card.metadata);
const worldbook = await materializeWorldbook(manifest.worldbook.source);
const helperScripts = await materializeHelperScripts(manifest.tavern_helper_scripts);
const regexScripts = await materializeRegexScripts(manifest.regex_scripts);

if (manifest.version !== profile.version || manifest.version !== contract.version || manifest.version !== cardSource.character_version) {
  throw new Error('manifest、profile、contract 与角色卡版本不一致');
}
if (worldbook.extensions?.tavernweave?.id !== manifest.worldbook.stable_id ||
    worldbook.extensions?.tavernweave?.version !== manifest.worldbook.version) {
  throw new Error('世界书稳定 ID 或版本与 manifest 不一致');
}

const [
  description,
  systemPrompt,
  postHistoryInstructions,
  firstMessage,
  exampleDialogue,
] = await Promise.all([
  readText(manifest.card.description),
  readText(manifest.card.system_prompt),
  readText(manifest.card.post_history_instructions),
  readText(manifest.card.first_message),
  readText(manifest.card.example_dialogue),
]);

const extensions = {
  talkativeness: cardSource.talkativeness,
  fav: cardSource.fav,
  world: worldbook.name,
  depth_prompt: {
    prompt: '',
    depth: 4,
    role: 'system',
  },
  regex_scripts: regexScripts,
  tavern_helper: {
    scripts: helperScripts,
  },
  mvu_worldbook_name: worldbook.name,
  tavernweave: {
    card_id: manifest.card.stable_id,
    card_type: profile.primary_card_type,
    version: manifest.version,
    worldbook_id: manifest.worldbook.stable_id,
    worldbook_version: manifest.worldbook.version,
    runtime_dependencies: manifest.runtime_dependencies,
  },
};

const data = {
  name: cardSource.name,
  description,
  personality: '',
  scenario: '系统觉醒日的傍晚，血锯药剂店的魂灯亮着；林恩刚刚写完日记，门外传来第一位病患的敲门声。',
  first_mes: firstMessage,
  mes_example: exampleDialogue,
  creator_notes: cardSource.creator_notes,
  system_prompt: systemPrompt,
  post_history_instructions: postHistoryInstructions,
  alternate_greetings: [],
  tags: cardSource.tags,
  creator: cardSource.creator,
  character_version: cardSource.character_version,
  character_book: worldbook,
  extensions,
};

const packed = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  name: data.name,
  description: data.description,
  personality: data.personality,
  scenario: data.scenario,
  first_mes: data.first_mes,
  mes_example: data.mes_example,
  creator_notes: data.creator_notes,
  system_prompt: data.system_prompt,
  post_history_instructions: data.post_history_instructions,
  alternate_greetings: data.alternate_greetings,
  tags: data.tags,
  creator: data.creator,
  character_version: data.character_version,
  extensions: data.extensions,
  data,
};

const outputPath = sourcePath(manifest.packed_json);
await mkdir(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
const serialized = `${JSON.stringify(packed, null, 2)}\n`;
await writeFile(temporaryPath, serialized, 'utf8');
await rename(temporaryPath, outputPath);

console.log(JSON.stringify({
  status: 'built',
  card_type: profile.primary_card_type,
  output: relative(projectRoot, outputPath).replaceAll('\\', '/'),
  worldbook_entries: worldbook.entries.length,
  helper_scripts: helperScripts.length,
  regex_scripts: regexScripts.length,
  bytes: Buffer.byteLength(serialized),
}, null, 2));
