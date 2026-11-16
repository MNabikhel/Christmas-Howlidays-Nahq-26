import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ITEMS = window.HOWL_ITEMS;
const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const BUDGET = 2000;
const money = n => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ABOUT = "Pets are family, and nothing says home for the holidays like a wagging tail. Plush golden retrievers and tabby kittens in tartan scarves peek from branches filled with paw-print ornaments, doghouses and biscuit bones, under a burlap paw-print bow. Below, a family dog waits in its own doghouse beside a gift basket for the winning bidder's best friend.";

// DIY how-to text lives in items.json ("how")
const DIY_HOW = Object.fromEntries(ITEMS.filter(i => i.how).map(i => [i.id, i.how]));
const NOT_ON_TREE = {
  paint: { note: 'Paints the DIY paw ornaments, bones, doghouses, the giant doghouse and the faux biscuits, which are highlighted now.', show: ['paw_disc', 'bones', 'doghouse', 'doghouse_xl', 'faux_treats'] },
  paw_stamp: { note: 'Stamps the paws on the burlap topper, the paw ornaments and the doghouse gables, highlighted now.', show: ['topper', 'paw_disc', 'doghouse', 'doghouse_xl'] },
  floral_wire: { note: 'Wraps every ornament, bow, pick and plush pet to the branches so nothing falls off in transit.', show: [] },
  bone_cutters: { note: 'Cuts the faux biscuits for the jar, highlighted now.', show: ['faux_treats'] },
  felt: { note: 'The black paw on the sherpa bone pillow, highlighted now.', show: ['bone_pillow'] },
  craft_supplies: { note: 'Paint, gesso, glue, stencil film and tools for every DIY build, highlighted now. Every line and its quantity is in the committee plan.', show: ['doghouse', 'doghouse_xl', 'paw_disc', 'bones', 'faux_treats', 'topper'] },
  ct_supplies: { note: 'Tape for the boxes and doghouse, plus a drop sheet for painting in the office.', show: ['gift_boxes', 'doghouse_xl'] },
  shipping: { note: 'Shipping charged by the Amazon.ca listings without free delivery. $0 with Prime.', show: [] },
};
const STATUS = { est: 'Estimated price', listed: 'Price as listed when checked', face: 'Face value' };

/* ---------------- Export the Word files ---------------- */
{
  const msg = document.getElementById('exportMsg'), box = document.querySelector('.export'), HINT = msg.textContent;
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const FILES = [
    { btn: document.getElementById('export'), name: 'HP26_Tree_Gallery_Form_Corporate_Finance.docx', b64: window.HOWL_DOCX },
    { btn: document.getElementById('exportPlan'), name: 'HP26_Committee_Plan_Corporate_Finance.docx', b64: window.HOWL_PLAN },
    { btn: document.getElementById('exportTpl'), name: 'HP26_Templates.pdf', b64: window.HOWL_TPL, type: 'application/pdf' },
    { btn: document.getElementById('exportSign'), name: 'HP26_Doghouse_Sign_11x17.pdf', b64: window.HOWL_SIGN, type: 'application/pdf' },
  ];
  const viaClaude = () => window.claude && typeof window.claude.use === 'function';
  if (!window.HOWL_DOCX) box.hidden = true;
  if (viaClaude()) window.claude.use('downloads').then(dl => { if (!dl) box.hidden = true; });
  FILES.forEach(f => {
    if (!f.b64) { f.btn.hidden = true; return; }
    const blob = () => new Blob([Uint8Array.from(atob(f.b64), c => c.charCodeAt(0))], { type: f.type || DOCX });
    f.btn.onclick = async () => {
      msg.textContent = HINT;
      if (!viaClaude()) {   // standalone preview file opened in a normal browser
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob()); a.download = f.name; document.body.append(a); a.click(); a.remove();
        msg.textContent = 'Downloading ' + f.name + '.'; return;
      }
      const dl = await window.claude.use('downloads');
      if (!dl) { box.hidden = true; return; }
      FILES.forEach(x => { x.btn.disabled = true; });
      try {
        const r = await dl.save({ filename: f.name, data: blob() });
        msg.textContent = r.status === 'saved' ? 'Saved ' + f.name + '.' : 'Sent where you chose.';
      } catch (e) {
        const code = e && e.code;
        if (code === 'declined') msg.textContent = HINT;
        else if (code === 'rate_limited') msg.textContent = 'A save prompt is already open. Finish that one first.';
        else msg.textContent = 'Saving files isn\'t available in this view. Open the page in claude.ai to export.';
      } finally { FILES.forEach(x => { x.btn.disabled = false; }); }
    };
  });
}

/* ---------------- Panel ---------------- */
document.getElementById('about').textContent = ABOUT;
const subtotal = ITEMS.reduce((s, i) => s + i.total, 0);
const taxable = ITEMS.filter(i => i.id !== 'gift_card').reduce((s, i) => s + i.total, 0);
const gst = Math.round(taxable * 0.05 * 100) / 100;
const grand = Math.round((subtotal + gst) * 100) / 100;
const SECTIONS = [...new Set(ITEMS.map(i => i.section))];
const SEC_COLORS = ['#2E7D5B', '#B3263A', '#C9962E', '#7E6A55', '#5A7FA6', '#6F7F86'];
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
   Scene v3: built at real-world scale from data/items.json (size_in).
   1 scene unit = 14 inches. Tree: 7.5 ft Wimberley Pine, ~52" wide.
   - 3D: bows (ribbon strips with loops, knot, V-cut tails), tartan
     cascades with poufs, baubles (glossy / glitter / painted), DIY
     doghouses, paw-print bauble discs, foam-clay bones, gift boxes,
     basket, glass jar, bowl, sherpa bone pillow.
   - Photo cutouts (camera-facing on the vertical axis only): the plush
     pets, knit stockings and the berry / gold / pine picks.
   ================================================================ */
const CUT = window.HOWL_CUTS;
const IN = 1 / 14;
const SZ = id => (BY_ID[id] && BY_ID[id].size_in) || {};
const COUNT = id => { const it = BY_ID[id]; if (!it) return 0; return it.diy ? it.made : it.qty; };

const canvas = document.getElementById('scene');
const stage = canvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.03, 120);
const HOME_POS = new THREE.Vector3(0, 3.05, 13.6);
const HOME_TARGET = new THREE.Vector3(0, 3.15, 0);
camera.position.copy(HOME_POS);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME_TARGET);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 1.0, maxDistance: 14.5, maxPolarAngle: Math.PI * 0.54, minPolarAngle: Math.PI * 0.1, autoRotate: true, autoRotateSpeed: 0.5, enablePan: false });

/* ---------------- Helpers ---------------- */
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true, clamp = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = rng(20261203);
const R = (a, b) => a + (b - a) * rand();
const loader = new THREE.TextureLoader();
const texCache = {};
function photoTex(name, repeat = null) {
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
function tag(obj, id) { obj.traverse(o => { if (o.isMesh) { o.userData.itemId = id; pickables.push(o); o.castShadow = true; } }); }
function noise(g, w, h, n, a, colors) { for (let i = 0; i < n; i++) { g.fillStyle = colors[(Math.random() * colors.length) | 0]; g.globalAlpha = Math.random() * a; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } g.globalAlpha = 1; }
function drawPaw(g, cx, cy, s, color, rot = 0) {
  g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = color;
  g.beginPath(); g.ellipse(0, s * 0.2, s * 0.32, s * 0.26, 0, 0, Math.PI * 2); g.fill();
  [[-0.36, -0.14, -0.4], [-0.13, -0.38, -0.12], [0.13, -0.38, 0.12], [0.36, -0.14, 0.4]].forEach(([x, y, r]) => { g.beginPath(); g.ellipse(x * s, y * s, s * 0.12, s * 0.16, r, 0, Math.PI * 2); g.fill(); });
  g.restore();
}
function instanced(geo, material, list, id, { cast = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  mesh.count = list.length;
  const d = new THREE.Object3D();
  list.forEach((it, i) => {
    d.position.copy(it.p); d.rotation.copy(it.rot || new THREE.Euler()); d.scale.setScalar(it.s ?? 1); if (it.sv) d.scale.copy(it.sv);
    d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    if (it.c) mesh.setColorAt(i, new THREE.Color(it.c));
    if (id && !it.noMark) addInstancePos(id, it.p);
  });
  mesh.castShadow = cast; mesh.receiveShadow = true;
  if (id) { mesh.userData.itemId = id; pickables.push(mesh); }
  scene.add(mesh); return mesh;
}

/* ---------------- Room: warm wood-panelled room with snowy windows ---------------- */
function drawRoom(g, w, h, wallFrom, wallTo, candles = true) {
  // vertical layout: [0, wallFrom) ceiling, [wallFrom, wallTo) wall, [wallTo, h) floor (for the env panorama)
  const wy = y => wallFrom + (wallTo - wallFrom) * y; // y in 0..1 from top of wall to floor
  g.fillStyle = '#0d0806'; g.fillRect(0, 0, w, h);
  const grd = g.createLinearGradient(0, wy(0), 0, wy(1)); grd.addColorStop(0, '#1c120b'); grd.addColorStop(0.7, '#2e1d12'); grd.addColorStop(1, '#3a2416');
  g.fillStyle = grd; g.fillRect(0, wy(0), w, wy(1) - wy(0));
  for (let x = 0; x < w; x += w / 48) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, wy(0.74), 2, wy(1) - wy(0.74)); }         // wainscot boards
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, wy(0.73), w, 4); g.fillStyle = 'rgba(255,190,120,.08)'; g.fillRect(0, wy(0.73) + 4, w, 2);
  const nWin = 6;
  for (let k = 0; k < nWin; k++) {                                    // tall windows: blue winter dusk, falling snow
    const cx = (k + 0.5) * w / nWin, ww = w / nWin * 0.36, top = wy(0.12), bot = wy(0.66);
    const sky = g.createLinearGradient(0, top, 0, bot); sky.addColorStop(0, '#1d2c45'); sky.addColorStop(1, '#5d7896');
    g.fillStyle = sky; g.fillRect(cx - ww / 2, top, ww, bot - top);
    g.fillStyle = 'rgba(235,240,255,.55)'; for (let i = 0; i < 70; i++) g.fillRect(cx - ww / 2 + Math.random() * ww, top + Math.random() * (bot - top), 1.5, 1.5);
    g.strokeStyle = '#140c07'; g.lineWidth = Math.max(3, w / 300); g.strokeRect(cx - ww / 2, top, ww, bot - top);
    g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, bot); for (let r = 1; r < 4; r++) { g.moveTo(cx - ww / 2, top + (bot - top) * r / 4); g.lineTo(cx + ww / 2, top + (bot - top) * r / 4); } g.stroke();
    // candles on the sill
    if (candles) for (let c = -1; c <= 1; c += 2) { const x = cx + c * ww * 0.6, y = wy(0.7); const cg = g.createRadialGradient(x, y, 0, x, y, w / 60); cg.addColorStop(0, 'rgba(255,214,150,1)'); cg.addColorStop(0.25, 'rgba(255,170,80,.6)'); cg.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = cg; g.fillRect(x - w / 60, y - w / 60, w / 30, w / 30); }
  }
  if (wallTo < h) { const fg = g.createLinearGradient(0, wallTo, 0, h); fg.addColorStop(0, '#2a1a10'); fg.addColorStop(1, '#120a06'); g.fillStyle = fg; g.fillRect(0, wallTo, w, h - wallTo); }
}
/* Two settings at true scale: the living room from the inspiration, and an office lobby like NAHQ (36 x 36 ft, 10 ft ceiling). */
const pmremGen = new THREE.PMREMGenerator(renderer);
const ENV = {};
{ // living room reflections
  const envTex = canvasTex(1024, 512, (g, w, h) => {
    drawRoom(g, w, h, h * 0.22, h * 0.56);
    for (let i = 0; i < 90; i++) { const x = Math.random() * w, y = h * (0.3 + Math.random() * 0.3), r = 3 + Math.random() * 9; const cg = g.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, 'rgba(255,215,150,1)'); cg.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = cg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  });
  envTex.mapping = THREE.EquirectangularReflectionMapping; ENV.living = pmremGen.fromEquirectangular(envTex).texture;
}
const ROOM_R = 16, ROOM_H = 12;
const livingRoom = new THREE.Group(); scene.add(livingRoom);
{
  const wallTex = canvasTex(4096, 1024, (g, w, h) => {   // drawn soft-focus, like a photo background
    const c = document.createElement('canvas'); c.width = w; c.height = h; drawRoom(c.getContext('2d'), w, h, 0, h, false);
    g.filter = 'blur(7px)'; g.drawImage(c, 0, 0); g.filter = 'none';
    for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) { const x = (k + 0.5) * w / 6 + (j - 1) * w / 40, y = h * 0.72, r = 26; const cg = g.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, 'rgba(255,210,140,.95)'); cg.addColorStop(1, 'rgba(255,160,70,0)'); g.fillStyle = cg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  }, { repeat: [1, 1] });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_R, ROOM_R, ROOM_H, 96, 1, true), new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide }));
  wall.position.y = ROOM_H / 2; livingRoom.add(wall);
  const floorTex = canvasTex(1024, 1024, (g, w) => {
    for (let y = 0; y < w; y += 64) {                      // 4.5" oak planks with staggered joints
      g.fillStyle = `hsl(${22 + Math.random() * 6}, ${38 + Math.random() * 10}%, ${14 + Math.random() * 7}%)`; g.fillRect(0, y, w, 63);
      for (let i = 0; i < 160; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.18)' : 'rgba(180,120,70,.10)'; g.fillRect(Math.random() * w, y + Math.random() * 63, 20 + Math.random() * 90, 1); }
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, y + 63, w, 1); const j = Math.random() * w; g.fillRect(j, y, 1, 63); g.fillRect((j + w / 2) % w, y, 1, 63);
    }
  }, { repeat: [10, 10] });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_R, 96), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.38, metalness: 0.0, envMapIntensity: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; livingRoom.add(floor);
}
const OFFICE = { w: 36 * 12 * IN, d: 36 * 12 * IN, h: 120 * IN };   // 36 x 36 ft lobby, 10 ft ceiling
const officeRoom = new THREE.Group(); officeRoom.visible = false; scene.add(officeRoom);
{
  const { w: OW, d: OD, h: OH } = OFFICE;
  const soft = (px, draw) => (g, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); g.filter = `blur(${px}px)`; g.drawImage(c, 0, 0); g.filter = 'none'; };
  // carpet tiles: 24" quarter-turned tiles in charcoal & slate (texture = 8 x 8 ft)
  const carpet = canvasTex(1024, 1024, (g, w) => {
    const n = 4, t = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = `hsl(215, ${6 + Math.random() * 3}%, ${27 + Math.random() * 4}%)`; g.fillRect(i * t, j * t, t, t);
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 2;
      for (let k = 6; k < t; k += 9) { g.beginPath(); if ((i + j) % 2) { g.moveTo(i * t + k, j * t); g.lineTo(i * t + k, j * t + t); } else { g.moveTo(i * t, j * t + k); g.lineTo(i * t + t, j * t + k); } g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.strokeRect(i * t, j * t, t, t);
    }
    noise(g, w, w, 26000, 0.3, ['#000', '#9aa3ad']);
  }, { repeat: [OW / (96 * IN), OD / (96 * IN)] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(OW, OD), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.97, envMapIntensity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; officeRoom.add(floor);
  // suspended ceiling: 2 x 2 ft acoustic tiles with 2 x 4 ft LED panels (texture = 16 x 16 ft)
  const ceilDraw = (lightOnly) => (g, w) => {
    const t = w / 8;
    if (!lightOnly) { g.fillStyle = '#e8e8e4'; g.fillRect(0, 0, w, w); noise(g, w, w, 30000, 0.25, ['#bdbdb7', '#ffffff']); g.strokeStyle = '#f6f6f3'; g.lineWidth = 6; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, w); g.moveTo(0, i * t); g.lineTo(w, i * t); g.stroke(); } }
    else { g.fillStyle = '#000'; g.fillRect(0, 0, w, w); }
    [[1, 1], [5, 1], [1, 5], [5, 5]].forEach(([i, j]) => { g.fillStyle = lightOnly ? '#fff' : '#fbfcff'; g.fillRect(i * t + 4, j * t + 4, t - 8, 2 * t - 8); if (!lightOnly) { g.strokeStyle = '#c9cbd0'; g.lineWidth = 3; g.strokeRect(i * t + 4, j * t + 4, t - 8, 2 * t - 8); } });
  };
  const ceilRep = [OW / (192 * IN), OD / (192 * IN)];
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(OW, OD), new THREE.MeshStandardMaterial({ map: canvasTex(1024, 1024, ceilDraw(false), { repeat: ceilRep }), emissive: 0xffffff, emissiveIntensity: 1.6, emissiveMap: canvasTex(1024, 1024, ceilDraw(true), { repeat: ceilRep }), roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = OH; officeRoom.add(ceil);
  // walls: drawn as soft-focus photographs at true size (texture width = wall width)
  const wallPx = 4096, wallH = Math.round(wallPx * OH / OW);
  const base = (g, w, h, color) => { g.fillStyle = color; g.fillRect(0, 0, w, h); g.fillStyle = '#2b2b2b'; g.fillRect(0, h - h * 4 / 120, w, h * 4 / 120); };     // 4" rubber base
  const windowsWall = canvasTex(wallPx, wallH, soft(2.5, (g, w, h) => {   // curtain wall: Edmonton downtown at dusk, light snow
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#152238'); sky.addColorStop(0.55, '#3a5376'); sky.addColorStop(0.85, '#8a96ab'); sky.addColorStop(1, '#2a2f38'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w;) { const bw = 60 + Math.random() * 160, bh = h * (0.18 + Math.random() * 0.5), y = h * 0.86 - bh; g.fillStyle = `hsl(220, 18%, ${9 + Math.random() * 7}%)`; g.fillRect(x, y, bw, bh);
      for (let yy = y + 8; yy < h * 0.84; yy += 12) for (let xx = x + 6; xx < x + bw - 6; xx += 10) if (Math.random() < 0.42) { g.fillStyle = Math.random() < 0.7 ? 'rgba(255,214,150,.85)' : 'rgba(205,225,255,.8)'; g.fillRect(xx, yy, 5, 6); }
      x += bw + Math.random() * 12; }
    g.fillStyle = 'rgba(240,244,255,.7)'; for (let i = 0; i < 2500; i++) g.fillRect(Math.random() * w, Math.random() * h * 0.86, 2, 2);
    g.fillStyle = '#7d8590'; g.fillRect(0, h * 0.86, w, h * 0.14);                                         // sill and spandrel
    const ft = w / 36; g.fillStyle = '#1c1f24';
    for (let x = 0; x <= w; x += ft * 5) g.fillRect(x - 6, 0, 12, h);                                          // mullions every 5 ft
    g.fillRect(0, h * (1 - 96 / 120) - 5, w, 10); g.fillRect(0, h * 0.86 - 6, w, 12);                           // transom at 8 ft
    base(g, w, h, 'rgba(0,0,0,0)');
  }));
  const meetingWall = canvasTex(wallPx, wallH, soft(3, (g, w, h) => {      // glass meeting rooms
    base(g, w, h, '#d9dad6'); const ft = w / 36;
    [[2, 12], [15, 12], [28, 7]].forEach(([x0, wf]) => {
      const x = x0 * ft, ww = wf * ft, y = h * (1 - 108 / 120);
      const inside = g.createLinearGradient(0, y, 0, h); inside.addColorStop(0, '#f1efe8'); inside.addColorStop(1, '#bfb9ac'); g.fillStyle = inside; g.fillRect(x, y, ww, h - y - h * 4 / 120);
      g.fillStyle = '#7b6a55'; g.fillRect(x + ww * 0.18, h * (1 - 30 / 120), ww * 0.64, h * 0.03);             // table
      for (let c = 0; c < 6; c++) { g.fillStyle = '#2f3237'; g.fillRect(x + ww * (0.2 + c * 0.11), h * (1 - 26 / 120), ww * 0.05, h * 0.12); }
      g.fillStyle = '#20242a'; g.fillRect(x + ww * 0.35, h * (1 - 80 / 120), ww * 0.3, h * 0.16);               // screen
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x, h * (1 - 60 / 120), ww, h * 0.05);                    // frosted band
      g.strokeStyle = '#8c9096'; g.lineWidth = 8; g.strokeRect(x, y, ww, h - y);
      for (let k = 1; k < wf / 4; k++) g.fillRect(x + k * 4 * ft - 3, y, 6, h - y);
    });
  }));
  const slatWall = canvasTex(wallPx, wallH, soft(2, (g, w, h) => {         // oak slat feature wall
    base(g, w, h, '#3b2c20'); const ft = w / 36;
    for (let x = 0; x < w; x += ft / 4) { g.fillStyle = `hsl(30, ${38 + Math.random() * 8}%, ${46 + Math.random() * 8}%)`; g.fillRect(x, 0, ft / 4 - ft / 14, h - h * 4 / 120); }
    const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, 'rgba(255,240,215,.25)'); lg.addColorStop(0.4, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(0, 0, w, h);
  }));
  const plainWall = canvasTex(wallPx, wallH, soft(3, (g, w, h) => {        // lift lobby wall with two steel doors and art
    base(g, w, h, '#cfd0cc'); const ft = w / 36;
    [[9, 4], [23, 4]].forEach(([x0, wf]) => { const gr = g.createLinearGradient(x0 * ft, 0, (x0 + wf) * ft, 0); gr.addColorStop(0, '#9aa0a6'); gr.addColorStop(0.5, '#c9cdd1'); gr.addColorStop(1, '#8e949a'); g.fillStyle = gr; g.fillRect(x0 * ft, h * (1 - 96 / 120), wf * ft, h * 92 / 120); g.fillStyle = '#5c6167'; g.fillRect((x0 + wf / 2) * ft - 2, h * (1 - 96 / 120), 4, h * 92 / 120); });
    g.fillStyle = '#26303b'; g.fillRect(15 * ft, h * (1 - 78 / 120), 5 * ft, 3.2 * ft); g.fillStyle = '#c3a46a'; g.fillRect(15.3 * ft, h * (1 - 75 / 120), 4.4 * ft, 2.6 * ft);
  }));
  const wallMat = (map, lit) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, emissive: lit ? 0xffffff : 0x000000, emissiveMap: lit ? map : null, emissiveIntensity: lit ? 0.9 : 0, envMapIntensity: 0.2 });
  [[windowsWall, 0, -OD / 2, 0, true], [plainWall, 0, OD / 2, Math.PI, false], [meetingWall, -OW / 2, 0, Math.PI / 2, false], [slatWall, OW / 2, 0, -Math.PI / 2, false]].forEach(([map, x, z, ry, lit]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(OW, OH), wallMat(map, lit)); m.position.set(x, OH / 2, z); m.rotation.y = ry; m.receiveShadow = true; officeRoom.add(m);
  });
  // reception desk (8 ft x 30" x 42"), quartz top on an oak front
  const desk = new THREE.Group(); desk.position.set(OW / 2 - 5, 0, -4); desk.rotation.y = -Math.PI / 2;
  const front = new THREE.Mesh(new THREE.BoxGeometry(96 * IN, 41 * IN, 30 * IN), new THREE.MeshStandardMaterial({ color: 0x9a7350, roughness: 0.6 })); front.position.y = 20.5 * IN; desk.add(front);
  const top = new THREE.Mesh(new THREE.BoxGeometry(98 * IN, 1.5 * IN, 32 * IN), new THREE.MeshStandardMaterial({ color: 0xf2f1ee, roughness: 0.25 })); top.position.y = 41.75 * IN; desk.add(top);
  desk.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); officeRoom.add(desk);
  // a pair of lounge chairs facing the tree, for scale
  [[-7.5, 4.5, 0.9], [-5.6, 6.1, 0.55]].forEach(([x, z, ry]) => {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry;
    const fab = new THREE.MeshStandardMaterial({ color: 0x5b6670, roughness: 0.95 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(30 * IN, 7 * IN, 28 * IN), fab); seat.position.y = 17 * IN; c.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(30 * IN, 16 * IN, 6 * IN), fab); back.position.set(0, 27 * IN, -11 * IN); c.add(back);
    [-1, 1].forEach(sx => { const arm = new THREE.Mesh(new THREE.BoxGeometry(5 * IN, 10 * IN, 28 * IN), fab); arm.position.set(sx * 14 * IN, 22 * IN, 0); c.add(arm); });
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * IN, 0.7 * IN, 13.5 * IN, 8), new THREE.MeshStandardMaterial({ color: 0x1d1d1d, metalness: 0.6, roughness: 0.4 })); leg.position.set(a * 12 * IN, 6.75 * IN, b * 11 * IN); c.add(leg); });
    c.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); officeRoom.add(c);
  });
  // office reflections: bright ceiling panels, pale walls, dusk windows
  const envTex = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#d8d9d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#eceeee'; g.fillRect(0, 0, w, h * 0.3); g.fillStyle = '#ffffff'; for (let i = 0; i < 18; i++) g.fillRect(Math.random() * w, Math.random() * h * 0.25, 40, 18);
    const s = g.createLinearGradient(0, h * 0.3, 0, h * 0.5); s.addColorStop(0, '#2b4062'); s.addColorStop(1, '#7c8ba3'); g.fillStyle = s; g.fillRect(0, h * 0.3, w * 0.25, h * 0.2);
    g.fillStyle = '#a07a52'; g.fillRect(w * 0.5, h * 0.3, w * 0.25, h * 0.2); g.fillStyle = '#3f4349'; g.fillRect(0, h * 0.5, w, h * 0.5);
  });
  envTex.mapping = THREE.EquirectangularReflectionMapping; ENV.office = pmremGen.fromEquirectangular(envTex).texture;
}
scene.environment = ENV.living;
scene.environmentIntensity = 0.9;
scene.background = new THREE.Color(0x0d0806);

// soft contact shadows under things that sit on the floor
const SHADOW_TEX = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,.75)'); r.addColorStop(0.55, 'rgba(0,0,0,.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }, { clamp: true });
function contactShadow(x, z, w, d, ry = 0, o = 0.8) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: o }));
  m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.004, z); scene.add(m);
}

/* ---------------- Lighting: warm room + glow from inside the tree ---------------- */
const hemi = new THREE.HemisphereLight(0xffd9b0, 0x20140c, 0.35); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffd6a8, 1.1);
key.position.set(4, 9, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 8.5, bottom: -0.5, near: 1, far: 25 }); key.shadow.bias = -0.0005; key.shadow.radius = 4;
scene.add(key);
const fill = new THREE.DirectionalLight(0x8fa6d6, 0.18); fill.position.set(-6, 5, -6); scene.add(fill);   // cool window light from behind

/* ---------------- Tree ---------------- */
const Y0 = 12 * IN, YTOP = 90 * IN, RB = 26 * IN;            // foliage starts 12" up, 90" tall, 52" wide
const rAt = y => RB * Math.pow(Math.max(0, 1 - (y - Y0) / (YTOP - Y0)), 0.92);
const treeGroup = new THREE.Group(); scene.add(treeGroup);
const NEEDLE = canvasTex(256, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const greens = ['#0f2a18', '#143220', '#183b25', '#1d452b', '#245033', '#2c5b3a', '#3a6b45', '#4d7d50'];
  const twig = (x0, y0, x1, y1, len, n, lw) => {
    g.strokeStyle = '#3a2a1a'; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
        const a = ang + side * (0.45 + Math.random() * 0.6) + (k ? 0.25 : -0.1) * side;
        const L = len * (0.7 + Math.random() * 0.5) * (1 - t * 0.35);
        g.strokeStyle = greens[Math.min(greens.length - 1, ((Math.random() * 5) | 0) + (t > 0.65 ? 3 : 0))];
        g.lineWidth = 1.3 + Math.random() * 1.1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
      }
    }
  };
  twig(128, 505, 128, 20, 40, 120, 5);
  [[128, 430, 50, 270], [128, 410, 206, 262], [128, 320, 60, 168], [128, 300, 196, 156], [128, 210, 82, 92], [128, 196, 174, 86]].forEach(([a, b, c, d]) => twig(a, b, c, d, 28, 48, 3));
});
NEEDLE.wrapS = NEEDLE.wrapT = THREE.ClampToEdgeWrapping;
{
  const a = new THREE.PlaneGeometry(0.5, 1); a.translate(0, 0.5, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const geo = mergeGeometries([a, b]);
  const m = new THREE.MeshStandardMaterial({ map: NEEDLE, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78, envMapIntensity: 0.35 });
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Object3D(), col = new THREE.Color();
  [[2600, 0.12, 0.7, 0.62], [3400, 0.45, 0.98, 0.85], [2600, 0.82, 1.06, 1.05]].forEach(([n, f0, f1, bright]) => {
    const mesh = new THREE.InstancedMesh(geo, m, n);
    for (let i = 0; i < n; i++) {
      const y = Y0 + 0.03 + (YTOP - Y0 - 0.05) * (1 - Math.sqrt(rand()));
      const th = rand() * Math.PI * 2, rT = rAt(y);
      const r0 = rT * R(f0 * 0.3, f0 * 0.6);
      const len = Math.max(0.18, rT * R(f0, f1) - r0 + 0.2) * R(0.85, 1.1);
      d.position.set(Math.cos(th) * r0, y, Math.sin(th) * r0);
      const dir = new THREE.Vector3(Math.cos(th), R(-0.5, -0.05) + (y > YTOP - 0.5 ? 1.0 : 0), Math.sin(th)).normalize();
      d.quaternion.setFromUnitVectors(up, dir); d.rotateY(R(0, Math.PI));
      const wd = Math.min(0.75, 0.3 + len * 0.5);
      d.scale.set(wd, len, wd); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.setRGB(1, 1, 1).multiplyScalar(bright * R(0.85, 1.15)).lerp(new THREE.Color(1.1, 1.05, 0.8), R(0, 0.15)));
    }
    mesh.castShadow = mesh.receiveShadow = true; treeGroup.add(mesh);
  });
}
const coreGeo = new THREE.ConeGeometry(RB * 0.6, YTOP - Y0, 32, 1, true); coreGeo.translate(0, (YTOP + Y0) / 2, 0);
const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({ color: 0x0a170e, roughness: 1, side: THREE.DoubleSide }));
core.userData.occluder = true; treeGroup.add(core);
const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, Y0 + 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x3B2A1E, roughness: 0.9 })); trunk.position.y = (Y0 + 0.2) / 2; treeGroup.add(trunk);
contactShadow(0, 0, RB * 2.6, RB * 2.6, 0, 0.9);
// warm glow from inside the branches (the tree is pre-lit)
[[1.4, 0.55], [2.4, 0.45], [3.4, 0.38], [4.4, 0.3], [5.4, 0.22]].forEach(([y, f], i) => {
  const l = new THREE.PointLight(0xffa24a, 7 - i * 0.6, rAt(y) * 2.6, 2); l.position.set(Math.cos(i * 2.1) * rAt(y) * f, y, Math.sin(i * 2.1) * rAt(y) * f); scene.add(l);
});
const front = new THREE.PointLight(0xffb060, 2.2, 4.0, 2); front.position.set(0.6, 2.2, 3.2); scene.add(front);
// pre-lit warm white bulbs + soft halos
const LIGHT_N = 650;
const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), LIGHT_N);
const lightPhase = [];
{
  const d = new THREE.Object3D(); const halo = new Float32Array(LIGHT_N * 3);
  for (let i = 0; i < LIGHT_N; i++) {
    const y = Y0 + 0.1 + (YTOP - Y0 - 0.2) * (1 - Math.sqrt(rand())); const th = rand() * Math.PI * 2; const r = rAt(y) * R(0.62, 0.97);
    d.position.set(Math.cos(th) * r, y, Math.sin(th) * r); d.updateMatrix(); lights.setMatrixAt(i, d.matrix);
    lights.setColorAt(i, new THREE.Color(3.4, 2.4, 1.2)); lightPhase.push(rand() * Math.PI * 2);
    halo.set([d.position.x, d.position.y, d.position.z], i * 3);
  }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(halo, 3));
  const ht = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,220,160,.9)'); r.addColorStop(0.2, 'rgba(255,180,90,.35)'); r.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, { clamp: true });
  
}
treeGroup.add(lights);

/* ---------------- Placement ---------------- */
const placed = [];
function spot(size, yMin, yMax, depth = 0.97) {
  for (let t = 0; t < 160; t++) {
    const y = yMin + (yMax - yMin) * rand(), th = rand() * Math.PI * 2, r = rAt(y) * depth + 0.02;
    const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    if (placed.every(q => q.p.distanceTo(p) > (q.s + size) * 0.5)) { placed.push({ p, s: size }); return { p, th }; }
  }
  const y = yMin + (yMax - yMin) * rand(), th = rand() * Math.PI * 2, r = rAt(y) * depth + 0.02;
  const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r); placed.push({ p, s: size }); return { p, th };
}
const faceY = p => Math.atan2(p.x, p.z);
function spotFront(size, yMin, yMax, depth, spread = 1.1) {   // hero pieces go on the side people see first
  for (let t = 0; t < 200; t++) { const s = spot(size, yMin, yMax, depth); const a = Math.atan2(s.p.x, s.p.z); if (Math.abs(a) < spread) return s; placed.pop(); }
  return spot(size, yMin, yMax, depth);
}      // yaw that turns local +z outward from the trunk

/* ---------------- Ribbon geometry ---------------- */
// strip along points with given surface normals; 3 columns across so tails can have a V-cut end
function strip(pts, nrm, width, { uLen = width, notch = false, taper = null, flip = false } = {}) {
  const n = pts.length, pos = [], uv = [], idx = []; let L = 0;
  const tng = new THREE.Vector3(), side = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    tng.subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(tng, nrm[i]).normalize();
    if (i) L += pts[i].distanceTo(pts[i - 1]);
    const w = width * (taper ? taper(i / (n - 1)) : 1) / 2, p = pts[i];
    let c = p.clone(); if (notch && i === n - 1) c.addScaledVector(tng, -width * 0.42);
    [p.clone().addScaledVector(side, -w), c, p.clone().addScaledVector(side, w)].forEach((v, k) => { pos.push(v.x, v.y, v.z); uv.push(L / uLen, flip ? 1 - k / 2 : k / 2); });
    if (i < n - 1) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// a hand-tied bow: loops (ribbon width vertical), centre knot, two hanging V-cut tails. All sizes in inches.
function bowGeo({ ribbon, span, tail, loops = 2, uLen = ribbon, seed = 1 }) {
  const r = rng(seed), parts = [], W = ribbon * IN, Lb = span / 2 * IN, T = tail * IN;
  const loopDefs = loops === 2 ? [[0, 0.22, 1], [Math.PI, 0.22, 1]] : [[0, 0.5, 1], [Math.PI, 0.5, 1], [0, -0.32, 0.82], [Math.PI, -0.32, 0.82]];
  loopDefs.forEach(([yaw, tilt, len]) => {
    const pts = [], nrm = [], L = Lb * len * (0.95 + r() * 0.1), dz = Math.max(W * 0.62, L * 0.34);
    for (let i = 0; i <= 40; i++) {
      const th = i / 40 * Math.PI * 2;
      const x = L / 2 * (1 - Math.cos(th)) * (1 - 0.12 * Math.sin(th / 2)), z = dz * Math.sin(th) * (0.75 + 0.25 * Math.sin(th / 2));
      const p = new THREE.Vector3(x, 0, z), n = new THREE.Vector3(x - L / 2, 0, z * 1.6).normalize();
      const e = new THREE.Euler(0, yaw, tilt); p.applyEuler(e); n.applyEuler(e); p.z += 0.15 * W; pts.push(p); nrm.push(n);
    }
    parts.push(strip(pts, nrm, W, { uLen: uLen * IN, taper: t => 0.55 + 0.45 * Math.sin(Math.min(1, Math.sin(t * Math.PI) * 1.4) * Math.PI / 2) }));
  });
  [-1, 1].forEach(s => {  // tails
    const pts = [], nrm = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, tw = 0.5 * Math.sin(t * 3.2 + s);
      pts.push(new THREE.Vector3(s * (0.03 * W + t * T * 0.32 + Math.sin(t * 4) * 0.08 * W), -t * T, 0.1 * W + Math.sin(t * 2.6 + s) * 0.2 * W));
      nrm.push(new THREE.Vector3(Math.sin(tw) * s, 0, Math.cos(tw)).normalize());
    }
    parts.push(strip(pts, nrm, W * 0.92, { uLen: uLen * IN, notch: true }));
  });
  { // knot
    const pts = [], nrm = [], kr = W * 0.24;
    for (let i = 0; i <= 24; i++) { const th = i / 24 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(th) * kr, 0, Math.sin(th) * kr * 0.8 + 0.2 * W)); nrm.push(new THREE.Vector3(Math.cos(th), 0, Math.sin(th))); }
    parts.push(strip(pts, nrm, W * 0.8, { uLen: uLen * IN }));
  }
  return mergeGeometries(parts);
}

/* ---------------- Materials from the real products ---------------- */
const tartanTex = photoTex('tx_tartan4', [1, 1]);
const velvet = (id, c = 0x6c0a16) => mat(id, THREE.MeshPhysicalMaterial, { color: c, roughness: 0.85, sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color(0xff5064), side: THREE.DoubleSide, envMapIntensity: 0.4 });
const tartanMat = id => mat(id, THREE.MeshStandardMaterial, { map: tartanTex, color: new THREE.Color(1.35, 1.2, 1.2), roughness: 0.75, side: THREE.DoubleSide, envMapIntensity: 0.4 });
const burlapMat = mat('topper', THREE.MeshStandardMaterial, { map: photoTex('tx_burlap_paw', [1, 1]), roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.3 });

/* ---------------- Topper: 24" four-loop burlap paw bow with long streamers ---------------- */
{
  const ts = SZ('topper');
  const g = bowGeo({ ribbon: ts.ribbon_w || 4, span: ts.w || 24, tail: 9, loops: 4, uLen: 16, seed: 9 });
  const bow = new THREE.Mesh(g, burlapMat); bow.position.set(0, YTOP + 0.12, 0.12); bow.castShadow = true; scene.add(bow); tag(bow, 'topper'); addInstancePos('topper', bow.position);
  [-1, 1].forEach(s => {   // ribbon waterfall: two burlap streamers pour from the bow down to the giant doghouse roof
    const pts = [], nrm = [], yEnd = (SZ('doghouse_xl').h || 28) * IN + 0.15;
    for (let i = 0; i <= 260; i++) {
      const t = i / 260, y = YTOP - 0.08 - t * (YTOP - 0.08 - yEnd), th = Math.PI / 2 + s * (0.24 + t * 0.42) + 0.05 * Math.sin(t * 17 + s);
      const ph = t * 5.5, bulge = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 2);
      const r = rAt(y) * 0.97 + 0.05 + 0.16 * bulge * (0.4 + t), tw = 0.55 * Math.sin(ph * Math.PI * 2 + s);
      const rad = new THREE.Vector3(Math.cos(th), 0.15, Math.sin(th)).normalize(), tan = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      pts.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r)); nrm.push(rad.multiplyScalar(Math.cos(tw)).addScaledVector(tan, Math.sin(tw)).normalize());
    }
    const m = new THREE.Mesh(strip(pts, nrm, 4 * IN, { uLen: 16 * IN, notch: true }), burlapMat); m.castShadow = true; scene.add(m); tag(m, 'topper');
  });
}
/* ---------------- Gold crown: twelve gold glitter sprays fanned out behind the topper ---------------- */
{
  const beads = [], L = (SZ('gold_picks').h || 17) * IN * 0.85, c = new THREE.Vector3(0, YTOP + 0.05, -0.05);
  const stems = [], up = new THREE.Vector3(0, 1, 0), goldMat = mat('gold_picks', THREE.MeshStandardMaterial, { color: 0xd8b062, metalness: 0.9, roughness: 0.3, emissive: 0x3a2508, emissiveIntensity: 0.6 });
  for (let k = 0; k < 12; k++) {
    const a = -1.3 + k / 11 * 2.6 + R(-0.05, 0.05), dir = new THREE.Vector3(Math.sin(a), Math.cos(a) * 0.95, -0.22).normalize(), len = L * R(0.85, 1.05);
    stems.push({ p: c.clone().addScaledVector(dir, len * 0.5), rot: new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)), sv: new THREE.Vector3(1, len, 1), noMark: true });
    for (let b = 0; b < 22; b++) {          // glitter berries along the outer two-thirds, thicker toward the tip, plus little side sprigs
      const t = 0.35 + Math.pow(b / 22, 0.8) * 0.65, side = new THREE.Vector3(R(-1, 1), R(-1, 1), R(-1, 1)).multiplyScalar((b % 3 ? 0.35 : 1.1) * IN);
      beads.push({ p: c.clone().addScaledVector(dir, len * t).add(side), s: 0.4 / 2 * IN * R(0.8, 1.3), noMark: !(k === 6 && b === 10) });
    }
  }
  instanced(new THREE.CylinderGeometry(0.06 * IN, 0.09 * IN, 1, 5), goldMat, stems, null);
  instanced(new THREE.SphereGeometry(1, 16, 10), goldMat, beads, 'gold_picks');
}

/* ---------------- Tartan ribbon cascades (4" wired) with poufs ---------------- */
{
  const m = tartanMat('tartan_ribbon');
  const N = 5;
  for (let k = 0; k < N; k++) {
    const th0 = k * Math.PI * 2 / N + 0.25, pts = [], nrm = [];
    for (let i = 0; i <= 320; i++) {
      const t = i / 320, y = YTOP - 0.55 - t * (YTOP - Y0 - 0.55), th = th0 + 0.5 * t + 0.04 * Math.sin(t * 13 + k);
      const ph = t * 4.5 + k * 0.37, bulge = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 2.2);
      const r = rAt(y) * 0.95 + 0.02 + 0.11 * bulge * (0.5 + rAt(y) / RB * 0.5);
      const tw = 0.5 * Math.sin(ph * Math.PI * 2 + 1.2);
      const rad = new THREE.Vector3(Math.cos(th), 0.25 + bulge * 0.5 * Math.cos(ph * Math.PI * 2), Math.sin(th)).normalize(), tan = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      pts.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r)); nrm.push(rad.multiplyScalar(Math.cos(tw)).addScaledVector(tan, Math.sin(tw)).normalize());
    }
    const mesh = new THREE.Mesh(strip(pts, nrm, 4 * IN, { uLen: 4 * IN }), m); mesh.castShadow = true; scene.add(mesh); tag(mesh, 'tartan_ribbon');
    addInstancePos('tartan_ribbon', pts[160]);
  }
}

/* ---------------- Bows on the tree (3D, real sizes) ---------------- */
function placeBows(id, geo, material, n, yMin, yMax, sizeIn) {
  const list = []; for (let i = 0; i < n; i++) { const { p } = spot(sizeIn * IN, yMin, yMax, 1.0); list.push({ p, rot: new THREE.Euler(R(-0.12, 0.12), faceY(p), R(-0.15, 0.15)) }); }
  return instanced(geo, material, list, id);
}
const BIG = SZ('big_bows'), VB = SZ('velvet_bows'), PB = SZ('plaid_bows'), MB = SZ('mini_bows');
placeBows('big_bows', bowGeo({ ribbon: 4, span: BIG.w || 11, tail: (BIG.h || 18) - 3, seed: 3 }), tartanMat('big_bows'), COUNT('big_bows'), 1.6, 5.6, BIG.w || 11);
placeBows('velvet_bows', bowGeo({ ribbon: 1.6, span: VB.w || 5.1, tail: (VB.h || 10.2) - 2, seed: 5 }), velvet('velvet_bows'), 12 * COUNT('velvet_bows'), 1.3, 6.0, 6);

/* ---------------- Baubles ---------------- */
const SPH = new THREE.SphereGeometry(1, 40, 24);
const capGeo = (() => { const c = new THREE.CylinderGeometry(0.2, 0.22, 0.22, 16); c.translate(0, 1.0, 0); const l = new THREE.TorusGeometry(0.08, 0.02, 6, 12); l.translate(0, 1.16, 0); return mergeGeometries([c.toNonIndexed(), l.toNonIndexed()]); })();
const capMat = new THREE.MeshStandardMaterial({ color: 0xcaa25a, metalness: 1, roughness: 0.28 });
const glitterNormal = canvasTex(512, 512, (g, w) => { const im = g.createImageData(w, w); for (let i = 0; i < w * w; i++) { const a = Math.random() * Math.PI * 2, s = Math.random() < 0.6 ? Math.random() * 0.9 : 0; im.data[i * 4] = 128 + Math.cos(a) * s * 127; im.data[i * 4 + 1] = 128 + Math.sin(a) * s * 127; im.data[i * 4 + 2] = 255 * Math.sqrt(1 - s * s * 0.5); im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: [5, 3], srgb: false });
const glitterRough = canvasTex(256, 256, (g, w) => { const im = g.createImageData(w, w); for (let i = 0; i < w * w; i++) { const v = Math.random() < 0.35 ? 20 : 150 + Math.random() * 90; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: [5, 3], srgb: false });
const finish = {
  shiny: () => ({ color: 0xffffff, metalness: 0.7, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 }),
  matte: () => ({ color: 0xffffff, metalness: 0.35, roughness: 0.45, clearcoat: 0.3, envMapIntensity: 1.2 }),
  glitter: () => ({ color: 0xffffff, metalness: 0.8, roughness: 0.42, roughnessMap: glitterRough, normalMap: glitterNormal, normalScale: new THREE.Vector2(0.9, 0.9) }),
};
const ballSpots = [];
function balls(id, list) {   // list: [{ d (in), c, f }]
  const groups = {};
  list.forEach(b => { const r = b.d / 2 * IN; const { p } = spot(r * 2.2, Y0 + 0.25, YTOP - 0.25, 0.9); (groups[b.f] ||= []).push({ p, s: r, c: b.c, rot: new THREE.Euler(R(-0.2, 0.2), R(0, 6.28), R(-0.2, 0.2)) }); ballSpots.push({ p, s: r }); });
  Object.entries(groups).forEach(([f, l]) => {
    const tex = f.startsWith('tex:') ? f.slice(4) : null;
    const m = tex ? mat(id, THREE.MeshPhysicalMaterial, { map: PATTERN[tex], metalnessMap: PATTERN_M[tex], metalness: 1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, normalMap: glitterNormal, normalScale: new THREE.Vector2(0.35, 0.35) })
                  : mat(id, THREE.MeshPhysicalMaterial, finish[f]());
    instanced(SPH, m, l, id);
  });
}
// painted 3.15" red & gold balls from the set (stripes, swirls, lattice, half-glitter)
const PATTERN = {}, PATTERN_M = {};
['meridian', 'swirl', 'lattice', 'half'].forEach(kind => {
  const draw = (g, w, h, metal) => {
    g.fillStyle = metal ? '#1a1a1a' : '#9e0c18'; g.fillRect(0, 0, w, h);
    const gold = metal ? '#ffffff' : '#d8b25c'; g.strokeStyle = gold; g.fillStyle = gold;
    if (kind === 'meridian') { g.lineWidth = 7; for (let x = 0; x < w; x += w / 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } }
    if (kind === 'swirl') { g.lineWidth = 16; for (let x = -w; x < w * 2; x += w / 5) { g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + w * 0.2, h * 0.33, x - w * 0.1, h * 0.66, x + w * 0.15, h); g.stroke(); } }
    if (kind === 'lattice') { g.lineWidth = 5; for (let x = -w; x < w * 2; x += w / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w * 0.5, h); g.stroke(); g.beginPath(); g.moveTo(x, 0); g.lineTo(x - w * 0.5, h); g.stroke(); } }
    if (kind === 'half') { g.beginPath(); g.moveTo(0, h * 0.55); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.55 + Math.sin(x / w * Math.PI * 8) * h * 0.05); g.lineTo(w, h); g.lineTo(0, h); g.fill(); }
    if (!metal) noise(g, w, h, 9000, 0.5, ['#fff2c0', '#8a6420']);
  };
  PATTERN[kind] = canvasTex(512, 256, (g, w, h) => draw(g, w, h, false));
  PATTERN_M[kind] = canvasTex(512, 256, (g, w, h) => draw(g, w, h, true), { srgb: false });
});
{
  const pick = arr => arr[(rand() * arr.length) | 0];
  // red, forest green & gold 100-pc set x qty: 32 x 2.4", 36 x 1.6", 32 x 1.2"
  const rgg = []; (SZ('baubles_rgg').d_mix || [[2.4, 32], [1.6, 36], [1.2, 32]]).forEach(([d, n]) => { for (let i = 0; i < n * COUNT('baubles_rgg'); i++) rgg.push({ d, c: pick(['#b8121f', '#b8121f', '#17683d', '#17683d', '#d7a64a']), f: pick(['shiny', 'shiny', 'glitter', 'matte']) }); });
  balls('baubles_rgg', rgg);
  const ch = []; (SZ('baubles_champ').d_mix || [[2.4, 33], [1.6, 34], [1.2, 33]]).forEach(([d, n]) => { for (let i = 0; i < n * COUNT('baubles_champ'); i++) ch.push({ d, c: pick(['#d9c39a', '#cdb07a', '#e8dcc2', '#b9a07a']), f: pick(['shiny', 'matte', 'glitter']) }); });
  balls('baubles_champ', ch);
  const gr = []; for (let i = 0; i < 12 * COUNT('glitter_red'); i++) gr.push({ d: SZ('glitter_red').d || 3.15, f: 'tex:' + ['meridian', 'swirl', 'lattice', 'half'][i % 4] });
  balls('glitter_red', gr);
  const gc = []; for (let i = 0; i < 12 * COUNT('glitter_champ'); i++) gc.push({ d: SZ('glitter_champ').d || 3.15, c: '#dcc08a', f: 'glitter' }); balls('glitter_champ', gc);
  const gg = []; for (let i = 0; i < 6 * COUNT('glitter_green'); i++) gg.push({ d: SZ('glitter_green').d || 3.94, c: '#1b6b3c', f: 'glitter' }); balls('glitter_green', gg);
  const caps = ballSpots.map(b => ({ p: b.p, s: b.s, noMark: true }));
  instanced(capGeo, capMat, caps, null);
}

/* ---------------- DIY ornaments (3D, sized like the real blanks) ---------------- */
// Paw-print bauble discs: 4" bauble-shaped wood rounds painted both sides (look from the inspiration)
const discSpots = [];
{
  const s = SZ('paw_disc'); const h = (s.h || 4.3) * IN, w = (s.w || 3.5) * IN;
  const geo = new THREE.PlaneGeometry(h * CUT.paw_disc.w / CUT.paw_disc.h, h); geo.translate(0, -h / 2, 0);
  const m = mat('paw_disc', THREE.MeshStandardMaterial, { map: photoTex('paw_disc'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.65, metalness: 0.05 });
  const list = []; for (let i = 0; i < COUNT('paw_disc'); i++) { const { p } = spot(h * 1.1, Y0 + 0.3, YTOP - 0.5, 0.99); const rot = new THREE.Euler(R(-0.1, 0.05), faceY(p) + R(-0.35, 0.35), R(-0.12, 0.12)); list.push({ p, rot }); discSpots.push({ p, rot }); }
  instanced(geo, m, list, 'paw_disc');
}
// 3D foam-clay bones, 5" x 1.8" x 1", sealed satin cream
{
  const s = SZ('bones'); const L = (s.w || 5) * IN, H = (s.h || 1.8) * IN, T = (s.d || 1) * IN;
  const parts = [new THREE.CapsuleGeometry(H * 0.24, L * 0.62, 6, 14).rotateZ(Math.PI / 2)];
  [[-1, 1], [-1, -1], [1, 1], [1, -1]].forEach(([x, y]) => parts.push(new THREE.SphereGeometry(H * 0.29, 16, 12).translate(x * L * 0.37, y * H * 0.21, 0)));
  const geo = mergeGeometries(parts.map(p => p.toNonIndexed())); geo.scale(1, 1, T / (H * 0.55));
  const m = mat('bones', THREE.MeshPhysicalMaterial, { color: 0xEBDAB6, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const list = []; for (let i = 0; i < COUNT('bones'); i++) { const { p } = spot(L, Y0 + 0.3, YTOP - 0.4, 0.99); list.push({ p, rot: new THREE.Euler(R(-0.15, 0.15), faceY(p) + R(-0.4, 0.4), R(-0.5, 0.5)) }); }
  instanced(geo, m, list, 'bones');
}
// Doghouses: 4.3" gabled birdhouses painted barn-red brick, cream roof, arched door, cream paw
{
  const s = SZ('doghouse'); const H = (s.h || 4.3) * IN, W = (s.w || 3.4) * IN, D = (s.d || 2.7) * IN, wallH = H * 0.56;
  const brick = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#3c0f0b'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 22) for (let x = (y / 22) % 2 ? -26 : 0; x < w; x += 52) { g.fillStyle = `hsl(${2 + Math.random() * 6}, ${55 + Math.random() * 15}%, ${26 + Math.random() * 8}%)`; g.fillRect(x + 2, y + 2, 48, 18); }
    noise(g, w, w, 2500, 0.2, ['#000', '#c86a5a']);
  }, { repeat: [1.4, 1.4] });
  const frontTex = canvasTex(512, 640, (g, w, h) => {
    g.drawImage(brick.image, 0, 0, w, h);
    const dw = w * 0.46, dh = h * 0.42, dx = w / 2, by = h;   // arched door with cream trim and warm glow inside
    g.fillStyle = '#efe0bf'; g.beginPath(); g.moveTo(dx - dw / 2 - 18, by); g.lineTo(dx - dw / 2 - 18, by - dh + dw / 2); g.arc(dx, by - dh + dw / 2, dw / 2 + 18, Math.PI, 0); g.lineTo(dx + dw / 2 + 18, by); g.fill();
    const ig = g.createRadialGradient(dx, by - 20, 5, dx, by - dh * 0.5, dh); ig.addColorStop(0, '#f2a94a'); ig.addColorStop(0.35, '#6b3416'); ig.addColorStop(1, '#1a0b05');
    g.fillStyle = ig; g.beginPath(); g.moveTo(dx - dw / 2, by); g.lineTo(dx - dw / 2, by - dh + dw / 2); g.arc(dx, by - dh + dw / 2, dw / 2, Math.PI, 0); g.lineTo(dx + dw / 2, by); g.fill();
    g.fillStyle = '#efe0bf'; drawPaw(g, w / 2, h * 0.3, w * 0.24, '#efe0bf');
  }, { clamp: true });
  const shingle = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#d9c497'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 32) for (let x = (y / 32) % 2 ? -24 : 0; x < w; x += 48) { g.fillStyle = `hsl(40, ${38 + Math.random() * 12}%, ${72 + Math.random() * 10}%)`; g.fillRect(x + 1, y, 46, 30); g.fillStyle = 'rgba(80,55,25,.35)'; g.fillRect(x, y + 28, 48, 3); g.fillRect(x, y, 2, 30); }
    noise(g, w, w, 1500, 0.15, ['#5a3d1d']);
  }, { repeat: [1.2, 1.2] });
  const body = new THREE.BoxGeometry(W, wallH, D); body.translate(0, wallH / 2, 0);
  const gable = new THREE.Shape(); gable.moveTo(-W / 2, 0); gable.lineTo(W / 2, 0); gable.lineTo(W / 2, wallH); gable.lineTo(0, H * 0.94); gable.lineTo(-W / 2, wallH); gable.closePath();
  const front = new THREE.ShapeGeometry(gable); { const uv = front.attributes.uv, p = front.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, p.getY(i) / (H * 0.94)); } front.translate(0, 0, D / 2 + 0.001);
  const back = new THREE.ShapeGeometry(gable); back.rotateY(Math.PI); back.translate(0, 0, -D / 2 - 0.001);
  const slope = Math.atan2(H * 0.94 - wallH, W / 2), rl = Math.hypot(W / 2, H * 0.94 - wallH) * 1.18;
  const roofs = [-1, 1].map(sg => { const r = new THREE.BoxGeometry(rl, 0.32 * IN, D * 1.25); r.rotateZ(-sg * slope); r.translate(sg * W / 4.2, wallH + (H * 0.94 - wallH) / 2 + 0.2 * IN, 0); return r; });
  const geoBrick = mergeGeometries([body.toNonIndexed(), back.toNonIndexed()]);
  const geoRoof = mergeGeometries(roofs.map(r => r.toNonIndexed()));
  const mBrick = mat('doghouse', THREE.MeshStandardMaterial, { map: brick, roughness: 0.8 });
  const mFront = mat('doghouse', THREE.MeshStandardMaterial, { map: frontTex, roughness: 0.8, side: THREE.DoubleSide });
  const mRoof = mat('doghouse', THREE.MeshStandardMaterial, { map: shingle, roughness: 0.75 });
  const list = []; for (let i = 0; i < COUNT('doghouse'); i++) { const { p } = spot(H * 1.1, Y0 + 0.4, YTOP - 0.7, 0.99); list.push({ p: p.clone().add(new THREE.Vector3(0, -H * 0.5, 0)), rot: new THREE.Euler(0, faceY(p) + R(-0.3, 0.3), R(-0.06, 0.06)) }); }
  instanced(geoBrick, mBrick, list, 'doghouse'); instanced(front, mFront, list.map(l => ({ ...l, noMark: true })), 'doghouse'); instanced(geoRoof, mRoof, list.map(l => ({ ...l, noMark: true })), 'doghouse');
}
// Mini velvet bows on top of every paw disc (and one on the jar later)
const miniBowGeo = bowGeo({ ribbon: 1, span: MB.w || 3.5, tail: (MB.h || 3.5) - 1, seed: 11 });
const miniBowMat = velvet('mini_bows');
instanced(miniBowGeo, miniBowMat, discSpots.map(({ p, rot }) => ({ p: p.clone().add(new THREE.Vector3(0, 0.1 * IN, 0)).addScaledVector(new THREE.Vector3(Math.sin(rot.y), 0, Math.cos(rot.y)), 0.012), rot })), 'mini_bows');

/* ---------------- Photo cutouts (rotate on the vertical axis to face the viewer) ---------------- */
const cards = [];
function photoCard(name, id, heightIn, pos, { anchor = 'bottom', emissive = 0.38, mark = true } = {}) {
  const c = CUT[name], h = heightIn * IN, w = h * c.w / c.h;
  const g = new THREE.PlaneGeometry(w, h); g.translate(0, anchor === 'top' ? -h / 2 : anchor === 'center' ? 0 : h / 2, 0);
  const tex = photoTex(name);
  const m = mat(id, THREE.MeshStandardMaterial, { map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive, envMapIntensity: 0.2 });
  const mesh = new THREE.Mesh(g, m); mesh.position.copy(pos); mesh.castShadow = true; scene.add(mesh); cards.push(mesh);
  mesh.userData.itemId = id; pickables.push(mesh); if (mark) addInstancePos(id, pos.clone().add(new THREE.Vector3(0, anchor === 'bottom' ? h / 2 : anchor === 'top' ? -h / 2 : 0, 0)));
  return mesh;
}
function updateCards() { for (const c of cards) c.rotation.y = Math.atan2(camera.position.x - c.position.x, camera.position.z - c.position.z); }
// plush pets sitting in the branches (they sit, so anchor at the bottom, tucked a little into the tree)
for (let i = 0; i < Math.max(0, COUNT('golden') - 1); i++) { const { p } = spotFront(SZ('golden').h * IN, 1.9, 3.6, 1.0, 0.9); photoCard('golden_tree', 'golden', SZ('golden').h || 10, p.clone().add(new THREE.Vector3(0, -0.12, 0))); }
for (let i = 0; i < COUNT('tabby_grey'); i++) { const { p } = spotFront(SZ('tabby_grey').h * IN * 1.4, 3.4, 5.2, 1.0, 1.2); photoCard('tabby_mini_s', 'tabby_grey', SZ('tabby_grey').h || 4.7, p.clone().add(new THREE.Vector3(0, -0.06, 0))); }
// knit mini stockings hang from their loops
['stock_red', 'stock_green', 'stock_cream'].forEach((n, k) => { for (let i = 0; i < 4 * COUNT('stockings'); i++) { const { p } = spot(SZ('stockings').h * IN, 1.4, 5.5, 1.0); photoCard(n, 'stockings', (SZ('stockings').h || 4.3) * 1.25, p, { anchor: 'top' }); } });
// picks tucked into the branches: glitter red sprays, gold sprigs, pine & berry
function sprays(id, n, color, stemsPer, beadIn, lenIn) {   // glitter spray picks: thin stems tipped with glitter beads
  const beads = []; const L = lenIn * IN;
  for (let i = 0; i < n; i++) {
    const { p, th } = spot(L * 0.5, 1.4, 6.3, 0.86);
    for (let k = 0; k < stemsPer; k++) {
      const dir = new THREE.Vector3(Math.cos(th + R(-0.5, 0.5)), R(0, 0.8), Math.sin(th + R(-0.5, 0.5))).normalize();
      for (let b = 0; b < 9; b++) { const t = 0.55 + b / 9 * 0.45; beads.push({ p: p.clone().addScaledVector(dir, L * t).add(new THREE.Vector3(R(-1, 1), R(-1, 1), R(-1, 1)).multiplyScalar(0.7 * IN)), s: beadIn / 2 * IN * R(0.8, 1.2), noMark: !(k === 0 && b === 3) }); }
    }
  }
  instanced(SPH, mat(id, THREE.MeshStandardMaterial, { color, metalness: 0.85, roughness: 0.35, roughnessMap: glitterRough, normalMap: glitterNormal }), beads, id);
}
sprays('gold_picks', Math.max(0, 28 * COUNT('gold_picks') - 12), 0xd4ad5c, 3, 0.4, 6);   // 12 of the pack form the crown
for (let i = 0; i < 16; i++) { const { p } = spot(0.35, 1.3, 5.8, 0.95); photoCard('pine_pick', 'pine_picks', (SZ('pine_picks').h || 4) * 1.3, p, { anchor: 'center' }); }
// glossy red berry clusters (0.6" berries on 7" stems)
{
  const list = [], bd = (SZ('glossy_berries').berry_d || 0.6) * IN;
  for (let i = 0; i < 48 * COUNT('glossy_berries'); i++) { const { p, th } = spot(0.25, 1.3, 6.3, 0.97); const out = new THREE.Vector3(Math.cos(th), 0, Math.sin(th)); for (let k = 0; k < 7; k++) list.push({ p: p.clone().add(new THREE.Vector3(R(-1, 1) * 1.1 * IN, R(-0.6, 1.6) * IN, R(-1, 1) * 1.1 * IN)).addScaledVector(out, 0.03), s: bd / 2 * R(0.85, 1.1), noMark: k > 0 }); }
  instanced(SPH, mat('glossy_berries', THREE.MeshPhysicalMaterial, { color: 0x9d0a12, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }), list, 'glossy_berries');
}

/* ---------------- Under the tree ---------------- */
function giftBox([wi, di, hi], faceMat, ribbonMat, x, z, ry, id, bow) {
  const w = wi * IN, d = di * IN, h = hi * IN, g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faceMat); b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b);
  const rw = (ribbonMat === tartanBoxRibbon ? 4 : 2.5) * IN;
  [[w * 1.006, h * 1.006, rw], [rw, h * 1.006, d * 1.006]].forEach(([a, bb, c]) => { const r = new THREE.Mesh(new THREE.BoxGeometry(a, bb, c), ribbonMat); r.position.y = h / 2; g.add(r); });
  g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); tag(g, id); addInstancePos(id, new THREE.Vector3(x, h * 0.7, z));
  contactShadow(x, z, w * 1.5, d * 1.5, ry, 0.7);
  if (bow) { const m = new THREE.Mesh(bow.geo, bow.mat); m.position.set(x, h + 0.01, z); m.rotation.set(-1.25, ry, 0); m.castShadow = true; scene.add(m); tag(m, bow.id); }
  return g;
}
const boxTex = (name, wi, hi) => photoTex(name, [+(wi / 8).toFixed(2), +(hi / 8).toFixed(2)]);
const tartanBoxRibbon = tartanMat('tartan_ribbon');
{
  const B = (SZ('gift_boxes').boxes || [[14, 11, 12], [12, 10, 9], [10, 10, 10], [16, 12, 7], [9, 9, 6]]);
  const velvetRib = velvet('velvet_ribbon', 0x7a0b18);
  const tw = s => mat('tartan_wrap', THREE.MeshStandardMaterial, { map: boxTex('tx_tartan_wrap', s[0], s[2]), roughness: 0.42 });
  const kp = s => mat('paw_wrap', THREE.MeshStandardMaterial, { map: boxTex('tx_paw_wrap', s[0], s[2]), roughness: 0.85 });
  const velvetBow = { geo: bowGeo({ ribbon: 2.5, span: 8, tail: 5, seed: 21 }), mat: velvetRib, id: 'velvet_ribbon' };
  const burlapBow = { geo: bowGeo({ ribbon: 4, span: 9, tail: 6, uLen: 16, seed: 23 }), mat: burlapMat, id: 'topper' };
  const tartanBow = { geo: bowGeo({ ribbon: 4, span: 9, tail: 6, seed: 25 }), mat: tartanBoxRibbon, id: 'big_bows' };
  // the four Canadian Tire moving boxes, at their real sizes: A 18x11x12, B 16x16x16, C 16x16x10, D 18x11x7
  giftBox(B[0], tw(B[0]), velvetRib, -1.6, 1.05, 0.35, 'tartan_wrap', velvetBow);
  giftBox(B[1], tw(B[1]), tartanBoxRibbon, -1.45, -0.7, 0.15, 'gift_boxes', tartanBow);
  giftBox(B[2], tw(B[2]), velvetRib, 1.6, 0.25, -0.45, 'tartan_wrap', velvetBow);
  giftBox(B[3], kp(B[3]), tartanBoxRibbon, 0.95, 1.45, -0.2, 'paw_wrap', burlapBow);
  addInstancePos('gift_boxes', new THREE.Vector3(-1.5, 0.5, 0.95));
}
// cream sherpa bone pillow, 15" x 9" x 3", with the black felt paw
{
  const s = SZ('bone_pillow'); const L = (s.w || 15) * IN, H = (s.d || 9) * IN, T = (s.h || 3) * IN;
  const sherpa = canvasTex(256, 256, (g, w) => { g.fillStyle = '#e9e1d2'; g.fillRect(0, 0, w, w); for (let i = 0; i < 1400; i++) { const x = Math.random() * w, y = Math.random() * w, r = 2 + Math.random() * 4; g.fillStyle = Math.random() < .5 ? '#f6f0e4' : '#cfc4b0'; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); } }, { repeat: [3, 2] });
  const parts = [];
  for (let k = -3; k <= 3; k++) parts.push(new THREE.SphereGeometry(H * 0.27, 20, 14).translate(k * L * 0.08, 0, 0));   // plump shaft
  [[-1, 1], [-1, -1], [1, 1], [1, -1]].forEach(([x, y]) => parts.push(new THREE.SphereGeometry(H * 0.3, 20, 14).translate(x * L * 0.33, y * H * 0.2, 0)));
  const geo = mergeGeometries(parts.map(p => p.toNonIndexed())); geo.scale(1, 1, T / (H * 0.6));
  const m = mat('bone_pillow', THREE.MeshStandardMaterial, { map: sherpa, bumpMap: sherpa, bumpScale: 3, roughness: 1 });
  const g = new THREE.Group(); const body = new THREE.Mesh(geo, m); body.castShadow = true; g.add(body);
  const pawT = canvasTex(256, 256, (c, w) => { c.clearRect(0, 0, w, w); drawPaw(c, 128, 136, 210, '#141414'); }, { clamp: true });
  const paw = new THREE.Mesh(new THREE.PlaneGeometry(4.5 * IN, 4.5 * IN), mat('felt', THREE.MeshStandardMaterial, { map: pawT, transparent: true, alphaTest: 0.3, roughness: 1 }));
  paw.position.set(-L * 0.18, 0.2 * IN, T * 0.52); g.add(paw);
  g.position.set(-1.95, H * 0.42, 2.7); g.rotation.set(-0.35, 0.45, 0.06); scene.add(g); tag(g, 'bone_pillow'); addInstancePos('bone_pillow', g.position);
  contactShadow(-1.95, 2.65, L * 1.3, H * 1.1, 0.45, 0.75);
}
// red glazed bowl with white dots, 5.9" x 1.8", scalloped rim
{
  const s = SZ('bowl'); const r = (s.w || 5.9) / 2 * IN, h = (s.h || 1.8) * IN;
  const prof = [[0, 0], [r * 0.72, 0], [r * 0.8, h * 0.06], [r * 0.98, h * 0.85], [r, h], [r * 0.93, h], [r * 0.76, h * 0.2], [0, h * 0.16]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 64); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > h * 0.6) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + Math.abs(Math.sin(a * 6)) * h * 0.12 * ((y - h * 0.6) / (h * 0.4))); } }
  geo.computeVertexNormals();
  const dots = canvasTex(1024, 256, (g, w, hh) => { g.fillStyle = '#b5101c'; g.fillRect(0, 0, w, hh); g.fillStyle = '#fbf7ef'; for (let y = 40; y < hh; y += 90) for (let x = (y / 90) % 2 ? 60 : 0; x < w; x += 120) { g.beginPath(); g.arc(x, y, 14, 0, 6.28); g.fill(); } [w * 0.22, w * 0.72].forEach(x => { g.fillStyle = '#b5101c'; g.fillRect(x - 70, 20, 140, 200); drawPaw(g, x, 125, 120, '#fbf7ef'); }); });
  const bowl = new THREE.Mesh(geo, mat('bowl', THREE.MeshPhysicalMaterial, { map: dots, roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide }));
  bowl.position.set(-0.78, 0, 3.95); bowl.castShadow = true; scene.add(bowl); tag(bowl, 'bowl'); addInstancePos('bowl', new THREE.Vector3(-0.78, h, 3.95));
  contactShadow(-0.78, 3.95, r * 3, r * 3, 0, 0.7);
}
// gift basket: natural wicker 13" x 10.5" x 6", 11" to the handle
{
  const s = SZ('basket'); const bw = (s.w || 13) * IN, bd = (s.d || 10.5) * IN, bh = (s.h || 6) * IN, hh = (s.handle_h || 11) * IN;
  const bx = 2.0, bz = 2.35, ry = -0.55;
  const g = new THREE.Group(); g.position.set(bx, 0, bz); g.rotation.y = ry; scene.add(g);
  const wick = mat('basket', THREE.MeshStandardMaterial, { map: photoTex('tx_wicker2', [4, 1]), roughness: 0.85, side: THREE.DoubleSide });
  const liner = mat('basket', THREE.MeshStandardMaterial, { color: 0xEFE7D8, roughness: 1, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(bw / 2, bw / 2 * 0.86, bh, 48, 1, true), wick); wall.position.y = bh / 2; wall.scale.z = bd / bw; g.add(wall);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(bw / 2 * 0.86, 48), wick); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.005; bottom.scale.y = bd / bw; g.add(bottom);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(bw / 2 * 1.03, bw / 2 * 1.0, 1.6 * IN, 48, 1, true), liner); cuff.position.y = bh - 0.5 * IN; cuff.scale.z = bd / bw; g.add(cuff);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(bw * 0.36, 0.35 * IN, 8, 40, Math.PI), mat('basket', THREE.MeshStandardMaterial, { map: photoTex('tx_wicker2', [6, 1]), roughness: 0.8 })); handle.position.y = bh; handle.scale.y = (hh - bh) / (bw * 0.36); g.add(handle);
  tag(g, 'basket'); addInstancePos('basket', new THREE.Vector3(bx, bh * 0.6, bz)); contactShadow(bx, bz, bw * 1.5, bd * 1.5, ry, 0.8);
  g.updateMatrixWorld(true); const W = (x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
  // red flannel paw-print throw (50 x 60 in), folded and draped over the front rim
  const bl = new THREE.PlaneGeometry(bw * 0.8, bw * 0.75, 28, 28); const pa = bl.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); const fold = y > 0 ? 0 : -y; pa.setZ(i, -fold * 1.05 + Math.sin(x * 30) * 0.012 + Math.sin(y * 22) * 0.01); pa.setY(i, y > 0 ? y : y * 0.25); }
  bl.computeVertexNormals();
  const blanket = new THREE.Mesh(bl, mat('blanket', THREE.MeshStandardMaterial, { map: photoTex('tx_blanket', [1.2, 1.2]), roughness: 1, side: THREE.DoubleSide }));
  blanket.rotation.set(-1.25, 0, 0.1); blanket.position.set(bw * 0.1, bh + 0.01, bd * 0.18); g.add(blanket); tag(blanket, 'blanket'); addInstancePos('blanket', W(bw * 0.1, bh, bd * 0.4));
  // glass jar 7" x 9.9" with lid, filled with the faux biscuits
  const js = SZ('jar'); const jr = (js.w || 7) / 2 * IN, jh = (js.h || 9.9) * IN;
  const jp = [[0.001, 0], [jr * 0.85, 0], [jr, jh * 0.12], [jr * 1.02, jh * 0.55], [jr * 0.93, jh * 0.84], [jr * 0.75, jh * 0.88], [jr * 0.75, jh * 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = mat('jar', THREE.MeshPhysicalMaterial, { color: 0xeef6f2, metalness: 0, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6, specularIntensity: 1 });
  const jar = new THREE.Group(); jar.position.copy(new THREE.Vector3(-bw * 0.18, bh * 0.45, -bd * 0.1)); g.add(jar);
  jar.add(new THREE.Mesh(new THREE.LatheGeometry(jp, 40), glass));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(jr * 0.82, jr * 0.82, 0.45 * IN, 36), glass); lid.position.y = jh * 0.92; jar.add(lid);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.7 * IN, 20, 14), glass); knob.position.y = jh * 0.92 + 0.7 * IN; jar.add(knob);
  tag(jar, 'jar'); addInstancePos('jar', W(-bw * 0.18, bh * 0.45 + jh * 0.5, -bd * 0.1));
  { // faux biscuits stacked inside (foam clay, biscuit-tan)
    const bs = SZ('faux_treats'); const bl2 = (bs.w || 3) * IN * 0.9, bh2 = (bs.h || 1.2) * IN;
    const parts = [new THREE.CapsuleGeometry(bh2 * 0.25, bl2 * 0.6, 4, 10).rotateZ(Math.PI / 2)]; [[-1, 1], [-1, -1], [1, 1], [1, -1]].forEach(([x, y]) => parts.push(new THREE.SphereGeometry(bh2 * 0.28, 10, 8).translate(x * bl2 * 0.38, y * bh2 * 0.2, 0)));
    const bgeo = mergeGeometries(parts.map(p => p.toNonIndexed())); bgeo.scale(1, 1, 0.55);
    const list = []; jar.updateMatrixWorld(true);
    for (let i = 0; i < Math.min(26, COUNT('faux_treats')); i++) { const y = 0.25 * IN + i * jh * 0.026, a = R(0, 6.28), rr = R(0, jr * 0.5); list.push({ p: jar.localToWorld(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr)), rot: new THREE.Euler(R(-1.2, 1.2), R(0, 6.28), R(-0.6, 0.6)), noMark: i > 0 }); }
    instanced(bgeo, mat('faux_treats', THREE.MeshStandardMaterial, { color: 0xC8955A, roughness: 0.85 }), list, 'faux_treats');
  }
  const jb = new THREE.Mesh(miniBowGeo, miniBowMat); jb.scale.setScalar(1.4); jb.position.copy(W(-bw * 0.18, bh * 0.45 + jh * 0.86, -bd * 0.1 + jr)); jb.rotation.y = ry; scene.add(jb); tag(jb, 'mini_bows');
  // red tennis balls 2.58"
  const felt = canvasTex(256, 128, (c, w, hh) => { c.fillStyle = '#b01322'; c.fillRect(0, 0, w, hh); noise(c, w, hh, 5000, 0.35, ['#e04050', '#70060f']); c.strokeStyle = '#f4ece0'; c.lineWidth = 5; c.beginPath(); for (let x = 0; x <= w; x += 4) c.lineTo(x, hh / 2 + Math.sin(x / w * Math.PI * 4) * hh * 0.28); c.stroke(); });
  const bm = mat('balls', THREE.MeshStandardMaterial, { map: felt, roughness: 1, bumpMap: felt, bumpScale: 1 }); const brd = (SZ('balls').d || 2.58) / 2 * IN;
  [[bw * 0.1, bh + brd * 0.6, bd * 0.05], [bw * 0.62, brd, bd * 0.75]].forEach(([x, y, z], i) => { const b = new THREE.Mesh(SPH, bm); b.scale.setScalar(brd); b.rotation.set(R(0, 3), R(0, 3), 0); b.position.set(x, y, z); b.castShadow = true; g.add(b); tag(b, 'balls'); if (!i) addInstancePos('balls', W(x, y, z)); });
  // Homes Alive Pets gift cards
  [0, 1].forEach(k => { const c = new THREE.Mesh(new THREE.BoxGeometry(3.4 * IN, 2.1 * IN, 0.003), [0, 1, 2, 3, 4, 5].map(f => f === 4 ? mat('gift_card', THREE.MeshStandardMaterial, { map: photoTex('tx_card'), roughness: 0.4 }) : mat('gift_card', THREE.MeshStandardMaterial, { color: 0xFBFAF6, roughness: 0.4 })));
    c.position.set(bw * 0.08 + k * 0.06, bh + 1.2 * IN + k * 0.02, -bd * 0.12 - k * 0.03); c.rotation.set(-0.25, 0.1 - k * 0.15, 0.05 - k * 0.12); g.add(c); tag(c, 'gift_card'); });
  addInstancePos('gift_card', W(bw * 0.1, bh + 1.4 * IN, -bd * 0.1));
  // plush bone toy (8.7") and rope toys tucked in the back
  photoCard('small_bone', 'holiday_toy', (SZ('holiday_toy').d || 5.7), W(bw * 0.28, bh * 0.75, -bd * 0.25));
  photoCard('rope_cane', 'rope', 8, W(bw * 0.38, bh * 0.6, -bd * 0.05));
  photoCard('rope_knot', 'rope', 5, W(bw * 0.42, bh * 0.7, bd * 0.2), { mark: false });
}
// the golden retriever and tabby plush sitting together in their real fringed tartan scarves
/* ---------------- Giant doghouse centrepiece (DIY): 26" x 22" x 28", sign, the family dog in the doorway ---------------- */
{
  const S = SZ('doghouse_xl'), W = (S.w || 26) * IN, D = (S.d || 22) * IN, H = (S.h || 28) * IN, wallH = H * 0.57, doorW = (S.door_w || 11) * IN, doorH = (S.door_h || 14) * IN;
  const X = 0, Z = RB + D / 2 + 0.12, frontZ = Z + D / 2;
  const brick = (rx, ry) => canvasTex(512, 512, (g, w) => {                  // painted brick: ~2.4" x 1.5" bricks (texture = 18")
    g.fillStyle = '#3a0e0a'; g.fillRect(0, 0, w, w); const bh = w / 12, bw = bh * 2.4;
    for (let y = 0; y < w; y += bh) for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < w; x += bw) { g.fillStyle = `hsl(${2 + Math.random() * 6}, ${55 + Math.random() * 15}%, ${25 + Math.random() * 9}%)`; g.fillRect(x + 3, y + 3, bw - 6, bh - 6); }
    noise(g, w, w, 9000, 0.18, ['#000', '#c86a5a']);
  }, { repeat: [rx, ry] });
  const frontTex = canvasTex(1040, 1120, (g, w, h) => {                       // front: bricks, arched door with cream trim, cream paw on the gable
    const b = brick(1, 1).image; for (let x = 0; x < w; x += w * 18 / 26) for (let y = 0; y < h; y += h * 18 / 28) g.drawImage(b, x, y, w * 18 / 26, h * 18 / 28);
    const dw = w * (S.door_w || 11) / 26, dh = h * (S.door_h || 14) / 28, cx = w / 2, trim = w * 1.3 / 26;
    g.fillStyle = '#efe0bf'; g.beginPath(); g.moveTo(cx - dw / 2 - trim, h); g.lineTo(cx - dw / 2 - trim, h - dh + dw / 2); g.arc(cx, h - dh + dw / 2, dw / 2 + trim, Math.PI, 0); g.lineTo(cx + dw / 2 + trim, h); g.fill();
    g.fillStyle = '#1a0d07'; g.beginPath(); g.moveTo(cx - dw / 2, h); g.lineTo(cx - dw / 2, h - dh + dw / 2); g.arc(cx, h - dh + dw / 2, dw / 2, Math.PI, 0); g.lineTo(cx + dw / 2, h); g.fill();
    drawPaw(g, cx, h * (1 - 24 / 28), w * 3.6 / 26, '#efe0bf');
  }, { clamp: true });
  const shingle = canvasTex(512, 512, (g, w) => {                             // cream shingles, 4" courses (texture = 16")
    g.fillStyle = '#d6c08f'; g.fillRect(0, 0, w, w); const ch = w / 4, sw = ch * 0.75;
    for (let y = 0; y < w; y += ch) for (let x = (y / ch) % 2 ? -sw / 2 : 0; x < w; x += sw) { g.fillStyle = `hsl(41, ${36 + Math.random() * 12}%, ${72 + Math.random() * 10}%)`; g.fillRect(x + 2, y, sw - 3, ch - 4); g.fillStyle = 'rgba(80,55,25,.4)'; g.fillRect(x, y + ch - 5, sw, 5); }
    noise(g, w, w, 6000, 0.14, ['#5a3d1d']);
  }, { repeat: [1, 1] });
  const g = new THREE.Group(); g.position.set(X, 0, Z); scene.add(g);
  const bm = mat('doghouse_xl', THREE.MeshStandardMaterial, { map: brick(W / (18 * IN), wallH / (18 * IN)), roughness: 0.85 });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, wallH, D), [bm, bm, hidden, hidden, hidden, bm]); body.position.y = wallH / 2; g.add(body);
  const inside = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, wallH * 0.97, D * 0.94), mat('doghouse_xl', THREE.MeshStandardMaterial, { color: 0x2a160c, roughness: 1, side: THREE.BackSide })); inside.position.y = wallH * 0.49; g.add(inside);
  const gableS = new THREE.Shape(); gableS.moveTo(-W / 2, 0); gableS.lineTo(W / 2, 0); gableS.lineTo(W / 2, wallH); gableS.lineTo(0, H * 0.93); gableS.lineTo(-W / 2, wallH); gableS.closePath();
  const door = new THREE.Path(); door.moveTo(-doorW / 2, 0); door.lineTo(-doorW / 2, doorH - doorW / 2); door.absarc(0, doorH - doorW / 2, doorW / 2, Math.PI, 0, true); door.lineTo(doorW / 2, 0); door.closePath();
  const frontShape = gableS.clone(); frontShape.holes.push(door);
  const fg = new THREE.ShapeGeometry(frontShape, 24); { const uv = fg.attributes.uv, pp = fg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pp.getX(i) + W / 2) / W, pp.getY(i) / H); }
  const front = new THREE.Mesh(fg, mat('doghouse_xl', THREE.MeshStandardMaterial, { map: frontTex, roughness: 0.82 })); front.position.z = D / 2 + 0.002; g.add(front);
  const back = new THREE.Mesh(new THREE.ShapeGeometry(gableS), bm); back.rotation.y = Math.PI; back.position.z = -D / 2 - 0.002; g.add(back);
  const slope = Math.atan2(H * 0.93 - wallH, W / 2), rl = Math.hypot(W / 2, H * 0.93 - wallH) + 2.5 * IN;
  const rm = mat('doghouse_xl', THREE.MeshStandardMaterial, { map: shingle, roughness: 0.8 }); rm.map.repeat.set(rl / (16 * IN), (D + 4 * IN) / (16 * IN));
  [-1, 1].forEach(sg => { const r = new THREE.Mesh(new THREE.BoxGeometry(rl, 1 * IN, D + 4 * IN), rm); r.rotation.z = -sg * slope; r.position.set(sg * (rl / 2 - 1.2 * IN) * Math.cos(slope), H * 0.93 - (rl / 2 - 1.2 * IN) * Math.sin(slope) + 0.6 * IN, 0); g.add(r); });
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(2.2 * IN, 1.4 * IN, D + 4.5 * IN), mat('doghouse_xl', THREE.MeshStandardMaterial, { color: 0xe7d6b0, roughness: 0.7 })); ridge.position.y = H * 0.93 + 1.1 * IN; g.add(ridge);
  // the hand-painted sign under the roof edge
  const signT = canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#ecdcb6'; c.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(150,110,60,${0.05 + Math.random() * 0.08})`; c.lineWidth = 1 + Math.random() * 2; c.beginPath(); const y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3); c.stroke(); }
    c.strokeStyle = '#8b1a1f'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.textAlign = 'center'; c.fillStyle = '#1d4a35'; c.font = 'italic 700 52px Georgia, "Times New Roman", serif'; c.fillText('Home for the', w / 2, 86);
    c.fillStyle = '#8b1a1f'; c.font = '700 92px Georgia, "Times New Roman", serif'; c.fillText('HOWLIDAYS', w / 2, 184);
    drawPaw(c, 92, 118, 80, '#1d4a35', -0.3); drawPaw(c, w - 92, 118, 80, '#1d4a35', 0.3);
  }, { clamp: true });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(16 * IN, 4 * IN, 0.25 * IN), [0, 1, 2, 3, 4, 5].map(f => f === 4 ? mat('doghouse_xl', THREE.MeshStandardMaterial, { map: signT, roughness: 0.75 }) : mat('doghouse_xl', THREE.MeshStandardMaterial, { color: 0xd9c79f, roughness: 0.8 })));
  sign.position.set(0, wallH + 1.4 * IN, D / 2 + 0.3 * IN); g.add(sign);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  tag(g, 'doghouse_xl'); addInstancePos('doghouse_xl', new THREE.Vector3(X, H * 0.6, Z));
  contactShadow(X, Z, W * 1.45, D * 1.45, 0, 0.85);
  // the family dog sits in the doorway in the fringed tartan scarf; the tabby sits beside it
  photoCard('golden_scarf', 'golden', SZ('golden').h || 10, new THREE.Vector3(X, 0, frontZ + 0.07));
  photoCard('tabby_cat_s', 'tabby_brown', SZ('tabby_brown').h || 6, new THREE.Vector3(X + W * 0.62, 0, frontZ + 0.22));
  contactShadow(X, frontZ + 0.1, 0.85, 0.5, 0, 0.8); contactShadow(X + W * 0.62, frontZ + 0.24, 0.55, 0.32, 0, 0.8);
  addInstancePos('bandanas', new THREE.Vector3(X, 0.45, frontZ + 0.1)); addInstancePos('bandanas', new THREE.Vector3(X + W * 0.62, 0.32, frontZ + 0.24));
}

scene.traverse(o => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial) [].concat(o.material).forEach(m => { if (m.envMapIntensity === 1) m.envMapIntensity = 0.7; }); });

/* ---------------- Scale: a person at a chosen height and an 8 ft measuring rod ---------------- */
const frameHooks = [];
const PERSON = { heightIn: 67, model: null, raw: null, mixer: null };
const person = new THREE.Group(); person.visible = false; person.position.set(-2.75, 0, 1.55); person.rotation.y = 0.5; scene.add(person);
function setPersonHeight(inches) {
  PERSON.heightIn = inches; if (!PERSON.model) return;
  const s = inches * IN / (PERSON.raw.max.y - PERSON.raw.min.y); PERSON.model.scale.setScalar(s); PERSON.model.position.y = -PERSON.raw.min.y * s;
  renderer.shadowMap.needsUpdate = true;
}
if (window.HOWL_PERSON) {
  const bin = Uint8Array.from(atob(window.HOWL_PERSON), c => c.charCodeAt(0)).buffer;
  new GLTFLoader().parse(bin, '', gl => {
    const m = gl.scene;
    const shell = new THREE.MeshStandardMaterial({ color: 0xd8d1c6, roughness: 0.45, metalness: 0.0 }), joint = new THREE.MeshStandardMaterial({ color: 0x9f978b, roughness: 0.5 });
    m.traverse(o => { if (o.isMesh) { o.material = /joint/i.test(o.name) ? joint : shell; o.castShadow = true; o.frustumCulled = false; } });
    PERSON.mixer = new THREE.AnimationMixer(m);
    const clip = gl.animations.find(a => /idle/i.test(a.name)) || gl.animations[0]; if (clip) PERSON.mixer.clipAction(clip).play();
    PERSON.mixer.update(0); m.updateMatrixWorld(true);
    const box = new THREE.Box3(); m.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
    PERSON.raw = box; PERSON.model = m; person.add(m); setPersonHeight(PERSON.heightIn);
  }, () => {});
}
const pclock = new THREE.Clock();
frameHooks.push(() => { const dt = Math.min(pclock.getDelta(), 0.1); if (person.visible && PERSON.mixer) PERSON.mixer.update(dt); });
const ftIn = inches => `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;
const MEASURE = [
  { el: null, text: () => `Tree ${ftIn(90)}`, at: () => new THREE.Vector3(0, YTOP, 0) },
  { el: null, text: () => `Doghouse ${ftIn(SZ('doghouse_xl').h || 28)}`, at: () => new THREE.Vector3(0, (SZ('doghouse_xl').h || 28) * IN, RB + (SZ('doghouse_xl').d || 22) * IN / 2 + 0.12) },
  { el: null, text: () => `Person ${ftIn(PERSON.heightIn)}`, at: () => person.position.clone().add(new THREE.Vector3(0, PERSON.heightIn * IN, 0)) },
];

/* ---------------- Post-processing: bloom, then a filmic finish ---------------- */
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uWarm: { value: 0.6 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uWarm; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.05, 0.99, 0.9), uWarm);            // warm candle-light grade (less in the office)
      float v = smoothstep(0.95, 0.25, distance(vUv, vec2(0.5, 0.52)));      // vignette
      c.rgb *= mix(0.62, 1.0, v);
      c.rgb += (h(vUv * 800.0) - 0.5) * 0.025;                               // fine film grain
      gl_FragColor = c; }`,
});
composer.addPass(grade);

/* ---------------- Selection markers ---------------- */
const ringTex = canvasTex(128, 128, (g) => { g.strokeStyle = '#FFE7A8'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 0.35; g.lineWidth = 22; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke(); });
const markerGroup = new THREE.Group(); scene.add(markerGroup);
const markerMat = new THREE.SpriteMaterial({ map: ringTex, depthTest: false, transparent: true, toneMapped: false, color: new THREE.Color(1.6, 1.4, 1.0) });
let selected = null;

function setHighlight(ids) {
  Object.entries(itemMats).forEach(([id, ms]) => ms.forEach(m => {
    if (!m.userData.baseEmissive) m.userData.baseEmissive = m.emissive ? m.emissive.clone() : null;
    if (m.userData.baseEI === undefined) m.userData.baseEI = m.emissiveIntensity;
    if (m.emissive) { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEI; }
  }));
  ids.forEach(id => (itemMats[id] || []).forEach(m => { if (m.emissiveMap) m.emissiveIntensity = m.userData.baseEI + 0.35; else if (m.emissive) m.emissive.setRGB(0.22, 0.15, 0.05); }));
  markerGroup.clear();
  ids.forEach(id => (instancesOf[id] || []).forEach(p => {
    const s = new THREE.Sprite(markerMat); s.position.copy(p); s.scale.setScalar(0.3); s.renderOrder = 999; markerGroup.add(s);
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
    ${it.img || it.notes ? `<div class="photo">${it.img ? `<img src="${it.img}" alt="Listing photo: ${it.name.replace(/"/g, '&quot;')}">` : ''}<div>${it.match ? `<span class="ok">${it.diy ? 'DIY: target look from our board' : { match: 'Photo matches the look', close: 'Close to the look' }[it.match]}</span>` : ''}<p>${it.notes || ''}${it.arrives_by ? ` <b>Arrives by ${new Date(it.arrives_by + 'T12:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}.</b>` : ''}</p></div></div>` : ''}
    ${DIY_HOW[id] ? `<p class="where"><b>${it.diy ? 'How to make it' : 'Finishing touch'}:</b> ${DIY_HOW[id]}</p>` : ''}
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
  updateCards();
  frameHooks.forEach(f => f());
  grade.uniforms.uTime.value = t % 10;
  doHover();
  for (let i = 0; i < LIGHT_N; i++) { const k = 0.75 + 0.25 * Math.sin(t * 1.6 + lightPhase[i]); lights.setColorAt(i, tmpCol.setRGB(3.2 * k, 2.15 * k, 1.05 * k)); }
  lights.instanceColor.needsUpdate = true;
  const pulse = 0.26 + 0.04 * Math.sin(t * 4);
  markerGroup.children.forEach(s => s.scale.setScalar(pulse));
  composer.render();
}
renderer.setAnimationLoop(frame);
document.getElementById('loading').remove();
{ // compare with the inspiration board
  const btn = document.getElementById('compare'), box = document.getElementById('insp');
  if (btn && box && CUT.inspiration) { box.querySelector('img').src = CUT.inspiration.src; btn.onclick = () => { const on = box.hidden; box.hidden = !on; btn.setAttribute('aria-pressed', String(on)); }; box.querySelector('button').onclick = () => btn.click(); }
}
/* ---------------- Settings: living room or office; person for scale ---------------- */
const LOOK = {
  living: { env: ENV.living, envI: 0.9, bg: 0x0d0806, hemi: [0xffd9b0, 0x20140c, 0.35], key: [0xffd6a8, 1.1], fill: [0x8fa6d6, 0.18], exp: 1.2, bloom: 0.75, warm: 0.6 },
  office: { env: ENV.office, envI: 0.7, bg: 0x2a2d31, hemi: [0xf3f5fb, 0x5a5650, 1.15], key: [0xfff2e2, 1.3], fill: [0xd8e2ff, 0.5], exp: 1.0, bloom: 0.5, warm: 0.2 },
};
function setRoom(name) {
  const L = LOOK[name]; livingRoom.visible = name === 'living'; officeRoom.visible = name === 'office';
  scene.environment = L.env; scene.environmentIntensity = L.envI; scene.background.set(L.bg);
  hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; key.color.set(L.key[0]); key.intensity = L.key[1]; fill.color.set(L.fill[0]); fill.intensity = L.fill[1];
  renderer.toneMappingExposure = L.exp; bloom.strength = L.bloom; grade.uniforms.uWarm.value = L.warm; renderer.shadowMap.needsUpdate = true;
  document.querySelectorAll('[data-room]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.room === name)));
}
document.querySelectorAll('[data-room]').forEach(b => { b.onclick = () => setRoom(b.dataset.room); });
{
  const pb = document.getElementById('personBtn'), sel = document.getElementById('personH'), layer = document.getElementById('measures');
  MEASURE.forEach(m => { m.el = document.createElement('div'); m.el.className = 'measure'; layer.append(m.el); });
  const show = on => { person.visible = on; layer.hidden = !on; sel.hidden = !on; pb.setAttribute('aria-pressed', String(on)); renderer.shadowMap.needsUpdate = true; };
  pb.onclick = () => show(!person.visible);
  sel.onchange = () => setPersonHeight(+sel.value);
  const v = new THREE.Vector3();
  frameHooks.push(() => {
    if (layer.hidden) return; const r = canvas.getBoundingClientRect();
    MEASURE.forEach(m => { v.copy(m.at()).project(camera); const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1; m.el.hidden = !vis; if (!vis) return;
      m.el.textContent = m.text(); m.el.style.left = ((v.x + 1) / 2 * r.width) + 'px'; m.el.style.top = ((1 - v.y) / 2 * r.height) + 'px'; });
  });
}
window.__howl = { select, instancesOf, pickables, stop: () => renderer.setAnimationLoop(null), frame, camera, controls };
