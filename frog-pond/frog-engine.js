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
    const hemi = new T.HemisphereLight(L.sky ?? 0xffffff, L.ground ?? 0x9fbf8a, L.hemi ?? .8); scene.add(hemi);
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
    function buildHat(kind, ck) {
      const h = new T.Group();
      if (kind === 'wizard') {
        const pm = mat(0x6b4bd6), gold = mat(0xffd23f, { metalness: .4, roughness: .3, clearcoat: 1 });
        const brim = new T.Mesh(new T.CylinderGeometry(.44, .44, .03, 40), pm); brim.position.y = .02; brim.castShadow = true;
        const cone = new T.Mesh(new T.ConeGeometry(.29, .8, 40), pm); cone.position.y = .42; cone.castShadow = true;
        const w = new T.Group(); w.rotation.set(-.12, 0, -.14); w.add(brim, cone); h.add(w);
        [[.13, .3, .22], [-.12, .5, .15], [.05, .66, .1], [-.18, .2, .2]].forEach(([x, y, z]) => { const st = new T.Mesh(new T.OctahedronGeometry(.045), gold); st.position.set(x, y, z); w.add(st); });
      } else if (kind === 'cap') {
        const red = mat(0xe84545);
        const dome = new T.Mesh(new T.SphereGeometry(.31, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), red); dome.scale.set(1, .8, 1); dome.castShadow = true; h.add(dome);
        const brim = new T.Mesh(new T.CylinderGeometry(.3, .3, .025, 32), red); brim.scale.set(.85, 1, .75); brim.position.set(0, .01, .3); brim.rotation.x = .12; h.add(brim);
        h.add(sph(.04, mat(0xffffff), 1, .6, 1, 0, .25, 0));
      } else if (kind === 'tiara') {
        const silver = mat(0xe3e9f2, { metalness: .7, roughness: .2, clearcoat: 1 });
        const arc = new T.Mesh(new T.TorusGeometry(.26, .022, 10, 40, Math.PI), silver); arc.position.set(0, .02, .08); arc.rotation.x = -.35; h.add(arc);
        [[0, .28, .05, 0x7fd4ff, .06], [-.17, .22, .05, 0xff7eb6, .04], [.17, .22, .05, 0xff7eb6, .04]].forEach(([x, y, z, c, r]) => h.add(sph(r, mat(c, { roughness: .05, clearcoat: 1 }), 1, 1, .7, x, y, z)));
      } else if (kind === 'sunnies') {
        // lens centres relative to the head anchor, per creature
        const L = ck === 'tad' ? { x: .42, y: -.33, z: 1.05, r: .25 } : { x: .48, y: -.1, z: .8, r: .26 };
        const lensM = mat(0x1b1b26, { roughness: .05, clearcoat: 1 }), frameM = mat(0xff4d7d);
        [-1, 1].forEach(s => {
          const lens = new T.Mesh(new T.CylinderGeometry(L.r, L.r, .04, 32), lensM); lens.rotation.x = Math.PI / 2; lens.position.set(s * L.x, L.y, L.z); h.add(lens);
          const rim = new T.Mesh(new T.TorusGeometry(L.r, .03, 8, 32), frameM); rim.position.set(s * L.x, L.y, L.z + .01); h.add(rim);
        });
        const bridge = new T.Mesh(new T.CylinderGeometry(.025, .025, L.x * 2 - L.r * 2 + .06, 8), frameM); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, L.y + .05, L.z + .02); h.add(bridge);
      } else if (kind === 'crown') {
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
    const tgt = { mouth: .5, eye: 1, sad: 0, dirty: 0, look: 0, night: 0 };
    const cur = { mouth: .5, eye: 1, sad: 0, dirty: 0, look: 0, night: 0 };
    let mood = 'ok', sleeping = false, dayMul = 1;
    const lightBase = { hemi: hemi.intensity, key: key.intensity, rim: rim.intensity, fill: fill.intensity };
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
    function messHit(x, y) {
      const r = cv.getBoundingClientRect();
      const ndc = new T.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      for (let i = 0; i < messSlots.length; i++) {
        const m = messSlots[i]; if (!m.visible || m.userData.hp <= 0) continue;
        if (ray.intersectObject(m, true).length) return i;
        const c = m.position.clone().setY(.25).project(camera);
        if (Math.hypot(ndc.x - c.x, (ndc.y - c.y) / camera.aspect) < .14) return i;
      }
      return -1;
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
      if (!tap) return;
      const mi = messHit(e.clientX, e.clientY);
      if (mi >= 0) { opts.onMess && opts.onMess(mi); return; }
      if (hitTest(e.clientX, e.clientY) && opts.onTap) opts.onTap();
    }
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const clock = new T.Clock(); let t = 0, raf;
    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, clock.getDelta()); t += dt;
      Object.assign(fx, { x: 0, y: 0, sx: 1, sy: 1, ry: 0, rz: 0, open: 0, squint: 0 });
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
      if (blinkT <= 0 && !sleeping) { blinkP = 0; blinkT = 2.5 + Math.random() * 3.5; }
      let blink = 1;
      if (blinkP >= 0) { blinkP += dt / .17; blink = blinkP < 1 ? Math.abs(1 - 2 * blinkP) * .92 + .08 : 1; if (blinkP >= 1) blinkP = -1; }
      if (!drag) { yaw += (0 - yaw) * (1 - Math.exp(-dt * 1.6)); pitch += (0 - pitch) * (1 - Math.exp(-dt * 2)); }
      root.rotation.set(pitch, yaw, 0);
      const energy = sleeping ? .4 : 1 - cur.sad * .6;
      const dim = (1 - cur.night * .55) * dayMul;
      hemi.intensity = lightBase.hemi * dim; key.intensity = lightBase.key * dim; rim.intensity = lightBase.rim * (1 - cur.night * .3); fill.intensity = lightBase.fill * dim;
      holder.position.set(fx.x, fx.y, 0); holder.scale.set(fx.sx, fx.sy, fx.sx); holder.rotation.set(0, fx.ry, fx.rz);

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

    // Little accidents on the lily pad, with a fly buzzing round them
    const POO = mat(0x8a5a33, { roughness: .35, clearcoat: .8 });
    function buildPoo() {
      const g = new T.Group();
      g.add(sph(.24, POO, 1, .55, 1, 0, .12, 0));
      g.add(sph(.18, POO, 1, .6, 1, .01, .27, 0));
      g.add(sph(.12, POO, 1, .7, 1, -.01, .4, 0));
      const tip = new T.Mesh(new T.ConeGeometry(.06, .14, 16), POO); tip.position.set(.02, .52, 0); tip.rotation.z = -.4; tip.castShadow = true; g.add(tip);
      [-1, 1].forEach(s => { g.add(sph(.055, W, 1, 1, .7, s * .075, .28, .16)); g.add(sph(.028, P, 1, 1, .6, s * .075, .28, .2)); });
      return g;
    }
    const messSlots = [[1.2, .02, .6], [-1.25, .02, .45], [.95, .02, -.85]].map(([x, y, z]) => {
      const m = buildPoo(); m.position.set(x, y, z); m.rotation.y = -x * .35; m.visible = false; m.scale.setScalar(.001); m.userData.hp = 0; scene.add(m); return m;
    });
    const messFly = buildFly(); messFly.visible = false; scene.add(messFly);

    // Pond decorations and friends you can buy in the shop
    const PAD_Y = .016;
    function lilyFlower(x, z, s) {
      const g = new T.Group(); g.position.set(x, PAD_Y, z); g.scale.setScalar(s);
      const pm = mat(0xffa6cf);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, p = sph(.09, pm, 1, .35, 2); p.position.set(Math.cos(a) * .11, .06, Math.sin(a) * .11); p.rotation.y = -a + Math.PI / 2; p.rotation.x = .5; g.add(p); }
      g.add(sph(.06, mat(0xffd23f), 1, .7, 1, 0, .08, 0));
      return g;
    }
    function buildExtra(k) {
      const g = new T.Group();
      if (k === 'flowers') [[60, .9], [120, .8], [200, 1], [250, .85], [300, .95]].forEach(([d, s]) => { const a = d * Math.PI / 180; g.add(lilyFlower(Math.cos(a) * 1.75, Math.sin(a) * 1.75, s)); });
      if (k === 'mushroom') {
        g.position.set(-1.5, PAD_Y, -.4);
        const stem = new T.Mesh(new T.CylinderGeometry(.07, .09, .3, 16), mat(0xf4eedd)); stem.position.y = .15; stem.castShadow = true; g.add(stem);
        const cap = new T.Mesh(new T.SphereGeometry(.24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe8443a)); cap.position.y = .27; cap.scale.y = .75; cap.castShadow = true; g.add(cap);
        [[.1, .4, .08], [-.09, .38, .12], [0, .44, -.08], [.14, .33, -.08], [-.15, .33, -.04]].forEach(([x, y, z]) => g.add(sph(.035, mat(0xffffff), 1, .5, 1, x, y, z)));
      }
      if (k === 'reeds') {
        [[1.25, -1.15, 1.6], [1.45, -.95, 1.3], [1.05, -1.35, 1.75], [-1.15, -1.2, 1.55], [-1.35, -1.0, 1.25]].forEach(([x, z, hgt]) => {
          const st = new T.Mesh(new T.CylinderGeometry(.018, .022, hgt, 8), mat(0x5aa04a)); st.position.set(x, hgt / 2, z); st.rotation.z = (x > 0 ? -1 : 1) * .06; st.castShadow = true; g.add(st);
          const top = new T.Mesh(new T.CapsuleGeometry(.05, .2, 4, 12), mat(0x7a4a2a)); top.position.set(x - st.rotation.z * hgt / 2, hgt * .88, z); top.rotation.z = st.rotation.z; g.add(top);
        });
      }
      if (k === 'lantern') {
        g.position.set(1.6, PAD_Y, -.2);
        const post = new T.Mesh(new T.CylinderGeometry(.03, .04, .62, 10), mat(0x2b2b33)); post.position.y = .31; g.add(post);
        const glassM = new T.MeshPhysicalMaterial({ color: 0xffe28a, emissive: 0xffc34d, emissiveIntensity: 1.2, roughness: .2 });
        const glass = new T.Mesh(new T.BoxGeometry(.16, .2, .16), glassM); glass.position.y = .72; g.add(glass);
        const roof = new T.Mesh(new T.ConeGeometry(.14, .12, 4), mat(0x2b2b33)); roof.position.y = .88; roof.rotation.y = Math.PI / 4; g.add(roof);
        const pl = new T.PointLight(0xffc870, .6, 3.2); pl.position.y = .72; g.add(pl);
        g.userData.light = pl; g.userData.glass = glassM;
      }
      if (k === 'ladybird') {
        const red = mat(0xe8302a, { roughness: .2, clearcoat: 1 }), blk = mat(0x15151b);
        g.add(sph(.1, red, 1, .6, 1.2, 0, .05, 0));
        g.add(sph(.05, blk, 1, .8, 1, 0, .04, .12));
        [[.04, .09, .03], [-.04, .09, .03], [.05, .08, -.06], [-.05, .08, -.06], [0, .1, -.1]].forEach(([x, y, z]) => g.add(sph(.022, blk, 1, .5, 1, x, y, z)));
      }
      if (k === 'snail') {
        const body = mat(0xc9b28f), shell = mat(0xc77a3c, { clearcoat: .8 });
        g.add(sph(.08, body, 2.6, .55, 1, 0, .04, 0));
        const sh = new T.Mesh(new T.TorusGeometry(.09, .06, 12, 24), shell); sh.position.set(-.05, .16, 0); sh.castShadow = true; g.add(sh);
        g.add(sph(.05, shell, 1, 1, .9, -.05, .16, 0));
        [-1, 1].forEach(s => { const st = new T.Mesh(new T.CylinderGeometry(.008, .01, .12, 6), body); st.position.set(.2, .1, s * .03); st.rotation.z = -.4; g.add(st); g.add(sph(.018, P, 1, 1, 1, .23, .16, s * .03)); });
      }
      if (k === 'dragonfly') {
        const bm = mat(0x2fb7c9, { metalness: .3, roughness: .2, clearcoat: 1 });
        g.add(sph(.05, bm, 1, 1, 1, .2, 0, 0));
        g.add(sph(.035, bm, 6, 1, 1, -.05, 0, 0));
        [-1, 1].forEach(s => g.add(sph(.025, P, 1, 1, 1, .23, .02, s * .03)));
        const wm = new T.MeshPhysicalMaterial({ color: 0xe6f6ff, transparent: true, opacity: .55, roughness: .1, side: T.DoubleSide });
        g.userData.w = [[.1, 1], [.1, -1], [0, 1], [0, -1]].map(([x, s]) => { const wg = new T.Group(); wg.position.set(x, .02, 0); const w = sph(.07, wm, 1, .08, 3.2, 0, 0, s * .22); w.castShadow = false; wg.add(w); g.add(wg); wg.userData.s = s; return wg; });
      }
      g.visible = false; scene.add(g); return g;
    }
    const extras = {};
    ['flowers', 'mushroom', 'reeds', 'lantern', 'ladybird', 'snail', 'dragonfly'].forEach(k => { extras[k] = buildExtra(k); });

    let messRaf;
    (function messLoop() {
      messRaf = requestAnimationFrame(messLoop);
      const lb = extras.ladybird, sn = extras.snail, df = extras.dragonfly, ln = extras.lantern;
      if (lb.visible) { const a = t * .22 + Math.sin(t * .9) * .1; lb.position.set(Math.cos(a) * 1.5, PAD_Y, Math.sin(a) * 1.5); lb.rotation.y = -a; }
      if (sn.visible) { const a = 2.2 - t * .05; sn.position.set(Math.cos(a) * 1.82, PAD_Y, Math.sin(a) * 1.82); sn.rotation.y = -a + Math.PI; sn.scale.set(1 + Math.sin(t * 2) * .05, 1, 1); }
      if (df.visible) {
        const p = new T.Vector3(Math.sin(t * .45) * 1.9, 2.05 + Math.sin(t * 1.3) * .25, Math.sin(t * .9) * .9 - .2);
        const v = new T.Vector3(Math.cos(t * .45) * .45 * 1.9, 0, Math.cos(t * .9) * .9 * .9);
        df.position.copy(p); df.rotation.y = Math.atan2(-v.z, v.x);
        df.userData.w.forEach((w, i) => { w.rotation.x = w.userData.s * Math.sin(t * 60 + i) * .5; });
      }
      if (ln.visible) { const n = .6 + cur.night * .9 + Math.sin(t * 9) * .04; ln.userData.light.intensity = n; ln.userData.glass.emissiveIntensity = .9 + cur.night * .8; }
      const live = messSlots.find(m => m.visible && m.userData.hp > 0);
      messFly.visible = !!live;
      if (live) {
        const a = t * 3.2;
        messFly.position.set(live.position.x + Math.cos(a) * .38, .62 + Math.sin(t * 7) * .06, live.position.z + Math.sin(a) * .38);
        messFly.rotation.y = -a;
        messFly.userData.w.forEach((w, i) => { w.rotation.x = Math.sin(t * 70 + i * Math.PI) * .7; });
      }
    })();

    function mouthWorld(c) { const v = new T.Vector3(); c.mouth.mg.getWorldPosition(v); return v; }
    function chomp() { tween(.55, p => { fx.open = Math.abs(Math.sin(p * Math.PI * 3)) * .9; fx.sy = 1 - Math.abs(Math.sin(p * Math.PI * 3)) * .04; }); }
    function burst(at, n = 26, size = 1) {
      const cols = [0xffd23f, 0xff7eb6, 0x6f8cff, 0x7fe0a0, 0xff9a4d];
      for (let i = 0; i < n; i++) {
        const m = sph(.06 * size, mat(cols[i % cols.length], { clearcoat: 1, roughness: .2 }), 1, 1, .4);
        scene.add(m);
        const a = Math.random() * Math.PI * 2, sp = 1.4 + Math.random() * 1.6, up = 2.5 + Math.random() * 2;
        const v = new T.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp * .6 + .4);
        m.position.copy(at || new T.Vector3(0, 1.2, 0));
        tween(1.6, (p, dt) => { v.y -= 6 * dt; m.position.addScaledVector(v, dt); m.rotation.x += dt * 8; m.rotation.y += dt * 5; m.scale.setScalar(p > .8 ? (1 - p) / .2 : 1); }, () => scene.remove(m), Math.random() * .1);
      }
    }

    function rebuildHat() { if (hatObj) hatWrap.remove(hatObj); hatObj = buildHat(hatKind, keyOf(stage)); hatWrap.add(hatObj); }
    function applyMood() {
      if (sleeping) { tgt.mouth = .25; tgt.eye = .06; tgt.sad = 0; tgt.look = .4; return; }
      tgt.mouth = mood === 'happy' ? 1 : mood === 'sad' ? -.55 : .5;
      tgt.eye = mood === 'sad' ? .66 : 1;
      tgt.sad = mood === 'sad' ? .6 : mood === 'ok' ? .08 : 0;
      tgt.look = mood === 'sad' ? 1 : 0;
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
        attachHat(); if (pk !== nk && hatKind === 'sunnies') rebuildHat();
      },
      setMood(m) { mood = m; applyMood(); },
      setSleep(on) {
        if (on === sleeping) return;
        sleeping = on; tgt.night = on ? 1 : 0; applyMood();
      },
      setMess(arr) {
        messSlots.forEach((m, i) => {
          const hp = (arr && arr[i]) || 0, was = m.userData.hp; m.userData.hp = hp;
          const target = hp > 0 ? .55 + .45 * hp / 3 : 0;
          if (hp === was) { if (hp > 0 && m.scale.x < .01) { m.visible = true; m.scale.setScalar(target); } return; }
          const from = m.scale.x; m.visible = true;
          tween(hp > was ? .7 : .35, p => m.scale.setScalar(Math.max(.001, from + (target - from) * (hp > was ? elastic(p) : E(p)))), () => { if (hp <= 0) m.visible = false; });
          if (hp < was) burst(m.position.clone().setY(.4), hp > 0 ? 8 : 22, .7);
        });
      },
      fart() {
        const bm = new T.MeshPhysicalMaterial({ color: 0xb6f08c, transparent: true, opacity: .6, roughness: 0, clearcoat: 1 });
        tween(.6, p => { const q = Math.sin(p * Math.PI); fx.sy = 1 - q * .06; fx.sx = 1 + q * .03; fx.squint = q * .9; fx.rz = Math.sin(p * Math.PI * 6) * .04 * (1 - p); });
        for (let i = 0; i < 10; i++) {
          const r = .09 + Math.random() * .14, side = i % 2 ? 1 : -1;
          const b = new T.Mesh(new T.SphereGeometry(r, 20, 14), bm); root.add(b);
          const x0 = side * (.75 + Math.random() * .4), z0 = -.55 - Math.random() * .3, ph = Math.random() * 6;
          b.position.set(x0, .3, z0); b.scale.setScalar(.001);
          tween(1.6 + Math.random() * .8, p => {
            b.position.set(x0 + side * p * .6 + Math.sin(p * 7 + ph) * .1, .3 + p * 2.3, z0 + p * .3);
            b.scale.setScalar(Math.max(.001, p < .12 ? p / .12 : p > .88 ? (1 - p) / .12 : 1));
          }, () => root.remove(b), i * .05);
        }
      },
      yawn() { tween(1.6, p => { const q = Math.sin(p * Math.PI); fx.open = q * .95; fx.squint = q * .85; fx.sy = 1 + q * .05; }); },
      hopAway(away = 1.3) {
        const D = 4.4, hop = p => Math.abs(Math.sin(p * Math.PI * 3)) * .45;
        tween(1, p => { fx.x = E(p) * D; fx.y = hop(p); fx.ry = Math.PI / 2 * Math.min(1, p * 4); }, () => {
          tween(away, () => { fx.x = D; }, () => {
            tween(1, p => { fx.x = D * (1 - E(p)); fx.y = hop(p); fx.ry = -Math.PI / 2 * Math.min(1, (1 - p) * 4); });
          });
        });
      },
      setDirty(v) { tgt.dirty = Math.max(0, Math.min(1, v)); },
      setHat(kind) {
        if (kind === hatKind) return;
        hatKind = kind; rebuildHat();
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
      burstAt(x, y, z, n) { burst(new T.Vector3(x, y, z), n); },
      setExtras(on) { for (const k in extras) { const v = !!(on && on[k]); if (extras[k].visible !== v) { extras[k].visible = v; if (v) { const g = extras[k], s = g.scale.x || 1; tween(.6, p => g.scale.setScalar(Math.max(.001, s * elastic(p)))); } } } },
      setDaylight(m) { dayMul = m; },
      snapshot() { renderer.render(scene, camera); return cv.toDataURL('image/png'); },
      burst,
      hitTest,
      destroy() {
        cancelAnimationFrame(raf); cancelAnimationFrame(messRaf); ro.disconnect();
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        renderer.dispose(); try { renderer.forceContextLoss(); } catch (_) {}
        cv.remove();
      }
    };
    return api;
  }
  window.FrogEngine = { mount };
})();
