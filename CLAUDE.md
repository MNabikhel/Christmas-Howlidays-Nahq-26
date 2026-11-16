# Home for the Howlidays: instructions for Claude Code

You are helping Muntaz (PCL Corporate Finance, Edmonton) finish the department's 2026 Holiday Tree Gallery tree. Read `GOAL.md` first: it is the agreed definition of done, and every change is checked against it.

## Where things are
- **Target look:** `inputs/inspiration.png`, with close-ups in `inputs/crops/`. Organizer rules are in `inputs/committee_email.md` and `inputs/kickoff_deck_notes.md`.
- **The plan:** `build/build_plan.py` defines every board element and its 2-4 options (the first option of each element is the default, the closest match to the board), every product and every DIY supply. It writes `data/options.json` (what the 3D page swaps), `data/items.json` (the default order list) and `data/supplies.json` (every supply with its calculated quantity). `build/resolve.js` is the same resolver in the browser; `build/check_resolve.js` proves they agree.
- **Lookbook:** `data/lookbook.json` (board notes, sizes, alternatives considered, `verified` results) plus images in `data/lookbook/`, built into `output/lookbook.html` by `build/build_lookbook.py`, which also writes the checks for each element to `data/verify.json`. One page per board element.
- **Build everything:** run `npm install`, then `npm run build`. This writes the Tree Gallery form, the committee plan, the templates, the 3D preview, the verification report and the item audit, all in `output/`.

## Your job in a Claude in Chrome session
Amazon.ca blocks automated browsing from the cloud, so the Amazon checks happen here, in Muntaz's own Chrome.

1. Run `/chrome` and confirm it is connected. If it isn't, stop and tell Muntaz how to connect it: `claude --chrome`, with the extension signed in to the same account.
2. For each element in `data/verify.json`, work through its checks (the same list is on each lookbook page):
   - Open each listing and look at the main photo and the gallery.
   - Record today's price, stock, and the delivery date to Edmonton (T6E, the Homes Alive Pets South Edmonton postal code is fine).
   - Record whether the photo still matches the board crop for that element.
   - Write the result into `data/lookbook.json` under `elements.<id>.verified` as `{"date": "YYYY-MM-DD", "items": [{"asin", "price", "in_stock", "arrives_by", "photo_ok", "note"}]}`.
3. **Searches:** where a check asks for one, compare at least 3 candidates against the board crop. Add each to `elements.<id>.considered` with its photo saved as `data/lookbook/p_<ASIN>.jpg`, its price and a one-line "why not".
4. **Price or stock changed:** update the price in `build/build_plan.py` (the `cat(...)` or `SUP` entry). If a default is sold out or arrives after Nov 30, make the next-best option the default (move it first in its element's `options`) and say why.
5. Run `npm run build` and tell Muntaz what changed.

## Hard rules
- **Never buy anything.** Do not log in, add to cart, check out or buy. Browse and record only. On a login wall or CAPTCHA, skip and ask Muntaz.
- **The form and order list come from `build/build_plan.py`.** Never edit `data/items.json` by hand; change the plan and run `npm run build`, which fails if a supply runs short, the page and the build disagree, or less than $75 is left. Muntaz delegated the choices on Nov 16: keep the board-match defaults unless a check fails, and report every change.
- **Budget:** at most $2,000 including GST and shipping, with at least $75 spare. Gift cards are GST-exempt.
- **Delivery:** everything in Edmonton by Nov 30; aim for Nov 21.
- **Excluded:** no lights, no tree skirt, no PCL, Oilers or other branding, and no food.
