// Lobby: a separate little scene with your character on a lit pedestal, like a battle royale lobby.
// The camera slides so the character sits in the open part of whichever tab is showing.
(() => {
'use strict';
const L = G.lobby = { yaw: 0, spin: 0, focus: 0 };
let stub, pedRing, rays = [];

function backdrop() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 576; const k = c.getContext('2d');
  const g = k.createRadialGradient(512, 330, 40, 512, 330, 720);
  g.addColorStop(0, '#4aa3ff'); g.addColorStop(0.35, '#1f5fd6'); g.addColorStop(0.75, '#14257a'); g.addColorStop(1, '#0a0f3c');
  k.fillStyle = g; k.fillRect(0, 0, 1024, 576);
  // light shafts from above
  k.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x = 120 + i * 100 + (i % 2) * 30, w = 26 + (i % 3) * 22;
    const sg = k.createLinearGradient(0, 0, 0, 520); sg.addColorStop(0, 'rgba(160,210,255,0.16)'); sg.addColorStop(1, 'rgba(160,210,255,0)');
    k.fillStyle = sg; k.beginPath(); k.moveTo(x, 0); k.lineTo(x + w, 0); k.lineTo(512 + (x - 512) * 0.35 + w * 2, 560); k.lineTo(512 + (x - 512) * 0.35, 560); k.closePath(); k.fill();
  }
  k.globalCompositeOperation = 'source-over';
  // a faint hex pattern near the floor
  k.strokeStyle = 'rgba(140,200,255,0.07)'; k.lineWidth = 1.5;
  for (let y = 360; y < 600; y += 26) for (let x = (y / 26 % 2) * 22; x < 1024; x += 44) {
    k.beginPath(); for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2; k[j ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 13, y + Math.sin(a) * 13); } k.closePath(); k.stroke();
  }
  const v = k.createRadialGradient(512, 288, 300, 512, 288, 700); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,20,0.55)');
  k.fillStyle = v; k.fillRect(0, 0, 1024, 576);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

L.init = () => {
  const s = L.scene = new THREE.Scene();
  s.background = backdrop();
  L.cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
  s.add(new THREE.HemisphereLight(0xcfe6ff, 0x1a2350, 1.25));
  const key = new THREE.DirectionalLight(0xfff2de, 2.4); key.position.set(2.5, 5, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 1, far: 15 }); s.add(key);
  const rim = new THREE.DirectionalLight(0x6fc8ff, 2.2); rim.position.set(-3, 3, -4); s.add(rim);
  const rim2 = new THREE.DirectionalLight(0xff9adf, 0.9); rim2.position.set(3, 2, -3); s.add(rim2);
  // pedestal
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.22, 48), new THREE.MeshStandardMaterial({ color: 0x1b2a6b, roughness: 0.4, metalness: 0.3 }));
  ped.position.y = -0.11; ped.receiveShadow = true; s.add(ped);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.02, 48), new THREE.MeshStandardMaterial({ color: 0x2a4bb8, roughness: 0.35, metalness: 0.2 }));
  top.position.y = 0.005; top.receiveShadow = true; s.add(top);
  pedRing = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: 0x7fe0ff }));
  pedRing.rotation.x = Math.PI / 2; pedRing.position.y = 0.0; s.add(pedRing);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), new THREE.MeshBasicMaterial({ map: G.tex.glow, color: 0x4fa8ff, transparent: true, opacity: 0.5, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.21; s.add(glow);
  // drifting light motes
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: 0x9fd6ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.scale.setScalar(G.rand(0.04, 0.12)); m.position.set(G.rand(-3, 3), G.rand(0, 3), G.rand(-2.5, 0.5)); m.userData.v = G.rand(0.05, 0.18); s.add(m); rays.push(m);
  }
  stub = { vel: { x: 0, z: 0 }, grounded: true, pitch: 0, buildMode: null, editing: false, useT: 0, swingT: 0, emote: 0, crouch: false, slideT: 0, reloadT: 0, adsK: 0 };
  L.setOutfit();
  addEventListener('resize', () => { L.cam.aspect = innerWidth / innerHeight; L.cam.updateProjectionMatrix(); });
};
L.setOutfit = () => {
  if (L.av) L.scene.remove(L.av.root);
  L.av = G.makeAvatar({ shirt: G.OUTFITS[G.save.outfit] || G.OUTFITS[0], hair: G.HAIR[G.save.hair || 0], skin: G.SKINS[G.save.skin || 0], pants: 0x34465e, accent: 0xffd23f });
  L.av.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  L.scene.add(L.av.root);
  L.hold(L.held === undefined ? null : L.held);
};
L.hold = id => { L.held = id; L.av.setWeapon(id); };
L.dance = () => { stub.emote = 3; };
L.update = dt => {
  stub.emote = Math.max(0, stub.emote - dt);
  L.spin *= Math.pow(0.04, dt); L.yaw += L.spin * dt;
  if (Math.abs(L.spin) < 0.05) L.yaw = G.lerp(L.yaw, Math.round(L.yaw / (Math.PI * 2)) * Math.PI * 2, Math.min(1, dt * 1.5));
  L.av.root.rotation.y = Math.PI + L.yaw - 0.25;
  stub.pitch = Math.sin(G.time * 0.7) * 0.05 - 0.05;
  L.av.animate(dt, stub);
  pedRing.material.color.setHSL(0.55 + Math.sin(G.time * 0.8) * 0.03, 1, 0.68);
  for (const m of rays) { m.position.y += m.userData.v * dt; if (m.position.y > 3.2) m.position.y = -0.1; m.material.opacity = 0.25 + Math.sin(G.time * 2 + m.position.x * 3) * 0.2; }
  // keep the character in the open part of the screen: centre on Play, left on Locker / Settings
  const want = L.focus, narrow = innerWidth < 900;
  L.cx = G.lerp(L.cx || 0, narrow ? 0 : want, Math.min(1, dt * 5));
  L.cam.position.set(L.cx, 1.25, 6.2); L.cam.lookAt(L.cx, 0.98, 0);
};
L.render = () => G.renderer.render(L.scene, L.cam);
})();
