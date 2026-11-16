/* Printable templates at true size (print at 100% / "Actual size", never "Fit to page").
   output/HP26_Templates.pdf          Letter: doghouse ornament parts, paw stencils, bone, giant doghouse door + cut plan
   output/HP26_Doghouse_Sign_11x17.pdf  11 x 17 landscape: the 16 x 4" sign
   Needs Playwright (used only here); if it is not installed the committed PDFs are kept. */
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'supplies.json'), 'utf8'));
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('templates: playwright not installed, keeping existing PDFs'); process.exit(0); }

const paw = (cx, cy, s, fill = '#111', rot = 0) => {
  const e = (x, y, rx, ry, r) => `<ellipse cx="${(x * s).toFixed(3)}" cy="${(y * s).toFixed(3)}" rx="${(rx * s).toFixed(3)}" ry="${(ry * s).toFixed(3)}" transform="rotate(${(r * 57.3).toFixed(1)} ${(x * s).toFixed(3)} ${(y * s).toFixed(3)})"/>`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})" fill="${fill}">${e(0, 0.2, 0.32, 0.26, 0)}${e(-0.36, -0.14, 0.12, 0.16, -0.4)}${e(-0.13, -0.38, 0.12, 0.16, -0.12)}${e(0.13, -0.38, 0.12, 0.16, 0.12)}${e(0.36, -0.14, 0.12, 0.16, 0.4)}</g>`;
};
const T = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 0.13}" font-weight="${o.w || 400}" text-anchor="${o.a || 'start'}" fill="${o.c || '#222'}" font-family="Arial, Helvetica, sans-serif">${t}</text>`;
const page = (title, note, svg) => `<section class="pg"><h1>${title}</h1><p>${note}</p><svg width="7.5in" height="9.6in" viewBox="0 0 7.5 9.6">${svg}</svg></section>`;
const cut = 'fill="none" stroke="#111" stroke-width="0.012"', dash = 'fill="none" stroke="#888" stroke-width="0.01" stroke-dasharray="0.06 0.05"';
const arch = (x, y, w, h) => `M ${x} ${y + h} L ${x} ${y + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} L ${x + w} ${y + h}`;   // y = top of arch

// ---- page 1: doghouse ornament (true size) ----
const [W, D] = P.ornament, WALL = 2.4, RIDGE = 4.0, T16 = 0.1875, SL = Math.hypot(W / 2, RIDGE - WALL) + 0.35;
const gableP = (x, y) => `M ${x} ${y + RIDGE} L ${x + W} ${y + RIDGE} L ${x + W} ${y + RIDGE - WALL} L ${x + W / 2} ${y} L ${x} ${y + RIDGE - WALL} Z`;
let s1 = '', s1b = '';
const doorP = arch(0.2 + W / 2 - 0.65, 0.4 + RIDGE - 1.75, 1.3, 1.75);
s1 += `<path d="${gableP(0.2, 0.4)}" ${cut}/><path d="${doorP}" ${cut}/><g stroke="#999" stroke-width="0.008" fill="none">${paw(0.2 + W / 2, 0.4 + 1.05, 1.0, 'none')}</g>` + T(0.2 + W / 2, 0.4 + RIDGE + 0.28, 'FRONT: cut out the arched door', { a: 'middle' });
s1 += `<path d="${gableP(3.9, 0.4)}" ${cut}/>` + T(3.9 + W / 2, 0.4 + RIDGE + 0.28, 'BACK', { a: 'middle' });
s1 += `<line x1="0.2" y1="5.4" x2="1.2" y2="5.4" stroke="#c00" stroke-width="0.02"/>` + T(1.3, 5.44, 'This red line must measure exactly 1 inch. If not, reprint at "Actual size".', { size: 0.12, c: '#c00' });
s1 += T(0.2, 6.0, 'Make 12 of each part. Parts continue on the next page.', { size: 0.13, w: 700 });
[[0.2, 0.3], [2.75, 0.3]].forEach(([x, y]) => { s1b += `<rect x="${x}" y="${y}" width="${D - 2 * T16}" height="${WALL}" ${cut}/>` + T(x + (D - 2 * T16) / 2, y + WALL + 0.25, 'SIDE', { a: 'middle' }); });
s1b += `<rect x="5.15" y="0.3" width="${D - 2 * T16}" height="${W - 2 * T16}" ${cut}/>` + T(5.15 + (D - 2 * T16) / 2, 0.3 + W - 2 * T16 + 0.25, 'FLOOR', { a: 'middle' });
[[0.2, 4.0], [3.7, 4.0]].forEach(([x, y]) => { s1b += `<rect x="${x}" y="${y}" width="${D + 0.5}" height="${SL}" ${cut}/>` + T(x + (D + 0.5) / 2, y + SL + 0.25, 'ROOF: score shingle lines across', { a: 'middle', size: 0.12 }); });
s1b += `<line x1="0.2" y1="7.6" x2="1.2" y2="7.6" stroke="#c00" stroke-width="0.02"/>` + T(1.3, 7.64, '1 inch check line', { size: 0.12, c: '#c00' });
// ---- page 2: paw stencils ----
let s2 = ''; [[1.0, 'doghouse ornament gables'], [1.5, 'bowl (oil paint marker)'], [2.2, 'burlap topper (fabric paint)'], [3.0, 'paw ornaments']].reduce((y, [sz, use]) => {
  s2 += paw(1.8, y + sz * 0.55, sz) + T(1.8, y + sz + 0.2, `${sz}" paw: ${use}`, { a: 'middle', size: 0.14, w: 700 }); return y + sz + 0.42; }, 0.05);
s2 += paw(5.4, 2.05, 3.6) + T(5.4, 4.05, '3.6" paw: giant doghouse gable', { a: 'middle', size: 0.14, w: 700 });
s2 += `<g stroke="#111" stroke-width="0.015" fill="none">${paw(5.15, 6.75, 4.5, 'none')}</g>` + T(5.15, 9.25, '4.5" paw: cut from black felt (bone pillow)', { a: 'middle', size: 0.14, w: 700 });

// ---- page 3: bone + giant door ----
const bone = (x, y, L, H) => { const r = H * 0.29, sh = H * 0.24; return `<g ${cut}><rect x="${x + L * 0.13}" y="${y + H / 2 - sh}" width="${L * 0.74}" height="${2 * sh}"/>${[[0.13, 0.29], [0.13, 0.71], [0.87, 0.29], [0.87, 0.71]].map(([a, b]) => `<circle cx="${x + L * a}" cy="${y + H * b}" r="${r}"/>`).join('')}</g>`; };
let s3 = bone(0.4, 0.4, 5, 1.8) + T(0.4, 2.55, '5 x 1.8" bone: shape the clay over a foil core to this outline, about 1" thick (make 24)', { size: 0.14, w: 700 });
s3 += `<path d="M 1.25 9.3 L 1.25 7.9 A 5 5 0 0 1 6.25 2.9" fill="none" stroke="#111" stroke-width="0.015"/>`;
s3 += `<line x1="1.25" y1="7.9" x2="6.25" y2="7.9" ${dash}/><line x1="6.25" y1="2.9" x2="6.25" y2="9.3" ${dash}/>` + T(1.45, 7.7, 'SPRING LINE: 8" above the floor', { size: 0.11 }) +
  T(3.3, 8.45, 'Giant doghouse door: left half of the 10"-wide arch,', { size: 0.12, w: 700 }) + T(3.3, 8.65, 'true size. Flip for the right half. The straight', { size: 0.12 }) + T(3.3, 8.85, 'side runs on down to the floor: 13" tall in all.', { size: 0.12 });

// ---- page 4: giant doghouse cut plan (to scale 1:6) ----
const [GW, GD, GR] = P.giant, k = 1 / 7; let s4 = '';
const box = (x, y, w, h, label, sub) => `<rect x="${x}" y="${y}" width="${w * k}" height="${h * k}" ${cut}/>` + T(x + w * k / 2, y + h * k / 2, label, { a: 'middle', size: 0.13, w: 700 }) + T(x + w * k / 2, y + h * k / 2 + 0.17, sub, { a: 'middle', size: 0.11 });
s4 += T(0.2, 0.3, 'BOX A (24 x 20 x 20") becomes the walls and floor', { size: 0.15, w: 700 });
s4 += box(0.2, 0.5, 24, 16, 'FRONT 24 x 16', 'door 10 x 13 centred') + `<path d="${arch(0.2 + (12 - 5) * k, 0.5 + (16 - 13) * k, 10 * k, 13 * k)}" ${cut}/>`;
s4 += box(3.8, 0.5, 24, 16, 'BACK 24 x 16', '') + box(0.2, 3.2, 20, 16, 'SIDE 20 x 16', '') + box(3.3, 3.2, 20, 16, 'SIDE 20 x 16', '');
s4 += T(0.2, 5.85, 'Cut all four walls down to 16" (remove the top 4" and the top flaps). Keep the bottom flaps taped shut as the floor.', { size: 0.12 });
s4 += T(0.2, 6.2, 'BOX B (24 x 20 x 20") becomes the roof, gables, shingles and sign', { size: 0.15, w: 700 });
s4 += `<path d="M 0.2 ${6.4 + 10 * k} L ${0.2 + 24 * k} ${6.4 + 10 * k} L ${0.2 + 12 * k} 6.4 Z" ${cut}/>` + T(0.2 + 12 * k, 6.4 + 10 * k + 0.2, 'GABLE x2 (24 x 10, from the long flaps)', { a: 'middle', size: 0.11 });
s4 += box(3.8, 6.4, 24, 17.6, 'ROOF x2', '24 x 17.6 (from the 24 x 20 sides)');
s4 += T(0.2, 9.3, 'Shingles: 3"-wide strips from the remaining flaps, 1" overlap per course. Sign backing 16 x 4 from a 20 x 20 side.', { size: 0.12 });

const css = `@page { size: Letter; margin: 0.3in 0.4in; } body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #222; } .pg { page-break-after: always; } .pg:last-child { page-break-after: auto; }
h1 { font-size: 15pt; margin: 0 0 2pt; } p { font-size: 9.5pt; margin: 0 0 6pt; color: #444; }`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
${page('1. Doghouse ornament, true size (make 12)', 'Trace onto 3/16" white foam board and cut with a fresh blade against the steel ruler. Score brick lines on FRONT, BACK and SIDES and shingle lines on the ROOF with a ballpoint pen before painting. The faint 1" paw is the gable stencil position.', s1)}
${page('1b. Doghouse ornament, true size (continued)', 'Sides fit between the front and back; the floor fits inside all four walls. Roof panels overhang 1/4" at the front and back.', s1b)}
${page('2. Paw stencils, true size', 'Cut each paw out of drafting film with the art knife to make a reusable stencil. Dab paint through it with a sponge; lift straight up.', s2)}
${page('3. Clay bone and giant doghouse door', 'Bone: shape over a scrunched-foil core so it stays light. Door: trace onto the 24" front wall of box A, centred, bottom on the floor line.', s3)}
${page('4. Giant doghouse cut plan (drawn at 1:7)', 'Finished size 24" wide x 20" deep x 26" to the ridge. All dimensions in inches.', s4)}
</body></html>`;
const signSvg = `<svg width="16in" height="4in" viewBox="0 0 16 4"><rect width="16" height="4" fill="#ecdcb6"/><rect x="0.2" y="0.2" width="15.6" height="3.6" fill="none" stroke="#8b1a1f" stroke-width="0.12"/>
${paw(1.3, 2.05, 1.5, '#1d4a35', -18)}${paw(14.7, 2.05, 1.5, '#1d4a35', 18)}
<text x="8" y="1.55" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="0.95" fill="#1d4a35">Home for the</text>
<text x="8" y="3.25" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="1.6" fill="#8b1a1f" letter-spacing="0.06">HOWLIDAYS</text></svg>`;
const signHtml = `<!doctype html><html><head><meta charset="utf-8"><style>@page { size: 17in 11in; margin: 0.5in; } body { margin: 0; font-family: Arial, sans-serif; }</style></head><body>
<p style="font-size:11pt;margin:0 0 0.3in">Giant doghouse sign, 16 x 4 inches. Print on 11 x 17 at "Actual size", trim on the outer edge, and glue to cardboard with Mod Podge (then a coat on top).</p>${signSvg}</body></html>`;

(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.setContent(html); await pg.pdf({ path: path.join(ROOT, 'output', 'HP26_Templates.pdf'), preferCSSPageSize: true, printBackground: true });
  await pg.setContent(signHtml); await pg.pdf({ path: path.join(ROOT, 'output', 'HP26_Doghouse_Sign_11x17.pdf'), preferCSSPageSize: true, printBackground: true });
  await b.close(); console.log('templates ok');
})();
