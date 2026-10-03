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
      return { kind: 'frog', g, mats: [mb, ms], paint: { body: mb, belly: mbe, spot: ms }, eyes, mouth, mud, stub, anchor };
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
      return { kind: 'tad', g, mats: [mb], paint: { body: mb, belly: mbe }, eyes, mouth, mud, segs, anchor };
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
      if (kind === 'bobble') {
        const red = mat(0xe23b3b, { roughness: .85, clearcoat: 0 }), wht = mat(0xfff4f0, { roughness: .9, clearcoat: 0 });
        const dome = new T.Mesh(new T.SphereGeometry(.33, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), red); dome.scale.y = 1.05; dome.castShadow = true; h.add(dome);
        const rim = new T.Mesh(new T.TorusGeometry(.31, .08, 12, 32), wht); rim.rotation.x = Math.PI / 2; rim.position.y = .03; h.add(rim);
        h.add(sph(.11, wht, 1, 1, 1, 0, .38, 0));
      } else if (kind === 'mortar') {
        const blk = mat(0x1f2a22, { roughness: .5 });
        const base = new T.Mesh(new T.CylinderGeometry(.26, .28, .16, 24), blk); base.position.y = .08; h.add(base);
        const board = new T.Mesh(new T.BoxGeometry(.66, .04, .66), blk); board.position.y = .18; board.rotation.y = Math.PI / 4; board.castShadow = true; h.add(board);
        const cord = new T.Mesh(new T.CylinderGeometry(.012, .012, .26, 6), mat(0xffd23f)); cord.position.set(.3, .08, .05); h.add(cord);
        h.add(sph(.045, mat(0xffd23f), 1, 1.4, 1, .3, -.06, .05), sph(.03, mat(0xffd23f), 1, 1, 1, 0, .21, 0));
      } else if (kind === 'bee') {
        const blk = mat(0x1f2a22);
        const band = new T.Mesh(new T.TorusGeometry(.28, .03, 8, 32, Math.PI), blk); band.position.set(0, .02, 0); band.rotation.y = Math.PI / 2; h.add(band);
        [-1, 1].forEach(s => { const st = new T.Mesh(new T.CylinderGeometry(.015, .015, .4, 6), blk); st.position.set(s * .14, .2, .02); st.rotation.z = -s * .35; h.add(st); h.add(sph(.06, mat(0xffcc33), 1, 1, 1, s * .22, .4, .02)); });
        const wm = new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .55, side: T.DoubleSide });
        [-1, 1].forEach(s => { const w = sph(.2, wm, .5, .08, 1, s * .2, -.15, -.4); w.rotation.z = s * .5; h.add(w); });
      } else if (kind === 'wizard') {
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

    let pad = null, padTop = null, sceneHook = null;
    if (pal.pad !== null) {
      // a lily pad has a notch cut out of it; put it at the back where it won't hide the frog
      const notch = opts.padNotch ? .42 : 0, start = 3.55 + notch / 2, len = Math.PI * 2 - notch;
      pad = new T.Mesh(new T.CylinderGeometry(1.95, 2.05, .16, 72, 1, false, start, len), mat(pal.pad, { roughness: .55, clearcoat: .3, side: T.DoubleSide }));
      pad.position.y = -.08; pad.receiveShadow = true; scene.add(pad);
      padTop = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, .02, 72, 1, false, start, len), mat(pal.padTop, { roughness: .6, clearcoat: .2 }));
      padTop.position.y = .006; padTop.receiveShadow = true; scene.add(padTop);
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
    let mood = 'ok', sleeping = false, dayMul = 1, rainbow = false, colourKey = '';
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
      const toy = toyHit(e.clientX, e.clientY);
      if (toy) { opts.onToy && opts.onToy(toy); return; }
      if (hitTest(e.clientX, e.clientY) && opts.onTap) opts.onTap();
    }
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const clock = new T.Clock(); let t = 0, raf;
    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, clock.getDelta()); t += dt;
      Object.assign(fx, { x: 0, z: 0, y: 0, sx: 1, sy: 1, ry: 0, rz: 0, open: 0, squint: 0 });
      for (let i = 0; i < tasks.length; i++) {
        const k = tasks[i]; k.t += dt;
        if (k.t < 0) continue;
        const p = Math.min(1, k.t / k.dur); k.fn(p, dt);
        if (p >= 1) { tasks.splice(i--, 1); k.done && k.done(); }
      }
      if (sceneHook) sceneHook(dt);
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
      holder.position.set(fx.x, fx.y, fx.z); holder.scale.set(fx.sx, fx.sy, fx.sx); holder.rotation.set(0, fx.ry, fx.rz);

      for (const k in creatures) {
        const c = creatures[k]; if (!c.wrap.visible) continue;
        const b = Math.sin(t * 2.2 * energy);
        if (c.kind === 'frog') { c.g.scale.set(1 - b * .012, 1 + b * .022, 1 - b * .012); c.stub.visible = stage === 'froglet'; }
        if (c.kind === 'tad') {
          c.g.position.y = .28 + Math.sin(t * 1.6) * .08; c.g.rotation.z = Math.sin(t * 1.3) * .05;
          c.segs.forEach((sg, i) => { sg.rotation.y = Math.sin(t * 8 * energy - i * .8) * .28; });
        }
        if (c.kind === 'egg') c.eggs.forEach((e, i) => { e.rotation.z = Math.sin(t * 2 + i * 1.7) * .06; e.scale.setScalar(1 + Math.sin(t * 2.4 + i) * .015); });
        if (rainbow && c.paint) {
          const hue = (t * .05) % 1;
          c.paint.body.userData.base.setHSL(hue, .62, .5); c.paint.body.userData.sad.copy(c.paint.body.userData.base).lerp(sadGrey, .65);
          if (c.paint.spot) { c.paint.spot.userData.base.setHSL((hue + .12) % 1, .7, .42); c.paint.spot.userData.sad.copy(c.paint.spot.userData.base).lerp(sadGrey, .65); }
        }
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

    // ---------- More shop things: clothes, treats, toys, pond upgrades, friends, big goals ----------
    const FRONT = (y) => Math.sqrt(Math.max(0, 1 - ((y - .9) / .88) ** 2)); // body depth at height y
    const outfit = { neck: new T.Group(), face: new T.Group(), feet: new T.Group(), brolly: new T.Group() };
    creatures.frog.g.add(outfit.neck, outfit.feet, outfit.brolly); creatures.frog.anchor.add(outfit.face);
    let outfitKey = '';
    function buildNeck(k) {
      const g = new T.Group();
      if (k === 'scarf') {
        const red = mat(0xe23b3b, { roughness: .8, clearcoat: 0 }), wht = mat(0xfff4f0, { roughness: .8, clearcoat: 0 });
        const ring = new T.Mesh(new T.TorusGeometry(1, .13, 14, 48), red); ring.rotation.x = Math.PI / 2; ring.scale.set(1.17, 1.03, 1); ring.position.y = .86; ring.castShadow = true; g.add(ring);
        [-.3, 0, .3].forEach((dy, i) => { const tail = new T.Mesh(new T.BoxGeometry(.22, .16, .07), i % 2 ? wht : red); tail.position.set(.5, .62 + dy * .55, FRONT(.62) * 1.02 + .05); tail.rotation.z = -.15; g.add(tail); });
      } else if (k === 'bowtie') {
        const blue = mat(0x6f8cff), y = .84, z = FRONT(y) + .02;
        g.add(sph(.075, blue, 1, 1, .8, 0, y, z));
        [-1, 1].forEach(s => { const c = new T.Mesh(new T.ConeGeometry(.13, .26, 18), blue); c.rotation.z = s * Math.PI / 2; c.position.set(s * .15, y, z - .02); g.add(c); });
      } else if (k === 'cape') {
        const red = mat(0xe84545, { side: T.DoubleSide, roughness: .6 });
        const cape = new T.Mesh(new T.CylinderGeometry(1.08, 1.32, 1.05, 40, 1, true, Math.PI / 2 + .2, Math.PI - .4), red); cape.position.y = .78; cape.castShadow = true; g.add(cape);
        [-1, 1].forEach(s => g.add(sph(.08, mat(0xffd23f, { metalness: .5 }), 1, 1, 1, s * .98, 1.22, .32)));
      }
      return g;
    }
    function buildFace(k) {
      const g = new T.Group(); if (k !== 'glasses') return g;
      const L = { x: .48, y: -.1, z: .8, r: .27 }, frame = mat(0x1f2a22, { roughness: .3 }), glass = new T.MeshPhysicalMaterial({ color: 0xdff4ff, transparent: true, opacity: .25, roughness: 0, clearcoat: 1 });
      [-1, 1].forEach(s => {
        const lens = new T.Mesh(new T.CylinderGeometry(L.r, L.r, .02, 32), glass); lens.rotation.x = Math.PI / 2; lens.position.set(s * L.x, L.y, L.z); g.add(lens);
        const rim = new T.Mesh(new T.TorusGeometry(L.r, .035, 10, 36), frame); rim.position.set(s * L.x, L.y, L.z + .01); g.add(rim);
      });
      const bridge = new T.Mesh(new T.CylinderGeometry(.03, .03, L.x * 2 - L.r * 2 + .08, 8), frame); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, L.y + .06, L.z + .02); g.add(bridge);
      return g;
    }
    function buildFeet(k) {
      const g = new T.Group(); if (k !== 'wellies') return g;
      const boot = mat(0xffcc33, { roughness: .3, clearcoat: .8 }), sole = mat(0x3b3b44);
      [[-.42, .84, .19], [.42, .84, .19], [-1.12, .5, .25], [1.12, .5, .25]].forEach(([x, z, r]) => {
        const b = new T.Mesh(new T.CylinderGeometry(r, r * 1.08, .3, 20), boot); b.position.set(x, .17, z); b.castShadow = true; g.add(b);
        const s = new T.Mesh(new T.CylinderGeometry(r * 1.12, r * 1.12, .05, 20), sole); s.position.set(x, .03, z); g.add(s);
      });
      return g;
    }
    function buildBrolly(on) {
      const g = new T.Group(); if (!on) return g;
      const pink = mat(0xff5c8a, { side: T.DoubleSide, roughness: .4 }), dark = mat(0x2b2b33);
      const can = new T.Mesh(new T.SphereGeometry(1.15, 32, 12, 0, Math.PI * 2, 0, Math.PI / 3), pink); can.scale.y = .7; can.position.y = 0; can.castShadow = true;
      const w = new T.Group(); w.position.set(.75, 2.45, .05); w.rotation.z = .22; w.add(can);
      const stick = new T.Mesh(new T.CylinderGeometry(.03, .03, 1.5, 8), dark); stick.position.y = -.2; w.add(stick);
      const hook = new T.Mesh(new T.TorusGeometry(.1, .03, 8, 16, Math.PI), dark); hook.position.set(-.1, -.95, 0); hook.rotation.z = Math.PI; w.add(hook);
      w.add(sph(.05, dark, 1, 1, 1, 0, .78, 0));
      g.add(w); return g;
    }

    // treats he eats: a little model appears at his mouth and gets chomped
    function buildTreat(k) {
      const g = new T.Group();
      if (k === 'burger') {
        g.add(sph(.2, mat(0xd9984a), 1, .5, 1, 0, .1, 0));
        const patty = new T.Mesh(new T.CylinderGeometry(.21, .21, .07, 20), mat(0x6b3b22)); patty.position.y = .02; g.add(patty);
        const leaf = new T.Mesh(new T.CylinderGeometry(.23, .23, .02, 20), mat(0x6fcf4a)); leaf.position.y = .065; g.add(leaf);
        g.add(sph(.2, mat(0xd9984a), 1, .35, 1, 0, -.05, 0));
      } else if (k === 'lolly') {
        const ice = new T.Mesh(new T.CapsuleGeometry(.11, .22, 6, 16), mat(0xff8fc0)); ice.position.y = .1; g.add(ice);
        const tip = new T.Mesh(new T.CapsuleGeometry(.112, .06, 6, 16), mat(0xffd23f)); tip.position.y = .26; g.add(tip);
        const stick = new T.Mesh(new T.BoxGeometry(.05, .2, .02), mat(0xe8c48a)); stick.position.y = -.12; g.add(stick);
      } else if (k === 'cocoa') {
        const mug = new T.Mesh(new T.CylinderGeometry(.15, .13, .26, 24), mat(0xffffff)); g.add(mug);
        const top = new T.Mesh(new T.CylinderGeometry(.135, .135, .02, 24), mat(0x7a4a2a)); top.position.y = .12; g.add(top);
        g.add(sph(.05, mat(0xfff6f0), 1, .6, 1, .03, .14, .02), sph(.045, mat(0xffd6e6), 1, .6, 1, -.04, .14, -.02));
        const h = new T.Mesh(new T.TorusGeometry(.07, .022, 8, 16), mat(0xffffff)); h.position.set(.16, 0, 0); g.add(h);
      } else if (k === 'smoothie') {
        const cup = new T.Mesh(new T.CylinderGeometry(.13, .1, .3, 24), new T.MeshPhysicalMaterial({ color: 0x8fe08a, roughness: .1, clearcoat: 1, transparent: true, opacity: .9 })); g.add(cup);
        const straw = new T.Mesh(new T.CylinderGeometry(.015, .015, .3, 8), mat(0xff5c8a)); straw.position.set(.05, .2, 0); straw.rotation.z = -.3; g.add(straw);
      } else if (k === 'cake') {
        const sp = new T.Mesh(new T.CylinderGeometry(.24, .24, .2, 28), mat(0xffb3d1)); g.add(sp);
        const icing = new T.Mesh(new T.CylinderGeometry(.25, .25, .04, 28), mat(0xffffff)); icing.position.y = .11; g.add(icing);
        const candle = new T.Mesh(new T.CylinderGeometry(.02, .02, .14, 8), mat(0x6f8cff)); candle.position.y = .2; g.add(candle);
        g.add(sph(.035, new T.MeshBasicMaterial({ color: 0xffc34d }), 1, 1.5, 1, 0, .3, 0));
      }
      return g;
    }

    // toys on the lily pad (tap to play) and pond upgrades
    const TOY_SPOTS = { ball: [-.8, 1.35], wand: [-.15, 1.62], trampoline: [-1.45, 1.0], radio: [.6, 1.55] };
    function stripedBall() {
      const cvs = document.createElement('canvas'); cvs.width = 128; cvs.height = 16; const c = cvs.getContext('2d');
      ['#ff6b6b', '#ffffff', '#ffd93d', '#ffffff', '#4d96ff', '#ffffff'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * 128 / 6, 0, 128 / 6 + 1, 16); });
      const tex = new T.CanvasTexture(cvs); if (T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
      return new T.Mesh(new T.SphereGeometry(.22, 32, 20), new T.MeshPhysicalMaterial({ map: tex, roughness: .35, clearcoat: .8 }));
    }
    function buildMore(k) {
      const g = new T.Group();
      const at = (x, z) => g.position.set(x, PAD_Y, z);
      if (k === 'ball') { at(...TOY_SPOTS.ball); const b = stripedBall(); b.position.y = .22; b.castShadow = true; g.add(b); g.userData.ball = b; }
      if (k === 'wand') {
        at(...TOY_SPOTS.wand); g.rotation.y = .6;
        const stick = new T.Mesh(new T.CylinderGeometry(.02, .02, .5, 8), mat(0xa780e6)); stick.rotation.z = Math.PI / 2; stick.position.y = .03; g.add(stick);
        const ring = new T.Mesh(new T.TorusGeometry(.09, .02, 8, 24), mat(0xa780e6)); ring.position.set(.32, .03, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
      }
      if (k === 'trampoline') {
        at(...TOY_SPOTS.trampoline);
        const rim = new T.Mesh(new T.TorusGeometry(.32, .05, 10, 32), mat(0x6f8cff)); rim.rotation.x = Math.PI / 2; rim.position.y = .16; g.add(rim);
        const bed = new T.Mesh(new T.CylinderGeometry(.3, .3, .02, 32), mat(0x2b2b33)); bed.position.y = .15; g.add(bed); g.userData.bed = bed;
        for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4, l = new T.Mesh(new T.CylinderGeometry(.025, .025, .16, 6), mat(0x9aa294)); l.position.set(Math.cos(a) * .28, .08, Math.sin(a) * .28); g.add(l); }
      }
      if (k === 'radio') {
        at(...TOY_SPOTS.radio); g.rotation.y = -.35;
        const box = new T.Mesh(new T.BoxGeometry(.38, .24, .14), mat(0xea942f)); box.position.y = .13; box.castShadow = true; g.add(box);
        const spk = new T.Mesh(new T.CylinderGeometry(.07, .07, .02, 20), mat(0x2b2b33)); spk.rotation.x = Math.PI / 2; spk.position.set(-.08, .13, .075); g.add(spk);
        g.add(sph(.025, mat(0xffffff), 1, 1, 1, .1, .16, .075), sph(.025, mat(0xffffff), 1, 1, 1, .1, .09, .075));
        const ant = new T.Mesh(new T.CylinderGeometry(.008, .008, .3, 6), mat(0x9aa294)); ant.position.set(.13, .38, 0); ant.rotation.z = -.4; g.add(ant);
      }
      if (k === 'kite') {
        const kite = new T.Group(); kite.position.set(-1.9, 3.4, -2.2); g.add(kite);
        const shape = new T.Shape(); shape.moveTo(0, .5); shape.lineTo(.32, 0); shape.lineTo(0, -.6); shape.lineTo(-.32, 0); shape.lineTo(0, .5);
        kite.add(new T.Mesh(new T.ShapeGeometry(shape), new T.MeshStandardMaterial({ color: 0xa780e6, side: T.DoubleSide })));
        [0, 1, 2].forEach(i => kite.add(sph(.05, mat([0xff6b6b, 0xffd93d, 0x4d96ff][i]), 1, 1, 1, .05 * (i % 2 ? 1 : -1), -.75 - i * .18, 0)));
        const lineGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]);
        const line = new T.Line(lineGeo, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 })); g.add(line);
        g.userData.kite = kite; g.userData.line = line;
      }
      if (k === 'lights') {
        const cols = [0xffd66b, 0xff7eb6, 0x7fe0a0, 0x6fb6ff];
        g.userData.bulbs = [];
        for (let i = 0; i < 28; i++) {
          const a = i / 28 * Math.PI * 2, m = new T.MeshStandardMaterial({ color: cols[i % 4], emissive: cols[i % 4], emissiveIntensity: .4 });
          const b = new T.Mesh(new T.SphereGeometry(.045, 10, 8), m); b.position.set(Math.sin(a) * 1.97, .08 + Math.sin(i * 1.3) * .015, Math.cos(a) * 1.97); g.add(b); g.userData.bulbs.push(m);
        }
      }
      if (k === 'stones') [[-1.55, 2.05, .26], [-2.05, 2.35, .22], [-1.25, 2.55, .24], [-1.85, 2.85, .2]].forEach(([x, z, r]) => g.add(sph(r, mat(0x9aa294, { roughness: .9, clearcoat: 0 }), 1.2, .32, 1, x, -.05, z)));
      if (k === 'waterlilies') {
        g.userData.lilies = [[1.45, 2.0, .9], [-.35, 2.4, .75], [2.25, .95, .8]].map(([x, z, s]) => {
          const l = new T.Group(); l.position.set(x, -.04, z); l.scale.setScalar(s); g.add(l);
          const leaf = new T.Mesh(new T.CylinderGeometry(.34, .34, .03, 28, 1, false, .4, Math.PI * 2 - .5), mat(0x3a8a48)); l.add(leaf);
          const petals = []; for (let i = 0; i < 8; i++) { const pg = new T.Group(); pg.rotation.y = i / 8 * Math.PI * 2; const p = sph(.1, mat(i % 2 ? 0xffffff : 0xffc6dc), .45, .2, 1, 0, .05, .11); pg.add(p); l.add(pg); petals.push(pg); }
          l.add(sph(.05, mat(0xffd23f), 1, .7, 1, 0, .08, 0)); l.userData.petals = petals; return l;
        });
      }
      if (k === 'fountain') {
        g.position.set(1.95, -.05, -1.55);
        const basin = new T.Mesh(new T.CylinderGeometry(.42, .36, .2, 28), mat(0xb9bfb5, { roughness: .8, clearcoat: 0 })); basin.position.y = .1; g.add(basin);
        const water = new T.Mesh(new T.CylinderGeometry(.36, .36, .02, 28), mat(0x7fd0ea, { roughness: .1, clearcoat: 1 })); water.position.y = .2; g.add(water);
        const col = new T.Mesh(new T.CylinderGeometry(.06, .08, .4, 12), mat(0xb9bfb5)); col.position.y = .35; g.add(col);
        const dm = new T.MeshPhysicalMaterial({ color: 0xbfeaff, transparent: true, opacity: .8, roughness: 0, clearcoat: 1 });
        g.userData.drops = Array.from({ length: 18 }, (_, i) => { const d = new T.Mesh(new T.SphereGeometry(.03, 8, 6), dm); g.add(d); d.userData.ph = i / 18; d.userData.a = i * 2.4; return d; });
      }
      if (k === 'jetty') {
        g.position.set(1.85, .0, .35); g.rotation.y = -.15;
        const wood = mat(0xa0703f, { roughness: .8, clearcoat: 0 });
        for (let i = 0; i < 7; i++) { const pl = new T.Mesh(new T.BoxGeometry(.16, .05, .8), wood); pl.position.set(i * .18, .04, 0); pl.castShadow = true; g.add(pl); }
        [[1.2, .38], [1.2, -.38]].forEach(([x, z]) => { const post = new T.Mesh(new T.CylinderGeometry(.05, .05, .5, 10), mat(0x7a5230)); post.position.set(x, .1, z); g.add(post); });
      }
      if (k === 'house') {
        g.position.set(-1.25, PAD_Y, -1.3);
        const stem = new T.Mesh(new T.CylinderGeometry(.3, .36, .62, 24), mat(0xf4eedd)); stem.position.y = .31; stem.castShadow = true; g.add(stem);
        const cap = new T.Mesh(new T.SphereGeometry(.58, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe8443a)); cap.position.y = .58; cap.scale.y = .7; cap.castShadow = true; g.add(cap);
        [[.25, .85, .32], [-.3, .8, .25], [0, .98, -.1], [.35, .72, -.25], [-.2, .9, .3]].forEach(([x, y, z]) => g.add(sph(.06, mat(0xffffff), 1, .5, 1, x, y, z)));
        const door = new T.Mesh(new T.BoxGeometry(.16, .26, .03), mat(0x8a5a33)); door.position.set(.14, .13, .32); door.rotation.y = .4; g.add(door);
        const winM = new T.MeshStandardMaterial({ color: 0xffe28a, emissive: 0xffc34d, emissiveIntensity: .2 });
        const win = new T.Mesh(new T.CircleGeometry(.07, 20), winM); win.position.set(-.12, .4, .33); win.rotation.y = -.35; g.add(win);
        g.userData.win = winM;
      }
      if (k === 'clock') {
        g.position.set(1.55, PAD_Y, -.85);
        const gold = mat(0xf5c542, { metalness: .6, roughness: .25, clearcoat: 1 });
        const post = new T.Mesh(new T.CylinderGeometry(.035, .045, .7, 10), gold); post.position.y = .35; g.add(post);
        const face = new T.Mesh(new T.CylinderGeometry(.24, .24, .06, 32), gold); face.rotation.x = Math.PI / 2; face.position.y = .88; g.add(face);
        const dial = new T.Mesh(new T.CircleGeometry(.2, 32), mat(0xfffbea)); dial.position.set(0, .88, .035); g.add(dial);
        const hand = (len, w) => { const h = new T.Mesh(new T.BoxGeometry(w, len, .01), mat(0x1f2a22)); h.geometry.translate(0, len / 2, 0); h.position.set(0, .88, .045); g.add(h); return h; };
        g.userData.hh = hand(.1, .025); g.userData.mh = hand(.16, .015); g.rotation.y = -.5;
      }
      if (k === 'giantpad') {
        const lotus = new T.Group(); lotus.position.set(-1.15, PAD_Y, -.95); g.add(lotus);
        for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 8; i++) { const pg = new T.Group(); pg.rotation.y = i / 8 * Math.PI * 2 + ring * .4; pg.add(sph(.16 - ring * .04, mat(ring ? 0xffd2e4 : 0xff8fc0), .5, .35, 1.2, 0, .14 + ring * .06, .17 - ring * .06)); pg.children[0].rotation.x = -.6 - ring * .3; lotus.add(pg); }
        lotus.add(sph(.08, mat(0xffd23f), 1, .7, 1, 0, .2, 0));
      }
      if (k === 'castle') {
        g.position.set(0, -.05, -3.7);
        const stone = mat(0xd9dde3, { roughness: .8, clearcoat: 0 }), roof = mat(0x8f7fe0), flag = mat(0xff7eb6, { side: T.DoubleSide });
        const wall = new T.Mesh(new T.BoxGeometry(2.6, 1.2, .6), stone); wall.position.y = .6; g.add(wall);
        const gate = new T.Mesh(new T.CylinderGeometry(.3, .3, .62, 20, 1, false, 0, Math.PI), mat(0x6b4a2a)); gate.rotation.z = Math.PI / 2; gate.rotation.y = Math.PI / 2; gate.position.set(0, .3, .31); g.add(gate);
        [[-1.3, 2.2], [1.3, 2.2], [0, 2.9]].forEach(([x, h]) => {
          const tw = new T.Mesh(new T.CylinderGeometry(.38, .42, h, 20), stone); tw.position.set(x, h / 2, x ? 0 : -.35); tw.castShadow = true; g.add(tw);
          const cone = new T.Mesh(new T.ConeGeometry(.5, .8, 20), roof); cone.position.set(x, h + .4, x ? 0 : -.35); g.add(cone);
          const pole = new T.Mesh(new T.CylinderGeometry(.015, .015, .4, 6), mat(0x555555)); pole.position.set(x, h + 1, x ? 0 : -.35); g.add(pole);
          const f = new T.Mesh(new T.PlaneGeometry(.3, .18), flag); f.position.set(x + .16, h + 1.1, x ? 0 : -.35); g.add(f);
          [.4, .9].forEach(y => { const w = new T.Mesh(new T.CircleGeometry(.08, 12), mat(0x3b3f78)); w.position.set(x, h * y, (x ? 0 : -.35) + .41); g.add(w); });
        });
        g.scale.setScalar(.95);
      }
      // friends
      if (k === 'goldfish') {
        const o = mat(0xff8a2a, { clearcoat: 1, roughness: .2 });
        g.add(sph(.13, o, 1.6, .9, .7)); const tail = new T.Mesh(new T.ConeGeometry(.1, .18, 12), o); tail.rotation.z = Math.PI / 2; tail.position.x = -.25; g.add(tail);
        g.add(sph(.03, P, 1, 1, 1, .14, .04, .07), sph(.03, P, 1, 1, 1, .14, .04, -.07));
      }
      if (k === 'duckling') {
        const y = mat(0xffd84d, { roughness: .6, clearcoat: .2 });
        g.add(sph(.2, y, 1.3, .9, 1, 0, .08, 0)); g.add(sph(.14, y, 1, 1, 1, .2, .3, 0));
        const beak = new T.Mesh(new T.ConeGeometry(.05, .12, 10), mat(0xff8a2a)); beak.rotation.z = -Math.PI / 2; beak.position.set(.36, .29, 0); g.add(beak);
        g.add(sph(.025, P, 1, 1, 1, .3, .35, .07), sph(.025, P, 1, 1, 1, .3, .35, -.07));
      }
      if (k === 'butterfly' || k === 'bee_friend') {
        const bee = k === 'bee_friend';
        const body = mat(bee ? 0xffcc33 : 0x2b2b33); g.add(sph(bee ? .08 : .04, body, bee ? 1.5 : 3, 1, 1));
        if (bee) [-.04, .04].forEach(x => { const st = new T.Mesh(new T.CylinderGeometry(.075, .075, .03, 16), mat(0x1b1b24)); st.rotation.z = Math.PI / 2; st.position.x = x; g.add(st); });
        const wm = bee ? new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .6, side: T.DoubleSide }) : mat(0xc77dff, { side: T.DoubleSide });
        g.userData.w = [-1, 1].map(s => { const wg = new T.Group(); const w = sph(bee ? .07 : .13, wm, 1, .06, 1.2, 0, 0, s * (bee ? .07 : .13)); if (!bee) w.add(sph(.05, mat(0xffd23f), 1, 1.2, 1, .03, 0, s * .03)); wg.add(w); wg.userData.s = s; g.add(wg); return wg; });
      }
      if (k === 'hedgehog') {
        const brown = mat(0x8b5a3c, { roughness: .8, clearcoat: 0 }), face = mat(0xe8c9a0);
        g.add(sph(.2, brown, 1.3, .8, 1, 0, .14, 0));
        for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI, b = Math.random() * Math.PI * 2, sp = new T.Mesh(new T.ConeGeometry(.03, .14, 6), brown);
          const d = new T.Vector3(Math.cos(b) * Math.sin(a) * 1.2, Math.cos(a) * .8 + .2, Math.sin(b) * Math.sin(a)).normalize(); if (d.x > .5) continue;
          sp.position.copy(d.clone().multiply(new T.Vector3(.24, .16, .2))).add(new T.Vector3(0, .14, 0)); sp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d); g.add(sp); }
        g.add(sph(.1, face, 1.3, .9, 1, .24, .1, 0)); g.add(sph(.03, P, 1, 1, 1, .37, .11, 0)); g.add(sph(.02, P, 1, 1, 1, .27, .15, .05), sph(.02, P, 1, 1, 1, .27, .15, -.05));
      }
      if (k === 'babyfrog') {
        const baby = buildFrog(); baby.g.scale.setScalar(.32); baby.stub.visible = false; g.add(baby.g); g.position.set(1.32, PAD_Y, 1.05); g.rotation.y = -.5; g.userData.baby = baby;
      }
      g.visible = false; scene.add(g); return g;
    }
    const MORE = ['ball', 'wand', 'trampoline', 'radio', 'kite', 'lights', 'stones', 'waterlilies', 'fountain', 'jetty', 'house', 'clock', 'giantpad', 'castle',
      'goldfish', 'duckling', 'butterfly', 'bee_friend', 'hedgehog', 'babyfrog'];
    MORE.forEach(k => { extras[k] = buildMore(k); });
    let wind = 10, lilyOpen = 1, lilyOpenCur = 1, busyToy = null;

    // ---------- Places: how the frog reacts to each background ----------
    let sceneMode = 'pond';
    const PAD_TINT = { arctic: [0xd8eef8, 0xeaf7fd], space: [0x8d939c, 0xa4aab3], candy: [0xff9fc9, 0xffc2dd], spooky: [0x2c4a2c, 0x35583a], desert: [0x6f9a3a, 0x86b04a] };
    function applyPadColour() {
      if (!pad) return;
      const big = pad.userData.big, tint = PAD_TINT[sceneMode];
      const c = tint || (big ? [0x2f8a3a, 0x3fa04a] : [pal.pad, pal.padTop]);
      pad.material.color.setHex(c[0]); padTop.material.color.setHex(c[1]);
    }
    // moustaches for Paris: one sized for the frog, one for the tadpole
    function buildMoustache() {
      const g = new T.Group(), blk = mat(0x1b1b22, { roughness: .4 });
      [-1, 1].forEach(s => {
        const half = sph(.1, blk, 1.7, .55, .7, s * .13, 0, 0); half.rotation.z = s * -.25; g.add(half);
        const curl = new T.Mesh(new T.TorusGeometry(.05, .022, 8, 16, Math.PI * 1.4), blk); curl.position.set(s * .28, .05, -.01); curl.rotation.z = s > 0 ? -.4 : Math.PI + .4; g.add(curl);
      });
      g.visible = false; return g;
    }
    const tache = { frog: buildMoustache(), tad: buildMoustache() };
    tache.frog.position.set(0, 1.27, .93); tache.frog.rotation.x = -.35; creatures.frog.g.add(tache.frog);
    tache.tad.position.set(0, 1.03, .74); tache.tad.scale.setScalar(.58); tache.tad.rotation.x = -.2; creatures.tad.g.add(tache.tad);
    // a glass space bubble that goes over the whole frog
    const bubbleHelmet = new T.Group(); holder.add(bubbleHelmet); bubbleHelmet.visible = false;
    { const glass = new T.MeshPhysicalMaterial({ color: 0xdff4ff, transparent: true, opacity: .16, roughness: 0, clearcoat: 1, side: T.DoubleSide });
      const dome = new T.Mesh(new T.SphereGeometry(1.6, 40, 24), glass); dome.position.y = 1.0; bubbleHelmet.add(dome);
      const ring = new T.Mesh(new T.TorusGeometry(1.45, .1, 12, 48), mat(0xf4f6fa, { metalness: .3 })); ring.rotation.x = Math.PI / 2; ring.position.y = .1; bubbleHelmet.add(ring);
      bubbleHelmet.add(sph(.08, mat(0xff5c5c, { roughness: .2 }), 1, 1, 1, 0, 2.62, 0)); }
    // disco mirrorball with coloured lights, and spooky pumpkins
    const disco = new T.Group(); disco.visible = false; scene.add(disco);
    const mball = new T.Mesh(new T.IcosahedronGeometry(.34, 2), new T.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 1, roughness: .15, flatShading: true }));
    mball.position.set(1.25, 2.85, -.4); disco.add(mball);
    { const cord = new T.Mesh(new T.CylinderGeometry(.01, .01, 1.4, 6), mat(0x888888)); cord.position.set(1.25, 3.7, -.4); disco.add(cord); }
    const discoLights = [0xff3fa4, 0x3fd9ff, 0xffe14d].map(col => { const l = new T.PointLight(col, 1.1, 6); disco.add(l); return l; });
    const pumpkins = new T.Group(); pumpkins.visible = false; scene.add(pumpkins);
    [[1.5, .95, 1], [-1.6, .15, .8]].forEach(([x, z, s]) => {
      const p = new T.Group(); p.position.set(x, PAD_Y, z); p.scale.setScalar(s); p.rotation.y = -x * .3; pumpkins.add(p);
      for (let i = 0; i < 6; i++) { const seg = sph(.2, mat(0xff8a1f, { roughness: .5 }), .55, .82, 1, Math.cos(i / 6 * Math.PI * 2) * .1, .17, Math.sin(i / 6 * Math.PI * 2) * .1); seg.rotation.y = i / 6 * Math.PI * 2; p.add(seg); }
      const stem = new T.Mesh(new T.CylinderGeometry(.03, .04, .1, 8), mat(0x4c7a2a)); stem.position.y = .35; p.add(stem);
      const glow = new T.MeshBasicMaterial({ color: 0xffd23f });
      [-1, 1].forEach(s => { const eye = new T.Mesh(new T.ConeGeometry(.04, .07, 3), glow); eye.position.set(s * .07, .22, .27); p.add(eye); });
      const grin = new T.Mesh(new T.BoxGeometry(.16, .035, .02), glow); grin.position.set(0, .12, .275); p.add(grin);
    });
    // little particles: drips (rainforest), breath (arctic), sweat (desert), bubbles (under the sea)
    const parts = [];
    function spawn(kind, pos, vel, life, size, color, opacity) {
      const m = new T.MeshPhysicalMaterial({ color, transparent: true, opacity, roughness: 0, clearcoat: 1 });
      const s = new T.Mesh(new T.SphereGeometry(size, 12, 8), m); s.position.copy(pos); scene.add(s);
      parts.push({ s, vel, life, age: 0, kind, o: opacity });
    }
    let nextPart = 0;
    const wetMats = () => [creatures.frog.paint.body, creatures.frog.paint.spot, creatures.tad.paint.body];
    sceneHook = (dt) => {
      const m = sceneMode;
      if (stage === 'egg') return;
      if (m === 'arctic' && !sleeping) { fx.rz += Math.sin(t * 55) * .022; fx.x += Math.sin(t * 47) * .012; }
      if (m === 'disco' && !sleeping) { fx.rz += Math.sin(t * 6) * .09; fx.y += Math.abs(Math.sin(t * 6)) * .1; fx.ry += Math.sin(t * 3) * .25; }
      if (m === 'space') { fx.y += .3 + Math.sin(t * .8) * .14; fx.rz += Math.sin(t * .6) * .06; }
      if (m === 'underwater') fx.y += .08 + Math.sin(t * 1.1) * .06;
      if (m === 'desert' && !sleeping) fx.open = Math.max(fx.open, (Math.sin(t * 7) * .5 + .5) * .45);
      // particles
      const c = creatures[keyOf(stage)];
      if (t > nextPart && holder.visible) {
        const head = new T.Vector3(); c.anchor.getWorldPosition(head);
        if (m === 'rainforest') { nextPart = t + .25; const p = holder.localToWorld(new T.Vector3((Math.random() - .5) * 1.8, .9 + Math.random() * .8, (Math.random() - .3) * 1.2)); spawn('drip', p, new T.Vector3(0, -.2, 0), 1.2, .045, 0x9fd8ff, .75); }
        else if (m === 'arctic' && c.mouth) { nextPart = t + 2.4; const mo = mouthWorld(c); for (let i = 0; i < 4; i++) spawn('puff', mo.clone().add(new T.Vector3(0, 0, .15)), new T.Vector3((Math.random() - .5) * .2, .25, .45), 1.6, .08, 0xffffff, .55); }
        else if (m === 'desert') { nextPart = t + 2.8; spawn('drip', head.clone().add(new T.Vector3((Math.random() < .5 ? -1 : 1) * .45, -.1, .35)), new T.Vector3(0, -.15, .05), 1.3, .05, 0x9fd8ff, .85); }
        else if (m === 'underwater' && c.mouth) { nextPart = t + 1.6; const mo = mouthWorld(c); for (let i = 0; i < 3; i++) spawn('bubble', mo.clone().add(new T.Vector3((Math.random() - .5) * .2, 0, .2)), new T.Vector3((Math.random() - .5) * .15, .6 + Math.random() * .3, .1), 3.5, .05 + Math.random() * .05, 0xe6f8ff, .5); }
        else nextPart = t + .5;
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i]; q.age += dt;
        if (q.kind === 'drip') q.vel.y -= 6 * dt;
        if (q.kind === 'puff') q.s.scale.setScalar(1 + q.age * 2.2);
        if (q.kind === 'bubble') q.s.position.x += Math.sin(t * 4 + i) * .004;
        q.s.position.addScaledVector(q.vel, dt);
        q.s.material.opacity = q.o * Math.max(0, 1 - q.age / q.life);
        if (q.age >= q.life || (q.kind === 'drip' && q.s.position.y < .02)) { scene.remove(q.s); q.s.geometry.dispose(); q.s.material.dispose(); parts.splice(i, 1); }
      }
      // disco lights and mirrorball, pad colours cycling on the dance floor
      if (disco.visible) {
        mball.rotation.y += dt * 1.2;
        discoLights.forEach((l, i) => { const a = t * 1.6 + i * 2.1; l.position.set(Math.cos(a) * 2.2, 2.2 + Math.sin(t * 2 + i) * .4, Math.sin(a) * 2.2); });
        if (pad) { pad.material.color.setHSL((t * .15) % 1, .7, .45); padTop.material.color.setHSL((t * .15 + .5) % 1, .7, .55); }
      }
    };
    const tmpV = new T.Vector3();
    function moreTick() {
      const x = extras;
      if (x.kite.visible) {
        const k = x.kite.userData.kite, sway = .15 + Math.min(1, wind / 30) * .5;
        if (busyToy !== 'kite') { k.position.set(-1.9 + Math.sin(t * .7) * sway, 3.4 + Math.sin(t * 1.1) * sway * .6, -2.2); k.rotation.z = Math.sin(t * 1.3) * sway * .6; }
        holder.localToWorld(tmpV.set(.5, 1.1, .2)); const pos = x.kite.userData.line.geometry.attributes.position;
        pos.setXYZ(0, tmpV.x, tmpV.y, tmpV.z); k.getWorldPosition(tmpV); pos.setXYZ(1, tmpV.x, tmpV.y - .55, tmpV.z); pos.needsUpdate = true;
      }
      if (x.lights.visible) x.lights.userData.bulbs.forEach((m, i) => { m.emissiveIntensity = .25 + cur.night * .9 + (dayMul < 1 ? .6 : 0) + Math.sin(t * 3 + i) * .15; });
      if (x.waterlilies.visible) { lilyOpenCur += (lilyOpen - lilyOpenCur) * .02; x.waterlilies.userData.lilies.forEach((l, j) => { l.userData.petals.forEach(pg => { pg.children[0].rotation.x = -.15 - lilyOpenCur * .9; }); l.position.y = -.04 + Math.sin(t * .8 + j) * .015; }); }
      if (x.fountain.visible) x.fountain.userData.drops.forEach(d => { const p = (t * .55 + d.userData.ph) % 1, a = d.userData.a; d.position.set(Math.cos(a) * p * .3, .56 + p * .5 - p * p * .5 * 1.6, Math.sin(a) * p * .3); });
      if (x.house.visible) x.house.userData.win.emissiveIntensity = sleeping ? 1.4 : .2 + cur.night * .6;
      holder.visible = !(x.house.visible && sleeping && stage !== 'egg');
      if (x.clock.visible) { const d = new Date(), h = d.getHours() % 12 + d.getMinutes() / 60, m = d.getMinutes(); x.clock.userData.hh.rotation.z = -h / 12 * Math.PI * 2; x.clock.userData.mh.rotation.z = -m / 60 * Math.PI * 2; }
      if (x.goldfish.visible) {
        const a = t * .35, jump = Math.max(0, Math.sin(t * .9)) ** 12;
        x.goldfish.position.set(Math.cos(a) * 2.45, -.06 + jump * .7, Math.sin(a) * 2.45); x.goldfish.rotation.set(0, -a - Math.PI / 2, (Math.cos(t * .9) > 0 ? -1 : 1) * jump * .8);
      }
      if (x.duckling.visible) { const a = -t * .18 + 1; x.duckling.position.set(Math.cos(a) * 2.7, -.06 + Math.sin(t * 3) * .02, Math.sin(a) * 2.7); x.duckling.rotation.y = -a; }
      if (x.butterfly.visible) {
        const b = x.butterfly; b.position.set(Math.sin(t * .4) * 1.6 + Math.sin(t * 1.7) * .2, 1.7 + Math.sin(t * .9) * .4, Math.cos(t * .4) * 1.2);
        b.rotation.y = -t * .4; b.userData.w.forEach(w => { w.rotation.x = w.userData.s * Math.sin(t * 14) * .9; });
      }
      if (x.bee_friend.visible) {
        const b = x.bee_friend; b.position.set(Math.sin(t * .9) * 1.4 + Math.sin(t * 5) * .08, 1.25 + Math.sin(t * 2.3) * .25, Math.sin(t * 1.8) * .8 + .6);
        b.rotation.y = Math.atan2(-Math.cos(t * 1.8), Math.cos(t * .9)); b.userData.w.forEach(w => { w.rotation.x = w.userData.s * Math.sin(t * 60) * .6; });
      }
      if (x.hedgehog.visible) { const a = 1 + t * .06; x.hedgehog.position.set(Math.cos(a) * 1.72, PAD_Y, Math.sin(a) * 1.72); x.hedgehog.rotation.y = -a - Math.PI / 2; }
      if (x.babyfrog.visible) { const bb = x.babyfrog.userData.baby; bb.g.position.y = Math.max(0, Math.sin(t * 2.6)) * .05; bb.mats.forEach(m => m.color.copy(m.userData.base)); }
    }
    function playToy(k) {
      const g = extras[k]; if (!g || !g.visible || busyToy) return 0; busyToy = k;
      const done = () => { busyToy = null; };
      if (k === 'ball') {
        const b = g.userData.ball, sx = g.position.x, sz = g.position.z;
        tween(2.4, p => {
          const ph = p < .25 ? p / .25 : p < .75 ? 1 : (1 - p) / .25, bounce = Math.abs(Math.sin(p * Math.PI * 4)) * .5;
          b.position.set(-sx * ph, .22 + ph * (1.9 + bounce), -sz * ph + ph * .1); b.rotation.x += .2;
          if (p > .25 && p < .75) { fx.y = Math.abs(Math.sin(p * Math.PI * 4)) * .12; fx.squint = .6; fx.open = .4; }
        }, () => { b.position.set(0, .22, 0); done(); });
        return 2400;
      }
      if (k === 'wand') {
        const bm = new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .4, roughness: 0, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.3 });
        const m0 = mouthWorld(creatures[keyOf(stage)]);
        tween(2, p => { fx.open = .5 + Math.sin(p * 20) * .2; fx.sy = 1 + Math.sin(p * Math.PI) * .04; }, done);
        for (let i = 0; i < 14; i++) {
          const r = .06 + Math.random() * .1, bub = new T.Mesh(new T.SphereGeometry(r, 18, 12), bm); scene.add(bub);
          const vx = (Math.random() - .5) * 1.6, vy = .4 + Math.random() * .8, vz = .6 + Math.random() * .6;
          bub.position.copy(m0); bub.scale.setScalar(.001);
          tween(2 + Math.random(), (p) => { bub.position.set(m0.x + vx * p, m0.y + vy * p, m0.z + .1 + vz * p); bub.scale.setScalar(Math.max(.001, p < .1 ? p / .1 : p > .9 ? (1 - p) / .1 : 1)); }, () => scene.remove(bub), i * .12);
        }
        return 2400;
      }
      if (k === 'trampoline') {
        const bed = g.userData.bed;
        tween(2.2, p => { const q = Math.abs(Math.sin(p * Math.PI * 3)); fx.y = q * 1.3; fx.sy = 1 + q * .06 - (q < .15 ? .15 : 0); fx.ry = p * Math.PI * 2; fx.open = .6; bed.position.y = .15 - (q < .2 ? (.2 - q) * .4 : 0); }, done);
        return 2300;
      }
      if (k === 'radio') {
        tween(4.2, p => { fx.rz = Math.sin(p * Math.PI * 8) * .14; fx.y = Math.abs(Math.sin(p * Math.PI * 8)) * .18; fx.ry = Math.sin(p * Math.PI * 4) * .4; fx.squint = .7; fx.open = .5; g.scale.setScalar(1 + Math.abs(Math.sin(p * Math.PI * 16)) * .06); }, () => { g.scale.setScalar(1); done(); });
        return 4300;
      }
      if (k === 'kite') {
        const kt = g.userData.kite;
        tween(2.4, p => { const a = p * Math.PI * 2; kt.position.set(-1.9 + Math.sin(a) * .9, 3.4 + (1 - Math.cos(a)) * .7, -2.2); kt.rotation.z = a; fx.ry = -.4 * Math.sin(p * Math.PI); }, done);
        return 2500;
      }
      busyToy = null; return 0;
    }
    function toyHit(x, y) {
      const r = cv.getBoundingClientRect();
      const ndc = new T.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      for (const k of ['ball', 'wand', 'trampoline', 'radio', 'kite']) {
        const g = extras[k]; if (!g.visible) continue;
        if (ray.intersectObject(g, true).length) return k;
        const target = k === 'kite' ? g.userData.kite : g; target.getWorldPosition(tmpV); const c = tmpV.clone().setY(tmpV.y + .15).project(camera);
        if (Math.hypot(ndc.x - c.x, (ndc.y - c.y) / camera.aspect) < (k === 'kite' ? .12 : .1)) return k;
      }
      return null;
    }

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
      moreTick();
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
      setExtras(on) {
        const big = !!(on && on.giantpad);
        if (pad && pad.userData.big !== big) { pad.userData.big = big; const from = pad.scale.x, to = big ? 1.16 : 1; tween(.8, p => { const s = from + (to - from) * elastic(p); pad.scale.set(s, 1, s); padTop.scale.set(s, 1, s); }); applyPadColour(); }
        for (const k in extras) { const v = !!(on && on[k]); if (extras[k].visible !== v) { extras[k].visible = v; if (v) { const g = extras[k], s = g.scale.x || 1; tween(.6, p => g.scale.setScalar(Math.max(.001, s * elastic(p)))); } } } },
      setDaylight(m) { dayMul = m; lilyOpen = m >= 1.2 ? 1 : m >= .95 ? .55 : .08; },
      setWind(w) { wind = +w || 0; },
      setOutfit(o) {
        const key = JSON.stringify(o); if (key === outfitKey) return; outfitKey = key;
        const swap = (g, child) => { while (g.children.length) g.remove(g.children[0]); g.add(child); };
        swap(outfit.neck, buildNeck(o.neck)); swap(outfit.face, buildFace(o.face)); swap(outfit.feet, buildFeet(o.feet)); swap(outfit.brolly, buildBrolly(o.umbrella));
      },
      eat(kind) {
        const c = creatures[keyOf(stage)]; if (!c.mouth) return;
        if (kind === 'dragonfly') { api.feed(); return; }
        const tr = buildTreat(kind); scene.add(tr);
        const place = () => { const m = mouthWorld(c); tr.position.set(m.x, m.y - .05, m.z + .38); };
        tween(.35, p => { place(); tr.scale.setScalar(Math.max(.001, elastic(p))); }, () => {
          tween(1.3, p => { place(); fx.open = Math.abs(Math.sin(p * Math.PI * 4)) * .9; fx.squint = .5; tr.scale.setScalar(Math.max(.001, 1 - Math.floor(p * 4) / 4)); },
            () => { scene.remove(tr); if (kind === 'cake') { api.react('celebrate'); burst(); } else api.react(kind === 'burger' ? 'tickle' : 'pet'); });
        });
      },
      playToy,
      setScene(name) {
        if (name === sceneMode) return; sceneMode = name;
        tache.frog.visible = tache.tad.visible = name === 'paris';
        bubbleHelmet.visible = name === 'space'; disco.visible = name === 'disco'; pumpkins.visible = name === 'spooky';
        wetMats().forEach(m => { if (m.userData.dry == null) m.userData.dry = [m.roughness, m.clearcoat]; m.roughness = name === 'rainforest' ? .08 : m.userData.dry[0]; m.clearcoat = name === 'rainforest' ? 1 : m.userData.dry[1]; });
        applyPadColour();
        if (name === 'paris') tween(.6, p => { const s = Math.max(.001, elastic(p)); tache.frog.scale.setScalar(s * 1.45); tache.tad.scale.setScalar(s * .8); });
      },
      shakeOff() {
        api.react('no');
        const p0 = new T.Vector3(); holder.getWorldPosition(p0);
        for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2; spawn('drip', p0.clone().add(new T.Vector3(Math.cos(a) * .9, 1 + Math.random() * .5, Math.sin(a) * .9)), new T.Vector3(Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5), 1, .05, 0x9fd8ff, .8); }
      },
      // post-loo zoomies: race two laps round the lily pad, hopping and spinning
      zoomies() {
        tween(3.6, p => {
          const ease = Math.sin(p * Math.PI), a = p * Math.PI * 4;
          fx.x = Math.sin(a) * .95 * ease; fx.z = (Math.cos(a) - 1) * .55 * ease;
          fx.y = Math.abs(Math.sin(p * Math.PI * 14)) * .22 * ease;
          fx.ry = a + Math.PI / 2 * ease; fx.open = .7 * ease; fx.squint = .3; fx.rz = Math.sin(p * Math.PI * 14) * .08 * ease;
        });
      },
      // colours: { key, body, belly, spot, tad, tadBelly, rainbow }
      setColour(c) {
        if (!c || c.key === colourKey) return; colourKey = c.key; rainbow = !!c.rainbow;
        const paint = (m, hex) => { if (!m || hex == null) return; m.color.setHex(hex); m.userData.base = m.color.clone(); m.userData.sad = m.color.clone().lerp(sadGrey, .65); };
        const f = creatures.frog.paint, tp = creatures.tad.paint;
        paint(f.body, c.body); paint(f.belly, c.belly); paint(f.spot, c.spot); paint(tp.body, c.tad); paint(tp.belly, c.tadBelly);
        const bf = extras.babyfrog.userData.baby.paint; paint(bf.body, c.body); paint(bf.belly, c.belly); paint(bf.spot, c.spot);
      },
      hop() {
        if (extras.babyfrog.visible) { const bb = extras.babyfrog.userData.baby.g; tween(.6, p => { bb.position.y = Math.sin(p * Math.PI) * .25; }, null, .25); }
        tween(.8, p => {
          if (p < .2) { const q = p / .2; fx.sy = 1 - .15 * q; fx.sx = 1 + .08 * q; }
          else if (p < .8) { const q = Math.sin((p - .2) / .6 * Math.PI); fx.y = q * .7; fx.sy = 1 + .06 * q; fx.open = .4; }
          else { const q = Math.sin((p - .8) / .2 * Math.PI); fx.sy = 1 - .1 * q; fx.sx = 1 + .05 * q; }
        });
      },
      lookAround() { tween(2.4, p => { fx.ry = Math.sin(p * Math.PI * 2) * .55 * Math.sin(p * Math.PI); look.x = Math.sin(p * Math.PI * 2); }); },
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
