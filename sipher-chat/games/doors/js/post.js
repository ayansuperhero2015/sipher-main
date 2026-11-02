// Post: full-screen fear shader, positional entity audio, death cam, Rush darkness,
// hiding reactions, chase music and rebuilt Figure / Seek models.
(() => {
'use strict';
const V3 = THREE.Vector3;
const A = G.audio, U = G.ui;
const P = G.post = { glitch: 0, warp: 0, dark: 0, pulse: 0, deathCam: null, jsDelay: 0, t: 0 };

/* =====================================================================
   Fear shader
   ===================================================================== */
const FS = `
uniform sampler2D tDiffuse;
uniform float uTime, uFear, uGlitch, uWarp, uPulse, uDark;
uniform vec2 uRes;
varying vec2 vUv;
float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  // lens squeeze + sickly wobble
  uv += c * r2 * (0.08 * uFear + 0.35 * uWarp);
  uv.x += sin(uv.y * 38.0 + uTime * 17.0) * 0.005 * uWarp;
  uv.y += sin(uv.x * 27.0 + uTime * 11.0) * 0.004 * uWarp;
  // torn scanline bands
  float row = floor(uv.y * 48.0);
  float band = step(0.992 - uGlitch * 0.3, rand(vec2(row, floor(uTime * 24.0))));
  uv.x += band * (rand(vec2(uTime, row)) - 0.5) * 0.2 * uGlitch;
  // chromatic split grows with fear
  vec2 dir = c * (0.003 + 0.012 * uFear + 0.035 * uGlitch);
  vec3 col;
  col.r = texture2D(tDiffuse, uv + dir).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dir).b;
  // drain the colour, crush the light
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l) * vec3(1.05, 0.95, 0.9), 0.5 * uFear);
  col *= 1.0 - uDark;
  // heartbeat flushes the edges red
  col.r += uPulse * 0.25 * r2 * (0.3 + uFear);
  // vignette tightens
  float d = length(c) * (1.0 + 0.6 * uFear);
  col *= mix(0.12, 1.0, 1.0 - smoothstep(0.22, 0.8, d));
  // film grain, heavier when scared
  float gr = rand(uv * uRes + fract(uTime * 7.13) * 91.0) - 0.5;
  col += gr * (0.04 + 0.08 * uFear + 0.1 * uGlitch) * (0.25 + l);
  // white-out flicker during glitches
  col += step(0.97, rand(vec2(floor(uTime * 30.0), 1.0))) * uGlitch * 0.35;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
P.init = () => {
  const r = G.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
  P.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  P.mat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: P.rt.texture }, uTime: { value: 0 }, uFear: { value: 0 }, uGlitch: { value: 0 },
      uWarp: { value: 0 }, uPulse: { value: 0 }, uDark: { value: 0 }, uRes: { value: size.clone() },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FS, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), P.mat); quad.frustumCulled = false;
  P.scene = new THREE.Scene(); P.scene.add(quad);
  P.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // A strobing light travels with Rush so it is seen in flashes as the room goes dark.
  P.rushLight = new THREE.PointLight(0xbfd8ff, 0, 14, 1.6); G.scene.add(P.rushLight);
  patchGame();
};
P.render = dt => {
  const r = G.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
  if (size.x !== P.rt.width || size.y !== P.rt.height) { P.rt.setSize(size.x, size.y); P.mat.uniforms.uRes.value.copy(size); }
  P.t += dt;
  if (G.assets) G.assets.update(dt);
  drive(dt);
  const u = P.mat.uniforms;
  u.uTime.value = P.t; u.uFear.value = G.fear ? G.fear.level : 0;
  u.uGlitch.value = P.glitch; u.uWarp.value = P.warp; u.uPulse.value = P.pulse; u.uDark.value = P.dark;
  r.setRenderTarget(P.rt); r.render(G.scene, G.camera);
  r.setRenderTarget(null); r.render(P.scene, P.cam);
};
P.kick = (glitch, warp) => { P.glitch = Math.max(P.glitch, glitch); P.warp = Math.max(P.warp, warp); };

/* =====================================================================
   Per-frame drivers
   ===================================================================== */
const tmpObj = new THREE.PerspectiveCamera(); // a camera, so lookAt aims -Z like the real one
let chaseLoop = null;
function drive(dt) {
  const g = G.game, cam = G.camera;
  P.glitch = Math.max(0, P.glitch - dt * 1.4);
  P.warp = Math.max(0, P.warp - dt * 0.9);
  P.pulse = Math.max(0, P.pulse - dt * 3);
  let near = 0;
  if (g.state === 'play') {
    const rush = g.rush;
    if (rush && rush.pos && rush.t >= 0 && rush.sprite.visible) near = G.clamp(1 - rush.pos.distanceTo(cam.position) / 24, 0, 1);
    P.warp = Math.max(P.warp, near * 0.9, G.player.hp < 35 ? 0.18 : 0, g.seek ? 0.12 : 0);
    if (near > 0.6) P.glitch = Math.max(P.glitch, (near - 0.6) * 2);
    if (g.a90) P.glitch = Math.max(P.glitch, 0.9);
    if (g.screech && g.screech.t > 1.6) P.glitch = Math.max(P.glitch, 0.35);
    // darkness swallows the room as Rush arrives; it shows itself in strobes
    const peeking = rush && rush._peekT > 0 && rush._peekAt;
    P.dark += ((peeking ? 0 : near * 0.5) - P.dark) * Math.min(1, dt * 6);
    if (peeking) {
      // Light its face so it is unmistakable through the slats.
      P.rushLight.position.copy(rush._peekAt).lerp(cam.position, 0.45);
      P.rushLight.intensity = G.rand(14, 22);
    } else if (rush && rush.pos && rush.sprite.visible) {
      P.rushLight.position.copy(rush.pos);
      P.rushLight.intensity = Math.random() < 0.35 ? G.rand(18, 40) : G.rand(0, 3);
    } else P.rushLight.intensity = 0;
    spatial(g, dt);
    if (G.dread) G.dread.update(dt, g);
    hidingFx(g, near);
    chaseMusic(g);
  } else { P.dark = Math.max(0, P.dark - dt); P.rushLight.intensity = 0; }
  // death cam: snap to face the killer
  const dc = P.deathCam;
  if (dc) {
    dc.t += dt;
    tmpObj.position.copy(cam.position); tmpObj.lookAt(dc.target);
    cam.quaternion.slerp(tmpObj.quaternion, Math.min(1, dt * 16));
    cam.fov += (48 - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix();
    if (dc.t > 1.6) P.deathCam = null;
  }
  A.listen(cam);
}
function entPos(e) {
  if (e.pos && e.pos.isVector3) return e.pos;
  if (e.sprite && e.sprite.visible) return e.sprite.position;
  if (e.m) return e.m.position;
  return null;
}
function spatial(g, dt) {
  for (const e of g.ents) {
    const p = entPos(e);
    if (p && e.snd && e.snd.at) e.snd.at(p, !G.los(G.camera.position, p, g.cols));
  }
  // heavy footfalls you can place in the dark
  for (const f of g.figures) {
    f._lw = f._lw === undefined ? f.walk : f._lw;
    if (f.walk - f._lw > (f.state === 'chase' ? 2.0 : 2.8)) {
      f._lw = f.walk;
      const d = G.distXZ(f.pos, G.player.pos);
      if (d < 28) A.sfxAt('thud', f.pos.clone().setY(f.pos.y + 0.3));
    }
  }
  if (g.seek) {
    const dr = g.seek.m.userData.drips;
    if (dr) dr.forEach(d => { d.m.scale.y = d.base * (1 + 0.45 * Math.sin(P.t * 3 + d.ph)); });
  }
}
function hidingFx(g, near) {
  const el = document.getElementById('hide-overlay');
  if (!G.player.hiding) { el.classList.remove('tense', 'rattle'); return; }
  const lv = G.fear ? G.fear.level : 0;
  el.classList.toggle('rattle', near > 0.45);
  el.classList.toggle('tense', near <= 0.45 && lv > 0.4);
  if (near > 0.45) G.player.shake = Math.max(G.player.shake, near * 0.6);
}
function chaseMusic(g) {
  const chasing = g.figures.some(f => f.state === 'chase' && G.distXZ(f.pos, G.player.pos) < 22);
  if (chasing && !chaseLoop) { chaseLoop = A.loop('chase'); chaseLoop.set(0.75, 0.2); A.sfx('sting'); }
  else if (!chasing && chaseLoop) { chaseLoop.stop(); chaseLoop = null; }
}
P.stopMusic = () => { if (chaseLoop) { chaseLoop.stop(); chaseLoop = null; } };

/* =====================================================================
   Hooks into the game (installed once main.js exists)
   ===================================================================== */
function patchGame() {
  const g = G.game;
  const kill0 = g.kill;
  g.kill = function (source, ent) {
    if (this.state !== 'play' || this.escaping) return kill0.call(this, source, ent);
    const p = ent && entPos(ent);
    P.jsDelay = p ? 0.38 : 0.12;
    kill0.call(this, source, ent);
    if (this.state === 'dead') {
      P.kick(1, 1); P.stopMusic();
      if (p) P.deathCam = { target: p.clone().add(new V3(0, ent.m ? 2.5 : 0, 0)), t: 0 };
      A.sfx('thud');
    }
    P.jsDelay = 0;
  };
  const dmg0 = g.damage;
  g.damage = function (a, s) { dmg0.call(this, a, s); if (a > 0 && this.state === 'play') P.kick(0.45, 0.3); };
  const start0 = g.start;
  g.start = function (id) { P.deathCam = null; P.glitch = P.warp = P.dark = 0; P.stopMusic(); return start0.call(this, id); };
  const lobby0 = g.toLobby;
  g.toLobby = function () { P.deathCam = null; P.stopMusic(); return lobby0.call(this); };
  // Delay the jumpscare a beat so the death cam shows the killer first.
  const js0 = U.jumpscare;
  U.jumpscare = (face, dur) => {
    if (P.jsDelay > 0) { const d = P.jsDelay; P.jsDelay = 0; setTimeout(() => js0(face, dur), d * 1000); }
    else js0(face, dur);
    P.kick(1, 0.8);
  };
  // Heartbeats flush the screen; ambient scares come from a direction.
  const sfx0 = A.sfx;
  const around = (dist, behind) => {
    const cam = G.camera, f = G.camForward(new V3()).setY(0).normalize();
    const a = behind ? Math.PI + G.rand(-0.6, 0.6) : G.rand(0, Math.PI * 2);
    return cam.position.clone().add(f.applyAxisAngle(new V3(0, 1, 0), a).multiplyScalar(dist));
  };
  A.sfx = (name, o) => {
    if (name === 'heartbeat') P.pulse = 1;
    if (G.game.state === 'play' && !A._route) {
      if (name === 'footsteps') return A.sfxAt(name, around(4, true), o);
      if (name === 'knock') return A.sfxAt(name, around(7), o);
      if (name === 'groan') return A.sfxAt(name, around(9), o);
      if (name === 'whisper') {
        const right = new V3(1, 0, 0).applyQuaternion(G.camera.quaternion).multiplyScalar(G.chance(0.5) ? 0.6 : -0.6);
        return A.sfxAt(name, G.camera.position.clone().add(right), o);
      }
    }
    return sfx0(name, o);
  };
}

/* =====================================================================
   Sounds
   ===================================================================== */
const kit = A.kit;
A.LOOPS.chase = (g, n) => {
  const b = kit.gain(0.32, g); kit.osc('sawtooth', 55, b, n); kit.lfo(3.4, 0.3, b.gain, n, 'square');
  const c = kit.gain(0.05, g); const o = kit.osc('sawtooth', 233, c, n); kit.lfo(6.8, 0.05, c.gain, n, 'square'); kit.lfo(0.2, 12, o.frequency, n);
  const d = kit.gain(0.04, g); kit.osc('triangle', 349, d, n); kit.osc('triangle', 370, d, n);
  kit.nsrc(kit.gain(0.18, g), n, 'bandpass', 90, 1.2);
};

/* =====================================================================
   Models
   ===================================================================== */
const fleshTex = (() => {
  let t;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#6a1a12'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) { const g = x.createRadialGradient(Math.random() * 256, Math.random() * 256, 0, 0, 0, 0); x.fillStyle = `rgba(${G.randi(20, 60)},0,0,${G.rand(0.2, 0.5)})`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, G.rand(6, 30), 0, 7); x.fill(); void g; }
    x.strokeStyle = 'rgba(30,0,0,0.6)';
    for (let i = 0; i < 40; i++) { let px = Math.random() * 256, py = Math.random() * 256; x.lineWidth = G.rand(0.6, 2); x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += G.rand(-18, 18); py += G.rand(-18, 18); x.lineTo(px, py); } x.stroke(); }
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
})();
const GEO = () => G.geo;
function blob(parent, mat, x, y, z, sx, sy, sz, rx = 0, rz = 0) {
  const m = new THREE.Mesh(GEO().sphere, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, 0, rz); parent.add(m); return m;
}
G.models.figure = () => {
  const g = new THREE.Group();
  const flesh = new THREE.MeshStandardMaterial({ map: fleshTex(), color: 0xc06050, roughness: 0.32, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x250404, roughness: 0.45 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.35 });
  const body = new THREE.Group(); g.add(body);
  blob(body, flesh, 0, 1.55, 0, 0.27, 0.2, 0.2);
  // hunched, knotted spine
  for (let i = 0; i < 8; i++) {
    const t = i / 7, y = 1.65 + t * 1.0, z = Math.pow(t, 1.4) * 0.32;
    blob(body, flesh, 0, y, z, 0.3 - t * 0.07, 0.22, 0.2);
    blob(body, bone, 0, y, z - 0.19, 0.05, 0.05, 0.05);
  }
  for (let i = 0; i < 5; i++) {
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.25 - i * 0.012, 0.018, 5, 14, Math.PI * 1.3), bone);
    tor.position.set(0, 1.92 + i * 0.12, 0.08 + i * 0.04); tor.rotation.set(Math.PI / 2, 0, Math.PI * 0.85); body.add(tor);
  }
  blob(body, flesh, 0, 2.78, 0.36, 0.09, 0.2, 0.09, 0.6);
  const head = new THREE.Group(); head.position.set(0, 3.0, 0.46); body.add(head);
  blob(head, flesh, 0, 0.05, 0, 0.25, 0.38, 0.28);
  blob(head, flesh, 0, 0.32, -0.05, 0.17, 0.12, 0.2);
  blob(head, dark, 0, -0.03, 0.17, 0.13, 0.28, 0.1);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, tooth = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 4), bone);
    tooth.position.set(Math.cos(a) * 0.11, -0.03 + Math.sin(a) * 0.24, 0.22);
    tooth.rotation.z = a + Math.PI / 2; tooth.rotation.x = 0.3;
    head.add(tooth);
  }
  for (let i = 0; i < 5; i++) blob(head, flesh, G.rand(-0.18, 0.18), G.rand(0, 0.3), G.rand(-0.1, 0.15), 0.06, 0.05, 0.06);
  const limbs = [];
  const finger = (parent, x) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.42, 5), dark); f.position.set(x, -0.22, 0.02); f.rotation.x = Math.PI; f.rotation.z = x * 1.5; parent.add(f); };
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.38, 2.5, 0.22); body.add(arm);
    blob(arm, flesh, 0, -0.5, 0, 0.07, 0.55, 0.07);
    const fore = new THREE.Group(); fore.position.set(0, -1.0, 0); fore.rotation.x = -0.35; arm.add(fore);
    blob(fore, flesh, 0, -0.5, 0, 0.055, 0.55, 0.055);
    const hand = new THREE.Group(); hand.position.set(0, -1.05, 0); fore.add(hand);
    blob(hand, dark, 0, 0, 0, 0.07, 0.09, 0.04);
    [-0.06, -0.02, 0.02, 0.06].forEach(fx => finger(hand, fx));
    const leg = new THREE.Group(); leg.position.set(s * 0.17, 1.5, 0); g.add(leg);
    blob(leg, flesh, 0, -0.4, 0, 0.11, 0.45, 0.11);
    const shin = new THREE.Group(); shin.position.set(0, -0.8, 0); shin.rotation.x = 0.3; leg.add(shin);
    blob(shin, flesh, 0, -0.38, 0, 0.075, 0.42, 0.075);
    blob(shin, dark, 0, -0.78, 0.08, 0.08, 0.04, 0.16);
    limbs.push(arm, leg);
  }
  g.userData = { body, limbs, head };
  return g;
};
G.models.seek = () => {
  const g = new THREE.Group();
  const goo = new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.06, metalness: 0.35 });
  const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xd8d8d8, emissiveIntensity: 0.9, roughness: 0.2 });
  const eyeB = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const body = new THREE.Group(); g.add(body);
  for (let i = 0; i < 6; i++) blob(body, goo, G.rand(-0.04, 0.04), 1.1 + i * 0.22, 0, 0.3 - i * 0.015, 0.2, 0.24);
  blob(body, goo, 0, 2.55, 0.05, 0.3, 0.42, 0.3);
  blob(body, eyeW, 0, 2.6, 0.27, 0.19, 0.12, 0.08);
  blob(body, eyeB, 0, 2.6, 0.335, 0.075, 0.075, 0.03);
  const veins = new THREE.MeshBasicMaterial({ color: 0x700000 });
  for (let i = 0; i < 6; i++) { const v = blob(body, veins, G.rand(-0.15, 0.15), 2.6 + G.rand(-0.1, 0.1), 0.33, 0.06, 0.006, 0.01); v.rotation.z = G.rand(0, 3); }
  const limbs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.36, 2.15, 0); body.add(arm);
    blob(arm, goo, 0, -0.7, 0, 0.08, 0.75, 0.08);
    for (let k = 0; k < 4; k++) { const f = blob(arm, goo, (k - 1.5) * 0.04, -1.5, 0.03, 0.02, 0.18, 0.02); f.rotation.z = (k - 1.5) * 0.15; }
    const leg = new THREE.Group(); leg.position.set(s * 0.16, 1.05, 0); g.add(leg);
    blob(leg, goo, 0, -0.52, 0, 0.11, 0.56, 0.11);
    limbs.push(arm, leg);
  }
  const drips = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(GEO().cyl, goo), base = G.rand(0.15, 0.6);
    m.scale.set(0.02, base, 0.02); m.position.set(G.rand(-0.3, 0.3), G.rand(0.9, 2.5) - base / 2, G.rand(-0.2, 0.25)); body.add(m);
    drips.push({ m, base, ph: Math.random() * 7 });
  }
  g.userData = { body, limbs, drips };
  return g;
};
})();
