# Command reference

Resolve `scripts/bridge-runner.mjs` from the skill directory. Run `setup` once before a command that opens a browser.

## Start and terminal logs

```powershell
node scripts/bridge-runner.mjs start --root "<SillyTavern安装目录>" --json
node scripts/bridge-runner.mjs debug log 200
node scripts/bridge-runner.mjs debug terminal-log 200
```

`debug log` reads SillyTavern's own `content.log`. `debug terminal-log` reads the stdout/stderr files created by `start`. Both are indirect log views, not terminal-window screenshots.

## Read-only inspection

```powershell
node scripts/bridge-runner.mjs bridge status --json
node scripts/bridge-runner.mjs bridge chat 20 --json
node scripts/bridge-runner.mjs bridge characters --json
node scripts/bridge-runner.mjs bridge worldbooks --json
node scripts/bridge-runner.mjs bridge worldbook "<世界书名>" --full --json
```

## Direct configuration reads

```powershell
node scripts/bridge-runner.mjs config preset --full --json
node scripts/bridge-runner.mjs config regex --scope all --character "<角色名>" --full --json
node scripts/bridge-runner.mjs config scripts --scope all --character "<角色名>" --full --json
```

Use `--scope character|global|all` where supported. These read actual host configuration and are independent of prompt capture.

## Controlled chat operations

```powershell
node scripts/bridge-runner.mjs bridge switch "<角色名>" --dry-run --json
node scripts/bridge-runner.mjs bridge send "<消息>" --dry-run --json
node scripts/bridge-runner.mjs bridge delete 1 --dry-run --character "<角色名>" --chat-id "<聊天ID>" --json
node scripts/bridge-runner.mjs bridge regenerate --dry-run --character "<角色名>" --chat-id "<聊天ID>" --json
```

Remove `--dry-run` only after authorization. Sending and regenerating can consume model quota.
Sending waits for completion by default. `--no-wait` exits after enqueueing; do not expect a later CLI `wait` or `stop` process to attach to that generation.

## Debug workflows

```powershell
node scripts/bridge-runner.mjs debug import "<卡文件>" --json
node scripts/bridge-runner.mjs debug talk "<角色名>" "<消息>" --json
node scripts/bridge-runner.mjs debug listen --json
node scripts/bridge-runner.mjs debug test "<临时测试卡>" --json
node scripts/bridge-runner.mjs debug cleanup "<临时角色名>" --json
node scripts/bridge-runner.mjs debug log 200
```

Add `--capture` only when the user needs the exact request payload. Treat the resulting files as sensitive.

## Import, replace, and probe

```powershell
node scripts/bridge-runner.mjs import-card "<卡文件>" --json
node scripts/bridge-runner.mjs replace-card "<旧角色名>" "<新卡文件>" --dry-run --json
node scripts/bridge-runner.mjs probe
```

Use `node scripts/bridge-runner.mjs <family> help` for family-specific options.
