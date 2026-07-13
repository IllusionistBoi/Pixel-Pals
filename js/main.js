/*
 * main.js — boot, the RAF loop, arcade screen flow and HUD wiring.
 */
(function (root) {
  'use strict';
  var PP = root.PP;

  var canvas = document.getElementById('stage');
  var renderer = new PP.Renderer(canvas); renderer.init();
  var audio = PP.Audio.create();
  var input = PP.Input.create(); input.attach(root); input.attachTouch(canvas);
  var prefs = PP.Storage.getPrefs();
  // Respect the OS reduced-motion setting, not just the in-game toggle.
  var rmq = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)');
  function applyReduceMotion() {
    var rm = !!prefs.reducedMotion || (rmq && rmq.matches);
    game.reduceMotion = rm; renderer.reduceMotion = rm;
    document.body.classList.toggle('reduce-motion', rm);
  }
  if (rmq && rmq.addEventListener) rmq.addEventListener('change', function () { applyReduceMotion(); });

  function id(x) { return document.getElementById(x); }
  var els = {
    score: id('hud-score'), best: id('hud-best'), level: id('hud-level'), difftab: id('hud-difftab'),
    lives: id('lives'),
    title: id('screen-title'), diff: id('screen-diff'), pause: id('screen-pause'),
    over: id('screen-over'), help: id('screen-help'),
    overScore: id('over-score'), overRank: id('over-rank'), board: id('board'), coin: id('coin'),
  };

  var menu = 'title';
  var idleTimer = 0;

  var game = new PP.Game({ renderer: renderer, audio: audio, input: input }, {
    onStats: renderStats,
    onGameOver: onGameOver,
    onLevel: function () {},
    onStateChange: function () {},
  });
  applyReduceMotion();
  audio.setMuted(!!prefs.muted);

  // Idle attract board behind the title.
  game.startAttract();

  // ---- screens ------------------------------------------------------------
  function hideAll() { [els.title, els.diff, els.pause, els.over, els.help].forEach(function (e) { e.hidden = true; }); }
  function announce(msg) { var l = id('live'); if (l && msg) { l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 30); } }
  function showMenu(which) {
    menu = which; hideAll();
    if (which === 'title') els.title.hidden = false;
    else if (which === 'diff') els.diff.hidden = false;
    else if (which === 'help') els.help.hidden = false;
    else if (which === 'pause') els.pause.hidden = false;
    else if (which === 'over') els.over.hidden = false;
    // Move focus to the screen's primary action for keyboard/AT users.
    var focusId = { title: 'btn-start', pause: 'btn-resume', help: 'btn-help-close' }[which];
    var target = focusId ? id(focusId) : (which === 'diff' ? document.querySelector('.pick') : null);
    if (target) setTimeout(function () { try { target.focus(); } catch (e) {} }, 40);
  }

  function toTitle() { game.startAttract(); idleTimer = 0; showMenu('title'); }
  function beginGame(diff, cycle) {
    hideAll(); menu = 'none';
    dropCoin();                    // clink + credit bump
    crtFx(cycle ? 'cycle' : 'boot'); // power-cycle on restart, boot on first play
    audio.resume(); audio.sfx.powerOn();
    game.start(diff);
  }

  // ---- buttons ------------------------------------------------------------
  function ui() { audio.resume(); audio.sfx.ui(); }
  id('btn-start').onclick = function () { ui(); showMenu('diff'); };
  id('btn-back').onclick = function () { ui(); showMenu('title'); };
  id('btn-how').onclick = function () { ui(); showMenu('help'); };
  id('btn-help-close').onclick = function () { ui(); showMenu('title'); };
  Array.prototype.forEach.call(document.querySelectorAll('.pick'), function (b) {
    b.onclick = function () { audio.resume(); beginGame(b.getAttribute('data-diff')); };
  });
  id('btn-resume').onclick = function () { ui(); doResume(); };
  id('btn-restart').onclick = function () { ui(); beginGame(game.diff, true); };
  id('btn-quit').onclick = function () { ui(); toTitle(); };
  id('btn-again').onclick = function () { ui(); beginGame(game.diff, true); };
  id('btn-home').onclick = function () { ui(); toTitle(); };
  function syncMute() {
    var m = audio.isMuted(), t = id('btn-mute-title'), p = id('btn-mute');
    if (t) { t.textContent = m ? '♪ MUTED' : '♪ SOUND'; t.setAttribute('aria-pressed', m); }
    if (p) { p.textContent = m ? '♪ UNMUTE' : '♪ MUTE'; p.setAttribute('aria-pressed', m); }
  }
  function toggleMute() { audio.setMuted(!audio.isMuted()); prefs.muted = audio.isMuted(); PP.Storage.setPrefs(prefs); syncMute(); }
  id('btn-mute-title').onclick = function () { ui(); toggleMute(); };
  id('btn-mute').onclick = function () { ui(); toggleMute(); };
  syncMute();

  function doResume() { hideAll(); game.resume(); }

  // ---- playful cabinet: coin drop, CRT power, interactive deck ------------
  var crt = document.querySelector('.crt');
  var deck = document.querySelector('.deck');
  var slot = document.querySelector('.coinslot');
  var stick = document.querySelector('.joystick .stick');
  var creditsEl = id('credits');
  var credits = 1;

  function dropCoin() {
    audio.resume(); audio.sfx.coin();
    var c = document.createElement('span'); c.className = 'coin-fx';
    slot.appendChild(c); void c.offsetWidth; c.classList.add('drop');
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 660);
    credits++;
    creditsEl.textContent = ('0' + credits).slice(-2);
    creditsEl.classList.remove('bump'); void creditsEl.offsetWidth; creditsEl.classList.add('bump');
  }
  function crtFx(cls) {
    crt.classList.remove('boot', 'cycle'); void crt.offsetWidth; crt.classList.add(cls);
    setTimeout(function () { crt.classList.remove(cls); }, 860);
  }
  function wiggleStick() { document.querySelector('.joystick').classList.remove('wiggle'); void deck.offsetWidth; document.querySelector('.joystick').classList.add('wiggle'); }

  slot.onclick = function () { dropCoin(); };
  document.querySelector('.joystick').onclick = function () { audio.resume(); audio.sfx.ui(); wiggleStick(); };

  // Deck buttons are real controls. A = confirm/start · B = pause/back.
  function deckA() {
    audio.resume(); audio.sfx.ui();
    if (menu === 'title') showMenu('diff');
    else if (menu === 'diff') beginGame(game.diff || 'normal');
    else if (game.state === 'gameover') beginGame(game.diff, true);
    else if (game.state === 'paused') doResume();
    else if (menu === 'help') showMenu('title');
  }
  function deckB() {
    audio.resume(); audio.sfx.ui();
    if (game.state === 'playing') { game.pause(); showMenu('pause'); }
    else if (game.state === 'paused') doResume();
    else if (menu === 'diff' || menu === 'help') showMenu('title');
  }
  document.querySelector('.ab.a').onclick = deckA;
  document.querySelector('.ab.b').onclick = deckB;

  // ---- HUD ----------------------------------------------------------------
  function renderStats(s) {
    els.score.textContent = s.score;
    els.best.textContent = Math.max(s.best, s.score);
    els.level.textContent = s.level;
    els.difftab.textContent = (PP.DIFFS[s.diff] || {}).label || 'NORMAL';
    var n = Math.max(0, s.lives);
    if (els.lives.childElementCount !== n) {
      els.lives.innerHTML = '';
      for (var i = 0; i < n; i++) { var d = document.createElement('span'); d.className = 'life'; els.lives.appendChild(d); }
    }
  }

  var pendingTs = null;
  function renderBoard(scores, myTs) {
    els.board.innerHTML = '';
    (scores || []).slice(0, 6).forEach(function (sc, i) {
      var li = document.createElement('li');
      if (myTs != null && sc.ts === myTs) li.className = 'me';
      li.innerHTML = '<span>' + (i + 1) + '. ' + (sc.initials || 'AAA') + '</span>'
        + '<span>' + sc.score + '</span>'
        + '<span>' + ((sc.diff || '?')[0].toUpperCase()) + ' L' + (sc.level || 1) + '</span>';
      els.board.appendChild(li);
    });
  }
  function onGameOver(info) {
    showMenu('over');
    els.overScore.textContent = info.score;
    var r = info.result, initEl = id('initials'), input = id('initials-input');
    if (r && r.isHigh) {
      pendingTs = r.ts;
      els.overRank.textContent = 'NEW HIGH SCORE — RANK #' + r.rank + '!';
      announce('Game over. New high score, rank ' + r.rank + '. Enter your initials.');
      initEl.hidden = false; input.value = '';
      renderBoard(r.scores, r.ts);
      setTimeout(function () { input.focus(); }, 60);
    } else {
      pendingTs = null;
      els.overRank.textContent = 'RANK OUTSIDE TOP 8';
      announce('Game over. Score ' + info.score + '.');
      initEl.hidden = true;
      renderBoard(r ? r.scores : PP.Storage.getScores(), null);
      setTimeout(function () { id('btn-again').focus(); }, 60);
    }
  }
  id('initials').addEventListener('submit', function (e) {
    e.preventDefault();
    var val = (id('initials-input').value || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'AAA';
    var scores = PP.Storage.setInitials(pendingTs, val);
    id('initials').hidden = true;
    renderBoard(scores, pendingTs);
    id('btn-again').focus();
  });

  // ---- keyboard -----------------------------------------------------------
  root.addEventListener('keydown', function (e) {
    var k = e.code;
    // Let Space/Enter activate a focused control instead of hijacking it globally.
    var tag = (e.target && e.target.tagName) || '';
    if ((k === 'Space' || k === 'Enter') && (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'A')) return;
    if (k === 'KeyM') { toggleMute(); return; }
    if (game.state === 'playing') {
      if (k === 'Escape' || k === 'Space') { e.preventDefault(); game.pause(); showMenu('pause'); }
      idleTimer = 0; return;
    }
    if (game.state === 'paused') { if (k === 'Escape' || k === 'Space') doResume(); return; }
    if (game.state === 'gameover') { if (k === 'Enter' || k === 'Space') beginGame(game.diff); return; }
    // attract / menus
    if (game.state === 'attract' || game.state === 'ready' || game.state === 'dying' || game.state === 'levelclear') {
      if (menu === 'title' && (k === 'Enter' || k === 'Space')) { ui(); showMenu('diff'); }
      else if (menu === 'diff') {
        if (k === 'Digit1' || k === 'KeyE') beginGame('easy');
        else if (k === 'Digit2' || k === 'KeyN') beginGame('normal');
        else if (k === 'Digit3' || k === 'KeyH') beginGame('hard');
        else if (k === 'Escape') showMenu('title');
      } else if (menu === 'help' && (k === 'Escape' || k === 'Enter')) showMenu('title');
    }
    idleTimer = 0;
  });
  root.addEventListener('pointerdown', function () { idleTimer = 0; });

  var resizeT = null;
  root.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { game.relayout(); }, 120); });

  // ---- loop ---------------------------------------------------------------
  // ---- Gamepad (physical arcade sticks / controllers) --------------------
  var gpPrev = {}, lastState = null;
  function pollGamepad() {
    if (!root.navigator || !navigator.getGamepads) return;
    var pads = navigator.getGamepads(), gp = null;
    for (var i = 0; i < pads.length; i++) if (pads[i]) { gp = pads[i]; break; }
    if (!gp) return;
    var dir = null, b = gp.buttons, ax = gp.axes;
    if (b[12] && b[12].pressed) dir = 'up';
    else if (b[13] && b[13].pressed) dir = 'down';
    else if (b[14] && b[14].pressed) dir = 'left';
    else if (b[15] && b[15].pressed) dir = 'right';
    else if (ax && (Math.abs(ax[0] || 0) > 0.5 || Math.abs(ax[1] || 0) > 0.5)) {
      dir = Math.abs(ax[0]) > Math.abs(ax[1]) ? (ax[0] > 0 ? 'right' : 'left') : (ax[1] > 0 ? 'down' : 'up');
    }
    if (dir) input.setTouchDir(dir);
    function edge(idx) { var p = b[idx] && b[idx].pressed; var was = gpPrev[idx]; gpPrev[idx] = p; return p && !was; }
    if (edge(0)) deckA();                 // A / cross
    if (edge(1)) deckB();                 // B / circle
    if (edge(9)) { if (game.state === 'playing') { game.pause(); showMenu('pause'); } else if (menu === 'title') showMenu('diff'); else if (menu === 'diff') beginGame(game.diff || 'normal'); } // start
  }

  var last = PP.U.now();
  showMenu('title');
  function loop() {
    var t = PP.U.now(), dt = (t - last) / 1000; last = t;
    if (dt > 0.1) dt = 0.016;
    // Auto-return to the title if someone walks away mid-pause / game-over.
    if (game.state === 'playing') idleTimer = 0;
    else { idleTimer += dt; if (idleTimer > 45 && (game.state === 'paused' || game.state === 'gameover')) { idleTimer = 0; toTitle(); } }
    pollGamepad();
    if (game.state !== lastState) { var am = { ready: 'Ready!', paused: 'Paused', levelclear: 'Level clear!' }[game.state]; if (am) announce(am); lastState = game.state; }
    game.update(dt);
    renderer.frame(game.renderState());
    // The deck joystick leans the way you're driving.
    if (stick) {
      if (game.state === 'playing' && game.pom) {
        var d = game.pom.dir;
        stick.style.transform = 'translate(calc(-50% + ' + (d.x * 5) + 'px), calc(-70% + ' + (d.y * 4) + 'px)) rotate(' + (d.x * 16) + 'deg)';
      } else if (stick.style.transform) { stick.style.transform = ''; }
    }
    root.requestAnimationFrame(loop);
  }
  root.requestAnimationFrame(loop);
  root.PP.instance = { game: game, renderer: renderer, audio: audio };
})(typeof window !== 'undefined' ? window : this);
