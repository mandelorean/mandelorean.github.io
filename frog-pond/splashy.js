// Splashy Frog: tap to swim up, sink slowly otherwise. Dodge newts, lobsters and sewage; gobble bugs for points.
// Everything is drawn on one canvas, sized in units of the field's height so it plays the same on any screen.
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');

  function create(cv, o) {
    const ctx = cv.getContext('2d');
    let W = 1, H = 1, dpr = 1;
    function fit() {
      const w = cv.clientWidth || 1, h = cv.clientHeight || 1, d = Math.min(2, window.devicePixelRatio || 1);
      if (w === W && h === H && d === dpr) return;
      W = w; H = h; dpr = d; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    const TOP = () => H * .08, BED = () => H * .86, FX = () => W * .26, FR = () => H * .055;
    const body = hex(o.colour || 0x67c24a), belly = hex(o.belly || 0xe4f6b4), spot = hex(o.spot || 0x4c9e36);
    let s;
    function reset() {
      fit();
      s = { t: 0, dist: 0, hearts: 3, over: 0, frog: { y: H * .42, vy: 0, kick: 0, hurt: 0, eat: 0 }, things: [], bubbles: [], pops: [], nextBad: 1.6, nextFood: .5, lastBadY: H * .5 };
    }
    reset();

    const speed = () => H * (.3 + Math.min(.3, s.t * .0065));

    // ---------- spawning ----------
    function spawnBad() {
      const r = Math.random(), x = W + H * .2;
      if (r < .36) s.things.push({ k: 'lobster', x, y: BED() - H * .035, r: H * .045, ph: Math.random() * TAU });
      else if (r < .86) {
        // keep newts away from the height of the last obstacle, so there's always a way through
        let y; do { y = TOP() + H * .1 + Math.random() * (BED() - TOP() - H * .2); } while (Math.abs(y - s.lastBadY) < H * .14 && Math.random() < .8);
        s.things.push({ k: 'newt', x, y, y0: y, r: H * .046, ph: Math.random() * TAU, extra: H * (.06 + Math.random() * .08) }); s.lastBadY = y;
      } else {
        const y = TOP() + H * .15 + Math.random() * (BED() - TOP() - H * .3);
        s.things.push({ k: 'sewage', x, y, y0: y, r: H * .05, ph: Math.random() * TAU }); s.lastBadY = y;
      }
    }
    function spawnFood() {
      const r = Math.random(), x = W + H * .1;
      let k, y;
      if (r < (o.wizard ? .08 : .05)) { k = 'golden'; y = TOP() + H * .12 + Math.random() * (BED() - TOP() - H * .25); }
      else if (r < .4) { k = 'fly'; y = TOP() + H * .04 + Math.random() * H * .2; }
      else if (r < .78) { k = 'worm'; y = TOP() + H * .15 + Math.random() * (BED() - TOP() - H * .28); }
      else { k = 'snail'; y = BED() - H * .025; }
      // not right on top of something nasty
      if (s.things.some(t => !t.food && Math.abs(t.x - x) < H * .16 && Math.abs(t.y - y) < H * .12)) return;
      s.things.push({ k, x, y, y0: y, r: H * .04, food: true, ph: Math.random() * TAU, pts: k === 'golden' ? 5 : k === 'snail' ? 2 : 1 });
    }

    // ---------- update ----------
    function tap() {
      if (s.over) return;
      const f = s.frog; f.vy = Math.max(Math.min(f.vy, 0) - H * .5, -H * .95); f.kick = 1;
      for (let i = 0; i < 3; i++) s.bubbles.push({ x: FX() - FR() * .9, y: s.frog.y + FR() * .2, r: H * (.006 + Math.random() * .008), vx: -H * (.05 + Math.random() * .1), vy: -H * (.08 + Math.random() * .1), life: 1.2 });
    }
    function update(dt) {
      s.t += dt; const v = speed(); s.dist += v * dt;
      const f = s.frog;
      if (!s.over) {
        f.vy = Math.min(f.vy + H * .95 * dt, H * .42);
        f.y += f.vy * dt;
        if (f.y < TOP() + FR() * .5) { f.y = TOP() + FR() * .5; f.vy = Math.max(f.vy, 0); }
        if (f.y > BED() - FR() * .55) { f.y = BED() - FR() * .55; f.vy = 0; }
      } else { f.vy = Math.min(f.vy + H * .4 * dt, H * .25); f.y = Math.min(f.y + f.vy * dt, BED() - FR() * .55); s.over += dt; if (s.over > 1.1 && !s.ended) { s.ended = true; o.onEnd && o.onEnd(); } }
      f.kick = Math.max(0, f.kick - dt * 3); f.hurt = Math.max(0, f.hurt - dt); f.eat = Math.max(0, f.eat - dt * 4);

      if (!s.over) {
        s.nextBad -= dt; s.nextFood -= dt;
        if (s.nextBad <= 0) { spawnBad(); s.nextBad = Math.max(.8, 1.75 - s.t * .016) * (.8 + Math.random() * .4); }
        if (s.nextFood <= 0) { spawnFood(); s.nextFood = .45 + Math.random() * .55; }
      }
      const fx = FX(), fr = FR();
      // cyborg suit: lock on to a bug ahead with the laser, then reel it into his mouth with a tractor beam
      if ((o.cyborg || o.sith || o.starlord || o.wizard) && !s.over) {
        s.tbCool = Math.max(0, (s.tbCool || 0) - dt);
        if (s.tb && (s.tb.t.gone || s.tb.t.x < fx)) { s.tb = null; s.tbCool = .3; }
        if (!s.tb && s.tbCool <= 0) {
          const tgt = s.things.filter(t => t.food && !t.gone && t.x > fx + fr && t.x < fx + W * .55 && Math.abs(t.y - f.y) < H * .2).sort((a, b) => a.x - b.x)[0];
          if (tgt) { s.tb = { t: tgt, age: 0 }; o.onBeam && o.onBeam(); }
        }
        if (s.tb) {
          const tb = s.tb; tb.age += dt;
          if (tb.age > .15) { const t = tb.t, k = Math.min(1, dt * 7); t.held = true; t.x += (fx + fr * .9 - t.x) * k; t.y += (f.y + fr * .1 - t.y) * k; }
        }
      }
      s.things.forEach(t => {
        t.ph += dt;
        if (t.held) { /* being reeled in by the tractor beam */ }
        else if (t.k === 'newt') { t.x -= (v + t.extra) * dt; t.y = t.y0 + Math.sin(t.ph * 2) * H * .025; }
        else if (t.k === 'lobster') t.x -= (v + H * .03) * dt;
        else if (t.k === 'sewage') { t.x -= v * dt; t.y = t.y0 + Math.sin(t.ph * 1.3) * H * .02; }
        else if (t.k === 'fly') { t.x -= (v - H * .02) * dt; t.y = t.y0 + Math.sin(t.ph * 5) * H * .012; }
        else if (t.k === 'worm' || t.k === 'golden') { t.x -= v * dt; t.y = t.y0 + Math.sin(t.ph * 1.6) * H * .015; }
        else t.x -= v * dt;
        if (t.gone || s.over) return;
        // collisions: the newt is long, so test its head and middle
        const pts = t.k === 'newt' ? [[t.x - t.r * .9, t.y], [t.x + t.r * .5, t.y]] : t.k === 'lobster' ? [[t.x - t.r * 1.2, t.y], [t.x + t.r * .3, t.y]] : [[t.x, t.y]];
        const rr = t.food ? t.r + fr * .9 : t.r * .8 + fr * .7;
        if (!pts.some(([x, y]) => (x - fx) ** 2 + (y - f.y) ** 2 < rr * rr)) return;
        if (t.food) {
          t.gone = true; f.eat = 1; o.onEat && o.onEat(t.pts, t.k);
          s.pops.push({ x: t.x, y: t.y, text: t.k === 'golden' && o.wizard ? 'Snitch! +' + t.pts : '+' + t.pts, life: 1, gold: t.k === 'golden' });
        } else if (f.hurt <= 0) {
          f.hurt = 1.6; s.hearts--; f.vy = -H * .25;
          s.pops.push({ x: fx, y: f.y - fr, text: t.k === 'sewage' ? (o.season === 'halloween' ? 'Boo!' : o.season === 'christmas' ? 'Coal!' : 'Yuck!') : t.k === 'lobster' ? 'Pinch!' : 'Ouch!', life: 1.1, bad: true });
          o.onHit && o.onHit(s.hearts, t.k);
          if (s.hearts <= 0) { s.over = .001; f.vy = 0; }
        }
      });
      s.things = s.things.filter(t => t.x > -H * .4 && !t.gone);
      if (Math.random() < dt * 2.2) s.bubbles.push({ x: Math.random() * W, y: BED(), r: H * (.004 + Math.random() * .01), vx: 0, vy: -H * (.08 + Math.random() * .12), life: 6 });
      s.bubbles.forEach(b => { b.x += (b.vx - v * .15) * dt; b.y += b.vy * dt; b.vx *= .96; b.life -= dt; });
      s.bubbles = s.bubbles.filter(b => b.life > 0 && b.y > TOP());
      s.pops.forEach(p => { p.y -= H * .12 * dt; p.life -= dt; }); s.pops = s.pops.filter(p => p.life > 0);
    }

    // ---------- drawing ----------
    function ell(x, y, rx, ry, rot, fill) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot || 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
    function backdrop() {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#86dcef'); g.addColorStop(.35, '#3aa6cc'); g.addColorStop(1, '#155d8a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // light rays from the surface
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = ((i * W * .3 - s.dist * .08) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * .2, w = W * (.05 + hash(i) * .06), a = .05 + Math.sin(s.t * .7 + i) * .02;
        ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w + W * .25, BED()); ctx.lineTo(x + W * .25, BED()); ctx.fill();
      }
      ctx.restore();
      // far rocky hills
      const hills = (off, base, amp, col) => {
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W + 8; x += 8) { const X = x + off; ctx.lineTo(x, base - amp * (1 + Math.sin(X * .011) * .5 + Math.sin(X * .027 + 1) * .3)); }
        ctx.lineTo(W, H); ctx.fillStyle = col; ctx.fill();
      };
      hills(s.dist * .2, BED() - H * .02, H * .12, 'rgba(18,80,115,.55)');
      hills(s.dist * .4 + 500, BED(), H * .07, 'rgba(14,70,100,.6)');
      // seaweed swaying
      const gap = H * .38, off = s.dist * .7, first = Math.floor(off / gap) - 1;
      for (let i = first; i < first + W / gap + 3; i++) {
        const x = i * gap - off + hash(i) * gap * .6, h = H * (.18 + hash(i + 9) * .22), col = hash(i + 3) < .5 ? '#2f9e57' : '#3fb06a';
        for (let j = 0; j < 3; j++) {
          ctx.beginPath(); ctx.moveTo(x + j * 7, BED() + 4);
          const sw = Math.sin(s.t * 1.4 + i + j) * H * .03;
          ctx.bezierCurveTo(x + j * 7 + sw, BED() - h * .35, x + j * 7 - sw, BED() - h * .7, x + j * 7 + sw * 1.4, BED() - h * (.8 + j * .1));
          ctx.strokeStyle = col; ctx.lineWidth = H * (.012 - j * .002); ctx.lineCap = 'round'; ctx.stroke();
        }
      }
      // sandy bottom with pebbles
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, BED() + Math.sin((x + s.dist) * .03) * H * .006);
      ctx.lineTo(W, H); ctx.fillStyle = '#e3c486'; ctx.fill();
      const pg = H * .09, po = s.dist, pf = Math.floor(po / pg);
      for (let i = pf; i < pf + W / pg + 2; i++) ell(i * pg - po + hash(i) * pg, BED() + H * (.03 + hash(i + 5) * .08), H * (.008 + hash(i + 2) * .01), H * .006, 0, hash(i + 7) < .5 ? '#c9a66a' : '#b8925a');
      // water surface
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, TOP());
      for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, TOP() + Math.sin((x + s.dist * .5) * .04 + s.t * 2) * H * .006);
      ctx.lineTo(W, 0); ctx.fillStyle = 'rgba(220,248,255,.55)'; ctx.fill();
    }
    function bubbles() { ctx.lineWidth = 1.5; s.bubbles.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke(); }); }

    function eyePos() {
      const f = s.frog, r = FR(), rot = clamp(f.vy / (H * .8), -.45, .45), lx = r * .45, ly = -r * .68;
      return [FX() + Math.cos(rot) * lx - Math.sin(rot) * ly, f.y + Math.sin(rot) * lx + Math.cos(rot) * ly];
    }
    function handPos() {
      const f = s.frog, r = FR(), rot = clamp(f.vy / (H * .8), -.45, .45), lx = r * .75, ly = r * .62;
      return [FX() + Math.cos(rot) * lx - Math.sin(rot) * ly, f.y + Math.sin(rot) * lx + Math.cos(rot) * ly];
    }
    // Sith lightning: a few jagged, flickering bolts from his hand to the bug
    function drawLightning() {
      const tb = s.tb; if (!tb || s.over) return;
      const [hx, hy] = handPos(), t = tb.t, reach = Math.min(1, tb.age / .15), dx = (t.x - hx) * reach, dy = (t.y - hy) * reach, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (let b = 0; b < 3; b++) {
        ctx.beginPath(); ctx.moveTo(hx, hy);
        for (let i = 1; i <= 8; i++) { const q = i / 8, j = i === 8 ? 0 : (Math.random() - .5) * L * .22 * Math.sin(Math.PI * q); ctx.lineTo(hx + dx * q + nx * j, hy + dy * q + ny * j); }
        ctx.strokeStyle = 'rgba(120,160,255,.35)'; ctx.lineWidth = H * .016; ctx.stroke();
        ctx.strokeStyle = 'rgba(235,245,255,.95)'; ctx.lineWidth = H * .004; ctx.stroke();
      }
      if (reach >= 1) ell(t.x, t.y, H * (.03 + Math.random() * .015), H * (.03 + Math.random() * .015), 0, 'rgba(170,200,255,.4)');
      ctx.restore();
    }
    // Star-Lord: two blaster shots fly out, then the bug floats in wrapped in an orange energy bubble
    function drawBlast() {
      const tb = s.tb; if (!tb || s.over) return;
      const [hx, hy] = handPos(), t = tb.t;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (tb.age <= .15) {
        [0, 1].forEach(i => { const q = clamp(tb.age / .15 * 1.3 - i * .3, 0, 1); if (q <= 0 || q >= 1) return; const x = hx + (t.x - hx) * q, y = hy + (t.y - hy) * q, a = Math.atan2(t.y - hy, t.x - hx);
          ell(x, y, H * .022, H * .008, a, 'rgba(255,190,80,.95)'); ell(x, y, H * .035, H * .016, a, 'rgba(255,140,40,.35)'); });
      } else {
        const r = H * (.045 + Math.sin(s.t * 12) * .004);
        ell(t.x, t.y, r, r, 0, 'rgba(255,150,60,.28)');
        ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, TAU); ctx.strokeStyle = 'rgba(255,200,120,.8)'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
    }
    // Accio! a stream of golden sparkles from the wand, swirling round the bug as it's summoned
    function drawSpell() {
      const tb = s.tb; if (!tb || s.over) return;
      const [hx, hy] = handPos(), t = tb.t, reach = Math.min(1, tb.age / .15);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const q = ((i / 16) + s.t * 1.6) % 1 * reach, x = hx + (t.x - hx) * q + (Math.random() - .5) * H * .012, y = hy + (t.y - hy) * q + Math.sin(q * 10 + s.t * 9) * H * .01;
        ell(x, y, H * .006, H * .006, 0, i % 3 ? 'rgba(255,215,80,.95)' : 'rgba(255,255,255,.95)');
      }
      if (reach >= 1) for (let i = 0; i < 6; i++) { const a = s.t * 8 + i * 1.05, r = H * .04; ell(t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, H * .006, H * .006, 0, 'rgba(255,230,120,.95)'); }
      ctx.restore();
    }
    function drawBeam() {
      if (o.wizard) { drawSpell(); return; }
      if (o.sith) { drawLightning(); return; }
      if (o.starlord) { drawBlast(); return; }
      const tb = s.tb; if (!tb || s.over) return;
      const [ex, ey] = eyePos(), t = tb.t, dx = t.x - ex, dy = t.y - ey, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, locked = tb.age > .15;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      if (locked) {
        const w = H * (.045 + Math.sin(s.t * 14) * .008);
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(t.x + nx * w, t.y + ny * w); ctx.lineTo(t.x - nx * w, t.y - ny * w); ctx.closePath();
        ctx.fillStyle = 'rgba(255,90,130,.28)'; ctx.fill();
        for (let i = 0; i < 3; i++) {
          const q = 1 - ((s.t * 1.8 + i / 3) % 1), rr = Math.max(1, w * q);
          ctx.beginPath(); ctx.ellipse(ex + dx * q, ey + dy * q, Math.max(1, rr * .3), rr, Math.atan2(dy, dx), 0, TAU); ctx.strokeStyle = 'rgba(255,170,190,.65)'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      const reach = locked ? 1 : tb.age / .15;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + dx * reach, ey + dy * reach); ctx.strokeStyle = 'rgba(255,60,60,.95)'; ctx.lineWidth = H * .006; ctx.stroke();
      if (locked && tb.age < .35) ell(t.x, t.y, H * .035, H * .035, 0, 'rgba(255,200,200,.45)');
      ctx.restore();
    }
    function drawFrog() {
      const f = s.frog, x = FX(), y = f.y, r = FR();
      if (f.hurt > 0 && !s.over && Math.floor(f.hurt * 10) % 2 === 0) ctx.globalAlpha = .35;
      ctx.save(); ctx.translate(x, y); ctx.rotate(s.over ? Math.PI * .9 : clamp(f.vy / (H * .8), -.45, .45));
      // rocket flame from the cyborg suit
      if ((o.cyborg || o.starlord) && f.kick > 0) { ctx.beginPath(); ctx.moveTo(-r * 1.1, -r * .15); ctx.lineTo(-r * (1.6 + f.kick * 1.4 + Math.random() * .3), r * .1); ctx.lineTo(-r * 1.1, r * .35); ctx.fillStyle = '#ffb030'; ctx.fill(); }
      // back leg kicks out behind on each stroke
      const k = f.kick, la = .5 - k * .55, len = r * (.9 + k * .7);
      ctx.save(); ctx.translate(-r * .55, r * .3); ctx.rotate(Math.PI - la);
      ell(len * .45, 0, len * .5, r * .2, 0, spot);
      ctx.translate(len * .9, 0); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * .5, -r * .3); ctx.lineTo(r * .55, 0); ctx.lineTo(r * .5, r * .3); ctx.closePath(); ctx.fillStyle = spot; ctx.fill();
      ctx.restore();
      // body and belly
      ell(0, 0, r * 1.08, r * .8, 0, body);
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r * .8, 0, 0, TAU); ctx.clip(); ell(r * .15, r * .55, r * .95, r * .5, 0, belly); ctx.restore();
      ell(-r * .35, -r * .3, r * .16, r * .1, 0, spot); ell(-r * .7, r * .05, r * .12, r * .08, 0, spot);
      // little front leg
      ell(r * .55, r * .7, r * .28, r * .13, .5, spot);
      // eye on top
      ell(r * .4, -r * .65, r * .34, r * .32, 0, body);
      ell(r * .45, -r * .68, r * .25, r * .25, 0, '#fff');
      ell(r * .54, -r * .66, r * .12, r * .14, 0, s.over ? '#fff' : '#15151b');
      if (s.over) { ctx.strokeStyle = '#15151b'; ctx.lineWidth = r * .06; ctx.beginPath(); ctx.moveTo(r * .35, -r * .78); ctx.lineTo(r * .6, -r * .55); ctx.moveTo(r * .6, -r * .78); ctx.lineTo(r * .35, -r * .55); ctx.stroke(); }
      if (o.cyborg) { ctx.beginPath(); ctx.arc(r * .45, -r * .68, r * .28, 0, TAU); ctx.strokeStyle = '#b9c3cd'; ctx.lineWidth = r * .1; ctx.stroke(); ell(r * .52, -r * .66, r * .09, r * .09, 0, '#ff2a2a'); }
      if (o.cat) {
        [[-.15, -.62], [.5, -.95]].forEach(([ex, ey]) => { ctx.beginPath(); ctx.moveTo(r * (ex - .2), r * (ey + .12)); ctx.lineTo(r * (ex + .02), r * (ey - .38)); ctx.lineTo(r * (ex + .25), r * (ey + .1)); ctx.closePath(); ctx.fillStyle = '#f2a65a'; ctx.fill(); ctx.beginPath(); ctx.moveTo(r * (ex - .1), r * (ey + .06)); ctx.lineTo(r * (ex + .02), r * (ey - .22)); ctx.lineTo(r * (ex + .14), r * (ey + .05)); ctx.closePath(); ctx.fillStyle = '#ffb3c6'; ctx.fill(); });
        ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = Math.max(1, r * .04);
        [-.12, 0, .12].forEach(dy => { ctx.beginPath(); ctx.moveTo(r * .8, r * (.0 + dy * .5)); ctx.lineTo(r * 1.35, r * (-.05 + dy)); ctx.stroke(); });
        ell(r * 1.0, -r * .08, r * .07, r * .05, 0, '#ff7aa2');
      }
      if (o.wizard) {
        // Gryffindor scarf, a wand, a lightning scar and round glasses
        // the end of his scarf streams out behind him as he swims
        for (let i = 0; i < 7; i++) { const x = -r * (.55 + i * .17), y = -r * .05 + Math.sin(s.t * 8 - i * .9) * r * .08 * (i / 3); ell(x, y, r * .1, r * .13, 0, i % 2 ? '#f2b01e' : '#8a1c1c'); }
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(1.5, r * .08); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r * .6, r * .7); ctx.lineTo(r * .95, r * .55); ctx.stroke();
        ctx.strokeStyle = '#b8323f'; ctx.lineWidth = Math.max(1, r * .05); ctx.beginPath(); ctx.moveTo(r * .02, -r * .62); ctx.lineTo(r * .12, -r * .5); ctx.lineTo(r * .02, -r * .44); ctx.lineTo(r * .12, -r * .32); ctx.stroke();
        ctx.beginPath(); ctx.arc(r * .45, -r * .68, r * .3, 0, TAU); ctx.strokeStyle = '#1b1b22'; ctx.lineWidth = Math.max(1, r * .05); ctx.stroke();
      }
      if (o.starlord) {
        // Walkman headphones: a band over his head and an orange ear pad
        ctx.beginPath(); ctx.arc(r * .05, -r * .35, r * .72, Math.PI * 1.05, Math.PI * 1.95); ctx.strokeStyle = '#9aa2ab'; ctx.lineWidth = r * .1; ctx.stroke();
        ell(-r * .62, -r * .22, r * .2, r * .24, 0, '#9aa2ab'); ell(-r * .62, -r * .22, r * .15, r * .19, 0, '#ff8a2a');
      }
      if (o.sith) {
        // a dark hood over his head and back, leaving his face free
        ctx.beginPath(); ctx.moveTo(r * .95, -r * .2); ctx.quadraticCurveTo(r * .9, -r * 1.25, r * .1, -r * 1.2); ctx.quadraticCurveTo(-r * 1.0, -r * 1.1, -r * 1.2, r * .1);
        ctx.quadraticCurveTo(-r * .9, -r * .55, -r * .1, -r * .85); ctx.quadraticCurveTo(r * .55, -r * 1.0, r * .7, -r * .25); ctx.closePath(); ctx.fillStyle = '#1c1820'; ctx.fill();
        // and his eye peeping out from under it
        ell(r * .45, -r * .68, r * .25, r * .25, 0, '#fff'); ell(r * .54, -r * .66, r * .12, r * .14, 0, '#15151b');
      }
      if (o.hat === 'witch') {
        ctx.fillStyle = '#1b1622'; ell(r * .05, -r * .78, r * .62, r * .1, -.15, '#1b1622');
        ctx.beginPath(); ctx.moveTo(-r * .32, -r * .8); ctx.lineTo(r * .02, -r * 1.55); ctx.lineTo(-r * .3, -r * 1.75); ctx.lineTo(r * .38, -r * .86); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(-r * .3, -r * .84); ctx.lineTo(r * .36, -r * .9); ctx.lineTo(r * .32, -r * 1.0); ctx.lineTo(-r * .24, -r * .96); ctx.closePath(); ctx.fill();
      }
      if (o.hat === 'santa') {
        ctx.fillStyle = '#d62a2a'; ctx.beginPath(); ctx.moveTo(-r * .35, -r * .82); ctx.quadraticCurveTo(-r * .1, -r * 1.7, -r * .7, -r * 1.45); ctx.lineTo(r * .38, -r * .88); ctx.closePath(); ctx.fill();
        ell(r * .02, -r * .84, r * .42, r * .12, -.1, '#ffffff'); ell(-r * .72, -r * 1.45, r * .12, r * .12, 0, '#ffffff');
      }
      if (o.hat === 'crown') { ctx.fillStyle = '#f5c542'; ctx.beginPath(); ctx.moveTo(-r * .2, -r * .7); ctx.lineTo(-r * .25, -r * 1.05); ctx.lineTo(-r * .05, -r * .85); ctx.lineTo(r * .1, -r * 1.1); ctx.lineTo(r * .2, -r * .8); ctx.closePath(); ctx.fill(); }
      // cheek and mouth (opens wide when he gobbles something)
      ell(r * .72, r * .05, r * .14, r * .09, 0, 'rgba(255,140,170,.8)');
      if (f.eat > 0) ell(r * .98, r * .12, r * .16, r * .2 * f.eat, 0, '#7a2a3a');
      else { ctx.beginPath(); ctx.arc(r * .82, -r * .02, r * .2, .3, 1.3); ctx.strokeStyle = '#2a4a2a'; ctx.lineWidth = r * .07; ctx.lineCap = 'round'; ctx.stroke(); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    function drawNewt(t) {
      const r = t.r, w = Math.sin(t.ph * 9);
      ctx.save(); ctx.translate(t.x, t.y);
      // tail
      ctx.beginPath(); ctx.moveTo(r * .6, -r * .3);
      ctx.quadraticCurveTo(r * 1.6, -r * .2 + w * r * .3, r * 2.6, w * r * .5); ctx.quadraticCurveTo(r * 1.6, r * .25 + w * r * .3, r * .6, r * .3); ctx.fillStyle = '#7b5530'; ctx.fill();
      // legs
      [[-r * .5, 1], [r * .4, -1]].forEach(([lx, d]) => { ell(lx + d * w * r * .1, r * .4, r * .1, r * .28, .4 * d, '#6a4626'); ell(lx - d * w * r * .1, -r * .35, r * .1, r * .26, -.4 * d, '#6a4626'); });
      ell(0, 0, r * 1.05, r * .38, 0, '#7b5530');
      ell(0, r * .14, r * .9, r * .2, 0, '#ff8a2a');
      ell(-r * 1.05, 0, r * .45, r * .32, 0, '#7b5530');
      [[-.3, -.15], [.2, -.2], [.55, -.1], [-.1, -.05]].forEach(([a, b]) => ell(r * a, r * b, r * .07, r * .06, 0, '#3f2a14'));
      ell(-r * 1.2, -r * .14, r * .08, r * .08, 0, '#fff'); ell(-r * 1.23, -r * .14, r * .045, r * .05, 0, '#111');
      ctx.restore();
    }
    function drawLobster(t) {
      const r = t.r, snap = Math.max(0, Math.sin(t.ph * 5)) * .5, red = '#d8432c', dk = '#a3301e';
      ctx.save(); ctx.translate(t.x, t.y);
      ctx.strokeStyle = dk; ctx.lineWidth = r * .08;
      for (let i = 0; i < 4; i++) { const lx = -r * .3 + i * r * .25, st = Math.sin(t.ph * 8 + i) * r * .1; ctx.beginPath(); ctx.moveTo(lx, r * .2); ctx.lineTo(lx - r * .15 + st, r * .7); ctx.stroke(); }
      // tail segments
      for (let i = 0; i < 4; i++) ell(r * (.7 + i * .38), r * (.02 + i * .03), r * (.28 - i * .03), r * (.24 - i * .03), 0, i % 2 ? red : dk);
      ctx.beginPath(); ctx.moveTo(r * 1.9, 0); ctx.lineTo(r * 2.3, -r * .25); ctx.lineTo(r * 2.3, r * .3); ctx.closePath(); ctx.fillStyle = red; ctx.fill();
      ell(0, 0, r * .62, r * .38, 0, red);
      // antennae
      ctx.beginPath(); ctx.moveTo(-r * .55, -r * .2); ctx.quadraticCurveTo(-r * 1.4, -r * 1.4, -r * .2, -r * 1.7 + Math.sin(t.ph * 3) * r * .2); ctx.moveTo(-r * .5, -r * .25); ctx.quadraticCurveTo(-r * 1, -r * 1.3, r * .3, -r * 1.5); ctx.stroke();
      // eyes on stalks
      ell(-r * .55, -r * .42, r * .08, r * .08, 0, '#111');
      // arms and big claws, snapping
      [[-1, -r * .15], [1, r * .18]].forEach(([sd, cy]) => {
        ctx.beginPath(); ctx.moveTo(-r * .4, cy); ctx.lineTo(-r * .95, cy - sd * r * .15); ctx.lineWidth = r * .12; ctx.stroke();
        ctx.save(); ctx.translate(-r * 1.15, cy - sd * r * .2);
        ctx.save(); ctx.rotate(-snap); ell(-r * .25, -r * .1, r * .32, r * .14, 0, red); ctx.restore();
        ctx.save(); ctx.rotate(snap); ell(-r * .25, r * .1, r * .3, r * .12, 0, dk); ctx.restore();
        ctx.restore();
      });
      ctx.restore();
    }
    function drawSewage(t) {
      const r = t.r;
      if (o.season === 'halloween') {
        // a friendly-but-in-the-way ghost
        ctx.save(); ctx.translate(t.x, t.y);
        ctx.beginPath(); ctx.moveTo(-r * .8, r * .7); ctx.lineTo(-r * .8, -r * .1); ctx.arc(0, -r * .1, r * .8, Math.PI, 0); ctx.lineTo(r * .8, r * .7);
        for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(r * (.6 - i * .4), r * (1.05 + Math.sin(t.ph * 6 + i) * .12), r * (.4 - i * .4), r * .7);
        ctx.closePath(); ctx.fillStyle = 'rgba(245,245,255,.92)'; ctx.fill();
        ell(-r * .28, -r * .2, r * .12, r * .17, 0, '#2a2438'); ell(r * .28, -r * .2, r * .12, r * .17, 0, '#2a2438'); ell(0, r * .22, r * .14, r * .18, 0, '#2a2438');
        ctx.restore(); return;
      }
      if (o.season === 'christmas') {
        // a lump of coal (for naughty frogs!)
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ph * .5);
        ctx.beginPath(); [[1, 0], [.6, .75], [-.2, .85], [-.9, .35], [-.85, -.45], [-.15, -.9], [.7, -.6]].forEach(([x, y], i) => (i ? ctx.lineTo(x * r * .8, y * r * .8) : ctx.moveTo(x * r * .8, y * r * .8))); ctx.closePath();
        ctx.fillStyle = '#26262c'; ctx.fill(); ell(-r * .2, -r * .25, r * .2, r * .1, -.5, 'rgba(255,255,255,.18)');
        ctx.restore(); return;
      }
      ctx.save(); ctx.translate(t.x, t.y);
      ctx.strokeStyle = 'rgba(140,200,90,.75)'; ctx.lineWidth = r * .09; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); const sx = i * r * .45, ph = t.ph * 3 + i; ctx.moveTo(sx, -r * .7); ctx.bezierCurveTo(sx + Math.sin(ph) * r * .25, -r * 1, sx - Math.sin(ph) * r * .25, -r * 1.2, sx, -r * 1.5); ctx.stroke(); }
      ell(-r * .35, r * .1, r * .55, r * .45, 0, '#7a5230'); ell(r * .35, r * .15, r * .5, r * .4, 0, '#6b4628'); ell(0, -r * .25, r * .45, r * .4, 0, '#865a35');
      ell(-r * .15, -r * .35, r * .1, r * .07, 0, '#9c7048'); ell(r * .3, r * .1, r * .08, r * .06, 0, '#4f3219');
      // a fly buzzing round it
      const a = t.ph * 6; ell(Math.cos(a) * r * 1.1, -r * .4 + Math.sin(a) * r * .5, r * .1, r * .07, 0, '#222');
      ctx.restore();
    }
    function drawFood(t) {
      const r = t.r;
      ctx.save(); ctx.translate(t.x, t.y);
      if (t.k === 'fly') {
        const flap = Math.abs(Math.sin(t.ph * 30));
        ell(-r * .1, -r * .35, r * .4, r * .22 * (.4 + flap), -.4, 'rgba(230,245,255,.85)'); ell(r * .2, -r * .35, r * .4, r * .22 * (.4 + flap), .4, 'rgba(230,245,255,.85)');
        ell(0, 0, r * .45, r * .3, 0, '#2a2a33'); ell(r * .38, -r * .05, r * .18, r * .18, 0, '#c0303a');
      } else if (t.k === 'worm') {
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const px = -r + i / 12 * r * 2.2, py = Math.sin(i * .9 + t.ph * 6) * r * .3; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.strokeStyle = '#e0405a'; ctx.lineWidth = r * .35; ctx.lineCap = 'round'; ctx.stroke();
        ell(r * 1.2, Math.sin(12 * .9 + t.ph * 6) * r * .3, r * .12, r * .12, 0, '#a82840');
      } else if (t.k === 'snail') {
        ell(r * .1, r * .35, r * 1, r * .22, 0, '#f0dcb0');
        ctx.beginPath(); ctx.moveTo(-r * .7, r * .25); ctx.lineTo(-r * 1.1, -r * .2); ctx.moveTo(-r * .6, r * .25); ctx.lineTo(-r * .85, -r * .3); ctx.strokeStyle = '#d8c090'; ctx.lineWidth = r * .1; ctx.stroke();
        ell(r * .2, -r * .15, r * .62, r * .58, 0, '#c77a3c');
        ctx.beginPath(); for (let i = 0; i < 30; i++) { const a = i * .45, rr = r * .5 * (1 - i / 32); ctx.lineTo(r * .2 + Math.cos(a) * rr, -r * .15 + Math.sin(a) * rr); }
        ctx.strokeStyle = '#8a4e20'; ctx.lineWidth = r * .09; ctx.stroke();
      } else if (t.k === 'golden' && o.season === 'christmas' && !o.wizard) {
        // a wrapped present
        const gl = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.5); gl.addColorStop(0, 'rgba(255,230,120,.55)'); gl.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d62a2a'; ctx.fillRect(-r * .6, -r * .5, r * 1.2, r * 1.1); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-r * .1, -r * .5, r * .2, r * 1.1); ctx.fillRect(-r * .6, -r * .05, r * 1.2, r * .18);
        ell(-r * .2, -r * .62, r * .2, r * .12, -.4, '#ffd23f'); ell(r * .2, -r * .62, r * .2, r * .12, .4, '#ffd23f');
      } else if (t.k === 'golden' && o.wizard) {
        // the Golden Snitch, wings a-blur
        const gl = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.5); gl.addColorStop(0, 'rgba(255,230,120,.6)'); gl.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, TAU); ctx.fill();
        const fl = Math.abs(Math.sin(t.ph * 40));
        [-1, 1].forEach(sd => ell(sd * r * .75, -r * .15, r * .6, r * .16 + fl * r * .12, sd * -.35, 'rgba(240,240,250,.85)'));
        ell(0, 0, r * .42, r * .42, 0, '#f5c542'); ell(-r * .12, -r * .14, r * .14, r * .1, 0, '#fff3b0');
      } else if (t.k === 'golden') {
        const gl = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.6); gl.addColorStop(0, 'rgba(255,230,120,.7)'); gl.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.fill();
        ell(0, 0, r * .62, r * .45, 0, '#f5c542'); ell(-r * .1, -r * .15, r * .25, r * .12, -.3, '#fff3b0');
        ctx.beginPath(); ctx.moveTo(0, -r * .45); ctx.lineTo(0, r * .45); ctx.strokeStyle = '#b8860b'; ctx.lineWidth = r * .07; ctx.stroke();
        ell(r * .62, 0, r * .2, r * .2, 0, '#8a6a10');
        for (let i = 0; i < 3; i++) { const a = t.ph * 2 + i * 2.1; ell(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1, r * .07, r * .07, 0, '#fff'); }
      }
      ctx.restore();
    }
    function hud() {
      ctx.font = '700 ' + Math.round(H * .045) + 'px Nunito, system-ui, sans-serif'; ctx.textBaseline = 'top';
      // hearts sit on the sand, out of the way of the swimming
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < s.hearts ? '#ff5c8a' : 'rgba(120,90,40,.3)'; ctx.fillText('♥', 14 + i * H * .045, (BED() + H) / 2 + H * .01); }
      ctx.textBaseline = 'top';
      s.pops.forEach(p => {
        ctx.globalAlpha = clamp(p.life, 0, 1); ctx.font = '800 ' + Math.round(H * (p.gold ? .05 : .04)) + 'px Fredoka, Nunito, sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.bad ? '#ff7a7a' : p.gold ? '#ffd23f' : '#fff'; ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1; ctx.textAlign = 'left';
      });
      if (s.t < 2.5 && !s.over && o.running) { ctx.globalAlpha = clamp(2.5 - s.t, 0, 1); ctx.font = '700 ' + Math.round(H * .04) + 'px Fredoka, Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('Tap to swim up!', W / 2, H * .3); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
    }
    function draw() {
      fit();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      backdrop(); bubbles();
      s.things.forEach(t => (t.food ? drawFood(t) : t.k === 'newt' ? drawNewt(t) : t.k === 'lobster' ? drawLobster(t) : drawSewage(t)));
      drawFrog(); drawBeam(); hud();
    }
    return {
      step(dt) { o.running = true; update(dt); draw(); },
      draw() { draw(); },
      tap, reset() { reset(); o.running = false; },
      _state: () => s
    };
  }
  window.Splashy = { create };
})();
