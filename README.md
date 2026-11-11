# AGENTROPOLIS-CHAOS-MALL-RIBBON

Chaos Mall, main build. A 3D product ribbon: the Atrium plus seven product ads
(Signal Scout, Hook Forge, Quant Lens, Deck Pilot, Ops Relay, Lead Loom,
Fleet Command 54). Live at
https://agentropolis-city-of-agents.github.io/AGENTROPOLIS-CHAOS-MALL-RIBBON/

## What is in here

- `index.html` — thin shell: the mall's cards, strings, and links, plus one
  `createRibbonApp()` call. "Enter the mall" and "Shop the mall" open the mall interior (a shop grid
  on this page); clicking a ribbon card opens that shop inside it. Nothing
  on this page links out to the old console.
- `ribbon-kit.js` + `ribbon-kit.css` — vendored dated copies (2026-11-06) of the
  shared ribbon kit. The kit is the source of truth; do not fork the engine
  per build.
- `media/` — 8 mp4s + 8 poster jpgs, all local. No CDN at runtime.
- `three.module.js` — three.js 0.160.0, vendored.
- `fonts/` — Inter Tight woff2, vendored.

## What this repo is not

- The old mall app still lives at
  `AGENTROPOLIS-CHAOS-MALL` (Base44 Vite app). This repo does not link to it,
  does not import it, and does not replace it. PR #13 in that repo stays on
  hold unless NEURO says otherwise.
- Neuralis is not part of this build. There is no Neuralis code, link, or
  redirect anywhere in this repo.
- There are no redirect files in this repo. All navigation is in-page.

## Verified

Desktop 1280x720 + mobile 390x844 in real Chromium (2026-11-06): 0 console
errors, all 8 videos readyState 4, on-screen play / off-screen pause correct,
wheel moves the ribbon, mobile stack + arrow pills correct. Verification
record: `VERIFICATION.md` in the build folder (local).
