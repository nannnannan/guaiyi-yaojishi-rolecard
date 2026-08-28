# Card operations

## Full import

Use `import-card` when adding a new card. It can import JSON or PNG, apply tags, create or update the embedded worldbook, install Tavern Helper scripts and regexes, enter a selected chat, and repair the persisted PNG payload.

After importing, `import-card` reads the persisted PNG back and verifies `system_prompt` / `post_history_instructions` survived the page's shallow-character saves; if a deferred page save strips them after the final rebuild, it rewrites the file from the source card automatically (up to 3 attempts) and warns in the report. Treat any "提示字段校验" failure or warning in the output as a hard failure: do not accept the import until a re-read shows both fields byte-identical to the source.

Before importing:

1. Read the card name and requested target.
2. Check for an existing character with the same name.
3. Decide whether tags, worldbook, scripts, regexes, and an existing chat should be applied.
4. Ask before overwriting or deleting anything.

## In-place replacement

Use `replace-card` to upgrade a card while preserving all chats attached to its avatar slot.

Required sequence:

1. Run a JSON dry-run.
2. Confirm the old character name and avatar slot exactly.
3. Review every chat fingerprint.
4. Read the old bound worldbook from the character binding, not from a guessed embedded name.
5. Reject when another character still binds the old book.
6. Reject when the new card's bound worldbook name conflicts with its embedded book name.
7. Back up the old PNG, chats, and relevant worldbooks.
8. Apply with the exact `--confirm-target` value.
9. Load the new worldbook before deleting an unshared, differently named old bound book.
10. Re-read the host state and verify chat byte stability, card fields, regexes, scripts, and worldbooks.

Same-name worldbooks are updated in place. Unrelated and shared books must remain untouched. A failed transaction must restore the card and worldbook snapshots.

## Temporary acceptance test

`verify-replace` creates timestamped temporary cards, chats, and worldbooks. It tests shared-book refusal and two consecutive upgrades, then removes only its unique temporary data. Run it only when the user authorizes write-path testing in the live host.
