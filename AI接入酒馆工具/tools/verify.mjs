// verify.mjs — st-bridge 自检（只读 + dry-run）
// 逐条调用真实 CLI，断言关键输出。写操作（switch/send）用 --dry-run，
// 不改变酒馆状态、不触发生成。用法: node tools/verify.mjs [--url ...]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const bridge = join(root, '入口', 'st-bridge.mjs');
const configReader = join(root, '入口', 'st-config.mjs');
const cardReplacer = join(root, '角色卡替换器', 'replace-card.mjs');
const v04Card = join(root, '..', '诡异药剂师_MVU_v0.4', 'dist', '诡异药剂师_v0.4.json');
const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:8000';

function runWith(entry, args) {
  const r = spawnSync(process.execPath, [entry, ...args, '--url', url, '--json'], {
    encoding: 'utf8',
    timeout: 120000,
  });
  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout || 'null');
  } catch {
    parsed = null;
  }
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    data: parsed,
  };
}

const run = (args) => runWith(bridge, args);
const runConfig = (args) => runWith(configReader, args);
const runReplace = (args) => runWith(cardReplacer, args);

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail ?? '' });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

// 1. status
{
  const r = run(['status']);
  check('status 命令', r.ok && r.data?.tavernVersion && r.data?.helperVersion,
    r.ok ? `${r.data.tavernVersion} / TH ${r.data.helperVersion} / 角色 ${r.data.characters} / 世界书 ${r.data.worldbooks}` : r.stderr.slice(0, 200));
}

// 2. characters
{
  const r = run(['characters']);
  check('characters 命令', r.ok && Array.isArray(r.data?.names) && r.data.names.length > 0,
    r.ok ? `共 ${r.data.names.length} 个角色` : r.stderr.slice(0, 200));
}

// 3. chat
{
  const r = run(['chat', '5']);
  check('chat 命令', r.ok && Array.isArray(r.data?.messages) && r.data.messages.length > 0,
    r.ok ? `${r.data.messages.length} 条消息` : r.stderr.slice(0, 200));
}

// 4. worldbooks（应包含本项目世界书）
{
  const r = run(['worldbooks']);
  const hasTarget = r.data?.names?.includes('《诡异药剂师》v0.4');
  check('worldbooks 命令', r.ok && Array.isArray(r.data?.names) && r.data.names.length > 0 && hasTarget,
    r.ok ? `共 ${r.data.names.length} 本，含《诡异药剂师》v0.4` : r.stderr.slice(0, 200));
}

// 5. worldbook 读取
{
  const r = run(['worldbook', '《诡异药剂师》v0.4']);
  check('worldbook 命令', r.ok && r.data?.entryCount > 0 && Array.isArray(r.data?.entries),
    r.ok ? `${r.data.entryCount} 个条目` : r.stderr.slice(0, 200));
}

// 6. eval（只读）
{
  const r = run(['eval', 'return ctx.chat.length']);
  check('eval 命令', r.ok && r.data?.ok === true && typeof r.data.result === 'number',
    r.ok ? `chat.length = ${r.data.result}` : r.stderr.slice(0, 200));
}

// 7. exec（选一个存在的只读 Slash 命令）
{
  const probe = run(['eval', 'return Object.keys(SillyTavern.getContext().SlashCommandParser.commands).filter(k => /^(echo|pass|version)$/i.test(k))']);
  const available = probe.data?.result || [];
  const chosen = available.includes('echo') ? '/echo st-bridge-verify' : available.includes('pass') ? '/pass st-bridge-verify' : available.includes('version') ? '/version' : null;
  if (!chosen) {
    check('exec 命令', false, `未找到可用的只读 Slash 命令（可用: ${available.join(',') || '无'}）`);
  } else {
    const r = run(['exec', chosen]);
    check('exec 命令', r.ok && r.data?.ok === true, r.ok ? `${chosen} → ${String(r.data.result).slice(0, 60)}` : r.stderr.slice(0, 200));
  }
}

// 8. switch dry-run
{
  const r = run(['switch', '《诡异药剂师》v0.4', '--dry-run']);
  check('switch dry-run', r.ok && r.data?.dryRun === true && r.data?.row?.found === true,
    r.ok ? '已定位角色行，未点击' : r.stderr.slice(0, 200));
}

// 9. send dry-run
{
  const r = run(['send', '这是自检消息，不会真正发送', '--dry-run']);
  check('send dry-run', r.ok && r.data?.dryRun === true && r.data?.sendEnabled === true,
    r.ok ? '输入框与发送键可用' : r.stderr.slice(0, 200));
}

// 10. delete dry-run（只验证核心删除/保存/事件接口，不删除）
{
  const r = run(['delete', '1', '--dry-run', '--character', '《诡异药剂师》v0.4']);
  check('delete dry-run', r.ok && r.data?.dryRun === true
    && r.data?.capabilities?.deleteMessage === true
    && r.data?.capabilities?.saveChat === true
    && r.data?.capabilities?.messageDeletedEvent === true
    && r.data?.available === true,
  r.ok ? `目标聊天定位成功；将预览 ${r.data.count} 条，不删除` : r.stderr.slice(0, 200));
}

// 11. regenerate dry-run（只验证内置按钮和上下文，不触发生成）
{
  const r = run(['regenerate', '--dry-run', '--character', '《诡异药剂师》v0.4']);
  check('regenerate dry-run', r.ok && r.data?.dryRun === true
    && r.data?.hasButton === true
    && r.data?.available === true,
  r.ok ? '目标聊天定位成功；内置按钮存在，不触发生成' : r.stderr.slice(0, 200));
}

// 12. preset 配置直读（不依赖提示词监听）
{
  const r = runConfig(['preset']);
  check('preset 配置直读', r.ok && r.data?.loadedName && r.data?.promptCount > 0 && Array.isArray(r.data?.prompts),
    r.ok ? `${r.data.loadedName} / ${r.data.promptCount} 个提示词块` : r.stderr.slice(0, 200));
}

// 13. regex 配置直读
{
  const r = runConfig(['regex', '--character', '《诡异药剂师》v0.4']);
  check('regex 配置直读', r.ok && r.data?.scope === 'character' && r.data?.itemCount > 0 && Array.isArray(r.data?.entries),
    r.ok ? `角色正则 ${r.data.itemCount} 条` : r.stderr.slice(0, 200));
}

// 14. scripts 配置直读
{
  const r = runConfig(['scripts', '--character', '《诡异药剂师》v0.4']);
  check('scripts 配置直读', r.ok && r.data?.scope === 'character' && r.data?.itemCount > 0 && Array.isArray(r.data?.entries),
    r.ok ? `角色酒馆助手脚本 ${r.data.itemCount} 个` : r.stderr.slice(0, 200));
}

// 15. replace-card dry-run（读取并指纹化，但不覆盖正式卡）
{
  const r = runReplace(['《诡异药剂师》v0.4', v04Card, '--dry-run']);
  check('replace-card dry-run', r.ok && r.data?.dryRun === true
    && r.data?.target?.name === '《诡异药剂师》v0.4'
    && r.data?.worldbooks?.oldWillBeDeleted === false
    && r.data?.worldbooks?.sameNameWillBeUpdated === true
    && r.data?.chats?.count >= 1,
  r.ok ? `定位 ${r.data.chats.count} 个聊天；同名世界书原位更新` : r.stderr.slice(0, 200));
}

// 16. screenshot
{
  const shot = join(root, 'screenshots', 'verify.png');
  const r = run(['screenshot', shot]);
  check('screenshot 命令', r.ok && existsSync(shot),
    r.ok ? `已生成 ${shot}` : r.stderr.slice(0, 200));
}

const failed = results.filter((x) => !x.pass);
console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
  console.log('失败项:');
  failed.forEach((x) => console.log(`  - ${x.name}: ${x.detail}`));
  process.exit(1);
}
