import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
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
const tempName = process.env.ST_TEST_CARD_NAME
  || '《诡异药剂师》v0.5-E06回归-20260810-B';
const sampleLabel = process.env.ST_SAMPLE_LABEL || 'sample-a';
const tempCardPath = resolve(evidenceDir, '诡异药剂师_v0.5_E06回归_临时卡.json');
// SillyTavern names an imported worldbook from the filename stem. Keep the
// filename exactly equal to the temporary card/worldbook name so the bound
// character-book reference resolves after a real host reload.
const tempWorldbookPath = resolve(evidenceDir, `${tempName}.json`);
const preparedPath = resolve(evidenceDir, 'runtime-e06-prepared.json');
const checkpointPath = resolve(evidenceDir, `${sampleLabel}-runtime-e06-checkpoint.json`);
const evidencePath = resolve(evidenceDir, `${sampleLabel}-runtime-e06-player-simulation.json`);
const cleanupPath = resolve(evidenceDir, 'runtime-e06-cleanup.json');
const diagnosticPath = resolve(evidenceDir, `${sampleLabel}-runtime-e06-initialization-diagnostic.json`);
const screenshotPath = resolve(evidenceDir, `${sampleLabel}-runtime-e06-final.png`);
const bridgeSessionPath = process.env.ST_BRIDGE_SESSION
  || 'C:/Users/huang/.codex/skills/sillytavern-ai-bridge/scripts/runtime/核心/tavern-session.mjs';
const promptCapturePath = process.env.ST_PROMPT_CAPTURE_MODULE
  || 'C:/Users/huang/.codex/skills/sillytavern-ai-bridge/scripts/runtime/提示词监听/prompt-capture.mjs';
const url = process.env.ST_URL || 'http://127.0.0.1:8000';
const expectedPreset = process.env.ST_EXPECTED_PRESET || null;
const command = process.argv[2] || 'run';

const expectedArtifact = {
  bytes: 861405,
  sha256: '15b8785c7af412c5dbdec1ce92a7361714a04114b5c4c299d78ccfdd2d9ac910',
  worldbookEntries: 102,
};

const prompts = {
  e02_to_e03: {
    goal: '封存寻母线索，继续营业，触发E03预兆',
    text: '林恩把盘中的头发、耳朵和梳子分别装进干净的密封袋，标记为“血娃娃寻母线索”，暂存到柜台内侧。他擦净手术台，重新点亮柜台灯，继续营业，等待下一位病人。',
  },
  e03_open: {
    goal: '回应E03预兆，让原作病患进入接诊',
    text: '林恩走到门边，保持魂灯照明，打开门让外面捂着腹部的病患进来。他指向诊疗台：“躺下。哪里不舒服，从什么时候开始的？”',
  },
  e03_diagnose: {
    goal: '完成E03诊断并进入手术节点',
    text: '林恩先检查病患腹部的异常蠕动，再取出唤魔药剂进行检测。他明确诊断为恶灵寄生，要求病患保持平躺，立即准备开腹取出寄生物。',
  },
  e03_finish: {
    goal: '完成血婴取出、整容压制和留店，随后继续营业',
    text: '林恩亲自实施开腹手术，完整取出未成型的恶灵血婴并处理切口。猪头病患离开后，他不丢弃血婴，而是为它完成第一次整容，压低怨气，确认状态稳定后将它收留在药店内照看。随后林恩清理诊疗台，继续营业接诊。',
  },
  e03_bridge: {
    goal: 'E03已收束时明确继续营业，触发E04预兆',
    text: '林恩确认血婴已经完成整容压制并被安置在店内。他收好器具，继续营业，等待下一位病患。',
  },
  e04_open: {
    goal: '回应E04预兆并检查猎魔人',
    text: '林恩扶住门口的瘦高男人，让他坐上诊疗椅。他观察缠绕全身的黑气并检查骨骼疼痛位置，要求对方说明中毒经过和可以支付的诊金。',
  },
  e04_finish: {
    goal: '完成黑蝴蝶剧毒治疗和左轮交易，并推进至夜幕',
    text: '林恩明确诊断为黑蝴蝶剧毒，亲自用剔骨刀刮除侵入骨面的毒性组织并完成止血、包扎。治疗结束后，他接受那把受诅咒的传说左轮作为诊金，听完夜晚的危险警告。等猎魔人离店，林恩关好门窗，留在店内观察，直到夜幕降临、魂灯熄灭。',
  },
  e04_bridge: {
    goal: 'E04已收束时推进夜幕，触发E05预兆',
    text: '林恩确认猎魔人的治疗和交易都已经结束。他按警告关好门窗，留在药店里，让时间推进到夜幕降临、魂灯熄灭。',
  },
  e05_enter: {
    goal: '识破血肉欺诈者并等待真正的根源来客',
    text: '林恩没有因为门外模仿老师的声音开门。他隔着门确认对方不是血锯，立刻用怨灵发丝缠住伪装者的脖颈，再用剔骨刀结束威胁。处理完欺诈者后，他仍留在魂灯附近，警惕那阵更沉重的脚步；若对方确实求医，他会先询问病症。',
  },
  e05_accept: {
    goal: '接诊根源来客并定位牙疼原因',
    text: '林恩确认巨大来客是在求医后开门接诊，保持冷静询问牙疼的位置与持续时间。他同意亲自检查口腔，让对方张嘴并配合照明，自己进入口腔寻找病因。',
  },
  e05_extract: {
    goal: '拔出神圣之矛碎片并完成止痛处理',
    text: '林恩在后槽牙处找到造成疼痛的破损神圣之矛，亲手将它完整拔出。他随后调配止痛与修复药剂，和来客的触手配合，把注入药剂的材料稳固填入牙洞，并明确继续寻找足够坚固的补牙材料。',
  },
  e05_finish: {
    goal: '完成钢牙安装、命名小小并推进到E05收尾后的黎明',
    text: '林恩随同来客取得钢性傀儡的钢材，把材料铸造成合适的钢牙并亲手安装，检查咬合与止痛效果都稳定。他为这位病患命名“小小”，确认医患关系建立。返回药店后，林恩留守到黎明，在E05收尾后的店内继续日常并查看留在店里的鬼婴。',
  },
  e05_confirm: {
    goal: '若E05仍活跃，明确确认全部完成并推进E05收尾后的黎明日常',
    text: '林恩再次确认小小的钢牙牢固、牙痛已经消失，命名和诊疗都已完成。他与小小结束本次诊疗，安全返回药店，休整至黎明后继续日常，查看店内收留的鬼婴。',
  },
  e06_bridge: {
    goal: 'E05已收束但E06未触发时推进E05收尾后的黎明日常',
    text: '黎明已经到来。林恩整理完不眠夜留下的器具，继续店内日常，检查昨夜留在药店里的鬼婴和门外动静。',
  },
};

const fatalRuntimePattern = /Identifier .*already been declared|activewi is not defined|getEnabledWorldInfoEntries is not defined|Macro "original".*(?:error|failed)|env\.functions\.original|EJS.*(?:error|failed)|world.?info.*(?:error|failed)|世界书.*(?:异常|失败)|预处理.*(?:异常|失败)|(?:MVU|Zod|Schema|JSON ?Patch).*(?:error|failed|invalid|reject|拒绝|失败)|(?:error|failed|invalid|reject|拒绝|失败).*(?:MVU|Zod|Schema|JSON ?Patch)/i;
const directPlayerSpeechPattern = /林恩(?:说|说道|回答|答道|问道|低声说|笑道|点头说道|摇头说道)[：:“\"]/g;
const calendarLeakPattern = /(?:星期[一二三四五六日天]|周[一二三四五六日天]|(?:第\s*)?(?:\d+|[一二三四五六七八九十百千万]+|好几|好多|很多|数|几|多)\s*天|昨天|昨日|昨夜|今天|今日|今早|今晨|明天|(?<!黎)明日|次日|翌日|第二天|\d{4}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2}\s*日?|\d{1,2}月\d{1,2}日)/g;
const playerAutonomyHeuristicPattern = /(?:毫不犹豫|没有丝毫迟疑|没有(?:丝毫|任何)?(?:畏惧|恐惧)|面无表情|目光冷漠|冷漠地|镇静地|熟练地|准确地|有条不紊(?:地)?|没有理会|坐回(?:高脚凳|魂灯光照下的柜台)|坐在高脚凳|手里捏着|抬起头|端坐|双手交叉|冷眼旁观|毫无波澜|静静地等待|安静地等待|留在位置上等待|安静地留在位置上|心中[^。！？\n]{0,28}(?:判断|认为|明白|意识|恐惧|畏惧|决定|想))/g;
const playerScopedMicroActionPattern = /(?:林恩|你)[^。！？\n]{0,60}(?:稳稳(?:地)?|戴着皮手套|给手套[^。！？\n]{0,12}消毒)/g;
const undeclaredActionQualityPattern = /(?:(?:精准|飞快)(?:地)?(?:补刀|检查|操作|切开|拔出|安装|处理|清理|擦净|缝合)|仔细(?:地)?(?:检查|操作|处理|安装|观察))/g;

async function prepareTempCard() {
  const artifactText = await readFile(artifactPath, 'utf8');
  const artifactBuffer = Buffer.from(artifactText);
  const sourceSha256 = createHash('sha256').update(artifactBuffer).digest('hex');
  const card = JSON.parse(artifactText);
  const entryCount = card.data?.character_book?.entries?.length ?? 0;
  if (artifactBuffer.byteLength !== expectedArtifact.bytes) throw new Error(`产物字节不匹配：${artifactBuffer.byteLength}`);
  if (sourceSha256 !== expectedArtifact.sha256) throw new Error(`产物哈希不匹配：${sourceSha256}`);
  if (entryCount !== expectedArtifact.worldbookEntries) throw new Error(`世界书条目不匹配：${entryCount}`);
  card.name = tempName;
  card.data.name = tempName;
  for (const extensions of [card.extensions, card.data.extensions]) {
    if (!extensions) continue;
    extensions.world = tempName;
    extensions.mvu_worldbook_name = tempName;
  }
  card.data.character_book.name = tempName;
  await mkdir(evidenceDir, { recursive: true });
  const tempText = `${JSON.stringify(card, null, 2)}\n`;
  const tempWorldbookText = `${JSON.stringify(card.data.character_book, null, 2)}\n`;
  await writeFile(tempCardPath, tempText, 'utf8');
  await writeFile(tempWorldbookPath, tempWorldbookText, 'utf8');
  const prepared = {
    preparedAt: new Date().toISOString(),
    tempName,
    tempCardPath,
    tempWorldbookPath,
    sourceArtifact: artifactPath,
    sourceBytes: artifactBuffer.byteLength,
    sourceSha256,
    worldbookEntries: entryCount,
    tempBytes: Buffer.byteLength(tempText),
    tempSha256: createHash('sha256').update(tempText).digest('hex'),
  };
  await writeFile(preparedPath, `${JSON.stringify(prepared, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(prepared, null, 2)}\n`);
}

async function inspectAssets(page) {
  return page.evaluate(async (name) => {
    const context = SillyTavern.getContext();
    const characters = context.characters
      .filter((item) => item?.name === name)
      .map((item) => ({ name: item.name, avatar: item.avatar, boundWorldbook: item.data?.extensions?.world ?? null }));
    const worldbooks = await TavernHelper.getWorldbookNames();
    return {
      characters,
      worldbookPresent: worldbooks.includes(name),
      worldbookMatches: worldbooks.filter((item) => item === name).length,
    };
  }, tempName);
}

async function ensureTempCharacterScriptsEnabled(page) {
  const result = await page.evaluate((name) => {
    const context = SillyTavern.getContext();
    const scriptSettings = context.extensionSettings?.tavern_helper?.script;
    if (!scriptSettings) throw new Error('酒馆助手角色脚本配置尚不可用');
    scriptSettings.enabled ??= {};
    const before = Array.isArray(scriptSettings.enabled.characters)
      ? [...scriptSettings.enabled.characters]
      : [];
    scriptSettings.enabled.characters = [...new Set([...before, name])];
    globalThis.saveSettingsDebounced?.();
    return {
      before,
      after: [...scriptSettings.enabled.characters],
      presentBefore: before.includes(name),
      presentAfter: scriptSettings.enabled.characters.includes(name),
      exactMatchesAfter: scriptSettings.enabled.characters.filter((item) => item === name).length,
    };
  }, tempName);
  await page.waitForTimeout(3500);
  return result;
}

async function ensureTempCharacterRegexAllowed(page) {
  const result = await page.evaluate(async (name) => {
    const context = SillyTavern.getContext();
    const character = context.characters?.find((item) => item?.name === name);
    if (!character?.avatar) throw new Error('找不到临时角色头像标识，无法授权角色正则');
    const settings = context.extensionSettings;
    const before = Array.isArray(settings?.character_allowed_regex)
      ? [...settings.character_allowed_regex]
      : [];
    const engine = await import('/scripts/extensions/regex/engine.js');
    engine.allowScopedScripts(character);
    return {
      avatar: character.avatar,
      before,
      after: [...settings.character_allowed_regex],
      presentBefore: before.includes(character.avatar),
      presentAfter: settings.character_allowed_regex.includes(character.avatar),
      exactMatchesAfter: settings.character_allowed_regex.filter((item) => item === character.avatar).length,
    };
  }, tempName);
  await page.waitForTimeout(3500);
  return result;
}

async function waitForCharacterList(page) {
  await page.waitForFunction((name) => {
    const context = SillyTavern.getContext();
    const inData = context.characters?.some((item) => item?.name === name);
    const inDom = [...document.querySelectorAll('#rm_print_characters_block .character_select')]
      .some((row) => row.querySelector('.ch_name')?.textContent.trim() === name);
    return inData && inDom;
  }, tempName, { timeout: 90000 });
}

async function waitForCharacterScriptFrames(page) {
  const requiredNames = [
    '诡异药剂师v0.5｜MVU 固定版本加载器',
    '诡异药剂师v0.5｜MVU Zod Schema',
  ];
  await page.waitForFunction((required) => {
    const names = [...document.querySelectorAll('iframe')].map((frame) => frame.name || '');
    return required.every((name) => names.some((frameName) => frameName.includes(name)));
  }, requiredNames, { timeout: 90000 });
  return page.evaluate((required) => {
    const names = [...document.querySelectorAll('iframe')].map((frame) => frame.name || '');
    return required.map((name) => ({
      name,
      matches: names.filter((frameName) => frameName.includes(name)),
    }));
  }, requiredNames);
}

async function waitForRuntime(page) {
  await page.waitForFunction(() => Boolean(window.SillyTavern && window.TavernHelper), null, { timeout: 90000 });
}

async function waitForMvuState(page) {
  await page.waitForFunction(() => {
    const context = SillyTavern.getContext();
    return context.chat.some((message) => {
      const swipeId = message?.swipe_id ?? 0;
      return Boolean(message?.variables?.[swipeId]?.stat_data?.事件);
    });
  }, null, { timeout: 90000 });
}

async function createIsolatedChat(page) {
  const beforeChatId = await page.evaluate(() => SillyTavern.getContext().chatId);
  await page.evaluate(async () => {
    const { doNewChat } = await import('/script.js');
    await doNewChat({ deleteCurrentChat: false });
  });
  await page.waitForFunction((oldChatId) => {
    const context = SillyTavern.getContext();
    return Boolean(context.chatId && context.chatId !== oldChatId && context.chat.length === 1);
  }, beforeChatId, { timeout: 90000 });
  await waitForMvuState(page);
  return page.evaluate(() => ({
    chatId: SillyTavern.getContext().chatId,
    messageCount: SillyTavern.getContext().chat.length,
  }));
}

function summarizeEvent(event) {
  if (!event) return null;
  const anchors = {};
  for (const id of ['E01', 'E02', 'E03', 'E04', 'E05', 'E06']) {
    anchors[id] = {
      status: event.锚点状态?.[id]?.状态 ?? null,
      ending: event.锚点状态?.[id]?.收尾 ?? null,
    };
  }
  return {
    anchors,
    active: {
      id: event.唯一活跃事件?.事件ID ?? '',
      title: event.唯一活跃事件?.标题 ?? '',
      location: event.唯一活跃事件?.地点 ?? '',
      participants: event.唯一活跃事件?.参与者 ?? [],
      status: event.唯一活跃事件?.状态 ?? '',
      urgency: event.唯一活跃事件?.紧迫度 ?? '',
      deadline: event.唯一活跃事件?.模糊期限 ?? '',
      progress: event.唯一活跃事件?.进展 ?? '',
      stopPoint: event.唯一活跃事件?.幕后停止点 ?? '',
    },
    omen: {
      id: event.近期预兆?.事件ID ?? '',
      direction: event.近期预兆?.方向 ?? '',
      location: event.近期预兆?.地点 ?? '',
      participants: event.近期预兆?.参与者 ?? [],
      urgency: event.近期预兆?.紧迫度 ?? '',
      deadline: event.近期预兆?.模糊期限 ?? '',
    },
    recentResults: Array.isArray(event.最近结果) ? event.最近结果 : event.最近结果 ?? null,
    notification: event.事件通知 ?? null,
  };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const context = SillyTavern.getContext();
    const candidates = [...context.chat].reverse();
    const latestWithMvu = candidates.find((message) => {
      const swipeId = message?.swipe_id ?? 0;
      return Boolean(message?.variables?.[swipeId]?.stat_data?.事件);
    });
    const swipeId = latestWithMvu?.swipe_id ?? 0;
    const stat = latestWithMvu?.variables?.[swipeId]?.stat_data;
    const messages = context.chat.slice(-4).map((message, offset) => ({
      index: context.chat.length - Math.min(4, context.chat.length) + offset,
      role: message?.is_user ? 'user' : message?.is_system ? 'system' : 'assistant',
      text: String(message?.mes ?? ''),
      hasUpdateVariable: String(message?.mes ?? '').includes('<UpdateVariable>'),
      hasStatusPlaceholder: String(message?.mes ?? '').includes('<StatusPlaceHolderImpl'),
      hasMvu: Boolean(message?.variables?.[message?.swipe_id ?? 0]?.stat_data),
    }));
    const statusFrames = [...document.querySelectorAll('iframe')].filter((frame) => {
      try { return Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]')); } catch { return false; }
    });
    const assistantFloors = [...document.querySelectorAll('#chat .mes')]
      .filter((floor) => floor.getAttribute('is_user') !== 'true');
    const latestRenderedAssistantText = assistantFloors.at(-1)?.querySelector('.mes_text')?.textContent ?? '';
    return {
      chatId: context.chatId,
      messageCount: context.chat.length,
      latestMvuMessageId: latestWithMvu ? context.chat.indexOf(latestWithMvu) : -1,
      event: stat?.事件 ?? null,
      world: stat?.世界 ? {
        phase: stat.世界.阶段编号,
        progress: stat.世界.模糊阶段进度,
        location: stat.世界.当前地点,
        sceneTime: stat.世界.当前场景时间,
      } : null,
      player: stat?.林恩 ? {
        level: stat.林恩.等级,
        goal: stat.林恩.当前明确目标,
        lastInstruction: stat.林恩.最近明确指令,
      } : null,
      system: stat?.系统 ? {
        currentTask: stat.系统.当前任务,
        taskStage: stat.系统.任务阶段,
        taskStatus: stat.系统.任务状态,
        eventNotice: stat.系统.事件通知,
      } : null,
      messages,
      statusFrameCount: statusFrames.length,
      latestRenderedAssistantText,
    };
  }).then((raw) => ({ ...raw, event: summarizeEvent(raw.event) }));
}

function targetReached(state) {
  return state?.event?.anchors?.E06?.status === '预兆' && state?.event?.omen?.id === 'E06';
}

function choosePrompt(state, used) {
  const a = state?.event?.anchors ?? {};
  const e03 = a.E03?.status;
  const e04 = a.E04?.status;
  const e05 = a.E05?.status;
  const e06 = a.E06?.status;
  if (e06 === '预兆') return null;
  if (e03 === '未触发') return ['e02_to_e03', prompts.e02_to_e03];
  if (e03 === '预兆') return ['e03_open', prompts.e03_open];
  if (e03 === '活跃') {
    if (!used.has('e03_diagnose')) return ['e03_diagnose', prompts.e03_diagnose];
    return ['e03_finish', prompts.e03_finish];
  }
  if (e04 === '未触发') return ['e03_bridge', prompts.e03_bridge];
  if (e04 === '预兆') return ['e04_open', prompts.e04_open];
  if (e04 === '活跃') return ['e04_finish', prompts.e04_finish];
  if (e05 === '未触发') return ['e04_bridge', prompts.e04_bridge];
  if (e05 === '预兆') return ['e05_enter', prompts.e05_enter];
  if (e05 === '活跃') {
    if (!used.has('e05_accept')) return ['e05_accept', prompts.e05_accept];
    if (!used.has('e05_extract')) return ['e05_extract', prompts.e05_extract];
    if (!used.has('e05_finish')) return ['e05_finish', prompts.e05_finish];
    return ['e05_confirm', prompts.e05_confirm];
  }
  if (['完成', '变形', '取消'].includes(e05) && e06 === '未触发') return ['e06_bridge', prompts.e06_bridge];
  throw new Error(`无法为当前事件状态选择林恩行动：${JSON.stringify(state?.event)}`);
}

function validRecentResults(value) {
  const keys = ['事件ID', '标题', '结果', '世界影响'];
  return Array.isArray(value) && value.every((item) => (
    item !== null
    && typeof item === 'object'
    && !Array.isArray(item)
    && JSON.stringify(Object.keys(item).sort()) === JSON.stringify([...keys].sort())
    && keys.every((key) => typeof item[key] === 'string')
  ));
}

function inspectAssistantPatch(text) {
  const blocks = [...String(text ?? '').matchAll(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/gi)];
  if (blocks.length !== 1) return { validJson: false, recentResultsValid: false, eventRootReplaceCount: 0 };
  try {
    const patch = JSON.parse(blocks[0][1]);
    if (!Array.isArray(patch)) return { validJson: false, recentResultsValid: false, eventRootReplaceCount: 0 };
    const eventRootReplaces = patch.filter((operation) => operation?.op === 'replace' && operation?.path === '/事件');
    return {
      validJson: true,
      recentResultsValid: eventRootReplaces.every((operation) => validRecentResults(operation?.value?.最近结果)),
      eventRootReplaceCount: eventRootReplaces.length,
    };
  } catch {
    return { validJson: false, recentResultsValid: false, eventRootReplaceCount: 0 };
  }
}

function expectedEventProgress(id, before, after) {
  const anchors = after?.event?.anchors ?? {};
  const activeId = after?.event?.active?.id ?? '';
  const omenId = after?.event?.omen?.id ?? '';
  const completed = (eventId) => anchors[eventId]?.status === '完成';
  const active = (eventId) => anchors[eventId]?.status === '活跃' && activeId === eventId && omenId === '';
  const omen = (previousId, nextId) => completed(previousId)
    && anchors[nextId]?.status === '预兆'
    && activeId === ''
    && omenId === nextId;
  const persistentStateChanged = JSON.stringify({
    event: before?.event,
    world: before?.world,
    player: before?.player,
    system: before?.system,
  }) !== JSON.stringify({
    event: after?.event,
    world: after?.world,
    player: after?.player,
    system: after?.system,
  });

  switch (id) {
    case 'e02_to_e03': return omen('E02', 'E03');
    case 'e03_open': return active('E03');
    case 'e03_diagnose': return active('E03') && persistentStateChanged;
    case 'e03_finish':
    case 'e03_bridge': return omen('E03', 'E04');
    case 'e04_open': return active('E04');
    case 'e04_finish':
    case 'e04_bridge': return omen('E04', 'E05');
    case 'e05_enter': return active('E05');
    case 'e05_accept':
    case 'e05_extract': return active('E05') && persistentStateChanged;
    case 'e05_finish':
    case 'e05_confirm':
    case 'e06_bridge': return omen('E05', 'E06');
    default: return false;
  }
}

function resolveConceptWindowIndex(state) {
  const eventIds = Array.from({ length: 20 }, (_, index) => `E${String(index + 1).padStart(2, '0')}`);
  const anchors = state?.event?.anchors ?? {};
  const activeIndex = eventIds.findIndex((id) => anchors[id]?.status === '活跃');
  if (activeIndex >= 0) return activeIndex;
  const omenIndex = eventIds.indexOf(state?.event?.omen?.id ?? '');
  if (omenIndex >= 0) return Math.max(0, omenIndex - 1);
  for (let index = eventIds.length - 1; index >= 0; index -= 1) {
    if (['完成', '变形', '取消'].includes(anchors[eventIds[index]]?.status)) return index;
  }
  return 0;
}

function countExactText(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let start = 0;
  while ((start = haystack.indexOf(needle, start)) >= 0) {
    count += 1;
    start += needle.length;
  }
  return count;
}

function inspectConceptWindow(capture, state, conceptEntries) {
  const eventIds = Array.from({ length: 20 }, (_, index) => `E${String(index + 1).padStart(2, '0')}`);
  const currentIndex = resolveConceptWindowIndex(state);
  const expected = conceptEntries.filter((entry) => (
    entry.eventIds.some((eventId) => {
      const eventIndex = eventIds.indexOf(eventId);
      return eventIndex >= 0 && Math.abs(eventIndex - currentIndex) <= 3;
    })
  ));
  const promptText = (capture?.messages ?? [])
    .map((message) => typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content ?? ''))
    .join('\n');
  const counts = expected.map((entry) => ({
    uid: entry.uid,
    comment: entry.comment,
    eventIds: entry.eventIds,
    count: countExactText(promptText, entry.content),
  }));
  return {
    currentEventId: eventIds[currentIndex],
    expectedCount: expected.length,
    counts,
    missing: counts.filter((entry) => entry.count === 0),
    duplicated: counts.filter((entry) => entry.count > 1),
  };
}

function stateAssertions(state) {
  const anchors = state?.event?.anchors ?? {};
  const activeAnchors = Object.entries(anchors)
    .filter(([, value]) => value.status === '活跃')
    .map(([id]) => id);
  const activeId = state?.event?.active?.id ?? '';
  const active = state?.event?.active ?? {};
  const omenId = state?.event?.omen?.id ?? '';
  const omen = state?.event?.omen ?? {};
  const emptyActiveCanonical = activeId !== '' || (
    active.title === ''
    && active.location === ''
    && Array.isArray(active.participants) && active.participants.length === 0
    && active.status === '无'
    && active.urgency === '无'
    && active.deadline === ''
    && active.progress === ''
    && active.stopPoint === ''
  );
  const emptyOmenCanonical = omenId !== '' || (
    omen.direction === ''
    && omen.location === ''
    && Array.isArray(omen.participants) && omen.participants.length === 0
    && omen.urgency === '无'
    && omen.deadline === ''
  );
  return {
    latestMvuPresent: state.latestMvuMessageId >= 0,
    atMostOneActiveAnchor: activeAnchors.length <= 1,
    activePointerConsistent: activeAnchors.length === 0 ? activeId === '' : activeAnchors[0] === activeId,
    activeStatusConsistent: activeId === '' ? active.status === '无' : active.status === '活跃',
    omenPointerConsistent: omenId === '' || anchors[omenId]?.status === '预兆',
    emptyActiveCanonical,
    emptyOmenCanonical,
    recentResultsObjectArray: validRecentResults(state?.event?.recentResults),
    statusRendered: state.statusFrameCount >= 1,
  };
}

function stateContractObservations(state) {
  const anchors = state?.event?.anchors ?? {};
  const activeId = state?.event?.active?.id ?? '';
  const activeStatus = state?.event?.active?.status ?? '';
  const omenId = state?.event?.omen?.id ?? '';
  return {
    strictOmenPointerConsistent: omenId === '' || anchors[omenId]?.status === '预兆',
    activeStatusConsistent: activeId === ''
      ? activeStatus === '无'
      : activeStatus === anchors[activeId]?.status,
  };
}

async function verifyReload(page, chatId, beforeState) {
  await page.evaluate(() => SillyTavern.getContext().saveChat());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitForRuntime(page);
  await page.evaluate(async ({ name, targetChatId }) => {
    const { getCharacters, selectCharacterById, openCharacterChat } = await import('/script.js');
    await getCharacters();
    const id = SillyTavern.getContext().characters.findIndex((item) => item?.name === name);
    if (id < 0) throw new Error(`重载后找不到临时卡：${name}`);
    await selectCharacterById(id, { switchMenu: false });
    await openCharacterChat(targetChatId);
  }, { name: tempName, targetChatId: chatId });
  await page.waitForFunction((targetChatId) => SillyTavern.getContext().chatId === targetChatId, chatId, { timeout: 90000 });
  await waitForMvuState(page);
  const afterState = await snapshot(page);
  return {
    before: beforeState,
    after: afterState,
    assertions: {
      sameChat: afterState.chatId === chatId,
      messageCountPersisted: afterState.messageCount === beforeState.messageCount,
      e06OmenPersisted: targetReached(afterState),
      latestMvuPersisted: afterState.latestMvuMessageId >= 0,
    },
  };
}

async function runSimulation() {
  const session = await import(pathToFileURL(bridgeSessionPath).href);
  const promptCapture = await import(pathToFileURL(promptCapturePath).href);
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  const conceptEntries = (artifact.data?.character_book?.entries ?? [])
    .filter((entry) => entry.id >= 400 && entry.id <= 451)
    .map((entry) => ({
      uid: entry.id,
      comment: entry.comment,
      content: entry.content,
      eventIds: entry.extensions?.tavernweave?.event_ids ?? [],
    }));
  if (conceptEntries.length !== 52) throw new Error(`真机概念注册表数量错误：${conceptEntries.length}`);
  const { browser, page } = await session.connect(url);
  const consoleEntries = [];
  let turns = [];
  const used = new Set();
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleEntries.push({ at: new Date().toISOString(), type: message.type(), text: message.text().slice(0, 2400) });
    }
  });
  page.on('pageerror', (error) => {
    consoleEntries.push({ at: new Date().toISOString(), type: 'pageerror', text: String(error?.stack || error).slice(0, 2400) });
  });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    const assets = await inspectAssets(page);
    if (assets.characters.length !== 1 || assets.worldbookMatches !== 1) {
      throw new Error(`临时卡或世界书不是唯一匹配：${JSON.stringify(assets)}`);
    }
    if (assets.characters[0].boundWorldbook !== tempName) {
      throw new Error(`临时卡绑定世界书不一致：${JSON.stringify(assets.characters[0])}`);
    }
    const scriptEnable = await ensureTempCharacterScriptsEnabled(page);
    const regexAllow = await ensureTempCharacterRegexAllowed(page);
    await session.switchCharacter(page, tempName, false);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await waitForRuntime(page);
    await waitForCharacterList(page);
    await session.switchCharacter(page, tempName, false);
    const characterScriptFrames = await waitForCharacterScriptFrames(page);
    const runtime = await session.getStatus(page);
    const loadedPreset = await page.evaluate(() => TavernHelper.getLoadedPresetName());
    let chat;
    let resumedFromCheckpoint = false;
    try {
      const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
      if (checkpoint.tempName === tempName
        && checkpoint.chat?.chatId
        && Array.isArray(checkpoint.turns)
        && checkpoint.turns.length > 0) {
        await page.evaluate(async (chatId) => {
          const context = SillyTavern.getContext();
          if (context.chatId !== chatId) await context.openCharacterChat(chatId);
        }, checkpoint.chat.chatId);
        await page.waitForFunction(
          (chatId) => SillyTavern.getContext().chatId === chatId,
          checkpoint.chat.chatId,
          { timeout: 90000 },
        );
        await waitForMvuState(page);
        chat = checkpoint.chat;
        turns = checkpoint.turns.map((turn) => {
          const assertions = { ...(turn.assertions ?? {}) };
          const assistantText = turn.output ?? '';
          const directSpeechHits = [...assistantText.matchAll(directPlayerSpeechPattern)].map((match) => match[0]);
          const autonomyHeuristicHits = [
            ...assistantText.matchAll(playerAutonomyHeuristicPattern),
            ...assistantText.matchAll(playerScopedMicroActionPattern),
            ...assistantText.matchAll(undeclaredActionQualityPattern),
          ].map((match) => match[0]);
          const calendarLeaks = [...assistantText.matchAll(calendarLeakPattern)].map((match) => match[0]);
          return {
            ...turn,
            directPlayerSpeechHits: directSpeechHits,
            sovereigntyHeuristicHits: autonomyHeuristicHits,
            calendarLeaks,
            contractObservations: {
              ...stateContractObservations(turn.after),
              assistantHasUpdateVariable: turn.contractObservations?.assistantHasUpdateVariable
                ?? (turn.assertions?.assistantHasUpdateVariable === true),
            },
            assertions: {
              ...assertions,
              ...stateAssertions(turn.after),
              noCalendarLeak: calendarLeaks.length === 0,
              noPlayerAutonomyHeuristicHit: directSpeechHits.length === 0 && autonomyHeuristicHits.length === 0,
            },
          };
        });
        turns.forEach((turn) => used.add(turn.id));
        if (Array.isArray(checkpoint.consoleEntries)) consoleEntries.unshift(...checkpoint.consoleEntries);
        resumedFromCheckpoint = true;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    if (!chat) chat = await createIsolatedChat(page);
    let current = await snapshot(page);
    const initialAssertions = stateAssertions(turns[0]?.before ?? current);
    for (let index = turns.length; index < 16 && !targetReached(current); index += 1) {
      const selected = choosePrompt(current, used);
      if (!selected) break;
      const [id, definition] = selected;
      used.add(id);
      const before = current;
      await promptCapture.clearPromptCapture(page);
      await promptCapture.installPromptCapture(page);
      const observed = [];
      let stopListener;
      const stopSignal = new Promise((resolveStop) => { stopListener = resolveStop; });
      const listenPromise = session.listen(page, {
        timeoutMs: 305000,
        stopSignal,
        onEntry: (entry) => observed.push(entry),
      });
      let send;
      try {
        send = await session.sendAndWait(page, definition.text, { wait: true, timeoutMs: 300000 });
      } finally {
        stopListener();
      }
      const listener = await listenPromise;
      await page.waitForTimeout(3000);
      const capture = await promptCapture.takePromptCapture(page, {
        char: tempName,
        chatId: chat.chatId,
        input: definition.text,
      });
      if (!capture) throw new Error(`${id} 未捕获到真实模型请求`);
      const captureFiles = promptCapture.writeCaptureFiles(capture, resolve(evidenceDir, `${sampleLabel}-request-captures`));
      current = await snapshot(page);
      const latestAssistant = [...current.messages].reverse().find((message) => message.role === 'assistant');
      const assistantText = latestAssistant?.text ?? '';
      const directSpeechHits = [...assistantText.matchAll(directPlayerSpeechPattern)].map((match) => match[0]);
      const autonomyHeuristicHits = [
        ...assistantText.matchAll(playerAutonomyHeuristicPattern),
        ...assistantText.matchAll(playerScopedMicroActionPattern),
        ...assistantText.matchAll(undeclaredActionQualityPattern),
      ].map((match) => match[0]);
      const calendarLeaks = [...assistantText.matchAll(calendarLeakPattern)].map((match) => match[0]);
      const patchInspection = inspectAssistantPatch(assistantText);
      const conceptWindowInspection = inspectConceptWindow(capture, before, conceptEntries);
      const assertions = {
        requestHttp200: capture.request?.status === 200,
        responseCaptured: capture.replyChars > 0,
        generationEnded: send.generation?.ended === true,
        userAndAssistantAdded: send.newMessages >= 2,
        assistantHasStatusPlaceholder: latestAssistant?.hasStatusPlaceholder === true,
        assistantHasUpdateVariable: latestAssistant?.hasUpdateVariable === true,
        assistantPatchIsValidJsonArray: patchInspection.validJson,
        assistantPatchRecentResultsValid: patchInspection.recentResultsValid,
        expectedEventProgress: expectedEventProgress(id, before, current),
        eventWindowConceptsInjectedOnce: conceptWindowInspection.expectedCount > 0
          && conceptWindowInspection.missing.length === 0
          && conceptWindowInspection.duplicated.length === 0,
        renderedAssistantHasNoThinkBlock: !/<\/?think\b/i.test(current.latestRenderedAssistantText ?? ''),
        noCalendarLeak: calendarLeaks.length === 0,
        noPlayerAutonomyHeuristicHit: autonomyHeuristicHits.length === 0,
        ...stateAssertions(current),
      };
      const contractObservations = {
        ...stateContractObservations(current),
        assistantHasUpdateVariable: latestAssistant?.hasUpdateVariable === true,
      };
      const turn = {
        index: index + 1,
        id,
        goal: definition.goal,
        input: definition.text,
        before,
        output: assistantText,
        after: current,
        send,
        request: {
          captureFile: captureFiles.file,
          status: capture.request?.status ?? null,
          model: capture.request?.model ?? '',
          promptChars: capture.promptChars,
          replyChars: capture.replyChars,
          messageRoles: capture.messages.map((message) => message.role),
        },
        listener: {
          count: listener.entries.length,
          entries: listener.entries,
        },
        directPlayerSpeechHits: directSpeechHits,
        sovereigntyHeuristicHits: autonomyHeuristicHits,
        calendarLeaks,
        patchInspection,
        conceptWindowInspection,
        contractObservations,
        assertions,
      };
      turns.push(turn);
      await writeFile(checkpointPath, `${JSON.stringify({
        updatedAt: new Date().toISOString(),
        tempName,
        runtime,
        loadedPreset,
        scriptEnable,
        regexAllow,
        characterScriptFrames,
        resumedFromCheckpoint,
        chat,
        initial: { state: turns[0]?.before ?? before, assertions: initialAssertions },
        turns,
        targetReached: targetReached(current),
        consoleEntries,
      }, null, 2)}\n`, 'utf8');
      process.stdout.write(`${JSON.stringify({
        turn: index + 1,
        id,
        requestStatus: capture.request?.status ?? null,
        replyChars: capture.replyChars,
        event: current.event,
        contractObservations,
        assertions,
        outputPreview: assistantText.slice(0, 260),
      })}\n`);
      if (Object.values(assertions).some((value) => value !== true)) {
        throw new Error(`第${index + 1}轮断言失败：${JSON.stringify(assertions)}`);
      }
    }
    if (!targetReached(current)) {
      throw new Error(`16轮内未到达E06预兆：${JSON.stringify(current.event)}`);
    }
    await page.evaluate(() => document.querySelector('#chat')?.lastElementChild?.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(600);
    await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 30000 });
    const reload = await verifyReload(page, chat.chatId, current);
    const fatalRuntimeErrors = consoleEntries.filter((entry) => fatalRuntimePattern.test(entry.text));
    const priorEventsSettled = ['E02', 'E03', 'E04', 'E05']
      .every((id) => ['完成', '变形', '取消'].includes(current.event.anchors[id].status));
    const cleanE06OmenBoundary = targetReached(current)
      && priorEventsSettled
      && current.event.active.id === '';
    const contractFindings = turns.flatMap((turn) => (
      [
        ...(turn.contractObservations?.strictOmenPointerConsistent === false
          ? [{ turn: turn.index, id: turn.id, finding: '近期预兆仍指向已转为活跃的同一锚点，与 Schema 的严格约束不一致' }]
          : []),
        ...(turn.contractObservations?.assistantHasUpdateVariable === false
          ? [{ turn: turn.index, id: turn.id, finding: '模型正文推进了事件，但回复缺少必需的 UpdateVariable 块，MVU 未随正文推进' }]
          : []),
        ...(turn.assertions?.activePointerConsistent === false
          ? [{ turn: turn.index, id: turn.id, finding: '锚点状态与唯一活跃事件指针不一致' }]
          : []),
        ...(turn.contractObservations?.activeStatusConsistent === false
          ? [{ turn: turn.index, id: turn.id, finding: '唯一活跃事件的状态值与其锚点状态不一致' }]
          : []),
        ...(/鬼婴破箱|初次塑形|物理按压|进入沉睡/.test(turn.output ?? '') && turn.after?.event?.anchors?.E06?.status === '预兆'
          ? [{ turn: turn.index, id: turn.id, finding: 'E06仍标记为预兆时，正文已直接执行E06鬼婴塑形本体，越过预兆边界' }]
          : []),
      ]
    ));
    const finalAssertions = {
      runtimeVersions: runtime.tavernVersion === '1.17.0' && runtime.helperVersion === '4.9.1',
      compatiblePresetLoaded: expectedPreset === null || loadedPreset === expectedPreset,
      uniqueTempAssets: assets.characters.length === 1 && assets.worldbookMatches === 1,
      tempCharacterScriptsEnabled: scriptEnable.presentAfter === true && scriptEnable.exactMatchesAfter === 1,
      tempCharacterRegexAllowed: regexAllow.presentAfter === true && regexAllow.exactMatchesAfter === 1,
      requiredCharacterScriptFramesPresent: characterScriptFrames.every((item) => item.matches.length === 1),
      startedFromExpectedOpening: turns[0]?.before?.event?.anchors?.E02?.status === '活跃'
        && turns[0]?.before?.event?.anchors?.E02?.ending === true
        && turns[0]?.before?.event?.anchors?.E03?.status === '未触发',
      reachedE06Omen: targetReached(current),
      priorEventsSettled,
      stoppedAtCleanE06OmenBoundary: cleanE06OmenBoundary,
      everyTurnRequestSucceeded: turns.every((turn) => turn.request.status === 200),
      everyTurnRuntimeCheckPassed: turns.every((turn) => Object.values(turn.assertions).every(Boolean)),
      reloadPersisted: Object.values(reload.assertions).every(Boolean),
      noFatalRuntimeErrors: fatalRuntimeErrors.length === 0,
    };
    const artifactBuffer = await readFile(artifactPath);
    const evidence = {
      acceptedAt: new Date().toISOString(),
      target: { tempName, endpoint: url, terminalEvent: 'E06预兆' },
      sampleLabel,
      outcome: Object.values(finalAssertions).every((value) => value === true)
        ? (contractFindings.length === 0 ? 'passed' : 'passed_with_findings')
        : 'failed_with_findings',
      artifact: {
        path: artifactPath,
        bytes: artifactBuffer.byteLength,
        sha256: createHash('sha256').update(artifactBuffer).digest('hex'),
      },
      runtime: {
        tavernVersion: runtime.tavernVersion,
        helperVersion: runtime.helperVersion,
        loadedPreset,
        expectedPreset,
        viewport: { width: 1440, height: 900 },
      },
      assets,
      scriptEnable,
      regexAllow,
      characterScriptFrames,
      resumedFromCheckpoint,
      chat,
      initial: { state: turns[0]?.before ?? null, assertions: initialAssertions },
      turns,
      finalState: current,
      reload,
      console: {
        warningOrErrorCount: consoleEntries.length,
        fatalRuntimeErrors,
        entries: consoleEntries,
      },
      contractFindings,
      manualReviewRequired: {
        playerSovereignty: '逐轮阅读output，区分对玩家已明确动作的复述与模型擅自新增的林恩对白/行动。',
        narrativeCausality: '逐轮核对E03手术、E04治疗、E05不眠夜牙科及E06预兆是否符合事件契约。',
      },
      screenshotPath,
      assertions: finalAssertions,
    };
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ evidencePath, screenshotPath, turns: turns.length, outcome: evidence.outcome, finalEvent: current.event, contractFindings, assertions: finalAssertions }, null, 2)}\n`);
  } finally {
    await session.closeSession({ browser });
  }
}

async function cleanupLocalAndWorldbook() {
  const session = await import(pathToFileURL(bridgeSessionPath).href);
  const { browser, page } = await session.connect(url);
  try {
    const before = await inspectAssets(page);
    const scriptRegistryCleanup = await page.evaluate((name) => {
      const scriptSettings = SillyTavern.getContext().extensionSettings?.tavern_helper?.script;
      const beforeNames = Array.isArray(scriptSettings?.enabled?.characters)
        ? [...scriptSettings.enabled.characters]
        : [];
      if (scriptSettings?.enabled) {
        scriptSettings.enabled.characters = beforeNames.filter((item) => item !== name);
        globalThis.saveSettingsDebounced?.();
      }
      const afterNames = Array.isArray(scriptSettings?.enabled?.characters)
        ? [...scriptSettings.enabled.characters]
        : [];
      return {
        before: beforeNames,
        after: afterNames,
        presentBefore: beforeNames.includes(name),
        presentAfter: afterNames.includes(name),
      };
    }, tempName);
    const regexAllowlistCleanup = await page.evaluate(async (name) => {
      const context = SillyTavern.getContext();
      const targetCharacters = context.characters.filter((item) => item?.name === name && item?.avatar);
      const targetAvatars = targetCharacters.map((item) => item.avatar);
      const settings = context.extensionSettings;
      const before = Array.isArray(settings?.character_allowed_regex)
        ? [...settings.character_allowed_regex]
        : [];
      const engine = await import('/scripts/extensions/regex/engine.js');
      targetCharacters.forEach((character) => engine.disallowScopedScripts(character));
      return {
        targetAvatars,
        before,
        after: [...settings.character_allowed_regex],
        presentAfter: targetAvatars.some((avatar) => settings.character_allowed_regex.includes(avatar)),
      };
    }, tempName);
    await page.waitForTimeout(3500);
    let characterDelete = null;
    if (before.characters.length > 0) characterDelete = await session.deleteCharacterCard(page, tempName);
    const afterCharacter = await inspectAssets(page);
    let worldbookDelete = null;
    if (afterCharacter.worldbookPresent) {
      worldbookDelete = await page.evaluate(async (name) => {
        try {
          const result = await TavernHelper.deleteWorldbook(name);
          return { ok: true, result };
        } catch (error) {
          return { ok: false, error: String(error?.stack || error) };
        }
      }, tempName);
    }
    const after = await inspectAssets(page);
    const local = {};
    for (const [key, path] of Object.entries({ tempCardPath, tempWorldbookPath })) {
      try {
        await unlink(path);
        local[key] = { absent: true, deletedNow: true };
      } catch (error) {
        if (error?.code === 'ENOENT') local[key] = { absent: true, deletedNow: false };
        else throw error;
      }
    }
    const evidence = {
      cleanedAt: new Date().toISOString(),
      target: { card: tempName, worldbook: tempName, localFiles: [tempCardPath, tempWorldbookPath] },
      before,
      scriptRegistryCleanup,
      regexAllowlistCleanup,
      characterDelete,
      afterCharacter,
      worldbookDelete,
      after,
      local,
      assertions: {
        cardAbsent: after.characters.length === 0,
        tempScriptRegistryEntryAbsent: scriptRegistryCleanup.presentAfter === false,
        tempRegexAllowlistEntryAbsent: regexAllowlistCleanup.presentAfter === false,
        worldbookAbsent: !after.worldbookPresent,
        worldbookMultiplicityZero: after.worldbookMatches === 0,
        localTempCardAbsent: local.tempCardPath.absent,
        localTempWorldbookAbsent: local.tempWorldbookPath.absent,
      },
    };
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(cleanupPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    if (Object.values(evidence.assertions).some((value) => value !== true)) process.exitCode = 1;
  } finally {
    await session.closeSession({ browser });
  }
}

async function diagnoseInitialization() {
  const session = await import(pathToFileURL(bridgeSessionPath).href);
  const { browser, page } = await session.connect(url);
  const consoleEntries = [];
  page.on('console', (message) => {
    consoleEntries.push({ at: new Date().toISOString(), type: message.type(), text: message.text().slice(0, 3000) });
  });
  page.on('pageerror', (error) => {
    consoleEntries.push({ at: new Date().toISOString(), type: 'pageerror', text: String(error?.stack || error).slice(0, 3000) });
  });
  try {
    await session.switchCharacter(page, tempName, false);
    const selectedChatId = await page.evaluate(() => SillyTavern.getContext().chatId);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await waitForRuntime(page);
    await page.waitForFunction((name) => {
      const context = SillyTavern.getContext();
      const inData = context.characters?.some((item) => item?.name === name);
      const inDom = [...document.querySelectorAll('#rm_print_characters_block .character_select')]
        .some((row) => row.querySelector('.ch_name')?.textContent.trim() === name);
      return inData && inDom;
    }, tempName, { timeout: 90000 });
    await session.switchCharacter(page, tempName, false);
    if (selectedChatId) {
      await page.evaluate(async (chatId) => {
        const context = SillyTavern.getContext();
        if (context.chatId !== chatId) await context.openCharacterChat(chatId);
      }, selectedChatId);
    }
    await page.waitForTimeout(20000);
    const state = await page.evaluate(async (name) => {
      const context = SillyTavern.getContext();
      const frames = [...document.querySelectorAll('iframe')].map((frame) => {
        try {
          return {
            name: frame.name,
            src: frame.getAttribute('src'),
            hasStatusRoot: Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]')),
            hasMvu: Boolean(frame.contentWindow?.Mvu),
            visibleError: frame.contentDocument?.querySelector('#wa-error:not([hidden])')?.textContent?.trim() ?? null,
          };
        } catch (error) {
          return { name: frame.name, src: frame.getAttribute('src'), inaccessible: String(error?.message || error) };
        }
      });
      const messages = context.chat.map((message, index) => {
        const swipeId = message?.swipe_id ?? 0;
        const variables = message?.variables?.[swipeId] ?? message?.variables;
        return {
          index,
          role: message?.is_user ? 'user' : message?.is_system ? 'system' : 'assistant',
          chars: String(message?.mes ?? '').length,
          hasInitvar: String(message?.mes ?? '').includes('<initvar>'),
          hasStatusPlaceholder: String(message?.mes ?? '').includes('<StatusPlaceHolderImpl'),
          variableShape: Array.isArray(message?.variables) ? 'array' : typeof message?.variables,
          variableKeys: variables && typeof variables === 'object' ? Object.keys(variables) : [],
          hasStatData: Boolean(variables?.stat_data),
          preview: String(message?.mes ?? '').slice(-500),
        };
      });
      const domMessages = [...document.querySelectorAll('#chat .mes')].map((message) => {
        const body = message.querySelector('.mes_text');
        return {
          messageId: message.getAttribute('mesid'),
          iframeCount: message.querySelectorAll('iframe').length,
          hasStatusRootInFrame: [...message.querySelectorAll('iframe')].some((frame) => {
            try { return Boolean(frame.contentDocument?.querySelector('[data-wa-status-root]')); }
            catch { return false; }
          }),
          htmlPrefix: body?.innerHTML?.slice(0, 800) ?? null,
          textPrefix: body?.textContent?.slice(0, 500) ?? null,
        };
      });
      let scripts = [];
      if (typeof TavernHelper.getCharacterTavernHelperScripts === 'function') {
        try { scripts = await TavernHelper.getCharacterTavernHelperScripts(name); }
        catch (error) { scripts = { error: String(error?.message || error) }; }
      }
      let regexProbe;
      try {
        const engine = await import('/scripts/extensions/regex/engine.js');
        const extensions = await import('/scripts/extensions.js');
        const scriptModule = await import('/script.js');
        const raw = String(context.chat.at(-1)?.mes ?? '');
        const allowed = engine.getRegexScripts({ allowedOnly: true });
        const scopedAll = engine.getScriptsByType(engine.SCRIPT_TYPES.SCOPED, { allowedOnly: false });
        const scopedAllowed = engine.getScriptsByType(engine.SCRIPT_TYPES.SCOPED, { allowedOnly: true });
        const transformed = engine.getRegexedString(raw, engine.regex_placement.AI_OUTPUT, {
          isMarkdown: true,
          isPrompt: false,
          depth: 0,
        });
        regexProbe = {
          allowedCardRegexes: allowed
            .filter((item) => String(item.id ?? '').startsWith('tavernweave-'))
            .map((item) => ({ id: item.id, disabled: item.disabled, markdownOnly: item.markdownOnly, promptOnly: item.promptOnly })),
          currentCharacterIndex: scriptModule.this_chid,
          currentAvatar: context.characters?.[scriptModule.this_chid]?.avatar ?? null,
          importedAllowlist: extensions.extension_settings?.character_allowed_regex ?? null,
          contextAllowlist: context.extensionSettings?.character_allowed_regex ?? null,
          scopedAllCount: scopedAll.length,
          scopedAllowedCount: scopedAllowed.length,
          rawHasStatusPlaceholder: raw.includes('<StatusPlaceHolderImpl'),
          transformedHasStatusRoot: transformed.includes('data-wa-status-root'),
          transformedHasUpdateVariable: transformed.includes('<UpdateVariable>'),
          transformedChars: transformed.length,
        };
      } catch (error) {
        regexProbe = { error: String(error?.stack || error) };
      }
      return {
        chatId: context.chatId,
        character: context.name2,
        messageCount: context.chat.length,
        topGlobals: {
          Mvu: typeof globalThis.Mvu,
          z: typeof globalThis.z,
          waitGlobalInitialized: typeof globalThis.waitGlobalInitialized,
          eventOn: typeof globalThis.eventOn,
        },
        regexRuntime: {
          extensionSettings: context.extensionSettings?.regex ?? globalThis.extension_settings?.regex ?? null,
          powerUserRegex: globalThis.power_user?.enable_regex ?? globalThis.power_user?.regex ?? null,
          disabledExtensions: globalThis.extension_settings?.disabledExtensions ?? null,
        },
        messages,
        domMessages,
        frames,
        helperScripts: Array.isArray(scripts) ? scripts.map((item) => ({ id: item.id, name: item.name, enabled: item.enabled })) : scripts,
        regexProbe,
      };
    }, tempName);
    const evidence = { capturedAt: new Date().toISOString(), tempName, state, consoleEntries };
    await writeFile(diagnosticPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ diagnosticPath, state, consoleEntries }, null, 2)}\n`);
  } finally {
    await session.closeSession({ browser });
  }
}

if (command === 'prepare') await prepareTempCard();
else if (command === 'run') await runSimulation();
else if (command === 'cleanup') await cleanupLocalAndWorldbook();
else if (command === 'diagnose') await diagnoseInitialization();
else throw new Error(`未知命令：${command}`);
