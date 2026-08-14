# Runtime compatibility

SillyTavern and Tavern Helper change over time. Treat exact functions, event payloads, and DOM selectors as version-sensitive.

## Probe first when behavior drifts

Run:

```powershell
node scripts/bridge-runner.mjs probe
```

Compare the observed versions and capability surface with the operation being attempted. Do not infer support from an older test record.

## Integration approach

- Use Tavern Helper APIs for normalized character, worldbook, chat-history, Slash, and raw-character operations when available.
- Use the live SillyTavern context for event dispatch, message-floor operations, chat persistence, character-book conversion, and host-native actions.
- Re-read state after a reload or mutation. A successful invocation is not sufficient evidence by itself.
- For import or replacement, verify the persisted PNG payload and host records rather than trusting only the UI toast.
- For delete or regenerate, reuse host-native behavior and event flow where possible.

If an exact capability matters, inspect the current runtime and official/project-provided API references before editing the bridge.
