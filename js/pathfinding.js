/*
 * pathfinding.js — the algorithmic soul of Pixel Pals, still a breadth-first
 * search (as in the original C++ `FindPath`), now tunnel-aware so the ghosts can
 * route through the warp tunnels that wrap the board left<->right.
 *
 * grid[y][x] === 1 means WALL. `tunnelRows` (a Set of row indices) marks rows
 * where stepping off the interior edge wraps to the other side.
 */
(function (root) {
  'use strict';

  var DIRS = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ];

  // The tile you land on stepping (dx,dy) from (x,y), honoring warp tunnels.
  // Returns {x,y} (may be off-grid-wrapped) or null if blocked / out of bounds.
  function step(grid, tunnelSet, x, y, dx, dy) {
    var cols = grid[0].length, rows = grid.length;
    if (!(x >= 0 && y >= 0 && Number.isFinite(dx) && Number.isFinite(dy))) {
      if (root.__pfbad === undefined) { root.__pfbad = { x: x, y: y, dx: dx, dy: dy, stack: (new Error()).stack }; }
      return null;
    }
    var nx = x + dx, ny = y + dy;
    if (dx !== 0 && tunnelSet && tunnelSet.has(y)) {
      if (nx < 1) nx = cols - 2;
      else if (nx > cols - 2) nx = 1;
    }
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return null;
    if (grid[ny][nx] === 1) return null;
    return { x: nx, y: ny };
  }

  function bfs(grid, start, goal, opts) {
    opts = opts || {};
    var tunnelSet = opts.tunnelSet || (opts.tunnelRows ? new Set(opts.tunnelRows) : null);
    var rows = grid.length, cols = grid[0].length;
    var dist = new Int32Array(rows * cols).fill(-1);
    var prev = new Int32Array(rows * cols).fill(-1);
    var idx = function (x, y) { return y * cols + x; };

    var queue = [], head = 0;
    var sIdx = idx(start.x, start.y);
    dist[sIdx] = 0; queue.push(sIdx);
    var goalIdx = idx(goal.x, goal.y), found = false;

    while (head < queue.length) {
      var cur = queue[head++];
      if (cur === goalIdx) { found = true; break; }
      var cx = cur % cols, cy = (cur - cx) / cols, nd = dist[cur] + 1;
      for (var i = 0; i < 4; i++) {
        var nb = step(grid, tunnelSet, cx, cy, DIRS[i].dx, DIRS[i].dy);
        if (!nb) continue;
        var nIdx = idx(nb.x, nb.y);
        if (dist[nIdx] !== -1) continue;
        dist[nIdx] = nd; prev[nIdx] = cur; queue.push(nIdx);
      }
    }

    var path = [];
    if (found) {
      var node = goalIdx;
      while (node !== -1 && node !== sIdx) {
        var px = node % cols, py = (node - px) / cols;
        path.push({ x: px, y: py }); node = prev[node];
      }
      path.reverse();
    }
    return { path: path, found: found, dist: dist, cols: cols, rows: rows };
  }

  function nextStep(grid, from, to, opts) {
    var r = bfs(grid, from, to, opts);
    return r.path.length ? r.path[0] : null;
  }

  root.PP = root.PP || {};
  root.PP.Pathfinding = { bfs: bfs, nextStep: nextStep, step: step, DIRS: DIRS };
})(typeof window !== 'undefined' ? window : this);
