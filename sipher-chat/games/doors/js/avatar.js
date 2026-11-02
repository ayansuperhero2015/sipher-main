// Avatars: a blocky Roblox-style character each player customises in the
// menu's Avatar tab (skin, shirt, pants, hat, face, walk style). Party mode
// shows everyone's avatar to the others, animated.
(() => {
'use strict';
const A = G.avatar = {};

A.OPTIONS = {
  skin: ['#f5d0a9', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#ffe0bd', '#9be15d', '#8ec5ff'],
  shirt: ['#d33c3c', '#e8833a', '#e8c547', '#4caf50', '#2e86de', '#7e57c2', '#ec6fa6', '#ffffff', '#3a3a3a', '#7a5230'],
  pants: ['#1f2a44', '#3a3a3a', '#5d4037', '#2e7d32', '#6a1b9a', '#b0bec5', '#c62828', '#0d47a1'],
  hat: ['none', 'cap', 'beanie', 'tophat', 'crown', 'horns', 'headphones'],
  face: ['smile', 'grin', 'cool', 'shocked', 'angry', 'sleepy'],
  walk: ['classic', 'zombie', 'robot', 'sneaky'],
};
A.NAMES = {
  none: 'None', cap: 'Cap', beanie: 'Beanie', tophat: 'Top hat', crown: 'Crown', horns: 'Horns', headphones: 'Headphones',
  smile: 'Smile', grin: 'Grin', cool: 'Cool', shocked: 'Shocked', angry: 'Angry', sleepy: 'Sleepy',
  classic: 'Classic', zombie: 'Zombie', robot: 'Robot', sneaky: 'Sneaky',
};
// Emotes: key, name, seconds.
A.EMOTES = { wave: ['KeyT', 'Wave', 2.2], dance: ['KeyY', 'Dance', 4], point: ['KeyU', 'Point', 1.6] };

const DEF = { skin: '#f5d0a9', shirt: '#2e86de', pants: '#1f2a44', hat: 'none', face: 'smile', walk: 'classic' };

// Only known values get through, from storage or from other players.
A.clean = c => {
  const out = {};
  for (const k of Object.keys(DEF)) out[k] = c && A.OPTIONS[k].includes(c[k]) ? c[k] : DEF[k];
  return out;
};
A.load = () => {
  try { return A.clean(JSON.parse(localStorage.getItem('doors_avatar') || 'null')); } catch (e) { return A.clean(null); }
};
A.cfg = A.load();
A.save = cfg => {
  A.cfg = A.clean(cfg);
  try { localStorage.setItem('doors_avatar', JSON.stringify(A.cfg)); } catch (e) { /* storage blocked */ }
  dispatchEvent(new CustomEvent('doors-avatar', { detail: A.cfg }));
};

/* ---------- building ---------- */

const geoCache = {};
const boxGeo = (w, h, d) => geoCache[`${w},${h},${d}`] || (geoCache[`${w},${h},${d}`] = new THREE.BoxGeometry(w, h, d));

function faceTexture(face, skin) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = skin; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#1a1a1a'; x.strokeStyle = '#1a1a1a'; x.lineWidth = 7; x.lineCap = 'round';
  const eyes = (h = 14) => { x.fillRect(38, 46, 12, h); x.fillRect(78, 46, 12, h); };
  if (face === 'smile') { eyes(); x.beginPath(); x.arc(64, 72, 24, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke(); }
  else if (face === 'grin') {
    eyes(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(36, 78); x.quadraticCurveTo(64, 112, 92, 78); x.closePath(); x.fill();
    x.stroke();
  } else if (face === 'cool') {
    x.fillRect(28, 44, 32, 16); x.fillRect(68, 44, 32, 16); x.fillRect(56, 48, 16, 5);
    x.beginPath(); x.moveTo(48, 88); x.quadraticCurveTo(70, 98, 86, 82); x.stroke();
  } else if (face === 'shocked') { eyes(18); x.beginPath(); x.ellipse(64, 90, 10, 14, 0, 0, Math.PI * 2); x.fill(); }
  else if (face === 'angry') {
    eyes(); x.beginPath(); x.moveTo(32, 36); x.lineTo(52, 44); x.moveTo(96, 36); x.lineTo(76, 44); x.stroke();
    x.beginPath(); x.arc(64, 100, 20, 1.2 * Math.PI, 1.8 * Math.PI); x.stroke();
  } else if (face === 'sleepy') {
    x.beginPath(); x.moveTo(36, 54); x.lineTo(52, 54); x.moveTo(76, 54); x.lineTo(92, 54); x.stroke();
    x.beginPath(); x.arc(64, 86, 7, 0, Math.PI * 2); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function hat(kind, mats) {
  const g = new THREE.Group();
  const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
  const std = color => { const s = new THREE.MeshStandardMaterial({ color, roughness: 0.6 }); mats.push(s); return s; };
  if (kind === 'cap') { const s = std('#d33c3c'); m(boxGeo(0.46, 0.12, 0.46), s, 0, 0.27, 0); m(boxGeo(0.4, 0.04, 0.22), s, 0, 0.22, -0.3); }
  else if (kind === 'beanie') { const s = std('#ef6c00'); m(boxGeo(0.46, 0.2, 0.46), s, 0, 0.27, 0); m(boxGeo(0.12, 0.1, 0.12), std('#fff3e0'), 0, 0.42, 0); }
  else if (kind === 'tophat') { const s = std('#212121'); m(boxGeo(0.56, 0.04, 0.56), s, 0, 0.22, 0); m(boxGeo(0.36, 0.38, 0.36), s, 0, 0.43, 0); m(boxGeo(0.37, 0.06, 0.37), std('#b71c1c'), 0, 0.28, 0); }
  else if (kind === 'crown') {
    const s = new THREE.MeshStandardMaterial({ color: '#ffd54f', metalness: 0.7, roughness: 0.3 }); mats.push(s);
    m(boxGeo(0.46, 0.1, 0.46), s, 0, 0.26, 0);
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18], [0, -0.2]]) m(boxGeo(0.08, 0.14, 0.08), s, x, 0.37, z);
  } else if (kind === 'horns') { const s = std('#b71c1c'); for (const x of [-0.17, 0.17]) { const h = m(boxGeo(0.08, 0.22, 0.08), s, x, 0.3, 0); h.rotation.z = -x * 2.5; } }
  else if (kind === 'headphones') { const s = std('#263238'); m(boxGeo(0.5, 0.05, 0.08), s, 0, 0.25, 0); for (const x of [-0.25, 0.25]) m(boxGeo(0.08, 0.18, 0.16), s, x, 0.05, 0); }
  return g;
}

// A ready-to-animate character, feet at y=0, facing -z.
A.build = cfg => {
  cfg = A.clean(cfg);
  const mats = [], std = color => { const s = new THREE.MeshStandardMaterial({ color, roughness: 0.75 }); mats.push(s); return s; };
  const skin = std(cfg.skin), shirt = std(cfg.shirt), pants = std(cfg.pants);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(cfg.face, cfg.skin), roughness: 0.75 }); mats.push(faceMat);
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const limb = (geo, mat, px, py, oy) => {
    const pivot = new THREE.Group(); pivot.position.set(px, py, 0);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.y = oy; pivot.add(mesh); body.add(pivot);
    return pivot;
  };
  const legL = limb(boxGeo(0.3, 0.8, 0.3), pants, -0.17, 0.8, -0.4);
  const legR = limb(boxGeo(0.3, 0.8, 0.3), pants, 0.17, 0.8, -0.4);
  const torso = new THREE.Mesh(boxGeo(0.66, 0.72, 0.34), shirt); torso.position.y = 1.16; body.add(torso);
  const armL = limb(boxGeo(0.28, 0.7, 0.28), shirt, -0.48, 1.48, -0.3);
  const armR = limb(boxGeo(0.28, 0.7, 0.28), shirt, 0.48, 1.48, -0.3);
  // Hands in skin colour.
  for (const a of [armL, armR]) { const h = new THREE.Mesh(boxGeo(0.29, 0.14, 0.29), skin); h.position.y = -0.62; a.add(h); }
  const head = new THREE.Group(); head.position.y = 1.72; body.add(head);
  head.add(new THREE.Mesh(boxGeo(0.42, 0.42, 0.42), [skin, skin, skin, skin, skin, faceMat]));
  if (cfg.hat !== 'none') head.add(hat(cfg.hat, mats));
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  root.userData.av = { cfg, body, head, torso, legL, legR, armL, armR, phase: 0, t: 0, mats };
  return root;
};

A.dispose = root => {
  const av = root.userData.av; if (!av) return;
  for (const m of av.mats) { if (m.map) m.map.dispose(); m.dispose(); }
};

/* ---------- animation ---------- */

// st: { speed (m/s), crouch, dead, emote, emoteT (seconds into it) }
A.animate = (root, dt, st = {}) => {
  const a = root.userData.av; if (!a) return;
  a.t += dt;
  const style = a.cfg.walk, sp = Math.min(st.speed || 0, 7);
  const move = G.clamp(sp / 4, 0, 1);
  a.phase += dt * (style === 'sneaky' ? 5 : 8) * Math.max(move, 0.001);
  const s = Math.sin(a.phase);
  let legA = s * 0.8 * move, armA = -s * 0.7 * move, armRx = null, armLx = null, armRz = 0, armLz = 0;
  let bodyY = 0, lean = 0, headBob = 0, sway = 0;

  if (style === 'zombie') { armLx = armRx = -1.45 + s * 0.08; legA *= 0.6; sway = s * 0.12 * move; lean = 0.12; }
  else if (style === 'robot') { legA = Math.sign(s) * 0.45 * move; armA = -Math.sign(s) * 0.45 * move; headBob = Math.abs(Math.sign(s)) * 0.02 * move; }
  else if (style === 'sneaky') { bodyY = -0.18; lean = 0.32; legA = s * 1.0 * move; armLx = armRx = 0.6; }
  if (move < 0.05) { // idle: breathe and sway a little
    const br = Math.sin(a.t * 2);
    legA = 0; armA = br * 0.04; headBob = br * 0.01;
  }
  if (st.crouch) { bodyY -= 0.35; lean = Math.max(lean, 0.35); }

  // Emotes override the arms (and sometimes more).
  const e = st.emote, et = st.emoteT || 0;
  if (e === 'wave') { armRz = 2.6; armRx = Math.sin(et * 10) * 0.35; }
  else if (e === 'point') { armRx = -1.55; }
  else if (e === 'dance') {
    armLx = armRx = 0;
    bodyY += Math.abs(Math.sin(et * 6)) * 0.12;
    armLz = -2.3 + Math.sin(et * 6) * 0.5; armRz = 2.3 + Math.sin(et * 6 + Math.PI) * 0.5;
    sway = Math.sin(et * 3) * 0.25; legA = Math.sin(et * 6) * 0.25;
  }

  a.legL.rotation.x = legA; a.legR.rotation.x = -legA;
  a.armL.rotation.x = armLx !== null ? armLx : armA; a.armR.rotation.x = armRx !== null ? armRx : -armA;
  a.armL.rotation.z = armLz; a.armR.rotation.z = armRz;
  a.body.position.y = bodyY + headBob;
  a.body.rotation.x = -lean;
  a.body.rotation.z = sway;
  a.torso.scale.y = 1 + (move < 0.05 ? Math.sin(a.t * 2) * 0.015 : 0);
  // Lying down when dead.
  const lie = st.dead ? 1 : 0;
  root.userData.lie = G.lerp(root.userData.lie || 0, lie, Math.min(1, dt * 5));
  a.body.rotation.x -= root.userData.lie * (Math.PI / 2 - lean);
  a.body.position.y += root.userData.lie * 0.18;
};

/* ---------- the menu's Avatar tab ---------- */

let preview = null;
A.stopPreview = () => {
  if (!preview) return;
  cancelAnimationFrame(preview.raf);
  A.dispose(preview.model);
  preview.renderer.dispose();
  preview = null;
};

A.renderTab = main => {
  A.stopPreview();
  const cfg = { ...A.cfg };
  const swatches = key => A.OPTIONS[key].map(v =>
    `<button class="av-sw${cfg[key] === v ? ' on' : ''}" data-k="${key}" data-v="${v}" style="background:${v}" title="${v}"></button>`).join('');
  const chips = key => A.OPTIONS[key].map(v =>
    `<button class="av-chip${cfg[key] === v ? ' on' : ''}" data-k="${key}" data-v="${v}">${A.NAMES[v]}</button>`).join('');
  main.innerHTML = `<h2>Avatar</h2><p class="sub">This is how your friends see you in a party.</p>
    <div class="av-wrap">
      <div class="av-stage"><canvas id="av-canvas" width="260" height="340"></canvas>
        <div class="av-emotes">${Object.entries(A.EMOTES).map(([id, [key, name]]) =>
          `<button class="av-chip" data-emote="${id}">${name} <kbd>${key.slice(3)}</kbd></button>`).join('')}</div></div>
      <div class="av-opts">
        <label>Skin</label><div class="av-row">${swatches('skin')}</div>
        <label>Shirt</label><div class="av-row">${swatches('shirt')}</div>
        <label>Pants</label><div class="av-row">${swatches('pants')}</div>
        <label>Hat</label><div class="av-row">${chips('hat')}</div>
        <label>Face</label><div class="av-row">${chips('face')}</div>
        <label>Walk style</label><div class="av-row">${chips('walk')}</div>
        <p class="av-tip">In a run, press <kbd>T</kbd> to wave, <kbd>Y</kbd> to dance and <kbd>U</kbd> to point.</p>
      </div>
    </div>`;

  const canvas = main.querySelector('#av-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2a2018, 1.4));
  const key = new THREE.DirectionalLight(0xffe2b8, 1.6); key.position.set(2, 3, -3); scene.add(key);
  const cam = new THREE.PerspectiveCamera(32, 260 / 340, 0.1, 50);
  cam.position.set(0, 1.2, -4.6); cam.lookAt(0, 1.0, 0);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  preview = { renderer, scene, model: null, raf: 0, emote: null, emoteT: 0 };
  const rebuild = () => {
    if (preview.model) { scene.remove(preview.model); A.dispose(preview.model); }
    preview.model = A.build(cfg); scene.add(preview.model);
  };
  rebuild();
  let last = performance.now();
  const loop = now => {
    if (!preview) return;
    preview.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const m = preview.model;
    m.rotation.y += dt * 0.6;
    if (preview.emote) { preview.emoteT += dt; if (preview.emoteT > A.EMOTES[preview.emote][2]) preview.emote = null; }
    // Shows off the walk style, then stands still for a bit.
    const walking = (now / 1000) % 6 < 4;
    A.animate(m, dt, { speed: walking && !preview.emote ? 3.2 : 0, emote: preview.emote, emoteT: preview.emoteT });
    renderer.render(scene, cam);
  };
  preview.raf = requestAnimationFrame(loop);

  main.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    cfg[b.dataset.k] = b.dataset.v;
    A.save(cfg);
    main.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => x.classList.toggle('on', x === b));
    rebuild();
    G.audio.sfx('click');
  }));
  main.querySelectorAll('[data-emote]').forEach(b => b.addEventListener('click', () => {
    preview.emote = b.dataset.emote; preview.emoteT = 0;
  }));
};
})();
