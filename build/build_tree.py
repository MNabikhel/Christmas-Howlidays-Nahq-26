"""Builds the 3D tree page from data/items.json.

Outputs:
  output/howlidays_tree.html          page body for republishing as a claude.ai Artifact (no <html>/<head> wrapper)
  output/howlidays_tree_preview.html  standalone page you can double-click to open in Chrome (needs internet for three.js + fonts)
"""
import base64, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
items = json.loads((ROOT / 'data' / 'items.json').read_text(encoding='utf-8'))
keep = ['id', 'section', 'name', 'store', 'url', 'price', 'qty', 'status', 'diy', 'made', 'notes', 'arrives_by', 'match']
slim = []
for it in items:
    d = {k: it[k] for k in keep if k in it}
    d['total'] = round(it['price'] * it['qty'], 2)
    img = ROOT / 'data' / 'img' / (it['id'] + '.jpg')  # main listing photo, embedded so the page works offline
    if img.exists(): d['img'] = 'data:image/jpeg;base64,' + base64.b64encode(img.read_bytes()).decode()
    slim.append(d)

ids = [i['id'] for i in items]
assert len(ids) == len(set(ids)), 'duplicate item ids'

script = (ROOT / 'build' / 'tree.js').read_text(encoding='utf-8')
# real-product cutouts and textures (background removed), embedded so the page is self-contained
from PIL import Image
cuts = {}
for f in sorted((ROOT / 'data' / 'cutouts').glob('*.webp')):
    w, h = Image.open(f).size
    cuts[f.stem] = {'src': 'data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode(), 'w': w, 'h': h}
template = (ROOT / 'build' / 'tree_template.html').read_text(encoding='utf-8')
docx = ROOT / 'output' / 'HP26_Tree_Gallery_Form_Corporate_Finance.docx'  # built first by build_docx.js
docx_b64 = base64.b64encode(docx.read_bytes()).decode() if docx.exists() else ''
page = template.replace('__DOCX__', docx_b64).replace('__ITEMS__', json.dumps(slim, ensure_ascii=False, separators=(',', ':'))).replace('__CUTS__', json.dumps(cuts, separators=(',', ':'))).replace('__SCRIPT__', script)
(ROOT / 'output' / 'howlidays_tree.html').write_text(page, encoding='utf-8')
preview = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
           '<style>body{margin:0}</style></head><body>' + page + '</body></html>')
(ROOT / 'output' / 'howlidays_tree_preview.html').write_text(preview, encoding='utf-8')

sub = sum(i['total'] for i in slim)
taxable = sum(i['total'] for i in slim if i['id'] != 'gift_card')
gst = round(taxable * 0.05, 2)
print(f'items={len(slim)} subtotal=${sub:,.2f} gst=${gst:,.2f} total=${sub + gst:,.2f} left=${2000 - sub - gst:,.2f}')
