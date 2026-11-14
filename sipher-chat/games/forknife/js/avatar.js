// Avatar: a stylised human (hips, spine, head with hair, two-bone arms and legs, glider pack) and the
// low-poly weapon models. Arms use a small two-bone IK so both hands stay on the weapon.
// Models face -Z (yaw 0), so root.rotation.y is simply the actor's yaw.
(() => {
'use strict';
const V3 = THREE.Vector3;
const lam = c => new THREE.MeshLambertMaterial({ color: c });
const std = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 });
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

// [w, h, d, x, y, z, colour]  b = body, k = dark, a = rarity accent, w = wood, or a hex number
const GUNS = {
  ar:      [[.08, .12, .6, 0, .05, -.28, 'b'], [.035, .035, .3, 0, .07, -.72, 'k'], [.06, .2, .08, 0, -.1, -.3, 'k'], [.07, .1, .22, 0, .03, .14, 'a'], [.05, .15, .07, 0, -.08, -.02, 'k'], [.03, .05, .14, 0, .135, -.3, 'a']],
  burst:   [[.09, .14, .66, 0, .05, -.24, 'b'], [.04, .04, .2, 0, .06, -.66, 'k'], [.06, .18, .09, 0, -.1, .0, 'k'], [.05, .14, .07, 0, -.08, -.26, 'k'], [.05, .06, .2, 0, .15, -.2, 'a'], [.09, .06, .18, 0, .09, -.5, 'a']],
  smg:     [[.08, .12, .36, 0, .05, -.16, 'b'], [.04, .04, .12, 0, .06, -.4, 'k'], [.05, .28, .07, 0, -.15, -.18, 'a'], [.05, .13, .07, 0, -.07, .0, 'k'], [.03, .03, .2, 0, .08, .12, 'k']],
  pump:    [[.09, .11, .46, 0, .05, -.2, 'b'], [.05, .05, .5, 0, .08, -.6, 'k'], [.075, .075, .2, 0, .0, -.56, 'a'], [.08, .12, .26, 0, .02, .16, 'w'], [.05, .13, .07, 0, -.07, .0, 'w']],
  tac:     [[.1, .13, .5, 0, .05, -.22, 'b'], [.06, .06, .3, 0, .07, -.6, 'k'], [.08, .15, .12, 0, -.09, -.24, 'a'], [.08, .1, .2, 0, .03, .12, 'k'], [.05, .13, .07, 0, -.07, .0, 'k']],
  pistol:  [[.07, .11, .32, 0, .08, -.16, 'a'], [.05, .06, .16, 0, .09, -.38, 'k'], [.06, .17, .08, 0, -.05, .0, 'k'], [.03, .03, .04, 0, .15, -.3, 'k']],
  dmr:     [[.08, .11, .66, 0, .05, -.26, 'b'], [.03, .03, .42, 0, .06, -.8, 'k'], [.05, .05, .24, 0, .15, -.22, 'k'], [.06, .16, .08, 0, -.09, -.28, 'a'], [.07, .11, .26, 0, .02, .18, 'a'], [.05, .13, .07, 0, -.07, .0, 'k']],
  sniper:  [[.08, .1, .8, 0, .05, -.3, 'b'], [.035, .035, .56, 0, .06, -.98, 'k'], [.065, .065, .34, 0, .16, -.26, 'k'], [.08, .13, .3, 0, .02, .24, 'a'], [.05, .13, .07, 0, -.07, .0, 'k'], [.1, .03, .03, .06, .08, -.05, 'a']],
  minigun: [[.16, .16, .4, 0, .02, -.15, 'b'], [.04, .04, .5, .04, .05, -.6, 'k'], [.04, .04, .5, -.04, .05, -.6, 'k'], [.04, .04, .5, 0, -.03, -.6, 'k'], [.12, .12, .05, 0, .02, -.84, 'a'], [.04, .08, .2, 0, .14, -.15, 'a'], [.12, .14, .16, .13, -.02, -.1, 'a']],
  rocket:  [[.16, .16, 1.0, 0, .12, -.2, 'b'], [.21, .21, .1, 0, .12, -.72, 'a'], [.2, .2, .08, 0, .12, .3, 'k'], [.05, .14, .07, 0, -.02, -.02, 'k'], [.05, .12, .06, 0, -.01, -.34, 'k'], [.05, .07, .16, .1, .2, -.3, 'a']],
  shield:  [[.2, .26, .2, 0, .06, -.14, 0x3d9bff], [.1, .06, .1, 0, .22, -.14, 0xdde9f5], [.22, .05, .22, 0, .06, -.14, 0xdde9f5]],
  pickaxe: [[.05, .05, .78, 0, .02, -.3, 'w'], [.08, .5, .1, 0, .02, -.66, 'a'], [.06, .1, .07, 0, .3, -.66, 'k'], [.06, .1, .07, 0, -.26, -.66, 'k']]
};
G.GUN_PARTS = GUNS;
G.makeGun = id => {
  const g = new THREE.Group(), w = G.WEAPONS[id] || G.PICKAXE;
  const pal = { b: 0x3b424b, k: 0x1b1e23, a: new THREE.Color(G.RARITY[w.rarity]).getHex(), w: 0x8a5a2b };
  for (const p of GUNS[id] || GUNS.ar) g.add(box(p[0], p[1], p[2], lam(typeof p[6] === 'number' ? p[6] : pal[p[6]]), p[3], p[4], p[5]));
  return g;
};
// where the support hand goes on each weapon (gun-local z)
const FORE = { ar: -0.36, burst: -0.34, smg: -0.2, pump: -0.52, tac: -0.4, pistol: -0.03, dmr: -0.4, sniper: -0.44, minigun: -0.28, rocket: -0.32, shield: -0.14 };

// limb segment hanging down from its pivot
function seg(r, len, mat) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 10); g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
const DOWN = new V3(0, -1, 0), _dir = new V3(), _pole = new V3(), _u = new V3(), _el = new V3(), _f = new V3(), _qi = new THREE.Quaternion(), _t = new V3(), _g = new V3();
// two-bone IK in the parent's space: point `upper` then `lower` so the end reaches `target`
function ik(upper, lower, a, b, target, pole) {
  _dir.subVectors(target, upper.position); let d = _dir.length(); if (d < 1e-4) return; _dir.multiplyScalar(1 / d); d = Math.min(d, a + b - 0.002);
  const alpha = Math.acos(G.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  _pole.copy(pole).addScaledVector(_dir, -pole.dot(_dir)); if (_pole.lengthSq() < 1e-6) _pole.set(0, -1, 0); _pole.normalize();
  _u.copy(_dir).multiplyScalar(Math.cos(alpha)).addScaledVector(_pole, Math.sin(alpha));
  upper.quaternion.setFromUnitVectors(DOWN, _u);
  _el.copy(upper.position).addScaledVector(_u, a);
  _f.subVectors(target, _el).normalize();
  _qi.copy(upper.quaternion).invert(); _f.applyQuaternion(_qi);
  lower.quaternion.setFromUnitVectors(DOWN, _f);
}

G.makeAvatar = o => {
  const skin = std(o.skin || 0xf1c6a0), shirt = std(o.shirt), pants = std(o.pants || 0x3e5068), trim = std(o.trim || 0x22262e);
  const hairM = std(o.hair !== undefined ? o.hair : 0x4a2c1a), boot = std(0x2b2420), packM = std(new THREE.Color(o.shirt).multiplyScalar(0.5).getHex());
  const accent = std(o.accent || 0xffd23f), dark = std(0x15181d);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  hips.add(box(0.34, 0.16, 0.2, pants, 0, 0.0, 0));
  hips.add(box(0.36, 0.05, 0.22, trim, 0, 0.07, 0)); // belt
  // legs: thigh -> knee -> shin -> boot
  const leg = side => {
    const up = new THREE.Group(); up.position.set(side * 0.1, -0.03, 0); hips.add(up);
    up.add(seg(0.1, 0.46, pants));
    const knee = new THREE.Group(); knee.position.y = -0.46; up.add(knee);
    knee.add(seg(0.088, 0.43, pants));
    knee.add(box(0.14, 0.1, 0.27, boot, 0, -0.44, -0.05));
    knee.add(box(0.15, 0.03, 0.28, dark, 0, -0.485, -0.05));
    return { up, knee };
  };
  const legL = leg(-1), legR = leg(1);
  // spine, chest and head
  const spine = new THREE.Group(); spine.position.y = 0.05; hips.add(spine);
  const torsoG = new THREE.CapsuleGeometry(0.17, 0.26, 4, 12); torsoG.translate(0, 0.27, 0);
  const torso = new THREE.Mesh(torsoG, shirt); torso.scale.set(1.3, 1, 0.78); torso.castShadow = true; spine.add(torso);
  spine.add(box(0.03, 0.34, 0.02, accent, 0, 0.27, -0.135));                        // zip stripe
  spine.add(box(0.3, 0.07, 0.2, shirt, 0, 0.53, 0));                                // collar
  for (const sx of [-1, 1]) spine.add(box(0.045, 0.42, 0.02, trim, sx * 0.1, 0.27, -0.14)); // pack straps
  spine.add(box(0.3, 0.36, 0.13, packM, 0, 0.3, 0.19));                             // glider pack
  spine.add(box(0.22, 0.1, 0.1, trim, 0, 0.5, 0.2));
  spine.add(box(0.06, 0.24, 0.06, accent, 0.12, 0.3, 0.26));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 10), skin); neck.position.y = 0.6; spine.add(neck);
  const head = new THREE.Group(); head.position.y = 0.64; spine.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), skin); skull.position.y = 0.13; skull.scale.set(0.94, 1.06, 1); skull.castShadow = true; head.add(skull);
  // hair: a cap tilted back so the forehead shows, plus a swept fringe
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.157, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM);
  hairCap.position.set(0, 0.16, 0.012); hairCap.rotation.x = 0.55; hairCap.scale.set(1, 1.08, 1.05); head.add(hairCap);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairM);
  crown.position.set(0, 0.17, -0.005); crown.scale.set(1, 1.05, 1.02); head.add(crown);
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6), hairM); fringe.position.set(0.045, 0.255, -0.095); fringe.scale.set(1.9, 0.6, 1); fringe.rotation.z = -0.35; head.add(fringe);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), dark); eye.position.set(sx * 0.05, 0.14, -0.128); eye.scale.set(1, 1.25, 0.5); head.add(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(sx * 0.05 + 0.008, 0.152, -0.139); head.add(shine);
    const brow = box(0.055, 0.014, 0.012, hairM, sx * 0.052, 0.185, -0.13); brow.rotation.z = sx * -0.12; head.add(brow);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), skin); ear.position.set(sx * 0.137, 0.12, 0); ear.scale.set(0.5, 1, 0.8); head.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), skin); nose.position.set(0, 0.11, -0.142); head.add(nose);
  head.add(box(0.05, 0.01, 0.01, std(0x8a4a3a), 0, 0.065, -0.135)); // mouth
  // arms: shoulder -> elbow -> hand
  const arm = side => {
    const up = new THREE.Group(); up.position.set(side * 0.26, 0.47, 0); spine.add(up);
    up.add(seg(0.068, 0.28, shirt));
    const el = new THREE.Group(); el.position.y = -0.28; up.add(el);
    el.add(seg(0.06, 0.24, shirt));
    el.add(box(0.13, 0.05, 0.13, trim, 0, -0.2, 0)); // cuff
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), skin); hand.position.y = -0.27; hand.scale.set(0.9, 1.1, 0.8); el.add(hand);
    return { up, el };
  };
  const armL = arm(-1), armR = arm(1);
  const gunPivot = new THREE.Group(); spine.add(gunPivot);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; root.add(sh);
  let tag = null;
  if (o.name) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48; const k = c.getContext('2d');
    k.font = 'italic 800 28px "Barlow Condensed", sans-serif'; k.textAlign = 'center';
    const w = Math.min(250, k.measureText(o.name.toUpperCase()).width + 22);
    k.fillStyle = 'rgba(10,14,30,0.65)'; k.fillRect(128 - w / 2, 6, w, 36);
    k.fillStyle = '#ffffff'; k.fillText(o.name.toUpperCase(), 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    tag.scale.set(2.0, 0.375, 1); tag.position.y = 2.25; root.add(tag);
  }
  const guns = {};
  const poleR = new V3(0.9, -1, 0.5), poleL = new V3(-0.9, -1, 0.3), poleUp = new V3(0, -0.4, 1);
  const tR = new V3(), tL = new V3();
  const toGun = (x, y, z, out) => out.set(x, y, z).applyEuler(gunPivot.rotation).add(gunPivot.position);
  const av = {
    root, body, hips, spine, head, gunPivot, shirt, tag, held: null, walk: 0, t: Math.random() * 10, kick: 0, crouchK: 0, swing: 0,
    setColor(c) { shirt.color.setHex(c); packM.color.setHex(new THREE.Color(c).multiplyScalar(0.5).getHex()); },
    setWeapon(id) {
      if (this.held === id) return; this.held = id;
      for (const k in guns) guns[k].visible = false;
      if (!id) return;
      if (!guns[id]) { guns[id] = G.makeGun(id); gunPivot.add(guns[id]); }
      guns[id].visible = true;
    },
    // `a` is an actor, or any object with the same animation fields (the lobby passes a stub)
    animate(dt, a) {
      this.t += dt;
      const t = this.t, sp = Math.hypot(a.vel.x, a.vel.z), amp = Math.min(1, sp / 6);
      this.walk += dt * sp * 1.55;
      this.kick = Math.max(0, this.kick - dt * 4);
      this.crouchK = G.lerp(this.crouchK, a.crouch || a.slideT > 0 ? 1 : 0, Math.min(1, dt * 12));
      const ck = this.crouchK, sliding = a.slideT > 0;
      // legs
      const s = Math.sin(this.walk), c2 = Math.sin(this.walk + Math.PI);
      let uL = s * 0.75 * amp, uR = c2 * 0.75 * amp, kL = -Math.max(0, Math.sin(this.walk - 1.1)) * 1.2 * amp, kR = -Math.max(0, Math.sin(this.walk + Math.PI - 1.1)) * 1.2 * amp;
      if (!a.grounded) { uL = 0.6; kL = -1.0; uR = -0.15; kR = -0.35; }
      uL += ck * 1.0; uR += ck * 0.7; kL -= ck * 1.7; kR -= ck * 1.5;
      if (sliding) { uL = 1.5; kL = -0.3; uR = 1.2; kR = -1.4; }
      legL.up.rotation.set(uL, 0, 0); legL.knee.rotation.set(kL, 0, 0); legR.up.rotation.set(uR, 0, 0); legR.knee.rotation.set(kR, 0, 0);
      const bob = a.grounded && !sliding ? Math.abs(Math.sin(this.walk)) * 0.04 * amp : 0;
      hips.position.y = 0.95 - ck * 0.3 - (sliding ? 0.15 : 0) + bob + Math.sin(t * 2) * 0.006;
      spine.rotation.set(sliding ? 0.45 : amp * -0.12 + ck * -0.15, 0, 0);
      body.rotation.set(0, 0, 0); body.position.y = 0;
      head.rotation.set(G.clamp(a.pitch, -0.8, 0.8) * 0.55 - spine.rotation.x, 0, 0);
      // arms and weapon
      const id = this.held, pitch = G.clamp(a.pitch, -1.2, 1.2) - spine.rotation.x;
      gunPivot.rotation.set(0, 0, 0); gunPivot.visible = !!id;
      if (a.emote > 0) {
        // victory dance: arms pump overhead, hips sway
        gunPivot.visible = false;
        const w = Math.sin(t * 9);
        tR.set(0.25 + w * 0.05, 0.95 + w * 0.12, -0.05); tL.set(-0.25 + w * 0.05, 0.95 - w * 0.12, -0.05);
        ik(armR.up, armR.el, 0.28, 0.27, tR, poleUp); ik(armL.up, armL.el, 0.28, 0.27, tL, poleUp);
        body.rotation.y = Math.sin(t * 4.5) * 0.4; body.position.y = Math.abs(Math.sin(t * 9)) * 0.07;
        legL.up.rotation.x = w * 0.35; legR.up.rotation.x = -w * 0.35;
        return;
      }
      if (a.editing || a.buildMode) {
        // building: both hands out in front, palms working
        gunPivot.visible = false;
        const w = Math.sin(t * 7) * 0.02, y = 0.32 + pitch * 0.25;
        tR.set(0.16, y + w, -0.42); tL.set(-0.16, y - w, -0.42);
        ik(armR.up, armR.el, 0.28, 0.27, tR, poleR); ik(armL.up, armL.el, 0.28, 0.27, tL, poleL);
        return;
      }
      if (!id) {
        // relaxed idle: arms hang loose with a little breathing sway
        const br = Math.sin(t * 1.6) * 0.015, sw = Math.sin(this.walk) * 0.12 * amp;
        tR.set(0.31, -0.02 + br, -0.02 - sw); tL.set(-0.31, -0.02 + br, -0.02 + sw);
        ik(armR.up, armR.el, 0.28, 0.27, tR, new V3(0.2, 0, 1)); ik(armL.up, armL.el, 0.28, 0.27, tL, new V3(-0.2, 0, 1));
        return;
      }
      if (id === 'pickaxe') {
        const k = a.swingT > 0 ? 1 - a.swingT / 0.35 : 0, sw = k > 0 ? Math.sin(k * Math.PI) : 0;
        gunPivot.position.set(0.24, 0.12 + sw * 0.2, -0.16 - sw * 0.15);
        gunPivot.rotation.set(0.9 + pitch * 0.4 + (k > 0 ? (k < 0.35 ? k / 0.35 * 1.0 : 1.0 - (k - 0.35) / 0.65 * 2.6) : 0), 0, -0.15);
        toGun(0, 0, 0.04, tR); ik(armR.up, armR.el, 0.28, 0.27, tR, poleR);
        tL.set(-0.27, -0.02 + Math.sin(this.walk) * 0.05 * amp, -0.02); ik(armL.up, armL.el, 0.28, 0.27, tL, poleL);
        return;
      }
      if (id === 'shield' && a.useT > 0) {
        gunPivot.position.set(0.05, 0.62, -0.2); gunPivot.rotation.set(-0.7, 0, 0);
        toGun(0, 0, -0.14, tR); ik(armR.up, armR.el, 0.28, 0.27, tR, poleR);
        tL.set(-0.25, 0.0, -0.05); ik(armL.up, armL.el, 0.28, 0.27, tL, poleL);
        return;
      }
      // guns: held at the right of the chest, aimed with the camera pitch
      const rocket = id === 'rocket', ads = a.adsK || 0;
      gunPivot.position.set(rocket ? 0.16 : G.lerp(0.13, 0.08, ads), rocket ? 0.6 : G.lerp(0.36, 0.44, ads), rocket ? 0.02 : -0.2);
      gunPivot.rotation.set(pitch * 0.95 + this.kick * (rocket ? 0.05 : 0.18), 0, 0);
      if (a.reloadT > 0) { gunPivot.rotation.z = 0.5; gunPivot.rotation.x -= 0.35; }
      gunPivot.position.z += this.kick * 0.05;
      toGun(0, -0.1, 0.0, tR); ik(armR.up, armR.el, 0.28, 0.27, tR, poleR);
      if (a.reloadT > 0) toGun(0, -0.16 + Math.sin(t * 10) * 0.03, -0.18, tL); else toGun(0, -0.03, FORE[id] !== undefined ? FORE[id] : -0.3, tL);
      ik(armL.up, armL.el, 0.28, 0.27, tL, poleL);
    }
  };
  return av;
};
})();
