// Audio engine (WebAudio, fully synthesized — no sample files).
// PUBLIC API (keep stable; game code calls these):
//   audio.init()                       call from a user gesture; safe to call repeatedly
//   audio.sfx(name, { pan=-1..1, vol=0..1, pitch=1 })
//   audio.music(trackId)               'title'|'streets'|'pub'|'underground'|'awayend'|'city'|'industrial'|'derby'|'laststand'|'victory'|'gameover'|null
//   audio.stopMusic()
//   audio.setBoss(bool)                switch current level track to its boss variant / back
//   audio.crowd(intensity 0..1)        crowd ambience bed level (stadium levels), 0 = off
//   audio.chant()                      trigger a supporters' chant phrase
//   audio.setVolumes({ music, sfx })   0..1
// Extras (optional, safe to ignore):
//   audio.registerSfx(name, (engine, t, {pan, vol, pitch}) => {...})   add/override a sound effect
//   audio.ambience(kind|null)          force a background ambience ('street','rain','pub','underground','industrial','stadium')
//   audio.stats()                      debug counters (live tickers / players / crowd)
//
// Signal flow:
//   music  -> musicBus(vol) -> duck -> master
//   sfx    -> sfxBus(vol)            -> master
//   crowd/ambience/chants -> ambBus(vol sfx) -> master
//   each bus also has a post-volume send into one shared synthesized-IR reverb.
//   master -> glue compressor -> brickwall-ish limiter -> destination
//
// src/audio/music.js installs the soundtrack, crowd, chants and ambience through the hooks
//   engine.songPlayer(engine, id) -> { stop(), setBoss(on) }
//   engine.crowdHook(engine, level), engine.chantHook(engine), engine.customSfx[name]
//   engine.crowdReact(kind)   (crowd reaction to KOs etc.)

const MUSIC_SCALE = 0.8;
const AMB_SCALE = 0.85;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// male-ish vowel formants [F1, F2, F3] (Hz)
export const VOWELS = {
  a: [730, 1090, 2440], o: [570, 840, 2410], u: [300, 870, 2240], e: [530, 1840, 2480],
  i: [300, 2200, 2950], ae: [660, 1720, 2410], er: [490, 1350, 1690], uh: [640, 1190, 2390],
  n: [260, 1700, 2600],
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { music: 0.6, sfx: 0.8 };
    this.track = null;
    this.boss = false;
    this.songs = {};
    this.seq = null;
    this.noiseBuf = null;
    this.crowdLevel = 0;
    this.customSfx = {};
    this.tickers = new Set();
    this.recent = new Map();
    this.curves = {};
    this.lastDuck = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let c;
    try { c = new AC({ latencyHint: 'interactive' }); } catch (e) { try { c = new AC(); } catch (e2) { return; } }
    this.ctx = c;

    // ---- master chain
    this.master = c.createGain(); this.master.gain.value = 0.72;
    this.glue = c.createDynamicsCompressor();
    this.glue.threshold.value = -10; this.glue.knee.value = 6; this.glue.ratio.value = 3;
    this.glue.attack.value = 0.003; this.glue.release.value = 0.25;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -2; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001; this.limiter.release.value = 0.08;
    this.master.connect(this.glue); this.glue.connect(this.limiter); this.limiter.connect(c.destination);

    // ---- buses
    this.duck = c.createGain(); this.duck.gain.value = 1; this.duck.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.duck);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.connect(this.master);

    // ---- noise buffers (white / pink / brown)
    const sr = c.sampleRate, len = Math.floor(sr * 2.5);
    const mk = () => c.createBuffer(1, len, sr);
    this.noiseBuf = mk(); this.pinkBuf = mk(); this.brownBuf = mk();
    const w = this.noiseBuf.getChannelData(0), p = this.pinkBuf.getChannelData(0), br = this.brownBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
      last = (last + 0.02 * x) / 1.02; br[i] = last * 3.5;
    }
    // smooth loop seams (short crossfade to the start) so looped beds don't click
    for (const buf of [this.noiseBuf, this.pinkBuf, this.brownBuf]) {
      const d = buf.getChannelData(0), n = 256;
      for (let i = 0; i < n; i++) { const k = i / n; d[len - n + i] = d[len - n + i] * (1 - k) + d[i] * k; }
    }

    // ---- pulse waves (8-bit style) for arps/blips
    this.pulse = {};
    for (const duty of [0.125, 0.25, 0.5]) {
      const N = 48, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) re[n] = Math.sin(Math.PI * n * duty) / n;
      this.pulse[duty] = c.createPeriodicWave(re, im);
    }

    // ---- reverb (synthesized impulse response, ~2.4 s hall)
    this.verb = c.createConvolver();
    this.verb.buffer = this.makeIR(2.4, 2.6);
    this.verbOut = c.createGain(); this.verbOut.gain.value = 0.42;
    this.verb.connect(this.verbOut); this.verbOut.connect(this.master);
    this.musicVerb = c.createGain(); this.musicVerb.connect(this.verb);
    this.sfxVerb = c.createGain(); this.sfxVerb.connect(this.verb);
    this.ambVerb = c.createGain(); this.ambVerb.connect(this.verb);

    this.applyVolumes(true);
    this.startClock();
    document.addEventListener && document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    });

    if (this.onInit) this.onInit(this);
    if (this.pendingTrack !== undefined) {
      const tr = this.pendingTrack, b = this.boss; this.pendingTrack = undefined;
      this.music(tr);
      if (b) this.setBoss(true);
    }
    if (this.crowdLevel > 0 && this.crowdHook) this.crowdHook(this, this.crowdLevel);
  }

  makeIR(seconds, decay) {
    const c = this.ctx, sr = c.sampleRate, n = Math.floor(sr * seconds);
    const buf = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        // gentle low-pass on the tail so it darkens as it decays
        const x = Math.random() * 2 - 1;
        lp += (x - lp) * (0.55 - 0.4 * k);
        const pre = i < sr * 0.012 ? 0 : 1;
        d[i] = lp * Math.pow(1 - k, decay) * pre * 0.9;
      }
      // a few early reflections
      for (let r = 0; r < 6; r++) {
        const at = Math.floor(sr * (0.013 + r * 0.011 + Math.random() * 0.01));
        if (at < n) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - r * 0.06);
      }
    }
    return buf;
  }

  // ---------------------------------------------------------------- clock (robust to tab throttling)
  // A tiny Worker posts a message every 25 ms (worker timers are not throttled like page timers);
  // falls back to setInterval. Every registered ticker is called on each beat of this clock.
  startClock() {
    if (this.clockOn) return;
    this.clockOn = true;
    const tick = () => {
      if (!this.ctx) return;
      for (const fn of this.tickers) {
        try { fn(); } catch (e) { if (!fn._err) { fn._err = true; console.error('[audio] ticker error', e); } }
      }
    };
    this._tick = tick;
    try {
      const src = 'let iv=null;onmessage=e=>{if(e.data==="start"&&!iv){iv=setInterval(()=>postMessage(0),25);}else if(e.data==="stop"){clearInterval(iv);iv=null;}};';
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      this.worker = new Worker(url);
      this.worker.onmessage = tick;
      this.worker.onerror = () => { this.worker = null; if (!this.clockIv) this.clockIv = setInterval(tick, 25); };
      this.worker.postMessage('start');
      // belt and braces: a slow page timer that only matters if the worker never delivers
      this.clockIv2 = setInterval(() => { if (!this.worker && !this.clockIv) this.clockIv = setInterval(tick, 25); }, 1000);
    } catch (e) {
      this.worker = null;
      this.clockIv = setInterval(tick, 25);
    }
  }
  addTicker(fn) { this.tickers.add(fn); return () => this.tickers.delete(fn); }
  removeTicker(fn) { this.tickers.delete(fn); }

  // ---------------------------------------------------------------- volumes / mixing
  setVolumes({ music, sfx } = {}) {
    if (music !== undefined) this.vol.music = clamp(+music || 0, 0, 1);
    if (sfx !== undefined) this.vol.sfx = clamp(+sfx || 0, 0, 1);
    if (this.ctx) this.applyVolumes(false);
  }
  applyVolumes(now) {
    const c = this.ctx, t = c.currentTime;
    const set = (p, v) => { if (now) p.value = v; else { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, 0.03); } };
    const m = this.vol.music * MUSIC_SCALE, s = this.vol.sfx, a = this.vol.sfx * AMB_SCALE;
    set(this.musicBus.gain, m); set(this.musicVerb.gain, m);
    set(this.sfxBus.gain, s); set(this.sfxVerb.gain, s);
    set(this.ambBus.gain, a); set(this.ambVerb.gain, a);
  }

  // duck the music briefly under big impacts
  duckMusic(depth = 0.3, hold = 0.12) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, g = this.duck.gain;
    if (t - this.lastDuck < 0.05) return;
    this.lastDuck = t;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.setTargetAtTime(1 - depth, t, 0.012);
    g.setTargetAtTime(1, t + hold, 0.18);
  }

  // ---------------------------------------------------------------- primitives (also usable by customSfx)
  out(pan, dest) {
    dest = dest || this.sfxBus;
    if (!pan || !this.ctx.createStereoPanner) return dest;
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(dest);
    return p;
  }

  // filtered noise burst. type: biquad type; buf: 'white'|'pink'|'brown'; sweep: end freq multiplier
  noise(t, dur, { vol = 0.5, freq = 1000, q = 1, type = 'bandpass', pan = 0, dest, attack = 0.002, sweep = 0, buf = 'white', rate = 0, verb = 0, hold = 0 } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf === 'pink' ? this.pinkBuf : buf === 'brown' ? this.brownBuf : this.noiseBuf;
    src.playbackRate.value = rate || (0.85 + Math.random() * 0.3);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(clamp(freq, 20, 20000), t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(clamp(freq * sweep, 30, 20000), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    if (hold) g.gain.setValueAtTime(Math.max(0.0002, vol), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + dur);
    src.connect(f); f.connect(g);
    const o = this.out(pan, dest);
    g.connect(o);
    if (verb) { const s = c.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.sfxVerb); }
    src.start(t, Math.random() * 1.5); src.stop(t + attack + hold + dur + 0.05);
    return g;
  }

  tone(t, dur, { freq = 440, to = null, type = 'square', vol = 0.3, pan = 0, dest, attack = 0.003, release = null, wave = null, detune = 0, verb = 0, curve = 'exp' } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    if (wave) o.setPeriodicWave(wave); else o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (detune) o.detune.value = detune;
    if (to) {
      if (curve === 'lin') o.frequency.linearRampToValueAtTime(Math.max(20, to), t + dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    }
    const g = c.createGain();
    const end = t + (release ?? dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g);
    g.connect(this.out(pan, dest));
    if (verb) { const s = c.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.sfxVerb); }
    o.start(t); o.stop(end + 0.05);
    return g;
  }

  // pitched body thump (sine with fast pitch drop)
  thump(t, { f0 = 150, f1 = 50, dur = 0.12, vol = 0.6, pan = 0, dest } = {}) {
    return this.tone(t, dur, { freq: f0, to: f1, type: 'sine', vol, pan, dest, attack: 0.002 });
  }

  // inharmonic metallic ring
  metal(t, { base = 520, ratios = [1, 2.13, 3.41, 4.9], dur = 0.5, vol = 0.2, pan = 0, dest } = {}) {
    const o = this.out(pan, dest);
    ratios.forEach((r, i) => this.tone(t, dur * (1 - i * 0.15), { freq: base * r * (0.99 + Math.random() * 0.02), type: i ? 'sine' : 'triangle', vol: vol / (1 + i * 0.6), dest: o, attack: 0.001 }));
  }

  distCurve(k = 3) {
    if (this.curves[k]) return this.curves[k];
    const n = 2049, cv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i - 1024) / 1024; cv[i] = Math.tanh(x * k) / Math.tanh(k); }
    return (this.curves[k] = cv);
  }

  // formant "voice" (grunts, shouts). vowel key from VOWELS, f0 -> f1 pitch glide
  vox(t, dur, { f0 = 120, f1 = 80, vowel = 'uh', vowel2 = null, vol = 0.3, pan = 0, dest, rough = 0, shift = 1, verb = 0 } = {}) {
    const c = this.ctx, o = this.out(pan, dest);
    const src = c.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0, t);
    src.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const jit = c.createOscillator(); jit.type = 'square'; jit.frequency.value = 23 + Math.random() * 9;
    const jg = c.createGain(); jg.gain.value = f0 * (0.02 + rough * 0.08); jit.connect(jg); jg.connect(src.frequency);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.015);
    env.gain.setValueAtTime(1, t + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let pre = env;
    if (rough > 0) {
      const ws = c.createWaveShaper(); ws.curve = this.distCurve(2 + rough * 6);
      const pg = c.createGain(); pg.gain.value = 1 + rough * 2;
      env.connect(pg); pg.connect(ws); pre = ws;
    }
    src.connect(env);
    const F = VOWELS[vowel] || VOWELS.uh, F2 = vowel2 ? (VOWELS[vowel2] || F) : null;
    const outG = c.createGain(); outG.gain.value = vol * 3.2;
    [1, 0.5, 0.22].forEach((amp, i) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = [5, 7, 9][i];
      bp.frequency.setValueAtTime(F[i] * shift, t);
      if (F2) bp.frequency.linearRampToValueAtTime(F2[i] * shift, t + dur * 0.8);
      const g = c.createGain(); g.gain.value = amp;
      pre.connect(bp); bp.connect(g); g.connect(outG);
    });
    outG.connect(o);
    if (verb) { const s = c.createGain(); s.gain.value = verb; outG.connect(s); s.connect(this.sfxVerb); }
    src.start(t); jit.start(t); src.stop(t + dur + 0.05); jit.stop(t + dur + 0.05);
  }

  // rate limiter: avoid machine-gun stacking of identical sounds
  allow(name, t) {
    let r = this.recent.get(name);
    if (!r) { r = { last: -1, n: 0, win: 0 }; this.recent.set(name, r); }
    if (t - r.win > 0.09) { r.win = t; r.n = 0; }
    if (t - r.last < 0.018 || r.n >= 4) return false;
    r.last = t; r.n++;
    return true;
  }

  // ---------------------------------------------------------------- sound effects
  registerSfx(name, fn) { this.customSfx[name] = fn; }

  sfx(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running' || !name) return;
    const t = this.ctx.currentTime + 0.005;
    if (!this.allow(name, t)) return;
    const pan = clamp(o.pan || 0, -1, 1), v = clamp(o.vol ?? 1, 0, 1.5), pr = (o.pitch || 1) * (0.94 + Math.random() * 0.12);
    const custom = this.customSfx && this.customSfx[name];
    if (custom) { try { custom(this, t, { pan, vol: v, pitch: pr }); } catch (e) { console.error('[audio] customSfx', name, e); } return; }
    try { this.playSfx(name, t, pan, v, pr); } catch (e) { console.error('[audio] sfx', name, e); }
  }

  playSfx(name, t, pan, v, pr) {
    const R = Math.random;
    switch (name) {
      // ---------------- hits
      case 'punch': {
        const o = this.out(pan); const k = (R() * 3) | 0;
        this.noise(t, 0.022, { vol: 0.32 * v, freq: 2600 + k * 500, type: 'highpass', q: 0.7, dest: o });
        this.noise(t, 0.08 + k * 0.01, { vol: 0.5 * v, freq: (1200 + k * 250) * pr, type: 'lowpass', q: 1.1, buf: 'pink', dest: o });
        this.thump(t, { f0: (175 + k * 20) * pr, f1: 58, dur: 0.09, vol: 0.5 * v, dest: o });
        break;
      }
      case 'punchHeavy': {
        const o = this.out(pan);
        this.noise(t, 0.03, { vol: 0.38 * v, freq: 2200, type: 'highpass', q: 0.7, dest: o });
        this.noise(t, 0.06, { vol: 0.3 * v, freq: 900 * pr, q: 1.6, dest: o });
        this.noise(t, 0.13, { vol: 0.55 * v, freq: 1000 * pr, type: 'lowpass', q: 1, buf: 'pink', dest: o });
        this.thump(t, { f0: 135 * pr, f1: 45, dur: 0.15, vol: 0.68 * v, dest: o });
        break;
      }
      case 'kick': {
        const o = this.out(pan);
        this.noise(t, 0.025, { vol: 0.28 * v, freq: 3000, type: 'highpass', dest: o });
        this.noise(t, 0.11, { vol: 0.55 * v, freq: 700 * pr, q: 1.1, buf: 'pink', dest: o });
        this.thump(t, { f0: 115 * pr, f1: 42, dur: 0.16, vol: 0.7 * v, dest: o });
        break;
      }
      case 'hitHeavy': case 'carHit': case 'wallSlam': case 'smash': case 'slam': {
        const o = this.out(pan);
        this.noise(t, 0.05, { vol: 0.42 * v, freq: 1900, type: 'highpass', q: 0.7, dest: o });
        this.noise(t, 0.24, { vol: 0.6 * v, freq: 950, type: 'lowpass', q: 1.2, sweep: 0.35, buf: 'pink', dest: o });
        this.thump(t, { f0: 105 * pr, f1: 32, dur: 0.3, vol: 0.8 * v, dest: o });
        this.tone(t + 0.005, 0.35, { freq: 58, to: 30, type: 'triangle', vol: 0.35 * v, dest: o });
        if (name === 'carHit') { this.metal(t, { base: 310 * pr, dur: 0.6, vol: 0.18 * v, dest: o }); this.noise(t + 0.02, 0.4, { vol: 0.25 * v, freq: 3500, type: 'highpass', dest: o }); }
        if (name === 'wallSlam') this.noise(t + 0.03, 0.35, { vol: 0.3 * v, freq: 450, q: 0.8, buf: 'brown', type: 'lowpass', dest: o });
        if (v > 0.4) this.duckMusic(0.28, 0.12);
        break;
      }
      case 'slap': {
        const o = this.out(pan);
        this.noise(t, 0.05, { vol: 0.55 * v, freq: 2100 * pr, q: 0.8, dest: o });
        this.noise(t, 0.025, { vol: 0.3 * v, freq: 4500, type: 'highpass', dest: o });
        this.thump(t, { f0: 240, f1: 120, dur: 0.04, vol: 0.2 * v, dest: o });
        break;
      }
      case 'stomp': {
        const o = this.out(pan);
        this.thump(t, { f0: 95 * pr, f1: 34, dur: 0.17, vol: 0.75 * v, dest: o });
        this.noise(t, 0.1, { vol: 0.45 * v, freq: 520, type: 'lowpass', buf: 'pink', dest: o });
        this.noise(t, 0.02, { vol: 0.2 * v, freq: 2500, type: 'highpass', dest: o });
        break;
      }
      case 'weapon': {
        const o = this.out(pan);
        this.thump(t, { f0: 150 * pr, f1: 55, dur: 0.12, vol: 0.55 * v, dest: o });
        this.noise(t, 0.09, { vol: 0.45 * v, freq: 1300 * pr, q: 1.4, buf: 'pink', dest: o });
        this.metal(t, { base: 700 * pr, dur: 0.22, vol: 0.12 * v, dest: o });
        break;
      }
      case 'metal': case 'clang': case 'pipe': {
        const o = this.out(pan);
        this.noise(t, 0.03, { vol: 0.35 * v, freq: 3500, type: 'highpass', dest: o });
        this.metal(t, { base: 480 * pr, ratios: [1, 2.31, 3.56, 5.12, 6.7], dur: 0.7, vol: 0.22 * v, dest: o });
        this.thump(t, { f0: 160, f1: 70, dur: 0.07, vol: 0.3 * v, dest: o });
        break;
      }
      case 'clatter': {
        const o = this.out(pan);
        for (let i = 0; i < 5; i++) {
          const tt = t + i * (0.04 + R() * 0.05), vv = v * (1 - i * 0.16);
          this.metal(tt, { base: (600 + R() * 900) * pr, ratios: [1, 2.4, 3.9], dur: 0.18, vol: 0.12 * vv, dest: o });
          this.noise(tt, 0.02, { vol: 0.18 * vv, freq: 3000, type: 'highpass', dest: o });
        }
        break;
      }
      case 'wood': case 'crate': {
        const o = this.out(pan);
        this.noise(t, 0.11, { vol: 0.6 * v, freq: 620 * pr, q: 3.5, dest: o });
        this.tone(t, 0.09, { freq: 210 * pr, to: 115, type: 'triangle', vol: 0.32 * v, dest: o });
        for (let i = 0; i < 4; i++) this.noise(t + 0.02 + R() * 0.12, 0.025, { vol: 0.18 * v, freq: 1800 + R() * 1500, q: 4, dest: o });
        break;
      }
      case 'glass': case 'bottle': {
        const o = this.out(pan);
        this.noise(t, 0.04, { vol: 0.4 * v, freq: 2600, q: 1.5, dest: o });
        this.noise(t, 0.32, { vol: 0.38 * v, freq: 4800, type: 'highpass', sweep: 1.4, dest: o, verb: 0.15 });
        for (let i = 0; i < 9; i++) this.tone(t + R() * 0.28, 0.06 + R() * 0.16, { freq: 2600 + R() * 4200, type: R() < 0.5 ? 'sine' : 'triangle', vol: 0.09 * v, dest: o, attack: 0.001 });
        break;
      }
      case 'block': {
        const o = this.out(pan);
        this.noise(t, 0.05, { vol: 0.45 * v, freq: 1500, q: 3, dest: o });
        this.tone(t, 0.05, { freq: 320, to: 260, type: 'square', vol: 0.08 * v, dest: o });
        this.thump(t, { f0: 200, f1: 110, dur: 0.05, vol: 0.3 * v, dest: o });
        break;
      }
      case 'guardBreak': {
        const o = this.out(pan);
        this.noise(t, 0.06, { vol: 0.45 * v, freq: 2000, q: 1, dest: o });
        this.tone(t, 0.32, { freq: 620, to: 140, type: 'sawtooth', vol: 0.16 * v, dest: o });
        this.tone(t, 0.32, { freq: 640, to: 150, type: 'square', vol: 0.08 * v, dest: o });
        this.thump(t, { f0: 140, f1: 50, dur: 0.15, vol: 0.5 * v, dest: o });
        break;
      }
      // ---------------- movement
      case 'whoosh': this.noise(t, 0.13, { vol: 0.55 * v, freq: 650 * pr, q: 1.3, pan, sweep: 3.2, attack: 0.04, buf: 'pink' }); break;
      case 'whooshLight': this.noise(t, 0.08, { vol: 0.36 * v, freq: 950 * pr, q: 1.4, pan, sweep: 2.6, attack: 0.025, buf: 'pink' }); break;
      case 'whooshBig': case 'swing': {
        const o = this.out(pan);
        this.noise(t, 0.24, { vol: 0.65 * v, freq: 380 * pr, q: 1, sweep: 4, attack: 0.06, buf: 'pink', dest: o });
        this.noise(t + 0.03, 0.18, { vol: 0.25 * v, freq: 1400 * pr, q: 2, sweep: 2, attack: 0.05, dest: o });
        break;
      }
      case 'jump': {
        const o = this.out(pan);
        this.noise(t, 0.07, { vol: 0.25 * v, freq: 1400, q: 1, sweep: 1.8, attack: 0.02, dest: o });
        this.tone(t, 0.09, { freq: 210, to: 430, wave: this.pulse[0.25], vol: 0.035 * v, dest: o });
        break;
      }
      case 'land': {
        const o = this.out(pan);
        this.noise(t, 0.07, { vol: 0.26 * v, freq: 420, type: 'lowpass', buf: 'pink', dest: o });
        this.thump(t, { f0: 85, f1: 50, dur: 0.06, vol: 0.22 * v, dest: o });
        break;
      }
      case 'dodge': {
        const o = this.out(pan);
        this.noise(t, 0.18, { vol: 0.45 * v, freq: 1300, q: 1, sweep: 0.35, attack: 0.03, buf: 'pink', dest: o });
        this.noise(t + 0.12, 0.05, { vol: 0.1 * v, freq: 2500, q: 2, dest: o });
        break;
      }
      case 'fall': case 'thud': {
        const o = this.out(pan);
        this.thump(t, { f0: 80, f1: 34, dur: 0.24, vol: 0.75 * v, dest: o });
        this.noise(t, 0.2, { vol: 0.45 * v, freq: 380, type: 'lowpass', buf: 'pink', dest: o });
        this.noise(t, 0.04, { vol: 0.2 * v, freq: 1600, q: 1, dest: o });
        if (v > 0.5) this.duckMusic(0.15, 0.08);
        break;
      }
      case 'grab': {
        const o = this.out(pan);
        this.noise(t, 0.08, { vol: 0.5 * v, freq: 1000, q: 1.4, buf: 'pink', dest: o });
        this.thump(t, { f0: 160, f1: 100, dur: 0.05, vol: 0.18 * v, dest: o });
        break;
      }
      case 'throw': {
        const o = this.out(pan);
        this.vox(t, 0.16, { f0: 150 * pr, f1: 110, vowel: 'uh', vowel2: 'a', vol: 0.18 * v, dest: o });
        this.noise(t + 0.03, 0.22, { vol: 0.55 * v, freq: 450, q: 1, sweep: 3.5, attack: 0.05, buf: 'pink', dest: o });
        break;
      }
      // ---------------- voices
      case 'grunt': {
        const vw = ['uh', 'a', 'o', 'er'][(R() * 4) | 0];
        this.vox(t, 0.1 + R() * 0.06, { f0: (105 + R() * 55) * pr, f1: 72, vowel: vw, vol: 0.22 * v, pan, rough: R() * 0.4 });
        break;
      }
      case 'hurtPlayer': this.vox(t, 0.16, { f0: 170 * pr, f1: 105, vowel: R() < 0.5 ? 'o' : 'a', vowel2: 'uh', vol: 0.26 * v, pan, rough: 0.2 }); break;
      case 'ko': {
        this.vox(t, 0.45, { f0: 190 * pr, f1: 70, vowel: 'a', vowel2: 'o', vol: 0.24 * v, pan, rough: 0.35 });
        if (this.crowdReact) this.crowdReact('ko', v);
        break;
      }
      case 'bossKO': {
        const o = this.out(pan);
        this.vox(t, 1.1, { f0: 130, f1: 42, vowel: 'a', vowel2: 'u', vol: 0.32 * v, dest: o, rough: 0.8 });
        this.thump(t, { f0: 80, f1: 24, dur: 1.2, vol: 0.8 * v, dest: o });
        this.noise(t, 1.0, { vol: 0.5 * v, freq: 320, type: 'lowpass', buf: 'brown', dest: o });
        this.noise(t + 0.05, 1.6, { vol: 0.2 * v, freq: 5000, type: 'highpass', dest: o, verb: 0.4 });
        this.duckMusic(0.45, 0.5);
        if (this.crowdReact) this.crowdReact('bossKO', 1);
        break;
      }
      case 'bossRoar': case 'roar': {
        const o = this.out(pan);
        this.vox(t, 0.8, { f0: 92 * pr, f1: 60, vowel: 'a', vowel2: 'o', vol: 0.32 * v, dest: o, rough: 1, verb: 0.3 });
        this.vox(t + 0.02, 0.75, { f0: 61 * pr, f1: 45, vowel: 'o', vol: 0.2 * v, dest: o, rough: 1 });
        this.noise(t, 0.6, { vol: 0.25 * v, freq: 500, q: 1.5, attack: 0.08, buf: 'pink', dest: o });
        break;
      }
      // ---------------- pickups / rewards
      case 'pickup': {
        const w = this.pulse[0.25];
        this.tone(t, 0.06, { freq: 784, wave: w, vol: 0.17 * v }); this.tone(t + 0.055, 0.1, { freq: 1175, wave: w, vol: 0.17 * v });
        break;
      }
      case 'pickupWeapon': {
        this.noise(t, 0.12, { vol: 0.2 * v, freq: 4000, type: 'highpass', sweep: 1.5, pan });
        this.metal(t, { base: 900, ratios: [1, 2.7], dur: 0.25, vol: 0.1 * v, pan });
        this.tone(t, 0.08, { freq: 330, wave: this.pulse[0.5], vol: 0.07 * v });
        break;
      }
      case 'coin': case 'cash': {
        const w = this.pulse[0.5];
        this.tone(t, 0.04, { freq: 1175, wave: w, vol: 0.14 * v }); this.tone(t + 0.04, 0.16, { freq: 1568, wave: w, vol: 0.14 * v });
        this.tone(t + 0.04, 0.12, { freq: 3136, type: 'sine', vol: 0.03 * v });
        break;
      }
      case 'heal': [440, 554, 659, 880].forEach((f, i) => this.tone(t + i * 0.05, 0.14, { freq: f, type: 'triangle', vol: 0.14 * v })); break;
      case 'drink': {
        for (let i = 0; i < 3; i++) { this.tone(t + i * 0.13, 0.08, { freq: 260 + i * 30, to: 480, type: 'sine', vol: 0.18 * v }); this.noise(t + i * 0.13, 0.07, { vol: 0.1 * v, freq: 600, q: 4 }); }
        this.vox(t + 0.42, 0.32, { f0: 140, f1: 105, vowel: 'a', vowel2: 'uh', vol: 0.14 * v });
        [523, 659, 784].forEach((f, i) => this.tone(t + 0.4 + i * 0.05, 0.12, { freq: f, type: 'triangle', vol: 0.09 * v }));
        break;
      }
      case 'eat': {
        for (let i = 0; i < 3; i++) this.noise(t + i * 0.12, 0.06, { vol: 0.28 * v, freq: 1200 + R() * 800, q: 2, buf: 'pink' });
        [523, 659, 784].forEach((f, i) => this.tone(t + 0.36 + i * 0.05, 0.12, { freq: f, type: 'triangle', vol: 0.09 * v }));
        break;
      }
      case 'scarf': case 'badge': {
        const w = this.pulse[0.25];
        [659, 784, 988, 1319].forEach((f, i) => this.tone(t + i * 0.065, 0.14, { freq: f, wave: w, vol: 0.1 * v, verb: 0.2 }));
        this.tone(t + 0.26, 0.4, { freq: 2637, type: 'sine', vol: 0.04 * v, verb: 0.3 });
        break;
      }
      case 'key': {
        for (let i = 0; i < 4; i++) this.metal(t + i * 0.035 + R() * 0.02, { base: 2400 + R() * 1600, ratios: [1, 1.5], dur: 0.12, vol: 0.06 * v });
        [880, 1319].forEach((f, i) => this.tone(t + 0.12 + i * 0.07, 0.16, { freq: f, wave: this.pulse[0.25], vol: 0.09 * v }));
        break;
      }
      case 'life': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(t + i * 0.06, 0.1, { freq: f, wave: this.pulse[0.25], vol: 0.1 * v, verb: 0.1 })); break;
      case 'secret': [392, 494, 587, 740, 880, 1175].forEach((f, i) => { this.tone(t + i * 0.055, 0.25, { freq: f, type: 'triangle', vol: 0.13 * v, verb: 0.4 }); this.tone(t + i * 0.055 + 0.28, 0.2, { freq: f * 2, type: 'sine', vol: 0.03 * v }); }); break;
      case 'combo': this.tone(t, 0.12, { freq: 880, to: 1320, wave: this.pulse[0.25], vol: 0.08 * v }); this.tone(t + 0.08, 0.1, { freq: 1760, type: 'sine', vol: 0.05 * v }); break;
      // ---------------- world
      case 'door': case 'gate': {
        const o = this.out(pan);
        const src = this.ctx.createOscillator(); src.type = 'sawtooth';
        src.frequency.setValueAtTime(70, t); src.frequency.linearRampToValueAtTime(110, t + 0.3); src.frequency.linearRampToValueAtTime(60, t + 0.45);
        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.setValueAtTime(600, t); bp.frequency.linearRampToValueAtTime(1100, t + 0.4);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
        src.connect(bp); bp.connect(g); g.connect(o); src.start(t); src.stop(t + 0.52);
        this.thump(t + 0.46, { f0: 120, f1: 55, dur: 0.12, vol: 0.4 * v, dest: o });
        this.noise(t + 0.46, 0.08, { vol: 0.25 * v, freq: 500, type: 'lowpass', buf: 'pink', dest: o });
        break;
      }
      case 'locked': {
        for (let i = 0; i < 3; i++) this.metal(t + i * 0.05, { base: 1500 + R() * 400, ratios: [1, 1.7], dur: 0.06, vol: 0.08 * v, pan });
        this.tone(t + 0.12, 0.07, { freq: 196, wave: this.pulse[0.5], vol: 0.09 * v }); this.tone(t + 0.21, 0.1, { freq: 147, wave: this.pulse[0.5], vol: 0.09 * v });
        break;
      }
      case 'horn': case 'carHorn': {
        const o = this.out(pan);
        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.02); g.gain.setValueAtTime(0.2 * v, t + 0.38); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        bp.connect(g); g.connect(o);
        for (const f of [349, 440]) { const os = this.ctx.createOscillator(); os.type = 'square'; os.frequency.value = f * pr; os.connect(bp); os.start(t); os.stop(t + 0.48); }
        break;
      }
      case 'zap': case 'electric': {
        const o = this.out(pan);
        this.noise(t, 0.22, { vol: 0.35 * v, freq: 3200, q: 6, dest: o });
        for (let i = 0; i < 4; i++) this.noise(t + i * 0.05, 0.03, { vol: 0.3 * v, freq: 5000, type: 'highpass', dest: o });
        this.tone(t, 0.24, { freq: 110, to: 90, type: 'sawtooth', vol: 0.16 * v, dest: o });
        break;
      }
      case 'fire': case 'flare': case 'hiss': case 'steam': this.noise(t, 0.7, { vol: 0.25 * v, freq: 3500, q: 0.6, attack: 0.08, hold: 0.2, pan, buf: 'white', type: 'highpass' }); break;
      case 'explosion': case 'boom': {
        const o = this.out(pan);
        this.thump(t, { f0: 70, f1: 22, dur: 1.0, vol: 0.9 * v, dest: o });
        this.noise(t, 1.2, { vol: 0.7 * v, freq: 700, type: 'lowpass', sweep: 0.2, buf: 'brown', dest: o });
        this.noise(t, 0.3, { vol: 0.4 * v, freq: 2500, type: 'highpass', dest: o, verb: 0.4 });
        this.duckMusic(0.5, 0.4);
        break;
      }
      case 'splash': case 'water': this.noise(t, 0.4, { vol: 0.35 * v, freq: 1800, q: 0.7, sweep: 0.4, attack: 0.01, pan }); for (let i = 0; i < 5; i++) this.tone(t + R() * 0.3, 0.05, { freq: 600 + R() * 900, to: 1500, type: 'sine', vol: 0.06 * v, pan }); break;
      case 'bell': case 'ding': this.metal(t, { base: 880 * pr, ratios: [1, 2.0, 2.76, 5.4], dur: 1.4, vol: 0.18 * v, pan }); break;
      case 'whistle': case 'referee': {
        const o = this.out(pan);
        const os = this.ctx.createOscillator(); os.type = 'sine'; os.frequency.value = 2950 * pr;
        const am = this.ctx.createOscillator(); am.frequency.value = 38; const amg = this.ctx.createGain(); amg.gain.value = 140; am.connect(amg); amg.connect(os.frequency);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13 * v, t + 0.02); g.gain.setValueAtTime(0.13 * v, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        g.gain.setValueAtTime(0.0001, t + 0.36); g.gain.exponentialRampToValueAtTime(0.13 * v, t + 0.38); g.gain.setValueAtTime(0.13 * v, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        os.connect(g); g.connect(o); os.start(t); am.start(t); os.stop(t + 0.95); am.stop(t + 0.95);
        break;
      }
      case 'siren': case 'alarm': {
        const o = this.out(pan);
        const os = this.ctx.createOscillator(); os.type = 'square';
        for (let i = 0; i < 4; i++) { os.frequency.setValueAtTime(i % 2 ? 660 : 880, t + i * 0.4); }
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08 * v, t + 0.03); g.gain.setValueAtTime(0.08 * v, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.62);
        os.connect(lp); lp.connect(g); g.connect(o); os.start(t); os.stop(t + 1.65);
        break;
      }
      case 'train': case 'rumble': case 'thunder': this.noise(t, 2.2, { vol: 0.45 * v, freq: 180, type: 'lowpass', attack: 0.5, hold: 0.6, buf: 'brown', pan }); this.thump(t, { f0: 60, f1: 30, dur: 1.5, vol: 0.3 * v }); break;
      case 'engine': case 'forklift': case 'motor': this.tone(t, 0.8, { freq: 55 * pr, to: 75, type: 'sawtooth', vol: 0.12 * v, pan, attack: 0.1 }); this.noise(t, 0.8, { vol: 0.15 * v, freq: 300, type: 'lowpass', attack: 0.1, buf: 'brown', pan }); break;
      case 'bark': case 'dog': for (let i = 0; i < 2; i++) this.vox(t + i * 0.22, 0.12, { f0: 380, f1: 260, vowel: 'a', vowel2: 'uh', vol: 0.2 * v, pan, rough: 0.6, shift: 1.4 }); break;
      case 'tannoy': case 'beep': this.tone(t, 0.25, { freq: 784, type: 'sine', vol: 0.1 * v, verb: 0.4 }); this.tone(t + 0.25, 0.4, { freq: 523, type: 'sine', vol: 0.1 * v, verb: 0.4 }); break;
      case 'laugh': for (let i = 0; i < 4; i++) this.vox(t + i * 0.14, 0.11, { f0: 180 - i * 8, f1: 150 - i * 8, vowel: 'a', vol: 0.18 * v, pan }); break;
      // ---------------- menus / UI
      case 'menuMove': this.tone(t, 0.04, { freq: 988, wave: this.pulse[0.25], vol: 0.13 * v }); break;
      case 'menuSelect': this.tone(t, 0.05, { freq: 659, wave: this.pulse[0.25], vol: 0.09 * v }); this.tone(t + 0.05, 0.12, { freq: 1319, wave: this.pulse[0.25], vol: 0.09 * v }); this.thump(t, { f0: 120, f1: 60, dur: 0.06, vol: 0.2 * v }); break;
      case 'menuBack': this.tone(t, 0.09, { freq: 523, to: 262, wave: this.pulse[0.5], vol: 0.08 * v }); break;
      case 'pause': this.tone(t, 0.07, { freq: 784, type: 'triangle', vol: 0.13 * v }); this.tone(t + 0.07, 0.1, { freq: 523, type: 'triangle', vol: 0.13 * v }); break;
      case 'encounter': {
        const w = this.pulse[0.5];
        this.tone(t, 0.09, { freq: 147, wave: w, vol: 0.09 * v }); this.tone(t + 0.1, 0.18, { freq: 156, wave: w, vol: 0.1 * v });
        this.thump(t + 0.1, { f0: 110, f1: 45, dur: 0.2, vol: 0.35 * v });
        break;
      }
      case 'clear': case 'go': {
        const w = this.pulse[0.25];
        this.tone(t, 0.08, { freq: 587, wave: w, vol: 0.09 * v }); this.tone(t + 0.09, 0.2, { freq: 880, wave: w, vol: 0.09 * v, verb: 0.2 });
        if (this.crowdReact) this.crowdReact('clear', 0.6);
        break;
      }
      case 'bossIntro': {
        const o = this.out(0);
        this.thump(t, { f0: 90, f1: 28, dur: 1.4, vol: 0.75 * v, dest: o });
        this.noise(t, 2.0, { vol: 0.16 * v, freq: 5000, type: 'highpass', dest: o, verb: 0.5 });
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.5); lp.frequency.exponentialRampToValueAtTime(300, t + 1.6);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
        lp.connect(g); g.connect(o); const s = this.ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(this.sfxVerb);
        for (const [f, d] of [[49, -8], [49, 8], [73.4, 0], [98, 5], [58.3, -4]]) { const os = this.ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.value = f; os.detune.value = d; os.connect(lp); os.start(t); os.stop(t + 1.75); }
        this.duckMusic(0.4, 0.6);
        break;
      }
      case 'crowdCheer': case 'cheer': if (this.crowdFx) this.crowdFx.cheer(t, v); else this.noise(t, 1.8, { vol: 0.4 * v, freq: 900, q: 0.6, attack: 0.3, buf: 'pink' }); break;
      case 'crowdBoo': case 'boo': if (this.crowdFx) this.crowdFx.boo(t, v); else this.vox(t, 1.2, { f0: 110, f1: 90, vowel: 'u', vol: 0.2 * v }); break;
      case 'crowdOoh': case 'ooh': if (this.crowdFx) this.crowdFx.ooh(t, v); else this.vox(t, 0.8, { f0: 160, f1: 120, vowel: 'o', vowel2: 'u', vol: 0.18 * v }); break;
      case 'chant': this.chant(); break;
      case 'levelComplete': {
        const w = this.pulse[0.25];
        [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3], [784, 0.48], [1047, 0.58]].forEach(([f, d], i) => {
          this.tone(t + d, i === 5 ? 0.6 : 0.12, { freq: f, wave: w, vol: 0.11 * v, verb: 0.25 });
          this.tone(t + d, i === 5 ? 0.6 : 0.12, { freq: f / 2, type: 'triangle', vol: 0.09 * v });
        });
        this.noise(t + 0.58, 1.4, { vol: 0.12 * v, freq: 6000, type: 'highpass', verb: 0.4 });
        if (this.crowdReact) this.crowdReact('win', 1);
        break;
      }
      case 'playerDown': {
        this.vox(t, 0.6, { f0: 200, f1: 70, vowel: 'a', vowel2: 'o', vol: 0.24 * v, rough: 0.3 });
        [392, 370, 349, 330, 311, 294].forEach((f, i) => this.tone(t + 0.15 + i * 0.09, 0.1, { freq: f, wave: this.pulse[0.5], vol: 0.08 * v }));
        this.thump(t + 0.1, { f0: 90, f1: 30, dur: 0.3, vol: 0.6 * v });
        if (this.crowdReact) this.crowdReact('down', 0.8);
        break;
      }
      case 'gameOver': {
        this.thump(t, { f0: 70, f1: 30, dur: 1.5, vol: 0.6 * v });
        this.metal(t, { base: 196, ratios: [1, 2.0, 2.76, 4.07], dur: 2.5, vol: 0.18 * v });
        break;
      }
      case 'respawn': [392, 523, 659, 784].forEach((f, i) => this.tone(t + i * 0.07, 0.14, { freq: f, wave: this.pulse[0.25], vol: 0.1 * v, verb: 0.2 })); break;
      default: this.fallbackSfx(name, t, pan, v, pr);
    }
  }

  // unknown names: guess from the name, else a soft generic thud (never silent, never loud)
  fallbackSfx(name, t, pan, v, pr) {
    const n = String(name).toLowerCase();
    const map = [
      [/glass|bottle|window|shatter/, 'glass'], [/metal|clang|steel|pipe|chain|bin|fence|gate/, 'metal'],
      [/wood|crate|table|chair|barrel|plank/, 'wood'], [/punch|hit|smack|smash|crash|slam/, 'hitHeavy'],
      [/door|hatch/, 'door'], [/train|rumble|thunder|quake/, 'train'], [/siren|alarm/, 'siren'],
      [/explo|boom|blast/, 'explosion'], [/whoosh|swing|swish/, 'whoosh'], [/cheer|goal|roar/, 'crowdCheer'],
      [/boo|jeer/, 'crowdBoo'], [/splash|water|puddle|drip/, 'splash'], [/horn|car|van|bus/, 'horn'],
      [/bell|ding|chime/, 'bell'], [/whistle|ref/, 'whistle'], [/fire|flare|smoke|steam|hiss/, 'flare'],
      [/chant|song|sing/, 'chant'], [/coin|cash|money/, 'coin'], [/pickup|item|collect|get/, 'pickup'],
      [/key/, 'key'], [/secret/, 'secret'], [/heal|health|drink|pint/, 'heal'], [/zap|elec|spark/, 'zap'],
      [/engine|motor|forklift|truck/, 'engine'], [/dog|bark/, 'bark'], [/laugh/, 'laugh'], [/beep|tannoy|pa\b|announce/, 'tannoy'],
      [/menu|click|select|ui/, 'menuMove'], [/fall|drop|land|thud/, 'fall'],
    ];
    for (const [re, to] of map) if (re.test(n) && to !== name) { this.playSfx(to, t, pan, v, pr); return; }
    const o = this.out(pan);
    this.noise(t, 0.06, { vol: 0.22 * v, freq: 900 * pr, q: 1, buf: 'pink', dest: o });
    this.thump(t, { f0: 140 * pr, f1: 70, dur: 0.07, vol: 0.2 * v, dest: o });
  }

  // ---------------------------------------------------------------- music
  registerSongs(songs) { Object.assign(this.songs, songs); }

  music(id) {
    if (!this.ctx) { this.pendingTrack = id; return; }
    if (this.track === id && this.seq) return;
    this.stopMusic();
    this.track = id;
    this.boss = false;
    if (!id) return;
    try {
      if (this.songPlayer) { this.seq = this.songPlayer(this, id); return; }
    } catch (e) { console.error('[audio] songPlayer failed, using fallback', e); }
    this.seq = this.basicSong(id);
  }

  stopMusic() {
    if (this.seq && this.seq.stop) { try { this.seq.stop(); } catch (e) { console.error(e); } }
    this.seq = null; this.track = null;
    if (!this.ctx) this.pendingTrack = undefined;
  }

  setBoss(on) {
    on = !!on;
    if (this.boss === on) return;
    this.boss = on;
    if (this.seq && this.seq.setBoss) this.seq.setBoss(on);
  }

  crowd(level) {
    this.crowdLevel = clamp(+level || 0, 0, 1);
    if (this.crowdHook && this.ctx) this.crowdHook(this, this.crowdLevel);
  }

  chant() { if (this.chantHook && this.ctx) this.chantHook(this); }

  ambience(kind) { this.ambienceOverride = kind === undefined ? undefined : kind; if (this.ambienceHook && this.ctx) this.ambienceHook(this, kind); }

  stats() {
    return { ctx: this.ctx ? this.ctx.state : 'none', track: this.track, boss: this.boss, tickers: this.tickers.size, crowd: this.crowdLevel, ...(this.statsHook ? this.statsHook() : {}) };
  }

  // minimal fallback sequencer (only used if music.js failed to install)
  basicSong(id) {
    const c = this.ctx;
    const root = 110 * Math.pow(2, ((id || '').length % 5) / 12);
    let step = 0;
    const bpm = id === 'title' ? 118 : 132;
    const spb = 60 / bpm / 4;
    let next = c.currentTime + 0.1;
    const bassLine = [0, 0, 7, 0, 5, 0, 3, 5];
    const tick = () => {
      if (next < c.currentTime - 0.2) next = c.currentTime + 0.02;
      while (next < c.currentTime + 0.2) {
        const s = step % 16, boss = this.boss;
        if (s % 4 === 0) this.tone(next, 0.15, { freq: 140, to: 40, type: 'sine', vol: 0.5, dest: this.musicBus });
        if (s % 8 === 4) this.noise(next, 0.12, { vol: 0.35, freq: 1800, q: 0.8, dest: this.musicBus });
        if (s % 2 === 1 || boss) this.noise(next, 0.03, { vol: 0.1, freq: 8000, type: 'highpass', dest: this.musicBus });
        if (s % 2 === 0) this.tone(next, spb * 1.8, { freq: root * Math.pow(2, bassLine[(step >> 1) % 8] / 12) / 2, type: 'sawtooth', vol: 0.12, dest: this.musicBus, attack: 0.005 });
        next += boss ? spb * 0.85 : spb;
        step++;
      }
    };
    this.addTicker(tick);
    tick();
    return { stop: () => this.removeTicker(tick), setBoss: () => {} };
  }
}

export const audio = new AudioEngine();
