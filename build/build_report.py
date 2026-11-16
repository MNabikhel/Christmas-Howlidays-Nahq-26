"""Writes output/verification_report.md from data/items.json."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
items = json.loads((ROOT / 'data' / 'items.json').read_text(encoding='utf-8'))
tot = lambda i: i['price'] * i['qty']
sub = sum(tot(i) for i in items); gst = round(sum(tot(i) for i in items if i['id'] != 'gift_card') * 0.05, 2)
checked = [i for i in items if i.get('image_checked')]
acts = lambda a: [i for i in items if i.get('action') == a]
basket_ids = ['gift_card', 'holiday_toy', 'rope', 'balls', 'blanket', 'basket', 'jar', 'bandanas', 'bone_pillow', 'bowl', 'faux_treats', 'tabby_brown']
basket = sum(tot(i) for i in items if i['id'] in basket_ids)
L = ['# Home for the Howlidays: photo verification report', '',
 f"**{len(checked)} of {len(items)} items checked against the inspiration photo on 2026-11-13** · "
 f"{sum(1 for i in items if i.get('verdict_before') == 'match')} matched as listed · {len(acts('replaced'))} replaced · "
 f"{len(acts('DIY'))} DIY (searched for bought versions first) · {len(acts('new'))} added · "
 f"**new total ${sub + gst:,.2f} incl. GST** (${2000 - sub - gst:,.2f} left of $2,000).", '',
 'Every listing was opened in a browser, its main photo compared to `inputs/inspiration.png` and the crops, and the price and delivery date read from the live page (delivery to Canada; confirm the Edmonton date at checkout). Nothing was added to a cart or bought.', '',
 '| Item | Verdict before | Action | Final product | Price | Qty / makes | Arrives by | What the photo shows |', '|---|---|---|---|---:|---:|---|---|']
for i in items:
    q = f"makes {i['made']}" if i.get('diy') else str(i['qty'])
    L.append(f"| `{i['id']}` | {i.get('verdict_before') or 'not checked'} | {i.get('action', 'kept')} | [{i['name']}]({i['url']}) | ${i['price']:.2f} | {q} | {i.get('arrives_by') or '—'} | {i.get('notes', '')} |")
SHIP = 39.06  # listings that charge shipping without Prime: tartan ribbon, Zigby cat, sherpa pillow, paw wrap, red glitter balls, plaid bows, mini bows
matchN = sum(1 for i in items if i.get('match') == 'match'); judged = sum(1 for i in items if i.get('match'))
G = ['', '## Goal', '',
 '**Win the 2026 Tree Gallery with a tree that stops people in their tracks, matches our inspiration board item for item, and is built exactly as the 3D preview shows.** Full goal and tests in `GOAL.md`.', '',
 '| Test | Status |', '|---|---|',
 '| 1. Wow from across the room | 28" doghouse centrepiece with the family dog in the doorway, burlap ribbon waterfall to the floor, gold crown behind the topper, plush pets front and centre |',
 f'| 2. Every item matches the board | {matchN} of {judged} items `match`; the rest are `close` with a fix noted below |',
 '| 3. Realistic and true to scale | every item placed at its listing size; living room or office setting; person for scale (5\'0"-6\'2") with height labels |',
 f'| 4. Within the rules | ${sub + gst:,.2f} incl. GST (${sub + gst + SHIP:,.2f} with the shipping some listings charge); arrives by Nov 21; no lights, skirt, brands or food |',
 '| 5. Paperwork ready | Tree Gallery form (original layout) and committee plan export as Word from the preview page |', '',
 '## Inspiration scorecard', '',
 '| Board element | What we have | Match |', '|---|---|---|',
 '| Paw-print ornaments | 30 DIY 4" bauble-shaped discs, cream with black glitter paw, gold rim, velvet bow | match |',
 '| Bone ornaments | 24 DIY 5" puffy foam-clay bones, biscuit-cream | match |',
 '| Mini dog & cat ornaments | 2 golden retriever plush (10") + 3 tabby plush (4.7") in tartan scarves | match |',
 '| Doghouse ornaments | 12 DIY 4.3" doghouses: red brick, cream roof, arched door, paw on gable | match |',
 '| Red, forest green, cream & gold baubles | 200 red/green/gold + 100 champagne + 12 red-gold 3.15" + 12 champagne 3.15" + 12 green 4" | match |',
 '| Plaid and velvet ribbons | 5 cascades of 4" tartan, 10 big tartan bows, 12 plaid bows, 12 wine-velvet bows | match |',
 '| Mini pet stockings | 12 knit minis (red, green, cream), 4.3" | close: knit, not plaid; the cuffs match |',
 '| Pet toys and treats in a gift basket | natural wicker basket, glass jar of faux biscuits, red tennis balls, rope toys, plush bone | match |',
 '| Gift cards from local pet stores | 2 x $100 Homes Alive Pets | match |',
 '| Cozy pet blanket or throw | red flannel with white paws & snowflakes | close: flannel, not knit; same colours and paws |',
 '| Gold accents and festive greens | gold crown + gold glitter sprays, pine & cone picks, glossy red berries | match |',
 '| Burlap paw-print topper | 24" 4-loop bow from 4" burlap, black paws stamped (DIY), streamers to the floor | match |',
 '| Sherpa bone pillow & red bowl under the tree | 15" cream sherpa bone + black felt paw; red bowl with two painted white paws | match |',
 '| Dog & cat in tartan scarves | plush golden retriever in the doghouse doorway + tabby beside it, in the real fringed scarf | match |',
 '| Doghouse (board panel) | 28" giant doghouse centrepiece built from a shipping box (DIY, $0) | match |',
 '', '**Where the 3D preview approximates:** the plush pets, stockings and pine picks are photo cutouts that turn to face you; the person is a neutral mannequin at the chosen height; the rooms are drawn, not photographed.']
L += G
L += ['', '## For Muntaz to decide or buy in person', '',
 '- **Order these first (low stock):** 4" natural burlap for the topper (2 left).',
 '- **Giant doghouse:** keep the largest shipping box (about 26 x 22 in) and one more for the roof; plan it for the second craft session.',
 '- **Plush pets on the tree:** secure each with floral wire around the body under the scarf and to a sturdy inner branch; the 10" goldens go on the lower-middle branches at the front.',
 f'- **Gift basket is about ${basket:,.0f}** (incl. the plush dog & cat that sit beside it). It is above the original ~$400 guideline, but it is the auction prize, so I think it is worth it. Drop the Zigby cat (-$24.99) if you want it lower.',
 '- **Shipping:** 7 listings charge $5-6 shipping without Prime (about $39 total). Use a Prime account, or keep it within the buffer.',
 '- **Bowl:** no red bowl with a white paw exists on Amazon.ca; add a white paw with the cream paint if you want it exact.',
 '- **Paint and paw stamp (Michaels):** the Michaels site blocks automated browsing, so these prices were not re-checked. Buy in store: barn red, cream, black, gold and tan acrylic, black fine glitter, a 2" paw stamp, and a clear sealer.',
 '- **Homes Alive Pets gift cards ($200):** buy in store.',
 '- **Plan two craft sessions** the week of Nov 16 (doghouses, discs and bones need paint and drying time).']
(ROOT / 'output' / 'verification_report.md').write_text('\n'.join(L) + '\n', encoding='utf-8')
print('basket', round(basket, 2))
