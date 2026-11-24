'use strict';
// Weapons: definitions, firing (hitscan through doors), rockets and grenades, explosions, first-person viewmodel.
G.WEAPONS = {
  ar: { name: 'PULSE AR', kind: 'primary', auto: true, rpm: 640, dmg: 17, head: 1.75, mag: 32, reload: 1.5, spread: 1.0, adsSpread: 0.2, range: 160, pellets: 1, recoil: 0.9, adsFov: 0.78, color: '#4fd8ff', sound: 'ar', bloom: 0.22, falloff: [45, 100, 0.75], desc: 'Full-auto all-rounder. Steady at range when aimed.' },
  br: { name: 'LATCH BR', kind: 'primary', burst: 3, burstGap: 0.07, rpm: 170, dmg: 21, head: 1.8, mag: 24, reload: 1.7, spread: 0.55, adsSpread: 0.05, range: 200, pellets: 1, recoil: 1.1, adsFov: 0.6, color: '#9dff6a', sound: 'br', bloom: 0.15, desc: 'Three-round burst. Rewards headshots at mid range.' },
  smg: { name: 'SWINGER SMG', kind: 'primary', auto: true, rpm: 920, dmg: 12, head: 1.5, mag: 40, reload: 1.3, spread: 1.7, adsSpread: 0.9, range: 70, pellets: 1, recoil: 0.55, adsFov: 0.86, color: '#ffd84f', sound: 'smg', bloom: 0.18, falloff: [12, 38, 0.5], desc: 'Shreds up close, keeps your speed when you hop doors.' },
  sidearm: { name: 'KNOB-9', kind: 'secondary', rpm: 380, dmg: 26, head: 2.0, mag: 12, reload: 1.15, spread: 0.45, adsSpread: 0.12, range: 120, pellets: 1, recoil: 1.5, adsFov: 0.8, color: '#ff7ad9', sound: 'pistol', bloom: 0.55, desc: 'Fast semi-auto pistol with a big headshot bonus.' },
  scatter: { name: 'SCATTER', kind: 'secondary', rpm: 80, dmg: 14, head: 1.35, mag: 6, reload: 2.0, spread: 6, adsSpread: 4.2, range: 45, pellets: 10, recoil: 4.5, adsFov: 0.88, color: '#ff9a3c', sound: 'scatter', bloom: 0, falloff: [8, 30, 0.3], desc: 'Ten-pellet shotgun. One pump through a door is enough.' },
  rail: { name: 'HINGE RAIL', kind: 'power', rpm: 55, dmg: 105, head: 2.0, mag: 4, reserve: 8, reload: 2.2, spread: 2.5, adsSpread: 0, range: 320, pellets: 1, recoil: 6, adsFov: 0.33, color: '#c070ff', sound: 'rail', bloom: 1.5, pierce: true, scope: true, desc: 'Piercing rail. Headshots kill from full health.' },
  rocket: { name: 'DOORBUSTER', kind: 'power', rpm: 60, dmg: 140, head: 1, mag: 1, reserve: 3, reload: 1.4, spread: 0, adsSpread: 0, range: 0, pellets: 0, recoil: 7, adsFov: 0.85, color: '#ff5a2a', sound: 'rocket', bloom: 0, projectile: true, desc: 'Rocket launcher. Rockets fly through doors too.' },
};
G.PRIMARIES = ['ar', 'br', 'smg'];
G.SECONDARIES = ['sidearm', 'scatter'];

(() => {
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();

  // ---------------------------------------------------------------- firing
  G.weapons = {
    projectiles: [],
    // fire one trigger pull from actor `a` with a direction function. Returns hit summary.
    fire(a, origin, dir, muzzlePos) {
      const id = a.cur, W = G.WEAPONS[id];
      if (W.projectile) { this.rocket(a, origin.clone().addScaledVector(dir, 0.6), dir.clone()); return null; }
      const spread = THREE.MathUtils.degToRad(a.currentSpread());
      let total = 0, head = false, killed = false, victim = null, vpos = null, any = false, via = false;
      const dmgMul = a.dmgMul || 1;
      const mut = G.match && G.match.mut;
      for (let i = 0; i < W.pellets; i++) {
        const d = G.cone(dir, spread, _d);
        const tr = G.trace(origin, d, W.range, a, { pierce: W.pierce });
        // tracers: first segment starts at the muzzle
        for (let s = 0; s < tr.segs.length; s++) {
          const [p, q] = tr.segs[s];
          const from = s === 0 && muzzlePos ? muzzlePos : p;
          if (W.pellets === 1 || Math.random() < 0.5) G.fx.tracer(from, q, W.color, W.pierce ? 0.07 : W.pellets > 1 ? 0.018 : 0.026, W.pierce ? 0.35 : 0.1);
        }
        if (tr.via) via = true;
        for (const h of tr.hits) {
          const t = h.actor;
          let dmg = W.dmg * (h.head ? W.head : 1) * (t.isPlayer ? dmgMul : 1);
          if (W.falloff) { const dist = origin.distanceTo(h.point); dmg *= G.clamp(1 - (dist - W.falloff[0]) / (W.falloff[1] - W.falloff[0]) * (1 - W.falloff[2]), W.falloff[2], 1); }
          if (mut && mut.instagib && id === 'rail') dmg = 999;
          const res = t.takeDamage(dmg, a, { head: h.head, via: h.via > 0, weapon: id, dir: h.dir, point: h.point });
          G.fx.impact(h.point, h.dir.clone().negate(), W.color, true);
          if (res > 0) { any = true; total += dmg; head = head || h.head; victim = t; vpos = h.point; if (res === 2) killed = true; }
        }
        if (!tr.hits.length || W.pierce) {
          if (tr.world) G.fx.impact(tr.world.point, tr.world.normal, W.color, false);
        }
      }
      if (any && victim) {
        a.onDealt && a.onDealt(total, head, killed, victim, vpos);
      }
      return { any, total, head, killed, via };
    },

    // ---------------------------------------------------------------- projectiles
    rocket(owner, pos, dir) {
      const m = G.models.rocket(); m.position.copy(pos); G.scene.add(m);
      this.projectiles.push({ kind: 'rocket', owner, pos: pos.clone(), vel: dir.clone().multiplyScalar(36), mesh: m, life: 6, via: false, trail: 0 });
    },
    jammer(owner, pos, vel) {
      const m = G.models.grenade(); m.traverse(o => { if (o.material && o.material.color && o.geometry.type === 'TorusGeometry') o.material = G.glowMat('#4ab8ff', 3); });
      m.position.copy(pos); G.scene.add(m);
      this.projectiles.push({ kind: 'jammer', owner, pos: pos.clone(), vel: vel.clone(), mesh: m, life: 1.3, via: false, bounced: 0, spin: new THREE.Vector3(G.rand(-9, 9), G.rand(-9, 9), 0) });
    },
    // close enemy doors and strip enemy shields around pos
    jam(pos, owner) {
      const R = 10;
      G.fx.shell(pos, '#4ab8ff', 0.5, R, 0.45); G.fx.shell(pos, '#ffffff', 0.2, 3, 0.2); G.fx.light(pos, '#4ab8ff', 40, 0.5, 20);
      G.fx.burst(pos, null, '#7fd0ff', 60, 16, 0.6, 0.1, 1.2, 0);
      G.audio.play('shieldBreak', { pos, ref: 16, vol: 1.1, rate: 0.7 }); G.audio.play('fizzle', { pos, ref: 16, vol: 1 });
      let closed = 0, stripped = 0;
      for (const d of G.portals.list) {
        if (!d.placed || d.center.distanceTo(pos) > R) continue;
        if (d.owner === owner || (owner && !G.match.enemies(owner, d.owner))) continue;
        d.close(); closed++;
      }
      for (const a of G.actors) {
        if (!a.alive || a === owner || (owner && !G.match.enemies(owner, a))) continue;
        const c = a.center(); if (c.distanceTo(pos) > R || !G.world.los(pos, c)) continue;
        if (a.shield > 0 || a.over > 0) { a.shield = 0; a.over = 0; a.regenDelay = 5; stripped++; a.onShieldBreak && a.onShieldBreak(); a.lastHitBy = owner; a.lastHitT = G.t; }
      }
      if (closed) G.portals.refreshNav();
      if (owner && owner.isPlayer && (closed || stripped)) { G.ui.toast((closed ? closed + ' DOOR' + (closed > 1 ? 'S' : '') + ' SHUT' : '') + (closed && stripped ? '  /  ' : '') + (stripped ? stripped + ' SHIELD' + (stripped > 1 ? 'S' : '') + ' DOWN' : ''), '#7fd0ff'); G.match.xpEarned += closed * 25 + stripped * 25; }
      return { closed, stripped };
    },
    grenade(owner, pos, vel) {
      const m = G.models.grenade(); m.position.copy(pos); G.scene.add(m);
      this.projectiles.push({ kind: 'grenade', owner, pos: pos.clone(), vel: vel.clone(), mesh: m, life: 1.9, via: false, bounced: 0, spin: new THREE.Vector3(G.rand(-9, 9), G.rand(-9, 9), G.rand(-9, 9)) });
    },
    update(dt) {
      const list = this.projectiles;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.kind !== 'rocket') p.vel.y -= 20 * G.grav() * dt;
        const sp = p.vel.length(), step = sp * dt;
        let done = false;
        if (step > 1e-5) {
          _d.copy(p.vel).divideScalar(sp);
          const wh = G.world.raycast(p.pos.x, p.pos.y, p.pos.z, _d.x, _d.y, _d.z, step + (p.kind !== 'rocket' ? 0.1 : 0), null);
          const door = G.portals.rayDoor(p.pos, _d, wh ? wh.t + 0.06 : step);
          let hitActor = null;
          if (!door && p.kind === 'rocket') {
            for (const a of G.actors) {
              if (!a.alive || (a === p.owner && p.life > 5.8 && !p.via)) continue;
              const r = a.rayTest(p.pos, _d, wh ? wh.t : step, 0.25);
              if (r) { hitActor = { a, t: r.t }; break; }
            }
          }
          if (door) {
            p.pos.addScaledVector(_d, door.t);
            door.p.travel(_m);
            p.pos.applyMatrix4(_m).addScaledVector(door.p.twin.normal, 0.03);
            p.vel.transformDirection(_m).multiplyScalar(sp);
            p.via = true;
            G.audio.play('portalPass', { pos: p.pos, vol: 0.4 });
          } else if (hitActor) {
            p.pos.addScaledVector(_d, hitActor.t); done = true;
          } else if (wh) {
            if (p.kind === 'rocket' || p.kind === 'jammer') { p.pos.addScaledVector(_d, Math.max(0, wh.t - 0.05)); done = true; }
            else {
              p.pos.addScaledVector(_d, Math.max(0, wh.t - 0.12));
              const vn = p.vel.dot(wh.normal);
              p.vel.addScaledVector(wh.normal, -1.55 * vn).multiplyScalar(0.62);
              if (Math.abs(vn) > 2) G.audio.play('clink', { pos: p.pos, vol: 0.6 });
              p.bounced++;
            }
          } else p.pos.addScaledVector(p.vel, dt);
        }
        if (p.kind === 'rocket') {
          p.mesh.position.copy(p.pos); p.mesh.lookAt(_a.copy(p.pos).add(p.vel));
          p.trail -= dt;
          if (p.trail <= 0) { p.trail = 0.012; G.fx.spawn(_b.copy(p.pos).addScaledVector(p.vel, -0.012), _a.set(G.rand(-0.4, 0.4), G.rand(-0.4, 0.4), G.rand(-0.4, 0.4)), G.col('#ffa040').multiplyScalar(2), 0.25, 0.25, 0, 3); G.fx.spawn(p.pos, _a.set(G.rand(-0.3, 0.3), G.rand(0, 0.5), G.rand(-0.3, 0.3)), G.col('#6a6460').multiplyScalar(0.2), 0.7, 1.1, 0.4, 1); }
        } else {
          p.mesh.position.copy(p.pos); p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt;
          if (Math.random() < 0.5) G.fx.spawn(p.pos, _a.set(0, 0.3, 0), G.col(p.kind === 'jammer' ? '#4ab8ff' : '#ff5530').multiplyScalar(1.5), 0.08, 0.2, 0, 1);
        }
        if (p.pos.y < G.world.map.killY - 10) { done = true; p.dud = true; }
        if (done || p.life <= 0) {
          if (!p.dud && p.kind === 'jammer') this.jam(p.pos.clone(), p.owner);
          else if (!p.dud) this.explode(p.pos, p.owner, p.kind === 'rocket' ? 'rocket' : 'grenade', p.kind === 'rocket' ? 140 : 120, p.kind === 'rocket' ? 5.5 : 6.2, p.via);
          G.scene.remove(p.mesh);
          list.splice(i, 1);
        }
      }
    },
    clear() { for (const p of this.projectiles) G.scene.remove(p.mesh); this.projectiles = []; },

    explode(pos, owner, weapon, dmg, radius, via) {
      G.fx.explosion(pos, weapon === 'rocket' ? '#ff6a2a' : '#ff8a3a', weapon === 'rocket' ? 1 : 0.9);
      G.audio.play('boom', { pos, ref: 18, vol: 1.3 });
      const cam = G.cam && G.cam.position;
      if (cam && G.player) { const d = cam.distanceTo(pos); if (d < 30) G.player.addTrauma(G.clamp((30 - d) / 30, 0, 1) * 0.6); }
      for (const a of G.actors) {
        if (!a.alive) continue;
        const c = _a.copy(a.pos); c.y += a.height() * 0.5;
        const d = c.distanceTo(pos);
        if (d > radius) continue;
        if (!G.world.los(pos, c)) continue;
        const f = 1 - d / radius;
        const amount = dmg * (0.25 + 0.75 * f);
        const push = _b.copy(c).sub(pos); if (push.lengthSq() < 0.001) push.set(0, 1, 0); push.normalize();
        a.vel.addScaledVector(push, 14 * f + 2); a.vel.y += 4 * f;
        a.takeDamage(amount, owner, { head: false, via, weapon, dir: push, point: c.clone(), explosive: true });
      }
    },
  };

  // ---------------------------------------------------------------- first-person viewmodel
  G.vm = {
    init() {
      this.scene = new THREE.Scene();
      this.cam = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.01, 10);
      this.hemi = new THREE.HemisphereLight(0xc8d8ff, 0x4a3a30, 1.0);
      this.dir = new THREE.DirectionalLight(0xffffff, 2.2); this.dir.position.set(-0.4, 1, 0.3);
      this.scene.add(this.hemi, this.dir, this.cam);
      this.root = new THREE.Group(); this.cam.add(this.root);
      this.gunHolder = new THREE.Group(); this.root.add(this.gunHolder);
      this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), G.glowMat('#ffd9a0', 6)); this.flash.visible = false;
      this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.radialTex(), color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.flashSprite.visible = false;
      this.root.add(this.flash, this.flashSprite);
      this.gun = null; this.gadget = null; this.cur = null;
    },
    setLights(t) {
      if (!this.hemi) return;
      this.hemi.color.set(t.hemiSky); this.hemi.groundColor.set(t.hemiGround); this.hemi.intensity = t.hemiI * 1.1;
      this.dir.color.set(t.lightColor); this.dir.intensity = Math.min(2.6, t.lightI * 0.85);
    },
    build(player) {
      const suit = G.SUITS[G.save.suit % G.SUITS.length].c;
      if (this.gadget) this.root.remove(this.gadget);
      this.gadget = G.models.gadget(player.portalColors[0], player.portalColors[1], suit);
      this.root.add(this.gadget);
      this.suit = suit; this.cur = null;
    },
    equip(id) {
      if (this.gun) this.gunHolder.remove(this.gun);
      const acc = G.ACCENTS[G.save.accent % G.ACCENTS.length];
      const g = G.models.gun(id, acc.c || G.WEAPONS[id].color);
      if (!g.userData.accent) { g.scale.setScalar(0.84); g.position.set(0.015, -0.015, -0.07); } // Sketchfab gun: sit it a touch further out
      const arm = G.models.fpArm(this.suit); arm.position.set(0.0, -0.1, 0.12); arm.rotation.set(0.25, -0.12, 0); g.add(arm);
      if (id !== 'sidearm') { const arm2 = G.models.fpArm(this.suit, true); arm2.position.set(-0.05, -0.06, -0.3); arm2.rotation.set(0.3, 0.6, 0.2); g.add(arm2); }
      g.traverse(o => { if (o.isMesh) o.castShadow = false; });
      this.gun = g; this.gunHolder.add(g); this.cur = id;
      this.muzzle = g.userData.muzzle;
    },
    muzzleWorld(out) {
      // muzzle in the main camera's world frame (viewmodel lives in camera space)
      this.root.updateMatrixWorld(true);
      const p = (out || new THREE.Vector3()).setFromMatrixPosition(this.muzzle.matrixWorld);
      // vm cam is at origin with identity; convert camera-space -> world through main cam
      return p.applyMatrix4(G.cam.matrixWorld);
    },
  };
})();
