> ⚠️ **SUPERSEDED (2026-07-12).** The felt-diorama direction below was the v1 art
> brief. After playtesting, the game was **totally redesigned into a retro
> Pac-Man arcade cabinet** (see `PLAN.md` → "v2"). The current, authoritative
> visual spec is the **Google Stitch "Pixel Pals Arcade" design system**:
> near-black CRT `#07070f`, amber hero `#ffce00`, electric-blue maze `#2c6bff`,
> four ghost hues (`#ff2e4d` `#ff7dd1` `#33e4ff` `#ff9b3d`), Bebas-Neue marquee +
> Space-Mono HUD, arcade cabinet with scanlines + curvature. `js/theme.js` and
> `css/style.css` hold the live values. The diorama brief is kept below for
> history only.

---

# Pixel Pals: Diorama — Art & Game-Feel Brief (v1, superseded)

> Chosen by a 5-direction judge panel (see `PLAN.md`). Through-line, one sentence:
> **it is a real, handmade shoebox diorama on a desk, and the pathfinding
> algorithm is the lamp the monster hunts you by.** Every effect either sells
> "this is a physical craft object" or "the BFS is the predator's light."

## 1. Concept + mood
A felt-and-cardboard maze in a shoebox on a kid's desk at 9pm — a knocked-sideways
gooseneck lamp raking across construction paper while a pipe-cleaner monster feels
its way toward you through amber light bleeding up from under the box. The first
wow: it looks like a *photographed physical object*, not neon-on-black. The second
wow: the warm light creeping toward you *is the BFS frontier thinking out loud*.

## 2. Palette (OKLCH, locked)
| Role | OKLCH | Meaning |
|---|---|---|
| bg | `oklch(0.24 0.025 75)` | corkboard/desk umber — warm near-black, never blue-void |
| maze-top | `oklch(0.88 0.05 85)` | cardboard wall top face, cream-kraft (fluting stripes) |
| maze-side | `oklch(0.58 0.05 70)` | extruded wall thickness (gives tiles height) |
| floor-felt | `oklch(0.30 0.03 60)` | corridor felt the dots sit on |
| pal | `oklch(0.74 0.16 55)` | felt-orange pom-pom hero ("Pom") |
| eater | `oklch(0.38 0.14 300)` | grape-velvet monster-doll ("Grabbins") |
| dot | `oklch(0.90 0.18 95)` | gold sequin pip + hot glint |
| powerup | `oklch(0.70 0.19 145)` | mossy craft-green resin bead |
| accent-led | `oklch(0.80 0.25 195)` | the ONE cold neon note — fairy-light bulbs at dead-ends |
| bfs-glow-hot | `oklch(0.83 0.17 72)` | **the hunting light** — warm amber at the live search frontier |
| bfs-glow-cold | `oklch(0.42 0.05 68)` | decayed trailing edge (~500ms behind frontier) |
| bfs-path | `oklch(0.72 0.10 70)` | dotted "pencil-marked" committed shortest path |
| wear-smudge | `oklch(0.46 0.03 60)` | persistent visit-log grime where the Eater has been |
| console-fg | `oklch(0.86 0.19 132)` | death-screen C++ phosphor green (cold intrusion) |
| console-bg | `oklch(0.14 0.008 150)` | console black |

Discipline: warm-craft everywhere; exactly two cold notes (LED prop + console),
both load-bearing. No magenta/cyan duotone. No black void.

## 3. Characters
- **Pom (Pal):** round felt pom-pom + two ear-tufts (fuzzy-tribble silhouette,
  never a Pac-circle), button eyes with a pupil that leads the travel direction,
  stitched V-mouth. Eats → mouth pops to `0`, ears perk, +15% scale hop with
  jiggle. Near-capture → wide eyes, leans away. Tumbling-roll movement, spring
  settle. **Score = gold sequins that crust onto its body over a run** (no HUD).
- **Grabbins (Eater):** same construction, grape-velvet, on 3 pipe-cleaner legs
  (2-joint IK), mismatched googly eyes. Drops a sequin-dot on every tile it
  leaves. **Telegraphs the BFS hunt by posture:** leg-splay + forward lean scale
  with 1/distance-to-Pom. **Signature quirk — eye convergence:** eyes wander
  lazily all chase, then snap into locked convergent focus in the final 1–2 tiles
  before a catch. "Eyes line up = death," taught without a tutorial.

## 4. Signature effects (by impact)
1. **BFS hunting light** (§8) — the game's centerpiece.
2. Tabletop feel: slight tilt/rotation, virtual gooseneck lamp casting wall
   shadows, warm spotlight lag-following Pom.
3. Paper-fiber noise overlay (multiply) — the single highest-leverage craft cue.
4. Extruded walls: shadow + side face + top face → real height above the felt.
5. Persistent visit-log wear where the Eater has crossed.
6. Felt/pipe-cleaner secondary motion (springs + IK), also driven by box-knock.
7. Push-pin / glue-dot micro-props at dead-ends (deterministic per seed).
8. Sequin score-crust + combo shimmer.

Perf: pre-render noise/shadows/wall tiles to atlases; the BFS underlight is the
only per-frame offscreen pass, at ¼-res. Locked 60fps target.

## 5. Audio (fully synthesized — wound-up toy orchestra, not chiptune)
- Music-box/celesta ambient motif; **playback slows (winds down) as the Eater's
  BFS distance shrinks**, snaps back on a near-miss escape.
- Dot pickup climbs a pentatonic scale per combo step (eating = a playable tune).
- **BFS recompute "ping"** whose pitch maps live to Manhattan(Eater, Pom) — the
  algorithm made audible.
- Eater footsteps tempo-locked to BFS step rate; paper-crinkle on bumps; hollow
  cardboard "tok" on box-knock; warm "toybox-lid" thud on capture (never a
  digital fail-buzzer), then a cold terminal beep for the console reboot.

## 6. Signature moments (build all three)
1. **Eye-convergence death tell** (§3).
2. **C++ ancestor death screen** — on capture, lamp cuts out, diorama collapses
   to black for a beat, then the screen becomes the literal original C++ console:
   monospace green-on-black rendering the maze in `#`/`.`/`H`/`E`, frozen at the
   catch, `GAME OVER — process exited (SIGKILL)`, blinking cursor ~3s, then a
   reboot flicker back to felt. Aimed at the CS graders.
3. **Knock the box + "COMPUTER PLAYS" attract mode** — click the diorama to send
   every spring jiggling; after ~20s idle the cabinet self-plays via BFS with a
   COMPUTER PLAYS marquee.

## 7. Framing (no floating HUD)
Score = sequin crust. Tension = Eater posture + audio wind-down. Difficulty =
hand-lettered index-card tab. Title = a closed shoebox with crayon lettering; lid
lifts to reveal the maze. Pause = the lamp dims. Game over = the §6.2 sequence.
Diegetic text is hand-lettered/marker; strict monospace ONLY in the console.

## 8. BFS visualizer = the hunting light (crown jewel)
Not a debug toggle — the Eater's diegetic flashlight under the box, wired to the
real search. Per real recompute: frontier cells light from underneath in
`bfs-glow-hot` as BFS expands along true graph edges; short parent→child tendrils
fan toward Pom; each cell decays hot→cold→dark over ~500ms (easeOutExpo) leaving a
comet trail; the resolved shortest path draws as a dotted pencil line; a ping
fires, pitch = Manhattan(Eater, Pom). A grader sees a correct real-time BFS
flood-fill with frontier + parent pointers + decay + extracted path; everyone else
sees a monster feeling toward them through the glowing floor. **Same pixels, both
truths.**

## Playtest revisions (2026-07-12)
Changes made after the first playable build, from direct feedback:
- **BFS light → calm heatmap.** The animated amber flood re-swept every recompute
  and was too distracting. Replaced with a smoothly-eased low-opacity heatmap of
  the Eater's live BFS *distance field* (warmer = closer), out to `HEAT_RADIUS`.
  Same "the algorithm is the light" idea, far easier on the eyes.
- **Trail food → scattered pellets.** The "eat the Eater's dropped trail" mechanic
  read as unclear. Now the objective is obvious: clear all the scattered gold
  pellets. (Points still crust onto Pom as sequins.)
- **Removed the blue LED dead-end prop** — it read as a collectible.
- **Harder.** The Eater is now as fast as / faster than the Pal and **ambushes**
  (targets ahead of the Pal's heading, scaled by difficulty). You can no longer
  simply outrun it.

## 9. Build order (max WOW first)
1. BFS hunting light, fully. 2. Physical-object read (tilt + shadows + noise +
extrusion). 3. Diegetic score/tension (sequins + Eater tell). 4. C++ death screen.
5. Toy audio (wind-down + combo melody + ping). Then garnish: LED props, box-knock,
attract mode, power-up beads — never at the cost of 60fps or the physical illusion.
