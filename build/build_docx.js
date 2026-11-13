const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, AlignmentType, ExternalHyperlink, VerticalAlign,
  TableLayoutType, PageBreak, LevelFormat,
} = require('docx');

const items = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'items.json'), 'utf8'));
const TODAY = new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
const allChecked = items.every(i => i.image_checked);
items.forEach(it => { it.total = Math.round(it.price * it.qty * 100) / 100; });

const GREEN = '104735';
const INK = '373A36';
const RULE = 'BFBFBF';
const FONT = 'Arial Narrow';
const money = n => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const subtotal = items.reduce((s, i) => s + i.total, 0);
const taxable = items.filter(i => i.id !== 'gift_card').reduce((s, i) => s + i.total, 0);
const gst = Math.round(taxable * 0.05 * 100) / 100;
const grand = Math.round((subtotal + gst) * 100) / 100;
const remaining = Math.round((2000 - grand) * 100) / 100;

const ABOUT = "Pets are family, and nothing says home for the holidays like a wagging tail or a purring lap. Our tree celebrates them with golden retrievers, tabby kittens, paw-print ornaments, doghouses and bones, wrapped in tartan and velvet ribbon. A cozy gift basket with local pet-store gift cards waits underneath for the winning bidder's best friend.";

// Page: US Letter, 0.75" margins -> 10800 DXA content width
const W = [4560, 1000, 760, 1160, 3320];
const TABLE_W = W.reduce((a, b) => a + b, 0);

const run = (text, o = {}) => new TextRun({ text, font: FONT, color: INK, size: 20, ...o });

function labelLine(label, value, italicNote) {
  const kids = [run(label + ' ', { size: 22 })];
  if (italicNote) kids.push(run(italicNote + ' ', { size: 22, italics: true, color: '6B6B6B' }));
  if (value) kids.push(run(value, { size: 24, bold: true, color: GREEN }));
  return new Paragraph({
    children: kids,
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
  });
}

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
};

function cell(children, width, o = {}) {
  return new TableCell({
    children: Array.isArray(children) ? children : [children],
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    verticalAlign: VerticalAlign.CENTER,
    ...o,
  });
}

function headerRow() {
  const labels = ['ITEM', 'COST', 'QTY.', 'TOTAL $', 'LINK'];
  return new TableRow({
    tableHeader: true,
    children: labels.map((l, i) => cell(
      new Paragraph({ children: [run(l, { bold: true, color: 'FFFFFF', size: 22 })] }),
      W[i],
      { shading: { type: ShadingType.CLEAR, color: 'auto', fill: GREEN } }
    )),
  });
}

function sectionRow(title) {
  return new TableRow({
    cantSplit: true,
    children: [cell(
      new Paragraph({ children: [run(title.toUpperCase(), { bold: true, color: GREEN, size: 18 })], keepNext: true }),
      TABLE_W,
      { columnSpan: 5, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8F0EC' } }
    )],
  });
}

function itemRow(it) {
  const costText = it.diy ? 'DIY' : money(it.price);
  const qtyText = it.diy ? String(it.made) : String(it.qty);
  const costRun = it.diy ? run(costText, { bold: true, color: 'A6192E' }) : run(costText);
  const storeShort = it.store.replace(/ \(.*\)$/, '');
  return new TableRow({
    cantSplit: true,
    children: [
      cell(new Paragraph({ children: [run(it.name)] }), W[0]),
      cell(new Paragraph({ alignment: AlignmentType.RIGHT, children: [costRun] }), W[1]),
      cell(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(qtyText)] }), W[2]),
      cell(new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(money(it.total))] }), W[3]),
      cell(new Paragraph({ children: [
        new ExternalHyperlink({ link: it.url, children: [new TextRun({ text: storeShort, style: 'Hyperlink', font: FONT, size: 20 })] }),
        ...(it.store.includes('(') ? [run(' ' + it.store.match(/\(.*\)$/)[0], { size: 16, color: '6B6B6B' })] : []),
      ] }), W[4]),
    ],
  });
}

const sections = [];
items.forEach(it => { if (!sections.includes(it.section)) sections.push(it.section); });
const rows = [headerRow()];
sections.forEach(s => {
  rows.push(sectionRow(s));
  items.filter(i => i.section === s).forEach(i => rows.push(itemRow(i)));
});

const table = new Table({
  width: { size: TABLE_W, type: WidthType.DXA },
  columnWidths: W,
  layout: TableLayoutType.FIXED,
  rows,
});

function totalLine(label, value, o = {}) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: o.before ?? 40, after: 40 },
    children: [
      run(label + '  ', { size: o.size ?? 22, bold: !!o.bold }),
      run(value, { size: o.size ?? 22, bold: !!o.bold, color: o.color ?? INK, underline: o.underline ? {} : undefined }),
    ],
  });
}

const note = (t, o = {}) => new Paragraph({ spacing: { before: 40, after: 40 }, children: [run(t, { size: 17, italics: true, color: '6B6B6B', ...o })] });

// ---------- Page 2: committee notes ----------
const H = t => new Paragraph({ spacing: { before: 220, after: 80 }, keepNext: true, children: [run(t, { bold: true, size: 26, color: GREEN })] });
const B = (t, bold) => new Paragraph({
  numbering: { reference: 'bul', level: 0 },
  spacing: { before: 30, after: 30 },
  children: bold ? [run(bold, { bold: true, size: 21 }), run(t, { size: 21 })] : [run(t, { size: 21 })],
});

const doc = new Document({
  creator: 'Corporate Finance Tree Committee',
  title: '2026 Holiday Tree Gallery – Home for the Howlidays',
  styles: {
    default: { document: { run: { font: FONT, size: 20, color: INK } } },
    characterStyles: [{ id: 'Hyperlink', name: 'Hyperlink', basedOn: 'DefaultParagraphFont', run: { color: '0B5CAD', underline: { type: 'single' } } }],
  },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1000, bottom: 900, left: 720, right: 720 } } },
    children: [
      new Paragraph({ spacing: { after: 120 }, children: [run('2026 HOLIDAY TREE GALLERY', { bold: true, size: 64 })] }),
      labelLine('Department / District Name:', 'Corporate Finance'),
      new Paragraph({ spacing: { before: 0, after: 0 }, children: [run('', { size: 4 })] }),
      labelLine('Name or Theme of the Tree:', 'Home for the Howlidays'),
      new Paragraph({ spacing: { before: 220, after: 60 }, children: [run('About Our Tree (why did you choose this theme) ', { size: 22 }), run('60 words max :', { size: 22, italics: true, color: '6B6B6B' })] }),
      new Paragraph({
        spacing: { before: 40, after: 200, line: 300 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
        children: [run(ABOUT, { size: 22 })],
      }),
      table,
      totalLine('Subtotal:', money(subtotal), { before: 160 }),
      totalLine('GST 5% (est.; gift cards exempt):', money(gst)),
      totalLine('Total $:', money(grand), { bold: true, size: 26, color: GREEN, underline: true }),
      totalLine('Budget $2,000.00  |  Remaining contingency:', money(remaining), { size: 19 }),
      note('DIY = made by our committee. For DIY rows, QTY is the number of ornaments we make and TOTAL $ is the cost of the materials; the link goes to the materials.'),
      note(allChecked ? `Prices as listed on ${TODAY}. Update the COST column with actual receipts before submitting.` : `Prices are approximate as of ${TODAY} and may change. Update the COST column with actual receipts before submitting.`),

      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ spacing: { after: 60 }, children: [run('COMMITTEE PLANNING NOTES', { bold: true, size: 40 })] }),
      new Paragraph({ spacing: { after: 120 }, children: [run('For our team only. Remove this page before submitting the form.', { italics: true, size: 20, color: '6B6B6B' })] }),

      H('Key dates'),
      B(' place all Amazon.ca orders so they arrive at least a week before decorating.', 'This week:'),
      B(' tree fully decorated at NAHQ.', 'Thursday, Dec 3:'),
      B(' Special Event Rentals picks up the tree at NAHQ.', 'Friday, Dec 4:'),

      H('Rules from the Tree Gallery kickoff'),
      B('Secure every ornament, bow and pick with floral wire (pipe cleaners also work). The tree gets moved several times.'),
      B('No tree skirt. The organizers cover the bases.'),
      B('Decorate all the way around so the tree looks finished from every angle.'),
      B('The tree comes pre-lit (7.5 ft Wimberley Pine), so we don\'t need to buy lights.'),
      B('Expense description: Holiday2026_TreeGallery.'),

      H('Goal'),
      B(' anyone who has seen our inspiration board recognises this tree from across the room. All 11 board elements are on the front of the tree, at the board\'s scale, within $2,000 incl. GST and shipping, delivered by Nov 21.', 'Win the Tree Gallery:'),
      H('DIY (about two craft sessions, start the week of Nov 16)'),
      B(' paint both sides of the 4" bauble-shaped rounds cream, gold rim and cap tab, black glitter paw, mini velvet bow on top.', 'Paw-print ornaments (30):'),
      B(' shape 5" puffy bones from the foam clay, add a cord loop, dry 24 h, paint biscuit-cream, dry-brush tan, seal.', 'Dog bones (24):'),
      B(' barn-red walls with brick lines, cream roof, dark arched door with cream trim, cream paw stamped on the gable.', 'Doghouses (12):'),
      B(' stamp black paws on the 4" burlap, tie a 24" four-loop bow and leave two 3 ft streamers down the front.', 'Topper:'),
      B(' 1.5 yd of 4" tartan ribbon each: two loops a side and 18" V-cut tails.', 'Big tartan bows (10):'),
      B(' cut 14" strips of the tartan ribbon, fringe the ends and tie them on the 2 golden and 3 tabby plush that go on the tree. Cut the tartan scarf in half for the plush dog and cat under the tree.', 'Pet scarves:'),
      B(' foam clay cut with the bone cutters, painted biscuit-tan and sealed (inedible).', 'Faux biscuits for the jar (30):'),
      B(' wrap 5 of our sturdiest shipping boxes in tartan and kraft paw paper; glue a 4" black felt paw on the sherpa bone pillow.', 'Display gifts:'),

      H('Gift basket (goes to the winning bidder)'),
      B('Pick up the two Homes Alive Pets gift cards at the South Edmonton store (5611 104 St NW).'),
      B('Basket: glass jar of faux biscuits with a velvet bow, red tennis balls, rope toys, plush bone, folded paw-print throw, gift cards. Sit the plush golden retriever and tabby beside it in their tartan scarves.'),
      B('Wrap the basket in cellophane and wire it to the base so nothing goes missing in transit.'),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = process.argv[2] || path.join(__dirname, '..', 'output', 'HP26_Tree_Gallery_Form_Corporate_Finance.docx');
  fs.writeFileSync(out, buf);
  console.log('ok', { subtotal, gst, grand, remaining });
});
