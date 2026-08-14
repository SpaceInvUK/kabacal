#!/usr/bin/env node
// SessionStart hook (repo-scoped, cross-platform): injects the Kabacal protocol into EVERY session
// opened on this repository — local on any OS or a claude.ai cloud environment — so the standing
// order survives outside Ednei's PC (where it also exists as a user-level PowerShell hook).
// Zero dependencies; prints the Claude Code hook JSON contract on stdout.
const ctx = `<kabacal-protocol source="tools/protocol-hook.mjs (repo SessionStart hook — standing order from Ednei)">
This session is on the Kabacal repository. Follow the Kabacal protocol AUTOMATICALLY for any work here, without being asked:
1. Read AGENTS.md, then STATUS.md, before editing anything.
2. \`git pull --rebase\` first.
3. Check \`.session.lock\` and the dirty tree (ONE writer at a time — local and cloud sessions share this rule); claim the lock while editing, delete it when done.
4. Identify the guarded zones the change touches (pricing / DXF / CAM-NC / nesting) and collect before-evidence.
5. If the task is a bug/issue: REPRODUCE it first, before any edit.
6. Smallest focused change — no drive-by refactors.
7. Run \`node tools/check.mjs\` after every index.html edit; NEVER commit if it fails; goldens byte-identical unless the diff is intentional and itemised.
8. Dated ROADMAP.md entry (with a "Testado" list), commit, push, confirm https://spaceinvuk.github.io/kabacal/ serves the change.
Cloud sessions: everything needed is in the repo (checker, goldens, docs, skills, agents); the physical world (VCarve, the Syntec machine, the local WordPress test site) is NOT reachable — flag anything needing them as pending for a PCGu session. See docs/CLOUD.md; docs/WORKSTREAMS.md maps every work stream (state + pendings + resume prompts).
</kabacal-protocol>`;
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx } }));
