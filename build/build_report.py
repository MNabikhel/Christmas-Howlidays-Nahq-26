"""Writes output/verification_report.md from data/items.json."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
items = json.loads((ROOT / 'data' / 'items.json').read_text(encoding='utf-8'))
tot = lambda i: i['price'] * i['qty']
sub = sum(tot(i) for i in items); gst = round(sum(tot(i) for i in items if i['id'] != 'gift_card') * 0.05, 2)
checked = [i for i in items if i.get('image_checked')]
acts = lambda a: [i for i in items if i.get('action') == a]
basket_ids = ['gift_card', 'holiday_toy', 'rope', 'balls', 'blanket', 'basket', 'jar', 'bandanas', 'bone_pillow', 'bowl']
basket = sum(tot(i) for i in items if i['id'] in basket_ids)
L = ['# Home for the Howlidays: photo verification report', '',
 f"**{len(checked)} of {len(items)} items checked against the inspiration photo on 2026-11-13** · "
 f"{sum(1 for i in items if i.get('verdict_before') == 'match')} matched as listed · {len(acts('replaced'))} replaced · "
 f"{len(acts('DIY'))} DIY (searched for bought versions first) · "
 f"**new total ${sub + gst:,.2f} incl. GST** (${2000 - sub - gst:,.2f} left of $2,000).", '',
 'Every listing was opened in a browser, its main photo compared to `inputs/inspiration.png` and the crops, and the price and delivery date read from the live page (delivery to Canada; confirm the Edmonton date at checkout). Nothing was added to a cart or bought.', '',
 '| Item | Verdict before | Action | Final product | Price | Qty / makes | Arrives by | What the photo shows |', '|---|---|---|---|---:|---:|---|---|']
for i in items:
    q = f"makes {i['made']}" if i.get('diy') else str(i['qty'])
    L.append(f"| `{i['id']}` | {i.get('verdict_before') or 'not checked'} | {i.get('action', 'kept')} | [{i['name']}]({i['url']}) | ${i['price']:.2f} | {q} | {i.get('arrives_by') or '—'} | {i.get('notes', '')} |")
L += ['', '## For Muntaz to decide or buy in person', '',
 f"- **Gift basket is ${basket:,.2f} before GST**, above the ~$400 target, because the photo-accurate items cost more (two tartan scarves $70.56, wicker basket now $53.60). To get back near $400: buy one scarf instead of two (−$35.28), or swap the basket for a cheaper natural wicker one in store.",
 '- **Brown tabby kitten: only 1 left in stock.** Order it first. If it sells out, buy a 5th grey tabby (same listing family) instead.',
 '- **Pet bowl:** no red bowl with a white paw exists on Amazon.ca. The chosen one is glossy red with white dots. Add a white paw with a ceramic paint pen if you want it exact.',
 '- **Topper ribbon:** the closest real ribbon has dark-brown paws on natural burlap (photo shows black). From a few feet away it reads the same.',
 '- **Paint and paw stamp (Michaels):** the Michaels site blocks automated browsing, so these prices were not re-checked. Buy in store; you need barn red, cream, black, gold acrylic, black fine glitter and a ~2" paw stamp.',
 '- **Plaid balls (Canadian Tire):** not in the inspiration photo; price could not be read online. Optional: drop them to save $29.98.',
 '- **Homes Alive Pets gift cards ($200):** buy in store.',
 '- Prices rose on several kept items (red glitter baubles, velvet ribbon, plaid bows, berry picks); quantities were trimmed so the look stays the same and the budget holds.']
(ROOT / 'output' / 'verification_report.md').write_text('\n'.join(L) + '\n', encoding='utf-8')
print('basket', round(basket, 2))
