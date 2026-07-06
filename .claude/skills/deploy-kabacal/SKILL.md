---
name: deploy-kabacal
description: Checked deploy for Kabacal — run the invariant checker, require verification evidence for guarded zones, commit with a conventional message, push to main (= GitHub Pages deploy), and confirm. Use when asked to "deploy", "publish", "push", or "ship" Kabacal changes.
---

Push to `main` IS the deploy (GitHub Pages). So the gate lives here.

## Gate — all must pass before commit

1. `node tools/check.mjs` → `kabacal check ok`. On failure: stop, fix, restart the gate.
2. `git status` + `git diff --stat` — confirm the change set is only what the current task intended. Unrelated files → ask the user before including them.
3. **Guarded-zone scan**: if the diff touches `calcQuote|priceForSheet|cncForThickness|sprayCalc|machOf|PRICES|DXF_LAYERS|dxfForThickness|buildDxfByThickness|ncPegasus|camMovesForSheet|camPerimeter|tabPositions|mrInsert|autoPack|packMulti|offcut` then the matching evidence must already exist in this conversation:
   - pricing → `/pricing-impact` table shown to the user
   - DXF/nesting → `/verify-kabacal` + before/after DXF diff
   - CAM → `/verify-kabacal` + before/after .NC diff
   Missing evidence → run it now; do not skip.
4. `/verify-kabacal` ran green after the LAST edit (any edit after the last verify invalidates it).

## Ship

5. `ROADMAP.md`: dated entry at the top describing the change + a "Testado" list of what was verified (house convention).
6. Commit: `git add` the intended files; message = `Area: what changed` (match existing history style, e.g. `Hinges: middle hinges are individually nudgeable`); end with the Claude co-author line.
7. `git push origin main`. Never force-push. If push is rejected (remote ahead): `git pull --rebase origin main`, re-run `node tools/check.mjs`, then push.

## Confirm

8. Pages serves the pushed commit within ~1 minute. Verify with `curl -s https://spaceinvuk.github.io/kabacal/ | head -c 400` (or fetch) and compare a string unique to the new version; if stale, wait and retry once or twice.
9. Report: commit hash, what shipped, the live URL, and remind about hard-refresh (Ctrl+F5) for cached browsers.
