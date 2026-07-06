# Kabacal

Single-file web app for **order entry, nesting, offcuts and DXF export** for FAST CNC.

Previously published as `order-entry-beta.html` inside the `cnc-calculator` repo; it now lives here as its own project.

## Open the app

- Local: open `index.html` in a browser, or run a static server from this folder:

  ```powershell
  python -m http.server 8123 --bind 127.0.0.1
  # then open http://127.0.0.1:8123/
  ```

- Published (GitHub Pages): https://spaceinvuk.github.io/kabacal/

## Files

- `index.html` — the entire app (one self-contained HTML file: inline CSS + one inline `<script>`).
- `KABACAL_RULES.md` — confirmed nesting / offcut / DXF rules.
- `CLAUDE.md` — development conventions, guarded zones, verify/deploy workflow (read by Claude Code).
- `tools/check.mjs` — zero-dependency syntax + production-invariant checker (`node tools/check.mjs`); also runs in CI (`.github/workflows/check.yml`).
- `.claude/` — Claude Code subagents (pricing-guard, dxf-nesting-reviewer, cam-reviewer) and skills (/verify-kabacal, /pricing-impact, /deploy-kabacal).
- `.nojekyll` — tells GitHub Pages to serve files as-is.

## Notes

- Keep it a **single-file** app unless a build system is explicitly requested.
- The **Calculate / Panelling** button opens the separate production calculator
  (`spaceinvuk.github.io/cnc-calculator/Cnc%20Calculator%20UI%20Test.html`) — that app stays in its own `cnc-calculator` repo.
- Sheet margin and spacing between nested front parts are both `7mm`.

## Validate after editing

PowerShell — syntax-check the inline script:

```powershell
$html = Get-Content -Raw index.html
[regex]::Matches($html,'(?s)<script[^>]*>(.*?)</script>') | ForEach-Object { [void][ScriptBlock]::Create('') }  # see node check below
```

Node — extract `<script>` blocks and compile each:

```bash
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const s=[...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);s.forEach(x=>new Function(x));console.log("ok "+s.length+" script(s)")'
```
