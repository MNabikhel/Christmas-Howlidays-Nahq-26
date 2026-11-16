/* Writes the two Word files for the board-match selection (data/items.json, data/supplies.json):
     output/HP26_Tree_Gallery_Form_Corporate_Finance.docx  the organizers' form in its original layout
     output/HP26_Committee_Plan_Corporate_Finance.docx      our plan: choices, build sheets, buy list by store
   The layout lives in build/docs_core.js, which the 3D page also runs, so its exports follow any swaps.
   Barlow Condensed (SIL OFL) is embedded so the form looks the same on any computer. */
const fs = require('fs'), path = require('path');
const D = require('docx');
const docs = require('./docs_core.js');
const ROOT = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const O = read('data/options.json'), SUP = read('data/supplies.json');
const sel = Object.fromEntries(O.elements.map(e => [e.id, e.default]));
const ctx = {
  items: read('data/items.json'), supplies: SUP.supplies, totals: SUP.totals, onHand: SUP.on_hand, sel, elements: O.elements,
  chosen: Object.fromEntries(O.elements.map(e => [e.id, e.options.find(o => o.id === e.default)])),
  widths: read('build/fonts/regular_widths.json'),
  fonts: Object.fromEntries([['reg', 'BarlowCondensed-Regular.ttf'], ['med', 'BarlowCondensed-Medium.ttf'], ['bold', 'Form-Bold.ttf'], ['lightIt', 'Form-LightItalic.ttf']].map(([k, f]) => [k, fs.readFileSync(path.join(__dirname, 'fonts', f))])),
};
const about = docs.aboutText(sel);
if (about.split(/\s+/).length > 60) { console.error('About text is over 60 words'); process.exit(1); }
fs.writeFileSync(path.join(ROOT, 'data', 'about.txt'), about + '\n');
const out = path.join(ROOT, 'output');
Promise.all([docs.buffer(D, 'form', ctx), docs.buffer(D, 'plan', ctx)]).then(([a, b]) => {
  fs.writeFileSync(path.join(out, 'HP26_Tree_Gallery_Form_Corporate_Finance.docx'), a);
  fs.writeFileSync(path.join(out, 'HP26_Committee_Plan_Corporate_Finance.docx'), b);
  console.log('ok', { ...SUP.totals, about_words: about.split(/\s+/).length, form_rows: ctx.items.length });
});
