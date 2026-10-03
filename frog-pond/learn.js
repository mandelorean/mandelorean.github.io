// Frog Pond learning games: question generators. Each game returns 10 questions shaped like
// { text?, clock?, say?, answer, choices?, mode: 'keypad' | 'choice', right, hint?, small?, trick? }
//   right – what to show when she gets it wrong ("7 × 8 = 56")
//   trick – key for the grown-ups' "tricky" list, or none
(function () {
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
  // make 10 distinct questions from a generator
  function ten(gen) {
    const qs = [], seen = new Set(); let tries = 0;
    while (qs.length < 10 && tries++ < 500) { const q = gen(); const k = q.text + '|' + q.answer; if (!seen.has(k)) { seen.add(k); qs.push(q); } }
    return qs;
  }
  const num = (text, answer, extra) => Object.assign({ text, answer, mode: 'keypad', right: text.includes('?') ? text.replace('?', answer) : text + ' = ' + answer }, extra || {});

  // ---------- Times tables and division ----------
  const tq = (a, b) => num(a + ' × ' + b, a * b, { trick: 'tables:' + Math.min(a, b) + ' × ' + Math.max(a, b) });
  function tables(t) {
    if (t === 'mix') return ten(() => tq(2 + rnd(11), 2 + rnd(11)));
    return shuffle(range(1, 12)).slice(0, 10).map(n => (Math.random() < .5 ? tq(t, n) : tq(n, t)));
  }
  const DIV = { '2-5': [2, 3, 4, 5], '6-9': [6, 7, 8, 9], '10-12': [10, 11, 12], mix: range(2, 12) };
  const dq = (t, n) => num(t * n + ' ÷ ' + t, n, { trick: 'divide:' + t * n + ' ÷ ' + t });
  function divide(key) { const ts = DIV[key] || DIV.mix; return ten(() => dq(ts[rnd(ts.length)], 1 + rnd(12))); }

  // ---------- Number bonds ----------
  function bonds(total) {
    total = +total;
    return ten(() => {
      const a = total === 100 ? (Math.random() < .5 ? 5 * (1 + rnd(19)) : 1 + rnd(99)) : rnd(total + 1);
      return num(Math.random() < .5 ? a + ' + ? = ' + total : '? + ' + a + ' = ' + total, total - a);
    });
  }

  // ---------- Adding and taking away ----------
  function addsub(limit) {
    limit = +limit;
    const lo = limit === 20 ? 1 : limit === 100 ? 10 : 100;
    return ten(() => {
      if (Math.random() < .5) { const a = lo + rnd(limit - lo * 2 + 1), b = lo + rnd(limit - a - lo + 1); return num(a + ' + ' + b, a + b); }
      const a = lo * 2 + rnd(limit - lo * 2 + 1), b = lo + rnd(a - lo); return num(a + ' − ' + b, a - b);
    });
  }

  // ---------- Maths challenge: doubles, halves, missing numbers, fractions ----------
  const FR = [['½', 2, 1], ['¼', 4, 1], ['¾', 4, 3], ['⅓', 3, 1], ['⅕', 5, 1], ['⅒', 10, 1]];
  const challengeGen = {
    doubles: () => { const n = 2 + rnd(49); return Math.random() < .5 ? num('Double ' + n, 2 * n) : num('Half of ' + 2 * n, n); },
    missing: () => { const a = 2 + rnd(11), b = 1 + rnd(12); return Math.random() < .5 ? num('? × ' + b + ' = ' + a * b, a, { trick: 'tables:' + Math.min(a, b) + ' × ' + Math.max(a, b) }) : num(a + ' × ? = ' + a * b, b, { trick: 'tables:' + Math.min(a, b) + ' × ' + Math.max(a, b) }); },
    fractions: () => { const [s, d, k] = FR[rnd(FR.length)], n = d * (1 + rnd(12)); return num(s + ' of ' + n, n / d * k); }
  };
  function challenge(key) {
    const kinds = key === 'mix' ? ['doubles', 'missing', 'fractions', 'divide', 'bonds'] : [key];
    return ten(() => {
      const k = kinds[rnd(kinds.length)];
      if (k === 'divide') return dq(2 + rnd(11), 1 + rnd(12));
      if (k === 'bonds') return bonds(100)[0];
      return challengeGen[k]();
    });
  }

  // ---------- Telling the time (British phrasing) ----------
  const HOURS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
  const MINS = { 5: 'five', 10: 'ten', 15: 'quarter', 20: 'twenty', 25: 'twenty-five', 30: 'half' };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function phrase(h, m) {
    const hw = HOURS[h % 12];
    if (m === 0) return cap(hw) + " o'clock";
    if (m <= 30) return cap(MINS[m]) + ' past ' + hw;
    return cap(MINS[60 - m]) + ' to ' + HOURS[(h + 1) % 12];
  }
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
      qs.push({ clock: { h, m }, answer: right, choices: shuffle([right].concat(shuffle([...wrong]).slice(0, 3))), mode: 'choice', hint: 'What time is it?', right: "It's " + right.toLowerCase() });
    }
    return qs;
  }

  // ---------- Spelling (English National Curriculum word lists) ----------
  const WORDS = ('accident actually address answer appear arrive believe bicycle breath breathe build busy business calendar caught centre century certain ' +
    'circle complete consider continue decide describe different difficult disappear early earth eight eighth enough exercise experience experiment ' +
    'extreme famous favourite forward fruit grammar group guard guide heard heart height history imagine increase important interest island ' +
    'knowledge learn length library material medicine mention minute natural naughty notice occasion often opposite ordinary particular peculiar ' +
    'perhaps popular position possess possible potatoes pressure probably promise purpose quarter question recent regular reign remember sentence ' +
    'separate special straight strange strength suppose surprise therefore though although thought through various weight woman women').split(' ');
  const WORDS56 = ('accommodate accompany according achieve aggressive amateur ancient apparent appreciate attached available average awkward bargain bruise ' +
    'category cemetery committee communicate community competition conscience conscious controversy convenience correspond criticise curiosity definite ' +
    'desperate determined develop dictionary disastrous embarrass environment equipment equipped especially exaggerate excellent existence explanation ' +
    'familiar foreign forty frequently government guarantee harass hindrance identity immediate immediately individual interfere interrupt language leisure ' +
    'lightning marvellous mischievous muscle necessary neighbour nuisance occupy occur opportunity parliament persuade physical prejudice privilege ' +
    'profession programme pronunciation queue recognise recommend relevant restaurant rhyme rhythm sacrifice secretary shoulder signature sincere sincerely ' +
    'soldier stomach sufficient suggest symbol system temperature thorough twelfth variety vegetable vehicle yacht').split(' ');
  const ALL = WORDS.concat(WORDS56);
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
      ['ible', 'able'], ['ly', 'ley'], ['ph', 'f'], ['wh', 'w'], ['qu', 'kw'], ['gue', 'g'], ['ei', 'ay'], ['ise', 'ize'], ['cial', 'shal'], ['ent', 'ant'], ['ant', 'ent'],
      ['ence', 'ance'], ['ance', 'ence'], ['sc', 's'], ['rh', 'r'], ['ch', 'k']].forEach(([a, b]) => { const i = w.lastIndexOf(a); if (i > 0) strong.add(w.slice(0, i) + b + w.slice(i + a.length)); });
    for (let i = 1; i < w.length; i++) if (V.includes(w[i])) for (const v of V) if (v !== w[i]) weak.add(w.slice(0, i) + v + w.slice(i + 1));
    const ok = x => x !== w && x.length > 2 && !ALL.includes(x);
    const s = shuffle([...strong].filter(ok)), k = shuffle([...weak].filter(ok));
    return s.concat(k).filter((x, i, a) => a.indexOf(x) === i);
  }
  const sq = w => ({ say: w, answer: w, choices: shuffle([w].concat(misspell(w).slice(0, 2))), mode: 'choice', trick: 'spell:' + w, hint: 'Which spelling is right?', right: "It's spelled " + w });
  function spell(key, tricky) {
    const list = key === 'tricky' && tricky && tricky.length ? tricky : key === 'y56' ? WORDS56 : WORDS;
    const pick = shuffle(list).slice(0, 10);
    while (pick.length < 10) pick.push(WORDS[rnd(WORDS.length)]);
    return pick.map(sq);
  }

  // ---------- Word games: homophones, missing letters, plurals ----------
  const HOMO = [
    ['there their', 'The ducks are over ___ by the reeds.', 'there'], ['there their', 'The children put on ___ wellies.', 'their'],
    ['to too two', 'I have ___ eyes and four legs.', 'two'], ['to too two', 'This soup is ___ hot to eat!', 'too'], ['to too two', 'We are going ___ the park.', 'to'],
    ['where wear were', 'What will you ___ to the party?', 'wear'], ['where wear were', '___ are my flies?', 'Where'], ['where wear were', 'The frogs ___ singing all night.', 'were'],
    ['here hear', 'Can you ___ the rain?', 'hear'], ['here hear', 'Come over ___ and sit with me.', 'here'],
    ['knew new', 'I got a ___ hat for my birthday.', 'new'], ['knew new', 'She ___ all the answers.', 'knew'],
    ['know no', 'Do you ___ how to swim?', 'know'], ['know no', 'There are ___ flies left!', 'no'],
    ['right write', 'Can you ___ your name?', 'write'], ['right write', 'Turn ___ at the big tree.', 'right'],
    ['by buy bye', 'Let\'s ___ some sweets at the shop.', 'buy'], ['by buy bye', 'The frog sat ___ the pond.', 'by'],
    ['ate eight', 'A spider has ___ legs.', 'eight'], ['ate eight', 'I ___ three flies for lunch.', 'ate'],
    ['meet meat', 'Let\'s ___ at the lily pad.', 'meet'], ['sea see', 'We went to the ___ on holiday.', 'sea'], ['sea see', 'I can ___ a rainbow!', 'see'],
    ['flower flour', 'We need ___ to bake a cake.', 'flour'], ['flower flour', 'A bee landed on the ___.', 'flower'],
    ['piece peace', 'Can I have a ___ of cake?', 'piece'], ['plain plane', 'The ___ flew over the clouds.', 'plane'],
    ['whole hole', 'The rabbit hopped down a ___.', 'hole'], ['whole hole', 'He ate the ___ pizza!', 'whole'],
    ['weather whether', 'The ___ is sunny today.', 'weather'], ['bear bare', 'The big brown ___ climbed a tree.', 'bear'],
    ['week weak', 'There are seven days in a ___.', 'week'], ['blue blew', 'The wind ___ my hat off.', 'blew'], ['blue blew', 'The sky is bright ___.', 'blue'],
    ['night knight', 'The ___ rode a white horse.', 'knight'], ['night knight', 'Owls fly at ___.', 'night'],
    ['son sun', 'The ___ is shining.', 'sun'], ['tail tale', 'The dog wagged its ___.', 'tail'], ['tail tale', 'Grandma told us a fairy ___.', 'tale'],
    ['would wood', 'The table is made of ___.', 'wood'], ['which witch', 'The ___ flew on a broomstick.', 'witch'], ['which witch', '___ hat do you like best?', 'Which'],
    ['threw through', 'The frog jumped ___ the hoop.', 'through'], ['threw through', 'She ___ the ball to me.', 'threw'],
    ['break brake', 'Be careful not to ___ the vase.', 'break'], ['great grate', 'That was a ___ game!', 'great'],
    ['mail male', 'The postman brought the ___.', 'mail'], ['heel heal', 'My cut will soon ___.', 'heal'], ['allowed aloud', 'Please read the story ___.', 'aloud'],
    ['missed mist', 'I ___ the bus this morning.', 'missed'], ['scene seen', 'Have you ___ my frog?', 'seen'], ['grown groan', 'Wow, you have ___ so tall!', 'grown']
  ];
  function homophones() {
    return shuffle(HOMO).slice(0, 10).map(([set, s, a]) => {
      const opts = set.split(' ').map(w => (s.startsWith('___') ? w.charAt(0).toUpperCase() + w.slice(1) : w));
      return { text: s, small: true, say: s.replace('___', a), answer: a, choices: shuffle(opts.length > 3 ? opts.slice(0, 3) : opts), mode: 'choice', hint: 'Which word fits?', right: 'It\'s "' + a + '"' };
    });
  }
  const CHUNKS = [['ough', 'uff', 'off'], ['tion', 'sion', 'shun'], ['ture', 'cher', 'chur'], ['ie', 'ei', 'ee'], ['ei', 'ie', 'ay'], ['ea', 'ee', 'e'], ['ou', 'ow', 'oo'],
    ['ss', 's', 'c'], ['ll', 'l', 'le'], ['pp', 'p', 'b'], ['tt', 't', 'd'], ['rr', 'r', 'w'], ['mm', 'm', 'n'], ['ph', 'f', 'ff'], ['kn', 'n', 'gn'], ['wr', 'r', 'rh'],
    ['ai', 'ay', 'a'], ['ar', 'er', 'ur'], ['ure', 'ur', 'er'], ['gh', 'g', 'f'], ['ck', 'k', 'c'], ['qu', 'kw', 'cw']];
  function missing(key) {
    const qs = [];
    for (const w of shuffle(key === 'y56' ? WORDS56 : WORDS)) {
      const c = shuffle(CHUNKS).find(([chunk]) => { const i = w.indexOf(chunk); return i > 0 || (i === 0 && chunk.length > 1); });
      if (!c) continue;
      const i = w.indexOf(c[0]);
      qs.push({ text: w.slice(0, i) + '_'.repeat(c[0].length) + w.slice(i + c[0].length), say: w, answer: c[0], choices: shuffle(c.slice()), mode: 'choice', trick: 'spell:' + w, hint: 'Which letters are missing?', right: "It's " + w });
      if (qs.length === 10) break;
    }
    return qs;
  }
  const PLURAL = [['fox', 'foxes'], ['box', 'boxes'], ['bus', 'buses'], ['dish', 'dishes'], ['brush', 'brushes'], ['church', 'churches'], ['witch', 'witches'], ['glass', 'glasses'],
    ['baby', 'babies'], ['party', 'parties'], ['fly', 'flies'], ['puppy', 'puppies'], ['berry', 'berries'], ['story', 'stories'], ['lily', 'lilies'],
    ['boy', 'boys'], ['day', 'days'], ['key', 'keys'], ['monkey', 'monkeys'], ['toy', 'toys'],
    ['leaf', 'leaves'], ['wolf', 'wolves'], ['half', 'halves'], ['knife', 'knives'], ['loaf', 'loaves'], ['scarf', 'scarves'],
    ['child', 'children'], ['mouse', 'mice'], ['foot', 'feet'], ['tooth', 'teeth'], ['person', 'people'], ['man', 'men'], ['woman', 'women'], ['goose', 'geese'],
    ['sheep', 'sheep'], ['fish', 'fish'], ['deer', 'deer'], ['potato', 'potatoes'], ['tomato', 'tomatoes'], ['hero', 'heroes'], ['frog', 'frogs'], ['tadpole', 'tadpoles']];
  function plurals() {
    return shuffle(PLURAL).slice(0, 10).map(([one, many]) => {
      const wrong = [one + 's', /(s|x|ch|sh|o)$/.test(one) ? one + 'es' : one + 's', /y$/.test(one) ? one.slice(0, -1) + 'ies' : '', /fe?$/.test(one) ? one.replace(/fe?$/, 'ves') : '',
        /(ild|an)$/.test(one) ? one + 's' : '', /oo/.test(one) ? one + 's' : '', one, one + 'es'];
      const opts = shuffle(wrong.filter((x, i, a) => x && x !== many && a.indexOf(x) === i && !/[aeiou]es$/.test(x))).slice(0, 2);
      return { text: 'One ' + one + ', two …', small: true, say: 'One ' + one + ', two ' + many, answer: many, choices: shuffle([many].concat(opts)), mode: 'choice', trick: 'spell:' + many, hint: 'Which is right?', right: 'One ' + one + ', two ' + many };
    });
  }
  function words(key) { return key === 'homophones' ? homophones() : key === 'plurals' ? plurals() : missing(); }

  // ---------- Pop quiz: one quick question with three answers ----------
  function pop(trickyFacts) {
    const r = Math.random();
    if (r < .2 && trickyFacts && trickyFacts.length) {
      const f = trickyFacts[rnd(trickyFacts.length)].split(' × ').map(Number);
      if (f.length === 2 && f[0] && f[1]) return numChoices(tq(f[0], f[1]), f[0]);
    }
    if (r < .45) { const a = 2 + rnd(11), b = 2 + rnd(11); return numChoices(tq(a, b), a); }
    if (r < .55) { const t = 2 + rnd(11); return numChoices(dq(t, 1 + rnd(12)), 1); }
    if (r < .65) return numChoices(bonds(Math.random() < .5 ? 10 : 100)[0], 10);
    if (r < .72) return numChoices(challengeGen.doubles(), 2);
    if (r < .86) { const q = sq(WORDS[rnd(WORDS.length)]); return q; }
    return homophones()[0];
  }
  function numChoices(q, step) {
    const a = q.answer, opts = new Set([a]);
    [a + step, a - step, a + 1, a - 1, a + 10, a - 10].filter(x => x >= 0 && x !== a).sort(() => Math.random() - .5).forEach(x => { if (opts.size < 3) opts.add(x); });
    return Object.assign({}, q, { mode: 'choice', choices: shuffle([...opts]) });
  }

  window.Learn = { tables, divide, bonds, addsub, challenge, time, spell, words, pop, WORDS, WORDS56, phrase };
})();
