#!/usr/bin/env node
// 角色卡原位替换器：用新卡覆盖旧卡的头像槽位，保留全部聊天，并安全清理旧卡独占绑定的世界书。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as session from '../核心/tavern-session.mjs';
import {
  embedCardInPng,
  getBoundWorldbookName,
  getEmbeddedWorldbook,
  loadCardFile,
  parsePngCardBuffer,
  prepareReplacementCard,
  sha256,
  summarizeCard,
} from './card-file.mjs';

const outputRoot = resolve(process.env.ST_OUTPUT_DIR || process.cwd(), 'st-bridge-output');

const HELP = `
replace-card — 保留聊天的角色卡原位替换器

用法:
  npm run replace-card -- <旧角色名> <新卡.json|新卡.png> --dry-run
  npm run replace-card -- <旧角色名> <新卡.json|新卡.png> --confirm-target <旧角色名>

行为:
  - 新卡写入旧卡原头像文件槽位，不先删除旧卡；全部聊天继续归属同一头像槽位。
  - 新卡内嵌世界书会创建或更新；若新旧世界书不同，精确删除旧卡绑定的旧世界书。
  - 若旧世界书还被其他角色卡绑定，写入前拒绝替换；无关世界书不会被删除。
  - 新卡的绑定世界书名与内嵌世界书名不一致时，写入前拒绝替换。
  - 覆盖前自动备份旧卡 PNG、全部聊天和相关世界书。
  - 覆盖后逐项核对角色名、头像槽位、聊天指纹、世界书、正则和助手脚本。
  - 校验失败会自动恢复旧卡和覆盖前的世界书快照。

选项:
  --dry-run                  只检查目标、来源、聊天和世界书，不写入
  --confirm-target <角色名>  实际替换必需，且必须与位置参数中的旧角色名逐字一致
  --json                     输出 JSON
  --url <地址>               酒馆地址（默认 env ST_URL 或 http://127.0.0.1:8000）
  --headed                   显示浏览器窗口
  --channel <通道>           msedge（默认）或 chromium
  help                       显示本帮助
`;

function parseArgs(argv) {
  const flags = { url: process.env.ST_URL || 'http://127.0.0.1:8000' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--headed') flags.headed = true;
    else if (arg === '--url') flags.url = argv[++i];
    else if (arg === '--channel') flags.channel = argv[++i];
    else if (arg === '--confirm-target') flags.confirmTarget = argv[++i];
    else if (arg.startsWith('--')) throw new Error(`未知选项：${arg}`);
    else positional.push(arg);
  }
  return { args: positional, flags };
}

function fingerprints(chats) {
  return Object.fromEntries(Object.entries(chats || {}).map(([id, messages]) => [id, {
    messageCount: Array.isArray(messages) ? messages.length : null,
    sha256: sha256(messages),
  }]));
}

function worldbookEntryCount(worldbook) {
  return Object.values(worldbook || {}).filter((entry) => entry && typeof entry === 'object' && 'content' in entry).length;
}

function safeSegment(value) {
  const cleaned = String(value).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  return cleaned.slice(0, 80) || 'character';
}

function makeBackup(state, source, preparedSummary) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(outputRoot, 'backups', 'card-replace', `${safeSegment(state.target.name)}-${stamp}`);
  mkdirSync(backupDir, { recursive: true });
  const oldPng = Buffer.from(state.avatarPngBase64, 'base64');
  writeFileSync(join(backupDir, 'old-card.png'), oldPng);
  writeFileSync(join(backupDir, 'chats.json'), JSON.stringify(state.chats, null, 2), 'utf8');
  writeFileSync(join(backupDir, 'worldbooks.json'), JSON.stringify(state.worldbooks, null, 2), 'utf8');
  const manifest = {
    createdAt: new Date().toISOString(),
    versions: state.versions,
    target: state.target,
    source: { path: source.path, sha256: source.sha256, summary: source.summary },
    preparedSummary,
    oldCardSha256: sha256(oldPng),
    chats: fingerprints(state.chats),
    worldbooks: Object.fromEntries(Object.entries(state.worldbooks).map(([name, book]) => [name, {
      entryCount: worldbookEntryCount(book),
      sha256: sha256(book),
    }])),
  };
  writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { backupDir, manifest };
}

function planWorldbookTransition(state, preparedSummary, embeddedBook, newBoundWorldbookName) {
  const oldName = state.target.oldWorldbookName || '';
  const embeddedName = embeddedBook?.name || '';
  const newBoundName = String(newBoundWorldbookName || '').trim();
  const embeddedNameMismatch = !!newBoundName && !!embeddedName && newBoundName !== embeddedName;
  const newName = newBoundName || embeddedName || preparedSummary.worldbookName || '';
  const oldExists = !!oldName && state.worldbookNames.includes(oldName);
  const sameName = !!oldName && oldName === newName;
  const otherReferences = oldName
    ? (state.worldbookBindings || []).filter((item) => item.worldbook === oldName && item.avatar !== state.target.avatar)
    : [];
  const deleteRequired = oldExists && !sameName;
  const newWorldbookReady = !newName || !!embeddedBook || state.worldbookNames.includes(newName);
  return {
    oldName: oldName || null,
    newName: newName || null,
    newBoundName: newBoundName || null,
    embeddedName: embeddedName || null,
    embeddedNameMismatch,
    oldExists,
    sameName,
    deleteRequired,
    otherReferences,
    sharedDeletionBlocked: deleteRequired && otherReferences.length > 0,
    newWorldbookReady,
  };
}

function buildDryRun(state, source, preparedSummary, transition) {
  const duplicate = state.characterNames.find((name) => name === source.summary.name && name !== state.target.name) || null;
  return {
    dryRun: true,
    allowed: !duplicate
      && !transition.sharedDeletionBlocked
      && !transition.embeddedNameMismatch
      && transition.newWorldbookReady,
    target: state.target,
    source: { path: source.path, sha256: source.sha256, summary: source.summary },
    preparedSummary,
    chats: {
      count: Object.keys(state.chats || {}).length,
      fingerprints: fingerprints(state.chats),
      preservedByAvatarSlot: state.target.avatar,
    },
    worldbooks: {
      old: transition.oldName,
      oldExists: transition.oldExists,
      oldWillBeDeleted: transition.deleteRequired && !transition.sharedDeletionBlocked,
      oldDeleteBlockedBy: transition.otherReferences,
      sameNameWillBeUpdated: transition.sameName,
      new: transition.newName,
      newBoundName: transition.newBoundName,
      embeddedName: transition.embeddedName,
      embeddedNameMismatch: transition.embeddedNameMismatch,
      newEntries: source.summary.worldbookEntryCount,
      newAlreadyExists: transition.newName ? state.worldbookNames.includes(transition.newName) : false,
      newWorldbookReady: transition.newWorldbookReady,
    },
    duplicateNewName: duplicate,
    requiredConfirmation: `--confirm-target "${state.target.name}"`,
  };
}

function compareReplacement(before, after, expected, afterCardSummary, embeddedBook, transition) {
  const checks = {
    avatarSlotPreserved: after.target.avatar === before.target.avatar,
    newNameApplied: after.target.name === expected.name,
    chatBindingPreserved: (after.target.chatId ?? null) === (before.target.chatId ?? null),
    chatFilesPreserved: JSON.stringify(fingerprints(after.chats)) === JSON.stringify(fingerprints(before.chats)),
    oldWorldbookHandled: transition.deleteRequired
      ? !after.worldbookNames.includes(transition.oldName)
      : !transition.sameName || after.worldbookNames.includes(transition.oldName),
    newCardBindingApplied: !transition.newBoundName
      || after.target.oldWorldbookName === transition.newBoundName,
    newWorldbookAvailable: !transition.newName || after.worldbookNames.includes(transition.newName),
    newWorldbookEntryCount: !embeddedBook
      || worldbookEntryCount(after.worldbooks[embeddedBook.name]) === embeddedBook.entryCount,
    cardNameMatches: afterCardSummary.name === expected.name,
    cardVersionMatches: afterCardSummary.version === expected.version,
    descriptionMatches: afterCardSummary.descriptionLength === expected.descriptionLength,
    firstMessageMatches: afterCardSummary.firstMessageLength === expected.firstMessageLength,
    regexCountMatches: afterCardSummary.regexCount === expected.regexCount,
    helperScriptCountMatches: afterCardSummary.helperScriptCount === expected.helperScriptCount,
    embeddedWorldbookMatches: afterCardSummary.worldbookName === expected.worldbookName
      && afterCardSummary.worldbookEntryCount === expected.worldbookEntryCount,
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

function render(result) {
  if (result.dryRun) {
    return [
      `[dry-run] ${result.target.name}（${result.target.avatar}） → ${result.source.summary.name}`,
      `聊天：${result.chats.count} 个，将按原头像槽位保留`,
      `世界书：旧 ${result.worldbooks.old || '（无）'} ${result.worldbooks.oldWillBeDeleted ? '将精确删除' : result.worldbooks.sameNameWillBeUpdated ? '与新版同名，将原位更新' : '无需删除'}；新 ${result.worldbooks.new || '（无）'} ${result.worldbooks.newAlreadyExists ? '将更新' : '将创建'}`,
      result.worldbooks.oldDeleteBlockedBy.length
        ? `拒绝：旧世界书还被 ${result.worldbooks.oldDeleteBlockedBy.map((item) => item.name).join('、')} 绑定`
        : result.worldbooks.embeddedNameMismatch
          ? `拒绝：新卡绑定世界书与内嵌世界书名称不一致（${result.worldbooks.newBoundName} / ${result.worldbooks.embeddedName}）`
        : result.duplicateNewName ? `拒绝：新角色名已存在 ${result.duplicateNewName}` : `实际执行需：${result.requiredConfirmation}`,
    ].join('\n');
  }
  return [
    `已原位替换：${result.before.name} → ${result.after.name}`,
    `头像槽位：${result.after.avatar}（未改变）`,
    `聊天：${result.chatCount} 个，指纹全部一致`,
    `旧世界书：${result.worldbooks.old || '（无）'}（${result.worldbooks.oldDeleted ? '已删除' : result.worldbooks.sameNameUpdated ? '与新版同名，已更新' : '原本不存在'}）`,
    `新世界书：${result.worldbooks.new || '（无）'}${result.worldbooks.new ? `（${result.worldbooks.newEntries} 条）` : ''}`,
    `备份：${result.backupDir}`,
    `校验：${Object.keys(result.verification.checks).length}/${Object.keys(result.verification.checks).length} 通过`,
  ].join('\n');
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h' || args.length === 0) {
    console.log(HELP);
    return;
  }
  if (args.length !== 2) throw new Error(`用法：replace-card <旧角色名> <新卡.json|新卡.png>\n${HELP}`);
  const [targetName, sourcePath] = args;
  if (!existsSync(resolve(sourcePath))) throw new Error(`新卡文件不存在：${resolve(sourcePath)}`);
  if (!flags.dryRun && flags.confirmTarget !== targetName) {
    throw new Error(`实际替换必须提供逐字一致的 --confirm-target "${targetName}"；建议先运行 --dry-run`);
  }
  if (targetName === 'SillyTavern System') throw new Error('拒绝替换 SillyTavern System');

  const source = loadCardFile(sourcePath);
  const embeddedBook = getEmbeddedWorldbook(source.card);
  const { browser, page } = await session.connect(flags.url, flags);
  let before = null;
  let backup = null;
  let writeAttempted = false;
  try {
    before = await session.captureCharacterReplacementState(page, targetName, embeddedBook ? [embeddedBook.name] : []);
    const duplicate = before.characterNames.find((name) => name === source.summary.name && name !== targetName);
    if (duplicate) throw new Error(`新角色名已存在另一张卡，拒绝制造同名角色：${duplicate}`);
    const preparedCard = prepareReplacementCard(source.card, before.target.chatId);
    const preparedSummary = summarizeCard(preparedCard);
    const newBoundWorldbookName = getBoundWorldbookName(preparedCard);
    const transition = planWorldbookTransition(before, preparedSummary, embeddedBook, newBoundWorldbookName);
    const dryRun = buildDryRun(before, source, preparedSummary, transition);
    if (flags.dryRun) {
      console.log(flags.json ? JSON.stringify(dryRun, null, 2) : render(dryRun));
      return;
    }
    if (transition.sharedDeletionBlocked) {
      throw new Error(`旧世界书 ${transition.oldName} 还被其他角色卡绑定，拒绝替换以避免误删：${transition.otherReferences.map((item) => `${item.name}（${item.avatar}）`).join('、')}`);
    }
    if (transition.embeddedNameMismatch) {
      throw new Error(`新卡绑定世界书名与内嵌世界书名不一致，拒绝替换：${transition.newBoundName} / ${transition.embeddedName}`);
    }
    if (!transition.newWorldbookReady) {
      throw new Error(`新卡绑定世界书 ${transition.newName}，但文件未内嵌该世界书且酒馆中也不存在，拒绝替换`);
    }

    backup = makeBackup(before, source, preparedSummary);
    const basePng = source.sourcePng || Buffer.from(before.avatarPngBase64, 'base64');
    const replacementPng = embedCardInPng(basePng, preparedCard);
    writeFileSync(join(backup.backupDir, 'prepared-new-card.png'), replacementPng);
    writeAttempted = true;
    const apply = await session.importCharacterPngInPlace(page, {
      targetName,
      expectedAvatar: before.target.avatar,
      newName: preparedSummary.name,
      pngBase64: replacementPng.toString('base64'),
      embeddedWorldbook: embeddedBook,
      preservedChatId: before.target.chatId,
    });
    const worldbookCleanup = await session.deleteReplacedCardWorldbook(page, {
      oldWorldbookName: transition.oldName,
      newWorldbookName: transition.newName,
    });

    const requestedBooks = [transition.oldName, transition.newName].filter(Boolean);
    const after = await session.captureCharacterReplacementState(page, preparedSummary.name, requestedBooks);
    const persistedCard = parsePngCardBuffer(Buffer.from(after.avatarPngBase64, 'base64')).card;
    const persistedSummary = summarizeCard(persistedCard);
    const verification = compareReplacement(before, after, preparedSummary, persistedSummary, embeddedBook, transition);
    if (!verification.passed) {
      throw new Error(`替换后校验失败：${JSON.stringify(verification.checks)}`);
    }

    const result = {
      replaced: true,
      before: { name: before.target.name, avatar: before.target.avatar },
      after: { name: after.target.name, avatar: after.target.avatar },
      source: { path: source.path, sha256: source.sha256, summary: source.summary },
      chatCount: Object.keys(after.chats || {}).length,
      worldbooks: {
        old: transition.oldName,
        oldDeleted: worldbookCleanup.deleted === true,
        sameNameUpdated: transition.sameName,
        new: transition.newName,
        newEntries: embeddedBook?.entryCount ?? 0,
      },
      backupDir: backup.backupDir,
      apply,
      worldbookCleanup,
      verification,
    };
    console.log(flags.json ? JSON.stringify(result, null, 2) : render(result));
  } catch (error) {
    let rollback = null;
    if (writeAttempted && before && backup) {
      try {
        const oldPng = Buffer.from(before.avatarPngBase64, 'base64');
        const oldCard = parsePngCardBuffer(oldPng).card;
        await session.importCharacterPngInPlace(page, {
          targetName: source.summary.name,
          expectedAvatar: before.target.avatar,
          newName: before.target.name,
          pngBase64: before.avatarPngBase64,
          embeddedWorldbook: getEmbeddedWorldbook(oldCard),
          preservedChatId: before.target.chatId,
        });
        const newlyCreatedBooks = embeddedBook && !Object.hasOwn(before.worldbooks, embeddedBook.name)
          ? [embeddedBook.name]
          : [];
        const worlds = await session.restoreWorldbookSnapshots(page, before.worldbooks, newlyCreatedBooks);
        rollback = { restored: true, worlds, backupDir: backup.backupDir };
      } catch (rollbackError) {
        rollback = { restored: false, error: String(rollbackError?.message || rollbackError), backupDir: backup.backupDir };
      }
    }
    const detail = rollback ? `${error?.message || error}\n回滚：${JSON.stringify(rollback)}` : String(error?.message || error);
    throw new Error(detail);
  } finally {
    await session.closeSession({ browser });
  }
}

main().catch((error) => {
  console.error(`[replace-card] 错误：${error?.message || error}`);
  process.exit(1);
});
