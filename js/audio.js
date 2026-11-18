// Soundeffekte, komplett per Web Audio erzeugt (keine Audiodateien, laeuft offline).
// iOS erlaubt Ton erst nach einer Beruehrung: deshalb init() bei jedem Antippen aufrufen.

class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.last = {};
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  // Darf der Sound jetzt spielen? gap = Mindestabstand in Sekunden (gegen Dauerfeuer-Krach)
  ok(name, gap = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return false;
    const t = this.ctx.currentTime;
    if (gap && this.last[name] && t - this.last[name] < gap) return false;
    this.last[name] = t;
    return true;
  }

  tone(f0, f1, dur, type = 'sine', vol = 0.2, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(dur, vol, freq, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.15), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.03);
  }

  shot() { if (this.ok('shot', 0.07)) this.tone(1300, 750, 0.045, 'square', 0.022); }
  hit() { if (this.ok('hit', 0.06)) this.tone(420, 280, 0.04, 'triangle', 0.05); }
  pop(tier) {
    if (!this.ok('pop', 0.03)) return;
    this.noise(0.12 + tier * 0.05, 0.22, 2800 - tier * 380);
    this.tone(760 - tier * 120, 110, 0.14 + tier * 0.04, 'sine', 0.18);
  }
  coin() {
    if (!this.ok('coin', 0.06)) return;
    this.tone(1320, 1320, 0.06, 'sine', 0.07);
    this.tone(1760, 1760, 0.09, 'sine', 0.07, 0.05);
  }
  power() {
    if (!this.ok('power')) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.13, 'triangle', 0.14, i * 0.06));
  }
  shield() {
    if (!this.ok('shield')) return;
    this.tone(900, 180, 0.35, 'sawtooth', 0.08);
    this.noise(0.25, 0.2, 3000);
  }
  warn() {
    if (!this.ok('warn')) return;
    this.tone(220, 220, 0.12, 'square', 0.08);
    this.tone(220, 220, 0.12, 'square', 0.08, 0.25);
    this.tone(220, 220, 0.12, 'square', 0.08, 0.5);
  }
  slam() {
    if (!this.ok('slam')) return;
    this.noise(0.45, 0.4, 900);
    this.tone(130, 40, 0.45, 'sine', 0.35);
  }
  boom() {
    if (!this.ok('boom')) return;
    this.noise(1.0, 0.5, 2000);
    this.tone(170, 35, 0.9, 'sine', 0.4);
  }
  win() {
    if (!this.ok('win')) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.28, 'triangle', 0.12, i * 0.09));
  }
  buy() { if (this.ok('buy')) this.tone(660, 1100, 0.12, 'square', 0.05); }
  click() { if (this.ok('click')) this.tone(800, 800, 0.03, 'square', 0.035); }
}

export const sfx = new Sfx();
