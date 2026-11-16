"""Builds output/lookbook.html from data/lookbook.json and the images in data/lookbook/ (GOAL.md, point 1)."""
import base64, html, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
LB = json.loads((ROOT / 'data' / 'lookbook.json').read_text())
IMG = ROOT / 'data' / 'lookbook'
esc = lambda s: html.escape(str(s), quote=True)
money = lambda n: f'${n:,.2f}'
def img(name, alt, cls=''):
    f = IMG / f'{name}.jpg'
    if not f.exists(): return ''
    return f'<img class="{cls}" src="data:image/jpeg;base64,{base64.b64encode(f.read_bytes()).decode()}" alt="{esc(alt)}">'

S = 2.6  # px per inch in the size diagrams
def diagram(rows):
    """rows: [(label, board_min, board_max, now, proposed)] in inches; drawn beside a 7.5 ft tree at the same scale."""
    tree_h, tree_w, foot = 90, 52, 12
    widths = [max((bmax + (now or 0) + (prop or 0)) * S + 24, 170) for _, _, bmax, now, prop in rows]
    W = 30 + tree_w * S + 40 + sum(widths) + 20 * (len(rows) - 1) + 10; H = tree_h * S + 50; base = tree_h * S + 22
    o = [f'<svg viewBox="0 0 {W:.0f} {H:.0f}" style="max-width:{W:.0f}px" role="img" aria-label="Sizes drawn to scale beside the 7.5 ft tree">']
    cx = 20 + tree_w * S / 2
    o.append(f'<polygon class="tree" points="{cx},{base - tree_h * S} {cx - tree_w * S / 2},{base - foot * S} {cx + tree_w * S / 2},{base - foot * S}"/>')
    o.append(f'<rect class="trunk" x="{cx - 3}" y="{base - foot * S}" width="6" height="{foot * S}"/>')
    o.append(f'<line class="floor" x1="4" x2="{W - 4}" y1="{base}" y2="{base}"/>')
    o.append(f'<text class="lbl" x="{cx}" y="{base + 16}" text-anchor="middle">7.5 ft tree</text>')
    x = 30 + tree_w * S + 40
    for (label, bmin, bmax, now, prop), w in zip(rows, widths):
        y = base - 36 * S
        o.append(f'<rect class="bmax" x="{x}" y="{y - bmax * S:.1f}" width="{bmax * S:.1f}" height="{bmax * S:.1f}"/>')
        o.append(f'<rect class="bmin" x="{x}" y="{y - bmin * S:.1f}" width="{bmin * S:.1f}" height="{bmin * S:.1f}"/>')
        xx = x + bmax * S + 12
        if now and now != prop: o.append(f'<rect class="now" x="{xx:.1f}" y="{y - now * S:.1f}" width="{now * S:.1f}" height="{now * S:.1f}"/>'); xx += now * S + 12
        o.append(f'<rect class="prop" x="{xx:.1f}" y="{y - prop * S:.1f}" width="{prop * S:.1f}" height="{prop * S:.1f}"/>')
        o.append(f'<text class="lbl b" x="{x}" y="{y + 18}">{esc(label)}</text>')
        o.append(f'<text class="lbl" x="{x}" y="{y + 34}">board {bmin:g}-{bmax:g}"</text>')
        o.append(f'<text class="lbl" x="{x}" y="{y + 50}">' + (f'now {now:g}" → proposed {prop:g}"' if now and now != prop else f'ours {prop:g}"') + '</text>')
        x += w + 20
    o.append('</svg>')
    return ''.join(o)

def alt_card(a):
    link = a.get('url') or (f"https://www.amazon.ca/dp/{a['asin']}" if a.get('asin') else '')
    price = money(a['price']) if a.get('price') else 'n/a'
    name = f'<a href="{esc(link)}" target="_blank" rel="noopener">{esc(a["name"])}</a>' if link else esc(a['name'])
    photo = img(a['photo'], a['name']) if a.get('photo') else '<div class="nophoto">No photo: found by web search, not on a Canadian store</div>'
    return f'<li class="alt">{photo}<div><p class="an">{name}</p><p class="ap">{price}</p><p class="aw"><b>Why not:</b> {esc(a["why"])}</p></div></li>'

secs, decisions = [], []
for e in LB['elements']:
    rows = []
    if e['id'] == 'pets':
        bs = {i['name']: i['in'] for i in e['board_size']['items']}
        rows = [('golden retriever', *bs['dog'], 11, 11), ('grey tabby', *bs['grey tabby'], 4.7, 8)]
        chosen = ''.join(f'<figure>{img(i["photo"], i["name"])}<figcaption><a href="{esc(i["url"])}" target="_blank" rel="noopener">{esc(i["name"])}</a><br>{money(i["price"])} x {i["qty"]} · <span class="pill {i["verdict"]}">{i["verdict"]}</span><br>{esc(i["why"])}</figcaption></figure>' for i in e['chosen']['items'])
    else:
        bmin, bmax = e['board_size']['in']; c = e['chosen']
        rows = [(e['board_size']['label'], bmin, bmax, e['current'].get('size_in'), c['size_in'])]
        link = f'<a href="{esc(c["url"])}" target="_blank" rel="noopener">{esc(c["name"])}</a>' if c.get('url') else esc(c['name'])
        chosen = f'<figure>{img(c["photo"], c["name"])}<figcaption>{link}<br>{money(c["price"])}{" x " + str(c["qty"]) if c.get("qty", 1) > 1 else ""}<br>{esc(c["why"])}{"<br><b>Materials:</b> " + esc(c["materials"]) if c.get("materials") else ""}</figcaption></figure>'
    board = ''.join(img(b, 'Inspiration board: ' + e['title'], 'bimg') for b in e['board'])
    r2 = f'<figure>{img(e["current"]["render2"], "Current 3D preview")}<figcaption>{esc(e["current"].get("render2_note", ""))}</figcaption></figure>' if e['current'].get('render2') else ''
    prop = e['chosen'].get('proposed')
    adds = ''.join(f'<li>{esc(x)}</li>' for x in e.get('additions', []))
    for x in e.get('additions', []): decisions.append((e['title'], x))
    if prop: decisions.append((e['title'], 'Approve: ' + prop))
    bc = e['budget_change']
    secs.append(f'''<section class="el" id="{e['id']}">
  <header class="elh"><h2>{esc(e['title'])}</h2><span class="pill {e['verdict']}">{e['verdict']}</span><span class="chip">{'+' if bc > 0 else ''}{money(bc)} before GST</span></header>
  <p class="vn">{esc(e['verdict_note'])}</p>
  <div class="trio">
    <div class="col"><h3>On the board</h3><div class="bgrid">{board}</div><p class="cap">{esc(e['board_desc'])}</p></div>
    <div class="col"><h3>What we'd buy or build</h3>{chosen}{f'<p class="cap"><b>Proposed:</b> {esc(prop)}</p>' if prop else ''}</div>
    <div class="col"><h3>In the 3D preview now</h3><figure>{img(e['current']['render'], 'Current 3D preview')}<figcaption>{esc(e['current']['desc'])}</figcaption></figure>{r2}</div>
  </div>
  <h3>Size against the tree, to scale</h3>
  <div class="diag">{diagram(rows)}<p class="legend"><span class="k bmin"></span>board, smallest reading <span class="k bmax"></span>board, largest reading <span class="k now"></span>now <span class="k prop"></span>proposed</p></div>
  <h3>Alternatives considered ({len(e['alternatives'])})</h3>
  <ul class="alts">{''.join(alt_card(a) for a in e['alternatives'])}</ul>
  {f'<h3>Not on the board</h3><ul class="plain">{adds}</ul>' if adds else ''}
  <h3>Verify in the Chrome session before ordering</h3>
  <ul class="check">{''.join(f'<li>{esc(v)}</li>' for v in e['verify'])}</ul>
</section>''')

total = sum(e['budget_change'] for e in LB['elements']); spare = 160.93 - total * 1.05
sc = LB['scale']; ck = LB['checkpoint']
dec_html = ''.join(f'<li><b>{esc(t)}:</b> {esc(d)}</li>' for t, d in decisions)
page = f'''<title>Howlidays Lookbook</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">
<style>
/* Layout: one reading column; each board element is a section with board / ours / 3D side by side, then scale, alternatives and checks. */
:root {{ --bg: #F3F4EF; --surface: #FFFFFF; --ink: #19231D; --muted: #56655C; --line: #D9E0DA; --chip: #E8EEE9; --pine: #1F5A41; --berry: #A6192E; --amber: #9A6A12;
  --tree: #2E6B4B; --bmin: rgba(166,25,46,.18); --bmaxs: #A6192E; --now: #8C8F8A; --prop: #1F5A41;
  --display: "Bricolage Grotesque", "Avenir Next", "Segoe UI", system-ui, sans-serif; --body: "Figtree", "Segoe UI", system-ui, sans-serif; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg: #0F1512; --surface: #161F1A; --ink: #E6EDE8; --muted: #9AA9A0; --line: #27342D; --chip: #1E2A24; --pine: #7CC09C; --berry: #F07A8B; --amber: #E2B259;
  --tree: #3F8A62; --bmin: rgba(240,122,139,.22); --bmaxs: #F07A8B; --now: #8E958F; --prop: #7CC09C; color-scheme: dark; }} }}
:root[data-theme="dark"] {{ --bg: #0F1512; --surface: #161F1A; --ink: #E6EDE8; --muted: #9AA9A0; --line: #27342D; --chip: #1E2A24; --pine: #7CC09C; --berry: #F07A8B; --amber: #E2B259;
  --tree: #3F8A62; --bmin: rgba(240,122,139,.22); --bmaxs: #F07A8B; --now: #8E958F; --prop: #7CC09C; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); margin: 0; }}
main {{ max-width: 1120px; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 28px; }}
main > * {{ min-width: 0; }}
a {{ color: var(--pine); text-underline-offset: 2px; }}
.eyebrow {{ font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--berry); margin: 0; }}
h1 {{ font-family: var(--display); font-weight: 800; font-size: clamp(30px, 5vw, 44px); line-height: 1.05; margin: 4px 0 8px; text-wrap: balance; }}
h2 {{ font-family: var(--display); font-weight: 800; font-size: 26px; margin: 0; text-wrap: balance; }}
h3 {{ font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 18px 0 8px; }}
.lede {{ max-width: 70ch; color: var(--muted); margin: 0; }}
.status {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }}
.stat {{ background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }}
.stat b {{ display: block; font-family: var(--display); font-size: 24px; font-variant-numeric: tabular-nums; }}
.stat span {{ color: var(--muted); font-size: 13px; }}
.finding {{ background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--berry); border-radius: 12px; padding: 16px 18px; }}
.finding p {{ margin: 0 0 8px; }}
.tablewrap {{ overflow-x: auto; }}
table {{ border-collapse: collapse; font-variant-numeric: tabular-nums; min-width: 460px; }}
th, td {{ text-align: left; padding: 6px 12px 6px 0; border-bottom: 1px solid var(--line); font-size: 14px; }}
th {{ color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }}
.bad {{ color: var(--berry); font-weight: 700; }} .good {{ color: var(--pine); font-weight: 700; }}
.decide {{ background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }}
.decide ol {{ margin: 0; padding-left: 20px; display: grid; gap: 6px; }}
.el {{ background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 20px; }}
.elh {{ display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }}
.pill {{ font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }}
.pill.match {{ background: var(--pine); color: var(--surface); }} .pill.close {{ background: var(--amber); color: var(--surface); }}
.chip {{ font-size: 13px; color: var(--muted); background: var(--chip); padding: 3px 10px; border-radius: 999px; font-variant-numeric: tabular-nums; }}
.vn {{ margin: 10px 0 0; max-width: 80ch; }}
.trio {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 8px; }}
.col {{ min-width: 0; }}
.bgrid {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }}
.bgrid img:first-child:last-child {{ grid-column: 1 / -1; }}
figure {{ margin: 0 0 12px; }}
img {{ display: block; width: 100%; max-width: 100%; height: auto; border-radius: 10px; background: #fff; border: 1px solid var(--line); }}
.bimg {{ aspect-ratio: 1; object-fit: cover; }}
figcaption, .cap {{ font-size: 13px; color: var(--muted); margin-top: 6px; }}
figcaption a {{ font-weight: 600; }}
.diag svg {{ width: 100%; height: auto; display: block; }}
.diag .tree {{ fill: var(--tree); opacity: .55; }} .diag .trunk {{ fill: var(--muted); }} .diag .floor {{ stroke: var(--line); stroke-width: 2; }}
.diag .bmin {{ fill: var(--bmin); stroke: none; }} .diag .bmax {{ fill: none; stroke: var(--bmaxs); stroke-width: 1.5; stroke-dasharray: 4 3; }}
.diag .now {{ fill: none; stroke: var(--now); stroke-width: 2; }} .diag .prop {{ fill: var(--prop); }}
.diag .lbl {{ fill: var(--muted); font: 12px var(--body); }} .diag .lbl.b {{ fill: var(--ink); font-weight: 700; }}
.legend {{ display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 12px; color: var(--muted); margin: 6px 0 0; }}
.k {{ display: inline-block; width: 14px; height: 14px; margin-right: -8px; border-radius: 2px; vertical-align: -2px; }}
.k.bmin {{ background: var(--bmin); }} .k.bmax {{ border: 1.5px dashed var(--bmaxs); }} .k.now {{ border: 2px solid var(--now); }} .k.prop {{ background: var(--prop); }}
.alts {{ list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }}
.alt {{ display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 10px; align-items: start; border: 1px solid var(--line); border-radius: 10px; padding: 8px; }}
.alt img, .nophoto {{ width: 84px; height: 84px; object-fit: contain; }}
.nophoto {{ font-size: 10.5px; color: var(--muted); background: var(--chip); border-radius: 8px; padding: 6px; display: grid; place-items: center; text-align: center; }}
.alt p {{ margin: 0; font-size: 13px; }} .an {{ font-weight: 600; }} .ap {{ color: var(--muted); font-variant-numeric: tabular-nums; }} .aw {{ margin-top: 4px !important; }}
.check, .plain {{ margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: 14px; }}
.check li::marker {{ content: "☐  "; }}
@media (max-width: 860px) {{ .trio {{ grid-template-columns: 1fr; }} .el {{ padding: 16px; }} }}
</style>
<main>
  <header>
    <p class="eyebrow">Corporate Finance · 2026 Tree Gallery · Home for the Howlidays</p>
    <h1>Lookbook: every element against the board</h1>
    <p class="lede">The goal: a tree the committee can buy and build exactly as the preview shows, with every element a true match to the inspiration board, proven side by side before anything is ordered. {esc(ck['note'])}</p>
  </header>
  <div class="status">
    <div class="stat"><b>{ck['done']} of {ck['of']}</b><span>board elements done (checkpoint)</span></div>
    <div class="stat"><b>{'+' if total > 0 else ''}{money(total * 1.05)}</b><span>these 3 changes, incl. GST</span></div>
    <div class="stat"><b>{money(spare)}</b><span>left of $2,000 after them (floor: $75)</span></div>
    <div class="stat"><b>Not yet</b><span>verified today: Amazon checks run in the Chrome session</span></div>
  </div>
  <section class="finding">
    <h2>The key finding: scale</h2>
    <p>Measured against the tree, the board's ornaments are two to three times bigger than most of what we bought. Small ornaments get lost behind the 11" bows, which is why the preview looks like an ordinary tree.</p>
    <div class="tablewrap"><table><thead><tr><th>Element</th><th>On the board</th><th>On our list</th><th></th></tr></thead><tbody>
      <tr><td>Topper bow</td><td>15-24" wide</td><td>24"</td><td class="good">fits</td></tr>
      <tr><td>Golden retriever</td><td>10-16" tall</td><td>11" sitting</td><td class="good">fits</td></tr>
      <tr><td>Tabby cats</td><td>8-15"</td><td>4.7"</td><td class="bad">too small</td></tr>
      <tr><td>Doghouse ornaments</td><td>10-15"</td><td>4.3"</td><td class="bad">too small</td></tr>
      <tr><td>Paw ornaments</td><td>5-8"</td><td>4"</td><td class="bad">too small</td></tr>
      <tr><td>Bones</td><td>7-11" long</td><td>5"</td><td class="bad">too small</td></tr>
      <tr><td>Big red baubles</td><td>4.5-7"</td><td>3.15"</td><td class="bad">too small</td></tr>
    </tbody></table></div>
    <p class="cap">{esc(sc['how'])}</p>
  </section>
  <section class="decide">
    <h2>Decisions for you at this checkpoint</h2>
    <ol>{dec_html}
      <li><b>Budget for the other 11 elements:</b> after these three, {money(spare)} is left. Matching the board's scale for the paw ornaments, bones and baubles will need money from somewhere. I propose fewer, bigger pieces, paid for by cutting small filler (for example, the 100 tiny champagne baubles, $40.99), which the board does not show.</li>
    </ol>
  </section>
  {''.join(secs)}
</main>'''
(ROOT / 'output' / 'lookbook.html').write_text(page, encoding='utf-8')
print('lookbook ok', round(len(page) / 1e6, 2), 'MB')
