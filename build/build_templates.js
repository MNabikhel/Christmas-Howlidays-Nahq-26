/* Printable templates at true size (print at 100% / "Actual size", never "Fit to page").
   output/HP26_Templates.pdf:
     1-2  10" doghouse ornament (11 x 17)          3  paw templates and stencils (Letter)
     4    9" clay bone, and the 5" option (Letter landscape)
     5-6  option: 4.3" doghouse ornament (Letter)  7-8  option: giant doghouse door and cut plan (Letter)
   output/HP26_Doghouse_Sign_11x17.pdf: the 16 x 4" sign for the giant doghouse option.
   Needs Playwright (used only here); if it is not installed the committed PDFs are kept. */
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'supplies.json'), 'utf8'));
const O = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'options.json'), 'utf8'));
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('templates: playwright not installed, keeping existing PDFs'); process.exit(0); }

const paw = (cx, cy, s, fill = '#111', rot = 0) => {
  const e = (x, y, rx, ry, r) => `<ellipse cx="${(x * s).toFixed(3)}" cy="${(y * s).toFixed(3)}" rx="${(rx * s).toFixed(3)}" ry="${(ry * s).toFixed(3)}" transform="rotate(${(r * 57.3).toFixed(1)} ${(x * s).toFixed(3)} ${(y * s).toFixed(3)})"/>`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})" fill="${fill}">${e(0, 0.2, 0.32, 0.26, 0)}${e(-0.36, -0.14, 0.12, 0.16, -0.4)}${e(-0.13, -0.38, 0.12, 0.16, -0.12)}${e(0.13, -0.38, 0.12, 0.16, 0.12)}${e(0.36, -0.14, 0.12, 0.16, 0.4)}</g>`;
};
const T = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 0.13}" font-weight="${o.w || 400}" text-anchor="${o.a || 'start'}" fill="${o.c || '#222'}" font-family="Arial, Helvetica, sans-serif">${t}</text>`;
const page = (cls, title, note, w, h, svg) => `<section class="pg ${cls}"><h1>${title}</h1><p>${note}</p><svg width="${w}in" height="${h}in" viewBox="0 0 ${w} ${h}">${svg}</svg></section>`;
const cut = 'fill="none" stroke="#111" stroke-width="0.012"', dash = 'fill="none" stroke="#888" stroke-width="0.01" stroke-dasharray="0.06 0.05"';
const arch = (x, y, w, h) => `M ${x} ${y + h} L ${x} ${y + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} L ${x + w} ${y + h}`;   // y = top of arch
const inch = (x, y) => `<line x1="${x}" y1="${y}" x2="${x + 1}" y2="${y}" stroke="#c00" stroke-width="0.02"/>` + T(x + 1.1, y + 0.04, 'Check: this red line is 1 inch. If not, reprint at "Actual size".', { size: 0.11, c: '#c00' });
const T16 = 0.1875;
const dh = id => { const o = O.elements.find(e => e.id === 'doghouses').options.find(x => x.id === id); return o.render; };

// ---- doghouse ornament parts at true size: front (door + paw) and floor; roof, side, trims ----
function doghouse(r, door, pawIn, over) {
  const { w: W, d: D, wall: WALL, ridge: RIDGE } = r, SL = Math.hypot(W / 2, RIDGE - WALL) + over;
  const gable = (x, y) => `M ${x} ${y + RIDGE} L ${x + W} ${y + RIDGE} L ${x + W} ${y + RIDGE - WALL} L ${x + W / 2} ${y} L ${x} ${y + RIDGE - WALL} Z`;
  const front = (x, y) => `<path d="${gable(x, y)}" ${cut}/><path d="${arch(x + W / 2 - door[0] / 2, y + RIDGE - door[1], door[0], door[1])}" ${cut}/>` +
    `<g stroke="#999" stroke-width="0.008" fill="none">${paw(x + W / 2, y + (RIDGE - WALL) * 0.62, pawIn, 'none')}</g>`;
  return { W, D, WALL, RIDGE, SL, gable, front };
}
const big = doghouse(dh('diy10'), [3.8, 4.6], 2.5, 0.75), small = doghouse(dh('diy43'), [1.3, 1.75], 1.0, 0.35);
let p1 = big.front(0.2, 0.2) + T(0.2 + big.W / 2, 0.2 + big.RIDGE + 0.3, 'FRONT: cut out the arched door. BACK: trace this outline again without the door.', { a: 'middle', size: 0.14, w: 700 });
p1 += `<rect x="0.2" y="${big.RIDGE + 0.75}" width="${big.D - 2 * T16}" height="${big.WALL}" ${cut}/>` + T(0.2 + (big.D - 2 * T16) / 2, big.RIDGE + 0.75 + big.WALL / 2, 'SIDE x2', { a: 'middle', size: 0.15, w: 700 });
p1 += `<line x1="6.4" y1="${big.RIDGE + 1.2}" x2="7.4" y2="${big.RIDGE + 1.2}" stroke="#c00" stroke-width="0.02"/>` + T(6.4, big.RIDGE + 1.45, 'Must measure 1 inch;', { size: 0.12, c: '#c00' }) + T(6.4, big.RIDGE + 1.62, 'else reprint at "Actual size".', { size: 0.12, c: '#c00' });
let p2 = `<rect x="0.2" y="0.2" width="${big.D + 1.5}" height="${big.SL}" ${cut}/>` + T(0.2 + (big.D + 1.5) / 2, 0.2 + big.SL / 2, 'ROOF x2 (score shingle rows across)', { a: 'middle', size: 0.15, w: 700 }) +
  T(0.2 + (big.D + 1.5) / 2, 0.2 + big.SL / 2 + 0.22, `${(big.D + 1.5).toFixed(1)} x ${big.SL.toFixed(2)}": overhangs 3/4" all round`, { a: 'middle', size: 0.12 });
p2 += `<rect x="0.2" y="${big.SL + 0.6}" width="${big.W - 2 * T16}" height="${big.D - 2 * T16}" ${cut}/>` + T(0.2 + (big.W - 2 * T16) / 2, big.SL + 0.6 + (big.D - 2 * T16) / 2, 'FLOOR', { a: 'middle', size: 0.15, w: 700 });
[[8.2, 0.2, 0.5, big.WALL, 'corner trim x4'], [9.2, 0.2, 0.5, 2 * 4.6 + 3.8, 'door arch trim x1 (bend round the arch)']].forEach(([x, y, w, h, l]) => {
  p2 += `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${cut}/>` + `<text x="${x + 0.32}" y="${y + 0.2}" font-size="0.12" font-family="Arial" transform="rotate(90 ${x + 0.32} ${y + 0.2})">${l}</text>`; });
p2 += T(0.2, big.SL + big.D + 0.9, 'Make 6 of everything (12 roof panels, 12 sides). Trims: cut from the foam-board offcuts, paint cream, glue on after the walls are red.', { size: 0.13 });
p2 += inch(0.2, big.SL + big.D + 1.4);

// ---- paw templates ----
const pawT = (x, y, sz, title, use) => `<g stroke="#111" stroke-width="0.015" fill="none">${paw(x, y + sz * 0.55, sz, 'none')}</g>` + T(x, y + sz + 0.22, title, { a: 'middle', size: 0.15, w: 700 }) + T(x, y + sz + 0.42, use, { a: 'middle', size: 0.12 });
let p3 = pawT(1.85, 0.1, 3.6, '3.6" paw', 'black glitter cardstock: paw ornaments (cut 10)') + pawT(5.6, 0.5, 2.2, '2.2" paw', 'black felt: topper bow (cut 20)')
  + pawT(1.6, 4.5, 2.5, '2.5" paw', 'stencil: 10" doghouse gables (cream)') + pawT(5.45, 3.7, 4.5, '4.5" paw', 'black felt: bone pillow (cut 1)') + pawT(1.6, 7.45, 1.5, '1.5" paw', 'stencil: bowl (white paint marker)');
p3 += inch(2.7, 9.35);
// ---- bones ----
const bone = (x, y, L) => { const H = L * 0.36, r = H * 0.3, sh = H * 0.28; return `<g ${cut}><rect x="${x + L * 0.14}" y="${y + H / 2 - sh}" width="${L * 0.72}" height="${2 * sh}" rx="${sh * 0.9}"/>${[[0.14, 0.29], [0.14, 0.71], [0.86, 0.29], [0.86, 0.71]].map(([a, b]) => `<circle cx="${x + L * a}" cy="${y + H * b}" r="${r}"/>`).join('')}</g>`; };
let p4 = bone(0.4, 0.3, 9) + T(0.4, 0.3 + 9 * 0.36 + 0.35, '9" bone (make 8): shape the clay over a foil core to this outline, about 1.3" thick', { size: 0.15, w: 700 });
p4 += bone(0.4, 4.6, 5) + T(0.4, 4.6 + 5 * 0.36 + 0.35, 'Option: 5" bone (make 24), about 1" thick', { size: 0.13 }) + inch(0.4, 7.2);

// ---- option: 4.3" doghouse (the earlier size) ----
let p5 = small.front(0.2, 0.4) + T(0.2 + small.W / 2, 0.4 + small.RIDGE + 0.28, 'FRONT (cut the door); BACK: trace it without the door', { a: 'middle', size: 0.11 });
p5 += `<rect x="4.2" y="0.4" width="${small.D + 0.7}" height="${small.SL}" ${cut}/>` + T(4.2 + (small.D + 0.7) / 2, 0.4 + small.SL / 2, 'ROOF x2', { a: 'middle', size: 0.12, w: 700 });
p5 += `<rect x="0.2" y="5.1" width="${small.D - 2 * T16}" height="${small.WALL}" ${cut}/>` + T(0.2 + (small.D - 2 * T16) / 2, 5.1 + small.WALL / 2, 'SIDE x2', { a: 'middle', size: 0.12, w: 700 });
p5 += `<rect x="3.0" y="5.1" width="${small.D - 2 * T16}" height="${small.W - 2 * T16}" ${cut}/>` + T(3.0 + (small.D - 2 * T16) / 2, 5.1 + (small.W - 2 * T16) / 2, 'FLOOR', { a: 'middle', size: 0.12, w: 700 });
p5 += inch(0.2, 9.0);

// ---- option: giant doghouse door + cut plan ----
let p7 = `<path d="M 1.25 9.3 L 1.25 7.9 A 5 5 0 0 1 6.25 2.9" fill="none" stroke="#111" stroke-width="0.015"/>`;
p7 += `<line x1="1.25" y1="7.9" x2="6.25" y2="7.9" ${dash}/><line x1="6.25" y1="2.9" x2="6.25" y2="9.3" ${dash}/>` + T(1.45, 7.7, 'SPRING LINE: 8" above the floor', { size: 0.11 }) +
  T(3.3, 8.45, 'Giant doghouse door: left half of the 10"-wide arch,', { size: 0.12, w: 700 }) + T(3.3, 8.65, 'true size. Flip for the right half. The straight', { size: 0.12 }) + T(3.3, 8.85, 'side runs on down to the floor: 13" tall in all.', { size: 0.12 }) + inch(0.2, 0.3);
const k = 1 / 7; let p8 = '';
const box = (x, y, w, h, label, sub) => `<rect x="${x}" y="${y}" width="${w * k}" height="${h * k}" ${cut}/>` + T(x + w * k / 2, y + h * k / 2, label, { a: 'middle', size: 0.13, w: 700 }) + T(x + w * k / 2, y + h * k / 2 + 0.17, sub, { a: 'middle', size: 0.11 });
p8 += T(0.2, 0.3, 'BOX A (24 x 20 x 20") becomes the walls and floor', { size: 0.15, w: 700 });
p8 += box(0.2, 0.5, 24, 16, 'FRONT 24 x 16', 'door 10 x 13 centred') + `<path d="${arch(0.2 + (12 - 5) * k, 0.5 + (16 - 13) * k, 10 * k, 13 * k)}" ${cut}/>`;
p8 += box(3.8, 0.5, 24, 16, 'BACK 24 x 16', '') + box(0.2, 3.2, 20, 16, 'SIDE 20 x 16', '') + box(3.3, 3.2, 20, 16, 'SIDE 20 x 16', '');
p8 += T(0.2, 5.85, 'Cut all four walls down to 16" (remove the top 4" and the top flaps). Keep the bottom flaps taped shut as the floor.', { size: 0.12 });
p8 += T(0.2, 6.2, 'BOX B (24 x 20 x 20") becomes the roof, gables, shingles and sign', { size: 0.15, w: 700 });
p8 += `<path d="M 0.2 ${6.4 + 10 * k} L ${0.2 + 24 * k} ${6.4 + 10 * k} L ${0.2 + 12 * k} 6.4 Z" ${cut}/>` + T(0.2 + 12 * k, 6.4 + 10 * k + 0.2, 'GABLE x2 (24 x 10, from the long flaps)', { a: 'middle', size: 0.11 });
p8 += box(3.8, 6.4, 24, 17.6, 'ROOF x2', '24 x 17.6 (from the 24 x 20 sides)');
p8 += T(0.2, 9.3, 'Shingles: 3"-wide strips from the remaining flaps, 1" overlap per course. Sign backing 16 x 4 from a 20 x 20 side.', { size: 0.12 });

const css = `@page { size: Letter; margin: 0.3in 0.4in; } @page tabloid { size: 11in 17in; margin: 0.25in 0.3in; } @page land { size: 11in 8.5in; margin: 0.3in 0.4in; }
.tab { page: tabloid; } .land { page: land; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #222; } .pg { break-after: page; } .pg:last-child { break-after: auto; }
h1 { font-size: 15pt; margin: 0 0 2pt; } p { font-size: 9.5pt; margin: 0 0 6pt; color: #444; }`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
${page('tab', '1. Doghouse ornament, 10" (make 6): front, back, sides. Print on 11 x 17.', 'Trace onto 3/16" foam board; cut with a fresh blade against the steel ruler. Score brick lines with a ballpoint pen before painting. The faint paw marks the 2.5" gable stencil.', 10.4, 15.6, p1)}
${page('tab', '2. Doghouse ornament, 10" (continued): roof, floor, trims. Print on 11 x 17.', 'Sides fit between the front and back; the floor fits inside all four walls. Roof panels overhang 3/4" at the front, back and eaves.', 10.4, 15.6, p2)}
${page('', '3. Paw templates and stencils, true size', 'Felt and glitter-card paws: trace onto the back and cut with scissors. Stencils: cut the paw out of drafting film with the art knife; dab paint through with a sponge and lift straight up. Options only: 1" (4.3" doghouses), 3" (wood rounds) and 3.6" (giant doghouse gable) use the same shape.', 7.7, 9.5, p3)}
${page('land', '4. Clay bones, true size', 'Shape over a scrunched-foil core so the bone stays light (about 75 g for the 9").', 10.2, 7.3, p4)}
${page('', '5. Option: 4.3" doghouse ornament (make 12), true size', 'Only if the smaller doghouses are chosen in the swap list. Same build as the 10" version; 1" gable paw.', 7.7, 9.6, p5)}
${page('', '6. Option: giant doghouse door, true size', 'Only if the giant doghouse is chosen. Trace onto the 24" front wall of box A, centred, bottom on the floor line.', 7.7, 9.5, p7)}
${page('', '7. Option: giant doghouse cut plan (drawn at 1:7)', 'Finished size 24" wide x 20" deep x 26" to the ridge. All dimensions in inches.', 7.7, 9.5, p8)}
</body></html>`;
const signSvg = `<svg width="16in" height="4in" viewBox="0 0 16 4"><rect width="16" height="4" fill="#ecdcb6"/><rect x="0.2" y="0.2" width="15.6" height="3.6" fill="none" stroke="#8b1a1f" stroke-width="0.12"/>
${paw(1.3, 2.05, 1.5, '#1d4a35', -18)}${paw(14.7, 2.05, 1.5, '#1d4a35', 18)}
<text x="8" y="1.55" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="0.95" fill="#1d4a35">Home for the</text>
<text x="8" y="3.25" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="1.6" fill="#8b1a1f" letter-spacing="0.06">HOWLIDAYS</text></svg>`;
const signHtml = `<!doctype html><html><head><meta charset="utf-8"><style>@page { size: 17in 11in; margin: 0.5in; } body { margin: 0; font-family: Arial, sans-serif; }</style></head><body>
<p style="font-size:11pt;margin:0 0 0.3in">Giant doghouse sign (option), 16 x 4 inches. Print on 11 x 17 at "Actual size", trim on the outer edge, and glue to cardboard with Mod Podge (then a coat on top).</p>${signSvg}</body></html>`;

(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.setContent(html); await pg.pdf({ path: path.join(ROOT, 'output', 'HP26_Templates.pdf'), preferCSSPageSize: true, printBackground: true });
  await pg.setContent(signHtml); await pg.pdf({ path: path.join(ROOT, 'output', 'HP26_Doghouse_Sign_11x17.pdf'), preferCSSPageSize: true, printBackground: true });
  await b.close(); console.log('templates ok');
})();
