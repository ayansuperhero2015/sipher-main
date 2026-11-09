// Nav: a layered 1x1 grid of walkable surfaces (so bridges over ground both work),
// plus links for jump pads and teleporters, searched with A*.
(() => {
'use strict';
const N = G.nav = { nodes: [], cells: null, nx: 0, nz: 0, minX: 0, minZ: 0 };
const TMP = [], tops = [];

G.buildNav = () => {
  const W = G.world, b = W.bounds;
  N.minX = Math.floor(b.minX); N.minZ = Math.floor(b.minZ);
  N.nx = Math.ceil(b.maxX) - N.minX; N.nz = Math.ceil(b.maxZ) - N.minZ;
  N.nodes = []; N.cells = new Array(N.nx * N.nz);
  for (let cz = 0; cz < N.nz; cz++) for (let cx = 0; cx < N.nx; cx++) {
    const x = N.minX + cx + 0.5, z = N.minZ + cz + 0.5;
    const l = W.query(x - 0.01, z - 0.01, x + 0.01, z + 0.01, TMP);
    tops.length = 0;
    for (const bx of l) if (x > bx.minX && x < bx.maxX && z > bx.minZ && z < bx.maxZ && bx.maxY > W.killY + 2) tops.push(bx);
    tops.sort((p, q) => q.maxY - p.maxY);
    const cell = [];
    let lastY = Infinity;
    for (const bx of tops) {
      const y = bx.maxY;
      if (lastY - y < 0.3) continue;
      lastY = y;
      if (W.boxHit(x - 0.3, y + 0.05, z - 0.3, x + 0.3, y + 1.75, z + 0.3)) continue;
      const n = { i: N.nodes.length, x, y, z, cx, cz, hz: bx.type === 'lava' ? 1 : 0, pad: bx.type === 'pad' ? bx : null, link: null, linkCost: 0, cost: 0 };
      if (W.boxHit(x - 0.85, y + 0.3, z - 0.85, x + 0.85, y + 1.6, z + 0.85)) n.cost += 1.2;
      N.nodes.push(n); cell.push(n);
    }
    N.cells[cx + cz * N.nx] = cell;
  }
  // edge nodes (next to a drop) cost a bit more so bots don't hug cliff edges
  for (const n of N.nodes) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = N.cell(n.cx + dx, n.cz + dz);
      if (!c || !c.some(m => m.y > n.y - 3)) { n.cost += 0.8; n.edge = true; break; }
    }
  }
  // jump pad links: simulate the launch and link to where it lands
  for (const pad of W.pads) {
    const body = { pos: new G.V3(pad.x, pad.y + 0.05, pad.z), vel: pad.launch.clone(), r: G.RAD, h: G.HEIGHT, grounded: false, ground: null };
    let t = 0;
    while (t < 5) {
      G.moveBody(body, 1 / 60); t += 1 / 60;
      if (body.grounded && t > 0.15 && !(body.ground && body.ground.type === 'pad')) break;
      if (body.pos.y < W.killY) break;
    }
    if (!body.grounded) continue;
    const land = N.nodeAt(body.pos.x, body.pos.y, body.pos.z);
    if (!land) continue;
    pad.land = land;
    for (const n of N.nodes) if (n.pad === pad.col) { n.link = land; n.linkCost = 2; }
  }
  for (const tp of W.teles) {
    const na = N.nodeAt(tp.a.x, tp.a.y, tp.a.z), nb = N.nodeAt(tp.b.x, tp.b.y, tp.b.z);
    if (!na || !nb) continue;
    for (const n of N.nodes) {
      if (Math.hypot(n.x - tp.a.x, n.z - tp.a.z) < 0.8 && Math.abs(n.y - tp.a.y) < 0.5) { n.link = nb; n.linkCost = 3; }
      if (Math.hypot(n.x - tp.b.x, n.z - tp.b.z) < 0.8 && Math.abs(n.y - tp.b.y) < 0.5) { n.link = na; n.linkCost = 3; }
    }
  }
  N.ground = N.nodes.filter(n => !n.hz && !n.pad && !n.link && n.cost < 1);
};
N.cell = (cx, cz) => (cx < 0 || cz < 0 || cx >= N.nx || cz >= N.nz) ? null : N.cells[cx + cz * N.nx];
N.nodeAt = (x, y, z) => {
  const cx = Math.floor(x - N.minX), cz = Math.floor(z - N.minZ);
  let best = null, bs = Infinity;
  for (let r = 0; r <= 2; r++) {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (r > 0 && Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
      const c = N.cell(cx + dx, cz + dz); if (!c) continue;
      for (const m of c) {
        if (m.y > y + 0.9) continue;
        const s = (m.x - x) ** 2 + (m.z - z) ** 2 + Math.max(0, y - m.y) * 1.5;
        if (s < bs) { bs = s; best = m; }
      }
    }
    if (best) return best;
  }
  return best;
};
N.randomNode = (near, radius) => {
  const pool = N.ground.length ? N.ground : N.nodes;
  for (let k = 0; k < 40; k++) {
    const n = pool[Math.floor(Math.random() * pool.length)];
    if (!near || (n.x - near.x) ** 2 + (n.z - near.z) ** 2 < radius * radius) return n;
  }
  return pool[Math.floor(Math.random() * pool.length)];
};

// ---------- A* ----------
const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
let gS = new Float32Array(0), came = new Int32Array(0), st = new Uint32Array(0), closed = new Uint32Array(0), sid = 0;
const heapI = [], heapF = [];
function push(i, f) {
  let k = heapI.length; heapI.push(i); heapF.push(f);
  while (k > 0) { const p = (k - 1) >> 1; if (heapF[p] <= f) break; heapI[k] = heapI[p]; heapF[k] = heapF[p]; k = p; }
  heapI[k] = i; heapF[k] = f;
}
function pop() {
  const top = heapI[0], li = heapI.pop(), lf = heapF.pop();
  if (heapI.length) {
    let k = 0; const n = heapI.length;
    for (;;) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= lf) break; heapI[k] = heapI[c]; heapF[k] = heapF[c]; k = c; }
    heapI[k] = li; heapF[k] = lf;
  }
  return top;
}
function near(cx, cz, y) { const c = N.cell(cx, cz); if (!c) return false; for (const m of c) if (Math.abs(m.y - y) < 0.7) return true; return false; }
N.path = (s, g, maxIter = 7000) => {
  if (!s || !g) return null;
  if (s === g) return [g];
  const n = N.nodes.length;
  if (gS.length < n) { gS = new Float32Array(n); came = new Int32Array(n); st = new Uint32Array(n); closed = new Uint32Array(n); }
  sid++; heapI.length = 0; heapF.length = 0;
  const h = m => Math.hypot(m.x - g.x, m.z - g.z) + Math.abs(m.y - g.y) * 0.5;
  gS[s.i] = 0; came[s.i] = -1; st[s.i] = sid; push(s.i, h(s));
  let best = s.i, bh = h(s), iter = 0;
  const relax = (m, c, from) => {
    const ng = gS[from] + c;
    if (st[m.i] !== sid || ng < gS[m.i]) { st[m.i] = sid; gS[m.i] = ng; came[m.i] = from; push(m.i, ng + h(m)); }
  };
  while (heapI.length && iter++ < maxIter) {
    const i = pop();
    if (closed[i] === sid) continue;
    closed[i] = sid;
    if (i === g.i) { best = i; break; }
    const nd = N.nodes[i];
    const hh = h(nd); if (hh < bh) { bh = hh; best = i; }
    for (const [dx, dz, dc] of D8) {
      const c = N.cell(nd.cx + dx, nd.cz + dz); if (!c) continue;
      const diag = dx && dz;
      for (const m of c) {
        const dy = m.y - nd.y;
        if (dy > 1.3 || dy < -10) continue;
        if (diag && (!near(nd.cx + dx, nd.cz, nd.y) || !near(nd.cx, nd.cz + dz, nd.y))) continue;
        let cost = dc + m.cost + (dy > 0.6 ? 1.2 : 0) + (dy < -1.5 ? 0.6 : 0);
        if (m.hz) cost += 40;
        if (m.pad && !nd.pad) cost += 5;
        relax(m, cost, i);
      }
    }
    if (nd.link) relax(nd.link, nd.linkCost, i);
  }
  const out = [];
  let k = best;
  while (k !== -1 && out.length < 2000) { out.push(N.nodes[k]); k = came[k]; }
  out.reverse();
  return out;
};
})();
