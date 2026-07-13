/*
 * game.js — the Pixel Pals arcade simulation (a Pac-Man-style chase).
 *
 * Pom (the yellow hero) clears the maze of pellets while FOUR ghosts hunt via a
 * real breadth-first search — the algorithmic soul of the original C++ game, now
 * four minds instead of one, each with a classic personality:
 *   red  Blinky  — chases Pom's tile directly
 *   pink Pinky   — ambushes a few tiles ahead of Pom's heading
 *   cyan Inky    — flanks (targets across Pom from Blinky)
 *   orange Clyde — skittish: hunts when far, scatters to its corner when close
 * Power-pellets flip the ghosts to frightened; eat them for escalating points and
 * they return to the pen as eyes. Warp tunnels wrap the board left<->right.
 */
(function (root) {
  'use strict';

  var DIFFS = {
    easy:   { pom: 6.6, ghost: 4.7, label: 'EASY' },   // relaxed amble
    normal: { pom: 6.8, ghost: 5.8, label: 'NORMAL' },
    hard:   { pom: 7.0, ghost: 6.6, label: 'HARD' },   // just under you — 4 of them + ambush is plenty
  };

  var FRIGHT_TIME = 7.0;      // seconds ghosts stay edible after a power-pellet
  var FRIGHT_FLASH = 2.0;     // last seconds it flashes white
  var SCATTER_TIME = 7.0;     // ghosts periodically scatter to their corners
  var CHASE_TIME = 22.0;
  var GHOST_SCORES = [200, 400, 800, 1600];
  // Direction set as {x,y} (movement + AI use this; PF.DIRS uses {dx,dy}).
  var DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  var GHOST_LABELS = { red: 'BLINKY // DIRECT CHASE', pink: 'PINKY // AMBUSH AHEAD', cyan: 'INKY // FLANK', orange: 'CLYDE // SKITTISH' };

  function key(x, y) { return x + ',' + y; }

  function Game(deps, hooks) {
    this.R = deps.renderer; this.A = deps.audio; this.I = deps.input;
    this.hooks = hooks || {}; this.U = root.PP.U;
    this.Maze = root.PP.Maze; this.PF = root.PP.Pathfinding;
    this.particles = new root.PP.Particles.System(1200);
    this.state = 'attract';
    this.diff = 'normal';
    this.cols = 31; this.rows = 19;
    this.time = 0; this.shake = { x: 0, y: 0, mag: 0 };
    this.ghostTypes = ['red', 'pink', 'cyan', 'orange'];
  }
  var G = Game.prototype;

  // ---- Level setup --------------------------------------------------------
  G.newLevel = function (opts) {
    opts = opts || {};
    var m = this.Maze.generate(this.cols, this.rows, opts.seed);
    this.grid = m.grid; this.cols = m.cols; this.rows = m.rows;
    this.tunnelRows = m.tunnelRows; this.tunnelSet = new Set(m.tunnelRows);
    this.pen = m.pen; this.powerCells = m.powerCells;
    // Tiles Pom may not enter (the ghost house + its gate) — ghosts only.
    this.penBlock = {};
    if (this.pen) {
      this.penBlock[key(this.pen.gate.x, this.pen.gate.y)] = 1;
      for (var pbi = 0; pbi < this.pen.cells.length; pbi++) this.penBlock[key(this.pen.cells[pbi].x, this.pen.cells[pbi].y)] = 1;
    }
    this.pf = { tunnelSet: this.tunnelSet };
    this.R.layout(this.grid, this.cols, this.rows, { tunnelRows: this.tunnelRows, pen: this.pen });

    // Pellets: every open corridor tile Pom can REACH (guarantees the level is
    // clearable), except the pen + power-pellet tiles.
    this.dots = new Map(); this.power = new Map();
    var reach = this.floodReach(m.pomStart);
    var powerSet = {};
    this.powerCells.forEach(function (c) { powerSet[key(c.x, c.y)] = 1; });
    for (var y = 0; y < this.rows; y++) {
      for (var x = 0; x < this.cols; x++) {
        if (this.grid[y][x] !== 0) continue;
        var k = key(x, y);
        if (!reach[k]) continue;               // unreachable / inside the house
        if (powerSet[k]) { this.power.set(k, { t: 0 }); continue; }
        this.dots.set(k, 1);
      }
    }
    // Don't put a pellet on Pom's start tile.
    this.dots.delete(key(m.pomStart.x, m.pomStart.y));
    this.totalPellets = this.dots.size + this.power.size;

    var dspeed = DIFFS[this.diff];
    var lvl = this.level || 1;
    this.pom = this.makeEntity(m.pomStart.x, m.pomStart.y, dspeed.pom + (lvl - 1) * 0.1);
    this.pom.dir = { x: -1, y: 0 }; this.pom.wish = { x: -1, y: 0 };
    this.pom.spawn = { x: m.pomStart.x, y: m.pomStart.y };

    this.ghosts = [];
    var gs = m.ghostStarts;
    // Stagger releases so you get solo time before the swarm; slower on Easy.
    var release = this.diff === 'easy' ? [0, 4, 9, 15] : this.diff === 'hard' ? [0, 2.2, 4.6, 7.5] : [0, 3, 6.5, 10.5];
    for (var i = 0; i < 4; i++) {
      var g = this.makeEntity(gs[i].x, gs[i].y, dspeed.ghost + (lvl - 1) * 0.08);
      g.type = this.ghostTypes[i];
      g.mode = 'pen'; g.releaseAt = release[i]; g.penTimer = 0;
      g.dir = { x: 0, y: -1 };
      g.home = this.corners()[i];
      g.spawn = { x: gs[i].x, y: gs[i].y };
      g.frightT = 0; g.eyes = false;
      this.ghosts[i] = g;
    }
    this.blinky = this.ghosts[0];

    this.modeTimer = 0; this.globalMode = 'chase'; this.frightChain = 0;
  };

  G.corners = function () {
    return [
      { x: this.cols - 2, y: 1 }, { x: 1, y: 1 },
      { x: this.cols - 2, y: this.rows - 2 }, { x: 1, y: this.rows - 2 },
    ];
  };

  G.makeEntity = function (x, y, speed) {
    return {
      tx: x, ty: y, dir: { x: 0, y: 0 }, moving: false, progress: 0,
      speed: speed, px: (x + 0.5) * this.R.cell, py: (y + 0.5) * this.R.cell,
      vx: 0, vy: 0,
    };
  };

  // ---- Public control -----------------------------------------------------
  G.start = function (diff) {
    this.diff = diff || 'normal';
    this.level = 1; this.score = 0; this.lives = 3;
    this.newLevel({});
    this.enterReady(2.0, true);
    this.A.resume(); this.A.sfx.ready(); this.A.music.start();
    this.emit();
  };

  G.startAttract = function () {
    this.diff = 'normal'; this.level = 1; this.score = 0; this.lives = 3;
    this.state = 'attract';
    this.newLevel({ seed: 4242 });
  };

  G.enterReady = function (dur, showText) {
    this.state = 'ready'; this.readyT = dur; this.readyText = showText;
    this.resetPositions();
  };

  G.resetPositions = function () {
    var p = this.pom;
    p.tx = p.spawn.x; p.ty = p.spawn.y; p.progress = 0; p.moving = false;
    p.dir = { x: -1, y: 0 }; p.wish = { x: -1, y: 0 };
    p.px = (p.tx + 0.5) * this.R.cell; p.py = (p.ty + 0.5) * this.R.cell;
    p.dead = false; p.deathT = 0;
    for (var i = 0; i < 4; i++) {
      var g = this.ghosts[i];
      g.tx = g.spawn.x; g.ty = g.spawn.y; g.progress = 0; g.moving = false;
      g.dir = { x: 0, y: -1 }; g.mode = 'pen'; g.penTimer = 0; g.frightT = 0; g.eyes = false;
      g.px = (g.tx + 0.5) * this.R.cell; g.py = (g.ty + 0.5) * this.R.cell;
    }
    this.modeTimer = 0; this.globalMode = 'chase';
  };

  G.pause = function () { if (this.state === 'playing') { this.state = 'paused'; this.emit(); } };
  G.resume = function () { if (this.state === 'paused') { this.state = 'playing'; this.emit(); } };

  // ---- Movement -----------------------------------------------------------
  G.stepTile = function (x, y, dx, dy) { return this.PF.step(this.grid, this.tunnelSet, x, y, dx, dy); };

  // Tiles Pom can reach from `start` (open, tunnel-aware, excluding the house).
  G.floodReach = function (start) {
    var reach = {}, q = [start], head = 0, D = this.PF.DIRS;
    reach[key(start.x, start.y)] = 1;
    while (head < q.length) {
      var c = q[head++];
      for (var i = 0; i < 4; i++) {
        var s = this.PF.step(this.grid, this.tunnelSet, c.x, c.y, D[i].dx, D[i].dy);
        if (s && !this.penBlock[key(s.x, s.y)] && !reach[key(s.x, s.y)]) { reach[key(s.x, s.y)] = 1; q.push(s); }
      }
    }
    return reach;
  };

  G.moveEntity = function (ent, dt, chooseDir, onEnter, avoid) {
    var self = this;
    function step(x, y, dx, dy) { var d = self.stepTile(x, y, dx, dy); if (!d) return null; if (avoid && avoid(d.x, d.y)) return null; return d; }
    var moved = false;
    if (!ent.moving) {
      var w0 = chooseDir(ent);
      if (w0 && step(ent.tx, ent.ty, w0.x, w0.y)) { ent.dir = w0; ent.moving = true; }
      else if ((ent.dir.x || ent.dir.y) && step(ent.tx, ent.ty, ent.dir.x, ent.dir.y)) { ent.moving = true; }
    }
    if (ent.moving) {
      ent.progress += ent.speed * dt;
      var guard = 0;
      while (ent.progress >= 1 && guard++ < 4) {
        ent.progress -= 1;
        var dest = step(ent.tx, ent.ty, ent.dir.x, ent.dir.y);
        if (!dest) { ent.moving = false; ent.progress = 0; break; }
        ent.tx = dest.x; ent.ty = dest.y; moved = true;
        if (onEnter) onEnter(ent.tx, ent.ty);
        var w = chooseDir(ent);
        if (w && step(ent.tx, ent.ty, w.x, w.y)) ent.dir = w;
        else if (!step(ent.tx, ent.ty, ent.dir.x, ent.dir.y)) { ent.moving = false; ent.progress = 0; break; }
      }
    }
    var cell = this.R.cell;
    var nx = (ent.tx + ent.dir.x * ent.progress + 0.5) * cell;
    var ny = (ent.ty + ent.dir.y * ent.progress + 0.5) * cell;
    ent.vx = nx - ent.px; ent.vy = ny - ent.py; ent.px = nx; ent.py = ny;
    return moved;
  };

  // ---- Pom direction (player or attract AI) -------------------------------
  G.pomDir = function () {
    var p = this.pom, self = this;
    if (this.state === 'attract') { var a = this.autoPilot(); if (a) p.wish = a; }
    else { var d = this.I.desired(); if (d) p.wish = this.I.vec(d); }
    var canStep = function (dir) { var t = self.stepTile(p.tx, p.ty, dir.x, dir.y); return t && !self.penBlock[t.x + ',' + t.y]; };
    if (p.wish && canStep(p.wish)) return p.wish;   // turn to wish when possible
    if (p.dir && canStep(p.dir)) return p.dir;      // else keep gliding
    return null;
  };

  // ---- Ghost AI -----------------------------------------------------------
  G.ghostTarget = function (g) {
    var p = this.pom;
    if (g.mode === 'eaten') return { x: this.pen.cx, y: this.pen.cy };
    if (this.globalMode === 'scatter' && g.mode === 'chase') return g.home;
    if (g.type === 'red') return { x: p.tx, y: p.ty };
    if (g.type === 'pink') return this.aheadOf(p, 4);
    if (g.type === 'cyan') {
      var a = this.aheadOf(p, 2);
      return { x: this.U.clamp(2 * a.x - this.blinky.tx, 0, this.cols - 1),
               y: this.U.clamp(2 * a.y - this.blinky.ty, 0, this.rows - 1) };
    }
    // orange (Clyde)
    var d = Math.abs(g.tx - p.tx) + Math.abs(g.ty - p.ty);
    return d > 8 ? { x: p.tx, y: p.ty } : g.home;
  };

  G.aheadOf = function (p, n) {
    var x = p.tx, y = p.ty;
    for (var i = 0; i < n; i++) { var s = this.stepTile(x, y, p.dir.x, p.dir.y); if (!s) break; x = s.x; y = s.y; }
    return { x: x, y: y };
  };

  G.ghostDir = function (g) {
    var rev = { x: -g.dir.x, y: -g.dir.y };
    // Frightened: wander away from Pom (pseudo-random, no reverse).
    if (g.mode === 'chase' && g.frightT > 0) {
      var opts = [];
      for (var i = 0; i < 4; i++) {
        var D = DIRS4[i]; if (D.x === rev.x && D.y === rev.y) continue;
        if (this.stepTile(g.tx, g.ty, D.x, D.y)) opts.push(D);
      }
      if (!opts.length) return rev;
      // bias away from Pom
      opts.sort((a, b) => this.awayScore(g, b) - this.awayScore(g, a));
      var pick = opts[(Math.abs(Math.sin((g.tx * 12.9 + g.ty * 7.3 + this.time * 3))) * opts.length) | 0] || opts[0];
      return pick;
    }
    // Greedy toward target using a BFS distance field (classic no-reverse rule).
    var target = this.ghostTarget(g);
    var field = this.PF.bfs(this.grid, { x: this.U.clamp(target.x, 0, this.cols - 1), y: this.U.clamp(target.y, 0, this.rows - 1) }, { x: -1, y: -1 }, this.pf).dist;
    var best = null, bestD = Infinity;
    for (var j = 0; j < 4; j++) {
      var Dj = DIRS4[j];
      if (Dj.x === rev.x && Dj.y === rev.y) continue;
      var nb = this.stepTile(g.tx, g.ty, Dj.x, Dj.y);
      if (!nb) continue;
      var dd = field[nb.y * this.cols + nb.x];
      if (dd < 0) continue;
      if (dd < bestD) { bestD = dd; best = Dj; }
    }
    return best || rev;
  };

  G.awayScore = function (g, D) {
    var nb = this.stepTile(g.tx, g.ty, D.x, D.y); if (!nb) return -1;
    return Math.abs(nb.x - this.pom.tx) + Math.abs(nb.y - this.pom.ty);
  };

  // ---- Per-tile events ----------------------------------------------------
  G.pomEnter = function (x, y) {
    var k = key(x, y);
    if (this.dots.has(k)) {
      this.dots.delete(k); this.score += 10; this.A.sfx.waka();
      this.pom.chomp = 1; this.emit();
      this.checkClear();
    } else if (this.power.has(k)) {
      this.power.delete(k); this.score += 50; this.A.sfx.power();
      this.triggerFright(); this.pom.chomp = 1; this.emit();
      this.checkClear();
    }
  };

  // Reverse without teleporting: move the origin to the current destination tile,
  // flip direction, and invert progress so the sprite keeps its exact position.
  G.reverseEntity = function (ent) {
    if (ent.moving) {
      var dest = this.stepTile(ent.tx, ent.ty, ent.dir.x, ent.dir.y);
      if (dest) { ent.tx = dest.x; ent.ty = dest.y; }
      ent.progress = 1 - ent.progress;
    }
    ent.dir = { x: -ent.dir.x, y: -ent.dir.y };
  };

  // Frightened is a single global deadline so EVERY ghost is edible during the
  // window — including any released from the pen mid-power (was lethal before).
  G.triggerFright = function () {
    this.frightChain = 0;
    this.frightUntil = this.time + FRIGHT_TIME;
    for (var i = 0; i < 4; i++) {
      var g = this.ghosts[i];
      if (g.mode === 'chase') { g.frightT = FRIGHT_TIME; this.reverseEntity(g); }
    }
  };

  G.checkClear = function () {
    if (this.dots.size !== 0 || this.power.size !== 0) return;
    if (this.state === 'attract') { this.newLevel({}); return; } // demo loops quietly
    this.state = 'levelclear'; this.clearT = 0; this.A.sfx.levelup();
  };

  // ---- Main update --------------------------------------------------------
  G.update = function (dt) {
    dt = Math.min(dt, 0.05); this.time += dt;
    this.particles.update(dt); this.updateShake(dt);
    if (this.power) this.power.forEach(function (v) { v.t += dt; });
    if (this.pom) this.pom.chomp = this.U.damp(this.pom.chomp || 0, 0, 12, dt);
    if (this.floatText) {
      for (var fi = this.floatText.length - 1; fi >= 0; fi--) {
        this.floatText[fi].t += dt; if (this.floatText[fi].t > 1) this.floatText.splice(fi, 1);
      }
    }

    if (this.state === 'attract') this.updateAlgo(); else this.algo = null;
    if (this.state === 'playing' || this.state === 'attract') this.simulate(dt);
    else if (this.state === 'ready') { this.readyT -= dt; if (this.readyT <= 0) this.state = 'playing'; }
    else if (this.state === 'dying') this.updateDying(dt);
    else if (this.state === 'levelclear') { this.clearT = (this.clearT || 0) + dt; if (this.clearT > 1.8) this.nextLevel(); }
  };

  G.simulate = function (dt) {
    var self = this;
    // Global scatter/chase alternation.
    this.modeTimer += dt;
    if (this.globalMode === 'chase' && this.modeTimer > CHASE_TIME) { this.globalMode = 'scatter'; this.modeTimer = 0; this.reverseGhosts(); }
    else if (this.globalMode === 'scatter' && this.modeTimer > SCATTER_TIME) { this.globalMode = 'chase'; this.modeTimer = 0; this.reverseGhosts(); }

    // Ghost siren pitch by pellets eaten.
    var eaten = 1 - (this.dots.size + this.power.size) / Math.max(1, this.totalPellets);
    this.A.music && this.A.music.setTension && this.A.music.setTension(eaten * (this.globalMode === 'scatter' ? 0.4 : 1));

    // Pom (blocked from the ghost house).
    this.moveEntity(this.pom, dt, function () { return self.pomDir(); }, function (x, y) { self.pomEnter(x, y); },
      function (x, y) { return !!self.penBlock[x + ',' + y]; });

    // Ghosts.
    for (var i = 0; i < 4; i++) {
      var g = this.ghosts[i];
      // release from pen
      if (g.mode === 'pen') {
        g.penTimer += dt;
        // gentle bob
        g.py = (g.ty + 0.5) * this.R.cell + Math.sin(this.time * 4 + i) * this.R.cell * 0.12;
        g.px = (g.tx + 0.5) * this.R.cell;
        if (g.penTimer >= g.releaseAt) {
          // Emerge from the house: keep the ghost where it sits and let its BFS
          // navigate it up and out through the gate (no teleport).
          g.mode = 'chase'; g.dir = { x: 0, y: -1 }; g.moving = false; g.progress = 0;
          g.px = (g.tx + 0.5) * this.R.cell; g.py = (g.ty + 0.5) * this.R.cell; // drop the bob offset
          if (this.frightUntil && this.frightUntil > this.time) g.frightT = this.frightUntil - this.time; // inherit active power window
        }
        continue;
      }
      // frightened timer
      if (g.frightT > 0 && g.mode === 'chase') { g.frightT -= dt; }
      // speed: eyes fast, frightened slow
      var baseSpeed = g.speed;
      var spd = g.mode === 'eaten' ? baseSpeed * 1.9 : (g.frightT > 0 ? baseSpeed * 0.5 : baseSpeed);
      var save = g.speed; g.speed = spd;
      this.moveEntity(g, dt, (function (gg) { return function () { return self.ghostDir(gg); }; })(g), null);
      g.speed = save;
      // eyes reached pen -> revive
      if (g.mode === 'eaten' && Math.abs(g.tx - this.pen.cx) <= 1 && Math.abs(g.ty - this.pen.cy) <= 1) {
        g.mode = 'chase'; g.frightT = 0; g.eyes = false; g.dir = { x: 0, y: -1 };
      }
      this.checkGhostCollision(g);
    }
  };

  G.reverseGhosts = function () {
    for (var i = 0; i < 4; i++) { var g = this.ghosts[i]; if (g.mode === 'chase') this.reverseEntity(g); }
  };

  G.checkGhostCollision = function (g) {
    if (this.state !== 'playing') return;
    var close = this.U.dist2(g.px, g.py, this.pom.px, this.pom.py) < Math.pow(this.R.cell * 0.55, 2);
    if (!close) return;
    if (g.mode === 'eaten') return;
    if (g.frightT > 0) {
      // Eat the ghost.
      var pts = GHOST_SCORES[Math.min(this.frightChain, 3)]; this.frightChain++;
      this.score += pts; g.mode = 'eaten'; g.frightT = 0; g.eyes = true;
      this.A.sfx.eatGhost(this.frightChain);
      this.popText(g.px, g.py, pts);
      this.particles.burst(g.px, g.py, 16, { color: [root.PP.Theme.css('frightPale'), root.PP.Theme.css('eye')], speed: 120, life: 0.5, size: 3 });
      this.addShake(3); this.emit();
    } else {
      this.die();
    }
  };

  G.popText = function (px, py, val) {
    this.floatText = this.floatText || [];
    this.floatText.push({ px: px, py: py, val: val, t: 0 });
  };

  // ---- Death / lives ------------------------------------------------------
  G.die = function () {
    // In attract, the demo just respawns — it never burns lives or shows GAME OVER.
    if (this.state === 'attract') { this.resetPositions(); return; }
    this.state = 'dying'; this.dyingT = 0; this.pom.dead = true; this.pom.deathT = 0;
    this.A.sfx.death(); this.addShake(7);
    this.hooks.onStateChange && this.hooks.onStateChange('dying');
  };

  G.updateDying = function (dt) {
    this.dyingT += dt; this.pom.deathT = this.dyingT;
    if (this.dyingT > 1.4) {
      this.lives--; this.emit();
      if (this.lives <= 0) this.gameOver();   // 3 lives = 3 deaths, then GAME OVER
      else this.enterReady(1.6, true);
    }
  };

  G.gameOver = function () {
    this.state = 'gameover'; this.A.music.stop();
    var res = root.PP.Storage.submitScore({ score: this.score, diff: this.diff, level: this.level, ts: (this.time * 1000) | 0 });
    this.lastResult = res;
    this.hooks.onGameOver && this.hooks.onGameOver({ score: this.score, level: this.level, result: res });
  };

  G.nextLevel = function () {
    this.level++; this.newLevel({});
    this.enterReady(1.6, true); this.A.sfx.ready();
    this.hooks.onLevel && this.hooks.onLevel(this.level); this.emit();
  };

  // In attract mode, spotlight one ghost at a time and expose its live BFS —
  // the actual target tile + shortest path — so a passerby SEES the algorithm.
  G.updateAlgo = function () {
    if (!this.ghosts) { this.algo = null; return; }
    var idx = Math.floor(this.time / 2.8) % 4;
    var g = this.ghosts[idx];
    if (!g || g.mode !== 'chase') { this.algo = null; return; }
    var tgt = this.ghostTarget(g);
    tgt = { x: this.U.clamp(tgt.x, 0, this.cols - 1), y: this.U.clamp(tgt.y, 0, this.rows - 1) };
    var res = this.PF.bfs(this.grid, { x: g.tx, y: g.ty }, tgt, this.pf);
    this.algo = { type: g.type, path: res.path, target: tgt, label: GHOST_LABELS[g.type], gx: g.px, gy: g.py };
  };

  // ---- Attract autopilot --------------------------------------------------
  G.autoPilot = function () {
    var self = this, p = this.pom, here = { x: p.tx, y: p.ty };
    // Flee if a non-fright ghost is close.
    var threat = null, td = 99;
    for (var i = 0; i < 4; i++) { var g = this.ghosts[i]; if (g.mode !== 'chase' || g.frightT > 0) continue; var d = Math.abs(g.tx - here.x) + Math.abs(g.ty - here.y); if (d < td) { td = d; threat = g; } }
    if (threat && td <= 5) {
      var away = null, best = -1;
      for (var j = 0; j < 4; j++) { var D = DIRS4[j]; var nb = this.stepTile(here.x, here.y, D.x, D.y); if (!nb) continue; var s = Math.abs(nb.x - threat.tx) + Math.abs(nb.y - threat.ty); if (s > best) { best = s; away = D; } }
      if (away) return away;
    }
    // else head to nearest dot.
    var r = this.PF.bfs(this.grid, here, { x: -1, y: -1 }, this.pf); var bestD = 1e9, bt = null;
    this.dots.forEach(function (v, k) { var pp = k.split(','), dx = +pp[0], dy = +pp[1]; var d = r.dist[dy * self.cols + dx]; if (d >= 0 && d < bestD) { bestD = d; bt = { x: dx, y: dy }; } });
    if (bt) { var pr = this.PF.bfs(this.grid, here, bt, this.pf); if (pr.path.length) return { x: pr.path[0].x - here.x, y: pr.path[0].y - here.y }; }
    return p.dir;
  };

  // ---- Shake + render bridge ---------------------------------------------
  G.addShake = function (m) { if (this.reduceMotion) m *= 0.3; this.shake.mag = Math.max(this.shake.mag, m); };
  G.updateShake = function (dt) { var s = this.shake; s.mag = this.U.damp(s.mag, 0, 8, dt); s.x = (Math.random() - 0.5) * s.mag; s.y = (Math.random() - 0.5) * s.mag; };

  G.relayout = function () {
    if (!this.grid) return;
    this.R.layout(this.grid, this.cols, this.rows, { tunnelRows: this.tunnelRows });
    var cell = this.R.cell;
    var fix = function (e) { e.px = (e.tx + 0.5) * cell; e.py = (e.ty + 0.5) * cell; };
    if (this.pom) fix(this.pom); if (this.ghosts) this.ghosts.forEach(fix);
  };

  G.renderState = function () {
    return {
      grid: this.grid, cols: this.cols, rows: this.rows, tunnelRows: this.tunnelRows,
      pom: this.pom, ghosts: this.ghosts, dots: this.dots, power: this.power,
      particles: this.particles, floatText: this.floatText,
      state: this.state, readyText: this.state === 'ready' && this.readyText,
      levelclear: this.state === 'levelclear', clearT: this.clearT || 0, algo: this.algo,
      shake: this.shake, time: this.time, globalMode: this.globalMode,
      frightFlash: FRIGHT_FLASH,
    };
  };

  G.emit = function () {
    this.hooks.onStats && this.hooks.onStats({
      score: this.score, lives: this.lives, level: this.level, diff: this.diff,
      remaining: this.dots ? this.dots.size + this.power.size : 0, total: this.totalPellets || 0,
      best: root.PP.Storage.bestScore(),
    });
  };

  root.PP = root.PP || {};
  root.PP.Game = Game; root.PP.DIFFS = DIFFS;
})(typeof window !== 'undefined' ? window : this);
