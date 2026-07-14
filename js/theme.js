/*
 * theme.js — the retro-arcade palette (Stitch design system "Pixel Pals Arcade").
 * Near-black CRT ground, amber hero, electric-blue maze, four classic ghost hues.
 * Hex values with an alpha helper so canvas + CSS share one source of truth.
 */
(function (root) {
  'use strict';

  var P = {
    bg:        '#07070f',   // CRT near-black
    bgDeep:    '#04040a',
    wall:      '#2c6bff',   // electric-blue maze walls
    wallCore:  '#6ea0ff',   // brighter inner double-line
    wallGlow:  '#1846c8',
    door:      '#ff7dd1',   // ghost-pen door
    dot:       '#ffd24a',   // pellets
    power:     '#fff1a6',   // power-pellets (flash)
    pal:       '#ffce00',   // the hero (yellow chomper)
    palDark:   '#c99a00',
    ghostRed:  '#ff2e4d',   // Blinky — direct chase
    ghostPink: '#ff7dd1',   // Pinky — ambush ahead
    ghostCyan: '#33e4ff',   // Inky — flank
    ghostOrange:'#ff9b3d',  // Clyde — skittish
    fright:    '#2437d8',   // frightened body
    frightPale:'#f2f4ff',   // frightened flash / mouth
    eye:       '#ffffff',
    pupil:     '#233bce',
    ink:       '#0a0a16',
    neon:      '#ffce00',
    neonDim:   '#8a6f12',
    white:     '#eef1ff',
    scan:      '#000000',
    heat:      '#ff6a2c',   // optional BFS "algo view"
  };

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function css(role, a) {
    var hex = P[role] || role; // allow passing a raw hex too
    if (a == null || a >= 1) return hex;
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function mix(roleA, roleB, t) {
    var a = hexToRgb(P[roleA] || roleA), b = hexToRgb(P[roleB] || roleB);
    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  root.PP = root.PP || {};
  root.PP.Theme = { P: P, css: css, mix: mix, rgb: hexToRgb };
})(typeof window !== 'undefined' ? window : this);
