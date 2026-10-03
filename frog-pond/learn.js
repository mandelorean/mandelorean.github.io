// Frog Pond learning games: question generators for times tables, number bonds,
// telling the time and spelling. Each returns 10 questions shaped like
// { text?, clock?, say?, answer, choices?, mode: 'keypad' | 'choice', fact? }.
(function () {
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Times tables ----------
  function tables(t) {
    const qs = [];
    if (t === 'mix') {
      const seen = new Set();
      while (qs.length < 10) {
        const a = 2 + rnd(11), b = 2 + rnd(11), k = Math.min(a, b) + '×' + Math.max(a, b);
        if (!seen.has(k)) { seen.add(k); qs.push(tq(a, b)); }
      }
    } else shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, 10).forEach(n => qs.push(Math.random() < .5 ? tq(t, n) : tq(n, t)));
    return qs;
  }
  const tq = (a, b) => ({ text: a + ' × ' + b, answer: a * b, mode: 'keypad', fact: Math.min(a, b) + ' × ' + Math.max(a, b) });

  // ---------- Number bonds ----------
  function bonds(total) {
    total = +total; const qs = [], seen = new Set();
    while (qs.length < 10) {
      let a = total === 100 ? (Math.random() < .5 ? 5 * (1 + rnd(19)) : 1 + rnd(99)) : rnd(total + 1);
      if (seen.has(a) && seen.size < total) continue; seen.add(a);
      qs.push({ text: Math.random() < .5 ? a + ' + ? = ' + total : '? + ' + a + ' = ' + total, answer: total - a, mode: 'keypad', fact: a + ' + ' + (total - a) });
    }
    return qs;
  }

  // ---------- Telling the time (British phrasing) ----------
  const HOURS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
  const MINS = { 5: 'five', 10: 'ten', 15: 'quarter', 20: 'twenty', 25: 'twenty-five', 30: 'half' };
  function phrase(h, m) {
    const hw = HOURS[h % 12];
    if (m === 0) return cap(hw) + " o'clock";
    if (m <= 30) return cap(MINS[m]) + ' past ' + hw;
    return cap(MINS[60 - m]) + ' to ' + HOURS[(h + 1) % 12];
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function time(level) {
    const pool = level == 1 ? [0, 30] : level == 2 ? [0, 15, 30, 45] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const qs = [], seen = new Set();
    while (qs.length < 10) {
      const h = 1 + rnd(12), m = pool[rnd(pool.length)], key = h + ':' + m;
      if (seen.has(key)) continue; seen.add(key);
      const right = phrase(h, m), wrong = new Set();
      // classic mix-ups: reading the hands the wrong way round, past/to and an hour out
      const swappedH = m / 5 || 12, swappedM = (h % 12) * 5;
      if (pool.includes(swappedM) && !(swappedH === h && swappedM === m)) wrong.add(phrase(swappedH, swappedM));
      if (m > 0 && m !== 30) wrong.add(phrase(h, 60 - m));
      wrong.add(phrase(h % 12 + 1, m));
      wrong.add(phrase((h + 10) % 12 + 1, m));
      while (wrong.size < 6) wrong.add(phrase(1 + rnd(12), pool[rnd(pool.length)]));
      wrong.delete(right);
      qs.push({ clock: { h, m }, answer: right, choices: shuffle([right].concat(shuffle([...wrong]).slice(0, 3))), mode: 'choice' });
    }
    return qs;
  }

  // ---------- Spelling (English National Curriculum, Year 3 and 4 word list) ----------
  const WORDS = ('accident actually address answer appear arrive believe bicycle breath breathe build busy business calendar caught centre century certain ' +
    'circle complete consider continue decide describe different difficult disappear early earth eight eighth enough exercise experience experiment ' +
    'extreme famous favourite forward fruit grammar group guard guide heard heart height history imagine increase important interest island ' +
    'knowledge learn length library material medicine mention minute natural naughty notice occasion often opposite ordinary particular peculiar ' +
    'perhaps popular position possess possible potatoes pressure probably promise purpose quarter question recent regular reign remember sentence ' +
    'separate special straight strange strength suppose surprise therefore though although thought through various weight woman women').split(' ');
  const V = 'aeiou';
  function misspell(w) {
    const strong = new Set(), weak = new Set();
    w.replace(/([a-z])\1/g, (m, c, i) => { strong.add(w.slice(0, i) + c + w.slice(i + 2)); return m; });
    for (let i = 1; i < w.length - 1; i++) {
      const c = w[i];
      if ('bcdfglmnprst'.includes(c) && w[i - 1] !== c && w[i + 1] !== c && V.includes(w[i - 1]) && !V.includes(w[i - 2] || 'x') && V.includes(w[i + 1])) strong.add(w.slice(0, i) + c + c + w.slice(i + 1));
    }
    if (w.includes('ie')) strong.add(w.replace('ie', 'ei'));
    if (w.includes('ei')) strong.add(w.replace('ei', 'ie'));
    [/k(?=n)/, /w(?=r)/, /u(?=[aei])/, /e$/, /b(?=t)/].forEach(re => { if (re.test(w)) strong.add(w.replace(re, '')); });
    [['gh', 'g'], ['wh', 'w'], ['gu', 'g']].forEach(([a, b]) => { if (w.includes(a)) strong.add(w.replace(a, b)); });
    [['ce', 'se'], ['ci', 'si'], ['cy', 'sy'], ['se', 'ce'], ['ough', 'uff'], ['ough', 'ow'], ['ure', 'er'], ['tion', 'shun'], ['sion', 'tion'], ['ar', 'er'], ['er', 'ar'], ['ous', 'us'],
      ['ght', 'te'], ['ea', 'ee'], ['ee', 'ea'], ['ai', 'ay'], ['ture', 'cher'], ['ck', 'k'], ['our', 'or'], ['ow', 'ou'], ['y', 'i'], ['tre', 'ter'],
      ['ible', 'able'], ['ly', 'ley'], ['ph', 'f'], ['wh', 'w'], ['qu', 'kw'], ['gue', 'g'], ['ei', 'ay']].forEach(([a, b]) => { const i = w.lastIndexOf(a); if (i > 0) strong.add(w.slice(0, i) + b + w.slice(i + a.length)); });
    for (let i = 1; i < w.length; i++) if (V.includes(w[i])) for (const v of V) if (v !== w[i]) weak.add(w.slice(0, i) + v + w.slice(i + 1));
    const ok = x => x !== w && x.length > 2 && !WORDS.includes(x);
    const s = shuffle([...strong].filter(ok)), k = shuffle([...weak].filter(ok));
    return s.concat(k).filter((x, i, a) => a.indexOf(x) === i);
  }
  function spell(words) {
    const pick = shuffle(words && words.length ? words : WORDS).slice(0, 10);
    while (pick.length < 10) pick.push(WORDS[rnd(WORDS.length)]);
    return pick.map(w => ({ say: w, answer: w, choices: shuffle([w].concat(misspell(w).slice(0, 2))), mode: 'choice', fact: w }));
  }

  window.Learn = { tables, bonds, time, spell, WORDS, phrase };
})();
