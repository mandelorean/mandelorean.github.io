(function () {
  'use strict';

  // ---------- Config ----------
  const KEY = 'frogpet-v1-b-app'; // same save slot as the Frog Pond prototype, so progress carries over
  const APP_VERSION = '2026-10-03.8'; // keep in step with version.json and sw.js (bump-version.sh does all three)
  const HR = 1 / 3600;
  const RATES = { food: 8 * HR, clean: 5 * HR, fun: 7 * HR, love: 6 * HR, energy: 5 * HR }; // points lost per second
  const POTTY_RATE = 7 * HR;     // the loo meter fills slowly on its own...
  const POTTY_PER_MEAL = 18;     // ...and quicker after every fly
  const SLEEP_GAIN = 100 / 600;  // a full recharge takes about 10 minutes of sleep
  const NEED = [
    { k: 'food', label: 'Tummy', icon: 'pest_control', color: '#ea942f' },
    { k: 'clean', label: 'Clean', icon: 'water_drop', color: '#37aae3' },
    { k: 'fun', label: 'Fun', icon: 'toys', color: '#a780e6' },
    { k: 'love', label: 'Love', icon: 'favorite', color: '#ef5f89' },
    { k: 'energy', label: 'Energy', icon: 'bedtime', color: '#f4d35e' }
  ];
  const CARE = ['food', 'clean', 'fun', 'love'];
  const colorOf = k => NEED.find(n => n.k === k).color;
  const STAGE_NAME = { egg: 'Egg', tadpole: 'Tadpole', froglet: 'Froglet', frog: 'Frog' };

  // Shop: [id, name, price, colour, icon, extras]
  //   extras: treat (eaten straight away), need/needText (unlocked by learning), slot (clothes), auto (weather clothes), scene, note
  const WARM = () => (wxFresh() ? wx().temp >= 15 : [4, 5, 6, 7].includes(new Date().getMonth()));
  const CHILLY = () => (wxFresh() ? wx().temp <= 10 || wxKind() === 'snow' : [10, 11, 0, 1].includes(new Date().getMonth()));
  const coldNow = () => !FANTASY[S.scene] && (wxFresh() ? wx().temp <= 8 || wxKind() === 'snow' : S.scene === 'arctic');
  const SHOP = {
    treats: [['t_dragonfly', 'Dragonfly delight', 8, '#2FB7C9', 'emoji_nature', { treat: 'dragonfly', gifts: { food: 45, love: 5 }, line: 'A dragonfly! My favourite!' }],
      ['t_burger', 'Bug burger', 10, '#C8873A', 'lunch_dining', { treat: 'burger', gifts: { food: 40, fun: 15 }, line: 'A bug burger! Yum yum yum!' }],
      ['t_smoothie', 'Pond smoothie', 8, '#7fca78', 'local_drink', { treat: 'smoothie', gifts: { energy: 25, fun: 5 }, line: 'Slurp! I feel full of beans!' }],
      ['t_lolly', 'Ice lolly', 6, '#FF8FC0', 'icecream', { treat: 'lolly', gifts: { fun: 20, food: 10 }, ok: WARM, okText: 'Only when it’s warm where he is', line: 'Brain freeze! Hee hee.' }],
      ['t_cocoa', 'Hot chocolate', 6, '#8B5A3C', 'coffee', { treat: 'cocoa', gifts: { love: 15, energy: 10 }, ok: CHILLY, okText: 'Only when it’s chilly where he is', line: 'Mmm, warm and cosy!' }],
      ['t_cake', 'Birthday cake', 15, '#FFB3D1', 'cake', { treat: 'cake', gifts: { food: 20, fun: 20, love: 20 }, line: 'Cake! Is it a party? Hooray!' }]],
    hats: [['none', 'No hat', 0, '#C9CFC6', 'block'], ['crown', 'Crown', 0, '#F5C542', 'workspace_premium'], ['bow', 'Bow', 0, '#FF7EB6', 'favorite'],
      ['party', 'Party hat', 0, '#6F8CFF', 'celebration'], ['flower', 'Flower', 0, '#FFA6CF', 'local_florist'], ['cap', 'Cap', 20, '#E84545', 'sports_baseball'],
      ['sunnies', 'Sunnies', 25, '#FF4D7D', 'visibility'], ['bobble', 'Bobble hat', 25, '#E23B3B', 'ac_unit', { note: 'Puts it on when it’s cold where he is' }],
      ['wizard', 'Wizard hat', 30, '#6B4BD6', 'auto_fix_high'], ['tiara', 'Tiara', 35, '#9FB4CC', 'diamond'],
      ['mortar', 'Graduation cap', 50, '#1F2A22', 'school', { need: s => !!s.stickers.timesall, needText: 'Win the Tables legend sticker' }],
      ['bee', 'Bee antennae', 50, '#F5B915', 'emoji_nature', { need: s => (s.stars['spell:y56'] || 0) >= 3, needText: '3 stars at Year 5 and 6 spelling' }]],
    clothes: [['scarf', 'Woolly scarf', 25, '#E23B3B', 'checkroom', { slot: 'neck', note: 'Also puts it on when it’s cold' }], ['bowtie', 'Bow tie', 20, '#6F8CFF', 'style', { slot: 'neck' }],
      ['cape', 'Superhero cape', 30, '#E84545', 'bolt', { slot: 'neck' }], ['glasses', 'Maths glasses', 25, '#1F2A22', 'eyeglasses', { slot: 'face' }],
      ['wellies', 'Wellies', 30, '#F5C542', 'water_drop', { auto: 'rain', note: 'Wears them when it rains where he is' }], ['umbrella', 'Umbrella', 35, '#FF5C8A', 'beach_access', { auto: 'rain', note: 'Uses it when it rains in Fleet' }]],
    colours: [],
    toys: [['ball', 'Beach ball', 25, '#FF6B6B', 'sports_volleyball'], ['wand', 'Bubble wand', 25, '#6fb6ff', 'bubble_chart'], ['kite', 'Kite', 35, '#a780e6', 'air'],
      ['trampoline', 'Mini trampoline', 40, '#6F8CFF', 'sports_gymnastics'], ['radio', 'Radio', 45, '#ea942f', 'radio']],
    pond: [['flowers', 'Lily flowers', 20, '#FFA6CF', 'local_florist'], ['reeds', 'Bulrushes', 20, '#5AA04A', 'grass'], ['mushroom', 'Toadstool', 25, '#E8443A', 'brightness_5'],
      ['lights', 'Fairy lights', 30, '#FFD66B', 'auto_awesome'], ['stones', 'Stepping stones', 30, '#9AA294', 'circle'], ['waterlilies', 'Water lilies', 35, '#FFB3D1', 'filter_vintage', { note: 'Open by day, close at night' }],
      ['lantern', 'Lantern', 40, '#F5B915', 'emoji_objects'], ['fountain', 'Fountain', 50, '#37aae3', 'water'], ['jetty', 'Wooden jetty', 60, '#A0703F', 'deck'],
      ['house', 'Toadstool house', 80, '#E8443A', 'cottage', { note: 'Sleeps inside at bedtime' }],
      ['clock', 'Golden clock', 60, '#F5C542', 'schedule', { need: s => (s.stars['time:3'] || 0) >= 3, needText: '3 stars telling the time to 5 minutes' }]],
    friends: [['ladybird', 'Ladybird', 40, '#E8302A', 'bug_report'], ['goldfish', 'Goldfish', 50, '#FF8A2A', 'set_meal'], ['snail', 'Snail', 50, '#C77A3C', 'pets'],
      ['duckling', 'Duckling', 60, '#FFD84D', 'egg'], ['butterfly', 'Butterfly', 60, '#c77dff', 'flutter_dash'], ['bee_friend', 'Bumblebee', 60, '#F5B915', 'hive'],
      ['dragonfly', 'Dragonfly', 70, '#2FB7C9', 'emoji_nature'], ['hedgehog', 'Hedgehog', 80, '#8B5A3C', 'pets'], ['babyfrog', 'Baby frog', 120, '#67c24a', 'favorite', { note: 'Copies everything he does' }]],
    places: [['pond', 'Frog Pond', 0, '#2A5A35', 'water', { scene: true }], ['garden', 'Garden pond', 250, '#5AA04A', 'yard', { scene: true }],
      ['seaside', 'Seaside rock pool', 250, '#37aae3', 'beach_access', { scene: true }], ['rainforest', 'Rainforest', 300, '#1F6B3A', 'forest', { scene: true, note: 'He gets soaking wet!' }],
      ['arctic', 'Arctic', 300, '#9fd3ea', 'ac_unit', { scene: true, note: 'Brrr! He shivers' }], ['desert', 'Desert', 300, '#E0B061', 'wb_sunny', { scene: true, note: 'Phew! He gets hot' }],
      ['paris', 'Paris', 350, '#6F8CFF', 'tour', { scene: true, note: 'Ooh la la, a moustache!' }], ['london', 'London', 350, '#E23B3B', 'account_balance', { scene: true, note: 'Big Ben goes bong' }],
      ['spooky', 'Spooky night', 350, '#6B4BD6', 'dark_mode', { scene: true, note: 'Bats and pumpkins' }], ['candy', 'Candy Land', 400, '#FF8FC0', 'cake', { scene: true }],
      ['underwater', 'Under the sea', 400, '#1b8aa3', 'scuba_diving', { scene: true, note: 'He blows bubbles' }], ['disco', 'Disco', 450, '#c77dff', 'nightlife', { scene: true, note: 'Mirrorball and dancing!' }],
      ['space', 'Outer space', 500, '#1b1f3a', 'rocket_launch', { scene: true, note: 'He floats in a space bubble' }]],
    scenes: [['giantpad', 'Giant lotus pad', 300, '#FF8FC0', 'spa'], ['castle', 'Frog Castle', 500, '#9FB4CC', 'castle']]
  };
  const TABS = [['treats', 'Treats'], ['hats', 'Hats'], ['clothes', 'Clothes'], ['colours', 'Colours'], ['toys', 'Toys'], ['pond', 'Pond'], ['friends', 'Friends'], ['places', 'Places'], ['scenes', 'Big goals']];
  // Frog colours: body, belly and spots for the frog; body and belly for the tadpole
  const COLOURS = {
    green: { name: 'Classic green', price: 0, swatch: '#67c24a', body: 0x67c24a, belly: 0xe4f6b4, spot: 0x4c9e36, tad: 0x4fb08a, tadBelly: 0xcdf1dc },
    blue: { name: 'Tree-frog blue', price: 30, swatch: '#3d9be0', body: 0x3d9be0, belly: 0xd8ecff, spot: 0x2a74b8, tad: 0x4aa3d8, tadBelly: 0xd5ecfa },
    pink: { name: 'Bubblegum pink', price: 30, swatch: '#ff8fbf', body: 0xff8fbf, belly: 0xffe3ef, spot: 0xe5679f, tad: 0xf59ac4, tadBelly: 0xfde2ee },
    purple: { name: 'Purple', price: 40, swatch: '#9b6be0', body: 0x9b6be0, belly: 0xeadcff, spot: 0x7a49c2, tad: 0xa07ad8, tadBelly: 0xebe0fb },
    orange: { name: 'Poison-dart orange', price: 40, swatch: '#ff8a2a', body: 0xff8a2a, belly: 0xffe2c4, spot: 0x1b1b24, tad: 0xf59a45, tadBelly: 0xffe6cc },
    midnight: { name: 'Midnight', price: 50, swatch: '#3a4aa8', body: 0x3a4aa8, belly: 0xc9d2ff, spot: 0x7fe3ff, tad: 0x4a5ab8, tadBelly: 0xd0d8ff },
    gold: { name: 'Golden', price: 60, swatch: '#f5c542', body: 0xf5c542, belly: 0xfff3c4, spot: 0xd9a21b, tad: 0xf0c752, tadBelly: 0xfff0c0 },
    rainbow: { name: 'Rainbow', price: 120, swatch: 'linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#c77dff)', rainbow: true, body: 0x67c24a, belly: 0xffffff, spot: 0x4c9e36, tad: 0x4fb08a, tadBelly: 0xffffff }
  };
  for (const id in COLOURS) SHOP.colours.push([id, COLOURS[id].name, COLOURS[id].price, COLOURS[id].swatch, '']);
  const ITEM = {}; for (const tab in SHOP) SHOP[tab].forEach(([id, name, price, color, icon, x]) => { ITEM[id] = Object.assign({ id, name, price, color, icon, tab }, x || {}); });
  const hex = n => '#' + n.toString(16).padStart(6, '0');

  const PLAY = {
    flies: { title: 'Fly Catch', icon: 'pest_control', color: '#ea942f', desc: 'Tap the buzzy flies', want: 'Fancy a game of Fly Catch?' },
    swim: { title: 'Pond Swim', icon: 'pool', color: '#37aae3', desc: 'Grab flowers, dodge logs', want: 'Can we go for a swim?' },
    memory: { title: 'Lily Memory', icon: 'grid_view', color: '#ef5f89', desc: 'Find the pairs', want: "Let's play Memory!" }
  };
  const QUIZ = {
    tables: { title: 'Times Tables', icon: 'calculate', color: '#a780e6', desc: '1× to 12×', pick: 'Which times table?', keypad: true, group: 'maths' },
    divide: { title: 'Division', icon: 'call_split', color: '#c58af0', desc: '56 ÷ 7 and friends', pick: 'Which division facts?', keypad: true, group: 'maths', want: "Can we practise dividing? I'll share my flies!",
      opts: [['2-5', '÷ 2, 3, 4 and 5'], ['6-9', '÷ 6, 7, 8 and 9'], ['10-12', '÷ 10, 11 and 12'], ['mix', 'All mixed up']] },
    bonds: { title: 'Number Bonds', icon: 'add_circle', color: '#7fca78', desc: 'Make 10, 20 and 100', pick: 'Which number bonds?', keypad: true, group: 'maths', want: "Number bonds, please! They're my favourite.",
      opts: [['10', 'Bonds to 10'], ['20', 'Bonds to 20'], ['100', 'Bonds to 100']] },
    addsub: { title: 'Add & Take Away', icon: 'exposure', color: '#ff9f6b', desc: 'Adding and subtracting', pick: 'How big are the numbers?', keypad: true, group: 'maths', want: "Let's do some adding and taking away!",
      opts: [['20', 'Up to 20'], ['100', 'Up to 100'], ['1000', 'Up to 1000']] },
    challenge: { title: 'Maths Challenge', icon: 'psychology', color: '#ef8fb0', desc: 'Doubles, fractions and more', pick: 'Pick a challenge', keypad: true, group: 'maths', want: 'Can we do a Maths Challenge? Pleeease?',
      opts: [['doubles', 'Doubles and halves'], ['missing', 'Missing numbers'], ['fractions', 'Fractions of amounts'], ['mix', 'Super mix']] },
    time: { title: 'Telling the Time', icon: 'schedule', color: '#5fd4c4', desc: 'Read the frog clock', pick: 'How tricky?', group: 'words', want: 'Can you help me tell the time?',
      opts: [['1', "O'clock and half past"], ['2', 'Quarter past and to'], ['3', 'Every five minutes']] },
    spell: { title: 'Spelling Bubbles', icon: 'spellcheck', color: '#F5B915', desc: 'Pop the right spelling', pick: 'Spelling Bubbles', group: 'words', want: "Let's play Spelling Bubbles!",
      opts: [['y34', 'Year 3 and 4 words'], ['y56', 'Year 5 and 6 words'], ['tricky', 'My tricky words']] },
    words: { title: 'Word Games', icon: 'menu_book', color: '#6fb6ff', desc: 'Homophones, plurals and more', pick: 'Pick a word game', group: 'words', want: "Let's play a word game!",
      opts: [['homophones', 'There or their? Homophones'], ['missing', 'Missing letters'], ['plurals', 'One fox, two foxes: plurals']] }
  };
  const GAMES = Object.assign({}, PLAY, QUIZ);
  const MEM_ICONS = [['pest_control', '#ea942f'], ['water_drop', '#37aae3'], ['favorite', '#ef5f89'], ['local_florist', '#FF7EB6'], ['star', '#F5B915'], ['bedtime', '#6F8CFF']];

  const $ = id => document.getElementById(id);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = v => Math.max(0, Math.min(100, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sfx = n => window.Sound && Sound.play(n);
  const isNight = () => { const h = londonMins() / 60; return h >= 19 || h < 6; };
  const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // ---------- Real time and weather for wherever the frog is ----------
  // Weather and sunrise/sunset come from Open-Meteo (free, no account). Only the place's coordinates are sent.
  // The pond and garden are in Fleet; the other real places use their own weather and local time.
  const PLACES = {
    fleet: { name: 'Fleet', lat: 51.2834, lon: -0.8412, tz: 'Europe/London' },
    seaside: { name: 'St Ives', lat: 50.2112, lon: -5.4797, tz: 'Europe/London' },
    rainforest: { name: 'the Amazon', short: 'Amazon', lat: -3.119, lon: -60.0217, tz: 'America/Manaus', climate: 'drizzle' },
    arctic: { name: 'Svalbard', lat: 78.2232, lon: 15.6267, tz: 'Arctic/Longyearbyen', climate: 'snow' },
    desert: { name: 'Giza', lat: 29.9792, lon: 31.1342, tz: 'Africa/Cairo' },
    paris: { name: 'Paris', lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' },
    london: { name: 'London', lat: 51.5072, lon: -0.1276, tz: 'Europe/London' }
  };
  const loc = () => (PLACES[S.scene] ? S.scene : 'fleet');
  const place = () => PLACES[loc()];
  const placeName = () => place().short || place().name;
  let WXS = {}; try { WXS = JSON.parse(localStorage.getItem('fp-weather2')) || {}; } catch (e) {}
  const wx = () => WXS[loc()] || null;
  function localMins(tz) {
    try {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      const g = t => +p.find(x => x.type === t).value; return g('hour') * 60 + g('minute');
    } catch (e) { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  }
  const londonMins = () => localMins('Europe/London'); // bedtime always follows home time
  const wxFresh = () => !!(wx() && Date.now() - wx().t < 6 * 3600e3);
  const toMins = iso => { const t = String(iso).split('T')[1].split(':'); return +t[0] * 60 + +t[1]; };
  // rough Fleet sunrise/sunset by month (UK clock time) for when we have no forecast yet
  const SUN = [[485, 975], [450, 1030], [390, 1080], [385, 1190], [330, 1240], [290, 1280], [310, 1270], [355, 1220], [405, 1150], [450, 1085], [440, 980], [480, 955]];
  function skyPhase() {
    const P = place(), W = wx(), m = localMins(P.tz), mo = new Date().getMonth();
    let rise = loc() === 'fleet' || P.tz === 'Europe/London' ? SUN[mo][0] : 390, set = loc() === 'fleet' || P.tz === 'Europe/London' ? SUN[mo][1] : 1110;
    if (wxFresh()) {
      // polar night or midnight sun (Svalbard!) has no sunrise or sunset: just use day/night
      if (!W.sunrise || !W.sunset || W.sunrise === W.sunset) return W.day ? 'day' : 'night';
      rise = toMins(W.sunrise); set = toMins(W.sunset);
    }
    return m >= rise - 30 && m < rise + 60 ? 'dawn' : m >= rise + 60 && m < set - 60 ? 'day' : m >= set - 60 && m < set + 30 ? 'dusk' : 'night';
  }
  function wxKind() {
    if (!wxFresh()) return place().climate || 'clear';
    const c = wx().code;
    return c <= 1 ? 'clear' : c === 2 ? 'partly' : c === 3 ? 'cloudy' : c === 45 || c === 48 ? 'fog' : c >= 51 && c <= 57 ? 'drizzle'
      : (c >= 61 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : 'cloudy';
  }
  const isRainy = () => !FANTASY[S.scene] && ['rain', 'drizzle', 'storm'].includes(wxKind());
  // made-up places have their own sky; real places use their own weather and clock
  const FANTASY = { space: 'night', disco: 'night', spooky: 'night', underwater: 'day', candy: 'day' };
  const scenePhase = () => FANTASY[S.scene] || skyPhase();
  const sceneWeather = () => (FANTASY[S.scene] ? 'clear' : wxKind());
  const SCENE_LINES = {
    garden: ['What a lovely garden!', 'I can smell the flowers!'], seaside: ['I can hear the waves!', 'Look, a starfish!'],
    rainforest: ["I'm soaking wet! Drip drip drip.", 'Ooh, I can hear a toucan!', "It's so rainy in the rainforest!"],
    arctic: ["B-b-b-brrr! It's f-f-freezing!", 'Look, a polar bear! Hello, polar bear!', 'My toes are like ice lollies!', 'Did you know? Penguins live at the South Pole, not up here!'],
    desert: ["Phew! It's sooo hot!", 'Is that a pyramid? Wow!', 'I need a drink of water!'],
    paris: ['Bonjour! Do you like my moustache?', 'Ooh la la! The Eiffel Tower!', 'Croissant, anyone? Ribbit!'],
    london: ['Fancy a cup of tea?', "Look, it's Big Ben!", 'Shall we ride the red bus?'],
    spooky: ['Wooooo! Spooky!', 'Did that bat just wink at me?', 'Trick or treat? Ribbit!'],
    candy: ['Everything is made of sweets!', 'Can I lick the lollipop trees?', 'This place is so sweet!'],
    underwater: ['Blub blub! Look at the fish!', "I'm a deep-sea frog!", 'Bubbles! Blub blub!'],
    disco: ["Let's boogie!", 'Look at the mirrorball spin!', "I've got the moves! Ribbit!"],
    space: ['One small hop for a frog!', "Wheee, I'm floating!", 'Hello, Earth! I can see my pond!']
  };
  const sceneLine = () => (SCENE_LINES[S.scene] ? SCENE_LINES[S.scene][Math.floor(Date.now() / 20000) % SCENE_LINES[S.scene].length] : null);
  function enterScene(id) {
    const lines = SCENE_LINES[id]; if (lines) setTimeout(() => say(lines[0], 3500), 1300);
    if (id === 'london') [0, 1, 2].forEach(i => setTimeout(() => sfx('bong'), 300 + i * 1300));
    if (id === 'disco') sfx('tune');
    if (id === 'arctic') setTimeout(() => sfx('brr'), 600);
    if (id === 'rainforest') setTimeout(() => engine && engine.shakeOff(), 1200);
    if (id === 'space') setTimeout(() => sfx('whoosh'), 200);
  }
  const WX_ICON = { clear: ['wb_sunny', 'dark_mode'], partly: ['partly_cloudy_day', 'partly_cloudy_night'], cloudy: ['cloud', 'cloud'], fog: ['foggy', 'foggy'], drizzle: ['rainy', 'rainy'], rain: ['rainy', 'rainy'], snow: ['ac_unit', 'ac_unit'], storm: ['thunderstorm', 'thunderstorm'] };
  const fetching = {};
  async function fetchWeather(force) {
    const key = loc(), P = PLACES[key];
    if (FANTASY[S.scene] || fetching[key] || (!force && WXS[key] && Date.now() - WXS[key].t < 10 * 60e3)) return;
    fetching[key] = true;
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + P.lat + '&longitude=' + P.lon +
        '&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=sunrise,sunset&timezone=' + encodeURIComponent(P.tz) + '&forecast_days=1';
      const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return;
      const j = await r.json(), c = j.current, d = j.daily || {};
      WXS[key] = { t: Date.now(), code: c.weather_code, day: c.is_day, temp: Math.round(c.temperature_2m), wind: c.wind_speed_10m, sunrise: d.sunrise && d.sunrise[0], sunset: d.sunset && d.sunset[0] };
      try { localStorage.setItem('fp-weather2', JSON.stringify(WXS)); } catch (e) {}
      const today = dayKey(new Date());
      if (isRainy() && S.stage !== 'egg' && S.stats.rainDay !== today) { S.stats.rainDay = today; count('rainyDays'); save(); checkStickers(); }
      render();
    } catch (e) {} finally { fetching[key] = false; }
  }
  // "3pm", "half past 7 in the morning" style local time for faraway places
  function localTimeWords() {
    const m = localMins(place().tz), h = Math.floor(m / 60), h12 = h % 12 || 12;
    return h12 + (m % 60 >= 30 ? ':30' : '') + (h < 12 ? 'am' : 'pm');
  }
  function weatherLine() {
    if (FANTASY[S.scene] || !wxFresh()) return null;
    const k = wxKind(), t = wx().temp, night = skyPhase() === 'night', where = place().name, P = place();
    if (P.tz !== 'Europe/London' && Math.floor(Date.now() / 20000) % 2 === 0)
    {
      const h = localMins(P.tz) / 60, polar = !wx().sunrise || wx().sunrise === wx().sunset;
      if (polar && night && h >= 9 && h < 18) return "It's " + localTimeWords() + ' in ' + where + ' but it’s dark! In winter the sun doesn’t come up there at all.';
      if (polar && !night && (h >= 22 || h < 5)) return "It's " + localTimeWords() + ' in ' + where + ' and the sun is still up! It never sets there in summer.';
      return "It's " + localTimeWords() + ' in ' + where + ' right now!' + (night ? ' Shh, everyone is asleep.' : '');
    }
    const temp = ' It\'s ' + t + '°C in ' + where + '.';
    if (k === 'storm') return 'Thunder! I\'ll stay snug on my lily pad.' + temp;
    if (k === 'snow') return 'Snow in ' + where + '! Brrr!' + temp;
    if (k === 'rain' || k === 'drizzle') return 'It\'s raining in ' + where + '! Frogs love the rain.';
    if (k === 'fog') return 'Ooh, it\'s all foggy in ' + where + '. Spooky!';
    if (t <= 3) return 'Brrr, it\'s only ' + t + '°C in ' + where + '!';
    if (t >= 25) return 'Phew, it\'s ' + t + '°C in ' + where + '! Lucky I live in a pond.';
    if (night) return k === 'clear' ? 'Look at all the stars over ' + where + ' tonight!' : 'It\'s a cloudy night in ' + where + '.';
    return k === 'clear' ? 'What a sunny day in ' + where + '!' + temp : k === 'partly' ? 'Sun and clouds in ' + where + ' today.' + temp : 'It\'s a cloudy day in ' + where + '.' + temp;
  }
  const starStr = n => '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>';

  // ---------- State ----------
  const base = () => ({
    name: '', stage: 'egg', needs: { food: 72, clean: 80, fun: 58, love: 66, energy: 85 }, xp: 0, hat: 'none', potty: 20, mess: [0, 0, 0], asleep: false,
    coins: 20, owned: {}, decor: {}, colour: 'green', neck: 'none', face: 'none', scene: 'pond', jobs: null, stars: {}, tricky: {}, history: [], stats: {}, best: {}, stickers: {}, day: '', streak: 0, sound: true, clock: false, last: Date.now()
  });
  const SAVED = Object.keys(base());
  let note = null;
  function load() {
    const b = base(); let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    s = Object.assign({}, b, s || {}); s.needs = Object.assign({}, b.needs, s.needs || {});
    if (!Array.isArray(s.mess) || s.mess.length !== 3) s.mess = [0, 0, 0];
    if (s.tables) { for (const t in s.tables) s.stars['tables:' + t] = Math.max(s.stars['tables:' + t] || 0, s.tables[t]); delete s.tables; } // older saves
    if (s.stage !== 'egg') {
      // catch up on the time she was away
      const secs = Math.max(0, (Date.now() - (s.last || Date.now())) / 1000);
      const slow = s.asleep ? .5 : 1, messy = s.mess.some(v => v > 0);
      for (const k of CARE) s.needs[k] = Math.max(8, s.needs[k] - RATES[k] * secs * slow * (k === 'clean' && messy ? 2 : 1));
      if (s.asleep) {
        s.needs.energy = Math.min(100, s.needs.energy + SLEEP_GAIN * secs);
        if (s.needs.energy >= 100) { s.asleep = false; note = 'Good morning! What a lovely sleep.'; }
      } else {
        s.needs.energy = Math.max(8, s.needs.energy - RATES.energy * secs);
        s.potty += POTTY_RATE * secs;
        if (s.potty >= 100) {
          const i = s.mess.indexOf(0); if (i >= 0) s.mess[i] = 3;
          s.potty = 25; note = 'Oops… I had a little accident while you were away. Can you help clean up?';
        }
      }
      if (!note && secs > 3 * 3600) note = 'You came back! I missed you.';
    }
    return Object.assign(s, { sheet: null, game: null, toast: null, busy: false, celebrate: null, drag: null, want: null, away: false, gate: false, tab: 'hats', confirm: null, resetArm: false, photo: null, popq: null });
  }
  let S = load();
  Sound.setMuted(!S.sound);
  function save() {
    if (restoring) return;
    const o = {}; SAVED.forEach(k => { o[k] = S[k]; }); o.last = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function set(patch) { Object.assign(S, patch); render(); }
  const hasMess = () => S.mess.some(v => v > 0);
  const count = (k, n = 1) => { S.stats[k] = (S.stats[k] || 0) + n; };

  // ---------- 3D frog ----------
  let engine = null, autoWear = null;
  function mountEngine() {
    if (!window.FrogEngine || !window.THREE) { setTimeout(mountEngine, 60); return; }
    engine = window.FrogEngine.mount($('scene'), {
      stage: S.stage, onTap: () => pet(), onMess: i => scoop(i), onToy: k => playToy(k),
      palette: { pad: 0x2a6e37, padTop: 0x358542 }, padNotch: true,
      lights: { sky: 0xa8c6ff, ground: 0x10262e, hemi: .6, key: 0xe6ecff, keyI: .9, rim: 0x8affd2, rimI: 1.4, fillI: .15 },
      shadow: .35
    });
    syncEngine();
  }
  function syncEngine() {
    if (!engine) return;
    const cold = coldNow(), wet = isRainy();
    engine.setStage(S.stage); engine.setSleep(S.asleep); engine.setMood(mood()); engine.setHat(S.owned.bobble && cold ? 'bobble' : S.hat);
    engine.setOutfit({ neck: S.owned.scarf && cold ? 'scarf' : S.neck, face: S.face, feet: S.owned.wellies && wet ? 'wellies' : 'none', umbrella: !!(S.owned.umbrella && wet) });
    engine.setWind(wx() && wx().wind);
    const auto = [S.owned.bobble && cold && 'bobble', S.owned.scarf && cold && 'scarf', S.owned.wellies && wet && 'wellies', S.owned.umbrella && wet && 'umbrella'].filter(Boolean).join();
    if (autoWear !== null && auto !== autoWear && auto && S.stage !== 'egg') setTimeout(() => say(wet ? "It's raining in " + place().name + '! ' + (S.owned.wellies ? 'Wellies on!' : 'Umbrella up!') : "Brrr, it's cold in Fleet! Wrapping up warm.", 3000), 50);
    autoWear = auto;
    engine.setDirty(S.needs.clean < 40 ? (40 - S.needs.clean) / 40 : 0);
    engine.setMess(S.mess); engine.setExtras(S.stage === 'egg' ? {} : S.decor);
    engine.setColour(Object.assign({ key: S.colour }, COLOURS[S.colour] || COLOURS.green));
    engine.setScene(S.scene);
    const ph = scenePhase(), dull = ['cloudy', 'fog', 'rain', 'drizzle', 'storm', 'snow'].includes(sceneWeather());
    engine.setDaylight((ph === 'day' ? 1.3 : ph === 'night' ? .6 : 1) * (dull ? .85 : 1));
  }
  function mood() {
    const v = Object.values(S.needs), min = Math.min(...v), avg = v.reduce((a, b) => a + b, 0) / v.length;
    const m = min < 25 ? 'sad' : avg >= 68 ? 'happy' : 'ok';
    return m === 'happy' && (hasMess() || S.potty >= 85) ? 'ok' : m;
  }

  // ---------- Coins, stickers and the daily streak ----------
  function earn(n) {
    if (n <= 0) return;
    S.coins += n; count('coinsEarned', n); save(); render();
    const pop = document.createElement('span'); pop.className = 'coin-pop'; pop.textContent = '+' + n;
    $('coinsBtn').appendChild(pop); setTimeout(() => pop.remove(), 1300);
    sfx('coin');
  }
  const anyStars = (prefix, n) => Object.keys(S.stars).some(k => k.startsWith(prefix) && S.stars[k] >= n);
  const STICKERS = [
    ['firstfly', 'First fly', 'pest_control', '#ea942f', 'Feed your frog', s => (s.stats.feeds || 0) >= 1],
    ['chef', 'Fly chef', 'restaurant', '#ea942f', 'Feed 25 times', s => (s.stats.feeds || 0) >= 25],
    ['bubbly', 'Bubble bath', 'bathtub', '#37aae3', 'Have 10 baths', s => (s.stats.baths || 0) >= 10],
    ['cuddles', 'Cuddle champ', 'favorite', '#ef5f89', 'Give 50 cuddles', s => (s.stats.cuddles || 0) >= 50],
    ['loo', 'Loo hero', 'wc', '#5fd4c4', '5 trips to the loo', s => (s.stats.loos || 0) >= 5],
    ['scooper', 'Super scooper', 'cleaning_services', '#A0703F', 'Clean up 5 messes', s => (s.stats.scoops || 0) >= 5],
    ['parp', 'Bubble trouble', 'bubble_chart', '#7CC95A', 'Hear 20 farts', s => (s.stats.farts || 0) >= 20],
    ['dreams', 'Sweet dreams', 'bedtime', '#E5B92E', 'Have 5 good sleeps', s => (s.stats.sleeps || 0) >= 5],
    ['grown', 'All grown up', 'emoji_events', '#3FA45B', 'Grow into a frog', s => s.stage === 'frog'],
    ['catcher', 'Fly catcher', 'sports_esports', '#a780e6', 'Catch 10 flies in one game', s => (s.best.flies || 0) >= 10],
    ['waterbaby', 'Water baby', 'pool', '#37aae3', 'Score 25 in Pond Swim', s => (s.best.swim || 0) >= 25],
    ['memory', 'Memory master', 'grid_view', '#ef5f89', 'Finish Memory in 9 goes', s => s.best.memory > 0 && s.best.memory <= 9],
    ['timesstar', 'Times star', 'calculate', '#a780e6', '3 stars on a times table', () => anyStars('tables:', 3)],
    ['timesall', 'Tables legend', 'military_tech', '#E5A50A', '3 stars on all 12 tables', s => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every(t => (s.stars['tables:' + t] || 0) >= 3)],
    ['bonds', 'Bond builder', 'add_circle', '#3FA45B', '3 stars on number bonds', () => anyStars('bonds:', 3)],
    ['clock', 'Time teller', 'schedule', '#2A9DB0', '3 stars telling the time', () => anyStars('time:', 3)],
    ['speller', 'Super speller', 'spellcheck', '#E5A50A', '3 stars at spelling', () => anyStars('spell:', 3)],
    ['streak3', '3-day streak', 'local_fire_department', '#F08A24', 'Play 3 days in a row', s => s.streak >= 3],
    ['streak7', '7-day streak', 'whatshot', '#E8443A', 'Play 7 days in a row', s => s.streak >= 7],
    ['wishes', 'Wish granter', 'auto_awesome', '#E5A50A', 'Grant 10 wishes', s => (s.stats.wishes || 0) >= 10],
    ['shopper', 'Shopper', 'storefront', '#3FA45B', 'Buy something in the shop', s => (s.stats.buys || 0) >= 1],
    ['cheese', 'Say cheese!', 'photo_camera', '#6F8CFF', 'Take a photo', s => (s.stats.photos || 0) >= 1],
    ['puddle', 'Puddle jumper', 'umbrella', '#5B7BE0', 'Visit on a rainy day', s => (s.stats.rainyDays || 0) >= 1],
    ['owl', 'Night owl', 'dark_mode', '#4B5A9E', 'Say goodnight after 7pm', s => (s.stats.bedtimes || 0) >= 1],
    ['busy', 'Busy bee', 'task_alt', '#3FA45B', "Finish all of a day's jobs", s => (s.stats.jobDays || 0) >= 1],
    ['quick', 'Quick thinker', 'bolt', '#E5A50A', 'Answer 10 quick questions', s => (s.stats.popq || 0) >= 10],
    ['newlook', 'New look', 'palette', '#ef5f89', "Change your frog's colour", s => (s.stats.colours || 0) >= 1],
    ['divider', 'Divide and conquer', 'call_split', '#a780e6', '3 stars at division', () => anyStars('divide:', 3)],
    ['wordwiz', 'Word wizard', 'menu_book', '#2A9DB0', '3 stars at a word game', () => anyStars('words:', 3)],
    ['zoomies', 'Zoomies!', 'directions_run', '#5fd4c4', 'See the after-loo zoomies', s => (s.stats.zoomies || 0) >= 1],
    ['treat', 'Treat time', 'cake', '#FF8FC0', 'Buy a treat', s => (s.stats.treats || 0) >= 1],
    ['player', 'Playtime', 'sports_volleyball', '#FF6B6B', 'Play with a toy 10 times', s => (s.stats.toys || 0) >= 10],
    ['collector', 'Collector', 'inventory_2', '#76cf8a', 'Own 15 things from the shop', s => Object.keys(s.owned).length >= 15],
    ['royal', 'King of the castle', 'castle', '#8f7fe0', 'Buy the Frog Castle', s => !!s.owned.castle],
    ['traveller', 'World traveller', 'travel_explore', '#37aae3', 'Own 5 places', s => ['garden', 'seaside', 'rainforest', 'arctic', 'desert', 'paris', 'london', 'spooky', 'candy', 'underwater', 'disco', 'space'].filter(k => s.owned[k]).length >= 5]
  ];
  let checking = false;
  function checkStickers() {
    if (checking || S.stage === 'egg') return; checking = true;
    STICKERS.forEach(([id, name, icon, color, , test]) => {
      if (S.stickers[id] || !test(S)) return;
      S.stickers[id] = Date.now(); save();
      queueToast('New sticker!', name, icon, color);
      earn(10);
    });
    checking = false;
  }
  const toastQ = []; let toastBusy = false;
  function queueToast(label, title, icon, color) { toastQ.push({ label, title, icon, color }); if (!toastBusy) nextToast(); }
  function nextToast() {
    const t = toastQ.shift(); if (!t) { toastBusy = false; return; }
    toastBusy = true; sfx('fanfare');
    const el = document.createElement('div'); el.className = 'toast';
    el.innerHTML = '<span class="st ms" style="background:' + t.color + '">' + t.icon + '</span><div><b>' + esc(t.label) + '</b><span class="t">' + esc(t.title) + '</span></div>';
    $('toastHost').appendChild(el);
    setTimeout(() => { el.remove(); nextToast(); }, 3500);
  }
  function checkDay() {
    if (S.stage === 'egg') return;
    ensureJobs();
    const today = dayKey(new Date()); if (S.day === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    S.streak = S.day === dayKey(y) ? S.streak + 1 : 1; S.day = today;
    save();
    const bonus = 5 + Math.min(S.streak, 10);
    setTimeout(() => {
      earn(bonus);
      say(S.streak > 1 ? 'Day ' + S.streak + ' in a row! Here are ' + bonus + ' lily coins.' : 'Hello! Here are ' + bonus + ' lily coins for today.', 4000);
      checkStickers();
    }, note ? 5200 : 1500);
  }

  // ---------- Today's jobs: three a day, at least two of them learning ----------
  const JOBS = {
    feed: { label: 'Feed {name} 2 flies', icon: 'pest_control', goal: 2, go: 'feed' },
    bath: { label: 'Give {name} a bubble bath', icon: 'bathtub', goal: 1, go: 'bath' },
    cuddle: { label: 'Give {name} 5 cuddles', icon: 'favorite', goal: 5 },
    playgame: { label: 'Play a fun game together', icon: 'sports_esports', goal: 1, go: 'pick' },
    popq: { label: "Answer 3 of {name}'s quick questions", icon: 'help', goal: 3 },
    score8: { label: 'Score 8 or more in a learning game', icon: 'military_tech', goal: 1, go: 'pick' }
  };
  const jobInfo = id => id.startsWith('quiz:') ? { label: 'Play ' + QUIZ[id.slice(5)].title, icon: QUIZ[id.slice(5)].icon, color: QUIZ[id.slice(5)].color, goal: 1, go: id.slice(5) } : JOBS[id];
  const fillName = t => t.replace('{name}', nm());
  function makeJobs(day) {
    let h = 17; for (const c of day) h = (h * 31 + c.charCodeAt(0)) | 0;
    const r = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; }, pk = a => a[Math.floor(r() * a.length)];
    const learn = Object.keys(QUIZ), a = pk(learn); let b = pk(learn); while (b === a) b = pk(learn);
    return { day, bonus: false, list: ['quiz:' + a, 'quiz:' + b, pk(Object.keys(JOBS))].map(id => ({ id, n: 0, done: false })) };
  }
  function ensureJobs() {
    if (S.stage === 'egg') return;
    const d = dayKey(new Date()); if (!S.jobs || S.jobs.day !== d || !S.jobs.list.every(j => jobInfo(j.id))) { S.jobs = makeJobs(d); save(); }
  }
  function job(id) {
    ensureJobs(); if (!S.jobs) return;
    S.jobs.list.forEach(j => {
      if (j.id !== id || j.done) return;
      const info = jobInfo(j.id); j.n++;
      if (j.n >= info.goal) { j.done = true; earn(10); queueToast('Job done!', fillName(info.label), 'task_alt', '#3FA45B'); }
    });
    if (!S.jobs.bonus && S.jobs.list.every(j => j.done)) {
      S.jobs.bonus = true; count('jobDays');
      setTimeout(() => { earn(15); queueToast('All jobs done!', 'Bonus 15 lily coins', 'celebration', '#E5A50A'); }, 700);
    }
    save(); render(); checkStickers();
  }
  const openLearnJob = () => S.jobs && S.jobs.list.find(j => !j.done && j.id.startsWith('quiz:'));
  function goJob(id) {
    const info = jobInfo(id);
    if (!info.go) { closeSheet(); say(id === 'cuddle' ? 'Tap me for a cuddle!' : "I'll ask you a question soon!", 2600); if (id === 'popq') nextPop = Date.now() + 3e3; return; }
    if (info.go === 'feed' || info.go === 'bath') { closeSheet(); setTimeout(() => (info.go === 'feed' ? feed : bath)(), 200); return; }
    if (info.go === 'pick') { set({ sheet: 'pick' }); return; }
    openGame(info.go);
  }

  // ---------- Pop quizzes: the frog asks a quick question ----------
  let nextPop = Date.now() + 70e3;
  function maybePop(now) {
    if (S.popq || quiet() || S.asleep || S.away || now < nextPop || mood() === 'sad' || now - lastInteract < 4000) return;
    nextPop = now + rand(150, 260) * 1e3;
    const facts = Object.keys(S.tricky).filter(k => k.startsWith('tables:') && S.tricky[k] > 0).map(k => k.slice(7));
    const q = Learn.pop(facts);
    set({ popq: { q, chosen: -1, fb: null, t: now } });
    engine && engine.hop(); sfx('ribbit');
    if (q.say) setTimeout(() => Sound.say(q.say), 500);
  }
  function popAnswer(i) {
    const p = S.popq; if (!p || p.fb) return;
    const q = p.q, ok = q.choices[i] === q.answer;
    p.chosen = i; p.fb = { ok };
    if (ok) {
      sfx('yes'); addHearts(); count('popq'); if (q.trick && S.tricky[q.trick] > 0) S.tricky[q.trick]--;
      give({ love: 8, fun: 5 }, 1); earn(3); say(pick(['Ribbit! You got it!', 'Wow, you are clever!', 'Yes! Brilliant!', 'Hoppy days! Correct!'])); job('popq');
    } else {
      sfx('no'); if (q.trick) S.tricky[q.trick] = (S.tricky[q.trick] || 0) + 1; save();
      say('Nearly! ' + q.right, 3400);
    }
    render(); setTimeout(() => { if (S.popq === p) set({ popq: null }); }, ok ? 1400 : 3200);
  }

  // ---------- Keeping busy: idle hops, look-arounds and nudges ----------
  let lastInteract = Date.now(), nextIdle = Date.now() + 15e3, nextNudge = Date.now() + 40e3;
  function maybeIdle(now) {
    if (quiet() || S.asleep || S.away) return;
    if (now >= nextIdle) {
      nextIdle = now + rand(12e3, 25e3);
      const r = Math.random(); if (r < .4) engine.hop(); else if (r < .8) engine.lookAround(); else engine.react('pet');
      if (S.decor.duckling && Math.random() < .35) setTimeout(() => sfx('quack'), 600);
      if (S.scene === 'rainforest' && Math.random() < .3) { engine.shakeOff(); say('Shake shake! I’m drenched!', 2200); }
      if (S.scene === 'arctic' && Math.random() < .3) sfx('brr');
      if (S.scene === 'london' && new Date().getMinutes() === 0 && Math.random() < .5) sfx('bong');
      if (Math.random() < .4) sfx('ribbit');
    }
    if (now - lastInteract > 30e3 && now >= nextNudge) {
      nextNudge = now + rand(40e3, 70e3);
      engine.hop(); sfx('ribbit'); say(nudgeLine(), 4200);
    }
  }
  function nudgeLine() {
    const lines = [], open = openLearnJob();
    if (S.want) lines.push('Hey! ' + wantText(S.want));
    if (open) lines.push("Don't forget today's job: " + QUIZ[open.id.slice(5)].title + '!');
    lines.push('Psst! Shall we do some maths together? I love numbers!', "I'm bored! Can we play Spelling Bubbles?", "Ribbit! Are you still there? Let's learn something new!",
      'Can we do some times tables? I want to be clever like you!', "Let's earn some lily coins with a learning game!");
    return pick(lines);
  }

  // ---------- The clock: needs drain, loo fills, wishes appear ----------
  let lastTick = 0, nextFart = 0, nextYawn = 0, nextWant = Date.now() + 25e3, snoreN = 0;
  function decay() {
    const now = Date.now(), raw = (now - (lastTick || now)) / 1000; lastTick = now;
    checkDay();
    if (S.stage === 'egg' || S.sheet === 'game' || S.celebrate || S.away) return;
    const dt = Math.min(raw, 43200), needs = Object.assign({}, S.needs), rainy = isRainy();
    if (S.asleep) {
      for (const k of CARE) needs[k] = Math.max(5, needs[k] - RATES[k] * dt * .5);
      needs.energy = Math.min(100, needs.energy + SLEEP_GAIN * dt);
      set({ needs });
      if (++snoreN % 4 === 0 && document.visibilityState === 'visible') sfx('snore');
      if (needs.energy >= 100) wake(true);
      save(); return;
    }
    for (const k of CARE) needs[k] = Math.max(5, needs[k] - RATES[k] * dt * (k === 'clean' ? (hasMess() ? 2 : rainy ? .5 : 1) : 1));
    needs.energy = Math.max(5, needs.energy - RATES.energy * dt * (isNight() ? 1.6 : 1));
    const potty = S.potty + POTTY_RATE * dt;
    set({ needs, potty });
    if (potty >= 100) accident();
    else maybeFart(now);
    maybeYawn(now); maybeWant(now); maybePop(now); maybeIdle(now);
    if (S.popq && !S.popq.fb && now - S.popq.t > 90e3) set({ popq: null });
    save();
  }
  function quiet() { return S.busy || S.toast || S.sheet || S.celebrate || S.drag || S.gate || S.popq || !engine; }
  function maybeFart(now) {
    if (S.potty < 65 || quiet()) return;
    if (!nextFart) nextFart = now + rand(3e3, 8e3);
    if (now < nextFart) return;
    const urgent = S.potty >= 85;
    engine.fart(); sfx('fart'); count('farts'); checkStickers();
    say(pick(urgent ? ['Pfffft! I REALLY need the loo!', 'Oops, more bubbles! Loo, please!'] : ['Pardon me! Hee hee.', 'Oops! Bubbles!', 'Pfft! Excuse me!', 'Was that me? Hee hee.']), 2800);
    nextFart = now + (urgent ? rand(9e3, 16e3) : rand(18e3, 34e3));
  }
  function maybeYawn(now) {
    if (S.needs.energy >= 30 || quiet() || now < nextYawn) return;
    engine.yawn(); sfx('yawn'); nextYawn = now + rand(20e3, 40e3);
  }
  function maybeWant(now) {
    if (S.want || now < nextWant) return;
    nextWant = now + rand(2, 4) * 60e3;
    // mostly learning wishes, with the odd fun game
    const kind = Math.random() < .75 ? pick(Object.keys(QUIZ).concat(['tables', 'tables'])) : pick(Object.keys(PLAY));
    if (kind !== 'tables') { set({ want: { kind } }); return; }
    // ask for the table she has fewest stars on
    const tabs = []; for (let t = 2; t <= 12; t++) tabs.push(t);
    const lo = Math.min(...tabs.map(t => S.stars['tables:' + t] || 0));
    set({ want: { kind, table: pick(tabs.filter(t => (S.stars['tables:' + t] || 0) === lo)) } });
  }
  const wantText = w => w.kind === 'tables' ? "Let's practise the " + w.table + ' times table!' : GAMES[w.kind].want;
  function accident() {
    const mess = S.mess.slice(), i = mess.indexOf(0); if (i >= 0) mess[i] = 3;
    set({ mess, potty: 20 }); save(); nextFart = 0;
    engine && engine.react('no'); sfx('fart'); setTimeout(() => sfx('plop'), 500);
    say("Oh no… I couldn't hold it! Can you help clean up?", 4200);
  }

  // ---------- Care actions ----------
  let busyT, toastT, petN = 0;
  function lock(ms) { set({ busy: true }); clearTimeout(busyT); busyT = setTimeout(() => set({ busy: false }), ms); }
  function say(text, ms = 2600) { set({ toast: text }); clearTimeout(toastT); toastT = setTimeout(() => set({ toast: null }), ms); }
  function give(gifts, xp) {
    const needs = Object.assign({}, S.needs);
    for (const k in gifts) needs[k] = Math.max(k === 'energy' ? 5 : 0, clamp(needs[k] + gifts[k]));
    S.needs = needs; S.xp += xp || 0;
    save(); render(); checkGrow(); checkStickers();
  }
  const canAct = () => !S.busy && S.stage !== 'egg' && !S.celebrate && !S.asleep && !S.away;
  const nm = () => S.name || 'Pip';

  function feed() {
    if (!canAct()) return;
    if (S.needs.food >= 95) { engine && engine.react('no'); say("I'm full! No more flies."); return; }
    engine && engine.feed(); lock(1700); sfx('buzz');
    setTimeout(() => {
      sfx('crunch'); S.potty += POTTY_PER_MEAL; count('feeds'); job('feed');
      give({ food: 30 }, 1); earn(1); say(pick(['Yum! Crunchy fly!', 'Mmm, thank you!', 'Tasty! More please?']));
    }, 1300);
  }
  function bath() {
    if (!canAct()) return;
    if (S.needs.clean >= 95) { engine && engine.react('no'); say("I'm already sparkly clean!"); return; }
    engine && engine.bath(); lock(2300); sfx('splash');
    [500, 900, 1300, 1700].forEach(d => setTimeout(() => sfx('pop'), d));
    setTimeout(() => { count('baths'); job('bath'); give({ clean: 45 }, 1); earn(1); say('So bubbly! I feel shiny.'); }, 1400);
  }
  function pet() {
    if (S.stage === 'egg') { engine && engine.react('no'); return; }
    if (S.asleep) { say(pick(['Zzz… shh, sleeping…', 'Mmm… five more minutes…', 'Zzz… ribbit… zzz…']), 2000); return; }
    if (!canAct()) return;
    petN++; const tickle = petN % 3 === 0;
    engine && engine.react(tickle ? 'tickle' : 'pet'); sfx(tickle ? 'giggle' : 'ribbit');
    addHearts(); count('cuddles'); job('cuddle'); give({ love: 12 }, petN % 2 === 0 ? 1 : 0);
    if (tickle) earn(1);
    say(tickle ? 'Hee hee! That tickles!' : pick(['Aww, I love cuddles.', 'More pats please!', 'You are my best friend.']));
    lock(tickle ? 800 : 650);
  }
  function loo() {
    if (!canAct()) return;
    if (S.potty < 30) { engine && engine.react('no'); say("I don't need to go right now."); return; }
    lock(3700); set({ away: true }); say('Be right back!', 1200);
    engine && engine.hopAway(1.3);
    setTimeout(() => sfx('flush'), 1300);
    setTimeout(() => {
      S.away = false; S.potty = 0; nextFart = 0; count('loos'); count('zoomies');
      give({ love: 5 }, 1); earn(2);
      lock(3900); engine && engine.zoomies(); sfx('zoom'); setTimeout(() => sfx('zoom'), 1700);
      say(pick(['ZOOMIES! Wheeee!', 'Zoom zoom zoom! Loo zoomies!', 'Nyooooom!']), 3400);
      setTimeout(() => say(pick(['Phew! Much better. And I washed my hands!', 'All done! Hands washed, too.']), 3000), 3800);
    }, 3300);
  }
  function sleep() {
    if (!canAct()) return;
    if (S.needs.energy >= 90) { engine && engine.react('no'); say("I'm not sleepy yet!"); return; }
    if (isNight()) count('bedtimes');
    sfx('yawn'); set({ asleep: true, sheet: null, want: null }); save(); say('Night night!', 1800); checkStickers();
  }
  function wake(auto) {
    const e = S.needs.energy;
    set({ asleep: false }); nextWant = Date.now() + 60e3;
    if (e >= 95) { count('sleeps'); earn(2); }
    save(); checkStickers();
    setTimeout(() => { sfx('ribbit'); engine && (auto ? engine.react('celebrate') : engine.yawn()); }, 300);
    say(auto ? 'Good morning! I feel full of beans!' : e < 60 ? 'Yawn… I was still a bit sleepy.' : 'Morning! That was a good nap.', 3000);
  }
  function scoop(i) {
    if (S.stage === 'egg' || S.away || !(S.mess[i] > 0)) return;
    const mess = S.mess.slice(); mess[i]--; set({ mess }); sfx('pop');
    if (mess[i] > 0) { say(pick(['Scoop!', 'Nearly gone…', 'Keep going!']), 1200); save(); return; }
    sfx('yes'); count('scoops'); give({ love: 5, clean: 10 }, 1); earn(3);
    say(hasMess() ? 'One more to go!' : pick(['Thank you! All clean now.', "Sparkly! You're the best."]));
  }
  function play() {
    if (!canAct()) return;
    if (S.needs.energy < 15) { engine && engine.yawn(); sfx('yawn'); say("I'm too sleepy to play. Nap time?"); return; }
    set({ sheet: 'pick' });
  }
  function shop() { if (S.stage === 'egg' || S.celebrate || S.away) return; set({ sheet: 'shop', confirm: null }); }
  function closeSheet() { stopGame(); set({ sheet: null, game: null, confirm: null, photo: null }); }
  const ACTIONS = [
    { kind: 'feed', label: 'Feed', icon: 'pest_control', color: colorOf('food'), run: feed },
    { kind: 'bath', label: 'Bath', icon: 'bathtub', color: colorOf('clean'), run: bath },
    { kind: 'play', label: 'Play', icon: 'sports_esports', color: colorOf('fun'), run: play },
    { kind: 'loo', label: 'Loo', icon: 'wc', color: '#5fd4c4', run: loo },
    { kind: 'sleep', label: 'Sleep', icon: 'bedtime', color: colorOf('energy'), run: sleep },
    { kind: 'shop', label: 'Shop', icon: 'storefront', color: '#76cf8a', run: shop }
  ];

  function addHearts() {
    const fx = $('fx');
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('span');
      h.textContent = '♥';
      h.style.cssText = 'left:' + (40 + Math.random() * 20) + '%;top:' + (34 + Math.random() * 12) + '%;font-size:' + (22 + Math.random() * 16) + 'px;animation:fp-heart 1.3s ' + (i * 130) + 'ms ease-out both';
      fx.appendChild(h);
      setTimeout(() => h.remove(), 1700);
    }
  }

  function checkGrow() {
    let next = null;
    if (S.stage === 'tadpole' && S.xp >= 8) next = 'froglet';
    else if (S.stage === 'froglet' && S.xp >= 20) next = 'frog';
    if (!next) return;
    stopGame();
    set({ stage: next, celebrate: { kind: 'grow', stage: next }, sheet: null, game: null }); save();
    sfx('fanfare'); setTimeout(() => engine && engine.burst(), 400);
    checkStickers();
  }
  function hatch() {
    lastInteract = Date.now();
    const raw = ($('nameInput').value || '').trim() || 'Pip';
    const name = (raw.charAt(0).toUpperCase() + raw.slice(1)).slice(0, 14);
    $('nameInput').blur();
    set({ name, stage: 'tadpole', celebrate: { kind: 'hatch' } }); save();
    sfx('fanfare'); setTimeout(() => engine && engine.burst(), 350);
    checkDay();
  }
  function resetAll() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    $('nameInput').value = '';
    S = Object.assign(base(), { sheet: null, game: null, toast: null, celebrate: null, want: null, away: false, gate: false, tab: 'hats', confirm: null, resetArm: false, photo: null, popq: null });
    Sound.setMuted(false); render();
  }

  // ---------- Shop ----------
  const owns = id => ITEM[id].price === 0 || !!S.owned[id];
  function equip(it, fresh) {
    const id = it.id;
    if (it.tab === 'hats') { set({ hat: id }); if (id !== 'none') say(pick(['Do I look fancy?', 'I love it!', 'So stylish!'])); }
    else if (it.tab === 'colours') { if (S.colour !== id) { set({ colour: id }); engine && engine.react('celebrate'); say(pick(['Ta-da! A whole new me!', 'Do you like my new colour?', 'Ooh, I feel fabulous!'])); if (id !== 'green') count('colours'); } }
    else if (it.slot) { const on = S[it.slot] !== id || fresh; set({ [it.slot]: on ? id : 'none' }); if (on) say(pick(['How do I look?', 'Very smart!', 'I love it!'])); if (S.stage === 'tadpole') say("I'll wear it when I grow legs!"); }
    else if (it.auto) say(it.note + '!', 2600);
    else if (it.scene) { if (S.scene !== id) { set({ scene: id }); say(pick(['Ooh, a new place!', 'Wow, look at this!', 'Off we go!']), 1300); enterScene(id); } }
    else { const on = fresh || !S.decor[id]; set({ decor: Object.assign({}, S.decor, { [id]: on }) }); if (on) say(pick(['Ooh, lovely!', 'My pond looks amazing!', 'Hello, friend!', 'Wow, thank you!'])); }
    checkStickers();
  }
  function tapItem(id) {
    const it = ITEM[id];
    if (it.need && !it.need(S) && !owns(id)) { sfx('no'); say('To unlock that: ' + it.needText.charAt(0).toLowerCase() + it.needText.slice(1) + '!', 3000); return; }
    if (it.treat) {
      if (it.ok && !it.ok()) { sfx('no'); say('Maybe another day! ' + it.okText + '.', 2600); return; }
      if (!canAct()) { say('Not right now!', 1500); return; }
      if (S.coins < it.price) { sfx('no'); say('I need ' + (it.price - S.coins) + ' more lily coins for that.', 2200); return; }
      if (S.confirm !== id) { set({ confirm: id }); return; }
      set({ coins: S.coins - it.price, confirm: null }); count('treats'); save(); sfx('coin');
      closeSheet(); setTimeout(() => giveTreat(it), 250); return;
    }
    if (owns(id)) { set({ confirm: null }); equip(it, false); save(); return; }
    if (S.coins < it.price) { sfx('no'); say('I need ' + (it.price - S.coins) + ' more lily coins for that.', 2200); return; }
    if (S.confirm !== id) { set({ confirm: id }); return; }
    set({ owned: Object.assign({}, S.owned, { [id]: true }), coins: S.coins - it.price, confirm: null });
    count('buys'); equip(it, true); save(); sfx('coin'); setTimeout(() => sfx('fanfare'), 150);
    if (!it.auto && !it.scene) say(pick(['Ooh, thank you!', 'Wow! I love it!', 'Best present ever!']));
    checkStickers();
  }
  function giveTreat(it) {
    engine && engine.eat(it.treat); lock(1900);
    setTimeout(() => sfx(it.treat === 'smoothie' || it.treat === 'cocoa' ? 'slurp' : 'crunch'), it.treat === 'dragonfly' ? 1300 : 600);
    setTimeout(() => {
      if (it.gifts.food) S.potty += 10;
      give(it.gifts, 1); addHearts(); if (it.treat === 'cake') sfx('fanfare');
      say(it.line, 2800);
    }, 1700);
  }
  const TOY_LINE = { ball: 'Header! Did you see that?', wand: 'Bubbles everywhere!', trampoline: 'Boing boing boing!', radio: 'I love this song! Dance with me!', kite: 'Wheee! Look at it fly!' };
  function playToy(k) {
    if (S.asleep) { say('Zzz… play tomorrow…', 1800); return; }
    if (!canAct()) return;
    if (S.needs.energy < 10) { engine && engine.yawn(); say('Too sleepy to play…'); return; }
    const ms = engine ? engine.playToy(k) : 0; if (!ms) return;
    lock(ms); count('toys');
    if (k === 'ball' || k === 'trampoline') [0, 1, 2].forEach(i => setTimeout(() => sfx('boing'), 300 + i * (k === 'ball' ? 450 : 730)));
    if (k === 'wand') [0, 1, 2, 3, 4].forEach(i => setTimeout(() => sfx('pop'), 400 + i * 300));
    if (k === 'radio') sfx('tune');
    if (k === 'kite') sfx('whoosh');
    say(TOY_LINE[k], Math.min(ms, 3000));
    setTimeout(() => { give({ fun: 12, love: 3, energy: -2 }, (S.stats.toys || 0) % 3 === 0 ? 1 : 0); checkStickers(); }, ms);
  }

  // ---------- Photo booth ----------
  function takePhoto() {
    if (!engine || S.stage === 'egg' || S.sheet || S.celebrate || S.away || S.busy) return;
    set({ busy: true }); const c = $('count'); c.hidden = false;
    const step = n => {
      c.innerHTML = '<span>' + (n || '🙂') + '</span>';
      if (n === 1 && !S.asleep) { say('Say cheese!', 1500); engine.react('pet'); }
      if (n > 0) { sfx('pop'); setTimeout(() => step(n - 1), 900); return; }
      c.hidden = true; c.innerHTML = '';
      const shot = engine.snapshot(); sfx('camera');
      const fl = document.createElement('div'); fl.className = 'flash'; $('app').appendChild(fl); setTimeout(() => fl.remove(), 700);
      compose(shot).then(url => { count('photos'); set({ busy: false, sheet: 'photo', photo: url }); save(); checkStickers(); }, () => set({ busy: false }));
    };
    step(3);
  }
  // sky top, sky at horizon, water near, water deep (matches app.css)
  const SKY = { dawn: ['#5E7FA6', '#F2B48A', '#4E7C86', '#16343C'], day: ['#3C8DC4', '#9FD3EA', '#3E93A3', '#174E5A'], dusk: ['#3B3F78', '#E0907A', '#4D4F78', '#141C33'], night: ['#0B1D2C', '#1C3D4E', '#1A4A52', '#06171B'] };
  function compose(shot) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const W = 1080, H = 1350, P = 54, ph = 1060, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const g = cv.getContext('2d');
        g.fillStyle = '#FFFDF6'; g.fillRect(0, 0, W, H);
        const [s1, s2, w1, w2] = SKY[scenePhase()], gr = g.createLinearGradient(0, P, 0, P + ph);
        gr.addColorStop(0, s1); gr.addColorStop(.38, s2); gr.addColorStop(.381, w1); gr.addColorStop(1, w2);
        g.save(); g.beginPath(); g.rect(P, P, W - 2 * P, ph); g.clip(); g.fillStyle = gr; g.fillRect(P, P, W - 2 * P, ph);
        const s = Math.max((W - 2 * P) / img.width, ph / img.height), iw = img.width * s, ih = img.height * s;
        g.drawImage(img, W / 2 - iw / 2, P + ph / 2 - ih / 2, iw, ih); g.restore();
        g.fillStyle = '#1F2A22'; g.font = "900 72px Nunito, system-ui, sans-serif"; g.fillText(nm(), P + 6, P + ph + 110);
        g.fillStyle = '#7A857D'; g.font = "700 38px Nunito, system-ui, sans-serif";
        g.fillText(STAGE_NAME[S.stage] + ' · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), P + 8, P + ph + 168);
        g.textAlign = 'right'; g.fillStyle = '#3FA45B'; g.font = "900 40px Nunito, system-ui, sans-serif"; g.fillText('Frog Pond', W - P - 6, P + ph + 110);
        res(cv.toDataURL('image/png'));
      };
      img.onerror = rej; img.src = shot;
    });
  }
  async function savePhoto() {
    const url = S.photo; if (!url) return;
    const name = nm().replace(/[^\w-]+/g, '') + '-frog-pond.png';
    try {
      const blob = await (await fetch(url)).blob(), file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Frog Pond' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- Games ----------
  let raf = 0, t0 = 0, tl = 0, sid = 0, qTimer = 0, memT = 0;
  function stopGame() { cancelAnimationFrame(raf); clearTimeout(qTimer); clearTimeout(memT); }
  function openGame(kind) {
    stopGame();
    const g = { kind, phase: 'ready', score: 0 };
    if (kind === 'flies') Object.assign(g, { left: 20, flies: [] });
    if (kind === 'swim') Object.assign(g, { left: 30, lane: 1, hearts: 3, items: [], spawn: 0 });
    if (QUIZ[kind]) g.phase = 'pick';
    if (kind === 'memory') Object.assign(g, { phase: 'run', moves: 0, open: [], matched: 0, cards: shuffle(MEM_ICONS.concat(MEM_ICONS)).map(([icon, color], i) => ({ i, icon, color, up: false, done: false })) });
    set({ sheet: 'game', game: g });
  }
  function loop(step) {
    t0 = tl = performance.now();
    const tick = now => {
      const g = S.game; if (!g || g.phase !== 'run') return;
      const dt = Math.min(.05, (now - tl) / 1000); tl = now;
      step(g, dt, (now - t0) / 1000);
      renderGame();
      if (S.game && S.game.phase === 'run') raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  }
  function endGame(extra) {
    stopGame(); const g = S.game; Object.assign(g, { phase: 'done' }, extra || {});
    g.coins = gameCoins(g); render();
    sfx(g.kind === 'swim' && g.hearts <= 0 ? 'bonk' : 'fanfare');
  }
  function gameCoins(g) {
    const sc = g.score || 0;
    if (g.kind === 'flies') return Math.min(10, Math.ceil(sc / 2));
    if (g.kind === 'swim') return Math.min(12, Math.floor(sc / 3));
    if (g.kind === 'memory') return Math.max(3, 14 - Math.floor(g.moves / 2));
    return sc + (g.stars || 0) * 3;
  }
  function startGame() {
    const g = S.game; sid = 0;
    if (g.kind === 'flies') { g.flies = [0, 1, 2, 3, 4].map(newFly); g.phase = 'run'; loop(flyStep); }
    if (g.kind === 'swim') { g.phase = 'run'; loop(swimStep); }
    render();
  }

  // Fly Catch
  function newFly() { const a = Math.random() * Math.PI * 2, sp = 18 + Math.random() * 22; return { id: ++sid, x: 10 + Math.random() * 80, y: 12 + Math.random() * 70, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }; }
  function flyStep(g, dt, el) {
    g.left = Math.max(0, 20 - el);
    if (g.left <= 0) { g.flies = []; endGame(); return; }
    g.flies.forEach(f => {
      if (Math.random() < .03) { const a = Math.random() * Math.PI * 2, sp = 18 + Math.random() * 28; f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < 7) { f.x = 7; f.vx = Math.abs(f.vx); } if (f.x > 93) { f.x = 93; f.vx = -Math.abs(f.vx); }
      if (f.y < 8) { f.y = 8; f.vy = Math.abs(f.vy); } if (f.y > 92) { f.y = 92; f.vy = -Math.abs(f.vy); }
    });
  }
  function catchFly(id) {
    const g = S.game; if (!g || g.kind !== 'flies' || g.phase !== 'run') return;
    g.score++; sfx('pop'); g.flies = g.flies.map(f => (f.id === id ? newFly() : f)); renderGame();
  }

  // Pond Swim: three lanes, things float down towards the frog
  function swimStep(g, dt, el) {
    g.left = Math.max(0, 30 - el);
    if (g.left <= 0) { endGame(); return; }
    const speed = 30 + el * 1.3; // % of the field per second
    g.spawn -= dt;
    if (g.spawn <= 0) {
      g.spawn = Math.max(.42, .85 - el * .014);
      const r = Math.random();
      g.items.push({ id: ++sid, lane: Math.floor(Math.random() * 3), y: -8, type: r < .52 ? 'flower' : r < .7 ? 'bubble' : 'log' });
    }
    g.items.forEach(it => {
      it.y += speed * dt;
      if (!it.hit && it.lane === g.lane && it.y > 76 && it.y < 92) {
        it.hit = true;
        if (it.type === 'log') { g.hearts--; bonk(); sfx('bonk'); } else { g.score += it.type === 'bubble' ? 2 : 1; sfx('pop'); }
      }
    });
    g.items = g.items.filter(it => it.y < 112 && !(it.hit && it.type !== 'log'));
    if (g.hearts <= 0) endGame();
  }
  function bonk() { const f = $('field'); f.classList.remove('bonk'); void f.offsetWidth; f.classList.add('bonk'); }
  function swimTo(dir) { const g = S.game; if (!g || g.kind !== 'swim' || g.phase !== 'run') return; g.lane = Math.max(0, Math.min(2, g.lane + dir)); sfx('splash'); renderGame(); }

  // Learning quizzes (times tables, number bonds, telling the time, spelling)
  const trickyWords = () => Object.keys(S.tricky).filter(k => k.startsWith('spell:') && S.tricky[k] > 0).sort((a, b) => S.tricky[b] - S.tricky[a]).map(k => k.slice(6));
  function startQuiz(key) {
    const g = S.game, k = g.kind;
    const qs = k === 'tables' ? Learn.tables(key === 'mix' ? 'mix' : +key) : k === 'spell' ? Learn.spell(key, trickyWords()) : Learn[k](key);
    Object.assign(g, { phase: 'run', key: String(key), qs, i: 0, input: '', fb: null, chosen: -1, wrong: [], score: 0 });
    askNext(true);
  }
  function askNext(first) {
    const g = S.game; if (!first) { g.i++; g.input = ''; g.fb = null; g.chosen = -1; }
    if (g.i >= g.qs.length) { finishQuiz(); return; }
    const q = g.qs[g.i];
    g.qStart = performance.now(); render();
    if (q.say) setTimeout(() => Sound.say(q.say), 300);
    if (S.clock && QUIZ[g.kind].keypad) {
      cancelAnimationFrame(raf);
      const tick = () => {
        const gg = S.game; if (!gg || !QUIZ[gg.kind] || gg.phase !== 'run' || gg.fb) return;
        if (performance.now() - gg.qStart >= 6000) { answer(null, true); return; }
        renderGame(); raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
  }
  function keyIn(k) {
    const g = S.game; if (!g || !QUIZ[g.kind] || !QUIZ[g.kind].keypad || g.phase !== 'run' || g.fb) return;
    if (k === 'del') g.input = g.input.slice(0, -1);
    else if (k === 'go') { if (g.input !== '') answer(+g.input, false); return; }
    else if (g.input.length < 4) g.input = (g.input + k).replace(/^0+(?=\d)/, '');
    renderGame();
  }
  function choose(i) {
    const g = S.game; if (!g || g.phase !== 'run' || g.fb) return;
    g.chosen = i; answer(g.qs[g.i].choices[i], false);
  }
  function answer(val, timedOut) {
    const g = S.game; if (g.fb) return;
    cancelAnimationFrame(raf);
    const q = g.qs[g.i], ok = val !== null && val === q.answer;
    if (ok) { g.score++; if (q.trick && S.tricky[q.trick] > 0) S.tricky[q.trick]--; }
    else { g.wrong.push(q.right); if (q.trick) S.tricky[q.trick] = (S.tricky[q.trick] || 0) + 1; }
    const tail = g.wrong.length && !ok ? g.wrong[g.wrong.length - 1] : '';
    g.fb = { ok, text: ok ? pick(['Ribbit! Correct!', 'Brilliant!', 'Spot on!', 'Hoppy days!']) : (timedOut ? "Time's up! " : 'Not quite! ') + tail };
    sfx(ok ? 'yes' : 'no'); renderGame();
    qTimer = setTimeout(() => askNext(false), ok ? 800 : 2100);
  }
  function finishQuiz() {
    const g = S.game, stars = g.score === 10 ? 3 : g.score >= 8 ? 2 : g.score >= 5 ? 1 : 0, sk = g.kind + ':' + g.key;
    S.stars = Object.assign({}, S.stars, { [sk]: Math.max(S.stars[sk] || 0, stars) });
    S.history = S.history.concat([{ t: Date.now(), kind: g.kind, key: g.key, score: g.score }]).slice(-60);
    save(); endGame({ stars });
    job('quiz:' + g.kind); if (g.score >= 8) job('score8');
  }
  function quizLabel(kind, key) {
    if (kind === 'tables') return key === 'mix' ? 'Mixed times tables' : key + ' times table';
    const o = (QUIZ[kind].opts || []).find(x => x[0] === key);
    return QUIZ[kind].title + (o ? ' · ' + o[1] : '');
  }

  // Lily Memory
  function flip(i) {
    const g = S.game; if (!g || g.kind !== 'memory' || g.phase !== 'run' || g.open.length >= 2) return;
    const c = g.cards[i]; if (c.up || c.done) return;
    c.up = true; g.open.push(i); sfx('flip'); renderGame();
    if (g.open.length < 2) return;
    g.moves++; g.score = g.moves;
    const [x, y] = g.open.map(j => g.cards[j]);
    if (x.icon === y.icon) {
      x.done = y.done = true; g.open = []; g.matched++; sfx('yes');
      renderGame();
      if (g.matched === MEM_ICONS.length) memT = setTimeout(() => endGame(), 700);
    } else memT = setTimeout(() => { x.up = y.up = false; g.open = []; renderGame(); }, 900);
  }

  function finishGame() {
    const g = S.game; if (!g) return;
    const kind = g.kind, sc = g.score || 0, coins = g.coins || 0;
    let gifts = {}, line = '';
    if (kind === 'flies') { gifts = { fun: Math.min(70, 20 + sc * 5), energy: -6 }; line = sc >= 8 ? sc + ' flies! You are amazing!' : 'That was fun! Play again soon?'; S.best.flies = Math.max(S.best.flies || 0, sc); }
    if (kind === 'swim') { gifts = { fun: Math.min(60, 20 + sc * 3), clean: 20, energy: -10 }; line = 'Splish splash! I love swimming!'; S.best.swim = Math.max(S.best.swim || 0, sc); }
    if (kind === 'memory') { gifts = { fun: Math.min(70, 25 + Math.max(0, 24 - sc) * 3), energy: -4 }; line = 'What a brilliant memory!'; S.best.memory = Math.min(S.best.memory || 99, g.moves); }
    if (QUIZ[kind]) { gifts = { fun: 15 + sc * 3, love: 10, energy: -4 }; line = sc >= 8 ? "You're a superstar!" : "Great practice! We'll get there."; }
    const w = S.want, wanted = w && w.kind === kind && (kind !== 'tables' || String(w.table) === g.key);
    if (wanted) { gifts.love = (gifts.love || 0) + 15; line = "That's just what I wanted! " + line; S.want = null; nextWant = Date.now() + rand(2, 4) * 60e3; count('wishes'); }
    if (PLAY[kind]) job('playgame');
    count('games');
    closeSheet(); give(gifts, 2 + (wanted ? 1 : 0) + (QUIZ[kind] && sc >= 8 ? 1 : 0));
    earn(coins + (wanted ? 5 : 0));
    setTimeout(() => { engine && engine.react('celebrate'); sfx('ribbit'); }, 150);
    say(line, 3000); checkStickers();
  }

  // ---------- Drag items onto the frog ----------
  let dragInfo = null;
  function local(e) { const r = $('app').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function startDrag(kind, e) {
    if (!canAct()) return;
    e.preventDefault();
    const p = local(e);
    dragInfo = { kind, sx: e.clientX, sy: e.clientY, moved: false };
    set({ drag: { kind, x: p.x, y: p.y, over: false, active: false } });
    window.addEventListener('pointermove', onDragMove); window.addEventListener('pointerup', onDragUp); window.addEventListener('pointercancel', onDragCancel);
  }
  function onDragMove(e) {
    const d = dragInfo; if (!d) return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) d.moved = true;
    const p = local(e), over = !!(engine && engine.hitTest(e.clientX, e.clientY));
    set({ drag: { kind: d.kind, x: p.x, y: p.y, over, active: d.moved } });
  }
  function endDrag() {
    window.removeEventListener('pointermove', onDragMove); window.removeEventListener('pointerup', onDragUp); window.removeEventListener('pointercancel', onDragCancel);
    const d = dragInfo; dragInfo = null; set({ drag: null }); return d;
  }
  function onDragCancel() { endDrag(); }
  function onDragUp(e) {
    const d = endDrag(); if (!d) return;
    const over = engine && engine.hitTest(e.clientX, e.clientY);
    if (!d.moved || over) ACTIONS.find(a => a.kind === d.kind).run(); // a plain tap works too
    else say('Drop it right on ' + nm() + '!', 1800);
  }

  // ---------- Grown-ups ----------
  let holdRaf = 0;
  function holdStart(e) {
    e.preventDefault(); const t0h = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0h) / 3000); $('holdFill').style.width = p * 100 + '%';
      if (p >= 1) { holdEnd(); set({ gate: false, sheet: 'parent' }); renderParent(); return; }
      holdRaf = requestAnimationFrame(step);
    };
    holdRaf = requestAnimationFrame(step);
  }
  function holdEnd() { cancelAnimationFrame(holdRaf); $('holdFill').style.width = '0'; }
  function renderParent() {
    const st = S.stars, row = (a, b) => '<li><span>' + a + '</span><span>' + b + '</span></li>';
    const stickerN = Object.keys(S.stickers).length;
    const tricky = prefix => Object.keys(S.tricky).filter(k => k.startsWith(prefix) && S.tricky[k] > 0).sort((a, b) => S.tricky[b] - S.tricky[a]).slice(0, 8);
    const tt = tricky('tables:').concat(tricky('divide:')).sort((a, b) => S.tricky[b] - S.tricky[a]).slice(0, 10), ts = tricky('spell:');
    const when = t => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    let h = '<div class="sheet-head"><div class="sheet-title">Grown-ups’ corner</div><button class="done" id="parentDone">Done</button></div>';
    h += '<div class="pbox"><div class="kpis">' +
      '<div class="kpi"><b>' + S.streak + '</b><span>' + (S.streak === 1 ? 'day' : 'days in a row') + '</span></div>' +
      '<div class="kpi"><b>' + stickerN + '/' + STICKERS.length + '</b><span>stickers</span></div>' +
      '<div class="kpi"><b>' + S.history.length + '</b><span>learning games</span></div>' +
      '<div class="kpi"><b>' + (S.stats.coinsEarned || 0) + '</b><span>lily coins earned</span></div></div></div>';
    h += '<div class="pbox"><h3>Times tables</h3><div class="tgrid-p">';
    for (let t = 1; t <= 12; t++) h += '<div><b>' + t + '×</b><small class="stars3">' + starStr(st['tables:' + t] || 0) + '</small></div>';
    h += '</div><p>Mixed up: <small class="stars3">' + starStr(st['tables:mix'] || 0) + '</small></p>';
    h += tt.length ? '<h3>Tricky facts</h3><ul class="plist">' + tt.map(k => row(esc(k.slice(k.indexOf(':') + 1)), 'missed ' + S.tricky[k] + '×')).join('') + '</ul>' : '<p>No tricky facts yet. Facts she gets wrong will show here until she gets them right again.</p>';
    h += '</div>';
    h += '<div class="pbox"><h3>Other learning</h3><ul class="plist">';
    Object.keys(QUIZ).filter(k => k !== 'tables').forEach(k => QUIZ[k].opts.filter(([key]) => key !== 'tricky').forEach(([key, label]) => { h += row(QUIZ[k].title + ': ' + label, '<small class="stars3">' + starStr(st[k + ':' + key] || 0) + '</small>'); }));
    h += '</ul>' + (ts.length ? '<h3>Tricky spellings</h3><ul class="plist">' + ts.map(k => row(esc(k.slice(6)), 'missed ' + S.tricky[k] + '×')).join('') + '</ul>' : '') + '</div>';
    const recent = S.history.slice(-12).reverse();
    h += '<div class="pbox"><h3>Recent results</h3>' + (recent.length ? '<ul class="plist">' + recent.map(r => row(esc(quizLabel(r.kind, r.key)) + ' — <b>' + r.score + '/10</b>', when(r.t))).join('') + '</ul>' : '<p>Nothing yet.</p>') + '</div>';
    h += '<div class="pbox"><h3>Settings</h3>' +
      '<div class="setting">Sound effects and spoken words<button class="switch" id="pSound" aria-pressed="' + S.sound + '" aria-label="Sound"></button></div>' +
      '<button class="danger" id="pReset">' + (S.resetArm ? 'Tap again to start over with a new egg' : 'Start over with a new egg') + '</button>' +
      '<p>App version ' + APP_VERSION + '. Updates never touch ' + esc(nm()) + '’s progress.</p>' +
      '<p>The sky follows the real time and weather where the frog is (Fleet, Hampshire for the pond and garden; St Ives, the Amazon, Svalbard, Giza, Paris or London for those places), from Open-Meteo. Only the place’s location is sent, nothing about ' + esc(nm()) + '.</p></div>';
    h += '<div class="pbox"><h3>Backup</h3>' +
      '<p>Progress is saved on this device. Removing the app from the Home Screen or clearing website data would lose it, so keep a backup file somewhere safe. It is also the way to move ' + esc(nm()) + ' between Safari and the Home Screen app, or to a new device.</p>' +
      '<div class="row2"><button class="ghostbtn" id="pBackup">Save a backup</button><button class="ghostbtn" id="pRestore">Restore a backup</button></div>' +
      '<input type="file" id="pFile" accept=".json,application/json" hidden>' +
      (S.restoreMsg ? '<p><b>' + esc(S.restoreMsg) + '</b></p>' : '') +
      (lastBackup() ? '<p>Last backup: ' + when(lastBackup()) + '</p>' : '<p>No backup saved yet.</p>') + '</div>';
    $('parentBody').innerHTML = h;
    $('parentDone').onclick = () => set({ sheet: null, resetArm: false });
    $('pSound').onclick = () => { toggleSound(); renderParent(); };
    $('pReset').onclick = () => { if (!S.resetArm) { S.resetArm = true; renderParent(); return; } resetAll(); };
    $('pBackup').onclick = backup;
    $('pRestore').onclick = () => $('pFile').click();
    $('pFile').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) restore(f); };
  }

  // ---------- Backups ----------
  const lastBackup = () => { try { return +localStorage.getItem(KEY + '-backup') || 0; } catch (e) { return 0; } };
  async function backup() {
    save();
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    const json = JSON.stringify({ app: 'frog-pond', format: 1, saved: new Date().toISOString(), data }, null, 1);
    const name = 'frog-pond-' + nm().replace(/[^\w-]+/g, '') + '-' + dayKey(new Date()) + '.json';
    let done = false;
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Frog Pond backup' }); done = true; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    if (!done) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    try { localStorage.setItem(KEY + '-backup', String(Date.now())); } catch (e) {}
    S.restoreMsg = 'Backup saved.'; renderParent();
  }
  function restore(file) {
    const rd = new FileReader();
    rd.onload = () => {
      let d = null;
      try { const o = JSON.parse(rd.result); d = o && o.app === 'frog-pond' ? o.data : null; } catch (e) {}
      if (!d || typeof d !== 'object' || !d.needs || !d.stage) { S.restoreMsg = "That file isn't a Frog Pond backup."; renderParent(); return; }
      if (!confirm('Replace the frog on this device with ' + (d.name || 'the frog') + ' from the backup?')) return;
      d.last = Date.now(); // don't count time spent in the backup file as time away
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { S.restoreMsg = 'Could not restore, storage is full.'; renderParent(); return; }
      restoring = true; location.reload();
    };
    rd.readAsText(file);
  }
  let restoring = false;
  function toggleSound() { set({ sound: !S.sound }); Sound.setMuted(!S.sound); save(); if (S.sound) sfx('ribbit'); }

  // ---------- Scenery for each scene: horizon (viewBox 400×40) and corner clumps (90×120) ----------
  let builtScene = null;
  function buildScenery(scene) {
    builtScene = scene;
    const R = Math.random, bumps = (step, lo, hi) => { let d = ''; for (let x = 0; x <= 400; x += step + R() * step) d += ' Q' + (x + 4).toFixed(0) + ' ' + (lo + R() * (hi - lo)).toFixed(0) + ' ' + (x + step).toFixed(0) + ' ' + (hi + R() * 4).toFixed(0); return d; };
    let hz = '', corner = () => '', fx = '';
    // a landmark standing on the horizon
    const lm = (left, w, h, vb, inner, cls) => '<svg class="lm ' + (cls || '') + '" style="left:' + left + '%;width:' + w + '%;height:' + h + '%" viewBox="' + vb + '" preserveAspectRatio="xMidYMax meet">' + inner + '</svg>';
    const peaks = (pts, fill) => '<path d="M0 40 ' + pts + ' L400 40 Z" fill="' + fill + '"/>';
    if (scene === 'arctic') {
      hz = peaks('L0 24 L30 6 L55 20 L80 2 L110 22 L140 10 L170 26 L200 12 L235 28 L265 8 L300 24 L330 14 L360 28 L400 16', '#f4fbff') + peaks('L0 32 L40 22 L70 30 L110 26 L150 33 L200 24 L250 32 L300 27 L350 34 L400 28', '#cfe6f2') +
        '<path d="M300 40 A14 14 0 0 1 328 40 Z" fill="#ffffff"/><path d="M309 40 A5 5 0 0 1 319 40 Z" fill="#7aa7bf"/><path d="M302 34 L326 34 M304 30 L324 30" stroke="#cfe6f2" stroke-width=".8"/>';
      corner = side => side ? '<rect x="8" y="88" width="40" height="32" rx="4" fill="#e6f6ff"/><rect x="40" y="96" width="30" height="24" rx="4" fill="#cfe9f7"/>' :
        // a polar bear (penguins live at the other end of the world!)
        '<ellipse cx="40" cy="98" rx="30" ry="17" fill="#f3f6fa"/><rect x="18" y="104" width="10" height="16" rx="4" fill="#f3f6fa"/><rect x="50" y="104" width="10" height="16" rx="4" fill="#f3f6fa"/>' +
        '<circle cx="70" cy="86" r="12" fill="#f3f6fa"/><circle cx="64" cy="75" r="4" fill="#e3e9f0"/><ellipse cx="80" cy="89" rx="7" ry="5" fill="#f3f6fa"/><circle cx="86" cy="88" r="2.2" fill="#1b1b24"/><circle cx="72" cy="83" r="1.6" fill="#1b1b24"/>' +
        '<path d="M14 98 Q30 90 44 96" stroke="#dfe7ef" stroke-width="2" fill="none"/>';
      fx = '<div class="aurora"></div>';
    } else if (scene === 'desert') {
      hz = '<path d="M0 40 L0 26 Q60 10 120 24 Q180 36 240 22 Q300 10 360 22 Q385 27 400 24 L400 40 Z" fill="#e8c27a"/><path d="M0 40 L0 32 Q80 24 160 34 Q240 40 320 30 Q370 26 400 32 L400 40 Z" fill="#d6a95c"/>';
      fx = lm(8, 46, 22, '0 0 200 100', '<polygon points="0,100 60,18 120,100" fill="#d9a35e"/><polygon points="60,18 120,100 84,100" fill="#b9823f"/><polygon points="96,100 150,42 204,100" fill="#d9a35e"/><polygon points="150,42 204,100 170,100" fill="#b9823f"/>');
      corner = side => '<path d="M40 120 L40 40 Q40 28 47 28 Q54 28 54 40 L54 120 Z M40 80 L28 80 Q22 80 22 70 L22 56 Q22 50 27 50 Q32 50 32 56 L32 72 L40 72 Z M54 70 L64 70 L64 52 Q64 46 69 46 Q74 46 74 52 L74 70 Q74 78 66 78 L54 78 Z" fill="#3f8a3f"/><ellipse cx="' + (side ? 20 : 74) + '" cy="116" rx="14" ry="6" fill="#c48f5a"/>';
    } else if (scene === 'paris') {
      let roofs = ''; for (let x = 0; x < 400; x += 26 + (x % 3) * 6) { const h = 14 + ((x * 7) % 11); roofs += '<rect x="' + x + '" y="' + (40 - h) + '" width="' + (24 + (x % 3) * 6) + '" height="' + h + '" fill="#e9dcc3"/><path d="M' + x + ' ' + (40 - h) + ' L' + (x + 4) + ' ' + (34 - h) + ' L' + (x + 20 + (x % 3) * 6) + ' ' + (34 - h) + ' L' + (x + 24 + (x % 3) * 6) + ' ' + (40 - h) + ' Z" fill="#6c7591"/><rect x="' + (x + 8) + '" y="' + (44 - h) + '" width="4" height="5" fill="#9fb4cc"/>'; }
      hz = roofs;
      fx = lm(14, 22, 36, '0 0 100 200', '<path d="M50 0 L52 28 L56 60 L62 95 L70 130 L86 200 L66 200 Q50 158 34 200 L14 200 L30 130 L38 95 L44 60 L48 28 Z" fill="#5b5f6e"/><rect x="35" y="92" width="30" height="5" fill="#474a57"/><rect x="25" y="127" width="50" height="6" fill="#474a57"/><path d="M42 60 L58 95 M58 60 L42 95 M34 133 L66 196 M66 133 L34 196" stroke="#474a57" stroke-width="1.5"/>');
      corner = side => side ? '<rect x="20" y="96" width="40" height="22" rx="3" fill="#b5651d"/><circle cx="28" cy="94" r="7" fill="#ff5c8a"/><circle cx="40" cy="91" r="7" fill="#ffd23f"/><circle cx="52" cy="94" r="7" fill="#ff5c8a"/>' :
        '<rect x="42" y="30" width="5" height="90" fill="#1f2a22"/><path d="M34 30 L55 30 L50 14 L39 14 Z" fill="#1f2a22"/><rect x="38" y="16" width="13" height="12" fill="#ffe28a"/><rect x="36" y="112" width="17" height="8" fill="#1f2a22"/>';
    } else if (scene === 'london') {
      let sky = ''; for (let x = 0; x < 400; x += 22) { const h = 10 + ((x * 13) % 14); sky += '<rect x="' + x + '" y="' + (40 - h) + '" width="21" height="' + h + '" fill="#8d8f9a"/>'; }
      hz = sky + '<rect x="0" y="34" width="400" height="6" fill="#6b6e78"/><g transform="translate(250 22)"><rect width="36" height="13" rx="2" fill="#d62828"/><rect x="2" y="2" width="32" height="4" fill="#ffe8e8"/><rect x="2" y="7.5" width="32" height="3" fill="#ffe8e8"/><circle cx="8" cy="13" r="2.5" fill="#1b1b24"/><circle cx="28" cy="13" r="2.5" fill="#1b1b24"/></g>';
      fx = lm(6, 14, 38, '0 0 60 220', '<rect x="16" y="70" width="28" height="150" fill="#c9a66b"/><rect x="12" y="58" width="36" height="40" fill="#b8955c"/><circle cx="30" cy="78" r="12" fill="#fdf6e3"/><path d="M30 78 L30 69 M30 78 L36 81" stroke="#1f2a22" stroke-width="2"/><polygon points="12,58 48,58 30,4" fill="#6b5435"/><path d="M22 110 L22 210 M30 110 L30 210 M38 110 L38 210" stroke="#a8874f" stroke-width="2"/>') +
        lm(66, 30, 28, '0 0 120 130', '<circle cx="60" cy="58" r="52" fill="none" stroke="#eef2f7" stroke-width="3"/>' + Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return '<line x1="60" y1="58" x2="' + (60 + Math.cos(a) * 52) + '" y2="' + (58 + Math.sin(a) * 52) + '" stroke="#dfe6ee" stroke-width="1"/><circle cx="' + (60 + Math.cos(a) * 52) + '" cy="' + (58 + Math.sin(a) * 52) + '" r="4" fill="#bfe6ff"/>'; }).join('') + '<path d="M60 58 L42 130 M60 58 L78 130" stroke="#eef2f7" stroke-width="3"/>', 'eye');
      corner = side => side ? '<rect x="42" y="30" width="5" height="90" fill="#1f2a22"/><path d="M34 30 L55 30 L50 14 L39 14 Z" fill="#1f2a22"/><rect x="38" y="16" width="13" height="12" fill="#ffe28a"/>' :
        '<rect x="24" y="40" width="40" height="80" rx="4" fill="#d62828"/><path d="M24 44 Q44 30 64 44" fill="#b81f1f"/><rect x="29" y="54" width="30" height="40" fill="#ffe8e8"/><path d="M39 54 L39 94 M49 54 L49 94 M29 67 L59 67 M29 80 L59 80" stroke="#d62828" stroke-width="2"/><rect x="30" y="46" width="28" height="5" fill="#1b1b24"/>';
    } else if (scene === 'spooky') {
      let t = ''; [[30, 14], [120, 8], [210, 16], [330, 10]].forEach(([x, top]) => { t += '<path d="M' + x + ' 40 L' + (x + 2) + ' ' + top + ' M' + (x + 1) + ' ' + (top + 10) + ' L' + (x - 8) + ' ' + (top + 2) + ' M' + (x + 1) + ' ' + (top + 14) + ' L' + (x + 10) + ' ' + (top + 5) + '" stroke="#160d22" stroke-width="2.2" fill="none"/>'; });
      hz = '<path d="M0 40 L0 32 Q100 26 200 33 Q300 38 400 30 L400 40 Z" fill="#160d22"/>' + t + [60, 80, 160, 260, 280].map(x => '<path d="M' + x + ' 40 L' + x + ' 32 Q' + (x + 5) + ' 26 ' + (x + 10) + ' 32 L' + (x + 10) + ' 40 Z" fill="#2a2038"/>').join('');
      fx = lm(64, 30, 24, '0 0 120 110', '<rect x="20" y="45" width="70" height="65" fill="#1b1028"/><polygon points="14,47 55,12 96,47" fill="#140b1f"/><rect x="82" y="22" width="18" height="88" fill="#1b1028"/><polygon points="78,24 91,0 104,24" fill="#140b1f"/>' + [[34, 60], [62, 60], [34, 84], [87, 40]].map(([x, y]) => '<rect x="' + x + '" y="' + y + '" width="10" height="12" fill="#ffd23f" opacity=".85"/>').join('')) +
        '<div class="bats">' + [0, 1, 2, 3].map(i => '<span style="top:' + (8 + i * 7) + '%;animation-delay:' + (-i * 3.3) + 's;animation-duration:' + (11 + i * 2) + 's"><svg viewBox="0 0 40 16"><path d="M20 6 Q16 0 10 4 Q6 0 0 6 Q6 6 8 10 Q12 8 14 12 Q17 9 20 12 Q23 9 26 12 Q28 8 32 10 Q34 6 40 6 Q34 0 30 4 Q24 0 20 6 Z" fill="#0d0815"/></svg></span>').join('') + '</div>';
      corner = side => '<path d="M14 120 L14 92 Q14 78 27 78 Q40 78 40 92 L40 120 Z" fill="#4a4458"/><path d="M27 86 L27 100 M21 92 L33 92" stroke="#2a2438" stroke-width="2.5"/>' +
        '<ellipse cx="62" cy="110" rx="16" ry="11" fill="#ff8a1f"/><rect x="60" y="96" width="4" height="6" fill="#4c7a2a"/><path d="M55 106 L58 102 L61 106 Z M63 106 L66 102 L69 106 Z M55 113 Q62 118 69 113" fill="#ffd23f" stroke="#ffd23f"/>';
    } else if (scene === 'candy') {
      hz = [[0, 30, '#ffb3d1'], [60, 26, '#b3e5ff'], [120, 32, '#c9f7c1'], [180, 24, '#ffe28a'], [240, 30, '#d9c2ff'], [300, 26, '#ffb3d1'], [360, 30, '#b3e5ff']].map(([x, r, c]) => '<ellipse cx="' + (x + 30) + '" cy="40" rx="' + (r + 8) + '" ry="' + r + '" fill="' + c + '"/>').join('');
      const pop = (x, h, c) => '<rect x="' + (x - 1.5) + '" y="' + (40 - h) + '" width="3" height="' + h + '" fill="#fff"/><circle cx="' + x + '" cy="' + (40 - h) + '" r="9" fill="' + c + '"/><circle cx="' + x + '" cy="' + (40 - h) + '" r="5.5" fill="none" stroke="#fff" stroke-width="1.6"/>';
      hz += pop(90, 30, '#ff5c8a') + pop(210, 34, '#a780e6') + pop(330, 28, '#37aae3');
      corner = side => '<path d="M40 120 L40 40 Q40 20 58 20 Q76 20 76 38" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M40 120 L40 40 Q40 20 58 20 Q76 20 76 38" fill="none" stroke="#e23b3b" stroke-width="9" stroke-linecap="round" stroke-dasharray="7 7"/>' +
        '<rect x="12" y="70" width="3" height="50" fill="#fff"/><circle cx="13.5" cy="66" r="11" fill="' + (side ? '#ffd23f' : '#7fe0a0') + '"/><circle cx="13.5" cy="66" r="6" fill="none" stroke="#fff" stroke-width="2"/>';
    } else if (scene === 'underwater') {
      hz = '<path d="M0 40 L0 28 Q20 18 40 26 Q60 34 80 24 Q110 14 140 28 Q170 36 200 26 Q240 16 270 30 Q310 38 340 24 Q370 16 400 26 L400 40 Z" fill="#0b3a48"/>' +
        [[60, '#ff7eb6'], [150, '#ffb36b'], [250, '#ff7eb6'], [350, '#c77dff']].map(([x, c]) => '<path d="M' + x + ' 30 L' + (x - 6) + ' 16 M' + x + ' 30 L' + (x + 6) + ' 14 M' + x + ' 30 L' + x + ' 12" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/>').join('');
      corner = side => [[16, 20], [34, 4], [52, 26], [70, 12]].map(([x, top], i) => '<path class="weed" style="animation-delay:' + (-i * .6) + 's" d="M' + x + ' 120 Q' + (x - 10) + ' ' + (top + 70) + ' ' + x + ' ' + (top + 40) + ' Q' + (x + 10) + ' ' + (top + 15) + ' ' + x + ' ' + top + '" fill="none" stroke="' + (i % 2 ? '#2f9a5a' : '#3fbf6a') + '" stroke-width="6" stroke-linecap="round"/>').join('');
      fx = '<div class="rays"></div><div class="fishies">' + [0, 1, 2].map(i => '<span style="top:' + (14 + i * 9) + '%;animation-delay:' + (-i * 4) + 's;animation-duration:' + (14 + i * 3) + 's"><svg viewBox="0 0 30 16"><ellipse cx="12" cy="8" rx="11" ry="6" fill="' + ['#ffb36b', '#ffd23f', '#ff7eb6'][i] + '"/><path d="M22 8 L30 2 L30 14 Z" fill="' + ['#ffb36b', '#ffd23f', '#ff7eb6'][i] + '"/><circle cx="6" cy="6.5" r="1.6" fill="#1b1b24"/></svg></span>').join('') + '</div><div class="risers">' + Array.from({ length: 10 }, (_, i) => '<span style="left:' + (5 + i * 9.5) + '%;animation-delay:' + (-i * .9) + 's;animation-duration:' + (5 + (i % 4)) + 's"></span>').join('') + '</div>';
    } else if (scene === 'disco') {
      hz = '<rect x="0" y="34" width="400" height="6" fill="#2a0d45"/>';
      corner = side => '<rect x="20" y="40" width="46" height="80" rx="5" fill="#1b1024"/><circle cx="43" cy="62" r="11" fill="#2d2040" stroke="#5a3d7a" stroke-width="3"/><circle cx="43" cy="96" r="16" fill="#2d2040" stroke="#5a3d7a" stroke-width="3"/><circle cx="43" cy="96" r="5" fill="#5a3d7a"/>';
      fx = '<div class="beams">' + ['#ff3fa4', '#3fd9ff', '#ffe14d', '#7cff6b'].map((c, i) => '<span style="--c:' + c + ';animation-delay:' + (-i * 1.5) + 's;left:' + (15 + i * 23) + '%"></span>').join('') + '</div><div class="sparkles"></div>';
    } else if (scene === 'space') {
      hz = '<path d="M0 40 L0 26 L22 18 L38 28 L60 12 L84 26 L110 20 L140 30 L170 16 L200 28 L230 22 L260 30 L290 14 L320 26 L350 20 L380 28 L400 22 L400 40 Z" fill="#5e636d"/>';
      corner = side => '<ellipse cx="30" cy="112" rx="24" ry="10" fill="#6c717b"/><ellipse cx="62" cy="114" rx="14" ry="6" fill="#7d828c"/>' + (side ? '<rect x="58" y="60" width="2.5" height="54" fill="#ddd"/><rect x="60.5" y="60" width="22" height="14" fill="#3fa45b"/><circle cx="71" cy="67" r="4" fill="#fff"/>' : '');
      fx = '<div class="planet ring"></div><div class="planet earth"></div><div class="shooting"></div>';
    } else if (scene === 'garden') {
      hz = '<path d="M0 40 L0 18' + bumps(12, 10, 20) + ' L400 20 L400 40 Z" fill="#2f6b3a"/>' +
        '<path d="M298 40 L298 14 L322 3 L346 14 L346 40 Z" fill="#9a6a44"/><rect x="314" y="24" width="12" height="16" fill="#5a3a24"/><rect x="330" y="17" width="9" height="7" fill="#cfe8f2"/>';
      let f = ''; for (let x = 0; x < 400; x += 9) if (x < 292 || x > 350) f += 'M' + x + ' 40 L' + x + ' 27 L' + (x + 3) + ' 23 L' + (x + 6) + ' 27 L' + (x + 6) + ' 40 Z ';
      hz += '<path d="' + f + 'M0 31 L292 31 L292 33 L0 33 Z M350 31 L400 31 L400 33 L350 33 Z" fill="#f4f0e6"/>';
      corner = () => { let h = ''; [[12, 40, '#ff7eb6'], [28, 20, '#ffd23f'], [44, 48, '#a780e6'], [58, 28, '#ff8a2a'], [74, 52, '#ff5c8a']].forEach(([x, top, c]) => { top += R() * 12;
        h += '<path d="M' + x + ' 120 L' + (x + 1) + ' ' + top + '" stroke="#3f8a3f" stroke-width="3"/><ellipse cx="' + (x - 6) + '" cy="' + (top + 30) + '" rx="7" ry="3" fill="#3f8a3f"/>';
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; h += '<circle cx="' + (x + 1 + Math.cos(a) * 6) + '" cy="' + (top + Math.sin(a) * 6) + '" r="4.5" fill="' + c + '"/>'; }
        h += '<circle cx="' + (x + 1) + '" cy="' + top + '" r="3.5" fill="#fff3a0"/>'; }); return h; };
    } else if (scene === 'seaside') {
      hz = '<path d="M0 40 L0 12 Q30 6 60 14 Q90 8 120 22 Q140 30 160 34 L160 40 Z" fill="#b89c6c"/><path d="M0 12 Q30 6 60 14 Q90 8 120 22 L118 25 Q90 13 60 18 Q30 11 0 16 Z" fill="#6aa84f"/>' +
        '<path d="M322 40 L327 6 L337 6 L342 40 Z" fill="#f6f6f2"/><path d="M325 26 L339 26 L340.5 33 L323.5 33 Z M327.5 12 L336.5 12 L337.5 19 L326.5 19 Z" fill="#e23b3b"/><rect x="326" y="1" width="12" height="6" fill="#ffe28a"/><path d="M324 1 L332 -4 L340 1 Z" fill="#e23b3b"/>' +
        '<path d="M220 37 L250 37 L246 40 L224 40 Z M234 37 L234 26 L246 35 Z" fill="#f4f0e6"/>';
      corner = () => { let h = ''; [[18, 98, 22, 14], [50, 104, 26, 16], [74, 92, 16, 22]].forEach(([x, y, rx, ry]) => { h += '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="#8d8f92"/><ellipse cx="' + (x - 4) + '" cy="' + (y - 5) + '" rx="' + rx * .5 + '" ry="' + ry * .4 + '" fill="#a7a9ab"/>'; });
        const st = (cx, cy, r, c) => { let d = ''; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .45 : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); } return '<path d="' + d + 'Z" fill="' + c + '"/>'; };
        return h + st(40, 80, 11, '#ff8a2a') + st(70, 72, 7, '#ff7eb6'); };
    } else if (scene === 'rainforest') {
      hz = '<path d="M0 40 L0 10' + bumps(14, 0, 12) + ' L400 10 L400 40 Z" fill="#14532d"/><path d="M0 40 L0 22' + bumps(10, 12, 24) + ' L400 24 L400 40 Z" fill="#1f6b3a"/>';
      corner = () => { let h = ''; [[20, 30, -30], [45, 15, 10], [70, 40, 35], [30, 60, -15]].forEach(([x, top, rot]) => { top += R() * 8;
        h += '<g transform="rotate(' + rot + ' ' + x + ' 120)"><path d="M' + x + ' 120 L' + x + ' ' + (top + 30) + '" stroke="#14532d" stroke-width="3"/><ellipse cx="' + x + '" cy="' + (top + 18) + '" rx="15" ry="26" fill="#1f7a3e"/><path d="M' + x + ' ' + (top - 6) + ' L' + x + ' ' + (top + 42) + '" stroke="#0f4a26" stroke-width="1.5"/></g>'; });
        return h + '<circle cx="62" cy="52" r="6" fill="#ff5c8a"/><circle cx="62" cy="52" r="2.5" fill="#ffd23f"/>'; };
    } else {
      hz = '<path class="tl" d="M0 40 L0 22' + bumps(8, 4, 18) + ' L400 22 L400 40 Z"/>';
      // a clump of tapered leaves and a few bulrush heads, leaning outwards
      corner = () => { let h = ''; [[10, 30, -14, 0], [22, 8, -6, 1], [30, 44, 4, 0], [40, 18, -2, 1], [52, 52, 12, 0], [62, 34, 8, 1], [74, 64, 18, 0]].forEach(([x, top, lean, head]) => {
        top += R() * 10; const w = 4 + R() * 2;
        h += '<path d="M' + (x - w) + ' 120 Q' + (x + lean * .2) + ' ' + (top + 50) + ' ' + (x + lean) + ' ' + top + ' Q' + (x + lean * .2 + w * .6) + ' ' + (top + 50) + ' ' + (x + w) + ' 120 Z" fill="currentColor"/>';
        if (head) h += '<rect x="' + (x + lean * .9 - 3.5) + '" y="' + (top + 2) + '" width="7" height="20" rx="3.5" fill="#4a2e1c" opacity=".85"/>'; }); return h; };
    }
    $('trees').innerHTML = hz; $('reedsL').innerHTML = corner(0); $('reedsR').innerHTML = corner(1);
    $('sceneFx').innerHTML = fx;
  }

  // ---------- Build static bits ----------
  (function build() {
    // pond scenery: ripples, stars and clouds (the horizon and corners depend on the scene)
    $('ripples').innerHTML = Array.from({ length: 14 }, (_, i) => '<span style="left:' + (5 + Math.random() * 88) + '%;top:' + (8 + Math.random() * 84) + '%;animation-delay:' + (-Math.random() * 4).toFixed(2) + 's;--s:' + (.6 + Math.random() * .8).toFixed(2) + '"></span>').join('');
    $('stars').innerHTML = Array.from({ length: 40 }, () => '<span style="left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 90) + '%;animation-delay:' + (-Math.random() * 4).toFixed(2) + 's;opacity:' + (.4 + Math.random() * .6).toFixed(2) + '"></span>').join('');
    $('clouds').innerHTML = Array.from({ length: 6 }, (_, i) => '<span style="top:' + (62 + i * 5 + Math.random() * 4) + '%;animation-duration:' + (90 + Math.random() * 80).toFixed(0) + 's;animation-delay:' + (-Math.random() * 160).toFixed(0) + 's;--w:' + (90 + Math.random() * 90).toFixed(0) + 'px"></span>').join('');
    $('fireflies').innerHTML = Array.from({ length: 12 }, () =>
      '<span style="left:' + (Math.random() * 92 + 4) + '%;top:' + (Math.random() * 80 + 5) + '%;animation-duration:' + (3 + Math.random() * 4) + 's;animation-delay:' + (-Math.random() * 6) + 's"></span>').join('');

    $('needs').innerHTML = NEED.map(n =>
      '<div class="need"><div class="ring">' +
      '<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="6"></circle>' +
      '<circle class="arc" data-need="' + n.k + '" cx="28" cy="28" r="22" fill="none" stroke="' + n.color + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="0 200" style="filter:drop-shadow(0 0 4px ' + n.color + ')"></circle></svg>' +
      '<span class="ms" style="color:' + n.color + '">' + n.icon + '</span></div>' +
      '<div class="need-label">' + n.label + '</div></div>').join('');

    ACTIONS.forEach(a => {
      const t = document.createElement('div');
      t.className = 'tile'; t.dataset.kind = a.kind; t.setAttribute('role', 'button'); t.setAttribute('aria-label', a.label);
      t.innerHTML = '<span class="ms" style="background:' + a.color + ';box-shadow:0 0 22px -4px ' + a.color + ',inset 0 -4px 0 rgba(0,0,0,.15)">' + a.icon + '</span><span class="tile-label">' + a.label + '</span>';
      t.addEventListener('pointerdown', e => startDrag(a.kind, e));
      $('tray').appendChild(t);
    });

    ['Pip', 'Lily', 'Mossy', 'Jumpy', 'Bubbles'].forEach(n => {
      const b = document.createElement('button'); b.textContent = n;
      b.addEventListener('click', () => { $('nameInput').value = n; });
      $('ideas').appendChild(b);
    });

    const gameBtn = (k, G) => {
      const b = document.createElement('button'); b.dataset.game = k;
      b.innerHTML = '<span class="gi ms" style="background:' + G.color + '">' + G.icon + '</span><span class="gt"><b>' + G.title + '</b><small>' + G.desc + '</small></span><span class="tag" hidden>Wish!</span>';
      b.addEventListener('click', () => openGame(k)); return b;
    };
    Object.keys(PLAY).forEach(k => $('gamesPlay').appendChild(gameBtn(k, PLAY[k])));
    Object.keys(QUIZ).forEach(k => $(QUIZ[k].group === 'maths' ? 'gamesMaths' : 'gamesWords').appendChild(gameBtn(k, QUIZ[k])));

    const tg = $('tgrid');
    for (let t = 1; t <= 12; t++) { const b = document.createElement('button'); b.dataset.key = t; b.innerHTML = '<b>' + t + '×</b><small class="stars3"></small>'; tg.appendChild(b); }
    const mix = document.createElement('button'); mix.className = 'mix'; mix.dataset.key = 'mix'; mix.innerHTML = '<b>Mixed up</b><small class="stars3"></small>'; tg.appendChild(mix);
    tg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) startQuiz(b.dataset.key); });
    $('qOpts').addEventListener('click', e => { const b = e.target.closest('button'); if (b) startQuiz(b.dataset.key); });
    $('clockBtn').addEventListener('click', () => { set({ clock: !S.clock }); save(); });

    $('keys').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'].map(k =>
      '<button data-key="' + k + '"' + (k === 'go' ? ' class="go" aria-label="Check">✓' : k === 'del' ? ' aria-label="Delete">⌫' : '>' + k) + '</button>').join('');
    $('keys').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); keyIn(b.dataset.key); } });
    $('qChoices').addEventListener('click', e => { const b = e.target.closest('button'); if (b) choose(+b.dataset.i); });
    $('qSay').addEventListener('click', () => { const g = S.game; if (g && g.qs && g.qs[g.i]) Sound.say(g.qs[g.i].say); });

    $('memLayer').addEventListener('click', e => { const c = e.target.closest('.mcard'); if (c) flip(+c.dataset.i); });

    $('swimLayer').addEventListener('pointerdown', e => {
      const g = S.game; if (!g || g.phase !== 'run') return;
      e.preventDefault();
      const r = $('swimLayer').getBoundingClientRect(), fx = r.left + r.width * (g.lane + .5) / 3;
      swimTo(e.clientX < fx ? -1 : 1);
    });
    document.addEventListener('keydown', e => {
      const g = S.game; if (!g || S.sheet !== 'game') return;
      if (g.kind === 'swim') { if (e.key === 'ArrowLeft') swimTo(-1); if (e.key === 'ArrowRight') swimTo(1); }
      if (QUIZ[g.kind] && QUIZ[g.kind].keypad) {
        if (/^[0-9]$/.test(e.key)) keyIn(e.key);
        else if (e.key === 'Backspace') keyIn('del');
        else if (e.key === 'Enter') keyIn('go');
      }
    });

    $('tabs').innerHTML = TABS.map(([k, label]) => '<button data-tab="' + k + '" role="tab">' + label + '</button>').join('');
    $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) set({ tab: b.dataset.tab, confirm: null }); });
    $('items').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) tapItem(b.dataset.id); });

    $('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') hatch(); });
    $('hatchBtn').addEventListener('click', hatch);
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheet));
    document.querySelectorAll('[data-grownups]').forEach(b => b.addEventListener('click', () => set({ gate: true, sheet: null })));
    $('gateCancel').addEventListener('click', () => { holdEnd(); set({ gate: false }); });
    $('holdBtn').addEventListener('pointerdown', holdStart);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('holdBtn').addEventListener(ev, holdEnd));
    $('gameClose').addEventListener('click', closeSheet);
    $('startBtn').addEventListener('click', startGame);
    $('finishBtn').addEventListener('click', finishGame);
    $('wakeBtn').addEventListener('click', () => wake(false));
    $('celeBtn').addEventListener('click', () => { set({ celebrate: null }); checkStickers(); });
    $('coinsBtn').addEventListener('click', shop);
    $('wx').addEventListener('click', () => { const l = weatherLine(); if (l && S.stage !== 'egg') say(l, 3500); });
    $('jobsBtn').addEventListener('click', () => { if (S.celebrate || S.away) return; ensureJobs(); set({ sheet: 'jobs' }); });
    $('jobList').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goJob(b.dataset.go); });
    $('popqCh').addEventListener('click', e => { const b = e.target.closest('button'); if (b) popAnswer(+b.dataset.i); });
    $('popqNo').addEventListener('click', () => { set({ popq: null }); say('Okay, maybe later!', 1800); });
    $('popqSay').addEventListener('click', () => { if (S.popq && S.popq.q.say) Sound.say(S.popq.q.say); });
    document.addEventListener('pointerdown', () => { lastInteract = Date.now(); }, true);
    $('bookBtn').addEventListener('click', () => { if (!S.celebrate) set({ sheet: 'book' }); });
    $('photoBtn').addEventListener('click', takePhoto);
    $('soundBtn').addEventListener('click', toggleSound);
    $('savePhoto').addEventListener('click', savePhoto);
    $('flyLayer').addEventListener('pointerdown', e => {
      const f = e.target.closest('.fly'); if (f) { e.preventDefault(); catchFly(+f.dataset.id); }
    });
    document.addEventListener('pointerdown', () => Sound.unlock(), true);
  })();

  // ---------- Render ----------
  const show = (id, on) => { const el = $(id); if (el.hidden === on) el.hidden = !on; };
  const text = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  const html = (el, h) => { if (el.innerHTML !== h) el.innerHTML = h; };

  // keeps a set of absolutely-positioned sprites in step with a list, by id
  function sprites(layer, map, list, make, place) {
    const live = new Set();
    list.forEach(o => {
      live.add(o.id);
      let el = map.get(o.id);
      if (!el) { el = make(o); el.dataset.id = o.id; layer.appendChild(el); map.set(o.id, el); }
      place(el, o);
    });
    map.forEach((el, id) => { if (!live.has(id)) { el.remove(); map.delete(id); } });
  }
  const flyEls = new Map(), itemEls = new Map();

  function speechLine(m, low) {
    if (S.toast) return S.toast;
    if (S.asleep) return 'Zzz…';
    if (S.away) return '';
    if (hasMess()) return 'Eww! Tap the mess to scoop it up.';
    if (S.potty >= 85) return 'I really, really need the loo!';
    const sadLines = { food: 'My tummy is rumbly…', clean: "I'm all muddy!", fun: "I'm sooo bored.", love: 'I miss you. Cuddle?', energy: "I'm so sleepy… bedtime?" };
    const okLines = { food: 'Got any flies?', clean: 'Bath time, maybe?', fun: 'Wanna play?', love: 'Pat my head!', energy: "Yawn… I'm getting sleepy." };
    if (m === 'sad') return sadLines[low.k];
    if (S.needs.energy < 30) return okLines.energy;
    if (S.potty >= 65) return 'I think I need the loo soon…';
    if (S.want) return wantText(S.want);
    const open = openLearnJob();
    if (open && Math.floor(Date.now() / 15000) % 3 === 0) return "Today's job: " + QUIZ[open.id.slice(5)].title + '. Shall we?';
    if (isNight() && S.needs.energy < 70) return "It's nearly bedtime!";
    const slot = Math.floor(Date.now() / 20000) % 4, sl = sceneLine(), wl = weatherLine();
    if (sl && (slot === 1 || slot === 3)) return sl;
    if (wl && slot === 1) return wl;
    return m === 'happy' ? 'Ribbit! I love you, friend!' : okLines[low.k];
  }

  function render() {
    const hatched = S.stage !== 'egg', name = nm();
    const needs = NEED.map(n => ({ k: n.k, v: Math.round(S.needs[n.k]) }));
    const low = needs.slice().sort((a, b) => a.v - b.v)[0], m = mood();

    // sky
    const ph = scenePhase(), wk = sceneWeather(), wet = ['rain', 'drizzle', 'storm'].includes(wk), cls = 'pond sky-' + ph + ' w-' + wk + ' scene-' + S.scene + (FANTASY[S.scene] ? ' fantasy' : '');
    if (builtScene !== S.scene) { buildScenery(S.scene); fetchWeather(); }
    if ($('pond').className !== cls) $('pond').className = cls;
    const orb = S.scene === 'spooky' ? 'moon full' : FANTASY[S.scene] ? '' : S.scene === 'desert' ? 'sun big' : wk === 'clear' || wk === 'partly' ? (ph === 'night' ? 'moon' : 'sun') : '';
    if ($('orb').className !== 'sky-orb ' + orb) $('orb').className = 'sky-orb ' + orb;
    $('orb').hidden = !orb;
    show('fireflies', (ph === 'night' || ph === 'dusk') && !wet && wk !== 'snow'); show('rain', wet);
    show('wx', hatched && wxFresh() && !FANTASY[S.scene]);
    if (wxFresh()) { text($('wxIcon'), WX_ICON[wk][ph === 'night' ? 1 : 0]); text($('wxTemp'), wx().temp + '°C ' + placeName()); }

    show('head', hatched); show('dock', hatched); show('speech', hatched); show('eggSheet', !hatched);
    show('night', hatched && S.asleep); show('zzz', hatched && S.asleep); show('looSign', !!S.away);
    if (hatched) {
      text($('name'), name);
      text($('coins'), String(S.coins));
      text($('soundBtn'), S.sound ? 'volume_up' : 'volume_off');
      let gp = 1, gLabel = 'All grown up!';
      if (S.stage === 'tadpole') { gp = S.xp / 8; gLabel = Math.max(1, Math.ceil(8 - S.xp)) + ' more care to grow legs'; }
      if (S.stage === 'froglet') { gp = (S.xp - 8) / 12; gLabel = Math.max(1, Math.ceil(20 - S.xp)) + ' more care to be a frog'; }
      $('growFill').style.width = Math.round(Math.min(1, Math.max(0, gp)) * 100) + '%';
      text($('growLabel'), STAGE_NAME[S.stage] + ' · ' + gLabel);
      needs.forEach(n => $('needs').querySelector('[data-need="' + n.k + '"]').setAttribute('stroke-dasharray', (n.v / 100 * 138.2).toFixed(1) + ' 200'));

      const sp = speechLine(m, low);
      show('speech', !!sp); text($('speech'), sp);
      show('tray', !S.asleep); show('dockHint', !S.asleep); show('sleepBar', S.asleep);
      text($('dockHint'), 'Drag a thing onto ' + name + ', or tap ' + name + ' to cuddle');
      text($('sleepText'), 'Shh… ' + name + ' is asleep. Energy fills up while ' + name + ' sleeps.');
      $('tray').style.opacity = S.busy || S.away ? .55 : 1;
      $('tray').querySelectorAll('.tile').forEach(t => {
        const k = t.dataset.kind;
        t.classList.toggle('wants', (k === 'play' && (!!S.want || !!openLearnJob())) || (k === 'loo' && S.potty >= 65) || (k === 'sleep' && S.needs.energy < 30));
      });
      const jl = S.jobs ? S.jobs.list : [], jd = jl.filter(j => j.done).length;
      text($('jobsCount'), 'Jobs ' + jd + '/' + jl.length);
      $('jobsBtn').classList.toggle('all', jl.length > 0 && jd === jl.length);
    }
    show('jobsBtn', hatched && !!S.jobs);
    const C = COLOURS[S.colour] || COLOURS.green, app = $('app');
    if (app.dataset.colour !== S.colour) { app.dataset.colour = S.colour; app.style.setProperty('--frog', C.rainbow ? '#67c24a' : C.swatch); app.style.setProperty('--frog2', hex(C.spot)); }

    // pop quiz
    const pq = S.popq; show('popq', !!pq && hatched && !S.sheet && !S.asleep);
    if (pq) {
      const q = pq.q;
      text($('popqLbl'), 'Quick question from ' + name + '!');
      text($('popqQ'), q.text || q.hint); $('popqQ').className = 'popq-q' + (q.small || !q.text ? ' sm' : '');
      show('popqSay', !!q.say && Sound.canSpeak() && S.sound);
      html($('popqCh'), q.choices.map((c, i) => '<button data-i="' + i + '" class="' + (pq.fb ? (c === q.answer ? 'ok' : i === pq.chosen ? 'no' : '') : '') + '">' + esc(c) + '</button>').join(''));
    }

    // drag ghost + drop glow
    const dr = S.drag, active = !!(dr && dr.active);
    show('ghost', active); show('glow', active && dr.over);
    if (active) {
      const a = ACTIONS.find(x => x.kind === dr.kind), gh = $('ghost');
      text(gh, a.icon); gh.style.background = a.color;
      gh.style.left = dr.x + 'px'; gh.style.top = dr.y + 'px';
      gh.style.transform = 'translate(-50%,-60%) scale(' + (dr.over ? 1.2 : 1) + ')';
    }

    show('shopSheet', S.sheet === 'shop'); if (S.sheet === 'shop') renderShop();
    show('bookSheet', S.sheet === 'book'); if (S.sheet === 'book') renderBook();
    show('jobsSheet', S.sheet === 'jobs'); if (S.sheet === 'jobs') renderJobs();
    show('photoSheet', S.sheet === 'photo' && !!S.photo); if (S.photo && $('photoImg').src !== S.photo) $('photoImg').src = S.photo;
    show('gate', S.gate); show('parent', S.sheet === 'parent');

    // game picker
    show('pickSheet', S.sheet === 'pick');
    if (S.sheet === 'pick') {
      text($('pickTitle'), 'Play with ' + name);
      document.querySelectorAll('#pickSheet [data-game]').forEach(b => {
        const on = !!(S.want && S.want.kind === b.dataset.game);
        b.classList.toggle('wanted', on); b.querySelector('.tag').hidden = !on;
      });
    }

    renderGame();

    // celebration
    const cel = S.celebrate;
    show('celeSheet', !!cel);
    if (cel) {
      text($('celeTitle'), cel.kind === 'hatch' ? 'Say hi to ' + name + '!' : cel.stage === 'froglet' ? name + ' is a froglet now!' : name + ' is a real frog!');
      text($('celeBody'), cel.kind === 'hatch' ? 'Your egg hatched into a tiny tadpole. Feed, bathe and cuddle it to help it grow.'
        : cel.stage === 'froglet' ? 'Look, little legs! Keep caring and ' + name + ' will grow into a frog.' : 'All grown up. Spend your lily coins in the shop!');
    }

    syncEngine();
  }

  function renderShop() {
    text($('wallet'), String(S.coins));
    $('tabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
    const h = SHOP[S.tab].map(([id]) => {
      const it = ITEM[id], own = owns(id) && !it.treat, locked = !own && it.need && !it.need(S), off = it.treat && it.ok && !it.ok();
      const on = it.tab === 'hats' ? S.hat === id : it.tab === 'colours' ? S.colour === id : it.slot ? S[it.slot] === id : it.scene ? S.scene === id : it.auto ? false : !!S.decor[id];
      const pr = locked ? '<span class="ms">lock</span>Locked' : own ? (it.auto ? 'Owned' : it.tab === 'hats' || it.slot ? (on ? 'Wearing' : 'Wear') : it.tab === 'colours' || it.scene ? (on ? 'Chosen' : 'Choose') : (on ? 'On' : 'Off'))
        : S.confirm === id ? (it.treat ? 'Tap to give' : 'Tap to buy') : '<span class="coin ms">eco</span>' + it.price;
      const sub = locked ? it.needText : off ? it.okText : it.note || '';
      const pic = id === 'mushroom' ? 'background:radial-gradient(circle at 30% 35%,#fff 0 9%,transparent 10%),radial-gradient(circle at 68% 40%,#fff 0 8%,transparent 9%),radial-gradient(circle at 50% 70%,#fff 0 7%,transparent 8%),#E8443A' : 'background:' + it.color;
      return '<button class="item-card' + (on ? ' on' : '') + (!own && (S.coins < it.price || locked || off) ? ' poor' : '') + (S.confirm === id ? ' confirm' : '') + '" data-id="' + id + '">' +
        '<span class="pic ms" style="' + pic + '">' + (id === 'mushroom' || it.tab === 'colours' ? '' : it.icon) + '</span><span class="nm">' + it.name + '</span>' +
        '<span class="pr' + (own ? ' own' : '') + '">' + pr + '</span>' + (sub ? '<small class="note">' + esc(sub) + '</small>' : '') + '</button>';
    }).join('');
    html($('items'), h);
  }
  function renderJobs() {
    const jl = S.jobs ? S.jobs.list : [];
    html($('jobList'), jl.map(j => {
      const info = jobInfo(j.id);
      return '<div class="job' + (j.done ? ' done' : '') + '"><span class="ji ms" style="background:' + (j.done ? '#3FA45B' : info.color || '#a780e6') + '">' + (j.done ? 'check' : info.icon) + '</span>' +
        '<span class="jt"><b>' + esc(fillName(info.label)) + '</b><small>' + (j.done ? 'Done! +10 lily coins' : (info.goal > 1 ? j.n + ' of ' + info.goal + ' · ' : '') + '10 lily coins') + '</small></span>' +
        (j.done ? '' : '<button data-go="' + j.id + '">Go</button>') + '</div>';
    }).join(''));
    text($('jobsNote'), S.jobs && S.jobs.bonus ? 'All done today! New jobs tomorrow.' : 'Finish all three for a bonus 15 lily coins!');
  }
  function renderBook() {
    text($('streakText'), S.streak === 1 ? '1 day' : S.streak + ' days in a row');
    text($('streakSub'), 'Come back every day for bonus lily coins!');
    html($('stickers'), STICKERS.map(([id, name, icon, color, hint]) => {
      const got = !!S.stickers[id];
      return '<div class="sticker"><span class="st ms' + (got ? '' : ' locked') + '" style="background:' + color + '">' + (got ? icon : 'lock') + '</span><b>' + name + '</b>' + (got ? '' : '<small>' + hint + '</small>') + '</div>';
    }).join(''));
  }

  function renderClock(h, m) {
    let s = '<circle cx="46" cy="30" r="27" style="fill:var(--frog,#67c24a)"/><circle cx="154" cy="30" r="27" style="fill:var(--frog,#67c24a)"/>' +
      '<circle cx="44" cy="25" r="14" fill="#fff"/><circle cx="156" cy="25" r="14" fill="#fff"/><circle cx="47" cy="26" r="7" fill="#15151b"/><circle cx="159" cy="26" r="7" fill="#15151b"/>' +
      '<circle cx="100" cy="108" r="86" fill="#fff" style="stroke:var(--frog,#67c24a)" stroke-width="9"/>';
    for (let i = 0; i < 60; i++) {
      const a = i * Math.PI / 30, r1 = i % 5 ? 76 : 71;
      s += '<line x1="' + (100 + Math.sin(a) * r1).toFixed(1) + '" y1="' + (108 - Math.cos(a) * r1).toFixed(1) + '" x2="' + (100 + Math.sin(a) * 80).toFixed(1) + '" y2="' + (108 - Math.cos(a) * 80).toFixed(1) + '" stroke="' + (i % 5 ? '#C9CFC6' : '#1F2A22') + '" stroke-width="' + (i % 5 ? 1.5 : 3) + '"/>';
    }
    for (let n = 1; n <= 12; n++) { const a = n * Math.PI / 6; s += '<text x="' + (100 + Math.sin(a) * 58).toFixed(1) + '" y="' + (108 - Math.cos(a) * 58 + 7).toFixed(1) + '" text-anchor="middle" font-family="Fredoka,system-ui,sans-serif" font-size="20" font-weight="600" fill="#1F2A22">' + n + '</text>'; }
    const ha = ((h % 12) + m / 60) * Math.PI / 6, ma = m * Math.PI / 30;
    s += '<line x1="100" y1="108" x2="' + (100 + Math.sin(ha) * 40).toFixed(1) + '" y2="' + (108 - Math.cos(ha) * 40).toFixed(1) + '" stroke="#1F2A22" stroke-width="9" stroke-linecap="round"/>';
    s += '<line x1="100" y1="108" x2="' + (100 + Math.sin(ma) * 64).toFixed(1) + '" y2="' + (108 - Math.cos(ma) * 64).toFixed(1) + '" stroke="#1F2A22" stroke-width="5" stroke-linecap="round"/>';
    s += '<circle cx="100" cy="108" r="7" fill="#E08B1E"/>';
    return s;
  }

  function renderGame() {
    const g = S.game, on = S.sheet === 'game' && !!g;
    show('game', on);
    if (!on) { sprites($('flyLayer'), flyEls, [], null, null); sprites($('swimLayer'), itemEls, [], null, null); return; }
    const G = GAMES[g.kind], name = nm(), quiz = !!QUIZ[g.kind];
    document.querySelectorAll('.js-name').forEach(el => text(el, name));
    text($('gameTitle'), G.title);

    // header chips
    const icons = { flies: 'pest_control', swim: 'local_florist', memory: 'touch_app' };
    text($('scoreIcon'), icons[g.kind] || 'check_circle'); text($('gameScore'), String(g.score || 0));
    show('scoreChip', !(quiz && g.phase === 'pick'));
    let tl = null;
    if (g.kind === 'flies' || g.kind === 'swim') tl = Math.ceil(g.left) + 's';
    if (quiz && g.phase === 'run') tl = Math.min(g.i + 1, 10) + '/10';
    show('timeChip', tl !== null); if (tl) text($('gameLeft'), tl);

    // layers
    show('flyLayer', g.kind === 'flies');
    show('swimLayer', g.kind === 'swim');
    show('qPick', quiz && g.phase === 'pick');
    show('qRun', quiz && g.phase === 'run');
    show('memLayer', g.kind === 'memory' && g.phase !== 'done');
    $('field').style.background = g.kind === 'swim' ? 'transparent' : '';

    sprites($('flyLayer'), flyEls, g.kind === 'flies' ? g.flies : [],
      () => { const el = document.createElement('div'); el.className = 'fly'; el.innerHTML = '<span class="w1"></span><span class="w2"></span><span class="b"></span>'; return el; },
      (el, f) => { el.style.left = f.x + '%'; el.style.top = f.y + '%'; });

    if (g.kind === 'swim') {
      $('swimmer').style.left = ((g.lane + .5) / 3 * 100) + '%';
      html($('hearts'), '♥'.repeat(Math.max(0, g.hearts)) + '<i>' + '♥'.repeat(3 - Math.max(0, g.hearts)) + '</i>');
    }
    sprites($('swimLayer'), itemEls, g.kind === 'swim' ? g.items : [],
      it => { const el = document.createElement('div'); el.className = 'item ' + it.type; if (it.type === 'flower') { el.classList.add('ms'); el.textContent = 'local_florist'; } return el; },
      (el, it) => { el.style.left = ((it.lane + .5) / 3 * 100) + '%'; el.style.top = it.y + '%'; });

    if (quiz && g.phase === 'pick') {
      const Q = QUIZ[g.kind];
      text($('qPickTitle'), Q.pick);
      show('tgrid', g.kind === 'tables'); show('qOpts', g.kind !== 'tables'); show('clockBtn', !!Q.keypad);
      if (g.kind === 'tables') {
        const w = S.want && S.want.kind === 'tables' ? String(S.want.table) : null;
        $('tgrid').querySelectorAll('button').forEach(b => {
          const k = b.dataset.key; html(b.querySelector('small'), starStr(S.stars['tables:' + k] || 0));
          b.classList.toggle('wanted', w === k);
        });
      } else {
        const tw = trickyWords().length;
        html($('qOpts'), Q.opts.filter(([k]) => k !== 'tricky' || tw >= 3).map(([k, label]) =>
          '<button data-key="' + k + '"' + (S.want && S.want.kind === g.kind ? ' class="wanted"' : '') + '><span>' + label + (k === 'tricky' ? ' (' + tw + ')' : '') + '</span><small class="stars3">' + starStr(S.stars[g.kind + ':' + k] || 0) + '</small></button>').join(''));
      }
      $('clockBtn').setAttribute('aria-pressed', String(!!S.clock));
      text($('clockBtn').querySelector('.ms'), S.clock ? 'timer' : 'timer_off');
    }
    if (quiz && g.phase === 'run' && g.i < g.qs.length) {
      const q = g.qs[g.i], keypad = q.mode === 'keypad';
      const opt = (QUIZ[g.kind].opts || []).find(x => x[0] === g.key);
      text($('qProg'), (opt ? opt[1] : quizLabel(g.kind, g.key)) + ' · question ' + (g.i + 1) + ' of 10');
      show('qText', !!q.text); if (q.text) { text($('qText'), q.text); $('qText').className = 'q' + (q.small ? ' sm' : ''); }
      show('qClockWrap', !!q.clock); if (q.clock) { const k = q.clock.h + ':' + q.clock.m; if ($('qClock').dataset.k !== k) { $('qClock').dataset.k = k; $('qClock').innerHTML = renderClock(q.clock.h, q.clock.m); } }
      show('qSay', !!q.say && Sound.canSpeak() && S.sound);
      show('qHint', !!q.hint); text($('qHint'), q.hint || '');
      show('qAns', keypad); show('keys', keypad); show('qChoices', !keypad);
      if (keypad) {
        text($('qAns'), g.input || (g.fb ? '–' : '?'));
        $('qAns').className = 'ans' + (g.fb ? (g.fb.ok ? ' ok' : ' no') : '');
      } else {
        const ch = $('qChoices'); ch.className = 'choices' + (g.kind === 'time' ? ' two' : ' bubbles');
        html(ch, q.choices.map((c, i) => {
          const st = g.fb ? (c === q.answer ? ' ok' : i === g.chosen ? ' no' : '') : '';
          return '<button data-i="' + i + '" class="' + st.trim() + '">' + esc(c) + '</button>';
        }).join(''));
      }
      text($('qFb'), g.fb ? g.fb.text : '');
      $('qFb').className = 'fb' + (g.fb ? (g.fb.ok ? ' ok' : ' no') : '');
      show('qBarWrap', !!S.clock && keypad);
      if (S.clock && keypad) $('qBar').style.width = (g.fb ? 0 : Math.max(0, 100 - (performance.now() - g.qStart) / 60)) + '%';
    }

    if (g.kind === 'memory') {
      const ml = $('memLayer'), deck = g.cards.map(c => c.icon).join();
      if (ml.dataset.deck !== deck) {
        ml.dataset.deck = deck;
        ml.innerHTML = g.cards.map(c => '<div class="mcard" data-i="' + c.i + '"><div class="in"><div class="bk"></div><div class="f ms" style="color:' + c.color + '">' + c.icon + '</div></div></div>').join('');
      }
      g.cards.forEach((c, i) => { const el = ml.children[i]; el.classList.toggle('up', c.up || c.done); el.classList.toggle('done', c.done); });
    }

    // ready + done cards
    const ready = g.phase === 'ready';
    show('gameReady', ready);
    if (ready) {
      text($('readyTitle'), g.kind === 'swim' ? "Let's go swimming!" : 'Catch the flies!');
      text($('readyText'), g.kind === 'swim' ? 'Tap left or right to swim. Grab flowers and bubbles, and dodge the logs!' : 'Tap as many flies as you can before time runs out. ' + name + ' is hungry for fun.');
    }
    show('gameDone', g.phase === 'done');
    if (g.phase === 'done') {
      const sc = g.score || 0;
      let big = String(sc), sub = '', extra = '';
      if (g.kind === 'flies') sub = sc >= 8 ? 'Super catcher!' : sc >= 1 ? 'Flies caught!' : 'Those flies were fast!';
      if (g.kind === 'swim') sub = g.hearts <= 0 ? 'Bonk! Too many logs. Flowers grabbed:' : sc >= 25 ? 'Super swimmer!' : 'Flowers and bubbles grabbed!';
      if (g.kind === 'memory') { sub = (g.moves <= 9 ? 'Amazing memory!' : g.moves <= 14 ? 'Well done!' : 'You found them all!') + ' That took ' + g.moves + ' goes.'; big = '6/6'; }
      if (quiz) {
        big = sc + '/10';
        sub = sc === 10 ? 'Perfect score!' : sc >= 8 ? 'Brilliant work!' : sc >= 5 ? 'Good going!' : 'Keep practising!';
        if (g.wrong.length) extra = "Let's remember these:<br>" + g.wrong.map(x => '<b>' + esc(x) + '</b>').join('');
      }
      text($('doneBig'), big); text($('doneText'), sub);
      show('doneStars', quiz); if (quiz) html($('doneStars'), starStr(g.stars || 0));
      show('doneExtra', !!extra); html($('doneExtra'), extra);
      html($('doneCoins'), '<span class="coin ms">eco</span>+' + (g.coins || 0) + ' lily coins');
    }
  }

  if (/[?&]debug\b/.test(location.search)) window.__fp = { playToy, loo, state: () => S }; // test hook

  // ---------- Go ----------
  const iconsOk = () => document.documentElement.classList.add('icons-ok');
  if (document.fonts && document.fonts.load) document.fonts.load("24px 'Material Symbols Rounded'", 'eco').then(f => { if (f.length) iconsOk(); }, () => {});
  else iconsOk();
  render();
  mountEngine();
  if (note) setTimeout(() => say(note, 4500), 600);
  checkDay();
  setInterval(decay, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') decay(); else save(); });

  // ---------- Staying up to date ----------
  // A Home Screen app on iOS is often resumed rather than reloaded, so we check for a new
  // version whenever it comes back into view and reload at a calm moment. The frog lives in
  // localStorage, which updates and the service worker never touch.
  let swReg = null, newVersion = null;
  async function checkForUpdate() {
    if (!/^https?:/.test(location.protocol)) return;
    try {
      const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
      const v = r.ok ? (await r.json()).version : null;
      if (v && v !== APP_VERSION) newVersion = v;
    } catch (e) {}
    if (swReg) swReg.update().catch(() => {});
  }
  function maybeReload() {
    if (!newVersion || restoring) return;
    let tried = null; try { tried = sessionStorage.getItem('fp-reloaded-for'); } catch (e) {}
    if (tried === newVersion) return; // already reloaded once for this version; don't loop if a file is still catching up
    const ae = document.activeElement;
    if (S.sheet === 'game' || S.sheet === 'parent' || S.sheet === 'photo' || S.gate || S.busy || S.drag || S.celebrate || (ae && ae.tagName === 'INPUT')) return;
    save();
    try { sessionStorage.setItem('fp-reloaded-for', newVersion); } catch (e) {}
    location.reload();
  }
  setInterval(maybeReload, 1000);
  fetchWeather(); setInterval(() => fetchWeather(true), 20 * 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fetchWeather(); });
  setInterval(checkForUpdate, 30 * 60e3);
  setTimeout(checkForUpdate, 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
  window.addEventListener('pageshow', e => { if (e.persisted) checkForUpdate(); });

  // ask the browser to keep our storage even when the device is short of space
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}

  try {
    if ('serviceWorker' in navigator && window.top === window && /^https?:/.test(location.protocol))
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(r => { swReg = r; }, () => {}));
  } catch (e) {}
})();
