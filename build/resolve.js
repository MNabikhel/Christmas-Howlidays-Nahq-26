/* Turns a selection ({element id: option id}) into the order list, supplies and totals.
   Mirrors resolve() in build/build_plan.py exactly; build/check_resolve.js checks every option against it. */
(function (root) {
  function resolve(O, sel) {
    const pick = e => e.options.find(o => o.id === sel[e.id]) || e.options.find(o => o.id === e.default);
    const chosen = O.elements.map(pick).concat([O.base]);
    const provides = {}; chosen.forEach(o => Object.assign(provides, o.provides || {}));
    const rows = {}, order = [];
    chosen.forEach(o => o.rows.forEach(r => {
      if (!rows[r.id]) { rows[r.id] = { qty: 0, made: null, price: null, carries: [] }; order.push(r.id); }
      rows[r.id].qty += r.qty;
      if (r.made !== undefined) rows[r.id].made = (rows[r.id].made || 0) + r.made;
    }));
    const need = {}, norder = [];
    chosen.forEach(o => o.needs.forEach(([s0, p, a, h]) => {
      const s = provides[s0] || s0;
      if (!need[s]) { need[s] = []; norder.push(s); }
      need[s].push([p, a, h]);
    }));
    const sups = [];
    norder.forEach(s => {
      const X = O.supplies[s], uses = need[s], tot = uses.reduce((t, u) => t + u[1], 0);
      const qty = X.per == null ? 1 : Math.max(1, Math.ceil(Math.round(tot * (X.counted ? 1 : O.margin) / X.per * 1e6) / 1e6));
      let target = (X.carrier || []).find(c => rows[c]);
      if (!target) target = X.row ? s : ({ 'DeSerres': 'craft_supplies', 'Canadian Tire': 'ct_supplies' })[X.store];
      if (!rows[target]) { rows[target] = { qty: target === s ? qty : 1, made: null, price: target === s ? X.price : null, carries: [] }; order.push(target); }
      if (target !== s) rows[target].carries.push(s);
      const have = X.per == null ? null : qty * X.per;
      sups.push({
        id: s, name: X.name, store: X.store, url: X.url, price: X.price, qty, per: X.per, unit: X.unit, need: pyRound(tot, 1), have,
        spare: have == null || tot === 0 ? null : pyRound((have - tot) / tot * 100, 0), carrier: target,
        ok: X.per == null || have >= tot * (X.counted ? 1 : O.margin) - 1e-9,
        uses: uses.map(([p, a, h]) => ({ project: p, amount: pyRound(a, 1), how: h })),
      });
    });
    const S_BY = Object.fromEntries(sups.map(x => [x.id, x]));
    const out = [], ships = [];
    order.forEach(id => {
      const r = rows[id], it = Object.assign({}, O.catalog[id]); it.qty = r.qty;
      if (r.made !== null) it.made = r.made;
      if (r.carries.length) { it.price = pyRound(r.carries.reduce((t, s) => t + S_BY[s].price * S_BY[s].qty, 0), 2); it.qty = 1; it.materials = r.carries; }
      else if (r.price !== null) it.price = r.price;
      else if (it.diy) it.price = 0;
      // delivery is counted per unit (worst case), as in build_plan.py
      const sh = pyRound((it.ship || 0) * r.qty + r.carries.reduce((t, s) => t + (O.supplies[s].ship || 0) * S_BY[s].qty, 0) + (O.supplies[id] && r.price !== null ? (O.supplies[id].ship || 0) * r.qty : 0), 2);
      if (sh) ships.push([it.form_name || it.name, sh]);
      out.push(it);
    });
    if (ships.length) {
      out.push(Object.assign({}, O.catalog.shipping, {
        price: pyRound(ships.reduce((t, s) => t + s[1], 0), 2), qty: 1, store: 'Amazon.ca', url: 'https://www.amazon.ca/',
        name: 'Amazon.ca delivery on the listings that charge it ($0 with Prime)', form_name: 'Shipping (Amazon.ca)',
        notes: 'From the listings, counted per unit where we buy more than one (the worst case; confirm the delivery line at checkout): ' + ships.map(([n, s]) => `${n} $${s.toFixed(2)}`).join(', ') + '. Everything else ships free on an order over $35; DeSerres ships free over $149; Canadian Tire is store pickup.',
      }));
    }
    out.forEach(it => { it.total = pyRound(it.price * it.qty, 2); });
    const secIdx = s => O.sections.indexOf(s);
    out.sort((a, b) => secIdx(a.section) - secIdx(b.section));   // stable, like Python's sort
    const sub = pyRound(out.reduce((t, i) => t + i.total, 0), 2);
    const taxable = out.filter(i => !(O.catalog[i.id] || {}).gst_exempt).reduce((t, i) => t + i.total, 0);
    const gst = pyRound(taxable * 0.05, 2), grand = pyRound(sub + gst, 2);
    return { items: out, supplies: sups, chosen: Object.fromEntries(O.elements.map(e => [e.id, pick(e)])), totals: { subtotal: sub, gst, grand, left: pyRound(O.budget - grand, 2) } };
  }
  // round half up, the same as rnd() in build_plan.py
  function pyRound(x, d) { const m = Math.pow(10, d); return Math.floor(x * m + 0.5 + 1e-9) / m; }
  resolve.pyRound = pyRound;
  if (typeof module !== 'undefined') module.exports = resolve; else root.howlResolve = resolve;
})(this);
