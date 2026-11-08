// Map: "Skyhold", an original four-team sky map. Team islands sit on the four sides,
// diamond islands on the diagonals and an emerald island in the middle.
(() => {
'use strict';
const S = G.SURF, CXW = G.W / 2, CZW = G.D / 2;
const TEAM_DIST = 44, DIA_DIST = 29;
const wd = G.world;

// small deterministic noise so the islands look the same every match
let s0 = 7;
const rnd = () => { s0 = (s0 * 16807) % 2147483647; return (s0 - 1) / 2147483646; };
const hash = (x, z) => { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); };

// Fill a blob-shaped floating island. shape(x,z) returns 0..1 "inside-ness" (>0 = inside).
function blob(cx, cz, rx, rz, depth, top = 1, sub = 2) {
  for (let z = Math.floor(cz - rz - 2); z <= cz + rz + 2; z++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
    const dx = (x - cx) / rx, dz = (z - cz) / rz, r = Math.max(Math.abs(dx), Math.abs(dz)) * 0.6 + Math.hypot(dx, dz) * 0.4;
    if (r > 1) continue;
    const dep = Math.floor(1 + (1 - r) * depth + hash(x, z) * 2.5);
    for (let k = 0; k < dep; k++) {
      const y = S - 1 - k;
      wd.raw(x, y, z, k === 0 ? top : k <= sub ? 2 : 3);
    }
  }
}
function pad(x, z, r, id = 17) { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) wd.raw(x + dx, S - 1, z + dz, id); }
function tree(x, z, h = 4) {
  for (let y = 0; y < h; y++) wd.raw(x, S + y, z, 5);
  for (let y = h - 2; y <= h + 1; y++) {
    const r = y >= h ? 1 : 2;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) === r && Math.abs(dz) === r && (y === h + 1 || rnd() < 0.5)) continue;
      if (!wd.get(x + dx, S + y, z + dz)) wd.raw(x + dx, S + y, z + dz, 6);
    }
  }
}

G.buildMap = () => {
  wd.clear(); s0 = 7;
  const map = { teams: [], diamond: [], emerald: [], protect: [], decor: [] };
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // red +z, blue +x, green -z, yellow -x
  G.TEAMS.forEach((t, i) => {
    const [ox, oz] = dirs[i], cx = CXW + ox * TEAM_DIST, cz = CZW + oz * TEAM_DIST;
    const fx = -ox, fz = -oz, rx = -fz, rz = fx; // forward points at the middle
    const L = (lx, lz) => [cx + lx * rx + lz * fx, cz + lx * rz + lz * fz];
    // island body: wide at the back, narrower towards the bed
    const [bx, bz] = L(0, -1);
    blob(bx, bz, ox ? 9 : 8, oz ? 9 : 8, 7);
    const [fx2, fz2] = L(0, 5);
    blob(fx2, fz2, ox ? 4.5 : 5.5, oz ? 4.5 : 5.5, 4);
    // generator pad at the back, spawn in front of it
    const [gx, gz] = L(0, -6);
    pad(gx, gz, 1);
    for (const [a, b] of [[-2, -8], [-1, -8], [0, -8], [1, -8], [2, -8], [-3, -7], [3, -7]]) { const [x, z] = L(a, b); wd.raw(x, S, z, 18); wd.raw(x, S + 1, z, 18); }
    for (const [a, b] of [[-2, -7], [2, -7]]) { const [x, z] = L(a, b); wd.raw(x, S, z, 18); }
    // the bed: foot at lz 3, head at lz 4
    const [b1x, b1z] = L(0, 3), [b2x, b2z] = L(0, 4);
    wd.setBed(b1x, S, b1z, i); wd.setBed(b2x, S, b2z, i);
    // decorative team-coloured trim around the island top
    for (let a = -6; a <= 6; a += 12) for (let b = -5; b <= 0; b++) { const [x, z] = L(a, b); if (wd.get(x, S - 1, z)) wd.raw(x, S - 1, z, G.WOOL(i)); }
    const [s1x, s1z] = L(-5, -4), [s2x, s2z] = L(5, -4);
    const [spx, spz] = L(0, -3);
    const yawFace = (dx, dz) => Math.atan2(dx, dz);
    map.teams.push({
      team: i, cx, cz, fwd: [fx, fz], right: [rx, rz], L,
      spawn: new G.V3(spx + 0.5, S, spz + 0.5),
      spawnYaw: Math.atan2(-fx, -fz),
      bed: [{ x: b1x, y: S, z: b1z }, { x: b2x, y: S, z: b2z }],
      bedYaw: Math.atan2(fx, fz),
      gen: new G.V3(gx + 0.5, S, gz + 0.5),
      shop: { pos: new G.V3(s1x + 0.5, S, s1z + 0.5), yaw: yawFace(rx, rz) },
      upg: { pos: new G.V3(s2x + 0.5, S, s2z + 0.5), yaw: yawFace(-rx, -rz) },
      edge: L(0, 8) // where bridges usually start
    });
    map.protect.push({ x: gx + 0.5, z: gz + 0.5, r: 2.2 }, { x: s1x + 0.5, z: s1z + 0.5, r: 1.6 }, { x: s2x + 0.5, z: s2z + 0.5, r: 1.6 });
  });
  // diamond islands
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const cx = CXW + sx * DIA_DIST, cz = CZW + sz * DIA_DIST;
    blob(cx, cz, 4.2, 4.2, 5, 7, 1);
    pad(cx, cz, 1, 15);
    wd.raw(cx, S - 1, cz, 17);
    for (const [a, b] of [[-3, -3], [3, 3], [3, -3], [-3, 3]]) if (wd.get(cx + a, S - 1, cz + b)) { wd.raw(cx + a, S, cz + b, 7); if (rnd() < 0.6) wd.raw(cx + a, S + 1, cz + b, 7); }
    map.diamond.push(new G.V3(cx + 0.5, S, cz + 0.5));
    map.protect.push({ x: cx + 0.5, z: cz + 0.5, r: 1.6 });
  }
  // middle island
  blob(CXW, CZW, 10, 10, 9, 1, 3);
  for (const [a, b] of [[-4, 0], [4, 0]]) { pad(CXW + a, CZW + b, 1, 15); wd.raw(CXW + a, S - 1, CZW + b, 17); map.emerald.push(new G.V3(CXW + a + 0.5, S, CZW + b + 0.5)); map.protect.push({ x: CXW + a + 0.5, z: CZW + b + 0.5, r: 1.6 }); }
  // a little ruin in the middle and trees around the rim
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) wd.raw(CXW + a, S - 1, CZW + b, 18);
  for (const [a, b] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) { for (let y = 0; y < 3; y++) wd.raw(CXW + a * 2, S + y, CZW + b * 2, 18); }
  for (const [a, b] of [[-7, -5], [6, 6], [-6, 7], [7, -6]]) tree(CXW + a, CZW + b, 4 + (rnd() < 0.5 ? 1 : 0));
  // far-away scenery islands for the sky (never reachable)
  for (let k = 0; k < 10; k++) {
    const ang = k / 10 * Math.PI * 2 + 0.3, r = 120 + (k % 3) * 25;
    map.decor.push({ x: CXW + Math.cos(ang) * r, y: S - 10 + (k % 4) * 6, z: CZW + Math.sin(ang) * r, s: 6 + (k % 3) * 3 });
  }
  return map;
};

// Where blocks may not be placed (generators, shops) and the height limit.
G.canBuildAt = (x, y, z) => {
  if (y >= G.BUILD_MAX || y < 1 || !wd.inside(x, y, z)) return false;
  for (const p of G.game.map.protect) if (G.dist2(x + 0.5, z + 0.5, p.x, p.z) < p.r * p.r && y < G.SURF + 3) return false;
  return true;
};
})();
