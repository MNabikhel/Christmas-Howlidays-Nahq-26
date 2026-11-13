"""Round 3 (2026-11-13): match the inspiration more closely, at real-world scale.
Records size_in (one unit, inches, from the listing) for every item; the 3D tree reads it."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
P = ROOT / 'data' / 'items.json'
items = json.loads(P.read_text(encoding='utf-8'))
by = {i['id']: i for i in items}
A = 'https://www.amazon.ca/dp/'
def upd(id, **kw):
    it = by[id]; it.update(kw); it['image_checked'] = True; it['checked_on'] = '2026-11-13'; it['status'] = it.get('status') if id == 'gift_card' else 'listed'
# --- replacements / upgrades
upd('golden', name='Golden retriever plush, sitting, ~10" (2 on the tree, 1 under it in a tartan scarf)', url=A+'B01N4NC8QY', store='Amazon.ca', price=19.37, qty=3, match='match', arrives_by='2026-11-17', action='replaced',
    notes='Resin 2.75" ornaments were far too small to read like the inspiration. Sitting golden plush with dark eyes and floppy ears; wired into the lower branches with a tartan-ribbon scarf.', size_in={'h': 10, 'w': 7, 'd': 11}, photo=None)
upd('tabby_grey', name='Grey tabby kitten plush, sitting, 4.7" (on the tree, tartan-ribbon scarf)', url=A+'B0CVNDJS4D', store='Amazon.ca', price=10.66, qty=3, match='match', arrives_by='2026-11-17', action='replaced',
    notes='Wild Republic Pocketkins: sitting grey tabby with white chest, like the kittens in the inspiration. Replaces the 2.25" resin kittens.', size_in={'h': 4.7, 'w': 3.7, 'd': 5.9})
upd('tabby_brown', name='Grey tabby cat plush, 6" tall (under the tree with the dog, tartan scarf)', url=A+'B086H6SNL7', store='Amazon.ca', price=24.99, qty=1, match='match', arrives_by='2026-11-16', action='replaced',
    notes='Douglas Zigby: realistic grey-brown tabby with white bib, the closest to the cat in the inspiration panel. $5.21 shipping on this listing.', size_in={'h': 6, 'w': 3, 'd': 8})
upd('paw_disc', name='Paw-print bauble ornaments (makes 30): 4" bauble-shaped wood rounds painted cream, gold rim & cap, black glitter paw, velvet bow',
    url=A+'B0FC6DWFVL', price=13.90, match='close', arrives_by='2026-11-20', notes='OurWarm 4" wood rounds already cut in a bauble shape with a cap tab, like the paw ornament in the inspiration. 50 pcs, cheaper than the 3" set.', size_in={'h': 4.3, 'w': 3.5, 'd': 0.1})
upd('bones', name='3D dog-bone ornaments (makes 24): 5" puffy bones shaped from white air-dry foam clay, painted biscuit-cream',
    url=A+'B0F86WQG4W', price=22.00, match='close', arrives_by='2026-11-17', notes='The inspiration bones are chunky and 3D, not flat. Lightweight foam clay (500 g) keeps them light enough to hang; also makes the faux biscuits for the jar.', size_in={'h': 1.8, 'w': 5, 'd': 1})
upd('doghouse', match='close', notes='Make Market gabled birdhouses with hanging rope, 4.3" tall: painted barn-red with brick lines, cream roof and arched door trim, cream paw on the gable.', size_in={'h': 4.3, 'w': 3.4, 'd': 2.7})
upd('topper', name='Tree topper (makes 1): 24" four-loop bow with 3 ft streamers, from 4" natural burlap stamped with black paws', url=A+'B0CHMLF3NP', price=16.80, match='match', arrives_by='2026-11-17',
    notes='No 4" burlap with black paws exists; the 2.5" one had brown paws. 4" natural burlap + black paw stamps = exactly the inspiration topper. Only 2 rolls left, order first.', size_in={'h': 24, 'w': 24, 'd': 8, 'ribbon_w': 4, 'len_yd': 10})
upd('velvet_bows', name='Deep red velvet bows with long tails, 5" x 10" (12-pk)', url=A+'B0HDXK13R2', price=23.99, match='match', arrives_by='2026-11-17',
    notes='Wine-red velvet, the same deep red as the bow on the paw ornament in the inspiration (the JOYIN bows were bright red).', size_in={'h': 10.2, 'w': 5.1, 'd': 1})
upd('tartan_ribbon', name='Red/green/black tartan wired ribbon, 4" x 10 yd', url=A+'B0D7WPZDJW', price=33.68, qty=4, match='match', arrives_by='2026-11-21',
    notes='Darker Stewart-style tartan, 4" wide like the cascading ribbon in the inspiration. 40 yd: 6 cascades, poufs, and scarves for the plush pets. $5.45 shipping per order.', size_in={'w': 4, 'len_yd': 10})
upd('velvet_ribbon', qty=1, notes='Deep red velvet with gold back, 2.5" x 10 yd. One roll ties the display gift boxes.', size_in={'w': 2.5, 'len_yd': 10})
upd('basket', name='Natural wicker gift basket with handle & lace liner, 13" x 10.5" x 6"', url=A+'B0CW39X1ZP', price=39.99, match='match', arrives_by='2026-11-17',
    notes='Light natural willow like the inspiration basket (the old one was dark burgundy wicker). 11" tall to the handle.', size_in={'h': 6, 'w': 13, 'd': 10.5, 'handle_h': 11})
upd('bone_pillow', name='Cream sherpa bone pillow, 15" (black felt paw added)', url=A+'B0GS53B213', price=26.57, match='match', arrives_by='2026-11-21',
    notes='Curly cream sherpa bone like the big pillow under the tree in the inspiration; glue on a 4" black felt paw. $6.11 shipping on this listing.', size_in={'h': 3, 'w': 15, 'd': 9})
upd('bandanas', name='Red tartan fringed scarf, 12" x 72" (cut in half: one each for the plush dog & cat)', qty=1, match='match',
    notes='Fold each half to 4" wide so it fits a 10" plush; the real fringe shows on the front like the inspiration panel.', size_in={'w': 12, 'len': 72})
upd('gift_boxes', name='Display gift boxes (makes 5): empty shipping boxes from our orders, wrapped in tartan & kraft paw paper', url=A+'B0FSXRGDGM', store='Amazon.ca (wrapping paper)', price=0.0, qty=1, diy=True, made=5, match='close', arrives_by='2026-11-21',
    notes='The Soul & Lane set was only 3.5" tall. The inspiration has chunky 10-14" presents, so we wrap the boxes our orders arrive in. No extra cost.', size_in={'boxes': [[14, 11, 12], [12, 10, 9], [10, 10, 10], [16, 12, 7], [9, 9, 6]]})
# --- sizes for kept items (from the listings)
S = {'baubles_rgg': {'d_mix': [[2.4, 32], [1.6, 36], [1.2, 32]]}, 'baubles_champ': {'d_mix': [[2.4, 33], [1.6, 34], [1.2, 33]]}, 'glitter_red': {'d': 3.15}, 'glitter_champ': {'d': 3.15},
     'stockings': {'h': 4.3, 'w': 3.9}, 'plaid_bows': {'h': 7, 'w': 5}, 'mini_bows': {'h': 3.5, 'w': 3.5}, 'red_picks': {'h': 17}, 'gold_picks': {'h': 17}, 'pine_picks': {'h': 4, 'w': 3},
     'bowl': {'h': 1.8, 'w': 5.9}, 'jar': {'h': 9.9, 'w': 7}, 'holiday_toy': {'h': 1.8, 'w': 8.7, 'd': 5.7}, 'balls': {'d': 2.58}, 'blanket': {'w': 50, 'len': 60}, 'gift_card': {'h': 2.1, 'w': 3.4},
     'tartan_wrap': {'w': 17, 'len_ft': 33}, 'paw_wrap': {'w': 17, 'len_ft': 20}, 'rope': {'w': 10}, 'floral_wire': {}, 'paint': {}, 'paw_stamp': {'w': 2}}
for k, v in S.items(): by[k].setdefault('size_in', v)
by['mini_bows']['qty'] = 3
# --- new items
new = [
 dict(id='bone_cutters', section='Accents & supplies', name='Bone cookie cutters, 2.7"/3"/3.3" (for the faux biscuits)', store='Amazon.ca', url=A+'B08GJDGNRC', price=8.92, qty=1, status='listed', priority='low', image_checked=True, match='match', checked_on='2026-11-13', arrives_by='2026-11-17', action='new', notes='Metal cutters with soft coating; cut biscuit shapes from the leftover foam clay.', size_in={'w': 3.3}, look='Supply only.', reference_crops=[], viz=None),
 dict(id='felt', section='Accents & supplies', name='Black felt sheets, 8" x 12" (paw on the bone pillow)', store='Amazon.ca', url=A+'B0DX78HCZC', price=8.50, qty=1, status='listed', priority='low', image_checked=True, match='match', checked_on='2026-11-13', arrives_by='2026-11-17', action='new', notes='1 mm black felt; cut a 4" paw and glue it to the sherpa pillow.', size_in={'w': 8, 'h': 12}, look='Supply only.', reference_crops=[], viz=None),
 dict(id='faux_treats', section='Gift basket', name='Faux dog biscuits for the jar (makes 30): foam clay cut with the bone cutters, painted biscuit-tan, sealed', store='Amazon.ca (cutters)', url=A+'B08GJDGNRC', price=0.0, qty=1, diy=True, made=30, status='listed', priority='high', image_checked=True, match='close', checked_on='2026-11-13', arrives_by='2026-11-17', action='new', notes='The inspiration jar is full of biscuits, but real treats would expire before the 2027 auction. These are inedible and last.', size_in={'w': 3, 'h': 1.2}, look='Biscuit-coloured bone treats filling the glass jar.', reference_crops=['gift_basket'], viz='Biscuits in the jar'),
]
items = [i for i in items if i['id'] not in ('plaid_balls',)]
for n in new:
    if n['id'] not in by: items.append(n)
order = ['Tree ornaments', 'Ribbon & bows', 'Accents & supplies', 'Under-tree display', 'Gift basket']
items.sort(key=lambda i: order.index(i['section']))
P.write_text(json.dumps(items, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
