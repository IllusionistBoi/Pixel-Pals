/*
 * utils.js — tiny math + timing helpers shared across the game.
 */
(function (root) {
  'use strict';

  var U = {
    clamp: function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    // Frame-rate independent exponential smoothing (t = "half-life"ish).
    damp: function (a, b, lambda, dt) { return U.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
    // Ease-out-quint — the exponential curve the design guidance calls for.
    easeOutQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
    easeOutCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    easeInOutCubic: function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    easeOutBack: function (t) {
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    randInt: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    choice: function (arr) { return arr[(Math.random() * arr.length) | 0]; },
    dist2: function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
    now: function () { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); },
  };

  root.PP = root.PP || {};
  root.PP.U = U;
})(typeof window !== 'undefined' ? window : this);
