"""Builds output/lookbook.html: one page per element of the inspiration board (GOAL.md, point 1).

Each page: the board crop, what we buy or build (the board-match option), the 3D preview of it, its size
against the tree drawn to scale, every option the 3D page can swap in (with the price change), other
products considered and why they lost, and the checks to run in the Chrome session before ordering.
Data: data/options.json (built by build_plan.py), data/lookbook.json (board notes, sizes, alternatives
considered, verification results), images in data/lookbook/.
"""
import base64, html, json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'build'))
import build_plan as B   # the same resolver as the 3D page

O = json.loads((ROOT / 'data' / 'options.json').read_text())
LB = json.loads((ROOT / 'data' / 'lookbook.json').read_text())
ITEMS = {i['id']: i for i in json.loads((ROOT / 'data' / 'items.json').read_text())}
SUP = json.loads((ROOT / 'data' / 'supplies.json').read_text())
IMG = ROOT / 'data' / 'lookbook'
esc = lambda s: html.escape(str(s), quote=True)
money = lambda n: ('−' if n < 0 else '') + f'${abs(n):,.2f}'
T0 = SUP['totals']
DEF = {e['id']: e['default'] for e in O['elements']}

def img(name, alt, cls='', size=None):
    f = IMG / f'{name}.jpg'
    if not name or not f.exists(): return ''
    if size:
        from PIL import Image; import io
        im = Image.open(f).convert('RGB'); im.thumbnail((size, size)); b = io.BytesIO(); im.save(b, 'JPEG', quality=84); data = b.getvalue()
    else: data = f.read_bytes()
    return f'<img class="{cls}" src="data:image/jpeg;base64,{base64.b64encode(data).decode()}" alt="{esc(alt)}" loading="lazy">'

S = 2.6  # px per inch in the size diagrams
def diagram(label, bmin, bmax, ours):
    """The board's range and our size, beside a 7.5 ft tree at the same scale."""
    tree_h, tree_w, foot = 90, 52, 12
    W = 30 + tree_w * S + 40 + bmax * S + 12 + ours * S + 190; H = tree_h * S + 50; base = tree_h * S + 22; cx = 20 + tree_w * S / 2
    o = [f'<svg viewBox="0 0 {W:.0f} {H:.0f}" style="max-width:{W:.0f}px" role="img" aria-label="{esc(label)}: board {bmin:g}-{bmax:g} inches, ours {ours:g} inches, beside the 7.5 ft tree">',
         f'<polygon class="tree" points="{cx},{base - tree_h * S} {cx - tree_w * S / 2},{base - foot * S} {cx + tree_w * S / 2},{base - foot * S}"/>',
         f'<rect class="trunk" x="{cx - 3}" y="{base - foot * S}" width="6" height="{foot * S}"/>', f'<line class="floor" x1="4" x2="{W - 4}" y1="{base}" y2="{base}"/>',
         f'<text class="lbl" x="{cx}" y="{base + 16}" text-anchor="middle">7.5 ft tree</text>']
    x = 30 + tree_w * S + 40; y = base - 36 * S
    o += [f'<rect class="bmax" x="{x}" y="{y - bmax * S:.1f}" width="{bmax * S:.1f}" height="{bmax * S:.1f}"/>', f'<rect class="bmin" x="{x}" y="{y - bmin * S:.1f}" width="{bmin * S:.1f}" height="{bmin * S:.1f}"/>']
    xx = x + bmax * S + 12
    o += [f'<rect class="prop" x="{xx:.1f}" y="{y - ours * S:.1f}" width="{ours * S:.1f}" height="{ours * S:.1f}"/>',
          f'<text class="lbl b" x="{x}" y="{y + 18}">{esc(label)}</text>', f'<text class="lbl" x="{x}" y="{y + 34}">board {bmin:g}-{bmax:g}" · ours {ours:g}"</text>', '</svg>']
    return ''.join(o)

def delta(el, opt):
    _, _, t = B.resolve({el: opt}); return round(t['grand'] - T0['grand'], 2), t['left']

def opt_card(e, o):
    d, left = delta(e['id'], o['id'])
    pic = img(f"r3d_{e['id']}_{o['id']}", o['label'], size=360) or img(o.get('photo') or '', o['label'], size=360) or '<div class="nophoto">nothing to show</div>'
    pill = f'<span class="pill {o["match"]}">{o["match"]}</span>' if o.get('match') else '<span class="pill extra">extra</span>'
    tight = ' <b class="warn">under the $75 floor</b>' if left < O['floor'] else ''
    return f'<li class="alt">{pic}<div><p class="an">{esc(o["label"])} {pill}</p><p class="ap">{"+" if d > 0 else ""}{money(d)} incl. GST · {money(left)} left{tight}</p><p class="aw">{esc(o["why"])}</p></div></li>'

def considered_card(a):
    link = a.get('url') or (f"https://www.amazon.ca/dp/{a['asin']}" if a.get('asin') else '')
    name = f'<a href="{esc(link)}" target="_blank" rel="noopener">{esc(a["name"])}</a>' if link else esc(a['name'])
    pic = img(a.get('photo') or '', a['name'], size=300) or '<div class="nophoto">No photo: found by web search, not on a Canadian store</div>'
    return f'<li class="alt">{pic}<div><p class="an">{name}</p><p class="ap">{money(a["price"]) if a.get("price") else "n/a"}</p><p class="aw"><b>Why not:</b> {esc(a["why"])}</p></div></li>'

def rows_of(o):
    """What this option puts on the order list, as resolved for the board-match plan (DIY rows include the materials only they use)."""
    out = []
    for r in o['rows']:
        it = ITEMS.get(r['id'])
        if not it: continue
        mats = ''
        if it.get('materials'):
            mats = '; '.join(f"{s['qty']} x {s['name']}" for s in SUP['supplies'] if s['id'] in it['materials'])
        what = f"makes {it.get('made')}" if it.get('diy') else f"{it['qty']} x {money(it['price'])}"
        out.append(f'<li><a href="{esc(it["url"])}" target="_blank" rel="noopener">{esc(it.get("form_name") or it["name"])}</a> · {what} · <b>{money(it["total"])}</b>'
                   + (f'<br><span class="cap">materials: {esc(mats)}</span>' if mats else '') + (f'<br><span class="cap">arrives by {it["arrives_by"]}</span>' if it.get('arrives_by') else '') + '</li>')
    return ''.join(out)

UNIT = {'in2': 'sq in'}
import re
def steps_html(how):
    parts = re.split(r'\s(?=\(\d+\)\s)', how.strip())
    lead = '' if re.match(r'\(\d+\)\s', parts[0]) else parts.pop(0)
    items = ''.join(f'<li>{esc(re.sub(r"^\(\d+\)\s", "", x))}</li>' for x in parts)
    return (f'<p class="steps">{esc(lead)}</p>' if lead else '') + (f'<ol class="steps">{items}</ol>' if items else '')
def make_block(o):
    """Every piece this option makes or finishes: all its materials (its share of each supply, from the build's calculation), its tools and its steps."""
    out = []
    for r in o['rows']:
        it = ITEMS.get(r['id'])
        if not it or not it.get('how') or not (it.get('diy') or it.get('projects')): continue
        P = set(it.get('projects') or [])
        mats = [f"{s['name']}: {round(sum(u['amount'] for u in s['uses'] if u['project'] in P), 1):g} {UNIT.get(s['unit'], s['unit'])}" for s in SUP['supplies'] if any(u['project'] in P for u in s['uses'])]
        S_BY = {s['id']: s['name'] for s in SUP['supplies']}
        tools = [S_BY.get(t, t) for t in it.get('tools') or []]
        head = f"makes {it.get('made')}" if it.get('diy') else 'bought, then finished by us'
        out.append(f'<div class="make"><p class="an">{esc(it.get("form_name") or it["name"])} <span class="cap">· {esc(head)}</span></p>'
                   + (f'<p class="cap"><b>Materials:</b> {esc("; ".join(mats))}.</p>' if mats else '')
                   + (f'<p class="cap"><b>Tools:</b> {esc("; ".join(tools))}.</p>' if tools else '')
                   + steps_html(it['how']) + '</div>')
    return ''.join(out)

def verify_list(e, o):
    out = []
    for r in o['rows']:
        it = ITEMS.get(r['id'])
        if not it: continue
        if it.get('materials'):
            for s in SUP['supplies']:
                if s['id'] in it['materials']: out.append(f"{s['name']} ({s['store']}): {s['url']} · {s['qty']} at {money(s['price'])}, in stock, delivery date to T6E (must be by Nov 30)")
        elif it['store'] not in ('Homes Alive Pets',) and it.get('url', '').startswith('http') and it['total'] > 0:
            out.append(f"{it.get('form_name') or it['name']}: {it['url']} · {it['qty']} at {money(it['price'])}, in stock, delivery date to T6E (aim Nov 21, must be by Nov 30), photo still matches the board crop")
    for s in SUP['supplies']:   # shared materials this option's build uses (velvet, clay, felt...)
        if s['carrier'] == s['id'] and (s['id'] != 'floral_wire' or e['id'] == 'ribbon') and any(u['project'] in {r['id'] for r in o['rows']} | {e['id']} for u in s['uses']) and not any(s['name'] in x for x in out):
            out.append(f"{s['name']} ({s['store']}): {s['url']} · {s['qty']} at {money(s['price'])}, in stock, delivery date to T6E (aim Nov 21)")
    n_alt = len(e['options']) - 1 + len(LB['elements'][e['id']].get('considered', []))
    if n_alt < 3 and o.get('match') and o['rows']: out.append(f'Search for {3 - n_alt} more candidate{"s" if 3 - n_alt > 1 else ""} against the board crop and add them under "considered" with a photo, price and why not.')
    return out

secs, index, verdicts = [], [], {'match': 0, 'close': 0, None: 0}
for e in O['elements']:
    L = LB['elements'][e['id']]; o = next(x for x in e['options'] if x['id'] == e['default'])
    verdicts[o.get('match')] += 1 if e['id'] not in ('flourish', 'giant') else 0
    board = ''.join(img(b, 'Inspiration board: ' + e['title'], 'bimg', size=700) for b in L['board'])
    r3d = img(f"r3d_{e['id']}_{o['id']}", '3D preview: ' + o['label'], size=700)
    chosen_pic = img(o.get('photo') or '', o['label'], size=700) if o.get('photo') and not o['photo'].startswith('r3d') else ''
    sz = L.get('size'); diag = ''
    if sz and o['id'] in sz['ours']:
        diag = f'<h3>Size against the tree, to scale</h3><div class="diag">{diagram(sz["label"], *sz["board"], sz["ours"][o["id"]])}<p class="legend"><span class="k bmin"></span>board, smallest reading <span class="k bmax"></span>board, largest reading <span class="k prop"></span>ours</p></div>'
    others = [x for x in e['options'] if x['id'] != o['id']]
    cons = L.get('considered', [])
    ver = L.get('verified')
    vstat = f'<span class="chip ok">verified {esc(ver["date"])}</span>' if ver else '<span class="chip">not yet verified today</span>'
    is_extra = e['id'] in ('flourish', 'giant')
    pill = '<span class="pill extra">extra, off by default</span>' if is_extra else f'<span class="pill {o["match"]}">{o["match"]}</span>'
    index.append(f'<li><a href="#{e["id"]}">{esc(e["title"])}</a> {pill}</li>')
    secs.append(f'''<section class="el" id="{e['id']}">
  <header class="elh"><h2>{esc(e['title'])}</h2>{pill}{vstat}</header>
  <p class="vn"><b>{esc(o['label'])}.</b> {esc(o['why'])}</p>
  <div class="trio">
    <div class="col"><h3>On the board</h3><div class="bgrid">{board}</div><p class="cap">{esc(L['board_desc'])}</p>{f'<p class="cap"><b>Our verdict:</b> {esc(L["notes"])}</p>' if L.get('notes') else ''}</div>
    <div class="col"><h3>What we buy or build</h3>{f'<figure>{chosen_pic}<figcaption>{"Main material; the finished piece is in the 3D preview." if ITEMS.get((o["rows"] or [{}])[0].get("id"), {}).get("diy") else "The listing photo."}</figcaption></figure>' if chosen_pic else ''}<ul class="rows">{rows_of(o) or '<li>Nothing: as the board.</li>'}</ul></div>
    <div class="col"><h3>In the 3D preview</h3>{f'<figure>{r3d}<figcaption>Close-up from the 3D page, at true size.</figcaption></figure>' if r3d else '<p class="cap">Nothing to show for this option.</p>'}</div>
  </div>
  {f'<h3>How we make it: materials, tools and steps</h3>{make_block(o)}' if make_block(o) else ''}
  {diag}
  <h3>Swap options in the 3D page ({len(others)})</h3>
  <ul class="alts">{''.join(opt_card(e, x) for x in others)}</ul>
  {f'<h3>Also considered ({len(cons)})</h3><ul class="alts">{"".join(considered_card(a) for a in cons)}</ul>' if cons else ''}
  <h3>Check in the Chrome session before ordering</h3>
  <ul class="check">{''.join(f'<li>{esc(v)}</li>' for v in verify_list(e, o)) or '<li>Nothing to buy.</li>'}</ul>
</section>''')

N_VER = sum(1 for e in O['elements'] if (LB['elements'][e['id']].get('verified') or {}).get('date') == LB['checked'])
JUDGMENTS = [
 ('Topper', 'Tied from 6" natural jute (B0DQ4BXYKZ): a 78" strip and an 8" knot piece, two 10" loops angled up about 20 degrees over two 14" tails, as on the board (the earlier 22" tails were 60% too long). 24 black felt paws of 3", about half the ribbon\'s width like the board\'s, on the front face only; floral wire glued along both back edges holds the unwired jute. Full cut list, knot, fray stop, tracing (white fabric marker) and fixing steps are on its page.'),
 ('Pets', 'Kept the 12" Cuddlekins golden retriever (a paler gold than the board\'s). The cats are now the Aurora Miyoni grey tabby (9" long, 6" tall): the board\'s striped grey-brown coat with a white chest, from a seller with 2,170 ratings. The earlier FLUFFYFUN pick was mostly white and standing, not the sitting tabby the plan claimed. No sitting striped grey tabby of 8-12" reaches Edmonton by Nov 30, so the cats are rated close: ours crouch where the board\'s sit. The same tabby sits with the dog under the tree.'),
 ('Doghouses', 'Six 10" foam-board doghouses at the board\'s scale, now with every board detail as a cut part: the flat U arch trim, barge boards, threshold, ridge cap and a raised paw (from the door offcut). Bricks score 0.9" x 1.5" through the template with an empty ballpoint, the joints stay dark (dark-brick base, barn red dabbed on the faces), roof undersides are sealed so they do not warp, and each 160 g house is wired upright through its floor. The printed cut plan fits all of it on 9 boards, so 10 still leaves a spare.'),
 ('Paw ornaments', 'Ten 6" ornaments: a hoop with only the outer ring primed and gilded (its brass screw reads as the cap), tea-stained Aida for the board\'s warm biscuit-cream face (9 x 9" pieces so it can be drawn drum-tight), a black glitter-card paw, a black felt back so it is finished from behind, and a bow hand-tied from the dark red velvet. The Faylapa 16-pk hoops are now the default: the same ornament, $37.69 less incl. GST than eleven DeSerres hoops, here Nov 20, with 6 spares; that saving pays for the wire cutter, cutting surface, third clay bag and the bigger Aida.'),
 ('Bones', 'Eight 9" bones at the board\'s chunky biscuit proportions (shaft 0.27, knob span 0.53 of the length, about 1" thick). Clay is calculated from the template outline (31 sq in) less the foil core: about 117 g each, so a third 500 g bag is bought (1,163 g needed for bones and biscuits). Each hangs level like the board from a gold cord whose two ends are glued into holes drilled over wire anchors in the upper knobs.'),
 ('Baubles', 'Big balls at the board\'s 4-6" scale: plain 6" reds (Benjia), 4" red glitter, 4" JOYIN reds and golds, the green glitter and champagne sets, and one 100-pc set to fill. The old 100-pc link now opened a Black & Gold set, so it points to the same seller\'s Red & Gold set; the 12 green glitter balls give the board\'s few greens. Patterned and sequin balls hang deep, smooth ones on the tips.'),
 ('Gifts', 'Cream burlap ribbon and bows on the gifts, as on the board (1.5" x 20 yd, $18.39), instead of velvet. Tartan paper on three boxes, kraft paw paper on the fourth.'),
 ('Velvet', 'The board mixes solid deep red velvet bows with the tartan ones on the tree, so five 9" velvet bows are tied from the spare 1.5" velvet (no extra cost) besides the paw-ornament and jar bows.'),
 ('Floor and basket', 'The bowl is now a deep red Bella dog bowl with a steel interior and paw prints, like the board (no paint marker needed). The basket bone toy is a cream sherpa bone with a felt paw (the old link was the grey variant). The lace liner comes out of the basket, the biscuits use the 2.7" cutter, and the throw is draped paw-side out.'),
 ('Vendors and delivery', "Prices re-checked on Nov 16. Delivery is counted per unit on international listings (worst case: the tartan's $5.45 on each of 5 rolls). DeSerres: every default line ships in 48 hours, as one shipment expected Nov 25-27; the committee plan's craft sessions start the clay bones, scarves and paws on Nov 20 with Amazon materials, so only painting waits for DeSerres, and Michaels Edmonton is the fallback if it has not shipped by Nov 19."),
 ('Giant doghouse, streamers, gold crown', 'Off by default: none of them are on the board. Each stays one tap away in Swap pieces.'),
]
page = f'''<meta charset="utf-8">
<title>Howlidays Lookbook</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">
<style>
/* One reading column; each board element is a section: board / ours / 3D, then scale, swap options, alternatives and checks. */
:root {{ --bg: #F3F4EF; --surface: #FFFFFF; --ink: #19231D; --muted: #56655C; --line: #D9E0DA; --chip: #E8EEE9; --pine: #1F5A41; --berry: #A6192E; --amber: #9A6A12;
  --tree: #2E6B4B; --bmin: rgba(166,25,46,.18); --bmaxs: #A6192E; --prop: #1F5A41;
  --display: "Bricolage Grotesque", "Avenir Next", "Segoe UI", system-ui, sans-serif; --body: "Figtree", "Segoe UI", system-ui, sans-serif; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg: #0F1512; --surface: #161F1A; --ink: #E6EDE8; --muted: #9AA9A0; --line: #27342D; --chip: #1E2A24; --pine: #7CC09C; --berry: #F07A8B; --amber: #E2B259;
  --tree: #3F8A62; --bmin: rgba(240,122,139,.22); --bmaxs: #F07A8B; --prop: #7CC09C; color-scheme: dark; }} }}
:root[data-theme="dark"] {{ --bg: #0F1512; --surface: #161F1A; --ink: #E6EDE8; --muted: #9AA9A0; --line: #27342D; --chip: #1E2A24; --pine: #7CC09C; --berry: #F07A8B; --amber: #E2B259;
  --tree: #3F8A62; --bmin: rgba(240,122,139,.22); --bmaxs: #F07A8B; --prop: #7CC09C; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); margin: 0; }}
main {{ max-width: 1120px; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 28px; }}
main > * {{ min-width: 0; }}
a {{ color: var(--pine); text-underline-offset: 2px; }}
.eyebrow {{ font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--berry); margin: 0; }}
h1 {{ font-family: var(--display); font-weight: 800; font-size: clamp(30px, 5vw, 44px); line-height: 1.05; margin: 4px 0 8px; text-wrap: balance; }}
h2 {{ font-family: var(--display); font-weight: 800; font-size: 26px; margin: 0; text-wrap: balance; }}
h3 {{ font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 18px 0 8px; }}
.lede {{ max-width: 72ch; color: var(--muted); margin: 0; }}
.status {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }}
.stat {{ background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }}
.stat b {{ display: block; font-family: var(--display); font-size: 24px; font-variant-numeric: tabular-nums; }}
.stat span {{ color: var(--muted); font-size: 13px; }}
.box {{ background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }}
.box.key {{ border-left: 4px solid var(--berry); }}
.box ol, .box ul {{ margin: 8px 0 0; padding-left: 20px; display: grid; gap: 6px; }}
.idx {{ columns: 2 240px; list-style: none; padding: 0 !important; display: block !important; }}
.idx li {{ margin: 0 0 6px; break-inside: avoid; }}
.el {{ background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 20px; scroll-margin-top: 12px; }}
.elh {{ display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }}
.pill {{ font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }}
.pill.match {{ background: var(--pine); color: var(--surface); }} .pill.close {{ background: var(--amber); color: var(--surface); }} .pill.extra {{ background: var(--chip); color: var(--muted); }}
.chip {{ font-size: 13px; color: var(--muted); background: var(--chip); padding: 3px 10px; border-radius: 999px; }} .chip.ok {{ color: var(--pine); font-weight: 700; }}
.vn {{ margin: 10px 0 0; max-width: 85ch; }}
.trio {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 8px; }}
.col {{ min-width: 0; }}
.bgrid {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }}
.bgrid img:first-child:last-child {{ grid-column: 1 / -1; }}
figure {{ margin: 0 0 10px; }}
img {{ display: block; width: 100%; max-width: 100%; height: auto; border-radius: 10px; background: #fff; border: 1px solid var(--line); }}
.bimg {{ aspect-ratio: 1; object-fit: cover; }}
figcaption, .cap {{ font-size: 13px; color: var(--muted); margin-top: 6px; }}
.rows {{ margin: 0; padding-left: 18px; display: grid; gap: 8px; font-size: 14px; }}
.diag svg {{ width: 100%; height: auto; display: block; }}
.diag .tree {{ fill: var(--tree); opacity: .55; }} .diag .trunk {{ fill: var(--muted); }} .diag .floor {{ stroke: var(--line); stroke-width: 2; }}
.diag .bmin {{ fill: var(--bmin); stroke: none; }} .diag .bmax {{ fill: none; stroke: var(--bmaxs); stroke-width: 1.5; stroke-dasharray: 4 3; }} .diag .prop {{ fill: var(--prop); }}
.diag .lbl {{ fill: var(--muted); font: 12px var(--body); }} .diag .lbl.b {{ fill: var(--ink); font-weight: 700; }}
.legend {{ display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 12px; color: var(--muted); margin: 6px 0 0; }}
.k {{ display: inline-block; width: 14px; height: 14px; margin-right: -8px; border-radius: 2px; vertical-align: -2px; }}
.k.bmin {{ background: var(--bmin); }} .k.bmax {{ border: 1.5px dashed var(--bmaxs); }} .k.prop {{ background: var(--prop); }}
.alts {{ list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }}
.alt {{ display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px; align-items: start; border: 1px solid var(--line); border-radius: 10px; padding: 8px; }}
.alt img, .nophoto {{ width: 96px; height: 96px; object-fit: cover; }}
.nophoto {{ font-size: 10.5px; color: var(--muted); background: var(--chip); border-radius: 8px; padding: 6px; display: grid; place-items: center; text-align: center; }}
.alt p {{ margin: 0; font-size: 13px; }} .an {{ font-weight: 600; }} .ap {{ color: var(--muted); font-variant-numeric: tabular-nums; }} .aw {{ margin-top: 4px !important; }}
.warn {{ color: var(--berry); }}
.make {{ border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin: 0 0 10px; }} .make p {{ margin: 0 0 6px; overflow-wrap: anywhere; }}
.make .steps {{ font-size: 14px; max-width: 95ch; margin: 0 0 6px; }} ol.steps {{ padding-left: 22px; display: grid; gap: 4px; }}
.check {{ margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: 14px; overflow-wrap: anywhere; }}
.check li::marker {{ content: "☐  "; }}
@media (max-width: 860px) {{ .trio {{ grid-template-columns: 1fr; }} .el {{ padding: 16px; }} }}
</style>
<main>
  <header>
    <p class="eyebrow">Corporate Finance · 2026 Tree Gallery · Home for the Howlidays</p>
    <h1>Lookbook: every element against the board</h1>
    <p class="lede">The goal: a tree the committee can buy and build exactly as the preview shows, with every element a true match to the inspiration board, shown side by side before anything is ordered. Each element below is the closest match we found; every other option is one tap away in the 3D page's Swap pieces, with its price.</p>
  </header>
  <div class="status">
    <div class="stat"><b>{verdicts['match']} match · {verdicts['close']} close</b><span>of the board's {verdicts['match'] + verdicts['close']} elements (2 extras off)</span></div>
    <div class="stat"><b>{money(T0['grand'])}</b><span>board match, incl. GST and shipping</span></div>
    <div class="stat"><b>{money(T0['left'])}</b><span>left of $2,000 (floor: $75)</span></div>
    <div class="stat"><b>{N_VER} of {len(O['elements'])}</b><span>elements with listings re-checked on {esc(LB['checked'])} (the rest: the Chrome session in CLAUDE.md)</span></div>
  </div>
  <section class="box key">
    <h2>The judgments I made</h2>
    <p class="cap">You asked me to decide; here is each call and why. All of them are reversible in Swap pieces.</p>
    <ol>{''.join(f'<li><b>{esc(t)}:</b> {esc(d)}</li>' for t, d in JUDGMENTS)}</ol>
  </section>
  <section class="box">
    <h2>Elements</h2>
    <ul class="idx">{''.join(index)}</ul>
    <p class="cap">{esc(LB['scale']['how'])}</p>
  </section>
  {''.join(secs)}
</main>'''
(ROOT / 'data' / 'verify.json').write_text(json.dumps({e['id']: verify_list(e, next(x for x in e['options'] if x['id'] == e['default'])) for e in O['elements']}, indent=1, ensure_ascii=False) + '\n')
(ROOT / 'output' / 'lookbook.html').write_text(page, encoding='utf-8')
print('lookbook ok', round(len(page) / 1e6, 2), 'MB |', verdicts)
