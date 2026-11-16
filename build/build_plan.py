"""The plan: every board element, its options, and the supplies each option needs.

- CAT: every product we might buy (data/catalog.json holds what we learned about the older picks; new and
  changed picks are set below). Each was opened on the date in `checked_on`.
- SUP: every craft material, with the verified listing and the amount in one unit.
- ELEMENTS: one entry per element of the inspiration board. Each has 2-4 options, and the default is the
  closest match to the board that fits the budget. Each option lists what we buy (rows), what its DIY
  build uses (needs, calculated from real dimensions) and how the 3D preview draws it (render).
- resolve(selection) turns a selection into the order list. build/resolve.js does exactly the same in the
  browser, so the 3D page can swap options and keep the list, budget and exports in step.

Writes data/options.json (for the page), data/items.json and data/supplies.json (the default selection).
Fails the build if any supply falls short or the default leaves less than $75 of the $2,000.
"""
import json, math, pathlib, sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHECKED = '2026-11-16'
BUDGET, FLOOR = 2000, 75

# ---- coverage assumptions (stated, not hidden) ----
ML_PER_FT2 = 12         # brushed acrylic / gesso, one coat
DAB_ML_PER_FT2 = 8      # sponge-dabbed coat (bricks): paint sits on the surface only
PODGE_ML_PER_FT2 = 15
CLAY_G_PER_CM3 = 0.45   # lightweight foam clay, wet (heavy end of the range, so we over-buy rather than run short)
MARGIN = 1.10
ft2 = lambda in2: in2 / 144
IN3_CM3 = 16.387
DS, CT, AMZ = 'https://www.deserres.ca/products/', 'https://www.canadiantire.ca/en/pdp/', 'https://www.amazon.ca/dp/'
COUNTED = {'tool', 'box', 'set', 'brush', 'sponge', 'pen', 'roll', 'sheet', 'pc', 'sheets', 'bows', 'stencils', 'hoops'}

# ---------------- products ----------------
CAT = json.loads((ROOT / 'data' / 'catalog.json').read_text())
def cat(id, **kw):
    it = CAT.setdefault(id, {'id': id}); it.update(kw); it['id'] = id
    it.setdefault('status', 'listed'); it.setdefault('checked_on', CHECKED); it.setdefault('image_checked', True)
    return it
AMZ_NEW = dict(store='Amazon.ca', checked_on=CHECKED, status='listed', image_checked=True)
cat('cat_fluffy', section='Tree ornaments', name='Grey tabby cat plush, sitting, 8" (FLUFFYFUN realistic)', form_name='Grey tabby cat plush, 8"',
    url=AMZ + 'B0H5YKFT7X', price=34.19, ship=5.45, arrives_by='2026-11-24', match='match', size_in={'h': 8, 'w': 5, 'd': 7}, photo_file='p_B0H5YKFT7X',
    notes='Grey-and-white tabby with a white muzzle and chest, sitting: the board\'s cats. 8" is inside the board\'s 8-15" range.', **AMZ_NEW)
cat('tabby_grey', section='Tree ornaments', name='Grey tabby kitten plush, 4.7" (Wild Republic Pocketkins)', form_name='Grey tabby kitten plush, 4.7"')
cat('tabby_brown', section='Tree ornaments', name='Grey tabby cat plush, 6" tall standing (Douglas Zigby)', form_name='Grey tabby cat plush, 6"', ship=5.21)
cat('golden', name='Golden retriever plush, sitting, 12" (Wild Republic Cuddlekins)', form_name='Golden retriever plush, sitting 12"',
    notes='Wild Republic Cuddlekins 12" (about 11" tall sitting). Wired round the body to the trunk under its tartan scarf.')
cat('golden_aurora', section='Tree ornaments', name='Golden Lab plush, sitting, 14" (Aurora)', form_name='Golden Lab plush, 14"', url=AMZ + 'B00ILYHVDQ', price=37.76,
    arrives_by='2026-11-21', match='close', size_in={'h': 13, 'w': 8, 'd': 12}, photo_file='p_B00ILYHVDQ', checked_on='2026-11-16', status='listed', store='Amazon.ca', image_checked=True,
    notes='Bigger (about 13" sitting), nearer the top of the board\'s range, but a rounder Labrador face rather than a fluffy golden retriever.')
cat('bandanas', section='Tree ornaments', name='Red tartan fringed scarf, 12 x 72" (cut lengthwise into 3" strips: fringed scarves for every plush pet)', form_name='Tartan scarf for the pet scarves')
for k in ('baubles_rgg', 'glitter_champ', 'glitter_green'): CAT[k]['section'] = 'Tree ornaments'
cat('red4_glitter', section='Tree ornaments', name='Red sequin-glitter baubles, 4" (6-pc)', form_name='Red glitter baubles, 4" (6 pc)', url=AMZ + 'B0CSYHTT86', price=30.99,
    arrives_by='2026-11-20', match='match', size_in={'d': 3.94}, photo_file='p_B0CSYHTT86', notes='The board\'s big red glitter balls, at the board\'s scale (4" vs 3.15" before).', **AMZ_NEW)
cat('red4_joyin', section='Tree ornaments', name='Red baubles, 4": glossy, matte, glitter and mirror (JOYIN 4-pc)', form_name='Red baubles, 4" (4 pc)', url=AMZ + 'B0H33K316H', price=19.99,
    arrives_by='2026-11-21', match='match', size_in={'d': 4}, photo_file='p_B0H33K316H', notes='Plain glossy and mirror reds, like the shiny balls near the board\'s topper.', **AMZ_NEW)
cat('gold4_joyin', section='Tree ornaments', name='Gold baubles, 4": glitter, matte, glossy and mirror (JOYIN 4-pc)', form_name='Gold baubles, 4" (4 pc)', url=AMZ + 'B0H33B6VSH', price=19.99,
    arrives_by='2026-11-21', match='match', size_in={'d': 4}, photo_file='p_B0H33B6VSH', notes='Champagne-gold balls like the board\'s left side, at its scale.', **AMZ_NEW)
cat('redgold6', section='Tree ornaments', name='Red and gold painted baubles, 6" (4-pc)', form_name='Red & gold baubles, 6" (4 pc)', url=AMZ + 'B0FVFMHFR9', price=35.99,
    arrives_by='2026-11-21', match='close', size_in={'d': 6}, photo_file='p_B0FVFMHFR9', notes='The board\'s biggest size, but painted with gold swirls and diamonds; the board\'s balls are plain.', **AMZ_NEW)
cat('red6_benjia', section='Tree ornaments', name='Red baubles, 6": 2 glossy, 1 matte, 1 glitter (Benjia 4-pc)', form_name='Red baubles, 6" (4 pc)', url=AMZ + 'B0B6PKG298', price=32.99,
    arrives_by='2026-11-21', match='match', size_in={'d': 6}, photo_file='p_B0B6PKG298', notes='Plain red at the board\'s biggest size: the big red balls under the topper and beside the doghouse.', **AMZ_NEW)
cat('stockings', section='Tree ornaments')
cat('velvet_ribbon', section='Ribbon & bows', name='Dark red wired velvet ribbon, 1.5" x 25 yd (bows on the paw ornaments and the jar)', form_name='Dark red velvet ribbon, 1.5" x 25 yd',
    url=AMZ + 'B09XPW59VV', price=36.07, arrives_by='2026-11-21', match='match', size_in={'w': 1.5}, photo_file='p_B09XPW59VV', look='Deep red wired velvet, hand-tied.',
    notes='The board\'s paw-ornament and jar bows are deep red wired velvet with soft loops and long tails. MEEDEE "dark red" is that colour; hand-tied, a 9" bow uses about 1 yd.', **AMZ_NEW)
cat('burlap_ribbon', section='Ribbon & bows', name='Natural burlap wired ribbon, 1.5" x 20 yd (ribbon and bows on the gifts)', form_name='Natural burlap ribbon, 1.5" x 20 yd',
    url=AMZ + 'B09MVX5VRK', price=18.39, arrives_by='2026-11-20', match='match', size_in={'w': 1.5}, photo_file='p_B09MVX5VRK',
    notes='The gifts under the board\'s tree are tied with cream ribbon and cream bows, not velvet.', **AMZ_NEW)
cat('glitter_card', section='Accents & supplies', name='Black glitter cardstock, 12 x 12", 10 sheets (paws on the paw ornaments)', form_name='Black glitter cardstock (10 sheets)',
    url=AMZ + 'B0BKWY2ZMT', price=14.88, arrives_by='2026-11-20', match='match', photo_file='p_B0BKWY2ZMT', notes='No-shed glitter: the board\'s paw is black and sparkly.', **AMZ_NEW)
cat('clay', section='Accents & supplies', name='White air-dry foam clay, 500 g (bones and biscuits)', form_name='Air-dry foam clay, 500 g', url=AMZ + 'B0F86WQG4W', price=22.00,
    arrives_by='2026-11-20', match='match', notes='Light enough to hang: a 9" bone weighs about 75 g.', store='Amazon.ca', status='listed', image_checked=True, checked_on='2026-11-13')
cat('bone_fleece', section='Tree ornaments', name='Cream fleece bone, 9" (Ethical Pet)', form_name='Fleece bone, 9"', url=AMZ + 'B000E1S8NG', price=10.49, arrives_by='2026-11-20',
    match='close', size_in={'l': 9, 'w': 3, 'd': 1.5}, photo_file='p_B000E1S8NG', notes='Right size and colour, but fuzzy sherpa: the board\'s bones are smooth like a biscuit. Squeaker inside.', **AMZ_NEW)
cat('glitter_red', section='Tree ornaments'); cat('baubles_champ', section='Tree ornaments')
cat('mini_bows', section='Ribbon & bows', name='Mini red velvet bows, 3.5" (12-pk)', form_name='Mini red velvet bows, 3.5" (12 pc)', ship=5.06)
cat('plaid_bows', section='Ribbon & bows', status='listed')
for k in ('tartan_ribbon', 'big_bows'): CAT[k]['section'] = 'Ribbon & bows'
CAT['tartan_ribbon'].update(ship=5.45, notes='4" wired tartan: the board\'s red-and-green plaid with a thin gold line. Cascades, hand-tied bows and the paw-paper gift\'s ribbon.')
CAT['bone_pillow']['ship'] = 6.11; CAT['paw_wrap']['ship'] = 5.75; CAT['glitter_red']['ship'] = 6.33
CAT['gift_card']['gst_exempt'] = True
CAT['gift_card']['arrives_by'] = None   # bought in store at Homes Alive Pets South Edmonton
CAT['bone_cutters']['section'] = 'Gift basket'

# DIY rows: what we make. Their price is the cost of the materials only they use (filled in by resolve()).
def diy(id, **kw):
    kw.setdefault('section', 'Tree ornaments'); kw.update(diy=True, status='listed', image_checked=True, checked_on=CHECKED); return cat(id, **kw)
diy('topper', store='Amazon.ca', url=AMZ + 'B0DQ4BXYKZ', arrives_by='2026-11-22', match='match', size_in={'w': 22, 'ribbon': 6},
    name='Tree topper (makes 1): 22" burlap bow, two loops and two tails, 6" natural jute with black felt paws, wired edges',
    form_name='Burlap paw-print bow topper, 22" (DIY)', photo_file='r3d_topper',
    notes='The board\'s bow: natural burlap about 6" wide, two big loops and two long tails, black paws. No paw-print burlap is sold at this width, so we add felt paws; floral wire glued along the back edges lets it hold its shape like the board.',
    how='Cut 2.7 yd of the 6" burlap. Hot-glue 22-gauge floral wire along both back edges. Cut 20 paws from black felt with the 2.2" paw template (page 3) and glue them on with fabric glue about every 5", on both loops, both tails and the knot; dry flat overnight. Make two 10" loops, pinch the centre with floral wire, wrap an 8" piece round it as the knot, and leave two 22" tails with V-notched ends. Zip-tie it to the top and shape the loops and tails like the board.')
diy('topper_4in', store='Amazon.ca', url=AMZ + 'B0CHMLF3NP', arrives_by='2026-11-20', match='close', size_in={'w': 24, 'ribbon': 4},
    name='Tree topper (makes 1): 24" four-loop bow from 4" wired burlap with black felt paws', form_name='Burlap paw bow topper, 24" (DIY)', photo_file='p_B0CHMLF3NP',
    notes='The earlier design: four loops of 4" ribbon. Thinner and busier than the board\'s two fat loops.',
    how='Cut 2.6 yd of the 4" burlap. Glue on 20 black felt paws (2.2" template, page 3). Make four 6" loops (two up, two down), pinch with floral wire, wrap the centre, leave two 16" tails.')
diy('topper_printed', store='Amazon.ca', url=AMZ + 'B09H2YMHCL', arrives_by='2026-11-20', match='close', size_in={'w': 20, 'ribbon': 2.5},
    name='Tree topper (makes 1): 20" bow from ready-printed 2.5" burlap paw ribbon (brown paws)', form_name='Printed paw ribbon topper (DIY)', photo_file='p_B09H2YMHCL',
    notes='No cutting or gluing, but the paws are brown and the ribbon is less than half the board\'s width.',
    how='Make a four-loop bow, 20" across, with two 14" tails; pinch with floral wire and zip-tie to the top.')
diy('doghouse', store='DeSerres', url=DS + 'foam-board-white-16x20', arrives_by='2026-11-26', match='match', size_in={'h': 10, 'w': 8.5, 'd': 6},
    name='Doghouse ornaments (makes 6): 10" foam-board doghouses, red brick walls, cream shingle roof, arched door with cream trim, cream paw on the gable',
    form_name='Doghouse ornaments, 10" (DIY)', photo_file='r3d_doghouse_iso',
    notes='Built at the board\'s scale: its doghouse is about as tall as the dog beside it (10-15"). Foam board keeps each one near 90 g, light enough for a sturdy branch.',
    how='Print the template (pages 1-2, actual size, 11x17) and cut 6 sets from the foam board with a fresh blade: front with the arched door, back, two sides, two roof panels, floor, and the trim strips. Score brick lines on the walls and shingle rows on the roof with a ballpoint pen. Hot-glue the walls to the floor, thread a 30 cm gold loop through the ridge and glue on the roof (3/4" overhang). Paint the walls mortar grey (gesso + a drop of black), then sponge-dab barn red (Naphthol Red + Crimson 1:1) so the scored lines stay grey. Paint inside the door dark brown, the roof, corner trims and door arch cream, and stencil a 2.5" cream paw on the gable. About 25 min each once cut.')
diy('doghouse_small', store='DeSerres', url=DS + 'foam-board-white-16x20', arrives_by='2026-11-26', match='close', size_in={'h': 4.3, 'w': 3.4, 'd': 2.7},
    name='Doghouse ornaments (makes 12): 4.3" foam-board doghouses', form_name='Doghouse ornaments, 4.3" (DIY)', photo_file='r3d_doghouse_iso',
    notes='Same build at the earlier size: a third of the board\'s doghouse, so it reads as filler rather than a feature.',
    how='Template page 5. Cut, score, glue and paint as for the 10" version; 1" gable paw.')
diy('paw_disc', store='DeSerres', url=DS + 'embroidery-hoop-round-15-2cm', arrives_by='2026-11-26', match='match', size_in={'d': 6},
    name='Paw ornaments (makes 10): 6" hoops painted gold, ivory Aida face, black glitter paw, dark red velvet bow',
    form_name='Paw-print hoop ornaments, 6" (DIY)', photo_file='p_hoops_ds',
    notes='The board\'s paw ornament is a cream, textured disc in a gold rim with a gold cap, a black sparkly paw and a deep red velvet bow. A 6" embroidery hoop gives the gold rim, and its brass screw sits where the cap is; ivory Aida gives the fine woven texture.',
    how='Paint the outer face and front edge of both hoop rings gold, 3 coats; leave the brass screw. Stretch a 7.5 x 9" piece of Aida drum-tight in each hoop with the screw at the top, trim the back to 1/2" and glue the edge inside the inner ring. Cut 10 paws from the black glitter cardstock with the 3.6" paw template (page 3) and glue one to the centre of each with fabric glue. Tie a 9" bow from 37" of the velvet (two 4.5" loops, 8" tails with V-notches), wire it just above the screw, and tie a 25 cm gold cord loop through the screw to hang it.')
diy('paw_disc_fay', store='Amazon.ca', url=AMZ + 'B088WV6BFG', arrives_by='2026-11-20', match='match', size_in={'d': 6},
    name='Paw ornaments (makes 10): Faylapa 6" bamboo hoops (16-pk), ivory Aida, black glitter paw, velvet bow', form_name='Paw-print hoop ornaments, 6" (DIY)', photo_file='p_B088WV6BFG',
    notes='The same ornament with Amazon hoops: $29.91 cheaper than ten DeSerres hoops, but only 3 packs were left on Nov 16.',
    how=CAT['paw_disc']['how'])
diy('paw_disc_wood', store='Amazon.ca', url=AMZ + 'B0FC6DWFVL', arrives_by='2026-11-20', match='close', size_in={'d': 4},
    name='Paw ornaments (makes 30): 4" bauble-shaped wood rounds painted cream, gold rim and cap, black sparkle paw, mini velvet bow', form_name='Paw-print bauble ornaments, 4" (DIY)', photo_file=None,
    notes='The earlier design: more of them, but two-thirds of the board\'s size and a flat painted face.',
    how='Paint both sides cream twice, the rim and cap gold. Stencil a 3" black paw, add the black sparkle medium, seal, add a gold loop and a mini bow.')
diy('bones', section='Tree ornaments', store='Amazon.ca', url=AMZ + 'B0F86WQG4W', arrives_by='2026-11-20', match='match', size_in={'l': 9, 'w': 3.4, 'd': 1.3},
    name='Bone ornaments (makes 8): 9" puffy bones of air-dry foam clay over a foil core, painted biscuit-cream, sealed', form_name='Dog-bone ornaments, 9" (DIY)', photo_file=None,
    notes='The board\'s bones are about as long as the dog is tall: 7-11". Foam clay over a foil core keeps each near 75 g.',
    how='For each bone scrunch a 6" foil log with a foil ball at each corner, wrap in 1/4" of foam clay, shape four round knobs and a 1.3" thick puffy shaft, 9" long against the template (page 4). Push a 25 cm gold cord loop into one end. Dry 48 h, paint cream twice, dry-brush burnt sienna on the edges, seal with Mod Podge.')
diy('bones_small', section='Tree ornaments', store='Amazon.ca', url=AMZ + 'B0F86WQG4W', arrives_by='2026-11-20', match='close', size_in={'l': 5, 'w': 1.8, 'd': 1},
    name='Bone ornaments (makes 24): 5" puffy foam-clay bones', form_name='Dog-bone ornaments, 5" (DIY)', photo_file=None,
    notes='The earlier design: more of them, about half the board\'s size.', how='As the 9" bones, against the 5" template (page 4).')
diy('big_bows', section='Ribbon & bows', store='Amazon.ca', url=CAT['tartan_ribbon']['url'], match='match', size_in={'w': 11, 'h': 18},
    name='Big tartan bows, 11" with 18" tails (hand-tied from the 4" tartan)', form_name='Big tartan bows, 11" (DIY)',
    notes='Hand-tied from our own tartan, so every bow matches the cascades.', how='Each bow: 1.5 yd of the 4" tartan. Two 5" loops each side, pinch with floral wire, wrap the centre, two 18" tails with V-notches.')
diy('gift_boxes', section='Under-tree display', store='Canadian Tire', url=CT + 'canadian-tire-small-moving-storage-box-100-recycled-cardboard-18-x-11-x-12-in-0676043p.html', arrives_by='2026-11-17', match='match',
    name='Wrapped gifts (makes 4): moving boxes in tartan and kraft paw paper, cream burlap ribbon and bows', form_name='Wrapped display gifts (DIY)',
    notes='Like the board: tartan boxes tied with cream ribbon, a kraft paw-print box with tartan ribbon, a cream bow on each. Four bought boxes of known size, so paper and ribbon are calculated.',
    how='Cut box C down to 10" and box D to 7" tall; tape all four shut. Wrap A, B and C in tartan paper (two 17" widths each, seam underneath) and D in kraft paw paper (tape two sheets together). Ribbon: 1.5" cream burlap both ways on A, B and C; 4" tartan one way round D. Tie a 10" cream burlap bow (40") for every box.')
diy('faux_treats', section='Gift basket', match='match', name='Faux dog biscuits (makes 60): foam clay cut with the bone cutters, painted biscuit-tan, sealed; fill the jar round a kraft-paper core', form_name='Faux dog biscuits (DIY)')
diy('doghouse_xl', section='Under-tree display', store='Canadian Tire', url=CT + 'canadian-tire-extra-large-moving-box-100-recycled-cardboard-24-x-20-x-20-in-0676076p.html', arrives_by='2026-11-17', match=None,
    name='Giant doghouse (makes 1): 24 x 20 x 26" from two moving boxes, red brick walls, cream shingle roof, "Home for the Howlidays" sign', form_name='Giant doghouse centrepiece (DIY)',
    notes='Not on the board: an extra we can add for impact. The plush pair sits in the doorway.')
CAT['doghouse_xl']['how'] = CAT['doghouse_xl'].get('how', '').replace('(template page 4)', '(template pages 6-7)')
CAT['felt']['how'] = 'Cut 20 paws of 2.2" for the topper and one 4.5" paw for the bone pillow (template page 3); glue with fabric glue.'
for k in ('craft_supplies', 'ct_supplies', 'shipping'): cat(k)
CAT['shipping'].update(status='est', image_checked=False, match=None, section='Shipping & fees')

# ---------------- supplies ----------------
# carrier = the DIY rows that carry its cost. Amazon supplies with no carrier become their own row;
# DeSerres and Canadian Tire ones are grouped into one row per store.
def S(name, store, url, price, per, unit, carrier=None, ship=0, row=False): return dict(name=name, store=store, url=url, price=price, per=per, unit=unit, carrier=carrier, ship=ship, row=row, counted=unit in COUNTED)
SUP = {
 'foam_board': S('Foam board, white 3/16", 16 x 20"', 'DeSerres', DS + 'foam-board-white-16x20', 5.99, 320, 'in2', ['doghouse', 'doghouse_small']),
 'hoops_ds': S('Embroidery hoop, round, 15.2 cm (6")', 'DeSerres', DS + 'embroidery-hoop-round-15-2cm', 5.99, 1, 'hoops', ['paw_disc']),
 'aida': S('Aida fabric 14ct, 38 x 46 cm (15 x 18"), antique white', 'DeSerres', DS + 'aida-fabric-14ct-38-1-x-45-7cm-antique-white', 9.99, 4, 'pc', ['paw_disc', 'paw_disc_fay']),
 'gesso': S('White gesso 948 ml (primer, mortar grey and cream when tinted)', 'DeSerres', DS + 'white-gesso-948ml', 19.99, 948, 'ml'),
 'red1': S('Student acrylic Naphthol Red 250 ml', 'DeSerres', DS + 'student-acrylic-naphthol-red-250ml', 12.99, 250, 'ml'),
 'red2': S('Student acrylic Crimson 250 ml (1:1 with Naphthol Red = barn red)', 'DeSerres', DS + 'student-acrylic-crimson-250ml', 12.99, 250, 'ml'),
 'sienna': S('Basics acrylic Burnt Sienna 8 oz (236 ml)', 'DeSerres', DS + 'basics-acrylic-8oz-burnt-sienna', 19.99, 236, 'ml'),
 'black': S('Americana acrylic Lamp Black 60 ml', 'DeSerres', DS + 'americana-acrylic-lamp-black-60ml', 2.99, 60, 'ml'),
 'gold': S('Americana Dazzling Metallics Glorious Gold 60 ml', 'DeSerres', DS + 'americana-acrylic-dazzling-metallics-glorious-gold-60ml', 3.99, 60, 'ml'),
 'sparkle': S('Pearl medium, fine, black (sparkle on painted paws)', 'DeSerres', DS + 'pearl-medium-fine-black', 9.99, None, 'jar'),
 'podge': S('Mod Podge Matte 473 ml (sealer and sign glue)', 'DeSerres', DS + 'mod-podge-matte-473ml', 16.99, 473, 'ml'),
 'gold_cord': S('Metallic yarn, gold, 25 m (hanging loops)', 'DeSerres', DS + 'metallic-yarn-gold-25m', 5.99, 25, 'm'),
 'film': S('Drafting film 8.5 x 11" (cut our own paw stencils)', 'DeSerres', DS + 'drafting-film-0-003-matte-on-2-sides-8-5x11', 1.99, 6, 'stencils'),
 'glue_gun': S('Mini hot glue gun (7 mm sticks)', 'DeSerres', DS + 'hot-glue-gun-mini', 14.99, 1, 'tool'),
 'glue_sticks': S('Glue sticks 7 mm, 96 pc', 'DeSerres', DS + '96-glue-sticks-7mm', 12.99, 96, 'sticks'),
 'knife': S('Art knife with 5 blades (foam board and cardboard)', 'DeSerres', DS + 'art-knife-with-5-blades', 12.99, 5, 'blades'),
 'ruler': S('Steel and cork ruler 24"', 'DeSerres', DS + 'stainless-steel-and-cork-ruler-24-inch', 12.99, 1, 'tool'),
 'brushes': S('Craft brush set, 25 pc (doors, trim, details)', 'DeSerres', DS + 'set-of-25-craft-brushes', 12.99, 1, 'set'),
 'foam_brush2': S('Foam brush 2"', 'DeSerres', DS + 'foam-brush-black-2', 1.99, 1, 'brush'),
 'foam_brush1': S('Foam brush 1"', 'DeSerres', DS + 'foam-brush-black-1', 1.99, 1, 'brush'),
 'sponge': S('Hydra synthetic sponge (brick dabbing, stencilling)', 'DeSerres', DS + 'hydra-synthetic-sponge', 1.99, 1, 'sponge'),
 'enamel_pen': S('Sharpie oil-based paint marker, white (paws on the glazed bowl)', 'DeSerres', DS + 'sharpie-oil-based-paint-marker-medium-tip-white', 9.99, 1, 'pen'),
 'fabric_glue': S('Permanent fabric glue 118 ml (felt and glitter paws, scarf edges)', 'DeSerres', DS + 'permanent-fabric-glue-118ml', 6.99, 118, 'ml'),
 'kraft': S('Kraft paper roll 27.6" x 9.8 ft (core that fills the jar)', 'DeSerres', DS + 'kraft-paper-roll-27-6x9-8', 6.99, 1, 'roll'),
 'box_small': S('Small moving box 18 x 11 x 12"', 'Canadian Tire', CT + 'canadian-tire-small-moving-storage-box-100-recycled-cardboard-18-x-11-x-12-in-0676043p.html', 1.75, 1, 'box', ['gift_boxes']),
 'box_medium': S('Medium moving box 16 x 16 x 16"', 'Canadian Tire', CT + 'canadian-tire-medium-moving-storage-box-100-recycled-cardboard-16-x-16-x-16-in-0676172p.html', 2.65, 1, 'box', ['gift_boxes']),
 'box_xl': S('Extra-large moving box 24 x 20 x 20"', 'Canadian Tire', CT + 'canadian-tire-extra-large-moving-box-100-recycled-cardboard-24-x-20-x-20-in-0676076p.html', 4.99, 1, 'box', ['doghouse_xl']),
 'packing_tape': S('Box sealing tape, clear, 48 mm x 50 m', 'Canadian Tire', CT + 'tempest-box-sealing-tape-clear-48mm-x-50m-4992262p.html', 3.99, 50, 'm'),
 'magic_tape': S('Scotch Magic Tape 19 mm x 10 m, 3-pk (gift wrapping)', 'Canadian Tire', CT + 'scotch-magic-tape-in-dispenser-invisible-matte-finish-19-mm-x-10-m-3-pk-0670361p.html', 4.99, 30, 'm'),
 'drop_sheet': S('Plastic drop sheet 8 x 12 ft (painting in the office)', 'Canadian Tire', CT + 'bennett-light-weight-plastic-drop-sheets-8-ft-x-12-ft-0494804p.html', 4.99, 1, 'sheet'),
 'burlap6': S('Natural jute burlap ribbon 6" x 12 yd, hemmed', 'Amazon.ca', AMZ + 'B0DQ4BXYKZ', 25.14, 12, 'yd', ['topper'], ship=6.43),
 'burlap4': S('Natural burlap wired ribbon 4" x 10 yd', 'Amazon.ca', AMZ + 'B0CHMLF3NP', 16.80, 10, 'yd', ['topper_4in']),
 'paw25': S('Burlap ribbon with brown paws, 2.5" x 10 yd', 'Amazon.ca', AMZ + 'B09H2YMHCL', 20.56, 10, 'yd', ['topper_printed']),
 'hoops_fay': S('Faylapa 6" bamboo embroidery hoops, 16-pk', 'Amazon.ca', AMZ + 'B088WV6BFG', 29.99, 16, 'hoops', ['paw_disc_fay']),
 'wood_rounds': S('4" bauble-shaped wood rounds, 50 pc', 'Amazon.ca', AMZ + 'B0FC6DWFVL', 13.90, 50, 'pc', ['paw_disc_wood']),
 'clay': S('White air-dry foam clay 500 g', 'Amazon.ca', AMZ + 'B0F86WQG4W', 22.00, 500, 'g', row=True),
 'tartan_ribbon': S('Tartan wired ribbon 4" x 10 yd', 'Amazon.ca', AMZ + 'B0D7WPZDJW', 33.68, 10, 'yd', row=True),
 'velvet_ribbon': S('Dark red wired velvet ribbon 1.5" x 25 yd', 'Amazon.ca', AMZ + 'B09XPW59VV', 36.07, 25, 'yd', row=True),
 'burlap_ribbon': S('Natural burlap wired ribbon 1.5" x 20 yd', 'Amazon.ca', AMZ + 'B09MVX5VRK', 18.39, 20, 'yd', row=True),
 'glitter_card': S('Black glitter cardstock 12 x 12", 10 sheets', 'Amazon.ca', AMZ + 'B0BKWY2ZMT', 14.88, 10, 'sheets', row=True),
 'tartan_wrap': S('Red tartan wrapping paper 17" x 33 ft', 'Amazon.ca', AMZ + 'B0F9P8CHMT', 19.79, 396, 'in', row=True),
 'paw_wrap': S('Kraft paw wrapping paper, 6 sheets 17 x 40"', 'Amazon.ca', AMZ + 'B0FSXRGDGM', 22.68, 6, 'sheets', row=True),
 'mini_bows': S('Mini red velvet bows 3.5", 12-pk', 'Amazon.ca', CAT['mini_bows']['url'], 15.41, 12, 'bows', row=True),
 'floral_wire': S('Green floral wire 22 gauge, 3 x 118 yd', 'Amazon.ca', CAT['floral_wire']['url'], 29.92, 354, 'yd', row=True),
 'felt': S('Black felt 8 x 12", 7 sheets', 'Amazon.ca', AMZ + 'B0DX78HCZC', 8.50, 7, 'sheets', row=True),
}
for k in ('clay', 'tartan_ribbon', 'velvet_ribbon', 'burlap_ribbon', 'glitter_card', 'tartan_wrap', 'paw_wrap', 'mini_bows', 'floral_wire', 'felt'):
    CAT[k].update(price=SUP[k]['price'], url=SUP[k]['url'])
ON_HAND = ['Scissors (3 pairs)', 'Pencils and ballpoint pens (pens score the brick and shingle lines)', 'Aluminum foil, about 15 ft (cores for the clay bones)',
           'Toothpicks', 'Paper towels, water cups, paper plates for palettes', 'Office colour printer: templates on Letter and 11x17', 'Garbage bags for clean-up']

# ---------------- project geometry -> needs ----------------
class Needs(list):
    def __call__(self, sup, project, amount, how=''): self.append([sup, project, round(amount, 3), how]); return self

def doghouses(n, W, D, WALL, RIDGE, paw, key):
    N = Needs(); big = W > 5; over = 0.75 if big else 0.35
    gable = W * WALL + 0.5 * W * (RIDGE - WALL); slope = math.hypot(W / 2, RIDGE - WALL) + over
    trims = (2 * 4.6 + 3.8) * 0.5 + 4 * WALL * 0.5 if big else 3
    parts = 2 * W * RIDGE + 2 * (D - 0.375) * WALL + 2 * slope * (D + 2 * over) + (W - 0.375) * (D - 0.375) + trims
    walls = 2 * gable + 2 * D * WALL; roof = 2 * slope * (D + 2 * over)
    N('foam_board', key, n * parts / 0.8, f'{n} sets x {parts:.0f} in2 of parts / 80% packing')
    N('gesso', key, ML_PER_FT2 * ft2(n * walls), f'mortar grey, 1 coat on {n} x {walls:.0f} in2 of walls')
    N('gesso', key, ML_PER_FT2 * ft2(n * roof) * 2, f'cream roofs, 2 coats on {n} x {roof:.0f} in2')
    N('gesso', key, n * (2 if big else 0.5), 'cream trims and gable paw')
    N('red1', key, DAB_ML_PER_FT2 * ft2(n * walls), 'red bricks, 2 dabbed coats (half from each red)'); N('red2', key, DAB_ML_PER_FT2 * ft2(n * walls), 'red bricks (other half)')
    N('sienna', key, ML_PER_FT2 * ft2(n * walls), 'inside faces, 1 coat (stops warping, dark through the door)')
    N('black', key, n * 0.6, 'darkens the door opening')
    N('glue_sticks', key, n * (3 if big else 2), 'per house'); N('gold_cord', key, n * 0.3, f'{n} loops x 30 cm')
    N('film', key, 1, f'{paw}" gable paw stencil'); N('floral_wire', key, n * 8 / 36, '8" each')
    return N

def bones(n, L, key):
    s = L / 5; vol = (3.2 * 0.8 * 0.8 * 0.8 + 4 * (4 / 3) * math.pi * 0.475 ** 3) * s ** 3; area = (2 * 6.3 + 5) * s ** 2
    N = Needs()
    N('clay', key, n * vol * IN3_CM3 * 0.5 * CLAY_G_PER_CM3, f'{n} x {vol:.1f} in3, half foil core, {CLAY_G_PER_CM3} g/cm3')
    N('gesso', key, ML_PER_FT2 * ft2(n * area) * 2, f'cream, 2 coats on {n} x {area:.0f} in2'); N('sienna', key, 0.5 * n, 'dry-brushed edges')
    N('podge', key, PODGE_ML_PER_FT2 * ft2(n * area), 'seal'); N('gold_cord', key, n * 0.25, f'{n} loops x 25 cm'); N('floral_wire', key, n * 8 / 36, '8" each')
    return N

def hoop_paws(n, hoops, key):
    N = Needs(); ring = math.pi * 6.4 * (0.6 + 0.35)
    N(hoops, key, n, f'{n} hoops'); N('aida', key, n, f'{n} pieces 7.5 x 9" (4 per 15 x 18" sheet)')
    N('gold', key, ML_PER_FT2 * ft2(n * ring) * 3, f'both rings, outer face and front edge ({ring:.0f} in2), 3 coats')
    N('glitter_card', key, n / 9, f'{n} paws of 3.6", 9 per 12 x 12" sheet'); N('fabric_glue', key, n * 1, 'glue the paws on')
    N('velvet_ribbon', key, n * 37 / 36, f'{n} bows x 37" (two 4.5" loops, 8" tails, knot)'); N('glue_sticks', key, n, 'Aida edge inside the ring')
    N('gold_cord', key, n * 0.25, f'{n} loops x 25 cm'); N('floral_wire', key, n * 8 / 36, '8" each')
    return N

def topper(ribbon_sup, yd, paws, key):
    N = Needs()
    N(ribbon_sup, key, yd, f'bow: loops, knot and tails ({yd * 36:.0f}")')
    if paws: N('felt', key, paws * 2.4 * 2.4 / 0.75 / 96, f'{paws} paws of 2.2" cut from 2.4" squares, 75% of the sheet usable'); N('fabric_glue', key, paws * 0.5, 'felt paws')
    N('floral_wire', key, yd * 2 + 3 if paws else 3, 'wire along both back edges + ties to the top' if paws else 'ties to the top'); N('glue_sticks', key, 6, 'edge wire')
    return N

BOXES = [('A', 18, 11, 12, 'tartan', 'burlap'), ('B', 16, 16, 16, 'tartan', 'burlap'), ('C', 16, 16, 10, 'tartan', 'burlap'), ('D', 18, 11, 7, 'paw', 'tartan')]
def gifts():
    N = Needs(); N('box_small', 'gift_boxes', 2, 'A (18x11x12) and D (cut down to 7" tall)'); N('box_medium', 'gift_boxes', 2, 'B (16x16x16) and C (cut down to 10")')
    for name, l, w, h, paper, rib in BOXES:
        girth = 2 * (w + h) + 2; width = l + h + 2
        if paper == 'tartan': N('tartan_wrap', 'gift_boxes', girth * math.ceil(width / 17), f'box {name}: {math.ceil(width / 17)} strips of {girth}" (paper is 17" wide)')
        else: N('paw_wrap', 'gift_boxes', 2 * math.ceil(width / 17), f'box {name}: 2 sheets taped end to end per strip (girth {girth}")')
        if rib == 'burlap': N('burlap_ribbon', 'gift_boxes', (2 * (l + h) + 2 * (w + h) + 8 + 40) / 36, f'box {name}: both ways + a 10" bow (40")')
        else: N('tartan_ribbon', 'gift_boxes', (2 * (w + h) + 4) / 36, f'box {name}: one way round'); N('burlap_ribbon', 'gift_boxes', 40 / 36, f'box {name}: 10" bow')
        N('packing_tape', 'gift_boxes', 3, f'close box {name}'); N('magic_tape', 'gift_boxes', 2, f'wrap box {name}')
    return N

JAR_D, JAR_H = 7.0, 9.9
ring = math.floor(math.pi * (JAR_D - 0.4) / 3.0); rings = math.floor((JAR_H - 1.4) / 1.4); biscuits_needed = ring * rings + 12
def basket_full():
    N = Needs(); b = 3 * 1.2 * 0.65 * 0.3
    N('clay', 'faux_treats', 60 * b * IN3_CM3 * CLAY_G_PER_CM3, f'60 biscuits x {b:.2f} in3 (the jar needs {biscuits_needed}: {ring} per ring x {rings} rings + 12 on top)')
    N('gesso', 'faux_treats', ML_PER_FT2 * ft2(60 * 6.1), 'tan (gesso + burnt sienna), 1 coat'); N('sienna', 'faux_treats', 15, 'tan tint')
    N('podge', 'faux_treats', PODGE_ML_PER_FT2 * ft2(60 * 6.1), 'seal'); N('kraft', 'faux_treats', 1, 'crumpled 4" core inside the jar')
    N('velvet_ribbon', 'jar', 45 / 36, 'jar bow, two 5" loops and 9" tails'); N('floral_wire', 'basket', 5 * 12 / 36, 'jar and toys wired into the basket')
    return N

GW, GD, GWALL, GRIDGE, DW, DH = 24, 20, 16, 26, 10, 13
def giant():
    N = Needs(); door = DW * (DH - DW / 2) + math.pi * (DW / 2) ** 2 / 2
    walls = 2 * (GW * GWALL + 0.5 * GW * (GRIDGE - GWALL)) - door + 2 * GD * GWALL
    roof = 2 * (math.hypot(GW / 2, GRIDGE - GWALL) + 2) * (GD + 4); inside = walls + door + GW * GD
    N('box_xl', 'doghouse_xl', 2, 'box A = walls and floor (cut down to 16"); box B = roof, gables, shingles, sign backing')
    N('gesso', 'doghouse_xl', ML_PER_FT2 * ft2(walls) * 2, f'mortar grey, 2 coats over cardboard on {walls:.0f} in2')
    N('red1', 'doghouse_xl', DAB_ML_PER_FT2 * ft2(walls), 'red bricks (half)'); N('red2', 'doghouse_xl', DAB_ML_PER_FT2 * ft2(walls), 'red bricks (other half)')
    N('gesso', 'doghouse_xl', ML_PER_FT2 * ft2(roof * 1.2) * 2, f'cream shingles, 2 coats on {roof:.0f} in2 (+20% for shingle edges)')
    N('red1', 'doghouse_xl', ML_PER_FT2 * ft2(inside) / 2, f'inside, dark red-brown, {inside:.0f} in2 (half)'); N('red2', 'doghouse_xl', ML_PER_FT2 * ft2(inside) / 2, 'inside (other half)')
    N('black', 'doghouse_xl', 30, 'darkens the inside'); N('gesso', 'doghouse_xl', ML_PER_FT2 * ft2(40 * 1.25) * 2 + 2, 'door trim and gable paw')
    N('podge', 'doghouse_xl', PODGE_ML_PER_FT2 * ft2(16 * 4) * 2, 'glue and seal the 16 x 4" sign'); N('glue_sticks', 'doghouse_xl', 30, 'roof, gables, shingles, trim')
    N('packing_tape', 'doghouse_xl', 10, 'inside seams'); N('film', 'doghouse_xl', 1, '3.6" paw stencil')
    return N

def wire(project, count, inches, how): return Needs()('floral_wire', project, count * inches / 36, how)
def plus(*ns):
    out = Needs(); [out.extend(n) for n in ns]; return out

# ---------------- the board, element by element ----------------
def O(id, label, short, match, why, rows, needs=None, render=None, provides=None, photo=None):
    return dict(id=id, label=label, short=short, match=match, why=why, rows=[dict(id=r[0], qty=r[1], **({'made': r[2]} if len(r) > 2 else {})) for r in rows],
                needs=needs or Needs(), render=render or {}, provides=provides or {}, photo=photo)

BAUBLE_WIRE = lambda n: wire('baubles', n, 8, f'{n} baubles x 8"')
ELEMENTS = [
 dict(id='topper', title='Topper bow', board='board_topper', options=[
   O('burlap6', '22" two-loop bow: 6" jute + felt paws', 'Two fat loops of 6" burlap, black felt paws', 'match',
     'Same width, colour, shape and paw print as the board\'s bow.', [('topper', 1, 1)], topper('burlap6', 2.7, 20, 'topper'),
     dict(ribbon=6, span=22, loops=2, tail=22, paws=20), {'@topper_ribbon': 'burlap6'}, 'p_B0DQ4BXYKZ'),
   O('burlap4', '24" four-loop bow: 4" wired burlap + felt paws', 'The earlier four-loop bow', 'close',
     'Thinner ribbon and four loops: busier than the board\'s two fat loops.', [('topper_4in', 1, 1)], topper('burlap4', 2.6, 20, 'topper'),
     dict(ribbon=4, span=24, loops=4, tail=16, paws=20), {'@topper_ribbon': 'burlap4'}, 'p_B0CHMLF3NP'),
   O('printed', '20" bow from printed 2.5" paw ribbon', 'No crafting; brown paws, narrow', 'close',
     'Ready-made paw print, but brown paws and under half the board\'s ribbon width.', [('topper_printed', 1, 1)], topper('paw25', 2.4, 0, 'topper'),
     dict(ribbon=2.5, span=20, loops=4, tail=14, paws=0, brown=True), {'@topper_ribbon': 'paw25'}, 'p_B09H2YMHCL'),
 ]),
 dict(id='flourish', title='Topper extras', board=None, options=[
   O('none', 'None, as the board', 'Just the bow, like the board', 'match', 'The board has no streamers or crown.', []),
   O('streamers', 'Two burlap streamers down the front', 'Ribbon waterfall', None, 'Our addition, not on the board.', [],
     Needs()('@topper_ribbon', 'streamers', 4.0, 'two 72" streamers')('floral_wire', 'streamers', 12 * 6 / 36, '12 ties'), dict(streamers=True)),
   O('crown', 'Gold crown of 12 sprays behind the bow', 'Gold sprays fanned behind the bow', None, 'Our addition, not on the board.', [('gold_picks', 1)],
     wire('crown', 12, 6, '12 sprays'), dict(crown=True)),
   O('both', 'Streamers and gold crown', 'Both extras', None, 'Our additions, not on the board.', [('gold_picks', 1)],
     plus(Needs()('@topper_ribbon', 'streamers', 4.0, 'two 72" streamers')('floral_wire', 'streamers', 12 * 6 / 36, '12 ties'), wire('crown', 12, 6, '12 sprays')), dict(streamers=True, crown=True)),
 ]),
 dict(id='dogs', title='Golden retrievers on the tree', board='board_dog', options=[
   O('cuddlekins', '12" Cuddlekins golden retriever x 2', 'Sitting puppy, 11" tall', 'match', 'Sitting golden puppy with the board\'s face and colour, inside its 9-14" size.',
     [('golden', 2)], wire('plush', 2, 24, 'round the body to the trunk'), dict(cut='golden_tree', h=11, n=2), photo='p_B01N4NC8QY'),
   O('aurora', '14" Aurora Golden Lab x 2', 'Bigger, rounder Lab face', 'close', 'Bigger, but a Labrador face rather than a fluffy golden.',
     [('golden_aurora', 2)], wire('plush', 2, 30, 'round the body to the trunk'), dict(cut='golden_aurora', h=13, n=2), photo='p_B00ILYHVDQ'),
   O('one', '12" Cuddlekins x 1', 'One dog, like the board\'s front', 'match', 'The board shows one dog on its visible side.',
     [('golden', 1)], wire('plush', 1, 24, 'round the body to the trunk'), dict(cut='golden_tree', h=11, n=1), photo='p_B01N4NC8QY'),
 ]),
 dict(id='cats', title='Tabby cats on the tree', board='board_cat_a', options=[
   O('fluffy', '8" FLUFFYFUN grey tabby x 2', 'Realistic sitting tabby, 8"', 'match', 'Grey tabby with white muzzle and chest, sitting, at the board\'s scale.',
     [('cat_fluffy', 2)], wire('plush', 2, 20, 'round the body to a sturdy branch'), dict(cut='cat_fluffy', h=8, n=2), photo='p_B0H5YKFT7X'),
   O('pocketkins', '4.7" Pocketkins tabby x 3', 'Small kittens (the earlier pick)', 'close', 'Right look, a third to a half of the board\'s size.',
     [('tabby_grey', 3)], wire('plush', 3, 16, 'round the body'), dict(cut='tabby_mini_s', h=4.7, n=3), photo='p_B0CVNDJS4D'),
   O('zigby', '6" Douglas Zigby tabby x 2', 'Standing tabby, 6"', 'close', 'Standing rather than sitting, and smaller.',
     [('tabby_brown', 2)], wire('plush', 2, 20, 'round the body'), dict(cut='tabby_cat_s', h=6, n=2), photo='p_B086H6SNL7'),
 ]),
 dict(id='doghouses', title='Doghouse ornaments', board='board_doghouse', options=[
   O('diy10', '10" DIY doghouses x 6', 'Board scale: red brick, cream roof, arched door', 'match', 'Same design and scale as the board\'s doghouse.',
     [('doghouse', 1, 6)], doghouses(6, 8.5, 6, 5.5, 9.5, 2.5, 'doghouse'), dict(w=8.5, d=6, wall=5.5, ridge=9.5, n=6), photo='r3d_doghouse_iso'),
   O('diy10x4', '10" DIY doghouses x 4', 'Fewer, same size', 'match', 'Same as the board; 4 instead of 6 leaves one or two per side.',
     [('doghouse', 1, 4)], doghouses(4, 8.5, 6, 5.5, 9.5, 2.5, 'doghouse'), dict(w=8.5, d=6, wall=5.5, ridge=9.5, n=4), photo='r3d_doghouse_iso'),
   O('diy43', '4.3" DIY doghouses x 12', 'Small (the earlier size)', 'close', 'Same design at a third of the board\'s size.',
     [('doghouse_small', 1, 12)], doghouses(12, 3.4, 2.7, 2.4, 4.0, 1, 'doghouse'), dict(w=3.4, d=2.7, wall=2.4, ridge=4.0, n=12), photo='r3d_doghouse_iso'),
 ]),
 dict(id='paws', title='Paw-print ornaments', board='board_paw', options=[
   O('hoop', '6" hoop paw ornaments x 10 (DeSerres hoops)', 'Gold rim, cream weave, glitter paw, velvet bow', 'match', 'Gold rim and cap, cream textured face, black sparkly paw, deep red velvet bow: the board\'s ornament at its size.',
     [('paw_disc', 1, 10)], hoop_paws(10, 'hoops_ds', 'paw_disc'), dict(kind='hoop', d=6, n=10, bow=9), photo='p_hoops_ds'),
   O('hoop_fay', '6" hoop paw ornaments x 10 (Amazon hoops)', 'Same ornament, cheaper hoops (low stock)', 'match', 'Identical ornament; the hoop listing had 3 packs left.',
     [('paw_disc_fay', 1, 10)], hoop_paws(10, 'hoops_fay', 'paw_disc'), dict(kind='hoop', d=6, n=10, bow=9), photo='p_B088WV6BFG'),
   O('wood', '4" painted wood rounds x 30', 'Smaller and flatter (the earlier design)', 'close', 'Two-thirds of the board\'s size, painted flat, small bows.',
     [('paw_disc_wood', 1, 30)],
     plus(Needs()('wood_rounds', 'paw_disc', 30, '30 of 50')('gesso', 'paw_disc', ML_PER_FT2 * ft2(30 * 12.8 * 2) * 2, 'cream, 2 coats, both sides')('gold', 'paw_disc', 10 * ft2(30 * 2.8 * 2) * 3, 'gold rim and cap')
          ('black', 'paw_disc', ML_PER_FT2 * ft2(30 * 4.95) * 2, '3" black paw')('sparkle', 'paw_disc', 10, 'sparkle coat')('podge', 'paw_disc', PODGE_ML_PER_FT2 * ft2(30 * 12.8), 'seal')
          ('mini_bows', 'paw_disc', 30, 'one bow each')('gold_cord', 'paw_disc', 7.5, '30 loops')('film', 'paw_disc', 1, '3" paw stencil')('glue_sticks', 'paw_disc', 4, 'bows'), wire('paw_disc', 30, 6, '6" each')),
     dict(kind='disc', d=4, n=30, bow=3.5), photo='p_B0FC6DWFVL'),
 ]),
 dict(id='bones', title='Bone ornaments', board='board_bone', options=[
   O('clay9', '9" DIY clay bones x 8', 'Smooth biscuit-cream bones at board scale', 'match', 'Smooth, puffy, cream: the board\'s bones at its size.', [('bones', 1, 8)], bones(8, 9, 'bones'), dict(kind='clay', l=9, n=8), photo='r3d_bones'),
   O('fleece9', '9" fleece bones x 8 (bought)', 'Fuzzy sherpa bones, no crafting', 'close', 'Right size and colour, but fuzzy, not smooth.', [('bone_fleece', 8)], wire('bones', 8, 8, '8" each'), dict(kind='fleece', l=9, n=8), photo='p_B000E1S8NG'),
   O('clay5', '5" DIY clay bones x 24', 'Smaller (the earlier size)', 'close', 'About half the board\'s size.', [('bones_small', 1, 24)], bones(24, 5, 'bones'), dict(kind='clay', l=5, n=24), photo='r3d_bones'),
 ]),
 dict(id='baubles', title='Baubles', board='board_baubles', options=[
   O('board', 'Board mix: 6" and 4" red, 4" gold and green + filler', 'Red, gold, green at the board\'s 4-6" scale', 'match', 'The board\'s palette with its big balls at its sizes; the 100-pc set fills between.',
     [('baubles_rgg', 1), ('red6_benjia', 1), ('red4_glitter', 2), ('red4_joyin', 1), ('gold4_joyin', 2), ('glitter_green', 2), ('glitter_champ', 1)], BAUBLE_WIRE(100 + 4 + 12 + 4 + 8 + 12 + 12),
     dict(sets=[['baubles_rgg', 1], ['red6_benjia', 1], ['red4_glitter', 2], ['red4_joyin', 1], ['gold4_joyin', 2], ['glitter_green', 2], ['glitter_champ', 1]])),
   O('painted', 'Board mix with 6" painted red & gold instead of plain red', 'Swirled and diamond-painted 6" balls', 'close', 'Same size, but painted with gold swirls; the board\'s big balls are plain.',
     [('baubles_rgg', 1), ('redgold6', 1), ('red4_glitter', 2), ('red4_joyin', 1), ('gold4_joyin', 2), ('glitter_green', 2), ('glitter_champ', 1)], BAUBLE_WIRE(152),
     dict(sets=[['baubles_rgg', 1], ['redgold6', 1], ['red4_glitter', 2], ['red4_joyin', 1], ['gold4_joyin', 2], ['glitter_green', 2], ['glitter_champ', 1]])),
   O('original', 'The earlier mix: 3" and smaller, 236 balls', 'Many small balls (the earlier list)', 'close', 'Right colours, but mostly 1.2-3" against the board\'s 4-6".',
     [('baubles_rgg', 2), ('baubles_champ', 1), ('glitter_red', 1), ('glitter_champ', 1), ('glitter_green', 2)], BAUBLE_WIRE(348),
     dict(sets=[['baubles_rgg', 2], ['baubles_champ', 1], ['glitter_red', 1], ['glitter_champ', 1], ['glitter_green', 2]])),
 ]),
 dict(id='ribbon', title='Tartan ribbon and bows', board='board_ribbon', options=[
   O('full', '5 cascades + 14 big tartan bows', 'Ribbon running down the tree, big bows', 'match', 'The board\'s ribbon runs top to bottom with big bows along it.',
     [('big_bows', 1, 14)], plus(Needs()('tartan_ribbon', 'cascades', 5 * 118 / 36, '5 cascades x 118" (82" down the tree + poufs)')('tartan_ribbon', 'big_bows', 14 * 1.5, '14 bows x 1.5 yd'),
     wire('cascades', 50, 6, '10 ties per cascade'), wire('big_bows', 14, 12, '12" each')), dict(cascades=5, bows=14)),
   O('bows', '14 big tartan bows, no cascades', 'Bows only', 'close', 'Loses the board\'s long ribbon lines.',
     [('big_bows', 1, 14)], plus(Needs()('tartan_ribbon', 'big_bows', 14 * 1.5, '14 bows x 1.5 yd'), wire('big_bows', 14, 12, '12" each')), dict(cascades=0, bows=14)),
   O('more', '5 cascades + 20 big bows', 'Fuller: more bows', 'match', 'As the board, fuller.',
     [('big_bows', 1, 20)], plus(Needs()('tartan_ribbon', 'cascades', 5 * 118 / 36, '5 cascades')('tartan_ribbon', 'big_bows', 20 * 1.5, '20 bows x 1.5 yd'), wire('cascades', 50, 6, 'ties'), wire('big_bows', 20, 12, '12" each')), dict(cascades=5, bows=20)),
 ]),
 dict(id='stockings', title='Mini pet stockings', board=None, options=[
   O('knit', '4" knit stockings x 12', 'Red, green, cream knit', 'close', 'On the board\'s list, not in its photos; knit in its colours.', [('stockings', 1)], wire('stockings', 12, 6, '6" each'), dict(n=12)),
   O('none', 'None', 'Leave them off', None, 'The board\'s photos show none.', []),
 ]),
 dict(id='greens', title='Gold accents and greens', board='board_greens', options=[
   O('full', 'Gold sprays, pine and holly picks, red berries', 'All three, like the board', 'match', 'Gold sprays, pine cones and red berry clusters as on the board.',
     [('gold_picks', 1), ('pine_picks', 1), ('glossy_berries', 1)], wire('picks', 28 + 24 + 48, 6, 'per stem'), dict(gold=28, pine=24, berries=48)),
   O('lean', 'Gold sprays and pine picks only', 'No extra red berries', 'close', 'Fewer of the board\'s red berry clusters.', [('gold_picks', 1), ('pine_picks', 1)], wire('picks', 52, 6, 'per stem'), dict(gold=28, pine=24, berries=0)),
 ]),
 dict(id='gifts', title='Wrapped gifts', board='board_gifts', options=[
   O('four', '4 wrapped boxes: tartan + cream bows, kraft paw', 'Like the board', 'match', 'Tartan with cream ribbon, kraft paw paper with tartan ribbon, cream bows.', [('gift_boxes', 1, 4)], gifts(), dict(boxes=4)),
   O('none', 'None', 'No display gifts', None, 'The board has them.', []),
 ]),
 dict(id='floor', title='Bone pillow and bowl', board='board_floor', options=[
   O('both', 'Sherpa bone pillow + red dotted bowl', 'Like the board', 'match', 'Both are in the board\'s photo, front and centre.', [('bone_pillow', 1), ('bowl', 1)],
     Needs()('felt', 'bone_pillow', 1, 'one 4.5" paw')('fabric_glue', 'bone_pillow', 3, 'felt paw')('enamel_pen', 'bowl', 1, '2 white paws on glazed ceramic')('film', 'bowl', 1, '1.5" paw stencil'), dict(pillow=True, bowl=True)),
   O('pillow', 'Bone pillow only', 'Pillow, no bowl', 'close', 'Loses the red bowl.', [('bone_pillow', 1)], Needs()('felt', 'bone_pillow', 1, 'one 4.5" paw')('fabric_glue', 'bone_pillow', 3, 'felt paw'), dict(pillow=True, bowl=False)),
 ]),
 dict(id='basket', title='Gift basket', board='board_basket', options=[
   O('full', 'Basket, treat jar, throw, toys, 2 x $100 gift cards', 'Everything on the board', 'match', 'Every item in the board\'s basket photo.',
     [('basket', 1), ('jar', 1), ('faux_treats', 1, 60), ('bone_cutters', 1), ('blanket', 1), ('holiday_toy', 1), ('rope', 1), ('balls', 1), ('gift_card', 2)], basket_full(), dict(jar=True, blanket=True)),
   O('lean', 'Basket, toys, 2 x $100 gift cards (no jar or throw)', 'Smaller basket', 'close', 'Loses the treat jar and the throw.',
     [('basket', 1), ('holiday_toy', 1), ('rope', 1), ('balls', 1), ('gift_card', 2)], wire('basket', 3, 12, 'toys wired in'), dict(jar=False, blanket=False)),
 ]),
 dict(id='pair', title='Dog and cat by the basket', board='board_pets_panel', options=[
   O('pair', 'Golden retriever + tabby in scarves', 'The board\'s dog-and-cat photo, under the tree', 'match', 'Recreates the board\'s dog-and-cat photo beside the basket.',
     [('golden', 1), ('cat_fluffy', 1)], Needs(), dict(on=True)),
   O('none', 'None', 'No pets under the tree', None, 'The tree still has its pets.', []),
 ]),
 dict(id='giant', title='Giant doghouse', board=None, options=[
   O('none', 'None, as the board', 'Not on the board', 'match', 'The board has no giant doghouse.', []),
   O('build', '24 x 20 x 26" doghouse from two moving boxes', 'Our wow piece: the pets sit in its doorway', None, 'Our addition: big impact, but not on the board.',
     [('doghouse_xl', 1, 1)], giant(), dict(on=True)),
 ]),
]
for e in ELEMENTS: e['default'] = e['options'][0]['id']

BASE = dict(rows=[dict(id='bandanas', qty=1)], needs=Needs()('fabric_glue', 'pet_scarves', 0.05 * 3 * 72, '3 lengthwise cuts x 72", thin bead to stop fraying')
    ('drop_sheet', 'craft', 1, 'covers two tables')('glue_gun', 'craft', 1)('knife', 'craft', 3, 'about 1 blade per 3 boards')('ruler', 'craft', 1)('brushes', 'craft', 1)
    ('foam_brush2', 'craft', 3, 'gesso, cream, Mod Podge')('foam_brush1', 'craft', 3, 'small parts')('sponge', 'craft', 2, 'bricks + stencilling')('glue_sticks', 'misc', 10, 'repairs on decorating day'))

# ---------------- resolve a selection into the order list (build/resolve.js mirrors this) ----------------
SECTIONS = ['Tree ornaments', 'Ribbon & bows', 'Accents & supplies', 'Under-tree display', 'Gift basket', 'Shipping & fees']
def rnd(x, d=0):     # the same rounding as resolve.js (round half up), so the page and the build agree to the cent
    m = 10 ** d; return math.floor(x * m + 0.5 + 1e-9) / m if d else int(math.floor(x + 0.5 + 1e-9))
def resolve(sel):
    chosen = [next(o for o in e['options'] if o['id'] == sel.get(e['id'], e['default'])) for e in ELEMENTS] + [BASE]
    provides = {}
    for o in chosen: provides.update(o.get('provides', {}))
    rows, order = {}, []
    for o in chosen:
        for r in o['rows']:
            if r['id'] not in rows: rows[r['id']] = dict(qty=0, made=None, price=None, carries=[]); order.append(r['id'])
            rows[r['id']]['qty'] += r['qty']
            if 'made' in r: rows[r['id']]['made'] = (rows[r['id']]['made'] or 0) + r['made']
    need, norder = defaultdict(list), []
    for o in chosen:
        for s, p, a, h in o['needs']:
            s = provides.get(s, s)
            if s not in need: norder.append(s)
            need[s].append((p, a, h))
    sups = []
    for s in norder:
        uses = need[s]; X = SUP[s]; tot = sum(a for _, a, _ in uses)
        qty = 1 if X['per'] is None else max(1, math.ceil(rnd(tot * (1 if X['counted'] else MARGIN) / X['per'], 6)))
        target = next((c for c in (X['carrier'] or []) if c in rows), None)
        if not target: target = s if X['row'] else {'DeSerres': 'craft_supplies', 'Canadian Tire': 'ct_supplies'}[X['store']]
        if target not in rows: rows[target] = dict(qty=qty if target == s else 1, made=None, price=X['price'] if target == s else None, carries=[]); order.append(target)
        if target != s: rows[target]['carries'].append(s)
        have = None if X['per'] is None else qty * X['per']
        sups.append(dict(id=s, name=X['name'], store=X['store'], url=X['url'], price=X['price'], qty=qty, per=X['per'], unit=X['unit'], need=rnd(tot, 1), have=have,
                         spare=None if have is None or tot == 0 else rnd((have - tot) / tot * 100), carrier=target,
                         ok=X['per'] is None or have >= tot * (1 if X['counted'] else MARGIN) - 1e-9, uses=[dict(project=p, amount=rnd(a, 1), how=h) for p, a, h in uses]))
    S_BY = {x['id']: x for x in sups}
    out, ships = [], []
    for id in order:
        r = rows[id]; it = dict(CAT[id]); it['qty'] = r['qty']
        if r['made'] is not None: it['made'] = r['made']
        if r['carries']: it['price'] = rnd(sum(S_BY[s]['price'] * S_BY[s]['qty'] for s in r['carries']), 2); it['qty'] = 1; it['materials'] = r['carries']
        elif r['price'] is not None: it['price'] = r['price']
        elif it.get('diy'): it['price'] = 0.0
        sh = rnd((it.get('ship') or 0) + sum(SUP[s]['ship'] for s in r['carries']) + (SUP[id]['ship'] if id in SUP and r['price'] is not None else 0), 2)
        if sh: ships.append((it.get('form_name') or it['name'], sh))
        out.append(it)
    if ships:
        it = dict(CAT['shipping']); it.update(price=rnd(sum(s for _, s in ships), 2), qty=1, store='Amazon.ca', url='https://www.amazon.ca/',
            name='Amazon.ca delivery on the listings that charge it ($0 with Prime)', form_name='Shipping (Amazon.ca)',
            notes='From the listings: ' + ', '.join(f'{n} ${s:.2f}' for n, s in ships) + '. Everything else ships free on an order over $35; DeSerres ships free over $149; Canadian Tire is store pickup.')
        out.append(it)
    for it in out: it['total'] = rnd(it['price'] * it['qty'], 2)
    out.sort(key=lambda i: SECTIONS.index(i['section']))
    sub = rnd(sum(i['total'] for i in out), 2); taxable = sum(i['total'] for i in out if not CAT[i['id']].get('gst_exempt'))
    gst = rnd(taxable * 0.05, 2); grand = rnd(sub + gst, 2)
    return out, sups, dict(subtotal=sub, gst=gst, grand=grand, left=rnd(BUDGET - grand, 2))

if __name__ == '__main__':
    items, sups, tot = resolve({})
    for r in sups: print(f"{'OK ' if r['ok'] else 'FAIL'} {r['id']:<14} need {r['need']:>8} {r['unit']:<7} buy {r['qty']:>2} have {r['have']!s:>6}  spare {r['spare']!s:>5}%  -> {r['carrier']}")
    fails = [r['id'] for r in sups if not r['ok']]
    swaps = []
    for e in ELEMENTS:      # every option must resolve with full supplies on its own
        for o in e['options']:
            _, s2, t2 = resolve({e['id']: o['id']}); fails += [f"{e['id']}.{o['id']}:{x['id']}" for x in s2 if not x['ok']]; swaps.append((t2['left'], f"{e['id']}.{o['id']}"))
    print('total', tot, '| options checked:', len(swaps), '| tightest single swap:', min(swaps))
    if fails: print('FAILED:', fails); sys.exit(1)
    if tot['left'] < FLOOR: print(f'FAILED: only ${tot["left"]} left; the floor is ${FLOOR}'); sys.exit(1)
    for it in items: it.setdefault('reference_crops', []); it.setdefault('look', ''); it.setdefault('viz', None)
    (ROOT / 'data' / 'items.json').write_text(json.dumps(items, indent=1, ensure_ascii=False) + '\n')
    data = dict(checked=CHECKED, assumptions=dict(ml_per_ft2=ML_PER_FT2, dab_ml_per_ft2=DAB_ML_PER_FT2, podge_ml_per_ft2=PODGE_ML_PER_FT2, clay_g_per_cm3=CLAY_G_PER_CM3, margin=MARGIN),
                supplies=sups, on_hand=ON_HAND, biscuits_needed=biscuits_needed, door=[DW, DH], giant=[GW, GD, GRIDGE], boxes=[[b[1], b[2], b[3], b[4], b[5]] for b in BOXES], totals=tot)
    (ROOT / 'data' / 'supplies.json').write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    used = {r['id'] for e in ELEMENTS for o in e['options'] for r in o['rows']} | {r['id'] for r in BASE['rows']} | {'craft_supplies', 'ct_supplies', 'shipping'} | {k for k, v in SUP.items() if v['row']}
    keep = ('id', 'section', 'name', 'form_name', 'store', 'url', 'price', 'ship', 'status', 'diy', 'notes', 'arrives_by', 'match', 'how', 'size_in', 'checked_on', 'gst_exempt', 'photo_file')
    opts = dict(budget=BUDGET, floor=FLOOR, margin=MARGIN, sections=SECTIONS, checked=CHECKED, base=BASE, elements=ELEMENTS, supplies=SUP, on_hand=ON_HAND,
                catalog={k: {f: CAT[k][f] for f in keep if f in CAT[k]} for k in sorted(used)})
    (ROOT / 'data' / 'options.json').write_text(json.dumps(opts, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('items:', len(items), '| elements:', len(ELEMENTS), '| options:', sum(len(e['options']) for e in ELEMENTS))
