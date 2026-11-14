// Core: globals, helpers, tuning constants, weapon / mode tables and the save file.
(() => {
'use strict';
const G = window.G = {};
G.V3 = THREE.Vector3;
G.rand = (a, b) => a + Math.random() * (b - a);
G.randi = (a, b) => Math.floor(G.rand(a, b + 1));
G.pick = arr => arr[Math.floor(Math.random() * arr.length)];
G.chance = p => Math.random() < p;
G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
G.lerp = (a, b, t) => a + (b - a) * t;
G.angleWrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
G.turnTo = (cur, want, max) => { const d = G.angleWrap(want - cur); return cur + G.clamp(d, -max, max); };
G.hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
G.mulberry = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
G.dirFrom = (yaw, pitch, out) => { const c = Math.cos(pitch); return (out || new THREE.Vector3()).set(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c); };

// World scale: one build cell is 4 x 3 x 4 units, a character is 1.8 tall.
G.CELL = 4; G.LH = 3;
G.GRAV = 28; G.JUMP = 9.2; G.STEP = 0.6; G.RAD = 0.4; G.HEIGHT = 1.8; G.EYE = 1.55;
G.SPEED = 7.4; G.SPRINT = 1.28;

G.RARITY = { common: '#8f9aa6', uncommon: '#4fb32c', rare: '#2d8de6', epic: '#9d4ddd', legendary: '#e8892a' };

// dmg = per pellet, rate = shots per second, falloff = [full damage until, minimum damage from]
G.WEAPONS = {
  ar:      { name: 'Assault Rifle',  rarity: 'rare',      kind: 'gun', dmg: 31, head: 1.5, rate: 5.5, mag: 30, reload: 2.1, spread: 0.005, bloom: 0.0045, maxBloom: 0.035, falloff: [45, 90], minF: 0.65, ideal: 16, snd: 'rifle', zoom: 1.3, desc: 'Reliable at any range.' },
  burst:   { name: 'Burst Rifle',    rarity: 'epic',      kind: 'gun', dmg: 29, head: 1.5, rate: 1.6, burst: 3, burstGap: 0.07, mag: 30, reload: 2.3, spread: 0.004, bloom: 0.004, maxBloom: 0.03, falloff: [50, 95], minF: 0.65, ideal: 18, snd: 'rifle', zoom: 1.45, desc: 'Three fast rounds per trigger pull.' },
  smg:     { name: 'Rapid SMG',      rarity: 'uncommon',  kind: 'gun', dmg: 16, head: 1.5, rate: 12, mag: 32, reload: 1.9, spread: 0.015, bloom: 0.003, maxBloom: 0.05, falloff: [16, 40], minF: 0.5, ideal: 8, snd: 'smg', zoom: 1.2, desc: 'Melts up close, shreds builds.' },
  pump:    { name: 'Pump Shotgun',   rarity: 'epic',      kind: 'gun', dmg: 10.5, pellets: 10, head: 1.6, rate: 1.05, mag: 5, reload: 3.4, spread: 0.05, bloom: 0, maxBloom: 0, falloff: [7, 22], minF: 0.12, bdmg: 9, ideal: 4, snd: 'shotgun', zoom: 1.15, desc: 'One huge hit, slow to follow up.' },
  tac:     { name: 'Auto Shotgun',   rarity: 'rare',      kind: 'gun', dmg: 7.5, pellets: 9, head: 1.5, rate: 1.9, mag: 8, reload: 3.9, spread: 0.065, bloom: 0, maxBloom: 0, falloff: [6, 18], minF: 0.12, bdmg: 6, ideal: 4, snd: 'shotgun', zoom: 1.15, desc: 'Less per shot, much faster.' },
  pistol:  { name: 'Hand Cannon',    rarity: 'legendary', kind: 'gun', dmg: 76, head: 2, rate: 1.25, mag: 7, reload: 2.0, spread: 0.003, bloom: 0.03, maxBloom: 0.05, falloff: [40, 85], minF: 0.7, bdmg: 150, ideal: 14, snd: 'cannon', zoom: 1.35, desc: 'Heavy rounds that break walls.' },
  dmr:     { name: 'Marksman Rifle', rarity: 'rare',      kind: 'gun', dmg: 46, head: 1.75, rate: 2.8, mag: 10, reload: 2.4, spread: 0.002, bloom: 0.012, maxBloom: 0.03, falloff: [80, 140], minF: 0.8, ideal: 26, snd: 'cannon', zoom: 2.4, desc: 'Semi-auto with a long zoom.' },
  sniper:  { name: 'Bolt Sniper',    rarity: 'legendary', kind: 'gun', dmg: 108, head: 2.3, rate: 0.62, mag: 3, reload: 2.9, spread: 0.035, bloom: 0, maxBloom: 0, falloff: [200, 300], minF: 1, bdmg: 160, ideal: 38, snd: 'sniper', zoom: 4.5, scope: true, desc: 'Scoped. A headshot ends the round.' },
  minigun: { name: 'Minigun',        rarity: 'epic',      kind: 'gun', dmg: 17, head: 1.5, rate: 14, mag: 80, reload: 4.2, spread: 0.018, bloom: 0.001, maxBloom: 0.04, falloff: [30, 70], minF: 0.6, bdmg: 34, ideal: 14, snd: 'smg', zoom: 1.15, spinup: 0.5, desc: 'Spins up, then never stops.' },
  rocket:  { name: 'Rocket Launcher', rarity: 'legendary', kind: 'rocket', dmg: 105, radius: 4.6, rate: 0.8, mag: 1, reload: 2.7, bdmg: 400, speed: 40, ideal: 18, snd: 'rocket', zoom: 1.2, spread: 0, desc: 'Splash damage, flattens structures.' },
  shield:  { name: 'Shield Keg',     rarity: 'rare',      kind: 'heal', amount: 50, charges: 2, useTime: 1.5, desc: 'Hold fire to drink: +50 shield, 2 per round.' }
};
G.WEAPON_IDS = Object.keys(G.WEAPONS);
G.PICKAXE = { name: 'Pickaxe', rarity: 'common', dmg: 20, bdmg: 75, rate: 2.3, range: 3.3 };
// Pieces start at `start` HP and grow to `hp` over `time` seconds: wood is fast and weak, metal slow and strong.
G.MATS = { wood: { name: 'Wood', start: 90, hp: 150, time: 4, color: '#c8975a' }, brick: { name: 'Brick', start: 99, hp: 300, time: 11.5, color: '#c0604a' }, metal: { name: 'Metal', start: 110, hp: 500, time: 24.5, color: '#9fb0bd' } };
G.PIECES = ['wall', 'floor', 'ramp', 'cone'];
G.PIECE_KEYS = { wall: 'Q', floor: 'F', ramp: 'C', cone: 'V' };
G.HAIR = [0x4a2c1a, 0x1c1714, 0xd9a35b, 0x8a3b22, 0x2c3a5a];
G.SKINS = [0xf1c6a0, 0xe0a878, 0xc68642, 0x8d5524, 0xffdbac];
G.MAT_IDS = ['wood', 'brick', 'metal'];
G.COST = 10;

G.MODES = {
  build:   { name: 'Build Fight', tag: 'CLASSIC', desc: 'Open arena, full materials. Out-build and out-aim the other player.', build: true, mats: { wood: 500, brick: 300, metal: 200 }, size: [10, 10], maxLv: 10, spawns: [[-22, 2], [22, -2]] },
  box:     { name: 'Box Fight',   tag: 'CLOSE QUARTERS', desc: 'Tiny arena, you both start boxed in. Low materials, lots of shotguns.', build: true, mats: { wood: 150, brick: 60, metal: 30 }, size: [4, 3], maxLv: 3, spawns: [[-10, 2], [10, -2]], map: 'box' },
  zone:    { name: 'Zone Wars',   tag: 'MOVING STORM', desc: 'The storm closes in and keeps moving. Random loadout every round.', build: true, mats: { wood: 300, brick: 200, metal: 100 }, size: [12, 12], maxLv: 10, spawns: [[-30, 2], [30, -2]], map: 'zone', zone: true, randomLoadout: true },
  nobuild: { name: 'Zero Build',  tag: 'AIM ONLY', desc: 'No building. Use cover in the depot and recharge your overshield.', build: false, size: [9, 9], maxLv: 0, spawns: [[-30, 2], [30, -2]], map: 'depot', overshield: 50, startShield: 50 },
  gungame: { name: 'Gun Game',    tag: 'FIRST THROUGH THE RACK', desc: 'Every elimination swaps your weapon. Finish the rack with the pickaxe to win.', build: false, size: [9, 9], maxLv: 0, spawns: [[-30, 2], [30, -2]], map: 'depot', respawn: true, startShield: 0, ladder: ['ar', 'smg', 'tac', 'burst', 'pistol', 'pump', 'sniper', 'pickaxe'] }
};
G.MODE_IDS = Object.keys(G.MODES);

G.DIFFS = {
  // err = aim wobble in radians (grows when you move, jump or slide), react = seconds before it starts shooting
  easy:   { name: 'Easy',   react: 1.0,  err: 0.13,  turn: 2.6, build: 0.15, strafe: 0.5, jump: 0.1,  duty: 0.45 },
  medium: { name: 'Medium', react: 0.65, err: 0.09,  turn: 3.8, build: 0.45, strafe: 0.8, jump: 0.35, duty: 0.6 },
  hard:   { name: 'Hard',   react: 0.42, err: 0.062, turn: 5.2, build: 0.75, strafe: 1,   jump: 0.6,  duty: 0.72 },
  sweat:  { name: 'Sweat',  react: 0.3,  err: 0.042, turn: 7,   build: 1,    strafe: 1,   jump: 0.9,  duty: 0.85 }
};
G.THEMES = {
  day:    { name: 'Day',    top: '#2a78dc', bot: '#c9ecff', fog: 0xbfe2f7, sun: 0xfff1d6, sunI: 2.3, hemi: 1.15, ground: '#5cab3f' },
  sunset: { name: 'Sunset', top: '#3a2a78', bot: '#ffa262', fog: 0xf0a878, sun: 0xffb070, sunI: 2.0, hemi: 0.9, ground: '#6f9a45' },
  night:  { name: 'Night',  top: '#050818', bot: '#22357a', fog: 0x16224e, sun: 0x9db4ff, sunI: 1.1, hemi: 0.75, ground: '#2f5a4a' }
};
G.PRESETS = {
  Classic:  ['pump', 'ar', 'smg', 'sniper', 'shield'],
  Sweat:    ['pump', 'smg', 'tac', 'pistol', 'shield'],
  Marksman: ['sniper', 'dmr', 'pistol', 'ar', 'shield'],
  Heavy:    ['rocket', 'minigun', 'tac', 'burst', 'shield']
};
G.OUTFITS = [0x2f9bff, 0xff4b42, 0x4fd65a, 0xffc93c, 0xb45cff, 0xff8a2b, 0x2bd9d9, 0xff6fb5, 0xf2f2f2, 0x333a48];
G.BOT_NAMES = ['RampRusher', 'xX_Cranker_Xx', 'NinetiesKing', 'BoxedLikeAFish', 'W_Key_Wes', 'PumpItPaula', 'EditCourseEd', 'SweatySam', 'ConeHeadKai', 'PeanutButter90s'];

G.keys = {}; G.pressed = {};
G.save = { mode: 'build', loadout: G.PRESETS.Classic.slice(), diff: 'medium', rounds: 5, theme: 'day', botLoadout: 'mirror',
  sens: 1, vol: 0.7, outfit: 0, wins: 0, games: 0 };
try { Object.assign(G.save, JSON.parse(localStorage.getItem('buildduel.save') || '{}')); } catch (e) { /* private mode */ }
if (!G.MODES[G.save.mode]) G.save.mode = 'build';
if (!Array.isArray(G.save.loadout) || G.save.loadout.length !== 5 || G.save.loadout.some(w => !G.WEAPONS[w])) G.save.loadout = G.PRESETS.Classic.slice();
G.persist = () => { try { localStorage.setItem('buildduel.save', JSON.stringify(G.save)); } catch (e) { /* ignore */ } };
})();
