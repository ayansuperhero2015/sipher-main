// Core: globals, helpers, tuning constants and the save file.
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
G.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
G.hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
G.mulberry = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Movement tuning (1 unit = 1 stud-block).
G.GRAV = 34; G.JUMP = 11.5; G.STEP = 0.6; G.RAD = 0.38; G.HEIGHT = 1.8;
G.SPEED = 9.2; G.HOLDER_SPEED = 10.3; G.SPRINT = 1.2;
G.TAG_DIST = 1.15;
G.mod = { id: null, grav: 1, speed: 1 }; // per-round modifier

G.ABILITIES = {
  dash:      { name: 'Dash',        cd: 5,  price: 0,   desc: 'Short burst in the direction you move.' },
  superjump: { name: 'Super Jump',  cd: 7,  price: 0,   desc: 'Jump about three times higher. Reaches bridges and rooftops.' },
  blink:     { name: 'Blink',       cd: 8,  price: 150, desc: 'Teleport 8 studs ahead, through a chaser if needed.' },
  freeze:    { name: 'Freeze Trap', cd: 12, price: 200, desc: 'Leave a trap. The next player on it is frozen for 2.5s.' },
  shockwave: { name: 'Shockwave',   cd: 11, price: 250, desc: 'Knock back and stun everyone within 7 studs.' },
  invis:     { name: 'Vanish',      cd: 15, price: 300, desc: 'Invisible for 4s. Bots stop tracking you.' },
  decoy:     { name: 'Decoy',       cd: 14, price: 350, desc: 'A clone runs off. Holders that touch it are stunned.' },
  toss:      { name: 'Bomb Toss',   cd: 10, price: 400, desc: 'Throw the bomb at whoever you aim at, up to 16 studs.' }
};
G.HATS = {
  none:      { name: 'None',          price: 0 },
  cone:      { name: 'Traffic Cone',  price: 100 },
  tophat:    { name: 'Top Hat',       price: 150 },
  horns:     { name: 'Horns',         price: 200 },
  halo:      { name: 'Halo',          price: 250 },
  propeller: { name: 'Propeller Cap', price: 300 },
  crown:     { name: 'Crown',         price: 600 }
};
G.SHIRTS = [0x3c8cff, 0xff4b42, 0x4fd65a, 0xffc93c, 0xb05cff, 0xff8a2b, 0x2bd9d9, 0xff6fb5, 0xf2f2f2, 0x333a48];
G.POWERUPS = {
  speed:    { name: 'Speed boost', color: 0xffd23f, dur: 6 },
  shield:   { name: 'Shield: blocks one pass', color: 0x58b7ff },
  jump:     { name: 'Spring legs', color: 0x7dff7a, dur: 8 },
  recharge: { name: 'Ability recharged', color: 0xc78bff }
};
G.MODS = [
  { id: 'lowgrav', name: 'LOW GRAVITY', sub: 'Everyone floats', grav: 0.5 },
  { id: 'frenzy',  name: 'SPEED FRENZY', sub: 'Everyone runs faster', speed: 1.25 },
  { id: 'double',  name: 'DOUBLE TROUBLE', sub: 'One extra bomb this round' },
  { id: 'short',   name: 'SHORT FUSE', sub: 'The timer is way shorter' },
  { id: 'rain',    name: 'POWER-UP RAIN', sub: 'Power-ups everywhere' }
];
G.BOT_NAMES = ['Blockhead_77', 'xXNoobSlayerXx', 'PixelPanda', 'TagMaster3000', 'sweatyboi', 'CookieCrumbz', 'TacoTuesday', 'Zappy_Zed',
  'MiloTheBuilder', 'KaboomKid', 'FluffyNinja', 'LavaLuke', 'Kiki_Plays', 'Turbo_Tom', 'SnackAttack', 'FrostByte', 'jellybean_jo',
  'CaptainCrunch3', 'NovaStrike', 'Wobbles', 'GG_Gary', 'ProDodger', 'Bobbert', 'sushiroll42', 'FuseBox', 'HotPotato99'];

G.keys = {}; G.pressed = {};
G.save = { coins: 0, owned: ['dash', 'superjump'], ability: 'dash', hats: ['none'], hat: 'none', shirt: 0, map: 'random', bots: 11,
  sens: 1, vol: 0.7, wins: 0, games: 0 };
try { Object.assign(G.save, JSON.parse(localStorage.getItem('boomtag.save') || '{}')); } catch (e) { /* private mode */ }
G.persist = () => { try { localStorage.setItem('boomtag.save', JSON.stringify(G.save)); } catch (e) { /* ignore */ } };
})();
