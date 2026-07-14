/*
 * storage.js — persistent high scores + settings via localStorage.
 * Fails safe to an in-memory store when storage is blocked (private mode, etc.).
 */
(function (root) {
  'use strict';

  var KEY_SCORES = 'pixelpals.scores.v1';
  var KEY_PREFS = 'pixelpals.prefs.v1';
  var mem = {};

  function backend() {
    try {
      var t = '__pp_test__';
      root.localStorage.setItem(t, '1');
      root.localStorage.removeItem(t);
      return root.localStorage;
    } catch (e) {
      return {
        getItem: function (k) { return k in mem ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; },
      };
    }
  }

  var store = backend();

  function readJSON(key, fallback) {
    try { var raw = store.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { store.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function getScores() {
    var s = readJSON(KEY_SCORES, []);
    return Array.isArray(s) ? s : [];
  }

  // Would this score make the top 8?
  function qualifies(score) {
    var s = getScores();
    return s.length < 8 || score > s[s.length - 1].score;
  }

  // Insert a score (with initials). Returns { rank, isHigh, best, scores }.
  function submitScore(entry) {
    var scores = getScores();
    scores.push({ score: entry.score, diff: entry.diff, level: entry.level || 1, ts: entry.ts || 0, initials: (entry.initials || 'AAA').toUpperCase().slice(0, 3) });
    scores.sort(function (a, b) { return b.score - a.score; });
    var trimmed = scores.slice(0, 8);
    writeJSON(KEY_SCORES, trimmed);
    var rank = -1;
    for (var i = 0; i < trimmed.length; i++) if (trimmed[i].ts === entry.ts && trimmed[i].score === entry.score) { rank = i + 1; break; }
    return { rank: rank, isHigh: rank !== -1, best: trimmed[0] ? trimmed[0].score : 0, scores: trimmed, ts: entry.ts };
  }

  // Set the initials on a stored entry (after the player enters them).
  function setInitials(ts, initials) {
    var scores = getScores();
    for (var i = 0; i < scores.length; i++) if (scores[i].ts === ts) { scores[i].initials = (initials || 'AAA').toUpperCase().slice(0, 3); break; }
    writeJSON(KEY_SCORES, scores);
    return scores;
  }

  function bestScore() {
    var s = getScores();
    return s.length ? s[0].score : 0;
  }

  function getPrefs() {
    return readJSON(KEY_PREFS, { muted: false, reducedMotion: false, visualizer: false, colorblind: false });
  }
  function setPrefs(p) { writeJSON(KEY_PREFS, p); }

  root.PP = root.PP || {};
  root.PP.Storage = {
    getScores: getScores, submitScore: submitScore, setInitials: setInitials,
    qualifies: qualifies, bestScore: bestScore,
    getPrefs: getPrefs, setPrefs: setPrefs,
  };
})(typeof window !== 'undefined' ? window : this);
