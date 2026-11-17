/* ================================================================
   Scene extras: animal Christmas (EXTRAS-FUN).
   Appended after tree.js (and extras_env.js) in the same module by build/build_tree.py.
   Uses only the documented Extras API (registerExtra / core) plus a few shims kept in this file.
   Everything here is for fun and never touches the shopping list or the totals:
   no tag(), no pickables, no instancesOf, no SEL. setExtras({all:false}) hides all of it.

     - "Sleeping pets by the fire" (living room, forest): a curled tabby on a rectangular
       tartan blanket and a golden retriever in a tartan dog bed with a little "Nice List"
       A-frame sign, breathing gently. In the forest they nap on a blanket by the log bench.
     - "Santa Paws mailbox & paw trail" (living room, forest): a red rural mailbox with a
       "Letters to SANTA PAWS" label and envelopes; tapping it flips the gold flag and shows
       a letter. In the forest a paw-print trail trots from the treeline past the mailbox.
     - "Dog-sled Santa" (forest): a real 3D sleigh pulled by six huskies that rises across
       the moon every ~38 s, with a gold sparkle trail. The dogs are physically ahead of the
       sleigh on its path, so they lead from every orbit angle.
     - "Party antlers on the plush" (all rooms, off by default): felt antlers on a red band with
       gold bells, parented to each plush photo relief so they turn with it.
     - "Husky napping by the door" (living room): a husky in a tartan scarf curled on a
       paw-print doormat just inside the front doorway.
     - "Kitten batting a bauble" (living room): a ginger kitten in a play bow swatting a gold
       bauble back and forth under the right window.
   The whole file is one block so none of its names clash with tree.js or other extras.
   ================================================================ */
{
const FX = { freezeSled: null, freezeT: null };   // debug hooks (window.__howl.funx)
const RMF = core.reducedMotion, LOWF = core.LOW;
const SEG = LOWF ? 0.65 : 1;                       // geometry detail on LOW phones
const sg = n => Math.max(4, Math.round(n * SEG));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = v => Math.min(1, Math.max(0, v));
const sst = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;
const fxStd = o => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, envMapIntensity: 0.3, ...o });
const GOLD = () => fxStd({ color: 0xc89b4a, metalness: 1, roughness: 0.3, envMapIntensity: 1.0 });
const DUMMY = new THREE.Object3D();
// shim: core.room is copied once by Object.assign in tree.js (the getter is evaluated, not kept), so read the live state
const curRoom = () => (typeof XS !== 'undefined' && XS && XS.room) || core.room;

/* ---------------- geometry helpers ---------------- */
// transform a geometry in place: position p, Euler r (YXZ), scale s
function xf(geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  DUMMY.position.set(...p); DUMMY.rotation.set(r[0], r[1], r[2], 'YXZ'); DUMMY.scale.set(...s); DUMMY.updateMatrix();
  return geo.applyMatrix4(DUMMY.matrix);
}
// place a geometry built facing +z so its +z points along n (up stays as level as possible), at p
function aim(geo, p, n, roll = 0) {
  DUMMY.position.copy(p); DUMMY.rotation.set(0, 0, 0); DUMMY.scale.set(1, 1, 1);
  DUMMY.lookAt(p.clone().add(n)); if (roll) DUMMY.rotateZ(roll); DUMMY.updateMatrix();
  return geo.applyMatrix4(DUMMY.matrix);
}
const ell = (rx, ry, rz, w = 18, h = 12) => new THREE.SphereGeometry(1, sg(w), sg(h)).scale(rx, ry, rz);
// merge, normalising attributes (position, normal, uv[, color]) and indexing so mergeGeometries never refuses
function merge(geos, { color = false } = {}) {
  const anyNonIdx = geos.some(g => !g.index);
  const list = geos.map(g => {
    let q = anyNonIdx && g.index ? g.toNonIndexed() : g;
    Object.keys(q.attributes).forEach(k => { if (!['position', 'normal', 'uv', 'color'].includes(k)) q.deleteAttribute(k); });
    if (!q.attributes.normal) q.computeVertexNormals();
    if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    if (color && !q.attributes.color) paint(q, 0xffffff);
    if (!color && q.attributes.color) q.deleteAttribute('color');
    q.clearGroups(); return q;
  });
  return core.mergeGeometries(list, false);
}
// vertex colour (sRGB hex) for merged multi-colour meshes
function paint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
// a tube along a smooth curve with a radius profile r(u); ends close themselves when r -> 0.
// Cross-section is an ellipse squashed by `flat` in the curve's "up" direction. UV: x along, y around
// (y 0.25 = top/spine, 0.75 = belly), so fur textures can carry a dark back and a light belly.
function taperTube(pts, rFn, { segs = 40, rad = 14, flat = 1, tension = 0.5, up = V(0, 1, 0) } = {}) {
  segs = sg(segs); rad = sg(rad);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', tension);
  const pos = [], uv = [], idx = [], P = V(), T = V(), S = V(), U = V();
  for (let i = 0; i <= segs; i++) {
    const u = 0.5 - 0.5 * Math.cos(Math.PI * i / segs);   // denser near both ends for round caps
    curve.getPointAt(u, P); curve.getTangentAt(u, T);
    S.crossVectors(up, T); if (S.lengthSq() < 1e-6) S.set(1, 0, 0); S.normalize(); U.crossVectors(T, S).normalize();
    const r = Math.max(0, rFn(u));
    for (let j = 0; j <= rad; j++) {
      const a = j / rad * Math.PI * 2, c = Math.cos(a), s = Math.sin(a) * flat;
      pos.push(P.x + r * (c * S.x + s * U.x), P.y + r * (c * S.y + s * U.y), P.z + r * (c * S.z + s * U.z));
      uv.push(u, j / rad);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
    const a = i * (rad + 1) + j, b = a + rad + 1, c = b + 1, d = a + 1;
    idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  const N = g.attributes.normal;   // weld the seam normals so there is no lighting crease along the belly
  for (let i = 0; i <= segs; i++) { const a = i * (rad + 1), b = a + rad; const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1; N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l); }
  g.userData.curve = curve;
  return g;
}
// rounded ends for a radius profile
const capEnds = (u, e0 = 0.08, e1 = 0.08) => Math.sqrt(clamp01(u / e0)) * Math.sqrt(clamp01((1 - u) / e1));
const bump = (u, c, w) => Math.exp(-(((u - c) / w) ** 2));
// a closed-eye arc (a little U of dark thread), built facing +z
const eyeArc = (r, t) => new THREE.TorusGeometry(r, t, 5, 12, Math.PI).rotateZ(Math.PI);

/* ---------------- texture helpers ---------------- */
const tx = (w, h, draw, o) => core.canvasTex(w, h, draw, o);
function cloneTex(src, rx, ry) {
  const t = src.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  const img = src.image;
  if (img && (img.complete === undefined || img.complete) && (img.width || img.naturalWidth)) t.needsUpdate = true;
  else if (img && img.addEventListener) img.addEventListener('load', () => { t.needsUpdate = true; }, { once: true });
  else { const iv = setInterval(() => { if (src.image && (src.image.width || src.image.naturalWidth)) { t.image = src.image; t.needsUpdate = true; clearInterval(iv); } }, 300); }
  return t;
}
// fur for a tube (see taperTube's UV layout): base colour, a darker spine, a lighter belly, fine strokes along the body,
// optional tabby stripes running from the spine down the flanks.
function furTex(seed, { base, spine, belly, strokes = ['#000'], stripes = null, stripeEvery = 34, bellyW = 0.16, w = 512, h = 256 }) {
  return tx(w, h, (g) => {
    const r = core.rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const band = (y, hh, col, a) => { const gr = g.createLinearGradient(0, y - hh, 0, y + hh); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(0, y - hh, w, hh * 2); g.globalAlpha = 1; };
    if (spine) band(0.75 * h, 0.22 * h, spine, 0.85);
    if (belly) { band(0.25 * h, bellyW * h * 1.6, belly, 1); band(0.25 * h, bellyW * h, belly, 1); }
    if (stripes) {   // tabby: wavy stripes from the spine down both flanks, broken at the belly
      for (let x = r() * stripeEvery; x < w + stripeEvery; x += stripeEvery * (0.75 + r() * 0.5)) {
        g.strokeStyle = stripes; g.lineCap = 'round';
        [[0.75, 0.42], [0.75, 1.08]].forEach(([y0, y1]) => {
          g.lineWidth = 5 + r() * 6; g.globalAlpha = 0.7 + r() * 0.25;
          g.beginPath(); g.moveTo(x, y0 * h);
          const n = 6; for (let k = 1; k <= n; k++) { const t = k / n; g.lineTo(x + Math.sin(t * 5 + x) * 6 + (r() - 0.5) * 6, (y0 + (y1 - y0) * t) * h); }
          g.stroke();
          if (y1 > 1) { g.save(); g.translate(0, -h); g.stroke(); g.restore(); }
        });
        g.globalAlpha = 1;
      }
    }
    // fine fur: short strokes lying along the body
    for (let i = 0; i < 5200; i++) {
      const x = r() * w, y = r() * h, l = 4 + r() * 10;
      g.strokeStyle = strokes[(r() * strokes.length) | 0]; g.globalAlpha = 0.05 + r() * 0.13; g.lineWidth = 0.8 + r() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 3); g.stroke();
    }
    g.globalAlpha = 1;
  });
}
// fur for a sphere head (face = +z = u 0.25): base, optional lighter lower face/muzzle, optional mask and forehead stripes
function headTex(seed, { base, lower = null, cap = null, stripes = null, strokes = ['#000'], w = 256, h = 128 }) {
  return tx(w, h, (g) => {
    const r = core.rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (cap) {   // husky: dark cap and back of the head, white mask round the eyes and down the face
      g.fillStyle = cap; g.fillRect(0, 0, w, h * 0.56);
      g.fillStyle = base;
      g.beginPath(); g.ellipse(0.25 * w, 0.64 * h, 0.17 * w, 0.3 * h, 0, 0, Math.PI * 2); g.fill();     // face mask
      g.beginPath(); g.moveTo(0.25 * w - 9, 0.42 * h); g.lineTo(0.25 * w, 0.16 * h); g.lineTo(0.25 * w + 9, 0.42 * h); g.fill();   // widow's peak
      [-1, 1].forEach(s => { g.beginPath(); g.ellipse(0.25 * w + s * 0.055 * w, 0.44 * h, 0.03 * w, 0.035 * h, 0, 0, Math.PI * 2); g.fill(); });   // brow spots
    }
    if (lower) { const gr = g.createLinearGradient(0, 0.45 * h, 0, 0.75 * h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, lower); g.fillStyle = gr; g.fillRect(0, 0.45 * h, w, 0.55 * h); }
    if (stripes) {   // tabby "M" on the forehead and a few cheek bars
      g.strokeStyle = stripes; g.lineCap = 'round'; g.lineWidth = 3;
      [-0.04, -0.015, 0.015, 0.04].forEach(dx => { g.beginPath(); g.moveTo((0.25 + dx) * w, 0.14 * h); g.lineTo((0.25 + dx * 0.8) * w, 0.36 * h); g.stroke(); });
      for (let k = 0; k < 9; k++) { const x = (0.45 + k * 0.06) * w; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 0.05 * h); g.lineTo(x + 3, 0.42 * h); g.stroke(); }
      [-1, 1].forEach(s => { for (let k = 0; k < 2; k++) { g.lineWidth = 2; g.beginPath(); g.moveTo((0.25 + s * 0.09) * w, (0.5 + k * 0.07) * h); g.lineTo((0.25 + s * 0.16) * w, (0.47 + k * 0.08) * h); g.stroke(); } });
    }
    for (let i = 0; i < 1600; i++) { const x = r() * w, y = r() * h; g.strokeStyle = strokes[(r() * strokes.length) | 0]; g.globalAlpha = 0.05 + r() * 0.12; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2 + r() * 5, y + (r() - 0.5) * 2); g.stroke(); }
    g.globalAlpha = 1;
  });
}
const shadowPlane = (w, d, o = 0.55) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: core.SHADOW_TEX, transparent: true, depthWrite: false, opacity: o }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.renderOrder = 1; return m;
};
// a little self-fill (as if lit by the hall light or the tree's glow) for pieces that stand in dark corners of the room
function fillLight(o, k) {
  o.traverse(m => { if (!m.isMesh || !m.material || m.material.isMeshBasicMaterial || m.material.isShaderMaterial) return;
    [].concat(m.material).forEach(mt => { if (mt.userData.fxFill || !mt.emissive || mt.vertexColors) return; mt.userData.fxFill = 1;
      if (mt.map) { mt.emissiveMap = mt.map; mt.emissive.setRGB(k, k * 0.9, k * 0.8); } else mt.emissive.copy(mt.color).multiplyScalar(k); mt.needsUpdate = true; }); });
}
const castAll = (o, cast = true) => o.traverse(m => { if (m.isMesh && !(m.material && m.material.transparent)) { m.castShadow = cast; m.receiveShadow = true; } });

/* ---------------- ground height (shim: the forest snow drifts are not in the API, so ray-cast them) ---------------- */
const RC = new THREE.Raycaster();
function groundAt(x, z) {
  const room = core.ROOMS && core.ROOMS[curRoom()];
  if (!room || !room.group || curRoom() === 'living' || curRoom() === 'office') return 0;
  RC.set(V(x, 30, z), V(0, -1, 0)); RC.far = 60;
  const hits = RC.intersectObject(room.group, true).filter(h => h.object.isMesh && !h.object.isInstancedMesh && h.point.y < 6 && !(h.object.material && h.object.material.side === THREE.BackSide));
  return hits.length ? Math.max(-2, hits[0].point.y) : 0;
}

// a head built facing +z at the origin: fur parts, white parts, dark features (closed eyes, nose) and pink parts
function headParts(H) {
  const hs = H.r, P = { fur: [ell(hs, hs * 0.9, hs * 1.02, 22, 16)], white: [], dark: [], pink: [] };
  if (H.kind === 'cat') {
    P.white.push(xf(ell(hs * 0.27, hs * 0.22, hs * 0.22), [-hs * 0.2, -hs * 0.3, hs * 0.82]), xf(ell(hs * 0.27, hs * 0.22, hs * 0.22), [hs * 0.2, -hs * 0.3, hs * 0.82]), xf(ell(hs * 0.3, hs * 0.2, hs * 0.22), [0, -hs * 0.5, hs * 0.68]));
    P.pink.push(xf(new THREE.SphereGeometry(1, 10, 8).scale(hs * 0.12, hs * 0.08, hs * 0.07), [0, -hs * 0.12, hs * 1.0]));
    [-1, 1].forEach(s => {
      P.fur.push(xf(new THREE.ConeGeometry(hs * 0.44, hs * 0.78, sg(12)).scale(1, 1, 0.5), [s * hs * 0.52, hs * 0.74, -hs * 0.1], [0, -s * 0.25, -s * 0.36]));
      P.pink.push(xf(new THREE.ConeGeometry(hs * 0.28, hs * 0.52, sg(10)).scale(1, 1, 0.3), [s * hs * 0.53, hs * 0.72, hs * 0.03], [0, -s * 0.25, -s * 0.36]));
    });
  } else {
    const mz = H.muzzle || 1;
    const muzzle = xf(ell(hs * 0.52, hs * 0.44, hs * 0.6 * mz), [0, -hs * 0.32, hs * 0.75 * mz]);
    (H.whiteMuzzle ? P.white : P.fur).push(muzzle);
    if (H.lightMuzzle) P.white.push(xf(ell(hs * 0.46, hs * 0.3, hs * 0.5 * mz), [0, -hs * 0.48, hs * 0.8 * mz]));
    P.dark.push(xf(ell(hs * 0.21, hs * 0.15, hs * 0.14), [0, -hs * 0.17, hs * (0.75 + 0.58 * mz)]));
    P.fur.push(xf(ell(hs * 0.62, hs * 0.3, hs * 0.5), [0, hs * 0.38, hs * 0.38]));   // brow ridge, so the stop between skull and muzzle reads
    if (H.ears === 'prick') [-1, 1].forEach(s => {
      P.fur.push(xf(new THREE.ConeGeometry(hs * 0.34, hs * 0.7, sg(12)).scale(1, 1, 0.45), [s * hs * 0.5, hs * 0.8, -hs * 0.16], [0.15, -s * 0.2, -s * 0.32]));
      P.white.push(xf(new THREE.ConeGeometry(hs * 0.21, hs * 0.46, sg(10)).scale(1, 1, 0.25), [s * hs * 0.5, hs * 0.76, -hs * 0.03], [0.15, -s * 0.2, -s * 0.32]));
    });
    else [-1, 1].forEach(s => P.fur.push(xf(ell(hs * 0.22, hs * 0.66, hs * 0.46), [s * hs * 0.88, -hs * 0.2, -hs * 0.02], [0.12, 0, s * 0.2])));
  }
  [-1, 1].forEach(s => { const d = V(s * 0.42, 0.2, 0.885).normalize(); const p = V(d.x * hs, d.y * hs * 0.9, d.z * hs * 1.02).multiplyScalar(1.01); P.dark.push(aim(eyeArc(hs * (H.kind === 'cat' ? 0.16 : 0.15), hs * 0.036), p, d, s * 0.12)); });
  return P;
}
// the shared tail of every pet builder: one mesh per material, cast shadows, and a breathing/twitch tick
const FEAT_MAT = () => fxStd({ vertexColors: true, roughness: 0.6, envMapIntensity: 0.3 });
function petMeshes(grp, name, parts, mats) {
  if (parts.fur.length) { const m = new THREE.Mesh(merge(parts.fur), mats.fur); m.name = name + '.fur'; grp.add(m); }
  // white, dark and pink details share one vertex-coloured mesh (one draw call)
  const col = { white: mats.whiteHex, dark: 0x1d1512, pink: 0xd99a8e }, f = [];
  ['white', 'dark', 'pink'].forEach(k => (parts[k] || []).forEach(gq => f.push(paint(gq.index ? gq.toNonIndexed() : gq, col[k]))));
  if (f.length) { const m = new THREE.Mesh(merge(f, { color: true }), FEAT_MAT()); m.name = name + '.features'; grp.add(m); }
}
function petTick(body, head, tail, R, phase, twitchAt) {
  return (t) => {
    if (RMF) { body.scale.set(1, 1, 1); if (tail) tail.rotation.set(0, 0, 0); return; }
    const br = Math.sin(1.2 * t + phase);
    body.scale.set(1 + 0.008 * br, 1 + 0.03 * br, 1 + 0.008 * br);   // from a fixed base each frame: never compounds
    if (head) head.position.y = 0.012 * R * br;
    const k = (t + twitchAt) % 8, e = k < 0.7 ? Math.sin(k / 0.7 * Math.PI) : 0;
    if (tail) tail.rotation.y = 0.09 * e * Math.sin(k * 18);
  };
}
const headMatrix = (p, face, roll = 0, pitch = 0) => { DUMMY.position.copy(p); DUMMY.rotation.set(0, 0, 0); DUMMY.scale.set(1, 1, 1); DUMMY.lookAt(p.clone().add(face)); DUMMY.rotateZ(roll); DUMMY.rotateX(pitch); DUMMY.updateMatrix(); return DUMMY.matrix.clone(); };

/* A curled, sleeping animal (cat, husky). Local frame: the curl's centre on the floor at the origin; the body runs
   from the rump round the back to the neck; the head lies in the gap at the front (+z), nose towards the rump (-x). */
function curledPet(sp) {
  const grp = new THREE.Group(); grp.name = sp.name;
  const { a, b, R, flat } = sp;
  const ringPt = (th, k = 1, y = 0) => V(a * k * Math.cos(th), y, b * k * Math.sin(th));
  const th0 = sp.th0 * D2R, th1 = sp.th1 * D2R, yC = R * flat * 0.95;
  const bpts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, th = th0 + (th1 - th0) * t; bpts.push(ringPt(th, 1 - 0.12 * t * t, yC * (1 - 0.1 * t))); }
  const bodyR = u => R * capEnds(u, 0.12, 0.1) * (0.94 + 0.16 * bump(u, 0.15, 0.13) - 0.1 * u);
  const bodyGeo = taperTube(bpts, bodyR, { segs: 48, rad: 16, flat });
  const mats = {
    body: fxStd({ map: sp.bodyTex, roughness: 0.95, envMapIntensity: 0.22 }), fur: fxStd({ map: sp.legTex || sp.tailTex || sp.bodyTex, roughness: 0.95, envMapIntensity: 0.22 }), head: fxStd({ map: sp.headTex, roughness: 0.95, envMapIntensity: 0.22 }),
    whiteHex: sp.whiteCol || 0xf2ece0,
  };
  const body = new THREE.Mesh(bodyGeo, mats.body); body.name = sp.name + '.body'; grp.add(body);
  const st = { fur: [], white: [] };
  // the hind leg: a thigh on the upper flank at the rump, its paw tucked forward along the floor towards the face
  const tTh = th0 + 0.5, thigh = ringPt(tTh, 0.92, yC + R * 0.42);
  st.fur.push(xf(ell(R * 0.55 * (sp.thighK || 1), R * 0.45 * (sp.thighK || 1), R * 0.8 * (sp.thighK || 1)), [thigh.x, thigh.y - R * 0.08, thigh.z], [0, -tTh + Math.PI / 2, 0.2]));
  { const p0 = ringPt(th0 + 0.25, 0.7, R * 0.3), p1 = ringPt(th0 - 0.3, 0.72, R * 0.22);
    st.fur.push(aim(new THREE.CapsuleGeometry(R * 0.25, p0.distanceTo(p1), 4, sg(10)).rotateX(Math.PI / 2), p0.clone().lerp(p1, 0.5), p1.clone().sub(p0).normalize()));
    (sp.whitePaws ? st.white : st.fur).push(xf(ell(R * 0.28, R * 0.22, R * 0.34), [p1.x, p1.y, p1.z])); }
  // head in the gap, on the front paws
  const H = sp.head, hp = ringPt(sp.headTh * D2R, sp.headK, H.y), face = V(...sp.face).normalize();
  const HM = headMatrix(hp, face, sp.roll, sp.pitch);
  const hpx = headParts(H); Object.values(hpx).forEach(l => l.forEach(gq => gq.applyMatrix4(HM)));
  const headFur = new THREE.Mesh(merge(hpx.fur), mats.head); headFur.name = sp.name + '.head'; grp.add(headFur);
  // front paws from the chest, stretched out under the chin
  const sh = ringPt(th1 - 0.2, 0.75, R * 0.3), side = V(-face.z, 0, face.x);
  [-1, 1].forEach(s => {
    const p1 = hp.clone().addScaledVector(face, H.r * 0.7).addScaledVector(side, s * H.r * 0.45); p1.y = R * 0.2;
    const p0 = sh.clone().addScaledVector(side, s * R * 0.35);
    st.fur.push(aim(new THREE.CapsuleGeometry(R * 0.24, p0.distanceTo(p1), 4, sg(10)).rotateX(Math.PI / 2), p0.clone().lerp(p1, 0.5), p1.clone().sub(p0).normalize()));
    (sp.whitePaws ? st.white : st.fur).push(xf(ell(R * 0.28, R * 0.22, R * 0.36), [p1.x, p1.y, p1.z]));
  });
  // tail: from the rump along the floor round the front of the curl, the tip past the nose (lifted over it when T.y > 0)
  const T = sp.tail, tpts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8, th = (T.th0 + (T.th1 - T.th0) * t) * D2R; tpts.push(ringPt(th, T.k0 + (T.k1 - T.k0) * t, T.r0 * 0.9 + (T.y || 0) * Math.sin(t * Math.PI * 0.8))); }
  const pivot = tpts[0].clone();
  const tailGeo = taperTube(tpts, u => (T.r0 + (T.r1 - T.r0) * u) * capEnds(u, 0.03, 0.14) * (T.bushy ? 1 + 0.4 * bump(u, 0.55, 0.3) : 1), { segs: 30, rad: 10, flat: T.flat || 0.9 });
  tailGeo.translate(-pivot.x, -pivot.y, -pivot.z);
  let tail = null;
  if (LOWF && (sp.tailTex || sp.bodyTex) === (sp.legTex || sp.tailTex || sp.bodyTex)) st.fur.push(tailGeo.translate(pivot.x, pivot.y, pivot.z));   // LOW: the tail joins the static mesh (no twitch, one draw call fewer)
  else { tail = new THREE.Mesh(tailGeo, fxStd({ map: sp.tailTex || sp.bodyTex, roughness: 0.95, envMapIntensity: 0.22 })); tail.position.copy(pivot); grp.add(tail); }
  petMeshes(grp, sp.name, { fur: st.fur, white: [...st.white, ...hpx.white], dark: hpx.dark, pink: hpx.pink }, mats);
  castAll(grp);
  return { group: grp, body, head: headFur, tail, tick: petTick(body, null, tail, R, sp.phase || 0, sp.twitchAt || 3), headPos: hp, face, neck: bpts[bpts.length - 1].clone(), curve: bodyGeo.userData.curve, bodyR, flat };
}
/* A dog asleep on its belly with its head resting on its front paws (the golden). Local frame: facing +z, on the floor. */
function restingDog(sp) {
  const grp = new THREE.Group(); grp.name = sp.name;
  const R = sp.R, L = sp.L, yb = R * 0.78;
  const mats = {
    body: fxStd({ map: sp.bodyTex, roughness: 0.95, envMapIntensity: 0.22 }), fur: fxStd({ map: sp.legTex || sp.bodyTex, roughness: 0.95, envMapIntensity: 0.22 }), head: fxStd({ map: sp.headTex, roughness: 0.95, envMapIntensity: 0.22 }),
    whiteHex: sp.whiteCol || 0xe7c690,
  };
  // body: rump at -z, chest at +z, a gentle sag in the middle, lying slightly on one hip (sp.lean)
  const bodyGeo = taperTube([V(0.02, yb * 1.06, -L / 2), V(0.0, yb * 0.95, -L / 6), V(-0.01, yb * 0.97, L / 6), V(0, yb * 1.04, L / 2)],
    u => R * capEnds(u, 0.16, 0.18) * (0.9 + 0.12 * bump(u, 0.18, 0.14) - 0.08 * bump(u, 0.5, 0.18) + 0.1 * bump(u, 0.78, 0.14)), { segs: 40, rad: 18, flat: 0.78 });
  bodyGeo.rotateZ(sp.lean || 0);
  const body = new THREE.Mesh(bodyGeo, mats.body); body.name = sp.name + '.body'; grp.add(body);
  const st = { fur: [], white: [] };
  // folded hind legs: big thighs at the rump sides, hind paws forward along the floor
  [-1, 1].forEach(s => {
    st.fur.push(xf(ell(R * 0.4, R * 0.62, R * 0.86), [s * R * 0.6, R * 0.6, -L * 0.33], [0.3, 0, s * 0.3]));
    const p0 = V(s * R * 0.95, R * 0.2, -L * 0.42), p1 = V(s * R * 1.05, R * 0.17, -L * 0.05);
    st.fur.push(aim(new THREE.CapsuleGeometry(R * 0.2, p0.distanceTo(p1), 4, sg(10)).rotateX(Math.PI / 2), p0.clone().lerp(p1, 0.5), p1.clone().sub(p0).normalize()));
    st.fur.push(xf(ell(R * 0.24, R * 0.18, R * 0.3), [p1.x, p1.y, p1.z + R * 0.08]));
  });
  // front legs straight out in front, paws side by side
  const pawZ = L / 2 + R * 1.45;
  [-1, 1].forEach(s => {
    const p0 = V(s * R * 0.42, R * 0.32, L / 2 - R * 0.2), p1 = V(s * R * 0.36, R * 0.17, pawZ);
    st.fur.push(aim(new THREE.CapsuleGeometry(R * 0.19, p0.distanceTo(p1), 4, sg(10)).rotateX(Math.PI / 2), p0.clone().lerp(p1, 0.5), p1.clone().sub(p0).normalize()));
    st.fur.push(xf(ell(R * 0.24, R * 0.17, R * 0.3), [p1.x, p1.y, p1.z + R * 0.12]));
  });
  // head resting on the paws, chin down, tipped a little to one side
  const H = sp.head, hp = V(0, R * 0.34 + H.r * 0.82, L / 2 + R * 0.62);
  const HM = headMatrix(hp, V(0, -0.05, 1), sp.roll || 0.12, 0.05);
  const hpx = headParts(H); Object.values(hpx).forEach(l => l.forEach(gq => gq.applyMatrix4(HM)));
  const head = new THREE.Mesh(merge(hpx.fur), mats.head); head.name = sp.name + '.head'; grp.add(head);
  // feathered tail curled round along the floor beside the hind leg
  const T = sp.tail; const tpts = [V(0, yb * 1.0, -L / 2 - R * 0.6), V(T.side * R * 0.7, R * 0.3, -L / 2 - R * 1.0), V(T.side * R * 1.5, R * 0.18, -L / 2 - R * 0.2), V(T.side * R * 1.75, R * 0.16, -L * 0.1)];
  const pivot = tpts[0].clone();
  const tailGeo = taperTube(tpts, u => (T.r0 + (T.r1 - T.r0) * u) * capEnds(u, 0.04, 0.16) * (1 + 0.45 * bump(u, 0.5, 0.3)), { segs: 30, rad: 10, flat: 0.75 });
  tailGeo.translate(-pivot.x, -pivot.y, -pivot.z);
  let tail = null;
  if (LOWF) st.fur.push(tailGeo.translate(pivot.x, pivot.y, pivot.z));   // LOW: the tail joins the static mesh
  else { tail = new THREE.Mesh(tailGeo, fxStd({ map: sp.bodyTex, roughness: 0.95, envMapIntensity: 0.22 })); tail.position.copy(pivot); grp.add(tail); }
  petMeshes(grp, sp.name, { fur: st.fur, white: [...st.white, ...hpx.white], dark: hpx.dark, pink: hpx.pink }, mats);
  castAll(grp);
  return { group: grp, body, head, tail, tick: petTick(body, null, tail, R, sp.phase || 0, sp.twitchAt || 3), headPos: hp };
}

/* ---------------- textures and materials shared by the pets ---------------- */
let PETTEX = null;
function petTex() {
  if (PETTEX) return PETTEX;
  PETTEX = {
    tabby: furTex(11, { base: '#8e8172', spine: '#5d5248', belly: '#ece4d6', stripes: '#3b322b', strokes: ['#2d2620', '#c7b9a6', '#6b5f53'] }),
    tabbyHead: headTex(12, { base: '#8e8172', lower: '#efe8dc', stripes: '#3b322b', strokes: ['#2d2620', '#c7b9a6'] }),
    tabbyTail: furTex(13, { base: '#86796a', stripes: '#3b322b', stripeEvery: 46, strokes: ['#2d2620', '#c7b9a6'] }),
    goldenLeg: furTex(23, { base: '#c48d4a', strokes: ['#8a5a26', '#efcf96', '#b98444'] }),
    huskyLeg: furTex(33, { base: '#686d74', strokes: ['#2a2d31', '#c9ccd1', '#8a8f96'] }),
    golden: furTex(21, { base: '#c8914c', spine: '#b07a3a', belly: '#e7c690', strokes: ['#8a5a26', '#efcf96', '#b98444'] }),
    goldenHead: headTex(22, { base: '#c99550', lower: '#e2bb80', strokes: ['#8a5a26', '#efcf96'] }),
    husky: furTex(31, { base: '#7c8189', spine: '#3a3f46', belly: '#f1ede6', bellyW: 0.26, strokes: ['#2a2d31', '#c9ccd1', '#8a8f96'] }),
    huskyHead: headTex(32, { base: '#f1ede6', cap: '#5b6067', strokes: ['#2a2d31', '#c9ccd1'] }),
    ginger: furTex(41, { base: '#d29a5c', spine: '#b8773c', belly: '#f3e1c2', stripes: '#a35f28', stripeEvery: 30, strokes: ['#8f5222', '#f1cf9c'] }),
    gingerHead: headTex(42, { base: '#d39b5e', lower: '#f3e1c2', stripes: '#a35f28', strokes: ['#8f5222', '#f1cf9c'] }),
  };
  return PETTEX;
}
let TARTAN_M = null;
const tartanMat = (rx = 4, ry = 4, extra = {}) => fxStd({ map: cloneTex(core.tartanTex, rx, ry), roughness: 0.92, envMapIntensity: 0.25, ...extra });

/* ================================================================
   (a) Sleeping pets by the fire
   ================================================================ */
// tabby, curled nose to tail (about 15" across)
function makeTabby() {
  const T = petTex();
  return curledPet({ name: 'fx.tabby', a: 0.3, b: 0.27, R: 0.19, flat: 0.74, th0: 118, th1: 410, headTh: 82, headK: 0.6, face: [-1, -0.05, 0.5], roll: 0.32, pitch: 0.1,
    head: { kind: 'cat', r: 0.14, y: 0.14 }, whitePaws: true, bodyTex: T.tabby, headTex: T.tabbyHead, tailTex: T.tabbyTail,
    tail: { th0: 122, th1: 50, k0: 1.06, k1: 1.42, r0: 0.055, r1: 0.035 }, phase: 0.7, twitchAt: 2 });
}
// golden retriever asleep in its bed, head on its paws (about 30" nose to tail)
function makeGolden() {
  const T = petTex();
  return restingDog({ name: 'fx.golden', R: 0.32, L: 1.1, lean: 0.06, roll: 0.14, head: { kind: 'dog', r: 0.23, muzzle: 1.0, ears: 'flop', lightMuzzle: true },
    bodyTex: T.golden, legTex: T.goldenLeg, headTex: T.goldenHead, tail: { side: 1, r0: 0.085, r1: 0.05 }, phase: 2.1, twitchAt: 6 });
}
// husky curled up with its bushy tail over its nose, in a tartan scarf
function makeHusky() {
  const T = petTex();
  const p = curledPet({ name: 'fx.husky', thighK: 0.8, a: 0.44, b: 0.38, R: 0.3, flat: 0.78, th0: 118, th1: 410, headTh: 84, headK: 0.6, face: [-1, -0.05, 0.42], roll: 0.25, pitch: 0.08,
    head: { kind: 'dog', r: 0.21, y: 0.21, muzzle: 0.85, ears: 'prick', whiteMuzzle: true }, whitePaws: true, bodyTex: T.husky, legTex: T.huskyLeg, tailTex: T.huskyLeg, headTex: T.huskyHead,
    tail: { th0: 122, th1: 44, k0: 1.04, k1: 1.32, r0: 0.095, r1: 0.075, bushy: true, flat: 0.8, y: 0.03 }, phase: 4.0, twitchAt: 0 });
  // tartan scarf: a soft band hugging the neck (following the body), its two ends trailing over the shoulder to the floor
  const sc = tartanMat(3, 0.8), pts = [];
  for (let i = 0; i <= 6; i++) pts.push(p.curve.getPointAt(0.8 + 0.1 * i / 6));
  p.group.add(new THREE.Mesh(taperTube(pts, u => (p.bodyR(0.8 + 0.1 * u) + 0.035) * capEnds(u, 0.12, 0.12) ** 0.3, { segs: 12, rad: 18, flat: p.flat }), sc));
  const knot = p.curve.getPointAt(0.84), Tn = p.curve.getTangentAt(0.84), out = V(Tn.z, 0, -Tn.x).normalize();
  if (out.dot(knot) < 0) out.negate();   // the outer flank of the curl
  [[-0.06, 0.15], [0.08, -0.2]].forEach(([o, tw]) => {
    const top = knot.clone().addScaledVector(Tn, o).addScaledVector(out, p.bodyR(0.84) * 0.9).add(V(0, p.bodyR(0.84) * 0.5, 0));
    const bot = top.clone().addScaledVector(out, 0.22).setY(0.02).addScaledVector(Tn, o * 1.5);
    p.group.add(new THREE.Mesh(taperTube([top, top.clone().lerp(bot, 0.5).addScaledVector(out, 0.05), bot], u => 0.055 * (1 + 0.3 * u), { segs: 10, rad: 6, flat: 0.25, up: out }), sc));
  });
  castAll(p.group);
  return p;
}
// rectangular tartan throw (lying flat with soft rumples and a fringe on the short ends)
function makeBlanket(w, d, seed) {
  const r = core.rng(seed), g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, d, sg(30), sg(22)).rotateX(-Math.PI / 2), P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), e = Math.min(w / 2 - Math.abs(x), d / 2 - Math.abs(z));
    P.setY(i, 0.012 + 0.011 * Math.sin(x * 9 + 1.3) * Math.sin(z * 7 + 0.4) + 0.006 * Math.sin(x * 23 + z * 11) - 0.008 * (1 - sst(0, 0.06, e))); }
  geo.computeVertexNormals();
  // fringe on the short ends: thin strands in the same mesh, mapped to a red stripe of the tartan
  const fr = []; [-1, 1].forEach(s => { for (let x = -w / 2 + 0.03; x <= w / 2 - 0.03; x += 0.032) { const q = xf(new THREE.BoxGeometry(0.008, 0.004, 0.07), [x + (r() - 0.5) * 0.008, 0.006, s * (d / 2 + 0.03)], [0, (r() - 0.5) * 0.4, 0]); const uv = q.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.1, 0.1); fr.push(q); } });
  const m = new THREE.Mesh(merge([geo, ...fr]), tartanMat(w * 2.4, d * 2.4, { side: THREE.DoubleSide })); m.receiveShadow = true; g.add(m);
  return g;
}
// oval tartan dog bed: a bolster ring and a cream sherpa cushion
function makeBed(L, W) {
  const g = new THREE.Group();
  const R0 = 0.78, tube = 0.2, sx = (W / 2) / (R0 + tube), sz = (L / 2) / (R0 + tube);
  const bol = new THREE.Mesh(new THREE.TorusGeometry(R0, tube, sg(14), sg(56)).rotateX(Math.PI / 2), tartanMat(14, 1.6));
  bol.scale.set(sx, 0.85, sz); bol.position.y = tube * 0.85; g.add(bol);
  const sherpa = tx(256, 256, (c, w, h) => { c.fillStyle = '#e9dfcb'; c.fillRect(0, 0, w, h); const r = core.rng(5);
    for (let i = 0; i < 2600; i++) { const x = r() * w, y = r() * h, s = 1.5 + r() * 3; c.fillStyle = r() < 0.5 ? 'rgba(255,250,238,.55)' : 'rgba(170,150,120,.35)'; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill(); } }, { repeat: [3, 3] });
  const cush = new THREE.Mesh(new THREE.SphereGeometry(1, sg(32), sg(10), 0, Math.PI * 2, 0, Math.PI / 2), fxStd({ map: sherpa, bumpMap: sherpa, bumpScale: 2, roughness: 1, envMapIntensity: 0.2 }));
  cush.scale.set(R0 * sx * 1.02, 0.12, R0 * sz * 1.02); cush.position.y = 0.03; g.add(cush);
  g.add(shadowPlane(W * 1.25, L * 1.2, 0.5));
  castAll(g); return g;
}
// a little wooden A-frame sign that reads "Nice List" on both faces
function makeNiceSign() {
  const g = new THREE.Group();
  const t = tx(512, 340, (c, w, h) => {
    c.fillStyle = '#efe4cc'; c.fillRect(0, 0, w, h); core.noise(c, w, h, 3000, 0.08, ['#8a6a44', '#ffffff']);
    c.strokeStyle = '#8e1a22'; c.lineWidth = 14; c.strokeRect(16, 16, w - 32, h - 32);
    c.strokeStyle = '#b8893a'; c.lineWidth = 3; c.strokeRect(36, 36, w - 72, h - 72);
    c.fillStyle = '#8e1a22'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'italic 700 104px Georgia, "Times New Roman", serif'; c.fillText('Nice List', w / 2, h * 0.42);
    c.fillStyle = '#1f3a26'; c.font = '600 34px Georgia, serif'; c.fillText('✓  approved by Santa Paws', w / 2, h * 0.7);
    core.drawPaw(c, w * 0.9, h * 0.8, 34, '#b8893a', 0.3); core.drawPaw(c, w * 0.1, h * 0.2, 30, '#b8893a', -0.3);
  }, { clamp: true });
  const face = fxStd({ map: t, roughness: 0.8 });
  const H = 0.62, Wd = 0.62, ang = 0.2, top = H * Math.cos(ang);
  // two boards hinged at the top, leaning out to +z and -z; one merged mesh (the print shows on the outer faces)
  const boards = [1, -1].map(s => { const b = new THREE.BoxGeometry(Wd, H, 0.025).translate(0, -H / 2, 0.013); if (s < 0) b.rotateY(Math.PI); return b.rotateX(-s * ang).translate(0, top, 0); });
  boards.push(new THREE.CylinderGeometry(0.018, 0.018, Wd + 0.04, 8).rotateZ(Math.PI / 2).translate(0, top + 0.01, 0));   // the hinge rod
  g.add(new THREE.Mesh(merge(boards), face));
  const bow = new THREE.Mesh(core.bowGeo({ ribbon: 1.2, span: 4, tail: 3.5, loops: 2, seed: 33 }), tartanMat(1.5, 1.5)); bow.position.set(0, top + 0.02, 0.05); g.add(bow);
  castAll(g); return g;
}

const PETS = { obj: null, tabby: null, golden: null, blanket: null, bed: null, sign: null, room: null };
// placements, chosen from ROOM.fire and the window positions; every animal is >= 3.5 units from the trunk
//   living: the golden's bed under the left window in front of the firebox's back half, the tabby's blanket in front of its front half.
function placePets(room) {
  PETS.room = room; const P = PETS;
  if (room === 'forest') {
    const bn = (core.envx && core.envx.forest && core.envx.forest.bench) || { x: -5.4, z: 0.9, ry: 0.45 };
    const c = Math.cos(bn.ry), s = Math.sin(bn.ry), at = (lx, lz) => [bn.x + lx * c + lz * s, bn.z - lx * s + lz * c];
    const [bx, bz] = at(0.1, 1.05), y = groundAt(bx, bz);
    P.blanket.position.set(bx, y, bz); P.blanket.rotation.y = bn.ry; P.blanket.scale.set(1.45, 1, 1.2);
    P.bed.visible = false;
    const [gx, gz] = at(0.4, 1.0); P.golden.group.position.set(gx, y + 0.02, gz); P.golden.group.rotation.y = bn.ry + Math.PI / 2 + 0.3;
    const [tx2, tz] = at(-0.62, 1.15); P.tabby.group.position.set(tx2, y + 0.02, tz); P.tabby.group.rotation.y = bn.ry - 0.4;
    const [sx2, sz2] = at(1.35, 1.6); P.sign.position.set(sx2, groundAt(sx2, sz2), sz2); P.sign.rotation.y = bn.ry - 0.6;
  } else {
    const F = (ROOM && ROOM.fire) || { x: -5, z: -2.2, w: 3.4, hearth: 1.0 };
    const hx = F.x + F.hearth;   // hearth front edge (x -4.0)
    P.bed.visible = true; P.bed.position.set(hx + 0.96, 0, -3.28); P.bed.rotation.y = 0;
    P.golden.group.position.set(hx + 0.96, 0.09, -3.38); P.golden.group.rotation.y = 0.18;   // head on its paws towards the room
    P.blanket.position.set(hx + 0.57, 0, -1.3); P.blanket.rotation.y = 0.04; P.blanket.scale.set(1, 1, 1);
    P.tabby.group.position.set(hx + 0.56, 0.018, -1.32); P.tabby.group.rotation.y = 0.9;
    P.sign.position.set(-1.95, 0, -4.12); P.sign.rotation.y = -0.35;
  }
  core.shadowsDirty();
}
registerExtra({
  id: 'sleeping_pets', label: 'Sleeping pets by the fire', kind: 'toggle', default: true, rooms: ['living', 'forest'],
  build(c) {
    const g = new THREE.Group(); g.name = 'extra.sleeping_pets';
    PETS.tabby = makeTabby(); PETS.golden = makeGolden();
    PETS.blanket = makeBlanket(1.1, 1.55, 7); PETS.bed = makeBed(2.3, 1.78); PETS.sign = makeNiceSign();
    g.add(PETS.blanket, PETS.bed, PETS.golden.group, PETS.tabby.group, PETS.sign);
    PETS.obj = g; placePets(curRoom()); return g;
  },
  setOn(on, c) { if (on && PETS.obj && PETS.room !== curRoom()) placePets(curRoom()); },
  tick(t, dt, c) { if (PETS.room !== curRoom()) placePets(curRoom()); const tt = FX.freezeT ?? t; PETS.tabby.tick(tt); PETS.golden.tick(tt); },
});

/* ================================================================
   (b) "Letters to Santa Paws" mailbox, and a paw-print trail in the snow
   ================================================================ */
const MAIL = { obj: null, flag: null, flagUp: false, flagA: 0, n: 0, room: null, trail: null, trailMat: null, base: null, mound: null };
const LETTERS = [
  'Dear Santa Paws, I have been a very good dog this year. (Mostly.) Love, Biscuit',
  'Dear Santa Paws, one squeaky bone and a sunny nap spot, please. Love, Maple the cat',
  'Dear Santa Paws, I only chewed ONE stocking. Love, Juniper',
  'Dear Santa Paws, a warm home for the howlidays for every shelter pal, please.',
];
function makeMailbox() {
  const g = new THREE.Group(); g.name = 'extra.mailbox';
  const wood = tx(128, 512, (c, w, h) => { c.fillStyle = '#6e4a2c'; c.fillRect(0, 0, w, h); const r = core.rng(9); for (let i = 0; i < 140; i++) { c.strokeStyle = r() < 0.5 ? 'rgba(40,24,12,.35)' : 'rgba(160,120,80,.25)'; c.lineWidth = 1 + r() * 2; const x = r() * w; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 4, h * 0.3, x - 4, h * 0.6, x + 2, h); c.stroke(); } });
  const woodM = fxStd({ map: wood, roughness: 0.75 });
  const postH = 2.42, bw = 0.464, bh = 0.3, bl = 1.36, br = bw / 2, y0 = postH + 0.05;
  g.add(new THREE.Mesh(merge([new THREE.BoxGeometry(0.22, postH, 0.22).translate(0, postH / 2, 0), new THREE.BoxGeometry(0.36, 0.07, bl * 0.8).translate(0, postH + 0.015, 0.1)]), woodM));
  // a crossed foot for indoors (hidden in the snow, where a snow mound takes over)
  const base = new THREE.Mesh(merge([0, Math.PI / 2].map(a => new THREE.BoxGeometry(0.95, 0.09, 0.2).rotateY(a + Math.PI / 4).translate(0, 0.045, 0))), woodM); g.add(base); MAIL.base = base;
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.45, sg(20), sg(8), 0, Math.PI * 2, 0, Math.PI / 2), fxStd({ color: 0xe9eef6, roughness: 0.9, envMapIntensity: 0.4 })); mound.scale.y = 0.35; g.add(mound); MAIL.mound = mound;
  // the box: a profile (flat sides, round top) extruded along its length, red enamel; the door (front) is hinged at the
  // bottom and dropped open a little, with envelopes poking out. Box and door are one mesh.
  const prof = new THREE.Shape(); prof.moveTo(-br, 0); prof.lineTo(br, 0); prof.lineTo(br, bh); prof.absarc(0, bh, br, 0, Math.PI, false); prof.lineTo(-br, 0);
  const boxG = new THREE.ExtrudeGeometry(prof, { depth: bl, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: sg(20) }).translate(0, y0, -bl / 2);
  const doorM = new THREE.Matrix4().compose(V(0, y0, bl / 2 + 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, 0, 0)), V(1, 1, 1));
  const dG = new THREE.ExtrudeGeometry(prof, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: sg(20) }).applyMatrix4(doorM);
  const red = new THREE.MeshPhysicalMaterial({ color: 0x8e1520, roughness: 0.35, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.7 });
  g.add(new THREE.Mesh(merge([boxG, dG]), red));
  const gold = GOLD();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 14, Math.PI).rotateZ(Math.PI).translate(0, bh + br * 0.6, 0.05).applyMatrix4(doorM), gold));
  const env = tx(512, 320, (c, w, h) => {
    c.fillStyle = '#f4ead6'; c.fillRect(0, 0, w, h); core.noise(c, w, h, 1500, 0.06, ['#a08060']);
    c.strokeStyle = 'rgba(120,90,60,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h * 0.55); c.lineTo(w, 0); c.stroke();
    c.fillStyle = '#8e1a22'; c.beginPath(); c.arc(w / 2, h * 0.55, 34, 0, 7); c.fill(); core.drawPaw(c, w / 2, h * 0.56, 34, '#e9c98a');
    c.fillStyle = '#5a3a22'; c.font = 'italic 34px Georgia, serif'; c.textAlign = 'center'; c.fillText('Santa Paws, North Pole', w / 2, h * 0.86);
    c.fillStyle = '#1f3a26'; c.fillRect(w - 86, 18, 64, 76); c.strokeStyle = '#efe4cc'; c.setLineDash([4, 4]); c.strokeRect(w - 82, 22, 56, 68); c.setLineDash([]); core.drawPaw(c, w - 54, 58, 30, '#efe4cc');
  }, { clamp: true });
  const envs = [[-0.1, 0.16, -0.18, 0.1], [0.04, 0.2, 0.0, -0.06], [0.12, 0.14, 0.15, 0.14]].map(([x, y, rz, ry]) => xf(new THREE.BoxGeometry(0.36, 0.23, 0.008), [x, y0 + y + 0.08, bl / 2 + 0.05], [-0.95, ry, rz]));
  g.add(new THREE.Mesh(merge(envs), fxStd({ map: env, roughness: 0.85 })));
  // "Letters to SANTA PAWS" labels on both sides (one mesh)
  const lab = tx(640, 220, (c, w, h) => {
    c.fillStyle = '#efe4cc'; c.fillRect(0, 0, w, h); core.noise(c, w, h, 1800, 0.07, ['#8a6a44']);
    c.strokeStyle = '#b8893a'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
    c.textAlign = 'center'; c.fillStyle = '#5a3a22'; c.font = 'italic 46px Georgia, serif'; c.fillText('Letters to', w / 2, h * 0.36);
    c.fillStyle = '#8e1a22'; c.font = '700 74px Georgia, "Times New Roman", serif'; c.fillText('SANTA PAWS', w / 2, h * 0.78);
    core.drawPaw(c, 64, h * 0.42, 54, '#1f3a26', -0.3); core.drawPaw(c, w - 64, h * 0.42, 54, '#1f3a26', 0.3);
  }, { clamp: true });
  const labs = [1, -1].map(s => new THREE.PlaneGeometry(bl * 0.72, bl * 0.72 * 220 / 640).rotateY(s * Math.PI / 2).translate(s * (br + 0.017), y0 + bh * 0.62, 0));
  g.add(new THREE.Mesh(merge(labs), fxStd({ map: lab, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })));
  // gold flag on a pivot on the right side: down = along the box, up = standing (one mesh)
  const flag = new THREE.Mesh(merge([new THREE.BoxGeometry(0.025, 0.035, 0.5).translate(0, 0, 0.25), new THREE.BoxGeometry(0.02, 0.15, 0.17).translate(0, 0.06, 0.43), new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12).rotateZ(Math.PI / 2)]), gold);
  flag.position.set(br + 0.04, y0 + bh * 0.5, -bl * 0.32); g.add(flag);
  MAIL.flag = flag;
  // a small tartan bow and a sprig on the post
  const bow = new THREE.Mesh(core.bowGeo({ ribbon: 2.2, span: 7, tail: 7, loops: 2, seed: 5 }), tartanMat(1.5, 1.5)); bow.position.set(0, postH - 0.28, 0.13); g.add(bow);
  g.add(Object.assign(shadowPlane(1.2, 1.2, 0.45), {}));
  castAll(g);
  return g;
}
function setFlag(up) { MAIL.flagUp = up; }
// paw prints in the snow: one merged mesh, each print fades in in turn (a dog trotting to the tree), 12 s loop
function makeTrail() {
  const pawT = tx(128, 128, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); core.drawPaw(c, w / 2, h / 2 + 6, 92, '#fff'); }, { clamp: true, srgb: false });
  const pts = [V(14.2, 0, -11.2), V(10.4, 0, -7.6), V(7.2, 0, -4.2), V(5.3, 0, -1.5), V(4.0, 0, -0.95), V(3.25, 0, -1.25), V(2.7, 0, -1.25)];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), N = 30, L = curve.getLength();
  const geos = [], P = V(), T = V();
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N; curve.getPointAt(u, P); curve.getTangentAt(u, T);
    const side = V(-T.z, 0, T.x).normalize().multiplyScalar((i % 2 ? 1 : -1) * 0.085);
    const x = P.x + side.x, z = P.z + side.z, y = groundAt(x, z) + 0.012;
    const q = new THREE.PlaneGeometry(0.2, 0.2).rotateX(-Math.PI / 2).rotateY(Math.atan2(T.x, T.z) + Math.PI).translate(x, y, z);
    const at = new Float32Array(q.attributes.position.count).fill(i / N * 8.5);
    q.setAttribute('aT', new THREE.BufferAttribute(at, 1)); geos.push(q);
  }
  const geo = core.mergeGeometries(geos, false);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6f84a8, alphaMap: pawT, transparent: true, opacity: 0.8, depthWrite: false, roughness: 1, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -4 });
  const uT = { value: RMF ? 6 : 0 };
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTrailT = uT;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aT; uniform float uTrailT; varying float vTrail;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrail = smoothstep(aT, aT + 0.35, uTrailT) * (1.0 - smoothstep(10.2, 12.0, uTrailT));');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTrail;')
      .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vTrail;');
  };
  mat.customProgramCacheKey = () => 'fx-trail';
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; m.receiveShadow = true; m.name = 'extra.paw_trail'; m.userData.uT = uT;
  return m;
}
function placeMail(room) {
  MAIL.room = room; const g = MAIL.obj;
  if (room === 'forest') {
    const x = 4.35, z = -0.55; g.position.set(x, groundAt(x, z) - 0.03, z); g.rotation.y = -0.9;   // the door faces the camera side, the trail runs past it
    MAIL.base.visible = false; MAIL.mound.visible = true;
    if (!MAIL.trail) { MAIL.trail = makeTrail(); MAIL.holder.add(MAIL.trail); }
    MAIL.trail.visible = true;
  } else {
    // just inside the front doorway, between the door opening and the right wall, door towards the room
    const D = (ROOM && ROOM.door) || { x: 2.9, w: 2.571 };
    g.position.set(Math.min(4.62, D.x + D.w / 2 + 0.42), 0, 8.45); g.rotation.y = Math.PI + 0.35;
    MAIL.base.visible = true; MAIL.mound.visible = false;
    if (MAIL.trail) MAIL.trail.visible = false;   // no prints on the oak floor
  }
  core.shadowsDirty();
}
registerExtra({
  id: 'mailbox', label: 'Santa Paws mailbox & paw trail', kind: 'toggle', default: true, rooms: ['living', 'forest'],
  build(c) {
    const holder = new THREE.Group(); holder.name = 'extra.mailbox_holder'; MAIL.holder = holder;
    MAIL.obj = makeMailbox(); holder.add(MAIL.obj); fillLight(MAIL.obj, 0.16);
    // its own tap target list: taps flip the flag and post a letter; they never select a shopping item
    c.addTapTarget(MAIL.obj, () => {
      setFlag(!MAIL.flagUp);
      c.toast(MAIL.flagUp ? LETTERS[MAIL.n++ % LETTERS.length] : 'Flag down: Santa Paws has collected the letters.', 4200);
    });
    placeMail(curRoom()); return holder;
  },
  setOn(on, c) { if (on && MAIL.obj && MAIL.room !== curRoom()) placeMail(curRoom()); },
  tick(t, dt, c) {
    if (MAIL.room !== curRoom()) placeMail(curRoom());
    const target = MAIL.flagUp ? -Math.PI / 2 : 0;
    if (Math.abs(MAIL.flagA - target) > 1e-3) { MAIL.flagA += (target - MAIL.flagA) * (RMF ? 1 : Math.min(1, dt * 9)); MAIL.flag.rotation.x = MAIL.flagA; if (Math.abs(MAIL.flagA - target) < 0.01) { MAIL.flagA = target; MAIL.flag.rotation.x = target; c.shadowsDirty(); } }
    if (MAIL.trail && MAIL.trail.visible) MAIL.trail.userData.uT.value = RMF ? 6 : ((FX.freezeT ?? t) % 12);
  },
});

/* ================================================================
   (c) Dog-sled Santa crossing the moon (forest only)
   Real low-poly 3D: the team is built with the dogs ahead (+z) of the sleigh and the whole team
   is turned along its path every frame, so the dogs lead from every orbit angle.
   ================================================================ */
const SLED = { obj: null, team: null, legs: null, legPiv: [], trail: null, path: null, last: V(), spawn: 0, head: 0, n: 0 };
function makeSledTeam() {
  const team = new THREE.Group(); team.name = 'fx.sled.team';
  const col = [], gold = [];
  const C = (geo, hex) => col.push(paint(geo.index ? geo.toNonIndexed() : geo, hex));
  // sleigh body: a curled scroll profile extruded across its width
  const pr = new THREE.Shape();
  pr.moveTo(-1.15, 0.22); pr.lineTo(-0.05, 0.22); pr.quadraticCurveTo(0.32, 0.24, 0.36, 0.52); pr.quadraticCurveTo(0.38, 0.7, 0.22, 0.68); pr.quadraticCurveTo(0.12, 0.62, 0.2, 0.55);
  pr.quadraticCurveTo(0.12, 0.45, -0.05, 0.45); pr.lineTo(-0.7, 0.45); pr.quadraticCurveTo(-0.85, 0.45, -0.9, 0.62); pr.lineTo(-1.0, 0.95); pr.quadraticCurveTo(-1.1, 1.08, -1.22, 0.98); pr.lineTo(-1.22, 0.3); pr.quadraticCurveTo(-1.21, 0.22, -1.15, 0.22);
  const sw = 0.56;
  const body = new THREE.ExtrudeGeometry(pr, { depth: sw, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 8 }).rotateY(-Math.PI / 2).translate(sw / 2, 0, 0);
  C(body, 0x8e1520);
  // gold trim: a rolled edge along the top of each side, from the high back round the front scroll
  [-1, 1].forEach(sx => { const e = pr.getPoints(6).filter(p => p.y > 0.4).map(p => V(sx * (sw / 2 + 0.035), p.y + 0.01, p.x)); if (e.length > 3) gold.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(e), 40, 0.022, 5, false)); });
  // runners with a curl at the front, and struts
  [-1, 1].forEach(s => {
    const c = new THREE.CatmullRomCurve3([V(s * 0.24, 0.02, -1.25), V(s * 0.24, 0.0, -0.4), V(s * 0.24, 0.02, 0.3), V(s * 0.24, 0.16, 0.52), V(s * 0.24, 0.32, 0.45), V(s * 0.24, 0.3, 0.33)]);
    gold.push(new THREE.TubeGeometry(c, 30, 0.025, 6, false));
    [-1.0, -0.45, 0.05].forEach(z => gold.push(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6).translate(s * 0.24, 0.12, z)));
  });
  // Santa: red coat with white trim, belt, beard, hat with pom, one arm on the reins
  C(ell(0.22, 0.27, 0.2, 14, 10).translate(0, 0.66, -0.62), 0xa8141e);
  C(new THREE.TorusGeometry(0.205, 0.035, 6, 18).rotateX(Math.PI / 2).translate(0, 0.62, -0.62), 0x1a1210);
  C(new THREE.TorusGeometry(0.18, 0.05, 6, 18).rotateX(Math.PI / 2).translate(0, 0.42, -0.62), 0xf4efe6);
  C(ell(0.11, 0.11, 0.11, 12, 8).translate(0, 1.0, -0.6), 0xe8b896);
  C(ell(0.11, 0.12, 0.08, 12, 8).translate(0, 0.92, -0.53), 0xf4efe6);
  C(new THREE.ConeGeometry(0.1, 0.26, 10).rotateX(-0.6).translate(0, 1.16, -0.68), 0xa8141e);
  C(new THREE.TorusGeometry(0.1, 0.03, 6, 14).rotateX(Math.PI / 2).translate(0, 1.07, -0.62), 0xf4efe6);
  C(ell(0.04, 0.04, 0.04, 8, 6).translate(0, 1.22, -0.83), 0xf4efe6);
  C(new THREE.CapsuleGeometry(0.05, 0.3, 3, 8).rotateX(Math.PI / 2 - 0.5).translate(0.16, 0.74, -0.42), 0xa8141e);
  // the sack of presents behind him (kraft paper, a cream tie)
  C(ell(0.25, 0.27, 0.24, 12, 9).translate(0, 0.72, -1.0), 0xb48a5a);
  C(new THREE.TorusGeometry(0.06, 0.02, 5, 10).rotateX(Math.PI / 2).translate(0, 0.98, -1.0), 0xefe4cc);
  // gangline to the lead dogs, with tug lines
  const lineC = 0x2a1a12;
  C(new THREE.CylinderGeometry(0.012, 0.012, 2.35, 5).rotateX(Math.PI / 2).translate(0, 0.27, 1.6), lineC);
  // six huskies in three pairs
  const dogs = [[-0.2, 0.95], [0.2, 0.95], [-0.2, 1.65], [0.2, 1.65], [-0.2, 2.35], [0.2, 2.35]];
  SLED.legPiv.length = 0;
  dogs.forEach(([x, z], i) => {
    const grey = i % 3 === 1 ? 0x8a6a4a : 0x5d636b;   // one copper husky in the middle pair
    C(new THREE.CapsuleGeometry(0.085, 0.3, 4, 8).rotateX(Math.PI / 2).translate(x, 0.32, z), grey);
    C(ell(0.07, 0.065, 0.16, 8, 6).translate(x, 0.27, z + 0.02), 0xeeeae2);   // white belly
    C(ell(0.075, 0.07, 0.08, 10, 8).translate(x, 0.43, z + 0.25), grey);       // head
    C(ell(0.042, 0.038, 0.07, 8, 6).translate(x, 0.405, z + 0.33), 0xeeeae2);  // muzzle
    C(ell(0.016, 0.014, 0.014, 6, 4).translate(x, 0.415, z + 0.4), 0x111111);  // nose
    [-1, 1].forEach(s => C(new THREE.ConeGeometry(0.028, 0.07, 6).translate(x + s * 0.035, 0.51, z + 0.23), grey));
    C(new THREE.TorusGeometry(0.06, 0.022, 5, 10, Math.PI * 1.3).rotateY(Math.PI / 2).translate(x, 0.43, z - 0.2), grey);   // curled tail
    C(new THREE.TorusGeometry(0.088, 0.016, 5, 12).translate(x, 0.32, z + 0.12), 0x8e1a22);   // red harness
    C(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 4).rotateZ(Math.PI / 2 * Math.sign(x)).rotateY(0).translate(x / 2, 0.29, z - 0.1), lineC);
    [[0.11, 1], [-0.12, -1]].forEach(([dz, ph]) => [-1, 1].forEach(s => SLED.legPiv.push({ p: V(x + s * 0.05, 0.3, z + dz), ph: ph * (s > 0 ? 1 : 0.85) + i * 0.4 })));
  });
  const vc = new THREE.Mesh(merge(col, { color: true }), fxStd({ vertexColors: true, roughness: 0.75, emissive: 0x150a08, envMapIntensity: 0.5 }));
  const gm = new THREE.Mesh(merge(gold), GOLD()); team.add(vc, gm);
  const leg = new THREE.CylinderGeometry(0.02, 0.016, 0.24, 5).translate(0, -0.12, 0);
  const legs = new THREE.InstancedMesh(leg, fxStd({ color: 0x5d636b, roughness: 0.8 }), SLED.legPiv.length); team.add(legs); SLED.legs = legs;
  team.children.forEach(m => { m.castShadow = false; m.frustumCulled = false; });
  team.position.z = 0; return team;
}
function updateLegs(t) {
  const o = DUMMY; SLED.legPiv.forEach((L, i) => {
    o.position.copy(L.p); o.rotation.set(RMF ? 0.15 * L.ph : 0.75 * Math.sin(t * 13 + L.ph * 2.6), 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); SLED.legs.setMatrixAt(i, o.matrix);
  });
  SLED.legs.instanceMatrix.needsUpdate = true;
}
// gold sparkles left behind the sleigh, fading over 2 s
function makeSparkles(n) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3).fill(0), born = new Float32Array(n).fill(-99), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) seed[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aBorn', new THREE.BufferAttribute(born, 1)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uPx: { value: 600 } },
    vertexShader: `attribute float aBorn, aSeed; uniform float uT, uPx; varying float vA;
      void main(){ float age = uT - aBorn; vA = age < 0.0 ? 0.0 : (1.0 - smoothstep(0.0, 2.0, age)) * (0.6 + 0.4 * sin(aSeed * 40.0 + uT * 12.0));
        vec3 p = position + vec3(0.0, -0.18 * age, 0.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.07 + 0.06 * aSeed) * uPx / -mv.z; }`,
    fragmentShader: `varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(2.4, 1.7, 0.6) * a, a); }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 7; return pts;
}
// the path: an arc round the clearing at radius ~24 that crosses the moon as seen from the home view, rising as it goes
function sledPath() {
  const m = ((core.envx && core.envx.forest && core.envx.forest.moon) || V(-0.42, 0.24, -0.88)).clone().normalize();
  const cam = (window.__howl && window.__howl.home && window.__howl.home.pos) ? window.__howl.home.pos.clone() : V(0.4, 3.1, 10.8);
  const D = m.clone().multiplyScalar(90).sub(cam), Q = cam.clone().addScaledVector(D, 34 / D.length());
  const rho = Math.hypot(Q.x, Q.z), ph = Math.atan2(Q.z, Q.x);
  return u => V(rho * Math.cos(ph - 0.55 + 1.1 * u), Q.y - 0.3 + 1.6 * (u - 0.5) + 0.25 * Math.sin(u * Math.PI * 3), rho * Math.sin(ph - 0.55 + 1.1 * u));
}
const SLED_RUN = 8, SLED_CYCLE = 38;
registerExtra({
  id: 'dog_sled', label: 'Dog-sled Santa', kind: 'toggle', default: true, rooms: ['forest'],
  build(c) {
    const g = new THREE.Group(); g.name = 'extra.dog_sled';
    SLED.team = makeSledTeam(); g.add(SLED.team);
    SLED.trail = makeSparkles(LOWF ? 120 : 200); g.add(SLED.trail);
    SLED.path = sledPath(); SLED.obj = g; return g;
  },
  tick(t, dt, c) {
    const tt = FX.freezeT ?? t;
    let u;
    if (FX.freezeSled != null) u = FX.freezeSled;
    else if (RMF) u = 0.42;   // reduced motion: parked across the moon (as seen from the home view), no movement
    else { const k = (tt + 26) % SLED_CYCLE; u = k < SLED_RUN ? k / SLED_RUN : -1; }
    const tm = SLED.team; tm.visible = u >= 0;
    SLED.trail.material.uniforms.uT.value = tt;
    { const v = new THREE.Vector2(); c.renderer.getDrawingBufferSize(v); SLED.trail.material.uniforms.uPx.value = v.y / (2 * Math.tan(c.camera.fov * Math.PI / 360)); }
    if (u < 0) return;
    const p = SLED.path(u), ahead = SLED.path(Math.min(1, u + 0.01)), behind = SLED.path(Math.max(0, u - 0.01));
    tm.position.copy(p); tm.lookAt(u < 0.99 ? ahead : p.clone().add(p.clone().sub(behind)));   // +z (the dogs) along the direction of travel
    tm.updateMatrixWorld(true);
    updateLegs(RMF ? 0 : tt);
    if (!RMF && FX.freezeSled == null) {   // spawn sparkles at the back of the sleigh
      const A = SLED.trail.geometry.attributes, n = A.aBorn.count; SLED.spawn += dt * 28;
      const back = V(0, 0.15, -1.25).applyMatrix4(tm.matrixWorld);
      while (SLED.spawn >= 1) { SLED.spawn -= 1; const i = SLED.n++ % n; A.position.setXYZ(i, back.x + (Math.random() - 0.5) * 0.25, back.y + (Math.random() - 0.5) * 0.2, back.z + (Math.random() - 0.5) * 0.25); A.aBorn.setX(i, tt); }
      A.position.needsUpdate = true; A.aBorn.needsUpdate = true;
    }
  },
});

/* ================================================================
   (d) Party antlers on the plush pets (off by default)
   Shim: the API has no list of plush reliefs, so this reads tree.js's `cards` (photo reliefs, each a
   group with userData.relief = {name, w, h, dy}) and parents a set of antlers to each plush one.
   ================================================================ */
// head-top anchor on each cutout: u, v (0..1 from the top-left of the image) and head width as a fraction of the image width
const HEAD = {
  golden_scarf: [0.49, 0.06, 0.5], golden_tree: [0.49, 0.06, 0.5], golden_aurora: [0.5, 0.05, 0.5],
  cat_fluffy: [0.29, 0.1, 0.4], cat_miyoni: [0.5, 0.2, 0.56], tabby_cat_s: [0.62, 0.24, 0.5], tabby_mini_s: [0.45, 0.12, 0.48],
};
const ANT = { list: [], geo: null, bells: null, mat: null, gold: null, on: false, scan: 0 };
function antlerGeos() {
  if (ANT.geo) return;
  // built for a head 1 unit wide, the band's top at the origin, in the card's plane (x right, y up), centred in depth
  const felt = [], bells = [];
  const band = new THREE.TorusGeometry(0.5, 0.045, 6, 22, Math.PI).translate(0, -0.47, 0);
  felt.push(paint(band.toNonIndexed(), 0x8e1a22));
  [-1, 1].forEach(s => {
    const a = 0.62, bx = s * 0.5 * Math.sin(a), by = 0.5 * Math.cos(a) - 0.47;
    const main = new THREE.CatmullRomCurve3([V(bx, by - 0.02, 0), V(bx + s * 0.08, by + 0.25, 0), V(bx + s * 0.24, by + 0.5, 0.02), V(bx + s * 0.22, by + 0.72, 0)]);
    felt.push(paint(new THREE.TubeGeometry(main, 14, 0.06, 7, false).toNonIndexed(), 0x8a5a34));
    felt.push(paint(new THREE.SphereGeometry(0.06, 8, 6).translate(bx + s * 0.22, by + 0.72, 0).toNonIndexed(), 0x8a5a34));
    [[0.35, 0.22, 0.12], [0.6, -0.16, 0.2]].forEach(([u, dx, dy]) => {
      const p = main.getPointAt(u), q = p.clone().add(V(s * dx, 0.12 + dy, 0));
      felt.push(paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p, p.clone().lerp(q, 0.5).add(V(0, 0.03, 0)), q]), 8, 0.045, 6, false).toNonIndexed(), 0x8a5a34));
      felt.push(paint(new THREE.SphereGeometry(0.045, 8, 6).translate(q.x, q.y, q.z).toNonIndexed(), 0x8a5a34));
    });
    bells.push(new THREE.SphereGeometry(0.075, 10, 8).translate(bx + s * 0.02, by - 0.05, 0.06));
    felt.push(paint(new THREE.TorusGeometry(0.03, 0.01, 4, 8).translate(bx + s * 0.02, by + 0.03, 0.06).toNonIndexed(), 0x7a5a2c));
  });
  ANT.geo = merge(felt, { color: true }); ANT.bells = merge(bells);
  ANT.mat = fxStd({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.2 }); ANT.gold = GOLD();
}
const inScene = o => { for (let x = o; x; x = x.parent) if (x === scene) return true; return false; };
// the real head top: scan the cutout's alpha down the head's columns, starting just above the table's hint (so a raised tail is skipped)
const HEAD_TOP = {};
function headTop(name) {
  if (HEAD_TOP[name]) return HEAD_TOP[name].v;
  HEAD_TOP[name] = { v: null };
  const src = typeof CUT !== 'undefined' && CUT[name] && CUT[name].src; if (!src) { HEAD_TOP[name].v = HEAD[name][1]; return null; }
  const img = new Image();
  img.onload = () => {
    try {
      const W = 160, H = Math.round(160 * img.height / img.width), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d'); g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
      const [u, v, s] = HEAD[name], tops = [];
      for (let du = -0.25; du <= 0.25; du += 0.125) {
        const x = Math.round((u + du * s) * (W - 1));
        for (let y = Math.max(0, Math.round((v - 0.08) * H)); y < H * 0.6; y++) if (d[(y * W + x) * 4 + 3] > 140) { tops.push(y / H); break; }
      }
      tops.sort((a, b) => a - b);
      HEAD_TOP[name].v = tops.length ? tops[Math.floor(tops.length / 2)] : v;
    } catch (e) { HEAD_TOP[name].v = HEAD[name][1]; }
  };
  img.onerror = () => { HEAD_TOP[name].v = HEAD[name][1]; };
  img.src = src; return null;
}
function fitAntlers() {
  const list = (typeof cards !== 'undefined' && Array.isArray(cards)) ? cards : [];
  let added = 0;
  list.forEach(cg => {
    const RL = cg.userData && cg.userData.relief; if (!RL || !HEAD[RL.name] || cg.userData.fxAntler || !inScene(cg)) return;
    const vTop = headTop(RL.name); if (vTop == null) return;   // the scan is still loading: the next pass fits it
    antlerGeos();
    const [u, , s] = HEAD[RL.name], hw = s * RL.w;
    const a = new THREE.Group(); a.name = 'fx.antlers';
    a.add(new THREE.Mesh(ANT.geo, ANT.mat), new THREE.Mesh(ANT.bells, ANT.gold));
    a.position.set((u - 0.5) * RL.w, RL.dy + (0.5 - vTop) * RL.h - hw * 0.07, 0); a.scale.setScalar(hw);   // the band sits a little into the fur
    a.children.forEach(m => { m.castShadow = true; m.raycast = () => {}; });   // never intercept taps meant for the plush
    a.visible = ANT.on; cg.add(a); cg.userData.fxAntler = a; ANT.list.push(a); added++;
  });
  if (added) core.shadowsDirty();
}
registerExtra({
  id: 'party_antlers', label: 'Party antlers on the plush', kind: 'toggle', default: false,
  build() { const g = new THREE.Group(); g.name = 'extra.party_antlers'; return g; },
  setOn(on, c) { ANT.on = on; if (on) fitAntlers(); ANT.list.forEach(a => { a.visible = on; }); c.shadowsDirty(); },
  tick(t, dt) { ANT.scan -= dt; if (ANT.scan <= 0) { ANT.scan = 0.5; fitAntlers(); } },   // plush rebuilt by an option swap get antlers too
});

/* ================================================================
   (e1) A husky in a tartan scarf napping on a paw-print doormat by the front door (living room)
   ================================================================ */
const HUSKY = { obj: null, pet: null };
function makeDoormat() {
  const t = tx(512, 320, (c, w, h) => {
    c.fillStyle = '#a77d4c'; c.fillRect(0, 0, w, h); const r = core.rng(17);
    for (let i = 0; i < 9000; i++) { c.fillStyle = r() < 0.5 ? 'rgba(80,52,24,.35)' : 'rgba(220,180,120,.3)'; c.fillRect(r() * w, r() * h, 1 + r() * 2, 4 + r() * 6); }
    c.strokeStyle = '#8e1a22'; c.lineWidth = 16; c.strokeRect(20, 20, w - 40, h - 40);
    [[0.25, 0.32, -0.4], [0.4, 0.62, -0.2], [0.57, 0.36, 0.1], [0.73, 0.66, 0.3]].forEach(([x, y, a]) => core.drawPaw(c, x * w, y * h, 62, '#1f3a26', a + Math.PI / 2));
  });
  const g = new THREE.Group();
  const top = fxStd({ map: t, bumpMap: t, bumpScale: 1.5, roughness: 1 }), edge = fxStd({ color: 0x7a5530, roughness: 1 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.03, 1.1), [edge, edge, top, edge, edge, edge]);
  m.position.y = 0.015; m.receiveShadow = true; g.add(m); g.add(shadowPlane(2.0, 1.3, 0.35));
  return g;
}
registerExtra({
  id: 'husky_door', label: 'Husky napping by the door', kind: 'toggle', default: !LOWF, rooms: ['living'],
  build() {
    const g = new THREE.Group(); g.name = 'extra.husky_door';
    const D = (ROOM && ROOM.door) || { x: 2.9 };
    const mat = makeDoormat(); g.add(mat);
    HUSKY.pet = makeHusky(); HUSKY.pet.group.position.set(0, 0.03, 0); HUSKY.pet.group.rotation.y = 0.5; g.add(HUSKY.pet.group);
    g.position.set(D.x - 0.15, 0, 8.25); g.rotation.y = Math.PI + 0.1;   // the face towards the room
    fillLight(g, 0.22); HUSKY.obj = g; return g;
  },
  tick(t) { HUSKY.pet.tick(FX.freezeT ?? t); },
});

/* ================================================================
   (e2) A ginger kitten in a play bow, batting a gold bauble back and forth (living room)
   ================================================================ */
const KIT = { obj: null, paw: null, bauble: null, tail: null, body: null };
function makeKitten() {
  const T = petTex(), g = new THREE.Group(); g.name = 'extra.kitten';
  const furM = fxStd({ map: T.ginger, roughness: 0.95, envMapIntensity: 0.22 }), headM = fxStd({ map: T.gingerHead, roughness: 0.95, envMapIntensity: 0.22 });
  const cream = fxStd({ color: 0xf3e1c2, roughness: 0.95, envMapIntensity: 0.2 }), dark = fxStd({ color: 0x1d1512, roughness: 0.3, envMapIntensity: 0.6 }), pinkM = fxStd({ color: 0xd99a8e, roughness: 0.7 });
  // play bow: rump up, chest low, facing +z
  const bodyG = taperTube([V(0, 0.27, -0.24), V(0, 0.24, -0.1), V(0, 0.17, 0.06), V(0, 0.13, 0.15)], u => 0.105 * capEnds(u, 0.12, 0.14) * (1 + 0.15 * bump(u, 0.2, 0.15)), { segs: 28, rad: 14, flat: 0.92 });
  const body = new THREE.Mesh(bodyG, furM); g.add(body); KIT.body = body;
  const hs = 0.09, hp = V(0, 0.17, 0.25);
  const head = [ell(hs, hs * 0.9, hs, 18, 12)], wh = [], dk = [], pk = [];
  [-1, 1].forEach(s => {
    head.push(xf(new THREE.ConeGeometry(hs * 0.45, hs * 0.8, sg(10)).scale(1, 1, 0.5), [s * hs * 0.5, hs * 0.8, -hs * 0.05], [0, -s * 0.2, -s * 0.32]));
    pk.push(xf(new THREE.ConeGeometry(hs * 0.28, hs * 0.55, sg(8)).scale(1, 1, 0.3), [s * hs * 0.5, hs * 0.76, hs * 0.07], [0, -s * 0.2, -s * 0.32]));
    // open eyes looking down at the bauble, with a catchlight
    const d = V(s * 0.4, 0.12, 0.91).normalize(), p = d.clone().multiplyScalar(hs * 0.97);
    dk.push(xf(ell(hs * 0.17, hs * 0.2, hs * 0.1), [p.x, p.y, p.z])); wh.push(xf(ell(hs * 0.05, hs * 0.05, hs * 0.03), [p.x + hs * 0.04, p.y + hs * 0.06, p.z + hs * 0.07]));
    wh.push(xf(ell(hs * 0.26, hs * 0.2, hs * 0.2), [s * hs * 0.2, -hs * 0.32, hs * 0.82]));
  });
  pk.push(xf(ell(hs * 0.11, hs * 0.08, hs * 0.07), [0, -hs * 0.14, hs * 1.0]));
  const H = new THREE.Group(); H.position.copy(hp); H.rotation.x = 0.3; g.add(H);
  H.add(new THREE.Mesh(merge(head), headM), new THREE.Mesh(merge(wh), cream), new THREE.Mesh(merge(dk), dark), new THREE.Mesh(merge(pk), pinkM));
  // haunches and hind paws, the left forepaw planted, the right one raised to bat (pivot at the shoulder)
  const st = [];
  [-1, 1].forEach(s => { st.push(xf(ell(0.06, 0.085, 0.1), [s * 0.07, 0.15, -0.2], [0.3, 0, 0])); st.push(xf(ell(0.035, 0.03, 0.07), [s * 0.07, 0.03, -0.12])); });
  st.push(aim(new THREE.CapsuleGeometry(0.028, 0.16, 3, sg(8)).rotateX(Math.PI / 2), V(-0.06, 0.07, 0.2), V(0, -0.35, 1).normalize()));
  g.add(new THREE.Mesh(merge(st), furM));
  const pw = []; pw.push(xf(ell(0.035, 0.026, 0.045), [-0.06, 0.02, 0.29]));
  g.add(new THREE.Mesh(merge(pw), cream));
  const paw = new THREE.Group(); paw.position.set(0.06, 0.14, 0.13); g.add(paw); KIT.paw = paw;
  paw.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.027, 0.15, 3, sg(8)).rotateX(Math.PI / 2).translate(0, 0, 0.1), furM));
  const pt = new THREE.Mesh(ell(0.034, 0.026, 0.042), cream); pt.position.z = 0.19; paw.add(pt);
  // tail up with a hooked tip, swishing
  const tl = new THREE.Group(); tl.position.set(0, 0.28, -0.26); g.add(tl); KIT.tail = tl;
  tl.add(new THREE.Mesh(taperTube([V(0, 0, 0), V(0, 0.12, -0.06), V(0, 0.3, -0.05), V(0.03, 0.38, 0.03)], u => 0.026 * (1 - 0.3 * u) * capEnds(u, 0.02, 0.1), { segs: 20, rad: 8, up: V(0, 0, 1) }), fxStd({ map: T.ginger, roughness: 0.95, envMapIntensity: 0.22 })));
  // a red collar with a tiny gold bell
  const col = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 5, 18), fxStd({ color: 0x8e1a22, roughness: 0.6 })); col.position.set(0, 0.17, 0.16); col.rotation.x = -0.5; g.add(col);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), GOLD()); bell.position.set(0, 0.11, 0.2); g.add(bell);
  // the bauble: gold, with a cap and loop, rolling on the floor in front of the kitten
  const b = new THREE.Group(); KIT.bauble = b; g.add(b);
  const ball = new THREE.Group(); b.add(ball);
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, sg(24), sg(16)), fxStd({ color: 0xc89b4a, metalness: 1, roughness: 0.22, envMapIntensity: 1.1 })));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.04, 12), fxStd({ color: 0x9a7a3a, metalness: 1, roughness: 0.4, envMapIntensity: 0.9 })); cap.position.y = 0.11; ball.add(cap);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.004, 5, 12), cap.material); loop.position.y = 0.14; ball.add(loop);
  const rib = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 24).rotateY(Math.PI / 2), tartanMat(2, 0.5)); ball.add(rib);
  b.position.set(0, 0.1, 0.42);
  g.add(shadowPlane(0.7, 0.9, 0.45)); const bs = shadowPlane(0.28, 0.28, 0.5); b.userData.sh = bs; g.add(bs);
  castAll(g); return g;
}
// one 3.6 s loop: bat out (bauble rolls away), wait, hook it back (rolls back)
function kittenPose(t) {
  const k = RMF ? 0.3 : t % 3.6;
  const swipe = (c, w) => { const x = (k - c) / w; return x > 0 && x < 1 ? Math.sin(x * Math.PI) : 0; };
  const out = swipe(0.1, 0.45), back = swipe(1.9, 0.6);
  KIT.paw.rotation.set(-0.9 * out - 0.5 * back + (RMF ? -0.7 : 0), 0.35 * out - 0.3 * back, 0);
  // bauble distance from the paw: eased out after the bat, eased back after the hook
  const d0 = 0.42, d1 = 0.78;
  const e = k < 0.3 ? 0 : k < 1.6 ? sst(0.3, 1.6, k) : k < 2.2 ? 1 : k < 3.2 ? 1 - sst(2.2, 3.2, k) : 0;
  const z = d0 + (d1 - d0) * e;
  KIT.bauble.position.z = z; KIT.bauble.children[0].rotation.x = z / 0.1;   // rolls without slipping
  KIT.bauble.userData.sh.position.set(0, 0.007, z);
  KIT.tail.rotation.set(0, 0, RMF ? 0.15 : 0.35 * Math.sin(t * 2.3));
  KIT.body.scale.y = 1 + (RMF ? 0 : 0.02 * Math.sin(t * 3.1));
}
registerExtra({
  id: 'kitten_bauble', label: 'Kitten batting a bauble', kind: 'toggle', default: !LOWF, rooms: ['living'],
  build() {
    const g = makeKitten();
    // under the right window, beside the tree (r ~ 4.6, behind the basket's line of sight), facing across the room
    const W = (ROOM && ROOM.windows && ROOM.windows[1]) || { x: 3.3 };
    g.scale.setScalar(1.25); g.position.set(W.x + 0.55, 0, -3.15); g.rotation.y = -2.2; fillLight(g, 0.1); KIT.obj = g; kittenPose(0); return g;
  },
  tick(t) { kittenPose(FX.freezeT ?? t); },
});

// debug and render hooks
FX.make = { makeTabby, makeGolden, makeHusky, makeKitten, makeMailbox, makeSledTeam, makeBed, makeBlanket, makeNiceSign };
try { if (window.__howl) window.__howl.funx = FX; } catch (e) {}
FX.pets = PETS; FX.mail = MAIL; FX.sled = SLED; FX.antlers = ANT; FX.kitten = KIT; FX.husky = HUSKY; FX.setFlag = setFlag;
queueMicrotask(() => { try { if (window.__howl) window.__howl.funx = FX; } catch (e) {} });
}
