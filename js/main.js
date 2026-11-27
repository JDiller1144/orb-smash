// Menue, Shop, Speicherstand und Verbindung zwischen Oberflaeche und Spiel.

import { Game, UPGRADES, POWERS, ULTRA, fmtNum, bossInfo } from './game.js';
import { sfx } from './audio.js';

const APP_VERSION = '1.3.0';
const SAVE_KEY = 'orbsmash-save-v1';
const DEFAULT = {
  level: 1, best: 1, coins: 0, up: { fire: 0, power: 0, coin: 0 }, sound: true, hintClosed: false,
  ultra: false,                                   // ist der Ultra-Modus im Menue ausgewaehlt?
  ultraBest: { pops: 0, wave: 0 },                // Rekord im Ultra-Modus
};

// ----- Speicherstand (bleibt auf dem Geraet, auch offline) -----

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      return {
        ...DEFAULT, ...s,
        up: { ...DEFAULT.up, ...(s.up || {}) },
        ultraBest: { ...DEFAULT.ultraBest, ...(s.ultraBest || {}) },
      };
    }
  } catch (_) { /* kein Speicher verfuegbar */ }
  return JSON.parse(JSON.stringify(DEFAULT));
}

let save = load();
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) { /* egal */ } };

const $ = (id) => document.getElementById(id);
const show = (...els) => els.forEach((e) => e.classList.remove('hidden'));
const hide = (...els) => els.forEach((e) => e.classList.add('hidden'));

const el = {
  hud: $('hud'), hudLevel: $('hud-level'), hudBar: $('hud-bar'), hudCoins: $('hud-coins'), hudIco: $('hud-ico'),
  menu: $('menu'), menuCoins: $('menu-coins'), wallet: $('wallet'), shop: $('shop'), playSub: $('play-sub'),
  playMain: $('play-main'), play: $('btn-play'), ultraCard: $('ultra-card'), ultraBest: $('ultra-best'),
  modeNormal: $('mode-normal'), modeUltra: $('mode-ultra'),
  best: $('best'), sound: $('btn-sound'), hint: $('install-hint'),
  pause: $('pause'), result: $('result'),
  resTitle: $('res-title'), resText: $('res-text'), resCoins: $('res-coins'),
  resRetry: $('res-retry'), resNext: $('res-next'),
};

const ICONS = {
  fire: '<svg viewBox="0 0 24 24"><path d="M7 20V9M12 20V4M17 20V9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>',
  power: '<svg viewBox="0 0 24 24"><path d="M12 2l2.4 6.2L21 9l-5 4.3L17.6 20 12 16.6 6.4 20 8 13.3 3 9l6.6-.8z" fill="currentColor"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" fill="currentColor"/><path d="M12 7l4.3 2.5v5L12 17l-4.3-2.5v-5z" fill="none" stroke="#1b0a40" stroke-width="1.6"/></svg>',
};

sfx.enabled = save.sound;

const stats = () => ({
  sps: UPGRADES.fire.value(save.up.fire),
  dmg: UPGRADES.power.value(save.up.power),
  coinMult: UPGRADES.coin.value(save.up.coin),
  fireLv: save.up.fire,
  powerLv: save.up.power,
});

let playingUltra = false;

const game = new Game($('cv'), {
  hud(progress) { el.hudBar.style.width = (progress * 100).toFixed(1) + '%'; },
  coin(v) { save.coins += v; el.hudCoins.textContent = fmtNum(save.coins); },
  score(pops) { el.hudCoins.textContent = fmtNum(pops); },
  wave(w) { el.hudLevel.textContent = `Ultra · Welle ${w}`; },
  end(res) { showResult(res); },
});
window.orbSmash = game; // zum Ausprobieren in der Browser-Konsole

// ----- Menue und Shop -----

function showMenu() {
  game.idle();
  hide(el.hud, el.pause, el.result);
  show(el.menu);
  renderMenu();
}

function renderMenu() {
  const ultra = save.ultra;
  el.modeNormal.classList.toggle('on', !ultra);
  el.modeUltra.classList.toggle('on', ultra);
  el.modeNormal.setAttribute('aria-selected', String(!ultra));
  el.modeUltra.setAttribute('aria-selected', String(ultra));
  el.menu.classList.toggle('ultra', ultra);
  el.shop.classList.toggle('hidden', ultra);
  el.wallet.classList.toggle('hidden', ultra);
  el.ultraCard.classList.toggle('hidden', !ultra);
  el.menuCoins.textContent = fmtNum(save.coins);
  el.best.textContent = `Rekord: Level ${save.best}`;
  el.sound.textContent = save.sound ? 'Ton: an' : 'Ton: aus';

  if (ultra) {
    el.playMain.textContent = 'ULTRA';
    const b = save.ultraBest;
    el.playSub.textContent = b.pops ? `Rekord: ${fmtNum(b.pops)} Kugeln · Welle ${b.wave}` : 'Noch kein Rekord';
    el.ultraBest.textContent = b.pops ? `Dein Rekord: ${fmtNum(b.pops)} Kugeln, Welle ${b.wave}` : 'Noch kein Rekord, leg los!';
    return;
  }

  el.playMain.textContent = 'SPIELEN';
  const bi = bossInfo(save.level);
  el.playSub.textContent = bi ? `Level ${save.level} · Boss ${bi.name}` : `Level ${save.level}`;
  el.shop.innerHTML = '';
  for (const [key, u] of Object.entries(UPGRADES)) {
    const lv = save.up[key], maxed = lv >= u.max, cost = u.cost(lv);
    const card = document.createElement('div');
    card.className = `card card-${key}`;
    card.innerHTML = `
      <div class="ico">${ICONS[key]}</div>
      <div class="info">
        <b>${u.name}</b>
        <span>${u.fmt(u.value(lv))}${maxed ? '' : ` <em>→ ${u.fmt(u.value(lv + 1))}</em>`}</span>
      </div>
      <button class="buy" data-key="${key}" ${maxed || save.coins < cost ? 'disabled' : ''}>
        ${maxed ? 'MAX' : `<i class="coin"></i>${fmtNum(cost)}`}
      </button>`;
    el.shop.appendChild(card);
  }
}

el.shop.addEventListener('click', (e) => {
  const btn = e.target.closest('.buy');
  if (!btn || btn.disabled) return;
  const key = btn.dataset.key, u = UPGRADES[key], lv = save.up[key];
  const cost = u.cost(lv);
  if (lv >= u.max || save.coins < cost) return;
  save.coins -= cost;
  save.up[key]++;
  persist();
  sfx.init();
  sfx.buy();
  renderMenu();
});

function setMode(ultra) {
  if (save.ultra === ultra) return;
  save.ultra = ultra;
  persist();
  sfx.init();
  sfx.click();
  renderMenu();
}

function startGame() {
  sfx.init();
  hide(el.menu, el.result, el.pause);
  show(el.hud);
  playingUltra = save.ultra;
  el.hud.classList.toggle('ultra', playingUltra);
  if (playingUltra) {
    el.hud.classList.remove('boss');
    el.hudLevel.textContent = 'Ultra · Welle 1';
    el.hudIco.className = 'orbico';
    el.hudCoins.textContent = '0';
    game.startUltra();
    return;
  }
  const bi = bossInfo(save.level);
  el.hudLevel.textContent = bi ? `${bi.name} · Level ${save.level}` : `Level ${save.level}`;
  el.hud.classList.toggle('boss', !!bi);
  el.hudIco.className = 'coin';
  el.hudCoins.textContent = fmtNum(save.coins);
  game.start(save.level, stats());
}

function showResult(res) {
  if (res.ultra) {
    const b = save.ultraBest, record = res.pops > b.pops;
    if (record) save.ultraBest = { pops: res.pops, wave: res.wave };
    persist();
    el.resTitle.textContent = record ? 'Neuer Rekord!' : 'Ultra vorbei!';
    el.resTitle.className = record ? 'win' : 'lose';
    el.resText.textContent = `Welle ${res.wave} erreicht, ${res.secs} Sekunden durchgehalten.`
      + (record || !b.pops ? '' : ` Rekord: ${fmtNum(b.pops)} Kugeln (Welle ${b.wave}).`);
    el.resCoins.innerHTML = `<i class="orbico"></i> ${fmtNum(res.pops)} <small>Kugeln zerschossen · keine Münzen im Ultra-Modus</small>`;
    show(el.resRetry);
    el.resNext.textContent = 'Menü';
    hide(el.hud);
    show(el.result);
    return;
  }
  if (res.win) {
    save.coins += res.bonus;
    save.level = res.level + 1;
    save.best = Math.max(save.best, save.level);
  }
  persist();
  el.resTitle.textContent = res.win ? 'Level geschafft!' : 'Erwischt!';
  el.resTitle.className = res.win ? 'win' : 'lose';
  el.resText.textContent = res.win
    ? `Level ${res.level} ist erledigt. Rüste im Shop auf und mach weiter.`
    : `Level ${res.level} zu ${Math.floor(res.progress * 100)} % geschafft. Rüste auf und versuch's nochmal.`;
  el.resCoins.innerHTML = `<i class="coin"></i> +${fmtNum(res.coins + res.bonus)}`
    + (res.bonus ? ` <small>inkl. ${fmtNum(res.bonus)} Bonus</small>` : '');
  el.resRetry.classList.toggle('hidden', res.win);
  el.resNext.textContent = res.win ? 'Weiter' : 'Zum Shop';
  hide(el.hud);
  show(el.result);
}

function pauseGame() {
  if (game.pause()) { persist(); show(el.pause); }
}

// ----- Knoepfe -----

el.play.addEventListener('click', startGame);
el.modeNormal.addEventListener('click', () => setMode(false));
el.modeUltra.addEventListener('click', () => setMode(true));
$('btn-pause').addEventListener('click', () => { sfx.click(); pauseGame(); });
$('btn-resume').addEventListener('click', () => { sfx.init(); hide(el.pause); game.resume(); });
$('btn-quit').addEventListener('click', () => { persist(); showMenu(); });
el.resRetry.addEventListener('click', startGame);
el.resNext.addEventListener('click', () => { sfx.click(); showMenu(); });
el.sound.addEventListener('click', () => {
  save.sound = !save.sound;
  sfx.enabled = save.sound;
  sfx.init();
  sfx.click();
  persist();
  renderMenu();
});
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Wirklich den ganzen Fortschritt löschen? Level, Münzen, Upgrades und der Ultra-Rekord sind dann weg.')) return;
  save = { ...JSON.parse(JSON.stringify(DEFAULT)), sound: save.sound, hintClosed: save.hintClosed, ultra: save.ultra };
  persist();
  renderMenu();
});
// ----- Spielstand: wiederherstellen (aus dem, was man im alten Spiel gesehen hat) und als Code sichern -----

// "1B", "3M", "1,4K", "1.000.000", "5005 %", "1126/s" -> Zahl (NaN, wenn unlesbar)
function parseAmount(txt) {
  const t = String(txt || '').trim().toLowerCase().replace(/\s+/g, '').replace(/%|\/s$/g, '').replace(/^\+/, '');
  const m = t.match(/^([\d.,]+)(k|tsd|m|mio|b|mrd)?$/);
  if (!m) return NaN;
  let num = m[1];
  if (/^\d{1,3}([.,]\d{3}){2,}$/.test(num) || (!m[2] && /^\d{1,3}\.\d{3}$/.test(num))) num = num.replace(/[.,]/g, ''); // Tausenderpunkte
  else num = num.replace(',', '.');
  const v = parseFloat(num);
  if (!isFinite(v)) return NaN;
  const mult = { k: 1e3, tsd: 1e3, m: 1e6, mio: 1e6, b: 1e9, mrd: 1e9 }[m[2]] || 1;
  return v * mult;
}

const MAX_LV = 1e7;
// kleinste Stufe k mit f(k) >= x (f steigt mit k)
function firstAtLeast(f, x) {
  let lo = 0, hi = MAX_LV;
  if (f(hi) < x) return hi;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (f(mid) >= x) hi = mid; else lo = mid + 1; }
  return lo;
}

// Anzeigewert (Feuerrate in /s, Feuerkraft, Muenzbonus in %) -> Anzahl Kaeufe
function levelFromValue(key, v) {
  const u = UPGRADES[key];
  if (key === 'coin') v = 1 + v / 100;
  const k = firstAtLeast(u.value, v);
  return k > 0 && Math.abs(u.value(k - 1) - v) <= Math.abs(u.value(k) - v) ? k - 1 : k;
}

// Preis auf dem Kauf-Knopf ("3M") -> erste Stufe, bei der genau dieser Preis angezeigt wird
function levelFromCost(key, price) {
  const u = UPGRADES[key], target = fmtNum(price);
  for (let k = firstAtLeast(u.cost, price * 0.5); k < MAX_LV && u.cost(k) <= price * 2; k++) {
    if (fmtNum(u.cost(k)) === target) return k;
  }
  return -1;
}

const svEl = {
  screen: $('savestate'), restore: $('sv-restore'), codePane: $('sv-code-pane'),
  tabRestore: $('sv-tab-restore'), tabCode: $('sv-tab-code'),
  level: $('sv-level'), coins: $('sv-coins'), preview: $('sv-preview'), msg: $('sv-msg'),
  codeOut: $('sv-code-out'), codeIn: $('sv-code-in'),
};
const UP_KEYS = ['fire', 'power', 'coin'];

function svMsg(text, bad) { svEl.msg.textContent = text; svEl.msg.classList.toggle('bad', !!bad); }

// liest das Formular und rechnet alles hoch; liefert den neuen Spielstand oder eine Fehlermeldung
function readRestore() {
  const level = Math.round(parseAmount(svEl.level.value));
  const coins = Math.round(parseAmount(svEl.coins.value));
  if (!(level >= 1)) return { err: 'Level fehlt oder ist unlesbar.' };
  if (!(coins >= 0)) return { err: 'Münzen fehlen oder sind unlesbar.' };
  const up = {};
  for (const key of UP_KEYS) {
    const mode = $(`sv-${key}-mode`).value, v = parseAmount($(`sv-${key}`).value);
    const name = UPGRADES[key].name;
    if (!isFinite(v) || v < 0) return { err: `${name}: Wert fehlt oder ist unlesbar.` };
    const k = mode === 'cost' ? levelFromCost(key, v) : levelFromValue(key, v);
    if (k < 0) return { err: `${name}: Diesen Preis gibt es so nicht. Genau so eintippen, wie er auf dem Knopf steht.` };
    up[key] = k;
  }
  return { level, coins, up };
}

function renderPreview() {
  const r = readRestore();
  if (r.err) { svEl.preview.innerHTML = `<span class="bad">${r.err}</span>`; return r; }
  const line = (key) => {
    const u = UPGRADES[key], k = r.up[key];
    const shown = key === 'power' ? u.value(k).toLocaleString('de-DE') : u.fmt(u.value(k)); // Feuerkraft genau, nicht "1.4K"
    return `${u.name}: <b>${shown}</b> (${k.toLocaleString('de-DE')}× gekauft, nächster Preis ${fmtNum(u.cost(k))})`;
  };
  svEl.preview.innerHTML = [
    `Level <b>${r.level}</b> · <b>${r.coins.toLocaleString('de-DE')}</b> Münzen`,
    ...UP_KEYS.map(line),
  ].join('<br>');
  return r;
}

// aktueller Spielstand ins Formular und als Code
function fillSave() {
  svEl.level.value = save.level;
  svEl.coins.value = Math.floor(save.coins);
  for (const key of UP_KEYS) {
    const v = UPGRADES[key].value(save.up[key]);
    $(`sv-${key}-mode`).value = 'value';
    $(`sv-${key}`).value = key === 'coin' ? Math.round((v - 1) * 100) : +v.toFixed(1);
  }
  renderPreview();
  svEl.codeOut.value = makeCode();
}

function makeCode() {
  const d = { v: 1, l: save.level, b: save.best, c: Math.floor(save.coins), u: save.up, x: save.ultraBest };
  return 'OS1-' + btoa(JSON.stringify(d));
}

function readCode(txt) {
  try {
    const t = String(txt).replace(/\s+/g, '');
    if (!t.startsWith('OS1-')) return null;
    const d = JSON.parse(atob(t.slice(4)));
    const int = (n) => (Number.isFinite(n) && n >= 0 ? Math.floor(n) : null);
    const up = d.u || {};
    const r = { level: int(d.l), best: int(d.b), coins: int(d.c), up: { fire: int(up.fire), power: int(up.power), coin: int(up.coin) } };
    if (!r.level || r.coins === null || Object.values(r.up).some((v) => v === null)) return null;
    r.ultraBest = d.x && int(d.x.pops) !== null ? { pops: int(d.x.pops), wave: int(d.x.wave) || 0 } : null;
    return r;
  } catch (_) { return null; }
}

function applySave(r) {
  save.level = r.level;
  save.best = Math.max(r.best || 0, r.level);
  save.coins = r.coins;
  save.up = { ...r.up };
  if (r.ultraBest) save.ultraBest = r.ultraBest;
  persist();
  renderMenu();
  fillSave();
}

function svTab(code) {
  svEl.tabRestore.classList.toggle('on', !code);
  svEl.tabCode.classList.toggle('on', code);
  svEl.restore.classList.toggle('hidden', code);
  svEl.codePane.classList.toggle('hidden', !code);
  svMsg('');
}

$('btn-save').addEventListener('click', () => { sfx.init(); sfx.click(); fillSave(); svTab(false); show(svEl.screen); });
$('sv-close').addEventListener('click', () => { sfx.click(); hide(svEl.screen); });
svEl.tabRestore.addEventListener('click', () => svTab(false));
svEl.tabCode.addEventListener('click', () => { svEl.codeOut.value = makeCode(); svTab(true); });
svEl.restore.addEventListener('input', () => { renderPreview(); svMsg(''); });
svEl.restore.addEventListener('change', () => renderPreview());
$('sv-apply').addEventListener('click', () => {
  const r = renderPreview();
  if (r.err) { svMsg(r.err, true); return; }
  if (!confirm('Spielstand wirklich übernehmen? Der jetzige wird überschrieben.')) return;
  applySave(r);
  svMsg('Spielstand übernommen ✓');
});
$('sv-copy').addEventListener('click', async () => {
  const code = makeCode();
  svEl.codeOut.value = code;
  try { await navigator.clipboard.writeText(code); svMsg('Code kopiert ✓'); }
  catch (_) { svEl.codeOut.select(); svMsg('Code markiert, jetzt kopieren.'); }
});
$('sv-load').addEventListener('click', () => {
  const r = readCode(svEl.codeIn.value);
  if (!r) { svMsg('Der Code ist ungültig.', true); return; }
  if (!confirm(`Spielstand laden: Level ${r.level}, ${fmtNum(r.coins)} Münzen? Der jetzige wird überschrieben.`)) return;
  applySave(r);
  svEl.codeIn.value = '';
  svMsg('Spielstand geladen ✓');
});

$('hint-close').addEventListener('click', () => { save.hintClosed = true; persist(); hide(el.hint); });

// App in den Hintergrund (Homebutton, Anruf): automatisch pausieren und speichern
document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseGame(); persist(); } });
// Pinch-Zoom in Safari verhindern
document.addEventListener('gesturestart', (e) => e.preventDefault());
// Querformat auf dem Handy: pausieren
addEventListener('resize', () => { if (innerWidth > innerHeight && matchMedia('(pointer: coarse)').matches) pauseGame(); });

// Hinweis zum Installieren nur in Safari auf iPhone/iPad, solange es noch nicht auf dem Homescreen liegt
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
if (isIOS && !standalone && !save.hintClosed) show(el.hint);

$('version').textContent = 'v' + APP_VERSION;

// Ultra-Infokarte
$('ultra-facts').innerHTML = [
  `<b>${ULTRA.sps}</b> Schuss/s`,
  `<b>${ULTRA.dmg.toLocaleString('de-DE')}</b> Schaden pro Schuss`,
  'Turbo, Fächer, Drohnen, Raketen und Frost immer an, ab und zu fällt ein Laser',
  `Schild lädt nach ${ULTRA.shieldRegen} s wieder auf, Nova alle ${ULTRA.novaEvery} s`,
  'Riesenkugeln ohne Ende, jede Welle zäher',
  'Keine Münzen, zählt nicht fürs Level',
].map((t) => `<li>${t}</li>`).join('');

// Liste der Power-ups im Menue
$('powers-list').innerHTML = Object.values(POWERS).map((p) =>
  `<li><i style="--c:${p.col}"></i><b>${p.label}</b><span>${p.desc}${p.time ? ` (${p.time} s)` : ''}</span></li>`).join('');

// Offline-Modus: Service Worker speichert alle Dateien auf dem Geraet.
// Lokal (localhost) nur mit ?sw, damit beim Entwickeln nichts Altes im Cache klebt.
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!local || location.search.includes('sw'))) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

showMenu();
