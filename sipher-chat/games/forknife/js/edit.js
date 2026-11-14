// Editing, Fortnite style. Press G while aiming at one of your own builds: the piece turns into a blue
// edit grid (walls 3x3, floors and cones 2x2, ramps 2x2). Hold left mouse and drag across tiles to select;
// releasing confirms the edit (edit on release). Pressing G again also confirms, right mouse resets the piece.
// Ramps are redirected by dragging from the tile that should be the bottom to the one that should be the top.
// You can't edit other players' builds, or through them.
(() => {
'use strict';
const C = G.CELL, H = G.LH;
const E = G.edit = { on: false, piece: null, mask: 0, dir: 0, paint: null, start: -1, hover: -1, tiles: [], group: null, prev: null };
const ray = new THREE.Raycaster();
const KEEP = new THREE.Color(0x5fd0ff), CUT = new THREE.Color(0x061a3a), HOT = new THREE.Color(0xffffff), PATH = new THREE.Color(0xffe83a);
G.EDIT_RANGE = 7;

function clearOverlay() {
  if (E.group) {
    G.scene.remove(E.group);
    E.group.traverse(o => { if (o.isMesh) { if (o.userData.own) o.geometry.dispose(); o.material.dispose(); } });
  }
  E.group = null; E.tiles = [];
}
function tile(geom, idx) {
  const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: KEEP, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.userData = { idx, own: true }; m.renderOrder = 10; E.tiles.push(m); return m;
}
function frame(w, h) { // thin outline around a tile so the grid reads clearly
  const g = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.85, fog: false }));
}
function buildOverlay(p) {
  clearOverlay();
  const g = E.group = new THREE.Group();
  if (p.type === 'wall') {
    const holder = new THREE.Group(); G.placeMesh(holder, p); g.add(holder);
    for (let i = 0; i < 9; i++) {
      const c = i % 3, r = (i / 3) | 0, w = C / 3 * 0.94, h = H / 3 * 0.92, m = tile(new THREE.PlaneGeometry(w, h), i);
      G.tileLocal(p, c, r, m.position); m.add(frame(w, h)); holder.add(m);
    }
  } else if (p.type === 'floor') {
    for (let i = 0; i < 4; i++) {
      const c = i % 2, r = i >> 1, s = C / 2 * 0.94, m = tile(new THREE.PlaneGeometry(s, s), i);
      m.rotation.x = -Math.PI / 2; m.position.set(p.x0 + (c + 0.5) * C / 2, p.y0 + 0.1, p.z0 + (r + 0.5) * C / 2); m.add(frame(s, s)); g.add(m);
    }
  } else if (p.type === 'ramp') {
    // tiles lie on the slope; each one is indexed by the world-grid quadrant it covers
    for (let i = 0; i < 4; i++) {
      const c = i % 2, r = i >> 1, cx = p.x0 + (c + 0.5) * C / 2, cz = p.z0 + (r + 0.5) * C / 2;
      const holder = new THREE.Group(); holder.position.set(cx, G.rampY(p, cx, cz) + 0.12, cz); holder.rotation.y = -p.d * Math.PI / 2;
      const tilt = new THREE.Group(); tilt.rotation.z = G.RAMP_ANG; holder.add(tilt);
      const w = G.RAMP_L / 2 * 0.94, d = C / 2 * 0.94, m = tile(new THREE.PlaneGeometry(w, d), i);
      m.rotation.x = -Math.PI / 2; m.add(frame(w, d)); tilt.add(m); g.add(holder);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const m = tile(G.coneQuadGeo(i % 2, i >> 1), i);
      m.position.set(p.x0 + C / 2, p.y0 + 0.08, p.z0 + C / 2); m.scale.setScalar(1.02); g.add(m);
    }
  }
  G.scene.add(g);
}

// Which of your pieces is under the crosshair? Your own pieces only, and nothing of the enemy's in front.
G.editTarget = a => {
  let best = null, bt = G.EDIT_RANGE;
  for (const p of G.pieces) {
    if (p.owner !== a || !p.alive || G.hdist(p.center, a.pos) > 10) continue;
    const t = G.rayPiece(p, a.aimO, a.aimD, true);
    if (t < bt) { bt = t; best = p; }
  }
  if (!best) return null;
  const wr = G.rayWorld(a.aimO, a.aimD, bt);
  if (wr.hit && wr.hit !== 'ground' && wr.t < bt - 0.05 && wr.hit !== best && !(wr.piece && wr.piece.owner === a)) return null;
  return best;
};
function begin(a, p) {
  E.on = true; E.piece = p; E.mask = p.mask; E.dir = p.d; E.paint = null; E.start = -1; E.hover = -1;
  E.prev = { cur: a.cur, build: a.buildMode };
  a.buildMode = null; a.editing = true; a.reloadT = 0; a.useT = 0; a.burstLeft = 0;
  p.mesh.visible = false; p.editing = true;
  buildOverlay(p); G.audio.editOpen();
}
function finish(a) {
  const p = E.piece;
  if (p) { p.editing = false; if (p.alive) p.mesh.visible = true; }
  clearOverlay();
  E.on = false; E.piece = null; E.paint = null; a.editing = false;
  if (E.prev) { a.cur = E.prev.cur; a.buildMode = E.prev.build; a.swapT = 0.06; E.prev = null; }
}
function confirm(a) {
  const p = E.piece;
  if (p && p.alive) {
    const changed = p.type === 'ramp' ? E.dir !== p.d : E.mask !== p.mask;
    if (changed && G.applyEdit(p, E.mask, E.dir)) { G.audio.editConfirm(p.center); if (a.isPlayer && G.match) G.match.stats.edits++; }
  }
  finish(a);
}
G.editToggle = a => {
  if (E.on) { confirm(a); return; }
  const p = G.editTarget(a);
  if (!p) { G.audio.deny(); return; }
  begin(a, p);
};
G.editReset = a => {
  const p = E.piece;
  if (p && p.alive && (p.mask || p.d !== p.d0)) { G.applyEdit(p, 0, p.d0); G.audio.editReset(p.center); }
  finish(a);
};
G.editCancel = a => { if (E.on) finish(a); };

function rampDir(s, h, cur) {
  const dc = (h % 2) - (s % 2), dr = (h >> 1) - (s >> 1);
  if (!dc && !dr) return cur;
  if (Math.abs(dc) >= Math.abs(dr)) return dc > 0 ? 0 : 2;
  return dr > 0 ? 1 : 3;
}
// per frame while editing; `held` = left mouse is down
G.editUpdate = (a, held) => {
  if (!E.on) return;
  const p = E.piece;
  if (!p || !p.alive || !a.alive || G.hdist(p.center, a.pos) > 9.5 || G.match.phase !== 'play') { finish(a); return; }
  ray.set(a.aimO, a.aimD); ray.far = 12;
  const hit = ray.intersectObjects(E.tiles, false)[0], h = hit ? hit.object.userData.idx : -1;
  if (h !== E.hover && h >= 0 && held) G.audio.editTick();
  E.hover = h;
  if (held) {
    if (p.type === 'ramp') {
      E.paint = 'drag';
      if (E.start < 0 && h >= 0) E.start = h;
      if (E.start >= 0 && h >= 0) E.dir = rampDir(E.start, h, p.d);
    } else if (h >= 0) {
      if (!E.paint) E.paint = (E.mask >> h) & 1 ? 'restore' : 'cut';
      const nm = E.paint === 'cut' ? E.mask | (1 << h) : E.mask & ~(1 << h);
      if (nm !== G.FULL[p.type]) E.mask = nm; // a piece can never be edited away entirely
    }
  } else if (E.paint) { confirm(a); return; } // edit on release
  for (const m of E.tiles) {
    const i = m.userData.idx, mat = m.material;
    if (p.type === 'ramp') {
      const on = E.start >= 0 && (i === E.start || i === h);
      mat.color.copy(on ? PATH : KEEP); mat.opacity = on ? 0.6 : i === h ? 0.6 : 0.42;
    } else {
      const cut = (E.mask >> i) & 1;
      mat.color.copy(cut ? CUT : KEEP); mat.opacity = cut ? 0.1 : 0.55;
      if (i === h) { mat.color.lerp(HOT, 0.35); mat.opacity += 0.2; }
      const fr = m.children[0]; if (fr) fr.material.opacity = cut ? 0.3 : 0.9;
    }
  }
};

// Bot helper: edit one of its own pieces instantly (bots don't drag tiles).
G.botEdit = (b, p, mask) => {
  if (!p || !p.alive || p.owner !== b || p.editing) return false;
  if (!G.applyEdit(p, mask, p.d)) return false;
  G.audio.editConfirm(p.center);
  return true;
};
G.MASKS = { window: 1 << 4, door: (1 << 1) | (1 << 4), arch: 1 | 2 | 4 | (1 << 4), halfwall: (1 << 6) | (1 << 7) | (1 << 8) };
})();
