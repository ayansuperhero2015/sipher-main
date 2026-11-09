// Players' own avatars (games/shared/avatar.js) in Bed Raid: your skin,
// face, hat, pants and walk style. The shirt stays your team's colour so
// teams are easy to tell apart. Also adds the Avatar editor to the menu.
(() => {
'use strict';
const SA = window.SipherAvatar;
const game = G.game;
const hex = c => new THREE.Color(c).getHex();

// G.makeAvatar({ team, look }): with a look, builds that player's avatar.
const realMake = G.makeAvatar;
G.makeAvatar = (o) => {
  if (!o.look) return realMake(o);
  const look = SA.clean(o.look);
  const av = realMake({ ...o, skin: hex(look.skin), pants: hex(look.pants), face: 0 });
  // The face plane on the head, and a hat (the head is 0.42 across, centred 0.21 up).
  const face = av.headG.children[1];
  face.material.map = SA.faceTexture(look.face, look.skin);
  face.material.transparent = false;
  face.material.needsUpdate = true;
  const hatMats = [];
  if (look.hat !== 'none') {
    const hat = SA.hat(look.hat, hatMats);
    hat.position.y = 0.21;
    hat.rotation.y = Math.PI; // these characters face +z
    av.headG.add(hat);
  }
  // Walk styles, using the same poses as everywhere else (flipped for +z).
  const realAnimate = av.animate;
  let phase = 0, t = 0;
  av.animate = function (dt, speed, grounded, sneaking) {
    realAnimate.call(this, dt, speed, grounded, sneaking);
    if (look.walk === 'classic') return;
    t += dt;
    const move = Math.min(1, speed / 4);
    phase += dt * (look.walk === 'sneaky' ? 5 : 8) * Math.max(move, 0.001);
    const p = SA.walkPose(look.walk, phase, move, t);
    if (grounded) { this.legL.rotation.x = p.legA; this.legR.rotation.x = -p.legA; }
    if (p.armL !== null) this.armL.rotation.x = -p.armL;
    if (p.armR !== null && this.swing <= 0 && !this.heldId) this.armR.rotation.x = -p.armR;
    if (!sneaking) { this.body.rotation.x = p.lean; this.body.position.y = p.bodyY + p.headBob; }
    this.body.rotation.z = p.sway;
  };
  const realDispose = av.dispose;
  av.dispose = function () { realDispose.call(this); for (const m of hatMats) m.dispose(); face.material.map.dispose(); };
  av.look = JSON.stringify(look);
  return av;
};

// Gives an actor a new look (keeping whether it was visible).
G.swapLook = (a, look) => {
  const key = JSON.stringify(SA.clean(look));
  if (a.avatar.look === key) return;
  const old = a.avatar, visible = old.root.visible;
  G.scene.remove(old.root);
  old.dispose();
  a.avatar = G.makeAvatar({ team: a.team, look });
  a.avatar.root.visible = visible;
  G.scene.add(a.avatar.root);
  a.tagDirty = true;
};

// You look like yourself in every match (third-person view, and on
// friends' screens in a party).
const realStart = game.start;
game.start = function (opts) {
  const out = realStart.call(this, opts);
  if (this.player) G.swapLook(this.player, SA.cfg);
  return out;
};
addEventListener('sipher-avatar', () => { if (game.player) G.swapLook(game.player, SA.cfg); });

/* ---------- the Avatar button in the menu ---------- */

const css = document.createElement('style');
css.textContent = `
#avatar-ov .box { background: #1b2840; font-family: Rubik, 'Segoe UI', sans-serif; }
#avatar-ov h2 { font-family: 'Lilita One', sans-serif; }`;
document.head.appendChild(css);

const openEditor = () => SA.openEditor({
  sub: 'Your look in every Sipher game. In Bed Raid your shirt shows your team colour.',
});

const realMenu = G.ui.menu;
G.ui.menu = (...args) => {
  const out = realMenu(...args);
  // Next to "How to play" and "Settings" under the PLAY button.
  const links = document.querySelector('#menu .links');
  if (links && !document.getElementById('avatar-btn')) {
    const b = document.createElement('button');
    b.id = 'avatar-btn';
    b.textContent = 'Avatar';
    b.onclick = openEditor;
    const help = links.querySelector('#m-help');
    if (help) help.before(b);
    else links.append(b);
  }
  return out;
};
})();
