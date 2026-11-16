/* The two Word files, built from a resolved selection. Shared by build/build_docx.js (Node) and the 3D page
   (browser), so the exports always match the list on screen.
   1. The organizers' Tree Gallery form, laid out exactly like inputs/HP26_Tree_Gallery_Form_original.pdf
      (Letter, Barlow Condensed, same columns, colours and rules), continuing onto extra pages when needed.
   2. Our committee plan: goal, what we chose for each board element, build sheets, buy list by store.
   ctx = { items, supplies, totals, onHand, fonts: {reg, med, bold, lightIt} (bytes or base64), widths, chosen, elements, sel } */
(function (root) {
  const money = n => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bytes = v => typeof v === 'string' ? Uint8Array.from(atob(v), c => c.charCodeAt(0)) : v;
  const fmtDate = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  // the form's 60-word "About our tree", true to what is under the tree in this selection
  function aboutText(sel = {}) {
    const below = sel.giant === 'build' ? 'Below, the family dog waits in its own doghouse beside a gift basket for the winning bidder\'s best friend.'
      : sel.pair === 'none' ? 'Below, a gift basket waits for the winning bidder\'s best friend.'
      : 'Below, a dog and cat wait beside a gift basket for the winning bidder\'s best friend.';
    return 'Pets are family, and nothing says home for the holidays like a wagging tail. Golden retrievers and tabby cats in tartan scarves sit among paw-print ornaments, red brick doghouses and biscuit bones under a burlap paw-print bow. ' + below;
  }

  // a piece's materials: every supply use whose project belongs to this piece (its share of shared supplies)
  const UNIT = { in2: 'sq in', in: 'in' };
  function materialsOf(it, sups) {
    const P = new Set(it.projects || []); if (!P.size) return [];
    const out = [];
    sups.forEach(s => {
      const a = (s.uses || []).filter(u => P.has(u.project)).reduce((t, u) => t + u.amount, 0);
      if (a > 0) out.push(`${s.name}: ${Math.round(a * 10) / 10} ${UNIT[s.unit] || s.unit}`);
    });
    return out;
  }
  const stepsOf = how => how.trim().split(/\s(?=\(\d+\)\s)/);
  function toolsOf(it, sups) { return (it.tools || []).map(t => { const s = sups.find(x => x.id === t); return s ? s.name : t; }); }

  function build(D, kind, ctx) {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, ExternalHyperlink, VerticalAlign, TableLayoutType, HeightRule, LevelFormat, LineRuleType } = D;
    const items = ctx.items, T = ctx.totals, sel = ctx.sel || {};
    const CHECKED = items.map(i => i.checked_on).filter(Boolean).sort().pop() || '';
    const asOf = fmtDate(CHECKED);
    const INK = '373A36', GREEN = '104735', RULE = 'BABCBE', GRID = 'D0CFCD';
    const F = { bold: 'Barlow Condensed Bold', med: 'Barlow Condensed Medium', reg: 'Barlow Condensed', lightIt: 'Barlow Condensed Light Italic' };
    const tw = pt => Math.round(pt * 20);
    const COLS = [217, 89, 43, 119].map(tw);                    // ITEM, COST, QTY., TOTAL $  (72 -> 540 pt)
    const LABEL_W = tw(104), VALUE_W = tw(364);
    const R = (text, font, sizePt, o = {}) => new TextRun({ text, font, size: Math.round(sizePt * 2), color: INK, ...o });
    const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const line = (color, eighths = 4) => ({ style: BorderStyle.SINGLE, size: eighths, color });
    const WID = ctx.widths || {};
    const textW = (s, pt) => [...s].reduce((a, c) => a + (WID[c.codePointAt(0)] ?? 0.5) * pt, 0);
    const wrap = (text, pt, maxPt) => { const out = []; let cur = ''; text.split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (textW(t, pt) <= maxPt) cur = t; else { out.push(cur); cur = w; } }); if (cur) out.push(cur); return out; };
    const FONTS = [{ name: F.reg, data: bytes(ctx.fonts.reg) }, { name: F.med, data: bytes(ctx.fonts.med) }, { name: F.bold, data: bytes(ctx.fonts.bold) }, { name: F.lightIt, data: bytes(ctx.fonts.lightIt) }];
    const PAGE = { size: { width: 12240, height: 15840 }, margin: { top: tw(50), bottom: tw(54), left: tw(72), right: tw(72) } };
    const gap = pt => new Paragraph({ spacing: { before: 0, after: 0, line: tw(pt), lineRule: LineRuleType.EXACT }, children: [R('', F.reg, 2)] });

    if (kind === 'form') {
      const labelRow = (label, value) => new Table({
        width: { size: LABEL_W + VALUE_W, type: WidthType.DXA }, columnWidths: [LABEL_W, VALUE_W], layout: TableLayoutType.FIXED,
        borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
        rows: [new TableRow({ height: { value: tw(20), rule: HeightRule.ATLEAST }, children: [
          new TableCell({ width: { size: LABEL_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, margins: { left: 0, right: 0, top: 0, bottom: 20 }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
            children: [new Paragraph({ children: [R(label, F.med, 11, { characterSpacing: -6 })] })] }),
          new TableCell({ width: { size: VALUE_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, margins: { left: tw(4), right: 0, top: 0, bottom: 20 }, borders: { top: NONE, left: NONE, right: NONE, bottom: line(RULE) },
            children: [new Paragraph({ children: [R(value, F.reg, 12.5, { color: GREEN })] })] }),
        ] })],
      });
      const cell = (text, width, { header = false, align = AlignmentType.LEFT, last = false, link = null, font = F.reg } = {}) => {
        const run = header ? R(text, F.med, 14, { color: 'FFFFFF' }) : R(text, font, 11);
        const kids = link ? [new ExternalHyperlink({ link, children: [R(text, font, 11, { color: GREEN })] })] : [run];
        return new TableCell({
          width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { left: tw(4), right: tw(5), top: tw(2), bottom: tw(2) },
          shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: GREEN } : undefined,
          borders: header ? { top: NONE, bottom: NONE, left: NONE, right: last ? NONE : line('FFFFFF', 8) } : { top: NONE, left: NONE, bottom: line(GRID, 4), right: last ? NONE : line(GRID, 8) },
          children: [new Paragraph({ alignment: align, children: kids })],
        });
      };
      const header = new TableRow({ tableHeader: true, height: { value: tw(29), rule: HeightRule.EXACT }, children: [
        cell('ITEM', COLS[0], { header: true }), cell('COST', COLS[1], { header: true }), cell('QTY.', COLS[2], { header: true }), cell('TOTAL $', COLS[3], { header: true, last: true })] });
      const rows = items.map(it => new TableRow({ height: { value: tw(21), rule: HeightRule.ATLEAST }, cantSplit: true, children: [
        cell(it.form_name || it.name, COLS[0], { link: it.url }),
        cell(it.diy ? 'DIY' : money(it.price), COLS[1], { align: AlignmentType.RIGHT }),
        cell(String(it.diy ? it.made : it.qty), COLS[2], { align: AlignmentType.CENTER }),
        cell(it.diy && !it.total ? '–' : money(it.total), COLS[3], { align: AlignmentType.RIGHT, last: true })] }));
      rows.push(new TableRow({ height: { value: tw(21), rule: HeightRule.ATLEAST }, children: [
        cell('GST 5% (gift cards exempt)', COLS[0], { font: F.med }), cell('', COLS[1]), cell('', COLS[2]), cell(money(T.gst), COLS[3], { align: AlignmentType.RIGHT, last: true })] }));
      const table = new Table({ width: { size: COLS.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED,
        borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE }, rows: [header, ...rows] });
      const TL = tw(30), TV = tw(92);
      const totalLine = new Table({ alignment: AlignmentType.RIGHT, width: { size: TL + TV, type: WidthType.DXA }, columnWidths: [TL, TV], layout: TableLayoutType.FIXED,
        borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: TL, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, margins: { left: 0, right: 0 }, children: [new Paragraph({ children: [R('Total $:', F.med, 11, { characterSpacing: -6 })] })] }),
          new TableCell({ width: { size: TV, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, borders: { top: NONE, left: NONE, right: NONE, bottom: line(RULE) }, margins: { left: tw(4), right: 0 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [R(money(T.grand), F.med, 12.5, { color: GREEN })] })] })] })] });
      const aboutLines = wrap(aboutText(sel), 11.5, 462).slice(0, 4); while (aboutLines.length < 4) aboutLines.push('');
      return new Document({
        creator: 'Corporate Finance Tree Committee', title: '2026 Holiday Tree Gallery – Corporate Finance', fonts: FONTS,
        styles: { default: { document: { run: { font: F.reg, size: 22, color: INK } } } },
        sections: [{ properties: { page: PAGE }, children: [
          new Paragraph({ spacing: { before: 0, after: 0 }, children: [R('2026 HOLIDAY TREE GALLERY', F.bold, 46.4, { characterSpacing: -26 })] }),
          gap(20), labelRow('Department / District Name:', 'Corporate Finance'), gap(13), labelRow('Name or Theme of the Tree:', 'Home for the Howlidays'), gap(16),
          new Paragraph({ spacing: { before: 0, after: 0 }, children: [R('About Our Tree (why did you choose this them) ', F.med, 11, { characterSpacing: -6 }), R('60 words max :', F.lightIt, 11, { characterSpacing: -6 })] }),
          gap(6),
          new Table({ width: { size: tw(468), type: WidthType.DXA }, columnWidths: [tw(468)], layout: TableLayoutType.FIXED,
            borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
            rows: aboutLines.map(t => new TableRow({ height: { value: tw(22.6), rule: HeightRule.EXACT }, children: [new TableCell({ width: { size: tw(468), type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM,
              margins: { left: 0, right: 0, top: 0, bottom: tw(2) }, borders: { top: NONE, left: NONE, right: NONE, bottom: line(RULE) }, children: [new Paragraph({ children: [R(t, F.reg, 11.5, { color: GREEN })] })] })] })) }),
          gap(22), table, gap(26), totalLine,
          new Paragraph({ spacing: { before: tw(10) }, alignment: AlignmentType.RIGHT, children: [R(`DIY = made by our committee: QTY. is how many we make and TOTAL $ is the materials only that piece uses; shared materials have their own lines (– = all on other lines). Item names link to the store listing. Prices as listed on ${asOf}; update with receipts before submitting.`, F.lightIt, 8.5, { color: '6B6B6B' })] }),
        ] }],
      });
    }

    /* ---- committee plan ---- */
    const H = t => new Paragraph({ spacing: { before: tw(12), after: tw(4) }, keepNext: true, children: [R(t.toUpperCase(), F.bold, 15, { color: GREEN })] });
    const B = (t, lead, lvl = 0) => new Paragraph({ numbering: { reference: 'bul', level: lvl }, spacing: { before: 0, after: tw(3) }, children: lead ? [R(lead, F.med, 11.5), R(t, F.reg, 11.5)] : [R(t, F.reg, 11.5)] });
    const P = t => new Paragraph({ spacing: { after: tw(4) }, children: [R(t, F.reg, 11.5)] });
    const sups = ctx.supplies || [], els = ctx.elements || [], chosen = ctx.chosen || {};
    const swapped = els.filter(e => sel[e.id] && sel[e.id] !== e.default);
    const amz = items.filter(i => i.store === 'Amazon.ca' && i.id !== 'shipping' && i.total > 0);
    const ship = items.find(i => i.id === 'shipping');
    const late = items.filter(i => i.arrives_by && i.arrives_by > '2026-11-21').map(i => `${i.form_name || i.name} (${fmtDate(i.arrives_by).replace(/, \d{4}$/, '')})`);
    const kids = [
      new Paragraph({ children: [R('HOME FOR THE HOWLIDAYS', F.bold, 40)] }),
      new Paragraph({ spacing: { after: tw(8) }, children: [R(`Corporate Finance committee plan · ${money(T.grand)} incl. GST of $2,000 (${money(T.left)} left) · prices as of ${asOf}`, F.lightIt, 11)] }),
      H('Goal'),
      B(' a tree the committee can buy and build exactly as the 3D preview shows, with every element a true match to the inspiration board, shown side by side in the lookbook before anything is ordered.', 'The goal:'),
      B(` ${money(T.grand)} incl. GST, at least $75 kept for price changes; everything in Edmonton by Nov 30 (aim Nov 21); no lights, no tree skirt, no PCL, Oilers or other branding, no food.`, 'Within the rules:'),
      H('What we chose for each element of the board'),
      P(swapped.length ? `This plan has ${swapped.length} swap${swapped.length > 1 ? 's' : ''} from the closest match to the board: ${swapped.map(e => e.title.toLowerCase()).join(', ')}.` : 'This is the board match: for every element, the option closest to the inspiration board.'),
      ...els.map(e => { const o = chosen[e.id] || e.options.find(x => x.id === (sel[e.id] || e.default)); return B(` ${o.label}. ${o.match === 'match' ? 'Match' : o.match === 'close' ? 'Close' : 'Extra'}: ${o.why}`, e.title + ':'); }),
      H('Key dates and craft sessions (built round the real delivery dates)'),
      B(' order on Amazon.ca, the low-stock and slow lines first (the Miyoni tabby, the green glitter baubles, the Faylapa hoops, the tartan, the bone pillow, the gold sprays and the bone cutters); order DeSerres as ONE shipment; pick up the Canadian Tire boxes, tapes, drop sheet and the XL box for the cutting surface by Nov 18; buy the gift cards in store.', 'Nov 16-17:'),
      ...(late.length ? [B(` ${late.join('; ')}. Every other order is due by Nov 21.`, 'Arrives after Nov 21 (still before Nov 30):')] : []),
      B(' read the DeSerres confirmation email. If any line is on backorder or the parcel has not shipped by Nov 19, buy those lines at a Michaels store in Edmonton (glue gun and sticks, fabric glue, gesso, the acrylics and Mod Podge, foam board, wire cutter, art knife and ruler first) and cancel them at DeSerres so nothing is paid twice.', 'Nov 18-19:'),
      B(' Amazon lands (clay, floral wire, felt, glitter card, scarf, hoops). Make the 8 bone cores with their wire anchors and cover them in clay (48 h to dry; until the wire cutter arrives, bend floral wire back and forth until it snaps); cut and fringe the scarves; cut the felt and glitter paws (tape the paper paw to the felt and cut round it if the marker has not come). Nothing here needs the DeSerres parcel.', 'Session 1, Nov 20-22:'),
      B(' DeSerres lands (foam board, paint, glue, Aida, tools). Cut, score and flat-paint the six doghouses, then assemble; prime and gild the hoops and tea-stain the Aida; paint and seal the bones; press, cut and dry the 64 biscuits (the bone cutters are due Nov 22-25); edge-wire, paw and tie the topper; tie the tartan and velvet bows and cut the cascades (tartan due Nov 24); cut down and wrap the gift boxes; glue the scarf edges and the sherpa paws.', 'Session 2, Nov 25-28:'),
      B(' second coats and doghouse trims; hoop the Aida, glue the paws and felt backs, tie the velvet bows; paint and seal the biscuits and fill the jar; glue the gold cords into the bones; unroll the bone pillow; pack the under-tree pieces (bowl, pillow, gifts, basket and the pair) in one labelled box that travels with the tree.', 'Session 3, Nov 29-30:'),
      B(' decorate at NAHQ (about 3 hours, 3-4 people): bring the wire cutter, glue gun and sticks and the spare floral wire. Tell the organizers when done and wrap with their materials.', 'Dec 1-3:'),
      B(' Special Event Rentals picks up the tree.', 'Fri Dec 4:'),
      H('DIY build sheets (templates: HP26_Templates.pdf, print at Actual size)'),
      P('Every piece we make, then every bought piece we finish, with all its materials (calculated from the real dimensions; for shared supplies, this piece\'s share), its tools and its steps. Tools marked (office) come from the "Bring from home or office" list.'),
      ...items.filter(i => i.how && (i.diy || i.projects)).sort((a, b) => (b.diy ? 1 : 0) - (a.diy ? 1 : 0)).flatMap(i => {
        const mats = materialsOf(i, sups), tools = toolsOf(i, sups);
        return [B(i.diy ? ` makes ${i.made}.` : ' bought, then finished by us.', (i.form_name || i.name) + ':'),
          ...(mats.length ? [B(' ' + mats.join('; ') + '.', 'Materials:', 1)] : []),
          ...(tools.length ? [B(' ' + tools.join('; ') + '.', 'Tools:', 1)] : []),
          ...stepsOf(i.how).map((t, k) => k === 0 && !/^\(\d+\)/.test(t) ? B(' ' + t, 'Before you start:', 1) : B(' ' + t.replace(/^\((\d+)\)\s/, ''), (t.match(/^\((\d+)\)/) ? 'Step ' + t.match(/^\((\d+)\)/)[1] + ':' : 'Steps:'), 1))];
      }),
      H('Buy list by store'),
      B(` ${amz.length} listings, ${money(amz.reduce((a, i) => a + i.total, 0))} before GST${ship ? ` plus about ${money(ship.total)} delivery (${ship.notes.replace(/^From the listings[^:]*: /, '').split('. ')[0]})` : ''}.`, 'Amazon.ca:'),
      ...amz.map(i => B(` ${i.diy ? (i.materials || []).map(s => { const x = sups.find(y => y.id === s); return x ? `${x.qty} x ${x.name}` : s; }).join(', ') + ' = ' + money(i.total) : `${i.qty} x ${money(i.price)}`}`, (i.form_name || i.name) + ':', 1)),
    ];
    for (const store of ['DeSerres', 'Canadian Tire']) {
      const rows = sups.filter(x => x.store === store), tot = rows.reduce((a, x) => a + x.price * x.qty, 0);
      if (!rows.length) continue;
      kids.push(B(store === 'DeSerres' ? ` ${rows.length} lines, ${money(tot)} before GST. Free shipping to Alberta over $149, no oversized items. Every line showed "Ships in 48 hours" on Nov 16: order by Nov 17 as ONE shipment (Canada Post from Quebec, expect Nov 25-27). DeSerres shows "In stock" even on backorder, so read the confirmation email; Michaels Edmonton is the fallback.` : ` ${rows.length} lines, ${money(tot)} before GST, store pickup in Edmonton.`, store + ':'));
      rows.forEach(x => kids.push(B(` ${x.qty} x ${money(x.price)} (need ${x.need} ${x.unit}${x.have != null ? `, have ${x.have}` : ''})`, x.name + ':', 1)));
    }
    if (items.some(i => i.id === 'gift_card')) kids.push(B(' 2 x $100 gift cards, in store (5611 104 St NW). GST-exempt.', 'Homes Alive Pets:'));
    kids.push(H('Bring from home or office (confirm who brings what)'), ...(ctx.onHand || []).map(x => B(x)),
      H('Rules from the kickoff'),
      B('Secure every ornament, bow, pick and plush with floral wire; the tree is moved several times.'),
      B('No tree skirt, no lights (the 7.5 ft Wimberley Pine is pre-lit), no PCL/Oilers or other branding, no food.'),
      B('Decorate all the way around. Expense code: Holiday2026_TreeGallery.'),
      B('Under-tree pieces (bowl, pillow, gifts, basket, the dog and cat) are not fixed to the tree: pack them in one labelled box that travels with it and set them out again at the ECC.'));
    return new Document({
      creator: 'Corporate Finance Tree Committee', title: 'Committee plan – Home for the Howlidays', fonts: FONTS,
      styles: { default: { document: { run: { font: F.reg, size: 23, color: INK } } } },
      numbering: { config: [{ reference: 'bul', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 300, hanging: 220 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 640, hanging: 220 } } } }] }] },
      sections: [{ properties: { page: PAGE }, children: kids }],
    });
  }
  const api = {
    aboutText, build, materialsOf, toolsOf,
    blob: (D, kind, ctx) => D.Packer.toBlob(build(D, kind, ctx)),
    buffer: (D, kind, ctx) => D.Packer.toBuffer(build(D, kind, ctx)),
  };
  if (typeof module !== 'undefined') module.exports = api; else root.howlDocs = api;
})(this);
