# Privacy and safety

## Read-only boundary

Status, chat reads, character lists, worldbook reads, preset reads, regex reads, script reads, runtime probes, and dry-runs are diagnostic operations. Report only information relevant to the request.

## Sensitive material

Treat these as sensitive even when stored locally:

- usernames and absolute home paths;
- character names, chat IDs, chat text, and fingerprints;
- presets, system prompts, worldbook content, regex bodies, and helper scripts;
- captured model requests and responses;
- authentication data, cookies, extension settings, and API credentials;
- screenshots, logs, backups, and generated test artifacts.

Never inspect or return keys, passwords, tokens, or unrelated extension settings. Never include runtime captures, screenshots, backups, logs, `node_modules`, or host-specific test output in a redistributed Skill.

## Mutation boundary

Obtain explicit authorization before generation, import, replacement, deletion, cleanup, or side-effecting Slash/eval commands. Resolve exact targets with read-only commands first. Prefer dry-run and reversible backups.

Do not test write behavior on a formal user card. Use unique timestamped temporary names, verify cleanup targets exactly, and remove only those temporary objects.

## Prompt capture

Prompt capture records the actual request sent to the model and can contain private conversations and configuration. Keep captures local, do not attach them to a Skill, and summarize narrowly. Delete captures only when the user authorizes cleanup.

## Package audit

Run the bundled audit before distribution:

```powershell
node scripts/audit-privacy.mjs --deny "<project-specific term>" --deny "<local username>"
```

Repeat `--deny` for each project name, formal character name, known chat identifier, or other private marker. The audit also rejects packaged generated-data directories, absolute user paths, and stored SHA-256-like fingerprints.
