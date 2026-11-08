// Core: globals, helpers, constants shared by every module.
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
G.dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
G.angleWrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
G.fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// World constants. 1 unit = 1 block.
G.W = 128; G.H = 64; G.D = 128;
G.SURF = 24;              // feet level on every island (top block sits at SURF-1)
G.BUILD_MAX = 48;         // highest block you may place
G.VOID_Y = -12;           // below this you die

G.TEAMS = [
  { id: 0, name: 'Red', color: 0xe8413b, css: '#ff4b42', dark: '#8f1d18' },
  { id: 1, name: 'Blue', color: 0x3c6fe8, css: '#4f86ff', dark: '#1b3a8f' },
  { id: 2, name: 'Green', color: 0x4fc23c, css: '#5ee04a', dark: '#24751a' },
  { id: 3, name: 'Yellow', color: 0xf2c73a, css: '#ffd84a', dark: '#94730f' }
];

G.BOT_NAMES = ['Blockhead_77', 'xXNoobSlayerXx', 'PixelPanda', 'BridgeKing', 'sweatyboi', 'CookieCrumbz', 'TacoTuesday', 'Zappy_Zed',
  'MiloTheBuilder', 'BedBreaker99', 'FluffyNinja', 'LavaLuke', 'Kiki_Plays', 'Turbo_Tom', 'SnackAttack', 'FrostByte', 'jellybean_jo',
  'CaptainCrunch3', 'NovaStrike', 'Wobbles', 'GG_Gary', 'ProClicker', 'Bobbert', 'sushiroll42'];

// Event timeline (seconds into the match).
G.EVENTS = [
  { t: 240, name: 'Diamond II', fn: g => g.gens.forEach(x => { if (x.kind === 'diamond') x.tier = 2; }) },
  { t: 480, name: 'Emerald II', fn: g => g.gens.forEach(x => { if (x.kind === 'emerald') x.tier = 2; }) },
  { t: 720, name: 'Diamond III', fn: g => g.gens.forEach(x => { if (x.kind === 'diamond') x.tier = 3; }) },
  { t: 960, name: 'Emerald III', fn: g => g.gens.forEach(x => { if (x.kind === 'emerald') x.tier = 3; }) },
  { t: 1320, name: 'Bed Destruction', fn: g => g.destroyAllBeds() },
  { t: 1680, name: 'Sudden Death', fn: g => g.suddenDeath() },
  { t: 1980, name: 'Game End', fn: g => g.endMatch(null) }
];

G.keys = {};
G.mouse = { l: false, r: false, lPressed: false, rPressed: false };
G.settings = { sens: 1, fov: 80, vol: 0.7 };
try { Object.assign(G.settings, JSON.parse(localStorage.getItem('bedraid.settings') || '{}')); } catch (e) { /* private mode */ }
G.saveSettings = () => { try { localStorage.setItem('bedraid.settings', JSON.stringify(G.settings)); } catch (e) { /* ignore */ } };
})();
