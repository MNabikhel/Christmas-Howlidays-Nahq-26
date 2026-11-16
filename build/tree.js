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

let TARGET = null, CTX = null;   // the group new meshes go into, and the element/option being built
/* ================================================================
   The plan is a set of board elements, each with 2-4 options (data/options.json).
   SEL holds the chosen option per element; resolve.js turns it into the order list,
   supplies and totals (the same code path as build/build_plan.py). Every option is
   built once in 3D, in its own group, and swapping only changes which group shows.
   ================================================================ */
const O = window.HOWL_OPTIONS;
const CAT = O.catalog;
const BUDGET = O.budget, FLOOR = O.floor;
const money = n => (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EL = Object.fromEntries(O.elements.map(e => [e.id, e]));
const DEFAULT_SEL = Object.fromEntries(O.elements.map(e => [e.id, e.default]));
const SEL_KEY = 'howl.selection.v6';
let SEL = (() => { try { const s = JSON.parse(localStorage.getItem(SEL_KEY) || 'null'); if (s) return Object.fromEntries(O.elements.map(e => [e.id, e.options.some(o => o.id === s[e.id]) ? s[e.id] : e.default])); } catch (e) {} return { ...DEFAULT_SEL }; })();
let CUR = window.howlResolve(O, SEL);
let ITEMS = CUR.items, BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const isDefault = () => O.elements.every(e => SEL[e.id] === e.default);
const optOf = (el, id = SEL[el]) => EL[el].options.find(o => o.id === id);
// which element an item belongs to (so a tap on the tree can offer its swaps)
const ELEMENT_OF = {};
O.elements.forEach(e => e.options.forEach(o => o.rows.forEach(r => { ELEMENT_OF[r.id] ||= e.id; })));
Object.assign(ELEMENT_OF, { velvet_ribbon: 'paws', glitter_card: 'paws', burlap_ribbon: 'gifts', tartan_wrap: 'gifts', paw_wrap: 'gifts', clay: 'bones', tartan_ribbon: 'ribbon' });

const ABOUT = "Pets are family, and nothing says home for the holidays like a wagging tail. Golden retrievers and tabby cats in tartan scarves sit among paw-print ornaments, red brick doghouses and biscuit bones under a burlap paw-print bow. Below, a dog and cat wait beside a gift basket for the winning bidder's best friend.";
const NOT_ON_TREE = {
  floral_wire: { note: 'Wraps every ornament, bow, pick and plush pet to the branches so nothing falls off in transit.', show: [] },
  bone_cutters: { note: 'Cuts the faux biscuits for the jar, highlighted now.', show: ['faux_treats'] },
  felt: { note: 'Black felt: the 20 paws on the topper bow and the paw on the bone pillow, highlighted now.', show: ['topper', 'topper_4in', 'bone_pillow'] },
  clay: { note: 'Air-dry foam clay for the bones and the faux biscuits, highlighted now.', show: ['bones', 'bones_small', 'faux_treats'] },
  glitter_card: { note: 'The black sparkly paw on every paw ornament, highlighted now.', show: ['paw_disc', 'paw_disc_fay'] },
  velvet_ribbon: { note: 'Hand-tied into the deep red bows on the paw ornaments and the treat jar, highlighted now.', show: ['paw_disc', 'paw_disc_fay', 'jar'] },
  burlap_ribbon: { note: 'Cream ribbon and bows on the wrapped gifts, highlighted now.', show: ['gift_boxes'] },
  tartan_wrap: { note: 'Wraps gifts A, B and C, highlighted now.', show: ['gift_boxes'] },
  paw_wrap: { note: 'Wraps gift D, highlighted now.', show: ['gift_boxes'] },
  craft_supplies: { note: 'Paint, gesso, glue, cord and tools for every DIY build, highlighted now. Every line and its calculated quantity is in the committee plan.', show: ['doghouse', 'doghouse_small', 'doghouse_xl', 'paw_disc', 'paw_disc_fay', 'paw_disc_wood', 'bones', 'bones_small', 'faux_treats', 'topper', 'topper_4in'] },
  ct_supplies: { note: 'Tape for the gift boxes, plus a drop sheet for painting in the office.', show: ['gift_boxes', 'doghouse_xl'] },
  shipping: { note: 'Delivery charged by the Amazon.ca listings that are not free. $0 with Prime.', show: [] },
};
const STATUS = { est: 'Estimated price', listed: 'Price as listed when checked', face: 'Face value' };
const SEC_COLORS = ['#2E7D5B', '#B3263A', '#C9962E', '#7E6A55', '#5A7FA6', '#6F7F86'];
const MATCH = { match: 'Match', close: 'Close' };

/* ---------------- Panel: budget, shopping list, swaps ---------------- */
document.getElementById('about').textContent = ABOUT;
const budgetEl = document.getElementById('budget'), listEl = document.getElementById('list'), swapsEl = document.getElementById('swaps');
function renderBudget() {
  const T = CUR.totals, secs = O.sections.filter(s => ITEMS.some(i => i.section === s));
  const secTotal = s => ITEMS.filter(i => i.section === s).reduce((a, i) => a + i.total, 0);
  const tone = T.left < 0 ? 'over' : T.left < FLOOR ? 'tight' : 'ok';
  const changed = O.elements.filter(e => SEL[e.id] !== e.default).length;
  budgetEl.innerHTML = `
    <div class="big"><b>${money(T.grand)}</b><span>of ${money(BUDGET)} incl. GST · <em class="${tone}">${T.left < 0 ? money(-T.left) + ' over' : money(T.left) + ' left'}</em></span></div>
    <div class="meter" role="img" aria-label="Spend by section">${secs.map(s => `<i style="width:${(secTotal(s) / BUDGET * 100).toFixed(2)}%;background:${SEC_COLORS[O.sections.indexOf(s)]}"></i>`).join('')}<i style="width:${(T.gst / BUDGET * 100).toFixed(2)}%;background:#8C8C8C"></i></div>
    <div class="legend">${secs.map(s => `<span style="--c:${SEC_COLORS[O.sections.indexOf(s)]}">${s}</span>`).join('')}<span style="--c:#8C8C8C">GST ${money(T.gst)}</span></div>
    ${tone !== 'ok' ? `<p class="warn">${tone === 'over' ? 'Over the $2,000 budget.' : `Under the $${FLOOR} we keep for price changes.`} Swap something back to fit.</p>` : ''}
    <p class="selnote">${changed ? `${changed} swap${changed > 1 ? 's' : ''} from the board match · <button type="button" class="linkish" id="resetSel">Back to the board match</button>` : 'Showing the board match: the closest version of every element.'}</p>`;
  const rs = document.getElementById('resetSel'); if (rs) rs.onclick = () => { SEL = { ...DEFAULT_SEL }; applySel(); };
}
function renderList() {
  const secs = O.sections.filter(s => ITEMS.some(i => i.section === s));
  listEl.innerHTML = secs.map(s => `
    <h3>${s}<span>${money(ITEMS.filter(i => i.section === s).reduce((a, i) => a + i.total, 0))}</span></h3>
    ${ITEMS.filter(i => i.section === s).map(i => `
      <div class="item${NOT_ON_TREE[i.id] ? ' nov' : ''}${i.img ? ' has-thumb' : ''}${i.id === selected ? ' on' : ''}" data-id="${i.id}" tabindex="0" role="button" aria-label="Show ${i.name.replace(/"/g, '&quot;')} on the tree">
        ${i.img ? `<img class="thumb" src="${i.img}" alt="" loading="lazy">` : ''}<div class="nm">${i.name}</div>
        <div class="tot">${money(i.total)}</div>
        <div class="meta">${i.diy ? '<span class="badge diy">DIY</span>' : ''}<span>${i.diy ? 'makes ' + i.made + (i.total ? ' · materials' : '') : (i.qty + ' × ' + money(i.price))}</span>
          <a href="${i.url}" target="_blank" rel="noopener">${i.store.replace(/ \(.*\)$/, '').replace(/, South Edmonton.*$/, '')} ↗</a></div>
      </div>`).join('')}`).join('');
}
// price of the plan if one element switched to another option (for the +/- on each choice)
const deltaFor = (el, opt) => window.howlResolve(O, { ...SEL, [el]: opt }).totals.grand - CUR.totals.grand;
function optButtons(e, { compact = false } = {}) {
  return e.options.map(o => {
    const on = SEL[e.id] === o.id, d = on ? 0 : deltaFor(e.id, o.id);
    const dTxt = on ? 'chosen' : Math.abs(d) < 0.005 ? '$0' : (d > 0 ? '+' : '−') + money(Math.abs(d)).slice(1);
    return `<button type="button" class="opt" role="radio" aria-checked="${on}" data-el="${e.id}" data-opt="${o.id}">
      ${o.thumb ? `<img src="${o.thumb}" alt="">` : `<span class="nothumb" aria-hidden="true">—</span>`}
      <span class="ol">${o.label}${o.id === e.default ? ' <i class="star" title="Closest to the board">★</i>' : ''}</span>
      <span class="od${d > 0.005 ? ' up' : d < -0.005 ? ' down' : ''}">${dTxt}</span>
      ${!compact && o.match ? `<span class="om ${o.match}">${MATCH[o.match]}</span>` : !compact ? '<span class="om extra">Extra</span>' : ''}
    </button>`;
  }).join('');
}
function renderSwaps() {
  swapsEl.innerHTML = `<p class="swaphint">Every element of the board, with the options we checked. <b>★</b> is the closest match to the board; the price shows what a swap adds or saves, GST included. The tree, the list, the budget and the exports all follow your choices.</p>` +
    O.elements.map(e => { const o = optOf(e.id); return `
    <div class="swap" data-el="${e.id}">
      <div class="swap-h"><b>${e.title}</b>${o.match ? `<span class="om ${o.match}">${MATCH[o.match]}</span>` : '<span class="om extra">Extra</span>'}<button type="button" class="linkish see" data-el="${e.id}">Show</button></div>
      <div class="opts" role="radiogroup" aria-label="${e.title}">${optButtons(e)}</div>
      <p class="why">${o.why}</p>
    </div>`; }).join('');
}
function onOptClick(ev) {
  const b = ev.target.closest('.opt'); if (b) { SEL = { ...SEL, [b.dataset.el]: b.dataset.opt }; applySel({ focusEl: b.dataset.el }); return; }
  const s = ev.target.closest('.see'); if (s) { const ids = visibleIdsOf(s.dataset.el); if (ids.length) select(ids[0], { focus: true }); }
}
swapsEl.addEventListener('click', onOptClick);
document.querySelectorAll('[data-tab]').forEach(t => t.onclick = () => {
  document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === t)));
  document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
});

/* ---------------- Export: the Word files follow the current selection ---------------- */
{
  const msg = document.getElementById('exportMsg'), box = document.querySelector('.export'), HINT = msg.textContent;
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', PDF = 'application/pdf';
  const b64Blob = (b64, type) => new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type });
  const canBuild = () => window.docx && window.howlDocs && window.HOWL_FONTS;
  // the form and the plan are built in the page from the current list (same code as build/build_docx.js);
  // the pre-built files are the fallback for the board-match selection
  const docBlob = async kind => {
    if (canBuild()) return window.howlDocs.blob(window.docx, kind, { items: ITEMS, supplies: CUR.supplies, totals: CUR.totals, onHand: O.on_hand, fonts: window.HOWL_FONTS, widths: window.HOWL_WIDTHS, chosen: CUR.chosen, elements: O.elements, sel: SEL });
    if (isDefault()) return b64Blob(kind === 'form' ? window.HOWL_DOCX : window.HOWL_PLAN, DOCX);
    throw Object.assign(new Error('builder unavailable'), { code: 'nobuild' });
  };
  const FILES = [
    { btn: document.getElementById('export'), name: 'HP26_Tree_Gallery_Form_Corporate_Finance.docx', make: () => docBlob('form'), ok: !!window.HOWL_DOCX },
    { btn: document.getElementById('exportPlan'), name: 'HP26_Committee_Plan_Corporate_Finance.docx', make: () => docBlob('plan'), ok: !!window.HOWL_PLAN },
    { btn: document.getElementById('exportTpl'), name: 'HP26_Templates.pdf', make: async () => b64Blob(window.HOWL_TPL, PDF), ok: !!window.HOWL_TPL },
    { btn: document.getElementById('exportSign'), name: 'HP26_Doghouse_Sign_11x17.pdf', make: async () => b64Blob(window.HOWL_SIGN, PDF), ok: !!window.HOWL_SIGN, el: ['giant', 'build'] },
  ];
  const viaClaude = () => window.claude && typeof window.claude.use === 'function';
  if (!window.HOWL_DOCX) box.hidden = true;
  if (viaClaude()) window.claude.use('downloads').then(dl => { if (!dl) box.hidden = true; });
  window.howlExportRefresh = () => FILES.forEach(f => { if (f.el) f.btn.hidden = !f.ok || SEL[f.el[0]] !== f.el[1]; });
  FILES.forEach(f => {
    if (!f.ok) { f.btn.hidden = true; return; }
    f.btn.onclick = async () => {
      msg.textContent = HINT;
      let blob;
      try { blob = await f.make(); } catch (e) { msg.textContent = e.code === 'nobuild' ? 'The Word builder did not load (it needs the internet). Go back to the board match to export the ready-made files.' : 'Could not build ' + f.name + '.'; return; }
      if (!viaClaude()) {   // standalone preview file opened in a normal browser
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f.name; document.body.append(a); a.click(); a.remove();
        msg.textContent = 'Downloading ' + f.name + '.'; return;
      }
      const dl = await window.claude.use('downloads');
      if (!dl) { box.hidden = true; return; }
      FILES.forEach(x => { x.btn.disabled = true; });
      try {
        const r = await dl.save({ filename: f.name, data: blob });
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

/* ================================================================
   Scene: built at real-world scale from the listings (size_in in data/options.json).
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
const SZ = id => (CAT[id] && CAT[id].size_in) || {};

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
function addInstancePos(id, v) { (instancesOf[id] ||= []).push({ p: v.clone(), g: TARGET || scene }); }
const shown = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
const visiblePts = id => (instancesOf[id] || []).filter(e => shown(e.g)).map(e => e.p);
const visibleIdsOf = el => [...new Set(optOf(el).rows.map(r => r.id).concat(el === 'ribbon' ? ['tartan_ribbon'] : []))].filter(id => visiblePts(id).length);
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
  (TARGET || scene).add(mesh); return mesh;
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
  m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.004, z); (TARGET || scene).add(m);
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
// Each option avoids the board-match pieces of every other element, and its own pieces, but not the
// other options of its own element (they are never shown together).
const placed = [];
const blocks = q => !q.el || !CTX ? true : q.el === CTX.el ? q.opt === CTX.opt : q.def;
function spot(size, yMin, yMax, depth = 0.97) {
  const tag = CTX ? { el: CTX.el, opt: CTX.opt, def: CTX.def } : {};
  for (let t = 0; t < 160; t++) {
    const y = yMin + (yMax - yMin) * rand(), th = rand() * Math.PI * 2, r = rAt(y) * depth + 0.02;
    const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    if (placed.every(q => !blocks(q) || q.p.distanceTo(p) > (q.s + size) * 0.5)) { placed.push({ p, s: size, ...tag }); return { p, th }; }
  }
  const y = yMin + (yMax - yMin) * rand(), th = rand() * Math.PI * 2, r = rAt(y) * depth + 0.02;
  const p = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r); placed.push({ p, s: size, ...tag }); return { p, th };
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
function bowGeo({ ribbon, span, tail, loops = 2, uLen = ribbon, seed = 1, open = 0, flare = 0.32 }) {
  const r = rng(seed), parts = [], W = ribbon * IN, Lb = span / 2 * IN, T = tail * IN;
  const loopDefs = loops === 2 ? [[0, 0.22, 1], [Math.PI, 0.22, 1]] : [[0, 0.5, 1], [Math.PI, 0.5, 1], [0, -0.32, 0.82], [Math.PI, -0.32, 0.82]];
  loopDefs.forEach(([yaw, tilt, len]) => {
    const pts = [], nrm = [], L = Lb * len * (0.95 + r() * 0.1), dz = Math.max(W * 0.62, L * 0.34);
    for (let i = 0; i <= 40; i++) {
      const th = i / 40 * Math.PI * 2;
      const x = L / 2 * (1 - Math.cos(th)) * (1 - 0.12 * Math.sin(th / 2)), z = dz * Math.sin(th) * (0.75 + 0.25 * Math.sin(th / 2));
      const p = new THREE.Vector3(x, 0, z), n = new THREE.Vector3(x - L / 2, 0, z * 1.6).normalize();
      const e = new THREE.Euler(open, yaw, tilt); p.applyEuler(e); n.applyEuler(e); p.z += 0.15 * W; pts.push(p); nrm.push(n);
    }
    parts.push(strip(pts, nrm, W, { uLen: uLen * IN, taper: t => 0.55 + 0.45 * Math.sin(Math.min(1, Math.sin(t * Math.PI) * 1.4) * Math.PI / 2) }));
  });
  [-1, 1].forEach(s => {  // tails
    const pts = [], nrm = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, tw = 0.5 * Math.sin(t * 3.2 + s);
      pts.push(new THREE.Vector3(s * (0.03 * W + t * T * flare + Math.sin(t * 4) * 0.08 * W), -t * T * (1 - flare * 0.35), 0.1 * W + Math.sin(t * 2.6 + s) * 0.2 * W + t * T * flare * 0.25));
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
const ribbonMat = (id, tex) => mat(id, THREE.MeshStandardMaterial, { map: photoTex(tex, [1, 1]), roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.3 });
const RIB = { 6: ['tx_burlap6', 10], 4: ['tx_burlap4', 10], 2.5: ['tx_burlap25', 6], 1.5: ['tx_burlap15', 6] };   // ribbon width (in) -> texture, inches per repeat
const goldMetal = id => mat(id, THREE.MeshStandardMaterial, { color: 0xcfa24e, metalness: 0.95, roughness: 0.3 });
const sherpaTex = canvasTex(256, 256, (g, w) => { g.fillStyle = '#e9e1d2'; g.fillRect(0, 0, w, w); for (let i = 0; i < 1400; i++) { const x = Math.random() * w, y = Math.random() * w, r = 2 + Math.random() * 4; g.fillStyle = Math.random() < .5 ? '#f6f0e4' : '#cfc4b0'; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); } }, { repeat: [3, 2] });
const BUILD = {};

/* ---------------- Topper bow and its optional extras ---------------- */
BUILD.topper = (r, id) => {
  const [tex, rep] = RIB[r.ribbon];
  const g = bowGeo({ ribbon: r.ribbon, span: r.span, tail: r.tail, loops: r.loops, uLen: rep, seed: 9, open: r.loops === 2 ? 0.62 : 0.2, flare: r.loops === 2 ? 0.58 : 0.4 });
  const bow = new THREE.Mesh(g, ribbonMat(id, tex)); bow.position.set(0, YTOP + 0.1 + (r.ribbon - 4) * IN * 0.45, 0.14); bow.castShadow = true;
  TARGET.add(bow); tag(bow, id); addInstancePos(id, bow.position);
};
BUILD.flourish = r => {
  if (r.streamers) [-1, 1].forEach(s => {   // two burlap streamers from the bow down the front of the tree
    const pts = [], nrm = [], yEnd = Y0 + 0.4;
    for (let i = 0; i <= 260; i++) {
      const t = i / 260, y = YTOP - 0.1 - t * (YTOP - 0.1 - yEnd), th = Math.PI / 2 + s * (0.24 + t * 0.42) + 0.05 * Math.sin(t * 17 + s);
      const ph = t * 5.5, bulge = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 2);
      const rr = rAt(y) * 0.97 + 0.05 + 0.16 * bulge * (0.4 + t), tw = 0.55 * Math.sin(ph * Math.PI * 2 + s);
      const rad = new THREE.Vector3(Math.cos(th), 0.15, Math.sin(th)).normalize(), tan = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      pts.push(new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr)); nrm.push(rad.multiplyScalar(Math.cos(tw)).addScaledVector(tan, Math.sin(tw)).normalize());
    }
    const m = new THREE.Mesh(strip(pts, nrm, 6 * IN, { uLen: 10 * IN, notch: true }), ribbonMat('topper', 'tx_burlap6')); m.castShadow = true; TARGET.add(m); tag(m, 'topper');
  });
  if (r.crown) {   // twelve gold glitter sprays fanned out behind the bow
    const beads = [], L = (SZ('gold_picks').h || 17) * IN * 0.85, c = new THREE.Vector3(0, YTOP + 0.05, -0.05);
    const stems = [], up = new THREE.Vector3(0, 1, 0), gm = mat('gold_picks', THREE.MeshStandardMaterial, { color: 0xd8b062, metalness: 0.9, roughness: 0.3, emissive: 0x3a2508, emissiveIntensity: 0.6 });
    for (let k = 0; k < 12; k++) {
      const a = -1.3 + k / 11 * 2.6 + R(-0.05, 0.05), dir = new THREE.Vector3(Math.sin(a), Math.cos(a) * 0.95, -0.22).normalize(), len = L * R(0.85, 1.05);
      stems.push({ p: c.clone().addScaledVector(dir, len * 0.5), rot: new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)), sv: new THREE.Vector3(1, len, 1), noMark: true });
      for (let b = 0; b < 22; b++) { const t = 0.35 + Math.pow(b / 22, 0.8) * 0.65, side = new THREE.Vector3(R(-1, 1), R(-1, 1), R(-1, 1)).multiplyScalar((b % 3 ? 0.35 : 1.1) * IN); beads.push({ p: c.clone().addScaledVector(dir, len * t).add(side), s: 0.2 * IN * R(0.8, 1.3), noMark: !(k === 6 && b === 10) }); }
    }
    instanced(new THREE.CylinderGeometry(0.06 * IN, 0.09 * IN, 1, 5), gm, stems, null);
    instanced(new THREE.SphereGeometry(1, 16, 10), gm, beads, 'gold_picks');
  }
};

/* ---------------- Plush pets on the tree (real product photos, cut out, with their tartan scarves) ---------------- */
BUILD.dogs = (r, id) => {
  for (let i = 0; i < r.n; i++) {
    const { p } = spotFront(r.h * IN * 1.1, 2.0, 3.7, 1.0, i ? 1.7 : 0.55);
    photoCard(r.cut, id, r.h, p.clone().add(new THREE.Vector3(0, -0.12, 0)));
    addInstancePos('bandanas', p.clone().add(new THREE.Vector3(0, r.h * IN * 0.45, 0.05)));
  }
};
BUILD.cats = (r, id) => {
  for (let i = 0; i < r.n; i++) {
    const { p } = spotFront(r.h * IN * 1.2, 2.9, 5.4, 1.0, i ? 1.4 : 0.85);
    photoCard(r.cut, id, r.h, p.clone().add(new THREE.Vector3(0, -0.08, 0)));
    addInstancePos('bandanas', p.clone().add(new THREE.Vector3(0, r.h * IN * 0.5, 0.05)));
  }
};

/* ---------------- Doghouse ornaments: foam board, true size from the template ---------------- */
const brickTex = canvasTex(256, 256, (g, w) => {   // 11.6 courses per tile; a tile covers 6.4"
  g.fillStyle = '#3c0f0b'; g.fillRect(0, 0, w, w);
  for (let y = 0; y < w; y += 22) for (let x = (y / 22) % 2 ? -26 : 0; x < w; x += 52) { g.fillStyle = `hsl(${2 + Math.random() * 6}, ${55 + Math.random() * 15}%, ${26 + Math.random() * 8}%)`; g.fillRect(x + 2, y + 2, 48, 18); }
  noise(g, w, w, 2500, 0.2, ['#000', '#c86a5a']);
});
const shingleTex = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#d9c497'; g.fillRect(0, 0, w, w);
  for (let y = 0; y < w; y += 32) for (let x = (y / 32) % 2 ? -24 : 0; x < w; x += 48) { g.fillStyle = `hsl(40, ${38 + Math.random() * 12}%, ${72 + Math.random() * 10}%)`; g.fillRect(x + 1, y, 46, 30); g.fillStyle = 'rgba(80,55,25,.35)'; g.fillRect(x, y + 28, 48, 3); g.fillRect(x, y, 2, 30); }
  noise(g, w, w, 1500, 0.15, ['#5a3d1d']);
});
BUILD.doghouses = (r, id) => {
  const W = r.w * IN, D = r.d * IN, wallH = r.wall * IN, H = r.ridge * IN, big = r.w > 5, over = (big ? 0.75 : 0.35) * IN, tile = 6.4 * IN;
  const frontTex = canvasTex(512, Math.round(512 * r.ridge / r.w), (g, w, h) => {
    const b = brickTex.image, tw = w * 6.4 / r.w; for (let x = 0; x < w; x += tw) for (let y = 0; y < h; y += tw) g.drawImage(b, x, y, tw, tw);
    const px = w / r.w, dw = (big ? 3.8 : 1.5) * px, dh = (big ? 4.6 : 1.9) * px, dx = w / 2, by = h, trim = (big ? 0.5 : 0.22) * px;
    g.fillStyle = '#efe0bf';
    [[0, trim], [w - trim, trim]].forEach(([x, tw2]) => g.fillRect(x, h - r.wall * px, tw2, r.wall * px));   // cream corner trims
    g.beginPath(); g.moveTo(dx - dw / 2 - trim, by); g.lineTo(dx - dw / 2 - trim, by - dh + dw / 2); g.arc(dx, by - dh + dw / 2, dw / 2 + trim, Math.PI, 0); g.lineTo(dx + dw / 2 + trim, by); g.fill();
    const ig = g.createRadialGradient(dx, by - 20, 5, dx, by - dh * 0.5, dh); ig.addColorStop(0, '#d98a3a'); ig.addColorStop(0.35, '#5b2a12'); ig.addColorStop(1, '#170905');
    g.fillStyle = ig; g.beginPath(); g.moveTo(dx - dw / 2, by); g.lineTo(dx - dw / 2, by - dh + dw / 2); g.arc(dx, by - dh + dw / 2, dw / 2, Math.PI, 0); g.lineTo(dx + dw / 2, by); g.fill();
    drawPaw(g, w / 2, h - (r.wall + (r.ridge - r.wall) * 0.38) * px, (big ? 2.5 : 1) * px, '#efe0bf');
  }, { clamp: true });
  const brick = brickTex.clone(); brick.needsUpdate = true; brick.repeat.set(D / tile, wallH / tile);
  const shingle = shingleTex.clone(); shingle.needsUpdate = true; shingle.repeat.set(1.2 * r.w / 8.5, 1.2 * r.d / 6);
  const body = new THREE.BoxGeometry(W, wallH, D); body.translate(0, wallH / 2, 0);
  const gable = new THREE.Shape(); gable.moveTo(-W / 2, 0); gable.lineTo(W / 2, 0); gable.lineTo(W / 2, wallH); gable.lineTo(0, H); gable.lineTo(-W / 2, wallH); gable.closePath();
  const front = new THREE.ShapeGeometry(gable); { const uv = front.attributes.uv, p = front.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, p.getY(i) / H); } front.translate(0, 0, D / 2 + 0.001);
  const back = new THREE.ShapeGeometry(gable); back.rotateY(Math.PI); back.translate(0, 0, -D / 2 - 0.001);
  const slope = Math.atan2(H - wallH, W / 2), rl = Math.hypot(W / 2, H - wallH) + over;
  const roofs = [-1, 1].map(sg => { const rf = new THREE.BoxGeometry(rl, 0.3 * IN, D + 2 * over); rf.rotateZ(-sg * slope); rf.translate(sg * (rl / 2 - over * 0.6) * Math.cos(slope), H - (rl / 2 - over * 0.6) * Math.sin(slope) + 0.15 * IN, 0); return rf; });
  const geoBrick = mergeGeometries([body.toNonIndexed(), back.toNonIndexed()]), geoRoof = mergeGeometries(roofs.map(x => x.toNonIndexed()));
  const mBrick = mat(id, THREE.MeshStandardMaterial, { map: brick, roughness: 0.8 }), mFront = mat(id, THREE.MeshStandardMaterial, { map: frontTex, roughness: 0.8, side: THREE.DoubleSide }), mRoof = mat(id, THREE.MeshStandardMaterial, { map: shingle, roughness: 0.75 });
  const list = [];
  for (let i = 0; i < r.n; i++) {
    const { p } = i < 2 ? spotFront(H * 1.15, 2.2, 4.4, 1.03, i ? 1.3 : 0.3) : spot(H * 1.15, Y0 + 0.7, YTOP - 1.3, 1.03);
    list.push({ p: p.clone().add(new THREE.Vector3(0, -H * 0.5, 0)), rot: new THREE.Euler(0, faceY(p) + R(-0.25, 0.25), R(-0.05, 0.05)) });
  }
  instanced(geoBrick, mBrick, list, id); instanced(front, mFront, list.map(l => ({ ...l, noMark: true })), id); instanced(geoRoof, mRoof, list.map(l => ({ ...l, noMark: true })), id);
};

/* ---------------- Paw ornaments ---------------- */
BUILD.paws = (r, id) => {
  const list = [];
  if (r.kind === 'hoop') {   // 6" embroidery hoop painted gold, ivory Aida, black glitter paw, hand-tied dark red velvet bow
    const Rr = r.d / 2 * IN, tube = 0.3 * IN, top = Rr + 1.5 * IN;
    const ring = new THREE.TorusGeometry(Rr, tube, 10, 72); ring.scale(1, 1, 1.4);
    const face = new THREE.CircleGeometry(Rr - tube * 0.5, 64);
    const clasp = mergeGeometries([new THREE.BoxGeometry(0.55 * IN, 0.6 * IN, 0.75 * IN).translate(0, Rr + 0.25 * IN, 0).toNonIndexed(), new THREE.CylinderGeometry(0.13 * IN, 0.13 * IN, 1.1 * IN, 10).rotateZ(Math.PI / 2).translate(0, Rr + 0.45 * IN, 0).toNonIndexed()]);
    const bow = bowGeo({ ribbon: 1.5, span: r.bow || 9, tail: 8, loops: 2, uLen: 3, seed: 31, open: 0.5, flare: 0.85 }); bow.translate(0, Rr + 1.3 * IN, 0.45 * IN);
    [ring, face, clasp, bow].forEach(g => g.translate(0, -top, 0));
    const faceTex = canvasTex(512, 512, (g, w) => {
      g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, w);
      g.strokeStyle = 'rgba(120,100,70,.18)'; g.lineWidth = 1; for (let k = 0; k < w; k += 6) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, w); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); }   // 14-count weave
      noise(g, w, w, 9000, 0.25, ['#fff7e6', '#b9a57f']);
      const m = document.createElement('canvas'); m.width = m.height = w; const mg = m.getContext('2d'); drawPaw(mg, w / 2, w * 0.53, w * 0.66, '#111');
      mg.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 9000; i++) { mg.fillStyle = ['#2a2a2a', '#555', '#8c8c8c', '#0c0c0c'][(Math.random() * 4) | 0]; mg.fillRect(Math.random() * w, Math.random() * w, 2, 2); }   // glitter card
      g.drawImage(m, 0, 0);
    }, { clamp: true });
    for (let i = 0; i < r.n; i++) {
      const { p } = i < 2 ? spotFront(top * 2, 1.8, 5.0, 1.04, i ? 1.4 : 0.6) : spot(top * 2, Y0 + 0.5, YTOP - 0.8, 1.04);
      list.push({ p, rot: new THREE.Euler(R(-0.08, 0.04), faceY(p) + R(-0.3, 0.3), R(-0.08, 0.08)) });
    }
    instanced(ring, goldMetal(id), list, id);
    instanced(face, mat(id, THREE.MeshStandardMaterial, { map: faceTex, roughness: 0.9, side: THREE.DoubleSide }), list.map(l => ({ ...l, noMark: true })), id);
    instanced(clasp, mat(id, THREE.MeshStandardMaterial, { color: 0xb8954a, metalness: 1, roughness: 0.35 }), list.map(l => ({ ...l, noMark: true })), id);
    instanced(bow, velvet(id, 0x5a0a14), list.map(l => ({ ...l, noMark: true })), id);
  } else {                   // 4" painted wood rounds with a mini velvet bow (the earlier design)
    const h = 4.3 * IN, geo = new THREE.PlaneGeometry(h * CUT.paw_disc.w / CUT.paw_disc.h, h); geo.translate(0, -h / 2, 0);
    for (let i = 0; i < r.n; i++) { const { p } = spot(h * 1.1, Y0 + 0.3, YTOP - 0.5, 0.99); list.push({ p, rot: new THREE.Euler(R(-0.1, 0.05), faceY(p) + R(-0.35, 0.35), R(-0.12, 0.12)) }); }
    instanced(geo, mat(id, THREE.MeshStandardMaterial, { map: photoTex('paw_disc'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.65 }), list, id);
    instanced(bowGeo({ ribbon: 1, span: 3.5, tail: 2.5, seed: 11 }), velvet('mini_bows'), list.map(({ p, rot }) => ({ p: p.clone().add(new THREE.Vector3(0, 0.1 * IN, 0)).addScaledVector(new THREE.Vector3(Math.sin(rot.y), 0, Math.cos(rot.y)), 0.012), rot })), 'mini_bows');
  }
};

/* ---------------- Bone ornaments ---------------- */
BUILD.bones = (r, id) => {
  const L = r.l * IN, H = L * 0.36, T = L * 0.15;
  const parts = [new THREE.CapsuleGeometry(H * 0.28, L * 0.6, 6, 14).rotateZ(Math.PI / 2)];
  [[-1, 1], [-1, -1], [1, 1], [1, -1]].forEach(([x, y]) => parts.push(new THREE.SphereGeometry(H * 0.3, 16, 12).translate(x * L * 0.36, y * H * 0.21, 0)));
  const geo = mergeGeometries(parts.map(p => p.toNonIndexed())); geo.scale(1, 1, T / (H * 0.6));
  const m = r.kind === 'fleece' ? mat(id, THREE.MeshStandardMaterial, { map: sherpaTex, bumpMap: sherpaTex, bumpScale: 2, roughness: 1 })
                                : mat(id, THREE.MeshPhysicalMaterial, { color: 0xEBDAB6, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const list = [];
  for (let i = 0; i < r.n; i++) { const { p } = i < 2 ? spotFront(L, 1.8, 4.8, 1.03, i ? 1.2 : 0.45) : spot(L, Y0 + 0.3, YTOP - 0.6, 1.03); list.push({ p, rot: new THREE.Euler(R(-0.15, 0.15), faceY(p) + R(-0.3, 0.3), R(-0.22, 0.22)) }); }
  instanced(geo, m, list, id);
};

/* ---------------- Baubles: what each pack holds, at its listed size ---------------- */
const SPH = new THREE.SphereGeometry(1, 40, 24);
const capGeo = (() => { const c = new THREE.CylinderGeometry(0.2, 0.22, 0.22, 16); c.translate(0, 1.0, 0); const l = new THREE.TorusGeometry(0.08, 0.02, 6, 12); l.translate(0, 1.16, 0); return mergeGeometries([c.toNonIndexed(), l.toNonIndexed()]); })();
const capMat = new THREE.MeshStandardMaterial({ color: 0xcaa25a, metalness: 1, roughness: 0.28 });
const glitterNormal = canvasTex(512, 512, (g, w) => { const im = g.createImageData(w, w); for (let i = 0; i < w * w; i++) { const a = Math.random() * Math.PI * 2, s = Math.random() < 0.6 ? Math.random() * 0.9 : 0; im.data[i * 4] = 128 + Math.cos(a) * s * 127; im.data[i * 4 + 1] = 128 + Math.sin(a) * s * 127; im.data[i * 4 + 2] = 255 * Math.sqrt(1 - s * s * 0.5); im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: [5, 3], srgb: false });
const glitterRough = canvasTex(256, 256, (g, w) => { const im = g.createImageData(w, w); for (let i = 0; i < w * w; i++) { const v = Math.random() < 0.35 ? 20 : 150 + Math.random() * 90; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: [5, 3], srgb: false });
const finish = {
  shiny: () => ({ color: 0xffffff, metalness: 0.7, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 }),
  mirror: () => ({ color: 0xffffff, metalness: 1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.7 }),
  matte: () => ({ color: 0xffffff, metalness: 0.35, roughness: 0.45, clearcoat: 0.3, envMapIntensity: 1.2 }),
  glitter: () => ({ color: 0xffffff, metalness: 0.8, roughness: 0.42, roughnessMap: glitterRough, normalMap: glitterNormal, normalScale: new THREE.Vector2(0.9, 0.9) }),
};
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
const pickOne = arr => arr[(rand() * arr.length) | 0];
const RED = '#b3121d', GOLD = '#d4ae5c';
const BALL = {      // one pack, as sold
  baubles_rgg: () => (SZ('baubles_rgg').d_mix || [[2.4, 32], [1.6, 36], [1.2, 32]]).flatMap(([d, n]) => Array.from({ length: n }, () => ({ d, c: pickOne(['#b8121f', '#b8121f', '#17683d', '#17683d', '#d7a64a']), f: pickOne(['shiny', 'shiny', 'glitter', 'matte']) }))),
  baubles_champ: () => (SZ('baubles_champ').d_mix || [[2.4, 33], [1.6, 34], [1.2, 33]]).flatMap(([d, n]) => Array.from({ length: n }, () => ({ d, c: pickOne(['#d9c39a', '#cdb07a', '#e8dcc2', '#b9a07a']), f: pickOne(['shiny', 'matte', 'glitter']) }))),
  glitter_red: () => Array.from({ length: 12 }, (_, i) => ({ d: 3.15, f: 'tex:' + ['meridian', 'swirl', 'lattice', 'half'][i % 4] })),
  glitter_champ: () => Array.from({ length: 12 }, () => ({ d: 3.15, c: '#dcc08a', f: 'glitter' })),
  glitter_green: () => Array.from({ length: 6 }, () => ({ d: 3.94, c: '#1b6b3c', f: 'glitter' })),
  red4_glitter: () => Array.from({ length: 6 }, () => ({ d: 3.94, c: '#a50f1b', f: 'glitter' })),
  red4_joyin: () => ['shiny', 'matte', 'glitter', 'mirror'].map(f => ({ d: 4, c: RED, f })),
  gold4_joyin: () => ['glitter', 'matte', 'shiny', 'mirror'].map(f => ({ d: 4, c: GOLD, f })),
  red6_benjia: () => ['shiny', 'shiny', 'matte', 'glitter'].map(f => ({ d: 6, c: '#b0101c', f })),
  redgold6: () => ['swirl', 'lattice', 'half', 'meridian'].map(k => ({ d: 6, f: 'tex:' + k })),
};
function balls(id, list, spots) {   // list: [{ d (in), c, f }]; big first so they get the best spots
  const groups = {};
  list.forEach(b => { const r = b.d / 2 * IN; const { p } = spot(r * 2.2, Y0 + 0.25 + r, YTOP - 0.3, b.d >= 3.9 ? 0.93 : 0.9); (groups[b.f] ||= []).push({ p, s: r, c: b.c, rot: new THREE.Euler(R(-0.2, 0.2), R(0, 6.28), R(-0.2, 0.2)) }); spots.push({ p, s: r }); });
  Object.entries(groups).forEach(([f, l]) => {
    const tex = f.startsWith('tex:') ? f.slice(4) : null;
    const m = tex ? mat(id, THREE.MeshPhysicalMaterial, { map: PATTERN[tex], metalnessMap: PATTERN_M[tex], metalness: 1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, normalMap: glitterNormal, normalScale: new THREE.Vector2(0.35, 0.35) })
                  : mat(id, THREE.MeshPhysicalMaterial, finish[f]());
    instanced(SPH, m, l, id);
  });
}
BUILD.baubles = r => {
  const spots = [];
  r.sets.map(([id, packs]) => [id, Array.from({ length: packs }, () => BALL[id]()).flat()])
    .sort((a, b) => Math.max(...b[1].map(x => x.d)) - Math.max(...a[1].map(x => x.d)))
    .forEach(([id, list]) => balls(id, list, spots));
  instanced(capGeo, capMat, spots.map(b => ({ p: b.p, s: b.s, noMark: true })), null);
};

/* ---------------- Tartan ribbon: cascades with poufs, and big hand-tied bows ---------------- */
BUILD.ribbon = r => {
  const m = tartanMat('tartan_ribbon');
  for (let k = 0; k < r.cascades; k++) {
    const th0 = k * Math.PI * 2 / r.cascades + 0.25, pts = [], nrm = [];
    for (let i = 0; i <= 320; i++) {
      const t = i / 320, y = YTOP - 0.55 - t * (YTOP - Y0 - 0.55), th = th0 + 0.5 * t + 0.04 * Math.sin(t * 13 + k);
      const ph = t * 4.5 + k * 0.37, bulge = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 2.2);
      const rr = rAt(y) * 0.95 + 0.02 + 0.11 * bulge * (0.5 + rAt(y) / RB * 0.5), tw = 0.5 * Math.sin(ph * Math.PI * 2 + 1.2);
      const rad = new THREE.Vector3(Math.cos(th), 0.25 + bulge * 0.5 * Math.cos(ph * Math.PI * 2), Math.sin(th)).normalize(), tan = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      pts.push(new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr)); nrm.push(rad.multiplyScalar(Math.cos(tw)).addScaledVector(tan, Math.sin(tw)).normalize());
    }
    const mesh = new THREE.Mesh(strip(pts, nrm, 4 * IN, { uLen: 4 * IN }), m); mesh.castShadow = true; TARGET.add(mesh); tag(mesh, 'tartan_ribbon');
    addInstancePos('tartan_ribbon', pts[160]);
  }
  const B = SZ('big_bows'), list = [];
  for (let i = 0; i < r.bows; i++) { const { p } = spot((B.w || 11) * IN * 1.45, 1.6, 5.6, 1.0);   /* wide berth: the tails must not cover the pets and ornaments */ list.push({ p, rot: new THREE.Euler(R(-0.12, 0.12), faceY(p), R(-0.15, 0.15)) }); }
  instanced(bowGeo({ ribbon: 4, span: B.w || 11, tail: (B.h || 18) - 3, seed: 3 }), tartanMat('big_bows'), list, 'big_bows');
};

/* ---------------- Stockings and the gold, pine and berry picks ---------------- */
const cards = [];
function photoCard(name, id, heightIn, pos, { anchor = 'bottom', emissive = 0.38, mark = true } = {}) {
  const c = CUT[name], h = heightIn * IN, w = h * c.w / c.h;
  const g = new THREE.PlaneGeometry(w, h); g.translate(0, anchor === 'top' ? -h / 2 : anchor === 'center' ? 0 : h / 2, 0);
  const tex = photoTex(name);
  const m = mat(id, THREE.MeshStandardMaterial, { map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive, envMapIntensity: 0.2 });
  const mesh = new THREE.Mesh(g, m); mesh.position.copy(pos); mesh.castShadow = true; TARGET.add(mesh); cards.push(mesh);
  mesh.userData.itemId = id; pickables.push(mesh); if (mark) addInstancePos(id, pos.clone().add(new THREE.Vector3(0, anchor === 'bottom' ? h / 2 : anchor === 'top' ? -h / 2 : 0, 0)));
  return mesh;
}
function updateCards() { for (const c of cards) if (c.parent && c.parent.visible) c.rotation.y = Math.atan2(camera.position.x - c.position.x, camera.position.z - c.position.z); }
BUILD.stockings = r => { ['stock_red', 'stock_green', 'stock_cream'].forEach(n => { for (let i = 0; i < r.n / 3; i++) { const { p } = spot(SZ('stockings').h * IN, 1.4, 5.5, 1.0); photoCard(n, 'stockings', (SZ('stockings').h || 4.3) * 1.25, p, { anchor: 'top' }); } }); };
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
BUILD.greens = r => {
  sprays('gold_picks', r.gold, 0xd4ad5c, 3, 0.4, 6);
  for (let i = 0; i < Math.round(r.pine * 2 / 3); i++) { const { p } = spot(0.35, 1.3, 5.8, 0.95); photoCard('pine_pick', 'pine_picks', (SZ('pine_picks').h || 4) * 1.3, p, { anchor: 'center' }); }
  if (r.berries) {   // glossy red berry clusters (0.6" berries on 7" stems)
    const list = [], bd = (SZ('glossy_berries').berry_d || 0.6) * IN;
    for (let i = 0; i < r.berries; i++) { const { p, th } = spot(0.25, 1.3, 6.3, 0.97); const out = new THREE.Vector3(Math.cos(th), 0, Math.sin(th)); for (let k = 0; k < 7; k++) list.push({ p: p.clone().add(new THREE.Vector3(R(-1, 1) * 1.1 * IN, R(-0.6, 1.6) * IN, R(-1, 1) * 1.1 * IN)).addScaledVector(out, 0.03), s: bd / 2 * R(0.85, 1.1), noMark: k > 0 }); }
    instanced(SPH, mat('glossy_berries', THREE.MeshPhysicalMaterial, { color: 0x9d0a12, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }), list, 'glossy_berries');
  }
};

/* ---------------- Under the tree: wrapped gifts ---------------- */
function giftBox([wi, di, hi], faceMat, ribbonMat, ribIn, x, z, ry, id, bow, oneWay = false) {
  const w = wi * IN, d = di * IN, h = hi * IN, g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faceMat); b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b);
  const rw = ribIn * IN;
  (oneWay ? [[rw, h * 1.006, d * 1.006]] : [[w * 1.006, h * 1.006, rw], [rw, h * 1.006, d * 1.006]]).forEach(([a, bb, c]) => { const rb = new THREE.Mesh(new THREE.BoxGeometry(a, bb, c), ribbonMat); rb.position.y = h / 2; g.add(rb); });
  g.position.set(x, 0, z); g.rotation.y = ry; TARGET.add(g); tag(g, id); addInstancePos(id, new THREE.Vector3(x, h * 0.7, z));
  contactShadow(x, z, w * 1.5, d * 1.5, ry, 0.7);
  if (bow) { const m = new THREE.Mesh(bow.geo, bow.mat); m.position.set(x, h + 0.01, z); m.rotation.set(-1.25, ry, 0); m.castShadow = true; TARGET.add(m); tag(m, bow.id); }
  return g;
}
const boxTex = (name, wi, hi) => photoTex(name, [+(wi / 8).toFixed(2), +(hi / 8).toFixed(2)]);
BUILD.gifts = () => {
  const B = SZ('gift_boxes').boxes || [[18, 11, 12], [16, 16, 16], [16, 16, 10], [18, 11, 7]];
  const tw = s => mat('tartan_wrap', THREE.MeshStandardMaterial, { map: boxTex('tx_tartan_wrap', s[0], s[2]), roughness: 0.42 });
  const kp = s => mat('paw_wrap', THREE.MeshStandardMaterial, { map: boxTex('tx_paw_wrap', s[0], s[2]), roughness: 0.85 });
  const cream = mat('burlap_ribbon', THREE.MeshStandardMaterial, { color: 0xcdb48a, roughness: 0.95 });
  const creamBow = { geo: bowGeo({ ribbon: 1.5, span: 10, tail: 6, uLen: 6, seed: 23 }), mat: ribbonMat('burlap_ribbon', 'tx_burlap15'), id: 'burlap_ribbon' };
  // the four Canadian Tire moving boxes at their real sizes: tartan with cream ribbon (A, B, C), kraft paw paper with tartan ribbon (D)
  giftBox(B[0], tw(B[0]), cream, 1.5, -1.6, 1.05, 0.35, 'gift_boxes', creamBow);
  giftBox(B[1], tw(B[1]), cream, 1.5, -1.45, -0.7, 0.15, 'gift_boxes', creamBow);
  giftBox(B[2], tw(B[2]), cream, 1.5, 1.6, 0.25, -0.45, 'gift_boxes', creamBow);
  giftBox(B[3], kp(B[3]), tartanMat('tartan_ribbon'), 4, 0.95, 1.45, -0.2, 'gift_boxes', creamBow, true);
};
BUILD.floor = r => {
  if (r.pillow) {   // cream sherpa bone pillow, 15" x 9" x 3", with the black felt paw
    const s = SZ('bone_pillow'); const L = (s.w || 15) * IN, H = (s.d || 9) * IN, T = (s.h || 3) * IN;
    const parts = [];
    for (let k = -3; k <= 3; k++) parts.push(new THREE.SphereGeometry(H * 0.27, 20, 14).translate(k * L * 0.08, 0, 0));
    [[-1, 1], [-1, -1], [1, 1], [1, -1]].forEach(([x, y]) => parts.push(new THREE.SphereGeometry(H * 0.3, 20, 14).translate(x * L * 0.33, y * H * 0.2, 0)));
    const geo = mergeGeometries(parts.map(p => p.toNonIndexed())); geo.scale(1, 1, T / (H * 0.6));
    const g = new THREE.Group(); const body = new THREE.Mesh(geo, mat('bone_pillow', THREE.MeshStandardMaterial, { map: sherpaTex, bumpMap: sherpaTex, bumpScale: 3, roughness: 1 })); body.castShadow = true; g.add(body);
    const pawT = canvasTex(256, 256, (c, w) => { c.clearRect(0, 0, w, w); drawPaw(c, 128, 136, 210, '#141414'); }, { clamp: true });
    const paw = new THREE.Mesh(new THREE.PlaneGeometry(4.5 * IN, 4.5 * IN), mat('felt', THREE.MeshStandardMaterial, { map: pawT, transparent: true, alphaTest: 0.3, roughness: 1 }));
    paw.position.set(-L * 0.18, 0.2 * IN, T * 0.52); g.add(paw);
    g.position.set(-1.95, H * 0.42, 2.7); g.rotation.set(-0.35, 0.45, 0.06); TARGET.add(g); tag(g, 'bone_pillow'); addInstancePos('bone_pillow', g.position);
    contactShadow(-1.95, 2.65, L * 1.3, H * 1.1, 0.45, 0.75);
  }
  if (r.bowl) {     // red glazed bowl with white dots and two painted paws
    const s = SZ('bowl'); const rr = (s.w || 5.9) / 2 * IN, h = (s.h || 1.8) * IN;
    const prof = [[0, 0], [rr * 0.72, 0], [rr * 0.8, h * 0.06], [rr * 0.98, h * 0.85], [rr, h], [rr * 0.93, h], [rr * 0.76, h * 0.2], [0, h * 0.16]].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(prof, 64); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > h * 0.6) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + Math.abs(Math.sin(a * 6)) * h * 0.12 * ((y - h * 0.6) / (h * 0.4))); } }
    geo.computeVertexNormals();
    const dots = canvasTex(1024, 256, (g, w, hh) => { g.fillStyle = '#b5101c'; g.fillRect(0, 0, w, hh); g.fillStyle = '#fbf7ef'; for (let y = 40; y < hh; y += 90) for (let x = (y / 90) % 2 ? 60 : 0; x < w; x += 120) { g.beginPath(); g.arc(x, y, 14, 0, 6.28); g.fill(); } [w * 0.22, w * 0.72].forEach(x => { g.fillStyle = '#b5101c'; g.fillRect(x - 70, 20, 140, 200); drawPaw(g, x, 125, 120, '#fbf7ef'); }); });
    const bowl = new THREE.Mesh(geo, mat('bowl', THREE.MeshPhysicalMaterial, { map: dots, roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide }));
    bowl.position.set(-0.78, 0, 3.95); bowl.castShadow = true; TARGET.add(bowl); tag(bowl, 'bowl'); addInstancePos('bowl', new THREE.Vector3(-0.78, h, 3.95));
    contactShadow(-0.78, 3.95, rr * 3, rr * 3, 0, 0.7);
  }
};

/* ---------------- Gift basket: wicker 13" x 10.5" x 6", 11" to the handle ---------------- */
BUILD.basket = r => {
  const s = SZ('basket'); const bw = (s.w || 13) * IN, bd = (s.d || 10.5) * IN, bh = (s.h || 6) * IN, hh = (s.handle_h || 11) * IN;
  const bx = 2.0, bz = 2.35, ry = -0.55;
  const g = new THREE.Group(); g.position.set(bx, 0, bz); g.rotation.y = ry; TARGET.add(g);
  const wick = mat('basket', THREE.MeshStandardMaterial, { map: photoTex('tx_wicker2', [4, 1]), roughness: 0.85, side: THREE.DoubleSide });
  const liner = mat('basket', THREE.MeshStandardMaterial, { color: 0xEFE7D8, roughness: 1, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(bw / 2, bw / 2 * 0.86, bh, 48, 1, true), wick); wall.position.y = bh / 2; wall.scale.z = bd / bw; g.add(wall);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(bw / 2 * 0.86, 48), wick); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.005; bottom.scale.y = bd / bw; g.add(bottom);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(bw / 2 * 1.03, bw / 2 * 1.0, 1.6 * IN, 48, 1, true), liner); cuff.position.y = bh - 0.5 * IN; cuff.scale.z = bd / bw; g.add(cuff);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(bw * 0.36, 0.35 * IN, 8, 40, Math.PI), mat('basket', THREE.MeshStandardMaterial, { map: photoTex('tx_wicker2', [6, 1]), roughness: 0.8 })); handle.position.y = bh; handle.scale.y = (hh - bh) / (bw * 0.36); g.add(handle);
  tag(g, 'basket'); addInstancePos('basket', new THREE.Vector3(bx, bh * 0.6, bz)); contactShadow(bx, bz, bw * 1.5, bd * 1.5, ry, 0.8);
  g.updateMatrixWorld(true); const W = (x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
  if (r.blanket) {   // red paw-print throw (50 x 60 in), folded and draped over the front rim
    const bl = new THREE.PlaneGeometry(bw * 0.8, bw * 0.75, 28, 28); const pa = bl.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); const fold = y > 0 ? 0 : -y; pa.setZ(i, -fold * 1.05 + Math.sin(x * 30) * 0.012 + Math.sin(y * 22) * 0.01); pa.setY(i, y > 0 ? y : y * 0.25); }
    bl.computeVertexNormals();
    const blanket = new THREE.Mesh(bl, mat('blanket', THREE.MeshStandardMaterial, { map: photoTex('tx_blanket', [1.2, 1.2]), roughness: 1, side: THREE.DoubleSide }));
    blanket.rotation.set(-1.25, 0, 0.1); blanket.position.set(bw * 0.1, bh + 0.01, bd * 0.18); g.add(blanket); tag(blanket, 'blanket'); addInstancePos('blanket', W(bw * 0.1, bh, bd * 0.4));
  }
  if (r.jar) {       // glass jar 7" x 9.9" with lid, lined with the faux biscuits, deep red velvet bow
    const js = SZ('jar'); const jr = (js.w || 7) / 2 * IN, jh = (js.h || 9.9) * IN;
    const jp = [[0.001, 0], [jr * 0.85, 0], [jr, jh * 0.12], [jr * 1.02, jh * 0.55], [jr * 0.93, jh * 0.84], [jr * 0.75, jh * 0.88], [jr * 0.75, jh * 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
    const glass = mat('jar', THREE.MeshPhysicalMaterial, { color: 0xeef6f2, metalness: 0, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6, specularIntensity: 1 });
    const jar = new THREE.Group(); jar.position.copy(new THREE.Vector3(-bw * 0.18, bh * 0.45, -bd * 0.1)); g.add(jar);
    jar.add(new THREE.Mesh(new THREE.LatheGeometry(jp, 40), glass));
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(jr * 0.82, jr * 0.82, 0.45 * IN, 36), glass); lid.position.y = jh * 0.92; jar.add(lid);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.7 * IN, 20, 14), glass); knob.position.y = jh * 0.92 + 0.7 * IN; jar.add(knob);
    tag(jar, 'jar'); addInstancePos('jar', W(-bw * 0.18, bh * 0.45 + jh * 0.5, -bd * 0.1));
    const bs = SZ('faux_treats'); const bl2 = (bs.w || 3) * IN * 0.9, bh2 = (bs.h || 1.2) * IN;
    const parts = [new THREE.CapsuleGeometry(bh2 * 0.25, bl2 * 0.6, 4, 10).rotateZ(Math.PI / 2)]; [[-1, 1], [-1, -1], [1, 1], [1, -1]].forEach(([x, y]) => parts.push(new THREE.SphereGeometry(bh2 * 0.28, 10, 8).translate(x * bl2 * 0.38, y * bh2 * 0.2, 0)));
    const bgeo = mergeGeometries(parts.map(p => p.toNonIndexed())); bgeo.scale(1, 1, 0.55);
    const list = []; jar.updateMatrixWorld(true);
    for (let i = 0; i < 30; i++) { const y = 0.25 * IN + i * jh * 0.026, a = R(0, 6.28), rr = R(jr * 0.35, jr * 0.8); list.push({ p: jar.localToWorld(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr)), rot: new THREE.Euler(R(-1.2, 1.2), R(0, 6.28), R(-0.6, 0.6)), noMark: i > 0 }); }
    instanced(bgeo, mat('faux_treats', THREE.MeshStandardMaterial, { color: 0xC8955A, roughness: 0.85 }), list, 'faux_treats');
    const jb = new THREE.Mesh(bowGeo({ ribbon: 1.5, span: 7, tail: 6, loops: 2, uLen: 3, seed: 33 }), velvet('velvet_ribbon', 0x5a0a14)); jb.position.copy(W(-bw * 0.18, bh * 0.45 + jh * 0.8, -bd * 0.1 + jr * 1.02)); jb.rotation.y = ry; TARGET.add(jb); tag(jb, 'jar');
  }
  const felt = canvasTex(256, 128, (c, w, hh2) => { c.fillStyle = '#b01322'; c.fillRect(0, 0, w, hh2); noise(c, w, hh2, 5000, 0.35, ['#e04050', '#70060f']); c.strokeStyle = '#f4ece0'; c.lineWidth = 5; c.beginPath(); for (let x = 0; x <= w; x += 4) c.lineTo(x, hh2 / 2 + Math.sin(x / w * Math.PI * 4) * hh2 * 0.28); c.stroke(); });
  const bm = mat('balls', THREE.MeshStandardMaterial, { map: felt, roughness: 1, bumpMap: felt, bumpScale: 1 }); const brd = (SZ('balls').d || 2.58) / 2 * IN;
  [[bw * 0.1, bh + brd * 0.6, bd * 0.05], [bw * 0.62, brd, bd * 0.75]].forEach(([x, y, z], i) => { const b = new THREE.Mesh(SPH, bm); b.scale.setScalar(brd); b.rotation.set(R(0, 3), R(0, 3), 0); b.position.set(x, y, z); b.castShadow = true; g.add(b); tag(b, 'balls'); if (!i) addInstancePos('balls', W(x, y, z)); });
  [0, 1].forEach(k => { const c = new THREE.Mesh(new THREE.BoxGeometry(3.4 * IN, 2.1 * IN, 0.003), [0, 1, 2, 3, 4, 5].map(f => f === 4 ? mat('gift_card', THREE.MeshStandardMaterial, { map: photoTex('tx_card'), roughness: 0.4 }) : mat('gift_card', THREE.MeshStandardMaterial, { color: 0xFBFAF6, roughness: 0.4 })));
    c.position.set(bw * 0.08 + k * 0.06, bh + 1.2 * IN + k * 0.02, -bd * 0.12 - k * 0.03); c.rotation.set(-0.25, 0.1 - k * 0.15, 0.05 - k * 0.12); g.add(c); tag(c, 'gift_card'); });
  addInstancePos('gift_card', W(bw * 0.1, bh + 1.4 * IN, -bd * 0.1));
  photoCard('small_bone', 'holiday_toy', (SZ('holiday_toy').d || 5.7), W(bw * 0.28, bh * 0.75, -bd * 0.25));
  photoCard('rope_cane', 'rope', 8, W(bw * 0.38, bh * 0.6, -bd * 0.05));
  photoCard('rope_knot', 'rope', 5, W(bw * 0.42, bh * 0.7, bd * 0.2), { mark: false });
};

/* ---------------- Giant doghouse (extra): 24 x 20 x 26", sign; the pair sits in its doorway ---------------- */
const GIANT = (() => { const S = SZ('doghouse_xl'); return { S, W: (S.w || 24) * IN, D: (S.d || 20) * IN, H: (S.h || 26) * IN }; })();
GIANT.Z = RB + GIANT.D / 2 + 0.12; GIANT.front = GIANT.Z + GIANT.D / 2;
BUILD.pair = () => {   // the board's dog-and-cat photo: a golden retriever and a tabby in fringed tartan scarves
  const free = new THREE.Group(), door = new THREE.Group(); TARGET.add(free); TARGET.add(door); TARGET.userData.free = free; TARGET.userData.door = door;
  const dh = SZ('golden').h || 11, ch = SZ('cat_fluffy').h || 8, prev = TARGET;
  TARGET = free;
  photoCard('golden_scarf', 'golden', dh, new THREE.Vector3(0.42, 0, 2.62)); photoCard('cat_fluffy', 'cat_fluffy', ch, new THREE.Vector3(0.98, 0, 2.86));
  contactShadow(0.42, 2.66, 0.85, 0.5, 0, 0.8); contactShadow(0.98, 2.9, 0.6, 0.38, 0, 0.8);
  addInstancePos('bandanas', new THREE.Vector3(0.42, dh * IN * 0.55, 2.66));
  TARGET = door;
  photoCard('golden_scarf', 'golden', dh, new THREE.Vector3(0, 0, GIANT.front + 0.07)); photoCard('cat_fluffy', 'cat_fluffy', ch, new THREE.Vector3(GIANT.W * 0.62, 0, GIANT.front + 0.22));
  contactShadow(0, GIANT.front + 0.1, 0.85, 0.5, 0, 0.8); contactShadow(GIANT.W * 0.62, GIANT.front + 0.24, 0.55, 0.32, 0, 0.8);
  addInstancePos('bandanas', new THREE.Vector3(0, 0.45, GIANT.front + 0.1));
  TARGET = prev;
};
BUILD.giant = () => {
  const { S } = GIANT, W = GIANT.W, D = GIANT.D, H = GIANT.H, wallH = (S.wall || 16) * IN, doorW = (S.door_w || 10) * IN, doorH = (S.door_h || 13) * IN, X = 0, Z = GIANT.Z;
  const brick = (rx, ry) => canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#3a0e0a'; g.fillRect(0, 0, w, w); const bh = w / 12, bw = bh * 2.4;
    for (let y = 0; y < w; y += bh) for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < w; x += bw) { g.fillStyle = `hsl(${2 + Math.random() * 6}, ${55 + Math.random() * 15}%, ${25 + Math.random() * 9}%)`; g.fillRect(x + 3, y + 3, bw - 6, bh - 6); }
    noise(g, w, w, 9000, 0.18, ['#000', '#c86a5a']);
  }, { repeat: [rx, ry] });
  const wIn = S.w || 24, hIn = S.h || 26;
  const frontTex = canvasTex(1040, Math.round(1040 * hIn / wIn), (g, w, h) => {
    const b = brick(1, 1).image; for (let x = 0; x < w; x += w * 18 / wIn) for (let y = 0; y < h; y += h * 18 / hIn) g.drawImage(b, x, y, w * 18 / wIn, h * 18 / hIn);
    const dw = w * (S.door_w || 10) / wIn, dhh = h * (S.door_h || 13) / hIn, cx = w / 2, trim = w * 1.3 / wIn;
    g.fillStyle = '#efe0bf'; g.beginPath(); g.moveTo(cx - dw / 2 - trim, h); g.lineTo(cx - dw / 2 - trim, h - dhh + dw / 2); g.arc(cx, h - dhh + dw / 2, dw / 2 + trim, Math.PI, 0); g.lineTo(cx + dw / 2 + trim, h); g.fill();
    g.fillStyle = '#1a0d07'; g.beginPath(); g.moveTo(cx - dw / 2, h); g.lineTo(cx - dw / 2, h - dhh + dw / 2); g.arc(cx, h - dhh + dw / 2, dw / 2, Math.PI, 0); g.lineTo(cx + dw / 2, h); g.fill();
    drawPaw(g, cx, h * (1 - 22 / hIn), w * 3.6 / wIn, '#efe0bf');
  }, { clamp: true });
  const shingle = canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#d6c08f'; g.fillRect(0, 0, w, w); const ch = w / 4, sw = ch * 0.75;
    for (let y = 0; y < w; y += ch) for (let x = (y / ch) % 2 ? -sw / 2 : 0; x < w; x += sw) { g.fillStyle = `hsl(41, ${36 + Math.random() * 12}%, ${72 + Math.random() * 10}%)`; g.fillRect(x + 2, y, sw - 3, ch - 4); g.fillStyle = 'rgba(80,55,25,.4)'; g.fillRect(x, y + ch - 5, sw, 5); }
    noise(g, w, w, 6000, 0.14, ['#5a3d1d']);
  }, { repeat: [1, 1] });
  const g = new THREE.Group(); g.position.set(X, 0, Z); TARGET.add(g);
  const bm = mat('doghouse_xl', THREE.MeshStandardMaterial, { map: brick(W / (18 * IN), wallH / (18 * IN)), roughness: 0.85 });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, wallH, D), [bm, bm, hidden, hidden, hidden, bm]); body.position.y = wallH / 2; g.add(body);
  const inside = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, wallH * 0.97, D * 0.94), mat('doghouse_xl', THREE.MeshStandardMaterial, { color: 0x2a160c, roughness: 1, side: THREE.BackSide })); inside.position.y = wallH * 0.49; g.add(inside);
  const gableS = new THREE.Shape(); gableS.moveTo(-W / 2, 0); gableS.lineTo(W / 2, 0); gableS.lineTo(W / 2, wallH); gableS.lineTo(0, H * 0.96); gableS.lineTo(-W / 2, wallH); gableS.closePath();
  const doorP = new THREE.Path(); doorP.moveTo(-doorW / 2, 0); doorP.lineTo(-doorW / 2, doorH - doorW / 2); doorP.absarc(0, doorH - doorW / 2, doorW / 2, Math.PI, 0, true); doorP.lineTo(doorW / 2, 0); doorP.closePath();
  const frontShape = gableS.clone(); frontShape.holes.push(doorP);
  const fg = new THREE.ShapeGeometry(frontShape, 24); { const uv = fg.attributes.uv, pp = fg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pp.getX(i) + W / 2) / W, pp.getY(i) / H); }
  const front = new THREE.Mesh(fg, mat('doghouse_xl', THREE.MeshStandardMaterial, { map: frontTex, roughness: 0.82 })); front.position.z = D / 2 + 0.002; g.add(front);
  const back = new THREE.Mesh(new THREE.ShapeGeometry(gableS), bm); back.rotation.y = Math.PI; back.position.z = -D / 2 - 0.002; g.add(back);
  const slope = Math.atan2(H * 0.96 - wallH, W / 2), rl = Math.hypot(W / 2, H * 0.96 - wallH) + 2.5 * IN;
  const rm = mat('doghouse_xl', THREE.MeshStandardMaterial, { map: shingle, roughness: 0.8 }); rm.map.repeat.set(rl / (16 * IN), (D + 4 * IN) / (16 * IN));
  [-1, 1].forEach(sg => { const rf = new THREE.Mesh(new THREE.BoxGeometry(rl, 1 * IN, D + 4 * IN), rm); rf.rotation.z = -sg * slope; rf.position.set(sg * (rl / 2 - 1.2 * IN) * Math.cos(slope), H * 0.96 - (rl / 2 - 1.2 * IN) * Math.sin(slope) + 0.6 * IN, 0); g.add(rf); });
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(2.2 * IN, 1.4 * IN, D + 4.5 * IN), mat('doghouse_xl', THREE.MeshStandardMaterial, { color: 0xe7d6b0, roughness: 0.7 })); ridge.position.y = H * 0.96 + 1.1 * IN; g.add(ridge);
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
};

/* ---------------- Build every option of every element, each in its own group ---------------- */
const GROUPS = {};
const rowId = (el, opt) => ((EL[el].options.find(o => o.id === opt).rows || [])[0] || {}).id;
function build(el, opt) {
  const g = new THREE.Group(); g.name = el + '.' + opt; scene.add(g); (GROUPS[el] ||= {})[opt] = g;
  const o = EL[el].options.find(x => x.id === opt); if (!o.rows.length && !Object.keys(o.render || {}).length) return g;   // "none"
  const prevT = TARGET, prevC = CTX; TARGET = g; CTX = { el, opt, def: EL[el].default === opt };
  try { BUILD[el](o.render || {}, rowId(el, opt)); } finally { TARGET = prevT; CTX = prevC; }
  return g;
}
const ORDER = ['topper', 'flourish', 'giant', 'gifts', 'floor', 'basket', 'pair', 'dogs', 'cats', 'doghouses', 'paws', 'bones', 'ribbon', 'baubles', 'stockings', 'greens'];   // hero pieces first, so they get the front
ORDER.forEach(el => build(el, EL[el].default));                                                     // the board match gets the best spots
ORDER.forEach(el => EL[el].options.forEach(o => { if (o.id !== EL[el].default) build(el, o.id); }));   // each alternative fits round the others' defaults


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
  { el: null, text: () => `Doghouse ${ftIn(SZ('doghouse_xl').h || 26)}`, at: () => new THREE.Vector3(0, GIANT.H, GIANT.Z), when: () => SEL.giant === 'build' },
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
  ids.forEach(id => visiblePts(id).forEach(p => {
    const s = new THREE.Sprite(markerMat); s.position.copy(p); s.scale.setScalar(0.3); s.renderOrder = 999; markerGroup.add(s);
  }));
}

const card = document.getElementById('card');
card.addEventListener('click', onOptClick);
function select(id, { focus = false } = {}) {
  selected = id;
  document.querySelectorAll('.item').forEach(el => el.classList.toggle('on', el.dataset.id === id));
  if (!id) { card.hidden = true; setHighlight([]); return; }
  const it = BY_ID[id] || { ...CAT[id], qty: 0, total: 0 }; const extra = NOT_ON_TREE[id]; const el = ELEMENT_OF[id];
  const showIds = extra ? extra.show : [id];
  setHighlight(showIds);
  const storeShort = it.store.replace(/ \(.*\)$/, '');
  card.innerHTML = `
    <div class="row1"><div style="display:grid;gap:5px"><div>${it.diy ? '<span class="badge diy">DIY</span> ' : ''}<span class="badge sec">${it.section}</span></div><h2>${it.name}</h2></div>
      <button class="close" type="button" aria-label="Close">✕</button></div>
    <div class="facts">
      <div class="fact"><span>Cost</span><b>${it.diy ? 'DIY' : money(it.price)}</b></div>
      <div class="fact"><span>${it.diy ? 'Makes' : 'Qty'}</span><b>${it.diy ? (it.made ?? '—') : it.qty}</b></div>
      <div class="fact"><span>Total</span><b>${money(it.total)}</b></div>
    </div>
    ${it.img || it.notes ? `<div class="photo">${it.img ? `<img src="${it.img}" alt="Listing photo: ${it.name.replace(/"/g, '&quot;')}">` : ''}<div>${it.match ? `<span class="ok">${it.diy ? 'DIY: target look from our board' : { match: 'Photo matches the look', close: 'Close to the look' }[it.match]}</span>` : ''}<p>${it.notes || ''}${it.arrives_by ? ` <b>Arrives by ${new Date(it.arrives_by + 'T12:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}.</b>` : ''}</p></div></div>` : ''}
    ${it.how ? `<p class="where"><b>${it.diy ? 'How to make it' : 'Finishing touch'}:</b> ${it.how}</p>` : ''}
    ${it.materials ? `<p class="src">Materials in this total: ${it.materials.map(s => { const x = CUR.supplies.find(y => y.id === s); return x ? `${x.qty} × ${x.name}` : s; }).join('; ')}.</p>` : ''}
    ${el && EL[el].options.length > 1 ? `<div class="cardswap"><span>Swap ${EL[el].title.toLowerCase()}</span><div class="opts compact" role="radiogroup" aria-label="${EL[el].title}">${optButtons(EL[el], { compact: true })}</div></div>` : ''}
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
  const pts = ids.flatMap(visiblePts); if (!pts.length) return;
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
  const hits = ray.intersectObjects([...pickables, core], false).filter(h => shown(h.object));
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
  if (id) { const r = stage.getBoundingClientRect(); tip.textContent = (BY_ID[id] || CAT[id]).name.replace(/ \(.*?\)/g, '').split(':')[0]; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.hidden = false; canvas.classList.add('hovering'); }
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
    MEASURE.forEach(m => { v.copy(m.at()).project(camera); const vis = (!m.when || m.when()) && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1; m.el.hidden = !vis; if (!vis) return;
      m.el.textContent = m.text(); m.el.style.left = ((v.x + 1) / 2 * r.width) + 'px'; m.el.style.top = ((1 - v.y) / 2 * r.height) + 'px'; });
  });
}
/* ---------------- Apply a selection: show its groups, re-resolve the list, budget and exports ---------------- */
function applySel({ focusEl } = {}) {
  O.elements.forEach(e => Object.entries(GROUPS[e.id] || {}).forEach(([o, g]) => { g.visible = o === SEL[e.id]; }));
  const pg = GROUPS.pair && GROUPS.pair.pair;   // the dog and cat sit in the giant doghouse's doorway when it is built
  if (pg && pg.userData.free) { pg.userData.free.visible = SEL.giant !== 'build'; pg.userData.door.visible = SEL.giant === 'build'; }
  CUR = window.howlResolve(O, SEL); ITEMS = CUR.items; BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
  try { localStorage.setItem(SEL_KEY, JSON.stringify(SEL)); } catch (e) {}
  document.getElementById('about').textContent = window.howlDocs ? window.howlDocs.aboutText(SEL) : ABOUT;
  renderBudget(); renderList(); renderSwaps(); if (window.howlExportRefresh) window.howlExportRefresh();
  if (selected) { if (BY_ID[selected] || (ELEMENT_OF[selected] && visiblePts(selected).length)) select(selected); else select(null); }
  renderer.shadowMap.needsUpdate = true;
  if (focusEl) { const ids = visibleIdsOf(focusEl); if (ids.length) { setHighlight(ids); focusOn(ids); } }
}
applySel();
window.__howl = { select, instancesOf, pickables, stop: () => renderer.setAnimationLoop(null), frame, camera, controls, setSel: s => { SEL = { ...SEL, ...s }; applySel(); }, sel: () => ({ ...SEL }), totals: () => CUR.totals, groups: GROUPS };
