// Bots: bomb holders hunt the nearest runner, runners pick escape spots away from
// every bomb, grab power-ups and use their abilities at sensible moments.
(() => {
'use strict';
const NAV = () => G.nav;

G.makeBrain = () => ({
  thinkT: Math.random() * 0.3, react: G.rand(0.18, 0.34), path: null, pi: 0, goal: null, target: null, direct: null,
  mode: 'roam', fleeT: 0, wanderT: G.rand(0, 2), abT: G.rand(0.5, 1.5), stuckT: 0, lastX: 0, lastZ: 0, progT: 0,
  replan: false, threat: null, threatD: Infinity, noDirectT: 0
});

function seen(by, t) {
  if (t.fx && t.fx.invis > 0) return G.hdist(by.pos, t.pos) < 2.5;
  return true;
}
function setPath(a, b, goalNode) {
  const s = NAV().nodeAt(a.pos.x, a.pos.y, a.pos.z);
  b.path = NAV().path(s, goalNode);
  b.pi = b.path && b.path.length > 1 ? 1 : 0;
  b.goal = goalNode;
}
const _p = new G.V3();
// Is there floor ahead in this direction (so bots don't run off sky islands)?
function safeAhead(a, dx, dz, dist = 1.2) {
  _p.set(a.pos.x + dx * dist, a.pos.y + 0.5, a.pos.z + dz * dist);
  const t = G.raycast(_p, new G.V3(0, -1, 0), 8);
  if (t >= 8) return false;
  const gy = _p.y - t;
  return !(G.world.def.id === 'lava' && gy < -0.5);
}
function safeLine(a, dx, dz, dist) {
  for (let d = 1.5; d <= dist; d += 1.5) if (!safeAhead(a, dx, dz, d)) return false;
  return true;
}

function think(a, b) {
  const m = G.match;
  const holders = G.actors.filter(o => o.alive && o.bomb && o !== a);
  b.direct = null;
  if (a.bomb && m.state === 'round') {
    // ---- chase ----
    let best = null, bs = Infinity;
    const cands = G.actors.filter(o => o.alive && !o.bomb && o !== a);
    for (const d of G.ent.decoys) if (d.alive && d.owner !== a) cands.push(d);
    for (const c of cands) {
      if (a.noBackT > 0 && c.id === a.noBackId) continue;
      if (!seen(a, c)) continue;
      let s = Math.hypot(c.pos.x - a.pos.x, c.pos.z - a.pos.z) + Math.abs(c.pos.y - a.pos.y) * 2;
      if (c === b.target) s *= 0.75;
      if (c.isPlayer) s *= 0.92;
      if (c.fx && c.fx.shield) s *= 1.6;
      if (s < bs) { bs = s; best = c; }
    }
    b.target = best; b.mode = 'chase';
    if (!best) { b.path = null; return; }
    const d = G.hdist(a.pos, best.pos), dy = best.pos.y - a.pos.y;
    if (d < 4 && Math.abs(dy) < 1.2 && b.noDirectT <= 0 && G.los(a.pos, best.pos, 0.5, 0.5)) { b.direct = best; b.path = null; return; }
    const gn = NAV().nodeAt(best.pos.x, best.pos.y + 0.3, best.pos.z);
    if (b.replan || !b.path || b.goal !== gn || b.pi >= b.path.length) setPath(a, b, gn);
    b.replan = false;
    return;
  }
  // ---- runner ----
  let threat = null, near = Infinity;
  for (const h of holders) {
    if (!seen(a, h)) continue;
    const d = Math.hypot(h.pos.x - a.pos.x, h.pos.z - a.pos.z) + Math.abs(h.pos.y - a.pos.y) * 0.8;
    if (d < near) { near = d; threat = h; }
  }
  b.threat = threat; b.threatD = near;
  const danger = 12 + a.skill * 4;
  if (threat && near < danger && m.state === 'round') {
    b.mode = 'flee';
    b.fleeT -= b.react;
    const goalBad = b.goal && holders.some(h => Math.hypot(h.pos.x - b.goal.x, h.pos.z - b.goal.z) < 6);
    const reached = b.path && b.pi >= b.path.length;
    if (b.replan || !b.path || b.fleeT <= 0 || goalBad || reached) {
      pickFlee(a, b, holders.filter(h => seen(a, h)));
      b.replan = false;
    }
    if (near < 2.8) b.direct = 'away';
    return;
  }
  b.mode = 'roam';
  // power-up nearby?
  let pu = null, pd = 14;
  for (const p of G.ent.pups) { const d = G.hdist(p.pos, a.pos); if (d < pd && Math.abs(p.pos.y - a.pos.y) < 4) { pd = d; pu = p; } }
  if (pu) {
    const gn = NAV().nodeAt(pu.pos.x, pu.pos.y + 0.3, pu.pos.z);
    if (b.goal !== gn || !b.path) setPath(a, b, gn);
    return;
  }
  b.wanderT -= b.react;
  if (b.wanderT <= 0 || b.replan) {
    b.wanderT = G.rand(2, 5); b.replan = false;
    // drift away from the crowd's holders even when safe
    let n = NAV().randomNode(a.pos, 14);
    if (threat) {
      let bestN = n, bsc = -Infinity;
      for (let k = 0; k < 8; k++) { const c = NAV().randomNode(a.pos, 16); const sc = G.hdist(c, threat.pos) - G.hdist(c, a.pos) * 0.3; if (sc > bsc) { bsc = sc; bestN = c; } }
      n = bestN;
    }
    if (n) setPath(a, b, n);
  }
}

function pickFlee(a, b, holders) {
  let best = null, bs = -Infinity;
  let ax = 0, az = 0;
  for (const h of holders) { const dx = a.pos.x - h.pos.x, dz = a.pos.z - h.pos.z, d = Math.hypot(dx, dz) || 1; ax += dx / d / d; az += dz / d / d; }
  const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  for (let k = 0; k < 26; k++) {
    const n = NAV().randomNode(a.pos, 26);
    if (!n) continue;
    let md = Infinity;
    for (const h of holders) md = Math.min(md, Math.hypot(n.x - h.pos.x, n.z - h.pos.z));
    const dx = n.x - a.pos.x, dz = n.z - a.pos.z, dl = Math.hypot(dx, dz) || 1;
    const dot = (dx * ax + dz * az) / dl;
    let s = Math.min(md, 26) - dl * 0.25 + dot * 6 + Math.random() * 2;
    if (dot < -0.2) s -= 10;
    if (s > bs) { bs = s; best = n; }
  }
  b.fleeT = G.rand(1.2, 2.2);
  if (best) setPath(a, b, best);
}

function steer(a, b, dt) {
  const inp = a.input;
  inp.jump = false; inp.sprint = false;
  let dx = 0, dz = 0, want = false;
  if (b.direct === 'away' && b.threat) {
    dx = a.pos.x - b.threat.pos.x; dz = a.pos.z - b.threat.pos.z;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    // if the straight escape is blocked or unsafe, follow the flee path instead
    if (!safeAhead(a, dx, dz, G.world.def.walls === false ? 2.6 : 1.2) || G.raycast(new G.V3(a.pos.x, a.pos.y + 0.6, a.pos.z), new G.V3(dx, 0, dz), 1.5) < 1.2) { b.direct = null; }
    else want = true;
  } else if (b.direct && b.direct.pos) {
    const t = b.direct;
    const lx = t.pos.x + (t.vel ? t.vel.x * 0.18 : 0), lz = t.pos.z + (t.vel ? t.vel.z * 0.18 : 0);
    dx = lx - a.pos.x; dz = lz - a.pos.z;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; want = true;
    if (t.pos.y > a.pos.y + 0.7 && a.grounded) inp.jump = true;
    if (!safeAhead(a, dx, dz)) { want = false; b.direct = null; }
  }
  if (!want && b.path && b.pi < b.path.length) {
    let n = b.path[b.pi];
    let ddx = n.x - a.pos.x, ddz = n.z - a.pos.z;
    const close = Math.hypot(ddx, ddz) < 0.45 && Math.abs(n.y - a.pos.y) < 1.4;
    if (close) {
      b.pi++;
      if (b.pi < b.path.length) { n = b.path[b.pi]; ddx = n.x - a.pos.x; ddz = n.z - a.pos.z; }
    }
    if (b.pi < b.path.length) {
      const prev = b.path[b.pi - 1];
      let l = Math.hypot(ddx, ddz);
      // dropping down a ledge: keep walking past the node so we actually fall off the edge
      if (n.y < a.pos.y - 1 && l < 0.7 && prev) { ddx = n.x - prev.x; ddz = n.z - prev.z; l = Math.hypot(ddx, ddz); }
      l = l || 1; dx = ddx / l; dz = ddz / l; want = true;
      // jump up ledges; on a jump pad or teleporter just stand still and let it work
      if (n.y > a.pos.y + 0.55 && a.grounded && l < 1.7) inp.jump = true;
      if (prev && prev.link === n && G.hdist(prev, n) > 2) { if (a.grounded && a.ground && a.ground.type !== 'pad') { dx = prev.x - a.pos.x; dz = prev.z - a.pos.z; const q = Math.hypot(dx, dz) || 1; dx /= q; dz /= q; } }
    }
  }
  // edge guard on open maps: never walk off a cliff unless the path wants to drop
  if (want && G.world.def.walls === false && a.grounded) {
    const nx = b.path && b.path[b.pi];
    const dropping = nx && nx.y < a.pos.y - 1;
    if (!dropping && !safeAhead(a, dx, dz, 0.9)) {
      const n = NAV().nodeAt(a.pos.x, a.pos.y, a.pos.z);
      if (n) { dx = n.x - a.pos.x; dz = n.z - a.pos.z; const q = Math.hypot(dx, dz) || 1; dx /= q; dz /= q; }
      b.direct = null; b.replan = true;
    }
  }
  if (want) {
    inp.x = dx; inp.z = dz;
    a.aim.set(dx, 0, dz);
    if (b.mode === 'chase') { a.aim.set(b.target ? b.target.pos.x - a.pos.x : dx, 0, b.target ? b.target.pos.z - a.pos.z : dz).normalize(); }
    // bots only sprint in short bursts when it really matters
    const urgent = (b.mode === 'chase' && b.target && G.hdist(a.pos, b.target.pos) < 6) || (b.mode === 'flee' && b.threatD < 5);
    inp.sprint = urgent && (a.stamina > 50 || (a.sprinting && a.stamina > 15));
  } else { inp.x = 0; inp.z = 0; }
  // stuck detection
  b.progT -= dt;
  if (b.progT <= 0) {
    const moved = Math.hypot(a.pos.x - b.lastX, a.pos.z - b.lastZ);
    if (want && moved < 0.5 && a.fx.frozen <= 0 && a.fx.stun <= 0) {
      b.stuckT++;
      if (a.grounded) a.input.jump = true;
      if (b.stuckT >= 2) { b.replan = true; b.path = null; b.wanderT = 0; b.stuckT = 0; b.fleeT = 0; b.noDirectT = 1.5; b.direct = null; }
    } else b.stuckT = 0;
    b.lastX = a.pos.x; b.lastZ = a.pos.z; b.progT = 0.5;
  }
}

function tryAbility(a, b) {
  if (a.cd > 0 || a.fx.frozen > 0 || a.fx.stun > 0) return;
  if (Math.random() > 0.35 + a.skill * 0.5) return;
  const ab = a.ability;
  if (b.mode === 'chase' && b.target) {
    const t = b.target, d = G.hdist(a.pos, t.pos), dy = t.pos.y - a.pos.y;
    const los = d < 16 && G.los(a.pos, t.pos);
    a.aim.set(t.pos.x - a.pos.x, 0, t.pos.z - a.pos.z).normalize();
    if (ab === 'toss' && los && d > 3 && d < 14 && !t.isDecoy) G.useAbility(a);
    else if (ab === 'dash' && los && d > 3 && d < 9 && Math.abs(dy) < 1 && safeLine(a, a.aim.x, a.aim.z, 7.5)) { a.input.x = a.aim.x; a.input.z = a.aim.z; G.useAbility(a); }
    else if (ab === 'blink' && los && d > 4 && d < 10 && Math.abs(dy) < 1 && safeLine(a, a.aim.x, a.aim.z, 9)) { a.input.x = a.aim.x; a.input.z = a.aim.z; G.useAbility(a); }
    else if (ab === 'superjump' && dy > 2.2 && d < 6) G.useAbility(a);
    else if (ab === 'invis' && d < 14 && d > 5) G.useAbility(a);
    else if (ab === 'shockwave' && d < 2.5 && t.fx && t.fx.shield) G.useAbility(a);
    return;
  }
  if (b.mode === 'flee' && b.threat) {
    const d = b.threatD, h = b.threat;
    let ax = a.pos.x - h.pos.x, az = a.pos.z - h.pos.z; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
    if ((ab === 'dash' || ab === 'blink') && d < 4.5) {
      // pick the escape direction: straight away if safe, else follow the path
      let ex = ax, ez = az;
      if (!safeLine(a, ex, ez, 9) || G.raycast(new G.V3(a.pos.x, a.pos.y + 0.8, a.pos.z), new G.V3(ex, 0, ez), 3) < 2.5) {
        if (b.path && b.path[b.pi]) { const n = b.path[Math.min(b.path.length - 1, b.pi + 2)]; ex = n.x - a.pos.x; ez = n.z - a.pos.z; const q = Math.hypot(ex, ez) || 1; ex /= q; ez /= q; } else return;
        if (!safeLine(a, ex, ez, 9)) return;
      }
      a.input.x = ex; a.input.z = ez; a.aim.set(ex, 0, ez);
      G.useAbility(a);
    } else if (ab === 'superjump' && d < 3.2) G.useAbility(a);
    else if (ab === 'shockwave' && d < 3.5) G.useAbility(a);
    else if (ab === 'freeze' && d < 6) G.useAbility(a);
    else if (ab === 'invis' && d < 6) G.useAbility(a);
    else if (ab === 'decoy' && d < 7) { a.input.x = -ax; a.input.z = -az; G.useAbility(a); a.input.x = ax; a.input.z = az; }
  }
}

G.updateBot = (a, dt) => {
  const b = a.bot;
  if (!a.alive) return;
  b.thinkT -= dt; b.noDirectT -= dt;
  if (b.thinkT <= 0 || (b.replan && b.thinkT < b.react * 0.5)) { b.thinkT = b.react; think(a, b); }
  steer(a, b, dt);
  b.abT -= dt;
  if (b.abT <= 0) { b.abT = G.rand(0.25, 0.5); tryAbility(a, b); }
};
})();
