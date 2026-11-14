// Players' own avatars (games/shared/avatar.js) in Forknife: skin, shirt,
// pants and hat carry over from every Sipher game. Hair colour still comes
// from the Locker. Bots keep their random looks.
(() => {
'use strict';
const SA = window.SipherAvatar;
const hex = c => new THREE.Color(c).getHex();
let pending = null; // the look for the avatar being built right now

// G.makeAvatar(o): with a look, uses that player's colours and hat.
const realMake = G.makeAvatar;
G.makeAvatar = o => {
  const look = o.look ? SA.clean(o.look) : pending;
  pending = null;
  if (!look) return realMake(o);
  const av = realMake({ ...o, skin: hex(look.skin), shirt: hex(look.shirt), pants: hex(look.pants) });
  if (look.hat !== 'none') {
    const h = SA.hat(look.hat);
    // the shared hats fit a 0.42 box head; this head is a 0.29 sphere centred at y 0.13
    h.scale.setScalar(0.7); h.position.y = 0.13;
    av.head.add(h);
    // tuck the hair cap and crown under the hat (the fringe still shows)
    if (look.hat !== 'horns' && look.hat !== 'headphones') { av.head.children[1].visible = false; av.head.children[2].visible = false; }
  }
  av.look = JSON.stringify(look);
  return av;
};

// You look like yourself in every match; friends look like themselves.
const realMakeActor = G.makeActor;
G.makeActor = o => {
  pending = o.look ? SA.clean(o.look) : o.isPlayer ? SA.clean(SA.cfg) : null;
  try { const a = realMakeActor(o); a.hair = o.hair; return a; } finally { pending = null; }
};

// Rebuilds an actor's model with a new look, in place.
G.swapLook = (a, look) => {
  const key = JSON.stringify(SA.clean(look));
  if (a.av.look === key) return;
  const old = a.av;
  G.scene.remove(old.root);
  a.av = G.makeAvatar({ look, name: a.isPlayer ? null : a.name, hair: a.hair, pants: a.isPlayer ? 0x34465e : 0x4a3434,
    trim: a.isPlayer ? 0x1f242c : 0x231518, accent: a.isPlayer ? 0xffd23f : 0xff6a3d, shirt: 0x888888 });
  a.av.root.position.copy(old.root.position);
  a.av.root.rotation.y = old.root.rotation.y;
  a.av.root.visible = old.root.visible;
  G.scene.add(a.av.root);
};

// The lobby character is you.
const realSetOutfit = G.lobby.setOutfit;
G.lobby.setOutfit = () => { pending = SA.clean(SA.cfg); try { realSetOutfit(); } finally { pending = null; } };
addEventListener('sipher-avatar', () => {
  if (G.player && G.match) G.swapLook(G.player, SA.cfg);
  if (G.lobby.scene) G.lobby.setOutfit();
});

/* ---------- lobby buttons: Avatar and Back to Sipher ---------- */

const css = document.createElement('style');
css.textContent = `
.sp-btn { padding: 8px 14px; border: 2px solid #ffe83a; background: rgba(10, 26, 74, 0.55); color: #ffe83a; cursor: pointer;
  font: italic 800 18px 'Barlow Condensed', sans-serif; letter-spacing: 0.05em; text-transform: uppercase; }
.sp-btn:hover { background: rgba(255, 232, 58, 0.16); }
#sp-avatar-play { width: 100%; margin-top: 8px; }
#sp-back { margin-left: 12px; font-size: 15px; padding: 5px 10px; border-color: rgba(255,255,255,0.5); color: #fff; }
.lobby .row3 > div:nth-child(1), .lobby .row3 > div:nth-child(3) { display: none; }
#sp-avatar-locker { align-self: start; }
#avatar-ov .box { background: #0f1d4d; border-color: #ffe83a; font-family: 'Barlow Condensed', 'Segoe UI', sans-serif; }
#avatar-ov h2 { font-family: Anton, sans-serif; letter-spacing: 0.04em; color: #ffe83a; }`;
document.head.appendChild(css);

const openAvatar = () => SA.openEditor({ sub: 'Your look in every Sipher game: skin, shirt, pants and hat. Hair colour is in the Locker.' });
function addButtons() {
  const menu = document.getElementById('menu');
  const play = menu.querySelector('.play[data-act="play"]');
  if (play && !document.getElementById('sp-avatar-play')) {
    const b = document.createElement('button');
    b.id = 'sp-avatar-play'; b.className = 'sp-btn'; b.textContent = 'Avatar'; b.onclick = openAvatar;
    play.after(b);
  }
  const row = menu.querySelector('.row3');
  if (row && !document.getElementById('sp-avatar-locker')) {
    const d = document.createElement('div');
    d.innerHTML = '<h3>Avatar</h3>';
    const b = document.createElement('button');
    b.id = 'sp-avatar-locker'; b.className = 'sp-btn'; b.textContent = 'Edit avatar'; b.onclick = openAvatar;
    d.append(b);
    row.prepend(d);
  }
  const brand = menu.querySelector('.topbar .brand');
  if (brand && !document.getElementById('sp-back')) {
    const b = document.createElement('button');
    b.id = 'sp-back'; b.className = 'sp-btn'; b.textContent = '← Back to Sipher';
    b.onclick = () => { window.close(); setTimeout(() => { location.href = 'about:blank'; }, 200); };
    brand.after(b);
  }
}
new MutationObserver(addButtons).observe(document.getElementById('menu'), { childList: true });
addButtons();
})();
