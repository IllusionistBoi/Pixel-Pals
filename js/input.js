/*
 * input.js — movement intent from keyboard OR touch.
 *
 * Keyboard: tracks which directions are held plus a short-lived BUFFERED turn, so
 * a quick tap that's released before the next junction still registers (Codex
 * flagged the old held-only buffer as dropping fast taps).
 * Touch: a virtual joystick / swipe on the canvas sets a persistent direction, so
 * the game is playable on phones and museum touchscreens.
 */
(function (root) {
  'use strict';

  var DIR_KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  var VEC = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  var BUFFER_MS = 260;

  function now() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function create() {
    var held = { up: false, down: false, left: false, right: false };
    var lastDir = null, lastAt = 0;   // buffered turn (survives key release briefly)
    var touchDir = null;              // persistent direction from touch
    var pressQueue = [], handlers = {};

    function onKeyDown(e) {
      var dir = DIR_KEYS[e.code];
      if (dir) { held[dir] = true; lastDir = dir; lastAt = now(); touchDir = null; e.preventDefault(); return; }
      if (!e.repeat) { pressQueue.push(e.code); if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault(); }
    }
    function onKeyUp(e) { var dir = DIR_KEYS[e.code]; if (dir) held[dir] = false; }

    function attach(target) {
      target = target || root;
      handlers.down = onKeyDown; handlers.up = onKeyUp;
      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
    }
    function detach(target) {
      target = target || root;
      target.removeEventListener('keydown', handlers.down);
      target.removeEventListener('keyup', handlers.up);
    }

    // --- Touch: a virtual joystick centred on first contact --------------
    function setTouchDir(dir) { touchDir = dir; if (dir) { lastDir = dir; lastAt = now(); } }
    function attachTouch(el) {
      var sx = 0, sy = 0, active = false, DEAD = 16;
      function down(e) { active = true; var p = pt(e); sx = p.x; sy = p.y; if (e.cancelable) e.preventDefault(); }
      function move(e) {
        if (!active) return;
        var p = pt(e), dx = p.x - sx, dy = p.y - sy;
        if (Math.abs(dx) < DEAD && Math.abs(dy) < DEAD) return;
        if (Math.abs(dx) > Math.abs(dy)) setTouchDir(dx > 0 ? 'right' : 'left');
        else setTouchDir(dy > 0 ? 'down' : 'up');
        if (e.cancelable) e.preventDefault();
      }
      function up() { active = false; }
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      function pt(e) { return { x: e.clientX, y: e.clientY }; }
    }

    function desired() {
      // freshest held key wins
      if (lastDir && held[lastDir]) return lastDir;
      var pri = ['up', 'down', 'left', 'right'];
      for (var i = 0; i < pri.length; i++) if (held[pri[i]]) return pri[i];
      // buffered tap (recently pressed, now released)
      if (lastDir && (now() - lastAt) < BUFFER_MS) return lastDir;
      // persistent touch direction
      return touchDir;
    }

    function drainActions() { var q = pressQueue; pressQueue = []; return q; }
    function clear() { held.up = held.down = held.left = held.right = false; lastDir = null; touchDir = null; pressQueue = []; }

    return {
      attach: attach, detach: detach, attachTouch: attachTouch, setTouchDir: setTouchDir,
      desired: desired, vec: function (d) { return VEC[d] || null; },
      drainActions: drainActions, clear: clear, isHeld: function (d) { return !!held[d]; },
    };
  }

  root.PP = root.PP || {};
  root.PP.Input = { create: create, VEC: VEC };
})(typeof window !== 'undefined' ? window : this);
