// UI: battle-royale style lobby (Play / Locker / Settings tabs, illustrated mode picker), the in-game HUD
// (minimap with storm, rarity hotbar that turns into the build bar, materials, elimination banner,
// per-weapon crosshairs, edit hints), pause and end screens.
(() => {
'use strict';
const $ = id => document.getElementById(id);
const U = G.ui = {};
let tab = 'play', selSlot = 0, picker = false, cache = {}, hmT = 0, centerT = 0, ringT = 0, hurtK = 0, banT = 0, mmT = 0, els = {}, mm;
const set = (el, key, val, prop = 'textContent') => { if (cache[key] !== val) { cache[key] = val; el[prop] = val; } };
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const wname = id => (id === 'pickaxe' ? 'Pickaxe' : G.WEAPONS[id].name);
const hex = c => '#' + c.toString(16).padStart(6, '0');

// ---------------------------------------------------------------- icons
const sv = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
const ICON = {
  wall: sv('<rect x="3.5" y="3.5" width="17" height="17"/><path d="M3.5 20.5 20.5 3.5M3.5 12h17M12 3.5v17" stroke-width="1.2"/>'),
  floor: sv('<path d="M2.5 17 8 7h13.5L16 17z"/><path d="M5.2 12h13.5M12.2 7l-2.8 10" stroke-width="1.2"/>'),
  ramp: sv('<path d="M3 20.5h18v-17z"/><path d="M9 20.5v-5.2M15 20.5V9.8" stroke-width="1.2"/>'),
  cone: sv('<path d="M2.5 18.5 12 5l9.5 13.5z"/><path d="M12 5v13.5M2.5 18.5h19" stroke-width="1.2"/>'),
  edit: sv('<path d="M4 20l1-4.5L16.5 4l3.5 3.5L8.5 19z"/><path d="M14 6.5 17.5 10" stroke-width="1.4"/>'),
  timer: sv('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4.5l3 2M9.5 2.5h5M19 6l1.5-1.5"/>'),
  alive: sv('<circle cx="12" cy="7" r="3.6"/><path d="M4.5 21c.7-4.3 3.6-7 7.5-7s6.8 2.7 7.5 7"/>'),
  elim: sv('<circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  shield: sv('<path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill="currentColor" stroke="none"/>'),
  heart: sv('<path d="M10 3.5h4v6.5h6.5v4H14v6.5h-4V14H3.5v-4H10z" fill="currentColor" stroke="none"/>'),
  wood: sv('<rect x="3" y="5" width="18" height="5.5" rx="1" fill="currentColor" stroke="none"/><rect x="3" y="13" width="18" height="5.5" rx="1" fill="currentColor" stroke="none" opacity=".75"/>'),
  brick: sv('<path d="M2.5 5h8.5v5H2.5zM13 5h8.5v5H13zM7.5 13H16v5H7.5z" fill="currentColor" stroke="none"/>'),
  metal: sv('<rect x="3" y="4" width="18" height="16" rx="1.5" fill="currentColor" stroke="none"/><circle cx="6.5" cy="7.5" r="1.1" fill="#1a1e28" stroke="none"/><circle cx="17.5" cy="7.5" r="1.1" fill="#1a1e28" stroke="none"/><circle cx="6.5" cy="16.5" r="1.1" fill="#1a1e28" stroke="none"/><circle cx="17.5" cy="16.5" r="1.1" fill="#1a1e28" stroke="none"/>')
};
const KEYS = [['WASD', 'Move'], ['Mouse', 'Aim'], ['LMB', 'Fire / place build'], ['RMB', 'Aim down sights'], ['Space', 'Jump'], ['Ctrl', 'Crouch (slide while sprinting)'],
  ['Shift', 'Walk'], ['1-5', 'Weapons'], ['X', 'Pickaxe'], ['Q / F1', 'Wall'], ['F / F2', 'Floor'], ['C / F3', 'Ramp'], ['V / F4', 'Cone'], ['T', 'Next material'],
  ['G', 'Edit your build'], ['LMB drag', 'Select edit tiles (release confirms)'], ['RMB (edit)', 'Reset edit'], ['R', 'Reload'], ['B', 'Emote'], ['Esc', 'Pause']];
const keysHtml = () => '<div class="keys">' + KEYS.map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('') + '</div>';

// side-view weapon silhouette built from the same parts as the 3D model
const svgCache = {};
G.gunSvg = id => {
  if (svgCache[id]) return svgCache[id];
  const parts = G.GUN_PARTS[id], w = G.WEAPONS[id] || G.PICKAXE, acc = G.RARITY[w.rarity];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const rects = parts.map(p => {
    const x = -p[5] - p[2] / 2, y = -p[4] - p[1] / 2;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x + p[2]); y0 = Math.min(y0, y); y1 = Math.max(y1, y + p[1]);
    const c = p[6] === 'a' ? acc : p[6] === 'k' ? '#20242c' : p[6] === 'w' ? '#a8743c' : typeof p[6] === 'number' ? hex(p[6]) : '#eef2f6';
    return `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${p[2]}" height="${p[1]}" fill="${c}"/>`;
  });
  const pad = 0.04;
  return (svgCache[id] = `<svg class="gun" viewBox="${(x0 - pad).toFixed(3)} ${(y0 - pad).toFixed(3)} ${(x1 - x0 + pad * 2).toFixed(3)} ${(y1 - y0 + pad * 2).toFixed(3)}" preserveAspectRatio="xMidYMid meet">${rects.join('')}</svg>`);
};
const wpnStats = w => w.kind === 'heal' ? `+${w.amount} SHIELD · ${w.charges} USES` : w.kind === 'rocket' ? `${w.dmg} SPLASH · WRECKS BUILDS` :
  `${w.pellets ? w.pellets + '×' : ''}${w.dmg} DMG · ${w.rate}/S · ${w.mag} MAG`;

// illustrated mode tiles (flat vector art, one scene per mode)
function modeArt(id) {
  const g = (a, b) => `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g${id})"/>`;
  const wall = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" stroke="#5b3a1a" stroke-width="3"/><path d="M${x} ${y + h}L${x + w} ${y}" stroke="#5b3a1a" stroke-width="2.5"/>`;
  let s = '';
  if (id === 'build') {
    s = g('#2f86e6', '#a9dcff') + '<path d="M0 150h320v30H0z" fill="#4f9e3a"/><path d="M0 150h320" stroke="#3d7f2c" stroke-width="3"/>'
      + wall(60, 96, 44, 54, '#d4a062') + wall(60, 42, 44, 54, '#d4a062') + '<path d="M104 150 148 96h0v54z" fill="#c38d4f" stroke="#5b3a1a" stroke-width="3"/>'
      + '<path d="M148 96 192 42v54z" fill="#c38d4f" stroke="#5b3a1a" stroke-width="3"/>' + wall(192, 42, 44, 54, '#bfc9d3') + wall(236, 96, 44, 54, '#c86a52')
      + '<path d="M60 42h44l-6-10H66z" fill="#e2b678" stroke="#5b3a1a" stroke-width="3"/>';
  } else if (id === 'box') {
    s = g('#ff8a3d', '#ffd27a') + '<path d="M0 150h320v30H0z" fill="#5c4a3a"/>'
      + '<path d="M110 70l50-22 50 22v66l-50 22-50-22z" fill="#c86a52" stroke="#5b2a1a" stroke-width="4"/><path d="M110 70l50 22 50-22M160 92v66" stroke="#5b2a1a" stroke-width="4"/>'
      + '<path d="M118 84l34 15M118 104l34 15M168 99l34-15M168 119l34-15" stroke="#8a3a2a" stroke-width="2.5"/><path d="M136 112h12v22h-12z" fill="#2a1a12"/>';
  } else if (id === 'zone') {
    s = g('#3a1676', '#8a3bd6') + '<circle cx="176" cy="96" r="66" fill="#57c8ff" opacity=".25"/><circle cx="176" cy="96" r="66" fill="none" stroke="#fff" stroke-width="4"/>'
      + '<circle cx="196" cy="104" r="30" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 7"/>'
      + '<path d="M0 0h320v180H0zM176 30a66 66 0 1 0 .1 0z" fill="#b25cff" opacity=".35" fill-rule="evenodd"/>'
      + '<path d="M186 96l14 24h-28z" fill="#ffe83a" stroke="#2a1050" stroke-width="2.5"/>';
  } else if (id === 'nobuild') {
    s = g('#ff9c5a', '#ffe0a8') + '<path d="M0 140h320v40H0z" fill="#8a8f96"/>'
      + '<rect x="40" y="96" width="96" height="44" fill="#d8433a" stroke="#6b1a14" stroke-width="3"/><path d="M52 100v36M64 100v36M76 100v36M88 100v36M100 100v36M112 100v36M124 100v36" stroke="#a52e26" stroke-width="3"/>'
      + '<rect x="150" y="70" width="96" height="44" fill="#2f7fd0" stroke="#123a66" stroke-width="3"/><rect x="150" y="114" width="96" height="26" fill="#3fa860" stroke="#1a4a2a" stroke-width="3"/>'
      + '<rect x="258" y="112" width="28" height="28" fill="#b98548" stroke="#5b3a1a" stroke-width="3"/><path d="M258 112l28 28M286 112l-28 28" stroke="#5b3a1a" stroke-width="2.5"/>';
  } else {
    s = g('#7a1420', '#ff5a4a');
    const ids = ['ar', 'smg', 'pump', 'sniper', 'pistol'];
    ids.forEach((w, i) => { s += `<g transform="translate(${40 + i * 10} ${26 + i * 28}) rotate(-8)" opacity="${1 - i * 0.08}"><rect x="0" y="0" width="${220 - i * 18}" height="16" rx="2" fill="#f2f2f2"/><rect x="${150 - i * 12}" y="16" width="14" height="20" fill="#222"/><rect x="${200 - i * 18}" y="4" width="34" height="7" fill="#222"/></g>`; });
  }
  return `<svg class="art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">${s}</svg>`;
}

// ---------------------------------------------------------------- lobby
function pills(label, act, opts, cur) {
  return `<div class="opt"><label>${label}</label><div class="pills">${opts.map(([v, t]) => `<button class="pill ${String(v) === String(cur) ? 'on' : ''}" data-act="${act}:${v}">${t}</button>`).join('')}</div></div>`;
}
const swatches = (act, list, cur) => `<div class="pills">${list.map((c, i) => `<button class="sw ${i === cur ? 'on' : ''}" data-act="${act}:${i}" style="background:${hex(c)}"></button>`).join('')}</div>`;
function playTab() {
  const s = G.save, mode = G.MODES[s.mode];
  return `<section class="p-left card">
      <h3>Match settings</h3>
      ${pills('Opponent', 'diff', Object.keys(G.DIFFS).map(k => [k, G.DIFFS[k].name]), s.diff)}
      ${mode.respawn ? '' : pills('Match length', 'rounds', [[3, 'Best of 3'], [5, 'Best of 5'], [7, 'Best of 7']], s.rounds)}
      ${mode.ladder || mode.randomLoadout ? '' : pills('Opponent loadout', 'botl', [['mirror', 'Same as mine'], ['random', 'Random']], s.botLoadout)}
      <p class="tip">${mode.build ? '<kbd>G</kbd> edits your builds. Drag across tiles, let go to confirm. <kbd>RMB</kbd> resets.' : 'No building here. Crouch with <kbd>Ctrl</kbd>, slide out of a sprint.'}</p>
    </section>
    <div class="nameplate"><b>YOU</b><span>${s.wins} WINS</span></div>
    <section class="p-right">
      <button class="modecard" data-act="picker:1">${modeArt(s.mode)}<div class="mc-body"><span class="tag">${mode.tag}</span><b>${mode.name}</b><small>${mode.desc}</small></div><span class="change">CHANGE</span></button>
      <button class="play" data-act="play">PLAY</button>
    </section>`;
}
function lockerTab() {
  const s = G.save, mode = G.MODES[s.mode];
  let note = '';
  if (mode.randomLoadout) note = '<div class="note">Zone Wars rolls a random loadout each round. Your picks are kept for the other modes.</div>';
  if (mode.ladder) note = '<div class="note">Gun Game uses a fixed rack: ' + mode.ladder.map(wname).join(' &rarr; ') + '.</div>';
  const slots = s.loadout.map((id, i) => { const w = G.WEAPONS[id]; return `<button class="slot r-bg ${i === selSlot ? 'on' : ''}" data-act="slot:${i}" style="--r:${G.RARITY[w.rarity]}"><span class="k">${i + 1}</span>${G.gunSvg(id)}<b>${w.name}</b></button>`; }).join('');
  const wpns = G.WEAPON_IDS.map(id => { const w = G.WEAPONS[id]; return `<button class="wpn ${s.loadout[selSlot] === id ? 'on' : ''}" data-act="wpn:${id}" style="--r:${G.RARITY[w.rarity]}"><div class="art r-bg">${G.gunSvg(id)}<span class="rar">${w.rarity}</span></div><b>${w.name}</b><small>${wpnStats(w)}</small><em>${w.desc}</em></button>`; }).join('');
  const presets = Object.keys(G.PRESETS).map(n => `<button class="pill" data-act="preset:${n}">${n}</button>`).join('');
  return `<section class="panel-r">
      <div class="row3">
        <div><h3>Outfit</h3>${swatches('outfit', G.OUTFITS, s.outfit)}</div>
        <div><h3>Hair</h3>${swatches('hair', G.HAIR, s.hair || 0)}</div>
        <div><h3>Skin</h3>${swatches('skin', G.SKINS, s.skin || 0)}</div>
      </div>
      <h3>Loadout <span class="presets">${presets}</span></h3>${note}
      <div class="slots">${slots}</div>
      <p class="tip">Pick a slot, then a weapon for it.</p>
      <div class="wpns">${wpns}</div>
    </section>`;
}
function settingsTab() {
  const s = G.save;
  return `<section class="panel-r">
      <h3>Game</h3>
      <div class="opt"><label>Mouse sensitivity <output>${s.sens.toFixed(2)}</output></label><input type="range" min="0.2" max="3" step="0.05" value="${s.sens}" data-set="sens"></div>
      <div class="opt"><label>Edit sensitivity <output>${(s.editSens || 1).toFixed(2)}</output></label><input type="range" min="0.5" max="2" step="0.05" value="${s.editSens || 1}" data-set="editSens"></div>
      <div class="opt"><label>Volume <output>${Math.round(s.vol * 100)}%</output></label><input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-set="vol"></div>
      ${pills('Time of day', 'theme', Object.keys(G.THEMES).map(k => [k, G.THEMES[k].name]), s.theme)}
      <h3>Controls</h3>${keysHtml()}
    </section>`;
}
function pickerHtml() {
  const s = G.save;
  return `<div class="picker" data-act="picker:0"><div class="pk-in" data-stop="1"><h2>SELECT MODE</h2><div class="pk-grid">${G.MODE_IDS.map(id => {
    const m = G.MODES[id];
    return `<button class="pk ${id === s.mode ? 'on' : ''}" data-act="mode:${id}">${modeArt(id)}<div class="pk-body"><span class="tag">${m.tag}</span><b>${m.name}</b><small>${m.desc}</small></div></button>`;
  }).join('')}</div></div></div>`;
}
function renderMenu() {
  const s = G.save;
  $('menu').innerHTML = `<div class="lobby tab-${tab}">
    <header class="topbar"><div class="brand">FORKNIFE<span>1V1</span></div>
      <nav class="tabs">${['play', 'locker', 'settings'].map(t => `<button class="${t === tab ? 'on' : ''}" data-act="tab:${t}">${t.toUpperCase()}</button>`).join('')}</nav>
      <div class="rec"><b>${s.wins}</b> WINS<i></i><b>${s.games}</b> MATCHES</div></header>
    <div class="stage" id="stage" title="Drag to turn, double-click to dance"></div>
    ${tab === 'play' ? playTab() : tab === 'locker' ? lockerTab() : settingsTab()}
    ${picker ? pickerHtml() : ''}
  </div>`;
  G.lobby.focus = tab === 'play' ? 0 : 1.3;
  G.lobby.hold(tab === 'locker' ? G.save.loadout[selSlot] : null);
}
U.showMenu = () => {
  $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); $('pause').classList.add('hidden'); $('end').classList.add('hidden');
  $('scope').classList.add('hidden'); $('storm-tint').style.opacity = 0; $('hurt').style.opacity = 0; picker = false; renderMenu();
};
U.hideMenu = () => $('menu').classList.add('hidden');

// ---------------------------------------------------------------- HUD
U.init = () => {
  $('hud').innerHTML = `
    <div id="mmwrap"><canvas id="mm" width="200" height="200"></canvas>
      <div class="mminfo"><span>${ICON.timer}<b id="stt">0:00</b></span><span>${ICON.alive}<b id="alive">2</b></span><span>${ICON.elim}<b id="elims">0</b></span></div>
      <div class="stormi" id="stormi"></div></div>
    <div class="top"><div class="score"><span class="nm you">YOU</span><b id="s0">0</b><span class="vs">VS</span><b id="s1">0</b><span class="nm them" id="bname">BOT</span></div><div class="rinfo" id="rinfo"></div></div>
    <div id="feed"></div>
    <div id="cross" class="rifle"><i></i><i></i><i></i><i></i><b></b><u></u></div>
    <div id="hm"><i></i><i></i><i></i><i></i></div>
    <div id="ring"><i></i></div>
    <div id="center"><div class="big"></div><div class="small"></div></div>
    <div id="elimban"><small>ELIMINATED</small><b></b><em></em></div>
    <div id="bars"><div class="bar sh"><span class="ic">${ICON.shield}</span><b id="shv">100</b><div class="track"><i></i></div></div><div class="bar hp"><span class="ic">${ICON.heart}</span><b id="hpv">100</b><div class="track"><i></i></div></div></div>
    <div id="right"><div id="mats"></div><div id="ammo"><div class="nm" id="wn"></div><div><b id="am"></b><span id="amr"></span></div><div id="rl"><i></i></div></div><div id="slots"></div></div>
    <div id="hint"></div>`;
  for (const id of ['s0', 's1', 'bname', 'rinfo', 'stormi', 'stt', 'alive', 'elims', 'feed', 'cross', 'hm', 'ring', 'center', 'elimban', 'bars', 'shv', 'hpv', 'mats', 'wn', 'am', 'amr', 'rl', 'slots', 'hint']) els[id] = $(id);
  els.shBar = els.bars.querySelector('.sh i'); els.hpBar = els.bars.querySelector('.hp i');
  els.rlBar = els.rl.querySelector('i'); els.cBig = els.center.querySelector('.big'); els.cSmall = els.center.querySelector('.small');
  mm = $('mm').getContext('2d');

  const menu = $('menu');
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'picker:0' && e.target.closest('[data-stop]')) return; // clicks inside the picker panel
    G.audio.init(); G.audio.click();
    const [k, v] = b.dataset.act.split(':'), s = G.save;
    if (k === 'play') { G.startMatch(); return; }
    if (k === 'tab') tab = v;
    else if (k === 'picker') picker = v === '1';
    else if (k === 'mode') { s.mode = v; picker = false; }
    else if (k === 'slot') selSlot = +v;
    else if (k === 'wpn') { const j = s.loadout.indexOf(v); if (j >= 0 && j !== selSlot) s.loadout[j] = s.loadout[selSlot]; s.loadout[selSlot] = v; }
    else if (k === 'preset') s.loadout = G.PRESETS[v].slice();
    else if (k === 'diff') s.diff = v;
    else if (k === 'rounds') s.rounds = +v;
    else if (k === 'botl') s.botLoadout = v;
    else if (k === 'theme') { s.theme = v; G.setTheme(v); }
    else if (k === 'outfit' || k === 'hair' || k === 'skin') { s[k] = +v; G.lobby.setOutfit(); }
    G.persist(); renderMenu();
  });
  menu.addEventListener('mouseover', e => { const b = e.target.closest('button'); if (b && b !== U._hov) { U._hov = b; G.audio.uiHover(); } });
  // drag the character around
  let drag = null;
  menu.addEventListener('mousedown', e => { if (e.target.id === 'stage') drag = { x: e.clientX }; });
  addEventListener('mousemove', e => { if (drag) { G.lobby.spin = (e.clientX - drag.x) * 0.9; G.lobby.yaw += (e.clientX - drag.x) * 0.012; drag.x = e.clientX; } });
  addEventListener('mouseup', () => { drag = null; });
  menu.addEventListener('dblclick', e => { if (e.target.id === 'stage') G.lobby.dance(); });
  const slide = e => {
    const r = e.target.closest('[data-set]'); if (!r) return;
    const s = G.save, v = +r.value, key = r.dataset.set, out = r.previousElementSibling.querySelector('output');
    s[key] = v;
    if (key === 'vol') { G.audio.setVol(v); out.textContent = Math.round(v * 100) + '%'; } else out.textContent = v.toFixed(2);
    G.persist();
  };
  menu.addEventListener('input', slide); $('pause').addEventListener('input', slide);
  $('pause').addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b) return; G.audio.click();
    if (b.dataset.p === 'resume') G.resume(); else G.quitToMenu();
  });
  $('end').addEventListener('click', e => {
    const b = e.target.closest('[data-e]'); if (!b) return; G.audio.click();
    if (b.dataset.e === 'again') G.startMatch(); else G.quitToMenu();
  });
};
U.showHud = () => {
  cache = {}; els.feed.innerHTML = ''; centerT = 0; banT = 0; els.center.style.opacity = 0; els.elimban.className = '';
  $('hud').classList.remove('hidden'); els.bname.textContent = G.bot.name.toUpperCase();
};
U.hitmarker = head => { hmT = 0.16; els.hm.classList.toggle('head', !!head); };
U.hurtFrom = pos => {
  hurtK = 1;
  if (!pos) return;
  const p = G.player, rel = G.angleWrap(Math.atan2(-(pos.x - p.pos.x), -(pos.z - p.pos.z)) - p.yaw);
  els.ring.style.transform = `translate(-50%,-50%) rotate(${-rel}rad)`; ringT = 1.1;
};
U.feed = html => {
  const d = document.createElement('div'); d.innerHTML = html; els.feed.append(d);
  while (els.feed.children.length > 5) els.feed.firstChild.remove();
  setTimeout(() => d.classList.add('out'), 6000); setTimeout(() => d.remove(), 6600);
};
U.center = (big, small, dur = 2, cls = '') => {
  els.cBig.textContent = big; els.cSmall.textContent = small || ''; els.center.className = cls;
  els.center.style.opacity = 1; centerT = dur;
  els.cBig.style.animation = 'none'; void els.cBig.offsetWidth; els.cBig.style.animation = '';
};
U.elimBanner = (name, n) => {
  els.elimban.querySelector('b').textContent = name.toUpperCase();
  els.elimban.querySelector('em').textContent = n + (n === 1 ? ' ELIMINATION' : ' ELIMINATIONS');
  els.elimban.className = ''; void els.elimban.offsetWidth; els.elimban.className = 'on'; banT = 2.6;
};

function drawMap() {
  const k = mm, W = 200, A = G.arena, p = G.player, st = G.storm;
  const span = Math.max(A.x1 - A.x0, A.z1 - A.z0), sc = (W - 18) / span;
  const X = x => W / 2 + x * sc, Z = z => W / 2 + z * sc;
  k.clearRect(0, 0, W, W);
  k.fillStyle = '#3f7a3a'; k.fillRect(0, 0, W, W);
  k.fillStyle = '#e9efe9'; k.fillRect(X(A.x0), Z(A.z0), (A.x1 - A.x0) * sc, (A.z1 - A.z0) * sc);
  k.strokeStyle = 'rgba(0,0,0,0.08)'; k.lineWidth = 1;
  for (let x = A.x0; x <= A.x1; x += G.CELL) { k.beginPath(); k.moveTo(X(x), Z(A.z0)); k.lineTo(X(x), Z(A.z1)); k.stroke(); }
  for (let z = A.z0; z <= A.z1; z += G.CELL) { k.beginPath(); k.moveTo(X(A.x0), Z(z)); k.lineTo(X(A.x1), Z(z)); k.stroke(); }
  k.fillStyle = '#7f8b98';
  for (const b of G.boxes) k.fillRect(X(b.min.x), Z(b.min.z), Math.max(1.5, (b.max.x - b.min.x) * sc), Math.max(1.5, (b.max.z - b.min.z) * sc));
  for (const pc of G.pieces) {
    k.fillStyle = pc.static ? '#56616d' : pc.owner === p ? 'rgba(47,141,230,0.75)' : 'rgba(230,80,60,0.75)';
    if (pc.type === 'wall') k.fillRect(X(pc.min.x) - 0.6, Z(pc.min.z) - 0.6, Math.max(1.6, (pc.max.x - pc.min.x) * sc), Math.max(1.6, (pc.max.z - pc.min.z) * sc));
    else { k.globalAlpha = 0.45; k.fillRect(X(pc.min.x) + 0.5, Z(pc.min.z) + 0.5, G.CELL * sc - 1, G.CELL * sc - 1); k.globalAlpha = 1; }
  }
  if (st && st.r < A.radius + 1) {
    k.beginPath(); k.rect(0, 0, W, W); k.arc(X(st.x), Z(st.z), Math.max(0, st.r) * sc, 0, Math.PI * 2, true);
    k.fillStyle = 'rgba(140,60,235,0.5)'; k.fill('evenodd');
    k.beginPath(); k.arc(X(st.x), Z(st.z), Math.max(0, st.r) * sc, 0, Math.PI * 2); k.strokeStyle = '#d9b3ff'; k.lineWidth = 2; k.stroke();
  }
  if (st && st.i < st.phases.length) {
    const ph = st.phases[st.i];
    if (ph.r > 0.5 && ph.r < A.radius) { k.setLineDash([5, 4]); k.beginPath(); k.arc(X(ph.x), Z(ph.z), ph.r * sc, 0, Math.PI * 2); k.strokeStyle = '#ffffff'; k.lineWidth = 2; k.stroke(); k.setLineDash([]); }
  }
  k.save(); k.translate(X(p.pos.x), Z(p.pos.z)); k.rotate(-p.yaw);
  k.beginPath(); k.moveTo(0, -8); k.lineTo(6, 7); k.lineTo(0, 3.5); k.lineTo(-6, 7); k.closePath();
  k.fillStyle = '#ffe83a'; k.strokeStyle = '#1a1e28'; k.lineWidth = 2; k.fill(); k.stroke(); k.restore();
}

U.update = dt => {
  const p = G.player, m = G.match, mode = m.mode, w = G.weaponOf(p);
  set(els.shBar.style, 'shw', p.shield + '%', 'width'); set(els.shv, 'shv', String(Math.ceil(p.shield)));
  set(els.hpBar.style, 'hpw', p.hp + '%', 'width'); set(els.hpv, 'hpv', String(Math.ceil(p.hp)));
  if (mode.ladder) {
    const n = mode.ladder.length;
    set(els.s0, 's0', `${p.tier + 1}/${n}`); set(els.s1, 's1', `${G.bot.tier + 1}/${n}`);
    const nxt = mode.ladder[p.tier + 1];
    set(els.rinfo, 'ri', `GUN GAME · ${wname(mode.ladder[p.tier]).toUpperCase()}${nxt ? ' · NEXT: ' + wname(nxt).toUpperCase() : ' · FINAL WEAPON'}`);
  } else {
    set(els.s0, 's0', String(m.score[0])); set(els.s1, 's1', String(m.score[1]));
    set(els.rinfo, 'ri', `ROUND ${m.round} · FIRST TO ${m.target}`);
  }
  set(els.alive, 'al', String(G.actors.filter(a => a.alive).length)); set(els.elims, 'el', String(m.stats.elims));
  // storm
  const st = G.storm; let stxt = '', stt = fmtT(m.t);
  if (st && st.phases.length) {
    const ph = st.phases[Math.min(st.i, st.phases.length - 1)];
    if (st.i >= st.phases.length) stxt = st.r < 1 ? 'STORM CLOSED' : '';
    else if (st.pt < ph.wait) { stt = fmtT(ph.wait - st.pt); if (st.r < G.arena.radius || ph.wait - st.pt < 15) stxt = 'STORM SHRINKS IN'; }
    else { stt = fmtT(ph.wait + ph.dur - st.pt); stxt = 'STORM SHRINKING'; }
  }
  set(els.stormi, 'st', stxt); set(els.stt, 'stt', stt);
  const out = st && st.r < G.arena.radius + 1 && Math.hypot(p.pos.x - st.x, p.pos.z - st.z) > st.r && p.alive;
  set($('storm-tint').style, 'tint', out ? '1' : '0', 'opacity');
  mmT -= dt; if (mmT <= 0) { mmT = 0.1; drawMap(); }
  // hotbar: weapons, or the build bar while building / editing
  const building = !!(p.buildMode || p.editing);
  const slotKey = building ? 'B' + p.buildMode + p.editing + p.matSel : p.slots.join() + '|' + p.cur + '|' + p.ammo.join();
  if (cache.slots !== slotKey) {
    cache.slots = slotKey;
    let h = '';
    if (building) {
      for (const t of G.PIECES) h += `<div class="hs bs ${p.buildMode === t ? 'on' : ''}" style="--r:${G.MATS[p.matSel].color}"><span class="k">${G.PIECE_KEYS[t]}</span>${ICON[t]}</div>`;
      h += `<div class="hs bs ed ${p.editing ? 'on' : ''}"><span class="k">G</span>${ICON.edit}</div>`;
    } else {
      h = `<div class="hs r-bg ${p.cur < 0 ? 'on' : ''}" style="--r:${G.RARITY.common}"><span class="k">X</span>${G.gunSvg('pickaxe')}</div>`;
      p.slots.forEach((id, i) => {
        const wi = G.WEAPONS[id];
        h += `<div class="hs r-bg ${i === p.cur ? 'on' : ''} ${p.ammo[i] <= 0 && wi.kind === 'heal' ? 'empty' : ''}" style="--r:${G.RARITY[wi.rarity]}"><span class="k">${i + 1}</span>${G.gunSvg(id)}<em>${p.ammo[i]}</em></div>`;
      });
    }
    els.slots.innerHTML = h;
  }
  const matKey = mode.build ? G.MAT_IDS.map(k => p.mats[k]).join() + p.matSel + building : 'x';
  if (cache.mats !== matKey) {
    cache.mats = matKey;
    els.mats.innerHTML = mode.build ? G.MAT_IDS.map(k => `<div class="mt ${building && p.matSel === k ? 'on' : ''}" style="color:${G.MATS[k].color}">${ICON[k]}<b>${p.mats[k]}</b></div>`).join('') : '';
  }
  // weapon / build readout
  let wn, am, amr, prog = 0;
  if (p.editing) { wn = 'EDIT'; am = ''; amr = ''; }
  else if (p.buildMode) { wn = p.buildMode.toUpperCase() + ' · ' + G.MATS[p.matSel].name.toUpperCase(); am = String(p.mats[p.matSel]); amr = ''; }
  else if (!w) { wn = 'PICKAXE'; am = ''; amr = ''; }
  else if (w.kind === 'heal') { wn = w.name.toUpperCase(); am = String(p.ammo[p.cur]); amr = ' LEFT'; if (p.useT > 0) prog = 1 - p.useT / w.useTime; }
  else { wn = w.name.toUpperCase(); am = String(p.ammo[p.cur]); amr = ' / ' + w.mag; if (p.reloadT > 0) prog = 1 - p.reloadT / p.reloadMax; }
  if (w && w.spinup && p.spin > 0 && p.spin < w.spinup && !building) prog = p.spin / w.spinup;
  set(els.wn, 'wn', wn); set(els.am, 'am', am); set(els.amr, 'amr', amr);
  set(els.rl.style, 'rlo', prog > 0 ? '1' : '0', 'opacity'); els.rlBar.style.width = (prog * 100) + '%';
  set(els.am.style, 'amc', w && w.kind === 'gun' && p.ammo[p.cur] <= Math.ceil(w.mag * 0.2) && !building ? '#ff5a4a' : '', 'color');
  // hints
  let hint = '';
  if (p.editing) hint = '<b>EDITING</b> Hold <kbd>LMB</kbd> and drag over tiles · release to confirm · <kbd>RMB</kbd> reset · <kbd>G</kbd> confirm';
  else if (p.buildMode) hint = `<kbd>LMB</kbd> place · <kbd>T</kbd> material · <kbd>G</kbd> edit${G.edit && G.editTarget(p) ? ' <span class="ok">(your build in reach)</span>' : ''}`;
  else if (mode.build && m.round === 1 && m.t < 25) hint = '<kbd>Q</kbd> <kbd>F</kbd> <kbd>C</kbd> <kbd>V</kbd> build · <kbd>G</kbd> edit · <kbd>Ctrl</kbd> crouch';
  set(els.hint, 'hint', hint, 'innerHTML');
  // crosshair
  const scoped = p.adsK > 0.6 && w && w.scope && !building;
  let cls = 'rifle', gap = 4;
  if (p.editing) { cls = 'edit'; }
  else if (p.buildMode) { cls = 'build'; }
  else if (!w) { cls = 'pick'; }
  else if (w.kind === 'gun') { const sp = G.spreadOf(p, w); gap = 3 + sp * 420; cls = w.pellets ? 'shotgun' : w.scope ? 'sniper' : 'rifle'; if (w.pellets) gap = 8 + sp * 330; }
  else if (w.kind === 'rocket') { cls = 'rifle'; gap = 8; }
  else cls = 'pick';
  set(els.cross, 'ccls', cls, 'className');
  els.cross.style.setProperty('--g', Math.min(gap, 60).toFixed(1) + 'px');
  els.cross.style.display = scoped || !p.alive ? 'none' : '';
  // timers
  hmT -= dt; els.hm.style.opacity = hmT > 0 ? 1 : 0;
  if (centerT > 0) { centerT -= dt; if (centerT <= 0) els.center.style.opacity = 0; }
  if (banT > 0) { banT -= dt; if (banT <= 0) els.elimban.className = ''; }
  ringT -= dt; els.ring.style.opacity = Math.max(0, Math.min(1, ringT));
  hurtK = Math.max(0, hurtK - dt * 1.8); $('hurt').style.opacity = Math.max(hurtK * 0.8, p.alive && p.hp < 30 ? 0.35 + Math.sin(G.time * 5) * 0.1 : 0);
};

// ---------------------------------------------------------------- pause / end
U.showPause = () => {
  const s = G.save;
  $('pause').innerHTML = `<div class="panel"><h2>PAUSED</h2>
    <button class="play" data-p="resume">RESUME</button>
    <div class="opt"><label>Mouse sensitivity <output>${s.sens.toFixed(2)}</output></label><input type="range" min="0.2" max="3" step="0.05" value="${s.sens}" data-set="sens"></div>
    <div class="opt"><label>Edit sensitivity <output>${(s.editSens || 1).toFixed(2)}</output></label><input type="range" min="0.5" max="2" step="0.05" value="${s.editSens || 1}" data-set="editSens"></div>
    <div class="opt"><label>Volume <output>${Math.round(s.vol * 100)}%</output></label><input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-set="vol"></div>
    ${keysHtml()}
    <button class="ghost" data-p="quit">FORFEIT AND RETURN TO LOBBY</button></div>`;
  $('pause').classList.remove('hidden');
};
U.hidePause = () => $('pause').classList.add('hidden');
U.showEnd = win => {
  const m = G.match, st = m.stats, acc = st.shots ? Math.round(st.hits / st.shots * 100) : 0;
  const score = m.mode.ladder ? `${G.player.tier + 1} / ${m.mode.ladder.length}` : `${m.score[0]} - ${m.score[1]}`;
  const rows = [['Eliminations', st.elims], ['Deaths', st.deaths], ['Damage dealt', st.dmg], ['Damage taken', st.taken], ['Accuracy', acc + '%'], ['Headshots', st.heads]];
  if (m.mode.build) rows.push(['Builds placed', st.builds], ['Edits', st.edits], ['Build damage', Math.round(st.buildDmg)]);
  $('end').innerHTML = `<div class="panel ${win ? 'win' : 'lose'}"><div class="res">${win ? 'VICTORY' : 'DEFEAT'}</div>
    <div class="sc">${score} <small>vs ${G.bot.name} · ${m.mode.name} · ${G.DIFFS[G.save.diff].name}</small></div>
    <div class="stats">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <div class="btns"><button class="play" data-e="again">REMATCH</button><button class="ghost" data-e="menu">BACK TO LOBBY</button></div></div>`;
  $('end').classList.remove('hidden'); $('hud').classList.add('hidden'); $('scope').classList.add('hidden');
};
})();
