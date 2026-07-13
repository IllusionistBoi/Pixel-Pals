/*
 * audio.js — every sound in Pixel Pals is synthesized live in the browser.
 * No audio files, no network: just oscillators, noise and envelopes through a
 * shared master bus with a gentle limiter. This keeps the whole game to a single
 * shareable folder while still sounding alive.
 *
 * Layers:
 *   - sfx()      one-shot blips, sweeps, noise hits (eat, turn, capture, power-up)
 *   - music      an evolving arpeggio + bass pulse whose intensity rises with the
 *                `tension` value (0 calm .. 1 the Eater is on your neck)
 */
(function (root) {
  'use strict';

  function create() {
    var Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return stub();

    var ac = new Ctx();
    var master = ac.createGain();
    master.gain.value = 0.9;

    // A soft limiter so stacked blips never clip or hurt.
    var comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    master.connect(comp);
    comp.connect(ac.destination);

    var muted = false;
    var musicGain = ac.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);

    var sfxGain = ac.createGain();
    sfxGain.gain.value = 0.85;
    sfxGain.connect(master);

    // Shared noise buffer for percussive hits.
    var noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
    var nd = noiseBuf.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    function now() { return ac.currentTime; }

    // Nothing is scheduled until the first user gesture unlocks the context.
    // This prevents autoplay warnings and a burst of queued oscillators on unlock.
    var unlocked = false;
    function resume() {
      if (ac.state === 'suspended') ac.resume();
      unlocked = true;
    }

    function env(node, t, a, d, peak, sus) {
      var g = node.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.0001, t);
      g.exponentialRampToValueAtTime(peak, t + a);
      g.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d);
      return g;
    }

    function tone(freq, dur, type, gainVal, dest, glideTo) {
      if (!unlocked) return;
      var t = now();
      var o = ac.createOscillator();
      var g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
      env(g, t, Math.min(0.01, dur * 0.2), dur, gainVal, 0.0001);
      o.connect(g); g.connect(dest || sfxGain);
      o.start(t); o.stop(t + dur + 0.05);
      return o;
    }

    function noiseHit(dur, gainVal, hp) {
      if (!unlocked) return;
      var t = now();
      var src = ac.createBufferSource();
      src.buffer = noiseBuf;
      var g = ac.createGain();
      var f = ac.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp || 800;
      env(g, t, 0.002, dur, gainVal, 0.0001);
      src.connect(f); f.connect(g); g.connect(sfxGain);
      src.start(t); src.stop(t + dur + 0.02);
    }

    // ---- Named cues -------------------------------------------------------
    var sfx = {
      eat: function (combo) {
        // Pitch climbs with the combo streak for a satisfying ramp.
        var base = 520 + Math.min(combo || 0, 24) * 26;
        tone(base, 0.09, 'square', 0.28, sfxGain, base * 1.5);
      },
      turn: function () { tone(300, 0.04, 'triangle', 0.10); },
      bonk: function () { tone(120, 0.06, 'sawtooth', 0.14, sfxGain, 80); },
      power: function () {
        tone(440, 0.5, 'square', 0.22, sfxGain, 1320);
        setTimeout(function () { tone(660, 0.4, 'triangle', 0.18, sfxGain, 1760); }, 60);
      },
      freeze: function () { tone(1200, 0.6, 'sine', 0.22, sfxGain, 200); noiseHit(0.3, 0.06, 3000); },
      blink: function () { tone(200, 0.18, 'sine', 0.2, sfxGain, 1600); },
      capture: function () {
        tone(300, 0.5, 'sawtooth', 0.3, sfxGain, 60);
        noiseHit(0.5, 0.18, 400);
        setTimeout(function () { tone(160, 0.6, 'square', 0.25, sfxGain, 50); }, 90);
      },
      levelup: function () {
        [523, 659, 784, 1047].forEach(function (f, i) {
          setTimeout(function () { tone(f, 0.16, 'square', 0.24); }, i * 70);
        });
      },
      ui: function () { tone(680, 0.05, 'square', 0.12); },
      start: function () {
        [392, 523, 659, 880].forEach(function (f, i) {
          setTimeout(function () { tone(f, 0.14, 'triangle', 0.22); }, i * 90);
        });
      },
      // The signature cue: a soft music-box ping on every real BFS recompute.
      // `closeness` 0..1 (1 = Eater right on top of Pom) → higher, more dread.
      ping: function (closeness) {
        if (!unlocked) return;
        var f = 380 + Math.min(1, Math.max(0, closeness)) * 900;
        var t = now();
        var o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o2.type = 'sine';
        o.frequency.value = f; o2.frequency.value = f * 2.01; // FM-ish bell
        var mod = ac.createGain(); mod.gain.value = f * 0.6;
        o2.connect(mod); mod.connect(o.frequency);
        env(g, t, 0.004, 0.28, 0.10 + closeness * 0.06, 0.0001);
        o.connect(g); g.connect(sfxGain);
        o.start(t); o2.start(t); o.stop(t + 0.34); o2.stop(t + 0.34);
      },
      // Eater footstep — a low-passed wood-block, tempo-locked by the caller.
      step: function () {
        if (!unlocked) return;
        var t = now();
        var src = ac.createBufferSource(); src.buffer = noiseBuf;
        var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 6;
        var g = ac.createGain();
        env(g, t, 0.002, 0.06, 0.10, 0.0001);
        src.connect(bp); bp.connect(g); g.connect(sfxGain);
        src.start(t); src.stop(t + 0.09);
        tone(90, 0.05, 'sine', 0.06);
      },
      // Hollow cardboard "tok" when the player knocks the box.
      knock: function () {
        tone(150, 0.12, 'sine', 0.16, sfxGain, 60);
        noiseHit(0.06, 0.10, 500);
      },
      reboot: function () { tone(880, 0.08, 'square', 0.14); }, // cold terminal beep
      // Arcade cues.
      _waka: 0,
      waka: function () { this._waka ^= 1; tone(this._waka ? 340 : 200, 0.06, 'square', 0.14, sfxGain, this._waka ? 200 : 340); },
      eatGhost: function (chain) {
        var base = 300 + (chain || 1) * 120;
        tone(base, 0.09, 'square', 0.2, sfxGain, base * 2);
        setTimeout(function () { tone(base * 2, 0.12, 'square', 0.18, sfxGain, base * 3); }, 80);
      },
      death: function () {
        var seq = [660, 620, 580, 520, 460, 400, 340, 280, 220, 160];
        seq.forEach(function (f, i) { setTimeout(function () { tone(f, 0.12, 'sawtooth', 0.22, sfxGain, f * 0.8); }, i * 90); });
      },
      ready: function () {
        [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.13, 'square', 0.2); }, i * 110); });
      },
      // Metallic coin "clink" for inserting a credit.
      coin: function () {
        tone(1180, 0.05, 'square', 0.18, sfxGain, 1560);
        setTimeout(function () { tone(1560, 0.09, 'triangle', 0.16, sfxGain, 940); }, 45);
        noiseHit(0.05, 0.05, 4000);
      },
      // CRT power-on thunk + rising whine.
      powerOn: function () {
        tone(60, 0.18, 'sawtooth', 0.14, sfxGain, 30);
        tone(200, 0.5, 'sine', 0.06, sfxGain, 900);
        noiseHit(0.12, 0.05, 1200);
      },
    };

    // ---- Procedural music -------------------------------------------------
    var music = { playing: false, tension: 0, _timer: null, _step: 0 };
    // Minor-key arpeggio that gains upper voices + speed as tension rises.
    var SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25]; // A minor-ish
    var PATTERN = [0, 2, 4, 6, 4, 2, 0, 3];

    function musicTick() {
      if (!music.playing) return;
      var t = music.tension;
      var stepDur = 0.20 - t * 0.075; // faster when hunted
      var noteIndex = PATTERN[music._step % PATTERN.length];
      var f = SCALE[noteIndex];
      // Bass pulse every 4 steps.
      if (music._step % 4 === 0) tone(f / 2, stepDur * 3.2, 'triangle', 0.12 + t * 0.05, musicGain);
      // Lead voice.
      tone(f, stepDur * 0.9, 'square', 0.05 + t * 0.05, musicGain);
      // Tension harmony voice kicks in when the hunt heats up.
      if (t > 0.45) tone(f * 1.5, stepDur * 0.7, 'sawtooth', 0.02 + t * 0.03, musicGain);
      music._step++;
      music._timer = setTimeout(musicTick, stepDur * 1000);
    }

    music.start = function () {
      if (music.playing) return;
      music.playing = true;
      music._step = 0;
      musicGain.gain.cancelScheduledValues(now());
      musicGain.gain.setTargetAtTime(0.5, now(), 0.5); // master gain is the mute gate
      musicTick();
    };
    music.stop = function () {
      music.playing = false;
      if (music._timer) clearTimeout(music._timer);
      musicGain.gain.setTargetAtTime(0.0001, now(), 0.2);
    };
    music.setTension = function (v) { music.tension = Math.max(0, Math.min(1, v)); };

    function setMuted(m) {
      muted = m;
      master.gain.setTargetAtTime(m ? 0.0001 : 0.9, now(), 0.05);
    }

    return {
      resume: resume,
      sfx: sfx,
      music: music,
      setMuted: setMuted,
      isMuted: function () { return muted; },
      ctx: ac,
    };
  }

  // Silent fallback if Web Audio is unavailable.
  function stub() {
    var noop = function () {};
    var sfx = {};
    ['eat', 'turn', 'bonk', 'power', 'freeze', 'blink', 'capture', 'levelup', 'ui', 'start',
      'ping', 'step', 'knock', 'reboot', 'waka', 'eatGhost', 'death', 'ready', 'coin', 'powerOn']
      .forEach(function (k) { sfx[k] = noop; });
    return {
      resume: noop, sfx: sfx,
      music: { start: noop, stop: noop, setTension: noop, playing: false },
      setMuted: noop, isMuted: function () { return true; }, ctx: null,
    };
  }

  root.PP = root.PP || {};
  root.PP.Audio = { create: create };
})(typeof window !== 'undefined' ? window : this);
