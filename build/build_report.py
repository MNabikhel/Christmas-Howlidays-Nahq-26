"""Writes output/verification_report.md: the board-match plan, element by element, and every item on it."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
O = json.loads((ROOT / 'data' / 'options.json').read_text(encoding='utf-8'))
items = json.loads((ROOT / 'data' / 'items.json').read_text(encoding='utf-8'))
SUP = json.loads((ROOT / 'data' / 'supplies.json').read_text(encoding='utf-8'))
LB = json.loads((ROOT / 'data' / 'lookbook.json').read_text(encoding='utf-8'))
T = SUP['totals']; money = lambda n: f'${n:,.2f}'
pick = lambda e: next(o for o in e['options'] if o['id'] == e['default'])
board = [e for e in O['elements'] if e['id'] not in ('flourish', 'giant')]
m = sum(1 for e in board if pick(e)['match'] == 'match'); c = sum(1 for e in board if pick(e)['match'] == 'close')
verified = [k for k, v in LB['elements'].items() if v.get('verified')]
L = ['# Home for the Howlidays: plan and verification report', '',
     f"**Board match: {m} of {len(board)} board elements `match`, {c} `close`** · {len(items)} lines · **{money(T['grand'])} incl. GST and shipping** ({money(T['left'])} left of $2,000; floor $75) · "
     f"verified today: {len(verified)} of {len(LB['elements'])} elements (the Amazon checks run in the Chrome session, see `CLAUDE.md`).", '',
     'Every option was built from its listing or DIY template, sized from the listing, and compared with the board crop. `output/lookbook.html` shows each element beside the board; the 3D page swaps any option in and updates the list, the budget and the Word exports.', '',
     '## Goal (GOAL.md)', '', '| Test | Status |', '|---|---|',
     f'| 1. A lookbook page for every board element | {len(O["elements"])} pages: board crop, what we buy or build, 3D close-up, size to scale, swap options, alternatives, checks |',
     f'| 2. Every element `match`, or `close` with a reason | {m} match, {c} close (reason on its page) |',
     f'| 3. Verified on the day we finalize | {"done for " + ", ".join(verified) if verified else "not yet: run the Chrome session"} |',
     '| 4. Buildable | every DIY piece has materials, quantities from real dimensions with 10%+ spare (build fails otherwise), a true-size template and steps |',
     '| 5. The preview is what we buy | every 3D piece is the option on the list, at its listing or template size |',
     f'| 6. Within the rules | {money(T["grand"])} incl. GST; latest delivery {max(i["arrives_by"] for i in items if i.get("arrives_by"))}; no lights, skirt, branding or food |',
     '| 7. Nothing hidden | each lookbook page lists what is not yet verified |', '',
     '## Element by element', '', '| Board element | Board match (default) | Verdict | Other options in Swap pieces |', '|---|---|---|---|']
for e in O['elements']:
    o = pick(e); others = '; '.join(x['label'] for x in e['options'] if x['id'] != o['id'])
    L.append(f"| {e['title']} | {o['label']} | {o['match'] or 'extra, off'}: {o['why']} | {others} |")
L += ['', '## Every line on the order list', '', '| Item | Store | Price | Qty / makes | Total | Arrives by | Notes |', '|---|---|---:|---:|---:|---|---|']
for i in items:
    q = f"makes {i['made']}" if i.get('diy') else str(i['qty'])
    L.append(f"| [{i.get('form_name') or i['name']}]({i['url']}) | {i['store']} | {money(i['price'])} | {q} | {money(i['total'])} | {i.get('arrives_by') or 'in store'} | {(i.get('notes') or '').replace('|', '/')} |")
late = [i for i in items if i.get('arrives_by') and i['arrives_by'] > '2026-11-21']
L += ['', '## For Muntaz', '',
      '- **Order on Nov 17:** Amazon.ca (one order; the listings with delivery charges are in the shipping line), DeSerres (one order over $149 ships free), Canadian Tire pickup (boxes, tape, drop sheet).',
      '- **Arrives after Nov 21 but before Nov 30:** ' + '; '.join(f"{i.get('form_name') or i['name']} ({i['arrives_by']})" for i in late) + '.',
      '- **Print:** `output/HP26_Templates.pdf` at Actual size: pages 1-2 on 11 x 17, page 4 landscape, the rest Letter.',
      '- **Homes Alive Pets gift cards ($200):** buy in store (GST-exempt).',
      '- **Craft sessions** once DeSerres arrives (about Nov 24-26): cut and build first, paint and finish second. Clay bones need 48 h to dry, so make them first (the clay arrives Nov 20).']
(ROOT / 'output' / 'verification_report.md').write_text('\n'.join(L) + '\n', encoding='utf-8')
print('report ok', m, 'match', c, 'close')
