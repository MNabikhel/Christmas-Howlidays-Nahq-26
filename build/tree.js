import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
   - Photo cutouts as fixed two-sided reliefs (they never turn to the
     camera): the plush pets, knit stockings and basket toys, shaped by
     depth maps (data/depth), with a plain fur-coloured back.
   ================================================================ */
const CUT = window.HOWL_CUTS;
const IN = 1 / 14;
const SZ = id => (CAT[id] && CAT[id].size_in) || {};

const canvas = document.getElementById('scene');
const stage = canvas.parentElement;
// Quality tier: phones, small screens and low-memory devices get a lighter scene.
const LOW = (() => { try { return matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 700 || (navigator.deviceMemory || 8) <= 4; } catch (e) { return false; } })();
const REDUCED_MOTION = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW ? 1.5 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // PCF reads shadow.radius (PCF_SOFT ignores it)
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 120);
// Home view: close, a little below the tree's middle, normal lens, like the board photo.
const HOME_POS = new THREE.Vector3(0.4, 3.1, 10.8);   // bow to gifts in frame (tree about 90% of the height at fov 40), with room for the HUD row
const HOME_TARGET = new THREE.Vector3(0, 3.65, 0);
camera.position.copy(HOME_POS);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME_TARGET);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 1.0, maxDistance: 11.5, maxPolarAngle: Math.PI * 0.54, minPolarAngle: Math.PI * 0.1, autoRotate: true, autoRotateSpeed: 0.5, enablePan: false });

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

const pmremGen = new THREE.PMREMGenerator(renderer);
/* ================================================================
   Settings (rooms) and scene extras.
   Rooms and extras register themselves; the HUD "Extras ✦" popover is generated
   from these registries. build/build_tree.py appends every build/extras_*.js after
   this file in the same module, so they can call registerRoom / registerExtra and
   read `core`. Extras are for fun: they never call tag(), never join pickables or
   instancesOf, and never touch SEL, the list or the totals.
   ================================================================ */
const XS = { room: 'living', lights: 'steady', on: {}, ready: false, saved: null, render: null };   // extras state
const XKEY = 'howl.extras.v2';   // v2: the default setting became the cabin porch, so older saved choices are dropped once
const DEFAULT_ROOM = 'porch', DEFAULT_LIGHTS = 'steady';   // what a first-time viewer sees ("All extras off" still gives the clean living-room board view)
try { const s = JSON.parse(localStorage.getItem(XKEY) || 'null'); if (s && typeof s === 'object') XS.saved = s; } catch (e) {}
const ROOMS = {}, ROOM_LIST = [], EXTRAS = [];
const core = {};   // the API handed to rooms and extras; filled in once the scene, lights and post-processing exist
function registerRoom(def) {
  if (!def || !def.id || ROOMS[def.id]) return;
  const r = { order: 50, maxDist: 14.5, label: def.id, look: {}, ...def, group: null };
  ROOMS[r.id] = r; ROOM_LIST.push(r); ROOM_LIST.sort((a, b) => a.order - b.order);
  if (XS.ready && XS.render) XS.render();
}
function registerExtra(def) {
  if (!def || !def.id || EXTRAS.some(x => x.id === def.id)) return;
  const x = { kind: 'toggle', default: false, rooms: null, ...def, obj: null, built: false, active: false };
  EXTRAS.push(x);
  const sv = XS.saved && XS.saved.on && XS.saved.on[x.id];
  XS.on[x.id] = typeof sv === 'boolean' ? sv : !!x.default;
  if (XS.ready) { refreshExtras(); if (XS.render) XS.render(); }
}

/* ---------------- Living room: a close, cosy wood-panelled box room (true scale, 1 unit = 14 in) ----------------
   Tree at the origin, the board's view looks toward -z. Walls are planes facing in; a wall (and everything
   fixed to it) hides while the camera is outside it, so the room reads right from every side (dollhouse cut-away). */
const ROOM = (() => {
  const h = 108 * IN, sill = 30 * IN, top = 100 * IN;
  return {
    x0: -5, x1: 5, zBack: -4.5, zFront: 9, h,                   // inner faces of the walls; 9 ft ceiling
    wainscot: 30 * IN,                                             // chair rail height (also the window sill line)
    reveal: 4.5 * IN,                                              // wall depth at the windows: the glass sits this far behind the wall face
    windows: [                                                     // on the back wall (z = zBack), facing +z
      { x: -3.3, w: 36 * IN, y0: sill, y1: top, cols: 2, rows: 4 },
      { x: 3.3, w: 30 * IN, y0: sill, y1: top, cols: 2, rows: 4 },
    ],
    sill: { top: sill + 0.5 * IN, depth: 5.5 * IN },               // the sill sticks 5.5" into the room from the wall face
    candles: [                                                     // pillar candles on the sills (x, height in units, radius)
      { x: -4.22, h: 8 * IN, r: 1.5 * IN, accent: 0 }, { x: -3.92, h: 5.5 * IN, r: 1.5 * IN, accent: 0 }, { x: -2.38, h: 6.5 * IN, r: 1.75 * IN, accent: 0 },
      { x: 2.55, h: 5 * IN, r: 1.5 * IN, accent: 1 }, { x: 4.02, h: 7 * IN, r: 1.5 * IN, accent: 1 },
    ],
    candleZ: -4.5 - 0.06,
    fire: { wall: 'left', x: -5, z: -2.2, w: 3.4, depth: 0.8, hearth: 1.0, mantelY: 54 * IN, normal: [1, 0, 0] },   // clear slot kept for a fireplace (extras): z -3.9..-0.5, clear of the window sill and the person
    door: { wall: 'front', x: 2.9, w: 36 * IN, h: 80 * IN, normal: [0, 0, -1] },
    backdropZ: -7, snow: { z0: -4.9, z1: -6.9 },                   // night backdrop plane behind the windows; snow slab between glass and backdrop
    groups: {},                                                    // back, left, right, front, ceiling, floor (filled when built)
  };
})();
const PANEL_IN = 54;   // the wall texture covers 54" across and the full 108" height
const panelTex = canvasTex(1024, 2048, (g, w, h) => {
  const px = h / 108, wain = h - ROOM.wainscot / IN * px;
  // upper walls: vertical 6" tongue-and-groove boards in a warm stain
  for (let x = 0, i = 0; x < w; x += 6 * px, i++) {
    const bw = 6 * px; g.fillStyle = `hsl(${22 + Math.random() * 7}, ${46 + Math.random() * 10}%, ${29 + Math.random() * 7}%)`; g.fillRect(x, 0, bw, wain);
    for (let k = 0; k < 70; k++) { const gx = x + Math.random() * bw, a = 0.05 + Math.random() * 0.12; g.strokeStyle = Math.random() < 0.6 ? `rgba(30,14,6,${a})` : `rgba(210,150,95,${a * 0.6})`; g.lineWidth = 0.6 + Math.random() * 1.6; g.beginPath(); g.moveTo(gx, 0); for (let y = 0; y <= wain; y += 64) g.lineTo(gx + Math.sin(y / 180 + k) * 3 + Math.sin(y / 47 + i) * 1.2, y); g.stroke(); }
    if (Math.random() < 0.35) { const ky = Math.random() * wain * 0.9, kx = x + bw * (0.3 + Math.random() * 0.4); const kg = g.createRadialGradient(kx, ky, 0, kx, ky, 9); kg.addColorStop(0, 'rgba(40,18,8,.7)'); kg.addColorStop(1, 'rgba(40,18,8,0)'); g.fillStyle = kg; g.fillRect(kx - 10, ky - 14, 20, 28); }
    g.fillStyle = 'rgba(8,4,2,.75)'; g.fillRect(x, 0, 3, wain); g.fillStyle = 'rgba(255,200,150,.10)'; g.fillRect(x + 3, 0, 2, wain);   // V-groove
  }
  // wainscot below the chair rail: stiles and rails round two raised panels, darker stain, 6" base
  const base = 6 * px; g.fillStyle = '#2a170d'; g.fillRect(0, wain, w, h - wain);
  noise(g, w, h, 6000, 0.12, ['#120804', '#4a2c18']);
  const st = 3.5 * px, pw = (w - 3 * st) / 2;
  [0, 1].forEach(k => { const x = st + k * (pw + st), y = wain + st, ph = h - base - st - y;
    const pg = g.createLinearGradient(x, y, x + pw, y + ph); pg.addColorStop(0, '#3a2213'); pg.addColorStop(1, '#2b180c'); g.fillStyle = pg; g.fillRect(x, y, pw, ph);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 5; g.strokeRect(x + 2, y + 2, pw - 4, ph - 4); g.strokeStyle = 'rgba(255,190,130,.10)'; g.lineWidth = 2; g.strokeRect(x + 12, y + 12, pw - 24, ph - 24); });
  g.fillStyle = '#1d0f07'; g.fillRect(0, h - base, w, base);
}, { repeat: [1, 1] });
panelTex.wrapT = THREE.ClampToEdgeWrapping;
const woodTrim = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.55, envMapIntensity: 0.4 });
function wallUV(geo, uOf) {   // world-scale UVs: u along the wall in PANEL_IN units, v = height / ceiling height
  const P = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) uv.setXY(i, uOf(P.getX(i), P.getY(i), P.getZ(i)) / (PANEL_IN * IN), P.getY(i) / ROOM.h);
  uv.needsUpdate = true; return geo;
}
const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; parent.add(b); return b; };
const FLAME_MAT = new THREE.ShaderMaterial({   // candle flame: crossed quads, so it reads as a flame from any side
  uniforms: { uTime: { value: 0 }, uOn: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `attribute float aSeed; varying vec2 vUv; varying float vSeed; uniform float uTime;
    void main(){ vUv = uv; vSeed = aSeed; vec3 p = position; float s = sin(uTime * 6.3 + aSeed * 7.0) * 0.6 + sin(uTime * 13.7 + aSeed * 3.0) * 0.4;
      p.x += s * uv.y * uv.y * 0.012; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `varying vec2 vUv; varying float vSeed; uniform float uTime; uniform float uOn;
    void main(){ vec2 q = vUv - vec2(0.5, 0.25);
      float fl = 0.88 + 0.12 * sin(uTime * 11.0 + vSeed * 5.0) * sin(uTime * 4.3 + vSeed);
      float ht = 0.72 * fl, w = 0.30 * (1.0 - smoothstep(-0.05, ht, q.y)) * (q.y < 0.0 ? sqrt(max(0.0, 1.0 + q.y / 0.25)) : 1.0);
      float d = abs(q.x) / max(w, 1e-3);
      float a = (1.0 - smoothstep(0.45, 1.0, d)) * smoothstep(-0.25, -0.15, q.y) * uOn;
      float c = (1.0 - smoothstep(0.0, 0.75, d)) * (1.0 - smoothstep(0.0, 0.45 * fl, q.y));
      vec3 col = mix(vec3(2.6, 0.9, 0.18), vec3(7.0, 5.2, 2.6), c);
      col = mix(col, vec3(0.35, 0.5, 1.4), smoothstep(-0.04, -0.2, q.y) * 0.7);
      gl_FragColor = vec4(col, a); }`,
});
function buildLivingRoom() {
  const R0 = ROOM, room = new THREE.Group(); room.name = 'room.living';
  const G = {}; ['back', 'left', 'right', 'front', 'ceiling', 'floor'].forEach(k => { G[k] = new THREE.Group(); G[k].name = 'living.' + k; room.add(G[k]); });
  R0.groups = G;
  const wallMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.62, envMapIntensity: 0.45 });
  const W = R0.x1 - R0.x0, D = R0.zFront - R0.zBack, Hc = R0.h, rail = R0.wainscot, cas = 3.5 * IN;
  // back wall with the two window openings
  const backS = new THREE.Shape(); backS.moveTo(R0.x0, 0); backS.lineTo(R0.x1, 0); backS.lineTo(R0.x1, Hc); backS.lineTo(R0.x0, Hc); backS.closePath();
  R0.windows.forEach(wn => { const p = new THREE.Path(); p.moveTo(wn.x - wn.w / 2, wn.y0); p.lineTo(wn.x - wn.w / 2, wn.y1); p.lineTo(wn.x + wn.w / 2, wn.y1); p.lineTo(wn.x + wn.w / 2, wn.y0); p.closePath(); backS.holes.push(p); });
  const backW = new THREE.Mesh(wallUV(new THREE.ShapeGeometry(backS), (x) => x - R0.x0), wallMat); backW.position.z = R0.zBack; backW.receiveShadow = true; G.back.add(backW);
  // side walls (the left one keeps a clear slot for a fireplace) and the front wall with a doorway
  const side = (sgn, grp) => { const g = new THREE.PlaneGeometry(D, Hc); g.translate(0, Hc / 2, 0); wallUV(g, x => x + D / 2); const m = new THREE.Mesh(g, wallMat); m.rotation.y = sgn * Math.PI / 2; m.position.set(sgn > 0 ? R0.x0 : R0.x1, 0, (R0.zBack + R0.zFront) / 2); m.receiveShadow = true; grp.add(m); };
  side(1, G.left); side(-1, G.right);
  const dr = R0.door, frontS = new THREE.Shape(); frontS.moveTo(R0.x0, 0); frontS.lineTo(R0.x1, 0); frontS.lineTo(R0.x1, Hc); frontS.lineTo(R0.x0, Hc); frontS.closePath();
  { const p = new THREE.Path(), dx = -dr.x; p.moveTo(dx - dr.w / 2, 0); p.lineTo(dx - dr.w / 2, dr.h); p.lineTo(dx + dr.w / 2, dr.h); p.lineTo(dx + dr.w / 2, 0); p.closePath(); frontS.holes.push(p); }
  const frontW = new THREE.Mesh(wallUV(new THREE.ShapeGeometry(frontS), x => x - R0.x0), wallMat); frontW.rotation.y = Math.PI; frontW.position.z = R0.zFront; frontW.receiveShadow = true; G.front.add(frontW);
  // a dim hall seen through the doorway
  const hall = new THREE.Mesh(new THREE.BoxGeometry(dr.w + 0.4, dr.h + 0.3, 2.2), new THREE.MeshStandardMaterial({ color: 0x1f140d, roughness: 0.9, side: THREE.BackSide })); hall.position.set(dr.x, (dr.h + 0.3) / 2, R0.zFront + 1.1); G.front.add(hall);
  [[-1, 0], [1, 0]].forEach(([s]) => box(cas, dr.h + cas, 0.06, woodTrim, dr.x + s * (dr.w / 2 + cas / 2), (dr.h + cas) / 2, R0.zFront - 0.03, G.front));
  box(dr.w + 2 * cas, cas, 0.06, woodTrim, dr.x, dr.h + cas / 2, R0.zFront - 0.03, G.front);
  // chair rail, baseboard and crown on every wall (split round the doorway)
  const trims = (grp, len, place) => { [[rail, 1.6 * IN, 1.0 * IN], [5.5 * IN, 5.5 * IN, 0.8 * IN], [Hc - 2.5 * IN, 5 * IN, 2.2 * IN]].forEach(([y, th, dp], k) => place(grp, len, y - (k === 0 ? th / 2 : k === 1 ? th / 2 : 0), th, dp)); };
  trims(G.back, W, (grp, len, y, th, dp) => box(len, th, dp, woodTrim, 0, y, R0.zBack + dp / 2, grp));
  trims(G.left, D, (grp, len, y, th, dp) => box(dp, th, len, woodTrim, R0.x0 + dp / 2, y, (R0.zBack + R0.zFront) / 2, grp));
  trims(G.right, D, (grp, len, y, th, dp) => box(dp, th, len, woodTrim, R0.x1 - dp / 2, y, (R0.zBack + R0.zFront) / 2, grp));
  { const l1 = (dr.x - dr.w / 2 - cas) - R0.x0, l2 = R0.x1 - (dr.x + dr.w / 2 + cas);
    trims(G.front, 0, (grp, _, y, th, dp) => { if (y > dr.h) { box(W, th, dp, woodTrim, 0, y, R0.zFront - dp / 2, grp); return; } box(l1, th, dp, woodTrim, R0.x0 + l1 / 2, y, R0.zFront - dp / 2, grp); box(l2, th, dp, woodTrim, R0.x1 - l2 / 2, y, R0.zFront - dp / 2, grp); }); }
  // windows: deep reveals, casings, a sill, mullions, frosted panes, and a soft night-snow backdrop behind
  const frostTex = canvasTex(256, 256, (g, w) => {
    g.clearRect(0, 0, w, w); const rg = g.createRadialGradient(w / 2, w / 2, w * 0.18, w / 2, w / 2, w * 0.74); rg.addColorStop(0, 'rgba(235,242,255,.06)'); rg.addColorStop(0.7, 'rgba(235,242,255,.32)'); rg.addColorStop(1, 'rgba(245,250,255,.75)'); g.fillStyle = rg; g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1;
    for (let i = 0; i < 120; i++) { const c = Math.random() < 0.5 ? 0 : w, r = Math.random() < 0.5 ? 0 : w, a = Math.random() * Math.PI * 2, L = 10 + Math.random() * 46; let x = c + (Math.random() - 0.5) * 60, y = r + (Math.random() - 0.5) * 60; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += Math.cos(a + k * 0.5) * L / 4; y += Math.sin(a + k * 0.5) * L / 4; g.lineTo(x, y); } g.stroke(); }
  }, { clamp: false });
  const glassZ = R0.zBack - R0.reveal + 1.2 * IN, sashM = new THREE.MeshStandardMaterial({ color: 0x2c1a10, roughness: 0.55, envMapIntensity: 0.4 });
  const cz = R0.candleZ;
  R0.windows.forEach(wn => {
    const ww = wn.w, hh = wn.y1 - wn.y0, cy = (wn.y0 + wn.y1) / 2, zr = R0.zBack - R0.reveal / 2;
    box(0.03, hh, R0.reveal, woodTrim, wn.x - ww / 2 - 0.015, cy, zr, G.back); box(0.03, hh, R0.reveal, woodTrim, wn.x + ww / 2 + 0.015, cy, zr, G.back);   // reveal sides
    box(ww, 0.03, R0.reveal, woodTrim, wn.x, wn.y1 + 0.015, zr, G.back);                                                                                // head
    box(cas, hh + cas, 0.055, woodTrim, wn.x - ww / 2 - cas / 2, cy + cas / 2, R0.zBack + 0.0275, G.back); box(cas, hh + cas, 0.055, woodTrim, wn.x + ww / 2 + cas / 2, cy + cas / 2, R0.zBack + 0.0275, G.back);
    box(ww + 2 * cas, cas, 0.055, woodTrim, wn.x, wn.y1 + cas / 2, R0.zBack + 0.0275, G.back);
    const sillD = R0.reveal + R0.sill.depth; box(ww + 2 * cas + 2 * IN, 1.25 * IN, sillD, woodTrim, wn.x, R0.sill.top - 0.625 * IN, R0.zBack - R0.reveal + sillD / 2, G.back).castShadow = true;
    box(ww + 2 * cas, 3 * IN, 0.05, woodTrim, wn.x, R0.sill.top - 1.25 * IN - 1.5 * IN, R0.zBack + 0.025, G.back);                                     // apron
    const bar = 1.1 * IN; for (let c = 0; c <= wn.cols; c++) box(c === 0 || c === wn.cols ? 2 * bar : bar, hh, bar, sashM, wn.x - ww / 2 + ww * c / wn.cols, cy, glassZ, G.back);
    for (let r = 0; r <= wn.rows; r++) box(ww, r === 0 || r === wn.rows ? 2 * bar : bar, bar, sashM, wn.x, wn.y0 + hh * r / wn.rows, glassZ, G.back);
    const ft = frostTex.clone(); ft.needsUpdate = true; ft.repeat.set(wn.cols, wn.rows);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), new THREE.MeshBasicMaterial({ map: ft, color: new THREE.Color(0.9, 0.95, 1.05), transparent: true, opacity: 0.85, depthWrite: false }));
    pane.position.set(wn.x, cy, glassZ - 0.6 * IN); pane.renderOrder = 5; G.back.add(pane);
  });
  // pillar candles on the sills (accent lights 0 and 1 sit over them)
  const wax = new THREE.MeshStandardMaterial({ color: 0xf1e3c8, roughness: 0.55, emissive: 0xff9a40, emissiveIntensity: 0.06, envMapIntensity: 0.3 });
  const flames = [], seeds = [];
  R0.candles.forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r * 1.02, c.h, 24), wax); m.position.set(c.x, R0.sill.top + c.h / 2, cz); m.castShadow = true; m.receiveShadow = true; G.back.add(m);
    const top = new THREE.Mesh(new THREE.CircleGeometry(c.r * 0.82, 20), new THREE.MeshStandardMaterial({ color: 0xffcf8a, emissive: 0xff8a2a, emissiveIntensity: 0.55, roughness: 0.4 })); top.rotation.x = -Math.PI / 2; top.position.set(c.x, R0.sill.top + c.h - 0.15 * IN, cz); G.back.add(top);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * IN, 0.04 * IN, 0.35 * IN, 5), new THREE.MeshBasicMaterial({ color: 0x1a1008 })); wick.position.set(c.x, R0.sill.top + c.h + 0.1 * IN, cz); G.back.add(wick);
    const fw = 0.75 * IN, fh = 1.9 * IN; [0, Math.PI / 2].forEach(a => { const q = new THREE.PlaneGeometry(fw, fh); q.translate(0, fh * 0.25, 0); q.rotateY(a + 0.4); q.translate(c.x, R0.sill.top + c.h + 0.12 * IN, cz); flames.push(q); seeds.push(...Array(q.attributes.position.count).fill(i * 1.37 + 0.3)); });
  });
  const fg = mergeGeometries(flames); fg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const flameMesh = new THREE.Mesh(fg, FLAME_MAT); flameMesh.renderOrder = 6; flameMesh.frustumCulled = false; G.back.add(flameMesh);
  // the night outside: a pre-blurred backdrop with snowy spruces and soft bokeh (cheap depth of field)
  const BX = 20, BY0 = -1, BY1 = 13;
  const backdrop = canvasTex(2048, 1024, (g, w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const q = c.getContext('2d');
    const Y = y => h * (1 - (y - BY0) / (BY1 - BY0)), X = x => (x / BX + 0.5) * w, ground = 2.55;
    const sky = q.createLinearGradient(0, 0, 0, Y(ground)); sky.addColorStop(0, '#142039'); sky.addColorStop(0.45, '#2f4a6e'); sky.addColorStop(0.85, '#8aa2c0'); sky.addColorStop(1, '#b9c9dc');
    q.fillStyle = sky; q.fillRect(0, 0, w, Y(ground));
    const gr = q.createLinearGradient(0, Y(ground), 0, h); gr.addColorStop(0, '#c7d4e3'); gr.addColorStop(1, '#7f93ad'); q.fillStyle = gr; q.fillRect(0, Y(ground), w, h - Y(ground));
    [['#8197b3', 0.9, 1.6, 70, 2.75], ['#4e6584', 1.3, 2.6, 46, 2.62], ['#22324a', 1.8, 3.6, 26, 2.5]].forEach(([col, h0, h1, n, gy]) => {
      for (let i = 0; i < n; i++) { const x = Math.random() * w, th = (h0 + Math.random() * (h1 - h0)) * (h / (BY1 - BY0)), bw = th * 0.42, by = Y(gy) + Math.random() * 6;
        for (let t = 0; t < 4; t++) { const ty = by - th * t / 4.2, tw = bw * (1 - t / 4.6); q.fillStyle = col; q.beginPath(); q.moveTo(x - tw / 2, ty); q.lineTo(x, ty - th * 0.42); q.lineTo(x + tw / 2, ty); q.fill();
          q.fillStyle = 'rgba(232,240,250,.55)'; q.beginPath(); q.moveTo(x - tw * 0.3, ty - th * 0.12); q.lineTo(x, ty - th * 0.36); q.lineTo(x + tw * 0.25, ty - th * 0.14); q.fill(); } } });
    g.filter = 'blur(9px)'; g.drawImage(c, 0, 0); g.filter = 'none';
    const hex = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); };
    for (let i = 0; i < 9; i++) hex(X(-9 + Math.random() * 18), Y(2.7 + Math.random() * 1.2), 10 + Math.random() * 14, `rgba(255,196,120,${0.25 + Math.random() * 0.25})`);   // far house lights
    for (let i = 0; i < 110; i++) hex(Math.random() * w, Math.random() * Y(ground), 5 + Math.random() * 16, `rgba(220,234,255,${0.06 + Math.random() * 0.14})`);  // out-of-focus flakes
  }, { clamp: true });
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(BX, BY1 - BY0), new THREE.MeshBasicMaterial({ map: backdrop, color: new THREE.Color(1.05, 1.05, 1.1) }));
  bd.position.set(0, (BY0 + BY1) / 2, R0.backdropZ); G.back.add(bd); R0.backdropMat = bd.material;
  // oak floor, planks running front to back
  const floorTex = canvasTex(1024, 1024, (g, w) => {
    const px = w / 54, pw = 4.5 * px;
    for (let x = 0; x < w; x += pw) { let y = -Math.random() * 40 * px;
      while (y < w) { const L = (24 + Math.random() * 40) * px; g.fillStyle = `hsl(${21 + Math.random() * 7}, ${40 + Math.random() * 10}%, ${15 + Math.random() * 7}%)`; g.fillRect(x, y, pw, L);
        for (let i = 0; i < 30; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.16)' : 'rgba(190,130,80,.09)'; g.fillRect(x + Math.random() * pw, y + Math.random() * L, 1, 20 + Math.random() * 90); }
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, pw, 2); y += L; }
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, 0, 2, w); }
  }, { repeat: [W / (54 * IN), D / (54 * IN)] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, envMapIntensity: 0.5 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (R0.zBack + R0.zFront) / 2); floor.receiveShadow = true; G.floor.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x8a6a52, map: panelTex, roughness: 0.8, envMapIntensity: 0.3 }));
  wallUV(ceil.geometry, x => x); ceil.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2) a[i] = 0.35; }); ceil.geometry.attributes.uv.needsUpdate = true;   // boards only, no wainscot
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, Hc, (R0.zBack + R0.zFront) / 2); G.ceiling.add(ceil);
  // dollhouse cut-away: hide a wall (and what is fixed to it) while the camera is outside it
  R0.cut = [[G.back, [0, 0, 1], [0, 0, R0.zBack]], [G.left, [1, 0, 0], [R0.x0, 0, 0]], [G.right, [-1, 0, 0], [R0.x1, 0, 0]], [G.front, [0, 0, -1], [0, 0, R0.zFront]], [G.ceiling, [0, -1, 0], [0, Hc, 0]]]
    .map(([g, n, p]) => ({ g, n: new THREE.Vector3(...n), p: new THREE.Vector3(...p) }));
  room.traverse(o => { if (o.isMesh) o.castShadow = o.castShadow && o.geometry.type === 'CylinderGeometry'; });
  return room;
}
// Reflections: every room gets an HDR environment (see 'HDR environment maps' after the tree lights).
const ENV = {};
const LIVING_BG = canvasTex(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#120b07'); gr.addColorStop(0.6, '#1d120b'); gr.addColorStop(1, '#0a0604'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { clamp: true });
/* Office lobby like NAHQ (36 x 36 ft, 10 ft ceiling), built the first time it is chosen. */
const OFFICE = { w: 36 * 12 * IN, d: 36 * 12 * IN, h: 120 * IN };   // 36 x 36 ft lobby, 10 ft ceiling
function buildOffice() {
  const officeRoom = new THREE.Group(); officeRoom.name = 'room.office';
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
  ENV.office = envFromEquirect(envTex, true).texture;   // the office shell plus the lit tree, as an HDR env
}
  return officeRoom;
}

// soft contact shadows under things that sit on the floor
const SHADOW_TEX = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,.75)'); r.addColorStop(0.55, 'rgba(0,0,0,.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }, { clamp: true });
function contactShadow(x, z, w, d, ry = 0, o = 0.8) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: o }));
  m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.004, z); (TARGET || scene).add(m);
}

/* ---------------- Lighting: one fixed pool ----------------
   Every light is created once here; rooms and modes change only intensity, colour, angle and position.
   (Light counts are shader defines: adding or removing a light would recompile every material.)
   Pool: 1 hemisphere, 1 spot `key` (the only shadow caster), 1 directional `rim`, 8 point lights
   (5 inside the tree, `base` at the foot, `accent[0..1]` for candles or a fire). */
const hemi = new THREE.HemisphereLight(0xffd9b0, 0x20140c, 0.15); scene.add(hemi);
const key = new THREE.SpotLight(0xffcf9a, 70, 0, 0.55, 0.9, 2);   // a warm ceiling pot light aimed at the tree
key.position.set(1.5, 9, 5); key.target.position.set(0, 3, 0); scene.add(key.target);
key.castShadow = true; key.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048); key.shadow.bias = -0.0005; key.shadow.radius = 4;
key.shadow.camera.near = 2; key.shadow.camera.far = 24;
scene.add(key);
const rim = new THREE.DirectionalLight(0x8fa6d6, 0.18); rim.position.set(-6, 5, -6); scene.add(rim);   // cool window light from behind-left

/* ---------------- Tree ---------------- */
const Y0 = 12 * IN, YTOP = 90 * IN, RB = 26 * IN;            // foliage starts 12" up, 90" tall, 52" wide
const rAt = y => RB * Math.pow(Math.max(0, 1 - (y - Y0) / (YTOP - Y0)), 0.92);
const treeGroup = new THREE.Group(); scene.add(treeGroup);
// one bottle-brush branch tip: a brown twig with tapered needles in three greens (darker at the base, fresher at the tip)
const NEEDLE = canvasTex(512, 1024, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const greens = [['#0e2716', '#133019', '#17391f'], ['#1b4227', '#204b2d', '#265634'], ['#2d613b', '#3a6e45', '#4b7d4e']];   // deep, mid, fresh
  const needle = (x, y, a, L, lw, col) => { const c = Math.cos(a), s = Math.sin(a), nx = -s * lw / 2, ny = c * lw / 2;
    g.fillStyle = col; g.beginPath(); g.moveTo(x + nx, y + ny); g.lineTo(x + c * L, y + s * L); g.lineTo(x - nx, y - ny); g.closePath(); g.fill(); };
  const twig = (x0, y0, x1, y1, len, n, lw) => {
    g.strokeStyle = '#3a2a1a'; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
        const a = ang + side * (0.45 + Math.random() * 0.6) + (k ? 0.25 : -0.1) * side;
        const L = len * (0.7 + Math.random() * 0.5) * (1 - t * 0.35);
        const tone = greens[t > 0.7 ? 2 : t > 0.3 ? 1 : 0];
        needle(x, y, a, L, 2.6 + Math.random() * 1.8, tone[(Math.random() * 3) | 0]);
      }
    }
  };
  twig(256, 1010, 256, 40, 82, 170, 9);
  [[256, 860, 100, 540], [256, 820, 412, 524], [256, 640, 120, 336], [256, 600, 392, 312], [256, 420, 164, 184], [256, 392, 348, 172]].forEach(([a, b, c, d]) => twig(a, b, c, d, 56, 70, 5));
});
NEEDLE.wrapS = NEEDLE.wrapT = THREE.ClampToEdgeWrapping;
// FOLIAGE: the three needle layers with each instance's base matrix and needle tip, so clearFoliage() can pull
// needles back where they would poke through the front of a pet, doghouse or hoop (and restore them after).
// Layout (R4): 12 whorls of 9-16 hinged branches, each angled 10-25 degrees down, reaching the silhouette at its tip
// (+/- 8%). The middle and tip layers are bottle-brush cards along those branches, so the outline is a ragged, layered
// fir with dark gaps between the tiers (board_tree.jpg); the inner layer still fills the core. The layout has its own
// random stream (FOL); rand() is advanced by exactly the draws the old even scatter used, so every ornament, light and
// pet lands where it did.
const FOLIAGE = [], BRANCHES = [];
let NEEDLE_GEO, NEEDLE_MAT;
{
  for (let i = 0; i < (2600 + 3400 + 2600) * 9; i++) rand();
  const FOL = rng(1717), FR = (a, b) => a + (b - a) * FOL(), NW = 12;
  for (let k = 0; k < NW; k++) {
    const yw = Y0 + 0.14 + (YTOP - Y0 - 0.62) * Math.pow(k / (NW - 1), 0.9), nb = Math.round(16 - 7 * k / (NW - 1)), off = k * 2.39996;
    for (let b = 0; b < nb; b++) {
      const th = off + b / nb * Math.PI * 2 + FR(-0.18, 0.18), down = FR(0.17, 0.44), f = FR(0.92, 1.08);
      let L = rAt(yw); for (let it = 0; it < 5; it++) L = rAt(yw - L * Math.sin(down)) * f / Math.cos(down);
      L = Math.max(0.12, L);
      BRANCHES.push({ y: yw, th, L, o: new THREE.Vector3(Math.cos(th) * 0.04, yw, Math.sin(th) * 0.04), dir: new THREE.Vector3(Math.cos(th) * Math.cos(down), -Math.sin(down), Math.sin(th) * Math.cos(down)) });
    }
  }
  const cum = []; let tot = 0; BRANCHES.forEach(B => { tot += Math.pow(B.L, 1.5); cum.push(tot); });
  const pickB = () => { const x = FOL() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } return BRANCHES[lo]; };
  const a = new THREE.PlaneGeometry(0.5, 1); a.translate(0, 0.5, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const geo = NEEDLE_GEO = mergeGeometries([a, b]);
  // alpha-to-coverage turns the alpha edge into MSAA coverage (rt has 4 samples): soft, stable needle edges while orbiting.
  // alphaTest stays above 0 so the shadow pass still cuts the card shapes out.
  const m = NEEDLE_MAT = new THREE.MeshStandardMaterial({ map: NEEDLE, alphaTest: 0.2, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.78, envMapIntensity: 0.2 });
  m.color.setRGB(0.82, 1.0, 1.2);   // emerald albedo: under the warm tree light the needles read deep green, not olive (board)
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Object3D(), col = new THREE.Color(), warm = new THREE.Color(1.1, 1.05, 0.8), side = new THREE.Vector3(), dir = new THREE.Vector3();
  [[2600, 0.12, 0.7, 0.62, 'inner'], [3400, 0.45, 0.98, 0.85, 'mid'], [2600, 0.82, 1.06, 1.05, 'tip']].forEach(([n, f0, f1, bright, kind]) => {
    const mesh = new THREE.InstancedMesh(geo, m, n);
    for (let i = 0; i < n; i++) {
      let len, rT, rBase;
      if (kind === 'inner') {   // the core filler, as before: short cards from inside the cone outward
        const y = Y0 + 0.03 + (YTOP - Y0 - 0.05) * (1 - Math.sqrt(FOL())), th = FOL() * Math.PI * 2; rT = rAt(y);
        const r0 = rT * FR(f0 * 0.3, f0 * 0.6); len = Math.max(0.18, rT * FR(f0, f1) - r0 + 0.2) * FR(0.85, 1.1); rBase = r0;
        d.position.set(Math.cos(th) * r0, y, Math.sin(th) * r0); dir.set(Math.cos(th), FR(-0.5, -0.05) + (y > YTOP - 0.5 ? 1.0 : 0), Math.sin(th)).normalize();
      } else if (kind === 'tip' && i < 110) {   // the leader: an upright tuft above the top whorl
        const y = YTOP - 0.62 + FR(0, 0.42); len = FR(0.18, 0.42) * (1 - (y - YTOP + 0.62) * 0.8); rT = rAt(y); rBase = 0;
        d.position.set(FR(-0.03, 0.03), y, FR(-0.03, 0.03)); const t = FOL() * Math.PI * 2, sp = FR(0.15, 0.8); dir.set(Math.cos(t) * sp, 1, Math.sin(t) * sp).normalize();
      } else {   // bottle-brush cards along a branch, splayed to both sides and a little down
        const B = pickB(), s0 = kind === 'tip' ? FR(0.5, 0.88) : FR(0.12, 0.72);
        len = kind === 'tip' ? (1 - s0) * B.L * FR(0.85, 1.12) + 0.05 : B.L * FR(0.22, 0.45);
        len = Math.min(0.7, Math.max(0.12, len));
        const p = B.o.clone().addScaledVector(B.dir, s0 * B.L); d.position.copy(p);
        side.set(-B.dir.z, 0, B.dir.x).normalize();
        const spl = (FOL() < 0.5 ? -1 : 1) * FR(kind === 'tip' ? 0.1 : 0.3, kind === 'tip' ? 0.55 : 0.95);
        dir.copy(B.dir).multiplyScalar(Math.cos(spl)).addScaledVector(side, Math.sin(spl)); dir.y -= FR(0, 0.22); dir.y += FR(-0.08, 0.12); dir.normalize();
        rT = rAt(p.y); rBase = Math.hypot(p.x, p.z);
      }
      d.quaternion.setFromUnitVectors(up, dir); d.rotateY(FR(0, Math.PI));
      const wd = Math.min(0.75, 0.3 + len * 0.5);
      d.scale.set(wd, len, wd); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      // baked ambient occlusion: needles deep inside the tree are darker than the tips at the surface
      const ao = THREE.MathUtils.lerp(0.55, 1.1, Math.min(1, (rBase + 0.6 * len) / Math.max(0.05, rT)));
      mesh.setColorAt(i, col.setRGB(1, 1, 1).multiplyScalar(Math.sqrt(bright) * ao * FR(0.85, 1.15)).lerp(warm, FR(0, 0.15)));
    }
    if (LOW) mesh.count = Math.round(n * 0.65);   // fewer needle cards on phones (all are generated, so the layout matches desktop)
    mesh.castShadow = mesh.receiveShadow = true; treeGroup.add(mesh);
    const base = mesh.instanceMatrix.array.slice(), tip = new Float32Array(n * 3), mid = new Float32Array(n * 3), wd = new Float32Array(n);
    for (let i = 0; i < n; i++) { const e = base.subarray(i * 16, i * 16 + 16); for (let k = 0; k < 3; k++) { tip[i * 3 + k] = e[12 + k] + e[4 + k]; mid[i * 3 + k] = e[12 + k] + e[4 + k] * 0.6; } wd[i] = Math.hypot(e[0], e[1], e[2]) * 0.25; }   // half the card width
    const order = Uint32Array.from({ length: n }, (_, i) => i).sort((a, b) => tip[a * 3 + 1] - tip[b * 3 + 1]), ys = Float32Array.from(order, i => tip[i * 3 + 1]);   // needles by tip height, for range lookups
    FOLIAGE.push({ mesh, base, tip, mid, wd, n, order, ys, mark: new Uint8Array(n), touched: [] });
  });
  // the hinged branch rods themselves (dark green wire), seen in the gaps between tiers
  const rod = new THREE.CylinderGeometry(0.11 * IN, 0.2 * IN, 1, 5, 1, true); rod.translate(0, 0.5, 0);
  const rods = new THREE.InstancedMesh(rod, new THREE.MeshStandardMaterial({ color: 0x23301f, roughness: 0.8, envMapIntensity: 0.15 }), BRANCHES.length);
  BRANCHES.forEach((B, i) => { d.position.copy(B.o); d.quaternion.setFromUnitVectors(up, B.dir); d.scale.set(1, B.L * 0.92, 1); d.updateMatrix(); rods.setMatrixAt(i, d.matrix); });
  rods.castShadow = true; rods.receiveShadow = true; treeGroup.add(rods);
}
const coreGeo = new THREE.ConeGeometry(RB * 0.6, YTOP - Y0, 32, 1, true); coreGeo.translate(0, (YTOP + Y0) / 2, 0);
// inner shell that fills the gaps between branches: dense dark needles rather than a flat colour
const CORE_TEX = canvasTex(256, 256, (g, w) => { g.fillStyle = '#0a1a0e'; g.fillRect(0, 0, w, w); for (let i = 0; i < 900; i++) { const x = Math.random() * w, y = Math.random() * w, a = Math.random() * Math.PI; g.strokeStyle = ['#12301b', '#173a21', '#0d2414', '#1f4429'][(Math.random() * 4) | 0]; g.lineWidth = 1 + Math.random(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); } }, { repeat: [10, 7] });
const coreCone = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({ map: CORE_TEX, color: 0xb0b8b0, roughness: 1, side: THREE.DoubleSide, envMapIntensity: 0.15 }));
coreCone.userData.occluder = true; treeGroup.add(coreCone);
const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, Y0 + 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x3B2A1E, roughness: 0.9 })); trunk.position.y = (Y0 + 0.2) / 2; treeGroup.add(trunk);
// the tree's own 4-leg metal stand (no tree skirt, so it shows): a centre collar with a tightening bolt and 4 flat legs
{ const parts = [new THREE.CylinderGeometry(1.5 * IN, 1.7 * IN, 3.5 * IN, 20).translate(0, 1.75 * IN + 0.4 * IN, 0), new THREE.CylinderGeometry(0.22 * IN, 0.22 * IN, 1.6 * IN, 8).rotateZ(Math.PI / 2).translate(1.9 * IN, 3.2 * IN, 0)];
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, leg = new THREE.BoxGeometry(13 * IN, 0.55 * IN, 1.1 * IN); leg.rotateZ(-0.03); leg.translate(7.8 * IN, 0.45 * IN, 0); leg.rotateY(a); parts.push(leg);
    parts.push(new THREE.CylinderGeometry(0.75 * IN, 0.85 * IN, 0.3 * IN, 12).translate(14 * IN, 0.15 * IN, 0).rotateY(a)); }   // rubber feet
  const stand = new THREE.Mesh(mergeGeometries(parts.map(g => g.toNonIndexed())), new THREE.MeshStandardMaterial({ color: 0x1b2620, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.8 }));
  stand.castShadow = stand.receiveShadow = true; treeGroup.add(stand); }
contactShadow(0, 0, RB * 2.6, RB * 2.6, 0, 0.9);
// warm glow from inside the branches (the tree is pre-lit): 5 interior point lights (part of the fixed pool)
const INTERIOR = [], INTERIOR_I = [];
[[1.4, 0.55], [2.4, 0.45], [3.4, 0.38], [4.4, 0.3], [5.4, 0.22]].forEach(([y, f], i) => {
  const l = new THREE.PointLight(0xffb870, 7 - i * 0.6, rAt(y) * 2.6, 2); l.position.set(Math.cos(i * 2.1) * rAt(y) * f, y, Math.sin(i * 2.1) * rAt(y) * f); scene.add(l);
  INTERIOR.push(l); INTERIOR_I.push(l.intensity);
});
const base = new THREE.PointLight(0xffb070, 3, 2.8, 2); base.position.set(0, 0.6, 0); scene.add(base);   // low glow onto the presents; the short range keeps its reflection off the floor in front
const accent = [0, 1].map(() => { const l = new THREE.PointLight(0xff9a40, 0, 3, 2); l.position.set(0, 2.6, -4.3); scene.add(l); return l; });   // candles / fire; parked at the sill
// pre-lit warm white bulbs: small round HDR bulbs (they bloom) + soft additive halos. Steady, as delivered.
const LIGHT_N = 650;
// a pre-lit bulb sits on a branch wire: move the scattered point to the nearest point on the nearest branch (same
// distance out along it), just under the rod, so the branch's own needle cards shade it from most angles
function onBranch(q) {
  let best = null, bd = 1e9; const v = new THREE.Vector3();
  for (const B of BRANCHES) { if (Math.abs(B.y - q.y) > 0.9) continue;
    const s = Math.min(0.97, Math.max(0.25, (q.clone().sub(B.o).dot(B.dir)) / B.L)); v.copy(B.o).addScaledVector(B.dir, s * B.L); const dd = v.distanceToSquared(q); if (dd < bd) { bd = dd; best = v.clone(); } }
  return best ? q.clone().lerp(best.add(new THREE.Vector3(0, -0.5 * IN, 0)), 0.6) : q;   // most of the way onto the wire
}
const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 16, 12), new THREE.MeshBasicMaterial(), LIGHT_N);
const BULB_BASE = new Float32Array(LIGHT_N * 3), BULB_POS = new Float32Array(LIGHT_N * 3);
let halos;
{
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < LIGHT_N; i++) {
    const y = Y0 + 0.1 + (YTOP - Y0 - 0.2) * (1 - Math.sqrt(rand())); const th = rand() * Math.PI * 2; const r = rAt(y) * R(0.62, 0.97);
    d.position.copy(onBranch(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r))); d.updateMatrix(); lights.setMatrixAt(i, d.matrix);   // clipped to the nearest branch, among its needles
    const k = R(0.85, 1.15); c.setRGB(9 * k, 6 * k, 3 * k); lights.setColorAt(i, c); BULB_BASE.set([c.r, c.g, c.b], i * 3);   // one rand() per bulb, as before, so placements downstream don't move
    BULB_POS.set([d.position.x, d.position.y, d.position.z], i * 3);
  }
  // soft halos: one instanced camera-facing quad per bulb (one draw call); additive, depth-tested so foliage hides the ones behind
  const hg = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1);
  hg.index = q.index; hg.setAttribute('position', q.attributes.position); hg.setAttribute('uv', q.attributes.uv);
  hg.setAttribute('aPos', new THREE.InstancedBufferAttribute(BULB_POS, 3)); hg.instanceCount = LIGHT_N;
  halos = new THREE.Mesh(hg, new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 0.18 }, uColor: { value: new THREE.Color(2.2, 1.5, 0.8) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aPos; uniform float uSize; varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(aPos, 1.0); mv.xy += position.xy * uSize; mv.z += uSize * 0.5; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = 0.9 * exp(-d * d * 22.0) + 0.3 * pow(max(0.0, 1.0 - d), 2.0); gl_FragColor = vec4(uColor * vec3(1.0, 0.82, 0.6), a); }',
  }));
  halos.frustumCulled = false;
  halos.renderOrder = 3; treeGroup.add(halos);
}
treeGroup.add(lights);
// Tree-light modes: 'steady' (as delivered, pre-lit), 'twinkle' (fun: ~3% of bulbs flare and fade), 'off' (daytime look).
const bulbs = { mesh: lights, halos, positions: BULB_POS, count: LIGHT_N, mode: 'steady', flare: new Float32Array(LIGHT_N), live: new Set() };
bulbs.write = (i, k) => { lights.instanceColor.setXYZ(i, BULB_BASE[i * 3] * k, BULB_BASE[i * 3 + 1] * k, BULB_BASE[i * 3 + 2] * k); };
bulbs.resetAll = () => { lights.instanceColor.array.set(BULB_BASE); lights.instanceColor.clearUpdateRanges(); lights.instanceColor.needsUpdate = true; bulbs.flare.fill(0); bulbs.live.clear(); };
bulbs.setMode = m => {
  if (!['steady', 'twinkle', 'off'].includes(m)) return bulbs.mode;
  if (m === 'twinkle' && REDUCED_MOTION) m = 'steady';
  bulbs.mode = m; bulbs.resetAll();
  lights.visible = halos.visible = m !== 'off';
  if (typeof applyLook === 'function' && XS.ready) applyLook();
  return m;
};
bulbs.tick = (t, dt) => {
  if (bulbs.mode !== 'twinkle' || !dt) return;
  const touched = [], decay = Math.exp(-dt * 3.2);
  bulbs.live.forEach(i => { bulbs.flare[i] *= decay; if (bulbs.flare[i] < 0.02) { bulbs.flare[i] = 0; bulbs.live.delete(i); bulbs.write(i, 1); } else bulbs.write(i, 1 + 0.8 * bulbs.flare[i]); touched.push(i); });
  for (let n = LIGHT_N * 0.05 * dt, k = 0; k < 8 && Math.random() < n; k++, n -= 1) { const i = (Math.random() * LIGHT_N) | 0; bulbs.flare[i] = 1; bulbs.live.add(i); bulbs.write(i, 1.8); touched.push(i); }
  if (!touched.length) return;
  const ic = lights.instanceColor; ic.clearUpdateRanges(); touched.sort((a, b) => a - b);
  const ranges = []; touched.forEach(i => { const r = ranges[ranges.length - 1]; if (r && i <= r[1] + 1) r[1] = i; else ranges.push([i, i]); });
  if (ranges.length <= 24) ranges.forEach(([a, b]) => ic.addUpdateRange(a * 3, (b - a + 1) * 3));   // upload only the bulbs that changed
  ic.needsUpdate = true;
};

/* ---------------- HDR environment maps (reflections) ----------------
   Each room's reflections are a tiny HDR scene rendered once into a PMREM cube (half float, no tone mapping), so
   values above 1 survive: the tree's own lit bulbs (about 15-40) give the glass and metal balls pin-sharp warm glints
   that also bloom, candle flames sit at 25 and the windows at about 1. The scene is seen from just inside the front of
   the tree, where most balls hang, so the tree's bulbs surround the view toward the trunk and the room fills the
   view outward. Built lazily per room and cached; the Daytime look ('off') uses a copy without the bulbs.
   Rooms registered by extras keep their own env: look.env may be a texture or a function returning one, and
   pmremGen.fromEquirectangular(tex) (used by extras_env.js) now returns this HDR version of their equirect with the
   tree's bulbs added. pmremGen.fromEquirectangularPlain(tex) is the original. */
const ENV_C = new THREE.Vector3(0, 3.3, 0.75);   // capture point: just inside the front of the foliage at mid height
const ENV_OFF = new Map();                         // env texture with the bulbs -> () => the same room without them
const PMREM_EQ = pmremGen.fromEquirectangular.bind(pmremGen);
pmremGen.fromEquirectangularPlain = PMREM_EQ;
function envTreeGroup(lit) {   // the tree as seen from the capture point: a green core (warm-lit when the bulbs are on) and (lit) the pre-lit bulbs at HDR values
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.ConeGeometry(RB * 0.5, YTOP - Y0, 24, 1, true), new THREE.MeshBasicMaterial({ color: lit ? new THREE.Color(0.05, 0.06, 0.025) : new THREE.Color(0.02, 0.04, 0.022), side: THREE.DoubleSide }));
  core.position.y = (YTOP + Y0) / 2; g.add(core);
  if (lit) {
    const ids = []; for (let i = 0; i < LIGHT_N; i += 2) ids.push(i);   // every other bulb (325): enough glints, little extra diffuse light
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), ids.length), d = new THREE.Object3D(), c = new THREE.Color(), r = rng(9011);
    ids.forEach((i, k) => {
      d.position.fromArray(BULB_POS, i * 3); const dist = d.position.distanceTo(ENV_C);
      d.scale.setScalar(THREE.MathUtils.clamp(dist * 0.009, 0.004, 0.03)); d.updateMatrix(); m.setMatrixAt(k, d.matrix);   // about 0.5 degree across from the capture point
      const kk = (BULB_BASE[i * 3] / 9) * (18 + 16 * r()); m.setColorAt(k, c.setRGB(kk, kk * 0.66, kk * 0.32));
    });
    g.add(m);
  }
  return g;
}
function envRender(scene) {   // render a small env scene from ENV_C into a PMREM cube; returns the render target
  scene.position.sub(ENV_C); scene.updateMatrixWorld(true);
  const t0 = performance.now(), rt = pmremGen.fromScene(scene, 0.02, 0.05, 80);
  scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); });
  ENV_MS.push(Math.round(performance.now() - t0));
  return rt;
}
const ENV_MS = [];
function livingEnvScene(lit) {
  const s = new THREE.Scene(), R0 = ROOM, B = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide });
  const day = !lit, k = day ? 2.2 : 1;   // daytime: brighter walls, no bulbs
  const W = R0.x1 - R0.x0, D = R0.zFront - R0.zBack, H = R0.h, cz = (R0.zBack + R0.zFront) / 2;
  const plane = (w, h, m, x, y, z, ry = 0, rx = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); s.add(p); return p; };
  const wall = B(0.1 * k, 0.055 * k, 0.03 * k), wain = B(0.05 * k, 0.028 * k, 0.016 * k);
  [[R0.zBack, 0], [R0.zFront, Math.PI]].forEach(([z, ry]) => { plane(W, H - R0.wainscot, wall, 0, (H + R0.wainscot) / 2, z, ry); plane(W, R0.wainscot, wain, 0, R0.wainscot / 2, z, ry); });
  [[R0.x0, Math.PI / 2], [R0.x1, -Math.PI / 2]].forEach(([x, ry]) => { plane(D, H - R0.wainscot, wall, x, (H + R0.wainscot) / 2, cz, ry); plane(D, R0.wainscot, wain, x, R0.wainscot / 2, cz, ry); });
  plane(W, D, B(0.06 * k, 0.034 * k, 0.02 * k), 0, 0, cz, 0, -Math.PI / 2);          // oak floor
  plane(W, D, B(0.045 * k, 0.03 * k, 0.02 * k), 0, H, cz, 0, Math.PI / 2);           // ceiling boards
  const glass = day ? B(1.6, 1.8, 2.2) : B(0.5, 0.62, 0.9);                            // frosted windows: night snow-light, or daylight
  R0.windows.forEach(wn => { const p = plane(wn.w, wn.y1 - wn.y0, glass, wn.x, (wn.y0 + wn.y1) / 2, R0.zBack + 0.01); p.renderOrder = 1; });
  const flame = B(25, 13, 4.5);
  R0.candles.forEach(c => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), flame); f.position.set(c.x, R0.sill.top + c.h + 0.06, R0.candleZ); s.add(f); });
  plane(R0.door.w, R0.door.h, B(0.012, 0.008, 0.005), R0.door.x, R0.door.h / 2, R0.zFront - 0.01, Math.PI);
  s.add(envTreeGroup(lit));
  return s;
}
const EQ_MAT = tex => new THREE.ShaderMaterial({ uniforms: { tEq: { value: tex } }, side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tEq; varying vec3 vDir; void main(){ vec3 d = normalize(vDir); vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5); gl_FragColor = vec4(texture2D(tEq, uv).rgb, 1.0); }' });
function envFromEquirect(tex, lit = true) {   // an LDR equirect room as the far shell, plus the lit tree, as one HDR env
  const s = new THREE.Scene(), sky = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), EQ_MAT(tex));
  sky.position.copy(ENV_C); sky.renderOrder = -1; s.add(sky);   // centred on the capture point, so directions match the equirect
  s.add(envTreeGroup(lit));
  const sm = sky.material; const rt = envRender(s); sm.dispose();
  if (lit) { let off = null; ENV_OFF.set(rt.texture, () => (off ||= envFromEquirect(tex, false).texture)); }
  return rt;
}
pmremGen.fromEquirectangular = (tex, target) => (target ? PMREM_EQ(tex, target) : envFromEquirect(tex, true));   // extras' rooms get the tree's glints too
function livingEnv() {
  if (!ENV.living) { ENV.living = envRender(livingEnvScene(true)).texture; let off = null; ENV_OFF.set(ENV.living, () => (off ||= envRender(livingEnvScene(false)).texture)); }
  return ENV.living;
}

/* ---------------- Bulbs warm the needles near them (glow volume) ----------------
   A 48 x 96 x 48 volume over the tree holds, per texel, the sum over bulbs within 0.25 units (3.5 in) of
   1/(d^2 + 0.008) - 1/(0.25^2 + 0.008) (so it falls to 0 at the edge). The needle shader samples it at each
   fragment's world position and adds a warm emissive term: needle tips round a bulb glow gold, the needles in
   between stay deep green, as in the board photo. One texture fetch per needle fragment, no extra lights.
   LOW tier (phones, WebGL1): no 3D texture; each needle card gets one baked value in its instance colour instead. */
const GLOW = (() => {
  const t0 = performance.now(), NX = 48, NY = 96, NZ = 48, RC = 0.25, EPS = 0.008, K0 = 1 / (RC * RC + EPS), GMAX = 40;
  const min = new THREE.Vector3(-RB - 0.3, Y0 - 0.35, -RB - 0.3), size = new THREE.Vector3(2 * RB + 0.6, YTOP - Y0 + 0.7, 2 * RB + 0.6);
  // bulbs bucketed in RC cubes over the volume (integer grid, no string keys)
  const CX = Math.ceil(size.x / RC), CY = Math.ceil(size.y / RC), CZ = Math.ceil(size.z / RC), bucket = Array.from({ length: CX * CY * CZ }, () => []);
  const ci = (v, m, n) => Math.min(n - 1, Math.max(0, Math.floor((v - m) / RC)));
  for (let b = 0; b < LIGHT_N; b++) bucket[ci(BULB_POS[b * 3], min.x, CX) + CX * (ci(BULB_POS[b * 3 + 1], min.y, CY) + CY * ci(BULB_POS[b * 3 + 2], min.z, CZ))].push(b);
  const field = (x, y, z) => {
    let g = 0; const i0 = ci(x, min.x, CX), j0 = ci(y, min.y, CY), k0 = ci(z, min.z, CZ);
    for (let k = Math.max(0, k0 - 1); k <= Math.min(CZ - 1, k0 + 1); k++) for (let j = Math.max(0, j0 - 1); j <= Math.min(CY - 1, j0 + 1); j++) for (let i = Math.max(0, i0 - 1); i <= Math.min(CX - 1, i0 + 1); i++)
      for (const b of bucket[i + CX * (j + CY * k)]) { const dx = x - BULB_POS[b * 3], dy = y - BULB_POS[b * 3 + 1], dz = z - BULB_POS[b * 3 + 2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < RC * RC) g += (BULB_BASE[b * 3] / 9) * (1 / (d2 + EPS) - K0); }
    return Math.min(1, g / GMAX);
  };
  const data = new Uint8Array(NX * NY * NZ);
  if (!LOW) for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++)
    data[i + NX * (j + NY * k)] = Math.round(255 * Math.sqrt(field(min.x + size.x * (i + 0.5) / NX, min.y + size.y * (j + 0.5) / NY, min.z + size.z * (k + 0.5) / NZ)));   // sqrt: more steps near 0
  const tex = new THREE.Data3DTexture(data, NX, NY, NZ);
  tex.format = THREE.RedFormat; tex.type = THREE.UnsignedByteType; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.unpackAlignment = 1; tex.needsUpdate = true;
  const ms = Math.round(performance.now() - t0);
  return { tex, min, size, field, ms, uniforms: { uGlow: { value: tex }, uGlowMin: { value: min }, uGlowSize: { value: size }, uGlowK: { value: 1 } } };
})();
const GLOW_K = 4.5;   // emissive gain at full glow (scaled by GLOW.uniforms.uGlowK: 0 when the tree lights are off)
if (!LOW && renderer.capabilities.isWebGL2) {
  NEEDLE_MAT.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, GLOW.uniforms);
    sh.vertexShader = 'varying vec3 vGlowP;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 gp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        gp = instanceMatrix * gp;
      #endif
        vGlowP = (modelMatrix * gp).xyz; }`);
    sh.fragmentShader = 'uniform lowp sampler3D uGlow; uniform vec3 uGlowMin; uniform vec3 uGlowSize; uniform float uGlowK; varying vec3 vGlowP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 gq = (vGlowP - uGlowMin) / uGlowSize; float g = texture(uGlow, gq).r; g *= g * ${GLOW_K.toFixed(1)} * uGlowK;
        // warm bulb light on the needle: its own colour pulled toward gold (light through thin needles reads yellow-gold, not lime)
        vec3 nc = diffuseColor.rgb; float nl = dot(nc, vec3(0.3, 0.59, 0.11));
        totalEmissiveRadiance += mix(nc, vec3(1.6, 1.15, 0.35) * nl, 0.6) * vec3(1.0, 0.75, 0.4) * g; }`);
  };
  NEEDLE_MAT.customProgramCacheKey = () => 'needleGlow';
} else {   // LOW: one baked glow value per needle card (at its 60% point), warming its instance colour
  const c = new THREE.Color(), warm = new THREE.Color(1.7, 1.35, 0.65);
  FOLIAGE.forEach(F => { const ic = F.mesh.instanceColor; for (let i = 0; i < F.n; i++) { const g = GLOW.field(F.mid[i * 3], F.mid[i * 3 + 1], F.mid[i * 3 + 2]); if (g <= 0.01) continue; c.fromBufferAttribute(ic, i); c.lerp(warm.clone().multiplyScalar(c.g), Math.min(0.45, 1.0 * Math.sqrt(g))); ic.setXYZ(i, c.r, c.g, c.b); } ic.needsUpdate = true; });
}

/* ---------------- Keep needles off the front of the hero pieces ---------------- */
// After the pets are seated on the branches, a needle card can still poke out in front of a face. clearFoliage()
// shortens (scale.y 0.35, or 0.12 if that is not enough) only the needles whose tip or middle would show in front
// of a visible pet, stocking, doghouse or hoop, inside its outline. Needles behind a piece are left alone, so no bald
// patch shows when you orbit. It restores every needle from its base matrix first, so it follows option swaps.
const HERO_BOX = [];   // { g (visibility), p, rot, hw, y0, y1, zf } in the piece's local frame
let CLEAR_STATS = { ms: 0, shortened: 0, heroes: 0 };
function clearFoliage() {
  const t0 = performance.now(), heroes = [], v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  cards.forEach(g => { const RL = g.userData.relief; if (!RL || !RL.hero || !RL.F || !shown(g)) return; g.updateMatrixWorld(true);
    heroes.push({ RL, inv: g.matrixWorld.clone().invert(), c: new THREE.Vector3(0, RL.dy, 0).applyMatrix4(g.matrixWorld), rad: Math.hypot(RL.w, RL.h) / 2 + RL.D }); });
  HERO_BOX.forEach(b => { if (!shown(b.g)) return; const m = new THREE.Matrix4().compose(b.p, new THREE.Quaternion().setFromEuler(b.rot), one);
    heroes.push({ b, inv: m.clone().invert(), c: new THREE.Vector3(0, (b.y0 + b.y1) / 2, 0).applyMatrix4(m), rad: Math.hypot(b.hw, (b.y1 - b.y0) / 2) + 0.05 }); });
  const over = (H, x, y, z, pad) => {   // is local point (x, y, z) in front of the piece and inside its outline (grown by pad)?
    v.set(x, y, z).applyMatrix4(H.inv);
    if (H.b) return Math.abs(v.x) < H.b.hw + pad && v.y > H.b.y0 - pad && v.y < H.b.y1 + pad && v.z > H.b.zf - pad * 0.5;
    const RL = H.RL, F = RL.F, u = v.x / RL.w + 0.5, w = (v.y - RL.dy) / RL.h + 0.5, du = pad / RL.w, dw = pad / RL.h;
    if (u < -du || u > 1 + du || w < -dw || w > 1 + dw) return false;
    const cu = Math.min(1, Math.max(0, u)), cw = Math.min(1, Math.max(0, w));
    const A = Math.max(sampleArr(F, F.a, cu, cw), sampleArr(F, F.a, Math.min(1, cu + du), cw), sampleArr(F, F.a, Math.max(0, cu - du), cw), sampleArr(F, F.a, cu, Math.min(1, cw + dw)), sampleArr(F, F.a, cu, Math.max(0, cw - dw)));
    return A > 0.3 && v.z > reliefZ(F, cu, cw, RL.D) * 0.8 - pad * 0.5;
  };
  let shortened = 0;
  FOLIAGE.forEach(FL => {
    const arr = FL.mesh.instanceMatrix.array, B = FL.base;
    FL.touched.forEach(i => arr.set(B.subarray(i * 16, i * 16 + 16), i * 16)); FL.touched = [];
    FL.mark.fill(0);
    const lower = y => { let lo = 0, hi = FL.n; while (lo < hi) { const m = (lo + hi) >> 1; if (FL.ys[m] < y) lo = m + 1; else hi = m; } return lo; };
    for (const H of heroes) {
      const R2 = (H.rad + 0.4) * (H.rad + 0.4);
      for (let q = lower(H.c.y - H.rad - 0.4), qe = lower(H.c.y + H.rad + 0.4); q < qe; q++) {
        const i = FL.order[q]; if (FL.mark[i]) continue;
        const tx = FL.tip[i * 3], ty = FL.tip[i * 3 + 1], tz = FL.tip[i * 3 + 2], o = i * 16;
        const dx = tx - H.c.x, dy = ty - H.c.y, dz = tz - H.c.z; if (dx * dx + dy * dy + dz * dz > R2) continue;
        const pad = FL.wd[i] * 0.5, at = k => [B[o + 12] + B[o + 4] * k, B[o + 13] + B[o + 5] * k, B[o + 14] + B[o + 6] * k];
        if (!over(H, ...at(1), pad) && !over(H, ...at(0.6), pad)) continue;
        const s = [0.35, 0.12].find(k => !over(H, ...at(k), pad) && !over(H, ...at(k * 0.6), pad)) || 0.05;
        for (let k = 4; k < 7; k++) arr[o + k] = B[o + k] * s;
        FL.mark[i] = 1; FL.touched.push(i); shortened++;
      }
    }
    FL.mesh.instanceMatrix.needsUpdate = true;
  });
  renderer.shadowMap.needsUpdate = true;
  CLEAR_STATS = { ms: +(performance.now() - t0).toFixed(2), shortened, heroes: heroes.length };
  return CLEAR_STATS;
}

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
// strip along points with given surface normals; 3 columns across so tails can have a V-cut end.
// ripple: wired-edge wave (fraction of the width) on the two edges, out of phase, `waves` per strip; cup: the centre
// column sits back by this fraction of the width, so the ribbon cups and catches light along its edges.
function strip(pts, nrm, width, { uLen = width, notch = false, taper = null, flip = false, ripple = 0, waves = 6, cup = 0 } = {}) {
  const n = pts.length, pos = [], uv = [], idx = []; let L = 0;
  const tng = new THREE.Vector3(), side = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    tng.subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(tng, nrm[i]).normalize();
    if (i) L += pts[i].distanceTo(pts[i - 1]);
    const t = i / (n - 1), w = width * (taper ? taper(t) : 1) / 2, p = pts[i];
    let c = p.clone().addScaledVector(nrm[i], -cup * w * 2); if (notch && i === n - 1) c.addScaledVector(tng, -width * 0.42);
    const e0 = ripple ? ripple * width * Math.sin(t * Math.PI * 2 * waves) : 0, e1 = ripple ? ripple * width * Math.sin(t * Math.PI * 2 * waves + 1.9) : 0;
    [p.clone().addScaledVector(side, -w).addScaledVector(nrm[i], e0), c, p.clone().addScaledVector(side, w).addScaledVector(nrm[i], e1)].forEach((v, k) => { pos.push(v.x, v.y, v.z); uv.push(L / uLen, flip ? 1 - k / 2 : k / 2); });
    if (i < n - 1) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// a hand-tied bow: loops (ribbon width vertical), centre knot, two hanging V-cut tails. All sizes in inches.
// Loops are pinched to 0.3 of the width where they enter the knot, carry a wired-edge ripple, cup slightly, and droop
// (droop ~ 0.28: the outer end sags about 15 degrees) with a little random yaw and tilt each. Tails flare out, then fall
// under their weight with a half twist (180 degrees) along their length. The knot is a creased band. tails:false leaves
// them off (gift bows lay their own along the lid).
function bowGeo({ ribbon, span, tail, loops = 2, uLen = ribbon, seed = 1, open = 0, flare = 0.32, loopTilt = 0.22, droop = 0.28, ripple = 0.04, twist = Math.PI, tails = true }) {
  const r = rng(seed), parts = [], W = ribbon * IN, Lb = span / 2 * IN, T = tail * IN;
  const loopDefs = loops === 2 ? [[0, loopTilt, 1], [Math.PI, loopTilt, 1]] : [[0, 0.5, 1], [Math.PI, 0.5, 1], [0, -0.32, 0.82], [Math.PI, -0.32, 0.82]];
  const pinch = t => { const m = Math.min(t, 1 - t) / 0.15, s = Math.min(1, m); return 0.3 + 0.7 * s * s * (3 - 2 * s); };
  loopDefs.forEach(([yaw, tilt, len]) => {
    const pts = [], nrm = [], L = Lb * len * (0.95 + r() * 0.1), dz = Math.max(W * 0.62, L * 0.34), dr = droop * (0.8 + r() * 0.4);
    const e = new THREE.Euler(open + (r() - 0.5) * 0.12, yaw + (r() - 0.5) * 0.16, tilt + (r() - 0.5) * 0.08);
    for (let i = 0; i <= 48; i++) {
      const th = i / 48 * Math.PI * 2;
      const x = L / 2 * (1 - Math.cos(th)) * (1 - 0.12 * Math.sin(th / 2)), z = dz * Math.sin(th) * (0.75 + 0.25 * Math.sin(th / 2));
      const p = new THREE.Vector3(x, -dr * x * x / L, z), n = new THREE.Vector3(x - L / 2, 0, z * 1.6).normalize();
      p.applyEuler(e); n.applyEuler(e); p.z += 0.15 * W; pts.push(p); nrm.push(n);
    }
    parts.push(strip(pts, nrm, W, { uLen: uLen * IN, taper: pinch, ripple, waves: 5, cup: 0.06 }));
  });
  if (tails) [-1, 1].forEach(s => {
    const pts = [], nrm = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36, tw = s * twist * 0.9 * t + 0.2 * Math.sin(t * 5 + s);
      pts.push(new THREE.Vector3(s * (0.03 * W + T * flare * Math.sin(t * Math.PI / 2) + Math.sin(t * 4) * 0.06 * W), -T * (0.72 * t + 0.28 * t * t) * (1 - flare * 0.3), 0.1 * W + Math.sin(t * 2.6 + s) * 0.18 * W + T * flare * 0.25 * Math.sin(t * Math.PI)));
      nrm.push(new THREE.Vector3(Math.sin(tw), 0, Math.cos(tw)).normalize());
    }
    parts.push(strip(pts, nrm, W * 0.92, { uLen: uLen * IN, notch: true, taper: t => Math.min(1, 0.55 + t * 3), ripple: ripple * 0.6, waves: 3, cup: 0.04 }));
  });
  { // knot: a creased band wrapped round the pinched loops
    const pts = [], nrm = [], kx = W * 0.3, kz = W * 0.24;
    for (let i = 0; i <= 28; i++) { const th = i / 28 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(th) * kx, 0, Math.sin(th) * kz + 0.2 * W)); nrm.push(new THREE.Vector3(Math.cos(th) * kz, 0, Math.sin(th) * kx).normalize()); }
    parts.push(strip(pts, nrm, W * 0.78, { uLen: uLen * IN, ripple: 0.05, waves: 2, cup: 0.1 }));
  }
  return mergeGeometries(parts);
}

/* ---------------- Materials from the real products ---------------- */
const tartanTex = photoTex('tx_tartan4', [1, 1]);
const velvet = (id, c = 0x6c0a16) => mat(id, THREE.MeshPhysicalMaterial, { color: c, roughness: 0.85, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xb02838), side: THREE.DoubleSide, envMapIntensity: 0.35 });
// woven twill: 45-degree ribs as a normal map (shared by the tartan pieces)
const TWILL_N = canvasTex(256, 256, (g, w) => { const im = g.createImageData(w, w); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const ph = ((x + y) % 16) / 16 * Math.PI * 2, nx = Math.cos(ph) * 0.38, i = (y * w + x) * 4; im.data[i] = 128 + nx * 127 * 0.7071; im.data[i + 1] = 128 - nx * 127 * 0.7071; im.data[i + 2] = 255 * Math.sqrt(1 - nx * nx); im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: [4, 4], srgb: false });
const tartanMat = id => mat(id, THREE.MeshPhysicalMaterial, { map: tartanTex, color: 0xffffff, roughness: 0.78, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x803030), normalMap: TWILL_N, normalScale: new THREE.Vector2(0.35, 0.35), side: THREE.DoubleSide, envMapIntensity: 0.3 });
function bumpTex(name, repeat = [1, 1]) {   // a linear (non-sRGB) copy of a photo texture, for bump maps
  const key = 'bump:' + name + repeat.join(); if (texCache[key]) return texCache[key];
  const t = loader.load(CUT[name].src); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); return (texCache[key] = t);
}
const ribbonMat = (id, tex) => mat(id, THREE.MeshStandardMaterial, { map: photoTex(tex, [1, 1]), bumpMap: bumpTex(tex), bumpScale: 1.5, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.3 });   // burlap weave in light and shadow
const RIB = { 6: ['tx_burlap6', 10], 4: ['tx_burlap4', 10], 2.5: ['tx_burlap25', 6], 1.5: ['tx_burlap15', 6] };   // ribbon width (in) -> texture, inches per repeat
const goldMetal = id => mat(id, THREE.MeshStandardMaterial, { color: 0xcfa24e, metalness: 0.95, roughness: 0.3 });
const sherpaTex = canvasTex(256, 256, (g, w) => { g.fillStyle = '#e9e1d2'; g.fillRect(0, 0, w, w); for (let i = 0; i < 1400; i++) { const x = Math.random() * w, y = Math.random() * w, r = 2 + Math.random() * 4; g.fillStyle = Math.random() < .5 ? '#f6f0e4' : '#cfc4b0'; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); } }, { repeat: [3, 2] });
const BUILD = {};

/* ---------------- Topper bow and its optional extras ---------------- */
// burlap with black felt paws glued on (render keys paws = how many on the bow, paw_in = paw size in inches)
function pawBurlapTex(name, tileIn, widthIn, pawIn, perTile) {
  const c = CUT[name], cv = document.createElement('canvas'); cv.width = c.w; cv.height = c.h;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  loadImg(c.src).then(img => {
    const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height; g.drawImage(img, 0, 0, W2, H2);
    // the shop texture carries the old 2.2" paws (at 0.14-0.34 and 0.64-0.86 of the tile): cover them with plain weave from the middle first
    [0.11, 0.62].forEach(x => g.drawImage(img, img.width * 0.36, 0, img.width * 0.26, img.height, W2 * x, 0, W2 * 0.26, H2));
    const pr = rng(31), pxIn = W2 / tileIn, n = Math.max(1, Math.round(perTile));
    for (let k = 0; k < n; k++) {   // staggered along the tile, alternately high and low across the ribbon, each turned a little
      const x = (k + 0.5) / n * cv.width + (pr() - 0.5) * pxIn * 0.6, y = cv.height * (k % 2 ? 0.66 : 0.36) + (pr() - 0.5) * pxIn * 0.4, rot = (pr() - 0.5) * 0.9;
      g.globalAlpha = 0.25; [0, cv.width, -cv.width].forEach(dx => drawPaw(g, x + dx + 1.5, y + 1.5, pawIn * pxIn * 0.95, '#000', rot)); g.globalAlpha = 1;   // felt edge
      [0, cv.width, -cv.width].forEach(dx => drawPaw(g, x + dx, y, pawIn * pxIn * 0.95, '#141210', rot));
    }
    t.needsUpdate = true;
  });
  return t;
}
// Paws are glued on the front face only (render key paw_face 'front'): the ribbon's visible outer face is the strip's
// back face (strip() winds its triangles so the geometric front faces along -nrm), so the paw texture goes on BackSide
// and plain burlap on FrontSide; inside the loops and the back of a twisted tail read as plain weave.
function pawRibbonMeshes(geo, id, tex, rep, ribbonIn, pawIn, perTile, face) {
  const paw = { map: pawBurlapTex(tex, rep, ribbonIn, pawIn, perTile), bumpMap: bumpTex(tex), bumpScale: 1.5, roughness: 0.95, envMapIntensity: 0.3 };
  if (face !== 'front') return [new THREE.Mesh(geo, mat(id, THREE.MeshStandardMaterial, { ...paw, side: THREE.DoubleSide }))];
  return [new THREE.Mesh(geo, mat(id, THREE.MeshStandardMaterial, { ...paw, side: THREE.BackSide })), new THREE.Mesh(geo, mat(id, THREE.MeshStandardMaterial, { map: photoTex(tex, [1, 1]), bumpMap: bumpTex(tex), bumpScale: 1.5, roughness: 0.95, envMapIntensity: 0.3, side: THREE.FrontSide }))];
}
BUILD.topper = (r, id) => {
  const [tex, rep] = RIB[r.ribbon];
  const two = r.loops === 2;   // board bow: two big upswept loops over shorter tails (render keys tail 14, loop_tilt 0.35)
  const g = bowGeo({ ribbon: r.ribbon, span: r.span, tail: r.tail, loops: r.loops, uLen: rep, seed: 9, open: two ? 0.62 : 0.2, flare: two ? 0.42 : 0.4, loopTilt: r.loop_tilt ?? 0.22, droop: two ? 0.22 : 0.28, twist: two ? Math.PI * 0.45 : Math.PI });
  const ribbonLen = 2 * Math.PI * r.span / 2 * 0.9 + 2 * r.tail + 8;   // inches of ribbon in the bow (loops + tails + knot)
  const meshes = r.paws ? pawRibbonMeshes(g, id, tex, rep, r.ribbon, r.paw_in || 3, r.paws / (ribbonLen / rep), r.paw_face) : [new THREE.Mesh(g, ribbonMat(id, tex))];
  meshes.forEach(bow => { bow.position.set(0, YTOP + 0.1 + (r.ribbon - 4) * IN * 0.45, 0.14); bow.castShadow = true; TARGET.add(bow); tag(bow, id); });
  addInstancePos(id, meshes[0].position);
};
BUILD.flourish = r => {
  if (r.streamers) [-1, 1].forEach(s => {   // two burlap streamers (render key len, inches each) from the bow down the front of the tree, paws on the front
    const path = yEnd => { const pts = [], nrm = []; let L = 0;
      for (let i = 0; i <= 260; i++) {
        const t = i / 260, y = YTOP - 0.1 - t * (YTOP - 0.1 - yEnd), th = Math.PI / 2 + s * (0.24 + t * 0.42) + 0.05 * Math.sin(t * 17 + s);
        const ph = t * 5.5, bulge = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 2);
        const rr = rAt(y) * 0.97 + 0.05 + 0.16 * bulge * (0.4 + t), tw = 0.55 * Math.sin(ph * Math.PI * 2 + s);
        const rad = new THREE.Vector3(Math.cos(th), 0.15, Math.sin(th)).normalize(), tan = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
        pts.push(new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr)); nrm.push(rad.multiplyScalar(Math.cos(tw)).addScaledVector(tan, Math.sin(tw)).normalize()); if (i) L += pts[i].distanceTo(pts[i - 1]);
      }
      return { pts, nrm, L };
    };
    let lo = Y0 + 0.2, hi = YTOP - 0.6, P = path(lo);   // end the streamer where its length matches the plan's (render key len)
    if (r.len && P.L > r.len * IN) { for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2; if (path(m).L > r.len * IN) lo = m; else hi = m; } P = path(lo); }
    const geo = strip(P.pts, P.nrm, 6 * IN, { uLen: 10 * IN, notch: true, ripple: 0.025, waves: 18, cup: 0.04 });
    const ms = r.paws ? pawRibbonMeshes(geo, 'topper', 'tx_burlap6', 10, 6, r.paw_in || 3, r.paws / 2 / (P.L / IN / 10), 'front') : [new THREE.Mesh(geo, ribbonMat('topper', 'tx_burlap6'))];
    ms.forEach(m => { m.castShadow = true; TARGET.add(m); tag(m, 'topper'); });
  });
  if (r.crown) {   // twelve gold glitter sprays fanned out behind the bow
    const beads = [], L = (SZ('gold_picks').h || 17) * IN * 0.85, c = new THREE.Vector3(0, YTOP + 0.05, -0.05);
    const stems = [], up = new THREE.Vector3(0, 1, 0), gm = mat('gold_picks', THREE.MeshStandardMaterial, { color: 0xd8b062, metalness: 0.9, roughness: 0.3, emissive: 0x3a2508, emissiveIntensity: 0.6 });
    const nc = r.n || 12;
    for (let k = 0; k < nc; k++) {
      const a = -1.3 + k / (nc - 1) * 2.6 + R(-0.05, 0.05), dir = new THREE.Vector3(Math.sin(a), Math.cos(a) * 0.95, -0.22).normalize(), len = L * R(0.85, 1.05);
      stems.push({ p: c.clone().addScaledVector(dir, len * 0.5), rot: new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)), sv: new THREE.Vector3(1, len, 1), noMark: true });
      for (let b = 0; b < 22; b++) { const t = 0.35 + Math.pow(b / 22, 0.8) * 0.65, side = new THREE.Vector3(R(-1, 1), R(-1, 1), R(-1, 1)).multiplyScalar((b % 3 ? 0.35 : 1.1) * IN); beads.push({ p: c.clone().addScaledVector(dir, len * t).add(side), s: 0.2 * IN * R(0.8, 1.3), noMark: !(k === 6 && b === 10) }); }
    }
    instanced(new THREE.CylinderGeometry(0.06 * IN, 0.09 * IN, 1, 5), gm, stems, null);
    instanced(new THREE.SphereGeometry(1, 16, 10), gm, beads, 'gold_picks');
  }
};

/* ---------------- Plush pets on the tree (real product photos, cut out, with their tartan scarves) ---------------- */
// Each pet sits on the branches: pushed out along the outward normal by 0.6 x its relief depth + 1.5" (so its back
// rests on the needle tips instead of being skewered), with a few short sprigs in front of its lower edge.
// clearFoliage() then pulls back only the needles that would still poke out in front of it.
function seatPet(cut, id, hIn, p, depth, dyOff) {
  const c = CUT[cut], h = hIn * IN, w = h * c.w / c.h, D = Math.min(w, h) * depth, th = faceY(p);
  const out = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
  const at = p.clone().add(new THREE.Vector3(0, dyOff, 0)).addScaledVector(out, 0.6 * D + 1.5 * IN);
  const g = photoCard(cut, id, hIn, at, { depth, hero: true });
  // seating sprigs: 4 short needle sprays rising from the branch in front of the pet's feet
  const list = [], up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < 4; k++) {
    const side = new THREE.Vector3(Math.cos(g.rotation.y), 0, -Math.sin(g.rotation.y)), x = (k / 3 - 0.5) * w * 0.8 + yawJ(0.03);
    const base = at.clone().addScaledVector(side, x).addScaledVector(out, -0.05).add(new THREE.Vector3(0, -0.02, 0));
    const dir = out.clone().multiplyScalar(0.9).add(new THREE.Vector3(yawJ(0.25), 0.05 + yawJ(0.15), 0)).addScaledVector(side, x * 0.6).normalize();
    q.setFromUnitVectors(up, dir); e.setFromQuaternion(q); e.y += yawJ(1);
    const len = 0.22 + YAW() * 0.1;
    list.push({ p: base, rot: e.clone(), sv: new THREE.Vector3(0.3 + len * 0.5, len, 0.3 + len * 0.5), c: new THREE.Color(1, 1, 1).multiplyScalar(0.95 + yawJ(0.1)), noMark: true });
  }
  if (NEEDLE_GEO) instanced(NEEDLE_GEO, NEEDLE_MAT, list, null);
  return g;
}
BUILD.dogs = (r, id) => {
  for (let i = 0; i < r.n; i++) {
    const { p } = spotFront(r.h * IN * 1.1, 2.0, 3.7, 1.0, i ? 1.7 : 0.55);
    seatPet(r.cut, id, r.h, p, 0.45, -0.12);
    addInstancePos('bandanas', p.clone().add(new THREE.Vector3(0, r.h * IN * 0.45, 0.05)));
  }
};
// cats: render keys h (tall), l (long) and pose ('sit' | 'stand'). A standing cat is longer than it is wide in
// the photo, so its relief is deeper (the body runs back toward the tree).
const catDepth = r => r.pose === 'stand' && r.l ? Math.min(0.62, 0.45 * Math.max(1, r.l / r.h * 0.8)) : 0.45;
BUILD.cats = (r, id) => {
  for (let i = 0; i < r.n; i++) {
    const { p } = spotFront(r.h * IN * 1.2, 2.9, 5.4, 1.0, i ? 1.4 : 0.85);
    seatPet(r.cut, id, r.h, p, catDepth(r), -0.08);
    addInstancePos('bandanas', p.clone().add(new THREE.Vector3(0, r.h * IN * 0.5, 0.05)));
  }
};

/* ---------------- Hangers: cords and wire hooks from a piece's top into the branches ---------------- */
// hangerGeo(len, back, rad, from): one thin tube per attachment point in `from` ([[x, y, z], ...], inches), each rising
// along a slightly sagging curve to one apex `len` inches up and `back` inches into the tree (local -z). Inches in, scene units out.
const HANGER_CACHE = {};
function hangerGeo(len, back, rad, from = [[0, 0, 0]], seg = 10) {
  const k = [len, back, rad, JSON.stringify(from), seg].join('|'); if (HANGER_CACHE[k]) return HANGER_CACHE[k];
  const apex = new THREE.Vector3(0, len, -back).multiplyScalar(IN);
  const tubes = from.map(([x, y, z]) => { const a = new THREE.Vector3(x, y, z).multiplyScalar(IN), mid = a.clone().lerp(apex, 0.5); mid.x += x * 0.15 * IN; mid.y -= 0.12 * len * IN; mid.z += 0.15 * back * IN;
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, apex), seg, rad * IN, 4, false).toNonIndexed(); });
  return (HANGER_CACHE[k] = tubes.length > 1 ? mergeGeometries(tubes) : tubes[0]);
}
const goldCord = () => mat('gold_cord', THREE.MeshStandardMaterial, { color: 0xd4a94e, metalness: 0.85, roughness: 0.35 });

/* ---------------- Doghouse ornaments: foam board, true size from the template ---------------- */
const shingleTex = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#d9c497'; g.fillRect(0, 0, w, w);
  for (let y = 0; y < w; y += 32) for (let x = (y / 32) % 2 ? -24 : 0; x < w; x += 48) { g.fillStyle = `hsl(40, ${38 + Math.random() * 12}%, ${72 + Math.random() * 10}%)`; g.fillRect(x + 1, y, 46, 30); g.fillStyle = 'rgba(80,55,25,.35)'; g.fillRect(x, y + 28, 48, 3); g.fillRect(x, y, 2, 30); }
  noise(g, w, w, 1500, 0.15, ['#5a3d1d']);
});
function brickTexFor(bhIn, blIn, mortar, seed) {   // one tile = 4 bricks x 6 courses, staggered; dark-brick base under dabbed barn red
  const tw = 4 * blIn, th = 6 * bhIn, W2 = 256, H2 = Math.max(32, Math.round(256 * th / tw)), br = rng(seed);
  const t = canvasTex(W2, H2, (g, w, h) => {
    g.fillStyle = mortar; g.fillRect(0, 0, w, h);
    const ch = h / 6, bl = w / 4, j = Math.max(1.5, ch * 0.09);
    for (let k = 0; k < 6; k++) for (let x = k % 2 ? -bl / 2 : 0; x < w; x += bl) {
      g.fillStyle = `hsl(${358 + br() * 9}, ${52 + br() * 16}%, ${24 + br() * 9}%)`; g.fillRect(x + j / 2, k * ch + j / 2, bl - j, ch - j);
      g.fillStyle = `rgba(${br() < 0.5 ? '160,52,40' : '40,8,6'},${0.15 + br() * 0.2})`; for (let d = 0; d < 5; d++) g.fillRect(x + j + br() * (bl - 3 * j), k * ch + j + br() * (ch - 3 * j), 2 + br() * 5, 2 + br() * 3);   // dabbed sponge texture
    }
    noise(g, w, h, 1200, 0.18, ['#000', '#c86a5a']);
  });
  t.userData = { tw, th }; return t;
}
function pawShapes(s, cx, cy) {   // drawPaw's pad and four toes as separate shapes (inches, y up)
  const ell = (x, y, rx, ry, rot) => { const sh = new THREE.Shape(); sh.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0); const pts = sh.getPoints(28).map(p => new THREE.Vector2(cx + x + p.x * Math.cos(rot) - p.y * Math.sin(rot), cy + y + p.x * Math.sin(rot) + p.y * Math.cos(rot))); return new THREE.Shape(pts); };
  return [ell(0, -0.2 * s, 0.32 * s, 0.26 * s, 0), ...[[-0.36, -0.14, -0.4], [-0.13, -0.38, -0.12], [0.13, -0.38, 0.12], [0.36, -0.14, 0.4]].map(([x, y, r]) => ell(x * s, -y * s, 0.12 * s, 0.16 * s, -r))];
}
BUILD.doghouses = (r, id) => {
  const W = r.w * IN, D = r.d * IN, wallH = r.wall * IN, H = r.ridge * IN, big = r.w > 5, over = (big ? 0.75 : 0.35) * IN;
  const [doorW, doorH] = r.door || (big ? [3.8, 4.6] : [1.5, 1.9]), trim = big ? 0.5 : 0.22, fb = (big ? 0.19 : 0.12);   // trim width, foam-board thickness (in)
  const bt = brickTexFor(r.brick_h || (big ? 0.9 : 0.4), r.brick_l || (big ? 1.5 : 0.7), r.mortar || '#3a1912', big ? 21 : 22);
  const pawRaised = r.raised_paw !== undefined ? !!r.raised_paw : big, pawY = r.ridge - (r.paw_y ?? (r.ridge - r.wall) * 0.62), pawS = big ? 2.5 : 1;
  const frontTex = canvasTex(512, Math.round(512 * r.ridge / r.w), (g, w, h) => {
    const px = w / r.w, b = bt.image; for (let x = 0; x < w; x += bt.userData.tw * px) for (let y = h; y > -bt.userData.th * px; y -= bt.userData.th * px) g.drawImage(b, x, y - bt.userData.th * px, bt.userData.tw * px, bt.userData.th * px);   // courses measured up from the bottom edge
    const dw = doorW * px, dh = doorH * px, dx = w / 2, by = h;
    const ig = g.createLinearGradient(0, by - dh, 0, by); ig.addColorStop(0, '#070302'); ig.addColorStop(1, r.interior === 'dark' ? '#1c0d07' : '#5b2a12');   // dark inside (render key interior)
    g.fillStyle = ig; g.beginPath(); g.moveTo(dx - dw / 2, by); g.lineTo(dx - dw / 2, by - dh + dw / 2); g.arc(dx, by - dh + dw / 2, dw / 2, Math.PI, 0); g.lineTo(dx + dw / 2, by); g.fill();
    if (!pawRaised) drawPaw(g, w / 2, h - pawY * px, pawS * px, '#efe0bf');   // the small house's paw is painted on
  }, { clamp: true });
  const brick = bt.clone(); brick.needsUpdate = true; brick.repeat.set(r.d / bt.userData.tw, r.wall / bt.userData.th); brick.offset.set(0, 0);
  const shingle = shingleTex.clone(); shingle.needsUpdate = true; shingle.repeat.set(1.2 * r.w / 8.5, 1.2 * r.d / 6);
  const body = new THREE.BoxGeometry(W, wallH, D); body.translate(0, wallH / 2, 0);
  const gable = new THREE.Shape(); gable.moveTo(-W / 2, 0); gable.lineTo(W / 2, 0); gable.lineTo(W / 2, wallH); gable.lineTo(0, H); gable.lineTo(-W / 2, wallH); gable.closePath();
  const front = new THREE.ShapeGeometry(gable); { const uv = front.attributes.uv, p = front.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, p.getY(i) / H); } front.translate(0, 0, D / 2 + 0.001);
  const back = new THREE.ShapeGeometry(gable); back.rotateY(Math.PI); back.translate(0, 0, -D / 2 - 0.001);
  const slope = Math.atan2(H - wallH, W / 2), rl = Math.hypot(W / 2, H - wallH) + over, rT = 0.3 * IN;
  const roofAt = (sg, along, below) => { const c = Math.cos(slope), s = Math.sin(slope); return new THREE.Vector3(sg * along * c + sg * s * -below, H - along * s + rT / 2 + 0.15 * IN - c * below, 0); };   // a point on a roof slope: `along` from the peak, `below` under the roof's mid-plane
  const roofs = [-1, 1].map(sg => { const rf = new THREE.BoxGeometry(rl, rT, D + 2 * over); rf.rotateZ(-sg * slope); const c = roofAt(sg, rl / 2 - over * 0.6, 0); rf.translate(c.x, c.y - rT / 2, 0); return rf; });
  const geoBrick = mergeGeometries([body.toNonIndexed(), back.toNonIndexed()]), geoRoof = mergeGeometries(roofs.map(x => x.toNonIndexed()));
  // raised cream trims (template page 8), extruded from foam board and glued on: one merged geometry
  const ex = (shapes, depth, z) => { const g = new THREE.ExtrudeGeometry(shapes, { depth: depth * IN, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 * IN, bevelSegments: 1, curveSegments: 20 }); g.scale(IN, IN, 1); g.translate(0, 0, z); return g.toNonIndexed(); };
  const trims = [], zf = D / 2 + 0.002;
  { const ow = doorW / 2 + trim, ar = doorW / 2, y0 = fb, yc = doorH - ar;   // U arch trim: 0.5" all round the arch-topped door, legs on the threshold
    const u = new THREE.Shape(); u.moveTo(-ow, y0); u.lineTo(-ow, yc); u.absarc(0, yc, ow, Math.PI, 0, true); u.lineTo(ow, y0); u.lineTo(ar, y0); u.lineTo(ar, yc); u.absarc(0, yc, ar, 0, Math.PI, false); u.lineTo(-ar, y0); u.closePath();
    trims.push(ex(u, fb, zf)); }
  [-1, 1].forEach(sg => [zf, -zf - fb * IN].forEach(z => { const c = new THREE.BoxGeometry(trim * IN, wallH - 0.02 * IN, fb * IN); c.translate(sg * (W / 2 - trim * IN / 2), wallH / 2, z + fb * IN / 2); trims.push(c.toNonIndexed()); }));   // corner trims, front and back
  if (r.threshold !== false) { const t = new THREE.BoxGeometry((doorW + 2 * trim) * IN, fb * IN, (big ? 0.75 : 0.4) * IN + fb * IN); t.translate(0, fb * IN / 2, D / 2 + ((big ? 0.75 : 0.4) * IN + fb * IN) / 2); trims.push(t.toNonIndexed()); }
  if (r.barge !== false) [-1, 1].forEach(sg => {   // barge boards along the front roof edges, top flush with the roof
    const bw = (big ? 0.6 : 0.3) * IN, len = rl, b = new THREE.BoxGeometry(len, bw, fb * IN); b.rotateZ(-sg * slope);
    const c = roofAt(sg, len / 2 - over * 0.6, bw / 2 - rT / 2); b.translate(c.x, c.y, D / 2 + over - fb * IN / 2 + 0.01 * IN); trims.push(b.toNonIndexed());
  });
  if (pawRaised) trims.push(ex(pawShapes(pawS, 0, pawY), fb, zf));
  const geoTrim = mergeGeometries(trims);
  const mBrick = mat(id, THREE.MeshStandardMaterial, { map: brick, roughness: 0.8 }), mFront = mat(id, THREE.MeshStandardMaterial, { map: frontTex, roughness: 0.8, side: THREE.DoubleSide }), mRoof = mat(id, THREE.MeshStandardMaterial, { map: shingle, roughness: 0.75 });
  const mTrim = mat(id, THREE.MeshStandardMaterial, { color: 0xefe2c2, roughness: 0.6 });
  const list = [];
  for (let i = 0; i < r.n; i++) {
    const { p } = i < 2 ? spotFront(H * 1.15, 2.2, 4.4, 1.03, i ? 1.3 : 0.3) : spot(H * 1.15, Y0 + 0.7, YTOP - 1.3, 1.03);
    list.push({ p: p.clone().add(new THREE.Vector3(0, -H * 0.5, 0)), rot: new THREE.Euler(0, faceY(p) + R(-0.25, 0.25), R(-0.05, 0.05)) });
  }
  const nm = list.map(l => ({ ...l, noMark: true }));
  instanced(geoBrick, mBrick, list, id); instanced(front, mFront, nm, id); instanced(geoRoof, mRoof, nm, id); instanced(geoTrim, mTrim, nm, id);
  if (r.ridge_cap !== false) {   // ridge cap: two strips glued as a peak, painted barn red with sienna
    const cw = (big ? 0.5 : 0.25) * IN, caps = [-1, 1].map(sg => { const c = new THREE.BoxGeometry(cw, fb * IN, D + 2 * over); c.rotateZ(-sg * slope); const q = roofAt(sg, cw / 2 - 0.02 * IN, -rT / 2 - fb * IN / 2); c.translate(q.x, q.y, 0); return c.toNonIndexed(); });
    instanced(mergeGeometries(caps), mat(id, THREE.MeshStandardMaterial, { color: 0x7c1d16, roughness: 0.7 }), nm, id);
  }
  if (r.hang === 'loop') instanced(hangerGeo(r.ridge + 1.8, 1.2, 0.05, [[-r.w * 0.12, r.ridge, 0], [r.w * 0.12, r.ridge, 0]]), goldCord(), nm, null, { cast: false });   // a gold cord loop glued under the ridge
  list.forEach(l => HERO_BOX.push({ g: TARGET, p: l.p, rot: l.rot, hw: W / 2 + over, y0: 0, y1: H + 0.3 * IN, zf: D / 2 + over }));   // clearFoliage keeps needles off the front
};

/* ---------------- Paw ornaments ---------------- */
BUILD.paws = (r, id) => {
  const list = [];
  if (r.kind === 'hoop') {   // 6" embroidery hoop painted gold, ivory Aida, black glitter paw, hand-tied dark red velvet bow
    const Rr = r.d / 2 * IN, tube = 0.3 * IN, top = Rr + 1.5 * IN;
    const ring = new THREE.TorusGeometry(Rr, tube, 10, 72); ring.scale(1, 1, 1.4);
    const face = new THREE.CircleGeometry(Rr - tube * 0.5, 64);
    const clasp = mergeGeometries([new THREE.BoxGeometry(0.55 * IN, 0.6 * IN, 0.75 * IN).translate(0, Rr + 0.25 * IN, 0).toNonIndexed(), new THREE.CylinderGeometry(0.13 * IN, 0.13 * IN, 1.1 * IN, 10).rotateZ(Math.PI / 2).translate(0, Rr + 0.45 * IN, 0).toNonIndexed()]);
    // broad velvet loops turned to face out (open 0.15), about 1.7x the disc wide, as on board_paw.jpg (LO-7)
    const bow = bowGeo({ ribbon: 1.5, span: Math.max(r.bow || 9, 10), tail: 8, loops: 2, uLen: 3, seed: 31, open: 0.15, flare: 0.45, loopTilt: 0.3 }); bow.translate(0, Rr + 1.3 * IN, 0.45 * IN);
    // the back is finished with a black felt circle (render key back: 'felt'), so from behind it is not a mirrored paw
    const backDisc = new THREE.CircleGeometry(Rr - tube * 0.3, 48); backDisc.rotateY(Math.PI); backDisc.translate(0, 0, -tube * 0.9);
    [ring, face, clasp, bow, backDisc].forEach(g => g.translate(0, -top, 0));
    face.translate(0, 0, tube * 0.15);
    const faceTex = canvasTex(512, 512, (g, w) => {
      g.fillStyle = r.face || '#e8dcc0'; g.fillRect(0, 0, w, w);
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
    list.forEach(l => HERO_BOX.push({ g: TARGET, p: l.p, rot: l.rot, hw: Rr + tube, y0: -top - Rr - tube, y1: -top + Rr + 2 * IN, zf: tube * 0.8 }));
    // the black glitter card paw sparkles: roughness/metalness and a glitter normal map inside the paw only, matte Aida round it
    const pawPx = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; drawPaw(c.getContext('2d'), 256, 512 * 0.53, 512 * 0.66, '#fff'); return c.getContext('2d').getImageData(0, 0, 512, 512).data; })();
    const gr = rng(515), pxTex = fill => canvasTex(512, 512, (g, w) => { const im = g.createImageData(w, w); for (let i = 0; i < w * w; i++) fill(im.data, i * 4, pawPx[i * 4 + 3] > 127); g.putImageData(im, 0, 0); }, { srgb: false, clamp: true });
    const rmTex = pxTex((d, o, inPaw) => { const sp = gr() < 0.3; d[o] = 0; d[o + 1] = inPaw ? (sp ? 25 : 90 + gr() * 60) : 235; d[o + 2] = inPaw ? (sp ? 230 : 140 + gr() * 50) : 0; d[o + 3] = 255; });   // G roughness, B metalness
    const nTex = pxTex((d, o, inPaw) => { const a = gr() * 6.283, k = inPaw && gr() < 0.6 ? gr() * 0.8 : 0; d[o] = 128 + Math.cos(a) * k * 127; d[o + 1] = 128 + Math.sin(a) * k * 127; d[o + 2] = 255 * Math.sqrt(1 - k * k * 0.5); d[o + 3] = 255; });
    instanced(face, mat(id, THREE.MeshStandardMaterial, { map: faceTex, roughness: 1, metalness: 1, roughnessMap: rmTex, metalnessMap: rmTex, normalMap: nTex, normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 1 }), list.map(l => ({ ...l, noMark: true })), id);
    const feltBack = r.back === 'felt' ? mat(id, THREE.MeshStandardMaterial, { color: 0x161412, roughness: 1, map: canvasTex(128, 128, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); noise(g, w, w, 2500, 0.25, ['#999', '#ddd']); }) })
                                       : mat(id, THREE.MeshStandardMaterial, { color: 0xcdb48a, roughness: 0.95 });   // plain backing otherwise
    instanced(backDisc, feltBack, list.map(l => ({ ...l, noMark: true })), id);
    instanced(clasp, mat(id, THREE.MeshStandardMaterial, { color: 0xb8954a, metalness: 1, roughness: 0.35 }), list.map(l => ({ ...l, noMark: true })), id);
    // the gold cord: a doubled loop through the brass screw eye, rising behind the bow into the branch (board_paw.jpg)
    const eye = (Rr + 0.55 * IN - top) / IN;
    instanced(hangerGeo(1.6, 1.1, 0.06, [[-0.08, eye, -0.05], [0.08, eye, -0.05]]), goldCord(), list.map(l => ({ ...l, noMark: true })), null, { cast: false });
    instanced(bow, velvet(id, 0x5a0a14), list.map(l => ({ ...l, noMark: true })), id);
  } else {                   // 4" painted wood rounds with a mini velvet bow (the earlier design)
    const h = 4.3 * IN, geo = new THREE.PlaneGeometry(h * CUT.paw_disc.w / CUT.paw_disc.h, h); geo.translate(0, -h / 2, 0);
    for (let i = 0; i < r.n; i++) { const { p } = spot(h * 1.1, Y0 + 0.3, YTOP - 0.5, 0.99); list.push({ p, rot: new THREE.Euler(R(-0.1, 0.05), faceY(p) + R(-0.35, 0.35), R(-0.12, 0.12)) }); }
    instanced(geo, mat(id, THREE.MeshStandardMaterial, { map: photoTex('paw_disc'), alphaTest: 0.2, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.65 }), list, id);
    instanced(bowGeo({ ribbon: 1, span: 3.5, tail: 2.5, seed: 11 }), velvet('mini_bows'), list.map(({ p, rot }) => ({ p: p.clone().add(new THREE.Vector3(0, 0.1 * IN, 0)).addScaledVector(new THREE.Vector3(Math.sin(rot.y), 0, Math.cos(rot.y)), 0.012), rot })), 'mini_bows');
  }
};

/* ---------------- Bone ornaments ---------------- */
// A chunky dog-bone outline (scene units): a straight shaft and FOUR clearly separate round lobes, two at each end,
// with a notch between them (never one bulb per end). L = length, shaftRatio = shaft height / L, spanRatio = end
// height (lobe to lobe) / L. Lobe radius 0.27 x span, lobe centres 0.23 x span off the axis (so they overlap by
// less than a radius and the notch reads), as on board_bone.jpg and template page 4.
function boneShape(L, shaftRatio = 0.27, spanRatio = 0.53) {
  const S = spanRatio * L, r = 0.27 * S, yc = 0.23 * S, sh = Math.min(shaftRatio * L, 2 * (yc + r * 0.55)) / 2, xc = L / 2 - r;
  const xj = xc - Math.sqrt(Math.max(1e-6, r * r - (sh - yc) * (sh - yc))), xn = xc + Math.sqrt(Math.max(1e-6, r * r - yc * yc));
  const pts = [], arc = (cx, cy, a0, a1) => { let b = a1; while (b > a0) b -= Math.PI * 2; const n = 28; for (let i = 0; i <= n; i++) { const a = a0 + (b - a0) * i / n; pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); } };   // clockwise from a0 to a1
  const ang = (x, y, cx, cy) => Math.atan2(y - cy, x - cx);
  arc(xc, yc, ang(xj, sh, xc, yc), ang(xn, 0, xc, yc));        // top-right lobe: shaft top -> over the end -> notch
  arc(xc, -yc, ang(xn, 0, xc, -yc), ang(xj, -sh, xc, -yc));    // bottom-right lobe: notch -> under -> shaft bottom
  arc(-xc, -yc, ang(-xj, -sh, -xc, -yc), ang(-xn, 0, -xc, -yc)); // bottom-left lobe
  arc(-xc, yc, ang(-xn, 0, -xc, yc), ang(-xj, sh, -xc, yc));   // top-left lobe, back to the shaft top
  const shape = new THREE.Shape(pts); shape.userData = { xc, yc, r }; return shape;
}
function boneGeo(L, shaftRatio, spanRatio, thick, bevel) {
  const shp = boneShape(L, shaftRatio, spanRatio);
  const g = new THREE.ExtrudeGeometry(shp, { depth: thick, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 24 });
  g.translate(0, 0, -thick / 2); g.computeVertexNormals(); g.userData = shp.userData; return g;
}
// dry-brushed clay: burnt sienna caught on the edges and crevices (where the face turns away from the front)
function dryBrush(g, cream, sienna, k = 0.6) {
  const n = g.attributes.normal, col = new Float32Array(n.count * 3), a = new THREE.Color(cream), b = new THREE.Color(sienna), c = new THREE.Color();
  for (let i = 0; i < n.count; i++) { const t = Math.pow(1 - Math.abs(n.getZ(i)), 2) * k; c.copy(a).lerp(b, t); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
BUILD.bones = (r, id) => {
  const Lin = r.len || r.l || 9, L = Lin * IN, thick = (r.thick || (r.kind === 'fleece' ? 1.6 : 1)) * IN;
  const geo = boneGeo(L, r.shaft_ratio || 0.27, r.span_ratio || 0.53, thick, Math.min(0.12 * IN, thick * 0.2));
  const m = r.kind === 'fleece' ? mat(id, THREE.MeshStandardMaterial, { map: sherpaTex, bumpMap: sherpaTex, bumpScale: 2, roughness: 1 })
                                : mat(id, THREE.MeshPhysicalMaterial, { vertexColors: true, roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  if (r.kind !== 'fleece') dryBrush(geo, 0xEBDAB6, 0x8a4a24, 0.6);
  const list = [];
  for (let i = 0; i < r.n; i++) { const { p } = i < 2 ? spotFront(L, 1.8, 4.8, 1.03, i ? 1.2 : 0.45) : spot(L, Y0 + 0.3, YTOP - 0.6, 1.03); const zr = R(-0.22, 0.22); list.push({ p, rot: new THREE.Euler(0.05 + R(-0.15, 0.15) * 0.2, faceY(p) + R(-0.3, 0.3), zr * 0.2) }); }   // hangs level from its two cords
  instanced(geo, m, list, id);
  if ((r.hang || 'two_cord') === 'two_cord') {   // a gold cord glued into each top lobe, meeting in a V over the bone and hooked into the branch behind
    const { xc, yc, r: lr } = geo.userData, apex = new THREE.Vector3(0, yc + lr + Math.min(3.2, Lin * 0.4) * IN, -1.1 * IN);
    const cords = [-1, 1].map(sg => { const a = new THREE.Vector3(sg * xc * 0.92, yc + lr * 0.8, 0), mid = a.clone().lerp(apex, 0.5); mid.x += sg * 0.15 * IN; mid.y -= 0.25 * IN;
      return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, apex), 12, 0.05 * IN, 5, false).toNonIndexed(); });
    instanced(mergeGeometries(cords), goldCord(), list.map(l => ({ ...l, noMark: true })), null);
  }
};

/* ---------------- Baubles: what each pack holds, at its listed size ---------------- */
const SPH = new THREE.SphereGeometry(1, 40, 24);
const capGeo = (() => { const c = new THREE.CylinderGeometry(0.2, 0.22, 0.22, 16); c.translate(0, 1.0, 0); const l = new THREE.TorusGeometry(0.08, 0.02, 6, 12); l.translate(0, 1.16, 0); return mergeGeometries([c.toNonIndexed(), l.toNonIndexed()]); })();
const capMat = new THREE.MeshStandardMaterial({ color: 0xcaa25a, metalness: 1, roughness: 0.28, envMapIntensity: 1.2 });
const glitterNormal = canvasTex(512, 512, (g, w) => { const im = g.createImageData(w, w); for (let i = 0; i < w * w; i++) { const a = Math.random() * Math.PI * 2, s = Math.random() < 0.6 ? Math.random() * 0.9 : 0; im.data[i * 4] = 128 + Math.cos(a) * s * 127; im.data[i * 4 + 1] = 128 + Math.sin(a) * s * 127; im.data[i * 4 + 2] = 255 * Math.sqrt(1 - s * s * 0.5); im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: [5, 3], srgb: false });
const glitterRough = canvasTex(256, 256, (g, w) => { const im = g.createImageData(w, w); for (let i = 0; i < w * w; i++) { const v = Math.random() < 0.35 ? 20 : 150 + Math.random() * 90; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: [5, 3], srgb: false });
const finish = {
  // shiny = lacquered glass: a coloured mirror under a clear coat, so the bulb glints on top stay white-hot. Metalness 0.85,
  // not 1: a little diffuse lacquer keeps the body crimson where it reflects the dark room
  shiny: () => ({ color: 0xffffff, metalness: 0.85, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 }),
  mirror: () => ({ color: 0xffffff, metalness: 1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }),
  matte: () => ({ color: 0xffffff, metalness: 0.35, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 0.3 }),
  glitter: () => ({ color: 0xffffff, metalness: 0.8, roughness: 0.42, roughnessMap: glitterRough, normalMap: glitterNormal, normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 1.1 }),
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
  baubles_rgg: () => (SZ('baubles_rgg').d_mix || [[2.4, 32], [1.6, 36], [1.2, 32]]).flatMap(([d, n]) => Array.from({ length: n }, () => ({ d, c: pickOne(SZ('baubles_rgg').palette || ['#b8121f', '#b8121f', '#9e0f1c', '#d7a64a', '#c9a14a']), f: pickOne(['shiny', 'shiny', 'glitter', 'matte']) }))),   // the pack as now chosen: red and gold only
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
const BDEPTH = rng(7331);   // ball depth stream (separate from rand(), the placement stream)
function balls(id, list, spots) {   // list: [{ d (in), c, f }]; big first so they get the best spots
  const groups = {};
  list.forEach(b => {
    const r = b.d / 2 * IN, d0 = b.d >= 3.9 ? 0.93 : 0.9, p = spot(r * 2.2, Y0 + 0.25 + r, YTOP - 0.3, d0).p.clone();   // a copy: the spot itself stays in placed[]
    // depth: smooth glossy balls ride the tips, sequin/glitter and small balls are tucked deeper and lit by the bulb glow
    // (LD5, R9). Drawn from BDEPTH, so spot() and rand() run exactly as before and every later piece lands where it did.
    const u = BDEPTH(), dep = b.f === 'shiny' || b.f === 'mirror' ? 0.86 + 0.08 * u : b.f === 'glitter' || b.f.startsWith('tex:') ? (b.d >= 3.9 ? 0.8 + 0.1 * u : 0.76 + 0.16 * u) : 0.74 + 0.21 * u;
    const rr = Math.hypot(p.x, p.z), rn = (rr - 0.02) * dep / d0 + 0.02; p.x *= rn / rr; p.z *= rn / rr;
    const rx = R(-0.2, 0.2), ry = R(0, 6.28), rz = R(-0.2, 0.2), yawOnly = b.f === 'glitter' || b.f.startsWith('tex:');   // stripes and sequin rows stay square to the cap
    (groups[b.f] ||= []).push({ p, s: r, c: b.c, rot: new THREE.Euler(yawOnly ? 0 : rx, ry, yawOnly ? 0 : rz) }); spots.push({ p, s: r }); });
  Object.entries(groups).forEach(([f, l]) => {
    const tex = f.startsWith('tex:') ? f.slice(4) : null;
    const m = tex ? mat(id, THREE.MeshPhysicalMaterial, { map: PATTERN[tex], metalnessMap: PATTERN_M[tex], metalness: 1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, normalMap: glitterNormal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.2 })
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
  // a gold wire hook from each cap's loop up into the branch behind (one draw call)
  instanced(hangerGeo(1.3, 0.9, 0.022, [[0, 0, 0]], 8), capMat, spots.map(b => ({ p: b.p.clone().add(new THREE.Vector3(0, b.s * 1.2, 0)), rot: new THREE.Euler(0, faceY(b.p), 0), noMark: true })), null, { cast: false });
};

/* ---------------- Tartan ribbon: cascades with poufs, and big hand-tied bows ---------------- */
BUILD.ribbon = r => {
  const m = tartanMat('tartan_ribbon');
  for (let k = 0; k < r.cascades; k++) {
    const th0 = k * Math.PI * 2 / r.cascades + 0.25, pts = [], nrm = [];
    for (let i = 0; i <= 320; i++) {
      const t = i / 320, y = YTOP - 0.55 - t * (YTOP - Y0 - 0.55), th = th0 + 0.5 * t + 0.04 * Math.sin(t * 13 + k);
      const ph = t * (r.poufs || 4.5) + k * 0.37, bulge = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 2.2);
      const rr = rAt(y) * 0.95 + 0.02 + 0.11 * bulge * (0.5 + rAt(y) / RB * 0.5), tw = 0.5 * Math.sin(ph * Math.PI * 2 + 1.2);
      const rad = new THREE.Vector3(Math.cos(th), 0.25 + bulge * 0.5 * Math.cos(ph * Math.PI * 2), Math.sin(th)).normalize(), tan = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      pts.push(new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr)); nrm.push(rad.multiplyScalar(Math.cos(tw)).addScaledVector(tan, Math.sin(tw)).normalize());
    }
    const mesh = new THREE.Mesh(strip(pts, nrm, 4 * IN, { uLen: 4 * IN }), m); mesh.castShadow = true; TARGET.add(mesh); tag(mesh, 'tartan_ribbon');
    addInstancePos('tartan_ribbon', pts[160]);
  }
  const B = SZ('big_bows'), list = [];
  for (let i = 0; i < r.bows; i++) { const { p } = spot((B.w || 11) * IN * 1.45, 1.6, 5.6, 1.0);   /* wide berth: the tails must not cover the pets and ornaments */ list.push({ p, rot: new THREE.Euler(R(-0.12, 0.12), faceY(p), R(-0.15, 0.15)) }); }
  instanced(bowGeo({ ribbon: 4, span: B.w || 11, tail: r.bow_tail || (B.h || 18) - 3, loops: r.bow_loops || 2, seed: 3 }), tartanMat('big_bows'), list, 'big_bows');
  if (r.velvet_bows) {   // solid deep-red velvet bows (9", 8" tails) wired between the tartan, mostly on the right side and lower half, as on the board
    const V = SZ('velvet_tree_bows'), vl = [];
    for (let i = 0; i < r.velvet_bows; i++) { const { p } = spot((V.w || 9) * IN * 1.3, 1.5, 4.6, 1.0); const th = faceY(p); vl.push({ p, rot: new THREE.Euler(R(-0.12, 0.12), th, R(-0.15, 0.15)) }); }
    instanced(bowGeo({ ribbon: V.ribbon || 1.5, span: V.w || 9, tail: (V.h || 12) - 4, loops: 2, uLen: 3, seed: 41, open: 0.2, flare: 0.4, loopTilt: 0.3 }), velvet('velvet_tree_bows', 0x5a0a14), vl, 'velvet_tree_bows');
  }
};

/* ---------------- Stockings and the gold, pine and berry picks ---------------- */
// Real products from their photos, as solid two-sided reliefs that stay put when you orbit (they never turn to
// the camera). Front: the product photo, shaped by a monocular depth map (data/depth/<cut>.png from
// build/make_depth.py) so muzzles, noses and paws stand out of a rounded body. Back: the same silhouette in
// plain fur colour (the photo blurred, so no mirrored face, eyes or scarf print), rounded like a stuffed body.
// Front and back meet in a vertical seam on the cutout's outline. One geometry per cutout and size, shared.
const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const RELIEF = {};   // cutout name -> Promise of { W, H, a: alpha 0..1 (1 px blur), f: inflation 0..1, dep: depth 0..1 | null }
function reliefField(name) {
  if (RELIEF[name]) return RELIEF[name];
  return (RELIEF[name] = Promise.all([loadImg(CUT[name].src), CUT[name].depth ? loadImg(CUT[name].depth) : null]).then(([img, dimg]) => {
    const W = 128, H = Math.max(8, Math.round(128 * img.height / img.width)), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.filter = 'blur(1px)'; g.drawImage(img, 0, 0, W, H); g.filter = 'none';   // blur the alpha 1 px: no stair-step outline
    const px = g.getImageData(0, 0, W, H).data, a = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) a[i] = px[i * 4 + 3] / 255;
    const d = new Float32Array(W * H), BIG = 1e6;
    for (let i = 0; i < W * H; i++) d[i] = a[i] >= 0.5 ? BIG : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : d[y * W + x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.41, at(x + 1, y - 1) + 1.41); }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.41, at(x - 1, y + 1) + 1.41); }
    let mx = 1; for (let i = 0; i < W * H; i++) mx = Math.max(mx, d[i]);
    const f = new Float32Array(W * H); for (let i = 0; i < W * H; i++) f[i] = Math.sqrt(d[i] / mx);   // rounded, like a stuffed toy
    let dep = null;
    if (dimg) { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const g2 = c2.getContext('2d'); g2.drawImage(dimg, 0, 0, W, H); const q = g2.getImageData(0, 0, W, H).data; dep = new Float32Array(W * H); for (let i = 0; i < W * H; i++) dep[i] = q[i * 4] / 255; }
    return { W, H, a, f, dep };
  }));
}
function sampleArr(F, arr, u, v) {
  const x = Math.min(F.W - 1.001, Math.max(0, u * (F.W - 1))), y = Math.min(F.H - 1.001, Math.max(0, (1 - v) * (F.H - 1))), x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
  const q = (a, b) => arr[b * F.W + a];
  return (q(x0, y0) * (1 - fx) + q(x0 + 1, y0) * fx) * (1 - fy) + (q(x0, y0 + 1) * (1 - fx) + q(x0 + 1, y0 + 1) * fx) * fy;
}
const sampleField = (F, u, v) => sampleArr(F, F.f, u, v);
// relief heights (scene units) for a field at (u, v); D = the piece's depth scale
const reliefZ = (F, u, v, D) => { const f = sampleField(F, u, v); return F.dep ? D * (0.35 * f + 0.9 * sampleArr(F, F.dep, u, v) * Math.min(1, 3 * f)) : D * f; };
const reliefZBack = (F, u, v, D) => -0.85 * D * Math.pow(sampleField(F, u, v), 0.7);
const GEO_CACHE = new Map();   // name|w|h|D -> Promise of { front, back, F }
function reliefGeo(name, w, h, D) {
  const k = [name, w.toFixed(4), h.toFixed(4), D.toFixed(4)].join('|');
  if (GEO_CACHE.has(k)) return GEO_CACHE.get(k);
  const pr = reliefField(name).then(F => {
    const nx = LOW ? 56 : 80, ny = Math.max(8, Math.round(nx * h / w)), N = (nx + 1) * (ny + 1);
    const U = new Float32Array(N), V = new Float32Array(N), A = new Float32Array(N), id = (i, j) => j * (nx + 1) + i;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const n = id(i, j); U[n] = i / nx; V[n] = j / ny; A[n] = sampleArr(F, F.a, U[n], V[n]); }
    const inside = n => A[n] >= 0.5, idx = [], used = new Uint8Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
      [[a, b, c], [a, c, d]].forEach(t => { if (t.some(inside)) { idx.push(...t); t.forEach(n => { used[n] = 1; }); } });   // drop triangles wholly outside the mask
    }
    // snap each outside vertex onto the outline (alpha 0.5), found by bisection toward its inside neighbours,
    // so the front and back meet in a vertical seam instead of a slanted, torn fin
    // The texture is sampled a little inside the outline (where alpha >= 0.92), so the steep rim shows the
    // product's own colour, never the cutout's dark fringe or a see-through edge: the geometry is the silhouette.
    const su = U.slice(), sv = V.slice(), tu = U.slice(), tv = V.slice(), seam = new Uint8Array(N);
    const cross = (n, m, thr) => { let lo = 0, hi = 1; for (let it = 0; it < 7; it++) { const t = (lo + hi) / 2; if (sampleArr(F, F.a, U[n] + (U[m] - U[n]) * t, V[n] + (V[m] - V[n]) * t) >= thr) hi = t; else lo = t; } return hi; };
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const n = id(i, j); if (!used[n] || inside(n)) continue;
      let cu = 0, cv = 0, ku = 0, kv = 0, cn = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj; if ((!di && !dj) || ii < 0 || jj < 0 || ii > nx || jj > ny) continue;
        const m = id(ii, jj); if (!inside(m)) continue;
        const t = cross(n, m, 0.5), t2 = Math.max(t, cross(n, m, 0.92));   // 0 = this (outside) vertex, 1 = the inside neighbour
        cu += U[n] + (U[m] - U[n]) * t; cv += V[n] + (V[m] - V[n]) * t; ku += U[n] + (U[m] - U[n]) * t2; kv += V[n] + (V[m] - V[n]) * t2; cn++;
      }
      if (cn) { su[n] = cu / cn; sv[n] = cv / cn; tu[n] = ku / cn; tv[n] = kv / cn; seam[n] = 1; }
    }
    const mk = back => {
      const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2);
      for (let n = 0; n < N; n++) {
        const u = su[n], v = sv[n]; pos[n * 3] = (u - 0.5) * w; pos[n * 3 + 1] = (v - 0.5) * h;
        pos[n * 3 + 2] = seam[n] || !inside(n) ? 0 : back ? reliefZBack(F, u, v, D) : reliefZ(F, u, v, D);
        uv[n * 2] = seam[n] ? tu[n] : u; uv[n * 2 + 1] = seam[n] ? tv[n] : v;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const ix = back ? idx.slice() : idx; if (back) for (let t = 0; t < ix.length; t += 3) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; }
      g.setIndex(ix); g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
      const nz = g.attributes.normal;
      for (let n = 0; n < N; n++) if (seam[n]) { const ex = (su[n] - tu[n]) * w, ey = (sv[n] - tv[n]) * h, l = Math.hypot(ex, ey); if (l > 1e-6) nz.setXYZ(n, ex / l, ey / l, 0); }   // the seam faces straight out on both halves: no lighting crease
      const side = new Float32Array(N); for (let n = 0; n < N; n++) side[n] = 1 - Math.abs(nz.getZ(n));
      g.setAttribute('aSide', new THREE.BufferAttribute(side, 1)); return g;   // how steeply the surface turns away: the rim gets plain fur colour
    };
    return { front: mk(false), back: mk(true), F };
  });
  GEO_CACHE.set(k, pr); return pr;
}
// back of a relief: the cutout blurred into plain fur/knit colour, with the original alpha (no face or print)
const FUR = {};
function furTex(name) {
  if (FUR[name]) return FUR[name];
  const cv = document.createElement('canvas'); cv.width = cv.height = 4; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  loadImg(CUT[name].src).then(img => {
    const s = Math.min(1, 256 / Math.max(img.width, img.height)); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
    const g = cv.getContext('2d'); g.filter = 'blur(' + Math.round(cv.width / 22) + 'px)'; g.drawImage(img, 0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
    g.filter = 'none'; g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0, cv.width, cv.height); t.dispose(); t.needsUpdate = true;
  });
  return (FUR[name] = t);
}
// de-light the photo: the product photos carry their own studio light, so flatten it a little and let the scene light them
// The rim (where the relief turns side-on) takes the blurred fur colour instead of the photo, which would smear there.
const delight = (m, fur, tint) => {
  m.onBeforeCompile = sh => {
    sh.uniforms.furMap = { value: fur }; sh.uniforms.furTint = { value: tint };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSide;\nvarying float vSide;').replace('#include <uv_vertex>', '#include <uv_vertex>\n  vSide = aSide;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D furMap;\nuniform vec3 furTint;\nvarying float vSide;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(furMap, vMapUv).rgb * furTint, smoothstep(0.45, 0.85, vSide));\n  diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.15));');
  };
  m.customProgramCacheKey = () => 'photoRelief'; return m;
};
const CARD_MATS = {};
function cardMats(name, id, tex) {
  const k = name + '|' + id + '|' + (tex ? tex.uuid : '');
  return CARD_MATS[k] ||= {
    // the relief geometry follows the outline, so the edge is geometry (antialiased by MSAA), not an alpha cut;
    // a low alphaTest only trims what a coarse grid cell could still carry past the outline
    mF: delight(mat(id, THREE.MeshStandardMaterial, { map: tex || photoTex(name), color: 0xffe6cc, alphaTest: 0.06, roughness: 0.92, envMapIntensity: 0.3 }), furTex(name), new THREE.Color(0xd9c8b4)),
    mB: delight(mat(id, THREE.MeshStandardMaterial, { map: furTex(name), color: 0xd9c8b4, alphaTest: 0.06, roughness: 0.97, envMapIntensity: 0.25 }), furTex(name), new THREE.Color(0xd9c8b4)),
  };
}
const YAW = rng(5150);   // natural yaw/tilt jitter: its own stream, so the placement stream (rand) and every placement stay as they were
const yawJ = a => (YAW() * 2 - 1) * a;
const cards = [], RELIEF_READY = [];
function photoCard(name, id, heightIn, pos, { anchor = 'bottom', mark = true, depth = 0.3, ry = null, tex = null, tilt = 0, hero = false } = {}) {
  const c = CUT[name], h = heightIn * IN, w = h * c.w / c.h, dy = anchor === 'top' ? -h / 2 : anchor === 'center' ? 0 : h / 2, D = Math.min(w, h) * depth;
  const { mF, mB } = cardMats(name, id, tex);
  const flat = new THREE.PlaneGeometry(w, h); flat.setAttribute('aSide', new THREE.Float32BufferAttribute(new Float32Array(4), 1));   // until the relief is ready
  const grp = new THREE.Group(); const meshes = [new THREE.Mesh(flat, mF), new THREE.Mesh(flat, mB)];
  meshes.forEach(m => { m.position.y = dy; m.castShadow = true; m.receiveShadow = true; m.userData.itemId = id; pickables.push(m); grp.add(m); });
  grp.position.copy(pos);
  grp.rotation.y = ry ?? ((Math.hypot(pos.x, pos.z) > 0.25 && pos.y > 0.9) ? faceY(pos) + yawJ(0.35) : Math.atan2(-pos.x * 0.15, 1));   // on the tree: face out from the trunk, give or take 20 degrees
  grp.rotation.order = 'YXZ'; grp.rotation.x = tilt;   // tilt about the piece's own left-right axis
  grp.userData.relief = { name, w, h, D, dy, F: null, hero };
  TARGET.add(grp); cards.push(grp);
  RELIEF_READY.push(reliefGeo(name, w, h, D).then(G => { meshes[0].geometry = G.front; meshes[1].geometry = G.back; grp.userData.relief.F = G.F; flat.dispose(); renderer.shadowMap.needsUpdate = true; }));
  if (mark) addInstancePos(id, pos.clone().add(new THREE.Vector3(0, dy, 0)));
  return grp;
}
function updateCards() {}   // pieces never turn to face the camera
// knit stockings, with a small black felt paw on each cuff when the option says so (render key stockings.paws)
const STOCK_TEX = {};
function stockPawTex(name) {
  if (STOCK_TEX[name]) return STOCK_TEX[name];
  const c = CUT[name], cv = document.createElement('canvas'); cv.width = c.w; cv.height = c.h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  loadImg(c.src).then(img => { const g = cv.getContext('2d'); g.drawImage(img, 0, 0); const [cx, cy, s] = c.cuff || [0.45, 0.33, 0.2];
    g.globalCompositeOperation = 'source-atop'; drawPaw(g, cx * c.w, cy * c.h, Math.min(s, 0.16) * c.h * 0.62, '#151313', -0.15); t.needsUpdate = true; });
  return (STOCK_TEX[name] = t);
}
const YARN = { stock_red: 0x8e1420, stock_green: 0x1d4a2c, stock_cream: 0xe6dcc6 };
BUILD.stockings = r => { const loops = []; ['stock_red', 'stock_green', 'stock_cream'].forEach(n => { for (let i = 0; i < r.n / 3; i++) { const { p } = spot(SZ('stockings').h * IN, 1.4, 5.5, 1.0);
  const hIn = (SZ('stockings').h || 4.3) * 1.25, D = Math.min(hIn * CUT[n].w / CUT[n].h, hIn) * IN * 0.22, th = faceY(p);   // hung on the branch tips, in front of the needles
  const at = p.clone().add(new THREE.Vector3(Math.sin(th), 0, Math.cos(th)).multiplyScalar(0.6 * D + 1.2 * IN));
  const g = photoCard(n, 'stockings', hIn, at, { anchor: 'top', depth: 0.22, ry: th + yawJ(0.4), tilt: 0.05, tex: r.paws ? stockPawTex(n) : null, hero: true });
  loops.push({ p: at.clone().add(new THREE.Vector3(0, -0.15 * IN, 0)), rot: new THREE.Euler(0, g.rotation.y, 0), c: YARN[n], noMark: true }); } });   // the knit hanging loop, over a branch behind
  instanced(hangerGeo(1.3, 1.6, 0.07, [[-0.25, 0, -0.1], [0.25, 0, -0.1]], 8), mat('stockings', THREE.MeshStandardMaterial, { color: 0xffffff, roughness: 1 }), loops, null, { cast: false }); };
// Shared helpers for small instanced parts: an orientation from an "up" axis (and an optional facing), and
// a quaternion -> Euler for instanced() lists.
const _UP = new THREE.Vector3(0, 1, 0);
function eulerFromAxes(up, face = null) {   // local +y along `up`; local +z as close to `face` as possible
  const y = up.clone().normalize(); let z = face ? face.clone().addScaledVector(y, -face.dot(y)) : null;
  if (!z || z.lengthSq() < 1e-6) return new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(_UP, y));
  z.normalize(); const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const STEM_GEO = (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); g.translate(0, 0.5, 0); return g; })();   // unit stem from 0 to +y
const stemItem = (a, b, rad) => { const d = b.clone().sub(a), L = d.length(); return { p: a.clone(), rot: eulerFromAxes(d), sv: new THREE.Vector3(rad, L, rad), noMark: true }; };
// a gold glitter lace leaf (the gold_picks product): pointed, serrated, 1 unit long along +y, slightly cupped
const LEAF_GEO = (() => {
  const s = new THREE.Shape(); s.moveTo(0, 0);
  const n = 7, R2 = [];
  for (let i = 1; i <= n; i++) { const t = i / (n + 1), w = 0.26 * Math.sin(Math.PI * Math.pow(t, 0.8)); R2.push([w, t]); }
  R2.forEach(([w, t], i) => { s.lineTo(w * 0.78, t - 0.05); s.lineTo(w, t); });
  s.lineTo(0, 1); R2.slice().reverse().forEach(([w, t]) => { s.lineTo(-w, t); s.lineTo(-w * 0.78, t - 0.05); }); s.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(s, 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -1.1 * x * x + 0.12 * Math.sin(y * Math.PI)); }   // cupped along the midrib, arched
  g.computeVertexNormals(); return g;
})();
// a small glitter poinsettia: two rings of 5 pointed petals round a cluster of beads
const FLOWER_GEO = (() => {
  const parts = [];
  [[0, 1, 0.12], [Math.PI / 5, 0.72, 0.2]].forEach(([a0, len, lift]) => { for (let k = 0; k < 5; k++) { const g = LEAF_GEO.clone(); g.scale(0.8, len, 0.8); g.rotateX(-Math.PI / 2 + lift); g.rotateY(a0 + k * Math.PI * 2 / 5); parts.push(g); } });
  for (let k = 0; k < 7; k++) { const a = k * 2.4, rr = k ? 0.09 : 0; parts.push(new THREE.SphereGeometry(0.06, 8, 6).translate(Math.cos(a) * rr, 0.06, Math.sin(a) * rr)); }
  return mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
})();
const SPRAY = rng(4242);   // leaves and flowers on the gold picks: their own stream, so rand() and every placement stay as they were
const sJ = a => (SPRAY() * 2 - 1) * a;
function sprays(id, n, color, stemsPer, beadIn, lenIn) {   // the gold glitter picks: wire stems with bead sprays, lace leaves and a small poinsettia
  const beads = [], stems = [], leaves = [], flowers = [], L = lenIn * IN;
  const gm = mat(id, THREE.MeshStandardMaterial, { color, metalness: 0.85, roughness: 0.35, roughnessMap: glitterRough, normalMap: glitterNormal, side: THREE.DoubleSide });
  for (let i = 0; i < n; i++) {
    const { p, th } = spot(L * 0.5, 1.4, 6.3, 0.86), out = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    const base = p.clone().addScaledVector(out, -1.5 * IN);   // the pick's stem is pushed in among the branches
    for (let k = 0; k < stemsPer; k++) {
      const dir = new THREE.Vector3(Math.cos(th + R(-0.5, 0.5)), R(0, 0.8), Math.sin(th + R(-0.5, 0.5))).normalize();
      stems.push(stemItem(base, p.clone().addScaledVector(dir, L * 0.98), 0.045 * IN));
      for (let b = 0; b < 9; b++) {
        const t = 0.55 + b / 9 * 0.45, bp = p.clone().addScaledVector(dir, L * t).add(new THREE.Vector3(R(-1, 1), R(-1, 1), R(-1, 1)).multiplyScalar(0.7 * IN));
        beads.push({ p: bp, s: beadIn / 2 * IN * R(0.8, 1.2), noMark: !(k === 0 && b === 3) });
        if (b % 3 === 1) stems.push(stemItem(p.clone().addScaledVector(dir, L * (t - 0.06)), bp, 0.02 * IN));   // a fine wire twig to each bead cluster
      }
      // two lace leaves along each stem, turned to face out of the tree
      for (let q = 0; q < 2; q++) {
        const t = 0.3 + 0.4 * SPRAY(), at = p.clone().addScaledVector(dir, L * t), side = new THREE.Vector3().crossVectors(dir, _UP).normalize().multiplyScalar(q ? -1 : 1);
        const ld = dir.clone().multiplyScalar(0.6).addScaledVector(side, 0.8).add(new THREE.Vector3(0, sJ(0.3), 0)).normalize();
        leaves.push({ p: at, rot: eulerFromAxes(ld, out.clone().add(new THREE.Vector3(sJ(0.4), 0.3, sJ(0.4)))), s: (2.4 + SPRAY() * 0.8) * IN, noMark: true });   // lace leaves about 2.5-3" long, as on the product
      }
    }
    const fd = out.clone().add(new THREE.Vector3(sJ(0.3), 0.35, sJ(0.3))).normalize();   // the flower faces out and a little up
    flowers.push({ p: p.clone().addScaledVector(out, L * 0.18), rot: eulerFromAxes(fd), s: (1.7 + SPRAY() * 0.3) * IN, noMark: true });
  }
  instanced(SPH, gm, beads, id);
  instanced(STEM_GEO, gm, stems, id);
  instanced(LEAF_GEO, gm, leaves, id);
  instanced(FLOWER_GEO, gm, flowers, id);
}
// The 24-pack of pine picks (data/img/pine_picks.jpg) mixes four heads: jingle bells, red berries, red-and-white
// mushrooms and plain cones, each with pinecones and a fan of pine sprigs. 4" tall x 3" wide, built as instanced geometry.
const PINECONE_GEO = (() => {   // a lathe with a sawtooth profile: overlapping scales, about 1 x 1.4 (scaled per instance)
  const pts = [], N = 64;
  for (let i = 0; i <= N; i++) { const t = i / N, egg = Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - 0.25 * t), saw = 1 - 0.22 * ((t * 9) % 1); pts.push(new THREE.Vector2(Math.max(0.001, 0.5 * egg * saw), t * 1.4)); }
  const g = new THREE.LatheGeometry(pts, 14), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), lo = new THREE.Color(0x2e1a0c), hi = new THREE.Color(0x9a6a3c);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)), ph = ((y / 1.4 * 9 + a / (Math.PI * 2) * 3) % 1 + 1) % 1;   // scales spiral round the cone
    const r = Math.hypot(p.getX(i), p.getZ(i)); p.setX(i, p.getX(i) * (1 + 0.12 * (1 - ph))); p.setZ(i, p.getZ(i) * (1 + 0.12 * (1 - ph)));
    c.copy(lo).lerp(hi, Math.pow(1 - ph, 1.5) * (r > 0.05 ? 1 : 0.3)); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); g.translate(0, -0.2, 0); return g;
})();
const MUSH_CAP = (() => { const g = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.62, 1); return g; })();
const MUSH_TEX = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#c8121c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fbf3e4'; for (let i = 0; i < 26; i++) { const x = (i * 97) % w, y = 12 + ((i * 53) % (h * 0.7)); g.beginPath(); g.ellipse(x, y, 7 + (i % 3) * 2, 5 + (i % 2) * 2, 0, 0, 6.28); g.fill(); } });
const BELL_GEO = (() => {   // a jingle bell: a sphere with a slot and a small loop
  const s = new THREE.SphereGeometry(1, 20, 14), p = s.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); if (y < -0.25 && Math.abs(x) < 0.12) p.setY(i, y * 0.8); }
  s.computeVertexNormals(); const loop = new THREE.TorusGeometry(0.22, 0.07, 6, 12).translate(0, 1.05, 0);
  return mergeGeometries([s.toNonIndexed(), loop.toNonIndexed()]);
})();
function pinePicks(id, n) {
  const PK = rng(8128), J = a => (PK() * 2 - 1) * a, cones = [], bells = [], berries = [], caps = [], mstems = [], sprigs = [], stems = [];
  for (let i = 0; i < n; i++) {
    const { p } = spot(0.35, 1.3, 5.8, 0.95), ry = faceY(p) + R(-0.6, 0.6);   // the same placement draws as the old photo picks
    const q = new THREE.Quaternion().setFromAxisAngle(_UP, ry), L = (x, y, z) => new THREE.Vector3(x, y, z).multiplyScalar(IN).applyQuaternion(q).add(p);
    const D = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).normalize(), out = D(0, 0, 1), head = i % 4;   // bells, berries, mushrooms, plain cones
    stems.push(stemItem(L(0, -0.4, -2.2), L(0, -0.2, 0.2), 0.1 * IN));   // the wired stem goes into the branch
    // 6 pine sprigs fanned up and out (the foliage needle card, a lighter green)
    for (let k = 0; k < 6; k++) { const a = -1.1 + k / 5 * 2.2 + J(0.15), len = (3.2 + PK() * 0.9) * IN;
      sprigs.push({ p: L(0, 0, 0), rot: eulerFromAxes(D(Math.sin(a) * 0.9, 0.35 + Math.cos(a) * 0.55, 0.55 + J(0.2)), out), sv: new THREE.Vector3(len * 0.75, len, len * 0.75), c: new THREE.Color(1.05, 1.15, 0.85), noMark: true }); }
    // pinecones hang below the head, tips down and out
    const nc = head === 3 ? 3 : 2;
    for (let k = 0; k < nc; k++) { const x = nc === 2 ? (k ? 0.55 : -0.6) : (k - 1) * 0.65, s = (head === 3 ? 1.05 : 0.95) * (0.9 + PK() * 0.2) * IN;
      cones.push({ p: L(x, -0.35 - (k % 2) * 0.2, 0.9), rot: eulerFromAxes(D(x * 0.5, -0.75, 0.6)), sv: new THREE.Vector3(s, s, s), noMark: k > 0 }); }
    if (head === 0) [-0.35, 0.35].forEach((x, k) => bells.push({ p: L(x, 0.45 + k * 0.15, 1.2), rot: eulerFromAxes(D(J(0.3), 1, 0.2)), s: 0.42 * IN, c: k ? 0xd4ae5c : 0xb3121d, noMark: true }));
    if (head === 1) for (let k = 0; k < 5; k++) { const a = k * 1.3; berries.push({ p: L(Math.cos(a) * 0.38, 0.45 + Math.sin(a) * 0.3, 1.25 + (k % 2) * 0.1), s: 0.24 * IN, noMark: true }); }
    if (head === 2) [[-0.3, 0.5, 0.55], [0.4, 0.3, 0.4]].forEach(([x, y, r]) => { const up = D(x * 0.8, 1, 0.5), base = L(x, y - 0.45, 1.1), top = base.clone().addScaledVector(up, 0.45 * IN);
      mstems.push(stemItem(base, top, 0.13 * IN)); caps.push({ p: top, rot: eulerFromAxes(up), sv: new THREE.Vector3(r, r, r).multiplyScalar(IN), noMark: true }); });
  }
  const sprigMat = NEEDLE_MAT;
  instanced(PINECONE_GEO, mat(id, THREE.MeshStandardMaterial, { vertexColors: true, roughness: 0.88 }), cones, id);
  instanced(STEM_GEO, mat(id, THREE.MeshStandardMaterial, { color: 0xffffff, roughness: 0.9 }), stems.map(m => ({ ...m, c: 0x6a4a2a })).concat(mstems.map(m => ({ ...m, c: 0xf2e6cc }))), id);
  instanced(NEEDLE_GEO, sprigMat, sprigs, null);
  if (bells.length) instanced(BELL_GEO, mat(id, THREE.MeshStandardMaterial, { color: 0xffffff, metalness: 0.9, roughness: 0.28 }), bells, id);
  if (berries.length) instanced(SPH, mat(id, THREE.MeshPhysicalMaterial, { color: 0xa50d16, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }), berries, id);
  if (caps.length) instanced(MUSH_CAP, mat(id, THREE.MeshPhysicalMaterial, { map: MUSH_TEX, roughness: 0.35, clearcoat: 0.6 }), caps, id);
}
BUILD.greens = r => {
  sprays('gold_picks', r.gold, 0xd4ad5c, 3, 0.4, 6);
  pinePicks('pine_picks', Math.round(r.pine * 2 / 3));
  if (r.berries) {   // glossy red berry clusters (0.6" berries on 7" stems): 7 berries on brown twigs from the cluster's stem
    const list = [], twigs = [], bd = (SZ('glossy_berries').berry_d || 0.6) * IN;
    for (let i = 0; i < r.berries; i++) {
      const { p, th } = spot(0.25, 1.3, 6.3, 0.97); const out = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
      const hub = p.clone().add(new THREE.Vector3(0, -0.3 * IN, 0)).addScaledVector(out, 0.01), root = hub.clone().addScaledVector(out, -2.2 * IN).add(new THREE.Vector3(0, -0.9 * IN, 0));
      twigs.push(stemItem(root, hub, 0.06 * IN));
      for (let k = 0; k < 7; k++) { const bp = p.clone().add(new THREE.Vector3(R(-1, 1) * 1.1 * IN, R(-0.6, 1.6) * IN, R(-1, 1) * 1.1 * IN)).addScaledVector(out, 0.03), s = bd / 2 * R(0.85, 1.1);
        list.push({ p: bp, s, noMark: k > 0 }); twigs.push(stemItem(hub, bp.clone().addScaledVector(bp.clone().sub(hub).normalize(), -s * 0.8), 0.035 * IN)); }
    }
    const bm = mat('glossy_berries', THREE.MeshPhysicalMaterial, { color: 0x9d0a12, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
    instanced(SPH, bm, list, 'glossy_berries');
    instanced(STEM_GEO, mat('glossy_berries', THREE.MeshStandardMaterial, { color: 0x4a2c1a, roughness: 0.85 }), twigs, 'glossy_berries');
  }
};

/* ---------------- Under the tree: wrapped gifts ---------------- */
// A wrapped moving box: paper-rounded edges (RoundedBox, 0.25" radius), the ribbon sitting 0.04" proud with soft edges,
// and a hand-tied bow standing up on the crossing (tilted back 0.3 rad, loops resting on the lid), its tails laid along
// the lid toward the front and hanging down the front face (board_gifts.jpg).
function giftBox([wi, di, hi], faceMat, ribbonMat, ribIn, x, z, ry, id, bow, oneWay = false) {
  const w = wi * IN, d = di * IN, h = hi * IN, g = new THREE.Group(), pr = 0.04 * IN;
  const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.25 * IN), faceMat); b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b);
  const rw = ribIn * IN;
  (oneWay ? [[rw, h + 2 * pr, d + 2 * pr]] : [[w + 2 * pr, h + 2 * pr, rw], [rw, h + 2 * pr, d + 2 * pr]]).forEach(([a, bb, c]) => { const rb = new THREE.Mesh(new RoundedBoxGeometry(a, bb, c, 2, 0.27 * IN), ribbonMat); rb.position.y = h / 2; rb.receiveShadow = true; g.add(rb); });
  g.position.set(x, 0, z); g.rotation.y = ry; TARGET.add(g); tag(g, id); addInstancePos(id, new THREE.Vector3(x, h * 0.7, z));
  contactShadow(x, z, w * 1.5, d * 1.5, ry, 0.7);
  if (bow) {
    const W = bow.ribbon * IN, top = h + pr, bg = new THREE.Group(); g.add(bg);
    const m = new THREE.Mesh(bow.geo, bow.mat); m.position.set(0, top + W * 0.62, 0); m.rotation.x = -0.3; m.castShadow = true; bg.add(m);
    [-1, 1].forEach(sg => {   // tails: from the knot down onto the lid, along it to the front edge, then down the front face
      const pts = [], nrm = [], k0 = new THREE.Vector3(sg * 0.1 * W, top + W * 0.45, 0.2 * W), lid = new THREE.Vector3(sg * 0.9 * IN, top + 0.02 * IN, 1.2 * IN), edge = new THREE.Vector3(sg * 1.7 * IN, top + 0.02 * IN, d / 2 + 0.05 * IN);
      const end = new THREE.Vector3(sg * 2.1 * IN, top - Math.min(h * 0.45, (bow.tail - 3) * IN), d / 2 + pr + 0.03 * IN);
      for (let i = 0; i <= 30; i++) { const t = i / 30;
        if (t < 0.25) { const u = t / 0.25; pts.push(k0.clone().lerp(lid, u).add(new THREE.Vector3(0, Math.sin(u * Math.PI) * 0.2 * W, 0))); nrm.push(new THREE.Vector3(0, u, 1 - u).normalize()); }
        else if (t < 0.55) { const u = (t - 0.25) / 0.3; pts.push(lid.clone().lerp(edge, u)); nrm.push(new THREE.Vector3(0, 1, 0)); }
        else { const u = (t - 0.55) / 0.45; pts.push(edge.clone().lerp(end, u).add(new THREE.Vector3(0, 0, Math.sin(u * Math.PI) * 0.05 * IN))); nrm.push(new THREE.Vector3(0, 1 - Math.min(1, u * 3), Math.min(1, u * 3)).normalize()); }
      }
      bg.add(new THREE.Mesh(strip(pts, nrm, W * 0.92, { uLen: bow.uLen * IN, notch: true, cup: 0.03 }), bow.mat));
    });
    tag(bg, bow.id);
  }
  return g;
}
const boxTex = (name, wi, hi) => photoTex(name, [+(wi / 8).toFixed(2), +(hi / 8).toFixed(2)]);
BUILD.gifts = () => {
  const B = SZ('gift_boxes').boxes || [[18, 11, 12], [16, 16, 16], [16, 16, 10], [18, 11, 7]];
  const tw = s => mat('tartan_wrap', THREE.MeshStandardMaterial, { map: boxTex('tx_tartan_wrap', s[0], s[2]), roughness: 0.42 });
  const kp = s => mat('paw_wrap', THREE.MeshStandardMaterial, { map: boxTex('tx_paw_wrap', s[0], s[2]), roughness: 0.85 });
  const cream = mat('burlap_ribbon', THREE.MeshStandardMaterial, { color: 0xcdb48a, roughness: 0.95 });
  const creamBow = { geo: bowGeo({ ribbon: 1.5, span: 10, tail: 6, uLen: 6, seed: 23, open: 0.25, loopTilt: 0.18, droop: 0.2, tails: false }), mat: ribbonMat('burlap_ribbon', 'tx_burlap15'), id: 'burlap_ribbon', ribbon: 1.5, tail: 6, uLen: 6 };
  // the four Canadian Tire moving boxes at their real sizes: tartan with cream ribbon (A, B, C), kraft paw paper with tartan ribbon (D)
  giftBox(B[0], tw(B[0]), cream, 1.5, -1.6, 1.05, 0.35, 'gift_boxes', creamBow);
  giftBox(B[1], tw(B[1]), cream, 1.5, -1.45, -0.7, 0.15, 'gift_boxes', creamBow);
  giftBox(B[2], tw(B[2]), cream, 1.5, 1.6, 0.25, -0.45, 'gift_boxes', creamBow);
  giftBox(B[3], kp(B[3]), tartanMat('tartan_ribbon'), 4, 0.95, 1.45, -0.2, 'gift_boxes', creamBow, true);
};
// Floor layout as on the board (LD9): the bone pillow front-centre-left with the bowl just to its right, in front of the
// gifts; the dog and cat pair stands to the right of the bowl, clear of the basket. [x, z, yaw]
const FLOOR_AT = { pillow: [-1.0, 3.0, 0.12], bowl: [-0.12, 3.08, 0.4], dog: [0.62, 2.62], cat: [1.18, 2.88] };
// a stuffed pillow from a 2D outline: a grid over the shape, raised by a rounded profile of the distance to the edge
// (front and back halves meeting in a seam on the outline), so the surface is smooth with no seams between parts
function pillowGeo(L, H, T) {
  const S = 0.6 * L * (H / (0.6 * L)), r = 0.27 * S, yc = 0.23 * S, sh = 0.18 * L, xc = L / 2 - r;   // bone outline: four lobes and a fat shaft (board_floor.jpg)
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const sdf = (x, y) => { let d = 1e9; [[xc, yc], [xc, -yc], [-xc, yc], [-xc, -yc]].forEach(([cx, cy]) => { d = smin(d, Math.hypot(x - cx, y - cy) - r, r * 0.5); });
    const qx = Math.abs(x) - xc, qy = Math.abs(y) - sh, box = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0); return smin(d, box, r * 0.6); };
  const nx = LOW ? 64 : 96, ny = Math.round(nx * H / L), m = 0.06 * L, x0 = -L / 2 - m, y0 = -H / 2 - m, dx = (L + 2 * m) / nx, dy = (H + 2 * m) / ny, N = (nx + 1) * (ny + 1), Rr = T * 1.15;
  const P = new Float32Array(N * 3), UV = new Float32Array(N * 2), inside = new Uint8Array(N), id = (i, j) => j * (nx + 1) + i;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    let x = x0 + i * dx, y = y0 + j * dy; const n = id(i, j), d = sdf(x, y); let z = 0;
    if (d < 0) { const k = Math.min(1, -d / Rr); z = T / 2 * Math.sqrt(1 - (1 - k) * (1 - k)) * (1 + 0.06 * Math.cos(x / L * Math.PI)); inside[n] = 1; }
    else { const e = 1e-4 * L, gx = (sdf(x + e, y) - sdf(x - e, y)) / (2 * e), gy = (sdf(x, y + e) - sdf(x, y - e)) / (2 * e), gl = Math.hypot(gx, gy) || 1; x -= gx / gl * d; y -= gy / gl * d; }   // onto the outline
    P.set([x, y, z], n * 3); UV.set([(x + L / 2) / L, (y + H / 2) / H], n * 2);
  }
  const idx = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1); [[a, b, c], [a, c, d]].forEach(t => { if (t.some(q => inside[q])) idx.push(...t); }); }
  const mk = sign => { const g = new THREE.BufferGeometry(), p = P.slice(); for (let n = 0; n < N; n++) p[n * 3 + 2] *= sign; g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UV.slice(), 2));
    const ix = idx.slice(); if (sign < 0) for (let t = 0; t < ix.length; t += 3) { const q = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = q; } g.setIndex(ix); g.computeVertexNormals(); return g; };
  return { front: mk(1), back: mk(-1) };
}
BUILD.floor = r => {
  if (r.pillow) {   // cream sherpa bone pillow, 15" x 9" x 3", with the black felt paw: a smooth stuffed bone (no lumpy spheres)
    const s = SZ('bone_pillow'); const L = (s.w || 15) * IN, H = (s.d || 9) * IN, T = (s.h || 3) * IN;
    const { front, back } = pillowGeo(L, H, T);
    const sr = rng(606), sherpa = (g, w, hh) => { g.fillStyle = '#e6ddcc'; g.fillRect(0, 0, w, hh); for (let i = 0; i < 7000; i++) { const x = sr() * w, y = sr() * hh, rr = 3 + sr() * 6; g.fillStyle = sr() < .5 ? '#f6f0e4' : '#cbbfa9'; g.beginPath(); g.arc(x, y, rr, 0, 6.28); g.fill(); } };
    const plain = canvasTex(1024, Math.round(1024 * H / L), sherpa, { clamp: true });
    const pawT = canvasTex(1024, Math.round(1024 * H / L), (g, w, hh) => { g.drawImage(plain.image, 0, 0); const px = w / (L / IN);
      g.globalAlpha = 0.35; drawPaw(g, w * 0.32 + 2, hh * 0.48 + 3, 3.7 * px, '#000'); g.globalAlpha = 1; drawPaw(g, w * 0.32, hh * 0.48, 3.7 * px, '#151413');   // felt paw, glued on (soft shadow at its edge)
      g.globalCompositeOperation = 'source-atop'; noise(g, w, hh, 3000, 0.08, ['#444', '#000']); }, { clamp: true });
    const m = (map) => mat('bone_pillow', THREE.MeshStandardMaterial, { map, bumpMap: plain, bumpScale: 3, roughness: 1, envMapIntensity: 0.3 });
    const g = new THREE.Group(); [new THREE.Mesh(front, m(pawT)), new THREE.Mesh(back, m(plain))].forEach(x => { x.castShadow = x.receiveShadow = true; g.add(x); });
    const P = FLOOR_AT.pillow; g.position.set(P[0], H * 0.47, P[1]); g.rotation.set(-0.18, P[2], 0.02); TARGET.add(g); tag(g, 'bone_pillow'); addInstancePos('bone_pillow', g.position);
    contactShadow(P[0], P[1] - 0.05, L * 1.3, T * 2.6, P[2], 0.8);
  }
  if (r.bowl && r.bowl_kind === 'steel') {   // Loving Pets Bella bowl: straight-sided deep red (merlot) shell, brushed steel inside, cream paw prints
    const s = SZ('bowl'); const rr = (s.w || 8.5) / 2 * IN, h = (s.h || 2.5) * IN;
    const shell = new THREE.LatheGeometry([[0, 0], [rr * 0.86, 0], [rr * 0.9, h * 0.04], [rr * 0.985, h * 0.9], [rr, h], [rr * 0.97, h * 1.02]].map(([x, y]) => new THREE.Vector2(x, y)), 72);
    const steel = new THREE.LatheGeometry([[rr * 0.965, h * 1.02], [rr * 0.93, h * 1.03], [rr * 0.84, h * 0.3], [rr * 0.78, h * 0.12], [0, h * 0.1]].map(([x, y]) => new THREE.Vector2(x, y)), 72);
    const paws = canvasTex(1024, 256, (g, w, hh) => { g.fillStyle = '#7d0f1a'; g.fillRect(0, 0, w, hh); noise(g, w, hh, 6000, 0.12, ['#a8202c', '#4a0710']);
      for (let k = 0; k < 6; k++) drawPaw(g, (k + 0.5) / 6 * w, hh * (k % 2 ? 0.42 : 0.6), hh * 0.32, '#efe3c8', (k % 2 ? 0.3 : -0.3)); });
    const brushed = canvasTex(256, 256, (g, w) => { g.fillStyle = '#9a9ea3'; g.fillRect(0, 0, w, w); for (let y = 0; y < w; y++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,40,45'},${Math.random() * 0.12})`; g.fillRect(0, y, w, 1); } }, { repeat: [4, 1] });
    const bowl = new THREE.Group();
    const mShell = new THREE.Mesh(shell, mat('bowl', THREE.MeshPhysicalMaterial, { map: paws, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15, side: THREE.DoubleSide }));
    const mSteel = new THREE.Mesh(steel, mat('bowl', THREE.MeshStandardMaterial, { map: brushed, metalness: 1, roughness: 0.32, envMapIntensity: 1.2, side: THREE.DoubleSide }));
    bowl.add(mShell, mSteel); bowl.position.set(FLOOR_AT.bowl[0], 0, FLOOR_AT.bowl[1]); bowl.rotation.y = FLOOR_AT.bowl[2]; bowl.traverse(o => { o.castShadow = o.receiveShadow = true; });
    TARGET.add(bowl); tag(bowl, 'bowl'); addInstancePos('bowl', new THREE.Vector3(FLOOR_AT.bowl[0], h, FLOOR_AT.bowl[1]));
    contactShadow(FLOOR_AT.bowl[0], FLOOR_AT.bowl[1], rr * 3, rr * 3, 0, 0.7);
  } else if (r.bowl) {     // red glazed bowl with white dots and two painted paws
    const s = SZ('bowl'); const rr = (s.w || 5.9) / 2 * IN, h = (s.h || 1.8) * IN;
    const prof = [[0, 0], [rr * 0.72, 0], [rr * 0.8, h * 0.06], [rr * 0.98, h * 0.85], [rr, h], [rr * 0.93, h], [rr * 0.76, h * 0.2], [0, h * 0.16]].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(prof, 64); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > h * 0.6) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + Math.abs(Math.sin(a * 6)) * h * 0.12 * ((y - h * 0.6) / (h * 0.4))); } }
    geo.computeVertexNormals();
    const dots = canvasTex(1024, 256, (g, w, hh) => { g.fillStyle = '#b5101c'; g.fillRect(0, 0, w, hh); g.fillStyle = '#fbf7ef'; for (let y = 40; y < hh; y += 90) for (let x = (y / 90) % 2 ? 60 : 0; x < w; x += 120) { g.beginPath(); g.arc(x, y, 14, 0, 6.28); g.fill(); } [w * 0.22, w * 0.72].forEach(x => { g.fillStyle = '#b5101c'; g.fillRect(x - 70, 20, 140, 200); drawPaw(g, x, 125, 120, '#fbf7ef'); }); });
    const bowl = new THREE.Mesh(geo, mat('bowl', THREE.MeshPhysicalMaterial, { map: dots, roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide }));
    bowl.position.set(FLOOR_AT.bowl[0], 0, FLOOR_AT.bowl[1]); bowl.castShadow = true; TARGET.add(bowl); tag(bowl, 'bowl'); addInstancePos('bowl', new THREE.Vector3(FLOOR_AT.bowl[0], h, FLOOR_AT.bowl[1]));
    contactShadow(FLOOR_AT.bowl[0], FLOOR_AT.bowl[1], rr * 3, rr * 3, 0, 0.7);
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
    // faux biscuits: flat bone biscuits (the same four-lobe outline as the clay bones, at the 2.7" cutter size),
    // stood on edge against the glass ring by ring, face out, round a crumpled kraft core, plus 12 piled on top (as the plan builds it)
    const bs = SZ('faux_treats'), bL = (bs.w || 2.7), bH = (bs.h || 1.08), bT = (bs.d || 0.25) * IN;
    const bgeo = boneGeo(bL * IN, 0.21, bH / bL, bT, 0.06 * IN); dryBrush(bgeo, 0xc8955a, 0x8a5a2c, 0.5);
    const ring = Math.floor(Math.PI * ((js.w || 7) - 0.4) / bL), rings = Math.floor(((js.h || 9.9) - 1.4) / (bH + 0.12));
    for (let i = 0; i < 150; i++) rand();   // the old scattered biscuits drew 150 placement numbers: keep the stream, so every piece after this lands where it did
    const list = [], tan = [0xffffff, 0xf0e2d2, 0xe2cdb6, 0xfff2e2], br = rng(77);   // tints on the baked tan (#c8955a to #a8703a overall) jar.updateMatrixWorld(true);
    const jarR = y => { const t = y / jh; return t < 0.12 ? jr * (0.85 + 1.25 * t) : t < 0.55 ? jr * (1 + 0.04 * (t - 0.12) / 0.43) : jr * (1.02 - 0.3 * (t - 0.55) / 0.29); };
    for (let k = 0; k < rings; k++) {
      const y = (0.35 + bH * 0.5) * IN + k * (bH + 0.12) * IN, rr = jarR(y) - bT * 0.8;
      for (let i = 0; i < ring; i++) { const a = (i + (k % 2) * 0.5) / ring * Math.PI * 2 + (br() - 0.5) * 0.1;
        list.push({ p: jar.localToWorld(new THREE.Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr)), rot: new THREE.Euler(0, ry + a, (br() - 0.5) * 0.12), c: tan[(br() * 4) | 0], noMark: !!(k + i) }); }
    }
    const topY = (0.35 + rings * (bH + 0.12)) * IN;
    for (let i = 0; i < 12; i++) { const a = br() * 6.28, rr = br() * jr * 0.55; list.push({ p: jar.localToWorld(new THREE.Vector3(Math.cos(a) * rr, topY + (i % 4) * 0.3 * IN, Math.sin(a) * rr)), rot: new THREE.Euler(-Math.PI / 2 + (br() - 0.5) * 0.9, br() * 6.28, (br() - 0.5) * 0.6), c: tan[(br() * 4) | 0], noMark: true }); }
    instanced(bgeo, mat('faux_treats', THREE.MeshStandardMaterial, { vertexColors: true, roughness: 0.85 }), list, 'faux_treats');
    const kraft = canvasTex(256, 256, (c2, w2) => { c2.fillStyle = '#a77a4c'; c2.fillRect(0, 0, w2, w2); for (let i = 0; i < 260; i++) { c2.strokeStyle = Math.random() < 0.5 ? 'rgba(70,45,20,.35)' : 'rgba(220,180,130,.3)'; c2.lineWidth = 1 + Math.random() * 2; c2.beginPath(); const x = Math.random() * w2, y = Math.random() * w2; c2.moveTo(x, y); c2.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60); c2.stroke(); } });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(jr * 0.72, jr * 0.75, topY - 0.3 * IN, 16, 6), mat('faux_treats', THREE.MeshStandardMaterial, { map: kraft, bumpMap: kraft, bumpScale: 3, roughness: 0.95 }));
    { const pp = core.geometry.attributes.position; for (let i = 0; i < pp.count; i++) { const k2 = 1 + 0.12 * Math.sin(pp.getY(i) * 90 + Math.atan2(pp.getZ(i), pp.getX(i)) * 5) * Math.cos(pp.getY(i) * 60); pp.setX(i, pp.getX(i) * k2); pp.setZ(i, pp.getZ(i) * k2); } core.geometry.computeVertexNormals(); }
    core.position.y = (topY - 0.3 * IN) / 2 + 0.3 * IN; jar.add(core);
    const jb = new THREE.Mesh(bowGeo({ ribbon: 1.5, span: 7, tail: 6, loops: 2, uLen: 3, seed: 33 }), velvet('velvet_ribbon', 0x5a0a14)); jb.position.copy(W(-bw * 0.18, bh * 0.45 + jh * 0.8, -bd * 0.1 + jr * 1.02)); jb.rotation.y = ry; TARGET.add(jb); tag(jb, 'jar');
  }
  const felt = canvasTex(256, 128, (c, w, hh2) => { c.fillStyle = '#b01322'; c.fillRect(0, 0, w, hh2); noise(c, w, hh2, 5000, 0.35, ['#e04050', '#70060f']); c.strokeStyle = '#f4ece0'; c.lineWidth = 5; c.beginPath(); for (let x = 0; x <= w; x += 4) c.lineTo(x, hh2 / 2 + Math.sin(x / w * Math.PI * 4) * hh2 * 0.28); c.stroke(); });
  const bm = mat('balls', THREE.MeshStandardMaterial, { map: felt, roughness: 1, bumpMap: felt, bumpScale: 1 }); const brd = (SZ('balls').d || 2.58) / 2 * IN;
  [[bw * 0.1, bh + brd * 0.6, bd * 0.05], [bw * 0.62, brd, bd * 0.75]].forEach(([x, y, z], i) => { const b = new THREE.Mesh(SPH, bm); b.scale.setScalar(brd); b.rotation.set(R(0, 3), R(0, 3), 0); b.position.set(x, y, z); b.castShadow = true; g.add(b); tag(b, 'balls'); if (!i) addInstancePos('balls', W(x, y, z)); });
  [0, 1].forEach(k => { const c = new THREE.Mesh(new THREE.BoxGeometry(3.4 * IN, 2.1 * IN, 0.003), [0, 1, 2, 3, 4, 5].map(f => f === 4 ? mat('gift_card', THREE.MeshStandardMaterial, { map: photoTex('tx_card'), roughness: 0.4 }) : mat('gift_card', THREE.MeshStandardMaterial, { color: 0xFBFAF6, roughness: 0.4 })));
    c.position.set(bw * 0.08 + k * 0.06, bh + 1.2 * IN + k * 0.02, -bd * 0.12 - k * 0.03); c.rotation.set(-0.25, 0.1 - k * 0.15, 0.05 - k * 0.12); g.add(c); tag(c, 'gift_card'); });
  addInstancePos('gift_card', W(bw * 0.1, bh + 1.4 * IN, -bd * 0.1));
  // toys stand in the basket, kept inside the rim: the 9" sherpa bone stands on end in the right-hand corner (rolled up
  // 70 degrees, leaning back), clear of the jar; the rope cane leans behind it and the knot sits at the front right.
  const ht = SZ('holiday_toy'), toyH = (ht.w || 9) * CUT.small_bone.h / CUT.small_bone.w;   // the cream sherpa bone, 9" long, with its black felt paw
  const toyW = (ht.w || 9) * IN, roll = 1.2, lift = toyW / 2 * Math.sin(roll) + 0.5 * IN;
  const toy = photoCard('small_bone', 'holiday_toy', toyH, W(bw * 0.27, lift - toyH * IN / 2 * Math.cos(roll), bd * 0.02), { ry: ry - 0.25, tilt: -0.3, depth: 0.32 }); toy.rotation.z = roll;
  photoCard('rope_cane', 'rope', 8, W(bw * 0.12, bh * 0.4, -bd * 0.3), { ry: ry - 0.2, tilt: -0.35 });
  photoCard('rope_knot', 'rope', 5, W(bw * 0.24, bh * 0.55, bd * 0.24), { mark: false, ry: ry + 0.1, tilt: -0.25 });
};

/* ---------------- Giant doghouse (extra): 24 x 20 x 26", sign; the pair sits in its doorway ---------------- */
const GIANT = (() => { const S = SZ('doghouse_xl'); return { S, W: (S.w || 24) * IN, D: (S.d || 20) * IN, H: (S.h || 26) * IN }; })();
GIANT.Z = RB + GIANT.D / 2 + 0.12; GIANT.front = GIANT.Z + GIANT.D / 2;
BUILD.pair = r => {   // the board's dog-and-cat photo: a golden retriever and a tabby in fringed tartan scarves
  const free = new THREE.Group(), door = new THREE.Group(); TARGET.add(free); TARGET.add(door); TARGET.userData.free = free; TARGET.userData.door = door;
  const catId = r.cat || 'cat_miyoni', catCut = r.cat_cut || catId, cs = SZ(catId);
  const dh = SZ('golden').h || 11, ch = r.cat_h || cs.h || 6, prev = TARGET, cd = catDepth({ h: ch, l: r.cat_l || cs.l, pose: r.cat_pose || 'stand' });
  TARGET = free;
  // as in the board's pair photo they turn toward each other: the golden a little to its left (toward the cat), the cat to its right
  const [dx, dz] = FLOOR_AT.dog, [cx, cz] = FLOOR_AT.cat;
  photoCard('golden_scarf', 'golden', dh, new THREE.Vector3(dx, 0, dz), { depth: 0.45, ry: 0.35 }); photoCard(catCut, catId, ch, new THREE.Vector3(cx, 0, cz), { depth: cd, ry: -0.5 });
  contactShadow(dx, dz + 0.04, 0.85, 0.5, 0, 0.8); contactShadow(cx, cz + 0.04, 0.6, 0.38, 0, 0.8);
  addInstancePos('bandanas', new THREE.Vector3(dx, dh * IN * 0.55, dz + 0.04));
  TARGET = door;
  photoCard('golden_scarf', 'golden', dh, new THREE.Vector3(0, 0, GIANT.front + 0.07), { depth: 0.45, ry: 0.35 }); photoCard(catCut, catId, ch, new THREE.Vector3(GIANT.W * 0.2, 0, GIANT.front + 0.24), { depth: cd, ry: -0.5 });   // both in the doorway (door 10" wide)
  contactShadow(0, GIANT.front + 0.1, 0.85, 0.5, 0, 0.8); contactShadow(GIANT.W * 0.2, GIANT.front + 0.26, 0.55, 0.32, 0, 0.8);
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


// Reflection strength is set per material (three r160 has no scene.environmentIntensity). Anything still at the default 1
// gets one by kind: polished metal 1.2, clear-coated glaze 0.8, cloth, paper, plush and wood 0.3, the rest 0.45.
const envPolicy = m => m.metalness >= 0.8 ? 1.2 : m.clearcoat >= 0.5 ? 0.8 : m.roughness >= 0.7 ? 0.3 : 0.45;
const envFix = root => { root.traverse(o => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial && !o.material.isShaderMaterial) [].concat(o.material).forEach(m => { if (m.envMapIntensity === 1) m.envMapIntensity = envPolicy(m); }); }); return root; };
envFix(scene);   // tree.js's own rooms get the same when they are built (extras set their own)

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
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.75, 1.25);   // only HDR sources bloom (bulbs, flames, glints), never plush or paper
// three's blur kernels stop at one sigma, so they act like box filters and a tiny HDR bulb blooms into a square.
// Re-weight them as a Gaussian that fades to ~4% at the kernel edge: round glows.
bloom.separableBlurMaterials.forEach(m => { const K = m.defines.KERNEL_RADIUS, sg = K / 2.5; m.uniforms.gaussianCoefficients.value = Array.from({ length: K }, (_, i) => Math.exp(-0.5 * i * i / (sg * sg))); });
composer.addPass(bloom);
composer.addPass(new OutputPass());
// Display-referred grade (after OutputPass, on sRGB values), aimed at the board photo's rich crimson and emerald:
// hue steer (olive greens toward emerald, orange-reds toward crimson; gold, plush, kraft and wood untouched),
// split-tone (warm highlights, near-neutral shadows), +12% saturation, a gentle S-curve, neutral blacks,
// vignette to 0.55 and a midtone-weighted grain. uWarm scales the split-tone and uGrade the hue steer per room.
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uWarm: { value: 0.6 }, uGrade: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uWarm; uniform float uGrade; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-6)), d / (q.x + 1e-6), q.x); }
    vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      vec3 q = rgb2hsv(clamp(c.rgb, 0.0, 1.0)); float H = q.x * 360.0;
      float wg = smoothstep(58.0, 80.0, H) * (1.0 - smoothstep(105.0, 150.0, H)) * smoothstep(0.12, 0.3, q.y);                    // olive -> emerald
      float wr = smoothstep(4.0, 8.0, H) * (1.0 - smoothstep(11.0, 17.0, H)) * smoothstep(0.75, 0.9, q.y) * smoothstep(0.18, 0.4, q.z);   // plush (hue ~18, less saturated) is left alone   // orange-red -> crimson
      float dh = (wg * 24.0 - wr * 9.0) * uGrade;
      if (abs(dh) > 0.01) { q.x = fract(q.x + dh / 360.0 + 1.0); q.y = min(1.0, q.y * (1.0 + 0.1 * wg * uGrade)); c.rgb = hsv2rgb(q); }
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 tone = mix(vec3(1.0, 0.99, 0.985), vec3(1.04, 1.0, 0.93), smoothstep(0.15, 0.85, l));                           // split-tone
      c.rgb *= mix(vec3(1.0), tone, clamp(uWarm / 0.6, 0.0, 1.5));
      c.rgb = mix(vec3(l), c.rgb, 1.12 * mix(0.6, 1.0, smoothstep(0.015, 0.09, l)));                                      // +12% saturation; the deepest shadows go neutral
      c.rgb = clamp(c.rgb, 0.0, 1.0); c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.25);                     // gentle S-curve
      float v = smoothstep(0.95, 0.25, distance(vUv, vec2(0.5, 0.52)));      // vignette
      c.rgb *= mix(0.55, 1.0, v);
      c.rgb += (h(vUv * 800.0) - 0.5) * 0.03 * (4.0 * l * (1.0 - l));      // film grain, mostly in the midtones
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
  const startDist = dist; const endDist = THREE.MathUtils.clamp(dist, 7.5, controls.maxDistance);
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
  const hits = ray.intersectObjects([...pickables, coreCone], false).filter(h => shown(h.object));
  if (!hits.length || hits[0].object.userData.occluder) return null;
  return hits[0].object.userData.itemId || null;
}
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
  if (moved > 6) return;
  if (tapExtra(e)) return;   // extras with their own tap (they never select a shopping item)
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
  camera.fov = w / h < 0.8 ? 50 : 40;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();

const clock = new THREE.Clock();
let lastT = 0;
renderer.shadowMap.needsUpdate = true;
function frame() {
  const t = clock.getElapsedTime(), dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
  if (anim) anim(performance.now());
  controls.update();
  updateCards();
  frameHooks.forEach(f => f(t, dt));
  tickScene(t, dt);
  grade.uniforms.uTime.value = t % 10;
  doHover();
  const pulse = 0.26 + 0.04 * Math.sin(t * 4);
  markerGroup.children.forEach(s => s.scale.setScalar(pulse));
  composer.render();
}
renderer.setAnimationLoop(frame);
document.getElementById('loading').remove();

/* ---------------- Settings (rooms), tree-light modes and scene extras ---------------- */
const extrasGroup = new THREE.Group(); extrasGroup.name = 'extras'; scene.add(extrasGroup);
const ACCENT_OWNER = [null, null];
const envOf = e => (typeof e === 'function' ? e(core) : e) || livingEnv();
const BG_COLOR = new THREE.Color();
// Apply the chosen room's light design to the fixed pool, then the tree-light mode on top.
function applyLook() {
  const room = ROOMS[XS.room] || ROOMS.living, L = room.look || {}, day = bulbs.mode === 'off', D = L.day || {};
  let env = envOf(L.env); if (day && ENV_OFF.has(env)) env = ENV_OFF.get(env)();   // Daytime look: the same room without the bulb glints
  scene.environment = env;
  if (L.bg && L.bg.isTexture) scene.background = L.bg; else { BG_COLOR.set(L.bg ?? 0x0d0806); scene.background = BG_COLOR; }
  const hm = L.hemi || [0xffd9b0, 0x20140c, 0.15]; hemi.color.set(hm[0]); hemi.groundColor.set(hm[1]); hemi.intensity = hm[2] + (day ? (D.hemi ?? 0.45) : 0);
  const K = { color: 0xffcf9a, intensity: 70, angle: 0.55, penumbra: 0.9, decay: 2, pos: [1.5, 9, 5], target: [0, 3, 0], ...(L.key || {}) };
  key.color.set(K.color); key.intensity = K.intensity * (day ? (D.key ?? 1.25) : 1); key.angle = K.angle; key.penumbra = K.penumbra; key.decay = K.decay;
  key.position.set(...K.pos); key.target.position.set(...K.target); key.target.updateMatrixWorld();
  const rm = L.rim || [0x8fa6d6, 0.18]; rim.color.set(rm[0]); rim.intensity = rm[1] + (day ? (D.rim ?? 0.25) : 0);
  INTERIOR.forEach((l, i) => { l.color.set(L.interiorColor ?? 0xffb870); l.intensity = day ? 0 : INTERIOR_I[i] * (L.interior ?? 1); });
  const bs = L.base || [0xffb070, 3]; base.color.set(bs[0]); base.intensity = day ? 0 : bs[1]; base.position.set(...(bs[2] || [0, 0.6, 0]));
  accent.forEach((l, i) => { if (ACCENT_OWNER[i]) return; const a = (L.accent || [])[i] || [0xff9a40, 0, [0, 2.6, -4.3]]; l.color.set(a[0]); l.userData.base = a[1]; l.intensity = a[1]; if (a[2]) l.position.set(...a[2]); });
  renderer.toneMappingExposure = (L.exp ?? 1.2) * (day ? (D.exp ?? 1.05) : 1);
  bloom.strength = Math.max(0, (L.bloom ?? 0.9) - (day ? 0.3 : 0)); grade.uniforms.uWarm.value = L.warm ?? 0.6;
  GLOW.uniforms.uGlowK.value = day ? 0 : (L.glow ?? 1); grade.uniforms.uGrade.value = L.grade ?? 1;   // bulb glow on the needles follows the tree lights
  controls.maxDistance = room.maxDist ?? 14.5;
  if (room.setMode) try { room.setMode(bulbs.mode, core); } catch (e) { console.error(e); }
  renderer.shadowMap.needsUpdate = true;
}
function setRoom(name, { persist = true } = {}) {
  const room = ROOMS[name]; if (!room) return XS.room;
  if (!room.group) { try { room.group = room.build(core) || new THREE.Group(); } catch (e) { console.error('room', name, e); room.group = new THREE.Group(); } room.group.name ||= 'room.' + name; scene.add(room.group); }
  ROOM_LIST.forEach(r => { if (r.group) r.group.visible = r.id === name; });
  XS.room = name; applyLook(); refreshExtras();
  if (persist) saveExtras(); if (XS.render) XS.render();
  return name;
}
// Extras switch on lazily (built the first time they are shown) and only in the rooms they list.
function refreshExtras() {
  EXTRAS.forEach(x => {
    const want = !!XS.on[x.id] && (!x.rooms || x.rooms.includes(XS.room));
    if (want && !x.built) { x.built = true; try { const o = x.build ? x.build(core) : null; if (o) { x.obj = o; if (!o.parent) extrasGroup.add(o); } } catch (e) { console.error('extra', x.id, e); x.tick = null; } }
    if (x.obj) x.obj.visible = want;
    if (want !== x.active) { x.active = want; if (x.setOn) try { x.setOn(want, core); } catch (e) { console.error('extra', x.id, e); } renderer.shadowMap.needsUpdate = true; }
  });
}
function saveExtras() { try { localStorage.setItem(XKEY, JSON.stringify({ room: XS.room, lights: bulbs.mode, on: XS.on })); } catch (e) {} }
const extrasState = () => ({ room: XS.room, lights: bulbs.mode, on: { ...XS.on } });
// setExtras({ all: false }) gives the clean board view: Living room, steady pre-lit lights, no extras.
// Other keys: room ('living' | 'office' | any registered room), lights ('steady' | 'twinkle' | 'off'), and <extra id>: true/false.
function setExtras(o = {}, { persist = true } = {}) {
  if ('all' in o) { EXTRAS.forEach(x => { XS.on[x.id] = !!o.all; }); if (!o.all) o = { room: 'living', lights: 'steady', ...o }; }
  EXTRAS.forEach(x => { if (typeof o[x.id] === 'boolean') XS.on[x.id] = o[x.id]; });
  if (o.lights && o.lights !== bulbs.mode) bulbs.setMode(o.lights);
  if (o.room && ROOMS[o.room]) setRoom(o.room, { persist: false }); else { applyLook(); refreshExtras(); }
  if (persist) saveExtras(); if (XS.render) XS.render();
  return extrasState();
}
function tickScene(t, dt) {
  bulbs.tick(t, dt);
  const room = ROOMS[XS.room];
  if (room && room.tick) try { room.tick(t, dt, core); } catch (e) { console.error('room tick', e); room.tick = null; }
  for (const x of EXTRAS) if (x.active && x.tick) try { x.tick(t, dt, core); } catch (e) { console.error('extra tick', x.id, e); x.tick = null; }
}
// Taps on extras (e.g. a mailbox flag) go to their own handlers and never select a shopping item.
const TAPS = [];
function tapExtra(ev) {
  if (!TAPS.length) return false;
  const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  const objs = TAPS.map(t => t.obj).filter(o => shown(o)); if (!objs.length) return false;
  const hx = ray.intersectObjects(objs, true)[0]; if (!hx) return false;
  const ht = ray.intersectObjects([...pickables, coreCone], false).filter(h => shown(h.object))[0];
  if (ht && ht.distance < hx.distance) return false;
  const t = TAPS.find(t => { for (let o = hx.object; o; o = o.parent) if (o === t.obj) return true; return false; });
  if (t) { try { t.fn(hx); } catch (e) { console.error(e); } return true; }
  return false;
}
const toastEl = (() => { const d = document.createElement('div'); d.className = 'xtoast'; d.hidden = true; d.setAttribute('role', 'status'); stage.append(d); return d; })();
let toastTimer = null;
function toast(msg, ms = 2600) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms); }

const CUT_V = new THREE.Vector3();
// The living room and the office register like any other room, so extras_*.js can add more the same way.
registerRoom({
  id: 'living', label: 'Living room', order: 0, maxDist: 11.5, build: c => envFix(buildLivingRoom(c)),
  look: { env: livingEnv, bg: LIVING_BG, hemi: [0xffd9b0, 0x2a1a10, 0.35], key: { color: 0xffcf9a, intensity: 70, angle: 0.55, penumbra: 0.9, decay: 2 }, rim: [0x8fa6d6, 0.18],
    base: [0xffb070, 2.2], interior: 1, accent: [[0xff9a40, 1.1, [-3.55, 2.75, -4.15]], [0xff9a40, 0.7, [3.3, 2.7, -4.15]]], exp: 1.2, bloom: 0.9, warm: 0.6,
    day: { hemi: 0.5, key: 1.2, rim: 0.3, exp: 1.05 } },
  setMode(mode) { if (ROOM.backdropMat) ROOM.backdropMat.color.setRGB(...(mode === 'off' ? [1.7, 1.75, 1.85] : [1.05, 1.05, 1.1])); },
  tick(t, dt, c) {
    const cam = camera.position, v = CUT_V;
    (ROOM.cut || []).forEach(w => { w.g.visible = v.subVectors(cam, w.p).dot(w.n) > -0.02; });   // dollhouse cut-away
    FLAME_MAT.uniforms.uTime.value = REDUCED_MOTION ? 0 : t; FLAME_MAT.uniforms.uOn.value = 1;
    accent.forEach((l, i) => { if (ACCENT_OWNER[i]) return; const b = l.userData.base || 0; l.intensity = REDUCED_MOTION ? b : b * (1 + 0.2 * Math.sin(t * 9.1 + i * 2) * Math.sin(t * 3.7 + i) + 0.06 * Math.sin(t * 23 + i)); });
  },
});
registerRoom({
  id: 'office', label: 'Office', order: 90, maxDist: 14.5, build: c => envFix(buildOffice(c)),
  look: { env: () => ENV.office, bg: 0x2a2d31, hemi: [0xf3f5fb, 0x5a5650, 1.15], key: { color: 0xfff2e2, intensity: 1.3, angle: 1.1, penumbra: 0.5, decay: 0 }, rim: [0xd8e2ff, 0.5],
    base: [0xffb070, 3], interior: 1, accent: [[0xff9a40, 0], [0xff9a40, 0]], exp: 1.0, bloom: 0.5, warm: 0.2, day: { hemi: 0.15, key: 1.0, rim: 0, exp: 1.0 } },
});
Object.assign(core, {
  THREE, scene, camera, controls, renderer, IN, rAt, Y0, YTOP, RB, treeGroup, extrasGroup, frameHooks, ROOM, ROOMS, get LOOK() { return Object.fromEntries(ROOM_LIST.map(r => [r.id, r.look])); },
  hemi, key, rim, base, accent, interior: INTERIOR, bloom, grade, composer, pmremGen, ENV, canvasTex, drawPaw, tartanTex, noise, rng, mergeGeometries, bowGeo, SHADOW_TEX, contactShadow,
  bulbs, LOW, reducedMotion: REDUCED_MOTION, setRoom, setExtras, applyLook, toast, state: extrasState, registerRoom, registerExtra,
  get room() { return XS.room; }, get time() { return clock.getElapsedTime(); },
  claimAccent(i, owner) { ACCENT_OWNER[i] = owner || true; return accent[i]; },
  releaseAccent(i, owner) { if (!owner || ACCENT_OWNER[i] === owner || ACCENT_OWNER[i] === true) { ACCENT_OWNER[i] = null; applyLook(); } },
  addTapTarget(obj, fn) { TAPS.push({ obj, fn }); },
  shadowsDirty() { renderer.shadowMap.needsUpdate = true; },
});
setRoom('living', { persist: false });

/* ---------------- HUD: the "Extras ✦" popover, generated from the registries ---------------- */
{
  const btn = document.getElementById('extrasBtn'), pop = document.getElementById('extras');
  const LIGHTS = [['steady', 'Steady', 'As delivered: the tree comes pre-lit'], ['twinkle', 'Twinkle', 'Just for fun: a few bulbs sparkle'], ['off', 'Daytime', 'Lights off, daytime look']];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const onlyIn = x => x.rooms && x.rooms.length ? ` <span class="xonly">(${x.rooms.map(r => (ROOMS[r] ? ROOMS[r].label : r).replace(/ room$/, '').toLowerCase()).join(', ')} only)</span>` : '';
  const chk = x => `<label class="xchk${x.rooms && !x.rooms.includes(XS.room) ? ' xoff' : ''}"><input type="checkbox" data-xid="${esc(x.id)}"${XS.on[x.id] ? ' checked' : ''}> <span>${esc(x.label || x.id)}${onlyIn(x)}</span></label>`;
  XS.render = () => {
    if (!pop) return;
    const room = EXTRAS.filter(x => x.kind === 'setting'), fun = EXTRAS.filter(x => x.kind !== 'setting');
    pop.innerHTML = `<div class="xh"><b>Scene extras</b><button type="button" class="xclose" aria-label="Close">✕</button></div>
      <div class="xsec"><span class="xl" id="xlRoom">Setting</span><div class="xchips" role="group" aria-labelledby="xlRoom">${ROOM_LIST.map(r => `<button type="button" data-xroom="${esc(r.id)}" aria-pressed="${r.id === XS.room}">${esc(r.label)}</button>`).join('')}</div></div>
      <div class="xsec"><span class="xl" id="xlLights">Tree lights</span><div class="xchips" role="group" aria-labelledby="xlLights">${LIGHTS.map(([m, l, tt]) => `<button type="button" data-xlights="${m}" title="${tt}" aria-pressed="${bulbs.mode === m}"${m === 'twinkle' && REDUCED_MOTION ? ' disabled' : ''}>${l}</button>`).join('')}</div>
        <p class="xnote">${{ steady: 'Steady is the tree as delivered: it comes pre-lit.', twinkle: 'Twinkle is just for fun; the delivered lights are steady.', off: 'Daytime look: the pre-lit lights switched off.' }[bulbs.mode]}</p></div>
      ${room.length ? `<div class="xsec"><span class="xl">In the room</span>${room.map(chk).join('')}</div>` : ''}
      ${fun.length ? `<div class="xsec"><span class="xl">Fun extras</span>${fun.map(chk).join('')}</div>` : ''}
      <button type="button" class="xalloff">All extras off</button>
      <p class="xcap">Scene extras are for fun and aren't on the shopping list.</p>`;
    btn.classList.toggle('xact', XS.room !== 'living' || bulbs.mode !== 'steady' || EXTRAS.some(x => XS.on[x.id]));
  };
  const place = () => { const s = stage.getBoundingClientRect(), b = btn.getBoundingClientRect(), top = Math.round(b.bottom - s.top + 8); pop.style.top = top + 'px'; pop.style.maxHeight = Math.max(160, s.height - top - 14) + 'px'; };
  const open = on => { pop.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on) { XS.render(); place(); } };
  if (btn && pop) {
    btn.onclick = () => open(pop.hidden);
    pop.addEventListener('click', e => {
      const r = e.target.closest('[data-xroom]'), l = e.target.closest('[data-xlights]');
      if (e.target.closest('.xclose')) { open(false); btn.focus(); return; }
      if (e.target.closest('.xalloff')) { setExtras({ all: false }); return; }
      if (r) { setRoom(r.dataset.xroom); return; }
      if (l) setExtras({ lights: l.dataset.xlights });
    });
    pop.addEventListener('change', e => { const c = e.target.closest('[data-xid]'); if (c) setExtras({ [c.dataset.xid]: c.checked }); });
    document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) open(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { open(false); btn.focus(); } });
    new ResizeObserver(() => { if (!pop.hidden) place(); }).observe(stage);
  }
}
// After every extras_*.js has registered (they run later in this same module), restore the saved choices.
queueMicrotask(() => {
  XS.ready = true;
  const s = XS.saved || {};
  const lights = s.lights || DEFAULT_LIGHTS;
  if (lights !== bulbs.mode) bulbs.setMode(lights);
  setRoom(ROOMS[s.room] ? s.room : ROOMS[DEFAULT_ROOM] ? DEFAULT_ROOM : 'living', { persist: false });
  if (XS.render) XS.render();
});
{ // compare with the inspiration board: the clean board view while it is open (extras off), then back
  const btn = document.getElementById('compare'), box = document.getElementById('insp');
  let stash = null;
  if (btn && box && CUT.inspiration) {
    box.querySelector('img').src = CUT.inspiration.src;
    btn.onclick = () => { const on = box.hidden; box.hidden = !on; btn.setAttribute('aria-pressed', String(on));
      if (on) { stash = extrasState(); setExtras({ all: false }, { persist: false }); } else if (stash) { setExtras({ ...stash.on, room: stash.room, lights: stash.lights }, { persist: false }); stash = null; } };
    box.querySelector('button').onclick = () => btn.click();
  }
}
/* ---------------- Person for scale ---------------- */
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
let applySel = function ({ focusEl } = {}) {
  O.elements.forEach(e => Object.entries(GROUPS[e.id] || {}).forEach(([o, g]) => { g.visible = o === SEL[e.id]; }));
  const pg = GROUPS.pair && GROUPS.pair.pair;   // the dog and cat sit in the giant doghouse's doorway when it is built
  if (pg && pg.userData.free) { pg.userData.free.visible = SEL.giant !== 'build'; pg.userData.door.visible = SEL.giant === 'build'; }
  clearFoliage();   // needles follow the pieces now shown
  CUR = window.howlResolve(O, SEL); ITEMS = CUR.items; BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
  try { localStorage.setItem(SEL_KEY, JSON.stringify(SEL)); } catch (e) {}
  document.getElementById('about').textContent = window.howlDocs ? window.howlDocs.aboutText(SEL) : ABOUT;
  renderBudget(); renderList(); renderSwaps(); if (window.howlExportRefresh) window.howlExportRefresh();
  if (selected) { if (BY_ID[selected] || (ELEMENT_OF[selected] && visiblePts(selected).length)) select(selected); else select(null); }
  renderer.shadowMap.needsUpdate = true;
  if (focusEl) { const ids = visibleIdsOf(focusEl); if (ids.length) { setHighlight(ids); focusOn(ids); } }
};
{ // reset the whole tree to the board match (every element back to its default option)
  const rt = document.getElementById('resetTree');
  const sync = () => { rt.disabled = isDefault(); };
  rt.onclick = () => { SEL = { ...DEFAULT_SEL }; applySel(); sync(); };
  const prev = applySel; applySel = (...a) => { prev(...a); sync(); };
}
applySel();
Promise.all(RELIEF_READY).then(() => clearFoliage());   // once every relief has its real shape
window.__howl = { select, instancesOf, pickables, stop: () => renderer.setAnimationLoop(null), frame, camera, controls, setSel: s => { SEL = { ...SEL, ...s }; applySel(); }, sel: () => ({ ...SEL }), totals: () => CUR.totals, groups: GROUPS,
  setExtras, setRoom: name => setRoom(name), extras: extrasState, renderer, scene, core, home: { pos: HOME_POS, target: HOME_TARGET }, bulbs,
  clearFoliage, foliageStats: () => CLEAR_STATS, reliefsReady: () => Promise.all(RELIEF_READY).then(() => RELIEF_READY.length),
  light: () => ({ glowMs: GLOW.ms, envMs: ENV_MS.slice(), glowOn: !!NEEDLE_MAT.onBeforeCompile, env: scene.environment && scene.environment.uuid, low: LOW }), grade };
