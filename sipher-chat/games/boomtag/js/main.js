// Main: renderer, input, third-person camera, match flow and the game loop.
(() => {
'use strict';
const A = G.audio;
G.cam = { yaw: 0, pitch: 0.38, dist: 7.5 };
G.match = null; G.player = null; G.paused = false; G.specTarget = null; G.fastSim = false;
let locked = false, dragging = false;

G.boot = () => {
  const r = G.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('game').appendChild(r.domElement);
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 900);
  addEventListener('resize', () => { G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight); });

  addEventListener('keydown', e => {
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (!e.repeat) G.pressed[e.code] = true;
    G.keys[e.code] = true;
    if (e.code === 'Escape' && G.match && !locked) { if (G.paused) G.resume(); else if (G.match.state !== 'over') G.pause(); }
  });
  addEventListener('keyup', e => { G.keys[e.code] = false; });
  addEventListener('blur', () => { G.keys = {}; });
  const cv = r.domElement;
  cv.addEventListener('mousedown', e => {
    A.init();
    if (!G.match || G.paused) return;
    if (G.player && !G.player.alive && G.match.state !== 'over') { G.nextSpec(); }
    if (!locked) G.lock();
    dragging = true;
  });
  addEventListener('mouseup', () => { dragging = false; });
  addEventListener('mousemove', e => {
    if (!G.match || G.paused) return;
    if (!locked && !dragging) return;
    const k = 0.0024 * G.save.sens;
    G.cam.yaw -= e.movementX * k;
    G.cam.pitch = G.clamp(G.cam.pitch + e.movementY * k, -0.45, 1.25);
  });
  addEventListener('wheel', e => { if (G.match) G.cam.dist = G.clamp(G.cam.dist + Math.sign(e.deltaY) * 0.8, 3, 14); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === cv;
    if (!locked && G.match && G.match.state !== 'over' && !G.paused && !G.leaving) G.pause();
  });
  G.makeThumbs();
  G.ui.init();
  G.ui.showMenu();
  G.menuPreview();
  document.getElementById('loading').remove();
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    G.update(dt);
    G.render();
  };
  requestAnimationFrame(frame);
};

G.lock = () => {
  const cv = G.renderer.domElement;
  try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not available */ }
};
G.pause = () => { G.paused = true; G.ui.showPause(true); G.keys = {}; };
G.resume = () => { G.paused = false; G.ui.showPause(false); G.lock(); };

// Render real thumbnails of every map and hat once, for the lobby cards.
G.thumbs = { maps: {}, hats: {} };
G.makeThumbs = () => {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true;
  r.setSize(400, 240, false);
  const cam = new THREE.PerspectiveCamera(50, 400 / 240, 0.1, 900);
  for (const def of G.MAPS) {
    G.buildMap(def); G.world.update(0.5);
    cam.position.set(...def.thumb[0]); cam.lookAt(...def.thumb[1]);
    r.render(G.scene, cam);
    G.thumbs.maps[def.id] = r.domElement.toDataURL('image/jpeg', 0.85);
  }
  // hats: a head-and-shoulders shot on a flat backdrop
  r.setSize(160, 160, false);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x1c1c1c);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(2, 4, 3); sc.add(dl);
  const hc = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  hc.position.set(0.75, 2.1, 1.55); hc.lookAt(0, 1.86, 0);
  for (const id of Object.keys(G.HATS)) {
    const av = G.makeAvatar({ shirt: 0x8a8a8a, hat: id, face: 0, skin: 0xf1c27d, pants: 0x2b2f3a });
    av.tag.visible = false; av.shadow.visible = false; av.root.rotation.y = 0.35;
    sc.add(av.root); r.render(sc, hc);
    G.thumbs.hats[id] = r.domElement.toDataURL('image/png');
    sc.remove(av.root);
  }
  r.dispose(); r.forceContextLoss();
  G.world.def = null;
};

// ---------------------------------------------------------------- lobby preview
let previewMap = null;
G.menuPreview = () => {
  const id = G.save.map === 'random' ? (previewMap && previewMap !== 'random' ? previewMap : G.MAPS[0].id) : G.save.map;
  if (G.world.def && G.world.def.id === id && !G.match) { refreshPreviewAvatar(); return; }
  G.buildMap(G.MAPS.find(m => m.id === id));
  previewMap = id;
  refreshPreviewAvatar();
};
let previewAv = null;
const LOBBY = { candy: [0, 1.5, 3.6], lava: [0, 2, 0], frozen: [0, 0, 0], sky: [5, 0, 5], maze: [0, 0.5, 2.4] };
function refreshPreviewAvatar() {
  if (previewAv) G.scene.remove(previewAv.root);
  previewAv = G.makeAvatar({ shirt: G.SHIRTS[G.save.shirt], hat: G.save.hat, face: 0 });
  previewAv.drawTag('You', false, true);
  const n = LOBBY[G.world.def.id] || [0, 0, 0];
  previewAv.root.position.set(n[0], n[1], n[2]);
  G.scene.add(previewAv.root);
}

// ---------------------------------------------------------------- match flow
G.startMatch = () => {
  const s = G.save;
  if (previewAv) { G.scene.remove(previewAv.root); previewAv = null; }
  G.camera.clearViewOffset();
  const def = s.map === 'random' ? G.pick(G.MAPS) : G.MAPS.find(m => m.id === s.map);
  G.mod = { id: null, grav: 1, speed: 1 };
  G.buildMap(def); G.buildNav();
  G.clearActors(); G.ent.clear(); G.fx.clear();
  G.player = G.makeActor({ name: 'You', isPlayer: true, ability: s.ability, hat: s.hat, shirt: G.SHIRTS[s.shirt] });
  const names = G.shuffle([...G.BOT_NAMES]);
  const abilities = Object.keys(G.ABILITIES), hats = Object.keys(G.HATS);
  for (let i = 0; i < s.bots; i++) {
    const b = G.makeActor({ name: names[i % names.length], ability: G.pick(abilities), hat: Math.random() < 0.55 ? G.pick(hats) : 'none',
      shirt: G.pick(G.SHIRTS), skill: G.rand(0.55, 1) });
    b.bot = G.makeBrain();
  }
  // spread spawns apart
  const used = [];
  for (const a of G.shuffle([...G.actors])) {
    let best = null, bd = -1;
    for (let k = 0; k < 30; k++) {
      const n = G.nav.randomNode();
      const d = used.reduce((m, u) => Math.min(m, G.hdist(u, n)), 99);
      if (d > bd) { bd = d; best = n; }
    }
    used.push(best); G.placeAt(a, best);
    a.yaw = Math.atan2(-best.x, -best.z);
  }
  // start the camera looking down the most open direction
  {
    const p = G.player.pos, o = new THREE.Vector3(p.x, p.y + 1.7, p.z);
    let best = 0, bs = -1;
    for (let k = 0; k < 8; k++) {
      const y = k * Math.PI / 4, back = G.raycast(o, new THREE.Vector3(-Math.sin(y), 0.35, -Math.cos(y)).normalize(), 8);
      const fwd = G.raycast(o, new THREE.Vector3(Math.sin(y), 0, Math.cos(y)), 20);
      const s = Math.min(back, 7.5) * 2 + fwd;
      if (s > bs) { bs = s; best = y; }
    }
    G.cam.yaw = best; G.cam.pitch = 0.38; G.player.yaw = best;
  }
  G.match = { state: 'intermission', t: 5, round: 0, fuse: 0, maxFuse: 1, time: 0, lastBeep: 0, lastCount: 99, over: false, def };
  G.specTarget = null; G.paused = false; G.leaving = false;
  G.ui.startHud();
  G.ui.announce(def.name, 'First bomb drops in 5…', 2.5);
  G.ui.feed(`Welcome to <b>${def.name}</b>! ${def.desc}`);
  G.lock();
};
function startRound() {
  const m = G.match;
  m.round++;
  const alive = G.alive();
  // random modifier from round 2 on
  G.mod = { id: null, grav: 1, speed: 1 };
  let mod = null;
  if (m.round >= 2 && alive.length > 2 && Math.random() < 0.4) {
    mod = G.pick(G.MODS);
    G.mod.id = mod.id; if (mod.grav) G.mod.grav = mod.grav; if (mod.speed) G.mod.speed = mod.speed;
    if (mod.id === 'rain') for (let i = 0; i < 7; i++) G.ent.spawnPowerup();
  }
  let nb = Math.max(1, Math.floor(alive.length / 4));
  if (mod && mod.id === 'double') nb++;
  nb = Math.min(nb, alive.length - 1);
  const pool = G.shuffle([...alive]);
  for (let i = 0; i < nb; i++) { G.setBomb(pool[i], true); pool[i].noBackT = 0; pool[i].passCd = 0.5; if (pool[i].bot) pool[i].bot.replan = true; }
  let fuse = G.clamp(12 + alive.length * 1.1, 14, 28) + G.rand(0, 3);
  if (mod && mod.id === 'short') fuse *= 0.55;
  m.fuse = m.maxFuse = fuse; m.state = 'round'; m.lastBeep = fuse;
  const me = G.player;
  if (mod) { A.mod(); G.ui.announce(mod.name, mod.sub, 2.4, 'mod'); }
  else if (me.alive && me.bomb) { A.gotBomb(); G.ui.flashBomb(); }
  else { A.round(); G.ui.announce('ROUND ' + m.round, nb + (nb > 1 ? ' bombs are' : ' bomb is') + ' live. RUN!', 1.8); }
  if (mod && me.alive && me.bomb) setTimeout(() => { if (G.player === me && me.bomb) G.ui.flashBomb(); }, 1400);
  G.ui.feed(`Round ${m.round}: ${pool.slice(0, nb).map(a => `<b class="${a.isPlayer ? 'me' : ''}">${a.name}</b>`).join(', ')} ${nb > 1 ? 'start with bombs' : 'starts with the bomb'}`, 'bomb');
}
function boom() {
  const m = G.match;
  const holders = G.actors.filter(a => a.alive && a.bomb);
  const after = G.alive().length - holders.length;
  for (const h of holders) {
    h.alive = false; G.setBomb(h, false); h.place = after + 1;
    A.explode(h.pos); A.oof(h.pos);
    G.fx.explosion(h.pos); G.fx.debris(h.av, h.pos);
    h.av.root.visible = false;
    for (const o of G.actors) {
      if (!o.alive) continue;
      const dx = o.pos.x - h.pos.x, dz = o.pos.z - h.pos.z, d = Math.hypot(dx, dz);
      if (d < 6.5 && Math.abs(o.pos.y - h.pos.y) < 4) { const k = 1 - d / 7; o.vel.set(dx / (d || 1) * 15 * k, 7 * k + 3, dz / (d || 1) * 15 * k); o.knockT = 0.35; }
    }
    G.ui.feed(`<b class="${h.isPlayer ? 'me' : ''}">${h.name}</b> exploded`, 'out');
    if (h.isPlayer) { G.ui.announce('KABOOM!', 'You held the bomb too long', 2.6, 'bad'); A.lose(); G.specTarget = null; G.nextSpec(); }
  }
  for (const a of G.alive()) a.survived++;
  if (G.player.alive && !G.fastSim) G.ui.toast('Round ' + m.round + ' survived  +10 coins');
  m.state = 'boom'; m.t = 2.4;
  G.mod = { id: null, grav: 1, speed: 1 };
}
function endMatch() {
  const m = G.match;
  m.state = 'over'; m.t = 3;
  const alive = G.alive();
  const winner = alive[0] || null;
  if (winner) { winner.place = 1; winner.av.cheer = 99; }
  const p = G.player;
  const survive = p.survived * 10, pass = p.passes * 3, bonus = { 1: 100, 2: 50, 3: 25 }[p.place] || 0;
  m.result = { place: p.place, survive, pass, bonus, total: survive + pass + bonus };
  G.save.coins += m.result.total; G.save.games++;
  if (p.place === 1) G.save.wins++;
  G.persist();
  if (winner) {
    G.specTarget = winner;
    G.ui.announce(winner.isPlayer ? 'YOU WIN!' : winner.name + ' WINS!', 'Last one standing', 3, winner.isPlayer ? 'win' : '');
    G.ui.feed(`<b class="${winner.isPlayer ? 'me' : ''}">${winner.name}</b> is the last one standing`);
    if (winner.isPlayer) A.win();
    for (let i = 0; i < 6; i++) setTimeout(() => G.fx.burst(winner.pos.clone().setY(winner.pos.y + 2), G.pick([0xffd23f, 0x5be05b, 0x4f86ff, 0xff4b42]), 20, 7, 0.16, 1, 8), i * 300);
  }
}
G.nextSpec = () => {
  const alive = G.alive();
  if (!alive.length) return;
  const i = alive.indexOf(G.specTarget);
  G.specTarget = alive[(i + 1) % alive.length];
};
G.fastForward = () => {
  // simulate the rest of the match instantly
  G.fastSim = true; A.muted = true;
  let guard = 0;
  while (G.match && G.match.state !== 'over' && guard++ < 60 * 900) G.update(1 / 30, true);
  G.fastSim = false; A.muted = false;
  G.fx.clear();
};
G.quitToMenu = () => {
  G.leaving = true;
  if (document.pointerLockElement) document.exitPointerLock();
  G.match = null; G.paused = false;
  G.clearActors(); G.ent.clear(); G.fx.clear();
  G.mod = { id: null, grav: 1, speed: 1 };
  G.world.def = null;
  G.ui.showMenu(); G.menuPreview();
  G.leaving = false;
};

// ---------------------------------------------------------------- update
function playerInput() {
  const p = G.player, k = G.keys;
  if (!p.alive || G.paused) { p.input.x = p.input.z = 0; p.input.jump = p.input.sprint = false; return; }
  let fx = 0, fz = 0;
  if (k.KeyW || k.ArrowUp) fz += 1; if (k.KeyS || k.ArrowDown) fz -= 1;
  if (k.KeyA || k.ArrowLeft) fx -= 1; if (k.KeyD || k.ArrowRight) fx += 1;
  const cy = G.cam.yaw, f = [Math.sin(cy), Math.cos(cy)], r = [-Math.cos(cy), Math.sin(cy)];
  let ix = f[0] * fz + r[0] * fx, iz = f[1] * fz + r[1] * fx;
  const l = Math.hypot(ix, iz); if (l > 0) { ix /= l; iz /= l; }
  p.input.x = ix; p.input.z = iz; p.input.jump = !!k.Space; p.input.sprint = !!(k.ShiftLeft || k.ShiftRight);
  if (G.pressed.KeyE || G.pressed.KeyQ || G.pressed.KeyF) G.useAbility(p);
}
function checkTags() {
  const acts = G.actors;
  for (const h of acts) {
    if (!h.alive || !h.bomb || h.passCd > 0) continue;
    for (const t of acts) {
      if (t === h || !t.alive || t.bomb) continue;
      if (h.noBackT > 0 && t.id === h.noBackId) continue;
      const dx = t.pos.x - h.pos.x, dz = t.pos.z - h.pos.z;
      if (dx * dx + dz * dz < G.TAG_DIST * G.TAG_DIST && Math.abs(t.pos.y - h.pos.y) < 1.7) { G.passBomb(h, t, 'tag'); break; }
    }
  }
}
G.update = (dt, sim) => {
  const m = G.match;
  if (!m) {
    // lobby: slow orbit around the preview map
    G.world.update && G.world.def && G.world.update(dt);
    const t = performance.now() / 1000 * 0.12;
    // push the character into the open area right of the lobby panel
    const W = innerWidth, H = innerHeight;
    if (W > 860) G.camera.setViewOffset(W, H, -Math.min(300, W * 0.2), 0, W, H); else G.camera.clearViewOffset();
    const c = previewAv ? previewAv.root.position : new THREE.Vector3();
    G.camera.position.set(c.x + Math.sin(t) * 6.5, c.y + 2.6, c.z + Math.cos(t) * 6.5);
    G.camera.lookAt(c.x, c.y + 1.3, c.z);
    if (previewAv) { previewAv.root.rotation.y = t + Math.PI * 0.15; previewAv.animate(dt, 0, true, null); }
    G.pressed = {};
    return;
  }
  if (G.paused) { G.pressed = {}; return; }
  m.time += dt;
  playerInput();
  for (const a of G.actors) if (a.alive && a.bot) G.updateBot(a, dt);
  for (const a of G.actors) if (a.alive) G.stepActor(a, dt);
  // In a Sipher party only the leader's game decides tags, power-ups and rounds (js/party.js sets G.netClient on everyone else's).
  if (m.state === 'round' && !G.netClient) checkTags();
  G.ent.update(dt, !G.netClient && (m.state === 'round' || m.state === 'intermission'));
  if (!sim) G.fx.update(dt);
  G.world.update(dt);
  // state machine
  if (G.netClient) {
    // the party leader's game runs the rounds
  } else if (m.state === 'intermission') {
    m.t -= dt;
    const c = Math.ceil(m.t);
    if (c !== m.lastCount && c <= 3 && c >= 1) { m.lastCount = c; A.countdown(false); if (!sim) G.ui.announce(String(c), m.round ? 'Next round' : 'Get ready', 0.8); }
    if (m.t <= 0) { m.lastCount = 99; A.countdown(true); startRound(); }
  } else if (m.state === 'round') {
    m.fuse -= dt;
    const iv = m.fuse > 10 ? 1 : m.fuse > 5 ? 0.5 : m.fuse > 2 ? 0.25 : 0.12;
    if (m.lastBeep - m.fuse >= iv) { m.lastBeep = m.fuse; A.tick(m.fuse < 5); }
    if (m.fuse <= 0) boom();
  } else if (m.state === 'boom') {
    m.t -= dt;
    if (m.t <= 0) {
      if (G.alive().length <= 1) endMatch();
      else { m.state = 'intermission'; m.t = 3.5; for (const a of G.actors) a.noBackT = 0; }
    }
  } else if (m.state === 'over') {
    m.t -= dt;
    if (m.t <= 0 && !m.shown && !sim) { m.shown = true; if (document.pointerLockElement) { G.leaving = true; document.exitPointerLock(); G.leaving = false; } G.ui.showEnd(m.result); }
  }
  if (m.state === 'over' && sim) { /* results shown on the next real frame */ }
  G.pressed = {};
  if (sim) return;
  updateCamera(dt);
  G.ui.update(dt);
};

// ---------------------------------------------------------------- camera
const _t = new THREE.Vector3(), _d = new THREE.Vector3();
function updateCamera(dt) {
  const p = G.player;
  let focus = p;
  if (!p.alive || G.match.state === 'over') {
    if (!G.specTarget || !G.specTarget.alive) { if (G.match.state !== 'over') G.nextSpec(); }
    if (G.specTarget) focus = G.specTarget;
  }
  const c = G.cam;
  _t.set(focus.pos.x, focus.pos.y + 1.7, focus.pos.z);
  const cp = Math.cos(c.pitch);
  _d.set(-Math.sin(c.yaw) * cp, Math.sin(c.pitch), -Math.cos(c.yaw) * cp);
  const hit = G.raycast(_t, _d, c.dist);
  const dist = Math.max(1.2, Math.min(c.dist, hit - 0.3));
  G.camera.position.copy(_t).addScaledVector(_d, dist);
  if (G.fx.shake > 0) {
    const s = G.fx.shake * 0.35;
    G.camera.position.x += G.rand(-s, s); G.camera.position.y += G.rand(-s, s); G.camera.position.z += G.rand(-s, s);
  }
  G.camera.lookAt(_t);
  const wantFov = 72 + (p.alive && p.sprinting ? 6 : 0) + (p.alive && p.fx.speed > 0 ? 4 : 0);
  if (Math.abs(G.camera.fov - wantFov) > 0.1) { G.camera.fov += (wantFov - G.camera.fov) * Math.min(1, dt * 6); G.camera.updateProjectionMatrix(); }
  // fade the player out when the camera is pushed right up against them
  if (p.alive && p.fx.invis <= 0) p.av.setOpacity(dist < 1.8 ? 0.35 : 1);
}
G.render = () => {
  G.renderer.render(G.scene, G.camera);
  G.ui.drawIndicators();
};

// Test hooks: step the simulation without requestAnimationFrame.
G.tick = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) G.update(dt); G.render(); return G.match && { state: G.match.state, round: G.match.round, fuse: +G.match.fuse.toFixed(1), alive: G.alive().length }; };
})();
