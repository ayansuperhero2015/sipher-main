'use strict';
// Split Door X — shared namespace, math helpers, input, settings and save data.
const G = window.G = {
  t: 0, dt: 0, frame: 0, state: 'boot', timeScale: 1, noAutoPause: false,
  actors: [], player: null, uTime: { value: 0 },
};

G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
G.rand = (a, b) => a + Math.random() * (b - a);
G.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
G.pick = arr => arr[Math.floor(Math.random() * arr.length)];
G.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
G.wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
G.v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
G.col = c => new THREE.Color(c);
G.hex = c => '#' + new THREE.Color(c).getHexString();
G.fwdFrom = (yaw, pitch, out) => (out || new THREE.Vector3()).set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
G.yawOf = v => Math.atan2(-v.x, -v.z);
G.now = () => G.t;
G.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// random direction inside a cone around dir (angle in radians)
G.cone = (dir, ang, out) => {
  out = out || new THREE.Vector3();
  if (ang <= 0) return out.copy(dir);
  const up = Math.abs(dir.y) > 0.95 ? G._cx : G._cy;
  const r = G._cr.crossVectors(dir, up).normalize();
  const u = G._cu.crossVectors(r, dir).normalize();
  const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * Math.tan(ang);
  return out.copy(dir).addScaledVector(r, Math.cos(a) * d).addScaledVector(u, Math.sin(a) * d).normalize();
};
G._cx = new THREE.Vector3(1, 0, 0); G._cy = new THREE.Vector3(0, 1, 0); G._cr = new THREE.Vector3(); G._cu = new THREE.Vector3();

// ---------------------------------------------------------------- settings + save
G.settings = { sens: 1, fov: 100, vol: 0.8, music: 0.35, quality: 'high', announcer: true, invertY: false, hitNumbers: true };
G.save = {
  level: 1, xp: 0, kills: 0, deaths: 0, wins: 0, matches: 0, headshots: 0, doorKills: 0, medalsTotal: 0,
  medals: {}, suit: 0, accent: 0, primary: 'ar', secondary: 'sidearm', challenges: {}, bestStreak: 0,
  lastMode: 'tdm', lastMap: 'hinge', difficulty: 1, mutators: {},
};
G.load = () => {
  try {
    const s = JSON.parse(localStorage.getItem('sdx_settings') || 'null'); if (s) Object.assign(G.settings, s);
    const v = JSON.parse(localStorage.getItem('sdx_save') || 'null'); if (v) Object.assign(G.save, v);
  } catch (e) { /* storage blocked */ }
};
G.store = () => {
  try {
    localStorage.setItem('sdx_settings', JSON.stringify(G.settings));
    localStorage.setItem('sdx_save', JSON.stringify(G.save));
  } catch (e) { /* storage blocked */ }
};

// ---------------------------------------------------------------- input
G.BIND = {
  fwd: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['KeyC'], reload: ['KeyR'],
  portalA: ['KeyQ', 'M1'], portalB: ['KeyE'], closePortals: ['KeyF'], grenade: ['KeyG'], jammer: ['KeyX'], melee: ['KeyV'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], score: ['Tab'], fire: ['M0'], ads: ['M2'],
};
G.input = { keys: {}, pressed: {}, mdx: 0, mdy: 0, wheel: 0, locked: false };
G.down = act => { const b = G.BIND[act]; for (let i = 0; i < b.length; i++) if (G.input.keys[b[i]]) return true; return false; };
G.hit = act => { const b = G.BIND[act]; for (let i = 0; i < b.length; i++) if (G.input.pressed[b[i]]) return true; return false; };
G.endInputFrame = () => { G.input.pressed = {}; G.input.mdx = 0; G.input.mdy = 0; G.input.wheel = 0; };

G.initInput = canvas => {
  const I = G.input;
  addEventListener('keydown', e => {
    if (e.code === 'Tab' || (e.code === 'Space' && G.state === 'playing')) e.preventDefault();
    if (!I.keys[e.code]) I.pressed[e.code] = true;
    I.keys[e.code] = true;
    if (e.code === 'Escape' || e.code === 'KeyP') G.onPauseKey && G.onPauseKey(e.code);
  });
  addEventListener('keyup', e => { I.keys[e.code] = false; });
  addEventListener('blur', () => { I.keys = {}; });
  addEventListener('mousedown', e => {
    if (G.state === 'playing' && !I.locked && e.target === canvas) { G.lock(); return; }
    const c = 'M' + e.button; if (!I.keys[c]) I.pressed[c] = true; I.keys[c] = true;
  });
  addEventListener('mouseup', e => { I.keys['M' + e.button] = false; });
  addEventListener('contextmenu', e => { if (G.state === 'playing') e.preventDefault(); });
  addEventListener('mousemove', e => { if (I.locked) { I.mdx += e.movementX; I.mdy += e.movementY; } });
  addEventListener('wheel', e => { if (I.locked) I.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    I.locked = document.pointerLockElement === canvas;
    if (!I.locked) { I.keys = {}; if (G.state === 'playing' && !G.noAutoPause) G.setPaused && G.setPaused(true); }
  });
  G.lock = () => { try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (e2) { /* no lock */ } }); } catch (e) { /* no lock */ } };
  G.unlock = () => { if (document.pointerLockElement) document.exitPointerLock(); };
};
