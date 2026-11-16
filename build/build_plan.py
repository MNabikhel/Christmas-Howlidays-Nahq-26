"""Test 0 of GOAL.md: every item thought through.

- SUPPLIES: every craft material we buy, with the verified listing (store, price, link, checked date).
- PROJECTS: each DIY build, with real dimensions; material needs are calculated from geometry.
- Every supply line must cover the total need with >= 10% spare, or the build fails.
- Writes data/supplies.json (used by the Word plan and the page) and output/item_audit.md,
  and updates the DIY / supply rows in data/items.json so prices and quantities stay in step.
Assumptions are named constants below, so anyone can challenge them.
"""
import json, math, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ITEMS = ROOT / 'data' / 'items.json'
CHECKED = '2026-11-16'

# ---- coverage assumptions (stated, not hidden) ----
ML_PER_FT2 = 12       # brushed acrylic / gesso, one coat, on paper, foam board or primed cardboard
DAB_ML_PER_FT2 = 8    # sponge-dabbed coat (bricks): paint sits on the surface only
BURLAP_ML_PER_FT2 = 25  # fabric paint through a stencil into open-weave burlap (thirsty)
PODGE_ML_PER_FT2 = 15
CLAY_G_PER_CM3 = 0.45 # lightweight foam clay, wet (upper end of the range, so we over-buy rather than run short)
MARGIN = 1.10
ft2 = lambda in2: in2 / 144
IN3_CM3 = 16.387

DS = 'https://www.deserres.ca/products/'
CT = 'https://www.canadiantire.ca/en/pdp/'
AMZ = 'https://www.amazon.ca/dp/'
# id: name, store, url, unit price, qty, amount per unit, unit
SUPPLIES = {
 'foam_board': ('Foam board, white 3/16", 16x20" (not oversized: no extra shipping fee)', 'DeSerres', DS + 'foam-board-white-16x20', 5.99, 4, 320, 'in2'),
 'gesso': ('White gesso 948 ml (primer, mortar grey and cream when tinted)', 'DeSerres', DS + 'white-gesso-948ml', 19.99, 1, 948, 'ml'),
 'red1': ('Student acrylic Naphthol Red 250 ml', 'DeSerres', DS + 'student-acrylic-naphthol-red-250ml', 12.99, 1, 250, 'ml'),
 'red2': ('Student acrylic Crimson 250 ml (mixed 1:1 with Naphthol Red = barn red)', 'DeSerres', DS + 'student-acrylic-crimson-250ml', 12.99, 1, 250, 'ml'),
 'sienna': ('Basics acrylic Burnt Sienna 8 oz (236 ml)', 'DeSerres', DS + 'basics-acrylic-8oz-burnt-sienna', 19.99, 1, 236, 'ml'),
 'black': ('Americana acrylic Lamp Black 60 ml', 'DeSerres', DS + 'americana-acrylic-lamp-black-60ml', 2.99, 2, 60, 'ml'),
 'gold': ('Americana Dazzling Metallics Glorious Gold 60 ml', 'DeSerres', DS + 'americana-acrylic-dazzling-metallics-glorious-gold-60ml', 3.99, 1, 60, 'ml'),
 'sparkle': ('Pearl medium, fine, black (the glitter on the black paws)', 'DeSerres', DS + 'pearl-medium-fine-black', 9.99, 1, None, 'jar'),
 'fabric_paint': ('Setacolor opaque textile paint, black lake 45 ml (paws on the burlap)', 'DeSerres', DS + 'textile-paint-setacolor-45ml-opaque-black-lake', 7.99, 2, 45, 'ml'),
 'podge': ('Mod Podge Matte 473 ml (sealer and sign glue)', 'DeSerres', DS + 'mod-podge-matte-473ml', 16.99, 1, 473, 'ml'),
 'gold_cord': ('Metallic yarn, gold, 25 m (hanging loops)', 'DeSerres', DS + 'metallic-yarn-gold-25m', 5.99, 1, 25, 'm'),
 'film': ('Drafting film 8.5x11" (cut our own paw stencils)', 'DeSerres', DS + 'drafting-film-0-003-matte-on-2-sides-8-5x11', 1.99, 2, 6, 'stencils'),
 'glue_gun': ('Mini hot glue gun (7 mm sticks)', 'DeSerres', DS + 'hot-glue-gun-mini', 14.99, 1, 1, 'tool'),
 'glue_sticks': ('Glue sticks 7 mm, 96 pc', 'DeSerres', DS + '96-glue-sticks-7mm', 12.99, 1, 96, 'sticks'),
 'knife': ('Art knife with 5 blades (foam board and cardboard)', 'DeSerres', DS + 'art-knife-with-5-blades', 12.99, 1, 5, 'blades'),
 'ruler': ('Steel and cork ruler 24"', 'DeSerres', DS + 'stainless-steel-and-cork-ruler-24-inch', 12.99, 1, 1, 'tool'),
 'brushes': ('Craft brush set, 25 pc (detail work: doors, trim, paws)', 'DeSerres', DS + 'set-of-25-craft-brushes', 12.99, 1, 1, 'set'),
 'foam_brush2': ('Foam brush 2"', 'DeSerres', DS + 'foam-brush-black-2', 1.99, 3, 1, 'brush'),
 'foam_brush1': ('Foam brush 1"', 'DeSerres', DS + 'foam-brush-black-1', 1.99, 3, 1, 'brush'),
 'sponge': ('Hydra synthetic sponge (brick dabbing, stencilling)', 'DeSerres', DS + 'hydra-synthetic-sponge', 1.99, 2, 1, 'sponge'),
 'enamel_pen': ('Sharpie oil-based paint marker, white (paws on the glazed bowl)', 'DeSerres', DS + 'sharpie-oil-based-paint-marker-medium-tip-white', 9.99, 1, 1, 'pen'),
 'fabric_glue': ('Permanent fabric glue 118 ml (felt paw; seals cut scarf edges)', 'DeSerres', DS + 'permanent-fabric-glue-118ml', 6.99, 1, 118, 'ml'),
 'kraft': ('Kraft paper roll 27.6" x 9.8 ft (core that fills the jar)', 'DeSerres', DS + 'kraft-paper-roll-27-6x9-8', 6.99, 1, 1, 'roll'),
 'box_small': ('Small moving box 18 x 11 x 12"', 'Canadian Tire', CT + 'canadian-tire-small-moving-storage-box-100-recycled-cardboard-18-x-11-x-12-in-0676043p.html', 1.75, 2, 1, 'box'),
 'box_medium': ('Medium moving box 16 x 16 x 16"', 'Canadian Tire', CT + 'canadian-tire-medium-moving-storage-box-100-recycled-cardboard-16-x-16-x-16-in-0676172p.html', 2.65, 2, 1, 'box'),
 'box_xl': ('Extra-large moving box 24 x 20 x 20"', 'Canadian Tire', CT + 'canadian-tire-extra-large-moving-box-100-recycled-cardboard-24-x-20-x-20-in-0676076p.html', 4.99, 2, 1, 'box'),
 'packing_tape': ('Box sealing tape, clear, 48 mm x 50 m', 'Canadian Tire', CT + 'tempest-box-sealing-tape-clear-48mm-x-50m-4992262p.html', 3.99, 1, 50, 'm'),
 'magic_tape': ('Scotch Magic Tape 19 mm x 10 m, 3-pk (gift wrapping)', 'Canadian Tire', CT + 'scotch-magic-tape-in-dispenser-invisible-matte-finish-19-mm-x-10-m-3-pk-0670361p.html', 4.99, 1, 30, 'm'),
 'drop_sheet': ('Plastic drop sheet 8 x 12 ft (painting in the office)', 'Canadian Tire', CT + 'bennett-light-weight-plastic-drop-sheets-8-ft-x-12-ft-0494804p.html', 4.99, 1, 1, 'sheet'),
 # already on the item list (Amazon), included so their quantities are checked too
 'clay': ('White air-dry foam clay 500 g', 'Amazon.ca', AMZ + 'B0F86WQG4W', 22.00, 2, 500, 'g'),
 'burlap': ('Natural burlap wired ribbon 4" x 10 yd', 'Amazon.ca', AMZ + 'B0CHMLF3NP', 16.80, 2, 10, 'yd'),
 'tartan': ('Tartan wired ribbon 4" x 10 yd', 'Amazon.ca', AMZ + 'B0D7WPZDJW', 33.68, 6, 10, 'yd'),
 'velvet': ('Red velvet wired ribbon 2.5" x 10 yd', 'Amazon.ca', AMZ + 'B0C9TMPDBM', 36.37, 1, 10, 'yd'),
 'tartan_paper': ('Red tartan wrapping paper 17" x 33 ft', 'Amazon.ca', AMZ + 'B0F9P8CHMT', 19.79, 1, 396, 'in'),
 'paw_paper': ('Kraft paw wrapping paper, 6 sheets 17 x 40"', 'Amazon.ca', AMZ + 'B0FSXRGDGM', 22.68, 1, 6, 'sheets'),
 'mini_bows': ('Mini red velvet bows 3.5", 12-pk', 'Amazon.ca', 'https://www.amazon.ca/Velvet-Christmas-Bows-Wreath-Wrapping/dp/B0FK4Y5M37', 15.41, 3, 12, 'bows'),
 'wood_rounds': ('4" bauble-shaped wood rounds, 50 pc', 'Amazon.ca', AMZ + 'B0FC6DWFVL', 13.90, 1, 50, 'pc'),
 'floral_wire': ('Green floral wire 22 gauge, 3 x 118 yd', 'Amazon.ca', 'https://www.amazon.ca/Floral-Wire-22-Gauge-Arrangements/dp/B09WVCQN4R', 29.92, 1, 354, 'yd'),
 'felt': ('Black felt 8 x 12", 7 sheets', 'Amazon.ca', AMZ + 'B0DX78HCZC', 8.50, 1, 7, 'sheets'),
}
ON_HAND = ['Scissors (3 pairs)', 'Pencils and ballpoint pens (pens score the brick and shingle lines)', 'Aluminum foil, about 10 ft (cores for the clay bones)',
           'Toothpicks', 'Paper towels, water cups, paper plates for palettes', 'Office colour printer: templates on Letter, the sign on 11x17 (or two Letter pages)', 'Garbage bags for clean-up']

need = {k: [] for k in SUPPLIES}     # supply -> [(project, amount, how)]
def use(sup, project, amount, how): need[sup].append((project, amount, how))

# ---------- project geometry ----------
# 12 doghouse ornaments, foam board: W 3.4, D 2.7, walls 2.4, ridge 4.0 (roof makes it 4.3 tall)
W, D, WALL, RIDGE = 3.4, 2.7, 2.4, 4.0
gable = W * WALL + 0.5 * W * (RIDGE - WALL)
slope = math.hypot(W / 2, RIDGE - WALL) + 0.35            # roof panel, with eave overhang
parts = [('front (arched door)', W, RIDGE), ('back', W, RIDGE), ('side', D - 0.375, WALL), ('side', D - 0.375, WALL), ('roof', slope, D + 0.5), ('roof', slope, D + 0.5), ('floor', W - 0.375, D - 0.375)]
set_bbox = sum(a * b for _, a, b in parts)
orn_walls = 2 * gable + 2 * (D * WALL); orn_roof = 2 * slope * (D + 0.5)
use('foam_board', 'doghouse', 12 * set_bbox / 0.8, f'12 sets x {set_bbox:.1f} in2 of parts / 80% packing')
use('gesso', 'doghouse', ml := ML_PER_FT2 * ft2(12 * orn_walls), f'mortar grey, 1 coat on 12 x {orn_walls:.1f} in2 of walls')
use('gesso', 'doghouse', ML_PER_FT2 * ft2(12 * orn_roof) * 2, f'cream roofs, 2 coats on 12 x {orn_roof:.1f} in2')
use('red1', 'doghouse', DAB_ML_PER_FT2 * ft2(12 * orn_walls) * 2 / 2, 'red bricks, 2 dabbed coats (half from each red)'); use('red2', 'doghouse', DAB_ML_PER_FT2 * ft2(12 * orn_walls) * 2 / 2, 'red bricks (other half)')
use('sienna', 'doghouse', ML_PER_FT2 * ft2(12 * orn_walls), 'inside faces, 1 coat (stops warping, dark through the door)')
use('black', 'doghouse', 3, 'door openings')
use('glue_sticks', 'doghouse', 24, '2 sticks per house'); use('gold_cord', 'doghouse', 12 * 0.3, '12 loops x 30 cm')
use('film', 'doghouse', 1, '1" paw stencil (gable)'); use('floral_wire', 'doghouse', 12 * 6 / 36, '6" per ornament')

# giant doghouse, from two 24 x 20 x 20" moving boxes: 24 W x 20 D, 16" walls, ridge 26", door 10 x 13" arched
GW, GD, GWALL, GRIDGE, DW, DH = 24, 20, 16, 26, 10, 13
door = DW * (DH - DW / 2) + math.pi * (DW / 2) ** 2 / 2
g_walls = 2 * (GW * GWALL + 0.5 * GW * (GRIDGE - GWALL)) - door + 2 * GD * GWALL
g_roof = 2 * (math.hypot(GW / 2, GRIDGE - GWALL) + 2) * (GD + 4)
g_inside = g_walls + door + GW * GD
use('box_xl', 'doghouse_xl', 2, 'box A = walls and floor (cut down to 16"); box B = roof panels, gable triangles, shingles, sign backing')
use('gesso', 'doghouse_xl', ML_PER_FT2 * ft2(g_walls) * 2, f'primer = mortar grey, 2 coats over brown cardboard on {g_walls:.0f} in2')
use('red1', 'doghouse_xl', DAB_ML_PER_FT2 * ft2(g_walls) * 2 / 2, 'red bricks, 2 dabbed coats (half)'); use('red2', 'doghouse_xl', DAB_ML_PER_FT2 * ft2(g_walls) * 2 / 2, 'red bricks (other half)')
use('gesso', 'doghouse_xl', ML_PER_FT2 * ft2(g_roof * 1.2) * 2, f'cream shingles, 2 coats on {g_roof:.0f} in2 of roof (+20% for shingle edges)')
use('red1', 'doghouse_xl', ML_PER_FT2 * ft2(g_inside) / 2, f'inside, 1 coat of red darkened with black, {g_inside:.0f} in2 (half)'); use('red2', 'doghouse_xl', ML_PER_FT2 * ft2(g_inside) / 2, 'inside (other half)')
use('black', 'doghouse_xl', 30, 'darkens the inside red to a deep red-brown')
use('gesso', 'doghouse_xl', ML_PER_FT2 * ft2(40 * 1.25) * 2 + 2, 'cream door trim strip (40 x 1.25") and gable paw')
use('podge', 'doghouse_xl', PODGE_ML_PER_FT2 * ft2(16 * 4) * 2, 'glue and seal the printed 16 x 4" sign')
use('glue_sticks', 'doghouse_xl', 30, 'roof, gables, shingle courses, trim'); use('packing_tape', 'doghouse_xl', 10, 'inside seams')
use('film', 'doghouse_xl', 1, '3.6" paw stencil (gable)')

# 30 paw ornaments: 4.3 x 3.5" bauble-shaped wood rounds
disc = 0.85 * 4.3 * 3.5; paw3 = 0.55 * 3 ** 2
use('wood_rounds', 'paw_disc', 30, '30 of 50')
use('gesso', 'paw_disc', ML_PER_FT2 * ft2(30 * disc * 2) * 2, f'cream, 2 coats, both sides of 30 x {disc:.1f} in2')
use('gold', 'paw_disc', 10 * ft2(30 * 2.8 * 2) * 3, 'gold rim and cap, 3 coats, both sides')
use('black', 'paw_disc', ML_PER_FT2 * ft2(30 * paw3) * 2, '3" black paw, 2 coats'); use('sparkle', 'paw_disc', 10 * ft2(30 * paw3), 'sparkle coat over the paws (about 10 ml)')
use('podge', 'paw_disc', PODGE_ML_PER_FT2 * ft2(30 * disc), 'seal the front'); use('mini_bows', 'paw_disc', 30, 'one bow on top of each')
use('gold_cord', 'paw_disc', 30 * 0.25, '30 loops x 25 cm'); use('glue_sticks', 'paw_disc', 4, 'bows'); use('film', 'paw_disc', 1, '3" paw stencil')
use('floral_wire', 'paw_disc', 30 * 6 / 36, '6" each')

# 24 puffy bones, 5 x 1.8 x 1", foam clay over a foil core (half the volume is foil)
bone_in3 = 3.2 * 0.8 * 0.8 * 0.8 + 4 * (4 / 3) * math.pi * 0.475 ** 3
bone_area = 2 * 6.3 + 5
use('clay', 'bones', 24 * bone_in3 * IN3_CM3 * 0.5 * CLAY_G_PER_CM3, f'24 x {bone_in3:.1f} in3, half foil core, {CLAY_G_PER_CM3} g/cm3')
use('gesso', 'bones', ML_PER_FT2 * ft2(24 * bone_area) * 2, 'cream, 2 coats'); use('sienna', 'bones', 5, 'dry-brushed edges and tint')
use('podge', 'bones', PODGE_ML_PER_FT2 * ft2(24 * bone_area), 'seal'); use('gold_cord', 'bones', 24 * 0.25, '24 loops x 25 cm')
use('floral_wire', 'bones', 24 * 6 / 36, '6" each')

# faux biscuits: enough to line the jar wall and cover the top, around a kraft-paper core
JAR_D, JAR_H = 7.0, 9.9
ring = math.floor(math.pi * (JAR_D - 0.4) / 3.0); rings = math.floor((JAR_H - 1.4) / 1.4)
biscuits_needed = ring * rings + 12
bisc_in3 = 3 * 1.2 * 0.65 * 0.3
use('clay', 'faux_treats', 60 * bisc_in3 * IN3_CM3 * CLAY_G_PER_CM3, f'60 biscuits x {bisc_in3:.2f} in3 (jar needs {biscuits_needed}: {ring} per ring x {rings} rings + 12 on top)')
use('gesso', 'faux_treats', ML_PER_FT2 * ft2(60 * 6.1), 'tan (gesso + burnt sienna), 1 coat'); use('sienna', 'faux_treats', 15, 'tan tint')
use('podge', 'faux_treats', PODGE_ML_PER_FT2 * ft2(60 * 6.1), 'seal'); use('kraft', 'faux_treats', 1, 'crumpled 4" core inside the jar')

# topper: 24" four-loop bow + two streamers to the doghouse roof (+ the burlap bow on one gift box)
bow_in = 4 * 2 * 12 + 8; streamer_in = 2 * ((90 - GRIDGE) * 1.06 + 5.5 * 6); boxbow_in = 54
use('burlap', 'topper', (bow_in + streamer_in + boxbow_in) / 36, f'bow {bow_in}" + streamers {streamer_in:.0f}" + gift-box bow {boxbow_in}"')
paws = (bow_in + streamer_in) / 4.5 + 12
use('fabric_paint', 'topper', BURLAP_ML_PER_FT2 * ft2(paws * 0.55 * 2.2 ** 2), f'{paws:.0f} paws x 2.2" on burlap'); use('film', 'topper', 1, '2.2" paw stencil')
use('floral_wire', 'topper', 3, 'bow to the tip + streamer ties')

# ribbon and wrapping
BOXES = [('A', 18, 11, 12, 'tartan', 'velvet'), ('B', 16, 16, 16, 'tartan', 'tartan'), ('C', 16, 16, 10, 'tartan', 'velvet'), ('D', 18, 11, 7, 'paw', 'tartan')]
use('box_small', 'gift_boxes', 2, 'A (18x11x12) and D (cut down to 7" tall)'); use('box_medium', 'gift_boxes', 2, 'B (16x16x16) and C (cut down to 10")')
for name, l, w, h, paper, rib in BOXES:
    girth = 2 * (w + h) + 2; width = l + h + 2
    if paper == 'tartan': use('tartan_paper', 'gift_boxes', girth * math.ceil(width / 17), f'box {name}: {math.ceil(width / 17)} strips of {girth}" (paper is 17" wide)')
    else: use('paw_paper', 'gift_boxes', math.ceil(width / 17), f'box {name}: {math.ceil(width / 17)} sheets (girth {girth}" fits a 40" sheet)')
    around = 2 * (l + h) + 2 * (w + h) + 8
    bow = 54 if rib == 'tartan' else 45
    use(rib, 'gift_boxes', (around + (bow if name != 'D' else 0)) / 36, f'box {name}: {around}" around both ways' + (f' + {bow}" bow' if name != 'D' else ' (burlap bow)'))
    use('packing_tape', 'gift_boxes', 3, f'close box {name}'); use('magic_tape', 'gift_boxes', 2, f'wrap box {name}')
use('tartan', 'cascades', 5 * 118 / 36, '5 cascades x 118" (82" down the tree + 4.5 poufs x 8")')
use('tartan', 'big_bows', 14 * 1.5, '14 bows x 1.5 yd')
use('floral_wire', 'cascades', 5 * 10 * 6 / 36, '10 ties per cascade x 6"'); use('floral_wire', 'big_bows', 14 * 12 / 36, '12" each')

# everything else that needs wire, glue or stencils
use('floral_wire', 'baubles', 348 * 8 / 36, '200 + 100 + 12 + 12 + 12 + 12 baubles x 8"')
use('floral_wire', 'plush', 5 * 24 / 36, '5 plush pets on the tree x 24" round the body to the trunk')
use('floral_wire', 'picks', (28 + 24 + 48) * 6 / 36, 'gold sprays, pine picks, berry stems x 6"')
use('floral_wire', 'stockings', 12 * 6 / 36, '12 x 6"'); use('floral_wire', 'velvet_bows', 12 * 12 / 36, '12 x 12"'); use('floral_wire', 'basket', 5 * 12 / 36, 'jar and toys wired into the basket')
use('glue_sticks', 'misc', 10, 'repairs on decorating day'); use('mini_bows', 'jar', 1, 'bow on the jar')
use('enamel_pen', 'bowl', 1, '2 white paws on glazed ceramic'); use('film', 'bowl', 1, '1.5" paw stencil')
use('fabric_glue', 'bone_pillow', 3, '4.5" felt paw'); use('felt', 'bone_pillow', 1, 'one 4.5" paw')
use('fabric_glue', 'pet_scarves', 0.05 * 3 * 72, '3 lengthwise cuts x 72", thin bead to stop fraying')
use('drop_sheet', 'craft', 1, 'covers two tables'); use('glue_gun', 'craft', 1, ''); use('knife', 'craft', 3, '1 blade per ~2 boards / boxes'); use('ruler', 'craft', 1, '')
use('brushes', 'craft', 1, ''); use('foam_brush2', 'craft', 3, 'gesso, cream, Mod Podge'); use('foam_brush1', 'craft', 3, 'small parts'); use('sponge', 'craft', 2, 'bricks + stencilling')

# ---------- check every supply ----------
rows, fails = [], []
for k, (name, store, url, price, qty, per, unit) in SUPPLIES.items():
    total = sum(a for _, a, _ in need[k]); have = qty * per if per else None
    counted = unit in ('tool', 'box', 'set', 'brush', 'sponge', 'pen', 'roll', 'sheet', 'pc', 'sheets', 'bows', 'stencils')
    ok = (have is None and total <= 15) or (have is not None and have >= total * (1 if counted else MARGIN) - 1e-9)   # whole items: exact count; consumables: 10% spare
    spare = None if have is None or total == 0 else (have - total) / total
    rows.append(dict(id=k, name=name, store=store, url=url, price=price, qty=qty, per=per, unit=unit, need=round(total, 1), have=have, spare=None if spare is None else round(spare * 100),
                     ok=ok, uses=[dict(project=p, amount=round(a, 1), how=h) for p, a, h in need[k]]))
    if not ok: fails.append(k)
data = dict(checked=CHECKED, assumptions=dict(ml_per_ft2=ML_PER_FT2, dab_ml_per_ft2=DAB_ML_PER_FT2, burlap_ml_per_ft2=BURLAP_ML_PER_FT2, podge_ml_per_ft2=PODGE_ML_PER_FT2, clay_g_per_cm3=CLAY_G_PER_CM3, margin=MARGIN),
            supplies=rows, on_hand=ON_HAND, biscuits_needed=biscuits_needed, door=[DW, DH], giant=[GW, GD, GRIDGE], ornament=[W, D, 4.3], boxes=[[b[1], b[2], b[3], b[4], b[5]] for b in BOXES])
(ROOT / 'data' / 'supplies.json').write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
for r in rows: print(f"{'OK ' if r['ok'] else 'FAIL'} {r['id']:<13} need {r['need']:>8} {r['unit']:<7} have {r['have']!s:>6}  spare {r['spare']!s:>5}%")
if fails: print('FAILED:', fails); sys.exit(1)

# ---------- keep the item list in step ----------
items = json.loads(ITEMS.read_text())
by = {i['id']: i for i in items}
cost = lambda keys: round(sum(SUPPLIES[k][3] * SUPPLIES[k][4] for k in keys), 2)
ds_shared = [k for k, v in SUPPLIES.items() if v[1] == 'DeSerres' and k != 'foam_board']
ct_shared = ['packing_tape', 'magic_tape', 'drop_sheet']
base = dict(status='listed', image_checked=True, checked_on=CHECKED, priority='high')
for gone in ('paint', 'paw_stamp', 'red_picks', 'plaid_bows'): by.pop(gone, None)
def upd(id, **kw):
    it = by.setdefault(id, {'id': id}); it.update(base); it.update(kw)
upd('doghouse', section='Tree ornaments', name='Doghouse ornaments (makes 12): 4.3" foam-board doghouses with arched doors, red brick walls, cream shingle roof, cream paw on the gable',
    form_name='Doghouse ornaments, 4.3" (DIY)', store='DeSerres', url=SUPPLIES['foam_board'][2], price=cost(['foam_board']), qty=1, diy=True, made=12, match='match', arrives_by='2026-11-26',
    action='redesigned', verdict_before='no', size_in={'h': 4.3, 'w': 3.4, 'd': 2.7},
    notes='Was 12 unfinished birdhouses (round hole, perch peg): not doghouses. Now built as real doghouses from 3/16" foam board with a printed template: arched door, brick lines scored with a ballpoint pen, cream shingle roof with overhang.',
    how='Print the template (page 1), trace 12 sets onto the foam board and cut with a fresh blade. Score brick lines on the walls and shingle lines on the roof panels with a ballpoint pen. Hot-glue the walls and floor, thread a 30 cm gold loop through the ridge and glue the roof on. Paint the outside walls mortar grey (gesso + a drop of black), then dab barn red on the surface with a sponge so the scored lines stay grey. Paint the roof cream, the door opening and the inside dark, the arch trim cream, and stencil a 1" cream paw on the gable. About 15 min each once cut.')
upd('doghouse_xl', section='Under-tree display', name='Giant doghouse centrepiece (makes 1): 24 x 20 x 26" from two moving boxes, red brick walls, cream shingle roof, arched door, "Home for the Howlidays" sign; the plush golden retriever sits in the doorway',
    form_name='Giant doghouse centrepiece (DIY)', store='Canadian Tire', url=SUPPLIES['box_xl'][2], price=cost(['box_xl']), qty=1, diy=True, made=1, match='match', arrives_by='2026-11-17',
    action='redesigned', verdict_before='no', size_in={'w': GW, 'd': GD, 'h': GRIDGE, 'door_w': DW, 'door_h': DH},
    notes='Had no materials (it assumed a big enough shipping box would arrive). Now two Canadian Tire 24 x 20 x 20" moving boxes, sized so the 12" plush dog sits in a 10 x 13" doorway; paint, glue and the sign are on the supply list.',
    how='Box A: cut all four walls down to 16", keep the bottom flaps taped as the floor. Cut the 10 x 13" arched door in a 24" side (template page 4). Box B: cut two 24 x 10" gable triangles from its long flaps and glue them on top of the front and back walls; cut two 17.6 x 24" roof panels from its 24 x 20" sides. Score brick lines on all walls with a ballpoint pen. Gesso the outside twice (tinted grey), dab red bricks with a sponge, paint the inside dark red-brown. Glue the roof on, then cover it with 3" strips cut from the remaining flaps, overlapping 1" per course, and paint them cream. Glue on a cream trim strip round the door, stencil a 3.6" cream paw on the gable, and Mod Podge the printed 16 x 4" sign under the roof edge. About 4 hours over two sessions.')
upd('gift_boxes', section='Under-tree display', name='Display gifts (makes 4): Canadian Tire moving boxes 18x11x12, 16x16x16, 16x16 cut to 10", 18x11 cut to 7", wrapped in tartan and kraft paw paper',
    form_name='Wrapped display gifts (DIY)', store='Canadian Tire', url=SUPPLIES['box_small'][2], price=cost(['box_small', 'box_medium']), qty=1, diy=True, made=4, match='close', arrives_by='2026-11-17',
    action='redesigned', verdict_before='no', size_in={'boxes': [[b[1], b[2], b[3]] for b in BOXES]},
    notes='Was "boxes from our orders" (not guaranteed). Now four bought boxes of known size; the wrapping-paper and ribbon lengths are calculated from these sizes.',
    how='Cut box C down to 10" and box D to 7" tall, tape all four shut. Wrap A, B and C in tartan paper (two 17" widths each, seam on the bottom) and D in kraft paw paper. Ribbon both ways: velvet on A and C, tartan on B and D; velvet bow on A and C, tartan bow on B, burlap paw bow on D.')
upd('craft_supplies', section='Accents & supplies', name='Craft paints, glue, stencil film & tools for all DIY builds (DeSerres order, itemized in the committee plan)', form_name='Craft paints, glue & tools (DeSerres)',
    store='DeSerres', url='https://www.deserres.ca/', price=cost(ds_shared), qty=1, match='match', arrives_by='2026-11-26', action='new', verdict_before='new', priority='high',
    notes=f'{len(ds_shared)} lines, every quantity calculated from the builds (see output/item_audit.md). Order total with the foam board is over $149, so standard shipping to Alberta is free; no oversized items. Ships in 48 h; allow 5-7 business days to Edmonton.')
upd('ct_supplies', section='Accents & supplies', name='Packing tape, Scotch tape 3-pk & plastic drop sheet (Canadian Tire)', form_name='Tape & drop sheet (Canadian Tire)', store='Canadian Tire',
    url=SUPPLIES['drop_sheet'][2], price=cost(ct_shared), qty=1, match='match', arrives_by='2026-11-17', action='new', verdict_before='new', priority='medium', notes='Pick up with the moving boxes.')
upd('shipping', section='Shipping & fees', name='Amazon.ca shipping on listings without free delivery (estimate; $0 with Prime)', form_name='Shipping (Amazon.ca, est.)', store='Amazon.ca', url='https://www.amazon.ca/',
    price=33.91, qty=1, status='est', match=None, image_checked=False, arrives_by=None, action='new', verdict_before='new', priority='low',
    notes='Tartan ribbon $5.45, Zigby cat $5.21, sherpa pillow $6.11, paw wrap $5.75, red glitter baubles $6.33, mini bows $5.06 per order, from the listings on Nov 13-16. DeSerres ships free (order over $149); Canadian Tire is store pickup.')
by['bones'].update(qty=2, name='3D dog-bone ornaments (makes 24): 5" puffy bones of white air-dry foam clay over a foil core, painted biscuit-cream, sealed',
    notes='1 bag was not enough: 24 bones need about 300 g of clay even with foil cores, and the 60 biscuits about 290 g. Two bags = 1 kg, about 60% spare.',
    how='Scrunch a 4" foil log for each bone, wrap it in clay, shape four round knobs and press to 1" thick against the template (page 3). Push a 25 cm gold loop into one end. Dry 24 h, paint cream twice, dry-brush burnt sienna on the edges, seal with Mod Podge.')
by['faux_treats'].update(made=60, name='Faux dog biscuits (makes 60): foam clay cut with the bone cutters, painted biscuit-tan, sealed; lines the jar round a kraft-paper core',
    notes=f'30 would fill only a fifth of a 7 x 9.9" jar. {biscuits_needed} line the glass ({ring} per ring x {rings} rings + 12 on top) round a crumpled kraft core, so the jar reads full like the board. Inedible, so they last until the 2027 auction.',
    how='Roll clay 1/4" thick, cut 60 bones with the 3" cutter, poke dots with a toothpick, dry, paint tan (gesso + burnt sienna) and seal. Stand a crumpled kraft-paper log in the jar and fill the gap between it and the glass with biscuits, flat against the glass; pile the rest on top.')
by['topper'].update(qty=2, name='Tree topper (makes 1): 24" four-loop bow with two streamers to the doghouse roof, from 4" natural burlap stencilled with black paws',
    notes=f'One 10 yd roll was too little: bow {bow_in}" + streamers {streamer_in:.0f}" + one gift-box bow = {(bow_in + streamer_in + boxbow_in) / 36:.1f} yd. Two rolls (only 2 were in stock on Nov 13: order first).',
    how='Lay the burlap flat and stencil 2.2" black paws every 4.5" with the fabric paint and a dabbing sponge; dry 24 h. Tie a 24" bow with four loops (two up, two down), pinch with floral wire and zip-tie it to the top. Let the two streamers run down the front to the doghouse roof, pinched and puffed every 12" and wired to branches.')
by['paw_disc'].update(name='Paw-print bauble ornaments (makes 30): 4" bauble-shaped wood rounds painted cream, gold rim and cap, black sparkle paw, mini velvet bow',
    how='Paint both sides cream twice (stipple the second coat for a quilted texture), the rim and cap tab gold (3 coats). Stencil a 3" black paw, add the black sparkle medium, seal the front with Mod Podge. Thread a 25 cm gold loop and hot-glue a mini velvet bow on top.')
by['mini_bows'].update(name='Mini red velvet bows, 3.5" (12-pk): on the 30 paw ornaments and the jar', form_name='Mini red velvet bows, 3.5" (12 pc)')
by['gold_picks'].update(qty=1, notes='Gold glitter sprays: 12 fan out behind the topper bow as a gold crown, 16 tucked through the tree. One pack of 28 covers both.')
by['golden'].update(name='Golden retriever plush, sitting, 12" (2 on the tree, 1 in the doorway of the giant doghouse)', form_name='Golden retriever plush, sitting 12"', size_in={'h': 11, 'w': 7, 'd': 11},
    notes='Wild Republic Cuddlekins 12" (about 11" tall sitting). Wired round the body to the trunk under its scarf; one sits in the doghouse doorway.')
by['bandanas'].update(name='Red tartan fringed scarf, 12 x 72" (cut lengthwise into 3" strips: fringed scarves for all 7 plush pets)',
    notes='Cut lengthwise into four 3 x 72" strips, so every piece keeps fringe on its ends: 36" pieces for the three dogs, 18" for the four cats. Seal the cut edges with fabric glue.')
by['tabby_grey'].update(name='Grey tabby kitten plush, sitting, 4.7" (on the tree, fringed tartan scarf)')
by['velvet_ribbon'].update(notes='Deep red velvet, 2.5" x 10 yd: ribbon and bows on gift boxes A and C (8.9 yd).')
by['big_bows'].update(made=14, name='Big tartan bows, 11" with 18" tails (makes 14): hand-tied from the 4" tartan ribbon', notes='14 bows x 1.5 yd = 21 yd of the 60 yd of tartan; replaces the store-bought plaid bows, whose different plaid clashed with our ribbon.')
by['felt']['how'] = 'Cut a 4.5" paw (template page 2) and glue it to the pillow with fabric glue.'
by['bowl']['how'] = 'Stencil two 1.5" white paws on the outside with the oil-based paint marker (display only).'
for it in by.values():
    if it['id'] in ('doghouse', 'doghouse_xl', 'gift_boxes', 'craft_supplies', 'ct_supplies', 'shipping'):
        it.setdefault('reference_crops', []); it.setdefault('look', ''); it.setdefault('viz', None)
order = ['Tree ornaments', 'Ribbon & bows', 'Accents & supplies', 'Under-tree display', 'Gift basket', 'Shipping & fees']
items = sorted(by.values(), key=lambda i: order.index(i['section']))
ITEMS.write_text(json.dumps(items, indent=1, ensure_ascii=False) + '\n')
print('items:', len(items))
