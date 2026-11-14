// Bot: perception, aim with human-ish error, weapon choice, strafing, cover building, ramp pushes,
// boxing up to heal, breaking through builds, and a flow-field path around static cover.
(() => {
'use strict';
const V3 = THREE.Vector3, C = G.CELL, LH = G.LH;
const _eye = new V3(), _t = new V3(), _d = new V3(), _a = new V3();
let nav = { any: false };

G.buildNav = () => {
  const A = G.arena, w = Math.round(A.x1 - A.x0), h = Math.round(A.z1 - A.z0);
  nav = { w, h, x0: A.x0, z0: A.z0, blocked: new Uint8Array(w * h), dist: new Int16Array(w * h), q: new Int32Array(w * h), any: false };
  if (!G.boxes.length && !G.pieces.some(p => p.static)) return;
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (G.blocked(A.x0 + x + 0.5, A.z0 + z + 0.5, 0, 0.6, 1.8)) { nav.blocked[z * w + x] = 1; nav.any = true; }
};
function flow(tx, tz) {
  const n = nav, w = n.w, h = n.h; n.dist.fill(-1);
  let cx = G.clamp(Math.floor(tx - n.x0), 0, w - 1), cz = G.clamp(Math.floor(tz - n.z0), 0, h - 1);
  if (n.blocked[cz * w + cx]) {
    let found = false;
    for (let r = 1; r < 6 && !found; r++) for (let dz = -r; dz <= r && !found; dz++) for (let dx = -r; dx <= r && !found; dx++) {
      const x = cx + dx, z = cz + dz;
      if (x >= 0 && z >= 0 && x < w && z < h && !n.blocked[z * w + x]) { cx = x; cz = z; found = true; }
    }
    if (!found) return;
  }
  let qh = 0, qt = 0; n.q[qt++] = cz * w + cx; n.dist[cz * w + cx] = 0;
  while (qh < qt) {
    const i = n.q[qh++], x = i % w, z = (i - x) / w, d = n.dist[i] + 1;
    if (x > 0 && !n.blocked[i - 1] && n.dist[i - 1] < 0) { n.dist[i - 1] = d; n.q[qt++] = i - 1; }
    if (x < w - 1 && !n.blocked[i + 1] && n.dist[i + 1] < 0) { n.dist[i + 1] = d; n.q[qt++] = i + 1; }
    if (z > 0 && !n.blocked[i - w] && n.dist[i - w] < 0) { n.dist[i - w] = d; n.q[qt++] = i - w; }
    if (z < h - 1 && !n.blocked[i + w] && n.dist[i + w] < 0) { n.dist[i + w] = d; n.q[qt++] = i + w; }
  }
}
function navDir(b, out) {
  const n = nav, w = n.w, h = n.h;
  const cx = G.clamp(Math.floor(b.pos.x - n.x0), 0, w - 1), cz = G.clamp(Math.floor(b.pos.z - n.z0), 0, h - 1);
  const free = (x, z) => x >= 0 && z >= 0 && x < w && z < h && !n.blocked[z * w + x];
  let best = n.dist[cz * w + cx]; if (best < 0) best = 32000;
  let bx = 0, bz = 0, found = false;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue;
    const x = cx + dx, z = cz + dz;
    if (!free(x, z)) continue;
    if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue;
    const d = n.dist[z * w + x]; if (d < 0) continue;
    const cost = d + (dx && dz ? 0.4 : 0);
    if (cost < best) { best = cost; bx = x; bz = z; found = true; }
  }
  if (!found) return false;
  out.set(n.x0 + bx + 0.5 - b.pos.x, 0, n.z0 + bz + 0.5 - b.pos.z).normalize();
  return true;
}

G.initBotAI = b => {
  b.ai = { t: 0, losT: 0, sees: false, blocker: null, headOnly: false, react: 0, noLos: 0, errT: 0, ex: 0, ey: 0, strafe: 1, strafeT: 0, wpnT: 0,
    stuckT: 0, lx: b.pos.x, lz: b.pos.z, stuck: 0, breakP: null, buildCd: 0, boxT: 0, navT: 0, peek: 1, fireT: 0.6, rampT: 0, peekWall: null, peekT: 0, peekCd: 1, push: false };
};
function boxUp(b, s) {
  const L = Math.floor((b.pos.y + 0.4) / LH), cx = Math.floor(b.pos.x / C), cz = Math.floor(b.pos.z / C), mat = b.matSel;
  for (const sp of [{ type: 'wall', ix: cx, iy: L, iz: cz, d: 0 }, { type: 'wall', ix: cx, iy: L, iz: cz + 1, d: 0 }, { type: 'wall', ix: cx, iy: L, iz: cz, d: 1 },
    { type: 'wall', ix: cx + 1, iy: L, iz: cz, d: 1 }, { type: 'cone', ix: cx, iy: L + 1, iz: cz, d: 0 }]) { sp.mat = mat; G.tryBuild(b, sp); }
  s.boxT = 2.6;
}

G.botThink = (b, dt) => {
  const s = b.ai, m = G.match, e = G.player, D = G.DIFFS[G.save.diff] || G.DIFFS.medium, mode = m.mode, inp = b.input;
  inp.fire = inp.jump = inp.ads = inp.sprint = false; b.move.x = b.move.z = 0;
  if (!b.alive) return;
  s.t += dt;
  _eye.set(b.pos.x, G.eyeY(b), b.pos.z);
  if (m.phase !== 'play' || !e.alive) { b.pitch = G.turnTo(b.pitch, 0, 3 * dt); b.aimO.copy(_eye); G.dirFrom(b.yaw, b.pitch, b.aimD); b.hurtFlag = false; return; }
  const ex = e.pos.x - b.pos.x, ez = e.pos.z - b.pos.z, hd = Math.hypot(ex, ez) || 0.001, dy = e.pos.y - b.pos.y;
  const fx = ex / hd, fz = ez / hd, yawE = Math.atan2(-fx, -fz), eh = e.crouch || e.slideT > 0 ? 0.7 : 1;

  // --- perception
  s.losT -= dt;
  if (s.losT <= 0) {
    s.losT = 0.09;
    _t.set(e.pos.x, e.pos.y + 1.1 * eh, e.pos.z);
    let blk = G.lineBlock(_eye, _t), head = false;
    if (blk) { _t.y = e.pos.y + 1.7 * eh; if (!G.lineBlock(_eye, _t)) { blk = null; head = true; } }
    if (!blk && !s.sees) { s.react = D.react * G.rand(0.7, 1.3); s.seeT = 0; }
    s.sees = !blk; s.blocker = blk; s.headOnly = head;
    if (s.sees) { s.noLos = 0; s.breakP = null; }
  }
  if (!s.sees) s.noLos += dt; else s.seeT = (s.seeT || 0) + dt;
  s.react -= dt;
  if (s.breakP && !s.breakP.alive) s.breakP = null;
  const ownCover = s.blocker && s.blocker.owner === b && s.noLos < 2.2;
  if (!s.sees && !s.breakP && s.noLos > 0.5 && s.blocker && s.blocker.type && !s.blocker.static && s.blocker.alive && hd < 32 && !ownCover) s.breakP = s.blocker;

  // --- aim
  if (s.breakP) _t.copy(s.breakP.center);
  else {
    _t.set(e.pos.x, e.pos.y + (s.headOnly ? 1.65 : 1.05) * eh, e.pos.z);
    // aim error: worse against a moving / jumping / sliding target, while the bot itself moves,
    // and for the first moments after it spots you
    const espd = Math.hypot(e.vel.x, e.vel.z), bspd = Math.hypot(b.vel.x, b.vel.z);
    const mul = (1 + espd / 6 + (e.grounded ? 0 : 0.7) + (e.slideT > 0 ? 0.5 : 0)) * (1 + bspd / 14 + (b.grounded ? 0 : 0.5)) * (1 + Math.max(0, 0.7 - s.seeT) * 1.5);
    s.errT -= dt; if (s.errT <= 0) { s.errT = G.rand(0.15, 0.4); s.tx = G.rand(-1, 1) * D.err * mul; s.ty = G.rand(-1, 1) * D.err * 0.6 * mul; }
    s.ex = G.lerp(s.ex, s.tx || 0, Math.min(1, dt * 6)); s.ey = G.lerp(s.ey, s.ty || 0, Math.min(1, dt * 6)); // drift, not snap
  }
  const tx = _t.x - _eye.x, ty = _t.y - _eye.y, tz = _t.z - _eye.z, th = Math.hypot(tx, tz) || 0.001;
  let wantYaw = Math.atan2(-tx, -tz), wantPitch = Math.atan2(ty, th);
  if (!s.breakP) { wantYaw += s.ex; wantPitch += s.ey; }
  if (s.sees || s.breakP) { b.yaw = G.turnTo(b.yaw, wantYaw, D.turn * dt); b.pitch = G.turnTo(b.pitch, wantPitch, D.turn * dt); }
  else { b.yaw = G.turnTo(b.yaw, yawE, D.turn * dt); b.pitch = G.turnTo(b.pitch, 0, 3 * dt); }
  b.aimO.copy(_eye); G.dirFrom(b.yaw, b.pitch, b.aimD);
  const aligned = Math.abs(G.angleWrap(wantYaw - b.yaw)) < 0.08 + (hd < 6 ? 0.14 : 0) && Math.abs(wantPitch - b.pitch) < 0.14;

  // --- healing and weapon choice
  const healIdx = b.slots.indexOf('shield');
  const wantHeal = healIdx >= 0 && b.ammo[healIdx] > 0 && b.shield <= 50 && ((!s.sees && s.noLos > 0.8) || s.boxT > 0);
  s.wpnT -= dt;
  if (wantHeal) { if (b.cur !== healIdx || b.buildMode) G.selectSlot(b, healIdx); s.wpnT = 0.3; }
  else if (s.wpnT <= 0 && b.burstLeft <= 0) {
    s.wpnT = G.rand(0.5, 0.9);
    let best = -1, bs = -1e9;
    b.slots.forEach((id, i) => {
      const w = G.WEAPONS[id]; if (w.kind === 'heal') return;
      let sc = -Math.abs(hd - w.ideal);
      if (w.kind === 'rocket') sc -= hd < 8 ? 50 : 3;
      if (b.ammo[i] <= 0) sc -= 10;
      if (s.breakP) sc += Math.min(12, (w.bdmg || w.dmg) * (w.pellets || 1) * w.rate / 30);
      if (i === b.cur) sc += 2;
      if (sc > bs) { bs = sc; best = i; }
    });
    if (best !== b.cur) G.selectSlot(b, best);
  }
  const w = G.weaponOf(b), ideal = w && w.ideal ? w.ideal : 2;

  // --- edits: window-peek out of its own wall, door-push through it with a shotgun, reset when done
  s.peekCd -= dt;
  if (s.peekWall) {
    s.peekT -= dt;
    if (!s.peekWall.alive || s.peekT <= 0 || (b.hurtFlag && !s.push && G.chance(0.5))) {
      if (s.peekWall.alive && s.peekWall.mask && !s.push) { G.applyEdit(s.peekWall, 0); G.audio.editReset(s.peekWall.center); }
      s.peekWall = null; s.push = false; s.peekCd = G.rand(1.2, 2.8);
    }
  } else if (mode.build && ownCover && s.blocker.type === 'wall' && !s.blocker.mask && !s.blocker.editing && s.peekCd <= 0 && D.build >= 0.4
    && G.hdist(s.blocker.center, b.pos) < 3 && w && !wantHeal && G.chance(dt * 4)) {
    const push = hd < 9 && !!w.pellets && b.hp + b.shield > 80;
    if (G.botEdit(b, s.blocker, push ? G.MASKS.door : G.MASKS.window)) {
      s.peekWall = s.blocker; s.push = push; s.peekT = push ? 1.2 : G.rand(1.0, 1.9); s.losT = 0;
    }
  }

  // --- movement
  let mx = 0, mz = 0;
  const st = G.storm;
  s.strafeT -= dt;
  if (s.strafeT <= 0) { s.strafeT = G.rand(0.35, 1.1); s.strafe = G.chance(1 - D.strafe) ? 0 : G.chance(0.5) ? 1 : -1; }
  if (nav.any) { s.navT -= dt; if (s.navT <= 0) { s.navT = 0.35; flow(e.pos.x, e.pos.z); } }
  const sd = Math.hypot(b.pos.x - st.x, b.pos.z - st.z);
  if (s.boxT > 0) s.boxT -= dt;
  if (st.active && sd > st.r - 4 && sd > 0.5) { mx = (st.x - b.pos.x) / sd; mz = (st.z - b.pos.z) / sd; inp.sprint = true; }
  else if (s.peekWall && s.push) { mx = fx; mz = fz; inp.sprint = true; }
  else if (s.peekWall || s.boxT > 0 || wantHeal) { /* hold still behind the window / inside the box */ }
  else if (s.sees) {
    const far = hd - ideal, f = far > 2 ? 1 : far < -3 ? -0.8 : 0;
    mx = fx * f - fz * s.strafe; mz = fz * f + fx * s.strafe;
    if (hd < 14 && b.grounded && G.chance(D.jump * dt * 1.2)) inp.jump = true;
  } else if (s.breakP) { if (hd > 12) { mx = fx * 0.7; mz = fz * 0.7; } }
  else if (ownCover) { mx = -fz * s.peek; mz = fx * s.peek; }
  else { if (nav.any && navDir(b, _a)) { mx = _a.x; mz = _a.z; } else { mx = fx; mz = fz; } inp.sprint = true; }

  // --- building
  if (mode.build) {
    s.buildCd -= dt;
    b.matSel = b.mats.wood >= G.COST ? 'wood' : b.mats.brick >= G.COST ? 'brick' : 'metal';
    const mats = b.mats.wood + b.mats.brick + b.mats.metal;
    if (b.hurtFlag && s.buildCd <= 0 && mats >= G.COST && G.chance(D.build)) {
      const sp = G.buildTarget(b, 'wall', yawE, 0); if (sp.valid) G.tryBuild(b, sp);
      s.buildCd = G.rand(0.4, 1.0);
      if (b.hp + b.shield < 90 && mats >= 60 && s.boxT <= 0 && G.chance(D.build * 0.6)) boxUp(b, s);
    }
    if (D.build >= 0.4 && dy > 2.4 && hd > 2.5 && hd < 38 && mats >= G.COST && s.boxT <= 0 && !wantHeal) {
      s.rampT -= dt;
      if (s.rampT <= 0) { s.rampT = 0.12; const sp = G.buildTarget(b, 'ramp', yawE, 0); if (sp.valid) G.tryBuild(b, sp); }
      // run up along the ramp axis, drifting to the middle of the cell
      if (Math.abs(fx) > Math.abs(fz)) { mx = Math.sign(fx); mz = G.clamp(((Math.floor(b.pos.z / C) + 0.5) * C - b.pos.z) * 0.6, -0.5, 0.5); }
      else { mz = Math.sign(fz); mx = G.clamp(((Math.floor(b.pos.x / C) + 0.5) * C - b.pos.x) * 0.6, -0.5, 0.5); }
    }
  }
  b.hurtFlag = false;

  // --- unstick
  s.stuckT += dt;
  if (s.stuckT > 0.5) {
    const moved = Math.hypot(b.pos.x - s.lx, b.pos.z - s.lz);
    if (Math.hypot(mx, mz) > 0.3 && moved < 0.5) {
      s.stuck++; if (b.grounded) inp.jump = true;
      s.peek = -s.peek; s.strafe = -s.strafe;
      if (s.stuck >= 2) {
        _d.set(mx, 0, mz).normalize(); _a.set(b.pos.x, b.pos.y + 1, b.pos.z);
        const r = G.rayWorld(_a, _d, 2.6);
        if (r.piece && !r.piece.static) {
          if (mode.build && b.mats[b.matSel] >= G.COST && G.chance(0.5)) { const sp = G.buildTarget(b, 'ramp', Math.atan2(-mx, -mz), 0); if (sp.valid) G.tryBuild(b, sp); }
          else s.breakP = r.piece;
        }
      }
    } else s.stuck = 0;
    s.lx = b.pos.x; s.lz = b.pos.z; s.stuckT = 0;
  }

  // --- trigger
  if (wantHeal) inp.fire = b.cur === healIdx;
  else if (s.breakP) inp.fire = aligned;
  else if (s.sees && s.react <= 0 && aligned) {
    if (!w) inp.fire = hd < 3.4;
    else { s.fireT -= dt; if (s.fireT < -(1 - D.duty) * 1.2) s.fireT = G.rand(0.5, 1.3); inp.fire = s.fireT > 0; }
  }
  if (w && w.scope) inp.ads = true;
  b.move.x = mx; b.move.z = mz;
};
})();
