// UI: lobby, HUD, overlays, minigames (padlock, breaker, heartbeat), death/victory screens.
(() => {
'use strict';
const U = G.ui = {};
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

U.NAMES = {
  rush: 'Rush', ambush: 'Ambush', screech: 'Screech', eyes: 'Eyes', halt: 'Halt', seek: 'Seek', hands: 'Seek', figure: 'The Figure',
  dupe: 'Dupe', snare: 'Snare', hide: 'Hide', timothy: 'Timothy', giggle: 'Giggle', gloombats: 'Gloombats', grumble: 'a Grumble',
  monument: 'Monument', a60: 'A-60', a90: 'A-90', a120: 'A-120', blitz: 'Blitz', lookman: 'Lookman', haste: 'Haste', vacuum: 'Vacuum', jack: 'Jack',
};
const GUIDE = {
  rush: ['You died to who you call Rush...', 'It seems to make its presence known when the lights flicker.', 'Whenever this happens, find a hiding spot!'],
  ambush: ['You died to who you call Ambush...', 'It can come back several times. Listen for it.', 'Stay hidden until it is gone for good.'],
  screech: ['You died to who you call Screech...', 'It lurks in dark rooms.', 'When you hear "psst", turn around and look at it.'],
  eyes: ['You died to who you call Eyes...', 'Do not look directly at it.', 'Look at the floor while you move past.'],
  halt: ['You died to who you call Halt...', 'When it tells you to turn around, walk the other way.'],
  seek: ['You died to who you call Seek...', 'Keep running and do not stop.', 'Follow the blue guiding light to the right door.'],
  hands: ['Seek\'s hands grabbed you...', 'In the burning hall, stay in the lit lane.'],
  figure: ['You died to who you call The Figure...', 'It cannot see, but it hears everything.', 'Crouch to move quietly, and stay calm when it is near your hiding spot.'],
  dupe: ['You died to who you call Dupe...', 'Remember the number of the last door you opened.', 'The next door is always one higher.'],
  snare: ['A Snare caught you...', 'Watch the floor in overgrown rooms.'],
  hide: ['Hide threw you out...', 'Do not stay in one hiding spot for too long.'],
  timothy: ['Timothy bit you...', 'It was just a spider. Mostly harmless.'],
  giggle: ['You died to who you call Giggle...', 'Look up before you walk under it, and shake it off fast.'],
  gloombats: ['You died to the Gloombats...', 'They are drawn to light. Keep your light off in dark mine rooms.'],
  grumble: ['You died to the Grumbles...', 'They see well. Crouch, stay behind cover and keep your light off.'],
  monument: ['You died to who you call Monument...', 'It only moves when you are not looking at it.', 'Keep it in sight as you back away.'],
  a60: ['You died to A-60...', 'The static means it is coming. Hide in a locker immediately.'],
  a90: ['You died to A-90...', 'When it appears, stop moving and do not move your mouse.'],
  a120: ['You died to A-120...', 'It is slow but relentless. Hide when you hear it.'],
  blitz: ['You died to who you call Blitz...', 'It passes through more than once. Hide when the lights flicker.'],
  lookman: ['You died to who you call Lookman...', 'Do not stare into the dark.'],
  haste: ['You died to who you call Haste...', 'Pull the green time levers to keep the clock running.'],
  vacuum: ['You fell into the Vacuum...', 'The real door always has a number on it.'],
};
const FACE = { hands: 'hands', grumble: 'grumble', figure: 'figure', seek: 'seek', vacuum: 'vacuum', hide: 'hide', snare: 'snare', halt: 'halt', gloombats: 'gloombat' };
U.faceFor = s => FACE[s] || s;
U.GUIDE = GUIDE; U.FACE = FACE;

const SHOP = [
  { id: 'lighter', price: 60, desc: 'A small flame. Lasts a while.' },
  { id: 'flashlight', price: 110, desc: 'Bright beam. Uses battery.' },
  { id: 'lockpick', price: 80, desc: 'Opens 3 locked doors.' },
  { id: 'vitamins', price: 60, desc: 'Run faster for 12 seconds.' },
  { id: 'bandage', price: 50, desc: 'Heals 35 health.' },
  { id: 'crucifix', price: 300, desc: 'Banishes the entity about to kill you.' },
];
const BESTIARY = [
  ['rush', 'Rush', 'Lights flicker → hide in a closet.'], ['ambush', 'Ambush', 'Rebounds several times. Stay hidden.'],
  ['screech', 'Screech', 'Dark rooms. Hear "psst"? Look at it.'], ['eyes', 'Eyes', 'Do not look at it.'],
  ['halt', 'Halt', 'Turn around when told.'], ['seek', 'Seek', 'Run. Follow the blue light.'],
  ['figure', 'The Figure', 'Blind. Crouch to stay silent.'], ['dupe', 'Dupe', 'Pick the correct door number.'],
  ['timothy', 'Timothy', 'Lives in drawers.'], ['jack', 'Jack', 'Lives in closets.'],
  ['giggle', 'Giggle', 'Ceiling drop. Click to shake it off.'], ['gloombat', 'Gloombats', 'Lights off in dark mines.'],
  ['grumble', 'Grumbles', 'The Nest. Stay out of sight.'], ['haste', 'Haste', 'Backdoor clock. Pull levers.'],
  ['blitz', 'Blitz', 'Backdoor Rush. Hide twice.'], ['lookman', 'Lookman', 'Look away from it.'],
  ['a60', 'A-60', 'Rooms. Hide in a locker.'], ['a90', 'A-90', 'Freeze completely.'],
  ['a120', 'A-120', 'Rooms. Hide when you hear it.'], ['monument', 'Monument', 'Keep it in sight.'],
];
U.BESTIARY = BESTIARY;

/* ---------- lobby ---------- */
U.init = () => {
  const m = $('menu');
  m.innerHTML = `
    <div class="menu-bg"></div>
    <div class="menu-wrap">
      <aside class="menu-side">
        <div class="logo">DOORS<span>web edition</span></div>
        <nav id="menu-nav">
          <button data-tab="play" class="on">Play</button>
          <button data-tab="shop">Pre-Run Shop</button>
          <button data-tab="avatar">Avatar</button>
          <button data-tab="entities">Entities</button>
          <button data-tab="howto">How to Play</button>
          <button data-tab="settings">Settings</button>
        </nav>
        <div class="knobs-box"><span class="knob-ico"></span><b id="knobs-n">0</b><small>Knobs</small></div>
        <a class="back-link" href="#" onclick="window.close(); return false;">&larr; Back to Sipher</a>
      </aside>
      <main class="menu-main" id="menu-main"></main>
    </div>`;
  m.querySelectorAll('#menu-nav button').forEach(b => b.addEventListener('click', () => { G.audio.init(); G.audio.sfx('click'); U.tab(b.dataset.tab); }));
  U.tab('play');
  $('clicklock').addEventListener('click', () => { G.requestLock(); });
};
U.tab = t => {
  document.querySelectorAll('#menu-nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  const main = $('menu-main');
  $('knobs-n').textContent = G.save.knobs;
  G.avatar.stopPreview();
  if (t === 'avatar') G.avatar.renderTab(main);
  else if (t === 'play') {
    main.innerHTML = `<h2>Choose a floor</h2><div class="floors">${G.FLOOR_ORDER.map(id => {
      const f = G.FLOORS[id], best = G.save.best[id], won = G.save.wins[id];
      return `<div class="floor-card" style="--acc:${f.color}">
        <div class="fc-art"><img src="${G.faceURL(f.face)}" alt=""></div>
        <div class="fc-body"><div class="fc-tag">${f.tag}${won ? ' · <span class="won">ESCAPED ×' + won + '</span>' : ''}</div>
        <h3>${f.name}</h3><p>${f.desc}</p>
        <div class="fc-meta">${f.range}${best !== undefined ? ' · Best: ' + esc(f.plate(best)) : ''}</div>
        <button class="btn" data-floor="${id}">Enter</button></div></div>`;
    }).join('')}</div>`;
    main.querySelectorAll('[data-floor]').forEach(b => b.addEventListener('click', () => G.game.start(b.dataset.floor)));
  } else if (t === 'shop') {
    const loadout = Object.entries(G.save.shop).filter(([, v]) => v > 0).map(([k, v]) => `${G.ITEMS[k].icon} ${G.ITEMS[k].name} ×${v}`).join(' &nbsp; ') || 'Nothing yet.';
    main.innerHTML = `<h2>Pre-Run Shop</h2><p class="sub">Spend knobs on items you bring into your next run. Earn knobs by opening doors and collecting gold.</p>
      <div class="shop">${SHOP.map(s => {
        const it = G.ITEMS[s.id];
        return `<div class="shop-item"><div class="si-ico">${it.icon}</div><div class="si-txt"><b>${it.name}</b><small>${s.desc}</small></div>
          <button class="btn sm" data-buy="${s.id}" ${G.save.knobs < s.price ? 'disabled' : ''}><span class="knob-ico sm"></span>${s.price}</button></div>`;
      }).join('')}</div><div class="loadout"><b>Next run loadout:</b> ${loadout}</div>`;
    main.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      const s = SHOP.find(x => x.id === b.dataset.buy);
      const total = Object.values(G.save.shop).reduce((a, v) => a + v, 0);
      if (total >= 5) { G.audio.sfx('bad'); return; }
      if (G.save.knobs < s.price) return;
      G.save.knobs -= s.price; G.save.shop[s.id] = (G.save.shop[s.id] || 0) + 1; G.persist(); G.audio.sfx('gold'); U.tab('shop');
    }));
  } else if (t === 'entities') {
    main.innerHTML = `<h2>Entities</h2><p class="sub">Know what is hunting you.</p><div class="bestiary">${BESTIARY.map(([f, n, tip]) =>
      `<div class="beast"><img src="${G.faceURL(f)}" alt=""><b>${n}</b><small>${tip}</small></div>`).join('')}</div>`;
  } else if (t === 'howto') {
    main.innerHTML = `<h2>How to Play</h2>
      <div class="howto">
        <div><kbd>W A S D</kbd> Move</div><div><kbd>Mouse</kbd> Look</div><div><kbd>E</kbd> Interact / open / hide / leave hiding</div>
        <div><kbd>C</kbd> / <kbd>Ctrl</kbd> Crouch (silent)</div><div><kbd>F</kbd> Toggle light</div><div><kbd>1</kbd>–<kbd>6</kbd> / <kbd>Wheel</kbd> Select item</div>
        <div><kbd>LMB</kbd> Use held item</div><div><kbd>Esc</kbd> Pause</div>
      </div>
      <ul class="tips">
        <li>Doors open when you walk into them. Locked doors need a key — search the drawers in that room.</li>
        <li>When the lights flicker, something is coming. Hide in a closet or locker <i>now</i>.</li>
        <li>Hold a Crucifix (select it) and it will save you once from Rush, Ambush, Seek, the Figure and more.</li>
        <li>The Library (door 50) needs a 5-digit code: books hold digits for shapes, the paper on the desk gives the order.</li>
        <li>Door 100: find the Electrical Room key, then set every breaker the panel asks for.</li>
      </ul>`;
  } else if (t === 'settings') {
    main.innerHTML = `<h2>Settings</h2>${U.settingsHTML()}`;
    U.bindSettings(main);
  }
};
U.settingsHTML = () => {
  const s = G.save.settings;
  return `<div class="settings">
    <label>Mouse sensitivity <input type="range" min="0.2" max="3" step="0.05" value="${s.sens}" data-set="sens"><output>${s.sens}</output></label>
    <label>Volume <input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-set="vol"><output>${s.vol}</output></label>
    <label>Field of view <input type="range" min="60" max="100" step="1" value="${s.fov}" data-set="fov"><output>${s.fov}</output></label>
    <label>Render quality <input type="range" min="0.5" max="1" step="0.05" value="${s.quality}" data-set="quality"><output>${s.quality}</output></label>
  </div>`;
};
U.bindSettings = root => root.querySelectorAll('[data-set]').forEach(inp => inp.addEventListener('input', () => {
  G.save.settings[inp.dataset.set] = parseFloat(inp.value); inp.nextElementSibling.textContent = inp.value;
  G.applySettings(); G.persist();
}));
U.showMenu = () => {
  ['hud', 'pause', 'death', 'win', 'modal', 'heartbeat', 'hide-overlay', 'clicklock', 'a90', 'jumpscare'].forEach(id => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  document.body.classList.remove('playing');
  U.tint('halt', false); U.tint('haste', false); U.fade(false, 0);
  U.tab('play');
};

/* ---------- HUD ---------- */
let msgT = 0, capT = 0;
U.startRun = f => {
  $('menu').classList.add('hidden'); $('death').classList.add('hidden'); $('win').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  document.body.classList.add('playing');
  U.hp(100); U.gold(0); U.hotbar(G.game.inv); U.hints(null); U.progress(null); U.giggle(false); U.extra(null);
  U.fade(true, 0); setTimeout(() => U.fade(false, 1.5), 50);
  U.msg(f.name.toUpperCase(), 3, 'title');
};
U.msg = (text, dur = 2, style = '') => {
  const el = $('msg'); el.textContent = text; el.className = 'show ' + style; msgT = dur;
};
U.caption = (text, dur = 2.5) => { const el = $('caption'); el.textContent = text; el.classList.add('show'); capT = dur; };
U.prompt = text => { const el = $('prompt'); if (text) { el.innerHTML = `<kbd>E</kbd> ${esc(text)}`; el.classList.add('show'); } else el.classList.remove('show'); };
U.hp = v => { $('hp-fill').style.width = v + '%'; $('hp').classList.toggle('low', v < 35); };
U.gold = n => { $('gold-n').textContent = n; };
U.roomLabel = t => { const el = $('room-label'); el.textContent = t; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };
U.hotbar = inv => {
  if (!inv) return;
  const el = $('hotbar');
  el.innerHTML = Array.from({ length: 6 }, (_, i) => {
    const it = inv.items[i];
    if (!it) return `<div class="slot"><i>${i + 1}</i></div>`;
    const bar = it.charge !== undefined ? `<div class="charge"><span style="width:${Math.max(0, it.charge)}%"></span></div>` : '';
    const uses = it.uses > 1 ? `<em>${it.uses}</em>` : '';
    return `<div class="slot ${i === inv.sel ? 'sel' : ''} ${it === G.game.light ? 'lit' : ''}" title="${esc(it.name)}"><i>${i + 1}</i><span>${it.icon}</span>${uses}${bar}</div>`;
  }).join('');
  const sel = inv.selected();
  $('hotbar').dataset.name = sel ? sel.name : '';
};
U.timer = on => $('timer').classList.toggle('hidden', !on);
U.timerText = (text, danger) => { const el = $('timer'); el.textContent = text; el.classList.toggle('danger', !!danger); };
U.extra = text => { const el = $('extra'); el.textContent = text || ''; el.classList.toggle('hidden', !text); };
U.timerSet = (t, danger) => { const el = $('timer'); el.textContent = danger ? 'HASTE IS COMING' : G.fmtTime(t); el.classList.toggle('danger', danger || t < 30); };
U.tint = (name, on) => document.body.classList.toggle('tint-' + name, !!on);
U.hurt = () => { const el = $('fx-damage'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
U.flash = col => { const el = $('fx-flash'); el.style.background = col || '#fff'; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
U.fade = (on, dur) => { const el = $('fx-flash'); el.style.transition = `opacity ${dur}s`; el.style.background = '#000'; el.classList.remove('on'); el.style.opacity = on ? 1 : 0; };
U.hideOverlay = (on, kind) => { const el = $('hide-overlay'); el.classList.toggle('hidden', !on); el.dataset.kind = kind || ''; };
U.giggle = (on, p = 0) => { $('giggle-ui').classList.toggle('hidden', !on); $('giggle-ui').querySelector('i').style.width = (p * 100) + '%'; if (on) $('giggle-ui').querySelector('.gig-face').style.backgroundImage = `url(${G.faceURL('giggle')})`; };
U.progress = p => { const el = $('progress'); if (p === null) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.querySelector('i').style.width = (p * 100) + '%'; };
U.hints = pz => {
  const el = $('hints');
  if (!pz) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const found = Object.entries(pz.found).map(([s, d]) => `<span>${s} = ${d}</span>`).join('') || '<em>No books yet</em>';
  el.innerHTML = `<b>LIBRARY HINTS</b><div class="hint-found">${found}</div><small>Read the paper on the desk for the order.</small>`;
};
U.book = (shape, digit) => { U.msg(`${shape}  =  ${digit}`, 2.5, 'book'); };
U.jumpscare = (face, dur = 0.8) => {
  const el = $('jumpscare'); el.querySelector('img').src = G.faceURL(U.faceFor(face));
  el.classList.remove('hidden', 'go'); void el.offsetWidth; el.classList.add('go');
  clearTimeout(U._js); U._js = setTimeout(() => el.classList.add('hidden'), dur * 1000);
};
U.a90 = phase => {
  const el = $('a90'), img = el.querySelector('img');
  if (!phase) { el.classList.add('hidden'); return; }
  img.src = G.faceURL('a90'); el.classList.remove('hidden');
  el.className = phase === 'warn' ? 'warn' : 'stare';
  if (phase === 'warn') { img.style.left = G.rand(5, 75) + '%'; img.style.top = G.rand(5, 70) + '%'; } else { img.style.left = ''; img.style.top = ''; }
};
U.tick = dt => {
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').classList.remove('show'); }
  if (capT > 0) { capT -= dt; if (capT <= 0) $('caption').classList.remove('show'); }
  if (U.hbActive) U.hbTick(dt);
};

/* ---------- pause / death / win ---------- */
U.pause = on => {
  const el = $('pause');
  el.classList.toggle('hidden', !on);
  if (!on) return;
  el.innerHTML = `<div class="panel"><h2>Paused</h2>
    <button class="btn" id="p-resume">Resume</button>
    <details><summary>Settings</summary>${U.settingsHTML()}</details>
    <button class="btn ghost" id="p-quit">Abandon run</button></div>`;
  U.bindSettings(el);
  $('p-resume').onclick = () => G.game.resume();
  $('p-quit').onclick = () => { G.game.quit(); };
};
const typeLines = (el, lines) => {
  el.innerHTML = '';
  let li = 0;
  const next = () => {
    if (li >= lines.length || el.closest('.hidden')) return;
    const p = document.createElement('p'); el.appendChild(p);
    const text = lines[li++]; let i = 0;
    const iv = setInterval(() => { p.textContent = text.slice(0, ++i); if (i >= text.length) { clearInterval(iv); setTimeout(next, 700); } }, 32);
  };
  setTimeout(next, 600);
};
U.death = info => {
  const el = $('death');
  el.classList.remove('hidden');
  el.innerHTML = `<div class="panel death-panel">
    <div class="dd-title">YOU DIED</div>
    <div class="dd-by">to <b>${esc(U.NAMES[info.source] || info.source)}</b></div>
    <div class="guiding" id="guiding"></div>
    <div class="stats"><div><small>Reached</small><b>${esc(info.plate)}</b></div><div><small>Gold</small><b>${info.gold}</b></div><div><small>Knobs</small><b>+${info.knobs}</b></div><div><small>Time</small><b>${G.fmtTime(info.time)}</b></div></div>
    <div class="btns"><button class="btn" id="d-retry">Try again</button><button class="btn ghost" id="d-lobby">Lobby</button></div></div>`;
  typeLines($('guiding'), GUIDE[info.source] || ['You died...', 'Try again. I believe in you.']);
  $('d-retry').onclick = () => G.game.start(info.floor);
  $('d-lobby').onclick = () => { G.game.toLobby(); };
};
const WIN_TEXT = {
  hotel: ['YOU ESCAPED THE HOTEL', 'The courtyard gate slams behind you. The Mines await below.'],
  mines: ['YOU ESCAPED THE MINES', 'The Dam gives way and the water carries Seek into the dark.'],
  backdoor: ['YOU ESCAPED THE BACKDOOR', 'Door 0 opens into the Hotel lobby. Haste will be waiting next time.'],
  rooms: ['YOU REACHED A-1000', 'A thousand rooms behind you. The light at the end is real.'],
  outdoors: ['YOU MADE IT THROUGH THE OUTDOORS', 'The cabin light is warm. The Monument stays in the garden.'],
};
U.WIN_TEXT = WIN_TEXT;
U.win = info => {
  const el = $('win');
  el.classList.remove('hidden');
  const [title, sub] = WIN_TEXT[info.textKey] || WIN_TEXT[info.floor] || ['YOU ESCAPED', ''];
  const next = G.FLOORS[info.floor].next;
  el.innerHTML = `<div class="panel win-panel"><div class="dd-title win">${title}</div><p class="win-sub">${sub}</p>
    <div class="stats"><div><small>Gold</small><b>${info.gold}</b></div><div><small>Knobs</small><b>+${info.knobs}</b></div><div><small>Time</small><b>${G.fmtTime(info.time)}</b></div></div>
    <div class="btns">${next ? `<button class="btn" id="w-next">Continue to ${G.FLOORS[next].name}</button>` : ''}<button class="btn ${next ? 'ghost' : ''}" id="w-lobby">Lobby</button></div></div>`;
  if (next) $('w-next').onclick = () => G.game.start(next);
  $('w-lobby').onclick = () => G.game.toLobby();
};

/* ---------- modals ---------- */
U.modalOpen = false;
const openModal = (html, cls) => {
  U.modalOpen = true; G.releaseLock();
  const box = $('modal-box'); box.className = cls || ''; box.innerHTML = html;
  $('modal').classList.remove('hidden');
  return box;
};
U.closeModal = () => {
  U.modalOpen = false; $('modal').classList.add('hidden'); U.onModalKey = null;
  G.requestLock();
  setTimeout(() => { if (!G.locked && G.game.state === 'play' && !G.game.paused) $('clicklock').classList.remove('hidden'); }, 400);
};
U.padlock = (len, cb) => {
  const vals = Array(len).fill(0);
  const box = openModal(`<h3>PADLOCK</h3><p class="sub">Enter the ${len}-digit code. Type digits or use the arrows.</p>
    <div class="wheels">${vals.map((_, i) => `<div class="wheel"><button data-up="${i}">▲</button><b data-v="${i}">0</b><button data-dn="${i}">▼</button></div>`).join('')}</div>
    <div class="btns"><button class="btn" id="pl-ok">Unlock</button><button class="btn ghost" id="pl-x">Leave</button></div>`, 'padlock');
  let cursor = 0;
  const draw = () => box.querySelectorAll('[data-v]').forEach(b => { b.textContent = vals[b.dataset.v]; b.classList.toggle('cur', +b.dataset.v === cursor); });
  box.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { vals[b.dataset.up] = (vals[b.dataset.up] + 1) % 10; G.audio.sfx('click'); draw(); });
  box.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { vals[b.dataset.dn] = (vals[b.dataset.dn] + 9) % 10; G.audio.sfx('click'); draw(); });
  const submit = () => { const code = vals.join(''); U.closeModal(); cb(code); };
  $('pl-ok').onclick = submit;
  $('pl-x').onclick = () => U.closeModal();
  U.onModalKey = e => {
    if (/^Digit\d$/.test(e.code) || /^Numpad\d$/.test(e.code)) { vals[cursor] = +e.code.slice(-1); cursor = Math.min(len - 1, cursor + 1); G.audio.sfx('click'); draw(); }
    else if (e.code === 'Backspace' || e.code === 'ArrowLeft') { cursor = Math.max(0, cursor - 1); draw(); }
    else if (e.code === 'ArrowRight') { cursor = Math.min(len - 1, cursor + 1); draw(); }
    else if (e.code === 'Enter') submit();
    else if (e.code === 'Escape' || e.code === 'KeyE') U.closeModal();
  };
  draw();
};
U.paper = pz => {
  openModal(`<h3>A torn note</h3><div class="paper-note"><p>The code is written in shapes:</p>
    <div class="order">${pz.order.map(s => `<span><b>${s}</b><small>${pz.found[s] !== undefined ? pz.found[s] : '?'}</small></span>`).join('')}</div>
    <p class="hand">Each book on the shelves holds one shape's number.</p></div>
    <div class="btns"><button class="btn" id="pp-x">Close</button></div>`, 'paper');
  $('pp-x').onclick = () => U.closeModal();
  U.onModalKey = e => { if (['Escape', 'KeyE', 'Enter'].includes(e.code)) U.closeModal(); };
};
U.breaker = cb => {
  const state = Array.from({ length: 10 }, () => G.chance(0.5));
  const steps = G.shuffle([...Array(10).keys()]).map(i => ({ i, on: !state[i] }));
  let k = 0;
  const box = openModal(`<h3>BREAKER BOX</h3><p class="sub">Set each switch the display asks for.</p>
    <div class="breaker-display" id="bk-disp"></div>
    <div class="switches">${state.map((_, i) => `<button class="sw" data-sw="${i}"><small>${i + 1}</small><i></i></button>`).join('')}</div>
    <div class="bk-progress"><i id="bk-prog"></i></div>
    <div class="btns"><button class="btn ghost" id="bk-x">Leave</button></div>`, 'breaker');
  const disp = $('bk-disp');
  const draw = () => {
    box.querySelectorAll('[data-sw]').forEach(b => b.classList.toggle('on', state[b.dataset.sw]));
    $('bk-prog').style.width = (k / 10 * 100) + '%';
    if (k < 10) disp.innerHTML = `<span>SWITCH</span><b>${steps[k].i + 1}</b><em class="${steps[k].on ? 'on' : 'off'}">${steps[k].on ? 'ON' : 'OFF'}</em>`;
  };
  const check = () => {
    while (k < 10 && state[steps[k].i] === steps[k].on && U._bkTouched === steps[k].i) { k++; U._bkTouched = -1; G.audio.sfx('good'); }
    if (k >= 10) { disp.innerHTML = '<b class="done">POWER RESTORED</b>'; setTimeout(() => { U.closeModal(); cb(); }, 700); }
    draw();
  };
  U._bkTouched = -1;
  box.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => {
    const i = +b.dataset.sw; state[i] = !state[i]; G.audio.sfx('click'); G.game.noise(G.player.pos, 7);
    U._bkTouched = i; check();
  });
  $('bk-x').onclick = () => U.closeModal();
  U.onModalKey = e => { if (e.code === 'Escape') U.closeModal(); };
  const glitch = setInterval(() => {
    if ($('modal').classList.contains('hidden')) { clearInterval(glitch); return; }
    if (Math.random() < 0.25) { disp.classList.add('glitch'); setTimeout(() => disp.classList.remove('glitch'), 250); }
  }, 900);
  draw();
};

/* ---------- heartbeat minigame ---------- */
U.hbActive = false;
U.heartbeat = (n, cb) => {
  U.hbActive = true;
  const el = $('heartbeat'); el.classList.remove('hidden');
  U._hb = { n, i: 0, fails: 0, t: 0, cur: -1, win: 1.15, cb, gap: 0.5 };
  U._hbNext();
};
U._hbNext = () => {
  const h = U._hb;
  if (h.i >= h.n) { U._hbEnd(true); return; }
  h.cur = G.chance(0.5) ? 0 : 2; h.t = 0; h.gap = 0.45;
  G.audio.sfx('heartbeat');
  document.querySelectorAll('#heartbeat .hb-key').forEach(k => k.classList.toggle('want', +k.dataset.k === h.cur));
  $('heartbeat').querySelector('.hb-heart').classList.remove('beat'); void $('heartbeat').offsetWidth;
  $('heartbeat').querySelector('.hb-heart').classList.add('beat');
};
U.hbTick = dt => {
  const h = U._hb; if (!h) return;
  if (h.cur < 0) { h.gap -= dt; if (h.gap <= 0) U._hbNext(); return; }
  h.t += dt;
  $('heartbeat').querySelector('.hb-meter i').style.width = (100 - h.t / h.win * 100) + '%';
  if (h.t > h.win) U._hbResult(false);
};
U.hbClick = button => { const h = U._hb; if (!h || h.cur < 0) return; U._hbResult(button === h.cur); };
U._hbResult = ok => {
  const h = U._hb;
  h.i++; h.cur = -1; h.gap = 0.35;
  document.querySelectorAll('#heartbeat .hb-key').forEach(k => k.classList.remove('want'));
  if (ok) G.audio.sfx('click'); else { h.fails++; G.audio.sfx('bad'); }
  if (h.fails >= 2) U._hbEnd(false);
};
U._hbEnd = ok => {
  const h = U._hb; U._hb = null; U.hbActive = false;
  $('heartbeat').classList.add('hidden');
  h.cb(ok);
};
})();
