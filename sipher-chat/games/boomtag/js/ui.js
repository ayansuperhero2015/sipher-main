// UI: lobby (maps, abilities, look), HUD, feed, scoreboard, pause and results.
(() => {
'use strict';
const A = G.audio;
const U = G.ui = { tab: 'map' };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hexCss = n => '#' + n.toString(16).padStart(6, '0');
const ic = (n, c) => G.svgIcon(n, c);

U.init = () => {
  $('hud').innerHTML = `
    <div id="top">
      <div id="round">Get ready</div>
      <div id="timer"><b id="t-num">--</b></div>
      <div id="fusebar"><i></i></div>
      <div id="alive"></div>
      <div id="modbadge" class="hidden"></div>
    </div>
    <div id="feed"></div>
    <div id="announce"><div class="t"></div><div class="s"></div></div>
    <div id="status"></div>
    <div id="toast"></div>
    <div id="cross"></div>
    <div id="bottom">
      <div id="fxrow"></div>
      <div id="abil"><div class="ic"></div><div class="cd"></div><div class="num"></div></div>
      <div id="abil-name"><kbd>E</kbd><span></span></div>
      <div id="stam"><i></i></div>
    </div>
    <div id="spec" class="hidden"></div>
    <div id="board" class="hidden"></div>
    <div id="help"><span><kbd>WASD</kbd> move</span><span><kbd>Space</kbd> jump</span><span><kbd>Shift</kbd> sprint</span><span><kbd>E</kbd> ability</span><span><kbd>Tab</kbd> players</span></div>`;
};

// ---------------------------------------------------------------- LOBBY
U.showMenu = () => {
  $('hud').classList.add('hidden'); $('end').classList.add('hidden'); $('pause').classList.add('hidden');
  $('vignette').className = '';
  $('menu').classList.remove('hidden');
  U.renderMenu();
};
function mapTab(s) {
  const tiles = [`<button class="map ${s.map === 'random' ? 'sel' : ''}" data-map="random"><span class="rnd">?</span><b>Random</b></button>`]
    .concat(G.MAPS.map(mp => `<button class="map ${s.map === mp.id ? 'sel' : ''}" data-map="${mp.id}"><img src="${G.thumbs.maps[mp.id]}" alt=""><b>${esc(mp.name)}</b></button>`));
  const cur = G.MAPS.find(m => m.id === s.map);
  return `<div class="maps">${tiles.join('')}</div>
    <p class="detail">${cur ? esc(cur.desc) : 'A different arena every match.'}</p>`;
}
function abilTab(s) {
  const rows = Object.entries(G.ABILITIES).map(([id, ab]) => {
    const owned = s.owned.includes(id), sel = s.ability === id;
    const right = sel ? 'Equipped' : owned ? 'Equip' : `${ic('coin', 'coin')}${ab.price}`;
    return `<button class="ab ${sel ? 'sel' : ''} ${owned ? '' : 'locked'} ${s.coins < ab.price && !owned ? 'poor' : ''}" data-ab="${id}">
      ${ic(id)}<span class="nm">${ab.name}</span><span class="cdv">${ab.cd}s</span><span class="pr">${right}</span></button>`;
  }).join('');
  const cur = G.ABILITIES[s.ability];
  return `<div class="abils">${rows}</div><p class="detail"><b>${cur.name}.</b> ${cur.desc}</p>`;
}
function lookTab(s) {
  const hats = Object.entries(G.HATS).map(([id, h]) => {
    const owned = s.hats.includes(id), sel = s.hat === id;
    return `<button class="hat ${sel ? 'sel' : ''} ${owned ? '' : 'locked'}" data-hat="${id}">
      <img src="${G.thumbs.hats[id]}" alt=""><span class="nm">${h.name}</span><span class="pr">${owned ? (sel ? 'Wearing' : 'Owned') : ic('coin', 'coin') + h.price}</span></button>`;
  }).join('');
  const sw = G.SHIRTS.map((c, i) => `<button class="sw ${s.shirt === i ? 'sel' : ''}" data-shirt="${i}" style="--c:${hexCss(c)}" aria-label="Shirt colour ${i + 1}"></button>`).join('');
  return `<div class="hats">${hats}</div><h4>Shirt</h4><div class="shirts">${sw}</div>`;
}
U.renderMenu = () => {
  const s = G.save;
  const body = U.tab === 'map' ? mapTab(s) : U.tab === 'ability' ? abilTab(s) : lookTab(s);
  $('menu').innerHTML = `
  <aside class="slab">
    <div class="brand">
      <h1>BOOM TAG</h1>
      <div class="hazard"></div>
      <div class="stats"><span>${ic('coin', 'coin')}<b>${s.coins}</b> coins</span><span><b>${s.wins}</b> wins</span><span><b>${s.games}</b> played</span></div>
    </div>
    <nav class="tabs">
      ${['map', 'ability', 'look'].map(t => `<button data-tab="${t}" class="${U.tab === t ? 'on' : ''}">${t}</button>`).join('')}
    </nav>
    <div class="tabbody">${body}</div>
    <div class="foot">
      <div class="botrow"><span>Bots</span><button class="step" data-bots="-1" aria-label="Fewer bots">−</button><b id="bots-v">${s.bots}</b><button class="step" data-bots="1" aria-label="More bots">+</button>
        <label>Mouse<input id="sens" type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}"></label>
        <label>Sound<input id="vol" type="range" min="0" max="1" step="0.05" value="${s.vol}"></label></div>
      <button id="play" class="primary">Play</button>
    </div>
  </aside>
  <ol class="rules">
    <li>Holding the bomb? Touch someone to pass it.</li>
    <li>When the fuse hits zero, everyone holding one is out.</li>
    <li>Last player standing wins.</li>
  </ol>
  <div class="menumsg"></div>`;
  const m = $('menu');
  m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { A.init(); A.click(); U.tab = b.dataset.tab; U.renderMenu(); });
  m.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { A.init(); A.click(); s.map = b.dataset.map; G.persist(); U.renderMenu(); G.menuPreview(); });
  m.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => {
    A.init(); const id = b.dataset.ab, ab = G.ABILITIES[id];
    if (s.owned.includes(id)) { s.ability = id; A.click(); }
    else if (s.coins >= ab.price) { s.coins -= ab.price; s.owned.push(id); s.ability = id; A.buy(); }
    else { A.deny(); U.menuMsg(`${ab.price - s.coins} more coins needed`); return; }
    G.persist(); U.renderMenu();
  });
  m.querySelectorAll('[data-hat]').forEach(b => b.onclick = () => {
    A.init(); const id = b.dataset.hat, h = G.HATS[id];
    if (s.hats.includes(id)) { s.hat = id; A.click(); }
    else if (s.coins >= h.price) { s.coins -= h.price; s.hats.push(id); s.hat = id; A.buy(); }
    else { A.deny(); U.menuMsg(`${h.price - s.coins} more coins needed`); return; }
    G.persist(); U.renderMenu(); G.menuPreview();
  });
  m.querySelectorAll('[data-shirt]').forEach(b => b.onclick = () => { A.init(); A.click(); s.shirt = +b.dataset.shirt; G.persist(); U.renderMenu(); G.menuPreview(); });
  m.querySelectorAll('[data-bots]').forEach(b => b.onclick = () => { A.init(); A.click(); s.bots = G.clamp(s.bots + +b.dataset.bots, 3, 15); $('bots-v').textContent = s.bots; G.persist(); });
  $('sens').oninput = e => { s.sens = +e.target.value; G.persist(); };
  $('vol').oninput = e => { s.vol = +e.target.value; A.setVol(s.vol); G.persist(); };
  $('play').onclick = () => { A.init(); A.click(); G.startMatch(); };
};
U.menuMsg = (t) => {
  const el = document.querySelector('.menumsg'); if (!el) return;
  el.textContent = t; el.classList.add('show');
  clearTimeout(U._mm); U._mm = setTimeout(() => el.classList.remove('show'), 1600);
};

// ---------------------------------------------------------------- HUD
U.startHud = () => {
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden'); $('feed').innerHTML = ''; $('spec').classList.add('hidden');
  document.querySelector('#abil .ic').innerHTML = ic(G.player.ability);
  document.querySelector('#abil-name span').textContent = G.ABILITIES[G.player.ability].name;
};
U.feed = (html, kind) => {
  if (G.fastSim) return;
  const f = $('feed'); const el = document.createElement('div');
  el.className = 'kf ' + (kind || '');
  el.innerHTML = (kind && G.ICONS[kind] ? ic(kind) : kind === 'out' ? ic('bomb') : '') + `<span>${html}</span>`;
  f.appendChild(el);
  while (f.children.length > 6) f.removeChild(f.firstChild);
  setTimeout(() => el.classList.add('fade'), 5000);
  setTimeout(() => el.remove(), 6000);
};
U.announce = (t, s = '', dur = 2.2, cls = '') => {
  if (G.fastSim) return;
  const el = $('announce'); el.querySelector('.t').textContent = t; el.querySelector('.s').textContent = s;
  el.className = 'show ' + cls;
  clearTimeout(U._an); U._an = setTimeout(() => { el.className = ''; }, dur * 1000);
};
U.toast = (t) => {
  if (G.fastSim) return;
  const el = $('toast'); el.textContent = t; el.classList.add('show');
  clearTimeout(U._to); U._to = setTimeout(() => el.classList.remove('show'), 1700);
};
U.flashBomb = () => U.announce('You have the bomb', 'Touch someone to pass it', 1.6, 'bad');

let lastBoard = 0;
const set = (el, v) => { if (el.textContent !== v) el.textContent = v; };
U.update = (dt) => {
  const m = G.match, p = G.player;
  if (!m || !p) return;
  const alive = G.alive(), bombs = alive.filter(a => a.bomb).length;
  set($('round'), m.round ? 'Round ' + m.round : 'Get ready');
  const tn = $('t-num'), timer = $('timer'), bar = document.querySelector('#fusebar i');
  if (m.state === 'round') {
    const f = Math.max(0, m.fuse);
    set(tn, f < 10 ? f.toFixed(1) : String(Math.ceil(f)));
    timer.classList.toggle('hot', f < 5);
    bar.style.width = (G.clamp(f / m.maxFuse, 0, 1) * 100) + '%';
  } else if (m.state === 'intermission') {
    set(tn, String(Math.max(0, Math.ceil(m.t)))); timer.classList.remove('hot'); bar.style.width = '100%';
  } else { set(tn, '0.0'); timer.classList.remove('hot'); bar.style.width = '0%'; }
  $('fusebar').classList.toggle('mine', p.alive && p.bomb && m.state === 'round');
  timer.classList.toggle('mine', p.alive && p.bomb && m.state === 'round');
  set($('alive'), `${alive.length} left · ${bombs} ${bombs === 1 ? 'bomb' : 'bombs'}`);
  const mb = $('modbadge');
  if (G.mod.id) { mb.classList.remove('hidden'); set(mb, G.MODS.find(x => x.id === G.mod.id).name); } else mb.classList.add('hidden');
  // ability
  const ab = G.ABILITIES[p.ability], frac = p.cd / ab.cd, abil = $('abil');
  abil.querySelector('.cd').style.height = (frac * 100) + '%';
  set(abil.querySelector('.num'), p.cd > 0 ? String(Math.ceil(p.cd)) : '');
  abil.classList.toggle('ready', p.cd <= 0 && p.alive && !(p.ability === 'toss' && !p.bomb));
  abil.classList.toggle('needbomb', p.ability === 'toss' && !p.bomb);
  const st = $('stam'); st.firstElementChild.style.width = p.stamina + '%'; st.classList.toggle('tired', p.tired);
  // effects
  const fx = [];
  if (p.fx.speed > 0) fx.push(`<span>${ic('speed')}${Math.ceil(p.fx.speed)}</span>`);
  if (p.fx.jump > 0) fx.push(`<span>${ic('jump')}${Math.ceil(p.fx.jump)}</span>`);
  if (p.fx.shield) fx.push(`<span>${ic('shield')}</span>`);
  if (p.fx.invis > 0) fx.push(`<span>${ic('invis')}${Math.ceil(p.fx.invis)}</span>`);
  if (p.fx.frozen > 0) fx.push(`<span class="bad">${ic('freeze')}${Math.ceil(p.fx.frozen)}</span>`);
  const fxs = fx.join(''); if ($('fxrow').innerHTML !== fxs) $('fxrow').innerHTML = fxs;
  // status line + vignette
  let stx = '', vcls = '', scls = '';
  if (p.alive && m.state === 'round' && p.bomb) { stx = 'Pass it'; scls = 'bad'; vcls = m.fuse < 5 ? 'bomb hot' : 'bomb'; }
  else if (p.alive && m.state === 'round') {
    const near = alive.filter(a => a.bomb && a !== p).reduce((d, a) => Math.min(d, G.hdist(a.pos, p.pos)), Infinity);
    if (near < 8) { stx = 'Bomb close'; scls = 'warn'; vcls = 'near'; }
  }
  const se = $('status'); set(se, stx); se.className = scls;
  const vg = $('vignette'); if (vg.className !== vcls) vg.className = vcls;
  // spectator bar
  const spec = $('spec');
  if (!p.alive && m.state !== 'over') {
    spec.classList.remove('hidden');
    const t = G.specTarget, nm = t ? t.name : '';
    if (spec.dataset.for !== nm) {
      spec.innerHTML = `<div class="sl">Out · placed #${p.place}</div><div class="watch">Watching <b>${esc(nm)}</b></div>
        <div class="sb"><button id="spec-next">Next player</button><button id="spec-skip">Skip to results</button><button id="spec-quit">Leave</button></div>`;
      spec.dataset.for = nm;
      $('spec-next').onclick = (e) => { e.stopPropagation(); G.nextSpec(); };
      $('spec-skip').onclick = (e) => { e.stopPropagation(); G.fastForward(); };
      $('spec-quit').onclick = (e) => { e.stopPropagation(); G.quitToMenu(); };
    }
  } else spec.classList.add('hidden');
  // scoreboard
  const board = $('board'), show = G.keys.Tab;
  board.classList.toggle('hidden', !show);
  if (show && (lastBoard -= dt) <= 0) {
    lastBoard = 0.25;
    const rows = [...G.actors].sort((a, b) => (b.alive - a.alive) || (a.alive ? b.passes - a.passes : a.place - b.place));
    board.innerHTML = `<div class="bh"><span>Player</span><span>Ability</span><span>Passes</span><span></span></div>` + rows.map(a => `<div class="row ${a.alive ? '' : 'dead'} ${a.isPlayer ? 'me' : ''} ${a.bomb ? 'hasbomb' : ''}">
      <span class="nm"><i style="background:${hexCss(a.shirt)}"></i>${esc(a.name)}</span><span class="ab">${ic(a.ability)}</span><span>${a.passes}</span><span class="st">${a.alive ? (a.bomb ? ic('bomb') : '') : '#' + a.place}</span></div>`).join('');
  }
};

// Edge-of-screen arrows pointing at bombs (or your nearest target when you hold one).
const _v = new THREE.Vector3();
U.drawIndicators = () => {
  const c = $('ind'), k = c.getContext('2d');
  if (c.width !== innerWidth || c.height !== innerHeight) { c.width = innerWidth; c.height = innerHeight; }
  k.clearRect(0, 0, c.width, c.height);
  const m = G.match, p = G.player;
  if (!m || !p || !p.alive || m.state !== 'round' || G.paused) return;
  const list = [];
  if (p.bomb) {
    let best = null, bd = Infinity;
    for (const a of G.actors) { if (!a.alive || a.bomb || a === p || a.fx.invis > 0) continue; const d = G.hdist(a.pos, p.pos); if (d < bd) { bd = d; best = a; } }
    if (best) list.push([best, '#ffd400', bd]);
  } else for (const a of G.actors) if (a.alive && a.bomb && a !== p && a.fx.invis <= 0) list.push([a, '#e8261c', G.hdist(a.pos, p.pos)]);
  const W = c.width, H = c.height, pad = 46;
  k.font = '700 15px "Barlow Condensed", sans-serif'; k.textAlign = 'center';
  for (const [a, col, d] of list) {
    _v.set(a.pos.x, a.pos.y + 1.2, a.pos.z).project(G.camera);
    let x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
    const behind = _v.z > 1;
    if (!behind && x > pad && x < W - pad && y > pad && y < H - pad) {
      if (d > 10) { k.fillStyle = col; k.fillText(Math.round(d) + ' M', x, y - 52); }
      continue;
    }
    if (behind) { x = W - x; y = H - y; }
    const cx = W / 2, cy = H / 2, ang = Math.atan2(y - cy, x - cx);
    const r = Math.min((W / 2 - pad) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - pad) / Math.abs(Math.sin(ang) || 1e-6));
    const ex = cx + Math.cos(ang) * r, ey = cy + Math.sin(ang) * r;
    k.save(); k.translate(ex, ey); k.rotate(ang);
    k.fillStyle = col; k.strokeStyle = '#121212'; k.lineWidth = 3;
    k.beginPath(); k.moveTo(16, 0); k.lineTo(-10, -12); k.lineTo(-10, 12); k.closePath(); k.stroke(); k.fill();
    k.restore();
    k.fillStyle = '#fff'; k.fillText(Math.round(d) + ' M', ex - Math.cos(ang) * 30, ey - Math.sin(ang) * 30 + 5);
  }
};

// ---------------------------------------------------------------- PAUSE + END
U.showPause = (on) => {
  const el = $('pause');
  if (!on) { el.classList.add('hidden'); return; }
  el.innerHTML = `<div class="box"><h2>Paused</h2>
    <label>Mouse sensitivity <input id="p-sens" type="range" min="0.3" max="2.5" step="0.1" value="${G.save.sens}"></label>
    <label>Sound <input id="p-vol" type="range" min="0" max="1" step="0.05" value="${G.save.vol}"></label>
    <div class="eb"><button id="p-res" class="primary">Resume</button><button id="p-quit" class="ghost">Quit to lobby</button></div></div>`;
  el.classList.remove('hidden');
  $('p-res').onclick = () => G.resume();
  $('p-quit').onclick = () => G.quitToMenu();
  $('p-sens').oninput = e => { G.save.sens = +e.target.value; G.persist(); };
  $('p-vol').oninput = e => { G.save.vol = +e.target.value; A.setVol(G.save.vol); G.persist(); };
};
U.showEnd = (res) => {
  const el = $('end');
  const rows = [...G.actors].sort((a, b) => a.place - b.place).slice(0, 8).map(a => `
    <div class="row ${a.isPlayer ? 'me' : ''}"><b>${a.place}</b><span class="nm"><i style="background:${hexCss(a.shirt)}"></i>${esc(a.name)}</span><small>${a.passes} passes</small><small>${a.survived} rds</small></div>`).join('');
  const verdict = res.place === 1 ? 'Last one standing' : res.place <= 3 ? 'Podium finish' : 'Blown up';
  el.innerHTML = `<div class="box end">
    <div class="place ${res.place === 1 ? 'win' : ''}"><span class="hash">#</span>${res.place}</div>
    <div class="verdict">${verdict}</div>
    <div class="sub">of ${G.actors.length} players · ${esc(G.world.def.name)}</div>
    <div class="earn">
      <div><span>Rounds survived</span><b>+${res.survive}</b></div>
      <div><span>Bomb passes</span><b>+${res.pass}</b></div>
      <div><span>Placement</span><b>+${res.bonus}</b></div>
      <div class="tot"><span>Coins</span><b>${ic('coin', 'coin')}${res.total}</b></div>
    </div>
    <div class="standings">${rows}</div>
    <div class="eb"><button id="e-again" class="primary">Play again</button><button id="e-menu" class="ghost">Lobby</button></div>
  </div>`;
  el.classList.remove('hidden');
  $('e-again').onclick = () => { A.click(); G.startMatch(); };
  $('e-menu').onclick = () => { A.click(); G.quitToMenu(); };
};
})();
