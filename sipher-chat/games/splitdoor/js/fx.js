'use strict';
// Effects: additive particles, physical debris, tracers, scorch decals, flash lights, explosions, damage numbers.
G.fx = {
  init() {
    const S = G.scene;
    // ---- particles
    const N = this.N = 3500;
    this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3); this.pSize = new Float32Array(N); this.pAlpha = new Float32Array(N);
    this.pVel = new Float32Array(N * 3); this.pLife = new Float32Array(N); this.pMax = new Float32Array(N); this.pGrav = new Float32Array(N);
    this.pDrag = new Float32Array(N); this.pS0 = new Float32Array(N); this.pi = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const tex = G.radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    const uScale = { value: 400 };
    this.pMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: tex }, uScale },
      vertexShader: `attribute vec3 color; attribute float size; attribute float alpha; uniform float uScale; varying vec3 vC; varying float vA;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(-mv.z, 0.05); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D tex; varying vec3 vC; varying float vA; void main(){ float a = texture2D(tex, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.points = new THREE.Points(g, this.pMat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    this.points.onBeforeRender = (r, sc, cam) => {
      const rt = r.getRenderTarget(); const h = rt ? rt.height : r.getDrawingBufferSize(this._s2).y;
      uScale.value = h * 0.5 / Math.tan(THREE.MathUtils.degToRad(cam.fov || 70) / 2);
    };
    this._s2 = new THREE.Vector2();
    S.add(this.points);

    // ---- debris (chunky lit boxes)
    const DN = this.DN = 420;
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.4 }), DN);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.castShadow = true; this.debris.frustumCulled = false;
    this.dState = []; for (let i = 0; i < DN; i++) this.dState.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 0.1, life: 0, emi: 0 });
    const black = new THREE.Color(0, 0, 0); this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._sc = new THREE.Vector3();
    for (let i = 0; i < DN; i++) { this.debris.setMatrixAt(i, this._m4.makeScale(0, 0, 0)); this.debris.setColorAt(i, black); }
    this.di = 0; S.add(this.debris);

    // ---- tracers
    this.tracers = [];
    const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0, -0.5);
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false; m.renderOrder = 4; S.add(m); this.tracers.push({ m, life: 0, max: 1, w: 0.03 });
    }
    this.ti = 0;

    // ---- decals
    this.decals = [];
    const dg = new THREE.PlaneGeometry(1, 1), scorch = G.scorchTex();
    for (let i = 0; i < 140; i++) {
      const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ map: scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0.9 }));
      m.visible = false; S.add(m); this.decals.push(m);
    }
    this.dci = 0;

    // ---- flash lights (fixed count so shaders never recompile)
    this.lights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 14, 2); S.add(l); this.lights.push({ l, life: 0, max: 1, i0: 0 }); }
    this.li = 0;

    // ---- explosion shells
    this.shells = [];
    const sg = new THREE.SphereGeometry(1, 20, 14);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false; S.add(m); this.shells.push({ m, life: 0, max: 1, r0: 1, r1: 3 });
    }
    this.si = 0;
    // ---- muzzle sprites for third-person shots
    this.flashes = [];
    const fm = new THREE.SpriteMaterial({ map: tex, color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(fm.clone()); s.visible = false; S.add(s); this.flashes.push({ s, life: 0 }); }
    this.fi = 0;
    this.nums = [];
  },

  // ---------------------------------------------------------------- spawners
  spawn(p, v, col, size, life, grav = -9.8, drag = 1) {
    const i = this.pi; this.pi = (this.pi + 1) % this.N;
    this.pPos[i * 3] = p.x; this.pPos[i * 3 + 1] = p.y; this.pPos[i * 3 + 2] = p.z;
    this.pVel[i * 3] = v.x; this.pVel[i * 3 + 1] = v.y; this.pVel[i * 3 + 2] = v.z;
    this.pCol[i * 3] = col.r; this.pCol[i * 3 + 1] = col.g; this.pCol[i * 3 + 2] = col.b;
    this.pS0[i] = size; this.pSize[i] = size; this.pAlpha[i] = 1; this.pLife[i] = life; this.pMax[i] = life; this.pGrav[i] = grav; this.pDrag[i] = drag;
  },
  burst(pos, dir, color, n, speed, life, size, spread = 1, grav = -9.8, hdr = 1.6) {
    const c = G.col(color).multiplyScalar(hdr), v = new THREE.Vector3(), d = dir || G._cy;
    for (let i = 0; i < n; i++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(spread).add(d).normalize().multiplyScalar(speed * (0.35 + Math.random() * 0.65));
      this.spawn(pos, v, c, size * (0.6 + Math.random() * 0.8), life * (0.5 + Math.random() * 0.6), grav, 2);
    }
  },
  smoke(pos, n, col = '#555a60', size = 1.2, life = 1.4) {
    const c = G.col(col).multiplyScalar(0.25), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.set(G.rand(-1, 1), G.rand(0.4, 2), G.rand(-1, 1)); this.spawn(pos, v, c, size * G.rand(0.7, 1.4), life * G.rand(0.6, 1.2), 0.6, 1.5); }
  },
  debrisBurst(pos, color, n, speed, size = 0.12, emi = 0) {
    const c = G.col(color);
    for (let k = 0; k < n; k++) {
      const d = this.dState[this.di]; const idx = this.di; this.di = (this.di + 1) % this.DN;
      d.on = true; d.p.copy(pos).add(new THREE.Vector3(G.rand(-0.3, 0.3), G.rand(-0.3, 0.3), G.rand(-0.3, 0.3)));
      d.v.set(G.rand(-1, 1), G.rand(0.3, 1.6), G.rand(-1, 1)).normalize().multiplyScalar(speed * G.rand(0.4, 1));
      d.w.set(G.rand(-12, 12), G.rand(-12, 12), G.rand(-12, 12)); d.r.set(G.rand(0, 6), G.rand(0, 6), G.rand(0, 6));
      d.s = size * G.rand(0.6, 1.5); d.life = G.rand(2.5, 4.5); d.emi = emi;
      this.debris.setColorAt(idx, emi ? c.clone().multiplyScalar(2.2) : c);
    }
    this.debris.instanceColor.needsUpdate = true;
  },
  casing(pos, vel) {
    const d = this.dState[this.di], idx = this.di; this.di = (this.di + 1) % this.DN;
    d.on = true; d.p.copy(pos); d.v.copy(vel); d.w.set(G.rand(-20, 20), G.rand(-20, 20), G.rand(-20, 20)); d.r.set(0, 0, 0); d.s = 0.028; d.life = 1.6; d.emi = 0;
    this.debris.setColorAt(idx, this._brass || (this._brass = new THREE.Color('#c9a24a'))); this.debris.instanceColor.needsUpdate = true;
  },
  tracer(a, b, color, w = 0.03, life = 0.12) {
    const T = this.tracers[this.ti]; this.ti = (this.ti + 1) % this.tracers.length;
    const len = a.distanceTo(b); if (len < 0.05) return;
    T.m.position.copy(b); T.m.lookAt(a); T.m.scale.set(w, w, len);
    T.m.material.color.set(color).multiplyScalar(2.2); T.m.material.opacity = 1;
    T.m.visible = true; T.life = life; T.max = life; T.w = w;
  },
  decal(p, n, size = 0.25) {
    const m = this.decals[this.dci]; this.dci = (this.dci + 1) % this.decals.length;
    m.position.copy(p).addScaledVector(n, 0.01); m.lookAt(p.x + n.x, p.y + n.y, p.z + n.z); m.rotateZ(Math.random() * 6);
    m.scale.setScalar(size); m.visible = true; m.material.opacity = 0.85;
  },
  light(p, color, intensity, life, dist = 14) {
    const L = this.lights[this.li]; this.li = (this.li + 1) % this.lights.length;
    L.l.position.copy(p); L.l.color.set(color); L.l.distance = dist; L.i0 = intensity; L.l.intensity = intensity; L.life = life; L.max = life;
  },
  shell(p, color, r0, r1, life) {
    const S = this.shells[this.si]; this.si = (this.si + 1) % this.shells.length;
    S.m.position.copy(p); S.m.material.color.set(color).multiplyScalar(2.5); S.m.visible = true; S.life = life; S.max = life; S.r0 = r0; S.r1 = r1;
  },
  muzzle(p, color) {
    const F = this.flashes[this.fi]; this.fi = (this.fi + 1) % this.flashes.length;
    F.s.position.copy(p); F.s.material.color.set(color).lerp(new THREE.Color(1, 0.9, 0.7), 0.5).multiplyScalar(3); F.s.scale.setScalar(G.rand(0.5, 0.9)); F.s.visible = true; F.life = 0.05;
  },
  impact(p, n, color, flesh) {
    if (flesh) { this.burst(p, n, '#ff5a3c', 8, 4, 0.3, 0.06, 0.8); this.burst(p, n, '#ffd27a', 4, 6, 0.15, 0.05, 0.5); return; }
    this.burst(p, n, color, 7, 5, 0.25, 0.05, 0.7);
    this.burst(p, n, '#ffe6b0', 3, 2.5, 0.4, 0.04, 0.4, -12, 2.2);
    this.decal(p, n, G.rand(0.16, 0.24));
  },
  explosion(p, color = '#ff7a2a', scale = 1) {
    this.shell(p, '#fff1c8', 0.3 * scale, 3.2 * scale, 0.22);
    this.shell(p, color, 0.6 * scale, 5.5 * scale, 0.42);
    this.light(p, color, 60 * scale, 0.45, 18 * scale);
    this.burst(p, null, '#ffcf70', 55, 14 * scale, 0.6, 0.18 * scale, 1.2, -6);
    this.burst(p, null, color, 40, 9 * scale, 0.9, 0.3 * scale, 1.2, -3);
    this.smoke(p, 22, '#4a4440', 2.2 * scale, 1.8);
    this.debrisBurst(p, '#3a3c42', 8, 9, 0.12);
  },
  portalBurst(portal) {
    const c = portal.colorHex, n = portal.normal, ctr = portal.center;
    const v = new THREE.Vector3(), q = new THREE.Vector3(), col = G.col(c).multiplyScalar(2.2);
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * Math.PI * 2;
      q.copy(ctr).addScaledVector(portal.right, Math.cos(a) * G.PORTAL_W / 2).addScaledVector(portal.up, Math.sin(a) * G.PORTAL_H / 2);
      v.copy(n).multiplyScalar(G.rand(1.5, 5)).addScaledVector(portal.right, Math.cos(a) * G.rand(0.5, 2)).addScaledVector(portal.up, Math.sin(a) * G.rand(0.5, 2));
      this.spawn(q, v, col, G.rand(0.06, 0.12), G.rand(0.3, 0.6), -5, 2);
    }
    this.light(ctr.clone().addScaledVector(n, 0.8), c, 16, 0.5, 9);
  },
  number(pos, amount, head, shield) {
    if (!G.settings.hitNumbers) return;
    const host = document.getElementById('nums');
    let n = this.nums.find(x => !x.on);
    if (!n) { if (this.nums.length > 24) return; const el = document.createElement('div'); el.className = 'dmg'; host.appendChild(el); n = { el }; this.nums.push(n); }
    n.on = true; n.p = pos.clone(); n.p.y += 0.3; n.life = 0.8; n.vx = G.rand(-0.6, 0.6);
    n.el.textContent = Math.round(amount); n.el.className = 'dmg' + (head ? ' head' : '') + (shield ? ' sh' : '');
    n.el.style.display = 'block';
  },

  // ---------------------------------------------------------------- update
  update(dt, cam) {
    // particles
    const N = this.N, P = this.pPos, V = this.pVel;
    for (let i = 0; i < N; i++) {
      if (this.pLife[i] <= 0) { if (this.pAlpha[i] !== 0) { this.pAlpha[i] = 0; this.pSize[i] = 0; } continue; }
      this.pLife[i] -= dt;
      const k = Math.exp(-this.pDrag[i] * dt);
      V[i * 3] *= k; V[i * 3 + 1] = V[i * 3 + 1] * k + this.pGrav[i] * dt; V[i * 3 + 2] *= k;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      const t = Math.max(0, this.pLife[i] / this.pMax[i]);
      this.pAlpha[i] = t < 0.7 ? t / 0.7 : 1; this.pSize[i] = this.pS0[i] * (0.4 + 0.6 * t + (this.pGrav[i] > 0 ? (1 - t) * 1.5 : 0));
    }
    const ga = this.points.geometry.attributes;
    ga.position.needsUpdate = ga.color.needsUpdate = ga.size.needsUpdate = ga.alpha.needsUpdate = true;
    // debris
    let any = false;
    for (let i = 0; i < this.DN; i++) {
      const d = this.dState[i]; if (!d.on) continue; any = true;
      d.life -= dt;
      if (d.life <= 0) { d.on = false; this.debris.setMatrixAt(i, this._m4.makeScale(0, 0, 0)); continue; }
      d.v.y -= 20 * dt;
      const sp = d.v.length() * dt;
      if (sp > 0.0001) {
        const h = G.world.raycast(d.p.x, d.p.y, d.p.z, d.v.x / (sp / dt), d.v.y / (sp / dt), d.v.z / (sp / dt), sp + d.s * 0.5, null);
        if (h) {
          const n = h.normal; const vn = d.v.dot(n);
          d.v.addScaledVector(n, -1.5 * vn).multiplyScalar(0.55); d.w.multiplyScalar(0.6);
        } else d.p.addScaledVector(d.v, dt);
      }
      d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; d.r.z += d.w.z * dt;
      const s = d.s * Math.min(1, d.life / 0.6);
      this._q.setFromEuler(d.r); this._sc.set(s, s, s);
      this.debris.setMatrixAt(i, this._m4.compose(d.p, this._q, this._sc));
    }
    if (any || this._anyDebris) this.debris.instanceMatrix.needsUpdate = true;
    this._anyDebris = any;
    for (const T of this.tracers) {
      if (!T.m.visible) continue;
      T.life -= dt; if (T.life <= 0) { T.m.visible = false; continue; }
      const t = T.life / T.max; T.m.material.opacity = t; T.m.scale.x = T.m.scale.y = T.w * (0.4 + 0.6 * t);
    }
    for (const L of this.lights) { if (L.life > 0) { L.life -= dt; L.l.intensity = Math.max(0, L.i0 * L.life / L.max); } else L.l.intensity = 0; }
    for (const S of this.shells) {
      if (!S.m.visible) continue;
      S.life -= dt; if (S.life <= 0) { S.m.visible = false; continue; }
      const t = 1 - S.life / S.max; S.m.scale.setScalar(S.r0 + (S.r1 - S.r0) * (1 - Math.pow(1 - t, 3))); S.m.material.opacity = (1 - t) * 0.9;
    }
    for (const F of this.flashes) { if (F.s.visible) { F.life -= dt; if (F.life <= 0) F.s.visible = false; } }
    // damage numbers
    if (cam) {
      const w = innerWidth, h = innerHeight, v = this._nv || (this._nv = new THREE.Vector3());
      for (const n of this.nums) {
        if (!n.on) continue;
        n.life -= dt; if (n.life <= 0) { n.on = false; n.el.style.display = 'none'; continue; }
        n.p.y += dt * 1.2; n.p.x += n.vx * dt;
        v.copy(n.p).project(cam);
        if (v.z > 1) { n.el.style.display = 'none'; continue; }
        n.el.style.display = 'block';
        n.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${0.8 + n.life * 0.4})`;
        n.el.style.opacity = Math.min(1, n.life * 3);
      }
    }
  },
  clear() {
    this.pLife.fill(0);
    for (const d of this.dState) d.on = false;
    for (let i = 0; i < this.DN; i++) this.debris.setMatrixAt(i, this._m4.makeScale(0, 0, 0));
    this.debris.instanceMatrix.needsUpdate = true;
    for (const T of this.tracers) T.m.visible = false;
    for (const m of this.decals) m.visible = false;
    for (const S of this.shells) S.m.visible = false;
    for (const n of this.nums) { n.on = false; n.el.style.display = 'none'; }
  },
};
