/* The page's resolver (resolve.js) must give the same list and totals as build_plan.py for the default
   and for every single-option swap. Fails the build otherwise. */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const resolve = require('./resolve.js');
const ROOT = path.join(__dirname, '..');
const O = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'options.json'), 'utf8'));
const sels = [{}];
O.elements.forEach(e => e.options.forEach(o => sels.push({ [e.id]: o.id })));
// a few multi-swaps too
sels.push(Object.fromEntries(O.elements.map(e => [e.id, e.options[e.options.length - 1].id])));
sels.push(Object.fromEntries(O.elements.map(e => [e.id, e.options[1 % e.options.length].id])));
const PY = [
  'import json, sys',
  "sys.path.insert(0, 'build')",
  'import build_plan as B',
  'out = []',
  'for sel in json.loads(sys.argv[1]):',
  '    items, sups, tot = B.resolve(sel)',
  "    out.append(dict(tot=tot, rows=[[i['id'], i['qty'], i.get('made'), i['price'], i['total']] for i in items], sups=[[s['id'], s['qty'], s['carrier'], s['need'], s['spare']] for s in sups]))",
  'print(json.dumps(out))',
].join('\n');
const py = JSON.parse(execFileSync('python3', ['-c', PY, JSON.stringify(sels)], { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
let bad = 0;
sels.forEach((sel, k) => {
  const r = resolve(O, sel), p = py[k];
  const js = {
    tot: { subtotal: r.totals.subtotal, gst: r.totals.gst, grand: r.totals.grand, left: r.totals.left },
    rows: r.items.map(i => [i.id, i.qty, i.made === undefined ? null : i.made, i.price, i.total]),
    sups: r.supplies.map(s => [s.id, s.qty, s.carrier, s.need, s.spare]),
  };
  if (JSON.stringify(js) !== JSON.stringify(p)) {
    bad++;
    console.log('MISMATCH', JSON.stringify(sel));
    console.log(' js', JSON.stringify(js).slice(0, 400));
    console.log(' py', JSON.stringify(p).slice(0, 400));
  }
});
console.log(`resolver check: ${sels.length} selections, ${bad} mismatches`);
if (bad) process.exit(1);
