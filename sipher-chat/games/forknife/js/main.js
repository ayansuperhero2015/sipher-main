// Main: boot, input, match / round flow, storm, camera and the game loop.
(() => {
'use strict';
const V3 = THREE.Vector3;
const _c = new V3(), _d = new V3(), _e = new V3(), _r = new V3(), _t = new V3();
G.time = 0; G.paused = false; G.match = null; G.mouse = { l: false, r: false };
G.storm = { phases: [], i: 0, pt: 0, r: 999, x: 0, z: 0, active: false, dmgT: 0 };
let last = 0, menuT = 0, lastCount = -1;

G.boot = () => {
  G.initTextures(); G.initWorld(); G.initBuild(); G.initFx(); G.lobby.init(); G.ui.init();
  G.buildMap('build');
  bindInput();
  document.getElementById('loading').remove();
  G.ui.showMenu();
  requestAnimationFrame(loop);
};

// ---------------------------------------------------------------- input
const locked = () => document.pointerLockElement === G.renderer.domElement;
G.lock = () => { try { const r = G.renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed */ } };
const inPlay = () => G.match && G.match.phase !== 'end' && !G.paused;
function cycleMat(p) { const i = G.MAT_IDS.indexOf(p.matSel); p.matSel = G.MAT_IDS[(i + 1) % 3]; G.audio.click(); }
function bindInput() {
  addEventListener('keydown', e => {
    if (e.code === 'Tab' || /^F[1-4]$/.test(e.code) || (e.code.startsWith('Control') && G.match)) e.preventDefault();
    if (e.repeat) return;
    G.keys[e.code] = true;
    if ((e.code === 'Escape' || e.code === 'KeyP') && G.match && G.match.phase !== 'end') { if (G.paused) G.resume(); else G.pause(); return; }
    if (!inPlay()) return;
    const p = G.player; if (!p.alive) return;
    const dig = e.code.match(/^Digit([1-5])$/);
    if (dig) G.selectSlot(p, +dig[1] - 1);
    else if (e.code === 'KeyX') G.selectSlot(p, -1);
    else if (e.code === 'KeyG') { if (G.match.mode.build && G.match.phase === 'play') G.editToggle(p); }
    else if (e.code === 'KeyR') G.reload(p);
    else if (e.code === 'KeyB' && p.grounded && !p.editing) p.emote = 3;
    else if (e.code === 'KeyT' && p.buildMode) cycleMat(p);
    else {
      const t = { KeyQ: 'wall', KeyF: 'floor', KeyC: 'ramp', KeyV: 'cone', F1: 'wall', F2: 'floor', F3: 'ramp', F4: 'cone' }[e.code];
      if (t && G.match.mode.build) {
        if (p.buildMode === t) { const s = G.buildTarget(p, t, p.yaw, p.pitch); if (s.valid) G.tryBuild(p, s); }
        else G.setBuild(p, t);
      }
    }
  });
  addEventListener('keyup', e => { G.keys[e.code] = false; });
  addEventListener('blur', () => { G.keys = {}; G.mouse.l = G.mouse.r = false; });
  const cv = G.renderer.domElement;
  cv.addEventListener('mousedown', e => {
    G.audio.init();
    if (!inPlay()) return;
    if (!locked()) { G.lock(); return; }
    if (e.button === 0) G.mouse.l = true;
    if (e.button === 2) { if (G.player.editing) G.editReset(G.player); else if (G.player.buildMode) cycleMat(G.player); else G.mouse.r = true; }
  });
  addEventListener('mouseup', e => { if (e.button === 0) G.mouse.l = false; if (e.button === 2) G.mouse.r = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => {
    if (!locked() || !inPlay()) return;
    const p = G.player, w = G.weaponOf(p);
    const zoom = p.adsK > 0.5 && w && !p.buildMode ? (w.zoom || 1) : 1;
    const k = 0.0021 * G.save.sens / Math.sqrt(zoom) * (p.editing ? G.save.editSens || 1 : 1);
    p.yaw -= e.movementX * k; p.pitch = G.clamp(p.pitch - e.movementY * k, -1.45, 1.45);
  });
  addEventListener('wheel', e => {
    if (!inPlay() || !locked()) return;
    const p = G.player, dir = e.deltaY > 0 ? 1 : -1;
    if (p.editing) return;
    if (p.buildMode) { cycleMat(p); return; }
    const n = p.slots.length + 1; let i = p.cur + 1;
    i = ((i + dir) % n + n) % n; G.selectSlot(p, i - 1);
  }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    if (!locked() && G.match && G.match.phase !== 'end' && !G.paused && !G.noAutoPause) G.pause();
  });
}
G.pause = () => { if (!G.match || G.paused) return; G.paused = true; G.mouse.l = G.mouse.r = false; G.ui.showPause(); if (locked()) document.exitPointerLock(); };
G.resume = () => { G.paused = false; G.ui.hidePause(); G.lock(); last = performance.now(); };
G.quitToMenu = () => {
  G.paused = false; G.ui.hidePause();
  if (G.player) G.editCancel(G.player);
  if (G.match && G.match.phase !== 'end') { G.save.games++; G.persist(); }
  G.match = null; G.storm.phases = []; G.setStorm(0, 0, 1, false); G.showGhost(null); G.clearRockets(); G.clearFx();
  if (locked()) document.exitPointerLock();
  for (const a of G.actors) a.av.root.visible = false;
  G.ui.showMenu();
};

// ---------------------------------------------------------------- match flow
// Round randomness (random loadouts, the moving storm) goes through G.rnd, so a party match
// can seed it and both players get the same rounds. Solo it's just Math.random.
G.rnd = Math.random;
function randomLoadout() {
  const guns = G.WEAPON_IDS.filter(id => G.WEAPONS[id].kind !== 'heal');
  const pair = ['pump', 'tac'], shot = pair[Math.floor(G.rnd() * 2)], rest = guns.filter(id => id !== 'pump' && id !== 'tac');
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(G.rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [shot, rest[0], rest[1], rest[2], 'shield'];
}
const tierSlots = (mode, t) => (mode.ladder[t] === 'pickaxe' ? [] : [mode.ladder[t]]);
G.startMatch = () => {
  const id = G.save.mode, mode = G.MODES[id];
  G.audio.init();
  G.paused = false; G.ui.hidePause(); document.getElementById('end').classList.add('hidden');
  for (const a of G.actors) G.scene.remove(a.av.root);
  G.setTheme(G.save.theme); G.buildMap(id);
  const pc = G.OUTFITS[G.save.outfit] || G.OUTFITS[0];
  const bc = G.pick(G.OUTFITS.filter(c => c !== pc));
  if (G.player) G.editCancel(G.player);
  G.player = G.makeActor({ isPlayer: true, name: 'You', color: pc, hair: G.HAIR[G.save.hair || 0], skin: G.SKINS[G.save.skin || 0] });
  // in a party match the opponent is your friend (js/party.js), otherwise a bot
  G.bot = G.makeRival ? G.makeRival(bc) : G.makeActor({ name: G.pick(G.BOT_NAMES), color: bc, hair: G.pick(G.HAIR), skin: G.pick(G.SKINS) });
  G.actors = [G.player, G.bot];
  G.match = { modeId: id, mode, phase: 'count', t: 0, timer: 3, round: 1, score: [0, 0], target: Math.ceil(G.save.rounds / 2), final: false,
    stats: { dmg: 0, taken: 0, shots: 0, hits: 0, heads: 0, builds: 0, buildDmg: 0, elims: 0, deaths: 0, edits: 0 } };
  if (mode.ladder) { G.player.tier = G.bot.tier = 0; G.player.slots = tierSlots(mode, 0); G.bot.slots = tierSlots(mode, 0); }
  else {
    G.player.slots = G.save.loadout.slice();
    G.bot.slots = G.save.botLoadout === 'random' ? randomLoadout() : G.save.loadout.slice();
  }
  G.ui.hideMenu(); G.ui.showHud();
  startRound();
  G.lock();
};
function spawnFor(i) {
  const m = G.match, sp = m.mode.spawns, swap = (m.round % 2 === 0) ? 1 : 0;
  return sp[(i + swap + (G.netSide || 0)) % 2]; // a party guest starts on the other side
}
function startRound() {
  const m = G.match, mode = m.mode;
  G.clearPieces(false); G.clearRockets(); G.clearFx(); G.placePrebuilt(m.modeId);
  if (G.netSeed) G.rnd = G.mulberry(G.netSeed + m.round * 7919);
  if (mode.randomLoadout) { const l = randomLoadout(); G.player.slots = l.slice(); G.bot.slots = l.slice(); }
  const a = spawnFor(0), b = spawnFor(1);
  const yawA = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])), yawB = Math.atan2(-(a[0] - b[0]), -(a[1] - b[1]));
  G.resetActor(G.player, a[0], a[1], yawA); G.resetActor(G.bot, b[0], b[1], yawB);
  if (!G.bot.puppet) G.initBotAI(G.bot);
  setupStorm();
  m.phase = 'count'; m.timer = 3; m.t = 0; lastCount = -1;
  G.ui.center(mode.ladder ? 'GUN GAME' : 'ROUND ' + m.round, mode.ladder ? 'First through the rack wins' : m.score[0] + ' - ' + m.score[1], 2.2, 'round');
}
function setupStorm() {
  const st = G.storm, m = G.match, mode = m.mode, A = G.arena;
  st.i = 0; st.pt = 0; st.dmgT = 0; st.x = 0; st.z = 0; st.phases = [];
  if (mode.zone) {
    st.r = A.x1 * 1.05;
    let cx = 0, cz = 0, r = st.r;
    for (const [wait, dur, nr, dmg] of [[8, 18, 30, 4], [6, 15, 15, 6], [5, 14, 5, 9], [5, 12, 0, 12]]) {
      const reach = (r - nr) * 0.7, ang = G.rnd() * Math.PI * 2, d = G.rnd() * reach;
      cx = G.clamp(cx + Math.cos(ang) * d, A.x0 + nr, A.x1 - nr); cz = G.clamp(cz + Math.sin(ang) * d, A.z0 + nr, A.z1 - nr);
      st.phases.push({ wait, dur, r: nr, x: cx, z: cz, dmg }); r = nr;
    }
  } else if (!mode.respawn) {
    st.r = A.radius + 2;
    st.phases.push(mode.map === 'box' ? { wait: 60, dur: 40, r: 0, x: 0, z: 0, dmg: 5 } : { wait: 100, dur: 60, r: 0, x: 0, z: 0, dmg: 6 });
  } else st.r = 999;
  st.fr = st.r; st.fx = 0; st.fz = 0;
}
function stormUpdate(dt) {
  const st = G.storm, A = G.arena;
  if (!st.phases.length) { st.active = false; G.setStorm(0, 0, 1, false); return; }
  if (st.i < st.phases.length) {
    const ph = st.phases[st.i]; st.pt += dt;
    if (st.pt >= ph.wait) {
      const k = Math.min(1, (st.pt - ph.wait) / ph.dur);
      st.r = G.lerp(st.fr, ph.r, k); st.x = G.lerp(st.fx, ph.x, k); st.z = G.lerp(st.fz, ph.z, k);
      if (k >= 1) { st.i++; st.pt = 0; st.fr = st.r; st.fx = st.x; st.fz = st.z; if (st.i < st.phases.length) G.audio.storm(); }
      else if (st.pt - dt < ph.wait) { G.audio.storm(); G.ui.feed('<i class="storm">The storm is closing in</i>'); }
    }
  }
  st.active = st.r < A.radius;
  G.setStorm(st.x, st.z, st.r, st.r < A.radius + 1);
  st.dmgT += dt;
  if (st.dmgT >= 1) {
    st.dmgT -= 1;
    const dmg = st.phases[Math.min(st.i, st.phases.length - 1)].dmg;
    for (const a of G.actors) if (a.alive && Math.hypot(a.pos.x - st.x, a.pos.z - st.z) > st.r) {
      G.hurt(a, dmg, null, false, 'storm'); if (a.isBot) a.hurtFlag = false; else G.audio.stormTick();
    }
  }
}
const weaponLabel = wid => wid === 'pickaxe' ? 'Pickaxe' : wid === 'storm' ? 'the storm' : wid === 'fall' ? 'fall damage' : G.WEAPONS[wid] ? G.WEAPONS[wid].name : wid;
G.onElim = (t, by, wid, head) => {
  const m = G.match, mode = m.mode, other = G.enemyOf(t);
  G.elimFx(t.pos); t.av.root.visible = false; t.buildMode = null;
  const nm = a => `<b class="${a.isPlayer ? 'you' : 'them'}">${a.isPlayer ? 'You' : a.name}</b>`;
  if (by) G.ui.feed(`${nm(by)} eliminated ${nm(t)} <span>${weaponLabel(wid)}${head ? ' · HEADSHOT' : ''}</span>`);
  else G.ui.feed(`${nm(t)} ${wid === 'storm' ? 'was lost to the storm' : wid === 'fall' ? 'fell to their death' : 'self-eliminated'}`);
  if (t.isPlayer) m.stats.deaths++; else if (by === G.player) { m.stats.elims++; G.ui.elimBanner(t.name, m.stats.elims); }
  if (mode.respawn) {
    let won = false;
    if (by) {
      if (mode.ladder[by.tier] === 'pickaxe') won = true;
      else if (wid === 'pickaxe') { t.tier = Math.max(0, t.tier - 1); G.ui.feed(`${nm(t)} got knocked back a weapon`); }
      else {
        by.tier++; G.giveLoadout(by, tierSlots(mode, by.tier));
        if (by.isPlayer) { G.ui.center('NEXT WEAPON', weaponLabel(mode.ladder[by.tier]), 1.4); G.audio.roundWin(); }
      }
    }
    if (won) { m.score[by === G.player ? 0 : 1]++; m.final = true; m.phase = 'roundEnd'; m.timer = 3.5; by.emote = 3.5; banner(by); return; }
    t.respawnT = 2.5;
    if (t.isPlayer) G.ui.center('ELIMINATED', 'Respawning...', 2.4, 'lose');
    return;
  }
  const win = other; m.score[win === G.player ? 0 : 1]++;
  m.final = m.score[0] >= m.target || m.score[1] >= m.target;
  m.phase = 'roundEnd'; m.timer = 4; win.emote = 3.8;
  banner(win);
};
function banner(win) {
  const m = G.match, you = win === G.player;
  if (m.final) G.ui.center(you ? 'YOU WIN THE MATCH' : 'MATCH LOST', m.mode.ladder ? '' : m.score[0] + ' - ' + m.score[1], 3.6, you ? 'win' : 'lose');
  else G.ui.center(you ? 'ROUND WON' : 'ROUND LOST', m.score[0] + ' - ' + m.score[1], 3.6, you ? 'win' : 'lose');
  if (you) G.audio.roundWin(); else G.audio.roundLose();
}
function respawn(a) {
  const m = G.match, e = G.enemyOf(a), pts = [[-30, 2], [30, -2], [-28, -30], [28, 30], [-30, 30], [30, -30], [0, -32], [0, 32], [-16, 0], [16, 0]];
  let best = pts[0], bd = -1;
  for (const p of pts) {
    if (G.blocked(p[0], p[1], 0, 0.6, 1.8)) continue;
    const d = Math.hypot(p[0] - e.pos.x, p[1] - e.pos.z) + Math.random() * 6;
    if (d > bd) { bd = d; best = p; }
  }
  a.slots = tierSlots(m.mode, a.tier);
  G.resetActor(a, best[0], best[1], Math.atan2(-(e.pos.x - best[0]), -(e.pos.z - best[1])));
  if (a.isBot) G.initBotAI(a);
}
function endMatch() {
  const m = G.match, win = m.score[0] > m.score[1];
  m.phase = 'end'; G.showGhost(null);
  G.save.games++; if (win) G.save.wins++; G.persist();
  if (win) G.audio.win(); else G.audio.lose();
  if (locked()) document.exitPointerLock();
  G.ui.showEnd(win);
}
G.endMatch = endMatch;

// ---------------------------------------------------------------- per-frame
function playerInput() {
  const p = G.player, k = G.keys, inp = p.input;
  const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  p.move.x = -sy * f + cy * s; p.move.z = -cy * f - sy * s;
  inp.fire = G.mouse.l && !p.editing; inp.ads = G.mouse.r && !p.buildMode && !p.editing; inp.jump = !!k.Space; inp.sprint = !k.ShiftLeft && !k.ShiftRight;
  inp.crouch = !!(k.ControlLeft || k.ControlRight);
  if (f || s || inp.jump || inp.fire) p.emote = 0;
}
function updateCamera(dt) {
  const p = G.player, cam = G.camera, m = G.match, w = G.weaponOf(p);
  G.camKick = Math.max(0, (G.camKick || 0) - dt * 7);
  let fov = 75, scoped = false;
  if (!p.alive || (m.phase === 'roundEnd' && !p.alive)) {
    const e = G.enemyOf(p), tt = G.time * 0.4;
    _t.set(e.pos.x, e.pos.y + 1.2, e.pos.z);
    cam.position.set(_t.x + Math.sin(tt) * 7, _t.y + 3, _t.z + Math.cos(tt) * 7); cam.lookAt(_t);
  } else if (p.emote > 0) {
    const tt = G.time * 0.6; _t.set(p.pos.x, p.pos.y + 1.1, p.pos.z);
    cam.position.set(_t.x + Math.sin(p.yaw + tt) * -4.5, _t.y + 1.2, _t.z + Math.cos(p.yaw + tt) * -4.5); cam.lookAt(_t);
  } else {
    scoped = !!(w && w.scope && p.adsK > 0.6 && !p.buildMode && !p.editing);
    const kick = (G.camKick || 0) * 0.025;
    _e.set(p.pos.x, G.eyeY(p), p.pos.z);
    if (scoped) { cam.position.copy(_e); fov = 75 / w.zoom; }
    else {
      const ads = p.buildMode || p.editing ? 0 : p.adsK, back = G.lerp(3.3, 1.9, ads), side = G.lerp(0.85, 0.7, ads);
      G.dirFrom(p.yaw, p.pitch, _d); _r.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
      G.camH = G.lerp(G.camH || 1.62, G.eyeY(p) - p.pos.y + 0.07, Math.min(1, dt * 14));
      _c.set(p.pos.x, p.pos.y + G.camH, p.pos.z);
      _t.copy(_c).addScaledVector(_d, -back).addScaledVector(_r, side); _t.y += 0.28;
      _d.subVectors(_t, _c); const len = _d.length(); _d.multiplyScalar(1 / len);
      const hit = G.rayWorld(_c, _d, len + 0.25);
      cam.position.copy(_c).addScaledVector(_d, Math.max(0.3, Math.min(len, hit.t - 0.25)));
      if (w && !p.buildMode) fov = 75 / G.lerp(1, w.zoom || 1, p.adsK);
    }
    cam.rotation.set(p.pitch + kick, p.yaw, 0, 'YXZ');
  }
  if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  p.av.root.visible = p.alive && !scoped;
  document.getElementById('scope').classList.toggle('hidden', !scoped);
  // aim ray: from the camera, starting level with the player's eye so nothing behind you blocks shots
  G.dirFrom(p.yaw, p.pitch, p.aimD);
  _e.set(p.pos.x, G.eyeY(p), p.pos.z);
  const t0 = Math.max(0, _t.subVectors(_e, cam.position).dot(p.aimD));
  p.aimO.copy(cam.position).addScaledVector(p.aimD, t0);
}
G.update = dt => {
  const m = G.match; if (!m) return;
  G.time += dt;
  if (m.phase === 'count') {
    m.timer -= dt;
    const c = Math.ceil(m.timer);
    if (c !== lastCount && c <= 3 && m.timer < 2.4) { lastCount = c; if (c > 0) { G.ui.center(String(c), '', 0.9, 'count'); G.audio.countdown(false); } }
    if (m.timer <= 0) { m.phase = 'play'; G.ui.center('FIGHT!', '', 0.8, 'count'); G.audio.countdown(true); }
  } else if (m.phase === 'play') {
    m.t += dt;
    stormUpdate(dt);
    for (const a of G.actors) if (!a.alive && a.respawnT > 0) { a.respawnT -= dt; if (a.respawnT <= 0) respawn(a); }
  } else if (m.phase === 'roundEnd') {
    m.timer -= dt;
    if (m.timer <= 0) { if (m.final) { endMatch(); return; } m.round++; startRound(); }
  }
  if (m.phase === 'end') return;
  if (G.player.alive) playerInput();
  if (!G.bot.puppet) G.botThink(G.bot, dt);
  for (const a of G.actors) G.actorUpdate(a, dt);
  G.rocketsUpdate(dt); G.buildUpdate(dt); G.fxUpdate(dt);
  updateCamera(dt);
  const p = G.player;
  G.editUpdate(p, G.mouse.l);
  G.showGhost(p.alive && p.buildMode && !p.editing && m.phase !== 'roundEnd' ? G.buildTarget(p, p.buildMode, p.yaw, p.pitch) : null);
  G.sunFocus(p.pos); G.barrierUpdate(p.pos); G.sceneryUpdate(dt);
  G.ui.update(dt);
};
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  if (!G.match) { G.time += dt; G.lobby.update(dt); G.lobby.render(); return; }
  // a party match keeps running behind the pause menu: your friend is still playing
  if ((!G.paused || G.netMatch) && G.match.phase !== 'end') G.update(dt);
  G.renderer.render(G.scene, G.camera);
}
// test hooks: the hidden Browser pane pauses rAF, so tests drive the sim directly
G.tick = (n = 60, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) { if (G.match && !G.paused && G.match.phase !== 'end') G.update(dt); else if (!G.match) { G.time += dt; G.lobby.update(dt); } }
  if (G.match) G.renderer.render(G.scene, G.camera); else G.lobby.render();
};
})();
