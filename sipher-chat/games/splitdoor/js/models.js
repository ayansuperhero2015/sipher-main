'use strict';
// Procedural models: door-runner robots, weapons (first and third person), portal gadget, pickups, projectiles.
G.models = {};
(() => {
  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
    m.castShadow = true; if (parent) parent.add(m); return m;
  };
  const cyl = (r1, r2, len, mat, seg = 12, parent) => {
    const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; if (parent) parent.add(m); return m;
  };
  const piv = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  G.models.box = box; G.models.cyl = cyl;

  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.42, metalness: 0.8 });
  const gunDark = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.65, metalness: 0.4 });
  const gunLight = new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.38, metalness: 0.35 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.05, metalness: 0.9 });
  G.models.mats = { gunMetal, gunDark, gunLight };

  // ---------------------------------------------------------------- robots
  G.models.robotBoxes = (suitColor, accentColor) => {
    const root = new THREE.Group();
    const armor = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.42, metalness: 0.25 });
    const joint = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.6, metalness: 0.5 });
    const acc = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.4, metalness: 0.2, emissive: accentColor, emissiveIntensity: 0.35 });
    const visor = G.glowMat(accentColor, 2.6);
    const P = {};
    P.hips = piv(root, 0, 0.95, 0);
    box(0.42, 0.18, 0.26, joint, 0, 0, 0, P.hips);
    P.torso = piv(P.hips, 0, 0.08, 0);
    box(0.4, 0.2, 0.24, joint, 0, 0.08, 0, P.torso);
    const chest = box(0.58, 0.46, 0.34, armor, 0, 0.38, 0, P.torso);
    box(0.36, 0.2, 0.04, acc, 0, 0.42, -0.18, P.torso);
    box(0.6, 0.08, 0.36, acc, 0, 0.18, 0, P.torso);
    // jetpack
    const jp = box(0.42, 0.44, 0.18, joint, 0, 0.36, 0.25, P.torso);
    for (const s of [-1, 1]) {
      const n = cyl(0.06, 0.08, 0.16, gunMetal, 10, P.torso); n.rotation.x = 0; n.geometry.rotateX(-Math.PI / 2); n.position.set(s * 0.12, 0.1, 0.3);
      box(0.1, 0.3, 0.06, acc, s * 0.14, 0.42, 0.35, P.torso);
    }
    const flameMat = new THREE.MeshBasicMaterial({ color: G.col(accentColor).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    P.flames = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 8), flameMat); f.rotation.x = Math.PI; f.position.set(s * 0.12, -0.2, 0.3); f.visible = false;
      P.torso.add(f); P.flames.push(f);
    }
    P.neck = piv(P.torso, 0, 0.64, 0);
    P.head = piv(P.neck, 0, 0.02, 0);
    box(0.34, 0.3, 0.34, armor, 0, 0.15, 0, P.head);
    box(0.36, 0.06, 0.36, acc, 0, 0.02, 0, P.head);
    P.visor = box(0.3, 0.09, 0.04, visor, 0, 0.17, -0.17, P.head); P.visor.castShadow = false;
    box(0.03, 0.22, 0.03, joint, 0.12, 0.38, 0.06, P.head);
    // arms
    for (const s of [-1, 1]) {
      const sh = piv(P.torso, s * 0.37, 0.52, 0);
      box(0.2, 0.16, 0.24, armor, s * 0.03, 0.02, 0, sh);
      box(0.12, 0.3, 0.12, joint, 0, -0.17, 0, sh);
      const el = piv(sh, 0, -0.32, 0);
      box(0.14, 0.28, 0.14, armor, 0, -0.14, 0, el);
      box(0.12, 0.1, 0.12, joint, 0, -0.31, 0, el);
      P[s < 0 ? 'lArm' : 'rArm'] = sh; P[s < 0 ? 'lEl' : 'rEl'] = el;
    }
    // legs
    for (const s of [-1, 1]) {
      const hp = piv(P.hips, s * 0.13, -0.04, 0);
      box(0.18, 0.44, 0.2, armor, 0, -0.22, 0, hp);
      const kn = piv(hp, 0, -0.45, 0);
      box(0.15, 0.42, 0.17, joint, 0, -0.21, 0, kn);
      box(0.16, 0.12, 0.08, acc, 0, -0.08, -0.09, kn);
      const ft = box(0.17, 0.09, 0.3, armor, 0, -0.45, -0.05, kn);
      P[s < 0 ? 'lLeg' : 'rLeg'] = hp; P[s < 0 ? 'lKnee' : 'rKnee'] = kn;
    }
    P.gunMount = piv(P.torso, 0.16, 0.3, -0.36);
    root.userData.P = P; root.userData.mats = { armor, acc, visor, flameMat };
    root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    return root;
  };
  G.models.setRobotColors = (root, suit, accent) => {
    const M = root.userData.mats;
    M.armor.color.set(suit); M.acc.color.set(accent); M.acc.emissive.set(accent);
    M.visor.color.set(accent).multiplyScalar(2.6); M.flameMat.color.set(accent).multiplyScalar(3);
  };
  // procedural animation; s = {speed, phase, ground, crouch, slide, pitch, jet, t, melee}
  G.models.animateBoxes = (root, s) => {
    const P = root.userData.P;
    const sp = Math.min(1, s.speed / 10.5), ph = s.phase;
    const swing = Math.sin(ph) * 0.9 * sp, swing2 = Math.sin(ph + Math.PI) * 0.9 * sp;
    let hipY = 0.95 + Math.abs(Math.cos(ph)) * 0.05 * sp;
    let lLeg = swing, rLeg = swing2, lKnee = Math.max(0, -Math.sin(ph - 0.6)) * 1.1 * sp, rKnee = Math.max(0, -Math.sin(ph + Math.PI - 0.6)) * 1.1 * sp;
    let lean = -0.12 * sp;
    if (!s.ground) { lLeg = -0.5; rLeg = 0.25; lKnee = 0.9; rKnee = 0.4; hipY = 0.95; lean = -0.05; }
    if (s.crouch) { hipY = 0.62; lLeg = -1.0 + swing * 0.4; rLeg = -1.0 + swing2 * 0.4; lKnee = 1.6; rKnee = 1.6; lean = -0.25; }
    if (s.slide) { hipY = 0.42; lLeg = -1.5; rLeg = -0.6; lKnee = 0.3; rKnee = 1.4; lean = 0.55; }
    P.hips.position.y = hipY;
    P.lLeg.rotation.x = lLeg; P.rLeg.rotation.x = rLeg; P.lKnee.rotation.x = lKnee; P.rKnee.rotation.x = rKnee;
    P.torso.rotation.x = lean + s.pitch * 0.35;
    P.neck.rotation.x = s.pitch * 0.55;
    // arms hold the gun toward aim
    const aim = s.pitch * 0.6;
    P.rArm.rotation.set(-1.25 + aim - (s.melee || 0) * 0.8, -0.2, 0); P.rEl.rotation.set(-0.5, 0, 0);
    P.lArm.rotation.set(-1.15 + aim - (s.melee || 0) * 1.4, 0.55, 0); P.lEl.rotation.set(-0.75, 0, 0);
    P.gunMount.rotation.x = aim * 0.9;
    for (const f of P.flames) { f.visible = !!s.jet; if (s.jet) f.scale.set(1, 0.7 + Math.random() * 0.6, 1); }
  };

  // ---------------------------------------------------------------- weapons
  const accentMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.3 });
  G.models.gunBoxes = (id, accent) => {
    const g = new THREE.Group(); const A = accentMat(accent || G.WEAPONS[id].color);
    const muzzle = new THREE.Object3D(); g.add(muzzle);
    const add = (o) => { g.add(o); return o; };
    if (id === 'ar') {
      box(0.075, 0.1, 0.42, gunMetal, 0, 0, -0.05, g);
      box(0.07, 0.07, 0.24, gunLight, 0, 0.005, -0.36, g);
      const b = cyl(0.016, 0.016, 0.18, gunDark, 10, g); b.position.set(0, 0.01, -0.56);
      box(0.05, 0.16, 0.08, gunDark, 0, -0.12, -0.08, g).rotation.x = 0.25;
      box(0.05, 0.12, 0.06, gunDark, 0, -0.1, 0.12, g).rotation.x = -0.35;
      box(0.06, 0.09, 0.2, gunMetal, 0, -0.01, 0.25, g);
      box(0.03, 0.03, 0.3, A, 0, 0.065, -0.12, g);
      box(0.045, 0.05, 0.06, lens, 0, 0.08, 0.04, g);
      muzzle.position.set(0, 0.01, -0.66);
    } else if (id === 'br') {
      box(0.075, 0.11, 0.5, gunLight, 0, 0, -0.08, g);
      box(0.065, 0.075, 0.26, gunMetal, 0, 0.0, -0.43, g);
      const b = cyl(0.017, 0.017, 0.2, gunDark, 10, g); b.position.set(0, 0.01, -0.64);
      box(0.05, 0.14, 0.07, gunDark, 0, -0.12, -0.06, g).rotation.x = 0.15;
      box(0.05, 0.12, 0.06, gunDark, 0, -0.1, 0.12, g).rotation.x = -0.35;
      box(0.065, 0.1, 0.22, gunMetal, 0, -0.01, 0.27, g);
      const sc = cyl(0.03, 0.03, 0.2, gunDark, 12, g); sc.position.set(0, 0.1, -0.05);
      box(0.02, 0.02, 0.42, A, 0.04, 0.02, -0.12, g); box(0.02, 0.02, 0.42, A, -0.04, 0.02, -0.12, g);
      muzzle.position.set(0, 0.01, -0.75);
    } else if (id === 'smg') {
      box(0.07, 0.11, 0.3, gunMetal, 0, 0, -0.02, g);
      box(0.06, 0.06, 0.12, gunLight, 0, 0.02, -0.22, g);
      const b = cyl(0.02, 0.02, 0.1, gunDark, 10, g); b.position.set(0, 0.02, -0.32);
      box(0.045, 0.26, 0.06, gunDark, 0, -0.17, -0.1, g);
      box(0.05, 0.12, 0.06, gunDark, 0, -0.1, 0.08, g).rotation.x = -0.3;
      box(0.04, 0.04, 0.16, gunMetal, 0, 0.0, 0.2, g);
      box(0.075, 0.025, 0.2, A, 0, 0.065, -0.04, g);
      muzzle.position.set(0, 0.02, -0.38);
    } else if (id === 'sidearm') {
      box(0.05, 0.07, 0.24, gunLight, 0, 0.02, -0.06, g);
      box(0.045, 0.05, 0.22, gunMetal, 0, -0.03, -0.06, g);
      box(0.045, 0.14, 0.06, gunDark, 0, -0.1, 0.03, g).rotation.x = -0.2;
      box(0.052, 0.015, 0.16, A, 0, 0.06, -0.08, g);
      muzzle.position.set(0, 0.02, -0.2);
    } else if (id === 'scatter') {
      box(0.09, 0.12, 0.42, gunMetal, 0, 0, -0.05, g);
      const b1 = cyl(0.025, 0.025, 0.36, gunDark, 10, g); b1.position.set(0.025, 0.02, -0.42);
      const b2 = cyl(0.025, 0.025, 0.36, gunDark, 10, g); b2.position.set(-0.025, 0.02, -0.42);
      box(0.09, 0.07, 0.18, gunLight, 0, -0.045, -0.38, g);
      box(0.05, 0.14, 0.07, gunDark, 0, -0.11, 0.08, g).rotation.x = -0.3;
      box(0.07, 0.1, 0.18, gunMetal, 0, -0.02, 0.26, g);
      box(0.095, 0.03, 0.12, A, 0, 0.075, -0.1, g);
      muzzle.position.set(0, 0.02, -0.62);
    } else if (id === 'rail') {
      box(0.08, 0.12, 0.6, gunLight, 0, 0, -0.1, g);
      const b = cyl(0.022, 0.022, 0.5, gunDark, 12, g); b.position.set(0, 0.01, -0.62);
      for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16), A); r.position.set(0, 0.01, -0.45 - i * 0.1); g.add(r); }
      box(0.05, 0.14, 0.07, gunDark, 0, -0.12, 0.05, g).rotation.x = -0.25;
      box(0.06, 0.12, 0.26, gunMetal, 0, -0.01, 0.32, g);
      const sc = cyl(0.04, 0.04, 0.28, gunDark, 14, g); sc.position.set(0, 0.12, -0.05);
      box(0.012, 0.012, 0.5, A, 0, 0.06, -0.15, g);
      muzzle.position.set(0, 0.01, -0.88);
    } else if (id === 'rocket') {
      const t = cyl(0.085, 0.085, 0.85, gunMetal, 16, g); t.position.set(0, 0.03, -0.1);
      const f = cyl(0.1, 0.1, 0.12, gunLight, 16, g); f.position.set(0, 0.03, -0.52);
      const bk = cyl(0.1, 0.07, 0.1, gunDark, 16, g); bk.position.set(0, 0.03, 0.34);
      box(0.05, 0.14, 0.06, gunDark, 0, -0.1, -0.05, g).rotation.x = -0.25;
      box(0.05, 0.12, 0.06, gunDark, 0, -0.1, -0.3, g);
      box(0.02, 0.06, 0.6, A, 0, 0.12, -0.1, g);
      box(0.06, 0.06, 0.1, lens, 0.1, 0.08, -0.15, g);
      muzzle.position.set(0, 0.03, -0.6);
    }
    g.userData.muzzle = muzzle; g.userData.accent = A;
    return g;
  };

  // first-person arm attached to a gun
  G.models.fpArm = (suit, left) => {
    const g = new THREE.Group();
    // dark undersuit sleeve, a narrow armor plate in the suit colour, knuckled glove
    const sleeve = new THREE.MeshStandardMaterial({ color: suit, roughness: 0.42, metalness: 0.3 });
    const under = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.85, metalness: 0.1 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.75, metalness: 0.2 });
    const fa = cyl(0.042, 0.05, 0.42, under, 10, g); fa.position.z = 0.22;
    box(0.07, 0.025, 0.2, sleeve, 0, 0.042, 0.2, g);
    box(0.06, 0.012, 0.012, G.models.mats.gunMetal, 0, 0.056, 0.11, g);
    const cuff = cyl(0.053, 0.053, 0.04, glove, 10, g); cuff.position.z = 0.02;
    box(0.075, 0.06, 0.1, glove, 0, -0.005, -0.05, g);
    for (let i = 0; i < 4; i++) box(0.016, 0.02, 0.05, glove, -0.027 + i * 0.018, -0.01, -0.12, g);
    g.userData.sleeve = sleeve;
    return g;
  };

  // left-hand portal launcher
  G.models.gadget = (c0, c1, suit) => {
    const g = new THREE.Group();
    const arm = G.models.fpArm(suit, true); arm.rotation.set(0.15, 0.25, 0); g.add(arm);
    box(0.12, 0.08, 0.2, gunMetal, 0, 0.07, 0.1, g);
    box(0.11, 0.022, 0.19, gunMetal, 0, 0.112, 0.1, g); box(0.124, 0.05, 0.03, G.models.mats.gunDark, 0, 0.08, 0.0, g);
    const lA = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 14), G.glowMat(c0, 3)); lA.rotation.x = Math.PI / 2; lA.position.set(-0.03, 0.075, -0.005); g.add(lA);
    const lB = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 14), G.glowMat(c1, 3)); lB.rotation.x = Math.PI / 2; lB.position.set(0.03, 0.075, -0.005); g.add(lB);
    const sA = box(0.05, 0.012, 0.12, G.glowMat(c0, 2), -0.03, 0.135, 0.1, g); const sB = box(0.05, 0.012, 0.12, G.glowMat(c1, 2), 0.03, 0.135, 0.1, g);
    g.userData.lights = [lA, lB, sA, sB]; g.userData.arm = arm;
    return g;
  };

  // ---------------------------------------------------------------- props
  G.models.grenade = () => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), gunMetal); b.castShadow = true; g.add(b);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.02, 6, 16), G.glowMat('#ff5530', 3)); band.rotation.x = Math.PI / 2; g.add(band);
    return g;
  };
  G.models.rocket = () => {
    const g = new THREE.Group();
    const b = cyl(0.06, 0.06, 0.5, gunLight, 10, g);
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), gunMetal); n.rotation.x = -Math.PI / 2; n.position.z = -0.33; g.add(n);
    for (let i = 0; i < 4; i++) { const f = box(0.01, 0.12, 0.12, gunMetal, 0, 0, 0.2, g); f.rotation.z = i * Math.PI / 2; f.position.set(Math.sin(i * Math.PI / 2) * 0.07, Math.cos(i * Math.PI / 2) * 0.07, 0.2); }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), G.glowMat('#ffb050', 5)); glow.position.z = 0.3; g.add(glow);
    return g;
  };
  G.models.pickup = (type) => {
    const g = new THREE.Group();
    const col = { rail: '#c070ff', rocket: '#ff5a2a', overshield: '#4ad6ff', frag: '#ff7a3c' }[type] || '#ffffff';
    const padMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.4, metalness: 0.6 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.16, 24), padMat); pad.position.y = 0.08; pad.receiveShadow = true; g.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.04, 6, 40), G.glowMat(col, 2.5)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.17; g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 2.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: G.col(col).multiplyScalar(0.6), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 1.25; g.add(beam);
    const item = new THREE.Group(); item.position.y = 1.15; g.add(item);
    if (type === 'rail' || type === 'rocket') { const gm = G.models.gun(type); gm.scale.setScalar(1.6); gm.rotation.y = Math.PI / 2; item.add(gm); }
    else if (type === 'overshield') { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 })); item.add(o); const w = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: G.col(col).multiplyScalar(2), wireframe: true })); item.add(w); }
    else if (type === 'frag') { for (let i = 0; i < 3; i++) { const gr = G.models.grenade(); gr.scale.setScalar(1.6); gr.position.set(Math.cos(i * 2.1) * 0.22, 0, Math.sin(i * 2.1) * 0.22); item.add(gr); } }
    g.userData = { item, beam, ring, col };
    return g;
  };
})();

// ---------------------------------------------------------------- Sketchfab-backed models with procedural fallbacks
(() => {
  const AX = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qi = new THREE.Quaternion();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  const BONES = {
    spine: 'Bone001_02', chest: 'Bone002_03', head: 'Bone006_018', headEnd: 'Bone006_end_048',
    uaL: 'UpperArm_L_05', faL: 'ForeArm_L_06', wrL: 'Wrist_L_07', uaR: 'UpperArm_R_020', faR: 'ForeArm_R_021', wrR: 'Wrist_R_022',
    ulL: 'UpperLeg_L_033', llL: 'LowerLeg_L_034', leL: 'LowerLeg_L_end_053', ulR: 'UpperLeg_R_035', llR: 'LowerLeg_R_036', leR: 'LowerLeg_R_end_054',
    fkL: 'FootIK_L_039', fkR: 'FootIK_R_037',
  };
  // which animated bone each one inherits its delta from
  const PARENT = { spine: null, chest: 'spine', head: 'chest', uaL: 'chest', faL: 'uaL', uaR: 'chest', faR: 'uaR', ulL: null, llL: 'ulL', ulR: null, llR: 'ulR' };
  const CHILD = { spine: 'chest', chest: 'head', head: 'headEnd', uaL: 'faL', faL: 'wrL', uaR: 'faR', faR: 'wrR', ulL: 'llL', llL: 'leL', ulR: 'llR', llR: 'leR' };

  G.models.gun = (id, accent) => (G.assets && G.assets.gun(id)) || G.models.gunBoxes(id, accent);

  G.models.robot = (suit, accent) => {
    const src = G.assets && G.assets.android;
    if (!src) return G.models.robotBoxes(suit, accent);
    const root = new THREE.Group();
    const body = TA.SkeletonUtils.clone(src);
    const rest = src.userData.rest, s = 1.8 / src.userData.h;
    // tint: armour takes the suit colour, joints stay dark (the texture carries that split)
    const armor = new THREE.MeshStandardMaterial(); let base = null;
    body.traverse(o => { if (o.isMesh) { if (!base) base = o.material; o.material = armor; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    armor.copy(base); armor.color.set(suit).lerp(new THREE.Color(1, 1, 1), 0.35); armor.metalness = 0.35; armor.roughness = 0.45;
    const B = {};
    body.traverse(o => { for (const k in BONES) if (o.name === BONES[k]) B[k] = o; });
    // accent pieces glued to bones (built with the body at identity, then re-parented)
    body.updateMatrixWorld(true);
    const visorMat = G.glowMat(accent, 2.6);
    const acc = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5, roughness: 0.4 });
    const hp = rest[BONES.head].p, he = rest[BONES.headEnd].p;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.03), visorMat);
    visor.position.set(0, hp.y + (he.y - hp.y) * 0.55, Math.max(hp.z, he.z) + 0.1); body.add(visor); B.head.attach(visor);
    const cp = rest[BONES.chest].p;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.14), G.models.mats.gunDark); pack.position.set(0, cp.y + 0.05, cp.z - 0.17); pack.castShadow = true; body.add(pack); B.chest.attach(pack);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.02), acc); strip.position.set(0, cp.y + 0.05, cp.z - 0.245); body.add(strip); B.chest.attach(strip);
    const flameMat = new THREE.MeshBasicMaterial({ color: G.col(accent).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const flames = [];
    for (const sx of [-0.08, 0.08]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 8), flameMat); f.rotation.x = Math.PI;
      f.position.set(sx, cp.y - 0.25, cp.z - 0.2); f.visible = false; body.add(f); B.chest.attach(f); flames.push(f);
    }
    body.rotation.y = Math.PI; body.scale.setScalar(s);
    root.add(body);
    const gunMount = new THREE.Object3D(); gunMount.position.set(0.14, 1.3, -0.38); root.add(gunMount);
    // bone lengths for arm IK (model frame)
    const len = (a, b) => rest[BONES[a]].p.distanceTo(rest[BONES[b]].p);
    const rig = { body, B, rest, s, D: {}, l1: len('uaR', 'faR'), l2: len('faR', 'wrR') };
    root.userData.P = { gunMount, flames, visor };
    root.userData.mats = { armor, acc, visor: visorMat, flameMat };
    root.userData.rig = rig;
    return root;
  };

  G.models.setRobotColors = (root, suit, accent) => {
    const M = root.userData.mats;
    M.armor.color.set(suit); if (root.userData.rig) M.armor.color.lerp(new THREE.Color(1, 1, 1), 0.35);
    M.acc.color.set(accent); M.acc.emissive.set(accent);
    M.visor.color.set(accent).multiplyScalar(2.6); M.flameMat.color.set(accent).multiplyScalar(3);
  };

  // point bone k along model-frame direction d (minimal rotation from its rest direction)
  function aim(rig, k, d) {
    const R = rig.rest, nm = BONES[k], r = R[nm];
    v1.copy(R[BONES[CHILD[k]]].p).sub(r.p).normalize();
    const D = rig.D[k] || (rig.D[k] = new THREE.Quaternion());
    D.setFromUnitVectors(v1, v2.copy(d).normalize());
    const Dp = PARENT[k] ? rig.D[PARENT[k]] : qi;
    // local = qp^-1 * Dp^-1 * D * qp * q0
    q1.copy(r.qp).invert().multiply(q2.copy(Dp).invert()).multiply(D).multiply(r.qp).multiply(r.q0);
    rig.B[k].quaternion.copy(q1);
  }
  // two-bone IK: shoulder S to target T, elbow pushed toward pole; returns [upper dir, lower dir]
  function ik(S, T, l1, l2, pole, o1, o2) {
    const dv = v3.copy(T).sub(S); let d = dv.length();
    d = Math.min(d, (l1 + l2) * 0.995); dv.normalize();
    const a = (l1 * l1 + d * d - l2 * l2) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const pn = v4.copy(pole).addScaledVector(dv, -pole.dot(dv)).normalize();
    const E = AX.copy(S).addScaledVector(dv, a).addScaledVector(pn, h);
    o1.copy(E).sub(S).normalize(); o2.copy(S).addScaledVector(dv, d).sub(E).normalize();
  }
  const tmpS = new THREE.Vector3(), tmpT = new THREE.Vector3(), d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
  const poleL = new THREE.Vector3(), poleR = new THREE.Vector3(), wp = new THREE.Vector3();

  G.models.animateRobot = (root, st) => {
    const rig = root.userData.rig;
    if (!rig) return G.models.animateBoxes(root, st);
    const P = root.userData.P, s = rig.s, body = rig.body;
    const sp = Math.min(1, st.speed / 10.5), ph = st.phase;
    // model frame faces +z. Legs: thigh swing a (forward +), knee bend k (shin goes back)
    let aL = Math.sin(ph) * 0.75 * sp, aR = -aL, kL = Math.max(0, -Math.sin(ph - 0.6)) * 1.1 * sp, kR = Math.max(0, -Math.sin(ph + Math.PI - 0.6)) * 1.1 * sp;
    let lean = 0.12 * sp, drop = Math.abs(Math.cos(ph)) * 0.03 * sp;
    if (!st.ground) { aL = 0.5; aR = -0.2; kL = 0.9; kR = 0.4; lean = 0.05; drop = 0; }
    if (st.crouch) { aL = 1.0 + aL * 0.3; aR = 1.0 + aR * 0.3; kL = kR = 1.9; lean = 0.3; drop = 0.42; }
    if (st.slide) { aL = 1.4; aR = 0.6; kL = 0.3; kR = 1.5; lean = -0.5; drop = 0.62; }
    body.position.y = -drop;
    const leg = (a) => v1.set(0, -Math.cos(a), Math.sin(a));
    aim(rig, 'ulL', leg(aL).clone()); aim(rig, 'llL', leg(aL - kL).clone());
    aim(rig, 'ulR', leg(aR).clone()); aim(rig, 'llR', leg(aR - kR).clone());
    const pitch = st.pitch;
    aim(rig, 'spine', v2.set(0, Math.cos(lean + pitch * 0.15), Math.sin(lean + pitch * 0.15)).clone());
    aim(rig, 'chest', v2.set(0, Math.cos(lean + pitch * 0.3), Math.sin(lean + pitch * 0.3)).clone());
    aim(rig, 'head', v2.set(0, Math.cos(pitch * 0.7), Math.sin(pitch * 0.7)).clone());
    // gun follows aim pitch; hands reach for it
    const aimP = pitch * 0.9, m = st.melee || 0;
    P.gunMount.position.set(0.14, 1.3 - drop, -0.38 - m * 0.25); P.gunMount.rotation.set(aimP, 0, 0);
    body.updateMatrixWorld(true);
    // shoulder positions in model frame
    const toModel = (bone, out) => body.worldToLocal(bone.getWorldPosition(out));
    root.updateMatrixWorld(true);
    // grip targets: root frame -> model frame (negate x,z; divide by scale)
    const gp = P.gunMount.position, cosP = Math.cos(aimP), sinP = Math.sin(aimP);
    const tgt = (x, y, z, out) => { // point on the gun in gunMount space -> model space
      const ry = y * cosP - z * sinP, rz = y * sinP + z * cosP;
      return out.set(-(gp.x + x) / s, (gp.y + ry) / s, -(gp.z + rz) / s);
    };
    poleR.set(0.6, -1, -0.3); poleL.set(-0.6, -1, -0.3); // model frame: right arm is -x
    toModel(rig.B.uaR, tmpS); tgt(0, -0.05, 0.12, tmpT); ik(tmpS, tmpT, rig.l1, rig.l2, poleR.set(-0.7, -1, -0.2), d1, d2); aim(rig, 'uaR', d1); aim(rig, 'faR', d2);
    toModel(rig.B.uaL, tmpS); tgt(0, -0.04, -0.2, tmpT); ik(tmpS, tmpT, rig.l1, rig.l2, poleL.set(0.7, -1, -0.2), d1, d2); aim(rig, 'uaL', d1); aim(rig, 'faL', d2);
    // feet hang off separate IK bones: pin them to the shin ends
    body.updateMatrixWorld(true);
    for (const [fk, le] of [['fkL', 'leL'], ['fkR', 'leR']]) {
      const F = rig.B[fk], E = rig.B[le]; if (!F || !E) continue;
      E.getWorldPosition(wp); F.parent.worldToLocal(wp); F.position.copy(wp);
    }
    for (const f of P.flames) { f.visible = !!st.jet; if (st.jet) f.scale.set(1, 0.7 + Math.random() * 0.6, 1); }
  };
})();
