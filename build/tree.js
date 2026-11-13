import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ITEMS = window.HOWL_ITEMS;
const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const BUDGET = 2000;
const money = n => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ABOUT = "Pets are family, and nothing says home for the holidays like a wagging tail or a purring lap. Our tree celebrates them with golden retrievers, tabby kittens, paw-print ornaments, doghouses and bones, wrapped in tartan and velvet ribbon. A cozy gift basket with local pet-store gift cards waits underneath for the winning bidder's best friend.";

// Extra copy for the selection card
const DIY_HOW = {
  paw_disc: 'Paint the 3" wood rounds cream with a thin gold rim, stamp a black paw in the centre, sprinkle black glitter on the wet paint, thread a gold cord through the hole and wire a mini velvet bow on top.',
  bones: 'Paint the wooden bones biscuit-cream on both sides, dry-brush a little tan on the edges, and hang them from the pre-drilled hole with gold cord.',
  doghouse: 'Paint the birdhouse walls barn-red with darker plank lines, the roof cream, paint an arch around the round hole in dark brown with cream trim, and stamp a cream paw on the gable.',
  topper: 'Tie a four-loop bow with two long streamers from the 2.5" paw-print burlap ribbon (the wired edge holds the loops) and zip-tie it to the top.',
};
const NOT_ON_TREE = {
  paint: { note: 'Used to paint the DIY paw discs, bones and doghouses, which are highlighted now.', show: ['paw_disc', 'bones', 'doghouse'] },
  paw_stamp: { note: 'Used for the paws on the DIY discs and doghouses, which are highlighted now.', show: ['paw_disc', 'doghouse'] },
  floral_wire: { note: 'Wraps every ornament, bow and pick to the branches so nothing falls off in transit.', show: [] },
};
const STATUS = { est: 'Estimated price', listed: 'Price as listed when checked', face: 'Face value' };

/* ---------------- Panel ---------------- */
document.getElementById('about').textContent = ABOUT;
const subtotal = ITEMS.reduce((s, i) => s + i.total, 0);
const taxable = ITEMS.filter(i => i.id !== 'gift_card').reduce((s, i) => s + i.total, 0);
const gst = Math.round(taxable * 0.05 * 100) / 100;
const grand = Math.round((subtotal + gst) * 100) / 100;
const SECTIONS = [...new Set(ITEMS.map(i => i.section))];
const SEC_COLORS = ['#2E7D5B', '#B3263A', '#C9962E', '#7E6A55', '#5A7FA6'];
const secTotal = s => ITEMS.filter(i => i.section === s).reduce((a, i) => a + i.total, 0);

const budgetEl = document.getElementById('budget');
budgetEl.innerHTML = `
  <div class="big"><b>${money(grand)}</b><span>of ${money(BUDGET)} incl. GST · ${money(BUDGET - grand)} left</span></div>
  <div class="meter" role="img" aria-label="Spend by section">${SECTIONS.map((s, k) => `<i style="width:${(secTotal(s) / BUDGET * 100).toFixed(2)}%;background:${SEC_COLORS[k]}"></i>`).join('')}<i style="width:${(gst / BUDGET * 100).toFixed(2)}%;background:#8C8C8C"></i></div>
  <div class="legend">${SECTIONS.map((s, k) => `<span style="--c:${SEC_COLORS[k]}">${s}</span>`).join('')}<span style="--c:#8C8C8C">GST ${money(gst)}</span></div>`;

const listEl = document.getElementById('list');
listEl.innerHTML = SECTIONS.map(s => `
  <h3>${s}<span>${money(secTotal(s))}</span></h3>
  ${ITEMS.filter(i => i.section === s).map(i => `
    <div class="item${NOT_ON_TREE[i.id] ? ' nov' : ''}${i.img ? ' has-thumb' : ''}" data-id="${i.id}" tabindex="0" role="button" aria-label="Show ${i.name.replace(/"/g, '&quot;')} on the tree">
      ${i.img ? `<img class="thumb" src="${i.img}" alt="" loading="lazy">` : ''}<div class="nm">${i.name}</div>
      <div class="tot">${money(i.total)}</div>
      <div class="meta">${i.diy ? '<span class="badge diy">DIY</span>' : ''}<span>${i.diy ? 'makes ' + i.made : (i.qty + ' × ' + money(i.price))}</span>
        <a href="${i.url}" target="_blank" rel="noopener">${i.store.replace(/ \(.*\)$/, '').replace(/, South Edmonton.*$/, '')} ↗</a></div>
    </div>`).join('')}`).join('');

/* ================================================================
   Photo-real scene.
   - Tree: thousands of alpha-cut pine-branch cards (needles drawn on canvas).
   - Ornaments & under-tree items: background-removed cutouts of the REAL
     listing photos (data/cutouts), shown as camera-facing sprites at their
     real-world size (1 scene unit = 14 in; tree = 7.5 ft).
   - Ribbon, gift wrap, blanket, wicker: textures cropped from the real
     product photos.
   ================================================================ */
const CUT = window.HOWL_CUTS;             // name -> { src, w, h }
const IN = 1 / 14;                        // inches -> scene units

const canvas = document.getElementById('scene');
const stage = canvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 200);
const HOME_POS = new THREE.Vector3(0, 4.3, 15.2);
const HOME_TARGET = new THREE.Vector3(0, 3.6, 0);
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME_TARGET);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 1.6, maxDistance: 22, maxPolarAngle: Math.PI * 0.53, minPolarAngle: Math.PI * 0.12, autoRotate: true, autoRotateSpeed: 0.6, enablePan: false });

// warm living-room light
scene.add(new THREE.HemisphereLight(0xffe2bd, 0x1a100a, 0.55));
const key = new THREE.DirectionalLight(0xffdcb0, 1.3);
key.position.set(5, 10, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 9, bottom: -1, near: 1, far: 30 }); key.shadow.bias = -0.0006;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fb8ff, 0.25); rim.position.set(-6, 6, -7); scene.add(rim);
const glow = new THREE.PointLight(0xffb060, 5, 7, 1.5); glow.position.set(0, 3.4, 0.6); scene.add(glow);
const glow2 = new THREE.PointLight(0xffb060, 3, 5, 1.6); glow2.position.set(0, 1.2, 1.8); scene.add(glow2);

/* ---------------- Helpers ---------------- */
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = rng(20261203);
const R = (a, b) => a + (b - a) * rand();
const pickOne = arr => arr[(rand() * arr.length) | 0];

const loader = new THREE.TextureLoader();
const texCache = {};
function photoTex(name, repeat) {
  const key = name + (repeat ? repeat.join() : '');
  if (texCache[key]) return texCache[key];
  const t = loader.load(CUT[name].src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return (texCache[key] = t);
}

const itemMats = {};
function mat(id, MatClass, params) { const m = new MatClass(params); if (id) (itemMats[id] ||= []).push(m); return m; }
const pickables = [];
const instancesOf = {};
function addInstancePos(id, v) { (instancesOf[id] ||= []).push(v.clone()); }
function tag(obj, id) { obj.traverse(o => { if (o.isMesh || o.isSprite) { o.userData.itemId = id; pickables.push(o); if (o.isMesh) o.castShadow = true; } }); }

// Real-photo cutout as a sprite. heightIn = real height in inches. anchor: 'top' (hangs), 'bottom' (sits), 'center'.
const spriteMats = {};
const WARM = new THREE.Color(0.93, 0.86, 0.76); // match the warm room light
function cutout(name, id, heightIn, pos, { anchor = 'top', tint = WARM, widthIn = null } = {}) {
  const c = CUT[name];
  let m = spriteMats[name + tint.getHexString()];
  if (!m) m = spriteMats[name + tint.getHexString()] = new THREE.SpriteMaterial({ map: photoTex(name), color: tint, alphaTest: 0.35, transparent: true, depthWrite: true, toneMapped: false });
  const s = new THREE.Sprite(m);
  const h = heightIn * IN, w = widthIn ? widthIn * IN : h * c.w / c.h;
  s.scale.set(w, widthIn ? w * c.h / c.w : h, 1);
  s.center.set(0.5, anchor === 'top' ? 1 : anchor === 'bottom' ? 0 : 0.5);
  s.position.copy(pos); scene.add(s);
  s.userData.itemId = id; pickables.push(s); addInstancePos(id, pos);
  return s;
}

/* ---------------- Tree: alpha-cut pine branch cards ---------------- */
const Y0 = 0.9, YTOP = 7.3, RB = 2.3;   // 7.5 ft Wimberley Pine, ~55" wide
const rAt = y => RB * Math.pow(Math.max(0, 1 - (y - Y0) / (YTOP - Y0)), 0.95);
const treeGroup = new THREE.Group(); scene.add(treeGroup);

const NEEDLE = canvasTex(256, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const greens = ['#16331f', '#1c3e27', '#21482d', '#285636', '#2f6140', '#3a6e49', '#4a7d55'];
  const twig = (x0, y0, x1, y1, len, n, lw) => {
    g.strokeStyle = '#3b2e1e'; g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    for (let i = 0; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      for (const side of [-1, 1]) {
        const a = ang + side * (0.55 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.2;
        const L = len * (0.75 + Math.random() * 0.45) * (0.65 + 0.35 * (1 - t * 0.6));
        g.strokeStyle = greens[Math.min(greens.length - 1, ((Math.random() * 4) | 0) + (t > 0.7 ? 3 : 0))];
        g.lineWidth = 1.6 + Math.random() * 1.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
      }
    }
  };
  twig(128, 505, 128, 18, 44, 150, 5);                                    // main stem (base at bottom)
  [[128, 420, 52, 260], [128, 400, 206, 250], [128, 300, 66, 150], [128, 280, 192, 140], [128, 190, 88, 70], [128, 175, 170, 66]]
    .forEach(([a, b, c, d]) => twig(a, b, c, d, 30, 55, 3));
}, { srgb: true });
NEEDLE.wrapS = NEEDLE.wrapT = THREE.ClampToEdgeWrapping;

{
  const a = new THREE.PlaneGeometry(0.5, 1); a.translate(0, 0.5, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const geo = mergeGeometries([a, b]);
  const m = new THREE.MeshStandardMaterial({ map: NEEDLE, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  const layers = [[2600, 0.15, 0.75, '#1a3a24'], [3200, 0.5, 1.0, '#2a5a3a'], [1800, 0.8, 1.05, '#3a6e4a']];
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Object3D(), col = new THREE.Color();
  layers.forEach(([n, f0, f1, base]) => {
    const mesh = new THREE.InstancedMesh(geo, m, n);
    for (let i = 0; i < n; i++) {
      const y = Y0 + 0.05 + (YTOP - Y0 - 0.1) * (1 - Math.sqrt(rand()));
      const th = rand() * Math.PI * 2, rT = rAt(y);
      const r0 = rT * R(f0 * 0.3, f0 * 0.6);
      const len = Math.max(0.25, rT * R(f0, f1) - r0 + 0.25) * R(0.85, 1.1);
      d.position.set(Math.cos(th) * r0, y, Math.sin(th) * r0);
      const dir = new THREE.Vector3(Math.cos(th), R(-0.55, -0.05) + (y > YTOP - 0.6 ? 0.9 : 0), Math.sin(th)).normalize();
      d.quaternion.setFromUnitVectors(up, dir);
      d.rotateY(R(0, Math.PI));
      const wd = Math.min(0.9, 0.35 + len * 0.55);
      d.scale.set(wd, len, wd); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.set(base).offsetHSL(R(-0.02, 0.02), R(-0.05, 0.05), R(-0.05, 0.06)).multiplyScalar(3.2));
    }
    mesh.castShadow = mesh.receiveShadow = true; treeGroup.add(mesh);
  });
}
// dark inner cone hides gaps and blocks clicks through the tree
const coreGeo = new THREE.ConeGeometry(RB * 0.62, YTOP - Y0, 32, 1, true); coreGeo.translate(0, (YTOP + Y0) / 2, 0);
const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({ color: 0x0b1a10, roughness: 1, side: THREE.DoubleSide }));
core.userData.occluder = true; treeGroup.add(core);
const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0x3B2A1E, roughness: 0.9 })); trunk.position.y = 0.6; treeGroup.add(trunk);
const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 1.9), new THREE.MeshStandardMaterial({ color: 0x9C7650, roughness: 0.7 })); base.position.y = 0.1; base.castShadow = base.receiveShadow = true; treeGroup.add(base);

// pre-lit warm white lights (come with the tree)
const LIGHT_N = 500;
const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), LIGHT_N);
const lightPhase = [];
{
  const d = new THREE.Object3D();
  for (let i = 0; i < LIGHT_N; i++) {
    const y = Y0 + 0.15 + (YTOP - Y0 - 0.3) * (1 - Math.sqrt(rand())); const th = rand() * Math.PI * 2; const r = rAt(y) * R(0.7, 0.98);
    d.position.set(Math.cos(th) * r, y, Math.sin(th) * r); d.updateMatrix(); lights.setMatrixAt(i, d.matrix);
    lights.setColorAt(i, new THREE.Color(3.4, 2.4, 1.2)); lightPhase.push(rand() * Math.PI * 2);
  }
}
treeGroup.add(lights);

/* ---------------- Placement on the tree ---------------- */
const placed = [];
function spot(size, yMin, yMax, depth = 0.96) {
  for (let t = 0; t < 150; t++) {
    const y = yMin + (yMax - yMin) * rand(), th = rand() * Math.PI * 2, r = rAt(y) * depth + 0.05;
    const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    if (placed.every(q => q.p.distanceTo(p) > (q.s + size) * 0.5)) { placed.push({ p, s: size }); return { p, th }; }
  }
  const y = yMin + (yMax - yMin) * rand(), th = rand() * Math.PI * 2, r = rAt(y) * depth + 0.05;
  const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r); placed.push({ p, s: size }); return { p, th };
}
const COUNT = id => { const it = BY_ID[id]; return it.diy ? it.made : it.qty; };
function hang(names, id, n, heightIn, yMin, yMax, opts = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const hgt = heightIn * R(0.95, 1.05);
    const { p, th } = spot(hgt * IN, yMin, yMax, opts.depth ?? 0.96);
    out.push({ s: cutout(names[i % names.length], id, hgt, p, opts), p, th });
  }
  return out;
}

/* ---------------- Topper (burlap paw-print bow) ---------------- */
cutout('topper_bow', 'topper', 22, new THREE.Vector3(0, YTOP + 0.95, 0.15), { anchor: 'top' });

/* ---------------- Ribbons (textures from the real ribbon photos) ---------------- */
function ribbonMesh(pathFn, steps, width, material, id, texScale = 1) {
  const pos = [], uv = [], idx = []; let len = 0, prev = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, { p, n } = pathFn(t);
    if (prev) len += p.distanceTo(prev); prev = p;
    const a = pathFn(Math.max(0, t - 0.002)).p, b = pathFn(Math.min(1, t + 0.002)).p;
    const side = new THREE.Vector3().crossVectors(b.sub(a).normalize(), n).normalize().multiplyScalar(width / 2);
    pos.push(p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z);
    uv.push(len / width * texScale, 0, len / width * texScale, 1);
    if (i < steps) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material); mesh.castShadow = true; scene.add(mesh); tag(mesh, id);
  for (let i = 1; i < 6; i++) addInstancePos(id, pathFn(i / 6).p);
  return mesh;
}
{
  const tartanMat = mat('tartan_ribbon', THREE.MeshStandardMaterial, { map: photoTex('tx_tartan_ribbon', [1, 1]), color: 0xd8d0c8, roughness: 0.85, side: THREE.DoubleSide });
  for (let k = 0; k < 5; k++) {   // cascading tartan ribbon from the top
    const th0 = k * (Math.PI * 2 / 5) + 0.35;
    ribbonMesh(t => {
      const y = YTOP - 0.5 - t * (YTOP - Y0 - 0.6), th = th0 + t * 0.9 + Math.sin(t * 9 + k) * 0.08;
      const r = rAt(y) + 0.06 + Math.sin(t * 14 + k) * 0.08;
      return { p: new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r), n: new THREE.Vector3(Math.cos(th + Math.sin(t * 14 + k) * 0.6), 0.35, Math.sin(th + Math.sin(t * 14 + k) * 0.6)).normalize() };
    }, 180, 2.5 * IN, tartanMat, 'tartan_ribbon', 0.55);
  }
  const velvetMat = mat('velvet_ribbon', THREE.MeshPhysicalMaterial, { map: photoTex('tx_velvet', [1, 1]), color: 0xc8b8b0, roughness: 0.7, sheen: 0.5, sheenColor: new THREE.Color(0xb02030), sheenRoughness: 0.5, side: THREE.DoubleSide });
  ribbonMesh(t => {   // velvet garland swag
    const th = t * Math.PI * 2 * 3.2 + 1.2;
    const y = YTOP - 1.2 - t * (YTOP - Y0 - 1.6) - Math.abs(Math.sin(th * 2.5)) * 0.2;
    const r = rAt(y) + 0.08;
    return { p: new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r), n: new THREE.Vector3(Math.cos(th), 0.25, Math.sin(th)).normalize() };
  }, 700, 2.5 * IN, velvetMat, 'velvet_ribbon', 0.3);
}

/* ---------------- Ornaments: real product photos at real size ---------------- */
// big bows first so smaller ornaments sit around them
hang(['velvet_bow'], 'velvet_bows', 12 * COUNT('velvet_bows'), 13, 1.5, 6.4, { depth: 1.0 });
hang(['plaid_bow'], 'plaid_bows', 12 * COUNT('plaid_bows'), 10, 1.4, 6.6, { depth: 1.0 });
hang(['golden'], 'golden', COUNT('golden'), 4.2, 1.6, 6.2);
hang(['tabby_grey'], 'tabby_grey', COUNT('tabby_grey'), 4.2, 1.6, 6.2);
hang(['tabby_brown'], 'tabby_brown', COUNT('tabby_brown'), 4.2, 1.6, 6.2);
const houses = hang(['doghouse'], 'doghouse', Math.min(12, COUNT('doghouse')), 4.3, 1.5, 6.0);
const discs = hang(['paw_disc'], 'paw_disc', Math.min(24, COUNT('paw_disc')), 3.6, 1.3, 6.6);
hang(['bone'], 'bones', Math.min(22, COUNT('bones')), 2.2, 1.3, 6.6, { widthIn: 4 });
hang(['stock_red', 'stock_green', 'stock_cream'], 'stockings', 12 * COUNT('stockings'), 4.5, 1.4, 6.0);
// mini velvet bows on top of every paw disc and doghouse
[...discs, ...houses].forEach(({ p, th }) => cutout('mini_bow', 'mini_bows', 3.5, p.clone().add(new THREE.Vector3(Math.cos(th) * 0.03, 0.08, Math.sin(th) * 0.03)), { anchor: 'center' }));
// baubles (photo cutouts of the actual balls in each set)
hang(['gr1', 'gr2', 'gr3', 'gr4', 'gr6'], 'glitter_red', 12 * COUNT('glitter_red'), 3.15, 1.3, 6.5, { anchor: 'center', depth: 0.93 });
hang(['gc1', 'gc2'], 'glitter_champ', 12 * COUNT('glitter_champ'), 3.15, 1.3, 6.5, { anchor: 'center', depth: 0.93 });
hang(['plaid_ball'], 'plaid_balls', 6 * COUNT('plaid_balls'), 3.15, 1.3, 6.2, { anchor: 'center', depth: 0.93 });
hang(['rgg_red', 'rgg_green', 'rgg_gold', 'rgg_plaid', 'rgg_swirl', 'rgg_red', 'rgg_green'], 'baubles_rgg', 80, 2.2, 1.2, 6.9, { anchor: 'center', depth: 0.9 });
{ // champagne/cream set: glossy & satin spheres (the photo set is behind clear plastic, so these are rendered)
  const list = []; const SPH = new THREE.SphereGeometry(1, 28, 18);
  const m = mat('baubles_champ', THREE.MeshPhysicalMaterial, { color: 0xffffff, metalness: 0.75, roughness: 0.22, clearcoat: 1 });
  const mesh = new THREE.InstancedMesh(SPH, m, 36); const d = new THREE.Object3D(); const cols = ['#E6D3AE', '#D9BE8A', '#EFE4CB', '#CDB083'];
  for (let i = 0; i < 36; i++) { const r = R(0.75, 1.1) * IN; const { p } = spot(r * 2.4, 1.2, 6.9, 0.9); d.position.copy(p); d.scale.setScalar(r); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); mesh.setColorAt(i, new THREE.Color(cols[i % 4])); addInstancePos('baubles_champ', p); }
  mesh.userData.itemId = 'baubles_champ'; pickables.push(mesh); scene.add(mesh);
}
// picks tucked into the branches
hang(['red_pick'], 'red_picks', 16, 9, 1.4, 6.8, { anchor: 'center', depth: 0.92 });
hang(['gold_pick'], 'gold_picks', 16, 7, 1.4, 6.9, { anchor: 'center', depth: 0.92 });
hang(['pine_pick'], 'pine_picks', 14, 5, 1.3, 6.4, { anchor: 'center', depth: 0.94 });

/* ---------------- Under the tree ---------------- */
const floorTex = canvasTex(512, 512, (g, w) => {
  for (let y = 0; y < w; y += 64) { g.fillStyle = `hsl(24, 34%, ${11 + Math.random() * 6}%)`; g.fillRect(0, y, w, 62); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, y + 62, w, 2); }
  for (let i = 0; i < 6000; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.15)' : 'rgba(150,100,60,.12)'; g.fillRect(Math.random() * w, Math.random() * w, 8 + Math.random() * 30, 1); }
}, { repeat: [6, 6] });
const floor = new THREE.Mesh(new THREE.CircleGeometry(13, 64), new THREE.MeshStandardMaterial({ map: floorTex, color: 0x9a7a62, roughness: 0.5, metalness: 0.05 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

function giftBox(w, h, d, faceMat, ribbonMat, x, z, ry, id, bowName) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faceMat); b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b);
  if (ribbonMat) {
    const rw = 2.5 * IN;
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, h * 1.01, rw), ribbonMat); r1.position.y = h / 2; g.add(r1);
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(rw, h * 1.01, d * 1.01), ribbonMat); r2.position.y = h / 2; g.add(r2);
  }
  g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); tag(g, id); addInstancePos(id, new THREE.Vector3(x, h * 0.7, z));
  if (bowName) cutout(bowName, bowName === 'plaid_bow' ? 'plaid_bows' : 'topper', 9, new THREE.Vector3(x, h - 0.02, z), { anchor: 'bottom' });
}
{
  const wrap = (name, rep) => photoTex(name, rep);
  const tartanBox = mat('tartan_wrap', THREE.MeshStandardMaterial, { map: wrap('tx_tartan_wrap', [1, 1]), roughness: 0.45 });
  const pawBox = mat('paw_wrap', THREE.MeshStandardMaterial, { map: wrap('tx_paw_wrap', [1, 1]), roughness: 0.8 });
  const printBox = mat('gift_boxes', THREE.MeshStandardMaterial, { map: wrap('tx_box_red', [1, 1]), roughness: 0.6 });
  const greenBox = mat('gift_boxes', THREE.MeshStandardMaterial, { map: wrap('tx_box_green', [1, 1]), roughness: 0.6 });
  const tartanRib = mat('tartan_ribbon', THREE.MeshStandardMaterial, { map: photoTex('tx_tartan_ribbon', [1, 1]), roughness: 0.8 });
  const velvetRib = itemMats.velvet_ribbon[0];
  giftBox(1.0, 0.62, 0.9, tartanBox, velvetRib, -1.75, 0.6, 0.35, 'tartan_wrap', 'plaid_bow');
  giftBox(0.85, 0.52, 0.78, pawBox, tartanRib, -1.15, 1.6, -0.25, 'paw_wrap', 'topper_bow');
  giftBox(0.62, 0.44, 0.62, tartanBox, null, 1.9, -0.4, 0.5, 'tartan_wrap');
  giftBox(0.78, 0.5, 0.78, printBox, tartanRib, 1.95, 0.6, -0.4, 'gift_boxes', 'plaid_bow');
  giftBox(0.6, 0.38, 0.6, greenBox, null, -2.0, -0.6, 0.2, 'gift_boxes');
}
// plush bone pillow, pet bowl
cutout('bone_pillow', 'bone_pillow', 6, new THREE.Vector3(-0.35, 0, 2.05), { anchor: 'bottom', widthIn: 13 });
cutout('bowl', 'bowl', 2.5, new THREE.Vector3(0.45, 0, 2.35), { anchor: 'bottom', widthIn: 6.5 });

// gift basket: 3D wicker basket (texture from the real basket photo) holding real-photo items
{
  const bx = 1.25, bz = 1.65;
  const wick = mat('basket', THREE.MeshStandardMaterial, { map: photoTex('tx_wicker', [5, 1]), roughness: 0.85, side: THREE.DoubleSide });
  const liner = mat('basket', THREE.MeshStandardMaterial, { color: 0xEDE3CF, roughness: 1, side: THREE.DoubleSide });
  const g = new THREE.Group(); g.position.set(bx, 0, bz); g.rotation.y = -0.4; scene.add(g);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.42, 0.42, 40, 1, true), wick); wall.position.y = 0.21; wall.scale.z = 0.72; g.add(wall);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), wick); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.01; bottom.scale.y = 0.72; g.add(bottom);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.52, 0.08, 40, 1, true), liner); cuff.position.y = 0.4; cuff.scale.z = 0.73; g.add(cuff);
  const handleMat = mat('basket', THREE.MeshStandardMaterial, { color: 0x6B2A20, roughness: 0.6 });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 40, Math.PI), handleMat); handle.position.y = 0.42; g.add(handle);
  tag(g, 'basket'); addInstancePos('basket', new THREE.Vector3(bx, 0.3, bz));
  g.updateMatrixWorld(true);
  const W = (x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
  // red paw-print blanket draped over the front (real blanket texture)
  const bl = new THREE.PlaneGeometry(0.7, 0.7, 24, 24); const pa = bl.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); const fold = y > 0 ? 0 : -y; pa.setZ(i, -fold * 0.95 + Math.sin(x * 10) * 0.035); pa.setY(i, y > 0 ? y : y * 0.3); }
  bl.computeVertexNormals();
  const blanket = new THREE.Mesh(bl, mat('blanket', THREE.MeshStandardMaterial, { map: photoTex('tx_blanket', [1, 1]), roughness: 1, side: THREE.DoubleSide }));
  blanket.rotation.set(-1.15, 0, 0.12); blanket.position.set(0.15, 0.42, 0.27); g.add(blanket); tag(blanket, 'blanket'); addInstancePos('blanket', W(0.15, 0.32, 0.32));
  // contents, back to front
  cutout('jar', 'jar', 9, W(-0.22, 0.1, -0.08), { anchor: 'bottom', widthIn: 6.5 });
  cutout('small_bone', 'holiday_toy', 3.2, W(0.22, 0.36, -0.15), { anchor: 'bottom', widthIn: 7 });
  cutout('rope_cane', 'rope', 6, W(0.42, 0.3, -0.05), { anchor: 'bottom' });
  cutout('rope_knot', 'rope', 4.5, W(0.38, 0.3, 0.2), { anchor: 'bottom' });
  cutout('ball', 'balls', 2.6, W(0.0, 0.38, 0.12), { anchor: 'bottom' });
  cutout('ball', 'balls', 2.6, W(0.62, 0, 0.45), { anchor: 'bottom' });
  cutout('scarf', 'bandanas', 11, W(-0.5, 0.47, 0.05), { anchor: 'top' });
  cutout('scarf', 'bandanas', 11, W(-0.45, 0.47, -0.25), { anchor: 'top' });
  // two Homes Alive Pets gift cards
  [0, 1].forEach(k => { const c = new THREE.Mesh(new THREE.BoxGeometry(3.4 * IN, 2.1 * IN, 0.004), [0, 1, 2, 3, 4, 5].map(f => f === 4 ? mat('gift_card', THREE.MeshStandardMaterial, { map: photoTex('tx_card'), roughness: 0.4 }) : mat('gift_card', THREE.MeshStandardMaterial, { color: 0xFBFAF6, roughness: 0.4 })));
    c.position.set(0.02 + k * 0.08, 0.5 + k * 0.03, 0.08 - k * 0.04); c.rotation.set(-0.3, 0.1 - k * 0.15, 0.05 - k * 0.12); g.add(c); tag(c, 'gift_card'); });
  addInstancePos('gift_card', W(0.05, 0.5, 0.05));
}

/* ---------------- Room ---------------- */
{ // soft bokeh of other lights in the room
  const tex = canvasTex(64, 64, (g) => { const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,200,120,1)'); grd.addColorStop(0.4, 'rgba(255,170,80,.45)'); grd.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); });
  const n = 70, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = R(0, Math.PI * 2), r = R(17, 24); pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = R(1, 9); pos[i * 3 + 2] = Math.sin(a) * r; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size: 0.35, transparent: true, depthWrite: false, opacity: 0.45, blending: THREE.AdditiveBlending })));
}
{
  const wallTex = canvasTex(1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#1a0f09'); grd.addColorStop(1, '#2e1c11'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,190,120,.04)'; g.fillRect(x + 3, 0, 2, h); }
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, h * 0.62, w, 6);                                       // chair rail
    [[180, 150], [560, 150], [900, 150]].forEach(([x, y]) => {                                            // frosted windows with warm glow
      const wg = g.createRadialGradient(x, y + 40, 10, x, y + 40, 150); wg.addColorStop(0, 'rgba(110,135,170,.18)'); wg.addColorStop(1, 'rgba(120,150,190,0)');
      g.fillStyle = wg; g.fillRect(x - 160, y - 110, 320, 300); g.strokeStyle = 'rgba(30,18,10,.9)'; g.lineWidth = 8; g.strokeRect(x - 70, y - 60, 140, 200); g.beginPath(); g.moveTo(x, y - 60); g.lineTo(x, y + 140); g.moveTo(x - 70, y + 40); g.lineTo(x + 70, y + 40); g.stroke();
    });
  }, { repeat: [2, 1] });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 14, 64, 1, true), new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide, fog: false }));
  wall.position.y = 6.5; scene.add(wall);
}
scene.background = new THREE.Color(0x120d0a);
scene.fog = new THREE.Fog(0x120d0a, 22, 45);
scene.traverse(o => { if (o.material && !o.isSprite) [].concat(o.material).forEach(m => { if ('envMapIntensity' in m) m.envMapIntensity = 0.4; }); });

/* ---------------- Post-processing ---------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.4, 1.1);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------------- Selection markers ---------------- */
const ringTex = canvasTex(128, 128, (g) => { g.strokeStyle = '#FFE7A8'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 0.35; g.lineWidth = 22; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke(); });
const markerGroup = new THREE.Group(); scene.add(markerGroup);
const markerMat = new THREE.SpriteMaterial({ map: ringTex, depthTest: false, transparent: true, toneMapped: false, color: new THREE.Color(1.6, 1.4, 1.0) });
let selected = null;

function setHighlight(ids) {
  Object.entries(itemMats).forEach(([id, ms]) => ms.forEach(m => {
    if (!m.userData.baseEmissive) m.userData.baseEmissive = m.emissive ? m.emissive.clone() : null;
    if (m.emissive) { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = 1; }
  }));
  ids.forEach(id => (itemMats[id] || []).forEach(m => { if (m.emissive) { m.emissive.setRGB(0.22, 0.15, 0.05); } }));
  markerGroup.clear();
  ids.forEach(id => (instancesOf[id] || []).forEach(p => {
    const s = new THREE.Sprite(markerMat); s.position.copy(p); s.scale.setScalar(0.42); s.renderOrder = 999; markerGroup.add(s);
  }));
}

const card = document.getElementById('card');
function select(id, { focus = false } = {}) {
  selected = id;
  document.querySelectorAll('.item').forEach(el => el.classList.toggle('on', el.dataset.id === id));
  if (!id) { card.hidden = true; setHighlight([]); return; }
  const it = BY_ID[id]; const extra = NOT_ON_TREE[id];
  const showIds = extra ? extra.show : [id];
  setHighlight(showIds);
  const storeShort = it.store.replace(/ \(.*\)$/, '');
  card.innerHTML = `
    <div class="row1"><div style="display:grid;gap:5px"><div>${it.diy ? '<span class="badge diy">DIY</span> ' : ''}<span class="badge sec">${it.section}</span></div><h2>${it.name}</h2></div>
      <button class="close" type="button" aria-label="Close">✕</button></div>
    <div class="facts">
      <div class="fact"><span>Cost</span><b>${it.diy ? 'DIY' : money(it.price)}</b></div>
      <div class="fact"><span>${it.diy ? 'Makes' : 'Qty'}</span><b>${it.diy ? it.made : it.qty}</b></div>
      <div class="fact"><span>Total</span><b>${money(it.total)}</b></div>
    </div>
    ${it.img || it.notes ? `<div class="photo">${it.img ? `<img src="${it.img}" alt="Listing photo: ${it.name.replace(/"/g, '&quot;')}">` : ''}<div>${it.match ? `<span class="ok">${{ match: 'Photo matches the look', close: 'Close to the look' }[it.match]}</span>` : ''}<p>${it.notes || ''}${it.arrives_by ? ` <b>Arrives by ${new Date(it.arrives_by + 'T12:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}.</b>` : ''}</p></div></div>` : ''}
    ${it.diy ? `<p class="where"><b>How to make it:</b> ${DIY_HOW[id]}</p>` : ''}
    ${extra ? `<p class="where">${extra.note}</p>` : ''}
    <p class="src">${it.diy ? 'Materials from ' : 'Buy from '}${it.store}. ${STATUS[it.status]}${it.diy ? ' of materials' : ''}.</p>
    <a class="buy" href="${it.url}" target="_blank" rel="noopener">${it.diy ? 'Get the materials at ' : 'Open at '}${storeShort.replace(/, South Edmonton.*$/, '')} ↗</a>`;
  card.hidden = false;
  card.querySelector('.close').onclick = () => select(null);
  if (focus) focusOn(showIds);
  if (window.matchMedia('(min-width: 900px)').matches) { const row = listEl.querySelector(`[data-id="${id}"]`); row && row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

// Camera focus animation toward the instance closest to the current view
let anim = null;
function focusOn(ids) {
  const pts = ids.flatMap(i => instancesOf[i] || []); if (!pts.length) return;
  stopSpin();
  const camAz = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  let best = pts[0], bestD = Infinity;
  pts.forEach(p => { const az = Math.atan2(p.x, p.z); let d = Math.abs(((az - camAz + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (Math.hypot(p.x, p.z) < 0.5) d = 0.5; if (d < bestD) { bestD = d; best = p; } });
  const az1 = Math.hypot(best.x, best.z) < 0.3 ? camAz : Math.atan2(best.x, best.z);
  const dist = camera.position.distanceTo(controls.target);
  const startAz = camAz; let dAz = ((az1 - startAz + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const narrow = !window.matchMedia('(min-width: 900px)').matches;
  const startT = controls.target.clone(); const endT = new THREE.Vector3(0, narrow ? Math.max(-0.6, best.y - 1.4) : THREE.MathUtils.clamp(best.y, 1.2, 5.5), 0);
  const startDist = dist; const endDist = THREE.MathUtils.clamp(dist, 9, 12.5);
  const startY = camera.position.y - controls.target.y; const endY = best.y < 1 ? 2.6 : 1.1;
  const t0 = performance.now(); const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 900;
  anim = (now) => {
    const k = Math.min(1, (now - t0) / dur); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const az = startAz + dAz * e; const tgt = startT.clone().lerp(endT, e); const d = startDist + (endDist - startDist) * e; const yo = startY + (endY - startY) * e;
    const horiz = Math.sqrt(Math.max(0.01, d * d - yo * yo));
    controls.target.copy(tgt); camera.position.set(tgt.x + Math.sin(az) * horiz, tgt.y + yo, tgt.z + Math.cos(az) * horiz);
    if (k >= 1) anim = null;
  };
}

/* ---------------- Picking ---------------- */
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
const tip = document.getElementById('tip');
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...pickables, core], false);
  if (!hits.length || hits[0].object.userData.occluder) return null;
  return hits[0].object.userData.itemId || null;
}
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
  if (moved > 6) return;
  const id = pick(e); select(id); if (id) stopSpin();
});
let hoverQueued = null;
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') hoverQueued = e; });
canvas.addEventListener('pointerleave', () => { tip.hidden = true; canvas.classList.remove('hovering'); });
function doHover() {
  if (!hoverQueued) return; const e = hoverQueued; hoverQueued = null;
  const id = pick(e);
  if (id) { const r = stage.getBoundingClientRect(); tip.textContent = BY_ID[id].name.replace(/ \(.*?\)/g, '').split(':')[0]; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.hidden = false; canvas.classList.add('hovering'); }
  else { tip.hidden = true; canvas.classList.remove('hovering'); }
}

listEl.addEventListener('click', e => { if (e.target.closest('a')) return; const row = e.target.closest('.item'); if (row) select(row.dataset.id, { focus: true }); });
listEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('item')) { e.preventDefault(); select(e.target.dataset.id, { focus: true }); } });

const spinBtn = document.getElementById('spin');
function stopSpin() { controls.autoRotate = false; spinBtn.setAttribute('aria-pressed', 'false'); }
spinBtn.onclick = () => { controls.autoRotate = !controls.autoRotate; spinBtn.setAttribute('aria-pressed', String(controls.autoRotate)); };
controls.addEventListener('start', () => { anim = null; stopSpin(); });
document.getElementById('reset').onclick = () => {
  const from = camera.position.clone(), fromT = controls.target.clone(), t0 = performance.now();
  anim = now => { const k = Math.min(1, (now - t0) / 700); const e = 1 - Math.pow(1 - k, 3); camera.position.lerpVectors(from, HOME_POS, e); controls.target.lerpVectors(fromT, HOME_TARGET, e); if (k >= 1) anim = null; };
};
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) stopSpin();

/* ---------------- Resize + loop ---------------- */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 46 : 36;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();

const tmpCol = new THREE.Color();
const clock = new THREE.Clock();
renderer.shadowMap.needsUpdate = true;
function frame() {
  const t = clock.getElapsedTime();
  if (anim) anim(performance.now());
  controls.update();
  doHover();
  for (let i = 0; i < LIGHT_N; i++) { const k = 0.75 + 0.25 * Math.sin(t * 1.6 + lightPhase[i]); lights.setColorAt(i, tmpCol.setRGB(3.2 * k, 2.15 * k, 1.05 * k)); }
  lights.instanceColor.needsUpdate = true;
  const pulse = 0.36 + 0.06 * Math.sin(t * 4);
  markerGroup.children.forEach(s => s.scale.setScalar(pulse));
  composer.render();
}
renderer.setAnimationLoop(frame);
document.getElementById('loading').remove();
window.__howl = { select, instancesOf, pickables, stop: () => renderer.setAnimationLoop(null), frame, camera, controls };
