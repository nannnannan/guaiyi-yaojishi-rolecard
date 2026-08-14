#!/usr/bin/env node
// Read-only runtime acceptance check. It reports counts and capabilities, not stored names or content.
import * as session from '../核心/tavern-session.mjs';

function parseArgs(argv) {
  const flags = { url: process.env.ST_URL || 'http://127.0.0.1:8000' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--headed') flags.headed = true;
    else if (arg === '--url') flags.url = argv[++i];
    else if (arg === '--channel') flags.channel = argv[++i];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const { browser, page } = await session.connect(flags.url, flags);
  try {
    const status = await session.getStatus(page);
    const characters = await session.getCharacters(page);
    const worldbooks = await session.getWorldbooks(page);
    const presets = await session.getPresetConfig(page, { listOnly: true });
    const regex = await session.getRegexConfigs(page, { scope: 'global' });
    const scripts = await session.getHelperScriptConfigs(page, { scope: 'global' });
    const report = {
      passed: true,
      runtime: {
        tavernVersion: status.tavernVersion,
        helperVersion: status.helperVersion,
        online: Boolean(status.onlineStatus),
      },
      counts: {
        characters: characters.names.length,
        worldbooks: worldbooks.names.length,
        presets: presets.names.length,
        globalRegexes: regex.itemCount,
        globalHelperScripts: scripts.itemCount,
        currentChatMessages: status.messageCount,
      },
      currentState: {
        characterSelected: Boolean(status.currentCharacter),
        chatSelected: status.chatId !== null && status.chatId !== undefined,
      },
      mutations: 0,
    };
    if (flags.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`PASS  runtime ${report.runtime.tavernVersion} / helper ${report.runtime.helperVersion}`);
      console.log(`PASS  read-only counts ${JSON.stringify(report.counts)}`);
      console.log('PASS  mutations 0');
    }
  } finally {
    await session.closeSession({ browser });
  }
}

main().catch((error) => {
  console.error(`[verify-live] ${error?.message || error}`);
  process.exit(1);
});
