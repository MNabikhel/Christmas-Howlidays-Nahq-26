# Home for the Howlidays: instructions for Claude Code

You are helping Muntaz (PCL Corporate Finance, Edmonton) finish the department's 2026 Holiday Tree Gallery tree. Read `GOAL.md` first: it is the agreed definition of done, and every change is checked against it.

## Where things are
- **Target look:** `inputs/inspiration.png`, with close-ups in `inputs/crops/`. Organizer rules are in `inputs/committee_email.md` and `inputs/kickoff_deck_notes.md`.
- **Shopping list:** `data/items.json`. Every DIY supply, with its calculated quantity, is in `data/supplies.json`, written by `build/build_plan.py`.
- **Lookbook:** `data/lookbook.json` plus images in `data/lookbook/`, built into `output/lookbook.html` by `build/build_lookbook.py`. One page per inspiration-board element.
- **Build everything:** run `npm install`, then `npm run build`. This writes the Tree Gallery form, the committee plan, the templates, the 3D preview, the verification report and the item audit, all in `output/`.

## Your job in a Claude in Chrome session
Amazon.ca blocks automated browsing from the cloud, so the Amazon checks happen here, in Muntaz's own Chrome.

1. Run `/chrome` and confirm it is connected. If it isn't, stop and tell Muntaz how to connect it: `claude --chrome`, with the extension signed in to the same account.
2. For each element in `data/lookbook.json`, work through its `verify` list:
   - Open each listing and look at the main photo and the gallery.
   - Record today's price, stock, and the delivery date to Edmonton (T6E, the Homes Alive Pets South Edmonton postal code is fine).
   - Record whether the photo still matches the board crop for that element.
   - Write the result into the element as `"verified": {"date": "YYYY-MM-DD", "items": [{"asin", "price", "in_stock", "arrives_by", "photo_ok", "note"}]}`.
3. **Searches:** where the `verify` list asks for one (for example, a closer tabby cat), compare at least 3 candidates against the board crop. Add each to `alternatives` with its photo saved as `data/lookbook/p_<ASIN>.jpg`, its price and a one-line "why not". Only change `chosen` if a candidate is a clearly better match that arrives by Nov 21; say so in `verdict_note`.
4. Run `python3 build/build_lookbook.py` and tell Muntaz what changed.

## Hard rules
- **Never buy anything.** Do not log in, add to cart, check out or buy. Browse and record only. On a login wall or CAPTCHA, skip and ask Muntaz.
- **The form and order list change only after approval.** Do not edit `data/items.json`, the Tree Gallery form or the order list until Muntaz has approved the lookbook page for that element. Then apply it, run `npm run build`, and check that `build/build_plan.py` still passes.
- **Budget:** at most $2,000 including GST and shipping, with at least $75 spare. Gift cards are GST-exempt.
- **Delivery:** everything in Edmonton by Nov 30; aim for Nov 21.
- **Excluded:** no lights, no tree skirt, no PCL, Oilers or other branding, and no food.
