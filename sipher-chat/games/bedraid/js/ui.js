// UI: HUD, scoreboard, kill feed, shops, menus.
// Visual language: opaque ink panels with a thick dark edge and a hard (unblurred) drop shadow,
// Lilita One for headings and numbers, Rubik for everything else, pixel icons drawn as SVG,
// your team colour as the HUD accent, gold reserved for the main call to action and gold currency.
(() => {
'use strict';
const $ = id => document.getElementById(id);
const UI = G.ui = { dirty: true };
const canAfford = (a, c) => Object.entries(c).every(([k, v]) => a.res[k] >= v);
UI.canAfford = canAfford;

/* ---------- pixel icons ---------- */
// Each icon is a 10x10 pixel grid; letters map to colours. Rendered as crisp SVG rects.
const PAL = { k: '#0e121c', w: '#f4efe4', g: '#a7afc2', s: '#dfe3ea', b: '#8a5a2b', y: '#ffcf3a', r: '#ff4b3e', o: '#ff9a2e', c: '#5fe0d0', e: '#3be36b', d: '#4b5568', p: '#c9a6ff', n: '#2f6fd6' };
const ICONS = {
  sword: ['........ss', '.......sws', '......sws.', '.....sws..', '.b..sws...', '..bsws....', '..bbs.....', '.bbbb.....', 'bb..b.....', 'b.........'],
  bow: ['.....bb...', '....b..s..', '...b...s..', '..b....s..', '.b...wwwww', '.b....ws..', '..b....s..', '...b...s..', '....b..s..', '.....bb...'],
  void: ['....ww....', '...wwww...', '....ww....', '..w.ww.w..', '....ww....', '...w..w...', 'gg.....ggg', 'gdkkkkkkdg', '.dkkkkkkd.', '..dkkkkd..'],
  close: ['..........', '.ww....ww.', '.www..www.', '..wwwwww..', '...wwww...', '...wwww...', '..wwwwww..', '.www..www.', '.ww....ww.', '..........'],
  dice: ['.wwwwwwww.', 'wwwwwwwwww', 'wkkwwwwkkw', 'wkkwwwwkkw', 'wwwwkkwwww', 'wwwwkkwwww', 'wkkwwwwkkw', 'wkkwwwwkkw', 'wwwwwwwwww', '.wwwwwwww.'],
  fall: ['....ww....', '....ww....', '....ww....', '....ww....', '..wwwwww..', '...wwww...', '....ww....', '..........', 'gggggggggg', 'dddddddddd'],
  tnt: ['....y.....', '...yoy....', '.y.oro.y..', '..oorroo..', 'yorrwrroy.', '..oorroo..', '.y.oro.y..', '...yoy....', '....y.....', '..........'],
  skull: ['..wwwwww..', '.wwwwwwww.', 'wwwwwwwwww', 'wkkwwwkkww', 'wkkwwwkkww', 'wwwwkwwwww', '.wwwwwwww.', '..wkwkwk..', '..wwwwww..', '..........'],
  bed: ['..........', '..........', 'ww........', 'wwrrrrrrrr', 'wwrrrrrrrr', 'bbbbbbbbbb', 'b........b', 'b........b', '..........', '..........'],
  clock: ['..wwwwww..', '.w......w.', 'w....k...w', 'w....k...w', 'w....kkk.w', 'w........w', 'w........w', '.w......w.', '..wwwwww..', '..........'],
  person: ['...wwww...', '...wwww...', '...wwww...', '..........', '..wwwwww..', '.wwwwwwww.', '.w.wwww.w.', '...w..w...', '...w..w...', '..........'],
  speed: ['.....yy...', '....yy....', '...yy.....', '..yyyyy...', '.....yy...', '....yy....', '...yy.....', '..yy......', '.y........', '..........'],
  heal: ['..........', '.rr...rr..', 'rrrr.rrrr.', 'rrrrrrrrr.', 'rrrrrrrrr.', '.rrrrrrr..', '..rrrrr...', '...rrr....', '....r.....', '..........'],
  slow: ['..........', '....ccc...', '...c...c..', '...c.c.c..', '...c..cc..', 'wwwwcccc..', 'w...wwww..', 'wwwwwwwwww', '..........', '..........'],
  shield: ['.ssssssss.', '.s......s.', '.s.ssss.s.', '.s.ssss.s.', '.s.ssss.s.', '.s.ssss.s.', '..s.ss.s..', '...s..s...', '....ss....', '..........']
};
const iconCache = {};
UI.icon = (name, size = 18) => {
  const key = name + size;
  if (iconCache[key]) return iconCache[key];
  const rows = ICONS[name]; let r = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PAL[ch]}"/>`; }));
  return (iconCache[key] = `<svg class="px" width="${size}" height="${size}" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`);
};
const resImg = (k, cls = '') => `<img class="${cls}" src="${G.icons['res_' + k] || ''}" alt="${k}">`;
const costHtml = (c, p) => Object.entries(c).map(([k, v]) => `<span class="cost${p && p.res[k] < v ? ' short' : ''}">${resImg(k)}<b>${v}</b></span>`).join('');

/* ---------- HUD ---------- */
UI.render = () => {
  const p = G.game.player; if (!p) return;
  const team = G.TEAMS[p.team];
  document.documentElement.style.setProperty('--team', team.css);
  document.documentElement.style.setProperty('--team-dark', team.dark);
  if (UI.dirty) {
    UI.dirty = false;
    $('hotbar').innerHTML = p.slots.map((s, i) => `<div class="slot${i === p.sel ? ' sel' : ''}"><small>${i + 1}</small>${s ? `<img src="${G.icons[s.id] || ''}" alt="">${s.count > 1 ? `<b>${s.count}</b>` : ''}` : ''}</div>`).join('');
    $('res').innerHTML = G.RES.map(k => `<div class="r r-${k}">${resImg(k)}<b>${p.res[k]}</b></div>`).join('');
    $('armor-ico').innerHTML = p.armor !== 'leather' ? `<img src="${G.icons['armor_' + p.armor]}" alt="${p.armor} armor">` : '';
    const held = p.held();
    UI.heldName(held ? G.ITEMS[held.id].name : '');
  }
  // health: ten segments, like hearts, with the exact number on top
  const f = G.clamp(p.hp / p.maxHp, 0, 1), segs = $('hp-fill');
  if (!segs.children.length) segs.innerHTML = '<i></i>'.repeat(10);
  [...segs.children].forEach((s, i) => { const v = G.clamp(f * 10 - i, 0, 1); s.style.setProperty('--v', v); });
  $('hp').classList.toggle('low', f <= 0.3);
  $('hp-text').textContent = Math.ceil(p.hp);
  const ef = [], t = G.game.time;
  if (p.effects.speed > t) ef.push(`<span>${UI.icon('speed', 16)}${Math.ceil(p.effects.speed - t)}</span>`);
  if (p.effects.heal > t) ef.push(`<span>${UI.icon('heal', 16)}${Math.ceil(p.effects.heal - t)}</span>`);
  if (p.effects.slow > t) ef.push(`<span>${UI.icon('slow', 16)}${Math.ceil(p.effects.slow - t)}</span>`);
  const efh = ef.join('');
  if (efh !== UI._ef) { UI._ef = efh; $('effects').innerHTML = efh; }
  UI.scoreboard();
};
let heldTimer = 0;
UI.heldName = (n) => {
  if (n === UI._held) return; UI._held = n;
  const el = $('held'); if (!n) { el.classList.remove('show'); return; }
  el.textContent = n; el.classList.add('show'); clearTimeout(heldTimer); heldTimer = setTimeout(() => el.classList.remove('show'), 1400);
};
UI.prompt = (txt) => {
  const el = $('prompt');
  if (!txt) { el.classList.remove('show'); return; }
  if (el.dataset.t !== txt) { el.dataset.t = txt; el.innerHTML = txt; }
  el.classList.add('show');
};
let sbKey = '';
UI.scoreboard = () => {
  const g = G.game, p = g.player;
  const ev = g.nextEvent();
  const rows = g.teams.map(tm => {
    const T = G.TEAMS[tm.id];
    const alive = g.actors.filter(a => a.team === tm.id && (a.alive || !a.eliminated)).length;
    const out = !alive && !tm.bedAlive;
    const state = tm.bedAlive ? `<span class="bed">${UI.icon('bed', 16)}</span>` : out ? '<span class="out">OUT</span>' : `<span class="n">${UI.icon('person', 14)}${alive}</span>`;
    return `<div class="row${out ? ' dead' : ''}${p && p.team === tm.id ? ' me' : ''}"><i class="chip" style="background:${T.css};box-shadow:inset 0 -3px 0 ${T.dark}"></i><span class="tn">${T.name}</span>${state}</div>`;
  }).join('');
  const key = rows + (ev ? ev.name + Math.floor(ev.t - g.time) : '') + (p ? p.stats.kills + ':' + p.stats.finals + ':' + p.stats.beds : '');
  if (key === sbKey) return; sbKey = key;
  $('scoreboard').innerHTML = `<div class="ev">${UI.icon('clock', 14)}<span>${ev ? ev.name : 'Final battle'}</span><b>${ev ? G.fmtTime(ev.t - g.time) : ''}</b></div>${rows}
    <div class="stats"><span><b>${p ? p.stats.kills : 0}</b>kills</span><span><b>${p ? p.stats.finals : 0}</b>finals</span><span><b>${p ? p.stats.beds : 0}</b>beds</span></div>`;
};
// kill feed: icon-based like a shooter, not sentences
UI.feed = (html, cls = '') => {
  const el = document.createElement('div'); el.className = 'kf ' + cls; el.innerHTML = html;
  $('killfeed').prepend(el);
  while ($('killfeed').children.length > 6) $('killfeed').lastChild.remove();
  setTimeout(() => el.classList.add('fade'), 6000); setTimeout(() => el.remove(), 7000);
};
UI.kill = (v, killer, kind, final) => {
  const ic = { melee: 'sword', arrow: 'bow', void: 'void', fall: 'fall', tnt: 'tnt' }[kind] || 'skull';
  const mine = (killer && killer.isPlayer) || v.isPlayer;
  UI.feed(`${killer ? nameHtml(killer) : ''}${UI.icon(killer ? ic : (kind === 'void' ? 'void' : 'skull'), 18)}${nameHtml(v)}${final ? '<em class="final">FINAL</em>' : ''}`, mine ? 'mine' : '');
};
const nameHtml = a => `<b style="color:${G.TEAMS[a.team].css}">${a.name}</b>`;
UI.name = nameHtml;
let annT = 0;
// big banner: a team-coloured slab with the title stamped on it
UI.announce = (title, sub = '', color = '#f4efe4', dur = 3000) => {
  const el = $('announce');
  el.style.setProperty('--ac', color);
  el.innerHTML = `<div class="slab"><div class="t">${title}</div></div>${sub ? `<div class="s">${sub}</div>` : ''}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(annT); annT = setTimeout(() => el.classList.remove('show'), dur);
};
UI.intro = (team, mode) => {
  const T = G.TEAMS[team];
  UI.announce(`${T.name.toUpperCase()} TEAM`, `${mode} · Skyhold · protect your bed`, T.css, 4200);
};
let toastT = 0;
UI.toast = (msg, color = '#f4efe4') => {
  const el = $('toast'); el.innerHTML = msg; el.style.color = color; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1600);
};
UI.pickup = (k, n) => { UI.toast(`${resImg(k)}+${n}`, G.RES_COLOR[k]); };
UI.hurtFlash = () => { const el = $('fx-damage'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
UI.hitmarker = (kill) => { const el = $('crosshair'); el.classList.remove('hit', 'kill'); void el.offsetWidth; el.classList.add(kill ? 'kill' : 'hit'); };
UI.breakRing = (f) => {
  const el = $('break-ring');
  if (f <= 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.firstChild.style.width = (f * 100) + '%';
};
UI.bowCharge = (f) => {
  const el = $('bowcharge');
  if (f <= 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.firstChild.style.width = (Math.min(1, f) * 100) + '%';
};
UI.respawn = (secs, final) => {
  const el = $('respawn');
  if (secs === null) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = final
    ? `<div class="t">ELIMINATED</div><div class="s">Your bed is gone · spectating · <kbd>WASD</kbd> fly · <kbd>Space</kbd>/<kbd>Shift</kbd> up/down</div>`
    : `<div class="t">RESPAWNING</div><div class="big">${Math.ceil(secs)}</div>`;
};

/* ---------- shops ---------- */
let shopKind = null, shopCat = 'Blocks', hover = null;
UI.shopOpen = () => !!shopKind;
UI.openShop = (kind) => {
  shopKind = kind; hover = null; $('shop').classList.remove('hidden');
  document.exitPointerLock && document.exitPointerLock();
  UI.drawShop();
};
UI.closeShop = () => { shopKind = null; $('shop').classList.add('hidden'); G.lockPointer(); };
function toolEntry(p, e) {
  const tier = (e.tool === 'pick' ? p.pickTier : p.axeTier) + 1;
  if (tier > 4) return { name: 'Diamond ' + (e.tool === 'pick' ? 'Pickaxe' : 'Axe'), maxed: true, icon: e.tool + '4', cost: {} };
  return { name: G.ITEMS[e.tool + tier].name, icon: e.tool + tier, cost: G.TOOL_COST[tier] };
}
const ARMOR_ORDER = ['leather', 'chain', 'iron', 'diamond'];
function entryInfo(p, e) {
  let name, icon, cost = e.cost, owned = false;
  if (e.tool) { const t = toolEntry(p, e); name = t.name; icon = t.icon; cost = t.cost; owned = t.maxed; }
  else if (e.armor) { name = e.name; icon = 'armor_' + e.armor; owned = ARMOR_ORDER.indexOf(p.armor) >= ARMOR_ORDER.indexOf(e.armor); }
  else { name = G.ITEMS[e.id].name; icon = e.id; if (e.id === 'shears') owned = p.shears; if (G.ITEMS[e.id].kind === 'sword') { const b = p.bestSword(); owned = !!b && G.ITEMS[b.id].dmg >= G.ITEMS[e.id].dmg; } }
  return { name, icon, cost, owned, ok: !owned && canAfford(p, cost) };
}
UI.drawShop = () => {
  const p = G.game.player, el = $('shop');
  const wallet = G.RES.map(k => `<span class="r-${k}">${resImg(k)}<b>${p.res[k]}</b></span>`).join('');
  let body, title, detail;
  if (shopKind === 'item') {
    title = 'ITEM SHOP';
    const cats = [...new Set(G.SHOP.map(e => e.cat))];
    const list = G.SHOP.map((e, i) => ({ e, i })).filter(x => x.e.cat === shopCat);
    const tiles = list.map(({ e, i }) => {
      const f = entryInfo(p, e);
      return `<button class="tile${f.ok ? '' : ' no'}${f.owned ? ' owned' : ''}${hover === i ? ' hov' : ''}" data-i="${i}">
        ${e.n > 1 ? `<span class="qty">×${e.n}</span>` : ''}<img src="${G.icons[f.icon] || ''}" alt=""><span class="price">${f.owned ? '<span class="own">OWNED</span>' : costHtml(f.cost, p)}</span></button>`;
    }).join('');
    const sel = G.SHOP[hover !== null && G.SHOP[hover] && G.SHOP[hover].cat === shopCat ? hover : list[0].i];
    const f = entryInfo(p, sel);
    detail = `<img src="${G.icons[f.icon] || ''}" alt=""><h3>${f.name}${sel.n > 1 ? ` <small>×${sel.n}</small>` : ''}</h3><p>${sel.desc}</p><div class="dc">${f.owned ? '<span class="own">OWNED</span>' : costHtml(f.cost, p)}</div>`;
    const TAB_ICON = { Blocks: 'wool', Melee: 'sword_stone', Armor: 'armor_iron', Tools: 'pick2', Ranged: 'bow', Utility: 'fireball' };
    body = `<nav class="tabs">${cats.map(c => `<button class="tab${c === shopCat ? ' on' : ''}" data-c="${c}"><img src="${G.icons[TAB_ICON[c]] || ''}" alt="">${c}</button>`).join('')}</nav><div class="grid">${tiles}</div>`;
  } else {
    title = 'TEAM UPGRADES';
    const tm = G.game.teams[p.team];
    const tiles = G.UPGRADES.map((u, i) => {
      const lvl = tm.up[u.id], maxed = lvl >= u.max, cost = maxed ? null : u.cost[lvl];
      const ok = !maxed && p.res.diamond >= cost;
      const pips = Array.from({ length: u.max }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('');
      return `<button class="tile up${ok ? '' : ' no'}${maxed ? ' owned' : ''}${hover === i ? ' hov' : ''}" data-u="${u.id}" data-h="${i}"><span class="pips">${pips}</span><img src="${G.icons['upg_' + u.id] || ''}" alt=""><span class="price">${maxed ? '<span class="own">MAX</span>' : costHtml({ diamond: cost }, p)}</span></button>`;
    }).join('');
    const u = G.UPGRADES[hover !== null && G.UPGRADES[hover] ? hover : 0], lvl = tm.up[u.id];
    detail = `<img src="${G.icons['upg_' + u.id] || ''}" alt=""><h3>${u.name}${u.max > 1 ? ` <small>${Math.min(lvl + 1, u.max)}/${u.max}</small>` : ''}</h3><p>${u.desc}</p><div class="dc">${lvl >= u.max ? '<span class="own">MAXED</span>' : costHtml({ diamond: u.cost[lvl] }, p)}</div><p class="note">Shared by your whole team. Diamonds spawn on the corner islands.</p>`;
    body = `<div class="grid up">${tiles}</div>`;
  }
  el.innerHTML = `<div class="box"><header><h2>${title}</h2><div class="wallet">${wallet}</div><button class="x" aria-label="Close">${UI.icon('close', 18)}</button></header>
    <div class="bd">${body}<aside class="detail">${detail}</aside></div>
    <footer><kbd>Click</kbd> buy <kbd>E</kbd> close</footer></div>`;
};
document.addEventListener('click', e => {
  if (!shopKind) return;
  const t = e.target.closest('[data-c],[data-i],[data-u],.x');
  if (!t) return;
  const p = G.game.player;
  if (t.classList.contains('x')) { UI.closeShop(); return; }
  if (t.dataset.c) { shopCat = t.dataset.c; hover = null; UI.drawShop(); return; }
  if (t.dataset.i) { if (G.game.buy(p, G.SHOP[+t.dataset.i])) { G.audio.buy(); t.classList.add('bought'); } else G.audio.deny(); setTimeout(UI.drawShop, 120); return; }
  if (t.dataset.u) { if (G.game.buyUpgrade(p, t.dataset.u)) G.audio.buy(); else G.audio.deny(); UI.drawShop(); }
});
document.addEventListener('mouseover', e => {
  if (!shopKind) return;
  const t = e.target.closest('[data-i],[data-h]'); if (!t) return;
  const h = t.dataset.i !== undefined ? +t.dataset.i : +t.dataset.h;
  if (h !== hover) { hover = h; UI.drawShop(); }
});

/* ---------- menus ---------- */
UI.menu = () => {
  $('menu').classList.remove('hidden');
  $('menu').innerHTML = `
    <section class="title">
      <h1 class="logo"><span>BED</span><span>RAID</span></h1>
      <p class="tag">Four islands. Four beds. Break theirs, keep yours.</p>
      <div class="field"><label>Mode</label>
        <div class="seg modes" id="o-mode">
          <button data-v="solo" class="on"><b>Solos</b><small>1v1v1v1</small></button>
          <button data-v="duo"><b>Duos</b><small>2v2v2v2</small></button>
          <button data-v="squad"><b>Squads</b><small>4v4v4v4</small></button>
        </div></div>
      <div class="field"><label>Bots</label>
        <div class="seg" id="o-diff"><button data-v="easy">Easy</button><button data-v="normal" class="on">Normal</button><button data-v="hard">Hard</button></div></div>
      <div class="field"><label>Team</label>
        <div class="seg teams" id="o-team">${G.TEAMS.map(t => `<button data-v="${t.id}" class="${t.id === 0 ? 'on' : ''}" style="--c:${t.css};--cd:${t.dark}" aria-label="${t.name}"><i></i></button>`).join('')}<button data-v="-1" class="rnd" aria-label="Random team">${UI.icon('dice', 22)}</button></div></div>
      <button id="play" class="cta">PLAY</button>
      <div class="links"><a href="#" onclick="window.close(); return false;">Back to Sipher</a><button id="m-help">How to play</button><button id="m-set">Settings</button></div>
    </section>
    <section class="sheet hidden" id="m-sheet"></section>
    <p class="credits">Models: Sketchfab, CC BY 4.0 — MrPuppet, MrMGames, anton.engdahl, twistedc3, ApixCraft, poonyamano, iwillsearch69, Twistednc, mrvovun.</p>`;
  const pickOpt = id => { const el = $(id); el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }); };
  ['o-mode', 'o-diff', 'o-team'].forEach(pickOpt);
  const sheet = $('m-sheet');
  const openSheet = (kind) => {
    if (sheet.dataset.k === kind && !sheet.classList.contains('hidden')) { sheet.classList.add('hidden'); return; }
    sheet.dataset.k = kind; sheet.classList.remove('hidden');
    sheet.innerHTML = kind === 'help' ? helpHtml() : settingsHtml();
    if (kind === 'set') bindSettings(sheet);
  };
  $('m-help').onclick = () => openSheet('help');
  $('m-set').onclick = () => openSheet('set');
  $('play').onclick = () => {
    G.audio.init();
    const v = id => $(id).querySelector('.on').dataset.v;
    let team = +v('o-team'); if (team < 0) team = G.randi(0, 3);
    $('menu').classList.add('hidden');
    G.game.start({ mode: v('o-mode'), diff: v('o-diff'), team });
  };
};
const helpHtml = () => `<h2>How to play</h2>
  <ol class="steps">
    <li><b>Farm</b> Stand on your generator for iron and gold.</li>
    <li><b>Shop</b> Buy wool and a sword. Diamonds buy team upgrades.</li>
    <li><b>Defend</b> Cover your bed. While it stands, you respawn.</li>
    <li><b>Raid</b> Bridge across, break their bed, finish them.</li>
  </ol>
  <div class="keys"><span><kbd>WASD</kbd>move</span><span><kbd>Space</kbd>jump</span><span><kbd>Ctrl</kbd>sprint</span><span><kbd>Shift</kbd>sneak</span><span><kbd>LMB</kbd>hit / break</span><span><kbd>RMB</kbd>place / use</span><span><kbd>1–9</kbd>hotbar</span><span><kbd>E</kbd>shop</span><span><kbd>F5</kbd>camera</span><span><kbd>Esc</kbd>pause</span></div>`;
const settingsHtml = () => { const s = G.settings; return `<h2>Settings</h2>
  <label>Mouse sensitivity<input id="s-sens" type="range" min="0.2" max="3" step="0.05" value="${s.sens}"></label>
  <label>Field of view<input id="s-fov" type="range" min="60" max="110" step="1" value="${s.fov}"></label>
  <label>Volume<input id="s-vol" type="range" min="0" max="1" step="0.05" value="${s.vol}"></label>`; };
function bindSettings(root) {
  const s = G.settings;
  for (const k of ['sens', 'fov', 'vol']) root.querySelector('#s-' + k).addEventListener('input', e => { s[k] = +e.target.value; G.saveSettings(); if (k === 'vol') G.audio.setVol(s.vol); if (k === 'fov' && G.camera) { G.camera.fov = s.fov; G.camera.updateProjectionMatrix(); } });
}
UI.pause = (on) => {
  const el = $('pause');
  if (!on) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `<div class="box"><h2>PAUSED</h2>${settingsHtml().replace('<h2>Settings</h2>', '')}<button id="p-resume" class="cta">RESUME</button><button id="p-quit" class="plain">Leave match</button></div>`;
  bindSettings(el);
  $('p-resume').onclick = () => { UI.pause(false); G.lockPointer(); };
  $('p-quit').onclick = () => { UI.pause(false); G.game.quit(); };
};
UI.end = (win, team) => {
  const g = G.game, p = g.player, el = $('end');
  el.classList.remove('hidden');
  const all = [...g.actors].sort((a, b) => (b.stats.finals * 3 + b.stats.kills + b.stats.beds * 4) - (a.stats.finals * 3 + a.stats.kills + a.stats.beds * 4)).slice(0, 8);
  const T = team !== null && team !== undefined ? G.TEAMS[team] : null;
  el.style.setProperty('--wc', T ? T.css : '#a7afc2');
  el.innerHTML = `<div class="box">
    <div class="res-t ${win ? 'win' : 'lose'}">${win ? 'VICTORY' : T ? 'DEFEAT' : 'DRAW'}</div>
    <div class="sub">${T ? `<i class="chip" style="background:${T.css}"></i>${T.name} team wins` : 'Time ran out'} · ${G.fmtTime(g.time)}</div>
    <table><thead><tr><th>Player</th><th>${UI.icon('sword', 14)}</th><th>FINAL</th><th>${UI.icon('bed', 14)}</th></tr></thead><tbody>
    ${all.map(a => `<tr class="${a === p ? 'me' : ''}"><td>${nameHtml(a)}</td><td>${a.stats.kills}</td><td>${a.stats.finals}</td><td>${a.stats.beds}</td></tr>`).join('')}</tbody></table>
    <div class="btns"><button id="e-again" class="cta">PLAY AGAIN</button><button id="e-menu" class="plain">Main menu</button></div></div>`;
  $('e-again').onclick = () => { el.classList.add('hidden'); G.game.start(g.opts); };
  $('e-menu').onclick = () => { el.classList.add('hidden'); G.game.quit(); };
};
})();
