'use strict';
// Match flow: modes, spawning, pickups, objectives (Doorstop hill, Skeleton Key), kills, medals, XP and challenges.
G.MODES = {
  tdm: { name: 'TEAM SLAYER', short: 'SLAYER', teams: true, limit: 40, time: 420, unit: 'KILLS', desc: 'Four on four. First team to 40 eliminations.' },
  ffa: { name: 'FREE FOR ALL', short: 'FFA', teams: false, limit: 20, time: 420, unit: 'KILLS', desc: 'Eight runners, no friends. First to 20.' },
  hill: { name: 'DOORSTOP', short: 'HILL', teams: true, limit: 150, time: 480, unit: 'POINTS', desc: 'Hold the zone. It moves every 50 seconds.' },
  key: { name: 'SKELETON KEY', short: 'KEY', teams: true, limit: 120, time: 480, unit: 'POINTS', desc: 'Grab the key and keep it alive. The carrier swings for one-hit kills.' },
};
G.MODES.lock = { name: 'LOCKPICK', short: 'LOCK', teams: false, limit: 7, time: 480, unit: 'GUNS', desc: 'Every kill hands you the next gun. Seven guns, ending on the rail. A melee kill knocks your victim back one.' };
G.MODES.range = { name: 'TRAINING RANGE', short: 'RANGE', teams: false, limit: 9999, time: 5999, unit: '', solo: true, desc: 'No one shoots back. Nine short steps teach doors, movement and the Jammer.' };
G.LOCK_ORDER = ['smg', 'ar', 'br', 'scatter', 'sidearm', 'rocket', 'rail'];
G.RANGE_STEPS = [
  ['Aim at a glowing hex wall and press Q', p => p.portals[0].placed],
  ['Press E on a second hex wall to link the pair', p => p.portals[0].placed && p.portals[1].placed],
  ['Walk through a door', p => p.stats.doors >= 1],
  ['Hold SPACE in the air to jetpack', p => p.jetFuel < 0.55],
  ['Sprint with SHIFT, then press C to slide', p => p.sliding > 0],
  ['Jump at a ledge and hold W to climb it', p => G.t - (p._mantleT || -9) < 0.5],
  ['Shoot a target', p => p.stats.kills >= 1],
  ['Shoot a target through a door', p => p.stats.doorKills >= 1],
  ['Press X to throw a Jammer: it shuts enemy doors and breaks shields', p => !!p.usedJammer],
];
G.MUTATORS = {
  lowgrav: { name: 'Low Gravity', desc: 'Floatier jumps, longer flights through doors.' },
  railsonly: { name: 'Rails Only', desc: 'Everyone spawns with a rail. One hit, one kill.' },
  infjet: { name: 'Endless Jetpack', desc: 'Fuel never runs out.' },
};
G.MEDALS = {
  'FIRST BLOOD': [100, '#e5323c', '1ST'], 'HEADSHOT': [50, '#ffcc33', 'HS'], 'THROUGH THE DOOR': [150, '#3c8cff', 'DR'],
  'DOOR HOP': [75, '#ff8a1a', 'HOP'], 'SKY SLAM': [50, '#5fd2ff', 'AIR'], 'KNOCK KNOCK': [100, '#d9dce2', 'KO'],
  'BACKDOOR': [150, '#a26bff', 'BK'], 'PEEPHOLE': [75, '#c070ff', 'FAR'], 'DOOR SHUT': [100, '#f04a32', 'END'],
  'PAYBACK': [75, '#e8357a', 'REV'], 'CLOSE CALL': [75, '#ff4a4a', '!!'], 'BOOM': [50, '#ff6a1a', 'BOOM'],
  'SHOWN THE DOOR': [100, '#9aa3ad', 'OUT'], 'KEYMASTER': [100, '#ffd23f', 'KEY'], 'BOUNCER': [75, '#4dff9a', 'ZN'],
  'DOUBLE SLAM': [100, '#3ee07a', 'x2'], 'TRIPLE SLAM': [150, '#34c8ff', 'x3'], 'QUAD SLAM': [250, '#b45cff', 'x4'], 'SLAMTASTIC': [400, '#ffc21a', 'x5'],
  'DOOR BREAKER': [250, '#ff8a1a', '5'], 'UNHINGED': [400, '#ff3b3b', '10'], 'DOORMINATOR': [600, '#b45cff', '15'], 'UNSTOPPABLE': [900, '#ffd23f', '20'],
};
G.CHALLENGES = [
  { id: 'doorKills', name: 'Through the Door', desc: 'Get 10 kills through a door', goal: 10, xp: 1500 },
  { id: 'headshots', name: 'Headhunter', desc: 'Land 25 headshot kills', goal: 25, xp: 1200 },
  { id: 'doors', name: 'Frequent Flyer', desc: 'Travel through doors 100 times', goal: 100, xp: 1000 },
  { id: 'melee', name: 'Knock Knock', desc: 'Get 10 melee kills', goal: 10, xp: 1000 },
  { id: 'boom', name: 'Demolition', desc: 'Get 10 explosive kills', goal: 10, xp: 1000 },
  { id: 'obj', name: 'Doorstop', desc: 'Score 300 objective points', goal: 300, xp: 1200 },
  { id: 'wins', name: 'Winner Winner', desc: 'Win 5 matches', goal: 5, xp: 2000 },
  { id: 'medals', name: 'Decorated', desc: 'Earn 75 medals', goal: 75, xp: 1500 },
];
G.WEAPON_LABEL = { ar: 'PULSE AR', br: 'LATCH BR', smg: 'SWINGER', sidearm: 'KNOB-9', scatter: 'SCATTER', rail: 'RAIL', rocket: 'DOORBUSTER', grenade: 'FRAG', melee: 'MELEE', void: 'VOID' };
G.xpNeeded = lv => 1000 + (lv - 1) * 250;

G.match = {
  mode: 'tdm', M: null, mut: {}, state: 'none', frozen: false, scores: [0, 0], timeLeft: 0, countdown: 0,
  feed: [], pickups: [], attract: false, firstBlood: false, xpEarned: 0, medalsEarned: [], hillI: 0, hillT: 0,

  start(o) {
    this.clear();
    const map = G.mapById(o.map);
    this.mode = o.mode; this.M = G.MODES[o.mode]; this.mut = Object.assign({}, o.mutators || {}); this.attract = !!o.attract;
    if (this.mut.railsonly) this.mut.instagib = true;
    this.map = map; this.difficulty = o.difficulty ?? 1;
    G.world.build(map);
    G.audio.startMusic(map.music);
    const skill = G.SKILLS[this.difficulty];
    const names = G.shuffle(G.BOT_NAMES.slice());
    let ni = 0;
    const teams = this.M.teams;
    const range = o.mode === 'range';
    // a party match (js/party.js) brings its own line-up: friends, and the leader's bots
    if (o.roster && G.netActors) G.netActors(o.roster, skill);
    else {
    if (!this.attract) {
      const suit = G.SUITS[G.save.suit % G.SUITS.length].c;
      const p = new G.Player({ team: 0, name: 'YOU', suit, accent: teams ? G.TEAM[0].color : '#3fb8ff', doors: G.PLAYER_DOORS });
      G.player = p; G.actors.push(p);
      G.vm.build(p);
      p.model.visible = false;
    } else G.player = null;
    const counts = range ? [5] : this.attract ? (teams ? [3, 3] : [6]) : teams ? [3, 4] : [7];
    this.rangeStep = 0; this.rangeText = '';
    if (teams) {
      for (let t = 0; t < 2; t++) for (let i = 0; i < counts[t]; i++) {
        const T = G.TEAM[t];
        G.actors.push(new G.Bot({ team: t, name: names[ni++ % names.length], suit: T.suit, accent: T.color, doors: T.doors, skill, tag: !this.attract && t === 0, tagColor: T.color }));
      }
    } else {
      for (let i = 0; i < counts[0]; i++) {
        const c = G.FFA_COLORS[i % G.FFA_COLORS.length];
        G.actors.push(new G.Bot({ team: 10 + i, name: names[ni++ % names.length], suit: G.pick(['#d9dce2', '#3a3f48', '#8a8f98']), accent: c, doors: [c, G.hex(G.col(c).lerp(G.col('#ffffff'), 0.45))], skill, dummy: range }));
      }
      if (G.player) G.player.team = 99;
    }
    }
    this.scores = teams ? [0, 0] : [];
    this.timeLeft = this.M.time; this.firstBlood = false; this.feed = []; this.xpEarned = 0; this.medalsEarned = [];
    this.startStats = G.player ? null : null;
    // pickups
    this.pickups = map.pickups.map((pd, i) => {
      const m = G.models.pickup(pd.type); m.position.set(...pd.pos); G.scene.add(m);
      const power = pd.type === 'rail' || pd.type === 'rocket';
      return { type: pd.type, pos: new THREE.Vector3(...pd.pos), mesh: m, active: !power, timer: power ? 20 : 0, respawn: power ? 45 : pd.type === 'overshield' ? 50 : 20, power };
    });
    // objectives
    this.hillI = 0; this.hillT = 50; this.hillMesh = null; this.key = null;
    if (o.mode === 'hill') this.buildHill();
    if (o.mode === 'key') this.buildKey();
    // spawn everyone
    for (const a of G.actors) a.respawn(this.pickSpawn(a));
    this.state = 'countdown'; this.countdown = this.attract ? 0 : 3.2; this.frozen = !this.attract; this._lastBeep = 4;
    if (this.attract) { this.state = 'playing'; this.frozen = false; }
    G.portals.refreshNav();
  },
  clear() {
    for (const a of G.actors) { G.scene.remove(a.model); if (a.tag) G.scene.remove(a.tag); if (a.marker) G.scene.remove(a.marker); }
    G.actors = []; G.player = null;
    G.portals.destroyAll();
    G.weapons.clear();
    G.fx.clear && G.fx.clear();
    for (const p of this.pickups) G.scene.remove(p.mesh);
    this.pickups = [];
    if (this.hillMesh) G.scene.remove(this.hillMesh); this.hillMesh = null;
    if (this.key) { G.scene.remove(this.key.mesh); this.key = null; }
    G.audio.loop('jet', 'jet', false);
  },
  enemies(a, b) { if (a === b) return false; if (!this.M.teams) return true; return a.team !== b.team; },
  scoreOf(a) { return this.mode === 'lock' ? (a.gunTier || 0) : a.stats.kills; },
  respawnTime(a) { return this.mode === 'range' ? 2 : this.mode === 'lock' ? 3 : this.mode === 'ffa' ? 3 : this.mode === 'hill' || this.mode === 'key' ? 4 : 4.5; },

  pickSpawn(a) {
    const sp = this.map.spawns;
    let list = this.M.teams ? sp[a.team] : sp.ffa;
    const foes = G.actors.filter(o => o.alive && o !== a && this.enemies(a, o));
    const score = s => {
      let md = 999, seen = 0;
      const p = new THREE.Vector3(s[0], s[1] + 1.6, s[2]);
      for (const f of foes) { const d = f.pos.distanceTo(p); md = Math.min(md, d); if (d < 45 && G.world.los(p, f.eye())) seen++; }
      const friends = G.actors.filter(o => o.alive && o !== a && !this.enemies(a, o)).reduce((m, o) => Math.min(m, o.pos.distanceTo(p)), 99);
      return Math.min(md, 40) - seen * 25 - (friends < 1.5 ? 30 : 0) + Math.random() * 6;
    };
    let best = null, bs = -1e9;
    for (const s of list) { const v = score(s); if (v > bs) { bs = v; best = s; } }
    if (this.M.teams && bs < -10) for (const s of sp.ffa) { const v = score(s) - 5; if (v > bs) { bs = v; best = s; } }
    return best;
  },

  // ---------------------------------------------------------------- objectives
  buildHill() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uCol: { value: new THREE.Color(1, 1, 1) }, uTime: G.uTime },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vU; uniform vec3 uCol; uniform float uTime; void main(){ float a = pow(1.0 - vU.y, 2.2) * 0.55 + 0.25 * step(0.92, fract(vU.y * 6.0 - uTime * 0.6)) * (1.0 - vU.y); gl_FragColor = vec4(uCol * a, a); }',
    }));
    wall.scale.set(1, 3, 1); wall.position.y = 1.5; g.add(wall);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 64), G.glowMat('#ffffff', 2.5)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    G.scene.add(g); this.hillMesh = g; this.hillWall = wall; this.hillRing = ring;
    this.placeHill(0);
  },
  placeHill(i) {
    const h = this.map.hills[i % this.map.hills.length];
    this.hill = { x: h[0], y: h[1], z: h[2], r: h[3] };
    this.hillMesh.position.set(h[0], h[1] + 0.02, h[2]); this.hillMesh.scale.set(h[3], 1, h[3]);
    this.hillT = 50;
  },
  inHill(a) { const h = this.hill; return a.alive && Math.hypot(a.pos.x - h.x, a.pos.z - h.z) < h.r && a.pos.y > h.y - 0.6 && a.pos.y < h.y + 3.2; },
  buildKey() {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffb000', emissiveIntensity: 1.2, metalness: 0.9, roughness: 0.25 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 20), gold); ring.position.y = 0.32; g.add(ring);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), gold); g.add(bar);
    for (const y of [-0.22, -0.1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.07), gold); t.position.set(0.11, y, 0); g.add(t); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.radialTex(), color: G.col('#ffc21a').multiplyScalar(1.5), blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(1.6); g.add(glow);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    G.scene.add(g);
    const home = new THREE.Vector3(...this.map.key);
    this.key = { mesh: g, home, pos: home.clone().setY(home.y + 1.1), carrier: null, idle: 0, dropT: 0 };
  },
  dropKey(at) {
    const k = this.key; if (!k || !k.carrier) return;
    k.carrier.hasKey = false; k.carrier = null;
    const gy = G.world.groundAt(at.x, at.z, at.y + 0.5, 0.5);
    if (gy < this.map.killY + 2 || at.y < this.map.killY + 2) { this.resetKey(); return; }
    k.pos.set(at.x, gy + 1.1, at.z); k.idle = 15; k.dropT = G.t;
  },
  resetKey() { const k = this.key; if (k.carrier) k.carrier.hasKey = false; k.carrier = null; k.pos.copy(k.home).setY(k.home.y + 1.1); k.idle = 0; if (!this.attract) G.ui.toast('KEY RESET', '#ffd23f'); },

  // ---------------------------------------------------------------- bot helpers
  botGoal(bot) {
    if (this.mode === 'hill' && this.hill) {
      const h = this.hill, focus = (G.actors.indexOf(bot) % 4) !== 3;
      if (!focus && !this.inHill(bot)) return null;
      const off = (bot.name.length % 5) / 5 * Math.PI * 2;
      return { pos: new THREE.Vector3(h.x + Math.cos(off) * h.r * 0.45, h.y, h.z + Math.sin(off) * h.r * 0.45), urgent: !this.inHill(bot) };
    }
    if (this.mode === 'key' && this.key) {
      const k = this.key;
      if (!k.carrier) return { pos: k.pos.clone().setY(k.pos.y - 1.1), urgent: true };
      if (k.carrier === bot) {
        const sp = this.map.spawns[bot.team]; const s = sp[Math.floor(G.t / 12 + bot.name.length) % sp.length];
        return { pos: new THREE.Vector3(s[0], s[1], s[2]), urgent: true };
      }
      if (this.enemies(bot, k.carrier)) return { pos: k.carrier.pos.clone(), urgent: true };
      return { pos: k.carrier.pos.clone().add(new THREE.Vector3(G.rand(-4, 4), 0, G.rand(-4, 4))), urgent: false };
    }
    return null;
  },
  pickupFor(bot) {
    let best = null, bd = 34;
    for (const p of this.pickups) {
      if (!p.active) continue;
      if (p.power && bot.slots[2]) continue;
      if (p.type === 'frag' && bot.grenades >= 2) continue;
      if (p.type === 'overshield' && bot.over > 0) continue;
      const d = p.pos.distanceTo(bot.pos) - (p.power ? 12 : 0);
      if (d < bd) { bd = d; best = p.pos; }
    }
    return best;
  },
  roamPoint(bot) {
    const m = this.map, pts = [];
    for (const h of m.hills) pts.push([h[0], h[1], h[2]]);
    for (const p of m.pickups) pts.push(p.pos);
    for (const s of m.spawns.ffa) pts.push(s);
    if (this.M.teams) for (const s of m.spawns[1 - bot.team]) pts.push(s);
    const p = G.pick(pts);
    return new THREE.Vector3(p[0], p[1], p[2]);
  },

  // ---------------------------------------------------------------- kills, medals, xp
  onKill(killer, victim, info = {}) {
    const k = killer && killer !== victim ? killer : null;
    const weapon = info.void ? (k ? 'void' : 'void') : info.weapon || 'void';
    const via = !!info.via;
    // team score
    if (this.state === 'playing' || this.state === 'countdown') {
      if (k) {
        if (this.M.teams && this.mode === 'tdm') this.scores[k.team]++;
      } else if (this.mode === 'tdm' && this.M.teams && victim) {
        // suicides cost a point
        this.scores[victim.team] = Math.max(0, this.scores[victim.team] - 1);
      }
    }
    if (this.mode === 'key' && victim.hasKey) this.dropKey(victim.pos.clone());
    const medals = [];
    if (k) {
      k.stats.kills++; k.stats.streak++; k.stats.best = Math.max(k.stats.best, k.stats.streak); k.stats.score += 100;
      if (this.mode === 'lock') {
        if (weapon === 'melee') { victim.gunTier = Math.max(0, (victim.gunTier || 0) - 1); if (victim.isPlayer) G.ui.toast('KNOCKED BACK A GUN', '#ff5a46'); }
        k.gunTier = (k.gunTier || 0) + 1;
        if (k.gunTier < G.LOCK_ORDER.length && k.alive) { k.resetLoadout(); if (k.isPlayer) G.ui.toast('GUN ' + (k.gunTier + 1) + ' / 7   ' + G.WEAPONS[G.LOCK_ORDER[k.gunTier]].name, '#ece8e1'); }
        else if (k.gunTier === G.LOCK_ORDER.length - 1 && !this.attract) G.ui.toast(k.name.toUpperCase() + ' IS ON THE LAST GUN', '#e8c46a');
      }
      if (info.head) { k.stats.headshots++; medals.push('HEADSHOT'); }
      if (via) { k.stats.doorKills++; medals.push('THROUGH THE DOOR'); }
      if (G.t - k.lastDoorT < 2.2) medals.push('DOOR HOP');
      if (!k.onGround && k.airTime > 0.45) medals.push('SKY SLAM');
      if (weapon === 'melee') medals.push(info.back ? 'BACKDOOR' : 'KNOCK KNOCK');
      if (info.explosive) medals.push('BOOM');
      if (info.void) medals.push('SHOWN THE DOOR');
      if (info.point && k.eye().distanceTo(info.point) > 45 && !info.explosive) medals.push('PEEPHOLE');
      if (!this.firstBlood && !this.attract) { this.firstBlood = true; medals.push('FIRST BLOOD'); }
      if ((victim.streakBefore ?? victim.stats.streak) >= 5) medals.push('DOOR SHUT');
      if (k.lastKiller === victim) { medals.push('PAYBACK'); k.lastKiller = null; }
      if (k.alive && k.hp < 30 && k.shield <= 0) medals.push('CLOSE CALL');
      if (victim.hasKeyAtDeath) medals.push('KEYMASTER');
      if (this.mode === 'hill' && this.hill && this.inHill(k)) medals.push('BOUNCER');
      if (G.t - k.lastKillT < 4.5) k.multi++; else k.multi = 1;
      k.lastKillT = G.t;
      const mm = { 2: 'DOUBLE SLAM', 3: 'TRIPLE SLAM', 4: 'QUAD SLAM' }[k.multi] || (k.multi >= 5 ? 'SLAMTASTIC' : null);
      if (mm) medals.push(mm);
      const st = { 5: 'DOOR BREAKER', 10: 'UNHINGED', 15: 'DOORMINATOR', 20: 'UNSTOPPABLE' }[k.stats.streak];
      if (st) medals.push(st);
      for (const m of medals) k.stats.score += G.MEDALS[m][0];
      k.stats.medals += medals.length;
      if (k.isPlayer) {
        this.xpEarned += 100;
        for (const m of medals) { this.xpEarned += G.MEDALS[m][0]; this.medalsEarned.push(m); }
        G.ui.killConfirm(victim, medals, info);
        G.audio.play('kill', { vol: 0.8 });
        const big = medals.find(m => ['DOUBLE SLAM', 'TRIPLE SLAM', 'QUAD SLAM', 'SLAMTASTIC', 'DOOR BREAKER', 'UNHINGED', 'DOORMINATOR', 'UNSTOPPABLE', 'FIRST BLOOD'].includes(m));
        if (big) G.audio.say(big.toLowerCase());
        const s = G.save;
        const C = s.challenges;
        if (via) C.doorKills = (C.doorKills || 0) + 1;
        if (info.head) C.headshots = (C.headshots || 0) + 1;
        if (weapon === 'melee') C.melee = (C.melee || 0) + 1;
        if (info.explosive) C.boom = (C.boom || 0) + 1;
        C.medals = (C.medals || 0) + medals.length;
      }
    }
    // assists
    for (const [a, dmg] of victim.damagers) {
      if (a === k || !a.alive && a !== k) continue;
      if (dmg >= 40 && this.enemies(a, victim)) { a.stats.assists++; a.stats.score += 50; if (a.isPlayer) { this.xpEarned += 50; G.ui.toast('ASSIST  +50', '#cfd6e0'); } }
    }
    victim.lastKiller = k;
    this.pushFeed(k, victim, weapon, info, via);
    this.checkWin();
  },
  pushFeed(k, victim, weapon, info, via) {
    if (this.attract) return;
    const col = a => a ? (this.M.teams ? (a.team === 0 ? G.TEAM[0].color : G.TEAM[1].color) : a.accent) : '#9aa3ad';
    this.feed.unshift({ k: k ? k.name : null, kc: col(k), v: victim.name, vc: col(victim), w: G.WEAPON_LABEL[weapon] || weapon, head: !!info.head, door: via, t: G.t, me: (k && k.isPlayer) || victim.isPlayer });
    if (this.feed.length > 6) this.feed.length = 6;
    G.ui && G.ui.feedChanged();
  },
  leader() {
    if (this.M.teams) return null;
    return G.actors.slice().sort((a, b) => this.scoreOf(b) - this.scoreOf(a) || b.stats.kills - a.stats.kills)[0];
  },
  checkWin() {
    if (this.attract || this.state !== 'playing' || G.netGuest) return; // in a party the leader's game ends the match
    const lim = this.M.limit;
    if (this.M.teams) { if (this.scores[0] >= lim || this.scores[1] >= lim) this.end(); }
    else if (this.mode !== 'range') { const l = this.leader(); if (l && this.scoreOf(l) >= lim) this.end(); }
  },
  playerWon() {
    if (!G.player) return false;
    if (this.M.teams) { const t = G.player.team === 1 ? 1 : 0; return this.scores[t] > this.scores[1 - t]; }
    return this.leader() === G.player;
  },
  end() {
    if (this.state === 'ended') return;
    this.state = 'ended'; this.endT = 0; this.frozen = true;
    const won = this.playerWon();
    G.timeScale = 0.35;
    G.audio.play(won ? 'win' : 'lose', { vol: 0.9 });
    G.audio.say(won ? 'victory' : 'defeat');
    G.ui.banner(won ? 'VICTORY' : 'DEFEAT', won ? '#3fb8ff' : '#ff5040');
    // xp + save
    const p = G.player, s = G.save;
    if (p) {
      this.xpEarned += 250 + (won ? 500 : 0) + Math.floor(p.stats.obj) * 2;
      s.matches++; if (won) s.wins++;
      s.kills += p.stats.kills; s.deaths += p.stats.deaths; s.headshots += p.stats.headshots; s.doorKills += p.stats.doorKills;
      s.medalsTotal += this.medalsEarned.length; s.bestStreak = Math.max(s.bestStreak, p.stats.best);
      for (const m of this.medalsEarned) s.medals[m] = (s.medals[m] || 0) + 1;
      const C = s.challenges; C.doors = (C.doors || 0) + p.stats.doors; C.obj = (C.obj || 0) + Math.floor(p.stats.obj); if (won) C.wins = (C.wins || 0) + 1;
      const done = []; C._done = C._done || {};
      for (const ch of G.CHALLENGES) if (!C._done[ch.id] && (C[ch.id] || 0) >= ch.goal) { C._done[ch.id] = true; this.xpEarned += ch.xp; done.push(ch); }
      this.challengesDone = done;
      this.levelBefore = s.level; this.xpBefore = s.xp;
      s.xp += this.xpEarned;
      while (s.xp >= G.xpNeeded(s.level)) { s.xp -= G.xpNeeded(s.level); s.level++; }
      G.store();
    }
  },

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this._lastBeep && c >= 1 && c <= 3) { this._lastBeep = c; G.audio.play('beep', { vol: 0.7 }); G.ui.countdown(c); }
      if (this.countdown <= 0) { this.state = 'playing'; this.frozen = false; G.audio.play('go', { vol: 0.8 }); G.ui.countdown('GO'); }
    }
    if (this.state === 'ended') {
      this.endT += dt / Math.max(G.timeScale, 0.01);
      if (this.endT > 2.6 && !this.endShown) { this.endShown = true; G.timeScale = 1; G.ui.showEnd(); }
      return;
    }
    this.endShown = false;
    // a party guest's game shows the leader's clock, scores, pickups and objectives (js/party.js)
    const auth = !G.netGuest;
    if (this.state === 'playing' && !this.attract && auth) {
      if (this.mode !== 'range') this.timeLeft -= dt;
      else this.updateRange();
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(); return; }
    }
    // respawns
    for (const a of G.actors) {
      if (a.alive) continue;
      a.respawnT -= dt;
      if (a.respawnT <= 0) a.respawn(this.pickSpawn(a));
    }
    // pickups
    for (const p of this.pickups) {
      const ud = p.mesh.userData;
      ud.item.visible = p.active; ud.beam.visible = p.active;
      if (p.active) { ud.item.rotation.y += dt * 1.6; ud.item.position.y = 1.15 + Math.sin(G.t * 2) * 0.08; }
      else {
        if (!auth) continue;
        p.timer -= dt;
        if (p.timer <= 0) { p.active = true; if (p.power && G.player && !this.attract) { G.ui.toast((p.type === 'rail' ? 'HINGE RAIL' : 'DOORBUSTER') + ' IS UP', G.WEAPONS[p.type].color); G.audio.play('alarm', { vol: 0.5 }); } }
        continue;
      }
      if (!auth) continue;
      for (const a of G.actors) {
        if (!a.alive || a.hasKey) continue;
        if (Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) > 1.3 || Math.abs(a.pos.y - p.pos.y) > 1.8) continue;
        if (this.applyPickup(p, a)) { p.active = false; p.timer = p.respawn; break; }
      }
    }
    // hill
    if (this.mode === 'hill' && this.hill && this.state === 'playing') {
      if (auth) this.hillT -= dt;
      if (this.hillT <= 0 && auth) { this.hillI++; this.placeHill(this.hillI); if (!this.attract) { G.ui.toast('ZONE MOVED', '#ffffff'); G.audio.play('alarm', { vol: 0.5 }); } }
      const inside = [0, 0];
      for (const a of G.actors) if (this.inHill(a)) inside[a.team]++;
      let owner = -1;
      if (inside[0] && !inside[1]) owner = 0; else if (inside[1] && !inside[0]) owner = 1;
      const contested = inside[0] && inside[1];
      if (owner >= 0 && auth) {
        this.scores[owner] += dt;
        for (const a of G.actors) if (a.team === owner && this.inHill(a)) a.stats.obj += dt;
        this._zoneTick = (this._zoneTick || 0) + dt;
        if (this._zoneTick > 1 && G.player && this.inHill(G.player)) { this._zoneTick = 0; G.audio.play('zone', { vol: 0.35 }); }
      }
      const col = contested ? '#ffcc33' : owner === 0 ? G.TEAM[0].color : owner === 1 ? G.TEAM[1].color : '#e8ecf2';
      this.hillWall.material.uniforms.uCol.value.set(col); this.hillRing.material.color.set(col).multiplyScalar(2.5);
      this.hillOwner = contested ? -2 : owner;
      this.checkWin();
    }
    // key
    if (this.mode === 'key' && this.key) {
      const k = this.key;
      if (!auth) { if (k.carrier) k.pos.set(k.carrier.pos.x, k.carrier.pos.y + 2.45, k.carrier.pos.z); }
      else if (k.carrier) {
        if (!k.carrier.alive) this.dropKey(k.carrier.pos.clone());
        else {
          k.pos.set(k.carrier.pos.x, k.carrier.pos.y + 2.45, k.carrier.pos.z);
          if (this.state === 'playing') { this.scores[k.carrier.team] += dt; k.carrier.stats.obj += dt; this.checkWin(); }
        }
      } else {
        if (k.idle > 0) { k.idle -= dt; if (k.idle <= 0) this.resetKey(); }
        for (const a of G.actors) {
          if (!a.alive || a.invuln > 1.2) continue;
          if (a.pos.distanceTo(_kp.set(k.pos.x, k.pos.y - 1.1, k.pos.z)) < 1.5) {
            k.carrier = a; a.hasKey = true; a.hasKeyAtDeath = false; a.burstLeft = 0; a.reloadT = 0;
            if (!this.attract) { G.ui.toast(a.isPlayer ? 'YOU HAVE THE KEY' : (a.name.toUpperCase() + ' HAS THE KEY'), this.M.teams && a.team === 0 ? G.TEAM[0].color : G.TEAM[1].color); G.audio.play('pickup', { vol: 0.7 }); }
            break;
          }
        }
      }
      for (const a of G.actors) a.hasKeyAtDeath = a.hasKey;
      k.mesh.position.copy(k.pos); k.mesh.position.y += k.carrier ? 0 : Math.sin(G.t * 2) * 0.12; k.mesh.rotation.y += dt * 2;
      k.mesh.visible = !(k.carrier && k.carrier.isPlayer);
    }
  },
  updateRange() {
    const p = G.player, S = G.RANGE_STEPS; if (!p) return;
    if (this.rangeStep < S.length && p.alive && S[this.rangeStep][1](p)) { this.rangeStep++; G.audio.play('pickup', { vol: 0.7 }); G.ui.toast(this.rangeStep < S.length ? 'GOOD' : 'RANGE COMPLETE', '#e8c46a'); }
    this.rangeText = this.rangeStep < S.length ? (this.rangeStep + 1) + ' / ' + S.length + ' &nbsp; ' + S[this.rangeStep][0] : 'Range complete &nbsp;/&nbsp; press ESC to leave';
  },
  applyPickup(p, a) {
    if (p.type === 'rail' || p.type === 'rocket') {
      if (this.mut.railsonly || this.mode === 'lock') return false;
      a.give(p.type);
      if (a.isPlayer) { G.ui.toast((p.type === 'rail' ? 'HINGE RAIL' : 'DOORBUSTER') + ' ACQUIRED', G.WEAPONS[p.type].color); }
    } else if (p.type === 'overshield') {
      if (a.over > 0) return false;
      a.over = 100; a.shield = a.maxShield;
      if (a.isPlayer) { G.ui.toast('OVERSHIELD', '#4ad6ff'); G.ui.flash('#4ad6ff', 0.3); }
    } else if (p.type === 'frag') {
      if (a.grenades >= 2) return false;
      a.grenades = 2;
      if (a.isPlayer) G.ui.toast('FRAGS RESTOCKED', '#ff7a3c');
    }
    G.audio.play('pickup', { pos: a.isPlayer ? null : a.pos, vol: 0.8 });
    return true;
  },
};
const _kp = new THREE.Vector3();
