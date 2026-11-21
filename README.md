# verano-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kurodo-ai/verano-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kurodo-ai/verano-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Verano Heat is an original top-down 2D open-world crime game built with plain web tech. It drops you into Verano City — a 3600×2700 pastel coastal city laid out on a road grid, with 50 buildings, a beach and boardwalk, and named landmarks to learn your way by. You explore on foot and by car, slipping into traffic that drives itself around you, and every crime raises your heat with the VCPD: a wanted system that escalates all the way to five stars as police pour in. Fight with your fists or a pistol, run a four-mission story chain of jobs for cash, and when the story runs out, keep earning in an endless chop-shop loop. A HUD with a live minimap keeps you oriented, title, pause and game-over screens frame the run, and your progress is kept in a localStorage save. There is no build step and no network at runtime — every sound is synthesized live with WebAudio.

## Controls

**WASD / arrow keys** move — in a car, W/S (or ↑/↓) are throttle and reverse, A/D (or ←/→) steer, and **Space** is the handbrake · **E** gets in and out of cars · **F** punches · aim with the **mouse** and hold the **left button** to fire the pistol · **Shift** sprints · **P** or **Esc** pauses · **M** mutes.

## Run it

To play it locally, serve the `game/` folder with the bundled dev server (Node 22, standard library only — nothing to install):

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. (Pass `--port <n>` to `serve.ts` to use a different port.)

The hand-in program is `main.ts`. It copies `game/` and `screenshots/` from beside itself into the output directory and writes `dossier.json` there — the summary the judge reads — built with the vendored library in `vendor/`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Without `MAKEFUN_OUTPUT_DIR` set, the output directory is `/output`.

## What's in the repo

- `game/` — the game itself: `index.html` and its ES modules under `src/`. Plain static files; it runs offline with no network requests.
- `screenshots/` — four real screenshots of the game running; the first one is the cover.
- `main.ts` — the hand-in program described above.
- `vendor/` — the vendored make.fun game library (`makefun-game.ts`) that `main.ts` uses to build the dossier.
- `serve.ts` — the tiny local server above.

<sub>Entered on [make.fun](https://make.fun/?ref=gzzxjh8r&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
