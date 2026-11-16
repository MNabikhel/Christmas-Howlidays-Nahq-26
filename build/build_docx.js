/* Builds two Word files from data/items.json:
   1. output/HP26_Tree_Gallery_Form_Corporate_Finance.docx  - the organizers' Tree Gallery form, laid out
      exactly like inputs/HP26_Tree_Gallery_Form_original.pdf (Letter, Barlow Condensed, same columns,
      colours and rules), filled with the current list. Continues onto extra pages when needed.
   2. output/HP26_Committee_Plan_Corporate_Finance.docx      - our own planning notes (goal, DIY, wow pieces).
   Barlow Condensed (SIL OFL) is embedded so the form looks the same on any computer. */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  AlignmentType, ExternalHyperlink, VerticalAlign, TableLayoutType, HeightRule, LevelFormat, LineRuleType,
} = require('docx');

const ROOT = path.join(__dirname, '..');
const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'items.json'), 'utf8'));
const ABOUT = fs.readFileSync(path.join(ROOT, 'data', 'about.txt'), 'utf8').trim();
items.forEach(it => { it.total = Math.round(it.price * it.qty * 100) / 100; });
const subtotal = items.reduce((s, i) => s + i.total, 0);
const taxable = items.filter(i => i.id !== 'gift_card').reduce((s, i) => s + i.total, 0);
const gst = Math.round(taxable * 0.05 * 100) / 100;
const grand = Math.round((subtotal + gst) * 100) / 100;
const money = n => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHECKED = items.map(i => i.checked_on).filter(Boolean).sort().pop() || '';
const asOf = CHECKED ? new Date(CHECKED + 'T12:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

/* ---- the original form's spec (measured from the PDF, in points) ---- */
const INK = '373A36', GREEN = '104735', RULE = 'BABCBE', GRID = 'D0CFCD';
const F = { bold: 'Barlow Condensed Bold', med: 'Barlow Condensed Medium', reg: 'Barlow Condensed', lightIt: 'Barlow Condensed Light Italic' };
const tw = pt => Math.round(pt * 20);                       // points -> twips
const COLS = [217, 89, 43, 119].map(tw);                    // ITEM, COST, QTY., TOTAL $  (72 -> 540 pt)
const LABEL_W = tw(104), VALUE_W = tw(364);
const R = (text, font, sizePt, o = {}) => new TextRun({ text, font, size: Math.round(sizePt * 2), color: INK, ...o });
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const line = (color, eighths = 4) => ({ style: BorderStyle.SINGLE, size: eighths, color });

// exact text width with Barlow Condensed Regular, so the "About" text breaks onto the form's ruled lines like handwriting would
const WID = JSON.parse(fs.readFileSync(path.join(__dirname, 'fonts', 'regular_widths.json'), 'utf8'));
const textW = (s, pt) => [...s].reduce((a, c) => a + (WID[c.codePointAt(0)] ?? 0.5) * pt, 0);
function wrap(text, pt, maxPt) {
  const out = []; let cur = '';
  text.split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (textW(t, pt) <= maxPt) cur = t; else { out.push(cur); cur = w; } });
  if (cur) out.push(cur); return out;
}

function labelRow(label, value) {
  return new Table({
    width: { size: LABEL_W + VALUE_W, type: WidthType.DXA }, columnWidths: [LABEL_W, VALUE_W], layout: TableLayoutType.FIXED,
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [new TableRow({ height: { value: tw(20), rule: HeightRule.ATLEAST }, children: [
      new TableCell({ width: { size: LABEL_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, margins: { left: 0, right: 0, top: 0, bottom: 20 }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
        children: [new Paragraph({ children: [R(label, F.med, 11, { characterSpacing: -6 })] })] }),
      new TableCell({ width: { size: VALUE_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, margins: { left: tw(4), right: 0, top: 0, bottom: 20 }, borders: { top: NONE, left: NONE, right: NONE, bottom: line(RULE) },
        children: [new Paragraph({ children: [R(value, F.reg, 12.5, { color: GREEN })] })] }),
    ] })],
  });
}
const gap = pt => new Paragraph({ spacing: { before: 0, after: 0, line: tw(pt), lineRule: LineRuleType.EXACT }, children: [R('', F.reg, 2)] });

function cell(text, width, { header = false, align = AlignmentType.LEFT, last = false, link = null, font = F.reg } = {}) {
  const run = header ? R(text, F.med, 14, { color: 'FFFFFF' }) : R(text, font, 11);
  const kids = link ? [new ExternalHyperlink({ link, children: [R(text, font, 11, { color: GREEN })] })] : [run];
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { left: tw(4), right: tw(5), top: tw(2), bottom: tw(2) },
    shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: GREEN } : undefined,
    borders: header
      ? { top: NONE, bottom: NONE, left: NONE, right: last ? NONE : line('FFFFFF', 8) }
      : { top: NONE, left: NONE, bottom: line(GRID, 4), right: last ? NONE : line(GRID, 8) },
    children: [new Paragraph({ alignment: align, children: kids })],
  });
}
const header = new TableRow({ tableHeader: true, height: { value: tw(29), rule: HeightRule.EXACT }, children: [
  cell('ITEM', COLS[0], { header: true }), cell('COST', COLS[1], { header: true }), cell('QTY.', COLS[2], { header: true }), cell('TOTAL $', COLS[3], { header: true, last: true }),
] });
const rows = items.map(it => new TableRow({ height: { value: tw(21), rule: HeightRule.ATLEAST }, cantSplit: true, children: [
  cell(it.form_name || it.name, COLS[0], { link: it.url }),
  cell(it.diy ? 'DIY' : money(it.price), COLS[1], { align: AlignmentType.RIGHT }),
  cell(String(it.diy ? it.made : it.qty), COLS[2], { align: AlignmentType.CENTER }),
  cell(money(it.total), COLS[3], { align: AlignmentType.RIGHT, last: true }),
] }));
rows.push(new TableRow({ height: { value: tw(21), rule: HeightRule.ATLEAST }, children: [
  cell('GST 5% (gift cards exempt)', COLS[0], { font: F.med }), cell('', COLS[1]), cell('', COLS[2]), cell(money(gst), COLS[3], { align: AlignmentType.RIGHT, last: true }),
] }));
const table = new Table({ width: { size: COLS.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED,
  borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE }, rows: [header, ...rows] });

const TOTAL_LABEL_W = tw(30), TOTAL_VALUE_W = tw(92);
const totalLine = new Table({
  alignment: AlignmentType.RIGHT, width: { size: TOTAL_LABEL_W + TOTAL_VALUE_W, type: WidthType.DXA }, columnWidths: [TOTAL_LABEL_W, TOTAL_VALUE_W], layout: TableLayoutType.FIXED,
  borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
  rows: [new TableRow({ children: [
    new TableCell({ width: { size: TOTAL_LABEL_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, margins: { left: 0, right: 0 }, children: [new Paragraph({ children: [R('Total $:', F.med, 11, { characterSpacing: -6 })] })] }),
    new TableCell({ width: { size: TOTAL_VALUE_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, borders: { top: NONE, left: NONE, right: NONE, bottom: line(RULE) }, margins: { left: tw(4), right: 0 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [R(money(grand), F.med, 12.5, { color: GREEN })] })] }),
  ] })],
});

const aboutLines = wrap(ABOUT, 11.5, 462).slice(0, 4);
while (aboutLines.length < 4) aboutLines.push('');
const FONTS = [
  { name: F.reg, data: fs.readFileSync(path.join(__dirname, 'fonts', 'BarlowCondensed-Regular.ttf')) },
  { name: F.med, data: fs.readFileSync(path.join(__dirname, 'fonts', 'BarlowCondensed-Medium.ttf')) },
  { name: F.bold, data: fs.readFileSync(path.join(__dirname, 'fonts', 'Form-Bold.ttf')) },
  { name: F.lightIt, data: fs.readFileSync(path.join(__dirname, 'fonts', 'Form-LightItalic.ttf')) },
];
const PAGE = { size: { width: 12240, height: 15840 }, margin: { top: tw(50), bottom: tw(54), left: tw(72), right: tw(72) } };

const form = new Document({
  creator: 'Corporate Finance Tree Committee', title: '2026 Holiday Tree Gallery – Corporate Finance', fonts: FONTS,
  styles: { default: { document: { run: { font: F.reg, size: 22, color: INK } } } },
  sections: [{ properties: { page: PAGE }, children: [
    new Paragraph({ spacing: { before: 0, after: 0 }, children: [R('2026 HOLIDAY TREE GALLERY', F.bold, 46.4, { characterSpacing: -26 })] }),
    gap(20),
    labelRow('Department / District Name:', 'Corporate Finance'),
    gap(13),
    labelRow('Name or Theme of the Tree:', 'Home for the Howlidays'),
    gap(16),
    new Paragraph({ spacing: { before: 0, after: 0 }, children: [R('About Our Tree (why did you choose this them) ', F.med, 11, { characterSpacing: -6 }), R('60 words max :', F.lightIt, 11, { characterSpacing: -6 })] }),
    gap(6),
    new Table({ width: { size: tw(468), type: WidthType.DXA }, columnWidths: [tw(468)], layout: TableLayoutType.FIXED,   // the form's four ruled lines
      borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
      rows: aboutLines.map(t => new TableRow({ height: { value: tw(22.6), rule: HeightRule.EXACT }, children: [new TableCell({ width: { size: tw(468), type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM,
        margins: { left: 0, right: 0, top: 0, bottom: tw(2) }, borders: { top: NONE, left: NONE, right: NONE, bottom: line(RULE) }, children: [new Paragraph({ children: [R(t, F.reg, 11.5, { color: GREEN })] })] })] })) }),
    gap(22),
    table,
    gap(26),
    totalLine,
    new Paragraph({ spacing: { before: tw(10) }, alignment: AlignmentType.RIGHT, children: [R(`DIY = made by our committee: QTY. is how many we make and TOTAL $ is the cost of materials. Item names link to the store listing. Prices as listed on ${asOf}; update with receipts before submitting.`, F.lightIt, 8.5, { color: '6B6B6B' })] }),
  ] }],
});

/* ---- committee plan ---- */
const H = t => new Paragraph({ spacing: { before: tw(12), after: tw(4) }, keepNext: true, children: [R(t.toUpperCase(), F.bold, 15, { color: GREEN })] });
const B = (t, lead) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { before: 0, after: tw(3) }, children: lead ? [R(lead, F.med, 11.5), R(t, F.reg, 11.5)] : [R(t, F.reg, 11.5)] });
const plan = new Document({
  creator: 'Corporate Finance Tree Committee', title: 'Committee plan – Home for the Howlidays', fonts: FONTS,
  styles: { default: { document: { run: { font: F.reg, size: 23, color: INK } } } },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 300, hanging: 220 } } } }] }] },
  sections: [{ properties: { page: PAGE }, children: [
    new Paragraph({ children: [R('HOME FOR THE HOWLIDAYS', F.bold, 40)] }),
    new Paragraph({ spacing: { after: tw(8) }, children: [R(`Corporate Finance committee plan · total ${money(grand)} incl. GST of $2,000 · prices as of ${asOf}`, F.lightIt, 11)] }),
    H('Goal'),
    B(' anyone who has seen our inspiration board recognises this tree from across the room, and it has one moment that makes people stop: the giant doghouse with the family dog in the doorway.', 'Win the Tree Gallery:'),
    B(' every item matches the board in subject, colour and style (scorecard in the verification report), and every piece is sized so the real tree reads like the board.', 'True to the board:'),
    B(` ${money(grand)} incl. GST, under $2,000 with at least $150 spare for shipping and price changes; everything arrives by Nov 21; no lights, skirt, brands or food.`, 'Within the rules:'),
    H('Key dates'),
    B(' order everything on Amazon.ca (burlap first, only 2 rolls left); buy paint, stamp and gift cards in store.', 'Now:'),
    B(' two craft sessions: doghouses, paw ornaments, clay bones and biscuits, burlap stamping, giant doghouse.', 'Week of Nov 16:'),
    B(' decorate at NAHQ (about 3 hours, 3-4 people).', 'Dec 1-3:'),
    B(' Special Event Rentals picks up the tree.', 'Fri Dec 4:'),
    H('The wow pieces'),
    B(' a 26" x 22" x 28" doghouse built from one of our shipping boxes, painted like the ornaments (red brick, cream shingle roof, arched door with cream trim), with a hand-painted "Home for the Howlidays" sign. The plush golden retriever sits in the doorway in the tartan scarf, the tabby beside it.', 'Giant doghouse centrepiece:'),
    B(' the 24" burlap paw bow on top, with two burlap streamers that pour down the front of the tree to the doghouse roof, tucked in and puffed every 12".', 'Ribbon waterfall:'),
    B(' twelve gold glitter sprays fanned out behind the topper bow.', 'Gold crown:'),
    B(' two 10" golden retrievers and three tabby kittens in tartan scarves sit front and centre on sturdy branches (floral wire round the body, under the scarf).', 'Pets on the tree:'),
    H('DIY'),
    ...items.filter(i => i.diy).map(i => B(' ' + (i.notes || ''), (i.form_name || i.name) + ':')),
    H('Gift basket (goes to the winning bidder)'),
    B('Pick up the two $100 Homes Alive Pets gift cards at the South Edmonton store (5611 104 St NW).'),
    B('Basket: glass jar of faux biscuits with a velvet bow, red tennis balls, rope toys, plush bone, folded paw-print throw, gift cards. Wrap in cellophane and wire it to the base.'),
    H('Rules from the kickoff'),
    B('Secure every ornament, bow, pick and plush with floral wire; the tree is moved several times.'),
    B('No tree skirt, no lights (the 7.5 ft Wimberley Pine is pre-lit), no PCL/Oilers or other branding, no food.'),
    B('Decorate all the way around. Expense code: Holiday2026_TreeGallery.'),
  ] }],
});

const out = path.join(ROOT, 'output');
Promise.all([Packer.toBuffer(form), Packer.toBuffer(plan)]).then(([a, b]) => {
  fs.writeFileSync(process.argv[2] || path.join(out, 'HP26_Tree_Gallery_Form_Corporate_Finance.docx'), a);
  fs.writeFileSync(path.join(out, 'HP26_Committee_Plan_Corporate_Finance.docx'), b);
  console.log('ok', { subtotal: Math.round(subtotal * 100) / 100, gst, grand, about_lines: aboutLines.filter(Boolean).length });
});
