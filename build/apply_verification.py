"""One-off: apply the 2026-11-13 photo verification to data/items.json."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
P = ROOT / 'data' / 'items.json'
items = {i['id']: i for i in json.loads(P.read_text(encoding='utf-8'))}
A = 'https://www.amazon.ca/dp/'
# id: (verdict_before, action, url|None, name|None, price, qty, match, arrives_by, note, extra)
U = {
 'baubles_rgg':  ('match','kept',None,None,43.99,2,'match','2026-11-17','Red, green & gold mix with glitter, gold caps and a few tartan-print balls; matches the tree palette.',{}),
 'baubles_champ':('close','kept',None,None,40.99,1,'close','2026-11-18','Champagne/gold mix, some lace-pattern balls; reads cream-gold on the tree.',{}),
 'glitter_red':  ('match','kept',None,None,54.23,1,'match','2026-11-16','12 large red & gold glitter/painted 3.15" balls. Price up from $29.99, so qty cut to 1.',{}),
 'glitter_champ':('no','replaced',A+'B09CMDR2D6','Large 3.15" champagne glitter baubles (12-pc)',39.99,1,'match','2026-11-17','Old listing unavailable. New: champagne glitter 3.15" balls with sequin texture.',{}),
 'plaid_balls':  ('close','kept',None,None,14.99,2,'close','2026-11-20','Red/green tartan fabric balls (not in the photo). Qty cut to 2 for budget. Price not shown online; confirm in store.',{}),
 'golden':       ('close','replaced',A+'B0C5LH4K55','Golden retriever ornaments with red plaid fringed scarf, 2.75"',27.26,6,'match','2026-11-16','Sitting golden in a red/black plaid fringed scarf; closer to the photo than the old knit-hat version, and $16 cheaper each.',{}),
 'tabby_grey':   ('match','kept',None,'Grey tabby kitten ornaments with red & white scarf',28.80,4,'match','2026-11-16','Grey-and-white tabby kitten, red/white knit scarf with pompom; same as the cats in the photo. Qty up to 4.',{}),
 'tabby_brown':  ('match','kept',None,'Brown tabby kitten ornament with red & white scarf',28.81,1,'match','2026-11-25','Same style in brown tabby. Only 1 left in stock, so qty 1 (extra grey kitten covers the gap).',{}),
 'paw_disc':     ('no','DIY',A+'B0DM4YQRBV','Paw-print disc ornaments (makes 30): 3" wood rounds painted cream, black glitter paw, mini velvet bow',22.99,1,'close','2026-11-17','No bought cream disc with black paw exists (all are clay prints or personalised). Old wood-slice link unavailable; new 60-pk 3" rounds with holes.',{'diy':True,'made':30}),
 'bones':        ('no','DIY',A+'B0G5B5ZLHN','Dog-bone ornaments (makes 24): chunky 4" wood bones painted biscuit-cream',19.89,1,'close','2026-11-18','Bought bone ornaments are all personalised/plaid. Old cutouts arrive Dec 2+; new 24-pk chunky bones with holes arrive Nov 18.',{'diy':True,'made':24}),
 'doghouse':     ('no','DIY',A+'B0BKBVLS3V','Red doghouse ornaments (makes 12): 4.3" wood birdhouses painted barn-red, cream roof & door trim, cream paw on the gable',54.93,1,'close','2026-11-19','Only bought doghouses are Snoopy (brand) or one-off glass. Gabled 4.3" birdhouses with hanging loop are the closest base. Price was $76.90 on the old listing.',{'diy':True,'made':12}),
 'topper':       ('no','DIY',A+'B09H2YMHCL','Tree topper (makes 1): 4-loop bow from 2.5" natural burlap paw-print wired ribbon',20.56,1,'close','2026-11-20','Old link was a mixed 6-roll set (black/white/colour). New: natural burlap with dark-brown paws; closest to the black-paw burlap in the photo.',{'diy':True,'made':1}),
 'stockings':    ('no','replaced',A+'B0FRF9R1HD','Mini knit stockings, red/green/cream, 4" (12-pk)',22.99,1,'match','2026-11-17','Old plaid set unavailable. New: cable-knit minis in red, forest green and cream with fluffy cuffs.',{}),
 'tartan_ribbon':('match','kept',None,None,20.33,6,'match','2026-11-18','Red/green tartan wired ribbon with gold edge, 2.5" x 10 yd.',{}),
 'velvet_ribbon':('match','kept',None,None,36.37,2,'match','2026-11-19','Deep-red velvet with gold back, 2.5" x 10 yd. Price up from $16.99, qty cut to 2.',{}),
 'plaid_bows':   ('match','kept',None,None,43.50,1,'match','2026-11-16','Red tartan bows with tails. Price up from $25.99, qty cut to 1 (12 bows).',{}),
 'velvet_bows':  ('no','replaced',A+'B07K7W8GBC','Large red velvet bows, 16" x 9" (12-pk)',29.99,1,'match','2026-11-18','Old listing showed BROWN velvet bows arriving Dec 3+. New: true red velvet bows.',{}),
 'mini_bows':    ('match','kept',None,None,15.41,3,'match','2026-11-18','Small deep-red velvet bows on twist ties.',{}),
 'red_picks':    ('match','kept',None,None,48.55,1,'match','2026-11-16','Red glitter berry sprays; matches the red berries in the photo.',{}),
 'gold_picks':   ('match','kept',None,None,20.40,2,'match','2026-11-23','Gold glitter berry & leaf picks.',{}),
 'pine_picks':   ('match','kept',None,None,26.99,1,'match','2026-11-18','Pine sprigs with pinecones and red berries.',{}),
 'floral_wire':  ('match','kept',None,None,29.92,1,'match','2026-11-16','Green 22-gauge paddle wire, 3 spools.',{}),
 'gift_boxes':   ('close','kept',None,None,47.54,1,'close','2026-11-16','Nesting boxes (red/green/kraft prints); they get wrapped in the kraft paw & tartan paper anyway.',{}),
 'tartan_wrap':  ('no','replaced',A+'B0F9P8CHMT','Red tartan wrapping paper (reversible)',19.79,1,'match','2026-11-17','Old roll was green with tan check. New: red tartan with green & white lines, like the boxes in the photo.',{}),
 'paw_wrap':     ('no','replaced',A+'B0FSXRGDGM','Kraft wrapping paper with black paw prints',22.68,1,'match','2026-11-18','Old listing unavailable (and was red bones). New: brown kraft with black paws, exactly the boxes in the photo.',{}),
 'bone_pillow':  ('close','replaced',A+'B0GR99NF8V','Plush bone pillow, cream with black paw',11.99,1,'match','2026-11-24','Soft cream/light-grey bone with a black embroidered paw, like the pillow under the tree.',{}),
 'bowl':         ('no','replaced',A+'B0FX23RP9K','Red glazed ceramic pet bowl with white dots',19.99,1,'close','2026-11-17','Old bowl unavailable. No red bowl with a white paw exists on Amazon.ca; this is glossy red ceramic with white dots. Optional: add a white paw with a paint pen.',{}),
 'basket':       ('close','kept',None,None,53.60,1,'close','2026-11-22','Wicker basket with handles and cream liner; a bit darker than the natural wicker in the photo. Price up from $29.99.',{}),
 'blanket':      ('no','replaced',A+'B0FKBGPHCV','Red flannel throw with white paw prints & snowflakes, 50x60"',43.34,1,'close','2026-11-19','Old one was snowflakes only. New: red with white paws (plus snowflakes); photo is red knit with white paws.',{}),
 'jar':          ('no','replaced',A+'B07GZ76ZZ6','Glass cookie jar with glass lid (for the treat-jar look; leave empty or fill with toys)',29.99,1,'match','2026-11-17','Old link was a 40 lb steel food bin. New: clear glass jar with knob lid, like the photo. No treats (auction is 2027).',{}),
 'holiday_toy':  ('no','replaced',A+'B0GR99NF8V','Plush bone toy, cream with black paw (for the basket)',11.99,1,'match','2026-11-24','Old toy was Santa-in-chimney. Now a cream bone with black paw, as in the basket photo.',{'store':'Amazon.ca'}),
 'rope':         ('no','replaced',A+'B0BBLFFB17','Christmas rope toys, red/white/green (9-pc)',21.99,1,'match','2026-11-18','Old rope was navy/yellow. New set is red, white and green braided ropes.',{'store':'Amazon.ca'}),
 'balls':        ('no','replaced',A+'B0DF7SGGPQ','Red tennis balls (4-pk)',24.96,1,'match','2026-11-18','Old KONG balls were yellow-green. These are red felt with white seams, as in the basket.',{'store':'Amazon.ca'}),
 'bandanas':     ('no','replaced',A+'B075ZCW8JD','Red tartan scarves with fringe (2) for the dog & cat',35.28,2,'match','2026-11-16','Bandanas swapped for real fringed red/green tartan scarves, the exact look the dog and cat wear.',{'store':'Amazon.ca'}),
 'gift_card':    ('match','kept',None,None,100.0,2,'match','2026-11-30','Buy in store at Homes Alive Pets.',{}),
 'paint':        (None,'kept',None,None,None,None,None,None,'Michaels site blocks automated browsing (403); price not re-checked. Buy in store.',{}),
 'paw_stamp':    (None,'kept',None,None,None,None,None,None,'Michaels site blocks automated browsing (403); price not re-checked. Buy in store.',{}),
}
for k, (vb, act, url, name, price, qty, match, arr, note, extra) in U.items():
    it = items[k]
    it['verdict_before'] = vb; it['action'] = act
    if url: it['url'] = url; it['store'] = extra.pop('store', 'Amazon.ca')
    if name: it['name'] = name
    if price is not None: it['price'] = price; it['status'] = 'listed' if k != 'gift_card' else 'face'
    if qty is not None: it['qty'] = qty
    it['diy'] = extra.get('diy', it.get('diy', False) if act == 'kept' else False)
    if not it['diy']: it.pop('made', None); it.pop('diy', None)
    else: it['made'] = extra.get('made', it.get('made'))
    it['image_checked'] = match is not None
    it['match'] = match; it['checked_on'] = '2026-11-13' if match else None; it['arrives_by'] = arr; it['notes'] = note
P.write_text(json.dumps(list(items.values()), indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
