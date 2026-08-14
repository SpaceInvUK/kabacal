# Kabacal from anywhere (Cloud)

Goal (Ednei, 2026-08-13): work on Kabacal from any device, not only PCGu. The project is
**already cloud-native in three layers**; the fourth (cloud Claude sessions) needs a one-time
setup in Ednei's claude.ai account — steps below.

## What is already in the cloud (nothing to do)

| Layer | Where | Access from anywhere |
|---|---|---|
| The app itself | GitHub Pages — https://spaceinvuk.github.io/kabacal/ | Any browser/phone. Push to `main` = deploy. |
| All code, docs, goldens, skills, agents | GitHub — `SpaceInvUK/kabacal` (public) | Clone/browse anywhere. The repo is self-contained: single `index.html`, zero-dep `tools/check.mjs`, byte-exact goldens. |
| Business settings (prices, tool DB, company, templates) | Supabase (SaaS Phase 3) | ☁ modal → **⇧ Push settings to cloud** once on PCGu, then **⇩ Pull** on any signed-in device. Orders from the site land in `fastcnc_orders` (Online Orders tab). |
| Cloud Claude sessions | claude.ai/code environment | **One-time setup below** — then start Kabacal sessions from browser or phone. |

## One-time setup: the "Kabacal" cloud environment (Ednei's part)

Cloud sessions run in Anthropic's managed sandbox against the GitHub repo. Creating the
environment needs Ednei's claude.ai login + a GitHub authorization click, so it cannot be
automated from a session:

1. Open **claude.ai/code** in a browser (logged in to the usual account).
2. Choose **New environment** (Environments / repository picker) → name it **Kabacal**.
3. Connect GitHub when prompted and authorize access to **SpaceInvUK/kabacal**
   (the Claude GitHub App → select the repo → Install/Authorize).
4. Open a session in that environment — the repo is cloned automatically and the
   **SessionStart hook** (`.claude/settings.json` → `tools/protocol-hook.mjs`) injects the
   Kabacal protocol; approve the project hooks/trust prompt on first run.
5. Optional: on the phone, the Claude app → Code shows the same environment.

If step 2/3 fails again, note the exact error message — that is the piece to debug next.

## What a cloud session CAN do

- Everything code-side: edit `index.html`, run `node tools/check.mjs`, verify the byte-exact
  goldens, run the headless order engine (`tools/order-engine.mjs`), update docs, commit + push
  (push = live on Pages ~1 min later).
- Preview: `python -m http.server 8123` in the repo root works in the sandbox.
- The one-writer rule applies ACROSS local + cloud: `git pull --rebase`, respect
  `.session.lock`, small commits, push often.

## What stays physical (PCGu / workshop only)

- **VCarve Pro** (toolpath templates, reference `.nc` validation, DXF gadget round-trip).
- **The Syntec/Pegasus machine** (air-cuts, real cuts, ScanMode folder).
- **The local WordPress test site** (fast-cnc-test.local, Local app).
- Reference files living in `W:\Documents\Vcarve` etc. — commit them to the repo or upload to
  the shared Drive if a cloud session ever needs one.

A cloud session that reaches one of these must record the pending step in STATUS.md for the
next PCGu session instead of guessing.

## Resuming a work stream from any session

`docs/WORKSTREAMS.md` maps every front (Doors editor, Paneling, CAM, SaaS, Doors Online,
WorkPlanner, infra) with its current state, pendings and a paste-ready opening message.
Sessions do not share chat memory — the repo docs are the only continuity.
