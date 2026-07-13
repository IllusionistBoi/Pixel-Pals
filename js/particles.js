/*
 * particles.js — a small pooled particle system.
 *
 * Everything juicy (dot pops, the Pal's trail, capture explosions, power-up
 * sparkles) runs through one fixed pool so we never thrash the garbage
 * collector mid-chase. Colors and behaviour are passed in by the renderer so the
 * same engine serves whatever art direction we land on.
 */
(function (root) {
  'use strict';

  function System(max) {
    max = max || 1200;
    this.max = max;
    this.pool = new Array(max);
    for (var i = 0; i < max; i++) {
      this.pool[i] = {
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 1, color: '#fff',
        drag: 0.9, gravity: 0, shape: 'circle', spin: 0, rot: 0, glow: true,
      };
    }
    this.cursor = 0;
  }

  System.prototype._acquire = function () {
    // Ring buffer: overwrite the oldest if we ever run dry.
    for (var n = 0; n < this.max; n++) {
      var i = (this.cursor + n) % this.max;
      if (!this.pool[i].active) { this.cursor = (i + 1) % this.max; return this.pool[i]; }
    }
    var p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    return p;
  };

  System.prototype.emit = function (opts) {
    var p = this._acquire();
    p.active = true;
    p.x = opts.x; p.y = opts.y;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.life = 0; p.maxLife = opts.life || 0.6;
    p.size = opts.size || 3;
    p.color = opts.color || '#fff';
    p.drag = opts.drag == null ? 0.86 : opts.drag;
    p.gravity = opts.gravity || 0;
    p.shape = opts.shape || 'circle';
    p.spin = opts.spin || 0;
    p.rot = opts.rot || 0;
    p.glow = opts.glow !== false;
    p.fade = opts.fade || 'out'; // 'out' | 'inout'
    return p;
  };

  // A radial burst of `count` particles.
  System.prototype.burst = function (x, y, count, opts) {
    opts = opts || {};
    for (var i = 0; i < count; i++) {
      var a = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      var spd = (opts.speed || 60) * (0.4 + Math.random() * 0.8);
      this.emit({
        x: x, y: y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: (opts.life || 0.5) * (0.6 + Math.random() * 0.7),
        size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
        color: pick(opts.color),
        drag: opts.drag, gravity: opts.gravity,
        shape: opts.shape || 'circle', glow: opts.glow,
        spin: opts.spin, rot: Math.random() * Math.PI * 2,
      });
    }
  };

  function pick(c) {
    if (!c) return '#fff';
    return Array.isArray(c) ? c[(Math.random() * c.length) | 0] : c;
  }

  System.prototype.update = function (dt) {
    for (var i = 0; i < this.max; i++) {
      var p = this.pool[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      var d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  };

  System.prototype.draw = function (ctx) {
    ctx.save();
    for (var i = 0; i < this.max; i++) {
      var p = this.pool[i];
      if (!p.active) continue;
      var t = p.life / p.maxLife;
      var alpha = p.fade === 'inout' ? Math.sin(t * Math.PI) : (1 - t);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = p.size * 2.5; }
      else ctx.shadowBlur = 0;
      var s = p.size * (p.shape === 'spark' ? (0.4 + alpha) : 1);
      if (p.shape === 'square' || p.shape === 'pixel') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (p.shape === 'spark') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-s * 2, -s * 0.25, s * 4, s * 0.5);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };

  System.prototype.clear = function () {
    for (var i = 0; i < this.max; i++) this.pool[i].active = false;
  };

  System.prototype.activeCount = function () {
    var c = 0;
    for (var i = 0; i < this.max; i++) if (this.pool[i].active) c++;
    return c;
  };

  root.PP = root.PP || {};
  root.PP.Particles = { System: System };
})(typeof window !== 'undefined' ? window : this);
