---
name: sillytavern-ai-bridge
description: Connect to and operate a local SillyTavern instance through a bundled Node.js bridge. Use when Codex needs to inspect chats, characters, worldbooks, presets, regexes, or Tavern Helper scripts directly; send or regenerate messages; run slash commands; import or test character cards; capture model request payloads; replace a card in place while preserving chats and safely rotating its bound worldbook; probe version-sensitive runtime APIs; or diagnose a SillyTavern card inside the real host.
---

# SillyTavern AI Bridge

Use the bundled runtime instead of recreating browser automation. Resolve every relative path from the directory containing this `SKILL.md`.

## Operating contract

- Start read-only. Inspect status and targets before any mutation.
- Treat chats, prompts, presets, cards, worldbooks, captures, API responses, and local paths as sensitive user data. Do not quote or package them unless the user asks.
- Do not read API keys, cookies, passwords, or unrelated extension settings. Use `ST_PASSWORD` only for the bridge's supported login flow.
- Require explicit user authorization before sending a model request, importing or deleting a card, deleting messages, replacing a card, or running arbitrary Slash/eval code with side effects.
- Use `--dry-run` whenever the command supports it. Never use a formal user card for write-path testing; use only unique temporary test data and clean it afterward.
- Do not expose prompt-capture files in the answer. Summarize only the requested fields.

## Bootstrap

Check Node.js 20+ and install the runtime dependency once. Read [references/setup.md](references/setup.md) for requirements, installation, and environment variables.

```powershell
node scripts/bridge-runner.mjs setup
```

The default endpoint is `http://127.0.0.1:8000`. Override it with `ST_URL` or the command's `--url` option. Set `ST_DATA_DIR` only when SillyTavern uses a non-default data directory. Set `ST_CHANNEL=chromium` when Edge is unavailable.

Start SillyTavern when it is offline. Set `ST_ROOT` when the installation is not at `~/SillyTavern`; `start` writes stdout/stderr to `ST_LOG_DIR` or `<ST_DATA_DIR>/bridge-logs`.

```powershell
node scripts/bridge-runner.mjs start --json
```

Run a non-mutating package check before first use:

```powershell
node scripts/bridge-runner.mjs verify
```

## Choose the command

| User intent | Command family |
|---|---|
| Status, chat, characters, worldbooks, switch/send dry-run, Slash, eval, screenshot, delete/regenerate | `bridge` |
| Direct preset, regex, or Tavern Helper script inspection | `config` |
| Card import, live talk, event/console listening, temporary-card test, cleanup, logs | `debug` |
| Full character-card import workflow | `import-card` |
| In-place card upgrade preserving chats | `replace-card` |
| Runtime API/version discovery | `probe` |
| Read-only runtime acceptance | `verify-live` |
| Unique temporary-card replacement acceptance | `verify-replace` |

Invoke a family through the runner:

```powershell
node scripts/bridge-runner.mjs <family> [arguments]
```

Read [references/command-reference.md](references/command-reference.md) for exact commands. Read only the reference relevant to the current task.

Normal `bridge send` and `debug send` calls wait for generation in the same process. Use `--no-wait` only when fire-and-forget behavior is intentional; a later CLI process cannot reliably attach its `wait` or `stop` command to that browser generation.

## Inspect configuration directly

These commands query the host configuration and do not depend on prompt capture:

```powershell
node scripts/bridge-runner.mjs config preset --full --json
node scripts/bridge-runner.mjs config regex --scope all --character "<角色名>" --full --json
node scripts/bridge-runner.mjs config scripts --scope all --character "<角色名>" --full --json
```

Use `bridge worldbooks` and `bridge worldbook "<世界书名>" --full --json` for worldbooks. Filter or summarize results before returning them to the user.

## Perform write workflows safely

For card import or live debugging, read [references/card-operations.md](references/card-operations.md). For any deletion, generation, replacement, prompt capture, or arbitrary code execution, also read [references/privacy-and-safety.md](references/privacy-and-safety.md).

For in-place replacement:

1. Run `replace-card "<旧角色名>" "<新卡文件>" --dry-run --json`.
2. Verify the exact avatar slot, chat fingerprints, old bound worldbook, new worldbook, and shared-reference blockers.
3. Execute only with `--confirm-target "<旧角色名>"` after authorization.
4. Confirm chats are byte-stable, the new book is loaded, and only the old card's unshared, differently named bound book was deleted.

The replacer must refuse ambiguous names, shared old-worldbook bindings, or a mismatch between the new card's bound and embedded worldbook names. Same-name worldbooks are updated in place.

## Handle runtime drift

SillyTavern and Tavern Helper APIs are version-sensitive. Run `probe` and read [references/runtime-compatibility.md](references/runtime-compatibility.md) when a command fails after an upgrade or an exact API capability matters. Prefer observed runtime evidence over remembered signatures.

## Bundled resources

- `scripts/bridge-runner.mjs`: stable entry point and dependency setup.
- `scripts/runtime/`: complete portable Node.js bridge runtime.
- `scripts/audit-privacy.mjs`: package privacy scan; accepts repeatable `--deny <text>` terms for project-specific checks.
- `assets/调试测试卡.json` and `assets/调试世界书.json`: generic temporary test fixtures only.
- `references/`: task-specific command, safety, card-operation, and compatibility guidance.
