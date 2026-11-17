/* Printable templates at true size (print at 100% / "Actual size", never "Fit to page"). Every page has a 1" check square.
   output/HP26_Templates.pdf:
     1-2  10" doghouse ornament (11 x 17): walls with brick lines; roof, floor, corner trims and the board cut plan
     3    paw templates (Letter): 3.6" hoop paw, 3" topper / holiday-toy paw, 4.5" pillow paw, 1" stocking-cuff paw
     4    9" clay bone (foil-core line; red wire-anchor / drill marks for the two-cord level hang) and the 2.7" biscuit outline (Letter landscape)
     5    option: 4.3" doghouse ornament with its trims (Letter)
     6-7  option: giant doghouse door and cut plan (Letter)
     8    10" doghouse trims and small parts (Letter): arch trim, barge boards, threshold, ridge cap, raised gable paw
     9    6" felt back circle for the hoop ornaments, and the 5" bone option (Letter)
   Text that names a step must agree with the CAT/SUP 'how' text in build/build_plan.py (same sizes, counts, tools, page numbers).
   output/HP26_Doghouse_Sign_11x17.pdf: the 16 x 4" sign for the giant doghouse option.
   Sizes and counts come from data/options.json render dicts (doghouses, bones, topper, paws, stockings, flourish) and the
   catalog size_in of faux_treats, so the 3D, the plan and the templates agree.
   Needs Playwright (used only here); if it is not installed the committed PDFs are kept. */
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const O = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'options.json'), 'utf8'));
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('templates: playwright not installed, keeping existing PDFs'); process.exit(0); }

const f2 = v => +v.toFixed(3);
const paw = (cx, cy, s, fill = '#111', rot = 0) => {
  const e = (x, y, rx, ry, r) => `<ellipse cx="${(x * s).toFixed(3)}" cy="${(y * s).toFixed(3)}" rx="${(rx * s).toFixed(3)}" ry="${(ry * s).toFixed(3)}" transform="rotate(${(r * 57.3).toFixed(1)} ${(x * s).toFixed(3)} ${(y * s).toFixed(3)})"/>`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})" fill="${fill}">${e(0, 0.2, 0.32, 0.26, 0)}${e(-0.36, -0.14, 0.12, 0.16, -0.4)}${e(-0.13, -0.38, 0.12, 0.16, -0.12)}${e(0.13, -0.38, 0.12, 0.16, 0.12)}${e(0.36, -0.14, 0.12, 0.16, 0.4)}</g>`;
};
// paw outline extent (in units of s, about its centre): x -0.48..0.48, y -0.54..0.46
const T = (x, y, t, o = {}) => `<text x="${f2(x)}" y="${f2(y)}" font-size="${o.size || 0.13}" font-weight="${o.w || 400}" text-anchor="${o.a || 'start'}" fill="${o.c || '#222'}"${o.halo ? ' stroke="#fff" stroke-width="0.05" paint-order="stroke"' : ''}${o.rot ? ` transform="rotate(${o.rot} ${f2(x)} ${f2(y)})"` : ''} font-family="Arial, Helvetica, sans-serif">${t}</text>`;
const page = (cls, title, note, w, h, svg) => `<section class="pg ${cls}"><h1>${title}</h1><p>${note}</p><svg width="${w}in" height="${h}in" viewBox="0 0 ${w} ${h}">${svg}</svg></section>`;
const cut = 'class="cut" fill="none" stroke="#111" stroke-width="0.012"', dash = 'fill="none" stroke="#777" stroke-width="0.01" stroke-dasharray="0.06 0.05"',
  dot = 'fill="none" stroke="#777" stroke-width="0.01" stroke-dasharray="0.015 0.04"', score = 'fill="none" stroke="#b9b9b9" stroke-width="0.008"';
const arch = (x, y, w, h) => `M ${f2(x)} ${f2(y + h)} L ${f2(x)} ${f2(y + w / 2)} A ${w / 2} ${w / 2} 0 0 1 ${f2(x + w)} ${f2(y + w / 2)} L ${f2(x + w)} ${f2(y + h)}`;   // y = top of arch
// 1" check square; text to the right ('r', footprint about 2.6 x 1) or below ('b', about 1.3 x 1.6)
const check = (x, y, mode = 'r') => {
  const sq = `<rect x="${x}" y="${y}" width="1" height="1" fill="none" stroke="#c00" stroke-width="0.02"/>` + T(x + 0.5, y + 0.55, '1 inch', { a: 'middle', size: 0.11, c: '#c00' });
  const lines = mode === 'r' ? ['Check: this square must', 'measure 1" x 1". If not,', 'reprint at "Actual size".'] : ['Check: 1" x 1".', 'If not, reprint', 'at "Actual size".'];
  return sq + lines.map((l, i) => mode === 'r' ? T(x + 1.12, y + 0.3 + i * 0.2, l, { size: 0.11, c: '#c00' }) : T(x, y + 1.2 + i * 0.17, l, { size: 0.1, c: '#c00' })).join('');
};
const T16 = 0.1875;
const opt = (el, id) => { const e = O.elements.find(x => x.id === el); const o = id ? e.options.find(x => x.id === id) : e.options[0]; return (o && o.render) || {}; };
const DH = opt('doghouses', 'diy10'), DHS = opt('doghouses', 'diy43'), BONES = opt('bones', 'clay9'), BONES5 = opt('bones', 'clay5'), TOP = opt('topper', 'burlap6'),
  PAWS = opt('paws'), STOCK = opt('stockings', 'knit'), STREAM = opt('flourish', 'streamers');
const BISC = (O.catalog.faux_treats && O.catalog.faux_treats.size_in) || {};
const BISC_L = BISC.w || 2.7, BISC_SPAN = BISC.h || 1.08;   // the 2.7" bone cutter the plan buys: the fallback outline is the same size so the jar ring maths holds
const BRICK_L = DH.brick_l || 1.5, BRICK_H = +(DH.wall / Math.round(DH.wall / (DH.brick_h || 0.9))).toFixed(3);   // board: big blocks about 0.9-1" high, 1.5" long (LO-8); whole courses up the wall
const NH = DH.n || 6, NHS = DHS.n || 12, NHOOP = PAWS.n || 10, NBONE = BONES.n || 8, TOPPAWS = TOP.paws || 24, TOPPAW_IN = TOP.paw_in || 3;
const NCUFF = STOCK.paws ? (STOCK.n || 12) : 0, NSTREAM = STREAM.paws || 24, NBONE5 = BONES5.n || 24, BONE5_T = BONES5.thick || 0.75;
const BONE_L = BONES.len || BONES.l || 9, SHAFT_R = BONES.shaft_ratio || 0.27, SPAN_R = BONES.span_ratio || 0.53, BONE_T = BONES.thick || 1;

// ---- doghouse geometry (true size) ----
function doghouse(r, door, trim, pawIn, over) {
  const { w: W, d: D, wall: WALL, ridge: RIDGE } = r, SL = Math.hypot(W / 2, RIDGE - WALL) + over, PITCH = Math.atan2(RIDGE - WALL, W / 2);
  const gable = (x, y) => `M ${f2(x)} ${f2(y + RIDGE)} L ${f2(x + W)} ${f2(y + RIDGE)} L ${f2(x + W)} ${f2(y + RIDGE - WALL)} L ${f2(x + W / 2)} ${f2(y)} L ${f2(x)} ${f2(y + RIDGE - WALL)} Z`;
  const doorD = (x, y) => arch(x + W / 2 - door[0] / 2, y + RIDGE - door[1], door[0], door[1]);
  const pawY = r.paw_y || (RIDGE - WALL) * 0.71;          // paw centre below the peak (render paw_y, the 3D's value): clear of the barge boards and of the arch trim
  return { W, D, WALL, RIDGE, SL, PITCH, door, trim, pawIn, over, gable, doorD, pawY, base: T16 };
}
let clipN = 0;
// staggered brick lines clipped to a closed outline (holes by even-odd), courses measured up from the bottom edge
function bricks(clipD, x0, x1, yBot, yTop, cx, bh, bl) {
  const id = 'clip' + (++clipN); let d = '';
  for (let k = 1; yBot - k * bh > yTop; k++) d += `M ${f2(x0)} ${f2(yBot - k * bh)} H ${f2(x1)} `;
  for (let k = 0; yBot - k * bh > yTop; k++) {
    const ya = yBot - k * bh, yb = Math.max(yTop, ya - bh), off = (k % 2) * bl / 2;
    for (let j = Math.floor((x0 - cx) / bl) - 1; cx + j * bl + off < x1; j++) { const x = cx + j * bl + off; if (x > x0) d += `M ${f2(x)} ${f2(ya)} V ${f2(yb)} `; }
  }
  return `<clipPath id="${id}"><path d="${clipD}" clip-rule="evenodd"/></clipPath><g clip-path="url(#${id})"><path d="${d}" ${score}/></g>`;
}
// front wall: outline, door, brick lines, dashed arch-trim placement, dotted raised-paw placement
function front(h, x, y, bh, bl) {
  const doorClosed = h.doorD(x, y) + ' Z';
  const uOut = uPath(h, x + h.W / 2 - (h.door[0] / 2 + h.trim), y + h.RIDGE - (h.door[1] + h.trim), true);
  return bricks(h.gable(x, y) + ' ' + doorClosed, x, x + h.W, y + h.RIDGE, y, x + h.W / 2, bh, bl) +
    `<path d="${h.gable(x, y)}" ${cut}/><path d="${h.doorD(x, y)}" ${cut}/><path d="${uOut}" ${dash}/>` +
    `<g ${dot}>${paw(x + h.W / 2, y + h.pawY, h.pawIn, 'none')}</g>`;
}
// flat U-shaped door arch trim; inner edge = the door; legs stand on the threshold (base above the wall bottom). outerOnly: the dashed placement line
function uPath(h, x, y, outerOnly) {
  const [dw, dh] = h.door, t = h.trim, ow = dw + 2 * t, yb = y + dh + t, yl = yb - h.base, ys = yb - (dh - dw / 2), R = ow / 2, r = dw / 2;
  const outer = `M ${f2(x)} ${f2(yl)} L ${f2(x)} ${f2(ys)} A ${R} ${R} 0 0 1 ${f2(x + ow)} ${f2(ys)} L ${f2(x + ow)} ${f2(yl)}`;
  if (outerOnly) return outer + ` M ${f2(x)} ${f2(yl)} H ${f2(x + t)} M ${f2(x + ow - t)} ${f2(yl)} H ${f2(x + ow)}`;
  return outer + ` L ${f2(x + ow - t)} ${f2(yl)} L ${f2(x + ow - t)} ${f2(ys)} A ${r} ${r} 0 0 0 ${f2(x + t)} ${f2(ys)} L ${f2(x + t)} ${f2(yl)} Z`;
}
const uSize = h => ({ w: h.door[0] + 2 * h.trim, h: h.door[1] + h.trim - h.base });
// barge board: top edge = roof slope length, eave end square, peak end plumb-cut so the pair meets at the ridge
function barge(h, x, y, w) {
  const L = h.SL, s = w * Math.tan(h.PITCH);
  return { d: `M ${f2(x)} ${f2(y)} L ${f2(x + L)} ${f2(y)} L ${f2(x + L - s)} ${f2(y + w)} L ${f2(x)} ${f2(y + w)} Z`, L, s };
}

const big = doghouse(DH, DH.door || [3.8, 4.6], 0.5, 2.5, 0.75);
const small = doghouse(DHS, DHS.door || [1.5, 1.9], 0.22, 1.0, 0.35);   // door 1.5 x 1.9 and 0.22" trims: the same as the 3D (DH-14)
const ROOF_W = big.D + 2 * big.over;                                                 // 7.5
const BARGE_W = 0.6, RIDGE_W = 0.5, THR = [big.door[0] + 2 * big.trim, 0.75];

// ---- page 1: front/back and sides ----
let p1 = front(big, 0.2, 0.2, BRICK_H, BRICK_L) + T(0.2 + big.W / 2, 0.2 + big.RIDGE + 0.22, 'FRONT: cut out the arched door. BACK: trace this outline again without the door.', { a: 'middle', size: 0.12, w: 700 });
const sideW = big.D - 2 * T16, sideY = 0.2 + big.RIDGE + 0.35;
p1 += bricks(`M 0.2 ${sideY} h ${sideW} v ${big.WALL} h ${-sideW} Z`, 0.2, 0.2 + sideW, sideY + big.WALL, sideY, 0.2 + sideW / 2, BRICK_H, BRICK_L) +
  `<rect x="0.2" y="${f2(sideY)}" width="${sideW}" height="${big.WALL}" ${cut}/>` + T(0.2 + sideW / 2, sideY + big.WALL / 2, 'SIDE x2', { a: 'middle', size: 0.15, w: 700, halo: 1 }) +
  T(0.2 + sideW / 2, sideY + big.WALL / 2 + 0.22, `${sideW.toFixed(3)} x ${big.WALL}"`, { a: 'middle', size: 0.12, halo: 1 });
p1 += check(6.3, sideY + 0.1);
[[`Grey lines: score the bricks with a ballpoint that has run dry`, 1], [`(courses ${BRICK_H.toFixed(2)}" high, bricks ${BRICK_L}" long, staggered).`, 0],
 ['Dashed U round the door: where the cream arch trim sits.', 1], ['Cut the trim itself from page 8.', 0],
 ['Dotted paw: where the raised 2.5" paw sits (page 8),', 1], [`centred ${big.pawY}" below the peak. Cut it from the door piece.`, 0]]
  .forEach(([t, b], i) => { p1 += T(6.3, sideY + 1.6 + i * 0.2 + (b ? 0.12 * i / 2 : 0.12 * (i - 1) / 2), t, { size: 0.11, w: b ? 700 : 400 }); });

// ---- page 2: roof, floor, corner trims, board cut plan ----
const roofScore = (x, y, w, hgt, row, joint) => { let d = ''; for (let k = 1; k * row < hgt - 0.05; k++) d += `M ${f2(x)} ${f2(y + hgt - k * row)} H ${f2(x + w)} `;
  for (let k = 0; k * row < hgt; k++) { const ya = y + hgt - k * row, yb = Math.max(y, ya - row), off = (k % 2) * joint / 2; for (let xx = x + off + joint; xx < x + w - 0.05; xx += joint) d += `M ${f2(xx)} ${f2(ya)} V ${f2(yb)} `; }
  return `<path d="${d}" ${score}/>`; };
let p2 = roofScore(0.2, 0.2, ROOF_W, big.SL, 1.25, 1.5) + `<rect x="0.2" y="0.2" width="${ROOF_W}" height="${f2(big.SL)}" ${cut}/>` +
  T(0.2 + ROOF_W / 2, 0.2 + big.SL / 2 - 0.1, 'ROOF x2', { a: 'middle', size: 0.15, w: 700, halo: 1 }) +
  T(0.2 + ROOF_W / 2, 0.2 + big.SL / 2 + 0.12, `${ROOF_W.toFixed(1)} x ${big.SL.toFixed(2)}": overhangs 3/4" all round`, { a: 'middle', size: 0.12, halo: 1 }) +
  T(0.2 + ROOF_W / 2, 0.2 + big.SL / 2 + 0.32, 'score the grey lines: boards parallel to the eave (bottom edge)', { a: 'middle', size: 0.11, halo: 1 }) +
  T(0.2 + ROOF_W / 2, 0.2 + big.SL - 0.08, 'EAVE', { a: 'middle', size: 0.1, c: '#666', halo: 1 }) + T(0.2 + ROOF_W / 2, 0.36, 'RIDGE', { a: 'middle', size: 0.1, c: '#666', halo: 1 });
p2 += `<rect x="8.4" y="0.2" width="0.5" height="${big.WALL}" ${cut}/>` + T(8.72, 0.35, `CORNER TRIM x4 (0.5 x ${big.WALL}")`, { size: 0.12, rot: 90 });
p2 += check(8.4, 6.0, 'b');
const flW = big.W - 2 * T16, flD = big.D - 2 * T16, flY = 0.2 + big.SL + 0.5;
p2 += `<rect x="0.2" y="${f2(flY)}" width="${flD}" height="${flW}" ${cut}/>` + T(0.2 + flD / 2, flY + flW / 2, 'FLOOR x1', { a: 'middle', size: 0.15, w: 700 }) + T(0.2 + flD / 2, flY + flW / 2 + 0.22, `${flD.toFixed(3)} x ${flW.toFixed(3)}"`, { a: 'middle', size: 0.12 });
// cut plan, 1:10, for 16 x 20" boards
{
  const k = 0.1, bw = 16, bh = 20, X0 = 6.3, Y0 = flY + 1.0, cw = 2.05, rh = 3.15;
  const R = (bx, by, x, y, w, h, fill = '#eee') => `<rect x="${f2(bx + x * k)}" y="${f2(by + y * k)}" width="${f2(w * k)}" height="${f2(h * k)}" fill="${fill}" stroke="#333" stroke-width="0.006"/>`;
  const G = (bx, by, x, y) => { const g = big; const s = (px, py) => `${f2(bx + (x + px) * k)} ${f2(by + (y + py) * k)}`; return `<path d="M ${s(0, g.RIDGE)} L ${s(g.W, g.RIDGE)} L ${s(g.W, g.RIDGE - g.WALL)} L ${s(g.W / 2, 0)} L ${s(0, g.RIDGE - g.WALL)} Z" fill="#f3d9d0" stroke="#333" stroke-width="0.006"/>`; };
  const U = (bx, by, x, y) => { const u = uSize(big); return R(bx, by, x, y, u.w, u.h, '#fff8e6'); };
  const boards = [
    ['Boards 1-6 (one per house):', '2 gables + 2 roofs + 1 side', b => G(b[0], b[1], 0, 0) + G(b[0], b[1], 0, big.RIDGE) + R(b[0], b[1], big.W, 0, ROOF_W, big.SL) + R(b[0], b[1], big.W, big.SL, ROOF_W, big.SL) + R(b[0], b[1], big.W, 2 * big.SL + 0.1, sideW, big.WALL)],
    ['Board 7: 4 floors, 24 corner', 'trims, 7 ridge caps', b => [0, 1].map(i => [0, 1].map(j => R(b[0], b[1], i * flD, j * flW, flD, flW)).join('')).join('') +
      Array.from({ length: 24 }, (_, i) => R(b[0], b[1], 2 * flD + 0.05 + (i % 9) * 0.52, Math.floor(i / 9) * 5.55, 0.5, big.WALL, '#fff8e6')).join('') +
      Array.from({ length: 7 }, (_, i) => R(b[0], b[1], 0, 2 * flW + 0.05 + i * 0.52, ROOF_W, RIDGE_W, '#fff8e6')).join('')],
    ['Board 8: 6 sides, 12 barge', 'boards, 6 thresholds', b => Array.from({ length: 6 }, (_, i) => R(b[0], b[1], (i % 2) * sideW, Math.floor(i / 2) * big.WALL, sideW, big.WALL)).join('') +
      Array.from({ length: 12 }, (_, i) => R(b[0], b[1], 2 * sideW + 0.05 + (i % 7) * 0.62, Math.floor(i / 7) * (big.SL + 0.05), BARGE_W, big.SL, '#fff8e6')).join('') +
      Array.from({ length: 6 }, (_, i) => R(b[0], b[1], (i % 2) * (THR[0] + 0.05), 3 * big.WALL + 0.1 + Math.floor(i / 2) * 0.8, THR[0], THR[1], '#fff8e6')).join('')],
    ['Board 9: 2 floors, 6 arch trims,', '5 ridge caps. Board 10: spare.', b => [0, 1].map(j => R(b[0], b[1], 0, j * flW, flD, flW)).join('') +
      Array.from({ length: 6 }, (_, i) => U(b[0], b[1], flD + 0.2 + (i % 2) * (uSize(big).w + 0.1), Math.floor(i / 2) * (uSize(big).h + 0.1))).join('') +
      Array.from({ length: 5 }, (_, i) => R(b[0], b[1], flD + 0.2, 3 * (uSize(big).h + 0.1) + i * 0.52, ROOF_W, RIDGE_W, '#fff8e6')).join('')],
  ];
  p2 += T(X0, Y0 - 0.3, `Cut plan: 10 boards of 16 x 20" (drawn at 1:10)`, { size: 0.13, w: 700 });
  boards.forEach(([l1, l2, fn], i) => { const bx = X0 + (i % 2) * cw, by = Y0 + Math.floor(i / 2) * rh;
    p2 += `<rect x="${bx}" y="${f2(by)}" width="${bw * k}" height="${bh * k}" fill="#fff" stroke="#111" stroke-width="0.01"/>` + fn([bx, by]) + T(bx, by + bh * k + 0.2, l1, { size: 0.1, w: 700 }) + T(bx, by + bh * k + 0.36, l2, { size: 0.1 }); });
  const ty = Y0 + 2 * rh + 0.05;
  ['Measure each board first: boards 1-6 need the full 16.0"', '(gable 8.5 + roof 7.5). Raised paws come from the doors', 'cut out of the fronts. Cream = trim parts.']
    .forEach((t, i) => { p2 += T(X0, ty + i * 0.17, t, { size: 0.1 }); });
}

// ---- page 3: paw templates ----
const pawT = (x, y, sz, title, use, use2) => `<g stroke="#111" stroke-width="0.015" fill="none">${paw(x, y + sz * 0.55, sz, 'none')}</g>` + T(x, y + sz + 0.22, title, { a: 'middle', size: 0.15, w: 700 }) + T(x, y + sz + 0.42, use, { a: 'middle', size: 0.12 }) + (use2 ? T(x, y + sz + 0.6, use2, { a: 'middle', size: 0.12 }) : '');
let p3 = pawT(1.95, 0.1, 3.6, '3.6" paw', `black glitter cardstock: hoop ornaments (cut ${NHOOP})`, 'stencil: giant doghouse gable (option)')
  + pawT(5.75, 0.1, TOPPAW_IN, `${TOPPAW_IN}" paw (5 pieces: pad + 4 toes)`, `black felt: topper bow (cut ${TOPPAWS}),`, 'holiday toy (cut 1)')
  + T(5.75, 0.1 + TOPPAW_IN + 0.78, `streamers option: ${NSTREAM} more;`, { a: 'middle', size: 0.12 }) + T(5.75, 0.1 + TOPPAW_IN + 0.96, 'stencil: wood-round ornaments (option)', { a: 'middle', size: 0.12 })
  + pawT(2.45, 4.45, 4.5, '4.5" paw', 'black felt: bone pillow (cut 1)')
  + pawT(6.2, 4.75, 1.0, '1" paw', NCUFF ? `black felt: stocking cuffs (cut ${NCUFF})` : 'black felt: stocking cuffs', 'stencil: 4.3" doghouse gable (option)');
p3 += check(5.7, 7.6, 'b');

// ---- page 4: 9" bone at board proportions, 2.7" biscuit ----
// knob span = spanR x L, shaft = shaftR x L, four round lobes (two circles per end that overlap enough to leave a clear notch).
// inset > 0 shrinks the lobes and shaft by that much with the same knob centres: the foil-core line (1/4" inside, BONE_HOW step 1).
function boneGeo(L, spanR = SPAN_R, shaftR = SHAFT_R, inset = 0) { const H = spanR * L, R0 = 0.29 * H, b = H / 2 - R0, a = L / 2 - R0, r = R0 - inset, h = shaftR * L / 2 - inset;
  if (r <= b + 0.02) return null;
  return { H, r, b, a, h, q: Math.sqrt(r * r - b * b), s: Math.sqrt(r * r - (h - b) ** 2), mark: -b - 0.45 * R0 }; }
const bonePath = (g, cx, cy) => { const P = (px, py) => `${f2(cx + px)} ${f2(cy + py)}`, A = `A ${f2(g.r)} ${f2(g.r)} 0 1 1`;
  return `M ${P(-g.a - g.q, 0)} ${A} ${P(-g.a + g.s, -g.h)} L ${P(g.a - g.s, -g.h)} ${A} ${P(g.a + g.q, 0)} ${A} ${P(g.a - g.s, g.h)} L ${P(-g.a + g.s, g.h)} ${A} ${P(-g.a - g.q, 0)} Z`; };
// marks: the red wire-anchor / drill marks in the two upper knobs, on one level line (BONE_HOW steps 1 and 4); core: the dashed foil-core line
function bone(x, y, L, o = {}) {
  const g = boneGeo(L, o.spanR, o.shaftR), cx = x + L / 2, cy = y + g.H / 2;
  let out = `<path d="${bonePath(g, cx, cy)}" ${cut}/>`;
  const gc = o.core && boneGeo(L, o.spanR, o.shaftR, 0.25);
  if (gc) out += `<path d="${bonePath(gc, cx, cy)}" ${dash}/>` + T(cx, cy + 0.05, 'dashed: foil core, 1/4" inside the outline', { a: 'middle', size: 0.1, c: '#666' });
  if (o.marks) {
    const my = cy + g.mark;
    [-1, 1].forEach(sx => { const mx = cx + sx * g.a;
      out += `<circle cx="${f2(mx)}" cy="${f2(my)}" r="0.09" fill="none" stroke="#c00" stroke-width="0.012"/><path d="M ${f2(mx - 0.16)} ${f2(my)} H ${f2(mx + 0.16)} M ${f2(mx)} ${f2(my - 0.16)} V ${f2(my + 0.16)}" stroke="#c00" stroke-width="0.008"/>` +
        T(mx, my + 0.3, 'wire anchor:', { a: 'middle', size: 0.1, c: '#c00' }) + T(mx, my + 0.43, 'drill here', { a: 'middle', size: 0.1, c: '#c00' }); });
    out += `<path d="M ${f2(cx - g.a)} ${f2(my)} H ${f2(cx + g.a)}" stroke="#c00" stroke-width="0.006" stroke-dasharray="0.05 0.05"/>` + T(cx, my - 0.06, 'both marks on this line: the bone hangs level', { a: 'middle', size: 0.1, c: '#c00' });
  }
  return out;
}
const BISC_SPAN_R = BISC_SPAN / BISC_L, BISC_SHAFT_R = 0.5 * BISC_SPAN_R;   // a cutter biscuit: slimmer knobs, shaft half the knob span
const B9 = boneGeo(BONE_L), BB = boneGeo(BISC_L, BISC_SPAN_R, BISC_SHAFT_R);
const in1 = v => +v.toFixed(1);
let p4 = bone(0.4, 0.25, BONE_L, { marks: true, core: true });
const b9y = 0.25 + B9.H;
p4 += check(0.4, b9y + 0.22, 'b');
[[`${BONE_L}" bone (make ${NBONE}), about ${BONE_T}" thick`, 0.13, 700],
 [`Knob span ${in1(B9.H)}", shaft ${in1(SHAFT_R * BONE_L)}": the board's proportions, four round knobs.`],
 ['Core: scrunch foil to the dashed line, about 1/2" thick, a firm ball in each knob.'],
 ['Red marks = wire anchors: wrap the tail of a 4" floral-wire loop round the foil'],
 ['in each upper knob, with the loop just under the surface at the mark.'],
 ['Clay: cover the core with a 1/4" sheet; shape it to the solid outline, flat-faced shaft.'],
 ['Hang, after drying and painting: drill each red mark with a toothpick down to the'],
 ['anchor, 3/4" deep. Knot each end of a 50 cm gold cord twice, fill each hole with hot'],
 ['glue and push one knot into each: two cords from the upper knobs, so it hangs level.']]
  .forEach(([t, sz, w], i) => { p4 += T(1.85, b9y + 0.36 + i * 0.175 + (i ? 0.04 : 0), t, { size: sz || 0.115, w: w || 400 }); });
{ const bx = 10.05 - BISC_L, by = b9y + 0.3, mx = bx + BISC_L / 2, ly = by + BB.H + 0.25;
  p4 += bone(bx, by, BISC_L, { spanR: BISC_SPAN_R, shaftR: BISC_SHAFT_R }) +
    [[`${BISC_L}" biscuit (the cutter's size)`, 700], ['only if there is no bone cutter:'], ['trace onto the 1/4" clay sheet'], ['and cut with the knife.']]
      .map(([t, w], i) => T(mx, ly + i * 0.17, t, { a: 'middle', size: 0.11, w: w || 400 })).join(''); }

// ---- page 5: option 4.3" doghouse with its trims ----
const sBH = DHS.brick_h || 0.4, sBL = DHS.brick_l || 0.7, sSideW = small.D - 2 * T16, sFlW = small.W - 2 * T16;
let p5 = front(small, 0.2, 0.4, sBH, sBL) + T(0.2 + small.W / 2, 0.4 + small.RIDGE + 0.25, 'FRONT (cut the door); BACK: trace it without the door', { a: 'middle', size: 0.11 });
p5 += roofScore(4.2, 0.4, small.D + 2 * small.over, small.SL, 0.55, 0.65) + `<rect x="4.2" y="0.4" width="${small.D + 2 * small.over}" height="${f2(small.SL)}" ${cut}/>` +
  T(4.2 + (small.D + 2 * small.over) / 2, 0.4 + small.SL / 2, 'ROOF x2', { a: 'middle', size: 0.12, w: 700, halo: 1 }) + T(4.2 + (small.D + 2 * small.over) / 2, 0.4 + small.SL / 2 + 0.18, 'eave at the bottom', { a: 'middle', size: 0.1, halo: 1 });
{ const bg = barge(small, 4.2, 3.35, 0.3); p5 += `<path d="${bg.d}" ${cut}/>` + T(4.2 + bg.L + 0.1, 3.57, 'BARGE x2', { size: 0.1, w: 700 }); }
p5 += `<rect x="4.2" y="3.95" width="${small.D + 2 * small.over}" height="0.25" ${cut}/>` + T(4.2 + (small.D + 2 * small.over) / 2, 4.12, 'RIDGE CAP x2', { a: 'middle', size: 0.1, w: 700 });
const sThr = [small.door[0] + 2 * small.trim, 0.4];
p5 += `<rect x="4.2" y="4.45" width="${sThr[0]}" height="${sThr[1]}" ${cut}/>` + T(4.2 + sThr[0] + 0.1, 4.7, 'THRESHOLD x1', { size: 0.1, w: 700 });
p5 += `<rect x="4.2" y="5.0" width="${small.WALL}" height="0.22" ${cut}/>` + T(4.2 + small.WALL + 0.1, 5.15, 'CORNER TRIM x4', { size: 0.1, w: 700 });
p5 += bricks(`M 0.2 5.45 h ${sSideW} v ${small.WALL} h ${-sSideW} Z`, 0.2, 0.2 + sSideW, 5.45 + small.WALL, 5.45, 0.2 + sSideW / 2, sBH, sBL) +
  `<rect x="0.2" y="5.45" width="${sSideW}" height="${small.WALL}" ${cut}/>` + T(0.2 + sSideW / 2, 5.45 + small.WALL / 2, 'SIDE x2', { a: 'middle', size: 0.12, w: 700, halo: 1 });
p5 += `<rect x="3.0" y="5.45" width="${sSideW}" height="${sFlW}" ${cut}/>` + T(3.0 + sSideW / 2, 5.45 + sFlW / 2, 'FLOOR', { a: 'middle', size: 0.12, w: 700 });
{ const u = uSize(small); p5 += `<path d="${uPath(small, 5.65, 5.6)}" ${cut}/>` + T(5.65 + u.w / 2, 5.6 + u.h + 0.2, 'ARCH TRIM x1', { a: 'middle', size: 0.1, w: 700 }) + T(5.65 + u.w / 2, 5.6 + u.h + 0.36, '(one flat U)', { a: 'middle', size: 0.1 }); }
p5 += check(0.2, 8.3);
p5 += T(3.0, 8.85, `Trims 0.22" wide: cream, ridge caps barn red. Bricks: courses ${sBH}", staggered.`, { size: 0.1 }) + T(3.0, 9.02, 'Gable paw: cut a drafting-film stencil of the 1" paw (page 3); sponge-dab cream.', { size: 0.1 });

// ---- page 6: option giant doghouse door (true size) ----
let p6 = `<path d="M 1.25 9.3 L 1.25 7.9 A 5 5 0 0 1 6.25 2.9" fill="none" stroke="#111" stroke-width="0.015"/>`;
p6 += `<line x1="1.25" y1="7.9" x2="6.25" y2="7.9" ${dash}/><line x1="6.25" y1="2.9" x2="6.25" y2="9.3" ${dash}/>` + T(1.45, 7.7, 'SPRING LINE: 8" above the floor', { size: 0.11 }) +
  T(1.45, 8.45, 'Giant doghouse door: left half of the 10"-wide arch,', { size: 0.12, w: 700 }) + T(1.45, 8.65, 'true size. Flip for the right half. The straight', { size: 0.12 }) + T(1.45, 8.85, 'side runs on down to the floor: 13" tall in all.', { size: 0.12 }) + check(0.2, 0.2);
// ---- page 7: option giant doghouse cut plan (1:7) ----
const k = 1 / 7; let p7 = '';
const box = (x, y, w, h, label, sub) => `<rect x="${x}" y="${y}" width="${f2(w * k)}" height="${f2(h * k)}" ${cut}/>` + T(x + w * k / 2, y + h * k / 2, label, { a: 'middle', size: 0.13, w: 700 }) + T(x + w * k / 2, y + h * k / 2 + 0.17, sub, { a: 'middle', size: 0.11 });
p7 += T(0.2, 0.3, 'BOX A (24 x 20 x 20") becomes the walls and floor', { size: 0.15, w: 700 });
p7 += box(0.2, 0.5, 24, 16, 'FRONT 24 x 16', 'door 10 x 13 centred') + `<path d="${arch(0.2 + (12 - 5) * k, 0.5 + (16 - 13) * k, 10 * k, 13 * k)}" ${cut}/>`;
p7 += box(3.8, 0.5, 24, 16, 'BACK 24 x 16', '') + box(0.2, 3.2, 20, 16, 'SIDE 20 x 16', '') + box(3.3, 3.2, 20, 16, 'SIDE 20 x 16', '');
p7 += T(0.2, 5.85, 'Cut all four walls down to 16" (remove the top 4" and the top flaps). Keep the bottom flaps taped shut as the floor.', { size: 0.12 });
p7 += T(0.2, 6.2, 'BOX B (24 x 20 x 20") becomes the roof, gables, shingles and sign', { size: 0.15, w: 700 });
p7 += `<path d="M 0.2 ${f2(6.4 + 10 * k)} L ${f2(0.2 + 24 * k)} ${f2(6.4 + 10 * k)} L ${f2(0.2 + 12 * k)} 6.4 Z" ${cut}/>` + T(0.2 + 12 * k, 6.4 + 10 * k + 0.2, 'GABLE x2 (24 x 10, from the long flaps)', { a: 'middle', size: 0.11 });
p7 += box(3.8, 6.4, 24, 17.6, 'ROOF x2', '24 x 17.6 (from the 24 x 20 sides)');
p7 += check(0.3, 8.15);
p7 += T(0.2, 9.35, 'Shingles: 3"-wide strips from the remaining flaps, 1" overlap per course. Sign backing 16 x 4 from a 20 x 20 side.', { size: 0.12 });
p7 += T(0.2, 9.55, 'Sign: centre it on the front with its top edge 18.5" above the floor (its bottom 1.5" overlaps the wall), so its corners clear the roof.', { size: 0.12, w: 700 });

// ---- page 8: 10" doghouse trims and small parts ----
let p8 = `<rect x="0.1" y="0.3" width="${ROOF_W}" height="${RIDGE_W}" ${cut}/>` + T(0.1 + ROOF_W / 2, 0.59, `RIDGE CAP x2 per house (${RIDGE_W} x ${ROOF_W}")`, { a: 'middle', size: 0.12, w: 700 }) +
  T(0.1, 1.0, 'Glue the two strips edge to edge as a peak over the ridge; paint barn red with a touch of sienna.', { size: 0.11 });
const bg8 = barge(big, 0.1, 1.35, BARGE_W);
p8 += `<path d="${bg8.d}" ${cut}/>` + T(0.25 + bg8.L / 2, 1.35 + BARGE_W / 2 + 0.045, `BARGE BOARD x2 per house (${BARGE_W} x ${bg8.L.toFixed(2)}")`, { a: 'middle', size: 0.12, w: 700 }) +
  T(0.1, 2.17, 'eave end (square)', { size: 0.1, c: '#555' }) + T(0.1 + bg8.L, 2.17, 'peak end (plumb cut)', { a: 'end', size: 0.1, c: '#555' }) +
  T(0.1, 2.37, 'Cut 2 from this outline (flip one over). Glue along the front edge of each roof panel, top edges flush; the plumb ends meet at the peak.', { size: 0.11 });
p8 += `<rect x="0.1" y="2.65" width="${THR[0]}" height="${THR[1]}" ${cut}/>` + [1, 2].map(i => `<line x1="${f2(0.1 + i * THR[0] / 3)}" y1="2.65" x2="${f2(0.1 + i * THR[0] / 3)}" y2="${2.65 + THR[1]}" ${dash}/>`).join('') +
  T(0.1 + THR[0] + 0.15, 2.85, `THRESHOLD x1 (${THR[0]} x ${THR[1]}")`, { size: 0.12, w: 700 }) + T(0.1 + THR[0] + 0.15, 3.03, 'score the 2 dashed plank lines', { size: 0.11 }) +
  T(0.1, 3.62, `Glue it flat at the foot of the front wall under the door: back edge against the wall, top level with the floor,`, { size: 0.11 }) +
  T(0.1, 3.79, `so it sticks out ${THR[1]}" in front. The arch trim's legs stand on it.`, { size: 0.11 });
const u8 = uSize(big), uX = 0.1, uY = 4.1;
p8 += `<path d="${uPath(big, uX, uY)}" ${cut}/>` +
  ['DOOR ARCH TRIM x1', 'cut as one flat U', `${u8.w} wide x ${u8.h.toFixed(2)}" tall,`, `${big.trim}" wide all round;`, 'inner edge = the door,', 'legs stand on the', 'threshold'].map((t, i) => T(uX + u8.w / 2, uY + 1.75 + i * 0.19, t, { a: 'middle', size: i ? 0.11 : 0.12, w: i ? 400 : 700 })).join('');
const px8 = 6.3, py8 = 4.0;
p8 += `<g stroke="#111" stroke-width="0.015" fill="none">${paw(px8, py8 + 2.5 * 0.55, 2.5, 'none')}</g>` +
  ['RAISED GABLE PAW (2.5")', '5 pieces: pad + 4 toes.', 'Cut from the door piece you', 'removed from the front; paint', 'cream; glue on at the dotted', 'paw on page 1.'].map((t, i) => T(px8, py8 + 2.75 + i * 0.18, t, { a: 'middle', size: i ? 0.11 : 0.12, w: i ? 400 : 700 })).join('');
p8 += check(5.1, 7.95);
p8 += T(0.1, 9.3, `Per house: 1 arch trim, 2 barge boards, 1 threshold, 2 ridge caps, 1 paw (make ${NH} sets). Corner trims: page 2. Cream, ridge caps barn red.`, { size: 0.11, w: 700 });

// ---- page 9: hoop back circle (felt) and the 5" bone option ----
let p9 = `<circle cx="3.2" cy="3.2" r="3" ${cut}/><circle cx="3.2" cy="3.2" r="0.04" fill="#111"/>` +
  T(3.2, 3.55, 'BACK CIRCLE, 6"', { a: 'middle', size: 0.15, w: 700 }) + T(3.2, 3.77, `black felt: cut ${NHOOP}, one per hoop ornament`, { a: 'middle', size: 0.12 }) +
  T(3.2, 3.97, 'hot-glue it to the back edge of the inner ring', { a: 'middle', size: 0.12 }) + T(3.2, 4.15, 'over the trimmed Aida', { a: 'middle', size: 0.12 });
p9 += check(6.45, 0.25, 'b');
p9 += T(0.2, 6.6, 'Option: 5" bone', { size: 0.15, w: 700 });
p9 += bone(0.2, 6.75, 5, { marks: true });
[`Make ${NBONE5} if the 5" option is`, `chosen, about ${BONE5_T === 0.75 ? '3/4' : BONE5_T}" thick. Same build`, 'as the 9" bone (page 4): foil', 'core 1/4" thick, a wire anchor', 'at each red mark, then drill', 'and glue in the 50 cm gold', 'cord after painting.'].forEach((t, i) => { p9 += T(5.45, 7.0 + i * 0.19, t, { size: 0.11 }); });

const css = `@page { size: Letter; margin: 0.3in 0.4in; } @page tabloid { size: 11in 17in; margin: 0.25in 0.3in; } @page land { size: 11in 8.5in; margin: 0.3in 0.4in; }
.tab { page: tabloid; } .land { page: land; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #222; } .pg { break-after: page; } .pg:last-child { break-after: auto; }
h1 { font-size: 15pt; margin: 0 0 2pt; } p { font-size: 9.5pt; margin: 0 0 6pt; color: #444; } svg { display: block; }`;
const PAGES = [
  page('tab', `1. Doghouse ornament, 10" (make ${NH}): front, back, sides. Print on 11 x 17.`, 'Tape it to 3/16" foam board and cut on the flattened moving box with a fresh blade against the steel ruler (mark in pencil). Score the grey brick lines through the paper with the empty ballpoint before painting. Trims, threshold, barge boards, ridge caps and the raised paw: page 8.', 10.4, 15.6, p1),
  page('tab', '2. Doghouse ornament, 10" (continued): roof, floor, corner trims, cut plan. Print on 11 x 17.', 'Sides fit between the front and back; the floor fits inside all four walls. Roof panels overhang 3/4" at the front, back and eaves. Score the roof board lines with the empty ballpoint. Trims: cream (ridge caps barn red), glued on after the walls are red.', 10.4, 15.6, p2),
  page('', '3. Paw templates and stencils, true size', 'Each paw is 5 pieces (pad + 4 toes). Felt: trace with the white fabric marker (or tape the paper paw on and cut round it) and cut with scissors. Glitter card: trace on the back in pencil. Stencils (options only): cut the paw from drafting film with the art knife and sponge-dab paint through it.', 7.7, 9.5, p3),
  page('land', '4. Clay bone and biscuit, true size', `Foam clay over a foil core, so each bone stays light (about ${Math.round(BONE_T * 100) / 100}" thick). The 5" bone option is on page 9.`, 10.2, 7.3, p4),
  page('', `5. Option: 4.3" doghouse ornament (make ${NHS}), true size`, 'Only if the smaller doghouses are chosen in the swap list. Same build as the 10" version (pages 1, 2 and 8), with these smaller trims.', 7.7, 9.6, p5),
  page('', '6. Option: giant doghouse door, true size', 'Only if the giant doghouse is chosen. Trace onto the 24" front wall of box A, centred, bottom on the floor line.', 7.7, 9.5, p6),
  page('', '7. Option: giant doghouse cut plan (drawn at 1:7)', 'Finished size 24" wide x 20" deep x 26" to the ridge. All dimensions in inches.', 7.7, 9.7, p7),
  page('', '8. Doghouse ornament, 10": trims and small parts, true size', `Cut from foam-board offcuts (see the cut plan on page 2), ${NH} sets. Paint cream (the ridge cap barn red) and glue on after the walls are red.`, 7.7, 9.5, p8),
  page('', '9. Hoop ornament back circle, and the 5" bone option, true size', 'Trace the circle onto the black felt with the white fabric marker and cut with scissors: two circles per 9 x 12" sheet.', 7.7, 9.5, p9),
];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>\n${PAGES.join('\n')}\n</body></html>`;
const signSvg = `<svg width="16in" height="4in" viewBox="0 0 16 4"><rect width="16" height="4" fill="#ecdcb6"/><rect x="0.2" y="0.2" width="15.6" height="3.6" fill="none" stroke="#8b1a1f" stroke-width="0.12"/>
${paw(1.3, 2.05, 1.5, '#1d4a35', -18)}${paw(14.7, 2.05, 1.5, '#1d4a35', 18)}
<text x="8" y="1.55" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="0.95" fill="#1d4a35">Home for the</text>
<text x="8" y="3.25" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="1.6" fill="#8b1a1f" letter-spacing="0.06">HOWLIDAYS</text></svg>`;
const signHtml = `<!doctype html><html><head><meta charset="utf-8"><style>@page { size: 17in 11in; margin: 0.5in; } body { margin: 0; font-family: Arial, sans-serif; } svg { display: block; }</style></head><body>
<p style="font-size:11pt;margin:0 0 0.3in">Giant doghouse sign (option), 16 x 4 inches. Print on 11 x 17 at "Actual size", trim on the outer edge, and glue to cardboard with Mod Podge (then a coat on top). Glue it centred on the front with its top edge 18.5" above the floor, so its corners clear the roof overhang.</p>${signSvg}
<svg width="4in" height="1.2in" viewBox="0 0 4 1.2" style="margin-top:0.4in">${check(0.05, 0.1)}</svg></body></html>`;

const countPages = f => (fs.readFileSync(f, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const out = path.join(ROOT, 'output', 'HP26_Templates.pdf'), sign = path.join(ROOT, 'output', 'HP26_Doghouse_Sign_11x17.pdf');
  await pg.setContent(html);
  const issues = await pg.evaluate(() => { const out = [];
    document.querySelectorAll('section.pg').forEach((sec, i) => {
      const svg = sec.querySelector('svg'), R = svg.getBoundingClientRect(), texts = [];
      svg.querySelectorAll('path,rect,circle,ellipse,line,text').forEach(e => { if (e.closest('clipPath')) return; const r = e.getBoundingClientRect();
        if (r.left < R.left - 1 || r.top < R.top - 1 || r.right > R.right + 1 || r.bottom > R.bottom + 1) out.push(`page ${i + 1}: ${e.tagName} "${(e.textContent || '').slice(0, 40)}" runs off the page`);
        if (e.tagName === 'text') texts.push([r, e.textContent]); });
      const cuts = [...svg.querySelectorAll('.cut')].map(e => [e.getBoundingClientRect(), e.tagName]);
      const ov = (p, q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1;
      const inside = (p, q) => p.left >= q.left - 1 && p.right <= q.right + 1 && p.top >= q.top - 1 && p.bottom <= q.bottom + 1;
      for (let a = 0; a < cuts.length; a++) { const [p] = cuts[a];
        for (let b = a + 1; b < cuts.length; b++) { const [q] = cuts[b]; if (ov(p, q) && !inside(p, q) && !inside(q, p)) out.push(`page ${i + 1}: two cut outlines overlap (${cuts[a][1]} and ${cuts[b][1]})`); }
        texts.forEach(([q, t]) => { if (ov(p, q) && !inside(q, p)) out.push(`page ${i + 1}: "${t.slice(0, 30)}" crosses a cut line`); }); }
      for (let a = 0; a < texts.length; a++) for (let b = a + 1; b < texts.length; b++) { const [p, t1] = texts[a], [q, t2] = texts[b];
        if (Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1) out.push(`page ${i + 1}: "${t1.slice(0, 30)}" overlaps "${t2.slice(0, 30)}"`); }
    }); return out; });
  if (issues.length) { console.error('templates: layout problems\n  ' + issues.join('\n  ')); process.exit(1); }
  await pg.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  await pg.setContent(signHtml); await pg.pdf({ path: sign, preferCSSPageSize: true, printBackground: true });
  await b.close();
  const n = countPages(out), ns = countPages(sign);   // a page that overflows spills onto an extra sheet, so the counts catch it
  if (n !== PAGES.length || ns !== 1) { console.error(`templates: expected ${PAGES.length} + 1 pages, got ${n} + ${ns} (something overflows a page)`); process.exit(1); }
  console.log(`templates ok (${n} pages + sign)`);
})();
