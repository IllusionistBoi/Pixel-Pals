# Pixel Pals — Elevation Plan (Pro Plan Log)

> Living document. Tracks the vision, decisions, and progress for taking the
> original C++ console game to a "wow" browser experience. Updated as work lands.

## What it was
A Windows C++ console game (`PixelPals` source, `Pixel_Pals.exe`). ASCII 18×32
maze. Player `H` collects dots dropped by an "Eater" `E` that chases via a real
**BFS shortest-path** algorithm. Difficulty (E/N/H) = enemy speed. Clever CS
core, zero visual appeal (monochrome console text).

## What it becomes
**Pixel Pals: Neon Hunt** — a self-contained, gorgeous, juicy browser arcade
game. Keeps the algorithmic soul (BFS chaser) but wraps it in neon, particles,
character, and synthesized sound. Runs from a single folder, no build step, no
external assets — so it's shareable and instantly "wow".

### Art direction
- Mood: "midnight arcade cabinet meets bioluminescent deep-sea — electric,
  playful, a little eerie."
- Palette (OKLCH): near-black blue-violet void bg; electric cyan/teal neon maze
  (honors seed hue ~200); warm amber "Pal" hero that pops against the cold maze;
  hot-magenta glitch "Eater"; gold dot pips; violet power-up accents.
- Effects: bloom/glow, CRT scanlines, subtle chromatic aberration, vignette,
  parallax star/grid field, particle trails, dot-pop bursts, screen shake.
- Character: the Pal blinks + squishes + has directional eyes; the Eater gnashes
  and leaks a glitch trail; a faint BFS "hunt tendril" shows it seeing you.
- Audio: 100% Web Audio synthesized chiptune (no files) — ambient arps, eat
  blips, rising tension as the Eater closes in, capture stinger.

### Feature set (beyond the original)
- Difficulty (Easy/Normal/Hard) → Eater speed + AI aggression (preserved concept)
- Combo / multiplier scoring; localStorage high-score table
- Power-ups: Freeze, Blink (teleport), Shield
- **Algorithm Visualizer toggle** — renders the live BFS flood-fill + shortest
  path. Honors the CS origin; great for a college project demo.
- Polished flow: title → difficulty → HUD → pause → game over → restart
- Accessibility: keyboard + reduced-motion + colorblind-safe cues; responsive.

## Orchestration (subagents, Ultracode on)
1. **Design-direction judge panel** (workflow): N distinct directions → scored →
   synthesized brief. Enriches the direction above.
2. **Build** (main thread, for cohesion): scaffold → BFS core → render → juice →
   audio → states → power-ups → visualizer → polish.
3. **Multi-lens review** (workflow): design critique · code correctness ·
   gameplay balance · a11y · perf — each adversarially verified. Then fix.
4. **Verify** (main): run in browser, screenshot, play-test, iterate.
5. **Finalize**: CLAUDE.md, README, memory, commit.

## Progress log
- [x] Analyzed original C++ source + README
- [x] Loaded impeccable design skill; got palette anchor (hue 200)
- [x] Design-direction judge panel → winner: **Diorama** (BFS = hunting light)
- [x] Project scaffold + BFS port (pathfinding/maze/input/audio/particles/utils/storage)
- [x] Core render (baked atlases, extruded walls) + game loop + state machine
- [x] Juice (particles, shake, chiaroscuro lamp, comet BFS light) + synth audio
- [x] States, power-ups, attract mode, C++ console death screen, scoring/sequins
- [x] Browser verify — captured gameplay, characters, console screen; full loop tested
- [x] Legacy C++ files preserved in legacy/; CLAUDE.md + README written
- [x] Legacy C++ files preserved in legacy/; CLAUDE.md + README written
- [x] **Playtest revision (user feedback):** BFS flood → calm distance heatmap;
      eater-trail food → clear scattered pellets; removed confusing blue LED;
      Eater now faster-than-Pal + ambushes (harder); live HUD score + pellets-left
- [x] Single-file standalone (`dist/pixel-pals.html`) + published live Artifact
- [ ] Commit (pending user go-ahead)

## v2 — Total redesign → retro arcade (2026-07-12)
User pivoted hard after playtesting the felt diorama: wanted a true Pac-Man
arcade. Consulted **Google Stitch** (added the MCP with the user's key; created a
project + a "Pixel Pals Arcade" design system that codified the direction:
near-black CRT, amber hero, electric-blue maze, four ghost hues, Bebas/Space-Mono,
cabinet + scanlines). Then rebuilt:
- **maze.js** — interconnected: full braid (no dead ends) + perimeter escape-loop
  + central pen + warp tunnels (wrap L↔R). Fixes "only one way out".
- **pathfinding.js** — tunnel-aware BFS (`step()` wraps).
- **game.js** — Pom + **four ghosts** with classic BFS personalities, power-pellets
  + frightened/eat-ghost (200→1600), pen release timers, lives, scatter/chase
  waves, arcade state flow (attract→ready→playing→dying→gameover). Harder: ghosts
  as fast as Pom on Hard, and 4 of them.
- **render.js** — CRT/arcade renderer: baked neon double-line maze, four ghosts
  (+ frightened + eyes), yellow chomper w/ death anim, scanlines + vignette.
- **index.html / css** — arcade cabinet: marquee, CRT bezel, 1UP/HIGH-SCORE HUD
  bars (HUD no longer overlaps the maze), control deck, retro screens. The C++
  console death screen was removed (user disliked it) → clean arcade GAME OVER.
- Verified: canvas renders (neon maze, ghosts, frightened, chomper); full UI flow
  title→diff→play→gameover; standalone bundle boots. Cabinet chrome verified by
  layout (screenshot tooling blocked here) — see the live Artifact.

## v3 — Codex staff-level UI critique + fixes (2026-07-12)
Ran an unbounded Codex (`gpt-5.6-sol`) review; cross-checked and implemented the
true findings: coordinate-preserving ghost reversals (no teleport), GLOBAL
frightened window (ghosts released mid-power are edible too), attract-mode
self-recovery (+ idle→title), reduced-motion-safe ≤2Hz flashing, audio unlocked
behind first gesture + music actually started, continuous DPR-crisp neon walls,
crisp ivory pellets vs. glowing hero, CRT glass over the whole screen, touch/swipe
input + semantic deck buttons, zoomable viewport + short-screen fallbacks,
turn-buffer, a live BFS "algorithm view" in attract, and a batch of small bugs
(lives, float-score dt, credit-bump, mute labels) + motion/type polish.

## v4 — deferred items, built WITH Codex (2026-07-13)
- **Codex** (write-scoped to `css/style.css`): unified cabinet silhouette (one
  shared `--cabinet-w`, marquee side-struts, cohesive body) + `@font-face` scaffold.
- **Claude**: left-right **symmetric** maze + a **walled ghost-house** with a pink
  gate (Pom blocked, ghosts exit/enter through it), a reachability guarantee so
  every level clears, **3-initial high-score** entry, **Gamepad** support, and
  **ARIA** (dialog roles, live region, focus management, shortcut scoping).
- **Claude filled in** the real Press Start 2P + VT323 WOFF2 as base64 data URIs
  (Codex's sandbox had no network) so the arcade font is deterministic + embedded.
All verified: fonts load, cabinet unified (820px), 0 unreachable pellets, ghosts
emerge from the house, initials save, no JS errors. Committed on a branch.

## Open questions
- The "old Pygame visuals in the Story section" the user saw: no artifact exists
  under the account and the repo has no old copy (grepped clean). Source
  unidentified — likely a stale GitHub social-preview or an external mockup.
  Awaiting the user to point to the exact location.

## Verification notes
- Tab is hidden in headless tooling → `requestAnimationFrame` is paused there, so
  live play/screenshots don't run; verified instead by driving `game.update()`
  manually + capturing `canvas.toDataURL` to PNGs. All core loops confirmed:
  eating (+score, sequins, combo), freeze power-up, level-up, capture → dying →
  C++ console → gameover with high score saved.
- Renderer confirmed producing correct output (cardboard walls, amber BFS light,
  characters with sequin crust + eye-lock tell).
