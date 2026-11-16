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
# Bone outline from template page 4 (board proportions: knob span 0.53 L, shaft 0.27 L, four round lobes). For the 9" bone the
# outline is 31.0 sq in with a 26.6" perimeter (measured from the template geometry); both scale with L^2 and L.
BONE_SPAN, BONE_SHAFT, BONE_A1, BONE_P1 = 0.53, 0.27, 31.0 / 81, 26.6 / 9
BONE_ROUND = 0.85       # rounded edges: a puffy bone fills about 85% of outline x thickness
BONE_SHELL = 0.25       # clay shell over the scrunched-foil core
# Colour mixes (the only warm tints bought are burnt sienna and deep ochre; gesso is the white)
CREAM = 'cream = 1/2 cup (120 ml) gesso + 1 tsp deep ochre + a pea-sized dab of burnt sienna'
BISCUIT = 'biscuit = 1/2 cup gesso + 2 tsp deep ochre + 1 tsp burnt sienna'
TAN = 'tan = 1/4 cup gesso + 2 tsp deep ochre + 1 tsp burnt sienna'
DARK_BRICK = 'dark brick = Crimson + Lamp Black about 10:1'
BARN_RED = 'barn red = Naphthol Red + Crimson 1:1'
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
# Cats (re-searched Nov 16, 22 Amazon.ca queries + Canadian stores): no 8-12" SITTING grey or brown striped tabby arrives by Nov 30
# from a solid vendor. The Miyoni has the board's coat (strong grey-brown mackerel stripes, white chest, muzzle and paws) and the best
# vendor record, so it is the default; it crouches rather than sits, so it is rated 'close', not 'match'.
cat('cat_miyoni', section='Tree ornaments', name='Grey tabby kitten plush, 9" long x 6" tall, crouching (Aurora Miyoni Tots)', form_name='Grey tabby kitten plush, 9" (Aurora Miyoni)',
    url=AMZ + 'B00SUECXD0', price=33.16, arrives_by='2026-11-20', match='close', size_in={'h': 6, 'l': 9, 'w': 4.5, 'd': 9}, photo_file='p_B00SUECXD0',
    look='Strongly striped grey-brown tabby with a white chest, muzzle and paws, in a fringed tartan scarf.',
    notes='The board\'s coat: strong grey-brown mackerel stripes with a white chest, muzzle and paws. It crouches (front paws forward, head up) where the board\'s cats sit upright, so it lies along a branch on the tree. Snip off the gold Miyoni tag; the scarf covers the spot. Sold by Amazon US (cross-border, no import fee shown), 4.8 stars from 2,170 ratings, free delivery Nov 20, but only 8 left on Nov 16: order it first.', **AMZ_NEW)
cat('cat_fluffy', section='Tree ornaments', name='Grey-and-white cat plush, standing, 8" long x 7" tall (FLUFFYFUN)', form_name='Grey-and-white cat plush, 8"',
    url=AMZ + 'B0H5YKFT7X', price=34.19, ship=5.45, arrives_by='2026-11-24', match='close', size_in={'h': 7, 'l': 8, 'w': 5, 'd': 8}, photo_file='p_B0H5YKFT7X',
    notes='Mostly white with grey patches; stripes only on the head; stands on four legs with its tail up (gallery size chart: 7" tall x 8" long). The board\'s cats are striped tabbies sitting upright. Third-party seller Fluffyfun with 4 ratings, $5.45 delivery Nov 24.', **AMZ_NEW)
cat('tabby_grey', section='Tree ornaments', name='Grey tabby kitten plush, sitting, 4.7" (Wild Republic Pocketkins)', form_name='Grey tabby kitten plush, 4.7"', price=10.66, arrives_by='2026-11-20', match='close',
    notes='Sitting grey tabby with a white chest: the board\'s pose and coat, but a third to a half of its size. Sold by Amazon.ca, 4.3 stars from 42 ratings.')
cat('tabby_brown', section='Tree ornaments', name='Grey tabby cat plush, 6" tall standing (Douglas Zigby)', form_name='Grey tabby cat plush, 6"', price=25.19, ship=5.21, arrives_by='2026-11-19', match='close',
    notes='Douglas Zigby: striped grey-brown tabby with a white bib, standing. Sold by Toy-Mart & Plus, shipped by Amazon from outside Canada ("Extended delivery time: Shipped internationally"), 4.5 stars from 390 ratings, $5.21 delivery Nov 19.')
cat('golden', name='Golden retriever plush, sitting, 12" (Wild Republic Cuddlekins)', form_name='Golden retriever plush, sitting 12"',
    notes='Wild Republic Cuddlekins 12" (about 11" tall sitting). A paler, peachier gold than the board\'s honey-gold puppy, and its grey felt paw pads face forward: wire it tilted back with the hind feet tucked onto the branch so the pads face down, and drape the scarf ends over the front paws. Wired round the body to the trunk under its tartan scarf. Amazon.ca seller, 4.4 stars (47), $19.37, Nov 17-20.')
cat('golden_aurora', section='Tree ornaments', name='Golden Lab plush, sitting, 14" (Aurora)', form_name='Golden Lab plush, 14"', url=AMZ + 'B00ILYHVDQ', price=37.76,
    arrives_by='2026-11-21', match='close', size_in={'h': 13, 'w': 8, 'd': 12}, photo_file='p_B00ILYHVDQ', checked_on='2026-11-16', status='listed', store='Amazon.ca', image_checked=True,
    notes='Bigger (about 13" sitting), nearer the top of the board\'s range, but a rounder Labrador face rather than a fluffy golden retriever.')
cat('bandanas', section='Tree ornaments', name='Red tartan fringed scarf, 12 x 72" (cut lengthwise into 3" strips: fringed scarves for every plush pet)', form_name='Tartan scarf for the pet scarves')
for k in ('baubles_rgg', 'glitter_champ', 'glitter_green'): CAT[k]['section'] = 'Tree ornaments'
# The old link (B0HGKYHG7X) now opens the Black & Gold set; B0FNJXJNXQ is the same seller's Red & Gold set at the same price.
cat('baubles_rgg', name='Shatterproof baubles, red & gold (100-pc set: 32 x 2.4", 36 x 1.6", 32 x 1.2")', form_name='Shatterproof baubles, red & gold (100 pc)',
    url=AMZ + 'B0FNJXJNXQ', price=43.99, arrives_by='2026-11-20', match='close', photo_file='p_B0FNJXJNXQ', store='Amazon.ca', checked_on=CHECKED, image_checked=True,
    size_in={'d_mix': [[2.4, 32], [1.6, 36], [1.2, 32]], 'palette': ['#b8121f', '#b8121f', '#9e0f1c', '#d7a64a', '#c9a14a']},
    look='Red and gold shatterproof balls in shiny, matte and glitter, with gold caps.',
    notes='Red and gold only (the board\'s fill is mostly red and gold); the forest green comes from the two 4" green glitter packs. About a third of the set is striped, diamond-painted or tartan-painted: hang those deep in the branches or leave them out, since the board\'s balls are plain. Ships from Amazon, sold by Flag Pro LLC, 4.6 stars (26), free delivery Nov 20.')
CAT['glitter_green'].update(arrives_by='2026-11-21', match='close',
    notes='Deep forest-green 4" balls with a chunky sequin texture, a little brighter than the board\'s smooth glossy greens: hang them deeper in the branches and keep the smooth reds and golds on the outer tips. The only green in the plan, and only 9 left on Nov 16: order first. Backup: SUMPTUX 36-pc dark green set (B0FC217TG4, $30.99, Nov 20).')
cat('red4_glitter', section='Tree ornaments', name='Red sequin-glitter baubles, 4" (6-pc)', form_name='Red glitter baubles, 4" (6 pc)', url=AMZ + 'B0CSYHTT86', price=30.99,
    arrives_by='2026-11-20', match='match', size_in={'d': 3.94}, photo_file='p_B0CSYHTT86', notes='The board\'s big red glitter balls, at the board\'s scale (4" vs 3.15" before). The sequin texture is chunkier and a little brighter than the board\'s: hang them a little deeper and keep the smooth JOYIN and Benjia reds on the tips.', **AMZ_NEW)
cat('red4_joyin', section='Tree ornaments', name='Red baubles, 4": glossy, matte, glitter and mirror (JOYIN 4-pc)', form_name='Red baubles, 4" (4 pc)', url=AMZ + 'B0H33K316H', price=19.99,
    arrives_by='2026-11-21', match='match', size_in={'d': 4}, photo_file='p_B0H33K316H', notes='Plain glossy and mirror reds, like the shiny balls near the board\'s topper. Only 3.1 stars (9 ratings): inspect on arrival and keep the 30-day return; the Oairse 4" sets (4.7 stars, 166) are the fallback.', **AMZ_NEW)
cat('gold4_joyin', section='Tree ornaments', name='Gold baubles, 4": glitter, matte, glossy and mirror (JOYIN 4-pc)', form_name='Gold baubles, 4" (4 pc)', url=AMZ + 'B0H33B6VSH', price=19.99,
    arrives_by='2026-11-21', match='match', size_in={'d': 4}, photo_file='p_B0H33B6VSH', notes='Champagne-gold balls like the board\'s left side, at its scale. Only 3.1 stars (9 ratings): inspect on arrival and keep the 30-day return; the Oairse 4" sets (4.7 stars, 166) are the fallback.', **AMZ_NEW)
cat('redgold6', section='Tree ornaments', name='Red and gold painted baubles, 6" (4-pc)', form_name='Red & gold baubles, 6" (4 pc)', url=AMZ + 'B0FVFMHFR9', price=35.99,
    arrives_by='2026-11-21', match='close', size_in={'d': 6}, photo_file='p_B0FVFMHFR9', notes='The board\'s biggest size, but painted with gold swirls and diamonds; the board\'s balls are plain.', **AMZ_NEW)
cat('red6_benjia', section='Tree ornaments', name='Red baubles, 6": 2 glossy, 1 matte, 1 glitter (Benjia 4-pc)', form_name='Red baubles, 6" (4 pc)', url=AMZ + 'B0B6PKG298', price=32.99,
    arrives_by='2026-11-23', match='match', size_in={'d': 6}, photo_file='p_B0B6PKG298', notes='Plain red at the board\'s biggest size: the big red balls under the topper and beside the doghouse. Ships from Amazon (Thousea), 4.2 stars (558), free delivery Nov 22-23.', **AMZ_NEW)
cat('stockings', section='Tree ornaments')
cat('velvet_ribbon', section='Ribbon & bows', name='Dark red wired velvet ribbon, 1.5" x 25 yd (bows on the paw ornaments, the tree and the jar)', form_name='Dark red velvet ribbon, 1.5" x 25 yd',
    url=AMZ + 'B09XPW59VV', price=36.07, arrives_by='2026-11-21', match='match', size_in={'w': 1.5}, photo_file='p_B09XPW59VV', look='Deep red wired velvet, hand-tied.',
    notes='The board mixes solid deep red velvet bows with the tartan on the tree, and its paw-ornament and jar bows are the same velvet with soft loops and long tails. MEEDEE "dark red" is that colour; hand-tied, a 9" bow uses about 1 yd. Ships from and sold by Amazon US (cross-border; 4.6 stars from 1,350): check the checkout for an import-fee line.', **AMZ_NEW)
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
CAT['tartan_ribbon'].update(ship=5.45, arrives_by='2026-11-24',
    notes='4" wired tartan: the board\'s red-and-green plaid with a thin gold line. Cascades, hand-tied bows and the paw-paper gift\'s ribbon. Sold by GiftWrap Etc. and shipped by Amazon from outside Canada (4.7 stars, 146): $5.45 delivery, Nov 24. Order it first. The plan counts the $5.45 once per roll (worst case); confirm the delivery line at checkout. Fallback: MESEEY B0FFH6C6HL (brighter red and green with a gold edge, $27.71 + $5.35, Nov 24, also international).')
CAT['bone_pillow'].update(ship=6.11, price=25.91, arrives_by='2026-11-24',
    notes='Curly cream sherpa bone like the big pillow under the board\'s tree; glue on a black felt paw. Shipped by Amazon from outside Canada (import fees deposit included), $6.11 delivery Nov 24. If it slips, buy a cream bone pillow at Homes Alive Pets South Edmonton on the gift-card trip.')
CAT['paw_wrap']['ship'] = 5.75; CAT['glitter_red']['ship'] = 6.33
CAT['gift_card'].update(gst_exempt=True, arrives_by=None,   # bought in store at Homes Alive Pets South Edmonton
    name='Homes Alive Pets gift card, $100 (buy in store at South Edmonton, 5611 104 St NW)', url='https://www.homesalive.ca/locations/south-edmonton', store='Homes Alive Pets',
    look='Physical gift card from Homes Alive Pets (a western Canadian pet chain with Edmonton stores). Face value, GST-exempt.',
    notes='Buy in store at Homes Alive Pets South Edmonton (5611 104 St NW, T6H 2K1); call (780) 800-9961 first to confirm they have $100 cards or can load any amount. Gift cards are non-refundable: keep the receipt. Basket tag: "Redeem at any Homes Alive Pets store. Gift cards cannot be used online, but customer service can load this card onto your online account."')
CAT['bone_cutters'].update(section='Gift basket', price=8.00, arrives_by='2026-11-25',
    notes='Metal cutters, 2.7", 3" and 3.3" bones (soft coating). Seller-fulfilled (Kunqing1126), free delivery Nov 22-25: order today, or buy any bone cutter at Michaels or Bulk Barn in Edmonton so the biscuits can start on Nov 20 when the clay lands.')
CAT['pine_picks'].update(price=30.99, notes='Pine sprigs with pine cones and red berries. Price up from $26.99 on Nov 16.')
CAT['gold_picks'].update(price=20.80, arrives_by='2026-11-24',
    notes='Gold glitter sprays: 12 fan out behind the topper bow as a gold crown, 16 tucked through the tree. One pack of 28 covers both. Seller-fulfilled (New Romantic), free delivery Nov 19-24: order early.')
CAT['bowl'].update(name='Deep red dog bowl with a steel interior and cream paw prints, 8.5" (Loving Pets Bella Bowl, Merlot)', form_name='Red paw-print dog bowl, 8.5"',
    url=AMZ + 'B001LUN3LG', price=17.68, arrives_by='2026-11-20', match='match', size_in={'w': 8.5, 'h': 2.5}, photo_file='p_B001LUN3LG', store='Amazon.ca', checked_on=CHECKED, image_checked=True,
    look='Straight-sided deep red bowl with a stainless-steel inner bowl and cream paw prints and bones on the side.',
    notes='The board\'s bowl: straight-sided deep red with a steel interior and paw prints. The paws are cream rather than pure white, close enough; nothing to paint. Sold by Amazon.ca, 4.6 stars from 16,487, free delivery Nov 20.')
CAT['bowl'].pop('how', None)
CAT['holiday_toy'].update(name='Cream sherpa fleece bone, 9" (black felt paw added)', form_name='Cream fleece bone toy, 9"', url=AMZ + 'B000E1S8NG', price=10.49, arrives_by='2026-11-20',
    match='match', size_in={'h': 2.25, 'w': 9, 'd': 4.5}, photo_file='p_B000E1S8NG', store='Amazon.ca', checked_on=CHECKED, image_checked=True,
    look='Curly cream sherpa bone with a big black paw on its face.',
    notes='The board\'s basket toy is a curly cream sherpa bone with a big black paw. Ethical Pet\'s cream fleece bone has that texture and colour; glue a 3" black felt paw on its face. The earlier link (B0GR99NF8V) was the Gray variant, and its sibling B0GR99XYFS is listed as White. Sold by Amazon.ca, 3.8 stars from 1,437, free delivery Nov 20.',
    how='Cut one 3" paw from the black felt (template page 3) and glue it on the face of the bone with fabric glue; dry flat.')
CAT['basket'].update(arrives_by='2026-11-21', name='Natural wicker gift basket with handle, 13" x 10.5" x 6" (remove the lace liner)',
    notes='Light natural willow like the board\'s honey wicker basket. It comes with a tie-in cream eyelet liner with a lace edge: untie and remove it (or swap in an offcut of the tartan scarf) so the basket reads as bare wicker, as on the board. 11" tall to the handle.')
CAT['jar'].update(match='close', arrives_by='2026-11-20',
    notes='Clear glass jar with a glass lid, like the board\'s treat jar, but a wider barrel shape with a flat lid and a small knob where the board\'s is a straight apothecary jar with a tall knob. No treats (auction is 2027).')
CAT['blanket'].update(arrives_by='2026-11-22',
    notes='Bright red printed flannel with white paws and about as many snowflakes; the board\'s throw is a deep red chunky knit with cream paws only. Fold it so a paw-heavy section shows over the basket edge and tuck the snowflake areas under. Sold by Amazon US (cross-border), 10 ratings, Nov 22.')
CAT['glitter_champ'].update(arrives_by='2026-11-20')
CAT['rope'].update(arrives_by='2026-11-21', notes='Red, white and green braided ropes, as in the basket. Amazon-shipped (HQTD Digital), 3.8 stars from only 4 ratings, Nov 21.')
CAT['balls'].update(arrives_by='2026-11-20', notes='Red felt tennis balls with white seams, as in the basket. Sold by Amazon US (cross-border).')
CAT['bandanas'].update(notes=(CAT['bandanas'].get('notes') or '') + ' Sold by Amazon US (cross-border).')
CAT['floral_wire'].update(arrives_by='2026-11-19', notes='Green 22-gauge paddle wire, 3 spools of 118 yd. Sold by Amazon US (cross-border), 4.8 stars from 1,208, $29.19, free delivery Nov 19 (re-checked Nov 16).')
# DIY materials re-checked on Nov 16 (T6E 5G8): the craft-session dates in the committee plan follow these.
CAT['golden'].update(arrives_by='2026-11-20'); CAT['felt'].update(arrives_by='2026-11-20', checked_on=CHECKED); CAT['glitter_card'].update(arrives_by='2026-11-20')
CAT['tartan_wrap'].update(arrives_by='2026-11-20', checked_on=CHECKED); CAT['burlap_ribbon'].update(arrives_by='2026-11-20')
CAT['paw_wrap'].update(arrives_by='2026-11-20', checked_on=CHECKED, notes=(CAT['paw_wrap'].get('notes') or '') + ' Shipped internationally (Unclev): $22.71 + $5.75, Nov 20 (re-checked Nov 16). 6 sheets of 17 x 40": 2 wrap box D, 3 crumpled make the jar core, 1 spare.')
CAT['clay'].update(checked_on=CHECKED, notes='LitoJoy, Amazon-shipped, 4.8 stars (102), $22.00, Nov 20 (re-checked Nov 16). Three bags: the 8 bones at board proportions take about 940 g and the 64 biscuits about 225 g.')
CAT['stockings'].update(match='close', how='Glue a 1" black felt paw on each cream cuff with fabric glue (12 paws), so they read as pet stockings like the board\'s list.',
    notes='Cable-knit minis in red, forest green and cream with fluffy cuffs. Generic knit, so we add a small black felt paw to each cuff to make them pet stockings.')

# Faux biscuits: 2.7 x 1.08" (the smallest bone cutter), standing flat against the glass of the 7 x 9.9" jar.
JAR_D, JAR_H, BISC_L, BISC_H = 7.0, 9.9, 2.7, 1.08
BISC_RING = math.floor(math.pi * (JAR_D - 0.4) / BISC_L); BISC_RINGS = math.floor((JAR_H - 1.4) / (BISC_H + 0.12)); BISC_NEED = BISC_RING * BISC_RINGS + 12
N_BISCUITS = BISC_NEED + 3   # a few spare for breakage

# DIY rows: what we make. Their price is the cost of the materials only they use (filled in by resolve()).
def diy(id, **kw):
    kw.setdefault('section', 'Tree ornaments'); kw.update(diy=True, status='listed', image_checked=True, checked_on=CHECKED); return cat(id, **kw)
# Every DIY row carries: how (numbered steps), projects (the need keys whose materials it uses, so the committee plan and the
# lookbook can list its full materials) and tools (supply ids for bought tools, or plain text for what comes from the office).
CUTSURF = 'cut_board'
diy('topper', store='Amazon.ca', url=AMZ + 'B0DQ4BXYKZ', arrives_by='2026-11-22', match='match', size_in={'w': 22, 'ribbon': 6, 'tail': 14, 'paw': 3},
    name='Tree topper (makes 1): 22" burlap bow, two upswept loops and two 14" tails, 6" natural jute with 3" black felt paws, wired edges',
    form_name='Burlap paw-print bow topper, 22" (DIY)', photo_file='r3d_topper', projects=['topper'],
    tools=['wire_cutter', 'glue_gun', 'fabric_marker', 'ruler', CUTSURF, 'drop_sheet', 'Scissors', 'Zip ties (2, supplied with the tree)'],
    notes='The board\'s bow: natural burlap about 6" wide, two big upswept loops over shorter tails, black paws about half the ribbon\'s width. No paw-print burlap is sold at this width, so we glue on 3" felt paws; floral wire glued along the back edges lets the unwired jute hold its shape like the board.',
    how='Cut list from the 6" jute (12 yd roll): one 78" bow strip and one 8" knot piece (2.4 yd with the notches). Work on the drop sheet. '
        '(1) Edge wire: on the back face, hot-glue a 79" length of floral wire 1/4" in from each long edge, folding the last 1/2" of wire back at each end so it cannot poke out. The jute is not wired, so this is what holds the loops. '
        '(2) Paws, front face only: trace 24 paws on the black felt with the 3" template (page 3) and the white fabric marker (or tape the paper paw to the felt and cut round it). Each paw is 5 pieces: a pad and four toes. Glue 23 on the front face of the strip with fabric glue, alternating left and right of the centre line about every 3.4", none in the middle 4" where the bow is pinched; glue the 24th in the middle of the knot piece. Dry flat overnight. '
        '(3) Fray stop: the long edges are hemmed; run a thin bead of fabric glue across the cut ends of the strip and the knot piece. '
        '(4) Tie, paws facing you: leave a 14" tail, make a 10" loop to the left (about 22" of ribbon) and a 10" loop to the right, angling both loops up about 20 degrees, and pinch the centre with an 18" piece of floral wire; the second 14" tail hangs down. Fold the knot piece lengthwise in half (3" wide, paw out), wrap it round the pinch and hot-glue it at the back. V-notch both tails 1" deep and seal the notch with fabric glue. '
        '(5) Fix: zip-tie it to the top stem with two of the organizers\' zip ties and twist the 18" wire ends round the stem (two more 18" wires if it leans). Shape the loops up and round and let the tails hang about 25 degrees off vertical, like the board: about 22" across with 14" tails.')
diy('topper_4in', store='Amazon.ca', url=AMZ + 'B0CHMLF3NP', arrives_by='2026-11-20', match='close', size_in={'w': 24, 'ribbon': 4},
    name='Tree topper (makes 1): 24" four-loop bow from 4" wired burlap with black felt paws', form_name='Burlap paw bow topper, 24" (DIY)', photo_file='p_B0CHMLF3NP', projects=['topper'],
    tools=['wire_cutter', 'glue_gun', 'fabric_marker', 'Scissors', 'Zip ties (2, supplied with the tree)'],
    notes='The earlier design: four loops of 4" ribbon. Thinner and busier than the board\'s two fat loops.',
    how='(1) Cut 2.6 yd of the 4" wired burlap: one 86" bow strip and one 8" knot piece (it is wired, so no edge wire). (2) Trace 16 black felt paws with the 3" template (page 3) and the white fabric marker; glue them on the front face with fabric glue, alternating sides about every 5"; dry flat. (3) Make four 6" loops (two up, two down), pinch with an 18" floral wire, wrap the knot piece round the centre and hot-glue it at the back, leave two 16" tails, V-notch them and seal the cut ends with fabric glue. (4) Zip-tie it to the top with the organizers\' zip ties and the wire ends.')
diy('topper_printed', store='Amazon.ca', url=AMZ + 'B09H2YMHCL', arrives_by='2026-11-20', match='close', size_in={'w': 20, 'ribbon': 2.5},
    name='Tree topper (makes 1): 20" bow from ready-printed 2.5" burlap paw ribbon (brown paws)', form_name='Printed paw ribbon topper (DIY)', photo_file='p_B09H2YMHCL', projects=['topper'],
    tools=['wire_cutter', 'glue_gun', 'Scissors', 'Zip ties (2, supplied with the tree)'],
    notes='No cutting or gluing of paws, but the paws are brown and the ribbon is less than half the board\'s width.',
    how='(1) Cut 2.4 yd of the printed 2.5" ribbon (it is wired): one 80" strip and one 6" knot piece. (2) Make a four-loop bow 20" across (loops about 5"), pinch with an 18" floral wire, wrap the knot piece round it and hot-glue it at the back. (3) Leave two 14" tails, V-notch them and seal the cut ends with fabric glue. (4) Zip-tie to the top with the organizers\' zip ties and the wire ends.')
diy('streamers', section='Tree ornaments', store='Amazon.ca', url=AMZ + 'B0DQ4BXYKZ', arrives_by='2026-11-22', match=None, size_in={'l': 90, 'ribbon': 6},
    name='Topper streamers (makes 2): 90" of the topper ribbon draped down the front with poufs and felt paws', form_name='Topper streamers (DIY, extra)', photo_file='r3d_flourish_streamers', projects=['streamers'],
    tools=['wire_cutter', 'fabric_marker', 'Scissors'],
    notes='Not on the board: an extra. Cut from the same roll as the topper, so they always match the chosen bow.',
    how='(1) Cut two 90" lengths of the topper ribbon (5 yd with the gathers). V-notch one end of each and seal both cut ends with a thin bead of fabric glue. (2) Trace 24 paws with the 3" template (page 3) on the black felt with the white fabric marker and glue 12 on the front face of each streamer, about every 7"; dry flat. (3) Tuck the square end of each under the topper knot and wire it to the top stem with 6" of floral wire. (4) Drape them down the front in loose S-curves: pinch a pouf about every 14" and wire each pinch to a branch tip with 6" of floral wire (6 ties each).')
diy('crown', section='Tree ornaments', store='Amazon.ca', url=CAT['gold_picks']['url'], arrives_by=CAT['gold_picks'].get('arrives_by'), match=None, size_in={'h': 14},
    name='Gold crown (makes 1): 12 gold glitter sprays fanned behind the topper bow', form_name='Gold spray crown (DIY, extra)', photo_file='r3d_flourish_crown', projects=['crown'],
    tools=['wire_cutter'],
    notes='Not on the board: an extra. Uses a second pack of gold sprays (the first pack goes through the tree).',
    how='(1) Before the topper goes on, fan 12 gold sprays in a half-circle behind where the bow will sit, stems pushed into the top branches. (2) Wire each stem to the top stem with 6" of floral wire. (3) Fix the bow in front, then bend the sprays so they show evenly round the loops.')
diy('doghouse', store='DeSerres', url=DS + 'foam-board-white-16x20', arrives_by='2026-11-27', match='match', size_in={'h': 10, 'w': 8.5, 'd': 6},
    name='Doghouse ornaments (makes 6): 10" foam-board doghouses, dark-jointed red brick walls, cream plank roof with barge boards and ridge cap, arched door with flat cream trim and threshold, raised cream paw on the gable',
    form_name='Doghouse ornaments, 10" (DIY)', photo_file='r3d_doghouse_iso', projects=['doghouse'],
    tools=['knife', 'ruler', CUTSURF, 'glue_gun', 'brushes', 'foam_brush1', 'foam_brush2', 'sponge', 'sticks', 'wire_cutter', 'drop_sheet', 'Pencil and an empty ballpoint pen', 'Toothpicks (6)'],
    notes='Built at the board\'s scale: its doghouse is about as tall as the dog beside it (10-15"). Each weighs about 160 g (about 350 sq in of 3/16" foam board, 50 g of paint, 4 glue sticks), so it sits upright on a sturdy inner branch, wired through the floor, like the board\'s, with the gold loop as a safety tie.',
    how='Print pages 1, 2 and 8 at Actual size (check the 1" square). Cut on the flattened moving box with a fresh blade against the steel ruler; mark in pencil, never pen. Test the glue gun on an offcut first and glue onto the paper faces, not the bare foam edge (the hot gun melts the foam core). '
        '(1) Cut, per house, following the page-2 cut plan (boards 1-9 hold all six houses; board 10 is spare; measure each board first and if it is under 16" trim the difference off the roof overhang): front with the arched door (keep the door piece), back, two sides, two roofs, floor (page 2), four corner trims (page 2), and from page 8 the flat U-shaped arch trim (cut as one piece), two barge boards (flip one), the threshold and two ridge caps. Cut the 2.5" gable paw (pad + 4 toes, page 8) from the door piece. '
        '(2) Score while the template is still taped on: press the grey brick lines (page 1: courses about 0.9", bricks 1.5", staggered) and the roof board lines (page 2: every 1.25" parallel to the eave, joints every 1.5") through the paper with the empty ballpoint. Score the two plank lines on the threshold. '
        f'(3) Paint flat, before assembly: the inside faces of the walls and the undersides of both roofs burnt sienna (stops the foam board warping; dark through the door); the roof tops, trims, threshold and paw one coat of cream ({CREAM}; mix one batch for all six houses in a lidded cup and stir with a wood stick). '
        '(4) Assemble with hot glue: the walls round the floor (the floor sits inside the walls), then a toothpick across the inside of the two gable peaks with a 60 cm gold cord tied round it, the doubled loop coming out at the ridge, then the two roofs (3/4" overhang all round) either side of the cord. Poke two holes through the floor 2" apart with a toothpick. '
        f'(5) Walls: brush the outside dark brick ({DARK_BRICK}) and let it dry, then sponge-dab {BARN_RED} over the brick faces only, twice, so the scored joints stay dark like the board\'s. '
        '(6) Second cream coat on the roof, trims, threshold and paw; dry-brush a little sienna along the roof boards for grain. Paint the ridge caps barn red with a touch of sienna. '
        '(7) Trims: glue the four corner trims on the wall corners, the threshold flat at the foot of the door (back edge against the wall, top level with the floor, sticking out 3/4"), the U arch trim round the door with its legs standing on the threshold, the barge boards along the two front roof edges meeting at the peak, the ridge caps as a peak over the ridge either side of the cord, and the five paw pieces on the front gable centred 2.84" below the peak (dotted on page 1). Darken the inside of the door opening with a little Lamp Black. '
        '(8) Hang: push a 10" floral wire through each floor hole, sit the house upright on a sturdy inner branch near the trunk and twist the wires round the branch; tie the gold loop to the branch above as a safety tie. About 40 min each once cut.')
diy('doghouse_small', store='DeSerres', url=DS + 'foam-board-white-16x20', arrives_by='2026-11-27', match='close', size_in={'h': 4.3, 'w': 3.4, 'd': 2.7},
    name='Doghouse ornaments (makes 12): 4.3" foam-board doghouses', form_name='Doghouse ornaments, 4.3" (DIY)', photo_file='r3d_doghouse_iso', projects=['doghouse'],
    tools=['knife', 'ruler', CUTSURF, 'glue_gun', 'brushes', 'foam_brush1', 'sponge', 'sticks', 'wire_cutter', 'drop_sheet', 'Pencil and an empty ballpoint pen', 'Toothpicks (12)'],
    notes='Same build at the earlier size: a third of the board\'s doghouse, so it reads as filler rather than a feature. About 30 g each.',
    how='Template page 5 (Letter): front and back (door 1.5 x 1.9"), two sides, two roofs, floor, four corner trims, the flat U arch trim, two barge boards, two ridge caps and the threshold. Cut 12 sets on the flattened box and score the 0.4" brick courses printed on page 5 with the empty ballpoint. Then as the 10" house: sienna inside and under the roofs and a first cream coat while flat; glue up with a toothpick bar and a 30 cm gold loop at the peak; dark brick base, then dabbed barn red; second cream coat; trims. For the gable paw, cut a stencil of the 1" paw (page 3) from the drafting film and dab cream through it with the sponge. Hang from the gold loop and wire it to the branch with 8" of floral wire.')
HOOP_HOW = ('Per ornament (template pages 3 and 9). '
    '(1) Hoop: paint the outer ring only. Prime its outside face and front edge with gesso, then 2 coats of gold; leave the inner ring, the outer ring\'s inside face and the brass screw bare (paint there makes the clamp too tight and scuffs off). Paint one spare hoop with them. Cure 24 h. '
    '(2) Face: cut the Aida into 9 x 9" pieces (4 per sheet, 2 spare). Tea-stain them: 4 black tea bags in 1 L of just-boiled water for 10 min, soak the pieces 10 min, rinse once and dry flat under a towel (no tea: 1/4 tsp deep ochre and a drop of burnt sienna in 1 cup of water). Stain an offcut strip first and let it dry to check: it should be the board\'s warm biscuit-cream, not white. '
    '(3) Hoop it: lay a piece over the inner ring, press the outer ring down with the screw at the top, pull the edges evenly all round until drum-tight and tighten the screw. On the back trim the Aida to 1/2" outside the ring and hot-glue that margin to the inside of the inner ring. '
    '(4) Paw: cut a 3.6" paw (pad + 4 toes, page 3) from the black glitter cardstock and glue it to the centre with fabric glue. '
    '(5) Back: trace a 6" circle (page 9) on black felt with the white fabric marker, cut it out and hot-glue it to the back edge of the inner ring over the trimmed Aida, so the ornament is finished from behind. '
    '(6) Bow and hanger: tie a 9" bow from 37" of the velvet (two 4.5" loops, 8" tails, V-notched), wire it just above the screw with 8" of floral wire, and tie a 25 cm gold cord loop through the screw to hang it; twist the wire ends round the branch.')
HOOP_TOOLS = ['brushes', 'foam_brush1', 'glue_gun', 'fabric_marker', 'wire_cutter', CUTSURF, 'Scissors', 'Black tea bags, a kettle and a bowl (office kitchen)']
diy('paw_disc', store='DeSerres', url=DS + 'embroidery-hoop-round-15-2cm', arrives_by='2026-11-27', match='match', size_in={'d': 6},
    name='Paw ornaments (makes 10): 6" hoops painted gold, tea-stained Aida face, black glitter paw, felt back, dark red velvet bow',
    form_name='Paw-print hoop ornaments, 6" (DIY)', photo_file='p_hoops_ds', projects=['paw_disc'], tools=HOOP_TOOLS,
    notes='The board\'s paw ornament is a warm biscuit-cream textured disc in a gold rim with a gold cap, a black sparkly paw and a deep red velvet bow. A 6" embroidery hoop gives the gold rim, and its brass screw sits where the cap is; tea-stained Aida gives the woven texture and the warm colour.',
    how=HOOP_HOW)
diy('paw_disc_fay', store='Amazon.ca', url=AMZ + 'B088WV6BFG', arrives_by='2026-11-20', match='match', size_in={'d': 6},
    name='Paw ornaments (makes 10): Faylapa 6" bamboo hoops (16-pk) painted gold, tea-stained Aida face, black glitter paw, felt back, velvet bow', form_name='Paw-print hoop ornaments, 6" (DIY)', photo_file='p_B088WV6BFG',
    projects=['paw_disc'], tools=HOOP_TOOLS,
    notes='The same ornament with Amazon hoops: 6" bamboo with a brass screw, 16 in the pack (6 spare), $29.99 against $65.89 for eleven DeSerres hoops, and here Nov 20 instead of with the DeSerres parcel (Nov 25-27), so the hoops can be primed first. Only 3 packs were left on Nov 16 (Amazon-shipped, sold by HLSG, 4.6 stars from 42): order it first. If it sells out, choose the DeSerres-hoop option.',
    how=HOOP_HOW)
diy('paw_disc_wood', store='Amazon.ca', url=AMZ + 'B0FC6DWFVL', arrives_by='2026-11-20', match='close', size_in={'d': 4}, projects=['paw_disc'],
    tools=['brushes', 'foam_brush1', 'sponge', 'glue_gun', 'knife', CUTSURF, 'wire_cutter'],
    name='Paw ornaments (makes 30): 4" bauble-shaped wood rounds painted cream, gold rim and cap, black sparkle paw, mini velvet bow', form_name='Paw-print bauble ornaments, 4" (DIY)', photo_file=None,
    notes='The earlier design: more of them, but two-thirds of the board\'s size and a flat painted face.',
    how=f'(1) Paint both sides cream ({CREAM}) twice, the rim and cap gold. (2) Cut a stencil of the 3" paw (page 3) from the drafting film with the art knife and sponge-dab black through it; add the black sparkle medium. (3) Seal with Mod Podge. (4) Tie a 25 cm gold cord loop through the hole, hot-glue a mini bow at the cap and wire it to a branch with 6" of floral wire.')
BONE_HOW = ('Per bone (template page 4: 9" long, knob span 4.8", shaft 2.4", about 1" thick). Start the day the clay lands: only the painting waits for the DeSerres parcel. '
    '(1) Core: scrunch a 12 x 18" sheet of foil into a flat bone about 1/2" thick and 1/4" inside the page-4 outline all round, with a firm ball in each of the four knobs. Wire anchors: twist a small loop at one end of a 4" piece of floral wire and wrap its tail tightly round the foil inside each of the two upper knobs, with the loop just under the surface at the red marks. '
    '(2) Clay: on a piece of the drop sheet, lay two pencils 5" apart as 1/4" thickness guides (or two of the 6 mm wood sticks once DeSerres arrives) and press about 120 g of foam clay between them into a 1/4" sheet with a flat flap cut from the XL moving box. Wrap the core, smooth the seams with a damp finger and shape four round knobs and a flat-faced shaft against the page-4 outline. Dry 48 h, turning once. '
    f'(3) Paint: 2 coats of the biscuit mix ({BISCUIT.split(" = ")[1]}); dry-brush burnt sienna on the edges and knobs; 1 coat of Mod Podge. '
    '(4) Hang with two cords, level, like the board: drill a hole about 3/4" deep at each red mark by twisting a toothpick down to the wire anchor. Cut a 50 cm gold cord, knot each end twice, fill each hole with hot glue and push one knotted end into each, so the glue grips the anchor. The two cords rise from the upper knobs and the bone hangs level; hang it from the middle of the cord and wire the cord to the branch with 8" of floral wire.')
diy('bones', section='Tree ornaments', store='Amazon.ca', url=AMZ + 'B0F86WQG4W', arrives_by='2026-11-20', match='match', size_in={'l': 9, 'w': 4.77, 'd': 1.0},
    name='Bone ornaments (makes 8): 9" puffy biscuit bones of air-dry foam clay over a foil core, painted biscuit, sealed, hung level from two gold cords', form_name='Dog-bone ornaments, 9" (DIY)', photo_file=None,
    projects=['bones'], tools=['brushes', 'foam_brush1', 'glue_gun', 'wire_cutter', 'drop_sheet', 'Aluminum foil (about 12 ft)', 'Toothpicks (16)', 'Two pencils (thickness guides)', 'cut_board'],
    notes='The board\'s bones are about as long as the dog is tall (7-11"), chunky like a biscuit (shaft about 0.27 of the length, knob span about 0.53), and hang level from two gold cords. Each takes about 117 g of wet foam clay over a foil core and weighs about 100 g dry.',
    how=BONE_HOW)
diy('bones_small', section='Tree ornaments', store='Amazon.ca', url=AMZ + 'B0F86WQG4W', arrives_by='2026-11-20', match='close', size_in={'l': 5, 'w': 2.65, 'd': 0.75},
    name='Bone ornaments (makes 24): 5" puffy foam-clay bones', form_name='Dog-bone ornaments, 5" (DIY)', photo_file=None, projects=['bones'],
    tools=['brushes', 'foam_brush1', 'glue_gun', 'wire_cutter', 'drop_sheet', 'Aluminum foil (about 8 ft)', 'Toothpicks (48)', 'Two pencils (thickness guides)', 'cut_board'],
    notes='The earlier design: more of them, about half the board\'s size.',
    how='As the 9" bones, against the 5" outline on page 9: foil cores about 1/4" thick, about 3/4" thick finished (about 36 g of clay each), the same two wire anchors at the red marks, then paint, seal, and the gold cord glued into two drilled holes.')
diy('big_bows', section='Ribbon & bows', store='Amazon.ca', url=CAT['tartan_ribbon']['url'], arrives_by=CAT['tartan_ribbon']['arrives_by'], match='match', size_in={'w': 11, 'h': 18},
    name='Big tartan bows, 11" with 15" tails (hand-tied from the 4" tartan, one loop each side)', form_name='Big tartan bows, 11" (DIY)', projects=['big_bows'],
    tools=['wire_cutter', 'glue_gun', 'Scissors'],
    notes='Hand-tied from our own tartan, so every bow matches the cascades. One loop each side, as on the board.',
    how='Cut plan for the five 10-yd tartan rolls: roll 1 = three 118" cascades; roll 2 = two cascades, one 65" bow length and the 40" band for gift D; rolls 3-5 = five 65" bow lengths each (16 bows: 14 for the tree, 1 on top of gift D, 1 spare). '
        'Each bow: from a 65" (1.8 yd) length, cut a 6" knot piece. Leave a 15" tail, make one 5" loop to the left (about 11" of ribbon) and one to the right, pinch the centre with a 12" piece of floral wire, wrap the knot piece round the pinch and hot-glue it at the back, and leave a second 15" tail. V-notch both tails and run a thin bead of fabric glue along each notch. Twist the wire ends round a cascade pouf or a branch.')
diy('cascades', section='Ribbon & bows', store='Amazon.ca', url=CAT['tartan_ribbon']['url'], arrives_by=CAT['tartan_ribbon']['arrives_by'], match='match', size_in={'l': 118, 'ribbon': 4},
    name='Tartan ribbon cascades (makes 5): 4" tartan from under the topper to the bottom branches, with poufs', form_name='Tartan ribbon cascades (DIY)', photo_file='r3d_ribbon_full',
    projects=['cascades'], tools=['wire_cutter', 'Scissors'],
    notes='The board\'s tartan runs from the topper to the bottom branches in loose poufs, with the big bows sitting on it. Five cascades, evenly round the tree, so the back is decorated too.',
    how='(1) Cut five 118" lengths of the 4" tartan (rolls 1 and 2 of the cut plan under the big bows). V-notch one end of each and seal it with a thin bead of fabric glue. '
        '(2) Space them evenly round the tree, about 72 degrees apart. Tuck the square end under the topper bow, about 8" below the tip, and wire it to the top stem with 6" of floral wire. '
        '(3) Work down and slightly round the tree: let the ribbon lie over the branch tips for about 12", then pinch it up into a pouf about 3" proud (about 8" of ribbon) and wire the pinch to a branch with 6" of floral wire. Make 4 poufs per cascade, about 10 ties in all, and finish at the bottom branches about 12" off the floor with the notched tail hanging free. '
        '(4) Wire 2-3 of the big tartan bows onto each cascade at a pouf, as on the board.')
diy('velvet_tree_bows', section='Ribbon & bows', store='Amazon.ca', url=CAT['velvet_ribbon']['url'], arrives_by='2026-11-21', match='match', size_in={'w': 9, 'h': 12, 'ribbon': 1.5},
    name='Velvet bows for the tree, 9" with 8" tails (hand-tied from the 1.5" dark red velvet)', form_name='Velvet tree bows, 9" (DIY)', photo_file='p_B09XPW59VV',
    projects=['velvet_tree_bows'], tools=['wire_cutter', 'Scissors'],
    notes='The board mixes solid deep red velvet bows with the tartan ones on the tree. Tied from the velvet roll we already buy, so they cost nothing extra.',
    how='Each bow: 37" of the 1.5" velvet: two 4.5" loops and 8" tails with V-notches, pinched with a 12" floral wire (as the paw-ornament bows). Wire them between the tartan bows, mostly on the right side and lower half like the board.')
diy('gift_boxes', section='Under-tree display', store='Canadian Tire', url=CT + 'canadian-tire-small-moving-storage-box-100-recycled-cardboard-18-x-11-x-12-in-0676043p.html', arrives_by='2026-11-17', match='match',
    name='Wrapped gifts (makes 4): moving boxes in tartan and kraft paw paper, cream burlap ribbon and bows, a tartan band and bow on the kraft box', form_name='Wrapped display gifts (DIY)',
    projects=['gift_boxes'], tools=['knife', 'ruler', CUTSURF, 'glue_gun', 'wire_cutter', 'Scissors', 'Pencil'],
    notes='Like the board: tartan boxes tied with cream ribbon and cream bows, and a kraft paw-print box with a tartan band and bow and a cream band with its own bow. Four bought boxes of known size, so paper and ribbon are calculated.',
    how='Boxes: A = small (18 x 11 x 12") as is, B = medium (16") as is, C = medium cut to 10" tall, D = small cut to 7" tall. '
        '(1) Fold and packing-tape the top flaps of all four shut. For C and D, mark the new height up from the open bottom on each corner, rule a pencil line round the box and cut the walls down along it with the art knife against the ruler, on the cutting box. The open bottom sits on the floor, hidden. '
        '(2) Tartan paper on A, B and C: cut two lengths of the box\'s girth (A 48", B 66", C 54") from the 17" roll and Magic-Tape them edge to edge on the back (1/2" overlap). Wrap so this join runs round the middle of the box, where the cream ribbon will cover it, with the girth overlap underneath; fold the ends like a parcel and tape (B\'s ends overlap only about 3/4": tape them well). '
        '(3) Kraft paw paper on D: two 17 x 40" sheets taped side by side, wrapped the same way with the join under the tartan band. '
        '(4) Ribbon: 1.5" cream burlap both ways round A, B and C, crossing on top over the paper join, ends taped underneath. On D, a 40" tartan band round the girth over the join and a 62" cream burlap band round the four sides, ends taped at the back. '
        '(5) Bows: tie a 10" cream burlap bow (40": two 5" loops, 6" tails, V-notched, pinched with 6" of floral wire) for each box and hot-glue it at the ribbon crossing (on D, on the front of the cream band). Tie one big tartan bow (as the tree bows) and hot-glue it on top of D at the tartan band.')
diy('faux_treats', section='Gift basket', match='match', name=f'Faux dog biscuits (makes {N_BISCUITS}): foam clay cut with the 2.7" bone cutter, painted tan, sealed; set ring by ring against the glass of the jar', form_name='Faux dog biscuits (DIY)',
    size_in={'w': 2.7, 'h': 1.08, 'd': 0.25}, arrives_by='2026-11-25', store='Amazon.ca', url=AMZ + 'B08GJDGNRC', projects=['faux_treats', 'jar'],
    tools=['brushes', 'glue_gun', 'drop_sheet', 'The 2.7" bone cutter (on the list)', 'Toothpicks (3)', 'sticks', 'A foam-board offcut (on the list) to press the clay'],
    notes=f'The board\'s biscuits are small and tan in a 7" jar, so we cut them with the smallest bone cutter (2.7"), not the 3". {BISC_RING} per ring x {BISC_RINGS} rings line the glass, plus 12 on top: {BISC_NEED}; we make {N_BISCUITS}. Inedible, so they last until the 2027 auction.',
    how=f'(1) Biscuits: on a piece of the drop sheet, press foam clay into a 1/4" sheet between two 6 mm wood sticks with a foam-board offcut, cut {N_BISCUITS} bones with the 2.7" cutter (no cutter yet? trace the 3" outline on page 4 and cut with the knife), poke 3 dots in each with a toothpick and dry 24 h flat, turning once. Paint 2 coats of the tan mix ({TAN.split(" = ")[1]}), then 1 coat of Mod Podge. '
        f'(2) Jar, ring by ring: stand {BISC_RING} biscuits flat against the glass (long side level, face out), stuff crumpled kraft paw paper (3 spare sheets, brown side out) behind them until they press on the glass, and repeat for {BISC_RINGS} rings up to the shoulder; pile the last 12 on top. Nudge them into place through the mouth with a wood stick. '
        '(3) Wrap a 22" velvet band round the shoulder and hot-glue it at the back, tie a bow over the seam (44": two 5" loops, 9" tails), and fix the lid with 3 dots of hot glue (peels off later).')
diy('doghouse_xl', section='Under-tree display', store='Canadian Tire', url=CT + 'canadian-tire-extra-large-moving-box-100-recycled-cardboard-24-x-20-x-20-in-0676076p.html', arrives_by='2026-11-17', match=None,
    name='Giant doghouse (makes 1): 24 x 20 x 26" from two moving boxes, red brick walls, cream shingle roof, "Home for the Howlidays" sign', form_name='Giant doghouse centrepiece (DIY)', projects=['doghouse_xl'],
    tools=['knife', 'ruler', CUTSURF, 'glue_gun', 'foam_brush2', 'sponge', 'brushes', 'Pencil'],
    notes='Not on the board: an extra we can add for impact. The plush pair sits in the doorway.')
CAT['doghouse_xl']['how'] = ('(1) Box A: cut all four walls down to 16" with the art knife against the ruler, keeping the bottom flaps taped as the floor. Cut the 10 x 13" arched door in a 24" side (true-size door on template page 6, cut plan on page 7). '
    '(2) Box B: cut two 24 x 10" gable triangles from its long flaps and glue them on top of the front and back walls; cut two 17.6 x 24" roof panels from its 24 x 20" sides. Packing-tape every inside seam. '
    '(3) Score brick lines on all walls with the empty ballpoint (courses about 2", bricks 4"). Gesso the outside twice, tinted grey with a drop of black, dab red bricks with the sponge, and paint the inside dark red-brown. '
    f'(4) Glue the roof on, then cover it with 3" strips cut from box B\'s spare sides and the gable offcuts, overlapping 1" per course, and paint them cream ({CREAM}). '
    '(5) Glue a cream trim strip round the door and stencil a 3.6" cream paw on the gable (a drafting-film stencil cut from page 3). '
    '(6) Mod Podge the printed 16 x 4" sign (HP26_Doghouse_Sign_11x17.pdf) centred on the front with its top edge 18.5" above the floor, so its corners clear the roof. About 4 hours over two sessions.')
CAT['felt']['how'] = 'One pack of 8 x 12" black felt covers every felt paw: 24 x 3" for the topper, 1 x 3" for the basket bone toy, 12 x 1" for the stocking cuffs and 1 x 4.5" for the bone pillow (all on template page 3). Trace with the white fabric marker; the hoop-ornament back circles use the DeSerres 9 x 12" sheets.'
# Bought pieces we finish ourselves: their steps print with the DIY build sheets.
CAT['bandanas'].update(name='Red tartan fringed scarf, 12 x 66" (cut lengthwise into 3" strips: fringed scarves for 3 dogs and 3 cats)', arrives_by='2026-11-19', projects=['pet_scarves'],
    tools=['Scissors', 'Pencil', 'Toothpicks (2)'],
    notes='Woven viscose/wool tartan, fringed on both short ends; the listing\'s body is 66" x 12" (167.6 x 30.5 cm), plus fringe. Six pets wear one: 3 goldens (2 on the tree, 1 under it) and 3 Miyoni tabbies (2 on the tree, 1 under it). Ships from and sold by Amazon US (cross-border), $35.28, free delivery Nov 19.',
    how='(1) Lay the scarf flat and cut it lengthwise into four 3"-wide strips with sharp scissors, following a straight line of the tartan pattern (mark it in pencil if the pattern does not fall at 3"). '
        '(2) From each of strips 1-3, cut a 36" dog scarf from one fringed end and a 22" cat scarf from the other fringed end (8" left over); strip 4 is spare. '
        '(3) On each bare cut end, pull out the cross threads for 1.25" with a toothpick so it gets the same fringe as the factory end. Run a thin bead of fabric glue across the scarf just above each new fringe and along both long cut edges; dry 24 h. '
        '(4) Tie once round the neck at the side with both fringed ends hanging in front, over the wire.')
CAT['golden'].update(projects=['plush_dogs', 'pair'], tools=['wire_cutter', 'Zip ties (supplied with the tree)'],
    how='Each dog (about 100 g): fold a 72" floral wire in half, wrap the doubled wire round the belly under the scarf and twist both ends round a main branch near the trunk; add one of the organizers\' zip ties round the body and branch, since the tree is moved several times. Sit it tilted back with the hind feet tucked onto the branch so the grey pads face down, and drape the scarf ends over the front paws. Under the tree, the dog and the cat sit side by side by the basket, wired to each other and to the basket handle with two 18" floral wires hidden under the scarves.')
CAT['cat_miyoni'].update(projects=['plush_cats', 'pair'], tools=['wire_cutter', 'Scissors'],
    how='Each cat (about 136 g): snip off the gold Miyoni tag. Fold a 48" floral wire in half, wrap the doubled wire round the body behind the front legs, under the scarf, and twist both ends round a sturdy branch so the cat lies along it, face out. Under the tree it sits beside the dog (see the golden retriever).')
CAT['holiday_toy'].update(projects=['holiday_toy'], tools=['fabric_marker', 'glue_gun', 'Scissors'],
    how='Trace one 3" paw (template page 3) on the black felt with the white fabric marker and cut it out (pad + 4 toes). Part the sherpa pile, put a dot of hot glue under the pad and each toe and press 30 s, then run a thin bead of fabric glue round the edges; dry flat. Wire it into the basket with 12" of floral wire.')
CAT['bone_pillow'].update(projects=['bone_pillow'], tools=['fabric_marker', 'glue_gun', 'Scissors'],
    how='It arrives vacuum-packed: unroll it 2-3 days before decorating so it fluffs up. Trace the 4.5" paw (template page 3) on the black felt with the white fabric marker and cut it out. Part the curly pile, put a dot of hot glue under the pad and each toe and press 30 s, then run a thin bead of fabric glue round the edges; dry flat.')
CAT['stockings'].update(projects=['stockings'], tools=['fabric_marker', 'glue_gun', 'wire_cutter', 'Scissors'],
    how='Trace 12 paws with the 1" template (page 3) on the black felt with the white fabric marker and cut them out. Glue one on each cream cuff: a dot of hot glue under the pad and toes, a bead of fabric glue round the edges. Wire each stocking to a branch through its loop with 6" of floral wire.')
CAT['basket'].update(projects=['basket'], tools=['wire_cutter'],
    how='Untie and remove the lace liner. Wire the jar (to the handle), the bone toy, the rope and the ball in with 12" floral wires through the wicker. Twist a 12" floral wire into a flat spiral card holder, push its stem into the wicker at the front and slip a gift card in so its face shows (the second card behind it), as on the board. Fold the throw paw-side out over the front edge and wire it at two corners.')
CAT['gold_picks'].update(notes='Gold glitter sprays: the pack of 28 goes through the tree (greens, full); the gold crown option adds a second pack for its 12 sprays. Seller-fulfilled (New Romantic), free delivery Nov 19-24: order early.')
for k in ('craft_supplies', 'ct_supplies', 'shipping'): cat(k)
CAT['craft_supplies'].update(arrives_by='2026-11-27',
    notes='Every quantity calculated from the builds (see output/item_audit.md). Over $149, so standard shipping to Alberta is free. On Nov 16 every line in the default order showed "Ships in 48 hours" once the slow lines were swapped (Student burnt sienna 250 ml and 18-count Aida instead of the 3-5 day Basics sienna and 14-count Aida; no paint marker or kraft paper from DeSerres). Order today as ONE shipment (two shipments costs $24.99). Canada Post from Quebec: expect Nov 25-27. DeSerres shows "In stock" even on backorder, so read the confirmation email; if it has not shipped by Nov 19, buy hoops, acrylics and foam brushes at Michaels Edmonton instead.')
CAT['ct_supplies'].update(notes='Pick up at Canadian Tire Edmonton South (2110 101 St NW) with the moving boxes. Scotch Magic Tape is $4.99 on sale until Nov 18 ($7.49 after); the plan counts $7.49.')
CAT['topper']['notes'] += ' Vendor: the 6" jute (B0DQ4BXYKZ) is sold by xingwanworks (18 ratings) and shipped by Amazon from outside Canada, $6.43, Nov 22; the 4" wired burlap (B0CHMLF3NP, Nov 20) is the fallback. The jute is not wired, so the glued edge wire is essential.'
CAT['shipping'].update(status='est', image_checked=False, match=None, section='Shipping & fees')

# ---------------- supplies ----------------
# carrier = the DIY rows that carry its cost. Amazon supplies with no carrier become their own row;
# DeSerres and Canadian Tire ones are grouped into one row per store.
def S(name, store, url, price, per, unit, carrier=None, ship=0, row=False): return dict(name=name, store=store, url=url, price=price, per=per, unit=unit, carrier=carrier, ship=ship, row=row, counted=unit in COUNTED)
SUP = {
 'foam_board': S('Foam board, white 3/16", 16 x 20"', 'DeSerres', DS + 'foam-board-white-16x20', 5.99, 320, 'in2', ['doghouse', 'doghouse_small']),
 'hoops_ds': S('Embroidery hoop, round, 15.2 cm (6")', 'DeSerres', DS + 'embroidery-hoop-round-15-2cm', 5.99, 1, 'hoops', ['paw_disc']),
 'aida': S('Aida fabric 14ct, white, 50 x 60 cm (19.7 x 23.6": four 9 x 9" pieces per sheet; tea-stained to the board\'s warm cream; ships in 48 h)', 'DeSerres', DS + 'aida-fabric-white-500x600mm', 14.99, 4, 'pc', ['paw_disc', 'paw_disc_fay']),
 'gesso': S('White gesso 948 ml (primer; the white in the cream, biscuit and tan mixes)', 'DeSerres', DS + 'white-gesso-948ml', 19.99, 948, 'ml'),
 'red1': S('Student acrylic Naphthol Red 250 ml', 'DeSerres', DS + 'student-acrylic-naphthol-red-250ml', 12.99, 250, 'ml'),
 'red2': S('Student acrylic Crimson 250 ml (1:1 with Naphthol Red = barn red)', 'DeSerres', DS + 'student-acrylic-crimson-250ml', 12.99, 250, 'ml'),
 'sienna': S('Student acrylic Burnt Sienna 250 ml (ships in 48 h)', 'DeSerres', DS + 'student-acrylic-burnt-sienna-250ml', 12.99, 250, 'ml'),
 'ochre': S('Americana acrylic Deep Ochre 59 ml (tints gesso to cream, biscuit and tan)', 'DeSerres', DS + 'americana-acrylic-deep-ochre-59ml', 2.99, 59, 'ml'),
 'black': S('Americana acrylic Lamp Black 60 ml', 'DeSerres', DS + 'americana-acrylic-lamp-black-60ml', 2.99, 60, 'ml'),
 'gold': S('Americana Dazzling Metallics Glorious Gold 60 ml', 'DeSerres', DS + 'americana-acrylic-dazzling-metallics-glorious-gold-60ml', 3.99, 60, 'ml'),
 'sparkle': S('Pearl medium, fine, black (sparkle on painted paws)', 'DeSerres', DS + 'pearl-medium-fine-black', 9.99, None, 'jar'),
 'podge': S('Mod Podge Matte 236 ml (sealer and sign glue)', 'DeSerres', DS + 'mod-podge-matte-236ml', 9.99, 236, 'ml'),
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
 'fabric_glue': S('Permanent fabric glue 118 ml (felt and glitter paws, scarf edges)', 'DeSerres', DS + 'permanent-fabric-glue-118ml', 6.99, 118, 'ml'),
 'wire_cutter': S('Wire cutter (every floral-wire cut: about 400)', 'DeSerres', DS + 'wire-cutter', 12.99, 1, 'tool'),
 'fabric_marker': S('Erasable fabric marker, white (traces paws and circles on black felt)', 'DeSerres', DS + 'eraseable-fabric-marker-white', 3.99, 1, 'pen'),
 'felt_ds': S('Felt sheet, black, 9 x 12" (backs for the paw ornaments: two 6" circles per sheet)', 'DeSerres', DS + 'felt-black-9x12in', 0.99, 1, 'sheet'),
 'sticks': S('Round wood sticks 6 mm x 15 cm, 30 pc (1/4" clay thickness guides, paint stirrers)', 'DeSerres', DS + '30-round-wood-sticks-6mm-15cm', 5.99, 30, 'pc'),
 'box_small': S('Small moving box 18 x 11 x 12"', 'Canadian Tire', CT + 'canadian-tire-small-moving-storage-box-100-recycled-cardboard-18-x-11-x-12-in-0676043p.html', 1.75, 1, 'box', ['gift_boxes']),
 'box_medium': S('Medium moving box 16 x 16 x 16"', 'Canadian Tire', CT + 'canadian-tire-medium-moving-storage-box-100-recycled-cardboard-16-x-16-x-16-in-0676172p.html', 2.65, 1, 'box', ['gift_boxes']),
 'box_xl': S('Extra-large moving box 24 x 20 x 20"', 'Canadian Tire', CT + 'canadian-tire-extra-large-moving-box-100-recycled-cardboard-24-x-20-x-20-in-0676076p.html', 4.99, 1, 'box', ['doghouse_xl']),
 'cut_board': S('Extra-large moving box 24 x 20 x 20", flattened (the cutting surface under every knife cut)', 'Canadian Tire', CT + 'canadian-tire-extra-large-moving-box-100-recycled-cardboard-24-x-20-x-20-in-0676076p.html', 4.99, 1, 'box'),
 'packing_tape': S('Box sealing tape, clear, 48 mm x 50 m', 'Canadian Tire', CT + 'tempest-box-sealing-tape-clear-48mm-x-50m-4992262p.html', 3.99, 50, 'm'),
 'magic_tape': S('Scotch Magic Tape 19 mm x 10 m, 3-pk (gift wrapping)', 'Canadian Tire', CT + 'scotch-magic-tape-in-dispenser-invisible-matte-finish-19-mm-x-10-m-3-pk-0670361p.html', 7.49, 30, 'm'),   # $4.99 sale ends Nov 18
 'drop_sheet': S('Plastic drop sheet 8 x 12 ft (painting in the office)', 'Canadian Tire', CT + 'bennett-light-weight-plastic-drop-sheets-8-ft-x-12-ft-0494804p.html', 4.99, 1, 'sheet'),
 'burlap6': S('Natural jute burlap ribbon 6" x 12 yd, hemmed', 'Amazon.ca', AMZ + 'B0DQ4BXYKZ', 25.14, 12, 'yd', ['topper'], ship=6.43),
 'burlap4': S('Natural burlap wired ribbon 4" x 10 yd', 'Amazon.ca', AMZ + 'B0CHMLF3NP', 16.80, 10, 'yd', ['topper_4in']),
 'paw25': S('Burlap ribbon with brown paws, 2.5" x 10 yd', 'Amazon.ca', AMZ + 'B09H2YMHCL', 20.56, 10, 'yd', ['topper_printed']),
 'hoops_fay': S('Faylapa 6" bamboo embroidery hoops, 16-pk', 'Amazon.ca', AMZ + 'B088WV6BFG', 29.99, 16, 'hoops', ['paw_disc_fay']),
 'wood_rounds': S('4" bauble-shaped wood rounds, 50 pc', 'Amazon.ca', AMZ + 'B0FC6DWFVL', 13.90, 50, 'pc', ['paw_disc_wood']),
 'clay': S('White air-dry foam clay 500 g', 'Amazon.ca', AMZ + 'B0F86WQG4W', 22.00, 500, 'g', row=True),
 'tartan_ribbon': S('Tartan wired ribbon 4" x 10 yd', 'Amazon.ca', AMZ + 'B0D7WPZDJW', 33.76, 10, 'yd', row=True),
 'velvet_ribbon': S('Dark red wired velvet ribbon 1.5" x 25 yd', 'Amazon.ca', AMZ + 'B09XPW59VV', 36.07, 25, 'yd', row=True),
 'burlap_ribbon': S('Natural burlap wired ribbon 1.5" x 20 yd', 'Amazon.ca', AMZ + 'B09MVX5VRK', 18.39, 20, 'yd', row=True),
 'glitter_card': S('Black glitter cardstock 12 x 12", 10 sheets', 'Amazon.ca', AMZ + 'B0BKWY2ZMT', 14.88, 10, 'sheets', row=True),
 'tartan_wrap': S('Red tartan wrapping paper 17" x 33 ft', 'Amazon.ca', AMZ + 'B0F9P8CHMT', 19.79, 396, 'in', row=True),
 'paw_wrap': S('Kraft paw wrapping paper, 6 sheets 17 x 40"', 'Amazon.ca', AMZ + 'B0FSXRGDGM', 22.71, 6, 'sheets', row=True),
 'mini_bows': S('Mini red velvet bows 3.5", 12-pk', 'Amazon.ca', CAT['mini_bows']['url'], 15.41, 12, 'bows', row=True),
 'floral_wire': S('Green floral wire 22 gauge, 3 x 118 yd', 'Amazon.ca', CAT['floral_wire']['url'], 29.19, 354, 'yd', row=True),
 'felt': S('Black felt 8 x 12", 7 sheets', 'Amazon.ca', AMZ + 'B0DX78HCZC', 8.50, 7, 'sheets', row=True),
}
# Tools: a supply id names a tool we buy; anything else comes from the office (the ON_HAND list) or the organizers.
for it in CAT.values():
    if it.get('tools'): it['tools'] = [t if t in SUP or '(office' in t or 'organizers' in t or 'supplied' in t or 'on the list' in t else t + ' (office)' for t in it['tools']]
for k in ('clay', 'tartan_ribbon', 'velvet_ribbon', 'burlap_ribbon', 'glitter_card', 'tartan_wrap', 'paw_wrap', 'mini_bows', 'floral_wire', 'felt'):
    CAT[k].update(price=SUP[k]['price'], url=SUP[k]['url'])
ON_HAND = ['Scissors (3 pairs; never on wire: the wire cutter is on the DeSerres list)',
           'Pencils (mark every cut line in pencil, never pen: ink bleeds through paint) and one empty ballpoint pen (scores the brick and roof lines with no ink)',
           'Aluminum foil, about 15 ft (cores for the 8 clay bones)', 'Toothpicks, about 50 (doghouse hanger bars, biscuit dots, drilling the bone holes, pulling scarf fringe)',
           'Paper towels, water cups, paper plates for palettes, a lidded cup or jar for the cream mix', 'Office colour printer: templates on Letter and 11x17',
           'Black tea bags (4), a kettle and a bowl from the office kitchen (tea-stains the Aida; no tea? use the ochre wash in the steps)', 'Garbage bags for clean-up', 'Optional: a second 7 mm hot glue gun from home (one is bought; a second speeds up Session 2)']

# ---------------- project geometry -> needs ----------------
class Needs(list):
    def __call__(self, sup, project, amount, how=''): self.append([sup, project, round(amount, 3), how]); return self

# Doghouse trims from the template (SP templates_parts.md, pages 2, 5 and 8), sq in per house:
#   10": corner trims 4 x 0.5 x 5.5 = 11.0, flat U arch trim 4.8 x 4.91 bounding box = 23.6 (the centre is the door, waste),
#        barge boards 2 x 0.6 x 6.586 = 7.9, threshold 4.8 x 0.75 = 3.6, ridge caps 2 x 0.5 x 7.5 = 7.5 -> 53.6.
#        The raised 2.5" gable paw is cut from the door piece, so it needs no extra board.
#   4.3": corner 2.1 + U 3.75 + barge 1.6 + ridge 1.7 + threshold 0.8 = 9.95.
# Cream parts (painted 2 coats): corner 11.0 + U 5.9 (net) + barge 7.6 + threshold 3.6 + paw 3.1 = 31.2 sq in, +30% for edges.
DH_TRIM = {True: 53.6, False: 9.95}; DH_CREAM = {True: 31.2 * 1.3, False: 6.0 * 1.3}; DH_RIDGE = {True: 7.5, False: 1.7}
CUT_PLAN_BOARDS = 9     # page-2 cut plan: all parts of six 10" houses on boards 1-9 (board 10 is the spare)
def doghouses(n, W, D, WALL, RIDGE, paw, key):
    N = Needs(); big = W > 5; over = 0.75 if big else 0.35
    gable = W * WALL + 0.5 * W * (RIDGE - WALL); slope = math.hypot(W / 2, RIDGE - WALL) + over
    parts = 2 * W * RIDGE + 2 * (D - 0.375) * WALL + 2 * slope * (D + 2 * over) + (W - 0.375) * (D - 0.375) + DH_TRIM[big]
    pack = 6 * parts / (CUT_PLAN_BOARDS * 320) if big else 0.8      # packing proven by the printed cut plan (0.88); small houses 80%
    walls = 2 * gable + 2 * D * WALL; roof = 2 * slope * (D + 2 * over)
    N('foam_board', key, n * parts / pack, f'{n} sets x {parts:.0f} sq in of parts incl. arch U, barge boards, threshold and ridge caps / {pack:.0%} packing' + (' (page-2 cut plan: 9 boards for 6 houses, 1 spare)' if big else ''))
    N('sienna', key, ML_PER_FT2 * ft2(n * walls), f'inside faces, 1 coat before assembly ({n} x {walls:.0f} sq in): stops warping, dark through the door')
    N('sienna', key, ML_PER_FT2 * ft2(n * roof), f'roof undersides, 1 coat before assembly ({n} x {roof:.0f} sq in): stops the overhangs cupping')
    N('gesso', key, ML_PER_FT2 * ft2(n * roof) * 2, f'{CREAM.split(" = ")[0]} roof tops, 2 coats on {n} x {roof:.0f} sq in')
    N('gesso', key, ML_PER_FT2 * ft2(n * DH_CREAM[big]) * 2, f'cream trims, threshold and gable paw, 2 coats ({DH_CREAM[big]:.0f} sq in each incl. edges)')
    cream = ML_PER_FT2 * ft2(n * (roof + DH_CREAM[big])) * 2
    N('ochre', key, cream / 24, 'cream tint, 1 tsp per 1/2 cup of gesso'); N('sienna', key, cream / 100 + n * 0.5, 'a dab in the cream + dry-brushed roof grain')
    N('red2', key, ML_PER_FT2 * ft2(n * walls) * 10 / 11, f'dark brick base coat on {n} x {walls:.0f} sq in (Crimson 10 : black 1): the scored joints stay dark like the board\'s')
    N('black', key, ML_PER_FT2 * ft2(n * walls) / 11, 'dark brick base coat (1 part in 11)')
    N('red1', key, DAB_ML_PER_FT2 * ft2(n * walls), 'barn red dabbed on the brick faces, 2 coats (half from each red)'); N('red2', key, DAB_ML_PER_FT2 * ft2(n * walls), 'barn red (other half)')
    N('red2', key, ML_PER_FT2 * ft2(n * DH_RIDGE[big]) * 2 + n * 0.3, 'ridge caps, barn red + a touch of sienna'); N('black', key, n * 0.6, 'darkens the door opening')
    N('glue_sticks', key, n * (4 if big else 2), 'walls, roof, trims and paw')
    N('gold_cord', key, n * (0.6 if big else 0.3), f'{n} safety loops x {60 if big else 30} cm' + (' (doubled) round a toothpick bar across the gable peaks' if big else ''))
    N('floral_wire', key, n * (20 if big else 8) / 36, f'{n} x 2 x 10" through the floor onto a sturdy branch (about 160 g each)' if big else f'{n} x 8"')
    if not big: N('film', key, 1, f'{paw}" gable paw stencil')
    return N

def bone_clay(L, T):
    """Foam clay (g) for one bone: the page-4 outline x thickness, rounded, less the scrunched-foil core (outline inset by the shell)."""
    A, P, s = BONE_A1 * L * L, BONE_P1 * L, BONE_SHELL
    core = (A - P * s + math.pi * s * s) * max(T - 2 * s, 0)
    return (A * T - core) * BONE_ROUND * IN3_CM3 * CLAY_G_PER_CM3, A, P
def bones(n, L, key, T=1.0):
    g, A, P = bone_clay(L, T); area = 2 * A + P * T
    N = Needs()
    N('clay', key, n * g, f'{n} bones x {g:.0f} g: page-4 outline {A:.1f} sq in x {T:g}" x {BONE_ROUND:.0%} (rounded) less the foil core, {CLAY_G_PER_CM3} g/cm3')
    N('gesso', key, ML_PER_FT2 * ft2(n * area) * 2, f'{BISCUIT.split(" = ")[0]}, 2 coats on {n} x {area:.0f} sq in'); N('ochre', key, ML_PER_FT2 * ft2(n * area) * 2 / 12, 'biscuit tint (2 tsp per 1/2 cup)')
    N('sienna', key, ML_PER_FT2 * ft2(n * area) * 2 / 24 + 0.5 * n, 'biscuit tint + dry-brushed edges')
    N('podge', key, PODGE_ML_PER_FT2 * ft2(n * area), 'seal'); N('gold_cord', key, n * 0.5, f'{n} two-cord hangers x 50 cm, both ends glued into the upper knobs')
    N('floral_wire', key, n * 2 * 4 / 36, 'two 4" wire anchors per bone, round the foil in the upper knobs'); N('floral_wire', key, n * 8 / 36, 'cord to the branch, 8" each')
    N('glue_sticks', key, n / 2, 'fills the two cord holes')
    return N

def hoop_paws(n, hoops, key, spare=1):
    N = Needs(); ring = math.pi * 6.4 * (0.6 + 0.35)   # outer ring only: outside face + front edge
    N(hoops, key, n + spare, f'{n} hoops + {spare} spare (a cracked ring would leave the tree a paw short)')
    N('aida', key, n, f'{n} pieces 9 x 9" (a 6" hoop needs about 8" to grip and trim; 4 per 50 x 60 cm sheet)')
    N('gesso', key, ML_PER_FT2 * ft2((n + 1) * ring), f'primer on the outer ring only ({ring:.0f} sq in), {n} + the spare')
    N('gold', key, ML_PER_FT2 * ft2((n + 1) * ring) * 2, 'outer ring outside face and front edge only, 2 coats over the gesso')
    N('glitter_card', key, n / 9, f'{n} paws of 3.6", 9 per 12 x 12" sheet'); N('fabric_glue', key, n * 1, 'glue the paws on')
    N('felt_ds', key, math.ceil(n / 2) + 1, f'{n} back circles of 6" (2 per 9 x 12" sheet) + 1 spare sheet'); N('glue_sticks', key, n, 'back circle on the inner ring')
    N('velvet_ribbon', key, n * 37 / 36, f'{n} bows x 37" (two 4.5" loops, 8" tails, knot)'); N('glue_sticks', key, n, 'Aida margin inside the ring')
    N('gold_cord', key, n * 0.25, f'{n} loops x 25 cm'); N('floral_wire', key, n * 8 / 36, '8" each (bow + branch)')
    return N

TOPPER_PAW = 3.0        # felt paw size on the topper (about half the 6" ribbon, as on the board)
def felt_paws(k, size=TOPPER_PAW): return k * (size + 0.2) ** 2 / 0.75 / 96   # 8 x 12" sheets, squares 0.2" bigger than the paw, 75% usable
def topper(ribbon_sup, yd, paws, key, edge_wire=True, strip=0):
    N = Needs()
    N(ribbon_sup, key, yd, f'bow strip, knot piece and V-notches ({yd * 36:.0f}")')
    if paws: N('felt', key, felt_paws(paws), f'{paws} paws of {TOPPER_PAW:g}" (front face only)'); N('fabric_glue', key, paws * 0.5, 'felt paws')
    N('fabric_glue', key, 1.5, 'fray stop on the cut ends')
    if edge_wire: N('floral_wire', key, 2 * (strip + 1) / 36, f'edge wire: two {strip + 1:.0f}" lengths along the back (the jute is not wired)'); N('glue_sticks', key, 5, 'edge wire')
    N('floral_wire', key, (18 + 2 * 18) / 36, '18" to pinch the centre + 2 x 18" to the top stem'); N('glue_sticks', key, 1, 'knot')
    return N

BOXES = [('A', 18, 11, 12, 'tartan', 'burlap'), ('B', 16, 16, 16, 'tartan', 'burlap'), ('C', 16, 16, 10, 'tartan', 'burlap'), ('D', 18, 11, 7, 'paw', 'tartan')]
BIG_BOW_YD = 1.8        # 65": 15" tail + 11" loop + 11" loop + 15" tail + 6" knot + pinches and notches
CASCADE_IN = 118        # 82" down the tree + 4 poufs x 8" + 4" tucked under the topper
def gifts():
    N = Needs(); N('box_small', 'gift_boxes', 2, 'A (18x11x12) and D (cut down to 7" tall)'); N('box_medium', 'gift_boxes', 2, 'B (16x16x16) and C (cut down to 10")')
    for name, l, w, h, paper, rib in BOXES:
        girth = 2 * (w + h) + 2; width = l + h + 2
        if paper == 'tartan': N('tartan_wrap', 'gift_boxes', girth * math.ceil(width / 17), f'box {name}: {math.ceil(width / 17)} lengths of {girth}" taped edge to edge (paper is 17" wide)')
        else: N('paw_wrap', 'gift_boxes', math.ceil(girth / 40) * math.ceil(width / 17), f'box {name}: {math.ceil(width / 17)} sheets side by side (girth {girth}" fits a 40" sheet)')
        if rib == 'burlap': N('burlap_ribbon', 'gift_boxes', (2 * (l + h) + 2 * (w + h) + 8 + 40) / 36, f'box {name}: both ways + a 10" bow (40")')
        else:
            N('tartan_ribbon', 'gift_boxes', (2 * (w + h) + 4) / 36, f'box {name}: tartan band round the girth, over the paper join')
            N('tartan_ribbon', 'gift_boxes', BIG_BOW_YD, f'box {name}: big tartan bow on top')
            N('burlap_ribbon', 'gift_boxes', (2 * (l + w) + 4) / 36, f'box {name}: cream band round the sides'); N('burlap_ribbon', 'gift_boxes', 40 / 36, f'box {name}: 10" cream bow on the band')
        N('packing_tape', 'gift_boxes', 3, f'close box {name}'); N('magic_tape', 'gift_boxes', 3, f'paper join and wrap, box {name}')
    N('glue_sticks', 'gift_boxes', 3, '5 bows onto the ribbon'); N('floral_wire', 'gift_boxes', 5 * 6 / 36, '6" pinch wire per bow')
    return N

ring, rings, biscuits_needed = BISC_RING, BISC_RINGS, BISC_NEED
def sherpa_paw(project, size): return Needs()('felt', project, felt_paws(1, size), f'one {size:g}" paw')('glue_sticks', project, 1, 'hot-glue dots under the pad and toes (fabric glue alone grips only the pile tips)')('fabric_glue', project, 2 if size < 4 else 3, 'bead round the edges')
def bone_toy_paw(): return sherpa_paw('holiday_toy', 3)
BISC_T = 0.25
def basket_full():
    N = Needs(); b = BISC_L * BISC_H * 0.65 * BISC_T; area = 2 * BISC_L * BISC_H * 0.65 + 2 * (BISC_L + BISC_H) * BISC_T
    N('clay', 'faux_treats', N_BISCUITS * b * IN3_CM3 * CLAY_G_PER_CM3, f'{N_BISCUITS} biscuits x {b:.2f} cu in, 1/4" thick (the jar needs {biscuits_needed}: {ring} per ring x {rings} rings + 12 on top)')
    tan = ML_PER_FT2 * ft2(N_BISCUITS * area) * 2
    N('gesso', 'faux_treats', tan, f'{TAN.split(" = ")[0]}, 2 coats on {N_BISCUITS} x {area:.1f} sq in'); N('ochre', 'faux_treats', tan / 6, 'tan tint (2 tsp per 1/4 cup)'); N('sienna', 'faux_treats', tan / 12, 'tan tint')
    N('podge', 'faux_treats', PODGE_ML_PER_FT2 * ft2(N_BISCUITS * area), 'seal'); N('sticks', 'faux_treats', 2, '1/4" thickness guides for pressing the clay')
    N('paw_wrap', 'faux_treats', 3, 'jar core: 3 spare kraft sheets crumpled behind each ring of biscuits')
    N('velvet_ribbon', 'jar', 66 / 36, 'band round the shoulder (22") + bow: two 5" loops, 9" tails'); N('glue_sticks', 'jar', 1, 'band seam + 3 dots on the lid')
    N('floral_wire', 'basket', 5 * 12 / 36, 'jar and toys wired into the basket'); N('floral_wire', 'basket', 12 / 36, 'spiral gift-card holder')
    return plus(N, bone_toy_paw())

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
# Solid deep red velvet bows among the tartan ones (the board's "plaid and velvet ribbons"), tied from the spare velvet like the paw-ornament bows.
VELVET_BOWS = lambda n: plus(Needs()('velvet_ribbon', 'velvet_tree_bows', n * 37 / 36, f'{n} tree bows x 37" (two 4.5" loops, 8" tails)'), wire('velvet_tree_bows', n, 12, '12" each'))
def BIG_BOWS(n): return plus(Needs()('tartan_ribbon', 'big_bows', n * BIG_BOW_YD, f'{n} bows x {BIG_BOW_YD} yd (65": one loop each side, 15" tails, 6" knot)')('glue_sticks', 'big_bows', n / 2, 'knots')('fabric_glue', 'big_bows', n * 0.5, 'seal the tail notches'), wire('big_bows', n, 12, '12" each'))
def CASCADES(n=5): return plus(Needs()('tartan_ribbon', 'cascades', n * CASCADE_IN / 36, f'{n} cascades x {CASCADE_IN}" (82" down the tree + 4 poufs x 8" + 4" under the topper)')('fabric_glue', 'cascades', n * 0.3, 'seal the notch'), wire('cascades', n * 11, 6, '1 top tie + 10 pouf ties per cascade'))
def STREAMERS(): return Needs()('@topper_ribbon', 'streamers', 5.0, 'two 90" streamers incl. gathers')('felt', 'streamers', felt_paws(24), '24 paws of 3" (12 per streamer, front face)')('fabric_glue', 'streamers', 24 * 0.5 + 1, 'paws + cut ends')('floral_wire', 'streamers', 14 * 6 / 36, '2 top ties + 12 pouf ties')
DH_RENDER = dict(brick_h=0.9, brick_l=1.5, mortar='#3a1912', barge=True, raised_paw=True, threshold=True, ridge_cap=True, door=[3.8, 4.6], paw_y=2.84, interior='dark', hang='upright')
BONE_RENDER = dict(kind='clay', shaft_ratio=BONE_SHAFT, span_ratio=BONE_SPAN, hang='two_cord')
PAW_FACE = '#dcc49c'    # tea-stained Aida: the board's warm biscuit-cream face
ELEMENTS = [
 dict(id='topper', title='Topper bow', board='board_topper', options=[
   O('burlap6', '22" two-loop bow: 6" jute + felt paws', 'Two fat loops of 6" burlap, black felt paws', 'match',
     'Same width, colour, shape and paw print as the board\'s bow: two loops angled up over 14" tails, 3" paws on the front face.', [('topper', 1, 1)], topper('burlap6', 2.4, 24, 'topper', strip=78),
     dict(ribbon=6, span=22, loops=2, tail=14, loop_tilt=0.35, paw_in=3, paws=24, paw_face='front'), {'@topper_ribbon': 'burlap6'}, 'p_B0DQ4BXYKZ'),
   O('burlap4', '24" four-loop bow: 4" wired burlap + felt paws', 'The earlier four-loop bow', 'close',
     'Thinner ribbon and four loops: busier than the board\'s two fat loops.', [('topper_4in', 1, 1)], topper('burlap4', 2.6, 16, 'topper', edge_wire=False),
     dict(ribbon=4, span=24, loops=4, tail=16, paws=16, paw_in=3, paw_face='front'), {'@topper_ribbon': 'burlap4'}, 'p_B0CHMLF3NP'),
   O('printed', '20" bow from printed 2.5" paw ribbon', 'No crafting; brown paws, narrow', 'close',
     'Ready-made paw print, but brown paws and under half the board\'s ribbon width.', [('topper_printed', 1, 1)], topper('paw25', 2.4, 0, 'topper', edge_wire=False),
     dict(ribbon=2.5, span=20, loops=4, tail=14, paws=0, brown=True), {'@topper_ribbon': 'paw25'}, 'p_B09H2YMHCL'),
 ]),
 dict(id='flourish', title='Topper extras', board=None, options=[
   O('none', 'None, as the board', 'Just the bow, like the board', 'match', 'The board has no streamers or crown.', []),
   O('streamers', 'Two burlap streamers down the front', 'Ribbon waterfall', None, 'Our addition, not on the board.', [('streamers', 1, 2)],
     STREAMERS(), dict(streamers=True, len=90, paws=24, paw_in=3)),
   O('crown', 'Gold crown of 12 sprays behind the bow', 'Gold sprays fanned behind the bow', None, 'Our addition, not on the board.', [('gold_picks', 1), ('crown', 1, 1)],
     wire('crown', 12, 6, '12 sprays'), dict(crown=True, n=12)),
   O('both', 'Streamers and gold crown', 'Both extras', None, 'Our additions, not on the board.', [('gold_picks', 1), ('streamers', 1, 2), ('crown', 1, 1)],
     plus(STREAMERS(), wire('crown', 12, 6, '12 sprays')), dict(streamers=True, len=90, paws=24, paw_in=3, crown=True, n=12)),
 ]),
 dict(id='dogs', title='Golden retrievers on the tree', board='board_dog', options=[
   O('cuddlekins', '12" Cuddlekins golden retriever x 2', 'Sitting puppy, 11" tall', 'match', 'Sitting golden puppy with the board\'s face, inside its 10-16" size; a paler gold than the board\'s honey coat, and its grey paw pads are tucked down when wired.',
     [('golden', 2)], wire('plush_dogs', 2, 72, 'doubled 36" round the belly to a main branch, plus an organizer zip tie'), dict(cut='golden_tree', h=11, n=2), photo='p_B01N4NC8QY'),
   O('aurora', '14" Aurora Golden Lab x 2', 'Bigger, rounder Lab face', 'close', 'Bigger, but a Labrador face rather than a fluffy golden.',
     [('golden_aurora', 2)], wire('plush_dogs', 2, 80, 'doubled 40" round the belly to a main branch, plus an organizer zip tie'), dict(cut='golden_aurora', h=13, n=2), photo='p_B00ILYHVDQ'),
   O('one', '12" Cuddlekins x 1', 'One dog, like the board\'s front', 'match', 'The board shows one dog on its visible side.',
     [('golden', 1)], wire('plush_dogs', 1, 72, 'doubled 36" round the belly to a main branch, plus an organizer zip tie'), dict(cut='golden_tree', h=11, n=1), photo='p_B01N4NC8QY'),
 ]),
 dict(id='cats', title='Tabby cats on the tree', board='board_cat_a', options=[
   O('miyoni', '9" Aurora Miyoni grey tabby x 2', 'Striped grey tabby, white chest, crouching', 'close',
     'The board\'s coat: strong grey-brown stripes with a white chest, muzzle and paws, 6" tall and 9" long. It crouches rather than sits upright, so it lies along a branch; no 8-12" sitting striped tabby arrives by Nov 30 from a solid seller.',
     [('cat_miyoni', 2)], wire('plush_cats', 2, 48, 'doubled 24" round the body to a sturdy branch'), dict(cut='cat_miyoni', h=6, l=9, n=2, pose='stand'), photo='p_B00SUECXD0'),
   O('pocketkins', '4.7" Pocketkins tabby x 3', 'Small sitting kittens (the earlier pick)', 'close', 'Sitting striped grey tabby with a white chest, the board\'s pose and coat, but a third to a half of its size: wire three at eye level.',
     [('tabby_grey', 3)], wire('plush_cats', 3, 32, 'doubled 16" round the body'), dict(cut='tabby_mini_s', h=4.7, l=5.9, n=3, pose='sit'), photo='p_B0CVNDJS4D'),
   O('zigby', '6" Douglas Zigby tabby x 2', 'Standing striped tabby, 6"', 'close', 'Striped grey-brown tabby with a white bib, but standing, and shipped from outside Canada.',
     [('tabby_brown', 2)], wire('plush_cats', 2, 40, 'doubled 20" round the body'), dict(cut='tabby_cat_s', h=6, l=8, n=2, pose='stand'), photo='p_B086H6SNL7'),
   O('fluffy', '8" FLUFFYFUN grey-and-white cat x 2', 'Mostly white cat, standing', 'close', 'Mostly white with grey patches and stripes only on the head, standing with its tail up; 4 ratings, Nov 24.',
     [('cat_fluffy', 2)], wire('plush_cats', 2, 40, 'doubled 20" round the body to a sturdy branch'), dict(cut='cat_fluffy', h=7, l=8, n=2, pose='stand'), photo='p_B0H5YKFT7X'),
 ]),
 dict(id='doghouses', title='Doghouse ornaments', board='board_doghouse', options=[
   O('diy10', '10" DIY doghouses x 6', 'Board scale: red brick, cream roof, arched door', 'match', 'Same design and scale as the board\'s doghouse: dark-jointed red brick, cream plank roof with barge boards and ridge cap, flat cream arch trim on a threshold, raised cream paw.',
     [('doghouse', 1, 6)], doghouses(6, 8.5, 6, 5.5, 9.5, 2.5, 'doghouse'), dict(w=8.5, d=6, wall=5.5, ridge=9.5, n=6, **DH_RENDER), photo='r3d_doghouse_iso'),
   O('diy10x4', '10" DIY doghouses x 4', 'Fewer, same size', 'match', 'Same as the board; 4 instead of 6 leaves one or two per side.',
     [('doghouse', 1, 4)], doghouses(4, 8.5, 6, 5.5, 9.5, 2.5, 'doghouse'), dict(w=8.5, d=6, wall=5.5, ridge=9.5, n=4, **DH_RENDER), photo='r3d_doghouse_iso'),
   O('diy43', '4.3" DIY doghouses x 12', 'Small (the earlier size)', 'close', 'Same design at a third of the board\'s size.',
     [('doghouse_small', 1, 12)], doghouses(12, 3.4, 2.7, 2.4, 4.0, 1, 'doghouse'), dict(w=3.4, d=2.7, wall=2.4, ridge=4.0, n=12, **dict(DH_RENDER, brick_h=0.4, brick_l=0.7, raised_paw=False, door=[1.5, 1.9], paw_y=1.0, hang='loop')), photo='r3d_doghouse_iso'),
 ]),
 dict(id='paws', title='Paw-print ornaments', board='board_paw', options=[
   O('hoop_fay', '6" hoop paw ornaments x 10 (Faylapa hoops, 16-pk)', 'Gold rim, warm cream weave, glitter paw, velvet bow', 'match', 'Gold rim and cap, warm biscuit-cream woven face (tea-stained Aida), black sparkly paw, deep red velvet bow, finished felt back: the board\'s ornament at its size. The Amazon bamboo hoops make the same ornament for less, arrive Nov 20 (so priming starts before the DeSerres parcel) and leave 6 spares; only 3 packs were left on Nov 16, so order first.',
     [('paw_disc_fay', 1, 10)], hoop_paws(10, 'hoops_fay', 'paw_disc'), dict(kind='hoop', d=6, n=10, bow=9, face=PAW_FACE, back='felt'), photo='p_B088WV6BFG'),
   O('hoop', '6" hoop paw ornaments x 10 (DeSerres hoops)', 'Same ornament, DeSerres hoops', 'match', 'Identical ornament with eleven DeSerres hoops: more expensive, and they come in the DeSerres parcel (Nov 25-27). The fallback if the Faylapa pack sells out.',
     [('paw_disc', 1, 10)], hoop_paws(10, 'hoops_ds', 'paw_disc'), dict(kind='hoop', d=6, n=10, bow=9, face=PAW_FACE, back='felt'), photo='p_hoops_ds'),
   O('wood', '4" painted wood rounds x 30', 'Smaller and flatter (the earlier design)', 'close', 'Two-thirds of the board\'s size, painted flat, small bows.',
     [('paw_disc_wood', 1, 30)],
     plus(Needs()('wood_rounds', 'paw_disc', 30, '30 of 50')('gesso', 'paw_disc', ML_PER_FT2 * ft2(30 * 12.8 * 2) * 2, 'cream, 2 coats, both sides')('gold', 'paw_disc', 10 * ft2(30 * 2.8 * 2) * 3, 'gold rim and cap')
          ('black', 'paw_disc', ML_PER_FT2 * ft2(30 * 4.95) * 2, '3" black paw')('sparkle', 'paw_disc', 10, 'sparkle coat')('podge', 'paw_disc', PODGE_ML_PER_FT2 * ft2(30 * 12.8), 'seal')
          ('mini_bows', 'paw_disc', 30, 'one bow each')('gold_cord', 'paw_disc', 7.5, '30 loops')('film', 'paw_disc', 1, '3" paw stencil')('glue_sticks', 'paw_disc', 4, 'bows')('ochre', 'paw_disc', ML_PER_FT2 * ft2(30 * 12.8 * 2) * 2 / 24, 'cream tint'), wire('paw_disc', 30, 6, '6" each')),
     dict(kind='disc', d=4, n=30, bow=3.5), photo='p_B0FC6DWFVL'),
 ]),
 dict(id='bones', title='Bone ornaments', board='board_bone', options=[
   O('clay9', '9" DIY clay bones x 8', 'Smooth biscuit-cream bones at board scale', 'match', 'Smooth, puffy biscuit bones at the board\'s size and proportions (shaft 0.27, knob span 0.53 of the length), hung level from two gold cords.', [('bones', 1, 8)], bones(8, 9, 'bones', 1.0), dict(BONE_RENDER, l=9, len=9, n=8, thick=1), photo='r3d_bones'),
   O('fleece9', '9" fleece bones x 8 (bought)', 'Fuzzy sherpa bones, no crafting', 'close', 'Right size and colour, but fuzzy, not smooth.', [('bone_fleece', 8)], wire('bones', 8, 8, '8" each'), dict(kind='fleece', l=9, n=8), photo='p_B000E1S8NG'),
   O('clay5', '5" DIY clay bones x 24', 'Smaller (the earlier size)', 'close', 'About half the board\'s size.', [('bones_small', 1, 24)], bones(24, 5, 'bones', 0.75), dict(BONE_RENDER, l=5, len=5, n=24, thick=0.75), photo='r3d_bones'),
 ]),
 dict(id='baubles', title='Baubles', board='board_baubles', options=[
   O('board', 'Board mix: 6" and 4" red, 4" gold and green + red & gold filler', 'Red, gold, green at the board\'s 4-6" scale', 'match', 'The board\'s palette with its big balls at its sizes; the red & gold 100-pc set fills between and the 4" green glitter balls give the few forest greens. Hang the sequin-glitter and painted balls deeper and keep the smooth reds and golds on the tips, where the board\'s big balls sit.',
     [('baubles_rgg', 1), ('red6_benjia', 1), ('red4_glitter', 2), ('red4_joyin', 1), ('gold4_joyin', 2), ('glitter_green', 2), ('glitter_champ', 1)], BAUBLE_WIRE(100 + 4 + 12 + 4 + 8 + 12 + 12),
     dict(sets=[['baubles_rgg', 1], ['red6_benjia', 1], ['red4_glitter', 2], ['red4_joyin', 1], ['gold4_joyin', 2], ['glitter_green', 2], ['glitter_champ', 1]])),
   O('painted', 'Board mix with 6" painted red & gold instead of plain red', 'Swirled and diamond-painted 6" balls', 'close', 'Same size, but painted with gold swirls; the board\'s big balls are plain.',
     [('baubles_rgg', 1), ('redgold6', 1), ('red4_glitter', 2), ('red4_joyin', 1), ('gold4_joyin', 2), ('glitter_green', 2), ('glitter_champ', 1)], BAUBLE_WIRE(152),
     dict(sets=[['baubles_rgg', 1], ['redgold6', 1], ['red4_glitter', 2], ['red4_joyin', 1], ['gold4_joyin', 2], ['glitter_green', 2], ['glitter_champ', 1]])),
   O('original', 'The earlier mix: 3" and smaller, 236 balls', 'Many small balls (the earlier list)', 'close', 'Right colours, but mostly 1.2-3" against the board\'s 4-6".',
     [('baubles_rgg', 2), ('baubles_champ', 1), ('glitter_red', 1), ('glitter_champ', 1), ('glitter_green', 2)], BAUBLE_WIRE(348),
     dict(sets=[['baubles_rgg', 2], ['baubles_champ', 1], ['glitter_red', 1], ['glitter_champ', 1], ['glitter_green', 2]])),
 ]),
 dict(id='ribbon', title='Tartan ribbon, tartan and velvet bows', board='board_ribbon', options=[
   O('full', '5 cascades + 14 big tartan bows + 5 velvet bows', 'Tartan running down the tree, tartan and velvet bows', 'match', 'The board\'s tartan runs top to bottom with big bows along it, and solid deep red velvet bows sit among the tartan ones.',
     [('cascades', 1, 5), ('big_bows', 1, 14), ('velvet_tree_bows', 1, 5)], plus(CASCADES(5), BIG_BOWS(14), VELVET_BOWS(5)), dict(cascades=5, bows=14, velvet_bows=5, bow_loops=2, bow_tail=15, poufs=4)),
   O('bows', '14 big tartan bows + 5 velvet bows, no cascades', 'Bows only', 'close', 'Loses the board\'s long ribbon lines.',
     [('big_bows', 1, 14), ('velvet_tree_bows', 1, 5)], plus(BIG_BOWS(14), VELVET_BOWS(5)), dict(cascades=0, bows=14, velvet_bows=5, bow_loops=2, bow_tail=15)),
   O('more', '5 cascades + 20 big tartan bows + 5 velvet bows', 'Fuller: more bows', 'match', 'As the board, fuller.',
     [('cascades', 1, 5), ('big_bows', 1, 20), ('velvet_tree_bows', 1, 5)], plus(CASCADES(5), BIG_BOWS(20), VELVET_BOWS(5)), dict(cascades=5, bows=20, velvet_bows=5, bow_loops=2, bow_tail=15, poufs=4)),
 ]),
 dict(id='stockings', title='Mini pet stockings', board=None, options=[
   O('knit', '4" knit stockings x 12, felt paw on each cuff', 'Red, green, cream knit with black paws', 'close', 'On the board\'s list, not in its photos; knit in its colours, with a black felt paw on each cuff to make them pet stockings.', [('stockings', 1)],
     plus(wire('stockings', 12, 6, '6" each'), Needs()('felt', 'stockings', felt_paws(12, 1.0), '12 paws of 1"')('fabric_glue', 'stockings', 3, '12 cuff paws, bead round the edges')('glue_sticks', 'stockings', 2, 'hot-glue dots under the paws (the cuffs are fluffy)')), dict(n=12, paws=True)),
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
   O('both', 'Sherpa bone pillow + red paw-print dog bowl', 'Like the board', 'match', 'Both are in the board\'s photo, front and centre: a cream sherpa bone with a black paw, and a straight-sided deep red bowl with a steel interior and paw prints.', [('bone_pillow', 1), ('bowl', 1)],
     sherpa_paw('bone_pillow', 4.5), dict(pillow=True, bowl=True, bowl_kind='steel')),
   O('pillow', 'Bone pillow only', 'Pillow, no bowl', 'close', 'Loses the board\'s red paw-print bowl.', [('bone_pillow', 1)], sherpa_paw('bone_pillow', 4.5), dict(pillow=True, bowl=False)),
 ]),
 dict(id='basket', title='Gift basket', board='board_basket', options=[
   O('full', 'Basket, treat jar, throw, toys, 2 x $100 gift cards', 'Everything on the board', 'close', 'Every item in the board\'s basket photo: bare wicker (liner removed), a glass treat jar with a velvet bow, a cream sherpa bone with a black paw, rope toys, a red ball, gift cards and a red paw throw. The jar is a wider barrel than the board\'s apothecary jar, and the throw is printed flannel with snowflakes, not the board\'s knit.',
     [('basket', 1), ('jar', 1), ('faux_treats', 1, N_BISCUITS), ('bone_cutters', 1), ('blanket', 1), ('holiday_toy', 1), ('rope', 1), ('balls', 1), ('gift_card', 2)], basket_full(), dict(jar=True, blanket=True)),
   O('lean', 'Basket, toys, 2 x $100 gift cards (no jar or throw)', 'Smaller basket', 'close', 'Loses the treat jar and the throw.',
     [('basket', 1), ('holiday_toy', 1), ('rope', 1), ('balls', 1), ('gift_card', 2)], plus(wire('basket', 3, 12, 'toys wired in'), wire('basket', 1, 12, 'spiral gift-card holder'), bone_toy_paw()), dict(jar=False, blanket=False)),
 ]),
 dict(id='pair', title='Dog and cat by the basket', board='board_pets_panel', options=[
   O('pair', 'Golden retriever + striped grey tabby in scarves', 'The board\'s dog-and-cat photo, under the tree', 'close', 'Recreates the board\'s dog-and-cat photo beside the basket with the same golden and the Miyoni tabby as on the tree; the board\'s cat sits upright, ours crouches beside the dog.',
     [('golden', 1), ('cat_miyoni', 1)], plus(wire('plush_dogs', 1, 72, 'doubled 36" round the belly, to the basket handle'), wire('plush_cats', 1, 48, 'doubled 24" round the body'), wire('pair', 2, 18, 'dog and cat wired to each other and to the basket handle')), dict(on=True, cat='cat_miyoni', cat_cut='cat_miyoni', cat_h=6, cat_l=9, cat_pose='stand')),
   O('none', 'None', 'No pets under the tree', None, 'The tree still has its pets.', []),
 ]),
 dict(id='giant', title='Giant doghouse', board=None, options=[
   O('none', 'None, as the board', 'Not on the board', 'match', 'The board has no giant doghouse.', []),
   O('build', '24 x 20 x 26" doghouse from two moving boxes', 'Our wow piece: the pets sit in its doorway', None, 'Our addition: big impact, but not on the board.',
     [('doghouse_xl', 1, 1)], giant(), dict(on=True)),
 ]),
]
for e in ELEMENTS: e['default'] = e['options'][0]['id']

SCARF_GLUE = 0.05 * (5 * 58 + 6 * 3) + 2     # 0.05 ml per inch: five raw long edges on the 58" used from strips 1-3, six new fringe stops of 3"
BASE = dict(rows=[dict(id='bandanas', qty=1)], needs=Needs()('fabric_glue', 'pet_scarves', SCARF_GLUE, 'thin bead on the raw long edges and above each pulled fringe (3 dog + 3 cat scarves)')
    ('drop_sheet', 'craft', 1, 'covers two tables; offcuts are the clay work surface')('glue_gun', 'craft', 1)('knife', 'craft', 4, 'about 1 blade per 3 foam boards + the gift boxes and scarf')('ruler', 'craft', 1)('brushes', 'craft', 1)
    ('foam_brush2', 'craft', 3, 'gesso, cream, Mod Podge')('foam_brush1', 'craft', 3, 'small parts')('sponge', 'craft', 2, 'brick dabbing + stencilling')('glue_sticks', 'misc', 10, 'repairs on decorating day')
    ('wire_cutter', 'craft', 1, 'about 400 floral-wire cuts (baubles, picks, bows, plush, ornaments)')('cut_board', 'craft', 1, 'flattened: the cutting surface for foam board, boxes, scarf and Aida')
    ('fabric_marker', 'craft', 1, 'traces every felt paw and circle')('sticks', 'craft', 6, 'paint stirrers for the cream, biscuit and brick mixes')('packing_tape', 'transport', 3, 'pack the under-tree pieces in one labelled box'))

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
        # delivery is counted per unit (worst case: Amazon.ca can charge an international listing's delivery on every unit)
        sh = rnd((it.get('ship') or 0) * r['qty'] + sum(SUP[s]['ship'] * S_BY[s]['qty'] for s in r['carries']) + (SUP[id]['ship'] * r['qty'] if id in SUP and r['price'] is not None else 0), 2)
        if sh: ships.append((it.get('form_name') or it['name'], sh))
        out.append(it)
    if ships:
        it = dict(CAT['shipping']); it.update(price=rnd(sum(s for _, s in ships), 2), qty=1, store='Amazon.ca', url='https://www.amazon.ca/',
            name='Amazon.ca delivery on the listings that charge it ($0 with Prime)', form_name='Shipping (Amazon.ca)',
            notes='From the listings, counted per unit where we buy more than one (the worst case; confirm the delivery line at checkout): ' + ', '.join(f'{n} ${s:.2f}' for n, s in ships) + '. Everything else ships free on an order over $35; DeSerres ships free over $149; Canadian Tire is store pickup.')
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
    keep = ('id', 'section', 'name', 'form_name', 'store', 'url', 'price', 'ship', 'status', 'diy', 'notes', 'arrives_by', 'match', 'how', 'size_in', 'checked_on', 'gst_exempt', 'photo_file', 'projects', 'tools')
    opts = dict(budget=BUDGET, floor=FLOOR, margin=MARGIN, sections=SECTIONS, checked=CHECKED, base=BASE, elements=ELEMENTS, supplies=SUP, on_hand=ON_HAND,
                catalog={k: {f: CAT[k][f] for f in keep if f in CAT[k]} for k in sorted(used)})
    (ROOT / 'data' / 'options.json').write_text(json.dumps(opts, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('items:', len(items), '| elements:', len(ELEMENTS), '| options:', sum(len(e['options']) for e in ELEMENTS))
