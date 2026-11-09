// Players' own avatars (games/shared/avatar.js) in Boom Tag: skin, face,
// shirt, pants, hat and walk style. A hat bought in Boom Tag's shop wins
// over the avatar's hat while it's equipped.
(() => {
'use strict';
const SA = window.SipherAvatar;
const hex = c => new THREE.Color(c).getHex();
const OWN_HATS = new Set(['tophat', 'horns', 'crown']); // shared hats Boom Tag has its own models for

// G.makeAvatar({ shirt, hat, look }): with a look, builds that player's avatar.
// The lobby preview (face 0, no skin, no match) is you.
const realMake = G.makeAvatar;
G.makeAvatar = (o) => {
  if (!o.look && o.face === 0 && o.skin === undefined && !G.match) o = { ...o, look: SA.cfg };
  if (!o.look) return realMake(o);
  const look = SA.clean(o.look);
  const shopHat = o.hat && o.hat !== 'none' ? o.hat : null;
  const hat = shopHat || (OWN_HATS.has(look.hat) ? look.hat : 'none');
  const av = realMake({ ...o, skin: hex(look.skin), shirt: hex(look.shirt), pants: hex(look.pants), face: 0, hat });
  const face = av.headG.children[1];
  face.material.map = SA.faceTexture(look.face, look.skin);
  face.material.transparent = false;
  face.material.needsUpdate = true;
  if (!shopHat && look.hat !== 'none' && !OWN_HATS.has(look.hat)) {
    const h = SA.hat(look.hat);
    h.position.y = 0.21;
    h.rotation.y = Math.PI; // these characters face +z
    av.headG.add(h);
  }
  // Walk styles (not while holding the bomb up, cheering or frozen).
  const realAnimate = av.animate;
  let phase = 0, t = 0;
  av.animate = function (dt, speed, grounded, a) {
    realAnimate.call(this, dt, speed, grounded, a);
    if (look.walk === 'classic' || this.bomb.visible || this.cheer > 0 || (a && a.fx && a.fx.frozen > 0)) return;
    t += dt;
    const move = Math.min(1, speed / 4);
    phase += dt * (look.walk === 'sneaky' ? 5 : 8) * Math.max(move, 0.001);
    const p = SA.walkPose(look.walk, phase, move, t);
    if (grounded) { this.legL.rotation.x = p.legA; this.legR.rotation.x = -p.legA; }
    if (p.armL !== null) this.armL.rotation.x = -p.armL;
    if (p.armR !== null) this.armR.rotation.x = -p.armR;
    this.body.rotation.x = p.lean;
    this.body.position.y = p.bodyY + p.headBob;
    this.body.rotation.z = p.sway;
  };
  av.look = JSON.stringify(look);
  return av;
};

// Gives an actor a new look in place.
G.swapLook = (a, look) => {
  const key = JSON.stringify(SA.clean(look));
  if (a.av.look === key) return;
  const old = a.av;
  G.scene.remove(old.root);
  a.av = G.makeAvatar({ shirt: a.shirt, hat: a.hat, look });
  a.shirt = hex(SA.clean(look).shirt);
  a.av.root.position.copy(old.root.position);
  a.av.root.rotation.y = old.root.rotation.y;
  a.av.setBomb(a.bomb);
  a.av.drawTag(a.name, a.bomb, a.isPlayer);
  G.scene.add(a.av.root);
};

// You look like yourself in every match.
const realMakeActor = G.makeActor;
G.makeActor = (o) => {
  const a = realMakeActor(o);
  const look = o.look || (o.isPlayer ? SA.cfg : null);
  if (look) G.swapLook(a, look);
  return a;
};
addEventListener('sipher-avatar', () => {
  if (G.player && G.match) G.swapLook(G.player, SA.cfg);
  else if (!G.match) G.menuPreview();
});

/* ---------- the Avatar button in the lobby ---------- */

const css = document.createElement('style');
css.textContent = `
#avatar-btn { margin-top: 8px; width: 100%; padding: 9px 12px; border: 2px solid #ffd400; background: transparent; color: #ffd400;
  font: 20px Anton, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }
#avatar-btn:hover { background: rgba(255, 212, 0, 0.12); }
#avatar-ov .box { background: #181818; border-color: #ffd400; font-family: Barlow, 'Segoe UI', sans-serif; }
#avatar-ov h2 { font-family: Anton, sans-serif; letter-spacing: 0.04em; color: #ffd400; }`;
document.head.appendChild(css);

const realShowMenu = G.ui.showMenu;
G.ui.showMenu = (...args) => {
  const out = realShowMenu(...args);
  const play = document.getElementById('play');
  if (play && !document.getElementById('avatar-btn')) {
    const b = document.createElement('button');
    b.id = 'avatar-btn';
    b.textContent = 'Avatar';
    b.onclick = () => SA.openEditor({
      sub: 'Your look in every Sipher game. A hat from the Boom Tag shop shows instead while it is equipped.',
    });
    play.after(b);
  }
  return out;
};
})();
