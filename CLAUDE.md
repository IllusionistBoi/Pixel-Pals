# CLAUDE.md — Pixel Pals

Guidance for Claude Code (and humans) working in this repo.

## What this is
A self-contained browser game: a **retro Pac-Man-style arcade maze chase**,
presented inside a neon **arcade cabinet**. Pom (the yellow chomper) clears the
maze of pellets while **four ghosts** hunt with a real **breadth-first search** —
the algorithmic soul of the original C++ console game (now in
`legacy/PixelPals.cpp`), scaled from one hunter to four. Power-pellets flip the
ghosts to frightened (eat them for 200→1600), warp tunnels wrap the board
left↔right. See `DESIGN.md` for the locked art brief (a Google-Stitch-informed
retro-arcade design system) and `PLAN.md` for the build history.

North star: **a coin-op cabinet you'd stop and play, whose ghosts think with a
real algorithm.** Keep it arcade-authentic and keep the BFS visible in the
gameplay (four minds pathfinding at once).

## Run it
No build step, no dependencies, no external assets (fonts/audio/graphics are all
system or procedural). Serve over HTTP (classic scripts; `file://` works in most
browsers too):

```bash
cd Pixel-Pals
python -m http.server 8000   # open http://localhost:8000
```
A pre-bundled single file lives at `dist/pixel-pals.html` (double-click to play).

Controls: Arrow keys / WASD move, Space/Esc pause, M mute. Idle on the title and
the cabinet auto-plays (attract mode).

## Architecture
Plain browser globals under a single `PP` namespace (no bundler). Scripts load in
dependency order in `index.html`; each file is an IIFE attaching to `window.PP`.
Keep that pattern — no ES modules / build step (self-containment is a feature).

| File | Role |
|---|---|
| `js/utils.js` | math/easing/timing helpers (`PP.U`) |
| `js/theme.js` | the arcade palette (hex + alpha helper) (`PP.Theme`) |
| `js/storage.js` | localStorage high scores + prefs (`PP.Storage`) |
| `js/pathfinding.js` | **BFS**, tunnel-aware (`step()` handles warp wrap) |
| `js/maze.js` | interconnected maze: full braid + perimeter ring + pen + warp tunnels |
| `js/input.js` | keyboard intent (held dir + turn buffer) |
| `js/audio.js` | 100% synthesized Web Audio (waka, power, eat-ghost, death, ready…) |
| `js/particles.js` | pooled particle system |
| `js/render.js` | the CRT/arcade renderer — bakes the neon maze, draws ghosts/Pom/pellets, scanlines |
| `js/game.js` | the sim: Pom + 4 ghosts (BFS personalities), power-pellets, modes, lives, states |
| `js/main.js` | boot, RAF loop, cabinet screen flow, HUD |

Data flow: `main.js` loop → `game.update(dt)` → `game.renderState()` → `render.frame(state)`.
Game never touches the canvas; render never mutates game state. The cabinet frame,
HUD bars, and menus are DOM (`index.html` + `css/style.css`).

## The four ghosts (the BFS crown jewel)
Each ghost runs a real BFS every time it reaches a tile center and greedily steps
toward its target with the classic no-reverse rule (`game.ghostDir`). Personalities
set the target (`game.ghostTarget`):
- **red / Blinky** — Pom's tile (direct chase)
- **pink / Pinky** — a few tiles ahead of Pom's heading (ambush)
- **cyan / Inky** — flanks (target reflected across Pom from Blinky)
- **orange / Clyde** — hunts when far, scatters to its corner when close

Global scatter/chase waves (`CHASE_TIME`/`SCATTER_TIME`) give the player breathing
room. Frightened ghosts flee (biased away from Pom); eaten ghosts become eyes and
BFS back to the pen. Difficulty = ghost speed (Hard ≈ Pom's speed) + `+/level`.

## Maze rules
`maze.generate` builds a randomized maze, then **fully braids** it (opens every
dead end), carves a **perimeter ring** (outer escape loop), a central **pen**
(open box; ghosts released on a timer), and one or two **warp-tunnel rows**
(cleared across, wrap left↔right). Steps 3–5 only OPEN tiles, so connectivity is
never broken. `tunnelRows` is threaded into BFS + movement via `PP.Pathfinding.step`.

## Rendering rules (performance)
- The neon maze is **baked once per level** into `mazeLayer` (glowing tube-lines
  tracing every wall edge that faces a corridor). Don't redraw it per frame.
- Pellets/power/ghosts/Pom/particles composite per frame; scanlines + vignette are
  a cheap screen-space pass.
- Balance `ctx.save()/restore()`; reset `shadowBlur`, `globalAlpha`,
  `globalCompositeOperation`, `filter` after use. Target 60fps.

## Colors / type
`PP.Theme.css(role[, alpha])` in canvas; CSS custom properties in `:root`. Arcade
palette: near-black CRT bg, amber `#ffce00` hero, electric-blue `#2c6bff` maze,
four ghost hues. Marquee/logo use a bold condensed system stack (Impact) with neon
glow; HUD uses a monospace stack (Space Mono → system mono). No external fonts.

## Gotchas
- `requestAnimationFrame` pauses on hidden tabs; the loop caps `dt`.
- Audio is suspended until the first user gesture; `audio.resume()` on interaction.
- Ghost AI returns `{x,y}` dirs (`DIRS4`), NOT `PP.Pathfinding.DIRS` (`{dx,dy}`).
  Mixing them yields `NaN` tiles — keep them straight.
- The pen is an open box (no walls); "release" is a per-ghost timer, and it only
  advances while `state === 'playing'` (not during READY).

## Do / Don't
- **Do** keep it one self-contained folder that runs from a static server.
- **Do** verify visuals by driving `game.update` + `canvas.toDataURL` (the tab may
  be hidden in headless tooling, which pauses RAF and screenshots).
- **Don't** add external assets, CDNs, fonts, or a build step.
- **Don't** make ghosts slower than Pom on Hard — being out-runnable is what made
  the earlier single-hunter version too easy.
