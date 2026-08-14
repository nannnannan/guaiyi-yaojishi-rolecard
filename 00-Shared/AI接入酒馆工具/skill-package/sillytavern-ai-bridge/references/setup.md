# Setup and environment

## Requirements

- Codex with local Skill support.
- Node.js 20 or newer with npm.
- A local SillyTavern installation. The `start` command can launch it when `ST_ROOT` or a derivable `ST_DATA_DIR` is available.
- Tavern Helper / JS-Slash-Runner enabled in SillyTavern.
- Microsoft Edge, or a Playwright-managed Chromium installation.

The Skill does not require an MCP server, cloud database, or additional Codex plugin.

## Install

Copy the complete `sillytavern-ai-bridge` directory into the local Codex Skills directory, then install the locked runtime dependencies:

```powershell
node <skill-dir>/scripts/bridge-runner.mjs setup
```

Setup runs `npm ci --ignore-scripts`, skips browser downloads, and uses a temporary npm cache. Edge is the default browser channel. If Edge is unavailable, install Chromium separately and set `ST_CHANNEL=chromium`.

## Environment variables

| Variable | Purpose |
|---|---|
| `ST_URL` | SillyTavern endpoint; defaults to `http://127.0.0.1:8000` |
| `ST_PASSWORD` | Local login form password when the host requires it; never store it in the Skill |
| `ST_CHANNEL` | `msedge` by default, or `chromium` |
| `ST_HEADED` | Set to `1` to show the browser window |
| `ST_DATA_DIR` | Non-default SillyTavern user-data directory for file, log, or backup operations |
| `ST_ROOT` | SillyTavern installation directory containing `server.js`; required by `start` when it cannot be derived |
| `ST_LOG_DIR` | Directory for `start` stdout/stderr logs; defaults to `<ST_DATA_DIR>/bridge-logs` |
| `ST_OUTPUT_DIR` | Parent directory for screenshots and replacement backups |
| `ST_CAPTURE_DIR` | Explicit private directory for prompt-capture output |
| `ST_SKILL_PRIVACY_DENYLIST` | Pipe-separated project-specific terms used by package verification |

## First checks

Start or confirm the host first:

```powershell
node <skill-dir>/scripts/bridge-runner.mjs start --json
```

Run the offline package verifier:

```powershell
node <skill-dir>/scripts/bridge-runner.mjs verify
```

Then run the read-only live acceptance check:

```powershell
node <skill-dir>/scripts/bridge-runner.mjs verify-live --json
```

The live verifier reports only versions, counts, and capability booleans. It does not report stored character, worldbook, preset, or chat names and performs zero mutations.
