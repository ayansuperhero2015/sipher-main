'use strict';
// Players' own avatars (games/shared/avatar.js) in Split Door X: your shirt colour is your runner's
// armour and your hat sits on its head, in every Sipher game. Team colours still mark teams.
(() => {
  const SA = window.SipherAvatar;
  let pending = null; // the look for the robot being built right now

  // A shared hat on a robot: the android's head bone, or the box robot's head.
  function addHat(root, kind) {
    if (!kind || kind === 'none') return;
    const h = SA.hat(kind);
    const rig = root.userData.rig;
    if (rig && rig.B.head) {
      const hb = rig.B.head, he = rig.B.headEnd || hb;
      const hp = rig.rest[hb.name].p, ep = rig.rest[he.name].p;
      const size = Math.max(0.12, Math.abs(ep.y - hp.y) * rig.s); // head height in metres
      const k = G.clamp(size / 0.42, 0.3, 0.8);
      // built in the body's own (unscaled, +z facing) frame, then glued to the head bone
      h.position.set(0, (hp.y + ep.y) / 2, (hp.z + ep.z) / 2);
      h.scale.setScalar(k / rig.s);
      h.rotation.y = Math.PI;
      rig.body.add(h);
      root.updateMatrixWorld(true);
      hb.attach(h);
    } else {
      h.position.y = 1.62; h.scale.setScalar(0.62);
      root.add(h);
    }
    h.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  }

  const realRobot = G.models.robot;
  G.models.robot = (suit, accent) => {
    const look = pending; pending = null;
    if (!look) return realRobot(suit, accent);
    const root = realRobot(look.shirt, accent);
    addHat(root, look.hat);
    root.userData.look = JSON.stringify(look);
    return root;
  };

  // You look like yourself in every match.
  const P0 = G.Player;
  G.Player = class extends P0 {
    constructor(o) { pending = SA.clean(SA.cfg); super(Object.assign({}, o, { suit: SA.clean(SA.cfg).shirt })); pending = null; }
  };
  // Friends (js/party.js) are built through G.withLook(look, () => new ...).
  G.withLook = (look, make) => { pending = look ? SA.clean(look) : null; try { return make(); } finally { pending = null; } };

  // Rebuilds an actor's robot with a new look, in place.
  G.swapLook = (a, look) => {
    const key = JSON.stringify(SA.clean(look));
    if (a.model.userData.look === key) return;
    const old = a.model;
    G.scene.remove(old);
    a.model = G.withLook(look, () => G.models.robot(SA.clean(look).shirt, a.accent));
    a.suit = SA.clean(look).shirt;
    a.model.position.copy(old.position); a.model.rotation.copy(old.rotation); a.model.visible = old.visible;
    G.scene.add(a.model);
    a.gunModel = null; a.attachGun();
  };

  // First-person arms in your shirt colour.
  const realVmBuild = G.vm.build;
  G.vm.build = function (player) { realVmBuild.call(this, player); this.suit = SA.clean(SA.cfg).shirt; this.cur = null; };

  addEventListener('sipher-avatar', () => {
    const p = G.player;
    if (p && G.state === 'playing') { G.swapLook(p, SA.cfg); p.model.visible = false; G.vm.suit = SA.clean(SA.cfg).shirt; G.vm.equip(p.cur); }
  });

  /* ---------- menu buttons: Avatar and Back to Sipher ---------- */

  const css = document.createElement('style');
  css.textContent = `
  .sp-btns { display: flex; gap: 8px; margin-left: 18px; align-items: center; }
  .sp-btn { padding: 6px 12px; border: 1px solid rgba(236,232,225,0.55); background: rgba(10,12,16,0.5); color: #ece8e1; cursor: pointer;
    font: 600 12px 'IBM Plex Mono', monospace; letter-spacing: 0.12em; text-transform: uppercase; }
  .sp-btn:hover { background: rgba(236,232,225,0.14); }
  #avatar-ov .box { background: #121418; border-color: #ece8e1; font-family: 'Archivo', 'Segoe UI', sans-serif; }
  #avatar-ov h2 { font-family: 'Archivo', sans-serif; letter-spacing: 0.08em; color: #ece8e1; }`;
  document.head.appendChild(css);

  function addButtons() {
    const bar = document.querySelector('#menu .topbar');
    if (!bar || bar.querySelector('.sp-btns')) return;
    const box = document.createElement('div'); box.className = 'sp-btns';
    const av = document.createElement('button'); av.className = 'sp-btn'; av.textContent = 'Avatar';
    av.onclick = () => SA.openEditor({ sub: 'Your look in every Sipher game. Your shirt colour is your armour here, and your hat comes along.' });
    const back = document.createElement('button'); back.className = 'sp-btn'; back.textContent = '← Sipher';
    back.onclick = () => { window.close(); setTimeout(() => { location.href = 'about:blank'; }, 200); };
    box.append(av, back);
    const mark = bar.querySelector('.mark');
    if (mark) mark.after(box); else bar.prepend(box);
  }
  new MutationObserver(addButtons).observe(document.getElementById('menu'), { childList: true });
  addButtons();
})();
