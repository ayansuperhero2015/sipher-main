'use strict';
// Boot, renderer + post, main loop, attract mode, pause, quality, test hooks.
G.quality = { shadow: 2048 };

G.boot = () => {
  const fill = document.getElementById('ld-fill'), prog = p => { fill.style.width = (p * 100) + '%'; };
  G.load();
  const R = G.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  R.setSize(innerWidth, innerHeight);
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
  document.getElementById('game').appendChild(R.domElement);
  G.scene = new THREE.Scene();
  G.cam = new THREE.PerspectiveCamera(G.settings.fov, innerWidth / innerHeight, 0.03, 2000);
  G.cam.rotation.order = 'YXZ';
  G.scene.add(G.cam);
  prog(0.2);
  G.portals.init(); G.fx.init(); G.vm.init(); G.ui.init(); G.initInput(R.domElement);
  // post: scene -> viewmodel overlay -> bloom -> tonemap/output
  G.buildComposer();
  G.applyQuality();
  prog(0.5);
  addEventListener('resize', G.onResize);
  addEventListener('pointerdown', () => G.audio.init(), { once: true });
  addEventListener('keydown', () => G.audio.init(), { once: true });
  G.onPauseKey = code => {
    if (G.state !== 'playing' || G.match.state === 'ended') return;
    if (!G.paused) G.setPaused(true);
  };
  document.querySelector('.ld-sub').textContent = 'LOADING MODELS';
  G.assets.load(p => prog(0.5 + p * 0.45)).then(() => {
    G.startAttract(G.ui.sel.map);
    prog(1);
    G.ui.showMenu();
    const ld = document.getElementById('loading'); ld.style.opacity = 0; setTimeout(() => ld.remove(), 600);
    G.last = performance.now();
    requestAnimationFrame(G.frame);
  });
};

G.buildComposer = () => {
  const R = G.renderer, pr = R.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: G.settings.quality === 'low' ? 0 : 4 });
  const C = G.composer = new TA.EffectComposer(R, rt);
  C.addPass(G.mainPass = new TA.RenderPass(G.scene, G.cam));
  const vp = G.vmPass = new TA.RenderPass(G.vm.scene, G.vm.cam); vp.clear = false; vp.clearDepth = true; C.addPass(vp);
  G.bloom = new TA.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.45, 0.9);
  C.addPass(G.bloom);
  C.addPass(new TA.OutputPass());
  // film finish, in display space: per-map lift/gain, saturation, vignette, fine grain, slight lens fringe
  G.grade = new TA.ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uSat: { value: 1 }, uVig: { value: 0.32 }, uGrain: { value: 0.035 }, uCA: { value: 0.0025 },
      uLift: { value: new THREE.Vector3(0.02, 0.015, 0.03) }, uGain: { value: new THREE.Vector3(1.03, 1.0, 0.96) }, uAspect: { value: 1.7 }, uFade: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uSat, uVig, uGrain, uCA, uAspect, uFade; uniform vec3 uLift, uGain; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = vUv - 0.5; float r2 = dot(c, c);
        vec2 o = c * r2 * uCA * 4.0;
        vec3 col = vec3(texture2D(tDiffuse, vUv - o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + o).b);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, uSat);
        col = col * uGain + uLift * (1.0 - col);
        float v = smoothstep(1.05, 0.25, length(c * vec2(uAspect * 0.62, 1.0)) * 1.15);
        col *= mix(1.0 - uVig, 1.0, v);
        col += (h(vUv * vec2(1931.0, 1087.0) + fract(uTime * 13.0)) - 0.5) * uGrain;
        col = mix(col, vec3(0.0), uFade);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  C.addPass(G.grade);
};
G.gradeFor = (t) => {
  const g = t.grade || {};
  G.grade.uniforms.uLift.value.set(...(g.lift || [0.02, 0.015, 0.03]));
  G.grade.uniforms.uGain.value.set(...(g.gain || [1.03, 1.0, 0.96]));
};

G.applyQuality = () => {
  const q = G.settings.quality, R = G.renderer;
  const pr = q === 'low' ? 0.75 : q === 'medium' ? 1 : Math.min(devicePixelRatio || 1, 1.5);
  R.setPixelRatio(pr);
  R.setSize(innerWidth, innerHeight);
  R.shadowMap.enabled = q !== 'low';
  G.quality.shadow = q === 'high' ? 2048 : 1024;
  if (G.world.sun) { G.world.sun.castShadow = q !== 'low'; G.world.sun.shadow.mapSize.set(G.quality.shadow, G.quality.shadow); if (G.world.sun.shadow.map) { G.world.sun.shadow.map.dispose(); G.world.sun.shadow.map = null; } }
  if (G.composer) { G.composer.setPixelRatio(pr); G.composer.setSize(innerWidth, innerHeight); }
  if (G.bloom) G.bloom.enabled = q !== 'low';
  G.portals.setQuality(q === 'low' ? 2 : q === 'medium' ? 4 : 6, q === 'low' ? 0.45 : q === 'medium' ? 0.6 : 0.75);
  // materials need a recompile when shadows toggle
  G.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
};

G.onResize = () => {
  G.renderer.setSize(innerWidth, innerHeight);
  G.composer.setSize(innerWidth, innerHeight);
  G.cam.aspect = innerWidth / innerHeight; G.cam.updateProjectionMatrix();
  G.portals.resize();
};

// ---------------------------------------------------------------- flow
G.startAttract = (mapId) => {
  G.state = 'menu'; G.paused = false; G.timeScale = 1;
  G.match.start({ mode: 'tdm', map: mapId, attract: true, difficulty: 1, mutators: {} });
  G.attract = { a: Math.random() * 6, follow: null, t: 0 };
  if (G.audio.sfx) G.audio.sfx.gain.value = 0.35;
};
G.startMatch = (sel) => {
  const s = G.save;
  s.lastMode = sel.mode; s.lastMap = sel.map; s.difficulty = sel.difficulty; s.mutators = Object.assign({}, sel.mutators); G.store();
  G.audio.init();
  if (G.audio.sfx) G.audio.sfx.gain.value = 1;
  G.state = 'playing'; G.paused = false; G.timeScale = 1;
  G.match.start({ mode: sel.mode, map: sel.map, difficulty: sel.difficulty, mutators: sel.mutators, roster: sel.roster });
  G.cam.fov = G.settings.fov;
  G.ui.showHud();
  G.lock();
};
G.toMenu = () => {
  G.unlock();
  G.startAttract(G.ui.sel.map);
  G.ui.showMenu();
};
G.setPaused = (on, silent) => {
  if (G.state !== 'playing') return;
  G.paused = on;
  G.ui.showPause(on);
  G.audio.loop('jet', 'jet', false);
  if (on) G.unlock(); else if (!silent) G.lock();
};
G.hitstop = (scale, dur) => {
  if (G.match.state === 'ended') return;
  G.timeScale = scale; clearTimeout(G._hs); G._hs = setTimeout(() => { if (G.match.state !== 'ended') G.timeScale = 1; }, dur * 1000);
};

// ---------------------------------------------------------------- loop
G.frame = (now) => {
  requestAnimationFrame(G.frame);
  const rdt = Math.min(0.05, (now - G.last) / 1000); G.last = now;
  G.step(rdt);
  G.render();
};
G.step = (rdt) => {
  // a party match keeps running behind the pause menu (your friends are still playing), without your inputs
  if (G.paused && !G.netMatch) { G.endInputFrame(); return; }
  if (G.paused) { G.input.keys = {}; G.endInputFrame(); }
  const dt = rdt * G.timeScale;
  G.t += dt; G.uTime.value = G.t; G.frameN = (G.frameN || 0) + 1;
  G.match.update(dt);
  for (const a of G.actors) { a.update(dt); a.updateModel(dt); }
  G.weapons.update(dt);
  G.portals.update(dt);
  G.world.update(dt);
  if (G.state === 'menu' || !G.player) G.attractCam(rdt);
  G.fx.update(dt, G.cam);
  if (G.state === 'playing' && G.player) G.ui.update(rdt);
  const L = G.audio.listener; L.pos.copy(G.cam.position); L.right.set(1, 0, 0).applyQuaternion(G.cam.quaternion);
  G.endInputFrame();
};
// Menu camera: a cut list of slow, motivated shots (crane, floor dolly, tracking a runner, push into a door).
G.attractCam = (dt) => {
  const A = G.attract, map = G.world.map, c = map.cam, cam = G.cam;
  A.t += dt; A.shotT = (A.shotT ?? 99) + dt;
  if (!A.shot || A.shotT > A.shot.dur) {
    A.shotT = 0;
    const kinds = ['crane', 'dolly', 'track', 'door', 'dolly', 'track'];
    let k = kinds[(A.n = (A.n ?? Math.floor(Math.random() * 6)) + 1) % kinds.length];
    const doors = G.portals.list.filter(p => p.linked);
    const runners = G.actors.filter(a => a.alive);
    if (k === 'door' && !doors.length) k = 'crane';
    if (k === 'track' && !runners.length) k = 'dolly';
    const [x0, x1, z0, z1] = map.bounds;
    const s = { kind: k, dur: G.rand(6.5, 9) };
    if (k === 'crane') { s.a = Math.random() * 6.28; s.dir = Math.random() < 0.5 ? 1 : -1; }
    if (k === 'dolly') {
      // pick a ground node and glide 14 m across it, low, looking ahead
      // try a few random lines until one has clear air the whole way and a clear view of its look point
      const N = G.world.nav.nodes, W = G.world;
      for (let tries = 0; tries < 24; tries++) {
        const n = N[Math.floor(Math.random() * N.length)], ang = Math.random() * 6.28;
        const p0 = new THREE.Vector3(n.x, n.y + 1.1, n.z), dirV = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
        const p1 = p0.clone().addScaledVector(dirV, 14);
        const look = new THREE.Vector3(G.clamp(n.x, x0 * 0.3, x1 * 0.3), n.y + 1.6, G.clamp(n.z, z0 * 0.3, z1 * 0.3));
        if (look.distanceTo(p0) < 10) continue;
        const ok = W.los(p0, p1) && W.los(p0, look) && W.los(p1, look) &&
          [0, 0.5, 1].every(u => { const q = p0.clone().lerp(p1, u); return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => W.los(q, new THREE.Vector3(q.x + dx * 1.2, q.y, q.z + dz * 1.2))); });
        if (ok || tries === 23) { s.p0 = p0; s.dirV = dirV; s.look = look; if (!ok) s.kind = 'crane', s.a = Math.random() * 6.28, s.dir = 1; break; }
      }
    }
    if (k === 'track') { s.who = G.pick(runners); s.side = Math.random() < 0.5 ? 1 : -1; }
    if (k === 'door') { s.door = G.pick(doors); }
    A.shot = s; A.cutFade = 1;
  }
  const s = A.shot, u = A.shotT / s.dur, ease = u * u * (3 - 2 * u);
  if (s.kind === 'crane') {
    const a = s.a + s.dir * u * 0.5, r = c.r * G.lerp(1.05, 0.85, ease), h = c.h * G.lerp(0.55, 1.05, ease);
    cam.position.set(Math.cos(a) * r, h, Math.sin(a) * r); cam.lookAt(c.look[0], c.look[1], c.look[2]); cam.fov = 48;
  } else if (s.kind === 'dolly') {
    cam.position.copy(s.p0).addScaledVector(s.dirV, ease * 14);
    if (G.world.pointSolid(cam.position.x, cam.position.y, cam.position.z)) s.dur = 0;
    cam.lookAt(s.look); cam.fov = 40;
  } else if (s.kind === 'track') {
    const w = s.who;
    if (!w.alive) { s.dur = 0; }
    const f = G.fwdFrom(w.yaw, 0), side = new THREE.Vector3(-f.z, 0, f.x).multiplyScalar(s.side);
    const want = w.pos.clone().addScaledVector(f, -4.5).addScaledVector(side, 2.2); want.y += 2.1;
    if (!A.trackPos || A.shotT < 0.05) A.trackPos = want.clone();
    A.trackPos.lerp(want, Math.min(1, dt * 2.2));
    // spring arm: never let a wall come between the runner and the lens
    const head = new THREE.Vector3(w.pos.x, w.pos.y + 1.7, w.pos.z), arm = A.trackPos.clone().sub(head), len = arm.length();
    arm.divideScalar(len || 1);
    const hit = G.world.raycast(head.x, head.y, head.z, arm.x, arm.y, arm.z, len + 0.4, null);
    cam.position.copy(hit ? head.clone().addScaledVector(arm, Math.max(0.6, hit.t - 0.45)) : A.trackPos);
    cam.lookAt(w.pos.x + f.x * 6, w.pos.y + 1.3, w.pos.z + f.z * 6); cam.fov = 52;
  } else if (s.kind === 'door') {
    const p = s.door;
    if (!p.linked) s.dur = 0;
    const d = G.lerp(9, 2.6, ease);
    cam.position.copy(p.center).addScaledVector(p.normal, d).addScaledVector(p.right, 1.2 * (1 - ease));
    if (p.normal.y < 0.5) cam.position.y = p.center.y + 0.2;
    cam.lookAt(p.center); cam.fov = 50;
  }
  A.cutFade = Math.max(0, (A.cutFade || 0) - dt * 2.5);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
};
G.render = () => {
  const R = G.renderer;
  R.shadowMap.needsUpdate = true;
  const p = G.player;
  const hideBody = h => { if (p) p.model.visible = !h && p.alive; };
  G.portals.render(G.cam, G.scene, hideBody);
  hideBody(true);
  G.vmPass.enabled = !!(p && p.alive && G.state === 'playing' && G.match.state !== 'ended');
  const gu = G.grade.uniforms;
  gu.uTime.value = G.t; gu.uAspect.value = innerWidth / innerHeight;
  const dead = p && !p.alive && G.state === 'playing';
  gu.uSat.value = G.damp(gu.uSat.value, dead ? 0.25 : G.match.state === 'ended' ? 0.6 : 1, 4, 1 / 60);
  gu.uFade.value = G.state === 'menu' && G.attract ? (G.attract.cutFade || 0) : 0;
  G.composer.render();
};

// ---------------------------------------------------------------- test hooks
G.tick = (n = 1, dt = 1 / 60, render = false) => { for (let i = 0; i < n; i++) G.step(dt); if (render) G.render(); return G.t; };
G.debug = () => ({
  state: G.state, match: G.match.state, mode: G.match.mode, scores: G.match.scores.slice(), time: G.match.timeLeft,
  actors: G.actors.map(a => ({ n: a.name, t: a.team, alive: a.alive, k: a.stats.kills, d: a.stats.deaths, pos: a.pos.toArray().map(v => +v.toFixed(1)), doors: a.stats.doors })),
  portals: G.portals.list.filter(p => p.placed).length,
});
