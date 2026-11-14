// World: renderer, sky and lights, the arena floor and barrier, static map props and the storm wall.
(() => {
'use strict';
const C = G.CELL;
G.boxes = []; // static axis-aligned props: { min, max, mesh }
let statics, sky, sun, hemi, stormMesh, outer, theme;

G.initWorld = () => {
  const r = G.renderer = new THREE.WebGLRenderer({ antialias: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game').appendChild(r.domElement);
  const scene = G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1200);
  scene.add(G.camera);
  hemi = new THREE.HemisphereLight(0xffffff, 0x4c5a3c, 1.1); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  sky = new THREE.Mesh(new THREE.SphereGeometry(900, 16, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(sky);
  outer = new THREE.Mesh(new THREE.CircleGeometry(900, 40), new THREE.MeshLambertMaterial({ color: 0x4a8f38 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.06; outer.receiveShadow = true; scene.add(outer);
  statics = new THREE.Group(); scene.add(statics);
  buildScenery(scene);
  stormMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 90, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: G.tex.storm, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  G.tex.storm.repeat.set(24, 1); stormMesh.position.y = 40; stormMesh.visible = false; stormMesh.renderOrder = 5; scene.add(stormMesh);
  addEventListener('resize', () => { r.setSize(innerWidth, innerHeight); G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix(); });
  G.setTheme(G.save.theme);
};

// Scenery past the barrier: pines, birches, rocks, hills and drifting clouds, so the arena sits in a place.
let clouds;
function buildScenery(scene) {
  const rnd = G.mulberry(7), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const flat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const spots = [];
  for (let i = 0; i < 420; i++) {
    const a = rnd() * Math.PI * 2, r = 64 + Math.pow(rnd(), 0.7) * 230;
    spots.push([Math.cos(a) * r, Math.sin(a) * r, rnd()]);
  }
  const inst = (geo, mat, list, fn) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length); im.castShadow = false; im.receiveShadow = true;
    list.forEach((sp, i) => { fn(sp, p, s); q.setFromAxisAngle(up, sp[2] * 6.28); m4.compose(p, q, s); im.setMatrixAt(i, m4); });
    scene.add(im); return im;
  };
  const pines = spots.filter(x => x[2] < 0.62), birch = spots.filter(x => x[2] >= 0.62 && x[2] < 0.86), rocks = spots.filter(x => x[2] >= 0.86);
  const cone = new THREE.ConeGeometry(1, 1, 7); cone.translate(0, 0.5, 0);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 6); cyl.translate(0, 0.5, 0);
  const ball = new THREE.IcosahedronGeometry(1, 0);
  inst(cyl, flat(0x6b4a2b), pines, (sp, p, s) => { const k = 0.8 + sp[2]; p.set(sp[0], 0, sp[1]); s.set(0.35 * k, 2.2 * k, 0.35 * k); });
  inst(cone, flat(0x2f6b3a), pines, (sp, p, s) => { const k = 0.8 + sp[2]; p.set(sp[0], 1.6 * k, sp[1]); s.set(2.4 * k, 5.2 * k, 2.4 * k); });
  inst(cone, flat(0x3c7f45), pines, (sp, p, s) => { const k = 0.8 + sp[2]; p.set(sp[0], 4.2 * k, sp[1]); s.set(1.7 * k, 3.6 * k, 1.7 * k); });
  inst(cyl, flat(0xe8e2d6), birch, (sp, p, s) => { const k = 0.9 + sp[2] * 0.6; p.set(sp[0], 0, sp[1]); s.set(0.25 * k, 3.4 * k, 0.25 * k); });
  inst(ball, flat(0x8fbf4a), birch, (sp, p, s) => { const k = 0.9 + sp[2] * 0.6; p.set(sp[0], 4.4 * k, sp[1]); s.set(2.3 * k, 2.0 * k, 2.3 * k); });
  inst(ball, flat(0x8a8f96), rocks, (sp, p, s) => { const k = 0.6 + (sp[2] - 0.86) * 12; p.set(sp[0], 0.2, sp[1]); s.set(1.6 * k, 1.0 * k, 1.3 * k); });
  // hills on the horizon
  const hill = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const hills = []; for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + rnd() * 0.2; hills.push([Math.cos(a) * (330 + rnd() * 120), Math.sin(a) * (330 + rnd() * 120), rnd()]); }
  inst(hill, flat(0x4f8a3e), hills, (sp, p, s) => { p.set(sp[0], -4, sp[1]); s.set(70 + sp[2] * 60, 26 + sp[2] * 40, 70 + sp[2] * 60); });
  // clouds: puffy clusters of soft spheres with flat bottoms
  clouds = new THREE.Group();
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8a96aa, fog: false });
  const cb = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group(), a = rnd() * 6.28, r = 160 + rnd() * 300;
    g.position.set(Math.cos(a) * r, 95 + rnd() * 55, Math.sin(a) * r);
    const n = 5 + Math.floor(rnd() * 5), len = 30 + rnd() * 30;
    for (let j = 0; j < n; j++) {
      const b = new THREE.Mesh(cb, cm), u = j / (n - 1) - 0.5, s = (1 - Math.abs(u) * 1.2) * (9 + rnd() * 6);
      b.scale.set(s * 1.3, s * 0.8, s); b.position.set(u * len, s * 0.25 + rnd() * 2, (rnd() - 0.5) * 10); g.add(b);
    }
    g.scale.y = 0.85; g.rotation.y = rnd() * 6.28; clouds.add(g);
  }
  scene.add(clouds);
}
G.sceneryUpdate = dt => { if (clouds) clouds.rotation.y += dt * 0.004; };
// the barrier only shows up when you get close to it, like a real force field
G.barriers = [];
G.barrierUpdate = pos => {
  const A = G.arena; if (!A) return;
  for (const b of G.barriers) {
    const d = b.axis === 'z' ? Math.abs(pos.z - b.at) : Math.abs(pos.x - b.at);
    b.mesh.material.opacity = 0.03 + 0.5 * G.clamp(1 - d / 9, 0, 1);
  }
};

G.setTheme = id => {
  theme = G.THEMES[id] || G.THEMES.day;
  if (sky.material.map) sky.material.map.dispose();
  sky.material.map = G.skyTex(theme.top, theme.bot); sky.material.needsUpdate = true;
  G.scene.fog = new THREE.Fog(theme.fog, 90, 520);
  sun.color.set(theme.sun); sun.intensity = theme.sunI; hemi.intensity = theme.hemi;
  outer.material.color.set(theme.ground).multiplyScalar(0.8);
  if (G.arenaFloor) G.arenaFloor.material.color.set(theme.ground);
};
G.sunFocus = p => { sun.position.set(p.x + 34, 70, p.z + 22); sun.target.position.set(p.x, 0, p.z); };

G.setStorm = (x, z, r, on) => {
  stormMesh.visible = on; if (!on) return;
  stormMesh.position.x = x; stormMesh.position.z = z; stormMesh.scale.set(Math.max(r, 0.01), 1, Math.max(r, 0.01));
  G.tex.storm.offset.x += 0.0006; G.tex.storm.offset.y -= 0.004;
};

function addBox(x, z, w, h, d, tex, color, y0 = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: G.tex[tex], color }));
  m.position.set(x, y0 + h / 2, z); m.castShadow = m.receiveShadow = true; statics.add(m);
  G.boxes.push({ min: new G.V3(x - w / 2, y0, z - d / 2), max: new G.V3(x + w / 2, y0 + h, z + d / 2), mesh: m });
}
const both = (x, z, w, h, d, tex, color, y0) => { addBox(x, z, w, h, d, tex, color, y0); addBox(-x, -z, w, h, d, tex, color, y0); };
function staticPieces(list) {
  for (const s of list) {
    const spec = { type: s[0], ix: s[1], iy: s[2], iz: s[3], d: s[4] || 0, mat: 'steel' };
    G.addPiece(spec, null, { static: true }); G.addPiece(G.mirrorSpec(spec), null, { static: true });
  }
}
// Pre-built destructible structures, rebuilt at the start of every round.
const PREBUILT = {
  box: [['wall', -3, 0, 0, 0, 'brick'], ['wall', -3, 0, 1, 0, 'brick'], ['wall', -3, 0, 0, 1, 'brick'], ['wall', -2, 0, 0, 1, 'brick'], ['floor', -3, 1, 0, 0, 'brick'],
    ['wall', 0, 0, -1, 1, 'wood']],
  zone: [['wall', -5, 0, -3, 0, 'wood'], ['wall', -5, 0, -2, 0, 'wood'], ['wall', -5, 0, -3, 1, 'wood'], ['floor', -5, 1, -3, 0, 'wood'],
    ['wall', -2, 0, 4, 0, 'brick'], ['wall', -1, 0, 4, 0, 'brick'], ['ramp', -9, 0, 5, 0, 'wood'], ['wall', -8, 0, 5, 1, 'wood'],
    ['wall', 0, 0, -1, 1, 'metal'], ['floor', -1, 1, -1, 0, 'wood'], ['floor', -1, 1, 0, 0, 'wood'], ['wall', -1, 0, -1, 0, 'brick'], ['wall', -1, 0, -1, 1, 'brick'],
    ['ramp', -2, 0, 0, 0, 'wood'], ['wall', -7, 0, 8, 0, 'brick'], ['wall', -7, 0, 8, 1, 'brick'], ['ramp', 4, 0, 7, 3, 'wood']]
};
G.placePrebuilt = modeId => {
  const list = PREBUILT[G.MODES[modeId].map]; if (!list) return;
  for (const s of list) {
    const spec = { type: s[0], ix: s[1], iy: s[2], iz: s[3], d: s[4] || 0, mat: s[5] };
    G.addPiece(spec, null, { quiet: true }); G.addPiece(G.mirrorSpec(spec), null, { quiet: true });
  }
};

function buildDepot() {
  staticPieces([
    ['floor', -1, 1, -1], ['floor', -1, 1, 0], ['ramp', -2, 0, 0, 0], ['wall', -1, 0, -1, 0], ['wall', -1, 0, -1, 1],
    ['wall', -6, 0, 0, 1], ['wall', -6, 0, -1, 1],
    ['wall', -4, 0, 5, 0], ['wall', -4, 0, 5, 1], ['floor', -4, 1, 5], ['ramp', -3, 0, 5, 2],
    ['wall', -4, 0, -3, 0], ['wall', -3, 0, -3, 0]
  ]);
  both(-14, 9, 6, 2.6, 2.5, 'container', 0xd8433a);
  both(-20, -19, 2.5, 2.6, 6, 'container', 0x2f7fd0);
  both(-6, 30, 6, 2.6, 2.5, 'container', 0x3fa860);
  both(-8, 15, 1.5, 1.5, 1.5, 'crate', 0xffffff); both(-9.6, 15.2, 1.5, 1.5, 1.5, 'crate', 0xffffff); both(-8.8, 15.1, 1.5, 1.5, 1.5, 'crate', 0xffffff, 1.5);
  both(-26, -8, 1.5, 1.5, 1.5, 'crate', 0xffffff); both(-3, -24, 1.5, 1.5, 1.5, 'crate', 0xffffff); both(-18.5, 2, 1.5, 1.5, 1.5, 'crate', 0xffffff);
  both(-30, -24, 1.5, 1.5, 1.5, 'crate', 0xffffff); both(-30, -22.4, 1.5, 1.5, 1.5, 'crate', 0xffffff);
  both(-12, -5.5, 0.6, 1.2, 4, 'concrete', 0xffffff); both(-27, 12, 4, 1.2, 0.6, 'concrete', 0xffffff);
  both(-22, 27, 0.6, 1.2, 4, 'concrete', 0xffffff); both(-9, -30, 4, 1.2, 0.6, 'concrete', 0xffffff); both(8.5, 22, 4, 1.2, 0.6, 'concrete', 0xffffff);
}

G.buildMap = modeId => {
  const mode = G.MODES[modeId];
  for (const m of statics.children.slice()) { statics.remove(m); m.geometry.dispose(); m.material.dispose(); }
  G.boxes.length = 0; G.clearPieces(true);
  const [nx, nz] = mode.size;
  const a = G.arena = { cx0: -nx, cx1: nx, cz0: -nz, cz1: nz, x0: -nx * C, x1: nx * C, z0: -nz * C, z1: nz * C, maxLv: mode.maxLv };
  a.radius = Math.hypot(a.x1, a.z1);
  const tex = G.tex.grid.clone(); tex.needsUpdate = true; tex.repeat.set(nx * 2, nz * 2);
  const floor = G.arenaFloor = new THREE.Mesh(new THREE.PlaneGeometry(nx * 2 * C, nz * 2 * C), new THREE.MeshLambertMaterial({ map: tex, color: theme.ground }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; statics.add(floor);
  // barrier
  const BH = 36; G.barriers = [];
  for (const [x, z, w, ry] of [[0, a.z0, nx * 2 * C, 0], [0, a.z1, nx * 2 * C, 0], [a.x0, 0, nz * 2 * C, Math.PI / 2], [a.x1, 0, nz * 2 * C, Math.PI / 2]]) {
    const t = G.tex.barrier.clone(); t.needsUpdate = true; t.repeat.set(w / 3, BH / 3);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, BH), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.03, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set(x, BH / 2, z); m.rotation.y = ry; statics.add(m);
    G.barriers.push({ mesh: m, axis: ry ? 'x' : 'z', at: ry ? x : z });
  }
  // painted base rim so the arena edge reads clearly from the ground
  const rimMat = new THREE.MeshLambertMaterial({ color: 0x2b3442 });
  for (const [x, z, w, d] of [[0, a.z0, a.x1 * 2 + 1, 1], [0, a.z1, a.x1 * 2 + 1, 1], [a.x0, 0, 1, a.z1 * 2 + 1], [a.x1, 0, 1, a.z1 * 2 + 1]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), rimMat); r.position.set(x, 0.1, z); r.receiveShadow = true; statics.add(r);
  }
  if (mode.map === 'depot') buildDepot();
  G.buildNav();
};
})();
