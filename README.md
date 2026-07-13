# Pixel Pals

**A retro Pac-Man-style arcade cabinet where four ghosts hunt you with a real breadth-first search.**

Pixel Pals began as a Windows C++ console game — a maze of `#` and `.` where an
`E` chased an `H` using BFS. This is that algorithm, grown from one hunter into
four and dropped into a glowing arcade cabinet. Clear the neon maze of pellets
while Blinky, Pinky, Inky and Clyde close in, each pathfinding with its own
personality. Grab a flashing power-pellet and turn the tables — the ghosts go
blue and you can eat them. Duck through the warp tunnels to shake them.

## Play

No install, no build, no downloads — one self-contained folder, everything
procedural. Serve it and open it:

```bash
python -m http.server 8000        # then open http://localhost:8000
```

Or just double-click **`dist/pixel-pals.html`** (a single bundled file).

**Controls**
- **Arrow keys** / **WASD** — move
- **Space / Esc** — pause · **M** — mute
- Idle on the title and the cabinet plays itself (attract mode).

## What's in it

- **Four ghosts, four minds.** Each runs a genuine breadth-first search every
  time it reaches a junction. Blinky chases you head-on, Pinky ambushes ahead of
  your heading, Inky flanks, Clyde loses his nerve up close. They alternate
  chase/scatter waves so you get room to breathe.
- **Power-pellets + eat-the-ghost.** Four flashing pellets flip every ghost to
  frightened blue; eat them for 200 → 400 → 800 → 1600, and they scurry back to
  the pen as eyes.
- **An interconnected maze.** Fully braided (no dead-end traps), with a perimeter
  escape-loop and warp tunnels that wrap the board left ↔ right — always a way out.
- **The whole cabinet.** Neon marquee, CRT bezel with scanlines and curvature,
  a 1UP / HIGH SCORE HUD, lives, a control deck with joystick and coin slot.
- **A wound-up toy-arcade soundtrack**, fully synthesized in the browser.

## The algorithm

The heart is `js/pathfinding.js` — a tunnel-aware breadth-first search returning
the shortest path and a full distance field. `js/game.js` runs it four times a
frame-ish (once per ghost decision) to drive the hunt. Same idea as `FindPath()`
in `legacy/PixelPals.cpp`, the C++ ancestor.

## Project layout

```
index.html          arcade cabinet shell + screens
css/style.css        cabinet, CRT, neon HUD
js/                  the game (see CLAUDE.md for the file map)
legacy/              the original C++ console game it grew from
dist/pixel-pals.html a single self-contained build (double-click to play)
DESIGN.md            the retro-arcade art brief (Stitch design system)
PLAN.md              build history
CLAUDE.md            architecture & conventions
```

## Credits

Reimagined from a college C++ project; visual direction developed with Google
Stitch. All graphics and audio are procedural — no external assets. ♥
