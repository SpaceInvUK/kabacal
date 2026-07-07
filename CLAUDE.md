# Kabacal — Claude Code notes

**`AGENTS.md` is the source of truth** for what this app is, the iron rules, guarded zones, the map, the session protocol, and how to verify/deploy — for ALL models. Read it first, then `STATUS.md`. This file only adds Claude-specific conveniences.

@AGENTS.md

## Claude-only extras

- **Preview server:** use preview config `kabacal` (python http.server, port 8123).
- **Skills:** `/verify-kabacal` (runtime smoke test + golden diff) · `/pricing-impact` (HEAD vs working-tree basket comparison) · `/deploy-kabacal` (gated commit + push + Pages confirm).
- **Subagents** (read-only reviewers, `.claude/agents/`): `pricing-guard` · `dxf-nesting-reviewer` · `cam-reviewer`. Run the matching one on any guarded-zone diff before shipping; `cam-reviewer` currently holds the full machine contract (until `docs/CONTRACT-CAM.md` is extracted).
- **Memory:** Claude project memory may contain Kabacal notes. The repo files win on any disagreement — fix the repo file, not the memory.
