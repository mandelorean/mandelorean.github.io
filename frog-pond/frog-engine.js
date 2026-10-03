(function () {
  const E = p => (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const elastic = p => (p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * (2 * Math.PI) / 3) + 1);

  function mount(el, opts) {
    opts = opts || {};
    const T = window.THREE;
    if (T.ColorManagement) T.ColorManagement.legacyMode = false;
    const pal = Object.assign({ body: 0x67c24a, belly: 0xe4f6b4, cheek: 0xff9cb5, spot: 0x4c9e36, tad: 0x4fb08a, tadBelly: 0xcdf1dc, pad: 0x6dbb6a, padTop: 0x7fca78 }, opts.palette || {});
    const L = opts.lights || {};

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const cv = renderer.domElement;
    cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none;-webkit-tap-highlight-color:transparent';
    el.appendChild(cv);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, .1, 100);
    scene.add(new T.HemisphereLight(L.sky ?? 0xffffff, L.ground ?? 0x9fbf8a, L.hemi ?? .8));
    const key = new T.DirectionalLight(L.key ?? 0xffffff, L.keyI ?? 1.05);
    key.position.set(3, 6, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    key.shadow.bias = -.0006; scene.add(key);
    const rim = new T.DirectionalLight(L.rim ?? 0xfff0d0, L.rimI ?? .6); rim.position.set(-4, 3, -4); scene.add(rim);
    const fill = new T.DirectionalLight(0xffffff, L.fillI ?? .25); fill.position.set(-3, 1, 4); scene.add(fill);

    const sadGrey = new T.Color(0x9aa294);
    function mat(color, o) {
      const m = new T.MeshPhysicalMaterial(Object.assign({ color, roughness: .42, metalness: 0, clearcoat: .55, clearcoatRoughness: .3 }, o || {}));
      m.userData.base = m.color.clone();
      m.userData.sad = m.color.clone().lerp(sadGrey, .65);
      return m;
    }
    function sph(r, m, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) {
      const me = new T.Mesh(new T.SphereGeometry(r, 40, 28), m);
      me.scale.set(sx, sy, sz); me.position.set(x, y, z); me.castShadow = true; return me;
    }
    function ellipsoid(A, B, C, cx, cy, cz) {
      const surf = (dx, dy, dz, inset = 0) => {
        const d = new T.Vector3(dx, dy, dz).normalize();
        const t = 1 / Math.sqrt((d.x / A) ** 2 + (d.y / B) ** 2 + (d.z / C) ** 2);
        const p = d.multiplyScalar(t);
        const n = new T.Vector3(p.x / A / A, p.y / B / B, p.z / C / C).normalize();
        p.addScaledVector(n, -inset); p.x += cx; p.y += cy; p.z += cz;
        return { p, n };
      };
      const stick = (mesh, dx, dy, dz, inset) => {
        const { p, n } = surf(dx, dy, dz, inset);
        mesh.position.copy(p); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n); return mesh;
      };
      return { surf, stick };
    }
    const W = mat(0xffffff, { roughness: .12, clearcoat: 1 });
    const P = mat(0x15151b, { roughness: .1, clearcoat: 1 });
    const SH = new T.MeshBasicMaterial({ color: 0xffffff });
    const MUD = mat(0x8a6845, { roughness: .95, clearcoat: 0 });
    const CHEEK = mat(pal.cheek, { roughness: .7, clearcoat: 0 });
    const MOUTH = mat(0x3b1a26, { roughness: .5, side: T.DoubleSide });
    const HOLE = mat(0x6a2338, { roughness: .6 });
    const TONGUE = mat(0xff6f91, { roughness: .35 });

    function makeEye(parent, x, y, z, r, socketMat) {
      const eg = new T.Group(); eg.position.set(x, y, z); parent.add(eg);
      eg.add(sph(r * 1.33, socketMat));
      const inner = new T.Group(); inner.position.set(0, r * .22, r * .6); eg.add(inner);
      inner.add(sph(r, W, 1, 1, .85));
      const pup = new T.Group(); inner.add(pup);
      pup.add(sph(r * .52, P, 1, 1, .6, 0, 0, r * .8));
      pup.add(sph(r * .17, SH, 1, 1, 1, r * .2, r * .26, r * 1.1));
      return { inner, pup, r };
    }
    function makeMouth(parent, surf, dir, r, tongue) {
      const { p, n } = surf(dir[0], dir[1], dir[2], .005);
      const mg = new T.Group(); mg.position.copy(p); mg.lookAt(p.clone().add(n)); parent.add(mg);
      const arc = new T.Mesh(new T.TorusGeometry(r, r * .17, 12, 32, Math.PI), MOUTH);
      arc.rotation.z = Math.PI; arc.position.z = .01; mg.add(arc);
      const hole = sph(r * 1.05, HOLE, .9, .02, .5, 0, -r * .42, -.02); mg.add(hole);
      let tg = null, tm = null, tip = null;
      if (tongue) {
        tg = new T.Group(); tg.position.set(0, -r * .4, 0); mg.add(tg); tg.visible = false;
        const geo = new T.CylinderGeometry(.065, .065, 1, 12); geo.rotateX(Math.PI / 2); geo.translate(0, 0, .5);
        tm = new T.Mesh(geo, TONGUE); tg.add(tm);
        tip = sph(.1, TONGUE, 1, .7, 1); tg.add(tip);
      }
      return { mg, arc, hole, tg, tm, tip };
    }

    function buildFrog() {
      const g = new T.Group();
      const mb = mat(pal.body), mbe = mat(pal.belly), ms = mat(pal.spot);
      g.add(sph(1, mb, 1.15, .88, 1, 0, .9, 0));
      const { surf, stick } = ellipsoid(1.15, .88, 1, 0, .9, 0);
      g.add(stick(sph(.8, mbe, 1, .3, .72), 0, -.2, 1, .17));
      [[.55, .55, -.5, .17], [-.6, .5, -.45, .13], [.05, .78, -.6, .12], [-.75, .2, -.55, .1], [.85, .15, -.35, .09]].forEach(([x, y, z, r]) => g.add(stick(sph(r, ms, 1, .28, 1), x, y, z, .02)));
      [-1, 1].forEach(s => g.add(stick(sph(.15, CHEEK, 1, .28, .7), s * .64, .16, .78, .02)));
      const eyes = [-1, 1].map(s => makeEye(g, s * .48, 1.58, .3, .27, mb));
      const mouth = makeMouth(g, surf, [0, .3, 1], .24, true);
      [-1, 1].forEach(s => {
        const th = sph(.5, mb, .7, .58, 1.1, s * .95, .38, 0); th.rotation.y = s * .3; g.add(th);
        g.add(sph(.26, mb, 1.5, .4, 1.7, s * 1.12, .08, .5));
        g.add(sph(.2, mb, 1.4, .45, 1.5, s * .42, .08, .84));
      });
      const stub = sph(.3, mb, .7, .55, 1.5, 0, .55, -1.05); g.add(stub);
      const mud = [[.5, -.1, .85, .16], [-.55, .35, .7, .12], [.85, .3, .2, .14], [-.8, -.2, .4, .15], [.25, .7, .45, .1], [-.2, -.45, .85, .11], [.3, .5, -.8, .14]]
        .map(([x, y, z, r]) => { const m = stick(sph(r, MUD, 1, .25, 1), x, y, z, .01); m.visible = false; g.add(m); return m; });
      const anchor = new T.Group(); anchor.position.set(0, 1.74, -.08); g.add(anchor);
      return { kind: 'frog', g, mats: [mb, ms], eyes, mouth, mud, stub, anchor };
    }
    function buildTad() {
      const g = new T.Group();
      const mb = mat(pal.tad), mbe = mat(pal.tadBelly);
      g.add(sph(.72, mb, 1, .85, 1.05, 0, .95, 0));
      const { surf, stick } = ellipsoid(.72, .612, .756, 0, .95, 0);
      g.add(stick(sph(.5, mbe, 1, .3, .8), 0, -.35, 1, .12));
      [-1, 1].forEach(s => g.add(stick(sph(.09, CHEEK, 1, .3, .7), s * .44, -.02, .8, .02)));
      const eyes = [-1, 1].map(s => makeEye(g, s * .3, 1.22, .42, .19, mb));
      const mouth = makeMouth(g, surf, [0, -.02, 1], .12, false);
      const segs = []; let parent = new T.Group(); parent.position.set(0, .95, -.6); g.add(parent);
      for (let i = 0; i < 7; i++) {
        const sg = new T.Group(); sg.position.z = i === 0 ? 0 : -.2; parent.add(sg);
        const r = .34 * (1 - i / 9);
        const m = sph(r, i > 3 ? mbe : mb, .36, 1 - i * .05, 1.15); m.position.z = -.08; sg.add(m);
        segs.push(sg); parent = sg;
      }
      const mud = [[.5, .3, .6, .1], [-.55, .1, .6, .09], [.2, .8, -.2, .1], [-.4, .6, .2, .08]]
        .map(([x, y, z, r]) => { const m = stick(sph(r, MUD, 1, .25, 1), x, y, z, .01); m.visible = false; g.add(m); return m; });
      const anchor = new T.Group(); anchor.position.set(0, 1.5, -.05); anchor.scale.setScalar(.72); g.add(anchor);
      return { kind: 'tad', g, mats: [mb], eyes, mouth, mud, segs, anchor };
    }
    function buildEgg() {
      const g = new T.Group();
      const jm = mat(0xcff0dc, { transparent: true, opacity: .55, roughness: .05, clearcoat: 1 });
      const cm = mat(0x2d3b30, { roughness: .4 });
      const eggs = [[0, 0, .85], [-1.05, .35, .38], [.95, .5, .32]].map(([x, z, r]) => {
        const e = new T.Group(); e.position.set(x, r, z);
        const j = sph(r, jm); j.castShadow = false; e.add(j);
        e.add(sph(r * .38, cm, 1, 1, 1, 0, r * .05, 0)); g.add(e); return e;
      });
      return { kind: 'egg', g, mats: [], eyes: [], mouth: null, mud: [], eggs, anchor: new T.Group() };
    }
    function buildHat(kind) {
      const h = new T.Group();
      if (kind === 'crown') {
        const gold = mat(0xf5c542, { metalness: .55, roughness: .25, clearcoat: 1, side: T.DoubleSide });
        const band = new T.Mesh(new T.CylinderGeometry(.3, .34, .24, 28, 1, true), gold); band.position.y = .12; band.castShadow = true; h.add(band);
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          const c = new T.Mesh(new T.ConeGeometry(.075, .2, 12), gold); c.position.set(Math.sin(a) * .3, .34, Math.cos(a) * .3); h.add(c);
          h.add(sph(.04, gold, 1, 1, 1, Math.sin(a) * .3, .46, Math.cos(a) * .3));
        }
        h.add(sph(.065, mat(0xff4d7d, { roughness: .1, clearcoat: 1 }), 1, 1, .6, 0, .12, .34));
      } else if (kind === 'bow') {
        const pink = mat(0xff7eb6);
        const b = new T.Group(); b.position.set(.32, .02, .12); b.rotation.set(-.2, -.3, -.35); h.add(b);
        b.add(sph(.09, pink));
        [-1, 1].forEach(s => { const l = sph(.17, pink, 1.25, .8, .55, s * .2, 0, 0); l.rotation.z = s * .3; b.add(l); });
      } else if (kind === 'party') {
        const c = new T.Mesh(new T.ConeGeometry(.26, .62, 32), mat(0x6f8cff)); c.position.y = .31; c.castShadow = true;
        const p = new T.Group(); p.rotation.z = -.18; p.add(c);
        p.add(sph(.09, mat(0xffd23f), 1, 1, 1, 0, .65, 0));
        [[.12, .2, .16], [-.1, .32, .14], [.03, .45, .1]].forEach(([x, y, z]) => p.add(sph(.035, mat(0xffd23f), 1, 1, .5, x, y, z)));
        h.add(p);
      } else if (kind === 'flower') {
        const f = new T.Group(); f.position.set(-.34, .06, .14); f.rotation.set(-.25, .35, .2); h.add(f);
        f.add(sph(.085, mat(0xffd23f), 1, 1, .6));
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; f.add(sph(.1, mat(0xffc6dc), 1, 1, .32, Math.cos(a) * .15, Math.sin(a) * .15, -.02)); }
        f.add(sph(.08, mat(0x58b84a), 1.7, .5, .3, .2, -.17, -.03));
      }
      return h;
    }
    function buildFly() {
      const g = new T.Group();
      g.add(sph(.1, mat(0x23232b, { roughness: .3, clearcoat: 1 }), 1.3, 1, 1));
      const em = mat(0xd64545);
      [-1, 1].forEach(s => g.add(sph(.04, em, 1, 1, 1, .11, .04, s * .05)));
      const wm = new T.MeshPhysicalMaterial({ color: 0xe6f6ff, transparent: true, opacity: .65, roughness: .1 });
      g.userData.w = [-1, 1].map(s => { const wg = new T.Group(); wg.position.set(0, .07, s * .04); const w = sph(.11, wm, .6, .1, 1.3, 0, 0, s * .12); w.castShadow = false; wg.add(w); g.add(wg); return wg; });
      return g;
    }

    if (pal.pad !== null) {
      const pad = new T.Mesh(new T.CylinderGeometry(1.95, 2.05, .16, 72), mat(pal.pad, { roughness: .55, clearcoat: .3 }));
      pad.position.y = -.08; pad.receiveShadow = true; scene.add(pad);
      const top = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, .02, 72), mat(pal.padTop, { roughness: .6, clearcoat: .2 }));
      top.position.y = .006; top.receiveShadow = true; scene.add(top);
    }
    const shadow = new T.Mesh(new T.PlaneGeometry(14, 14), new T.ShadowMaterial({ opacity: opts.shadow ?? .2 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = pal.pad !== null ? -.17 : 0; shadow.receiveShadow = true; scene.add(shadow);

    const root = new T.Group(); scene.add(root);
    const holder = new T.Group(); root.add(holder);
    const creatures = { egg: buildEgg(), tad: buildTad(), frog: buildFrog() };
    for (const k in creatures) { const c = creatures[k]; c.wrap = new T.Group(); c.wrap.add(c.g); c.wrap.visible = false; holder.add(c.wrap); }
    const keyOf = s => (s === 'egg' ? 'egg' : s === 'tadpole' ? 'tad' : 'frog');
    const scaleOf = s => (s === 'froglet' ? .78 : 1);
    let stage = opts.stage || 'egg';
    creatures[keyOf(stage)].wrap.visible = true;
    creatures[keyOf(stage)].wrap.scale.setScalar(scaleOf(stage));

    const hatWrap = new T.Group(); let hatKind = 'none', hatObj = null;
    function attachHat() { const a = creatures[keyOf(stage)].anchor; a.add(hatWrap); hatWrap.visible = stage !== 'egg'; }
    attachHat();

    const tasks = [];
    function tween(dur, fn, done, delay = 0) { tasks.push({ t: -delay, dur, fn, done }); }
    const fx = {};
    const tgt = { mouth: .5, eye: 1, sad: 0, dirty: 0, look: 0 };
    const cur = { mouth: .5, eye: 1, sad: 0, dirty: 0, look: 0 };
    const look = { x: 0, y: 0 }, lookCur = { x: 0, y: 0 };
    let yaw = 0, pitch = 0, drag = null;
    let blinkT = 2, blinkP = -1;

    function resize() {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const tan = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      const half = opts.frame || 2.05;
      const d = Math.max(half / tan, half / (tan * camera.aspect));
      const e = T.MathUtils.degToRad(13), cy = opts.centerY ?? 1.0;
      camera.position.set(0, cy + Math.sin(e) * d, Math.cos(e) * d);
      camera.lookAt(0, cy, 0); camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    const ray = new T.Raycaster();
    function hitTest(x, y) {
      const r = cv.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
      const ndc = new T.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.intersectObject(creatures[keyOf(stage)].wrap, true).length) return true;
      const c = new T.Vector3(0, .9, 0).project(camera);
      return Math.hypot(ndc.x - c.x, (ndc.y - c.y) / camera.aspect) < .38;
    }
    function onDown(e) { drag = { x: e.clientX, y: e.clientY, yaw, pitch, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} cv.style.cursor = 'grabbing'; }
    function onMove(e) {
      const r = cv.getBoundingClientRect();
      look.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      look.y = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1) + .2));
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 7) drag.moved = true;
      yaw = drag.yaw + dx * .012; pitch = Math.max(-.25, Math.min(.35, drag.pitch + dy * .004));
    }
    function onUp(e) {
      if (!drag) return;
      const tap = !drag.moved; drag = null; cv.style.cursor = 'grab';
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      if (tap && hitTest(e.clientX, e.clientY) && opts.onTap) opts.onTap();
    }
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const clock = new T.Clock(); let t = 0, raf;
    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, clock.getDelta()); t += dt;
      Object.assign(fx, { y: 0, sx: 1, sy: 1, ry: 0, rz: 0, open: 0, squint: 0 });
      for (let i = 0; i < tasks.length; i++) {
        const k = tasks[i]; k.t += dt;
        if (k.t < 0) continue;
        const p = Math.min(1, k.t / k.dur); k.fn(p, dt);
        if (p >= 1) { tasks.splice(i--, 1); k.done && k.done(); }
      }
      const kk = 1 - Math.exp(-dt * 4);
      for (const q in tgt) cur[q] += (tgt[q] - cur[q]) * kk;
      lookCur.x += (look.x - lookCur.x) * (1 - Math.exp(-dt * 8));
      lookCur.y += (look.y - lookCur.y) * (1 - Math.exp(-dt * 8));
      blinkT -= dt;
      if (blinkT <= 0) { blinkP = 0; blinkT = 2.5 + Math.random() * 3.5; }
      let blink = 1;
      if (blinkP >= 0) { blinkP += dt / .17; blink = blinkP < 1 ? Math.abs(1 - 2 * blinkP) * .92 + .08 : 1; if (blinkP >= 1) blinkP = -1; }
      if (!drag) { yaw += (0 - yaw) * (1 - Math.exp(-dt * 1.6)); pitch += (0 - pitch) * (1 - Math.exp(-dt * 2)); }
      root.rotation.set(pitch, yaw, 0);
      const energy = 1 - cur.sad * .6;
      holder.position.y = fx.y; holder.scale.set(fx.sx, fx.sy, fx.sx); holder.rotation.set(0, fx.ry, fx.rz);

      for (const k in creatures) {
        const c = creatures[k]; if (!c.wrap.visible) continue;
        const b = Math.sin(t * 2.2 * energy);
        if (c.kind === 'frog') { c.g.scale.set(1 - b * .012, 1 + b * .022, 1 - b * .012); c.stub.visible = stage === 'froglet'; }
        if (c.kind === 'tad') {
          c.g.position.y = .28 + Math.sin(t * 1.6) * .08; c.g.rotation.z = Math.sin(t * 1.3) * .05;
          c.segs.forEach((sg, i) => { sg.rotation.y = Math.sin(t * 8 * energy - i * .8) * .28; });
        }
        if (c.kind === 'egg') c.eggs.forEach((e, i) => { e.rotation.z = Math.sin(t * 2 + i * 1.7) * .06; e.scale.setScalar(1 + Math.sin(t * 2.4 + i) * .015); });
        c.mats.forEach(m => m.color.copy(m.userData.base).lerp(m.userData.sad, cur.sad));
        c.eyes.forEach(e => {
          e.inner.scale.y = Math.max(.06, cur.eye * blink * (1 - fx.squint * .88));
          e.pup.position.set(lookCur.x * e.r * .28, lookCur.y * e.r * .22 - cur.look * e.r * .3, 0);
        });
        if (c.mouth) { c.mouth.arc.scale.y = cur.mouth * (1 + fx.open * .2); c.mouth.hole.scale.y = .02 + fx.open * .5; }
        c.mud.forEach(m => { m.visible = cur.dirty > .03; m.scale.set(cur.dirty, .25 * cur.dirty, cur.dirty); });
      }
      renderer.render(scene, camera);
    }
    frame();

    function mouthWorld(c) { const v = new T.Vector3(); c.mouth.mg.getWorldPosition(v); return v; }
    function chomp() { tween(.55, p => { fx.open = Math.abs(Math.sin(p * Math.PI * 3)) * .9; fx.sy = 1 - Math.abs(Math.sin(p * Math.PI * 3)) * .04; }); }
    function burst() {
      const cols = [0xffd23f, 0xff7eb6, 0x6f8cff, 0x7fe0a0, 0xff9a4d];
      for (let i = 0; i < 26; i++) {
        const m = sph(.06, mat(cols[i % cols.length], { clearcoat: 1, roughness: .2 }), 1, 1, .4);
        root.add(m);
        const a = Math.random() * Math.PI * 2, sp = 1.4 + Math.random() * 1.6, up = 2.5 + Math.random() * 2;
        const v = new T.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp * .6 + .4);
        m.position.set(0, 1.2, 0);
        tween(1.6, (p, dt) => { v.y -= 6 * dt; m.position.addScaledVector(v, dt); m.rotation.x += dt * 8; m.rotation.y += dt * 5; m.scale.setScalar(p > .8 ? (1 - p) / .2 : 1); }, () => root.remove(m), Math.random() * .1);
      }
    }

    const api = {
      setStage(s, anim = true) {
        if (s === stage) return;
        const prevStage = stage, pk = keyOf(prevStage), nk = keyOf(s);
        const prev = creatures[pk], next = creatures[nk];
        stage = s; const target = scaleOf(s);
        if (pk === nk) {
          const from = next.wrap.scale.x;
          tween(1, p => { next.wrap.scale.setScalar(from + (target - from) * elastic(p)); fx.ry = E(p) * Math.PI * 2; fx.y = Math.sin(p * Math.PI) * .5; });
        } else if (anim) {
          const ps = scaleOf(prevStage);
          tween(.3, p => prev.wrap.scale.setScalar(ps * (1 - E(p)) + .001), () => { prev.wrap.visible = false; });
          next.wrap.scale.setScalar(.001);
          tween(.9, p => { next.wrap.visible = true; next.wrap.scale.setScalar(Math.max(.001, target * elastic(p))); }, null, .25);
        } else {
          prev.wrap.visible = false; next.wrap.visible = true; next.wrap.scale.setScalar(target);
        }
        attachHat();
      },
      setMood(m) {
        tgt.mouth = m === 'happy' ? 1 : m === 'sad' ? -.55 : .5;
        tgt.eye = m === 'sad' ? .66 : 1;
        tgt.sad = m === 'sad' ? .6 : m === 'ok' ? .08 : 0;
        tgt.look = m === 'sad' ? 1 : 0;
      },
      setDirty(v) { tgt.dirty = Math.max(0, Math.min(1, v)); },
      setHat(kind) {
        if (kind === hatKind) return;
        hatKind = kind;
        if (hatObj) hatWrap.remove(hatObj);
        hatObj = buildHat(kind); hatWrap.add(hatObj);
        if (kind !== 'none') tween(.6, p => hatWrap.scale.setScalar(Math.max(.001, elastic(p))));
      },
      react(kind) {
        if (kind === 'tickle') tween(.75, p => {
          if (p < .15) { const q = p / .15; fx.sy = 1 - .18 * q; fx.sx = 1 + .1 * q; }
          else if (p < .85) { const q = Math.sin((p - .15) / .7 * Math.PI); fx.y = q * .8; fx.sy = 1 + .08 * q; fx.sx = 1 - .04 * q; }
          else { const q = Math.sin((p - .85) / .15 * Math.PI); fx.sy = 1 - .14 * q; fx.sx = 1 + .07 * q; }
          fx.open = .8; fx.squint = .9;
        });
        else if (kind === 'pet') tween(1.1, p => {
          const s = p < .85 ? Math.min(1, p * 4) : (1 - p) / .15;
          fx.squint = s; fx.open = .3 * s; fx.rz = Math.sin(p * Math.PI * 4) * .07 * (1 - p); fx.sy = 1 - Math.sin(p * Math.PI * 4) ** 2 * .035;
        });
        else if (kind === 'no') tween(.7, p => { fx.ry = Math.sin(p * Math.PI * 4) * .3 * (1 - p); });
        else if (kind === 'celebrate') tween(1.1, p => { fx.ry = E(p) * Math.PI * 2; fx.y = Math.sin(p * Math.PI) * .6; fx.open = .7; fx.squint = .8; });
      },
      feed() {
        const c = creatures[keyOf(stage)]; if (!c.mouth) return;
        const fly = buildFly(); scene.add(fly);
        const side = Math.random() < .5 ? -1 : 1;
        const start = new T.Vector3(side * 3, 2.8, 1.4);
        const hover = () => mouthWorld(c).add(new T.Vector3(side * .35, .35, 1.25));
        const flap = () => fly.userData.w.forEach((w, i) => { w.rotation.x = Math.sin(t * 70 + i * Math.PI) * .7; });
        const end = () => { scene.remove(fly); chomp(); };
        tween(.9, p => { flap(); fly.position.lerpVectors(start, hover(), E(p)); fly.position.y += Math.sin(p * 18) * .06; fly.rotation.y = side > 0 ? Math.PI : 0; }, () => {
          if (c.mouth.tg) {
            const tg = c.mouth.tg; tg.visible = true;
            const aim = (pos, len) => {
              tg.lookAt(pos);
              const lp = tg.parent.worldToLocal(pos.clone());
              const L = lp.distanceTo(tg.position) * len;
              c.mouth.tm.scale.z = Math.max(.001, L); c.mouth.tip.position.z = L;
            };
            tween(.16, p => { flap(); fx.open = .6; aim(fly.position, p); }, () => {
              const h0 = fly.position.clone();
              tween(.22, p => { fx.open = .6; const m = mouthWorld(c); fly.position.lerpVectors(h0, m, p); aim(fly.position, 1); }, () => { tg.visible = false; end(); });
            });
          } else {
            const h0 = fly.position.clone();
            tween(.35, p => { flap(); fx.open = .7; fly.position.lerpVectors(h0, mouthWorld(c), p); fly.scale.setScalar(1 - p * .8); }, end);
          }
        });
      },
      bath() {
        const bm = new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .38, roughness: 0, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.3 });
        tween(2.2, p => { fx.rz = Math.sin(p * Math.PI * 10) * .06 * (1 - p); fx.squint = .85; fx.open = .3; });
        for (let i = 0; i < 20; i++) {
          const r = .1 + Math.random() * .17;
          const b = new T.Mesh(new T.SphereGeometry(r, 24, 16), bm); root.add(b);
          const x0 = (Math.random() * 2 - 1) * 1.5, y0 = .1 + Math.random() * 1.2, z0 = -.4 + Math.random() * 1.8, ph = Math.random() * 6;
          b.position.set(x0, y0, z0); b.scale.setScalar(.001);
          tween(1.5 + Math.random(), p => {
            b.position.set(x0 + Math.sin(p * 6 + ph) * .12, y0 + p * 1.7, z0);
            b.scale.setScalar(Math.max(.001, p < .15 ? p / .15 : p > .9 ? (1 - p) / .1 : 1));
          }, () => root.remove(b), Math.random() * 1.1);
        }
      },
      celebrate() { api.react('celebrate'); burst(); },
      burst,
      hitTest,
      destroy() {
        cancelAnimationFrame(raf); ro.disconnect();
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        renderer.dispose(); try { renderer.forceContextLoss(); } catch (_) {}
        cv.remove();
      }
    };
    return api;
  }
  window.FrogEngine = { mount };
})();
