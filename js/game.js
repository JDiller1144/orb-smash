// Orb Smash: Spiellogik und Zeichnen auf dem Canvas.
// Koordinaten sind "logisch": Das Spielfeld ist immer 400 Einheiten breit, die Hoehe haengt vom Bildschirm ab.

import { sfx } from './audio.js';

export const W = 400;
const G = 700;                                    // Schwerkraft
const TAU = Math.PI * 2;
const RADII = [0, 16, 24, 33, 43];                // Kugelgroesse je Stufe (1 = klein, 4 = gross)
const APEX = [0, 0.30, 0.40, 0.50, 0.58];         // Sprunghoehe je Stufe (Anteil am Spielfeld)
const COLORS = [null, '#3cf2ff', '#7dff5a', '#ff4fd8', '#ffb13b'];
const BULLET_COLS = ['#8ffaff', '#fff36b', '#ffae3b', '#ff6bd5', '#c39bff'];
const BARREL_OFFS = [null, [0], [-7, 7], [-11, 0, 11]];
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const POWERS = {
  shield: { label: 'SCHILD', col: '#5cd6ff' },
  turbo: { label: 'TURBO', col: '#ffe14d', time: 8 },
  frost: { label: 'FROST', col: '#c8f4ff', time: 5 },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);

export function fmtNum(n) {
  n = Math.ceil(n);
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, '') + 'M';
}

// ---------- Upgrades und Balancing ----------

const baseCost = (k) => Math.round(10 + 8 * k + 1.5 * k * k);

export const UPGRADES = {
  fire: {
    name: 'Feuerrate', max: 27, cost: baseCost,
    value: (k) => 6 + 0.7 * k,
    fmt: (v) => v.toFixed(1).replace(/\.0$/, '') + '/s',
  },
  power: {
    name: 'Feuerkraft', max: 500, cost: baseCost,
    value: (k) => 1 + k,
    fmt: (v) => fmtNum(v),
  },
  coin: {
    name: 'Münzbonus', max: 20,
    cost: (k) => Math.round(20 + 15 * k + 3 * k * k),
    value: (k) => 1 + 0.1 * k,
    fmt: (v) => '+' + Math.round((v - 1) * 100) + ' %',
  },
};

export const isBossLevel = (L) => L % 5 === 0;

// Schaden pro Sekunde, den ein Spieler in Level L ungefaehr hat (ca. 1,6 Upgrades pro Level)
function expectedDps(L) {
  const n = 1.6 * (L - 1);
  let f = n / 2, p = n / 2;
  if (f > UPGRADES.fire.max) { p += f - UPGRADES.fire.max; f = UPGRADES.fire.max; }
  return UPGRADES.fire.value(f) * UPGRADES.power.value(p);
}

// Muenzen, die ein Level ungefaehr einbringt (reicht fuer knapp 2 Upgrades)
function levelCoins(L) { return Math.round(1.8 * baseCost(0.8 * (L - 1))) + 10; }

// Kleiner Zufallsgenerator mit festem Startwert: jedes Level ist immer gleich aufgebaut
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gesamte Trefferpunkte einer Kugel inklusive aller Teilstuecke
function treeTotal(hp, tier) { return hp + (tier > 1 ? 2 * treeTotal(Math.ceil(hp / 2), tier - 1) : 0); }

function buildLevel(L) {
  const r = rng(L * 7919 + 13);
  const dps = expectedDps(L);
  if (isBossLevel(L)) {
    return {
      boss: true,
      bossHp: Math.round(dps * (16 + Math.min(L, 40) * 0.1)),
      minionHp: Math.max(2, Math.round(dps * 0.6)),
      coinsT: levelCoins(L) * 2,
      queue: [], total: 1, pops: 1,
    };
  }
  const budget = dps * Math.min(10 + L * 1.5, 40);
  const n = Math.min(3 + Math.floor(L / 3), 12);
  const maxTier = L < 3 ? 3 : 4, minTier = L < 7 ? 1 : 2;
  const queue = [];
  let total = 0, pops = 0;
  for (let i = 0; i < n; i++) {
    const tier = minTier + Math.floor(r() * (maxTier - minTier + 1));
    const hp = Math.max(tier, Math.round((budget / n / tier) * (0.75 + r() * 0.5)));
    queue.push({ tier, hp });
    total += treeTotal(hp, tier);
    pops += (1 << tier) - 1;
  }
  return {
    boss: false, queue, total, pops,
    coinsT: levelCoins(L),
    maxRoots: Math.min(2 + Math.floor(L / 8), 4),
    interval: Math.max(2.5, 6 - L * 0.15),
  };
}

// ---------- Zeichen-Helfer ----------

function hexPath(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + i * TAU / 6 - Math.PI / 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function readSafeArea() {
  const el = document.getElementById('safe');
  if (!el) return { top: 0, bottom: 0 };
  const cs = getComputedStyle(el);
  return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
}

// ---------- Das Spiel ----------

export class Game {
  constructor(canvas, hooks) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.state = 'idle';
    this.time = 0;
    this.shake = 0;
    this.sprites = new Map();
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.player = { x: W / 2, bob: 0, shield: false, inv: 0, barrel: 0, recoil: 0, alive: true };
    this.input = { down: false, id: null, lastX: 0, keys: new Set() };
    this.stats = { sps: 5, dmg: 1, coinMult: 1, fireLv: 0, powerLv: 0 };
    this.plan = null;
    Object.assign(this, { dpr: 1, scale: 1, offX: 0, H: 800, top: 80, ground: 740, bg: null });
    this.clearWorld();
    this.bindInput();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  clearWorld() {
    this.orbs = []; this.bullets = []; this.coins = []; this.parts = [];
    this.rings = []; this.texts = []; this.caps = [];
    this.boss = null;
    this.roots = new Map();
    this.pw = { turbo: 0, frost: 0 };
    Object.assign(this.player, { shield: false, inv: 0, alive: true });
  }

  // ----- Bildschirmgroesse -----

  resize() {
    const cssW = innerWidth, cssH = innerHeight;
    if (!cssW || !cssH) return;                   // Fenster noch nicht sichtbar
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.cv.width = Math.round(cssW * this.dpr);
    this.cv.height = Math.round(cssH * this.dpr);
    this.cv.style.width = cssW + 'px';
    this.cv.style.height = cssH + 'px';
    const colW = Math.min(cssW, cssH * 0.62);     // auf dem PC: hochkant-Spalte in der Mitte
    this.scale = colW / W;
    this.offX = (cssW - colW) / 2;
    this.H = cssH / this.scale;
    const safe = readSafeArea();
    this.top = (safe.top + 66) / this.scale;      // unter der Anzeige oben
    this.ground = this.H - (safe.bottom + 54) / this.scale;
    document.documentElement.style.setProperty('--col-w', colW + 'px');
    this.sprites.clear();
    this.buildBackground();
    for (const o of this.orbs) if (o.y + o.r > this.ground) o.y = this.ground - o.r;
  }

  buildBackground() {
    const c = document.createElement('canvas');
    c.width = this.cv.width; c.height = this.cv.height;
    const g = c.getContext('2d');
    const k = this.dpr * this.scale;
    const grd = g.createLinearGradient(0, 0, 0, c.height);
    grd.addColorStop(0, '#07021a');
    grd.addColorStop(0.6, '#1b0a40');
    grd.addColorStop(1, '#2a0d4a');
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    g.setTransform(k, 0, 0, k, this.offX * this.dpr, 0);
    const L = -this.offX / this.scale, R = W + this.offX / this.scale, gy = this.ground, H = this.H;

    // Sterne
    const r = rng(42);
    g.fillStyle = '#fff';
    for (let i = 0; i < 150; i++) {
      const x = L + r() * (R - L), y = r() * (gy - 30);
      g.globalAlpha = 0.15 + r() * 0.6;
      const s = r() < 0.9 ? 1 : 2;
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;

    // Gestreifte Sonne am Horizont (eigenes Canvas, damit die Streifen ausgestanzt werden koennen)
    const sr = 115, sc = document.createElement('canvas');
    const sk = Math.ceil(sr * 2 * k);
    sc.width = sk; sc.height = Math.ceil(sr * k);
    const s = sc.getContext('2d');
    s.scale(k, k);
    const sg = s.createLinearGradient(0, 0, 0, sr);
    sg.addColorStop(0, '#ffd666');
    sg.addColorStop(1, '#ff3d8b');
    s.fillStyle = sg;
    circle(s, sr, sr, sr);
    s.fill();
    s.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) s.fillRect(0, sr - 6 - i * 13, sr * 2, 1.2 + (7 - i) * 0.8);
    g.globalAlpha = 0.45;
    g.drawImage(sc, W / 2 - sr, gy - sr, sr * 2, sr);
    g.globalAlpha = 1;

    // Boden mit Gitter
    const fg = g.createLinearGradient(0, gy, 0, H);
    fg.addColorStop(0, '#2a0b4d');
    fg.addColorStop(1, '#0b0320');
    g.fillStyle = fg;
    g.fillRect(L, gy, R - L, H - gy);
    g.save();
    g.beginPath(); g.rect(L, gy, R - L, H - gy); g.clip();
    g.strokeStyle = 'rgba(255,79,216,0.35)';
    g.lineWidth = 1;
    for (let i = -20; i <= 20; i++) {
      g.beginPath(); g.moveTo(W / 2 + i * 16, gy); g.lineTo(W / 2 + i * 95, H); g.stroke();
    }
    for (let j = 1; j <= 8; j++) {
      const y = gy + (H - gy) * (j / 8) ** 1.8;
      g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke();
    }
    g.restore();

    // Leuchtende Horizontlinie
    g.strokeStyle = 'rgba(60,242,255,0.95)';
    g.lineWidth = 2;
    g.shadowColor = '#3cf2ff';
    g.shadowBlur = 10 * k;
    g.beginPath(); g.moveTo(L, gy); g.lineTo(R, gy); g.stroke();
    g.shadowBlur = 0;

    // Auf breiten Bildschirmen: Rand ausserhalb des Spielfelds abdunkeln
    if (this.offX > 1) {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(L, 0, -L, H);
      g.fillRect(W, 0, R - W, H);
      g.strokeStyle = 'rgba(160,130,255,0.3)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, H); g.moveTo(W, 0); g.lineTo(W, H); g.stroke();
    }
    this.bg = c;
  }

  // Kugel einmal vorzeichnen und dann nur noch als Bild stempeln (schont den Akku)
  orbSprite(tier, frozen) {
    const key = tier + (frozen ? 'f' : '');
    let sp = this.sprites.get(key);
    if (sp) return sp;
    const r = RADII[tier], pad = 14, size = (r + pad) * 2, k = this.dpr * this.scale;
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    const m = size / 2, col = frozen ? '#bfefff' : COLORS[tier];
    const glow = g.createRadialGradient(m, m, r * 0.6, m, m, r + pad);
    glow.addColorStop(0, rgba(col, 0.5));
    glow.addColorStop(1, rgba(col, 0));
    g.fillStyle = glow;
    circle(g, m, m, r + pad); g.fill();
    g.fillStyle = frozen ? '#16324a' : '#120630';
    circle(g, m, m, r); g.fill();
    const body = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
    body.addColorStop(0, rgba(col, 0.55));
    body.addColorStop(0.55, rgba(col, 0.15));
    body.addColorStop(1, rgba(col, 0));
    g.fillStyle = body;
    circle(g, m, m, r); g.fill();
    const lw = Math.max(2.5, r * 0.12);
    g.lineWidth = lw;
    g.strokeStyle = col;
    circle(g, m, m, r - lw / 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = r * 0.08;
    g.lineCap = 'round';
    g.beginPath(); g.arc(m, m, r * 0.68, Math.PI * 1.1, Math.PI * 1.42); g.stroke();
    sp = { c, size };
    this.sprites.set(key, sp);
    return sp;
  }

  // ----- Steuerung -----

  bindInput() {
    const cv = this.cv, inp = this.input;
    cv.addEventListener('pointerdown', (e) => {
      if (inp.id !== null) return;
      inp.id = e.pointerId; inp.down = true; inp.lastX = e.clientX;
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* egal */ }
      sfx.init();
      if (this.state === 'ready') this.begin();
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerId !== inp.id) return;
      const dx = e.clientX - inp.lastX;
      inp.lastX = e.clientX;
      if (this.state === 'playing' || this.state === 'ready') {
        this.player.x = clamp(this.player.x + (dx / this.scale) * 1.4, 22, W - 22);
      }
    });
    const up = (e) => { if (e.pointerId === inp.id) { inp.id = null; inp.down = false; } };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('lostpointercapture', up);
    const KEYS = ['arrowleft', 'arrowright', 'a', 'd', ' '];
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!KEYS.includes(k) || !(this.state === 'playing' || this.state === 'ready')) return;
      inp.keys.add(k);
      sfx.init();
      if (this.state === 'ready') this.begin();
      e.preventDefault();
    });
    addEventListener('keyup', (e) => inp.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => { inp.keys.clear(); inp.down = false; inp.id = null; });
  }

  // ----- Ablauf -----

  idle() {
    this.state = 'idle';
    this.clearWorld();
    this.plan = null;
    this.player.x = W / 2;
    for (let i = 0; i < 3; i++) {
      const o = this.makeOrb(2 + i, Math.floor(rand(5, 80)), 0, rand(60, W - 60), this.top + 40 + i * 40);
      o.vx = (i % 2 ? 1 : -1) * rand(45, 70);
      this.orbs.push(o);
    }
  }

  start(level, stats) {
    this.clearWorld();
    this.level = level;
    this.stats = stats;
    this.plan = buildLevel(level);
    this.queue = this.plan.queue.slice();
    this.done = 0; this.coinsRun = 0; this.spawnT = 0; this.emptyT = 0;
    this.fireAcc = 0.99; this.endT = 0; this.rootSeq = 0; this.spawnedAny = false;
    const T = this.plan.coinsT * stats.coinMult;
    this.coinPerPop = Math.max(1, Math.round(this.plan.boss ? 0.02 * T : (0.65 * T) / this.plan.pops));
    this.player.x = W / 2;
    this.player.barrel = 0;
    if (this.plan.boss) this.boss = this.makeBoss(this.plan.bossHp);
    this.state = 'ready';
    this.lastHud = -1;
    this.emitHud(true);
  }

  begin() { this.state = 'playing'; }

  pause() {
    if (this.state !== 'playing' && this.state !== 'ready') return false;
    this.prev = this.state;
    this.state = 'paused';
    this.input.down = false; this.input.id = null; this.input.keys.clear();
    return true;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.prev;
    this.last = performance.now();
  }

  progress() {
    if (!this.plan) return 0;
    if (this.boss) return 1 - this.boss.hp / this.boss.max;
    return this.plan.boss ? 1 : Math.min(1, this.done / this.plan.total);
  }

  emitHud(force) {
    const key = Math.floor(this.progress() * 200);
    if (force || key !== this.lastHud) { this.lastHud = key; this.hooks.hud(this.progress()); }
  }

  finish(win) {
    if (this.state === 'over') return;
    const bonus = win ? Math.round(0.35 * this.plan.coinsT * this.stats.coinMult) : 0;
    const progress = win ? 1 : this.progress();
    this.state = 'over';
    this.input.down = false;
    this.hooks.end({ win, level: this.level, coins: this.coinsRun, bonus, progress });
  }

  // ----- Hauptschleife -----

  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 1 / 30);
    if (this.state !== 'paused') this.update(dt);
    this.render();
  }

  update(dt) {
    this.time += dt;
    const st = this.state, p = this.player, K = this.input.keys;
    p.bob += dt;
    p.recoil = Math.max(0, p.recoil - dt * 12);
    this.shake = Math.max(0, this.shake - dt * 25);

    if (st === 'idle') { this.updateOrbs(dt); this.updateFx(dt); return; }

    const kdir = (K.has('arrowright') || K.has('d') ? 1 : 0) - (K.has('arrowleft') || K.has('a') ? 1 : 0);
    if (kdir && (st === 'playing' || st === 'ready')) p.x = clamp(p.x + kdir * 420 * dt, 22, W - 22);

    const wdt = st === 'dying' ? dt * 0.3 : dt;   // Zeitlupe beim Abschuss

    if (st === 'playing') {
      if (this.input.down || K.size > 0) {
        this.fireAcc += dt * this.stats.sps * (this.pw.turbo > 0 ? 1.8 : 1);
        while (this.fireAcc >= 1) { this.fireAcc -= 1; this.shoot(); }
      } else {
        this.fireAcc = 0.99;
      }
      this.pw.turbo = Math.max(0, this.pw.turbo - dt);
      this.pw.frost = Math.max(0, this.pw.frost - dt);
      p.inv = Math.max(0, p.inv - dt);
      this.updateSpawns(dt);
    }

    if (st !== 'ready') {
      const ts = this.pw.frost > 0 ? 0.3 : 1;
      this.updateOrbs(wdt * ts);
      if (this.boss) this.updateBoss(wdt * ts);
    }
    this.updateBullets(wdt);
    this.updateCoins(wdt);
    this.updateCaps(wdt);
    this.updateFx(wdt);

    if (st === 'playing') {
      this.checkPlayerHits();
      if (this.state === 'playing') this.checkWin();
      this.emitHud();
    } else if (st === 'dying') {
      this.endT += dt;
      if (this.endT > 1.5) this.finish(false);
    } else if (st === 'won') {
      this.endT += dt;
      if ((this.endT > 1.3 && this.coins.length === 0) || this.endT > 3) this.finish(true);
    }
  }

  // ----- Kugeln -----

  makeOrb(tier, hp, root, x, y) {
    return { tier, hp, max: hp, root, x, y, r: RADII[tier], vx: 0, vy: 0, entering: false, flash: 0, squash: 0 };
  }

  bounceV(tier) { return Math.sqrt(2 * G * APEX[tier] * (this.ground - this.top)); }

  aliveRoots() {
    let n = 0;
    for (const v of this.roots.values()) if (v > 0) n++;
    return n;
  }

  updateSpawns(dt) {
    if (!this.queue.length) return;
    this.spawnT -= dt;
    if (this.orbs.length === 0) {
      this.emptyT += dt;
      if (this.emptyT > 0.6 || !this.spawnedAny) this.spawnRoot();
      return;
    }
    this.emptyT = 0;
    if (this.spawnT <= 0 && this.aliveRoots() < this.plan.maxRoots) this.spawnRoot();
  }

  spawnRoot() {
    const d = this.queue.shift(), id = ++this.rootSeq, r = RADII[d.tier];
    const side = Math.random() < 0.5 ? -1 : 1;
    const o = this.makeOrb(d.tier, d.hp, id, side < 0 ? -r : W + r, this.top + r + 10 + Math.random() * 60);
    o.vx = -side * rand(60, 85);
    o.entering = true;
    this.orbs.push(o);
    this.roots.set(id, 1);
    this.spawnT = this.plan.interval;
    this.emptyT = 0;
    this.spawnedAny = true;
  }

  updateOrbs(dt) {
    const gr = this.ground, top = this.top;
    for (const o of this.orbs) {
      o.flash = Math.max(0, o.flash - dt);
      o.squash = Math.max(0, o.squash - dt * 4);
      o.x += o.vx * dt;
      if (o.entering) {                     // schwebt erst von der Seite herein, dann faellt sie
        if (o.x - o.r >= 0 && o.x + o.r <= W) o.entering = false;
        continue;
      }
      o.vy += G * dt;
      o.y += o.vy * dt;
      if (o.x - o.r < 0) { o.x = o.r; o.vx = Math.abs(o.vx); }
      else if (o.x + o.r > W) { o.x = W - o.r; o.vx = -Math.abs(o.vx); }
      if (o.y + o.r > gr) { o.y = gr - o.r; o.vy = -this.bounceV(o.tier); o.squash = 1; }
      if (o.y - o.r < top && o.vy < 0) { o.y = top + o.r; o.vy = 0; }
    }
  }

  damageOrb(o, dmg, b) {
    this.done += Math.min(dmg, o.hp);
    o.hp -= dmg;
    o.flash = 0.06;
    if (Math.random() < 0.5) this.spark(b.x, b.y, COLORS[o.tier]);
    sfx.hit();
    if (o.hp <= 0) this.popOrb(o, false);
  }

  popOrb(o, silent) {
    const i = this.orbs.indexOf(o);
    if (i < 0) return;
    this.orbs.splice(i, 1);
    if (this.roots.has(o.root)) this.roots.set(o.root, this.roots.get(o.root) - 1);
    const col = COLORS[o.tier];
    this.burst(o.x, o.y, col, 8 + o.tier * 5, 60 + o.tier * 40);
    this.rings.push({ x: o.x, y: o.y, r: o.r, max: o.r * 2.2, t: 0, life: 0.35, col });
    this.shake = Math.min(10, this.shake + o.tier * 0.9);
    if (silent) return;
    sfx.pop(o.tier);
    this.dropCoin(o.x, o.y, this.coinPerPop);
    if (o.tier >= 2 && this.caps.length === 0 && Math.random() < 0.07) this.dropCap(o.x, o.y);
    if (o.tier > 1) {
      const t = o.tier - 1, r = RADII[t], hp = Math.ceil(o.max / 2), sp = Math.max(55, Math.abs(o.vx));
      for (const s of [-1, 1]) {
        const c = this.makeOrb(t, hp, o.root, clamp(o.x + s * o.r * 0.4, r, W - r), Math.min(o.y, this.ground - r));
        c.vx = s * sp;
        c.vy = -this.bounceV(t) * 0.55;
        this.orbs.push(c);
      }
      if (this.roots.has(o.root)) this.roots.set(o.root, this.roots.get(o.root) + 2);
    }
  }

  checkWin() {
    if (this.queue.length || this.orbs.length || this.boss) return;
    this.state = 'won';
    this.endT = 0;
    sfx.win();
    for (const c of this.coins) c.st = 2;
    this.texts.push({ x: W / 2, y: this.H * 0.38, s: 'GESCHAFFT!', t: 0, life: 1.8, size: 40, col: '#fff36b' });
  }

  // ----- Boss (jedes 5. Level) -----

  makeBoss(hp) {
    return { x: W / 2, y: -90, baseY: 0, r: 52, hp, max: hp, vx: 70, ph: 'enter', t: 0, spawnT: 2.5, slamT: 6, rot: 0, flash: 0, vy: 0, tx: W / 2 };
  }

  updateBoss(dt) {
    const b = this.boss;
    b.baseY = this.top + b.r + 40;
    b.rot += dt;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    const minX = b.r + 6, maxX = W - b.r - 6;
    if (b.ph === 'enter') {
      b.y += (b.baseY - b.y) * Math.min(1, dt * 2.2);
      if (Math.abs(b.y - b.baseY) < 3) { b.ph = 'move'; b.t = 0; }
    } else if (b.ph === 'move') {
      b.x += b.vx * dt;
      if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx); }
      else if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx); }
      b.y = b.baseY + Math.sin(this.time * 1.7) * 8;
      b.spawnT -= dt;
      if (b.spawnT <= 0) { b.spawnT = 4.2; if (this.orbs.length < 4) this.spawnMinion(); }
      b.slamT -= dt;
      if (b.slamT <= 0) { b.ph = 'warn'; b.t = 0; b.tx = clamp(this.player.x, minX, maxX); sfx.warn(); }
    } else if (b.ph === 'warn') {
      b.x += (b.tx - b.x) * Math.min(1, dt * 5);
      if (b.t > 1.0) { b.ph = 'slam'; b.vy = 0; }
    } else if (b.ph === 'slam') {
      b.vy += 2400 * dt;
      b.y += b.vy * dt;
      if (b.y + b.r >= this.ground) {
        b.y = this.ground - b.r; b.ph = 'ground'; b.t = 0;
        this.shake = 12;
        sfx.slam();
        this.rings.push({ x: b.x, y: this.ground, r: 20, max: 140, t: 0, life: 0.5, col: '#ff4fd8' });
        this.burst(b.x, this.ground, '#ff4fd8', 20, 220);
      }
    } else if (b.ph === 'ground') {
      if (b.t > 0.45) { b.ph = 'rise'; b.t = 0; }
    } else if (b.ph === 'rise') {
      b.y += (b.baseY - b.y) * Math.min(1, dt * 3);
      if (Math.abs(b.y - b.baseY) < 4) { b.ph = 'move'; b.slamT = rand(4.5, 7); }
    }
  }

  spawnMinion() {
    const b = this.boss;
    const tier = this.level >= 15 && Math.random() < 0.35 ? 3 : 2;
    const o = this.makeOrb(tier, this.plan.minionHp, 0, clamp(b.x, RADII[tier], W - RADII[tier]), b.y + b.r * 0.5);
    o.vx = (Math.random() < 0.5 ? -1 : 1) * rand(55, 85);
    o.vy = -150;
    this.orbs.push(o);
  }

  damageBoss(dmg, bul) {
    const b = this.boss;
    b.hp -= dmg;
    b.flash = 0.05;
    if (Math.random() < 0.5) this.spark(bul.x, bul.y, '#ff4fd8');
    sfx.hit();
    if (b.hp <= 0) this.bossDie();
  }

  bossDie() {
    const b = this.boss;
    this.boss = null;
    sfx.boom();
    this.shake = 16;
    this.burst(b.x, b.y, '#ff4fd8', 60, 320);
    this.burst(b.x, b.y, '#ffffff', 30, 200);
    this.rings.push({ x: b.x, y: b.y, r: b.r, max: b.r * 3.5, t: 0, life: 0.6, col: '#ff4fd8' });
    const total = 0.9 * this.plan.coinsT * this.stats.coinMult;
    for (let i = 0; i < 12; i++) this.dropCoin(b.x, b.y, Math.max(1, Math.round(total / 12)));
    for (const o of this.orbs.slice()) this.popOrb(o, true);
    this.texts.push({ x: W / 2, y: this.H * 0.3, s: 'BOSS BESIEGT!', t: 0, life: 1.8, size: 34, col: '#ff8ae6' });
  }

  // ----- Schuesse -----

  barrels() {
    const f = this.stats.fireLv;
    return f >= 18 ? 3 : f >= 8 ? 2 : 1;
  }

  shoot() {
    const p = this.player, n = this.barrels();
    const off = BARREL_OFFS[n][p.barrel++ % n];
    this.bullets.push({ x: p.x + off, y: this.ground - 46, vy: -1050 });
    p.recoil = 1;
    sfx.shot();
  }

  updateBullets(dt) {
    const B = this.bullets, dmg = this.stats.dmg;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      b.y += b.vy * dt;
      let hit = b.y < -20;
      const bs = this.boss;
      if (!hit && bs) {
        const dx = b.x - bs.x, dy = b.y - bs.y;
        if (dx * dx + dy * dy < bs.r * bs.r) { this.damageBoss(dmg, b); hit = true; }
      }
      if (!hit) {
        for (const o of this.orbs) {
          const dx = b.x - o.x, dy = b.y - o.y, rr = o.r + 3;
          if (dx * dx + dy * dy < rr * rr) { this.damageOrb(o, dmg, b); hit = true; break; }
        }
      }
      if (hit) { B[i] = B[B.length - 1]; B.pop(); }
    }
  }

  // ----- Muenzen -----

  dropCoin(x, y, v) {
    this.coins.push({ x, y, vx: rand(-70, 70), vy: rand(-280, -160), v, st: 0, t: 0, sp: 0, spin: Math.random() * 6 });
  }

  updateCoins(dt) {
    const p = this.player, gy = this.ground;
    const alive = this.state === 'playing' || this.state === 'won';
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.t += dt;
      c.spin += dt * 6;
      if (c.st === 0) {                      // faellt
        c.vy += G * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.x < 8) { c.x = 8; c.vx = Math.abs(c.vx); } else if (c.x > W - 8) { c.x = W - 8; c.vx = -Math.abs(c.vx); }
        if (c.y > gy - 8) {
          c.y = gy - 8;
          if (c.vy > 150) { c.vy *= -0.45; c.vx *= 0.6; } else { c.vy = 0; c.vx = 0; c.st = 1; c.t = 0; }
        }
      } else if (c.st === 1) {               // liegt kurz am Boden
        if (c.t > 0.5 && alive) { c.st = 2; c.sp = 200; }
      } else {                               // fliegt zur Kanone
        const dx = p.x - c.x, dy = gy - 20 - c.y, d = Math.hypot(dx, dy) || 1;
        c.sp += 1600 * dt;
        const m = Math.min(d, c.sp * dt);
        c.x += (dx / d) * m; c.y += (dy / d) * m;
      }
      let remove = false;
      if (alive && Math.abs(c.x - p.x) < 24 && c.y > gy - 50) { this.collect(c); remove = true; }
      else if (!alive && c.t > 3) remove = true;
      if (remove) { this.coins[i] = this.coins[this.coins.length - 1]; this.coins.pop(); }
    }
  }

  collect(c) {
    this.coinsRun += c.v;
    this.hooks.coin(c.v);
    this.texts.push({ x: this.player.x + rand(-10, 10), y: this.ground - 60, s: '+' + fmtNum(c.v), t: 0, life: 0.7, size: 15, col: '#ffd84d' });
    sfx.coin();
  }

  // ----- Power-ups -----

  dropCap(x, y) {
    const types = Object.keys(POWERS);
    this.caps.push({ x, y, vy: -220, type: types[Math.floor(Math.random() * types.length)], t: 0, st: 0 });
  }

  updateCaps(dt) {
    const p = this.player, gy = this.ground;
    for (let i = this.caps.length - 1; i >= 0; i--) {
      const c = this.caps[i];
      c.t += dt;
      if (c.st === 0) {
        c.vy += G * dt; c.y += c.vy * dt;
        if (c.y > gy - 14) { c.y = gy - 14; if (c.vy > 150) c.vy *= -0.4; else { c.vy = 0; c.st = 1; c.t = 0; } }
      }
      let remove = c.st === 1 && c.t > 7;
      if (this.state === 'playing' && Math.abs(c.x - p.x) < 28 && c.y > gy - 60) { this.activate(c.type); remove = true; }
      if (remove) this.caps.splice(i, 1);
    }
  }

  activate(type) {
    const P = POWERS[type];
    if (type === 'shield') this.player.shield = true;
    else this.pw[type] = P.time;
    this.texts.push({ x: this.player.x, y: this.ground - 80, s: P.label + '!', t: 0, life: 1.2, size: 22, col: P.col });
    this.rings.push({ x: this.player.x, y: this.ground - 18, r: 10, max: 60, t: 0, life: 0.4, col: P.col });
    sfx.power();
  }

  // ----- Treffer am Spieler -----

  checkPlayerHits() {
    const p = this.player;
    if (p.inv > 0) return;
    const hw = 18, top = this.ground - 32, bot = this.ground;
    const touches = (x, y, r) => {
      const cx = clamp(x, p.x - hw, p.x + hw), cy = clamp(y, top, bot);
      const dx = x - cx, dy = y - cy;
      return dx * dx + dy * dy < r * r;
    };
    for (const o of this.orbs) if (!o.entering && touches(o.x, o.y, o.r * 0.86)) return this.playerHit(o);
    const b = this.boss;
    if (b && touches(b.x, b.y, b.r * 0.85)) this.playerHit(null);
  }

  playerHit(o) {
    const p = this.player;
    if (p.shield) {
      p.shield = false;
      p.inv = 1.3;
      sfx.shield();
      this.rings.push({ x: p.x, y: this.ground - 16, r: 20, max: 90, t: 0, life: 0.45, col: POWERS.shield.col });
      if (o) {
        o.vy = -this.bounceV(o.tier);
        o.vx = (o.x < p.x ? -1 : 1) * Math.max(60, Math.abs(o.vx));
      }
      return;
    }
    this.state = 'dying';
    this.endT = 0;
    p.alive = false;
    this.input.down = false;
    sfx.boom();
    this.shake = 14;
    this.burst(p.x, this.ground - 16, '#ffffff', 30, 260);
    this.burst(p.x, this.ground - 16, '#3cf2ff', 30, 200);
    this.rings.push({ x: p.x, y: this.ground - 16, r: 10, max: 120, t: 0, life: 0.6, col: '#3cf2ff' });
  }

  // ----- Effekte -----

  burst(x, y, col, n, sp) {
    for (let i = 0; i < n && this.parts.length < 450; i++) {
      const a = Math.random() * TAU, v = sp * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: 0.4 + Math.random() * 0.5, s: 2 + Math.random() * 3, col });
    }
  }

  spark(x, y, col) {
    if (this.parts.length < 450) this.parts.push({ x, y, vx: rand(-90, 90), vy: rand(20, 140), t: 0, life: 0.2, s: 2, col });
  }

  updateFx(dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.t += dt;
      if (q.t >= q.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      q.vy += 320 * dt; q.vx *= 1 - 1.5 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt; if (r.t >= r.life) this.rings.splice(i, 1); }
    for (let i = this.texts.length - 1; i >= 0; i--) { const s = this.texts[i]; s.t += dt; s.y -= 40 * dt; if (s.t >= s.life) this.texts.splice(i, 1); }
  }

  // ---------- Zeichnen ----------

  render() {
    if (!this.bg) return;
    const ctx = this.ctx, k = this.dpr * this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.bg, 0, 0);
    const sx = this.shake ? (Math.random() * 2 - 1) * this.shake * 0.5 : 0;
    const sy = this.shake ? (Math.random() * 2 - 1) * this.shake * 0.5 : 0;
    ctx.setTransform(k, 0, 0, k, this.offX * this.dpr + sx * k, sy * k);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const b = this.boss;
    if (b && b.ph === 'warn' && Math.floor(b.t * 10) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,40,60,0.35)';
      ctx.beginPath(); ctx.ellipse(b.tx, this.ground, b.r + 10, 9, 0, 0, TAU); ctx.fill();
    }

    for (const c of this.caps) this.drawCap(ctx, c);
    for (const c of this.coins) this.drawCoin(ctx, c);
    for (const o of this.orbs) this.drawOrb(ctx, o);
    if (b) this.drawBoss(ctx, b);
    this.drawBullets(ctx);
    if (this.player.alive) this.drawPlayer(ctx);
    this.drawFx(ctx);
    this.drawOverlayTexts(ctx);
  }

  drawOrb(ctx, o) {
    const s = this.orbSprite(o.tier, this.pw.frost > 0);
    if (o.squash > 0) {
      const q = o.squash * 0.12;
      ctx.save();
      ctx.translate(o.x, o.y + o.r * q);
      ctx.scale(1 + q, 1 - q);
      ctx.drawImage(s.c, -s.size / 2, -s.size / 2, s.size, s.size);
      ctx.restore();
    } else {
      ctx.drawImage(s.c, o.x - s.size / 2, o.y - s.size / 2, s.size, s.size);
    }
    if (o.flash > 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      circle(ctx, o.x, o.y, o.r * 0.9); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const txt = fmtNum(o.hp);
    const fs = o.r * (txt.length <= 2 ? 0.9 : txt.length === 3 ? 0.72 : 0.58);
    ctx.font = `800 ${fs.toFixed(1)}px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, o.x, o.y + fs * 0.06);
  }

  drawBoss(ctx, b) {
    const warn = b.ph === 'warn';
    const col = warn && Math.floor(b.t * 10) % 2 === 0 ? '#ff3b3b' : '#ff4fd8';
    const jx = warn ? rand(-2, 2) : 0;
    const x = b.x + jx, y = b.y;
    const glow = ctx.createRadialGradient(x, y, b.r * 0.5, x, y, b.r * 1.6);
    glow.addColorStop(0, rgba(col, 0.45));
    glow.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = glow;
    circle(ctx, x, y, b.r * 1.6); ctx.fill();
    hexPath(ctx, x, y, b.r, b.rot * 0.4);
    ctx.fillStyle = '#1a0733';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = col;
    ctx.stroke();
    hexPath(ctx, x, y, b.r * 0.72, -b.rot * 0.7);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(60,242,255,0.7)';
    ctx.stroke();
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 6);
    ctx.fillStyle = warn ? '#ff3b3b' : '#ffffff';
    circle(ctx, x, y - 6, b.r * 0.2 * pulse); ctx.fill();
    ctx.fillStyle = col;
    circle(ctx, x, y - 6, b.r * 0.1); ctx.fill();
    ctx.font = `800 15px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(fmtNum(b.hp), x, y + b.r * 0.45);
    if (b.flash > 0) {
      ctx.globalAlpha = 0.4;
      hexPath(ctx, x, y, b.r, b.rot * 0.4);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawBullets(ctx) {
    if (!this.bullets.length) return;
    const col = BULLET_COLS[Math.min(BULLET_COLS.length - 1, Math.floor(this.stats.powerLv / 10))];
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = col;
    for (const [w, a] of [[7, 0.25], [2.6, 1]]) {
      ctx.globalAlpha = a;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (const b of this.bullets) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 15); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawPlayer(ctx) {
    const p = this.player;
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2) return;   // blinkt nach Schild-Treffer
    const x = p.x, gy = this.ground, by = gy - 8 + Math.sin(p.bob * 4) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, gy + 2, 22, 4, 0, 0, TAU); ctx.fill();

    // Duesen
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(60,242,255,0.8)';
    for (const dx of [-12, 12]) {
      const fl = 5 + Math.random() * 4;
      ctx.beginPath(); ctx.moveTo(x + dx - 4, by); ctx.lineTo(x + dx + 4, by); ctx.lineTo(x + dx, by + fl); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Rohre
    const n = this.barrels(), rec = p.recoil * 3;
    for (const o of BARREL_OFFS[n]) {
      ctx.fillStyle = '#d9d3ff';
      rrect(ctx, x + o - 3, by - 40 + rec, 6, 24, 2); ctx.fill();
      ctx.fillStyle = BULLET_COLS[Math.min(4, Math.floor(this.stats.powerLv / 10))];
      ctx.fillRect(x + o - 3, by - 40 + rec, 6, 3);
    }

    // Rumpf
    ctx.beginPath();
    ctx.moveTo(x - 23, by); ctx.lineTo(x + 23, by); ctx.lineTo(x + 15, by - 18); ctx.lineTo(x - 15, by - 18);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, by - 18, 0, by);
    bg.addColorStop(0, '#a493ff');
    bg.addColorStop(1, '#4a2db5');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3cf2ff';
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, by - 18, 11, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = '#ece8ff';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3cf2ff';
    circle(ctx, x, by - 22, 3.5); ctx.fill();
    ctx.fillStyle = '#ff4fd8';
    ctx.fillRect(x - 17, by - 7, 4, 3);
    ctx.fillRect(x + 13, by - 7, 4, 3);

    if (p.shield) {
      const a = 0.5 + 0.2 * Math.sin(this.time * 6);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = POWERS.shield.col;
      circle(ctx, x, gy - 18, 34); ctx.fill();
      ctx.globalAlpha = a;
      ctx.lineWidth = 3;
      ctx.strokeStyle = POWERS.shield.col;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawCoin(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(0.35 + 0.65 * Math.abs(Math.cos(c.spin)), 1);
    hexPath(ctx, 0, 0, 7.5);
    ctx.fillStyle = '#ffcc3d';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff3b0';
    ctx.stroke();
    ctx.restore();
  }

  drawCap(ctx, c) {
    if (c.st === 1 && c.t > 5 && Math.floor(c.t * 8) % 2) return;  // blinkt bevor es verschwindet
    const P = POWERS[c.type], x = c.x, y = c.y + Math.sin(this.time * 5) * 2;
    ctx.fillStyle = rgba(P.col, 0.25);
    circle(ctx, x, y, 18); ctx.fill();
    ctx.fillStyle = '#140832';
    circle(ctx, x, y, 13); ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = P.col;
    ctx.stroke();
    ctx.fillStyle = P.col;
    ctx.strokeStyle = P.col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (c.type === 'shield') {
      ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y - 4); ctx.lineTo(x + 5, y + 2); ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 5, y + 2); ctx.lineTo(x - 6, y - 4); ctx.closePath(); ctx.fill();
    } else if (c.type === 'turbo') {
      ctx.moveTo(x + 2, y - 8); ctx.lineTo(x - 5, y + 1); ctx.lineTo(x, y + 1); ctx.lineTo(x - 2, y + 8);
      ctx.lineTo(x + 5, y - 1); ctx.lineTo(x, y - 1); ctx.closePath(); ctx.fill();
    } else {
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3;
        ctx.moveTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); ctx.lineTo(x - Math.cos(a) * 7, y - Math.sin(a) * 7);
      }
      ctx.stroke();
    }
  }

  drawFx(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const q of this.parts) {
      ctx.globalAlpha = 1 - q.t / q.life;
      ctx.fillStyle = q.col;
      ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
    }
    for (const r of this.rings) {
      const f = r.t / r.life;
      ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = r.col;
      ctx.lineWidth = 3 * (1 - f) + 1;
      circle(ctx, r.x, r.y, r.r + (r.max - r.r) * f); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawOverlayTexts(ctx) {
    for (const s of this.texts) {
      ctx.globalAlpha = Math.min(1, 2 * (1 - s.t / s.life));
      ctx.font = `900 ${s.size}px ${FONT}`;
      ctx.lineWidth = s.size > 20 ? 5 : 3;
      ctx.strokeStyle = 'rgba(20,5,40,0.85)';
      ctx.strokeText(s.s, s.x, s.y);
      ctx.fillStyle = s.col;
      ctx.fillText(s.s, s.x, s.y);
    }
    ctx.globalAlpha = 1;

    // Aktive Power-ups oben links
    let cy = this.top + 4;
    const chip = (label, col, frac) => {
      ctx.fillStyle = 'rgba(10,3,30,0.6)';
      rrect(ctx, 10, cy, 78, 20, 10); ctx.fill();
      ctx.fillStyle = rgba(col, 0.45);
      rrect(ctx, 10, cy, Math.max(20, 78 * frac), 20, 10); ctx.fill();
      ctx.font = `800 11px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 49, cy + 10.5);
      cy += 26;
    };
    if (this.state === 'playing' || this.state === 'paused') {
      if (this.player.shield) chip(POWERS.shield.label, POWERS.shield.col, 1);
      if (this.pw.turbo > 0) chip(POWERS.turbo.label, POWERS.turbo.col, this.pw.turbo / POWERS.turbo.time);
      if (this.pw.frost > 0) chip(POWERS.frost.label, POWERS.frost.col, this.pw.frost / POWERS.frost.time);
    }

    if (this.state === 'ready') {
      const boss = this.plan && this.plan.boss;
      ctx.font = `900 34px ${FONT}`;
      ctx.fillStyle = boss ? '#ff6bd5' : '#ffffff';
      ctx.fillText(boss ? 'BOSS-LEVEL' : `LEVEL ${this.level}`, W / 2, this.ground - 210);
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.time * 4);
      ctx.font = `700 18px ${FONT}`;
      ctx.fillStyle = '#c9bfff';
      ctx.fillText(this.touch ? 'Finger auflegen und ziehen' : 'Klicken und ziehen oder ← →', W / 2, this.ground - 170);
      ctx.globalAlpha = 1;
    }
  }
}
