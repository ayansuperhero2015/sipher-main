'use strict';
// Portals ("doors"): real render-to-texture views with oblique clipping and one-frame-lagged recursion.
// Anything can cross them: players, bots, bullets, rockets, grenades. Momentum is carried through.
G.PORTAL_W = 2.4;
G.PORTAL_H = 3.4;
G.PORTAL_DEPTH = 0.22;

(() => {
  const W2 = G.PORTAL_W / 2, H2 = G.PORTAL_H / 2;
  const ROT_Y = new THREE.Matrix4().makeRotationY(Math.PI);
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4(), _m3 = new THREE.Matrix3();
  const _plane = new THREE.Plane(), _clip = new THREE.Vector4(), _q4 = new THREE.Vector4();
  const _sv1 = new THREE.Vector3(), _sv2 = new THREE.Vector3(), _sv3 = new THREE.Vector3(), _svm = new THREE.Matrix4();
  const _frustum = new THREE.Frustum(), _sphere = new THREE.Sphere(), _s2 = new THREE.Vector2();

  const SURF_VS = `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const SURF_FS = `uniform sampler2D tMap; uniform vec2 uRes; uniform vec3 uColor; uniform float uLinked, uOpen, uTime, uFlash;
  varying vec3 vL;
  void main(){
    float r = length(vL.xy);
    if (r > uOpen) discard;
    float front = step(-0.002, vL.z);
    float edge = smoothstep(uOpen - 0.07, uOpen, r) * front;
    float ang = atan(vL.y, vL.x);
    float sw = sin(ang * 5.0 + uTime * 4.5 - r * 15.0) * 0.5 + 0.5;
    float sw2 = sin(ang * 3.0 - uTime * 2.0 + r * 9.0) * 0.5 + 0.5;
    vec3 idle = mix(uColor * 0.08, uColor * 1.35, sw * smoothstep(0.05, 1.0, r)) + uColor * sw2 * 0.15;
    vec3 view = texture2D(tMap, gl_FragCoord.xy / uRes).rgb;
    vec3 col = mix(idle, view, uLinked);
    col += uColor * pow(r, 9.0) * 0.9 * uLinked * front;
    col = mix(col, uColor * 2.2, edge);
    col += uColor * uFlash * 2.0 * (1.0 - r);
    gl_FragColor = vec4(col, 1.0);
  }`;

  class Portal {
    constructor(owner, idx, color) {
      this.owner = owner; this.idx = idx; this.color = G.col(color); this.colorHex = color;
      this.placed = false; this.box = -1; this.open = 0; this.openT = 1; this.flash = 0;
      this.center = new THREE.Vector3(); this.normal = new THREE.Vector3(); this.up = new THREE.Vector3(); this.right = new THREE.Vector3();
      this.matrix = new THREE.Matrix4(); this.inv = new THREE.Matrix4();
      this.rt = null; this.twin = null;
      const P = G.portals;
      this.mat = new THREE.ShaderMaterial({
        uniforms: { tMap: { value: P.blank }, uRes: P.uRes, uColor: { value: this.color.clone() }, uLinked: { value: 0 }, uOpen: { value: 1 }, uTime: G.uTime, uFlash: { value: 0 } },
        vertexShader: SURF_VS, fragmentShader: SURF_FS, side: THREE.DoubleSide, fog: false,
      });
      this.group = new THREE.Group(); this.group.visible = false; this.group.matrixAutoUpdate = false;
      this.surface = new THREE.Mesh(P.surfGeo, this.mat); this.surface.scale.set(W2, H2, 1); this.surface.position.z = 0.012;
      this.surface.renderOrder = 1;
      this.ring = new THREE.Mesh(P.ringGeo, G.glowMat(color, 1.8)); this.ring.scale.set(W2, H2, 1); this.ring.position.z = 0.03;
      this.halo = new THREE.Mesh(P.haloGeo, new THREE.MeshBasicMaterial({ map: P.haloTex, color: this.color.clone().multiplyScalar(0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      this.halo.scale.set(G.PORTAL_W * 0.95, G.PORTAL_H * 0.95, 1); this.halo.position.z = 0.02;
      this.group.add(this.surface, this.ring, this.halo);
      this.surface.updateMatrix(); this.ring.updateMatrix(); this.halo.updateMatrix();
      G.scene.add(this.group);
    }
    get linked() { return this.placed && this.twin && this.twin.placed; }

    // Try to open this door on box `bi` at hit point. Returns true on success.
    place(bi, hit, n, viewDir) {
      const b = G.world.boxes[bi];
      if (!b || !b.portal) return false;
      const up = new THREE.Vector3();
      if (Math.abs(n.y) > 0.5) {
        if (Math.abs(viewDir.x) > Math.abs(viewDir.z)) up.set(Math.sign(viewDir.x) || 1, 0, 0); else up.set(0, 0, Math.sign(viewDir.z) || 1);
      } else up.set(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(up, n);
      const ra = Math.abs(right.x) > 0.5 ? 0 : Math.abs(right.y) > 0.5 ? 1 : 2;
      const ua = Math.abs(up.x) > 0.5 ? 0 : Math.abs(up.y) > 0.5 ? 1 : 2;
      const na = Math.abs(n.x) > 0.5 ? 0 : Math.abs(n.y) > 0.5 ? 1 : 2;
      const c = hit.clone();
      const fit = (axis, half) => {
        const lo = b.min[axis] + half + 0.04, hi = b.max[axis] - half - 0.04;
        if (lo > hi) return false;
        c.setComponent(axis, G.clamp(c.getComponent(axis), lo, hi));
        return true;
      };
      if (!fit(ra, W2) || !fit(ua, H2)) return false;
      c.setComponent(na, n.getComponent(na) > 0 ? b.max[na] : b.min[na]);
      // the face must be exposed (not buried inside another box)
      _v.copy(c).addScaledVector(n, 0.15);
      if (G.world.pointSolid(_v.x, _v.y, _v.z)) return false;
      // no overlap with other doors on the same plane
      for (const o of G.portals.list) {
        if (o === this || !o.placed) continue;
        if (o.normal.dot(n) < 0.99 || Math.abs(_v2.copy(c).sub(o.center).dot(n)) > 0.05) continue;
        _v2.copy(c).sub(o.center);
        const dr = _v2.dot(o.right) / G.PORTAL_W, du = _v2.dot(o.up) / G.PORTAL_H;
        if (dr * dr + du * du < 1) return false;
      }
      this.box = bi; this.center.copy(c); this.normal.copy(n); this.up.copy(up); this.right.copy(right);
      this.matrix.makeBasis(right, up, n).setPosition(c);
      this.inv.copy(this.matrix).invert();
      this.group.matrix.copy(this.matrix); this.group.matrixWorldNeedsUpdate = true;
      this.group.visible = true; this.placed = true;
      this.openT = 0; this.flash = 1;
      G.fx && G.fx.portalBurst(this);
      return true;
    }
    close() {
      if (this.placed && G.fx) G.fx.burst(this.center, this.normal, this.colorHex, 18, 3, 0.4, 0.07);
      this.placed = false; this.group.visible = false; this.box = -1;
    }
    // world transform that carries things entering this portal out of its twin
    travel(out) {
      return (out || new THREE.Matrix4()).multiplyMatrices(this.twin.matrix, ROT_Y).multiply(this.inv);
    }
    localOf(p, out) { return (out || new THREE.Vector3()).copy(p).applyMatrix4(this.inv); }
    inEllipse(lx, ly, k = 1) { const x = lx / (W2 * k), y = ly / (H2 * k); return x * x + y * y <= 1; }
    update(dt) {
      if (!this.placed) return;
      this.openT = Math.min(1, this.openT + dt / 0.45);
      const t = this.openT, e = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 2 * 1.4) * 0.9;
      this.open = Math.max(0.001, Math.min(1, e));
      this.mat.uniforms.uOpen.value = this.open;
      this.ring.scale.set(W2 * Math.max(0.02, e), H2 * Math.max(0.02, e), 1); this.ring.updateMatrix();
      this.flash = Math.max(0, this.flash - dt * 3);
      this.mat.uniforms.uFlash.value = this.flash;
    }
  }

  G.portals = {
    list: [], pool: [], uRes: { value: new THREE.Vector2(1, 1) }, vcam: null, maxRT: 4, rtScale: 0.7, navTimer: 0,

    init() {
      const g = new THREE.CylinderGeometry(1, 1, G.PORTAL_DEPTH, 56, 1, false);
      g.rotateX(Math.PI / 2); g.translate(0, 0, -G.PORTAL_DEPTH / 2);
      this.surfGeo = g;
      this.ringGeo = new THREE.TorusGeometry(1, 0.045, 8, 72);
      this.haloGeo = new THREE.PlaneGeometry(1, 1);
      // ring-shaped halo spilling light onto the wall
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 30, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      this.haloTex = new THREE.CanvasTexture(c);
      const d = new Uint8Array([10, 12, 18, 255]);
      this.blank = new THREE.DataTexture(d, 1, 1); this.blank.needsUpdate = true;
      this.vcam = new THREE.PerspectiveCamera();
    },
    create(owner, colors) {
      const a = new Portal(owner, 0, colors[0]), b = new Portal(owner, 1, colors[1]);
      a.twin = b; b.twin = a;
      this.list.push(a, b);
      return [a, b];
    },
    destroyAll() {
      for (const p of this.list) { G.scene.remove(p.group); p.mat.dispose(); }
      this.list = [];
      for (const r of this.pool) { r.a.dispose(); r.b.dispose(); }
      this.pool = [];
    },
    setQuality(maxRT, scale) {
      this.maxRT = maxRT; this.rtScale = scale;
      for (const r of this.pool) { r.a.dispose(); r.b.dispose(); }
      this.pool = []; for (const p of this.list) p.rt = null;
    },
    rtSize() {
      const v = G.renderer.getDrawingBufferSize(_s2);
      return [Math.max(64, Math.floor(v.x * this.rtScale)), Math.max(64, Math.floor(v.y * this.rtScale))];
    },
    makePair() {
      const [w, h] = this.rtSize();
      const o = { type: THREE.HalfFloatType, depthBuffer: true };
      const r = { a: new THREE.WebGLRenderTarget(w, h, o), b: new THREE.WebGLRenderTarget(w, h, o), owner: null, used: 0 };
      r.read = r.a; r.write = r.b;
      this.pool.push(r);
      return r;
    },
    resize() { const [w, h] = this.rtSize(); for (const r of this.pool) { r.a.setSize(w, h); r.b.setSize(w, h); } },

    update(dt) {
      for (const p of this.list) p.update(dt);
      this.navTimer -= dt;
      if (this.navTimer <= 0) { this.navTimer = 0.4; this.refreshNav(); }
    },

    // ---------------------------------------------------------------- traversal helpers
    // boxes an actor may pass into this step because its pivot is lined up with a linked door in them
    ignoreFor(pivot, out) {
      out.length = 0;
      for (const p of this.list) {
        if (!p.linked || p.open < 0.6) continue;
        const l = p.localOf(pivot, _v);
        if (l.z > 2.0 || l.z < -1.2) continue;
        if (p.inEllipse(l.x, l.y, 0.92)) out.push(p.box);
      }
      return out;
    },
    // keep a pivot that is inside a wall within the hole of the door it entered
    clampInside(pivot) {
      for (const p of this.list) {
        if (!p.linked) continue;
        const l = p.localOf(pivot, _v);
        if (l.z > 0.5 || l.z < -1.2) continue;
        const k = 0.9, x = l.x / (W2 * k), y = l.y / (H2 * k), r = Math.sqrt(x * x + y * y);
        if (r > 1 && r < 2.2) { l.x /= r; l.y /= r; l.applyMatrix4(p.matrix); pivot.copy(l); return true; }
      }
      return false;
    },
    // did the segment a->b go through the front of a linked door? returns the door
    crossed(a, b) {
      for (const p of this.list) {
        if (!p.linked || p.open < 0.5) continue;
        const la = p.localOf(a, _v), lbz = _v2.copy(b).applyMatrix4(p.inv);
        if (la.z > 0 && lbz.z <= 0) {
          const t = la.z / (la.z - lbz.z);
          const x = la.x + (lbz.x - la.x) * t, y = la.y + (lbz.y - la.y) * t;
          if (p.inEllipse(x, y, 1.0)) return p;
        }
      }
      return null;
    },
    // ray vs all linked doors: nearest front-facing hit within maxT
    // Can `eye` see world point `c` by looking into door P (out of its twin)? Returns the apparent point or null.
    seeVia(P, eye, c, maxD = 95, out) {
      if (!P.linked || P.open < 0.6) return null;
      const Q = P.twin;
      if (_sv1.copy(eye).sub(P.center).dot(P.normal) < 0.05) return null;
      if (_sv1.copy(c).sub(Q.center).dot(Q.normal) < 0.05) return null;
      Q.travel(_svm);
      const v = (out || new THREE.Vector3()).copy(c).applyMatrix4(_svm); // where c appears, behind P
      const d = _sv2.copy(v).sub(eye); const len = d.length();
      if (len > maxD || len < 0.01) return null;
      d.divideScalar(len);
      const den = d.dot(P.normal); if (den > -1e-4) return null;
      const t = _sv1.copy(P.center).sub(eye).dot(P.normal) / den;
      if (t <= 0 || t >= len) return null;
      const h = _sv3.copy(eye).addScaledVector(d, t);
      _sv1.copy(h).applyMatrix4(P.inv);
      if (!P.inEllipse(_sv1.x, _sv1.y, 0.9)) return null;
      if (!G.world.los(eye, _sv1.copy(h).addScaledVector(P.normal, 0.04))) return null;
      P.travel(_svm); h.applyMatrix4(_svm).addScaledVector(Q.normal, 0.04); // same spot on the exit door
      if (!G.world.los(h, c)) return null;
      return v;
    },
    // first door through which eye can see c
    sightTo(eye, c, maxD, out) {
      for (const p of this.list) { const v = this.seeVia(p, eye, c, maxD, out); if (v) return { door: p, v }; }
      return null;
    },
    rayDoor(o, d, maxT) {
      let best = null, bt = maxT;
      for (const p of this.list) {
        if (!p.linked || p.open < 0.5) continue;
        const den = d.dot(p.normal);
        if (den >= -1e-6) continue;
        const t = _v.copy(p.center).sub(o).dot(p.normal) / den;
        if (t < 0.001 || t >= bt) continue;
        _v.copy(o).addScaledVector(d, t).applyMatrix4(p.inv);
        if (!p.inEllipse(_v.x, _v.y)) continue;
        best = p; bt = t;
      }
      return best ? { p: best, t: bt } : null;
    },

    // ---------------------------------------------------------------- bots: door shortcuts in the nav graph
    refreshNav() {
      const N = G.world.nav; if (!N) return;
      N.portalEdges.clear();
      for (const p of this.list) {
        if (!p.linked) continue;
        const entry = this.entryNode(p), exit = this.exitNode(p.twin);
        if (!entry || !exit) continue;
        const arr = N.portalEdges.get(entry.id) || [];
        arr.push({ to: exit.id, c: 3, portal: p });
        N.portalEdges.set(entry.id, arr);
      }
    },
    entryNode(p) {
      if (p.normal.y > 0.5) { const n = G.world.nearestNode(p.center, 1); return n && Math.abs(n.y - p.center.y) < 0.5 ? n : null; }
      if (p.normal.y < -0.5) return null;
      const bottom = p.center.y - H2;
      _v.copy(p.center).addScaledVector(p.normal, 1.0); _v.y = bottom + 0.1;
      const n = G.world.nearestNode(_v, 1);
      return n && Math.abs(n.y - bottom) < 0.8 ? n : null;
    },
    exitNode(q) {
      if (q.normal.y > 0.5) return G.world.nearestNode(q.center, 2);
      _v.copy(q.center).addScaledVector(q.normal, q.normal.y < -0.5 ? 0.5 : 1.6);
      const gy = G.world.groundAt(_v.x, _v.z, _v.y, 0);
      if (gy < -1e8) return null;
      _v.y = gy;
      return G.world.nearestNode(_v, 2);
    },

    // ---------------------------------------------------------------- rendering
    render(cam, scene, hideBody) {
      const R = G.renderer;
      for (const p of this.list) { p.mat.uniforms.uLinked.value = 0; p.mat.uniforms.tMap.value = this.blank; }
      // pick the doors worth rendering this frame
      _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_m);
      const cands = [];
      for (const p of this.list) {
        if (!p.linked) continue;
        _v.copy(cam.position).sub(p.center);
        if (_v.dot(p.normal) < -0.05) continue;
        const d = _v.length();
        if (d > 170) continue;
        _sphere.center.copy(p.center); _sphere.radius = 2.2;
        if (!_frustum.intersectsSphere(_sphere)) continue;
        cands.push({ p, d });
      }
      cands.sort((a, b) => a.d - b.d);
      const chosen = cands.slice(0, this.maxRT).map(c => c.p);
      // sticky render-target assignment so recursion keeps last frame's view
      for (const r of this.pool) if (r.owner && chosen.indexOf(r.owner) < 0) { r.owner.rt = null; r.owner = null; }
      for (const p of chosen) {
        if (p.rt) continue;
        let r = this.pool.find(x => !x.owner);
        if (!r) r = this.makePair();
        r.owner = p; p.rt = r;
      }
      if (!chosen.length) { this.uRes.value.copy(R.getDrawingBufferSize(_s2)); return; }
      const [w, h] = this.rtSize();
      const vc = this.vcam;
      vc.fov = cam.fov; vc.aspect = cam.aspect; vc.near = cam.near; vc.far = cam.far; vc.updateProjectionMatrix();
      vc.layers.mask = cam.layers.mask;
      if (hideBody) hideBody(false);
      for (const p of chosen) {
        const q = p.twin;
        p.travel(_m).multiply(cam.matrixWorld);
        _m.decompose(vc.position, vc.quaternion, vc.scale);
        vc.scale.set(1, 1, 1);
        vc.updateMatrixWorld(true);
        vc.projectionMatrix.copy(cam.projectionMatrix);
        this.oblique(vc, q.normal, q.center);
        p.mat.uniforms.uLinked.value = 1; p.mat.uniforms.tMap.value = p.rt.read.texture;
        q.group.visible = false;
        this.uRes.value.set(w, h);
        R.setRenderTarget(p.rt.write);
        R.render(scene, vc);
        q.group.visible = true;
        p.mat.uniforms.uLinked.value = 0; p.mat.uniforms.tMap.value = this.blank;
        const t = p.rt.read; p.rt.read = p.rt.write; p.rt.write = t;
      }
      R.setRenderTarget(null);
      if (hideBody) hideBody(true);
      for (const p of chosen) { p.mat.uniforms.uLinked.value = 1; p.mat.uniforms.tMap.value = p.rt.read.texture; }
      this.uRes.value.copy(R.getDrawingBufferSize(_s2));
    },
    // Lengyel oblique near plane: clip everything behind the exit door.
    oblique(cam, n, point) {
      _plane.setFromNormalAndCoplanarPoint(n, _v.copy(point).addScaledVector(n, -0.01));
      _plane.applyMatrix4(cam.matrixWorldInverse);
      _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
      const e = cam.projectionMatrix.elements;
      _q4.x = (Math.sign(_clip.x) + e[8]) / e[0];
      _q4.y = (Math.sign(_clip.y) + e[9]) / e[5];
      _q4.z = -1.0;
      _q4.w = (1.0 + e[10]) / e[14];
      _clip.multiplyScalar(2.0 / _clip.dot(_q4));
      e[2] = _clip.x; e[6] = _clip.y; e[10] = _clip.z + 1.0; e[14] = _clip.w;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    },
  };

  // ---------------------------------------------------------------- hitscan through doors
  // Returns { segs: [[a,b],...], hits: [{actor, point, head, via}], world: {point, normal, box}|null, via }
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _tm = new THREE.Matrix4();
  G.trace = (origin, dir, maxD, shooter, opts = {}) => {
    _o.copy(origin); _d.copy(dir).normalize();
    let remaining = maxD, via = 0;
    const out = { segs: [], hits: [], world: null, via: 0, endDir: null };
    const skip = new Set(); if (shooter) skip.add(shooter);
    for (let hop = 0; hop < 4; hop++) {
      const wh = G.world.raycast(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, remaining, null);
      const tW = wh ? wh.t : remaining;
      const door = G.portals.rayDoor(_o, _d, wh ? tW + 0.06 : tW);
      const tLimit = door ? door.t : tW;
      // actors along this segment
      let segEnd = tLimit, stop = false;
      if (opts.actors !== false) {
        const cands = [];
        for (const a of G.actors) {
          if (!a.alive || skip.has(a)) continue;
          const r = a.rayTest(_o, _d, tLimit);
          if (r) cands.push({ a, t: r.t, head: r.head });
        }
        cands.sort((x, y) => x.t - y.t);
        for (const c of cands) {
          out.hits.push({ actor: c.a, point: _o.clone().addScaledVector(_d, c.t), head: c.head, via, dir: _d.clone() });
          skip.add(c.a);
          if (!opts.pierce) { segEnd = c.t; stop = true; break; }
        }
      }
      const a = _o.clone(), b = _o.clone().addScaledVector(_d, segEnd);
      out.segs.push([a, b]);
      if (stop) break;
      if (door) {
        door.p.travel(_tm);
        _o.copy(b).applyMatrix4(_tm);
        _d.transformDirection(_tm);
        _o.addScaledVector(door.p.twin.normal, 0.02);
        remaining -= door.t; via++; out.via = via;
        if (shooter) skip.delete(shooter); // you can shoot yourself through your own doors
        continue;
      }
      if (wh) out.world = { point: b, normal: wh.normal, box: wh.box };
      break;
    }
    out.endDir = _d.clone();
    return out;
  };
})();
