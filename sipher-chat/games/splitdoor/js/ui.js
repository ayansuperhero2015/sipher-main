'use strict';
// UI: film-framed menu (letterbox bars hold the chrome, the live arena is the picture), HUD, scoreboard, pause, end.
// Type does the work: wide Archivo for names and numerals, IBM Plex Mono for labels and readouts. No card boxes.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = G.esc;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const KEYS = [['Move', 'W A S D'], ['Jump / jetpack', 'SPACE  hold'], ['Sprint', 'SHIFT'], ['Crouch / slide', 'C'], ['Fire / aim', 'LMB / RMB'],
    ['Blue door', 'Q  or  MOUSE 4'], ['Orange door', 'E'], ['Close doors', 'F'], ['Grenade', 'G'], ['Jammer', 'X'], ['Climb ledge', 'W  into it, mid-air'], ['Melee', 'V'], ['Reload', 'R'],
    ['Weapons', '1 2 3 / WHEEL'], ['Scoreboard', 'TAB'], ['Pause', 'ESC']];
  const MAP_CAPTION = {
    hinge: 'Orbital arena at golden hour. Long lanes, a portal spire at the centre, and a long way down off every edge.',
    foundry: 'Night shift at a dead smelter. Tight rooms, two catwalk rings, and a pit that never gives anything back.',
    drydock: 'A ship-repair platform under a grey sky. A sunken basin, a hull on stands with door panels down both sides.',
    mesa: 'A research post in a red canyon. Two mesas, a pavilion roofed in door panels, nowhere to hide from the sun.',
  };
  const body = document.body;
  const frame = (mode) => { body.classList.remove('lb-menu', 'lb-death', 'lb-end'); if (mode) body.classList.add('lb-' + mode); };

  G.ui = {
    tab: 'play', sel: null, cache: {}, wsel: null,
    init() {
      const s = G.save;
      this.sel = { mode: s.lastMode || 'tdm', map: s.lastMap || 'hinge', difficulty: s.difficulty ?? 1, mutators: Object.assign({}, s.mutators || {}) };
      this.hud = $('#hud'); this.menu = $('#menu'); this.pause = $('#pause'); this.end = $('#end');
      this.buildHud();
      this.flashEl = $('#flash'); this.hurtEl = $('#hurt'); this.scopeEl = $('#scope');
      addEventListener('keydown', e => { if (e.code === 'Enter' && G.state === 'menu' && this.tab === 'play' && !this.menu.classList.contains('hidden')) this.deploy(); });
    },
    click() { G.audio.init(); G.audio.play('tick', { vol: 0.7 }); },
    deploy() { G.audio.init(); G.audio.play('go', { vol: 0.6 }); G.startMatch(this.sel); },

    // ================================================================ MENU
    showMenu() {
      this.menu.classList.remove('hidden'); this.hud.classList.add('hidden'); this.pause.classList.add('hidden'); this.end.classList.add('hidden');
      this.scopeEl.classList.add('hidden');
      frame('menu');
      this.renderMenu();
    },
    renderMenu() {
      const s = G.save, need = G.xpNeeded(s.level), S = this.sel;
      const tabs = [['play', 'PLAY'], ['loadout', 'LOADOUT'], ['record', 'RECORD'], ['options', 'OPTIONS']];
      const M = G.MODES[S.mode], map = G.mapById(S.map);
      const muts = Object.keys(S.mutators).filter(k => S.mutators[k]).map(k => G.MUTATORS[k].name.toUpperCase());
      const bottom = this.tab === 'play'
        ? `<div class="setup">${M.short} / ${map.name} / ${M.teams ? '4V4' : 'FFA 8'} / ${G.SKILLS[S.difficulty].name}${muts.length ? ' / ' + muts.join(' / ') : ''}</div>
           <div class="subtitle">${MAP_CAPTION[map.id]}</div>
           <button class="deploy-btn" id="deploy">DEPLOY <span class="k">ENTER</span></button>`
        : `<div class="setup">SPLIT DOOR X</div><div class="subtitle"></div><button class="txt-btn" data-tab="play">BACK TO PLAY</button>`;
      this.menu.innerHTML = `
        <div class="topbar">
          <div class="mark">SPLIT DOOR<sup>X</sup></div>
          <nav class="nav">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${n}</button>`).join('')}</nav>
          <div class="rank"><span class="lbl">LEVEL ${pad(s.level)} &nbsp; ${s.xp} / ${need} XP</span><div class="xpline"><i style="width:${(s.xp / need * 100).toFixed(1)}%"></i></div></div>
        </div>
        <div class="stage">${this['tab_' + this.tab]()}</div>
        <div class="botbar">${bottom}</div>`;
      this.menu.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.click(); this.renderMenu(); });
      const d = $('#deploy'); if (d) d.onclick = () => this.deploy();
      this['bind_' + this.tab] && this['bind_' + this.tab]();
    },

    tab_play() {
      const S = this.sel, keys = Object.keys(G.MODES), mi = G.MAPS.findIndex(m => m.id === S.map), M = G.MODES[S.mode];
      return `<div class="col-l">
          <div class="picker"><span class="lbl">Mode</span>
            ${keys.map((k, i) => `<button class="pick ${S.mode === k ? 'on' : ''}" data-mode="${k}"><span class="ix">${pad(i + 1)}</span><span class="nm">${G.MODES[k].name}</span></button>`).join('')}
            <p class="pick-desc">${M.desc}</p>
          </div>
          <div class="arena"><span class="lbl">Arena</span>
            <div class="row"><button class="arr" data-map="-1">&lsaquo;</button><span class="nm">${G.MAPS[mi].name}</span><button class="arr" data-map="1">&rsaquo;</button><span class="ct">${pad(mi + 1)} / ${pad(G.MAPS.length)}</span></div>
          </div>
        </div>
        <div class="col-r brief"><span class="lbl">Briefing</span>
          <div class="kvrow"><span>PLAYERS</span><b>${M.solo ? 'YOU + 5 TARGETS' : M.teams ? '4 V 4' : '8, NO TEAMS'}</b></div>
          <div class="kvrow"><span>TO WIN</span><b>${M.solo ? 'FINISH 9 STEPS' : M.limit + ' ' + M.unit}</b></div>
          <div class="kvrow"><span>TIME</span><b>${M.solo ? 'UNTIMED' : Math.floor(M.time / 60) + ':00'}</b></div>
          <button class="kvrow" id="diff"><span>BOTS</span><b>${G.SKILLS[S.difficulty].name}</b></button>
          <div class="gap"></div><span class="lbl">Mutators</span>
          ${Object.entries(G.MUTATORS).map(([k, m]) => `<button class="kvrow tog ${S.mutators[k] ? 'on' : ''}" data-mut="${k}" title="${esc(m.desc)}"><b>${m.name.toUpperCase()}</b></button>`).join('')}
        </div>`;
    },
    bind_play() {
      const S = this.sel, m = this.menu;
      m.querySelectorAll('[data-mode]').forEach(e => e.onclick = () => { S.mode = e.dataset.mode; this.click(); this.renderMenu(); });
      m.querySelectorAll('[data-map]').forEach(e => e.onclick = () => {
        const i = (G.MAPS.findIndex(x => x.id === S.map) + +e.dataset.map + G.MAPS.length) % G.MAPS.length;
        S.map = G.MAPS[i].id; this.click(); G.startAttract(S.map); this.renderMenu();
      });
      $('#diff').onclick = () => { S.difficulty = (S.difficulty + 1) % G.SKILLS.length; this.click(); this.renderMenu(); };
      m.querySelectorAll('[data-mut]').forEach(e => e.onclick = () => { const k = e.dataset.mut; S.mutators[k] = !S.mutators[k]; this.click(); this.renderMenu(); });
    },

    tab_loadout() {
      const s = G.save, w = this.wsel || s.primary, W = G.WEAPONS[w];
      const row = (id, on, key) => `<button class="pick ${on ? 'on' : ''}" data-${key}="${id}" data-w="${id}"><span class="ix">${on ? '&#9656;' : ''}</span><span class="nm">${G.WEAPONS[id].name}</span></button>`;
      const dps = Math.round(W.dmg * (W.pellets || 1) * (W.burst || 1) * W.rpm / 60);
      const suit = G.SUITS[s.suit], acc = G.ACCENTS[s.accent];
      return `<div class="col-l wlist">
          <div class="grp"><span class="lbl">Primary</span>${G.PRIMARIES.map(id => row(id, s.primary === id, 'pri')).join('')}</div>
          <div class="grp"><span class="lbl">Secondary</span>${G.SECONDARIES.map(id => row(id, s.secondary === id, 'sec')).join('')}</div>
          <div class="grp" style="margin-bottom:0"><span class="lbl">On the map</span>${['rail', 'rocket'].map(id => `<button class="pick" data-w="${id}"><span class="ix"></span><span class="nm">${G.WEAPONS[id].name}</span></button>`).join('')}</div>
        </div>
        <div class="col-r spec">
          <span class="lbl">${W.kind === 'power' ? 'Pickup' : W.kind}</span>
          <div class="nm">${W.name}</div><p>${W.desc}</p>
          <div class="kvrow"><span>DAMAGE</span><b>${W.dmg}${W.pellets > 1 ? ' x ' + W.pellets : ''}</b></div>
          <div class="kvrow"><span>HEADSHOT</span><b>x ${W.head}</b></div>
          <div class="kvrow"><span>FIRE RATE</span><b>${W.rpm} RPM${W.burst ? ' / BURST ' + W.burst : ''}</b></div>
          <div class="kvrow"><span>MAGAZINE</span><b>${W.mag}</b></div>
          <div class="kvrow"><span>RANGE</span><b>${W.range || '—'} M</b></div>
          <div class="kvrow"><span>SUSTAINED</span><b>${dps} DPS</b></div>
          <div class="gap"></div><span class="lbl">Armor</span>
          <div class="swatches">${G.SUITS.map((x, i) => `<button class="sw ${s.suit === i ? 'on' : ''} ${s.level < x.lv ? 'locked' : ''}" data-suit="${i}" title="${x.n}${s.level < x.lv ? ' (level ' + x.lv + ')' : ''}" style="background:${x.c}"></button>`).join('')}</div>
          <span class="lbl sw-name">${suit.n}</span>
          <div class="gap"></div><span class="lbl">Weapon glow</span>
          <div class="swatches">${G.ACCENTS.map((x, i) => `<button class="sw ${s.accent === i ? 'on' : ''} ${s.level < x.lv ? 'locked' : ''}" data-acc="${i}" title="${x.n}${s.level < x.lv ? ' (level ' + x.lv + ')' : ''}" style="background:${x.c || '#5a5d62'}"></button>`).join('')}</div>
          <span class="lbl sw-name">${acc.n}</span>
        </div>`;
    },
    bind_loadout() {
      const s = G.save, m = this.menu;
      m.querySelectorAll('[data-w]').forEach(e => { e.onmouseenter = () => { if (this.wsel !== e.dataset.w) { this.wsel = e.dataset.w; this.renderMenu(); } }; });
      m.querySelectorAll('[data-pri]').forEach(e => e.onclick = () => { s.primary = e.dataset.pri; this.click(); G.store(); this.renderMenu(); });
      m.querySelectorAll('[data-sec]').forEach(e => e.onclick = () => { s.secondary = e.dataset.sec; this.click(); G.store(); this.renderMenu(); });
      m.querySelectorAll('[data-suit]').forEach(e => e.onclick = () => { const i = +e.dataset.suit; if (s.level < G.SUITS[i].lv) return G.audio.play('denied'); s.suit = i; this.click(); G.store(); this.renderMenu(); });
      m.querySelectorAll('[data-acc]').forEach(e => e.onclick = () => { const i = +e.dataset.acc; if (s.level < G.ACCENTS[i].lv) return G.audio.play('denied'); s.accent = i; this.click(); G.store(); this.renderMenu(); });
    },

    tab_record() {
      const s = G.save, kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
      const big = [['Matches', s.matches], ['Wins', s.wins], ['Eliminations', s.kills], ['K / D', kd], ['Door kills', s.doorKills]];
      const C = s.challenges, D = C._done || {};
      const medals = Object.keys(G.MEDALS).filter(n => s.medals[n]).sort((a, b) => s.medals[b] - s.medals[a]);
      return `<div class="col-l" style="justify-content:space-between">
          <div class="bignums">${big.map(([n, v]) => `<div class="bignum"><b>${v}</b><span class="lbl">${n}</span></div>`).join('')}</div>
          <div class="ledger" style="max-width:640px"><span class="lbl">Challenges</span>
            ${G.CHALLENGES.map(ch => { const v = Math.min(ch.goal, C[ch.id] || 0); return `<div class="kvrow"><span>${ch.name.toUpperCase()} <span style="opacity:.6">— ${ch.desc}</span></span><b><span class="prog"><i style="width:${v / ch.goal * 100}%"></i></span>${D[ch.id] ? 'DONE' : v + ' / ' + ch.goal}</b></div>`; }).join('')}
          </div>
        </div>
        <div class="col-r ledger"><span class="lbl">Medals earned</span>
          ${medals.length ? medals.map(n => `<div class="kvrow"><span>${n}</span><b>${s.medals[n]}</b></div>`).join('') : '<div class="kvrow"><span>NONE YET</span><b>—</b></div>'}
          <div class="gap"></div><span class="lbl">Bests</span>
          <div class="kvrow"><span>LONGEST STREAK</span><b>${s.bestStreak}</b></div>
          <div class="kvrow"><span>HEADSHOT KILLS</span><b>${s.headshots}</b></div>
          <div class="kvrow"><span>MEDALS</span><b>${s.medalsTotal}</b></div>
        </div>`;
    },
    tab_options() {
      return `<div class="col-l" style="justify-content:flex-start;max-width:620px;width:100%">${this.settingsHtml()}</div>
        <div class="col-r keys"><span class="lbl">Controls</span>${KEYS.map(([a, b]) => `<div class="kvrow"><span>${a.toUpperCase()}</span><b>${b}</b></div>`).join('')}
          <div class="gap"></div><span class="lbl">Models &nbsp;/&nbsp; Sketchfab, CC BY 4.0</span>
          ${[['AR-H470, SMG-1311, RL0N-25', 'Frostoise'], ['M13-Gaus', 'irons'], ['Future hand gun', 'bcfbox'], ['Sci-fi Super Shotgun', 'tnnv'], ['Sci-FI Sniper Rifle', 'svacomatija'], ['Low poly Android', 'oscargoldsworthy']].map(([m, a]) => `<div class="kvrow"><span>${m.toUpperCase()}</span><b>${a}</b></div>`).join('')}</div>`;
    },
    settingsHtml() {
      const st = G.settings;
      const sl = (k, n, min, max, step, fmt) => `<div class="opt"><span>${n}</span><input type="range" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${st[k]}"><output>${fmt(st[k])}</output></div>`;
      const tg = (k, n) => `<div class="opt"><span>${n}</span><div class="choices"><button data-tog="${k}" data-v="1" class="${st[k] ? 'on' : ''}">ON</button><button data-tog="${k}" data-v="0" class="${st[k] ? '' : 'on'}">OFF</button></div></div>`;
      const q = `<div class="opt"><span>Graphics</span><div class="choices">${['low', 'medium', 'high'].map(x => `<button data-q="${x}" class="${st.quality === x ? 'on' : ''}">${x.toUpperCase()}</button>`).join('')}</div></div>`;
      return `${sl('sens', 'Mouse sensitivity', 0.2, 3, 0.05, v => (+v).toFixed(2))}${sl('fov', 'Field of view', 80, 120, 1, v => v)}${tg('invertY', 'Invert look')}
        ${sl('vol', 'Master volume', 0, 1, 0.05, v => Math.round(v * 100))}${sl('music', 'Music', 0, 1, 0.05, v => Math.round(v * 100))}${tg('announcer', 'Announcer voice')}
        ${q}${tg('hitNumbers', 'Damage numbers')}`;
    },
    bindSettings(root) {
      const st = G.settings;
      root.querySelectorAll('[data-set]').forEach(e => e.oninput = () => {
        const k = e.dataset.set; st[k] = +e.value; e.nextElementSibling.textContent = k === 'sens' ? (+e.value).toFixed(2) : k === 'fov' ? e.value : Math.round(e.value * 100);
        G.audio.applyVolume(); G.store();
      });
      root.querySelectorAll('[data-tog]').forEach(e => e.onclick = () => { const k = e.dataset.tog; st[k] = e.dataset.v === '1'; G.store(); this.click(); root.querySelectorAll(`[data-tog="${k}"]`).forEach(b => b.classList.toggle('on', b === e)); });
      root.querySelectorAll('[data-q]').forEach(e => e.onclick = () => { st.quality = e.dataset.q; G.store(); G.applyQuality(); this.click(); root.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b === e)); });
    },
    bind_options() { this.bindSettings(this.menu); },

    // ================================================================ HUD
    buildHud() {
      this.hud.innerHTML = `
        <div class="score" id="h-sb"></div><div class="objline lbl" id="h-obj"></div>
        <canvas id="radar" width="300" height="300"></canvas>
        <div class="feed" id="h-feed"></div>
        <div class="xh" id="h-xh"><div class="ln u"></div><div class="ln d"></div><div class="ln l"></div><div class="ln r"></div><div class="dot"></div>
          <div class="pip pa"></div><div class="pip pb"></div><div class="hm" id="h-hm"><i></i><i></i><i></i><i></i></div><div class="jet" id="h-jet"><i></i></div></div>
        <div class="aimname" id="h-aim"></div>
        <div class="dirs" id="h-dirs"></div>
        <div class="vitals">
          <div class="kv"><span class="lbl">Shield</span><b id="h-shv">100</b></div><div class="shieldbar" id="h-sh">${'<i><b></b></i>'.repeat(10)}</div>
          <div class="kv"><span class="lbl">Hull</span><b id="h-hpv">100</b></div><div class="hpbar" id="h-hp"><b></b></div>
          <div class="gren" id="h-gren"></div></div>
        <div class="weap"><div class="reload lbl" id="h-rl"></div><div class="ammo tnum" id="h-ammo"></div><div class="wname lbl" id="h-wn"></div><div class="slots" id="h-slots"></div><div class="doors" id="h-doors"></div></div>
        <div class="stamps" id="h-medals"></div>
        <div class="kc lbl" id="h-kc"></div>
        <div class="announce" id="h-ann"></div>
        <div class="toasts" id="h-toasts"></div>
        <div class="countdown" id="h-cd"></div>
        <div class="banner" id="h-banner"></div>
        <div class="death hidden" id="h-death"></div>
        <div id="h-wps"></div>
        <div class="sboard hidden" id="h-board"></div>
        <div class="keyhint lbl" id="h-hint"></div>
        <div class="card" id="h-card"></div>`;
      const H = this.H = {};
      for (const el of this.hud.querySelectorAll('[id]')) H[el.id.replace('h-', '')] = el;
      this.radar = $('#radar').getContext('2d');
      for (let i = 0; i < 8; i++) H.dirs.appendChild(document.createElement('i'));
      this.dirI = 0;
    },
    showHud() {
      this.menu.classList.add('hidden'); this.hud.classList.remove('hidden'); this.end.classList.add('hidden'); this.pause.classList.add('hidden');
      frame(null);
      this.H.feed.innerHTML = ''; this.H.medals.innerHTML = ''; this.H.toasts.innerHTML = ''; this.H.death.classList.add('hidden');
      for (const k of ['banner', 'ann', 'cd', 'kc']) this.H[k].classList.remove('on');
      this.flashT = 0; this.flashEl.style.opacity = 0; this.hmT = 0;
      this.cache = {};
      const p = G.player;
      this.H.hint.innerHTML = `Q<b>BLUE DOOR</b> E<b>ORANGE DOOR</b> F<b>CLOSE</b>`;
      clearTimeout(this._hintT); this._hintT = setTimeout(() => { if (this.H.hint) this.H.hint.innerHTML = ''; }, 9000);
      this.weaponChanged(); this.feedChanged();
      const MM = G.match.M;
      this.H.card.innerHTML = `<span class="lbl">${MM.name} &nbsp;/&nbsp; ${MM.solo ? 'solo' : MM.teams ? 'you are ' + G.TEAM[0].name : 'everyone for themselves'}</span><div class="disp">${G.match.map.name}</div><span class="lbl">${MM.solo ? 'Follow the steps at the top' : MM.limit + ' ' + MM.unit.toLowerCase() + ' to win'}</span>`;
      const pa = this.H.xh.querySelector('.pa'), pb = this.H.xh.querySelector('.pb');
      pa.style.borderColor = p.portalColors[0]; pb.style.borderColor = p.portalColors[1];
    },
    set(key, el, prop, val) { if (this.cache[key] !== val) { this.cache[key] = val; el[prop] = val; } },
    scoreSide(name, n, frac, color, right) {
      return `<div class="side ${right ? 'r' : ''}"><div class="row"><span class="n tnum">${pad(n)}</span><span class="lbl">${esc(name)}</span></div><div class="line"><i style="width:${Math.min(100, frac * 100)}%;background:${color}"></i></div></div>`;
    },
    update(dt) {
      const p = G.player, H = this.H, M = G.match;
      if (!p) return;
      const lim = M.M.limit;
      let sb;
      if (M.M.teams) {
        const a = Math.floor(M.scores[0]), b = Math.floor(M.scores[1]);
        sb = `${a}|${b}|${Math.ceil(M.timeLeft)}`;
        if (this.cache.sb !== sb) {
          this.cache.sb = sb;
          H.sb.innerHTML = this.scoreSide(G.TEAM[0].name, a, a / lim, G.TEAM[0].color) +
            `<div class="mid"><span class="clock tnum">${this.fmtTime(M.timeLeft)}</span><span class="lbl">${M.M.short} &middot; ${lim}</span></div>` +
            this.scoreSide(G.TEAM[1].name, b, b / lim, G.TEAM[1].color, true);
        }
      } else {
        const sc = a => M.scoreOf(a), L = M.leader(), me = sc(p), top = L === p ? G.actors.filter(x => x !== p).sort((x, y) => sc(y) - sc(x))[0] : L;
        sb = `${me}|${top ? sc(top) : 0}|${Math.ceil(M.timeLeft)}|${top && top.name}|${M.rangeStep}`;
        if (this.cache.sb !== sb) {
          this.cache.sb = sb;
          const place = G.actors.slice().sort((x, y) => sc(y) - sc(x)).indexOf(p) + 1;
          if (M.mode === 'range') H.sb.innerHTML = `<div></div><div class="mid"><span class="clock">RANGE</span><span class="lbl">${Math.min(M.rangeStep, G.RANGE_STEPS.length)} of ${G.RANGE_STEPS.length} done</span></div><div></div>`;
          else H.sb.innerHTML = this.scoreSide('YOU  #' + place, me, me / lim, '#ece8e1') +
            `<div class="mid"><span class="clock tnum">${this.fmtTime(M.timeLeft)}</span><span class="lbl">${M.M.short} &middot; ${lim}</span></div>` +
            this.scoreSide(top ? top.name : '', top ? sc(top) : 0, (top ? sc(top) : 0) / lim, top ? top.accent : '#fff', true);
        }
      }
      let obj = '';
      if (M.mode === 'hill' && M.hill) obj = `${M.hillOwner === -2 ? 'Zone contested' : M.hillOwner === 0 ? 'Zone held' : M.hillOwner === 1 ? 'Enemy holds zone' : 'Zone open'} &nbsp;/&nbsp; moves in ${Math.ceil(M.hillT)}`;
      if (M.mode === 'key' && M.key) obj = M.key.carrier ? (M.key.carrier === p ? 'You have the key &nbsp;/&nbsp; melee only' : M.key.carrier.team === p.team && M.M.teams ? 'Ally has the key' : 'Enemy has the key') : 'Key is free';
      if (M.mode === 'range') obj = M.rangeText;
      if (M.mode === 'lock') obj = `Gun ${Math.min(7, (p.gunTier || 0) + 1)} of 7 &nbsp;/&nbsp; ${p.W().name}`;
      this.set('obj', H.obj, 'innerHTML', obj);
      // vitals
      const shs = H.sh.children, over = p.over > 0, shVal = over ? p.over : p.shield;
      const shKey = Math.round(shVal) + (over ? 'o' : '');
      if (this.cache.sh !== shKey) {
        this.cache.sh = shKey; H.sh.classList.toggle('over', over); H.shv.textContent = (over ? '+' : '') + Math.round(shVal);
        for (let i = 0; i < 10; i++) shs[i].firstChild.style.transform = `scaleX(${G.clamp((shVal - i * 10) / 10, 0, 1)})`;
      }
      const hpk = Math.max(0, Math.round(p.hp));
      if (this.cache.hp !== hpk) { this.cache.hp = hpk; H.hpv.textContent = hpk; H.hp.firstChild.style.width = hpk + '%'; H.hp.classList.toggle('low', p.hp < 35); }
      this.set('gren', H.gren, 'innerHTML', `<span class="lbl">Frag</span><i class="${p.grenades > 0 ? 'on' : ''}"></i><i class="${p.grenades > 1 ? 'on' : ''}"></i><span class="lbl" style="margin-left:14px">Jam</span><i class="jam ${p.jammers > 0 ? 'on' : ''}"></i>`);
      // weapon
      const W = p.W(), mag = p.mags[p.cur], res = p.reserve[p.cur];
      this.set('ammo', H.ammo, 'innerHTML', p.hasKey ? 'KEY' : `${pad(mag)}<small>/ ${res < 0 ? '&infin;' : res}</small>`);
      H.ammo.classList.toggle('low', !p.hasKey && mag <= Math.ceil(W.mag * 0.25));
      this.set('rl', H.rl, 'textContent', p.reloadT > 0 ? 'Reloading' : mag === 0 ? 'Reload' : '');
      const dk = `${p.portals[0].placed}|${p.portals[1].placed}`;
      if (this.cache.doors !== dk) {
        this.cache.doors = dk;
        H.doors.innerHTML = `<span class="lbl" style="margin-right:4px">Doors</span>` + [0, 1].map(i => `<i style="border-color:${p.portalColors[i]};${p.portals[i].placed ? 'background:' + p.portalColors[i] : ''}"></i>`).join('');
      }
      // crosshair
      const xh = H.xh, scoped = p.cur === 'rail' && p.ads > 0.85 && p.alive;
      const spreadPx = Math.max(4, Math.tan(THREE.MathUtils.degToRad(p.currentSpread())) / Math.tan(THREE.MathUtils.degToRad(G.cam.fov / 2)) * innerHeight / 2);
      const g = Math.round(spreadPx + 3), xk = g + '|' + scoped + '|' + p.alive;
      if (this.cache.xh !== xk) {
        this.cache.xh = xk;
        const L = xh.children;
        L[0].style.top = (-g - 8) + 'px'; L[1].style.top = g + 'px'; L[2].style.left = (-g - 8) + 'px'; L[3].style.left = g + 'px';
        xh.style.display = scoped || !p.alive ? 'none' : 'block';
      }
      xh.classList.toggle('portalable', !!p.aimPortalable);
      xh.children[5].classList.toggle('fill', p.portals[0].placed); xh.children[6].classList.toggle('fill', p.portals[1].placed);
      this.scopeEl.classList.toggle('hidden', !scoped);
      H.jet.style.opacity = p.jetFuel < 0.999 ? 1 : 0; H.jet.firstChild.style.height = (p.jetFuel * 100) + '%'; H.jet.classList.toggle('low', p.jetFuel < 0.25);
      this.set('aim', H.aim, 'textContent', p.aimTarget && G.match.enemies(p, p.aimTarget) ? p.aimTarget.name.toUpperCase() : '');
      if (this.hmT > 0) { this.hmT -= dt; H.hm.style.opacity = Math.max(0, this.hmT / 0.25); }
      if (this.flashT > 0) { this.flashT -= dt; this.flashEl.style.opacity = Math.max(0, this.flashT) * this.flashA; }
      this.hurtEl.style.opacity = p.alive ? G.clamp((1 - p.hp / p.maxHp) * 0.9 + (this.hurtT > 0 ? this.hurtT : 0), 0, 0.85) * (p.shield > 0 ? 0.4 : 1) : 0;
      if (this.hurtT > 0) this.hurtT -= dt;
      for (const d of H.dirs.children) { if (d._t > 0) { d._t -= dt; d.style.opacity = Math.min(1, d._t); if (d._pos) d.style.transform = `rotate(${this.dirAngle(d._pos)}deg)`; } }
      if (M.feed.length && G.t - M.feed[M.feed.length - 1].t > 7) { M.feed.pop(); this.feedChanged(); }
      // death: the picture letterboxes and drains of colour (see G.render), name sits in the frame
      const dead = !p.alive && M.state !== 'ended';
      if (dead) {
        const k = p.lastKiller, rt = Math.max(0, Math.ceil(p.respawnT)), key = (k ? k.name : 'x') + rt;
        if (this.cache.death !== key) {
          this.cache.death = key;
          const kc = k ? (M.M.teams ? G.TEAM[k.team].color : k.accent) : '#ece8e1';
          H.death.innerHTML = `<div class="lbl">Eliminated by</div><div class="n" style="color:${kc}">${k ? esc(k.name.toUpperCase()) : 'THE VOID'}</div><div class="lbl">${this.deathWeapon || ''}${k && k.alive ? ' &nbsp;/&nbsp; ' + Math.ceil(k.hp + k.shield + k.over) + ' left' : ''}</div><div class="r lbl">Redeploy in ${rt}</div>`;
        }
        H.death.classList.remove('hidden');
      } else H.death.classList.add('hidden');
      const fr = M.state === 'ended' ? 'end' : dead || M.state === 'countdown' ? 'death' : null;
      if (this.cache.frame !== fr) { this.cache.frame = fr; frame(fr); this.hud.classList.toggle('dead', fr === 'death'); }
      H.card.classList.toggle('on', M.state === 'countdown');
      const showBoard = G.down('score') || M.state === 'ended';
      H.board.classList.toggle('hidden', !showBoard || M.endShown);
      if (showBoard) { this._boardT = (this._boardT || 0) - dt; if (this._boardT <= 0) { this._boardT = 0.25; H.board.innerHTML = this.boardHtml(); } }
      this.radarDraw();
      this.waypoints();
      this.enemyMarkers(dt);
    },
    fmtTime(t) { t = Math.max(0, Math.ceil(t)); return pad(Math.floor(t / 60)) + ':' + pad(t % 60); },
    dirAngle(pos) { const p = G.player; const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z; const a = Math.atan2(-dx, -dz) - p.yaw; return -a * 180 / Math.PI; },
    boardHtml() {
      const M = G.match, obj = M.mode === 'hill' || M.mode === 'key';
      const rows = list => list.map(a => `<tr class="${a.isPlayer ? 'me' : ''} ${a.alive ? '' : 'dead'}"><td>${esc(a.name)}</td><td>${a.stats.score}</td><td>${a.stats.kills}</td><td>${a.stats.deaths}</td><td>${a.stats.assists}</td>${obj ? `<td>${Math.floor(a.stats.obj)}</td>` : ''}</tr>`).join('');
      const head = `<tr><th>PLAYER</th><th>SCORE</th><th>K</th><th>D</th><th>A</th>${obj ? '<th>OBJ</th>' : ''}</tr>`;
      const sort = l => l.sort((a, b) => b.stats.score - a.stats.score);
      const top = `<div class="board-head"><span class="disp">${M.M.name}</span><span class="lbl">${G.mapById(M.map.id).name} &nbsp;/&nbsp; ${this.fmtTime(M.timeLeft)}</span></div>`;
      if (M.M.teams) {
        const t = [0, 1].map(i => sort(G.actors.filter(a => a.team === i)));
        return `<div class="board">${top}<div class="board-cols">${[0, 1].map(i => `<div><div class="team-h"><span class="disp" style="color:${G.TEAM[i].color}">${G.TEAM[i].name}</span><span class="n tnum">${pad(Math.floor(M.scores[i]))}</span></div><table class="sb">${head}${rows(t[i])}</table></div>`).join('')}</div></div>`;
      }
      return `<div class="board">${top}<div class="board-cols one"><table class="sb">${head}${rows(sort(G.actors.slice()))}</table></div></div>`;
    },
    radarDraw() {
      const c = this.radar, p = G.player, R = 150, S = 300, scale = R / 42;
      c.clearRect(0, 0, S, S);
      c.save(); c.translate(R, R);
      c.beginPath(); c.arc(0, 0, R - 2, 0, 7); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill(); c.clip();
      c.strokeStyle = 'rgba(236,232,225,0.14)'; c.lineWidth = 1.5;
      for (const r of [R * 0.5, R - 3]) { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); }
      c.beginPath(); c.moveTo(0, -R); c.lineTo(0, R); c.moveTo(-R, 0); c.lineTo(R, 0); c.strokeStyle = 'rgba(236,232,225,0.06)'; c.stroke();
      const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
      const tx = (x, z) => { const dx = x - p.pos.x, dz = z - p.pos.z; return [(dx * cos - dz * sin) * scale, (dx * sin + dz * cos) * scale]; };
      for (const d of G.portals.list) {
        if (!d.placed) continue;
        const [x, y] = tx(d.center.x, d.center.z);
        c.strokeStyle = d.colorHex; c.globalAlpha = d.owner === p ? 1 : 0.4; c.lineWidth = 3;
        c.beginPath(); c.ellipse(x, y, 4, 6, 0, 0, 7); c.stroke();
      }
      c.globalAlpha = 1;
      const M = G.match;
      if (M.mode === 'hill' && M.hill) { const [x, y] = tx(M.hill.x, M.hill.z); c.strokeStyle = '#ece8e1'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.arc(x, y, M.hill.r * scale, 0, 7); c.stroke(); c.setLineDash([]); }
      if (M.mode === 'key' && M.key) { const [x, y] = tx(M.key.pos.x, M.key.pos.z); c.fillStyle = '#e8c46a'; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 8, y); c.lineTo(x, y + 8); c.lineTo(x - 8, y); c.fill(); }
      for (const a of G.actors) {
        if (a === p || !a.alive) continue;
        const enemy = M.enemies(p, a);
        if (enemy && !(a.lastShotT && G.t - a.lastShotT < 1.6) && !a.hasKey) continue;
        const [x, y] = tx(a.pos.x, a.pos.z);
        c.fillStyle = enemy ? G.TEAM[1].color : G.TEAM[0].color;
        c.beginPath(); c.arc(x, y, enemy ? 5 : 4, 0, 7); c.fill();
      }
      c.restore();
      c.fillStyle = '#ece8e1'; c.beginPath(); c.moveTo(R, R - 9); c.lineTo(R + 6, R + 7); c.lineTo(R, R + 3); c.lineTo(R - 6, R + 7); c.fill();
    },
    waypoints() {
      const M = G.match, host = this.H.wps, pts = [];
      if (M.mode === 'hill' && M.hill) pts.push({ p: new THREE.Vector3(M.hill.x, M.hill.y + 1.5, M.hill.z), c: M.hillOwner === 0 ? G.TEAM[0].color : M.hillOwner === 1 ? G.TEAM[1].color : M.hillOwner === -2 ? '#e8c46a' : '#ece8e1', t: 'ZONE' });
      if (M.mode === 'key' && M.key && M.key.carrier !== G.player) pts.push({ p: M.key.pos.clone().setY(M.key.pos.y + 0.5), c: '#e8c46a', t: 'KEY' });
      while (host.children.length < pts.length) { const d = document.createElement('div'); d.className = 'wp'; d.innerHTML = '<div class="ic"></div><span></span>'; host.appendChild(d); }
      for (let i = 0; i < host.children.length; i++) {
        const el = host.children[i], w = pts[i];
        if (!w) { el.style.display = 'none'; continue; }
        const v = w.p.clone().project(G.cam);
        let x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
        if (v.z > 1) { x = innerWidth - x; y = innerHeight - 40; }
        x = G.clamp(x, 40, innerWidth - 40); y = G.clamp(y, 60, innerHeight - 60);
        el.style.display = 'flex'; el.style.color = w.c; el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        el.lastChild.textContent = w.t + '  ' + Math.round(w.p.distanceTo(G.player.pos)) + 'M';
      }
    },
    enemyMarkers(dt) {
      this._mkT = (this._mkT || 0) - dt;
      const recheck = this._mkT <= 0; if (recheck) this._mkT = 0.12;
      const p = G.player, cam = G.cam.position;
      for (const a of G.actors) {
        if (!a.marker) continue;
        if (!a.alive || !p.alive || !G.match.enemies(p, a)) { a.marker.visible = false; continue; }
        if (recheck) { const head = a.eye(); head.y += 0.4; a._vis = head.distanceTo(cam) < 70 && G.world.los(cam, head); }
        a.marker.visible = !!a._vis;
        if (a._vis) a.marker.position.set(a.pos.x, a.pos.y + a.height() + 0.55, a.pos.z);
      }
    },

    // ---------------------------------------------------------------- events
    weaponChanged() {
      const p = G.player; if (!p || !this.H) return;
      this.H.wn.textContent = p.W().name;
      this.H.slots.innerHTML = p.slots.map((s, i) => `<span class="${s && s === p.cur ? 'cur' : ''}">${i + 1} ${s ? G.WEAPON_LABEL[s] : '—'}</span>`).join('');
      this.cache.ammo = null;
    },
    feedChanged() {
      if (!this.H) return;
      this.H.feed.innerHTML = G.match.feed.map(f => `<div>${f.k ? `<span class="${f.me && f.k === 'YOU' ? 'me' : ''}" style="color:${f.kc}">${esc(f.k)}</span>` : ''}<span class="w">${f.w}${f.head ? ' / HS' : ''}</span>${f.door ? `<span class="tag" style="color:${G.PLAYER_DOORS[1]}">DOOR</span>` : ''}<span class="${f.me && f.v === 'YOU' ? 'me' : ''}" style="color:${f.vc}">${esc(f.v)}</span></div>`).join('');
    },
    hitmarker(head, kill) { this.hmT = kill ? 0.45 : 0.25; this.H.hm.className = 'hm' + (head ? ' head' : '') + (kill ? ' kill' : ''); this.H.hm.style.opacity = 1; },
    flash(color, a) { this.flashEl.style.background = color; this.flashA = a * 1.6; this.flashT = 0.4; },
    hurt() { this.hurtT = 0.35; },
    damageFrom(pos) { const d = this.H.dirs.children[this.dirI++ % 8]; d._t = 1.4; d._pos = pos.clone(); },
    toast(text, color) {
      const el = document.createElement('div'); el.className = 'toast'; el.style.color = color || '#ece8e1'; el.textContent = text;
      this.H.toasts.appendChild(el); setTimeout(() => el.remove(), 2850);
      while (this.H.toasts.children.length > 3) this.H.toasts.firstChild.remove();
    },
    killConfirm(victim, medals, info) {
      const kc = this.H.kc;
      kc.innerHTML = `Eliminated &nbsp;<b>${esc(victim.name.toUpperCase())}</b>&nbsp; +${100 + medals.reduce((s, m) => s + G.MEDALS[m][0], 0)}`;
      kc.classList.add('on'); clearTimeout(this._kcT); this._kcT = setTimeout(() => kc.classList.remove('on'), 1800);
      this.hitmarker(info.head, true);
      medals.forEach((m, i) => setTimeout(() => this.medal(m), i * 240));
      const big = medals.find(m => ['DOUBLE SLAM', 'TRIPLE SLAM', 'QUAD SLAM', 'SLAMTASTIC', 'DOOR BREAKER', 'UNHINGED', 'DOORMINATOR', 'UNSTOPPABLE'].includes(m));
      if (big) this.announce(big);
    },
    medal(name) {
      const m = G.MEDALS[name], host = this.H.medals;
      const el = document.createElement('div'); el.className = 'stamp';
      el.innerHTML = `<b>${name}</b><span>+${m[0]}</span>`;
      host.appendChild(el); G.audio.play('medal', { vol: 0.4 });
      while (host.children.length > 4) host.firstChild.remove();
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 2600);
    },
    announce(text) { const a = this.H.ann; a.textContent = text; a.classList.remove('on'); void a.offsetWidth; a.classList.add('on'); },
    countdown(c) { const e = this.H.cd; e.textContent = c; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); },
    banner(text, color) { const e = this.H.banner; e.textContent = text; e.style.color = color; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); frame('end'); },
    onPlayerDeath(attacker, info) {
      this.deathWeapon = (G.WEAPON_LABEL[info.weapon] || '') + (info.head ? ' &nbsp;/&nbsp; headshot' : '') + (info.via ? ' &nbsp;/&nbsp; through a door' : '');
      this.cache.death = null; this.scopeEl.classList.add('hidden');
    },
    onPlayerSpawn() { this.cache = {}; this.weaponChanged(); },

    // ================================================================ PAUSE / END
    showPause(on) {
      this.pause.classList.toggle('hidden', !on);
      if (!on) return;
      this.pause.innerHTML = `<div class="pbox"><h2>PAUSED</h2>${this.settingsHtml()}<div class="acts"><button class="deploy-btn" id="p-res">RESUME <span class="k">CLICK</span></button><button class="txt-btn" id="p-quit">LEAVE MATCH</button></div></div>`;
      this.bindSettings(this.pause);
      $('#p-res').onclick = () => G.setPaused(false);
      $('#p-quit').onclick = () => { G.setPaused(false, true); G.toMenu(); };
    },
    showEnd() {
      G.unlock();
      frame('end');
      const M = G.match, p = G.player, won = M.playerWon(), s = G.save;
      const lines = [['Eliminations', p.stats.kills * 100], ['Medals', M.medalsEarned.reduce((a, m) => a + G.MEDALS[m][0], 0)], ['Assists', p.stats.assists * 50], ['Objective', Math.floor(p.stats.obj) * 2], ['Match complete', 250]];
      if (won) lines.push(['Victory', 500]);
      for (const ch of M.challengesDone || []) lines.push(['Challenge  ' + ch.name, ch.xp]);
      const counts = {}; for (const m of M.medalsEarned) counts[m] = (counts[m] || 0) + 1;
      const leveled = s.level > M.levelBefore;
      const sc = M.M.teams ? `${pad(Math.floor(M.scores[0]))} — ${pad(Math.floor(M.scores[1]))}` : `PLACED ${G.actors.slice().sort((a, b) => M.scoreOf(b) - M.scoreOf(a)).indexOf(p) + 1} OF ${G.actors.length}`;
      const mvp = G.actors.slice().sort((a, b) => b.stats.score - a.stats.score)[0];
      const acc = p.stats.shots ? Math.round(p.stats.hits / p.stats.shots * 100) : 0;
      this.end.innerHTML = `<div class="ebox">
        <div class="res"><h2>${won ? 'VICTORY' : 'DEFEAT'}</h2><span class="lbl">${M.M.name} &nbsp;/&nbsp; ${M.map.name} &nbsp;/&nbsp; ${sc} &nbsp;/&nbsp; MVP ${esc(mvp.name.toUpperCase())}</span></div>
        <div class="ecols"><div>${this.boardHtml()}
          <div class="gap"></div>
          <div class="bignums">${[['Kills', p.stats.kills], ['Deaths', p.stats.deaths], ['Streak', p.stats.best], ['Accuracy', acc + '%'], ['Door trips', p.stats.doors]].map(([n, v]) => `<div class="bignum"><b>${v}</b><span class="lbl">${n}</span></div>`).join('')}</div></div>
          <div class="ledger"><span class="lbl">Experience</span>${lines.map(([n, v]) => `<div class="kvrow"><span>${esc(n.toUpperCase())}</span><b>+${v}</b></div>`).join('')}
            <div class="xpbig"><div class="row"><span class="disp">LEVEL ${pad(s.level)}</span>${leveled ? '<span class="lbl lvup">Level up</span>' : ''}<span class="lbl">${s.xp} / ${G.xpNeeded(s.level)}</span></div><div class="bar2"><i id="e-xp"></i></div></div>
            <div class="gap"></div><span class="lbl">Medals</span>
            ${Object.keys(counts).length ? Object.entries(counts).map(([n, c]) => `<div class="kvrow"><span>${n}</span><b>x ${c}</b></div>`).join('') : '<div class="kvrow"><span>NONE THIS MATCH</span><b>—</b></div>'}
          </div></div>
        <div class="eacts"><button class="deploy-btn" id="e-again">PLAY AGAIN <span class="k">SAME SETUP</span></button><button class="txt-btn" id="e-menu">MAIN MENU</button></div></div>`;
      this.end.classList.remove('hidden'); this.hud.classList.add('hidden');
      requestAnimationFrame(() => { const x = $('#e-xp'); if (x) x.style.width = (s.xp / G.xpNeeded(s.level) * 100) + '%'; });
      $('#e-again').onclick = () => G.startMatch(this.sel);
      $('#e-menu').onclick = () => G.toMenu();
      if (leveled) G.audio.say('level up');
    },
  };
})();
