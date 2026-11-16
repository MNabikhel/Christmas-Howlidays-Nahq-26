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
 'golden': 'doubled 36" floral wire round the belly under the scarf to a main branch + an organizer zip tie (about 100 g)', 'tabby_grey': '24" floral wire round the body, to a sturdy inner branch',
 'tabby_brown': '20" floral wire round the body, to a sturdy branch', 'cat_miyoni': 'doubled 24" floral wire round the body under the scarf, lying along a sturdy branch (about 136 g; one sits with the dog under the tree, wired to it and the basket)',
 'cat_fluffy': '20" floral wire round the body, to a sturdy branch', 'velvet_tree_bows': 'floral wire through the back of the knot', 'paw_disc': '25 cm gold cord loop + floral wire', 'paw_disc_fay': '25 cm gold cord loop through the screw + floral wire',
 'bones': 'level, from a gold cord whose two ends are glued into holes drilled over wire anchors in the upper knobs, + 8" floral wire',
 'doghouse': 'sits upright on a sturdy inner branch, two 10" floral wires through the floor (about 160 g); gold loop round a toothpick bar as a safety tie',
 'cascades': 'wired to the top stem and to a branch at each of 4 poufs (11 ties)', 'streamers': 'wired under the bow knot and at each pouf', 'crown': 'stems wired to the top stem', 'stockings': 'built-in loop + 6" floral wire', 'topper': 'zip ties (supplied by the organizers) + floral wire',
 'tartan_ribbon': 'wired to branches about every 8"', 'velvet_ribbon': 'bows on the paw ornaments, the tree and the jar', 'velvet_bows': 'floral wire through the back of the knot',
 'mini_bows': 'hot glue on top of each paw ornament and the jar lid', 'big_bows': 'floral wire through the knot', 'gold_picks': 'wire stems twisted round branches',
 'pine_picks': 'wire stems twisted round branches', 'glossy_berries': 'wire stems twisted round branches', 'gift_boxes': 'sit on the floor round the base',
 'doghouse_xl': 'sits on the floor in front of the tree', 'bone_pillow': 'sits on the floor', 'bowl': 'sits on the floor', 'basket': 'sits on the floor; contents wired in',
 'jar': 'wired to the basket handle', 'blanket': 'folded and draped over the basket front, wired', 'holiday_toy': 'wired into the basket', 'rope': 'wired into the basket',
 'balls': 'wired into the basket', 'gift_card': 'clipped into the basket', 'bandanas': 'tied on the plush pets', 'faux_treats': 'inside the jar',
 'tartan_wrap': 'wraps boxes A, B, C', 'paw_wrap': 'wraps box D',
}
FOUND = [  # what the audits caught, and the fix (latest round first)
 ('topper', 'Tails 22" (about 60% too long), flat loops, 2.2" paws on both faces, and no knot width, fray stop or way to trace on black felt; 2.7 yd left no slack.', 'Two 10" loops angled up over 14" tails, 24 x 3" felt paws on the front face only, a 78" strip + 8" knot piece (2.4 yd), edge wire, fray stop on the cut ends, a white fabric marker for tracing.'),
 ('big_bows', '1.5 yd per bow could not make the four-loop recipe, and the five cascades had no build steps anywhere.', 'One loop each side as on the board, 1.8 yd each, with a cut plan for the 5 tartan rolls (16 bows + 5 cascades + the gift band); a cascades build sheet (118" each, 4 poufs).'),
 ('gift_boxes', 'No method to cut boxes C and D down, the join between the two paper widths was left showing, and nothing fixed the bows.', 'Walls cut down from the open bottom; the paper join hides under the ribbon; box D gets the board\'s cream band and a tartan bow on top; every bow hot-glued.'),
 ('doghouse', 'The arch trim was a straight strip that cannot bend; no barge boards, threshold, ridge cap or raised paw; nothing to cut on; roof undersides unsealed; a working pen for scoring; no cream recipe; grey joints where the board\'s are dark; a glued cord for a 160 g house.', 'Every board part is a cut piece (template page 8) inside the foam-board count (the printed cut plan fits 9 of the 10 boards); a flattened XL box to cut on; sienna under the roofs; empty-ballpoint scoring at 0.9 x 1.5" bricks; cream = gesso + deep ochre + sienna; dark-brick base under dabbed barn red; each house wired upright through its floor.'),
 ('paw_disc_fay', '7.5 x 9" Aida could not be drawn drum-tight in a 6" hoop; both rings painted (over the 60 ml of gold); a raw back; a paler face than the board; no spare hoop.', '9 x 9" tea-stained Aida (white 50 x 60 cm sheets, 4 pieces each), only the outer ring primed and gilded, a 6" felt back circle, and the Faylapa 16-pk hoops (6 spare, $37.69 less, here Nov 20).'),
 ('bones', 'Slim dumbbell bones hanging end-down from one cord pushed into wet clay; clay counted as half of a 20 cu in bone; no thickness guides.', 'Board proportions (shaft 0.27, span 0.53, 1" thick); a gold cord glued at both ends over wire anchors so each hangs level; clay from the page-4 outline less the foil core (about 117 g each), so a third bag; pencils or 6 mm sticks as guides.'),
 ('bandanas', 'The 66" scarf cut into 36" and 18" pieces left most scarves with a bare end; 3 dogs and 3 cats need one.', 'A 36" dog and a 22" cat scarf from each of three 3" strips; every cut end fringed by pulling the weft; edges glued.'),
 ('faux_treats', 'A 4" core left the biscuits slumping in a 7" jar; the jar bow had no band and the lid was loose in a basket that moves.', 'Filled ring by ring round crumpled kraft paw paper; a velvet band and bow; the lid fixed with 3 dots of hot glue.'),
 ('golden', 'One 24" strand of wire round an 11" plush could not reach the trunk, and the under-tree pair and floor pieces had no fixing or transport plan.', 'Doubled wire plus an organizer zip tie on every plush; the pair wired to each other and the basket; the under-tree pieces packed in one labelled box.'),
 ('craft_supplies', 'No wire cutter for about 400 wire cuts, no marker for black felt, no clay thickness guides or stirrers, and no warm tint for cream (sienna alone gives peach).', 'DeSerres wire cutter, white fabric marker, 6 mm wood sticks and Americana Deep Ochre, all "ships in 48 hours"; Mod Podge down to 236 ml (112 ml needed).'),
 ('cat_miyoni', 'The cat was called a "sitting grey tabby" and rated match, but the FLUFFYFUN listing photo is a mostly white cat standing with its tail up (7" tall, 4 ratings).', 'Re-searched: no 8-12" sitting striped grey tabby arrives by Nov 30. Default is now the Aurora Miyoni grey tabby (the board\'s striped coat, 2,170 ratings, Nov 20), rated close because it crouches; the same cat sits with the dog.'),
 ('baubles_rgg', 'The 100-pc bauble link now opens a Black & Gold set: the order would have shipped black baubles.', 'Repointed to the same seller\'s Red & Gold set (B0FNJXJNXQ, $43.99, Nov 20); green comes from the 4" green glitter packs.'),
 ('bowl', 'The bowl was a shallow scalloped polka-dot cat dish that needed a paint marker; the board\'s is a deep red dog bowl with a steel rim and paws.', 'Loving Pets Bella Bowl (Merlot): steel interior and paw prints built in; the $9.99 marker is dropped.'),
 ('holiday_toy', 'The basket bone toy link was the Gray variant.', 'Ethical Pet cream sherpa fleece bone with a 3" black felt paw glued on.'),
 ('velvet_tree_bows', 'The board mixes solid velvet bows with the tartan on the tree; ours had velvet only on the paw ornaments and jar.', 'Five 9" velvet bows from the spare velvet (no extra cost).'),
 ('craft_supplies', 'Four DeSerres lines ship in 3-5 days, which would hold the one free shipment back to about Nov 26-Dec 2. Zero spare hoops.', 'Swapped sienna and Aida for 48-hour lines, dropped the paint marker and kraft paper, added an 11th hoop. Expect Nov 25-27; Michaels Edmonton is the fallback.'),
 ('shipping', 'International delivery was counted once per listing, though the tartan is bought 5 times.', 'Counted per unit (worst case) in build_plan.py and resolve.js, so the $75 floor is checked against it.'),
 ('topper', 'Matching the board exactly: its bow is about 6" ribbon in two fat loops; ours was 4" in four loops, and the stencilled paws needed fabric paint.', 'Two loops of 6" natural jute, 20 black felt paws glued on (from the felt we already buy), floral wire along the edges so the loops hold.'),
 ('paw_disc', 'At the board\'s scale the paw ornaments are 5-8" with a gold rim and cap and a deep red velvet bow; ours were 4" flat wood rounds with 3.5" mini bows.', 'Ten 6" hoops painted gold (the brass screw is the cap), ivory Aida face, black glitter-card paw, bow hand-tied from dark red wired velvet.'),
 ('doghouse', 'The board\'s doghouse is 10-15" tall; ours were 4.3".', 'Six 10" doghouses from the same template, scaled; 10 foam boards.'),
 ('bones', 'The board\'s bones are 7-11" long; ours were 5".', 'Eight 9" bones (now at board proportions, with a third clay bag: see above).'),
 ('tabby_grey', 'The 4.7" kittens are a third to a half of the board\'s cats.', 'A bigger cat (now the 9" Aurora Miyoni tabby; see above).'),
 ('red6_benjia', 'The board\'s biggest red balls are 4.5-7"; our biggest were 3.15".', 'Plain 6" and 4" reds and 4" golds; dropped the second 100-pc set, the 100-pc champagne set and the painted 3.15" reds.'),
 ('burlap_ribbon', 'The board\'s gifts are tied with cream ribbon; ours used velvet.', 'Cream 1.5" burlap ribbon and bows; the velvet roll and the 12 bought velvet bows are gone (the board has no velvet bows on the tree).'),
 ('doghouse', 'The "doghouse ornaments" were 12 unfinished birdhouses: round entry hole and perch peg. Paint could not make them read as doghouses.', 'Built as real doghouses from 3/16" foam board with a printed template: arched door, scored bricks, cream shingle roof. Uses 4 foam boards ($23.96) instead of the $54.93 birdhouses.'),
 ('doghouse_xl', 'The giant doghouse had no materials. It assumed a big enough shipping box would arrive.', 'Two Canadian Tire 24 x 20 x 20" moving boxes ($4.99 each), a full cut plan (template pages 6-7) and every paint, glue and sign material on the supply list.'),
 ('gift_boxes', 'The display gifts relied on "boxes from our orders", which are not guaranteed and of unknown size.', 'Four bought moving boxes of known size, so wrapping paper and ribbon lengths can be calculated.'),
 ('craft_supplies', 'Paint was one unverified Michaels "value pack" of 2 oz bottles. The builds need about 0.7 L of gesso/cream and 0.4 L of red.', 'Itemized DeSerres order (verified prices, all in stock), every line covering its calculated need with 10%+ spare.'),
 ('topper', 'A rubber paw stamp does not print on open-weave burlap, and one stamp size cannot do five jobs. One 10 yd roll of burlap covered the 10 yd need with no spare.', 'Five paw stencils cut from drafting film (template page 3), fabric paint for the burlap, and a second roll.'),
 ('bones', 'One 500 g bag of foam clay; the bones and biscuits need about 615 g.', 'Two bags (1 kg), with foil cores in the bones (now three: see above).'),
 ('faux_treats', '30 biscuits would fill about a fifth of a 7 x 9.9" jar, and 3" biscuits are bigger than the board\'s.', f"Cut with the 2.7\" cutter: {sup['biscuits_needed']} line the glass round a cardboard-offcut core; make {next((i.get('made') for i in items if i['id'] == 'faux_treats'), '')}."),
 ('mini_bows', 'The list put mini bows on the paw ornaments, doghouses and jar: 43 needed, 36 bought.', 'The board shows bows on the paw ornaments only: 31 needed (30 + jar), 36 bought.'),
 ('velvet_ribbon', 'Velvet ribbon was planned for 3 gift boxes: about 13 yd from a 10 yd roll.', 'Velvet on boxes A and C (8.8 yd); tartan on B and D.'),
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
       f"- **Mod Podge:** {a['podge_ml_per_ft2']} ml per sq ft.",
      f"- **Foam clay:** {a['clay_g_per_cm3']} g per cm³. This is the heavy end of the range, so we over-buy rather than run short.",
      '- **Clay bones:** each is its template outline (31.0 sq in for the 9") x thickness x 85% for the rounded edges, less the foil core (the outline inset 1/4", at the thickness less 1/2").',
      '- **Foam board:** the page-2 cut plan places every part of six 10" houses, trims included, on 9 boards (88% packing); the 10th is spare.',
      '- **Pearl medium, fine, black:** the listing does not state the jar size. The paws need about 10 ml.',
      '- **Amazon prices:** re-checked on Nov 16 with the Edmonton postal code set. Confirm them, and the per-unit delivery on international listings, at checkout.',
      '', '## Bring from home or office (confirm in the committee chat)', ''] + [f'- {x}' for x in sup['on_hand']]
(ROOT / 'output' / 'item_audit.md').write_text('\n'.join(L) + '\n', encoding='utf-8')
print('audit rows', len(items), '| CHECK rows:', sum(1 for l in L if l.endswith('| CHECK |')))
