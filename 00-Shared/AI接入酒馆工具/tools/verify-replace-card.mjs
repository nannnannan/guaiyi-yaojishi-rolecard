// 写入型集成测试：仅创建并清理带时间戳的临时角色卡/聊天/世界书。
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import * as session from '../核心/tavern-session.mjs';
import { sha256 } from '../角色卡替换器/card-file.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const replacer = join(root, '角色卡替换器', 'replace-card.mjs');
const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:8000';
const token = `${Date.now()}-${process.pid}`;
const oldName = `Codex替换测试旧卡-${token}`;
const newName = `Codex替换测试新卡-${token}`;
const newerName = `Codex替换测试再升级卡-${token}`;
const guardName = `Codex替换测试共享引用卡-${token}`;
const oldBook = `Codex替换测试旧世界书-${token}`;
const newBook = `Codex替换测试新世界书-${token}`;
const newerBook = `Codex替换测试再升级世界书-${token}`;
const controlBook = `Codex替换测试无关世界书-${token}`;
const marker = `replace-chat-marker-${token}`;
const tempDir = mkdtempSync(join(tmpdir(), 'st-replace-card-'));
const oldFile = join(tempDir, 'old.json');
const newFile = join(tempDir, 'new.json');
const newerFile = join(tempDir, 'newer.json');
const guardFile = join(tempDir, 'guard.json');
const backupDirs = [];

function makeCard(name, version, bookName, withEmbeddedBook, markerText, count = 1) {
  const regexes = Array.from({ length: count }, (_, index) => ({
    id: `${name}-regex-${index}`,
    script_name: `${name}正则${index + 1}`,
    enabled: true,
    find_regex: `<${index}>`,
    replace_string: `[${markerText}-${index}]`,
    source: { user_input: false, ai_output: true, slash_command: false, world_info: false, reasoning: false },
    destination: { display: true, prompt: false },
    run_on_edit: true,
  }));
  const scripts = Array.from({ length: count }, (_, index) => ({
    type: 'script',
    enabled: true,
    name: `${name}脚本${index + 1}`,
    id: `${name}-script-${index}`,
    content: `window.__replaceCardTest = ${JSON.stringify(`${markerText}-${index}`)};`,
    info: '角色卡替换器临时测试脚本',
    button: [],
    data: {},
  }));
  const data = {
    name,
    description: `${markerText}-description`,
    personality: `${markerText}-personality`,
    scenario: `${markerText}-scenario`,
    first_mes: `${markerText}-first-message`,
    mes_example: '',
    creator_notes: '角色卡替换器临时测试卡',
    system_prompt: `${markerText}-system`,
    post_history_instructions: '',
    alternate_greetings: [],
    tags: ['Codex临时测试'],
    creator: 'Codex',
    character_version: version,
    extensions: {
      world: bookName,
      regex_scripts: regexes,
      tavern_helper: { scripts, variables: {} },
    },
  };
  if (withEmbeddedBook) {
    data.character_book = {
      name: bookName,
      description: '替换器临时测试世界书',
      extensions: {},
      entries: [{
        id: 0,
        keys: ['replace-test'],
        secondary_keys: [],
        comment: `${markerText}-entry`,
        content: `${markerText}-worldbook-content`,
        constant: true,
        selective: false,
        insertion_order: 100,
        enabled: true,
        position: 'before_char',
        extensions: { exclude_recursion: true, prevent_recursion: true },
      }],
    };
  }
  return { spec: 'chara_card_v3', spec_version: '3.0', name, ...data, data };
}

function chatFingerprints(chats) {
  return Object.fromEntries(Object.entries(chats || {}).map(([id, messages]) => [id, {
    count: Array.isArray(messages) ? messages.length : null,
    sha256: sha256(messages),
  }]));
}

function runReplacer(args) {
  const result = spawnSync(process.execPath, [replacer, ...args, '--url', url, '--json'], {
    encoding: 'utf8',
    timeout: 180000,
  });
  if (result.status !== 0) throw new Error(`replace-card 失败：${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function runReplacerExpectFailure(args) {
  const result = spawnSync(process.execPath, [replacer, ...args, '--url', url, '--json'], {
    encoding: 'utf8',
    timeout: 180000,
  });
  if (result.status === 0) throw new Error(`replace-card 本应拒绝但成功了：${result.stdout}`);
  return { status: result.status, output: `${result.stderr || ''}${result.stdout || ''}` };
}

async function setup() {
  const { browser, page } = await session.connect(url);
  try {
    const existing = await page.evaluate(async () => ({
      characters: await TavernHelper.getCharacterNames(),
      worldbooks: await TavernHelper.getWorldbookNames(),
    }));
    for (const name of [oldName, newName, newerName, guardName]) {
      if (existing.characters.includes(name)) throw new Error(`测试角色名碰撞：${name}`);
    }
    for (const name of [oldBook, newBook, newerBook, controlBook]) {
      if (existing.worldbooks.includes(name)) throw new Error(`测试世界书名碰撞：${name}`);
    }
    const imported = await session.importCharacterFile(page, oldFile);
    if (imported.name !== oldName) throw new Error(`旧测试卡导入名异常：${imported.name}`);
    const guardImported = await session.importCharacterFile(page, guardFile);
    if (guardImported.name !== guardName) throw new Error(`共享引用测试卡导入名异常：${guardImported.name}`);
    await page.evaluate(async ({ oldBook, controlBook, marker }) => {
      await TavernHelper.createOrReplaceWorldbook(oldBook, [{
        uid: 0,
        name: `${marker}-old-entry`,
        content: `${marker}-old-worldbook-content`,
        enabled: true,
        strategy: { type: 'constant' },
        position: { type: 'before_character_definition', order: 100 },
      }], { render: 'immediate' });
      await TavernHelper.createOrReplaceWorldbook(controlBook, [{
        uid: 0,
        name: `${marker}-control-entry`,
        content: `${marker}-control-worldbook-content`,
        enabled: true,
        strategy: { type: 'constant' },
        position: { type: 'before_character_definition', order: 100 },
      }], { render: 'immediate' });
    }, { oldBook, controlBook, marker });
    await session.switchCharacter(page, oldName, false);
    const sent = await session.execSlash(page, `/send ${marker}`);
    if (!sent.ok) throw new Error(`创建测试聊天消息失败：${sent.error}`);
    await page.waitForTimeout(800);
    await page.evaluate(async () => await SillyTavern.getContext().saveChat());
    return await session.captureCharacterReplacementState(page, oldName, [oldBook, newBook, controlBook]);
  } finally {
    await session.closeSession({ browser });
  }
}

async function verify(before, replacementResult) {
  const { browser, page } = await session.connect(url);
  try {
    const after = await session.captureCharacterReplacementState(page, newName, [oldBook, newBook, controlBook]);
    const beforeChats = chatFingerprints(before.chats);
    const afterChats = chatFingerprints(after.chats);
    const newWorldbookEntryCount = Object.values(after.worldbooks[newBook] || {}).filter((entry) => entry && 'content' in entry).length;
    const checks = {
      cliReportedSuccess: replacementResult.replaced === true,
      renamed: after.target.name === newName,
      avatarSlotPreserved: after.target.avatar === before.target.avatar,
      chatBindingPreserved: after.target.chatId === before.target.chatId,
      chatsByteStable: JSON.stringify(afterChats) === JSON.stringify(beforeChats),
      chatMarkerPresent: Object.values(after.chats).some((messages) => JSON.stringify(messages).includes(marker)),
      oldWorldbookDeleted: !after.worldbookNames.includes(oldBook),
      newWorldbookCreated: after.worldbookNames.includes(newBook),
      unrelatedWorldbookPreserved: after.worldbookNames.includes(controlBook),
      newWorldbookOneEntry: newWorldbookEntryCount === 1,
      twoRegexes: after.target.regexCount === 2,
      twoHelperScripts: after.target.helperScriptCount === 2,
    };
    return {
      passed: Object.values(checks).every(Boolean),
      checks,
      beforeChats,
      afterChats,
      newWorldbookEntryCount,
      newWorldbookSnapshotKeys: Object.keys(after.worldbooks[newBook] || {}),
    };
  } finally {
    await session.closeSession({ browser });
  }
}

async function removeSharedReferenceGuard() {
  const { browser, page } = await session.connect(url);
  try {
    const names = await page.evaluate(async () => await TavernHelper.getCharacterNames());
    if (names.includes(guardName)) {
      const result = await session.deleteCharacterCard(page, guardName);
      if (!result.ok) throw new Error(`共享引用测试卡删除失败：${result.err}`);
    }
  } finally {
    await session.closeSession({ browser });
  }
}

async function cleanup() {
  const { browser, page } = await session.connect(url);
  try {
    const names = await page.evaluate(async () => await TavernHelper.getCharacterNames());
    for (const name of [newerName, newName, guardName, oldName]) {
      if (names.includes(name)) await session.deleteCharacterCard(page, name);
    }
    await page.evaluate(async (books) => {
      const names = await TavernHelper.getWorldbookNames();
      for (const name of books) if (names.includes(name)) await TavernHelper.deleteWorldbook(name);
    }, [oldBook, newBook, newerBook, controlBook]);
  } finally {
    await session.closeSession({ browser });
  }
}

async function main() {
  writeFileSync(oldFile, JSON.stringify(makeCard(oldName, 'test-old', oldBook, false, 'old', 1), null, 2), 'utf8');
  writeFileSync(newFile, JSON.stringify(makeCard(newName, 'test-new', newBook, true, 'new', 2), null, 2), 'utf8');
  writeFileSync(newerFile, JSON.stringify(makeCard(newerName, 'test-newer', newerBook, true, 'newer', 3), null, 2), 'utf8');
  writeFileSync(guardFile, JSON.stringify(makeCard(guardName, 'test-guard', oldBook, false, 'guard', 1), null, 2), 'utf8');
  let finalReport = null;
  try {
    const before = await setup();
    const guardedDryRun = runReplacer([oldName, newFile, '--dry-run']);
    if (guardedDryRun.allowed !== false
      || guardedDryRun.worldbooks.oldDeleteBlockedBy?.[0]?.name !== guardName) {
      throw new Error(`共享世界书 dry-run 未正确阻止删除：${JSON.stringify(guardedDryRun.worldbooks)}`);
    }
    const guardedWrite = runReplacerExpectFailure([oldName, newFile, '--confirm-target', oldName]);
    if (!guardedWrite.output.includes(guardName) || !guardedWrite.output.includes(oldBook)) {
      throw new Error(`共享世界书实际写入拒绝信息不完整：${guardedWrite.output}`);
    }
    const { browser: refusalBrowser, page: refusalPage } = await session.connect(url);
    let afterRefusal;
    try {
      afterRefusal = await session.captureCharacterReplacementState(
        refusalPage,
        oldName,
        [oldBook, newBook, controlBook],
      );
    } finally {
      await session.closeSession({ browser: refusalBrowser });
    }
    const refusalChecks = {
      originalCardStillPresent: afterRefusal.target.name === before.target.name,
      avatarSlotUnchanged: afterRefusal.target.avatar === before.target.avatar,
      chatBindingUnchanged: afterRefusal.target.chatId === before.target.chatId,
      chatsByteStable: JSON.stringify(chatFingerprints(afterRefusal.chats))
        === JSON.stringify(chatFingerprints(before.chats)),
      oldWorldbookStillPresent: afterRefusal.worldbookNames.includes(oldBook),
      newWorldbookNotCreated: !afterRefusal.worldbookNames.includes(newBook),
      unrelatedWorldbookStillPresent: afterRefusal.worldbookNames.includes(controlBook),
      guardStillReferencesOldWorldbook: afterRefusal.worldbookBindings.some(
        (item) => item.name === guardName && item.worldbook === oldBook,
      ),
    };
    if (!Object.values(refusalChecks).every(Boolean)) {
      throw new Error(`共享引用拒绝后发生了意外改动：${JSON.stringify(refusalChecks)}`);
    }
    await removeSharedReferenceGuard();
    const dryRun = runReplacer([oldName, newFile, '--dry-run']);
    if (!dryRun.dryRun || !dryRun.allowed || !dryRun.worldbooks.oldWillBeDeleted
      || dryRun.target.name !== oldName || dryRun.source.summary.name !== newName) {
      throw new Error('dry-run 结果不符合预期');
    }
    const replacement = runReplacer([oldName, newFile, '--confirm-target', oldName]);
    backupDirs.push(replacement.backupDir);
    const verification = await verify(before, replacement);
    if (!verification.passed) throw new Error(`端到端校验失败：${JSON.stringify(verification)}`);

    const secondDryRun = runReplacer([newName, newerFile, '--dry-run']);
    if (!secondDryRun.dryRun || secondDryRun.target.name !== newName || secondDryRun.source.summary.name !== newerName) {
      throw new Error('第二次升级 dry-run 结果不符合预期');
    }
    const secondReplacement = runReplacer([newName, newerFile, '--confirm-target', newName]);
    backupDirs.push(secondReplacement.backupDir);
    const { browser, page } = await session.connect(url);
    let secondAfter;
    try {
      secondAfter = await session.captureCharacterReplacementState(page, newerName, [oldBook, newBook, newerBook, controlBook]);
    } finally {
      await session.closeSession({ browser });
    }
    const secondChats = chatFingerprints(secondAfter.chats);
    const secondChecks = {
      cliReportedSuccess: secondReplacement.replaced === true,
      renamedAgain: secondAfter.target.name === newerName,
      originalAvatarSlotStillPreserved: secondAfter.target.avatar === before.target.avatar,
      originalChatBindingStillPreserved: secondAfter.target.chatId === before.target.chatId,
      originalChatsStillByteStable: JSON.stringify(secondChats) === JSON.stringify(verification.beforeChats),
      firstOldWorldbookStillDeleted: !secondAfter.worldbookNames.includes(oldBook),
      firstNewWorldbookDeletedAfterSecondUpgrade: !secondAfter.worldbookNames.includes(newBook),
      newestWorldbookCreated: secondAfter.worldbookNames.includes(newerBook),
      unrelatedWorldbookStillPreserved: secondAfter.worldbookNames.includes(controlBook),
      threeRegexes: secondAfter.target.regexCount === 3,
      threeHelperScripts: secondAfter.target.helperScriptCount === 3,
    };
    if (!Object.values(secondChecks).every(Boolean)) {
      throw new Error(`连续升级校验失败：${JSON.stringify({ secondChecks, secondChats })}`);
    }
    finalReport = {
      passed: true,
      testCard: { oldName, newName, newerName, avatar: secondReplacement.after.avatar },
      chats: secondChats,
      worldbooks: {
        oldDeleted: oldBook,
        firstNewDeletedOnSecondUpgrade: newBook,
        newestCreated: newerBook,
        unrelatedPreserved: controlBook,
      },
      checks: {
        sharedReferenceGuard: {
          dryRunBlocked: true,
          actualWriteBlockedBeforeMutation: true,
          blockingCharacter: guardName,
          refusalChecks,
        },
        firstReplacement: verification.checks,
        secondReplacement: secondChecks,
      },
    };
  } finally {
    await cleanup().catch((error) => {
      if (finalReport) finalReport.cleanupError = String(error?.message || error);
      else throw error;
    });
    for (const backupDir of backupDirs) {
      if (backupDir && backupDir.startsWith(join(root, 'backups', 'card-replace')) && existsSync(backupDir)) {
        rmSync(backupDir, { recursive: true, force: true });
      }
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
  console.log(JSON.stringify(finalReport, null, 2));
}

main().catch((error) => {
  console.error(`[verify-replace-card] ${error?.stack || error}`);
  process.exit(1);
});
