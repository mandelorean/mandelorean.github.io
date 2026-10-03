// Frog Pond sound effects, synthesised with Web Audio so there are no files to download.
(function () {
  let ctx = null, master = null, noiseBuf = null, muted = false;

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise() {
    if (noiseBuf) return noiseBuf;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }
  // attack/decay envelope on a gain node
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
  }
  function tone(type, f0, f1, t, dur, peak = .3, filter) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, .01, peak, dur);
    let n = o; if (filter) { n.connect(filter); n = filter; }
    n.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
    return o;
  }
  function hiss(t, dur, type, f0, f1, peak = .3, q = 1, attack = .02) {
    const s = ctx.createBufferSource(); s.buffer = noise();
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, attack, peak, dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + .1);
  }
  function wobble(osc, t, dur, rate, depth) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = rate; lg.gain.value = depth; l.connect(lg).connect(osc.frequency);
    l.start(t); l.stop(t + dur + .05);
  }
  const notes = (t, list, type = 'sine', len = .12, gap = .09, peak = .22) =>
    list.forEach((f, i) => tone(type, f, null, t + i * gap, len, peak));

  const SFX = {
    ribbit(t) {
      [0, .17].forEach(o => {
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 850; f.Q.value = 2.5;
        const osc = tone('sawtooth', 200, 125, t + o, .13, .5, f);
        wobble(osc, t + o, .13, 48, 60);
      });
    },
    giggle(t) { [0, 1, 2, 3].forEach(i => { const o = tone('sine', 620 + i * 70, 520 + i * 70, t + i * .09, .07, .18); wobble(o, t + i * .09, .07, 30, 40); }); },
    crunch(t) { [0, .07, .15].forEach(o => hiss(t + o, .05, 'highpass', 2200, null, .35, .7, .003)); },
    fart(t) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const o = tone('sawtooth', 95, 58, t, .55, .5, f); wobble(o, t, .55, 26, 18);
      hiss(t, .45, 'lowpass', 500, 200, .12);
    },
    plop(t) { tone('sine', 320, 70, t, .18, .45); hiss(t, .08, 'lowpass', 900, null, .15, 1, .003); },
    flush(t) { hiss(t, 1.5, 'bandpass', 2600, 260, .4, 1.2, .08); [.3, .55, .8].forEach(o => tone('sine', 300 + Math.random() * 200, 140, t + o, .12, .12)); },
    splash(t) { hiss(t, .5, 'bandpass', 1800, 450, .4, .8, .005); [0, .08, .15].forEach(o => tone('sine', 900 + Math.random() * 500, 1500, t + o, .05, .08)); },
    pop(t) { tone('sine', 520, 1150, t, .07, .3); },
    flip(t) { hiss(t, .06, 'highpass', 3000, null, .2, .8, .003); },
    coin(t) { tone('square', 988, null, t, .07, .12); tone('square', 1319, null, t + .07, .25, .12); },
    yes(t) { notes(t, [523, 659, 784], 'sine', .14, .08, .25); },
    no(t) { tone('triangle', 240, 170, t, .3, .25); },
    bonk(t) { tone('sine', 170, 55, t, .22, .5); hiss(t, .1, 'lowpass', 600, null, .2, 1, .003); },
    fanfare(t) { notes(t, [523, 659, 784, 1047], 'triangle', .18, .11, .22); tone('triangle', 1047, null, t + .44, .5, .2); },
    camera(t) { hiss(t, .05, 'highpass', 4000, null, .4, .7, .002); hiss(t + .09, .07, 'highpass', 3000, null, .3, .7, .002); },
    yawn(t) { const o = tone('sine', 420, 230, t, .9, .18); wobble(o, t, .9, 5, 12); },
    snore(t) {
      hiss(t, 1.1, 'lowpass', 260, 620, .22, 4, .4);
      const o = tone('sawtooth', 70, 62, t + .1, 1, .05); wobble(o, t, 1, 18, 6);
    },
    boing(t) { const o = tone('sine', 140, 420, t, .25, .35); wobble(o, t, .25, 18, 40); },
    slurp(t) { hiss(t, .5, 'bandpass', 600, 1800, .25, 3, .05); tone('sine', 300, 700, t + .1, .35, .08); },
    whoosh(t) { hiss(t, .7, 'bandpass', 400, 2400, .3, 1.5, .2); },
    zoom(t) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; const o = tone('sawtooth', 180, 900, t, .7, .12, f); wobble(o, t, .7, 30, 20); },
    quack(t) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2; tone('sawtooth', 480, 330, t, .16, .4, f); },
    tune(t) {
      // a bouncy little melody with a bass line, about four seconds
      const mel = [659, 784, 880, 784, 659, 587, 523, 587, 659, 659, 784, 880, 1047, 880, 784, 659];
      mel.forEach((f, i) => tone('square', f, null, t + i * .25, .2, .06));
      [131, 196, 165, 196].forEach((f, i) => { for (let j = 0; j < 4; j++) tone('triangle', f, null, t + (i * 4 + j) * .25, .18, .14); });
    },
    buzz(t) { const o = tone('sawtooth', 210, 230, t, .6, .05); wobble(o, t, .6, 9, 25); }
  };

  window.Sound = {
    play(name) {
      if (muted || !SFX[name]) return;
      const c = ac(); if (!c) return;
      try { SFX[name](c.currentTime + .01); } catch (e) {}
    },
    say(text) {
      if (muted || !window.speechSynthesis) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = .85;
        const v = speechSynthesis.getVoices().find(v => /en-GB/i.test(v.lang)); if (v) u.voice = v;
        speechSynthesis.speak(u);
      } catch (e) {}
    },
    canSpeak: () => !!window.speechSynthesis,
    setMuted(m) { muted = !!m; if (m && window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {} },
    unlock() { ac(); }
  };
})();
