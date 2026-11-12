/* 03-audio — 程序化音频：WebAudio 实时合成，零音频文件（沿袭《几猫港区》）。
   五声音阶（宫商角徵羽）配乐层 + 劳作/战斗/UI/升级音效登记制。 */
'use strict';

const Sound = window.Sound = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let enabled = true;
  const registry = {};   // name -> {gain, pan, ...}

  function ensure() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = .28; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = .6; sfxGain.connect(master);
    return ctx;
  }
  function resume() { if (enabled) { ensure(); if (ctx.state === 'suspended') ctx.resume(); } }
  function setEnabled(v) { enabled = !!v; if (!v) stopMusic(); }
  function setVolume(v, m) { if (!enabled) return; ensure(); if (v !== undefined) sfxGain.gain.value = .6 * v; if (m !== undefined) musicGain.gain.value = .28 * m; }

  // 通用合成基元
  function tone({ f = 440, f2 = null, type = 'sine', dur = .18, vol = .5, attack = .005, delay = 0, dest = null }) {
    ensure();
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise({ dur = .2, vol = .4, type = 'lowpass', freq = 900, q = 1, delay = 0, slide = null, dest = null }) {
    ensure();
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest || sfxGain);
    src.start(t0); src.stop(t0 + dur + .02);
  }
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0];  // 宫商角徵羽 (C D E G A)
  const penta = (i) => PENTA[((i % 5) + 5) % 5] * Math.pow(2, Math.floor(i / 5) % 2);

  /* ---- 音效登记表 -------------------------------------------------------- */
  const SFX = {
    till: () => { noise({ dur: .16, vol: .4, freq: 500, slide: 180 }); tone({ f: 120, f2: 70, type: 'triangle', dur: .12, vol: .3 }); },
    plant: () => { tone({ f: penta(2), type: 'sine', dur: .12, vol: .35 }); tone({ f: penta(4), dur: .14, vol: .3, delay: .07 }); },
    water: () => { noise({ dur: .3, vol: .22, type: 'highpass', freq: 1200, slide: 300 }); tone({ f: 700, f2: 1400, type: 'sine', dur: .25, vol: .1 }); },
    harvest: () => { tone({ f: penta(5), dur: .12, vol: .4 }); tone({ f: penta(7), dur: .14, vol: .35, delay: .08 }); tone({ f: penta(9), dur: .2, vol: .3, delay: .16 }); },
    coin: () => { tone({ f: 1200, f2: 1800, type: 'square', dur: .08, vol: .12 }); tone({ f: 1800, f2: 2400, type: 'square', dur: .1, vol: .1, delay: .06 }); },
    swing: () => { noise({ dur: .12, vol: .3, type: 'bandpass', freq: 1600, slide: 600 }); },
    hit: () => { tone({ f: 300, f2: 120, type: 'square', dur: .08, vol: .3 }); noise({ dur: .08, vol: .25, freq: 2200 }); },
    kill: () => { tone({ f: 200, f2: 60, type: 'sawtooth', dur: .25, vol: .35 }); noise({ dur: .3, vol: .3, freq: 900, slide: 120 }); },
    shoot: () => { tone({ f: 880, f2: 300, type: 'triangle', dur: .09, vol: .22 }); },
    cannon: () => { tone({ f: 160, f2: 50, type: 'square', dur: .25, vol: .4 }); noise({ dur: .35, vol: .35, freq: 500, slide: 80 }); },
    zap: () => { tone({ f: 1400, f2: 200, type: 'sawtooth', dur: .12, vol: .25 }); noise({ dur: .15, vol: .2, type: 'highpass', freq: 3000 }); },
    build: () => { tone({ f: penta(0), dur: .1, vol: .3 }); tone({ f: penta(2), dur: .1, vol: .3, delay: .08 }); tone({ f: penta(4), dur: .18, vol: .32, delay: .16 }); },
    upgrade: () => { for (let i = 0; i < 4; i++) tone({ f: penta(i + 3), dur: .12, vol: .25, delay: i * .06 }); },
    quest: () => { tone({ f: penta(7), dur: .3, vol: .3 }); tone({ f: penta(10), dur: .5, vol: .3, delay: .2 }); },
    hurt: () => { tone({ f: 220, f2: 80, type: 'square', dur: .2, vol: .35 }); },
    breakthrough: () => { for (let i = 0; i < 7; i++) tone({ f: penta(i), dur: .3 + i * .06, vol: .22, delay: i * .1 }); noise({ dur: 1.2, vol: .15, freq: 400, slide: 4000, delay: .4 }); },
    ui: () => { tone({ f: 900, type: 'square', dur: .05, vol: .1 }); },
    error: () => { tone({ f: 200, f2: 140, type: 'square', dur: .2, vol: .2 }); },
    deny: () => { tone({ f: 160, type: 'square', dur: .1, vol: .15 }); tone({ f: 120, type: 'square', dur: .12, vol: .15, delay: .09 }); },
    freeze: () => { noise({ dur: .8, vol: .2, type: 'highpass', freq: 5000, slide: 1500 }); },
  };
  function play(name) { if (!enabled) return; const fn = SFX[name]; if (fn) { try { resume(); fn(); } catch {} } }

  /* ---- 音乐层：五声音阶循环琶音 + 低音，随昼夜调亮暗 --------------------- */
  let musicTimer = null, stepIdx = 0;
  function startMusic() {
    if (!enabled) return;
    ensure(); if (musicTimer) return;
    stepIdx = 0;
    musicTimer = setInterval(() => {
      if (!enabled) return;
      const bar = (stepIdx / 8) | 0;
      const root = penta(0) / 2;
      const chords = [[0, 2, 4], [3, 5, 7], [2, 4, 6], [4, 6, 8]];   // 宫调式和声循环
      const ch = chords[bar % 4];
      if (stepIdx % 8 === 0) tone({ f: root * (bar % 2 ? 1.5 : 1), type: 'triangle', dur: 1.4, vol: .16, dest: musicGain });
      const n = ch[stepIdx % 3];
      tone({ f: penta(n), type: 'sine', dur: .5, vol: .09, dest: musicGain });
      stepIdx = (stepIdx + 1) % 32;
    }, 420);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  function intensity(v) { if (!enabled) return; ensure(); musicGain.gain.value = .18 + .2 * clamp(v, 0, 1); }

  return { resume, play, setVolume, setEnabled, startMusic, stopMusic, intensity, SFX };
})();
