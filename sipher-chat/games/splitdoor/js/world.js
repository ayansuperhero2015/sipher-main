'use strict';
// World: builds the static level from map data, owns collision (AABBs + ramps), raycasts, and the bot nav graph.
G.world = {
  map: null, boxes: [], ramps: [], group: null, mats: null,
  nav: null, anchors: [],

  build(map) {
    const W = this, scene = G.scene;
    if (W.group) { scene.remove(W.group); W.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    W.map = map; W.group = new THREE.Group(); scene.add(W.group);
    const t = map.theme;
    W.mats = G.makeMaterials(t);

    // ---- boxes
    W.boxes = map.boxes.map((b, i) => {
      const [cx, y, cz, w, h, d, mat] = b;
      return { i, min: [cx - w / 2, y, cz - d / 2], max: [cx + w / 2, y + h, cz + d / 2], mat, portal: mat === 'portal', solid: true };
    });
    const nb = W.boxes.length;
    W.bmin = new Float32Array(nb * 3); W.bmax = new Float32Array(nb * 3);
    W.boxes.forEach((b, i) => { for (let k = 0; k < 3; k++) { W.bmin[i * 3 + k] = b.min[k]; W.bmax[i * 3 + k] = b.max[k]; } });

    // merge geometry per material
    const byMat = {};
    for (const b of W.boxes) {
      const sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
      const g = new THREE.BoxGeometry(sx, sy, sz);
      g.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
      W.tagBox(g, b.min[1], b.max[1]);
      (byMat[b.mat] = byMat[b.mat] || []).push(g);
    }
    // ---- ramps
    W.ramps = map.ramps.map(r => {
      const [cx, cz, w, d, y0, y1, dir] = r;
      const o = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y0, y1, dir };
      o.axis = dir[0]; o.sign = dir[1] === '+' ? 1 : -1;
      return o;
    });
    for (const r of W.ramps) {
      const k = map.id === 'mesa' && r.y1 > 6 ? 'rock' : 'base';
      (byMat[k] = byMat[k] || []).push(W.tagBox(W.rampGeo(r), Math.min(r.y0, r.y1), Math.max(r.y0, r.y1)));
    }

    for (const k in byMat) {
      const geo = TA.BGU.mergeGeometries(byMat[k].map(g => { const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute('uv'); return n; }), false);
      byMat[k].forEach(g => g.dispose());
      const mesh = new THREE.Mesh(geo, W.mats[k] || W.mats.base);
      const glow = k === 'lamp' || k === 'accent';
      mesh.castShadow = !glow && k !== 'floor' && k !== 'ground'; mesh.receiveShadow = !glow;
      W.group.add(mesh);
    }

    // ---- lights, sky, fog
    const hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemiI);
    W.group.add(hemi);
    const sun = new THREE.DirectionalLight(t.lightColor, t.lightI);
    const ld = new THREE.Vector3(...t.lightDir).normalize();
    sun.position.copy(ld).multiplyScalar(90); sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    const [bx0, bx1, bz0, bz1] = map.bounds, ext = Math.max(bx1 - bx0, bz1 - bz0) * 0.62;
    const sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 10; sc.far = 220;
    sun.shadow.mapSize.set(G.quality.shadow, G.quality.shadow); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    W.group.add(sun, sun.target); W.sun = sun;
    W.hemi = hemi;
    G.vm && G.vm.setLights(t);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), G.skyMat(t));
    sky.renderOrder = -10; sky.frustumCulled = false;
    W.group.add(sky);
    // image-based lighting from this map's sky so metals and the viewmodel read properly
    if (W.envRT) W.envRT.dispose();
    const pm = new THREE.PMREMGenerator(G.renderer), es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), G.skyMat(t, true)));
    W.envRT = pm.fromScene(es, 0, 0.1, 400);
    pm.dispose();
    scene.environment = W.envRT.texture; if (G.vm.scene) G.vm.scene.environment = W.envRT.texture;
    hemi.intensity = t.hemiI * 0.55;
    scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
    scene.background = G.col(t.sky[1]);
    G.renderer.toneMappingExposure = t.exposure ?? 1;

    W.buildBackdrop(map);
    W.buildDetails(map);
    W.buildDust(t);
    if (G.grade) G.gradeFor(Object.assign({ grade: { hinge: { lift: [0.025, 0.012, 0.035], gain: [1.05, 0.99, 0.93] }, foundry: { lift: [0.0, 0.018, 0.035], gain: [0.98, 1.0, 1.06] }, mesa: { lift: [0.03, 0.018, 0.0], gain: [1.06, 1.0, 0.9] }, drydock: { lift: [0.01, 0.02, 0.03], gain: [0.99, 1.0, 1.03] } }[map.id] }, t));
    W.buildNav();
    W.buildAnchors();
  },

  // sunlit dust that hangs in the air around the camera (wraps in a 40 m cube, never runs out)
  buildDust(t) {
    const N = 900, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 40; pos[i * 3 + 1] = Math.random() * 40; pos[i * 3 + 2] = Math.random() * 40; seed[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.dustU = { uCam: { value: new THREE.Vector3() }, uTime: G.uTime, uCol: { value: G.col(t.dust || '#ffffff') }, uScale: { value: 500 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute float seed; uniform vec3 uCam; uniform float uTime, uScale; varying float vA;
        void main(){
          vec3 p = position + vec3(sin(uTime * 0.13 + seed * 40.0) * 1.5, uTime * (0.05 + seed * 0.08), cos(uTime * 0.11 + seed * 31.0) * 1.5);
          p = mod(p - uCam + 20.0, 40.0) - 20.0 + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = smoothstep(20.0, 6.0, d) * smoothstep(0.4, 2.0, d) * (0.35 + 0.65 * fract(seed * 7.13));
          gl_PointSize = (0.025 + seed * 0.035) * uScale / max(d, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uCol * a * 0.9, a); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3;
    pts.onBeforeRender = (r, sc, cam) => { const rt = r.getRenderTarget(); const h = rt ? rt.height : r.getDrawingBufferSize(this._ds || (this._ds = new THREE.Vector2())).y; this.dustU.uScale.value = h * 0.5 / Math.tan(THREE.MathUtils.degToRad(cam.fov || 70) / 2); };
    this.group.add(pts);
  },

  // per-vertex box extents: lets the panel shader fake contact shadow at wall bases and catch-light on top edges
  tagBox(g, y0, y1) {
    const n = g.attributes.position.count, a = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { a[i * 2] = y0; a[i * 2 + 1] = y1; }
    g.setAttribute('aBox', new THREE.BufferAttribute(a, 2));
    return g;
  },

  rampGeo(r) {
    // wedge: low edge at y0, high edge at y1 along axis/sign
    const { x0, x1, z0, z1, y0, y1, axis, sign } = r;
    const hAt = (x, z) => {
      let u = axis === 'x' ? (x - x0) / (x1 - x0) : (z - z0) / (z1 - z0);
      if (sign < 0) u = 1 - u;
      return y0 + (y1 - y0) * u;
    };
    const base = Math.min(y0, y1) - 0.01;
    const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const top = c.map(([x, z]) => new THREE.Vector3(x, hAt(x, z), z));
    const bot = c.map(([x, z]) => new THREE.Vector3(x, base, z));
    const pos = [];
    const quad = (a, b, cc, d) => { pos.push(a, b, cc, a, cc, d); };
    quad(top[0], top[3], top[2], top[1]);
    quad(bot[0], bot[1], bot[2], bot[3]);
    quad(bot[0], top[0], top[1], bot[1]);
    quad(bot[1], top[1], top[2], bot[2]);
    quad(bot[2], top[2], top[3], bot[3]);
    quad(bot[3], top[3], top[0], bot[0]);
    const g = new THREE.BufferGeometry().setFromPoints(pos);
    g.computeVertexNormals();
    return g;
  },

  rampHeight(r, x, z) {
    let u = r.axis === 'x' ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
    if (r.sign < 0) u = 1 - u;
    return r.y0 + (r.y1 - r.y0) * G.clamp(u, 0, 1);
  },

  // ---------------------------------------------------------------- collision queries
  // returns box indices overlapping the AABB, skipping ignored ones
  overlap(minx, miny, minz, maxx, maxy, maxz, ignore, out) {
    out.length = 0;
    const a = this.bmin, b = this.bmax, n = this.boxes.length, e = 0.0005;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      if (maxx <= a[j] + e || minx >= b[j] - e || maxy <= a[j + 1] + e || miny >= b[j + 1] - e || maxz <= a[j + 2] + e || minz >= b[j + 2] - e) continue;
      if (ignore && ignore.length && ignore.indexOf(i) >= 0) continue;
      out.push(i);
    }
    return out;
  },
  pointSolid(x, y, z) {
    const a = this.bmin, b = this.bmax, n = this.boxes.length;
    for (let i = 0; i < n; i++) { const j = i * 3; if (x > a[j] && x < b[j] && y > a[j + 1] && y < b[j + 1] && z > a[j + 2] && z < b[j + 2]) return true; }
    return false;
  },
  // highest walkable surface at or below y+up at (x,z) within radius 0 (point test)
  groundAt(x, z, y, up = 0.6) {
    let best = -1e9;
    const a = this.bmin, b = this.bmax, n = this.boxes.length;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      if (x < a[j] || x > b[j] || z < a[j + 2] || z > b[j + 2]) continue;
      const top = b[j + 1];
      if (top <= y + up && top > best) best = top;
    }
    for (const r of this.ramps) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const h = this.rampHeight(r, x, z);
      if (h <= y + up && h > best) best = h;
    }
    return best;
  },

  // ray vs boxes + ramps. returns {t, box, normal:[...] } or null
  raycast(ox, oy, oz, dx, dy, dz, maxT, ignore) {
    const a = this.bmin, b = this.bmax, n = this.boxes.length;
    let bestT = maxT, bestI = -1, bestAxis = 0, bestSign = 0, bestRamp = null;
    const ix = 1 / (dx || 1e-12), iy = 1 / (dy || 1e-12), iz = 1 / (dz || 1e-12);
    for (let i = 0; i < n; i++) {
      if (ignore && ignore.indexOf(i) >= 0) continue;
      const j = i * 3;
      let t1 = (a[j] - ox) * ix, t2 = (b[j] - ox) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
      t1 = (a[j + 1] - oy) * iy; t2 = (b[j + 1] - oy) * iy;
      let m1 = Math.min(t1, t2); const M1 = Math.max(t1, t2);
      if (m1 > tmin) { tmin = m1; ax = 1; }
      if (M1 < tmax) tmax = M1;
      t1 = (a[j + 2] - oz) * iz; t2 = (b[j + 2] - oz) * iz;
      m1 = Math.min(t1, t2); const M2 = Math.max(t1, t2);
      if (m1 > tmin) { tmin = m1; ax = 2; }
      if (M2 < tmax) tmax = M2;
      if (tmax < 0 || tmin > tmax || tmin >= bestT) continue;
      if (tmin < 0) continue; // origin inside box: ignore (lets rays leave walls)
      bestT = tmin; bestI = i; bestAxis = ax;
      bestSign = ax === 0 ? -Math.sign(dx) : ax === 1 ? -Math.sign(dy) : -Math.sign(dz);
    }
    for (const r of this.ramps) {
      // plane y = y0 + k*(coord - c0)
      const L = r.axis === 'x' ? r.x1 - r.x0 : r.z1 - r.z0;
      const k = (r.y1 - r.y0) / L * r.sign;
      const c0 = r.axis === 'x' ? (r.sign > 0 ? r.x0 : r.x1) : (r.sign > 0 ? r.z0 : r.z1);
      // f(p) = y - y0 - k*(c - c0) = 0
      const oc = r.axis === 'x' ? ox : oz, dc = r.axis === 'x' ? dx : dz;
      const den = dy - k * dc;
      if (Math.abs(den) < 1e-9) continue;
      const T = (r.y0 - oy + k * (oc - c0)) / den;
      if (T < 0 || T >= bestT) continue;
      const px = ox + dx * T, pz = oz + dz * T;
      if (px < r.x0 || px > r.x1 || pz < r.z0 || pz > r.z1) continue;
      bestT = T; bestRamp = r; bestI = -1;
    }
    if (bestRamp) {
      const r = bestRamp, L = r.axis === 'x' ? r.x1 - r.x0 : r.z1 - r.z0, k = (r.y1 - r.y0) / L * r.sign;
      const nrm = r.axis === 'x' ? new THREE.Vector3(-k, 1, 0) : new THREE.Vector3(0, 1, -k);
      nrm.normalize();
      if (nrm.x * dx + nrm.y * dy + nrm.z * dz > 0) nrm.negate();
      return { t: bestT, box: -1, ramp: r, normal: nrm };
    }
    if (bestI < 0) return null;
    const nrm = new THREE.Vector3(); nrm.setComponent(bestAxis, bestSign);
    return { t: bestT, box: bestI, ramp: null, normal: nrm };
  },
  los(p, q, ignore) {
    const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.001) return true;
    return !this.raycast(p.x, p.y, p.z, dx / d, dy / d, dz / d, d - 0.05, ignore);
  },

  // ---------------------------------------------------------------- scenery
  buildDetails(map) {
    // light strips along portal walls bottoms and some floor glow lines, small antennas etc.
    const g = this.group, t = map.theme;
    const stripMat = G.glowMat(t.portalGlow, 2.2);
    const geos = [];
    for (const b of this.boxes) {
      if (!b.portal) continue;
      const sx = b.max[0] - b.min[0], sz = b.max[2] - b.min[2], sy = b.max[1] - b.min[1];
      if (sy < 1) continue;
      // vertical edge strips on wall-like slabs
      if (sx < 0.6 || sz < 0.6) {
        const along = sx < sz ? 'z' : 'x';
        for (const s of [-1, 1]) {
          const geo = new THREE.BoxGeometry(along === 'x' ? 0.12 : sx + 0.04, sy, along === 'z' ? 0.12 : sz + 0.04);
          const cx = (b.min[0] + b.max[0]) / 2 + (along === 'x' ? s * (sx / 2 - 0.06) : 0);
          const cz = (b.min[2] + b.max[2]) / 2 + (along === 'z' ? s * (sz / 2 - 0.06) : 0);
          geo.translate(cx, (b.min[1] + b.max[1]) / 2, cz); geos.push(geo);
        }
      }
    }
    if (geos.length) { const m = new THREE.Mesh(TA.BGU.mergeGeometries(geos), stripMat); g.add(m); }
  },

  buildBackdrop(map) {
    const g = this.group, t = map.theme, M = this.mats;
    const rnd = (a, b) => a + Math.random() * (b - a);
    if (map.backdrop === 'islands') {
      const rockMat = G.panelMat({ color: '#8a6f5d', rock: true, rough: 0.95 });
      const grass = new THREE.MeshStandardMaterial({ color: '#7d8f5a', roughness: 1 });
      for (let i = 0; i < 26; i++) {
        const a = rnd(0, Math.PI * 2), r = rnd(150, 420), s = rnd(8, 34);
        const y = rnd(-80, 30);
        const geo = new THREE.DodecahedronGeometry(s, 0); geo.scale(1, rnd(0.9, 1.6), 1);
        const pos = geo.attributes.position;
        for (let k = 0; k < pos.count; k++) if (pos.getY(k) > 0) pos.setY(k, pos.getY(k) * 0.25);
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, rockMat); m.position.set(Math.cos(a) * r, y, Math.sin(a) * r); m.rotation.y = rnd(0, 6);
        g.add(m);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.95, s * 0.95, 0.6, 7), grass); cap.position.copy(m.position); cap.position.y += s * 0.24; cap.rotation.y = m.rotation.y;
        g.add(cap);
      }
      // the great ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(260, 9, 12, 96), G.panelMat({ color: '#cfd4dc', line: '#7d8794', scale: 6, lineMix: 0.4, glow: t.accent, glowI: 0.5 }));
      ring.position.set(-120, 80, -620); ring.rotation.set(0.25, 0.4, 0.15); g.add(ring);
      const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(260, 1.4, 6, 96), G.glowMat(t.accent, 3)); ringGlow.position.copy(ring.position); ringGlow.rotation.copy(ring.rotation); g.add(ringGlow);
      // cloud sea
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uTime: G.uTime, c1: { value: G.col('#f6c39a') }, c2: { value: G.col('#7a6a8a') } },
        vertexShader: 'varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `varying vec2 vU; varying vec3 vW; uniform float uTime; uniform vec3 c1, c2;
          float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
          void main(){ vec2 p = vW.xz * 0.012 + uTime * 0.004; float v = n(p)*0.5 + n(p*2.3)*0.3 + n(p*5.1)*0.2;
            float d = length(vW.xz); float a = smoothstep(0.35, 0.7, v) * smoothstep(1400.0, 300.0, d) * smoothstep(40.0, 140.0, d);
            gl_FragColor = vec4(mix(c2, c1, v), a * 0.9); }`,
      }));
      cloud.rotation.x = -Math.PI / 2; cloud.position.y = -70; g.add(cloud);
    } else if (map.backdrop === 'city') {
      const tex = G.windowTex();
      const bmat = new THREE.MeshStandardMaterial({ color: '#0c1018', roughness: 0.8, metalness: 0.3, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 1.1 });
      const geos = [];
      for (let i = 0; i < 110; i++) {
        const a = rnd(0, Math.PI * 2), r = rnd(150, 430), w = rnd(12, 30), h = rnd(25, 140), d = rnd(12, 30);
        const geo = new THREE.BoxGeometry(w, h, d);
        const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 10, uv.getY(k) * h / 18);
        geo.translate(Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r);
        geos.push(geo);
      }
      g.add(new THREE.Mesh(TA.BGU.mergeGeometries(geos), bmat));
      // smokestacks with blinking aviation lights
      const stackMat = new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.9 });
      const redMat = G.glowMat('#ff2a1a', 4);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + 0.3, r = rnd(70, 95);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, rnd(50, 75), 12), stackMat);
        s.position.set(Math.cos(a) * r, 15, Math.sin(a) * r); g.add(s);
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), redMat); l.position.copy(s.position); l.position.y += s.geometry.parameters.height / 2 + 1;
        l.userData.blink = rnd(0, 6); g.add(l); (this.blinkers = this.blinkers || []).push(l);
      }
      const gnd = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: '#0a0d12', roughness: 1 }));
      gnd.rotation.x = -Math.PI / 2; gnd.position.y = -20; g.add(gnd);
    } else if (map.backdrop === 'sea') {
      // grey swell to the horizon, a breakwater and harbour cranes standing in the haze
      const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 1, 1), new THREE.ShaderMaterial({
        fog: false, uniforms: { uTime: G.uTime, deep: { value: G.col('#2c3a44') }, lite: { value: G.col('#8e9aa3') }, fogC: { value: G.col(t.fog) } },
        vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `varying vec3 vW; uniform float uTime; uniform vec3 deep, lite, fogC;
          float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
          void main(){ vec2 p = vW.xz * 0.06; float w = n(p + uTime * 0.05) * 0.6 + n(p * 2.7 - uTime * 0.08) * 0.4;
            float d = length(vW.xz - cameraPosition.xz);
            vec3 c = mix(deep, lite, pow(w, 3.0) * 0.6 + smoothstep(200.0, 900.0, d) * 0.5);
            gl_FragColor = vec4(mix(c, fogC, smoothstep(120.0, 900.0, d)), 1.0); }`,
      }));
      water.rotation.x = -Math.PI / 2; water.position.y = -9; g.add(water);
      const steel = new THREE.MeshStandardMaterial({ color: '#3b4248', roughness: 0.8, metalness: 0.3 });
      const geos = [];
      const addBox = (w, h, d, x, y, z, ry = 0) => { const b = new THREE.BoxGeometry(w, h, d); b.rotateY(ry); b.translate(x, y, z); geos.push(b); };
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2 + 0.35, r = rnd(120, 260), x = Math.cos(a) * r, z = Math.sin(a) * r, H = rnd(45, 70), ry = rnd(0, 6);
        addBox(3, H, 3, x - 6, H / 2 - 9, z, ry); addBox(3, H, 3, x + 6, H / 2 - 9, z, ry);
        addBox(rnd(40, 60), 4, 4, x + 8, H - 9, z, ry); addBox(6, 6, 6, x, H - 4, z, ry);
      }
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = 95; addBox(14, 4, 6, Math.cos(a) * r, -7, Math.sin(a) * r, -a); }
      g.add(new THREE.Mesh(TA.BGU.mergeGeometries(geos.map(x => x.toNonIndexed())), steel));
    } else if (map.backdrop === 'canyon') {
      const rockMat = M.rock;
      const geos = [];
      for (let i = 0; i < 70; i++) {
        const a = rnd(0, Math.PI * 2), r = rnd(80, 340);
        const w = rnd(20, 70), d = rnd(20, 70), h = rnd(25, 90) * (r > 200 ? 1.4 : 1);
        for (let tier = 0; tier < 3; tier++) {
          const s = 1 - tier * 0.22;
          const geo = new THREE.BoxGeometry(w * s, h / 3, d * s);
          geo.rotateY(rnd(0, 6));
          geo.translate(Math.cos(a) * r + rnd(-3, 3), -6 + h / 6 + tier * h / 3, Math.sin(a) * r + rnd(-3, 3));
          geos.push(geo);
        }
      }
      const canyon = new THREE.Mesh(TA.BGU.mergeGeometries(geos.map(x => x.toNonIndexed())), rockMat); canyon.receiveShadow = false; g.add(canyon);
      const sand = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), M.ground); sand.rotation.x = -Math.PI / 2; sand.position.y = -0.05; g.add(sand);
    }
  },

  // ---------------------------------------------------------------- navigation graph
  buildNav() {
    const W = this, [x0, x1, z0, z1] = W.map.bounds, S = 1.5;
    const nx = Math.ceil((x1 - x0) / S), nz = Math.ceil((z1 - z0) / S);
    const nodes = [], cols = new Array(nx * nz);
    const tmp = [];
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      const x = x0 + (ix + 0.5) * S, z = z0 + (iz + 0.5) * S;
      const cands = [];
      for (let i = 0; i < W.boxes.length; i++) {
        const b = W.boxes[i];
        if (b.max[1] - b.min[1] < 0.05) continue;
        if (x > b.min[0] + 0.25 && x < b.max[0] - 0.25 && z > b.min[2] + 0.25 && z < b.max[2] - 0.25) cands.push(b.max[1]);
      }
      for (const r of W.ramps) if (x > r.x0 + 0.2 && x < r.x1 - 0.2 && z > r.z0 && z < r.z1) cands.push(W.rampHeight(r, x, z));
      const list = [];
      for (const y of cands) {
        if (y < W.map.killY + 4) continue;
        if (W.overlap(x - 0.3, y + 0.05, z - 0.3, x + 0.3, y + 1.85, z + 0.3, null, tmp).length) continue;
        if (list.some(n => Math.abs(n.y - y) < 0.3)) continue;
        const n = { id: nodes.length, x, y, z, ix, iz, e: [] };
        nodes.push(n); list.push(n);
      }
      cols[ix * nz + iz] = list;
    }
    const P = new THREE.Vector3(), Q = new THREE.Vector3();
    const clear = (a, b, h) => W.los(P.set(a.x, h, a.z), Q.set(b.x, h, b.z));
    for (const a of nodes) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const jx = a.ix + dx, jz = a.iz + dz;
        if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        for (const b of cols[jx * nz + jz]) {
          const dy = b.y - a.y, dist = Math.hypot(b.x - a.x, b.z - a.z);
          if (Math.abs(dy) <= 0.6) {
            if (clear(a, b, Math.max(a.y, b.y) + 0.9) && clear(a, b, Math.max(a.y, b.y) + 0.3)) a.e.push({ to: b.id, c: dist + Math.abs(dy), k: 0 });
          } else if (dy < -0.6 && dy > -10) {
            if (clear(a, b, a.y + 0.9)) a.e.push({ to: b.id, c: dist + 0.5, k: 1 });
          } else if (dy > 0.6 && dy <= 6) {
            if (W.los(P.set(a.x, a.y + 1, a.z), Q.set(a.x, b.y + 1.2, a.z)) && clear(a, b, b.y + 1.2)) a.e.push({ to: b.id, c: dist + dy * 2.5, k: 2 });
          }
        }
      }
    }
    W.nav = { nodes, cols, nx, nz, S, x0, z0, portalEdges: new Map() };
  },
  nearestNode(p, maxR = 4) {
    const N = this.nav; if (!N) return null;
    const ix = Math.floor((p.x - N.x0) / N.S), iz = Math.floor((p.z - N.z0) / N.S);
    let best = null, bd = 1e9;
    for (let r = 0; r <= maxR; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= N.nx || jz >= N.nz) continue;
        for (const n of N.cols[jx * N.nz + jz]) {
          const dy = n.y - p.y;
          const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2 + (dy > 0.8 ? dy * dy * 6 : dy * dy * 0.6);
          if (d < bd) { bd = d; best = n; }
        }
      }
      if (best && r >= 1) break;
    }
    return best;
  },
  // A* with optional portal shortcuts (edges added each frame by G.portals.refreshNavEdges)
  path(fromP, toP) {
    const N = this.nav; if (!N) return null;
    const s = this.nearestNode(fromP), g = this.nearestNode(toP, 6);
    if (!s || !g) return null;
    if (s === g) return [{ n: g }];
    const nodes = N.nodes, open = new G.Heap(), came = new Map(), gs = new Map();
    gs.set(s.id, 0); open.push(s.id, 0);
    const h = n => Math.hypot(n.x - g.x, n.z - g.z) + Math.abs(n.y - g.y) * 0.5;
    let iter = 0;
    while (open.size && iter++ < 6000) {
      const cur = open.pop();
      if (cur === g.id) break;
      const cn = nodes[cur], cg = gs.get(cur);
      const edges = cn.e, pe = N.portalEdges.get(cur);
      const tryE = (to, c, k, portal) => {
        const ng = cg + c;
        if (ng < (gs.has(to) ? gs.get(to) : 1e18)) { gs.set(to, ng); came.set(to, { from: cur, k, portal }); open.push(to, ng + h(nodes[to])); }
      };
      for (let i = 0; i < edges.length; i++) tryE(edges[i].to, edges[i].c, edges[i].k, null);
      if (pe) for (const e of pe) tryE(e.to, e.c, 3, e.portal);
    }
    if (!came.has(g.id)) return null;
    const out = []; let c = g.id;
    while (c !== s.id) { const info = came.get(c); out.push({ n: nodes[c], k: info.k, portal: info.portal }); c = info.from; }
    out.reverse();
    return out;
  },

  // candidate spots where bots may open doors: ground-level positions on portal faces with a nav node in front
  buildAnchors() {
    const W = this, out = [], PW = G.PORTAL_W, PH = G.PORTAL_H;
    for (const b of W.boxes) {
      if (!b.portal) continue;
      for (let ax = 0; ax < 3; ax++) for (const sgn of [-1, 1]) {
        const n = new THREE.Vector3(); n.setComponent(ax, sgn);
        if (ax === 1 && sgn < 0) continue; // ceilings: no anchors
        const faceC = new THREE.Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
        faceC.setComponent(ax, sgn > 0 ? b.max[ax] : b.min[ax]);
        if (ax === 1) {
          const sx = b.max[0] - b.min[0], sz = b.max[2] - b.min[2];
          if (Math.min(sx, sz) < PW || Math.max(sx, sz) < PH) continue;
          const p = faceC.clone().add(n.clone().multiplyScalar(0.05));
          if (W.pointSolid(p.x, p.y + 0.3, p.z)) continue;
          const node = W.nearestNode(new THREE.Vector3(p.x, p.y, p.z), 1);
          if (node && Math.abs(node.y - p.y) < 0.4) out.push({ box: b.i, normal: n, center: faceC.clone(), up: new THREE.Vector3(sx >= sz ? 1 : 0, 0, sx >= sz ? 0 : 1), node, floor: true });
          continue;
        }
        const ux = ax === 0 ? 2 : 0; // horizontal axis along face
        const len = b.max[ux] - b.min[ux], hgt = b.max[1] - b.min[1];
        if (len < PW + 0.1 || hgt < PH + 0.1) continue;
        const cy = b.min[1] + PH / 2 + 0.05;
        const steps = Math.max(1, Math.floor((len - PW) / 3) + 1);
        for (let s = 0; s < steps; s++) {
          const u = steps === 1 ? (b.min[ux] + b.max[ux]) / 2 : b.min[ux] + PW / 2 + 0.05 + (len - PW - 0.1) * s / (steps - 1);
          const c = faceC.clone(); c.setComponent(ux, u); c.y = cy;
          const front = c.clone().addScaledVector(n, 1.2);
          if (W.pointSolid(front.x, front.y, front.z)) continue;
          const node = W.nearestNode(new THREE.Vector3(front.x, b.min[1] + 0.1, front.z), 1);
          if (!node || Math.abs(node.y - b.min[1]) > 0.7) continue;
          out.push({ box: b.i, normal: n, center: c, up: new THREE.Vector3(0, 1, 0), node, floor: false });
        }
      }
    }
    W.anchors = out;
  },

  update(dt) {
    if (this.dustU) this.dustU.uCam.value.copy(G.cam.position);
    if (this.blinkers) for (const l of this.blinkers) l.visible = Math.sin(G.t * 2 + l.userData.blink) > 0.6;
  },
};

// binary min-heap keyed by priority
G.Heap = class {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p; K.push(k); P.push(p);
    let i = K.length - 1;
    while (i > 0) { const j = (i - 1) >> 1; if (P[j] <= P[i]) break; [K[i], K[j]] = [K[j], K[i]]; [P[i], P[j]] = [P[j], P[i]]; i = j; }
  }
  pop() {
    const K = this.k, P = this.p, top = K[0];
    const lk = K.pop(), lp = P.pop();
    if (K.length) {
      K[0] = lk; P[0] = lp; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < K.length && P[l] < P[m]) m = l;
        if (r < K.length && P[r] < P[m]) m = r;
        if (m === i) break;
        [K[i], K[m]] = [K[m], K[i]]; [P[i], P[m]] = [P[m], P[i]]; i = m;
      }
    }
    return top;
  }
};
