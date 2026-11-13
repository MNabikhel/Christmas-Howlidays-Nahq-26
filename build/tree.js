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

/* ---------------- Three.js setup ---------------- */
const canvas = document.getElementById('scene');
const stage = canvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // scene is static; shadows render once

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
const HOME_POS = new THREE.Vector3(0, 4.6, 16.4);
const HOME_TARGET = new THREE.Vector3(0, 3.7, 0);
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3.2;
controls.maxDistance = 24;
controls.maxPolarAngle = Math.PI * 0.53;
controls.minPolarAngle = Math.PI * 0.12;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.7;
controls.enablePan = false;

// Lighting: warm room
scene.add(new THREE.HemisphereLight(0xffe7c4, 0x1b120c, 0.32));
const key = new THREE.DirectionalLight(0xffe2b8, 1.15);
key.position.set(5, 10, 8);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 9, bottom: -1, near: 1, far: 30 });
key.shadow.bias = -0.0008;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fb8ff, 0.3);
rim.position.set(-6, 6, -7);
scene.add(rim);
const glow = new THREE.PointLight(0xffb85c, 3.5, 6, 1.6);
glow.position.set(0, 3.2, 0);
scene.add(glow);
const glow2 = new THREE.PointLight(0xffb85c, 2.2, 5, 1.6);
glow2.position.set(0, 1.4, 1.4);
scene.add(glow2);

/* ---------------- Procedural textures ---------------- */
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = rng(20261203);
const R = (a, b) => a + (b - a) * rand();

function drawPaw(g, cx, cy, s, color, rot = 0) {
  g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = color;
  g.beginPath(); g.ellipse(0, s * 0.2, s * 0.32, s * 0.26, 0, 0, Math.PI * 2); g.fill();
  [[-0.36, -0.14, -0.4], [-0.13, -0.38, -0.12], [0.13, -0.38, 0.12], [0.36, -0.14, 0.4]].forEach(([x, y, r]) => {
    g.beginPath(); g.ellipse(x * s, y * s, s * 0.12, s * 0.16, r, 0, Math.PI * 2); g.fill();
  });
  g.restore();
}
function noise(g, w, h, n, a, colors) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[(Math.random() * colors.length) | 0]; g.globalAlpha = Math.random() * a; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  g.globalAlpha = 1;
}
const TEX = {};
TEX.tartan = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#A3151F'; g.fillRect(0, 0, w, w);
  const band = (pos, size, color, alpha) => { g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(0, pos, w, size); g.fillRect(pos, 0, size, w); };
  band(36, 46, '#163A27', 0.62); band(164, 46, '#163A27', 0.62);
  band(104, 8, '#0E1A2B', 0.7); band(232, 8, '#0E1A2B', 0.7);
  band(14, 3, '#E8C35A', 0.9); band(142, 3, '#E8C35A', 0.9);
  band(57, 2, '#F1EDE3', 0.8); band(185, 2, '#F1EDE3', 0.8);
  g.globalAlpha = 1; noise(g, w, w, 3000, 0.12, ['#000', '#fff']);
}, { repeat: [2, 2] });
TEX.burlapPaw = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#D2BA8E'; g.fillRect(0, 0, w, w);
  g.globalAlpha = 0.18; g.strokeStyle = '#8D7448';
  for (let i = 0; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.stroke(); g.beginPath(); g.moveTo(0, i + 2); g.lineTo(w, i + 2); g.stroke(); }
  g.globalAlpha = 1;
  // listing B09H2YMHCL: natural burlap, dark-brown paws
  [[60, 64, -0.3], [190, 60, 0.25], [125, 140, 0.1], [50, 205, 0.35], [200, 200, -0.2]].forEach(([x, y, r]) => drawPaw(g, x, y, 46, '#4A2C1C', r));
}, { repeat: [1.5, 1] });
TEX.pawDisc = canvasTex(256, 256, (g, w) => {
  // 3" plywood round painted cream, black glitter paw
  g.fillStyle = '#EADDC4'; g.fillRect(0, 0, w, w);
  g.strokeStyle = 'rgba(150,120,80,.18)'; g.lineWidth = 1.5;
  for (let y = 4; y < w; y += 7) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + 4, 170, y - 4, w, y + 2); g.stroke(); }
  g.strokeStyle = '#C9A24A'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
  drawPaw(g, 128, 132, 120, '#161412');
  noise(g, w, w, 1500, 0.25, ['#161412']);
  noise(g, w, w, 500, 0.6, ['#8a8a8a']);
}, { srgb: true });
// red/black buffalo-check fringed scarf on the golden retriever ornament (B0C5LH4K55)
TEX.buffalo = canvasTex(64, 64, (g, w) => {
  g.fillStyle = '#B5121B'; g.fillRect(0, 0, w, w);
  g.fillStyle = 'rgba(15,10,10,.55)'; g.fillRect(0, 0, 32, 64); g.fillRect(0, 0, 64, 32);
  g.fillStyle = 'rgba(10,6,6,.5)'; g.fillRect(0, 0, 32, 32);
}, { repeat: [3, 3] });
// red & white striped knit scarf on the tabby kitten ornaments (B0BGQZBSKV)
TEX.knitRW = canvasTex(64, 64, (g, w) => {
  for (let x = 0; x < w; x += 16) { g.fillStyle = '#C8142A'; g.fillRect(x, 0, 8, w); g.fillStyle = '#F4F1EA'; g.fillRect(x + 8, 0, 8, w); }
  g.globalAlpha = 0.18; g.fillStyle = '#000'; for (let y = 0; y < w; y += 4) g.fillRect(0, y, w, 1); g.globalAlpha = 1;
}, { repeat: [3, 1] });
// cable knit for the mini stockings (B0FRF9R1HD), tinted per instance
TEX.knit = canvasTex(64, 64, (g, w) => {
  g.fillStyle = '#E8E8E8'; g.fillRect(0, 0, w, w);
  g.strokeStyle = '#FFFFFF'; g.lineWidth = 5;
  for (let x = 8; x < w; x += 16) { g.beginPath(); for (let y = 0; y <= w; y += 8) g.lineTo(x + ((y / 8) % 2 ? 4 : -4), y); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5;
  for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, w); g.stroke(); }
}, { repeat: [3, 3] });
// printed nesting gift box, red with gold snowflakes (Soul & Lane set)
TEX.giftPrint = canvasTex(128, 128, (g, w) => {
  g.fillStyle = '#A8202A'; g.fillRect(0, 0, w, w);
  g.strokeStyle = '#E2C27A'; g.lineWidth = 2;
  for (let y = 20; y < w; y += 44) for (let x = (y / 44) % 2 ? 42 : 20; x < w; x += 44) {
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * 9, y - Math.sin(a) * 9); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke(); }
  }
}, { repeat: [2, 2] });
TEX.pawDisc.wrapS = TEX.pawDisc.wrapT = THREE.ClampToEdgeWrapping;
TEX.kraftPaw = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#B58D5C'; g.fillRect(0, 0, w, w); noise(g, w, w, 4000, 0.2, ['#7d5b34', '#d6b48a']);
  for (let y = 24; y < w; y += 64) for (let x = (y / 64) % 2 ? 56 : 24; x < w; x += 64) drawPaw(g, x, y, 22, '#22180F', R(-0.5, 0.5));
}, { repeat: [2, 2] });
TEX.kraft = canvasTex(128, 128, (g, w) => { g.fillStyle = '#B48A57'; g.fillRect(0, 0, w, w); noise(g, w, w, 2500, 0.25, ['#7d5b34', '#d6b48a']); });
TEX.blanket = canvasTex(256, 256, (g, w) => {
  // red flannel throw with white paws + snowflakes (B0FKBGPHCV)
  g.fillStyle = '#C0182B'; g.fillRect(0, 0, w, w);
  noise(g, w, w, 2500, 0.12, ['#000', '#fff']);
  for (let y = 36; y < w; y += 86) for (let x = (y / 86) % 2 ? 90 : 40; x < w; x += 100) drawPaw(g, x, y, 40, '#F7F3EC', R(-0.4, 0.4));
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
  for (let y = 80; y < w; y += 86) for (let x = (y / 86) % 2 ? 30 : 85; x < w; x += 100)
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * 12, y - Math.sin(a) * 12); g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); g.stroke(); }
}, { repeat: [1.5, 1.5] });
TEX.planks = canvasTex(128, 128, (g, w) => {
  g.fillStyle = '#9A2620'; g.fillRect(0, 0, w, w);
  g.fillStyle = 'rgba(40,6,4,.45)'; for (let y = 0; y < w; y += 21) g.fillRect(0, y, w, 2);
  noise(g, w, w, 1500, 0.2, ['#3b0a06', '#d0574b']);
});
TEX.glitter = canvasTex(256, 256, (g, w) => {
  const im = g.createImageData(w, w);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() < 0.5 ? 255 * Math.random() : 120; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
}, { repeat: [3, 3], srgb: false });
TEX.wicker = canvasTex(128, 128, (g, w) => {
  g.fillStyle = '#7B5530'; g.fillRect(0, 0, w, w);
  for (let y = 0; y < w; y += 16) for (let x = 0; x < w; x += 16) {
    const odd = ((x + y) / 16) % 2;
    const grd = odd ? g.createLinearGradient(x, y, x + 16, y) : g.createLinearGradient(x, y, x, y + 16);
    grd.addColorStop(0, '#9A6D3C'); grd.addColorStop(0.5, '#D3A766'); grd.addColorStop(1, '#9A6D3C');
    g.fillStyle = grd; g.fillRect(x + 1, y + 1, 14, 14);
  }
}, { repeat: [6, 2] });
TEX.rope = canvasTex(128, 32, (g, w, h) => {
  const cols = ['#B3172A', '#F3EEE4', '#1F6B3E', '#F3EEE4'];
  for (let i = -4; i < 16; i++) { g.fillStyle = cols[(i + 8) % 4]; g.beginPath(); g.moveTo(i * 12, 0); g.lineTo(i * 12 + 12, 0); g.lineTo(i * 12 + 12 + h, h); g.lineTo(i * 12 + h, h); g.fill(); }
}, { repeat: [3, 1] });
TEX.card = canvasTex(512, 320, (g, w, h) => {
  g.fillStyle = '#FBFAF6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1E6B47'; g.fillRect(0, h - 26, w, 26);
  drawPaw(g, 96, 150, 110, '#1E6B47', -0.15);
  g.fillStyle = '#18231D'; g.font = '700 46px Figtree, sans-serif'; g.fillText('Homes Alive', 180, 135); g.fillText('Pets', 180, 185);
  g.font = '600 34px Figtree, sans-serif'; g.fillStyle = '#5B6A61'; g.fillText('Gift card · $100', 180, 240);
}, { srgb: true });
TEX.card.wrapS = TEX.card.wrapT = THREE.ClampToEdgeWrapping;
TEX.bowl = canvasTex(512, 128, (g, w, h) => {
  // glossy red glazed bowl with white polka dots (B0FX23RP9K)
  g.fillStyle = '#C4141F'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#FBF8F2';
  for (let y = 22; y < h; y += 40) for (let x = (y / 40) % 2 ? 36 : 12; x < w; x += 48) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
}, { repeat: [1, 1] });
TEX.tabbyGrey = canvasTex(128, 128, (g, w) => {
  g.fillStyle = '#A3A5A2'; g.fillRect(0, 0, w, w);
  g.strokeStyle = '#4B4E50'; g.lineWidth = 5;
  for (let y = 6; y < w; y += 16) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.1 + y) * 4); g.stroke(); }
});
TEX.tabbyBrown = canvasTex(128, 128, (g, w) => {
  g.fillStyle = '#A9845A'; g.fillRect(0, 0, w, w);
  g.strokeStyle = '#5B3E22'; g.lineWidth = 5;
  for (let y = 6; y < w; y += 16) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.1 + y) * 4); g.stroke(); }
});
TEX.floor = canvasTex(512, 512, (g, w) => {
  g.fillStyle = '#3A2618'; g.fillRect(0, 0, w, w);
  for (let y = 0; y < w; y += 64) { g.fillStyle = `hsl(24, 34%, ${9 + Math.random() * 5}%)`; g.fillRect(0, y, w, 62); }
  noise(g, w, w, 9000, 0.15, ['#000', '#7a5236']);
}, { repeat: [6, 6] });

/* ---------------- Material registry (for highlighting) ---------------- */
const itemMats = {}; // id -> [materials]
function mat(id, MatClass, params) {
  const m = new MatClass(params);
  if (id) (itemMats[id] ||= []).push(m);
  return m;
}
const pickables = [];            // meshes that can be clicked
const instancesOf = {};          // id -> [Vector3 world positions]
function addInstancePos(id, v) { (instancesOf[id] ||= []).push(v.clone()); }
function tag(obj, id) { obj.traverse(o => { if (o.isMesh) { o.userData.itemId = id; pickables.push(o); o.castShadow = true; } }); }

/* ---------------- Tree ---------------- */
const Y0 = 0.95, YTOP = 7.35, RB = 2.35;
const rAt = y => RB * Math.pow(Math.max(0, 1 - (y - Y0) / (YTOP - Y0)), 0.93);
const treeGroup = new THREE.Group(); scene.add(treeGroup);

// wood base (provided) + trunk
const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.22, 2.1), new THREE.MeshStandardMaterial({ color: 0xA9805A, roughness: 0.7 }));
base.position.y = 0.11; base.receiveShadow = base.castShadow = true; treeGroup.add(base);
const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0x3B2A1E, roughness: 0.9 }));
trunk.position.y = 0.8; treeGroup.add(trunk);

// occluder core (also blocks clicks through the tree)
const coreGeo = new THREE.ConeGeometry(RB * 0.84, YTOP - Y0 + 0.2, 28, 1, true);
coreGeo.translate(0, (YTOP + Y0) / 2 + 0.05, 0);
const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({ color: 0x0E2016, roughness: 1, side: THREE.DoubleSide }));
core.userData.occluder = true; treeGroup.add(core);

// branch tips (instanced)
function makeBranches(count, depthMin, depthMax, scaleMul, colors, seedOffset) {
  const g = new THREE.ConeGeometry(0.2, 0.95, 6, 1);
  g.translate(0, 0.475, 0);
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, flatShading: true });
  const mesh = new THREE.InstancedMesh(g, m, count);
  const dummy = new THREE.Object3D(); const col = new THREE.Color(); const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const u = rand();
    const y = Y0 + 0.05 + (YTOP - Y0 - 0.15) * (1 - Math.sqrt(u));
    const th = rand() * Math.PI * 2;
    const r = rAt(y) * R(depthMin, depthMax);
    dummy.position.set(Math.cos(th) * r * 0.55, y + 0.12, Math.sin(th) * r * 0.55);
    const dir = new THREE.Vector3(Math.cos(th), -R(0.25, 0.6), Math.sin(th)).normalize();
    dummy.quaternion.setFromUnitVectors(up, dir);
    const s = scaleMul * (0.55 + 0.75 * (rAt(y) / RB)) * R(0.8, 1.2);
    dummy.scale.set(s * R(0.9, 1.4), s * (r * 0.5 + 0.35), s * R(0.5, 0.9));
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, col.set(colors[(rand() * colors.length) | 0]).offsetHSL(0, 0, R(-0.03, 0.03)));
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  treeGroup.add(mesh);
  return mesh;
}
makeBranches(1700, 0.55, 0.95, 1.0, ['#173A26', '#1B4430', '#21503A', '#143222'], 1);
makeBranches(1500, 0.85, 1.04, 0.8, ['#24563A', '#2B6243', '#1E4A31', '#30694A'], 2);
makeBranches(1100, 0.9, 1.06, 0.55, ['#2F6A48', '#24583B', '#3A7552'], 3);

// pre-lit warm lights (included with tree)
const LIGHT_N = 420;
const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), LIGHT_N);
const lightPhase = [];
{
  const d = new THREE.Object3D();
  for (let i = 0; i < LIGHT_N; i++) {
    const y = Y0 + 0.15 + (YTOP - Y0 - 0.3) * (1 - Math.sqrt(rand()));
    const th = rand() * Math.PI * 2; const r = rAt(y) * R(0.82, 1.0);
    d.position.set(Math.cos(th) * r, y, Math.sin(th) * r); d.updateMatrix(); lights.setMatrixAt(i, d.matrix);
    lights.setColorAt(i, new THREE.Color(3.2, 2.2, 1.1));
    lightPhase.push(rand() * Math.PI * 2);
  }
}
treeGroup.add(lights);

/* ---------------- Placement on tree surface ---------------- */
const placed = [];
function findSpot(size, yMin, yMax, depth = 1.0, tries = 120) {
  for (let t = 0; t < tries; t++) {
    const y = yMin + (yMax - yMin) * rand();
    const th = rand() * Math.PI * 2;
    const r = rAt(y) * depth + size * 0.4;
    const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    if (placed.every(q => q.p.distanceTo(p) > (q.s + size) * 0.92)) { placed.push({ p, s: size }); return { p, th }; }
  }
  const y = yMin + (yMax - yMin) * rand(), th = rand() * Math.PI * 2, r = rAt(y) * depth + size * 0.4;
  const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r); placed.push({ p, s: size }); return { p, th };
}
function faceOut(obj, th) { obj.rotation.set(0, Math.PI / 2 - th, 0); }

/* ---------------- Reusable geometries ---------------- */
function bowGeometry() {
  const parts = [];
  const loop = new THREE.TorusGeometry(0.42, 0.11, 8, 28);
  [-1, 1].forEach(s => { const l = loop.clone(); l.scale(1, 0.62, 0.32); l.rotateZ(s * 0.18); l.translate(s * 0.4, 0.03, 0); parts.push(l); });
  const knot = new THREE.SphereGeometry(0.17, 14, 10); knot.scale(1, 1.15, 0.7); parts.push(knot);
  [-1, 1].forEach(s => { const t = new THREE.BoxGeometry(0.2, 0.75, 0.04, 1, 4, 1); t.translate(0, -0.38, 0); t.rotateZ(s * 0.42); t.translate(s * 0.06, -0.06, 0.02); parts.push(t); });
  const g = mergeGeometries(parts.map(p => p.index ? p : p), false);
  return g;
}
const BOW_GEO = bowGeometry();
function baubleCap() { const g = new THREE.CylinderGeometry(0.22, 0.24, 0.26, 12); g.translate(0, 1.0, 0); return g; }

function instanced(geo, material, list, id, { cast = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const d = new THREE.Object3D();
  list.forEach((it, i) => {
    d.position.copy(it.p); d.rotation.copy(it.rot || new THREE.Euler()); d.scale.setScalar(it.s ?? 1);
    if (it.sv) d.scale.copy(it.sv);
    d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    if (it.c) mesh.setColorAt(i, new THREE.Color(it.c));
    if (id) addInstancePos(id, it.p);
  });
  mesh.castShadow = cast;
  if (id) { mesh.userData.itemId = id; pickables.push(mesh); }
  scene.add(mesh); return mesh;
}

/* ---------------- Topper + ribbons ---------------- */
{
  const m = mat('topper', THREE.MeshStandardMaterial, { map: TEX.burlapPaw, roughness: 0.95, side: THREE.DoubleSide });
  const bow = new THREE.Mesh(BOW_GEO, m);
  bow.scale.setScalar(1.05); bow.position.set(0, YTOP + 0.05, 0.25);
  scene.add(bow); tag(bow, 'topper'); addInstancePos('topper', bow.position);
}

// flat ribbon strip along a path that hugs the tree
function ribbonMesh(pathFn, steps, width, material, id) {
  const pos = [], uv = [], idx = []; let len = 0; let prev = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; const { p, n } = pathFn(t);
    if (prev) len += p.distanceTo(prev); prev = p;
    const tan = (() => { const a = pathFn(Math.max(0, t - 0.002)).p, b = pathFn(Math.min(1, t + 0.002)).p; return b.sub(a).normalize(); })();
    const side = new THREE.Vector3().crossVectors(tan, n).normalize().multiplyScalar(width / 2);
    pos.push(p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z);
    uv.push(len / width / 1.4, 0, len / width / 1.4, 1);
    if (i < steps) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material); mesh.castShadow = true; scene.add(mesh); tag(mesh, id);
  for (let i = 1; i < 6; i++) addInstancePos(id, pathFn(i / 6).p);
  return mesh;
}
{
  const tartanMat = mat('tartan_ribbon', THREE.MeshStandardMaterial, { map: TEX.tartan, roughness: 0.8, side: THREE.DoubleSide });
  tartanMat.map = TEX.tartan.clone(); tartanMat.map.repeat.set(1, 1); tartanMat.map.needsUpdate = true;
  for (let k = 0; k < 5; k++) {
    const th0 = k * (Math.PI * 2 / 5) + 0.35;
    ribbonMesh(t => {
      const y = YTOP - 0.45 - t * (YTOP - Y0 - 0.55);
      const th = th0 + t * 0.9 + Math.sin(t * 9 + k) * 0.08;
      const r = rAt(y) * 1.0 + 0.1 + Math.sin(t * 14 + k) * 0.07;
      const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      const n = new THREE.Vector3(Math.cos(th + Math.sin(t * 14 + k) * 0.6), 0.35, Math.sin(th + Math.sin(t * 14 + k) * 0.6)).normalize();
      return { p, n };
    }, 160, 0.21, tartanMat, 'tartan_ribbon');
  }
  const velvetMat = mat('velvet_ribbon', THREE.MeshPhysicalMaterial, { color: 0x8E0F1F, roughness: 0.62, sheen: 1, sheenColor: new THREE.Color(0xff6b7a), sheenRoughness: 0.35, side: THREE.DoubleSide });
  ribbonMesh(t => {
    const turns = 3.3; const th = t * Math.PI * 2 * turns + 1.2;
    const y = YTOP - 1.1 - t * (YTOP - Y0 - 1.5) - Math.abs(Math.sin(th * 2.5)) * 0.18;
    const r = rAt(y) * 1.0 + 0.12;
    const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    return { p, n: new THREE.Vector3(Math.cos(th), 0.25, Math.sin(th)).normalize() };
  }, 600, 0.17, velvetMat, 'velvet_ribbon');
  // topper streamers
  const tm = itemMats.topper[0];
  [-1, 1].forEach(s => ribbonMesh(t => {
    const y = YTOP - 0.25 - t * 1.6; const th = Math.PI / 2 + s * (0.18 + t * 0.25);
    const r = rAt(y) + 0.12 + Math.sin(t * 6) * 0.04;
    return { p: new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r), n: new THREE.Vector3(Math.cos(th), 0.2, Math.sin(th)).normalize() };
  }, 50, 0.22, tm, 'topper'));
}

/* ---------------- Figurine ornaments ---------------- */
function hookString(group, top) {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 4), new THREE.MeshStandardMaterial({ color: 0xD8B460, metalness: 0.8, roughness: 0.3 }));
  s.position.y = top + 0.08; group.add(s);
}
function dogOrnament() {
  const id = 'golden';
  const fur = mat(id, THREE.MeshStandardMaterial, { color: 0xD9A35A, roughness: 0.75 });
  const light = mat(id, THREE.MeshStandardMaterial, { color: 0xEFCB93, roughness: 0.75 });
  const dark = mat(id, THREE.MeshStandardMaterial, { color: 0xB57B37, roughness: 0.8 });
  const black = mat(id, THREE.MeshStandardMaterial, { color: 0x111111, roughness: 0.25 });
  const scarf = mat(id, THREE.MeshStandardMaterial, { map: TEX.buffalo, roughness: 0.9 });
  const g = new THREE.Group(); const S = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  const sph = new THREE.SphereGeometry(1, 20, 14);
  S(sph, fur, 0, 0.13, 0, 0.13, 0.15, 0.12);
  S(sph, light, 0, 0.14, 0.07, 0.085, 0.1, 0.06);
  S(sph, fur, 0, 0.31, 0.03, 0.11, 0.1, 0.1);
  S(sph, light, 0, 0.28, 0.115, 0.055, 0.042, 0.05);
  S(sph, black, 0, 0.297, 0.165, 0.018, 0.014, 0.014);
  S(sph, black, -0.042, 0.33, 0.118, 0.015, 0.015, 0.01); S(sph, black, 0.042, 0.33, 0.118, 0.015, 0.015, 0.01);
  const e1 = S(sph, dark, -0.1, 0.28, 0.01, 0.035, 0.075, 0.03); e1.rotation.z = 0.35;
  const e2 = S(sph, dark, 0.1, 0.28, 0.01, 0.035, 0.075, 0.03); e2.rotation.z = -0.35;
  S(sph, light, -0.05, 0.02, 0.09, 0.04, 0.03, 0.05); S(sph, light, 0.05, 0.02, 0.09, 0.04, 0.03, 0.05);
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.026, 8, 20), scarf); sc.rotation.x = Math.PI / 2 - 0.15; sc.position.set(0, 0.215, 0.02); g.add(sc);
  // two long fringed tails hanging down the chest (listing photo)
  [[0.03, 0.1, 0.12, 0.15], [0.075, 0.08, 0.1, 0.35]].forEach(([x, y, z, rz]) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.018), scarf); t.position.set(x, y, z); t.rotation.z = rz; g.add(t);
    for (let f = 0; f < 5; f++) { const fr = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.035, 0.006), scarf); fr.position.set(x - 0.02 + f * 0.01 + Math.sin(rz) * 0.1, y - 0.115 * Math.cos(rz), z); fr.rotation.z = rz; g.add(fr); }
  });
  hookString(g, 0.41);
  return g;
}
function catOrnament(id) {
  const stripes = id === 'tabby_grey' ? TEX.tabbyGrey : TEX.tabbyBrown;
  const fur = mat(id, THREE.MeshStandardMaterial, { map: stripes, roughness: 0.8 });
  const white = mat(id, THREE.MeshStandardMaterial, { color: 0xF2EEE6, roughness: 0.8 });
  const black = mat(id, THREE.MeshStandardMaterial, { color: 0x111111, roughness: 0.2 });
  const eye = mat(id, THREE.MeshStandardMaterial, { color: 0xB9C24A, roughness: 0.25 });
  const pink = mat(id, THREE.MeshStandardMaterial, { color: 0xD98C8C, roughness: 0.5 });
  const scarf = mat(id, THREE.MeshStandardMaterial, { map: TEX.knitRW, roughness: 0.95 });
  const pom = mat(id, THREE.MeshStandardMaterial, { color: 0xFAFAF7, roughness: 1, bumpMap: TEX.glitter, bumpScale: 3 });
  const g = new THREE.Group(); const sph = new THREE.SphereGeometry(1, 20, 14);
  const S = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  S(sph, fur, 0, 0.13, 0, 0.12, 0.15, 0.11);
  S(sph, white, 0, 0.13, 0.07, 0.075, 0.1, 0.05);
  S(sph, fur, 0, 0.31, 0.02, 0.105, 0.092, 0.095);
  S(sph, white, 0, 0.285, 0.085, 0.05, 0.035, 0.035);
  S(sph, pink, 0, 0.3, 0.118, 0.012, 0.009, 0.008);
  S(sph, eye, -0.04, 0.33, 0.09, 0.02, 0.022, 0.012); S(sph, eye, 0.04, 0.33, 0.09, 0.02, 0.022, 0.012);
  S(sph, black, -0.04, 0.33, 0.1, 0.007, 0.018, 0.006); S(sph, black, 0.04, 0.33, 0.1, 0.007, 0.018, 0.006);
  const ear = new THREE.ConeGeometry(0.038, 0.075, 4);
  const a = S(ear, fur, -0.06, 0.4, 0.01); a.rotation.z = 0.28; const b = S(ear, fur, 0.06, 0.4, 0.01); b.rotation.z = -0.28;
  S(sph, white, -0.045, 0.02, 0.08, 0.035, 0.025, 0.045); S(sph, white, 0.045, 0.02, 0.08, 0.035, 0.025, 0.045);
  const tl = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 16, Math.PI * 0.9), fur); tl.rotation.set(Math.PI / 2, 0, 0.3); tl.position.set(0.02, 0.03, 0.02); g.add(tl);
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.024, 8, 20), scarf); sc.rotation.x = Math.PI / 2 - 0.15; sc.position.set(0, 0.225, 0.01); g.add(sc);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.02), scarf); tail.position.set(-0.04, 0.165, 0.09); tail.rotation.z = -0.2; g.add(tail);
  S(sph, pom, -0.1, 0.24, 0.02, 0.055, 0.055, 0.055); // big white pompom on the scarf end (listing photo)
  hookString(g, 0.43);
  return g;
}
function doghouseOrnament() {
  const id = 'doghouse';
  const red = mat(id, THREE.MeshStandardMaterial, { map: TEX.planks, roughness: 0.7 });
  const cream = mat(id, THREE.MeshStandardMaterial, { color: 0xE6D3AE, roughness: 0.7 });
  const dark = mat(id, THREE.MeshStandardMaterial, { color: 0x24140C, roughness: 0.9 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.24), red); body.position.y = 0.11; g.add(body);
  const gable = new THREE.Shape(); gable.moveTo(-0.15, 0); gable.lineTo(0.15, 0); gable.lineTo(0, 0.14); gable.closePath();
  const gg = new THREE.ExtrudeGeometry(gable, { depth: 0.24, bevelEnabled: false }); gg.translate(0, 0.22, -0.12);
  g.add(new THREE.Mesh(gg, red));
  [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.025, 0.3), cream); r.position.set(s * 0.078, 0.29, 0); r.rotation.z = -s * 0.75; g.add(r); });
  const arch = new THREE.Shape(); arch.moveTo(-0.06, 0); arch.lineTo(-0.06, 0.08); arch.absarc(0, 0.08, 0.06, Math.PI, 0, true); arch.lineTo(0.06, 0); arch.closePath();
  const door = new THREE.Mesh(new THREE.ShapeGeometry(arch, 16), dark); door.position.set(0, 0.005, 0.121); g.add(door);
  const trimS = new THREE.Shape(); trimS.moveTo(-0.08, 0); trimS.lineTo(-0.08, 0.08); trimS.absarc(0, 0.08, 0.08, Math.PI, 0, true); trimS.lineTo(0.08, 0); trimS.closePath();
  trimS.holes.push(arch);
  const trim = new THREE.Mesh(new THREE.ShapeGeometry(trimS, 16), cream); trim.position.set(0, 0.005, 0.1205); g.add(trim);
  const paw = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), mat(id, THREE.MeshStandardMaterial, { map: canvasTex(64, 64, (c) => { c.fillStyle = '#9A2620'; c.fillRect(0, 0, 64, 64); drawPaw(c, 32, 34, 44, '#E6D3AE'); }), roughness: 0.7 }));
  paw.position.set(0, 0.27, 0.1215); g.add(paw);
  hookString(g, 0.37);
  return g;
}

// mini bows (shared instanced list, filled as ornaments are placed)
const miniBowSpots = [];

// Place figurines first (largest), then other ornaments
function placeFigs(n, build, id, yMin, yMax, scale = 1) {
  for (let i = 0; i < n; i++) {
    const { p, th } = findSpot(0.33 * scale, yMin, yMax, 1.0);
    const o = build(); o.scale.setScalar(scale * 1.15); o.position.copy(p); o.position.y -= 0.18 * scale; faceOut(o, th);
    scene.add(o); tag(o, id); addInstancePos(id, p);
    if (id === 'doghouse') miniBowSpots.push({ p: p.clone().add(new THREE.Vector3(0, 0.27 * scale, 0)), th, s: 0.07 });
  }
}
// counts follow the shopping list (qty, or 'made' for DIY)
const COUNT = id => { const it = BY_ID[id]; return it.diy ? it.made : it.qty; };
placeFigs(COUNT('golden'), dogOrnament, 'golden', 1.6, 6.3, 1.1);
placeFigs(COUNT('tabby_grey'), () => catOrnament('tabby_grey'), 'tabby_grey', 1.6, 6.3, 1.05);
placeFigs(COUNT('tabby_brown'), () => catOrnament('tabby_brown'), 'tabby_brown', 1.6, 6.3, 1.05);
placeFigs(Math.min(10, COUNT('doghouse')), doghouseOrnament, 'doghouse', 1.5, 6.0, 1.1);

// Bows on the tree
function bowList(n, size, yMin, yMax) {
  const out = [];
  for (let i = 0; i < n; i++) { const { p, th } = findSpot(size, yMin, yMax, 1.02); out.push({ p, rot: new THREE.Euler(0, Math.PI / 2 - th, R(-0.15, 0.15)), s: size * 0.85 }); }
  return out;
}
const plaidBowMat = mat('plaid_bows', THREE.MeshStandardMaterial, { map: TEX.tartan, roughness: 0.8 });
instanced(BOW_GEO, plaidBowMat, bowList(12 * COUNT('plaid_bows'), 0.4, 1.4, 6.6), 'plaid_bows');
const velvetBowMat = mat('velvet_bows', THREE.MeshPhysicalMaterial, { color: 0xB3101E, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xff6b7a), sheenRoughness: 0.35 });
instanced(BOW_GEO, velvetBowMat, bowList(12 * COUNT('velvet_bows'), 0.42, 1.3, 6.4), 'velvet_bows');

// Stockings
{
  const sh = new THREE.Shape();
  sh.moveTo(-0.1, 0); sh.lineTo(0.1, 0); sh.lineTo(0.1, -0.24); sh.quadraticCurveTo(0.1, -0.3, 0.2, -0.33); sh.quadraticCurveTo(0.26, -0.37, 0.22, -0.42);
  sh.lineTo(0.02, -0.42); sh.quadraticCurveTo(-0.1, -0.42, -0.1, -0.3); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 10 });
  const cuff = new THREE.BoxGeometry(0.24, 0.08, 0.1); cuff.translate(0, 0.0, 0.03);
  const smat = mat('stockings', THREE.MeshStandardMaterial, { map: TEX.knit, roughness: 0.95 });
  const cmat = mat('stockings', THREE.MeshStandardMaterial, { color: 0xF7F5F0, roughness: 1, bumpMap: TEX.glitter, bumpScale: 4 });
  const KNIT = ['#B3162A', '#1F5A3A', '#EFE7D6']; // red, forest green, cream (4" minis, 12-pk)
  const list = []; for (let i = 0; i < 12 * COUNT('stockings'); i++) { const { p, th } = findSpot(0.22, 1.4, 6.0, 1.0); list.push({ p: p.clone().add(new THREE.Vector3(0, -0.05, 0)), rot: new THREE.Euler(0, Math.PI / 2 - th, R(-0.12, 0.12)), s: 0.8, c: KNIT[i % 3] }); }
  instanced(geo, smat, list, 'stockings'); instanced(cuff, cmat, list.map(l => ({ ...l, c: undefined })), null);
}

// Paw discs (+ mini bows)
{
  const g = new THREE.CylinderGeometry(0.16, 0.16, 0.035, 28); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 2);
  const side = mat('paw_disc', THREE.MeshStandardMaterial, { color: 0xE3D3B2, roughness: 0.9 });
  const face = mat('paw_disc', THREE.MeshStandardMaterial, { map: TEX.pawDisc, roughness: 0.75 });
  const list = [];
  for (let i = 0; i < Math.min(22, COUNT('paw_disc')); i++) {
    const { p, th } = findSpot(0.22, 1.3, 6.6, 1.0);
    list.push({ p, rot: new THREE.Euler(0, Math.PI / 2 - th, R(-0.2, 0.2)), s: 1.05 });
    miniBowSpots.push({ p: p.clone().add(new THREE.Vector3(Math.cos(th) * 0.02, 0.18, Math.sin(th) * 0.02)), th, s: 0.075 });
  }
  instanced(g, [side, face, face], list, 'paw_disc');
}

// Bones
{
  const parts = [new THREE.CylinderGeometry(0.035, 0.035, 0.24, 12).rotateZ(Math.PI / 2)];
  [[-0.12, 0.035], [-0.12, -0.035], [0.12, 0.035], [0.12, -0.035]].forEach(([x, y]) => parts.push(new THREE.SphereGeometry(0.048, 12, 10).translate(x, y, 0)));
  const geo = mergeGeometries(parts); geo.scale(1.25, 1.35, 0.32); // flat 4" plywood bone (B0G5B5ZLHN), painted biscuit-cream
  const m = mat('bones', THREE.MeshStandardMaterial, { color: 0xEBD9B4, roughness: 0.8 });
  const list = []; for (let i = 0; i < Math.min(20, COUNT('bones')); i++) { const { p, th } = findSpot(0.22, 1.3, 6.6, 1.0); list.push({ p, rot: new THREE.Euler(0, Math.PI / 2 - th, R(-0.5, 0.5)), s: 1.1 }); }
  instanced(geo, m, list, 'bones');
}

// Baubles
const SPH = new THREE.SphereGeometry(1, 28, 18);
const capMat = new THREE.MeshStandardMaterial({ color: 0xC9A24A, metalness: 0.9, roughness: 0.3 });
function baubles(id, n, rMin, rMax, colors, material, yMin = 1.2, yMax = 6.9) {
  const list = [];
  for (let i = 0; i < n; i++) { const r = R(rMin, rMax); const { p } = findSpot(r * 1.4, yMin, yMax, 0.97); list.push({ p, s: r, c: colors[i % colors.length] }); }
  instanced(SPH, material, list, id);
  const capGeo = baubleCap();
  instanced(capGeo, capMat, list.map(l => ({ ...l, c: undefined })), null);
}
baubles('glitter_red', 12 * COUNT('glitter_red'), 0.15, 0.16, ['#B0141F', '#C59A3E'], mat('glitter_red', THREE.MeshStandardMaterial, { color: 0xffffff, metalness: 0.75, roughness: 0.45, roughnessMap: TEX.glitter, bumpMap: TEX.glitter, bumpScale: 2.5 }));
baubles('glitter_champ', 12 * COUNT('glitter_champ'), 0.15, 0.16, ['#E0C690'], mat('glitter_champ', THREE.MeshStandardMaterial, { color: 0xffffff, metalness: 0.8, roughness: 0.4, roughnessMap: TEX.glitter, bumpMap: TEX.glitter, bumpScale: 2.5 }));
baubles('plaid_balls', 6 * COUNT('plaid_balls'), 0.13, 0.13, ['#ffffff'], mat('plaid_balls', THREE.MeshStandardMaterial, { map: TEX.tartan, roughness: 0.85 }));
baubles('baubles_rgg', 70, 0.075, 0.115, ['#B5122A', '#1E5A35', '#C9A24A', '#B5122A', '#1E5A35'], mat('baubles_rgg', THREE.MeshPhysicalMaterial, { color: 0xffffff, metalness: 0.35, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 }));
baubles('baubles_champ', 34, 0.075, 0.11, ['#EFE4CB', '#D6BD86'], mat('baubles_champ', THREE.MeshPhysicalMaterial, { color: 0xffffff, metalness: 0.2, roughness: 0.32, clearcoat: 0.6 }));

// Mini velvet bows (on discs + doghouses)
{
  const m = mat('mini_bows', THREE.MeshPhysicalMaterial, { color: 0x900F20, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xff6b7a), sheenRoughness: 0.35 });
  instanced(BOW_GEO, m, miniBowSpots.map(b => ({ p: b.p, rot: new THREE.Euler(0, Math.PI / 2 - b.th, 0), s: b.s * 1.6 })), 'mini_bows');
}

// Picks: red berries, gold sprays, pine cones + holly
{
  const berryMat = mat('red_picks', THREE.MeshPhysicalMaterial, { color: 0xB1121F, roughness: 0.25, clearcoat: 1, roughnessMap: TEX.glitter });
  const goldMat = mat('gold_picks', THREE.MeshStandardMaterial, { color: 0xD7B25E, metalness: 0.9, roughness: 0.35, bumpMap: TEX.glitter, bumpScale: 2 });
  const coneMat = mat('pine_picks', THREE.MeshStandardMaterial, { color: 0x6B4426, roughness: 0.9, flatShading: true });
  const hollyMat = mat('pine_picks', THREE.MeshStandardMaterial, { color: 0x1E5130, roughness: 0.35 });
  const pineBerryMat = mat('pine_picks', THREE.MeshStandardMaterial, { color: 0xB71C1C, roughness: 0.3 });
  const berries = [], golds = [], cones = [], holly = [], pBerries = [];
  for (let i = 0; i < 16; i++) {
    const { p, th } = findSpot(0.2, 1.3, 6.8, 1.0); const out = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    for (let k = 0; k < 9; k++) berries.push({ p: p.clone().add(new THREE.Vector3(R(-0.09, 0.09), R(-0.08, 0.1), R(-0.09, 0.09))).addScaledVector(out, 0.04), s: R(0.026, 0.036) });
  }
  for (let i = 0; i < 18; i++) {
    const { p, th } = findSpot(0.22, 1.3, 6.9, 1.0); const out = new THREE.Vector3(Math.cos(th), 0.35, Math.sin(th)).normalize();
    for (let k = 0; k < 11; k++) { const q = p.clone().addScaledVector(out, R(-0.05, 0.22)).add(new THREE.Vector3(R(-0.1, 0.1), R(-0.05, 0.16), R(-0.1, 0.1))); golds.push({ p: q, s: R(0.017, 0.028) }); }
  }
  for (let i = 0; i < 12; i++) {
    const { p, th } = findSpot(0.22, 1.3, 6.2, 1.0);
    cones.push({ p, rot: new THREE.Euler(Math.PI + R(-0.4, 0.4), 0, R(-0.4, 0.4)), sv: new THREE.Vector3(0.07, 0.13, 0.07) });
    for (let k = 0; k < 3; k++) holly.push({ p: p.clone().add(new THREE.Vector3(Math.cos(th + k * 1.2) * 0.08, 0.05, Math.sin(th + k * 1.2) * 0.08)), rot: new THREE.Euler(R(0, 1), th + k * 1.2, R(0, 1)), sv: new THREE.Vector3(0.09, 0.012, 0.04) });
    for (let k = 0; k < 3; k++) pBerries.push({ p: p.clone().add(new THREE.Vector3(R(-0.04, 0.04), 0.1, R(-0.04, 0.04))), s: 0.025 });
  }
  instanced(SPH, berryMat, berries, 'red_picks');
  instanced(SPH, goldMat, golds, 'gold_picks');
  instanced(new THREE.ConeGeometry(1, 1, 7, 3), coneMat, cones, 'pine_picks');
  instanced(SPH, hollyMat, holly, 'pine_picks');
  instanced(SPH, pineBerryMat, pBerries, 'pine_picks');
}

/* ---------------- Under the tree ---------------- */
const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ map: TEX.floor, roughness: 0.75 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

function giftBox(w, h, d, boxMat, ribbonMat, bowMat, x, z, ry, id, bowId) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat); b.position.y = h / 2; g.add(b);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 0.16, d * 1.04), boxMat); lid.position.y = h - h * 0.06; g.add(lid);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, h * 1.02, 0.07), ribbonMat); r1.position.y = h / 2 + 0.005; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, h * 1.02, d * 1.06), ribbonMat); r2.position.y = h / 2 + 0.005; g.add(r2);
  g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); tag(g, id); addInstancePos(id, new THREE.Vector3(x, h * 0.7, z));
  if (bowMat) { const bw = new THREE.Mesh(BOW_GEO, bowMat); bw.scale.setScalar(0.42); bw.rotation.x = -1.2; bw.position.set(x, h + 0.08, z); scene.add(bw); tag(bw, bowId || id); }
  return g;
}
{
  const tartanBox = mat('tartan_wrap', THREE.MeshStandardMaterial, { map: TEX.tartan, roughness: 0.7 });
  const creamRib = mat('tartan_wrap', THREE.MeshStandardMaterial, { color: 0xE9DDC2, roughness: 0.6 });
  const pawBox = mat('paw_wrap', THREE.MeshStandardMaterial, { map: TEX.kraftPaw, roughness: 0.85 });
  const kraftBox = mat('gift_boxes', THREE.MeshStandardMaterial, { map: TEX.giftPrint, roughness: 0.6 });
  const burlapBow = mat('gift_boxes', THREE.MeshStandardMaterial, { color: 0xE2CFA5, roughness: 0.9 });
  const plaidRib = itemMats.tartan_ribbon[0];
  giftBox(0.95, 0.62, 0.9, tartanBox, creamRib, burlapBow, -1.75, 0.55, 0.35, 'tartan_wrap', 'gift_boxes');
  giftBox(0.85, 0.5, 0.75, pawBox, plaidRib, burlapBow, -1.25, 1.55, -0.25, 'paw_wrap', 'gift_boxes');
  giftBox(0.6, 0.42, 0.6, tartanBox, creamRib, null, 1.85, -0.35, 0.5, 'tartan_wrap');
  giftBox(0.7, 0.55, 0.7, kraftBox, plaidRib, burlapBow, 1.95, 0.55, -0.4, 'gift_boxes');
}
// plush bone pillows
function bonePillow(x, z, ry, s, tilt = 0) {
  const id = 'bone_pillow';
  const sherpa = mat(id, THREE.MeshStandardMaterial, { color: 0xDED8CC, roughness: 1, bumpMap: TEX.glitter, bumpScale: 4 });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 8, 16), sherpa); shaft.rotation.z = Math.PI / 2; g.add(shaft);
  [[-0.38, 0.13], [-0.38, -0.13], [0.38, 0.13], [0.38, -0.13]].forEach(([px, py]) => { const k = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), sherpa); k.position.set(px, py, 0); g.add(k); });
  g.scale.set(s, s, s * 0.75);
  const paw = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), mat(id, THREE.MeshStandardMaterial, { map: canvasTex(128, 128, (c) => { c.clearRect(0, 0, 128, 128); drawPaw(c, 64, 66, 100, '#151312'); }), transparent: true, roughness: 0.9 }));
  paw.position.set(0, 0, 0.165); g.add(paw);
  g.position.set(x, 0.17 * s + 0.01, z); g.rotation.set(tilt, ry, 0); scene.add(g); tag(g, id); addInstancePos(id, g.position);
}
bonePillow(-0.45, 1.9, 0.15, 0.9, -0.15);

// pet bowl
{
  const id = 'bowl';
  const prof = [[0, 0], [0.24, 0], [0.27, 0.02], [0.31, 0.18], [0.3, 0.2], [0.25, 0.2], [0.23, 0.04], [0, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 40);
  const tex = TEX.bowl.clone(); tex.needsUpdate = true;
  const m = mat(id, THREE.MeshPhysicalMaterial, { map: tex, roughness: 0.2, clearcoat: 1 });
  const bowl = new THREE.Mesh(geo, m); bowl.position.set(0.35, 0, 2.25); bowl.rotation.y = -1.2; scene.add(bowl); tag(bowl, id); addInstancePos(id, new THREE.Vector3(0.35, 0.15, 2.25));
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.235, 32), mat(id, THREE.MeshPhysicalMaterial, { color: 0xB51420, roughness: 0.15, clearcoat: 1 }));
  inside.rotation.x = -Math.PI / 2; inside.position.set(0.35, 0.05, 2.25); scene.add(inside); tag(inside, id);
}

// gift basket
{
  const bx = 1.2, bz = 1.6;
  const wick = mat('basket', THREE.MeshStandardMaterial, { map: TEX.wicker, roughness: 0.9, side: THREE.DoubleSide });
  const g = new THREE.Group(); g.position.set(bx, 0, bz); g.rotation.y = -0.5; scene.add(g);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.38, 32, 1, true), wick); wall.position.y = 0.19; wall.scale.z = 0.72; g.add(wall);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), wick); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.01; bottom.scale.y = 0.72; g.add(bottom);
  const rimM = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 40), wick); rimM.rotation.x = Math.PI / 2; rimM.position.y = 0.38; rimM.scale.y = 0.72; g.add(rimM);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.028, 8, 32, Math.PI), wick); handle.position.y = 0.38; g.add(handle);
  tag(g, 'basket'); addInstancePos('basket', new THREE.Vector3(bx, 0.3, bz));

  const local = (x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
  g.updateMatrixWorld(true);
  // blanket draped over front-right
  const bl = new THREE.PlaneGeometry(0.8, 0.75, 20, 20); const pa = bl.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); const fold = y > 0 ? 0 : -y; pa.setZ(i, -fold * 0.9 + Math.sin(x * 9) * 0.03); pa.setY(i, y > 0 ? y : y * 0.35); }
  bl.computeVertexNormals();
  const blanket = new THREE.Mesh(bl, mat('blanket', THREE.MeshStandardMaterial, { map: TEX.blanket, roughness: 1, side: THREE.DoubleSide }));
  blanket.rotation.set(-1.1, 0, 0.1); blanket.position.set(0.12, 0.34, 0.22); g.add(blanket); tag(blanket, 'blanket'); addInstancePos('blanket', local(0.12, 0.3, 0.3));
  // glass jar with balls + bow
  const glass = mat('jar', THREE.MeshPhysicalMaterial, { color: 0xdfeeea, roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 28, 1, true), glass); jar.position.set(-0.2, 0.33, -0.05); g.add(jar);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 28), glass); lid.position.set(-0.2, 0.56, -0.05); g.add(lid);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), glass); knob.position.set(-0.2, 0.6, -0.05); g.add(knob);
  tag(jar, 'jar'); tag(lid, 'jar'); tag(knob, 'jar'); addInstancePos('jar', local(-0.2, 0.4, -0.05));
  const jbow = new THREE.Mesh(BOW_GEO, itemMats.mini_bows[0]); jbow.scale.setScalar(0.16); jbow.position.set(-0.2, 0.48, 0.1); g.add(jbow); tag(jbow, 'mini_bows'); addInstancePos('mini_bows', local(-0.2, 0.48, 0.1));
  const ballMat = mat('balls', THREE.MeshStandardMaterial, { color: 0xC0182A, roughness: 0.95, bumpMap: TEX.glitter, bumpScale: 1.5 });
  [[-0.24, 0.19, -0.05], [-0.16, 0.19, -0.02], [-0.2, 0.3, -0.06], [0.28, 0.3, -0.12]].forEach(([x, y, z]) => { const b = new THREE.Mesh(SPH, ballMat); b.scale.setScalar(0.065); b.position.set(x, y, z); g.add(b); tag(b, 'balls'); });
  addInstancePos('balls', local(0.28, 0.3, -0.12));
  // rope toy
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.35, 0.25, -0.2), new THREE.Vector3(0.45, 0.42, -0.05), new THREE.Vector3(0.52, 0.35, 0.12), new THREE.Vector3(0.56, 0.12, 0.2)]);
  const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.035, 10), mat('rope', THREE.MeshStandardMaterial, { map: TEX.rope, roughness: 0.95 })); g.add(rope); tag(rope, 'rope');
  [0, 1].forEach(k => { const kn = new THREE.Mesh(SPH, itemMats.rope[0]); kn.scale.setScalar(0.06); kn.position.copy(curve.getPoint(k ? 0.98 : 0.02)); g.add(kn); tag(kn, 'rope'); });
  addInstancePos('rope', local(0.5, 0.35, 0.05));
  // gift cards
  [0, 1].forEach(k => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.006), [0, 1, 2, 3, 4, 5].map(f => f === 4 ? mat('gift_card', THREE.MeshStandardMaterial, { map: TEX.card, roughness: 0.4 }) : mat('gift_card', THREE.MeshStandardMaterial, { color: 0xFBFAF6, roughness: 0.4 })));
    c.position.set(0.02 + k * 0.07, 0.42 + k * 0.02, 0.05 - k * 0.04); c.rotation.set(-0.25, 0.1 - k * 0.15, 0.05 - k * 0.12); g.add(c); tag(c, 'gift_card'); });
  addInstancePos('gift_card', local(0.05, 0.45, 0.05));
  // holiday plush toy
  // bandanas draped on rim (two triangles)
  // fringed red/green tartan scarves (B075ZCW8JD) folded over the rim, ends hanging outside
  const scarfMat = mat('bandanas', THREE.MeshStandardMaterial, { map: (() => { const t = TEX.tartan.clone(); t.repeat.set(1, 3); t.needsUpdate = true; return t; })(), roughness: 0.95, side: THREE.DoubleSide });
  [[-0.44, 0.02, 0.0], [-0.4, -0.2, 0.35]].forEach(([x, z, ry]) => {
    const sg = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.3), scarfMat); top.position.y = 0.4; sg.add(top);
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.025), scarfMat); drop.position.set(0, 0.23, -0.15); drop.rotation.x = 0.12; sg.add(drop);
    for (let f = 0; f < 9; f++) { const fr = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.008), scarfMat); fr.position.set(-0.07 + f * 0.0175, 0.025, -0.175); sg.add(fr); }
    sg.position.set(x, 0, z); sg.rotation.y = Math.PI / 2 + ry; g.add(sg); tag(sg, 'bandanas');
  });
  addInstancePos('bandanas', local(-0.42, 0.33, -0.1));
  // second plush bone standing in the basket
  const bp = new THREE.Group();
  const sherpa = itemMats.bone_pillow[0];
  const shaft = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.18, 6, 12), sherpa); bp.add(shaft);
  [[-0.06, 0.15], [0.06, 0.15], [-0.06, -0.15], [0.06, -0.15]].forEach(([px, py]) => { const k = new THREE.Mesh(SPH, sherpa); k.scale.setScalar(0.065); k.position.set(px, py, 0); bp.add(k); });
  const bpPaw = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), itemMats.bone_pillow[1]); bpPaw.position.z = 0.066; bp.add(bpPaw);
  bp.position.set(0.2, 0.42, -0.22); bp.rotation.set(-0.2, 0, -0.4); g.add(bp); tag(bp, 'holiday_toy'); addInstancePos('holiday_toy', local(0.2, 0.42, -0.22));
}

/* ---------------- Background bokeh ---------------- */
{
  const tex = canvasTex(64, 64, (g) => { const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,200,120,1)'); grd.addColorStop(0.4, 'rgba(255,170,80,.45)'); grd.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); });
  const n = 60; const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = R(0, Math.PI * 2), r = R(19, 25); pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = R(1, 9); pos[i * 3 + 2] = Math.sin(a) * r; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size: 0.7, transparent: true, depthWrite: false, opacity: 0.5, blending: THREE.AdditiveBlending })));
}
scene.background = new THREE.Color(0x0D110E);
scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { if ('envMapIntensity' in m) m.envMapIntensity = 0.35; }); });
scene.fog = new THREE.Fog(0x0D110E, 20, 42);

/* ---------------- Post-processing ---------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.35, 1.15);
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
