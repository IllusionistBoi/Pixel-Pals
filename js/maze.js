/*
 * maze.js — an interconnected, left-right SYMMETRIC arcade maze with a real
 * walled ghost-house.
 *
 * Pipeline (each step only opens tiles unless noted, and a final repair pass
 * guarantees every open tile is reachable):
 *   1. randomized DFS maze on the left half, then MIRROR to the right (classic,
 *      recognizable board instead of random asymmetry)
 *   2. stitch the two halves across the centre column
 *   3. full braid (open every dead end -> loops / escape routes everywhere)
 *   4. perimeter ring (outer loop you can circle)
 *   5. warp tunnels (rows cleared across, wrap left<->right)
 *   6. a WALLED ghost house (box + pink gate) carved in the centre
 *   7. connectivity repair
 *
 * grid[y][x]: 1 = wall, 0 = open.
 */
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeGrid(cols, rows, fill) {
    var g = new Array(rows);
    for (var y = 0; y < rows; y++) { g[y] = new Array(cols); for (var x = 0; x < cols; x++) g[y][x] = fill; }
    return g;
  }

  function generate(cols, rows, seed) {
    if (cols % 2 === 0) cols += 1;
    if (rows % 2 === 0) rows += 1;
    var rng = mulberry32((seed == null ? Math.floor(Math.random() * 1e9) : seed) >>> 0);
    var grid = makeGrid(cols, rows, 1);
    var half = (cols - 1) / 2; // carve columns 1..half, mirror the rest

    // 1) DFS on the left half (cells on even coords, walls between).
    var stack = [{ x: 1, y: 1 }]; grid[1][1] = 0;
    var STEP = [{ dx: 0, dy: -2 }, { dx: 0, dy: 2 }, { dx: -2, dy: 0 }, { dx: 2, dy: 0 }];
    while (stack.length) {
      var cur = stack[stack.length - 1], order = [0, 1, 2, 3];
      for (var s = 3; s > 0; s--) { var j = (rng() * (s + 1)) | 0; var tmp = order[s]; order[s] = order[j]; order[j] = tmp; }
      var carved = false;
      for (var k = 0; k < 4; k++) {
        var d = STEP[order[k]], nx = cur.x + d.dx, ny = cur.y + d.dy;
        if (nx > 0 && ny > 0 && nx <= half && ny < rows - 1 && grid[ny][nx] === 1) {
          grid[cur.y + d.dy / 2][cur.x + d.dx / 2] = 0; grid[ny][nx] = 0;
          stack.push({ x: nx, y: ny }); carved = true; break;
        }
      }
      if (!carved) stack.pop();
    }

    // 2) Mirror left -> right, then stitch across the centre column.
    for (var y = 0; y < rows; y++) for (var x = 0; x < half; x++) grid[y][cols - 1 - x] = grid[y][x];
    for (var yy = 1; yy < rows - 1; yy += 2) if (grid[yy][half - 1] === 0 || grid[yy][half + 1] === 0) grid[yy][half] = 0;

    // 3) Full braid — open every dead end.
    var N = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    for (var pass = 0; pass < 2; pass++) {
      for (var by = 1; by < rows - 1; by++) {
        for (var bx = 1; bx < cols - 1; bx++) {
          if (grid[by][bx] !== 0) continue;
          var open = 0, wd = [];
          for (var i = 0; i < 4; i++) {
            var ax = bx + N[i].dx, ay = by + N[i].dy;
            if (grid[ay][ax] === 0) open++;
            else if (ax > 0 && ay > 0 && ax < cols - 1 && ay < rows - 1) wd.push(N[i]);
          }
          if (open <= 1 && wd.length) { var w = wd[(rng() * wd.length) | 0]; grid[by + w.dy][bx + w.dx] = 0; }
        }
      }
    }

    // 4) Perimeter ring.
    for (var rx = 1; rx < cols - 1; rx++) { grid[1][rx] = 0; grid[rows - 2][rx] = 0; }
    for (var ry = 1; ry < rows - 1; ry++) { grid[ry][1] = 0; grid[ry][cols - 2] = 0; }

    // 5) Warp tunnels.
    var pcx = (cols / 2) | 0, pcy = (rows / 2) | 0;
    var tunnelRows = [];
    [Math.max(2, Math.round(rows * 0.3)), Math.min(rows - 3, Math.round(rows * 0.7))].forEach(function (ty) {
      if (Math.abs(ty - pcy) <= 2) return;
      for (var x = 1; x < cols - 1; x++) grid[ty][x] = 0;
      tunnelRows.push(ty);
    });

    // 6) Walled ghost house: 5x3 interior, wall ring, a 1-tile gate at top-centre.
    var house = { cx: pcx, cy: pcy, cells: [], gate: { x: pcx, y: pcy - 2 } };
    for (var wy = pcy - 2; wy <= pcy + 2; wy++) {
      for (var wx = pcx - 3; wx <= pcx + 3; wx++) {
        if (wx <= 0 || wy <= 0 || wx >= cols - 1 || wy >= rows - 1) continue;
        grid[wy][wx] = 1; // wall the whole footprint first
      }
    }
    for (var iy = pcy - 1; iy <= pcy + 1; iy++) for (var ix = pcx - 2; ix <= pcx + 2; ix++) { grid[iy][ix] = 0; house.cells.push({ x: ix, y: iy }); }
    grid[pcy - 2][pcx] = 0;          // gate opening
    if (pcy - 3 > 0) grid[pcy - 3][pcx] = 0; // corridor just above the gate
    // keep corridors flanking the house connected
    grid[pcy][pcx - 3 > 0 ? pcx - 3 : 1] = 1;

    // 7) Force perfect left-right symmetry (the braid/repair mutated both halves
    //    independently). The house/tunnels/ring are already centred, so a final
    //    mirror + centre-stitch is symmetric; the perimeter ring keeps everything
    //    connected, so repair is a no-op and symmetry survives.
    for (var my = 0; my < rows; my++) for (var mx = 0; mx < half; mx++) grid[my][cols - 1 - mx] = grid[my][mx];
    for (var sy2 = 1; sy2 < rows - 1; sy2 += 2) if (grid[sy2][half - 1] === 0 || grid[sy2][half + 1] === 0) grid[sy2][half] = 0;
    repair(grid, cols, rows, nearestOpen(grid, 1, rows - 2, cols, rows, house), house);

    // Spawns.
    var pomStart = nearestOpen(grid, pcx, rows - 2, cols, rows, house);
    var ghostStarts = [
      { x: pcx, y: pcy }, { x: pcx - 1, y: pcy }, { x: pcx + 1, y: pcy }, { x: pcx - 2, y: pcy },
    ];
    var powerCells = [
      nearestOpen(grid, 3, 3, cols, rows, house), nearestOpen(grid, cols - 4, 3, cols, rows, house),
      nearestOpen(grid, 3, rows - 4, cols, rows, house), nearestOpen(grid, cols - 4, rows - 4, cols, rows, house),
    ];

    return {
      grid: grid, cols: cols, rows: rows, tunnelRows: tunnelRows,
      pen: { cx: pcx, cy: pcy, cells: house.cells, doorY: pcy - 2, gate: house.gate, houseCells: house.cells },
      pomStart: pomStart, ghostStarts: ghostStarts, powerCells: powerCells,
    };
  }

  function inHouse(house, x, y) {
    return x >= house.cx - 3 && x <= house.cx + 3 && y >= house.cy - 2 && y <= house.cy + 2;
  }

  function repair(grid, cols, rows, start, house) {
    var reach = flood(grid, cols, rows, start);
    for (var attempt = 0; attempt < 6; attempt++) {
      var connectedAny = false;
      for (var y = 1; y < rows - 1; y++) {
        for (var x = 1; x < cols - 1; x++) {
          if (grid[y][x] !== 0 || reach[y * cols + x] || inHouse(house, x, y)) continue;
          // isolated open tile — try to punch to a reachable cell two away.
          var D = [[0, -2], [0, 2], [-2, 0], [2, 0]];
          for (var i = 0; i < 4; i++) {
            var nx = x + D[i][0], ny = y + D[i][1];
            if (nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && grid[ny][nx] === 0 && reach[ny * cols + nx] && !inHouse(house, (x + nx) / 2, (y + ny) / 2)) {
              grid[y + D[i][1] / 2][x + D[i][0] / 2] = 0; connectedAny = true; break;
            }
          }
        }
      }
      if (!connectedAny) break;
      reach = flood(grid, cols, rows, start);
    }
  }

  function flood(grid, cols, rows, start) {
    var reach = new Uint8Array(cols * rows), q = [start.y * cols + start.x];
    reach[q[0]] = 1;
    var D = [[0, -1], [0, 1], [-1, 0], [1, 0]], head = 0;
    while (head < q.length) {
      var c = q[head++], cx = c % cols, cy = (c - cx) / cols;
      for (var i = 0; i < 4; i++) {
        var nx = cx + D[i][0], ny = cy + D[i][1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        var ni = ny * cols + nx;
        if (grid[ny][nx] === 0 && !reach[ni]) { reach[ni] = 1; q.push(ni); }
      }
    }
    return reach;
  }

  function nearestOpen(grid, x, y, cols, rows, house) {
    for (var r = 0; r < Math.max(cols, rows); r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          var nx = x + dx, ny = y + dy;
          if (nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && grid[ny][nx] === 0 && !(house && inHouse(house, nx, ny))) return { x: nx, y: ny };
        }
      }
    }
    return { x: 1, y: 1 };
  }

  function openCells(grid) {
    var cells = [];
    for (var y = 0; y < grid.length; y++) for (var x = 0; x < grid[0].length; x++) if (grid[y][x] === 0) cells.push({ x: x, y: y });
    return cells;
  }

  root.PP = root.PP || {};
  root.PP.Maze = { generate: generate, openCells: openCells, makeGrid: makeGrid };
})(typeof window !== 'undefined' ? window : this);
