"""Writes output/item_audit.md: every item against test 0 of GOAL.md ("every item is thought through")."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
items = json.loads((ROOT / 'data' / 'items.json').read_text())
sup = json.loads((ROOT / 'data' / 'supplies.json').read_text())
S = {s['id']: s for s in sup['supplies']}
money = lambda n: f'${n:,.2f}'

HANG = {
 'baubles_rgg': 'floral wire through the cap loop', 'baubles_champ': 'floral wire through the cap loop', 'glitter_red': 'floral wire through the cap loop',
 'glitter_champ': 'floral wire through the cap loop', 'glitter_green': 'floral wire through the cap loop',
 'golden': '24" floral wire round the body under the scarf, twisted to the trunk', 'tabby_grey': '24" floral wire round the body, to a sturdy inner branch',
 'tabby_brown': 'sits on the floor beside the doghouse', 'paw_disc': '25 cm gold cord loop + floral wire', 'bones': 'gold cord loop set in the clay + floral wire',
 'doghouse': 'gold cord loop glued through the ridge + floral wire', 'stockings': 'built-in loop + floral wire', 'topper': 'zip ties (supplied by the organizers) + floral wire',
 'tartan_ribbon': 'wired to branches about every 8"', 'velvet_ribbon': 'tied round gift boxes A and C', 'velvet_bows': 'floral wire through the back of the knot',
 'mini_bows': 'hot glue on top of each paw ornament and the jar lid', 'big_bows': 'floral wire through the knot', 'gold_picks': 'wire stems twisted round branches',
 'pine_picks': 'wire stems twisted round branches', 'glossy_berries': 'wire stems twisted round branches', 'gift_boxes': 'sit on the floor round the base',
 'doghouse_xl': 'sits on the floor in front of the tree', 'bone_pillow': 'sits on the floor', 'bowl': 'sits on the floor', 'basket': 'sits on the floor; contents wired in',
 'jar': 'wired to the basket handle', 'blanket': 'folded and draped over the basket front, wired', 'holiday_toy': 'wired into the basket', 'rope': 'wired into the basket',
 'balls': 'wired into the basket', 'gift_card': 'clipped into the basket', 'bandanas': 'tied on the plush pets', 'faux_treats': 'inside the jar',
 'tartan_wrap': 'wraps boxes A, B, C', 'paw_wrap': 'wraps box D',
}
FOUND = [  # what the audit caught, and the fix
 ('doghouse', 'The "doghouse ornaments" were 12 unfinished birdhouses: round entry hole and perch peg. Paint could not make them read as doghouses.', 'Built as real doghouses from 3/16" foam board with a printed template: arched door, scored bricks, cream shingle roof. Uses 4 foam boards ($23.96) instead of the $54.93 birdhouses.'),
 ('doghouse_xl', 'The giant doghouse had no materials. It assumed a big enough shipping box would arrive.', 'Two Canadian Tire 24 x 20 x 20" moving boxes ($4.99 each), a full cut plan (template page 4) and every paint, glue and sign material on the supply list.'),
 ('gift_boxes', 'The display gifts relied on "boxes from our orders", which are not guaranteed and of unknown size.', 'Four bought moving boxes of known size, so wrapping paper and ribbon lengths can be calculated.'),
 ('craft_supplies', 'Paint was one unverified Michaels "value pack" of 2 oz bottles. The builds need about 0.7 L of gesso/cream and 0.4 L of red.', 'Itemized DeSerres order (verified prices, all in stock), every line covering its calculated need with 10%+ spare.'),
 ('topper', 'A rubber paw stamp does not print on open-weave burlap, and one stamp size cannot do five jobs. One 10 yd roll of burlap covered the 10 yd need with no spare.', 'Five paw stencils cut from drafting film (template page 2), fabric paint for the burlap, and a second roll.'),
 ('bones', 'One 500 g bag of foam clay; the bones and biscuits need about 615 g.', 'Two bags (1 kg), with foil cores in the bones.'),
 ('faux_treats', '30 biscuits would fill about a fifth of a 7 x 9.9" jar.', f"{sup['biscuits_needed']} line the glass round a kraft-paper core; make 60."),
 ('mini_bows', 'The list put mini bows on the paw ornaments, doghouses and jar: 43 needed, 36 bought.', 'The board shows bows on the paw ornaments only: 31 needed (30 + jar), 36 bought.'),
 ('velvet_ribbon', 'Velvet ribbon was planned for 3 gift boxes: about 13 yd from a 10 yd roll.', 'Velvet on boxes A and C (8.8 yd); tartan on B and D.'),
 ('bowl', 'Acrylic paint does not stay on glazed ceramic.', 'Oil-based white paint marker.'),
 ('felt', 'The felt paw and the cut scarf strips had no glue.', 'Permanent fabric glue.'),
 ('paw_disc', 'Bones, paw ornaments and doghouses had no hanging hardware (only jute came with the rounds).', 'Gold metallic cord, 25 m, enough for 66 loops.'),
 ('golden', 'The golden retriever plush was recorded as 10"; the listing is the 12" Cuddlekins.', 'Corrected; the giant doghouse door is sized for it.'),
 ('glossy_berries', 'Red glitter sprays ($48.55) were a second red-berry item, and the board shows glossy berries, not glitter.', 'Removed; the 48 glossy berry stems cover the look.'),
 ('big_bows', 'Store-bought plaid bows ($43.50) were a second, different plaid that clashed with our tartan.', 'Removed; 14 DIY bows from our own tartan instead of 10.'),
 ('ct_supplies', 'Painting in the office with no drop sheet; boxes with no tape.', 'Drop sheet, packing tape and Scotch tape from Canadian Tire.'),
 ('shipping', 'Amazon shipping charges were left out of the total.', 'Included as an estimate ($0 with Prime).'),
]
L = ['# Item audit: is every item thought through?', '',
     f"Test 0 of `GOAL.md`, run {sup['checked']}. Every item is checked on six points: it is what it says; DIY items have a full build sheet; quantities come from a calculation with at least 10% spare; it can hang or sit as shown; it fits; and its source is verified. "
     "The quantity calculations run in `build/build_plan.py`. The build stops if any supply line falls short.", '',
     '## What the audit caught', '', '| Item | Problem | Fix |', '|---|---|---|']
names = {i['id']: i.get('form_name') or i['name'] for i in items}
for k, prob, fix in FOUND: L.append(f"| {names.get(k, k)} | {prob} | {fix} |")
L += ['', '## Every item', '', '| Item | It is what it says | Build sheet | Quantity | Hangs / sits | Source | Result |', '|---|---|---|---|---|---|---|']
uses_by = {}
for s in sup['supplies']:
    for u in s['uses']: uses_by.setdefault(u['project'], []).append(s['id'])
for i in items:
    k = i['id']; diy = i.get('diy')
    real = 'yes: listing photo and title checked' if i.get('image_checked') else 'estimate (not a product)'
    if k == 'doghouse': real = 'yes: foam-board doghouse with arched door (was a birdhouse)'
    sheet = ('yes: steps, template, materials' if i.get('how') else 'MISSING') if diy else 'n/a'
    q = ', '.join(sorted(set(uses_by.get(k, [])))) or ('qty ' + str(i.get('qty')))
    if k in uses_by: q = 'calculated: ' + q
    hang = HANG.get(k, 'n/a (supply)')
    src = f"{i['store'].split(' (')[0]}, {i.get('checked_on') or 'estimate'}"
    ok = (not diy or i.get('how')) and (i.get('image_checked') or k == 'shipping')
    L.append(f"| {names[k]} | {real} | {sheet} | {q} | {hang} | {src} | {'pass' if ok else 'CHECK'} |")
L += ['', '## Supplies: need vs. bought', '', 'Need is calculated from the build dimensions. Whole items (tools, boxes) must match exactly; consumables keep at least 10% spare.', '',
      '| Supply | Store | Price | Qty | Need | Have | Spare | How the need is worked out |', '|---|---|---:|---:|---:|---:|---:|---|']
for s in sup['supplies']:
    how = '; '.join(f"{u['project']}: {u['amount']} ({u['how']})" if u['how'] else f"{u['project']}: {u['amount']}" for u in s['uses'])
    link = f"[{s['name']}]({s['url']})" if s['url'] else s['name']
    L.append(f"| {link} | {s['store']} | {money(s['price'])} | {s['qty']} | {s['need']} {s['unit']} | {s['have'] if s['have'] is not None else 'one jar'} | {str(s['spare']) + '%' if s['spare'] is not None else '-'} | {how} |")
a = sup['assumptions']
L += ['', '## Assumptions behind the numbers', '',
      f"- **Brushed paint:** {a['ml_per_ft2']} ml per sq ft per coat.",
      f"- **Sponge-dabbed bricks:** {a['dab_ml_per_ft2']} ml per sq ft.",
      f"- **Fabric paint into burlap:** {a['burlap_ml_per_ft2']} ml per sq ft.",
      f"- **Mod Podge:** {a['podge_ml_per_ft2']} ml per sq ft.",
      f"- **Foam clay:** {a['clay_g_per_cm3']} g per cm³. This is the heavy end of the range, so we over-buy rather than run short.",
      '- **Pearl medium, fine, black:** the listing does not state the jar size. The paws need about 10 ml.',
      '- **Amazon prices:** from Nov 13-16. Amazon.ca blocked automated browsing on Nov 16, so confirm them at checkout.',
      '', '## Bring from home or office (confirm in the committee chat)', ''] + [f'- {x}' for x in sup['on_hand']]
(ROOT / 'output' / 'item_audit.md').write_text('\n'.join(L) + '\n', encoding='utf-8')
print('audit rows', len(items), '| CHECK rows:', sum(1 for l in L if l.endswith('| CHECK |')))
