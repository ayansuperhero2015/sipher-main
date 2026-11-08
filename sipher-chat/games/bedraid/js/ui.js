// UI: HUD, scoreboard, kill feed, shops, menus.
(() => {
'use strict';
const $ = id => document.getElementById(id);
const UI = G.ui = { dirty: true };
const costHtml = c => Object.entries(c).map(([k, v]) => `<span class="cost" style="color:${G.RES_COLOR[k]}"><img src="${G.icons['res_' + k] || ''}">${v}</span>`).join(' ');
const canAfford = (a, c) => Object.entries(c).every(([k, v]) => a.res[k] >= v);
UI.canAfford = canAfford;

/* ---------- HUD ---------- */
UI.render = () => {
  const p = G.game.player; if (!p) return;
  if (UI.dirty) {
    UI.dirty = false;
    $('hotbar').innerHTML = p.slots.map((s, i) => `<div class="slot${i === p.sel ? ' sel' : ''}"><small>${i + 1}</small>${s ? `<img src="${G.icons[s.id] || ''}">${s.count > 1 ? `<b>${s.count}</b>` : ''}` : ''}</div>`).join('');
    $('res').innerHTML = G.RES.map(k => `<div class="r" style="color:${G.RES_COLOR[k]}"><img src="${G.icons['res_' + k] || ''}"><b>${p.res[k]}</b></div>`).join('');
    const held = p.held();
    $('armor-ico').innerHTML = p.armor !== 'leather' ? `<img src="${G.icons['armor_' + p.armor]}">` : '';
    UI.heldName(held ? G.ITEMS[held.id].name : '');
  }
  $('hp-fill').style.width = (p.hp / p.maxHp * 100) + '%';
  $('hp-fill').style.background = p.hp > 50 ? 'linear-gradient(#7cf06a,#3fbf2f)' : p.hp > 25 ? 'linear-gradient(#ffe066,#e6b800)' : 'linear-gradient(#ff7a6a,#d63a2a)';
  $('hp-text').textContent = Math.ceil(p.hp);
  const ef = [];
  const t = G.game.time;
  if (p.effects.speed > t) ef.push(`<span>⚡ ${Math.ceil(p.effects.speed - t)}s</span>`);
  if (p.effects.heal > t) ef.push(`<span>❤ ${Math.ceil(p.effects.heal - t)}s</span>`);
  if (p.effects.slow > t) ef.push(`<span>🐌 ${Math.ceil(p.effects.slow - t)}s</span>`);
  $('effects').innerHTML = ef.join('');
  UI.scoreboard();
};
let heldTimer = 0;
UI.heldName = (n) => {
  if (n === UI._held) return; UI._held = n;
  const el = $('prompt'); if (!n) return;
  el.textContent = n; el.classList.add('show'); clearTimeout(heldTimer); heldTimer = setTimeout(() => el.classList.remove('show'), 1300);
};
let sbKey = '';
UI.scoreboard = () => {
  const g = G.game;
  const ev = g.nextEvent();
  const rows = g.teams.map(tm => {
    const alive = g.actors.filter(a => a.team === tm.id && (a.alive || !a.eliminated)).length;
    const st = tm.bedAlive ? '<i class="ok">✔</i>' : alive ? `<i class="cnt">${alive}</i>` : '<i class="no">✘</i>';
    const you = g.player && g.player.team === tm.id ? ' <em>YOU</em>' : '';
    return `<div class="row${alive || tm.bedAlive ? '' : ' dead'}"><b style="background:${G.TEAMS[tm.id].css}">${G.TEAMS[tm.id].name[0]}</b> ${G.TEAMS[tm.id].name}${you}<span>${st}</span></div>`;
  }).join('');
  const p = g.player;
  const key = rows + (ev ? ev.name + Math.floor(ev.t - g.time) : '') + (p ? p.stats.kills + ':' + p.stats.finals + ':' + p.stats.beds : '');
  if (key === sbKey) return; sbKey = key;
  $('scoreboard').innerHTML = `<h3>BED RAID</h3><div class="ev">${ev ? `${ev.name} in <b>${G.fmtTime(ev.t - g.time)}</b>` : 'Final battle!'}</div>${rows}
    <div class="stats">Kills <b>${p ? p.stats.kills : 0}</b> · Finals <b>${p ? p.stats.finals : 0}</b> · Beds <b>${p ? p.stats.beds : 0}</b></div><div class="map">Map: Skyhold · ${g.modeName}</div>`;
};
UI.feed = (html) => {
  const el = document.createElement('div'); el.className = 'kf'; el.innerHTML = html;
  $('killfeed').prepend(el);
  while ($('killfeed').children.length > 6) $('killfeed').lastChild.remove();
  setTimeout(() => el.classList.add('fade'), 6000); setTimeout(() => el.remove(), 7000);
};
const nameHtml = a => `<b style="color:${G.TEAMS[a.team].css}">${a.name}</b>`;
UI.name = nameHtml;
let annT = 0;
UI.announce = (title, sub = '', color = '#fff', dur = 3000) => {
  const el = $('announce');
  el.innerHTML = `<div class="t" style="color:${color}">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(annT); annT = setTimeout(() => el.classList.remove('show'), dur);
};
let toastT = 0;
UI.toast = (msg, color = '#fff') => {
  const el = $('toast'); el.innerHTML = msg; el.style.color = color; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800);
};
UI.pickup = (k, n) => { UI.toast(`+${n} ${k[0].toUpperCase() + k.slice(1)}`, G.RES_COLOR[k]); };
UI.hurtFlash = () => { const el = $('fx-damage'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
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
  el.innerHTML = final ? `<div class="t">ELIMINATED</div><div class="s">Your bed is gone. Spectating — WASD to fly, Space/Shift up/down.</div>` : `<div class="t">YOU DIED!</div><div class="s">Respawning in <b>${Math.ceil(secs)}</b>…</div>`;
};

/* ---------- shops ---------- */
let shopKind = null, shopCat = 'Blocks';
UI.shopOpen = () => !!shopKind;
UI.openShop = (kind) => {
  shopKind = kind; $('shop').classList.remove('hidden');
  document.exitPointerLock && document.exitPointerLock();
  UI.drawShop();
};
UI.closeShop = () => { shopKind = null; $('shop').classList.add('hidden'); G.lockPointer(); };
function toolEntry(p, e) {
  const tier = (e.tool === 'pick' ? p.pickTier : p.axeTier) + 1;
  if (tier > 4) return { name: 'Diamond ' + (e.tool === 'pick' ? 'Pickaxe' : 'Axe'), maxed: true, icon: e.tool + '4', cost: {} };
  return { name: G.ITEMS[e.tool + tier].name, icon: e.tool + tier, cost: G.TOOL_COST[tier] };
}
UI.drawShop = () => {
  const p = G.game.player, el = $('shop');
  const res = G.RES.map(k => `<span style="color:${G.RES_COLOR[k]}"><img src="${G.icons['res_' + k]}">${p.res[k]}</span>`).join('');
  if (shopKind === 'item') {
    const cats = [...new Set(G.SHOP.map(e => e.cat))];
    const items = G.SHOP.map((e, i) => ({ e, i })).filter(x => x.e.cat === shopCat).map(({ e, i }) => {
      let name, icon, cost = e.cost, owned = false, n = e.n;
      if (e.tool) { const t = toolEntry(p, e); name = t.name; icon = t.icon; cost = t.cost; owned = t.maxed; }
      else if (e.armor) { name = e.name; icon = 'armor_' + e.armor; owned = ['leather', 'chain', 'iron', 'diamond'].indexOf(p.armor) >= ['leather', 'chain', 'iron', 'diamond'].indexOf(e.armor); }
      else { name = G.ITEMS[e.id].name; icon = e.id; if (e.id === 'shears') owned = p.shears; if (G.ITEMS[e.id].kind === 'sword') { const b = p.bestSword(); owned = b && G.ITEMS[b.id].dmg >= G.ITEMS[e.id].dmg; } }
      const ok = !owned && canAfford(p, cost);
      return `<div class="card${ok ? '' : ' no'}${owned ? ' owned' : ''}" data-i="${i}"><img src="${G.icons[icon] || ''}"><div class="nm">${name}${n > 1 ? ` <small>x${n}</small>` : ''}</div><div class="cs">${owned ? '<span class="own">OWNED</span>' : costHtml(cost)}</div><div class="ds">${e.desc}</div></div>`;
    }).join('');
    el.innerHTML = `<div class="box"><div class="hd"><h2>ITEM SHOP</h2><div class="res">${res}</div><button class="x">✕</button></div>
      <div class="bd"><div class="tabs">${cats.map(c => `<button class="tab${c === shopCat ? ' on' : ''}" data-c="${c}">${c}</button>`).join('')}</div><div class="grid">${items}</div></div>
      <div class="ft">Click an item to buy it · <kbd>E</kbd>/<kbd>Esc</kbd> to close</div></div>`;
  } else {
    const tm = G.game.teams[p.team];
    const rows = G.UPGRADES.map(u => {
      const lvl = tm.up[u.id], maxed = lvl >= u.max, cost = maxed ? null : u.cost[lvl];
      const ok = !maxed && p.res.diamond >= cost;
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      return `<div class="card up${ok ? '' : ' no'}${maxed ? ' owned' : ''}" data-u="${u.id}"><img src="${G.icons['upg_' + u.id] || ''}"><div class="nm">${u.name} <span class="pips">${pips}</span></div><div class="cs">${maxed ? '<span class="own">MAXED</span>' : costHtml({ diamond: cost })}</div><div class="ds">${u.desc}</div></div>`;
    }).join('');
    el.innerHTML = `<div class="box"><div class="hd"><h2>TEAM UPGRADES</h2><div class="res">${res}</div><button class="x">✕</button></div>
      <div class="bd"><div class="grid wide">${rows}</div></div><div class="ft">Upgrades are shared by your whole team and paid with diamonds from the diamond islands.</div></div>`;
  }
};
document.addEventListener('click', e => {
  if (!shopKind) return;
  const t = e.target.closest('[data-c],[data-i],[data-u],.x');
  if (!t) return;
  const p = G.game.player;
  if (t.classList.contains('x')) { UI.closeShop(); return; }
  if (t.dataset.c) { shopCat = t.dataset.c; UI.drawShop(); return; }
  if (t.dataset.i) { if (G.game.buy(p, G.SHOP[+t.dataset.i])) G.audio.buy(); else G.audio.deny(); UI.drawShop(); return; }
  if (t.dataset.u) { if (G.game.buyUpgrade(p, t.dataset.u)) G.audio.buy(); else G.audio.deny(); UI.drawShop(); }
});

/* ---------- menus ---------- */
UI.menu = () => {
  const s = G.settings;
  $('menu').classList.remove('hidden');
  $('menu').innerHTML = `<div class="mwrap">
    <div class="logo">BED RAID</div>
    <div class="tag">Protect your bed. Break theirs. Last team standing wins.</div>
    <div class="cols">
      <div class="panel">
        <h3>Mode</h3>
        <div class="opts" id="o-mode">
          <button data-v="solo" class="on">Solos<small>4 teams of 1</small></button>
          <button data-v="duo">Duos<small>4 teams of 2</small></button>
          <button data-v="squad">Squads<small>4 teams of 4</small></button>
        </div>
        <h3>Bots</h3>
        <div class="opts" id="o-diff">
          <button data-v="easy">Easy</button>
          <button data-v="normal" class="on">Normal</button>
          <button data-v="hard">Hard</button>
        </div>
        <h3>Your team</h3>
        <div class="opts teams" id="o-team">${G.TEAMS.map(t => `<button data-v="${t.id}" class="${t.id === 0 ? 'on' : ''}" style="--c:${t.css}">${t.name}</button>`).join('')}<button data-v="-1">Random</button></div>
        <button id="play" class="big">PLAY</button>
        <a class="back" href="#" onclick="window.close(); return false;">← Back to Sipher</a>
        <div class="credits">3D models from Sketchfab (CC BY 4.0) by MrPuppet, MrMGames, anton.engdahl, twistedc3, ApixCraft, poonyamano, iwillsearch69, Twistednc, DevJeeth and mrvovun. Full list in CREDITS.md.</div>
      </div>
      <div class="panel help">
        <h3>How to play</h3>
        <ul>
          <li>Stand on your <b>generator</b> to collect iron and gold.</li>
          <li>Spend them at the <b>Item Shop</b>; spend diamonds at <b>Team Upgrades</b>.</li>
          <li>Cover your <b>bed</b> with blocks. While it stands you respawn.</li>
          <li>Bridge to other islands and break their beds. Then finish them off.</li>
          <li>Diamonds spawn on the corner islands, emeralds in the middle.</li>
        </ul>
        <h3>Controls</h3>
        <div class="keys">
          <span><kbd>WASD</kbd> move</span><span><kbd>Space</kbd> jump</span><span><kbd>Ctrl</kbd> sprint</span><span><kbd>Shift</kbd> sneak (safe edges)</span>
          <span><kbd>LMB</kbd> hit / break</span><span><kbd>RMB</kbd> place / use</span><span><kbd>1-9</kbd> / wheel hotbar</span><span><kbd>E</kbd> shop</span>
          <span><kbd>F5</kbd> camera</span><span><kbd>Esc</kbd> pause</span>
        </div>
        <h3>Settings</h3>
        <label>Mouse sensitivity <input id="s-sens" type="range" min="0.2" max="3" step="0.05" value="${s.sens}"></label>
        <label>Field of view <input id="s-fov" type="range" min="60" max="110" step="1" value="${s.fov}"></label>
        <label>Volume <input id="s-vol" type="range" min="0" max="1" step="0.05" value="${s.vol}"></label>
      </div>
    </div></div>`;
  const pickOpt = id => { const el = $(id); el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }); };
  ['o-mode', 'o-diff', 'o-team'].forEach(pickOpt);
  for (const k of ['sens', 'fov', 'vol']) $('s-' + k).addEventListener('input', e => { s[k] = +e.target.value; G.saveSettings(); if (k === 'vol') G.audio.setVol(s.vol); if (k === 'fov' && G.camera) { G.camera.fov = s.fov; G.camera.updateProjectionMatrix(); } });
  $('play').onclick = () => {
    G.audio.init();
    const v = id => $(id).querySelector('.on').dataset.v;
    let team = +v('o-team'); if (team < 0) team = G.randi(0, 3);
    $('menu').classList.add('hidden');
    G.game.start({ mode: v('o-mode'), diff: v('o-diff'), team });
  };
};
UI.pause = (on) => {
  const el = $('pause');
  if (!on) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `<div class="box"><h2>PAUSED</h2><button id="p-resume" class="big">Resume</button><button id="p-quit">Leave match</button></div>`;
  $('p-resume').onclick = () => { UI.pause(false); G.lockPointer(); };
  $('p-quit').onclick = () => { UI.pause(false); G.game.quit(); };
};
UI.end = (win, team) => {
  const g = G.game, p = g.player, el = $('end');
  el.classList.remove('hidden');
  const all = [...g.actors].sort((a, b) => (b.stats.finals * 3 + b.stats.kills + b.stats.beds * 4) - (a.stats.finals * 3 + a.stats.kills + a.stats.beds * 4)).slice(0, 8);
  el.innerHTML = `<div class="box">
    <div class="res-t ${win ? 'win' : 'lose'}">${win ? 'VICTORY!' : team === null ? 'DRAW' : 'GAME OVER'}</div>
    <div class="sub">${team !== null && team !== undefined ? `<b style="color:${G.TEAMS[team].css}">${G.TEAMS[team].name}</b> team wins!` : 'Time ran out.'}</div>
    <table><tr><th>Player</th><th>Kills</th><th>Finals</th><th>Beds</th></tr>
    ${all.map(a => `<tr class="${a === p ? 'me' : ''}"><td>${nameHtml(a)}</td><td>${a.stats.kills}</td><td>${a.stats.finals}</td><td>${a.stats.beds}</td></tr>`).join('')}</table>
    <div class="btns"><button id="e-again" class="big">Play again</button><button id="e-menu">Main menu</button></div></div>`;
  $('e-again').onclick = () => { el.classList.add('hidden'); G.game.start(g.opts); };
  $('e-menu').onclick = () => { el.classList.add('hidden'); G.game.quit(); };
};
})();
