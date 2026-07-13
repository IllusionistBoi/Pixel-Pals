/*
 * render.js — the retro-arcade renderer.
 *
 * A CRT screen: a neon-blue maze (baked once per level as glowing tube-lines that
 * trace every wall facing a corridor), amber pellets and flashing power-pellets,
 * four classic ghosts, a chomping yellow hero, and a scanline/curvature pass over
 * the top. Only the maze is baked; everything else composites per frame.
 */
(function (root) {
  'use strict';
  var T, U;

  function Renderer(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.cell = 28; this.cols = 0; this.rows = 0;
    this.dpr = Math.min(root.devicePixelRatio || 1, 2);
    this.mazeLayer = document.createElement('canvas');
    this.scan = document.createElement('canvas');
  }

  Renderer.prototype.init = function () { T = root.PP.Theme; U = root.PP.U; };

  Renderer.prototype.layout = function (grid, cols, rows, opts) {
    this.grid = grid; this.cols = cols; this.rows = rows;
    this.tunnelRows = (opts && opts.tunnelRows) || [];
    this.pen = opts && opts.pen;
    // Reserve room for the marquee, HUD bars, control deck + fineprint so the
    // whole cabinet fits the viewport without clipping.
    var maxW = Math.min(root.innerWidth - 80, 1150);
    var maxH = root.innerHeight - 330;
    var cell = Math.floor(Math.min(maxW / cols, maxH / rows));
    this.cell = U.clamp(cell, 12, 40);
    var w = cols * this.cell, h = rows * this.cell; this.w = w; this.h = h;
    var dpr = this.dpr;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.mazeLayer.width = w * dpr; this.mazeLayer.height = h * dpr; // DPR-crisp bake
    this.bakeMaze();
  };

  Renderer.prototype.bakeMaze = function () {
    var c = this.mazeLayer, x2 = c.getContext('2d'), cell = this.cell, grid = this.grid, dpr = this.dpr;
    x2.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in logical coords onto the hi-res backing
    x2.clearRect(0, 0, this.w, this.h);
    var self = this;
    var isWall = function (x, y) { return x < 0 || y < 0 || x >= self.cols || y >= self.rows || grid[y][x] === 1; };
    var tunnel = {};
    (this.tunnelRows || []).forEach(function (r) { tunnel[r] = 1; });
    var inset = cell * 0.18, lw = Math.max(2, cell * 0.12);

    // Neon rails: each wall edge facing a corridor is drawn FULL length (no end
    // shortening), so neighbouring walls form one continuous glowing tube.
    x2.lineCap = 'round'; x2.lineJoin = 'round';
    for (var pass = 0; pass < 2; pass++) {
      if (pass === 0) { x2.strokeStyle = T.css('wall'); x2.lineWidth = lw; x2.shadowColor = T.css('wall'); x2.shadowBlur = cell * 0.5; }
      else { x2.strokeStyle = T.css('wallCore'); x2.lineWidth = Math.max(1, cell * 0.05); x2.shadowBlur = cell * 0.1; }
      for (var y = 0; y < this.rows; y++) {
        for (var x = 0; x < this.cols; x++) {
          if (grid[y][x] !== 1) continue;
          var L = x * cell, Tt = y * cell, R = L + cell, B = Tt + cell;
          if (!isWall(x, y - 1)) seg(x2, L, Tt + inset, R, Tt + inset);
          if (!isWall(x, y + 1)) seg(x2, L, B - inset, R, B - inset);
          // Don't cap the vertical rails at tunnel-mouth rows (leave the mouth open).
          if (!isWall(x - 1, y) && !tunnel[y]) seg(x2, L + inset, Tt, L + inset, B);
          if (!isWall(x + 1, y) && !tunnel[y]) seg(x2, R - inset, Tt, R - inset, B);
        }
      }
    }
    // Ghost-house gate: a pink bar across the top opening (ghosts pass, Pom can't).
    if (this.pen && this.pen.gate) {
      var gx = this.pen.gate.x * cell, gy = this.pen.gate.y * cell;
      x2.strokeStyle = T.css('door'); x2.lineWidth = Math.max(3, cell * 0.16); x2.lineCap = 'round';
      x2.shadowColor = T.css('door'); x2.shadowBlur = cell * 0.5;
      seg(x2, gx + cell * 0.12, gy + cell * 0.5, gx + cell * 0.88, gy + cell * 0.5);
    }
    x2.shadowBlur = 0;
  };

  function seg(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

  // === Per-frame ===========================================================
  Renderer.prototype.frame = function (state) {
    var ctx = this.ctx, cell = this.cell;
    ctx.save();
    // CRT ground.
    ctx.fillStyle = T.css('bg'); ctx.fillRect(0, 0, this.w, this.h);
    ctx.translate(state.shake ? state.shake.x : 0, state.shake ? state.shake.y : 0);

    // Maze. On level clear, a gentle ~2Hz glow pulse (no hard high-freq flashing;
    // fully suppressed under reduced-motion).
    ctx.drawImage(this.mazeLayer, 0, 0, this.w, this.h);
    if (state.levelclear && !this.reduceMotion) {
      var pulse = 0.5 + 0.5 * Math.sin(state.clearT * Math.PI * 4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse * 0.55;
      ctx.drawImage(this.mazeLayer, 0, 0, this.w, this.h); ctx.restore();
    }

    if (!state.levelclear) {
      this.drawDots(ctx, state);
      this.drawPower(ctx, state);
    }
    if (state.algo) this.drawAlgo(ctx, state);
    if (state.ghosts) for (var i = 0; i < state.ghosts.length; i++) this.drawGhost(ctx, state.ghosts[i], state);
    if (state.pom) this.drawPom(ctx, state);
    if (state.particles) state.particles.draw(ctx);
    this.drawFloatText(ctx, state);
    if (state.readyText) this.drawReady(ctx, state);

    ctx.restore();
    // Scanlines + vignette are now a single CSS layer over the whole CRT
    // (canvas + HUD + menus), so the "glass" is one consistent material.
  };

  Renderer.prototype.drawDots = function (ctx, state) {
    // Crisp ivory squares, NO glow — so the amber glowing hero reads clearly in
    // the dense field (glow is reserved for Pom + power-pellets).
    var cell = this.cell, s = Math.max(2, Math.round(cell * 0.16));
    var o = -s / 2;
    ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = '#ffe7bd';
    ctx.beginPath();
    state.dots.forEach(function (v, k) {
      var i = k.indexOf(','), x = (+k.slice(0, i) + 0.5) * cell, y = (+k.slice(i + 1) + 0.5) * cell;
      ctx.rect(x + o, y + o, s, s);
    });
    ctx.fill(); // one batched path for the whole field
    ctx.restore();
  };

  Renderer.prototype.drawPower = function (ctx, state) {
    var cell = this.cell;
    state.power.forEach(function (v, k) {
      var p = k.split(','), blink = 0.5 + 0.5 * Math.sin(v.t * 8);
      if (blink < 0.2) return;
      var r = cell * 0.28 * (0.85 + blink * 0.25);
      var cx = (+p[0] + 0.5) * cell, cy = (+p[1] + 0.5) * cell;
      ctx.fillStyle = T.css('power'); ctx.shadowColor = T.css('power'); ctx.shadowBlur = cell * 0.6 * blink;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;
  };

  // Attract-mode "algorithm view": one ghost's live BFS — its shortest path and
  // the exact target tile — with a label, so a passerby sees the real algorithm.
  Renderer.prototype.drawAlgo = function (ctx, state) {
    var a = state.algo, cell = this.cell, col = T.css('ghost' + cap(a.type));
    ctx.save();
    // shortest-path breadcrumbs
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = cell * 0.2;
    for (var i = 0; i < a.path.length; i++) {
      var p = a.path[i]; ctx.globalAlpha = 0.28 + 0.5 * (i / Math.max(1, a.path.length));
      ctx.beginPath(); ctx.arc((p.x + 0.5) * cell, (p.y + 0.5) * cell, cell * 0.09, 0, Math.PI * 2); ctx.fill();
    }
    // target reticle
    ctx.globalAlpha = 0.95; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, cell * 0.07);
    var tx = (a.target.x + 0.5) * cell, ty = (a.target.y + 0.5) * cell;
    ctx.beginPath(); ctx.arc(tx, ty, cell * 0.34, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx - cell * 0.2, ty); ctx.lineTo(tx + cell * 0.2, ty); ctx.moveTo(tx, ty - cell * 0.2); ctx.lineTo(tx, ty + cell * 0.2); ctx.stroke();
    // label banner
    ctx.globalAlpha = 1; ctx.shadowBlur = cell * 0.35; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = 'bold ' + Math.round(cell * 0.52) + 'px "Space Mono", ui-monospace, monospace';
    ctx.fillStyle = col; ctx.fillText(a.label, this.w / 2, cell * 0.5);
    ctx.font = Math.round(cell * 0.34) + 'px "Space Mono", ui-monospace, monospace';
    ctx.fillStyle = T.css('white'); ctx.shadowBlur = 0; ctx.globalAlpha = 0.7;
    ctx.fillText('LIVE BREADTH-FIRST SEARCH', this.w / 2, cell * 1.15);
    ctx.restore();
  };

  // The classic ghost silhouette: dome head + wavy skirt + two eyes.
  Renderer.prototype.drawGhost = function (ctx, g, state) {
    var cell = this.cell, r = cell * 0.42, t = state.time || 0;
    var fright = g.frightT > 0 && g.mode === 'chase';
    var eaten = g.mode === 'eaten';
    // ~2Hz warning flash in the last window; suppressed under reduced-motion.
    var flashing = fright && g.frightT < state.frightFlash && !this.reduceMotion && Math.floor(g.frightT * 4) % 2 === 0;
    var body = eaten ? null : (fright ? (flashing ? T.css('frightPale') : T.css('fright')) : T.css('ghost' + cap(g.type)));

    ctx.save(); ctx.translate(g.px, g.py);
    if (!eaten) {
      ctx.fillStyle = body;
      ctx.shadowColor = body; ctx.shadowBlur = cell * 0.35;
      ghostBody(ctx, r, t);
      ctx.shadowBlur = 0;
      // Permanent pale outline on frightened ghosts — a non-color "edible" cue
      // and a contrast lift (frightened blue is only ~2.5:1 on the CRT).
      if (fright) { ctx.lineWidth = Math.max(1.5, cell * 0.06); ctx.strokeStyle = T.css('frightPale'); ctx.stroke(); }
    }
    // Eyes (both frightened-white-with-frown handled below).
    var dir = g.dir || { x: 0, y: -1 };
    if (fright && !eaten) {
      // frightened face: two dot eyes + zigzag mouth
      ctx.fillStyle = flashing ? T.css('fright') : T.css('frightPale');
      dot(ctx, -r * 0.32, -r * 0.15, r * 0.14); dot(ctx, r * 0.32, -r * 0.15, r * 0.14);
      ctx.strokeStyle = flashing ? T.css('fright') : T.css('frightPale'); ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var zz = -3; zz <= 3; zz++) { var zx = zz * r * 0.16, zy = r * 0.3 + (zz % 2 === 0 ? 0 : -r * 0.14); if (zz === -3) ctx.moveTo(zx, zy); else ctx.lineTo(zx, zy); }
      ctx.stroke();
    } else {
      // normal / eyes: white sclera + pupil looking in travel dir
      eye(ctx, -r * 0.32, -r * 0.12, r * 0.24, dir);
      eye(ctx, r * 0.32, -r * 0.12, r * 0.24, dir);
    }
    ctx.restore();
  };

  function ghostBody(ctx, r, t) {
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r, Math.PI, 0); // dome
    ctx.lineTo(r, r * 0.75);
    // wavy skirt (animated)
    var feet = 4, w = (r * 2) / feet;
    for (var i = 0; i < feet; i++) {
      var x = r - i * w; var dy = (Math.floor(t * 6 + i) % 2 === 0) ? r * 0.75 : r * 0.55;
      ctx.lineTo(x - w * 0.5, dy);
      ctx.lineTo(x - w, r * 0.75);
    }
    ctx.lineTo(-r, -r * 0.1);
    ctx.closePath(); ctx.fill();
  }

  function eye(ctx, x, y, r, dir) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = T.css('eye');
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.css('pupil');
    ctx.beginPath(); ctx.arc(dir.x * r * 0.4, dir.y * r * 0.5, r * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // The yellow chomper. Mouth opens/closes along travel direction; on death it
  // opens all the way and the wedge closes to nothing (classic Pac-Man death).
  Renderer.prototype.drawPom = function (ctx, state) {
    var p = state.pom, cell = this.cell, r = cell * 0.46, t = state.time || 0;
    ctx.save(); ctx.translate(p.px, p.py);
    var ang = Math.atan2(p.dir.y || 0, p.dir.x || 0);
    if (!(p.dir.x || p.dir.y)) ang = 0;
    ctx.rotate(ang);
    ctx.fillStyle = T.css('pal'); ctx.shadowColor = T.css('pal'); ctx.shadowBlur = cell * 0.45;
    var open;
    if (p.dead) { open = U.clamp(p.deathT / 1.2, 0, 1); }
    else { open = Math.abs(Math.sin(t * 12)) * 0.5 * (Math.abs(p.vx) + Math.abs(p.vy) > 0.05 ? 1 : 0.35); }
    var m = open * Math.PI; // half-mouth angle
    if (p.dead && open >= 1) { ctx.restore(); return; }
    ctx.beginPath();
    if (p.dead) {
      // shrink as it opens
      var rr = r * (1 - open);
      ctx.arc(0, 0, rr, m, Math.PI * 2 - m);
    } else {
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, m, Math.PI * 2 - m);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  Renderer.prototype.drawFloatText = function (ctx, state) {
    if (!state.floatText) return;
    var cell = this.cell;
    ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold ' + (cell * 0.6) + 'px "Space Mono", monospace';
    for (var i = 0; i < state.floatText.length; i++) {
      var f = state.floatText[i], a = 1 - f.t;
      ctx.fillStyle = T.css('frightPale', a);
      ctx.fillText(f.val, f.px, f.py - f.t * cell);
    }
    ctx.restore();
  };

  Renderer.prototype.drawReady = function (ctx, state) {
    var cell = this.cell;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = T.css('neon'); ctx.shadowColor = T.css('neon'); ctx.shadowBlur = cell;
    ctx.font = 'bold ' + (cell * 1.0) + 'px "Space Mono", monospace';
    ctx.fillText('READY!', this.w / 2, this.h * 0.62);
    ctx.restore();
  };

  root.PP = root.PP || {};
  root.PP.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : this);
