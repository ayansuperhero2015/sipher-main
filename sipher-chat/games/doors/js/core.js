// Core: globals, math helpers, save data, renderer, input, collision.
(() => {
'use strict';
const G = window.G = {};
const V3 = THREE.Vector3;
G.V3 = V3;

// All gameplay randomness goes through G.random, so party mode can seed it
// (js/party.js) without touching Math.random, which Three.js also uses.
G.random = Math.random;

G.rand = (a, b) => a + G.random() * (b - a);
G.randi = (a, b) => Math.floor(a + G.random() * (b - a + 1));
G.pick = a => a[Math.floor(G.random() * a.length)];
G.chance = p => G.random() < p;
G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
G.lerp = (a, b, t) => a + (b - a) * t;
G.pad = (n, l = 4) => (n < 0 ? '-' : '') + String(Math.abs(n)).padStart(l, '0');
G.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(G.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
G.weighted = obj => {
  let tot = 0; for (const k in obj) tot += obj[k];
  let r = G.random() * tot;
  for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
  return Object.keys(obj)[0];
};
G.distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
G.fmtTime = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- save data ---------- */
const DEF = { knobs: 0, best: {}, runs: 0, wins: {}, shop: {}, settings: { sens: 1, vol: 0.8, fov: 75, quality: 1 } };
G.save = JSON.parse(JSON.stringify(DEF));
try {
  const s = JSON.parse(localStorage.getItem('doors_web_save') || 'null');
  if (s) { Object.assign(G.save, s); G.save.settings = Object.assign({}, DEF.settings, s.settings || {}); }
} catch (e) { /* storage blocked */ }
G.persist = () => { try { localStorage.setItem('doors_web_save', JSON.stringify(G.save)); } catch (e) { /* ignore */ } };

/* ---------- renderer ---------- */
G.initRenderer = () => {
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5) * G.save.settings.quality);
  r.setSize(innerWidth, innerHeight);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.2;
  r.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('game').appendChild(r.domElement);
  G.renderer = r;

  const s = G.scene = new THREE.Scene();
  s.background = new THREE.Color(0x000000);
  s.fog = new THREE.FogExp2(0x000000, 0.05);
  const c = G.camera = new THREE.PerspectiveCamera(G.save.settings.fov, innerWidth / innerHeight, 0.05, 260);
  c.rotation.order = 'YXZ';
  s.add(c);

  G.hemi = new THREE.HemisphereLight(0x9aa6b8, 0x2a2018, 0.35);
  s.add(G.hemi);
  G.moon = new THREE.DirectionalLight(0x9db4ff, 0);
  G.moon.position.set(-30, 60, 20);
  s.add(G.moon);
  // Fixed pool of point lights, re-assigned to the nearest lamps every frame (no shader recompiles).
  G.lightPool = [];
  for (let i = 0; i < 8; i++) { const l = new THREE.PointLight(0xffd0a0, 0, 11, 2); s.add(l); G.lightPool.push(l); }
  G.flash = new THREE.SpotLight(0xfff1d6, 0, 34, 0.42, 0.55, 1.3);
  G.flash.position.set(0.25, -0.25, 0.1);
  c.add(G.flash);
  G.flash.target.position.set(0, -0.35, -5);
  c.add(G.flash.target);
  G.handLight = new THREE.PointLight(0xff9c45, 0, 9, 1.6);
  G.handLight.position.set(0.3, -0.25, -0.5);
  c.add(G.handLight);

  addEventListener('resize', () => {
    c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight);
  });
};
G.applySettings = () => {
  const st = G.save.settings;
  if (G.camera) { G.camera.fov = st.fov; G.camera.updateProjectionMatrix(); }
  if (G.renderer) { G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5) * st.quality); G.renderer.setSize(innerWidth, innerHeight); }
  G.audio.setVol(st.vol);
};

/* ---------- input ---------- */
G.keys = {};
G.mouse = { dx: 0, dy: 0, down: {} };
G.locked = false;
addEventListener('keydown', e => {
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  const fresh = !G.keys[e.code];
  G.keys[e.code] = true;
  if (fresh && G.onKey) G.onKey(e);
});
addEventListener('keyup', e => { G.keys[e.code] = false; });
addEventListener('mousemove', e => { if (G.locked) { G.mouse.dx += e.movementX; G.mouse.dy += e.movementY; } });
addEventListener('mousedown', e => { G.mouse.down[e.button] = true; if (G.onMouse) G.onMouse(e); });
addEventListener('mouseup', e => { G.mouse.down[e.button] = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { G.keys = {}; });
document.addEventListener('pointerlockchange', () => {
  G.locked = document.pointerLockElement === (G.renderer && G.renderer.domElement);
  if (G.onLockChange) G.onLockChange(G.locked);
});
G.requestLock = () => {
  try { const p = G.renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* cooldown */ }
};
G.releaseLock = () => { if (document.pointerLockElement) document.exitPointerLock(); };

/* ---------- geometry helpers ---------- */
// World-space AABB of a local box (center + size) inside obj.
G.aabb = (obj, cx, cy, cz, w, h, d) => {
  obj.updateMatrixWorld(true);
  const v = new V3();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < 8; i++) {
    v.set(cx + (i & 1 ? w : -w) / 2, cy + (i & 2 ? h : -h) / 2, cz + (i & 4 ? d : -d) / 2);
    obj.localToWorld(v);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
  }
  return { x0, x1, y0, y1, z0, z1, on: true };
};
// Room-local (x,z) to world for a room at origin facing dir (0..3, quarter turns).
G.l2wXZ = (o, dir, x, z) => {
  const t = dir * Math.PI / 2, c = Math.cos(t), s = Math.sin(t);
  return { x: o.x + x * c + z * s, z: o.z - x * s + z * c };
};
G.footprint = (o, dir, x0, x1, z0, z1) => {
  const pts = [G.l2wXZ(o, dir, x0, z0), G.l2wXZ(o, dir, x1, z0), G.l2wXZ(o, dir, x0, z1), G.l2wXZ(o, dir, x1, z1)];
  return {
    x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)),
    z0: Math.min(...pts.map(p => p.z)), z1: Math.max(...pts.map(p => p.z)),
  };
};
G.overlap = (a, b, m = 0.05) => a.x0 < b.x1 - m && a.x1 > b.x0 + m && a.z0 < b.z1 - m && a.z1 > b.z0 + m;
G.inBounds = (b, p, m = 0) => p.x > b.x0 - m && p.x < b.x1 + m && p.z > b.z0 - m && p.z < b.z1 + m;

// Push a circle out of all AABB colliders between the feet (p.y) and the given absolute head height.
G.collideCircle = (p, r, cols, head) => {
  for (const c of cols) {
    if (!c.on || c.y0 > head || c.y1 < p.y + 0.3) continue;
    const cx = G.clamp(p.x, c.x0, c.x1), cz = G.clamp(p.z, c.z0, c.z1);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x += dx / d * (r - d); p.z += dz / d * (r - d);
    } else {
      const l = p.x - c.x0, rr = c.x1 - p.x, b = p.z - c.z0, t = c.z1 - p.z, m = Math.min(l, rr, b, t);
      if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === b) p.z = c.z0 - r; else p.z = c.z1 + r;
    }
  }
};
// Line of sight at eye height (2D slab test against wall-height colliders).
G.los = (a, b, cols) => {
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const c of cols) {
    if (!c.on || c.y0 > a.y - 0.2 || c.y1 < a.y - 0.3) continue;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (a.x < c.x0 || a.x > c.x1) continue; }
    else {
      let ta = (c.x0 - a.x) / dx, tb = (c.x1 - a.x) / dx;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-9) { if (a.z < c.z0 || a.z > c.z1) continue; }
    else {
      let ta = (c.z0 - a.z) / dz, tb = (c.z1 - a.z) / dz;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    if (t1 > 0.02 && t0 < 0.98) return false;
  }
  return true;
};
// UVs from local vertex positions so textures stay world-scaled and continuous across wall pieces.
G.worldUV = (g, s) => {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    let u, v;
    if (ax > 0.5) { u = p.getZ(i); v = p.getY(i); }
    else if (ay > 0.5) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / s, v / s);
  }
  uv.needsUpdate = true;
};
G.yawFromDir = (dx, dz) => Math.atan2(-dx, -dz);
G.camForward = (out = new V3()) => G.camera.getWorldDirection(out);
G.lookingAt = (pos, minDot) => {
  const f = G.camForward(new V3());
  const d = pos.clone().sub(G.camera.position).normalize();
  return f.dot(d) > minDot;
};

/* ---------- player ---------- */
G.player = {
  pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, eye: 1.6, r: 0.3, hp: 100,
  crouch: false, hiding: null, speedMul: 1, vitT: 0, shake: 0, rooted: 0, bob: 0, stepD: 0, moved: 0,
};
})();
