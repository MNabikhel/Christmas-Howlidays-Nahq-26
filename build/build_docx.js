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

      H('DIY ornaments (about one craft session)'),
      B(' paint the 3" wood rounds cream with a thin gold rim, stamp a black paw in the centre and dust it with black glitter, then wire a mini velvet bow at the top.', 'Paw-print discs (30):'),
      B(' paint the 4" wooden bones biscuit-cream on both sides. A light dry-brush of tan on the edges makes them look like the photo.', 'Dog bones (24):'),
      B(' paint the 4.3" birdhouses barn-red with cream roof, paint a dark arched door around the round hole with cream trim, and stamp a cream paw on the gable.', 'Doghouses (12):'),
      B(' tie a 4-loop bow with two long streamers from the 2.5" paw-print burlap ribbon, then wire it to the top of the tree.', 'Topper:'),

      H('Gift basket'),
      B('Pick up the two Homes Alive Pets gift cards at the South Edmonton store (5611 104 St NW). Everything else in the basket now ships from Amazon.ca.'),
      B('Fill the glass jar with the red tennis balls and small rope toys instead of treats. The tree is auctioned at the 2027 gala, so food would be expired by then.'),
      B('Fold the two tartan scarves over the basket rim (or tie one on a plush pup if we add one).'),
      B('Wrap the basket in cellophane and wire it to the base so nothing goes missing in transit.'),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = process.argv[2] || path.join(__dirname, '..', 'output', 'HP26_Tree_Gallery_Form_Corporate_Finance.docx');
  fs.writeFileSync(out, buf);
  console.log('ok', { subtotal, gst, grand, remaining });
});
