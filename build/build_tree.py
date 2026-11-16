"""Builds the 3D tree page from data/options.json (every element and its options) and the product photos.

Outputs:
  output/howlidays_tree.html          page body for republishing as a claude.ai Artifact (no <html>/<head> wrapper)
  output/howlidays_tree_preview.html  standalone page you can double-click to open in Chrome (needs internet for three.js + fonts)
"""
import base64, io, json, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
O = json.loads((ROOT / 'data' / 'options.json').read_text(encoding='utf-8'))

def thumb(path, size):
    im = Image.open(path).convert('RGB'); im.thumbnail((size, size)); b = io.BytesIO(); im.save(b, 'JPEG', quality=82)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
# listing photos for the shopping list and the detail card (embedded so the page works offline)
for k, it in O['catalog'].items():
    for f in (ROOT / 'data' / 'img' / f'{k}.jpg', ROOT / 'data' / 'lookbook' / f"{it.get('photo_file') or '-'}.jpg"):
        if f.exists(): it['img'] = thumb(f, 240); break
# a small picture on every option: its photo, or the photo of what it buys
for e in O['elements']:
    for o in e['options']:
        src = ROOT / 'data' / 'lookbook' / f"{o.get('photo') or '-'}.jpg"
        if not src.exists() and o['rows']: src = ROOT / 'data' / 'img' / f"{o['rows'][0]['id']}.jpg"
        if src.exists(): o['thumb'] = thumb(src, 96)
        o.pop('needs_text', None)

script = (ROOT / 'build' / 'tree.js').read_text(encoding='utf-8')
resolve_js = (ROOT / 'build' / 'resolve.js').read_text(encoding='utf-8')
cuts = {}
for f in sorted((ROOT / 'data' / 'cutouts').glob('*.webp')):
    w, h = Image.open(f).size
    cuts[f.stem] = {'src': 'data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode(), 'w': w, 'h': h}
template = (ROOT / 'build' / 'tree_template.html').read_text(encoding='utf-8')
b64 = lambda f: base64.b64encode(f.read_bytes()).decode() if f.exists() else ''
docx_b64 = b64(ROOT / 'output' / 'HP26_Tree_Gallery_Form_Corporate_Finance.docx')   # built first by build_docx.js
plan_b64 = b64(ROOT / 'output' / 'HP26_Committee_Plan_Corporate_Finance.docx')
tpl_b64 = b64(ROOT / 'output' / 'HP26_Templates.pdf'); sign_b64 = b64(ROOT / 'output' / 'HP26_Doghouse_Sign_11x17.pdf')
person_b64 = b64(ROOT / 'data' / 'models' / 'person.glb')                           # scale figure (three.js example model, MIT)
docs_js = (ROOT / 'build' / 'docs_core.js')
docx_umd = ROOT / 'node_modules' / 'docx' / 'dist' / 'index.umd.cjs'
fonts = {n: b64(ROOT / 'build' / 'fonts' / f) for n, f in (('reg', 'BarlowCondensed-Regular.ttf'), ('med', 'BarlowCondensed-Medium.ttf'), ('bold', 'Form-Bold.ttf'), ('lightIt', 'Form-LightItalic.ttf'))}
wid = (ROOT / 'build' / 'fonts' / 'regular_widths.json').read_text()
builder = ''
if docs_js.exists() and docx_umd.exists():   # the Word builder runs in the page, so exports follow the selection
    umd = docx_umd.read_text(encoding='utf-8').replace('</script', '<\\/script')
    builder = ('<script>' + umd + '</script>\n<script>window.HOWL_FONTS = ' + json.dumps(fonts) + '; window.HOWL_WIDTHS = ' + wid + ';</script>\n<script>'
               + docs_js.read_text(encoding='utf-8') + '</script>')
page = (template.replace('__DOCX__', docx_b64).replace('__PLAN__', plan_b64).replace('__TPL__', tpl_b64).replace('__SIGN__', sign_b64).replace('__PERSON__', person_b64)
        .replace('__OPTIONS__', json.dumps(O, ensure_ascii=False, separators=(',', ':'))).replace('__RESOLVE__', resolve_js).replace('__BUILDER__', builder)
        .replace('__CUTS__', json.dumps(cuts, separators=(',', ':'))).replace('__SCRIPT__', script))
(ROOT / 'output' / 'howlidays_tree.html').write_text(page, encoding='utf-8')
preview = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
           '<style>body{margin:0}</style></head><body>' + page + '</body></html>')
(ROOT / 'output' / 'howlidays_tree_preview.html').write_text(preview, encoding='utf-8')
t = json.loads((ROOT / 'data' / 'supplies.json').read_text())['totals']
print(f"page {len(page) / 1e6:.1f} MB | elements {len(O['elements'])} | default total ${t['grand']:,.2f}, ${t['left']:,.2f} left | word builder {'in page' if builder else 'NOT embedded'}")
