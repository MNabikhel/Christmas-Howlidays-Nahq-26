# Home for the Howlidays: make the shopping list actually match the tree

You're helping Muntaz (PCL Corporate Finance, Edmonton) finish the department's 2026 Holiday Tree Gallery tree.
Read this whole file before doing anything.

## Background
- Theme: **Home for the Howlidays**, a pet-themed tree. The target look is `inputs/inspiration.png`. Detail crops are in `inputs/crops/`.
- Rules from the organizers are in `inputs/committee_email.md` and `inputs/kickoff_deck_notes.md`.
- A first pass already produced a 37-item shopping list (`data/items.json`), a filled Word form (`output/HP26_Tree_Gallery_Form_Corporate_Finance.docx`) and a clickable 3D preview of the tree (`output/howlidays_tree_preview.html`).
- **The problem:** that first pass chose products from search-result titles only. It never saw the product photos, and Muntaz says the items don't look like the tree. Your job is to fix that by actually looking at each product in the browser.

## You need the browser
This task depends on Claude in Chrome. Run `/chrome` first and confirm "Status: Enabled". If it isn't connected, stop and tell Muntaz how to connect it (`claude --chrome`, extension signed in to the same account). Don't try to do this task blind.

## Hard rules
- Budget: **total incl. 5% GST must be ≤ $2,000**. Gift cards are GST-exempt. Aim to keep at least ~$75 unspent for price changes. `python3 build/build_tree.py` prints the totals.
- Gift basket (gift cards, toys, blanket, basket, jar, scarves, plus the bone pillow and bowl under the tree) should stay around **$400**.
- Stores: Amazon.ca first, plus Edmonton stores (Michaels canada.michaels.com, Canadian Tire, Walmart.ca, Homes Alive Pets, Pet Valu, PetSmart.ca, Dollarama, Etsy sellers that ship to Canada in time). Prices in **CAD**.
- Everything must arrive in Edmonton **by Nov 30, 2026** (decorating deadline is Dec 3). Check the delivery estimate on the listing.
- No lights (tree is pre-lit), no tree skirt, no PCL/Oilers/other brand theming, no food or treats (the auction is in 2027, so they'd expire).
- **Do not log in, add to cart, check out or buy anything.** Browse and record only. If a site shows a login wall or CAPTCHA, skip it or ask Muntaz.
- If nothing close to an item exists, make it **DIY**: set `"diy": true`, `"made": <count>`, `price` = materials cost, `qty` = 1, link to the main material, and update `DIY_HOW` in `build/tree.js`. In the Word form, DIY shows "DIY" in the Cost column.

## How to check each item
Work through `data/items.json` in this order: `priority: "high"` first, then `"medium"`, then `"low"`. Skip `paint`, `paw_stamp` and `floral_wire` beyond confirming the link works and the price.

For each item:
1. Look at the reference crops listed in `reference_crops` (open the jpgs in `inputs/crops/`) and read the `look` field. That's the target.
2. Open the item's `url` in Chrome. Look at the main photo and the gallery. Note colour, shape, size, material and style.
3. Give a verdict:
   - `match`: a casual viewer would say it's the same thing (same subject, colours and style)
   - `close`: same subject and palette, different in a detail that doesn't change the overall look
   - `no`: wrong subject, colour, style or scale, or the listing is dead or unavailable
4. If `no` (or `close` and you can easily find better), search for a replacement. Compare 3-5 candidates visually and pick the closest one that fits the budget and arrives by Nov 30.
5. Update the item in `data/items.json`: `url`, `store`, `name` (short and descriptive, it prints on the form), `price` (current CAD), `qty`, `status: "listed"`, `image_checked: true`, `match`, `checked_on` (YYYY-MM-DD), `arrives_by`, and a one-line `notes` on what the photo shows.
6. Keep item `id`s unchanged (the 3D tree uses them). If you add or remove an item, see "3D tree" below.

Known gaps to fix (from comparing the list to the photo):
- `bandanas`: the dog and cat wear **knit tartan scarves with fringe**, not bandanas.
- `holiday_toy`: the basket has a **cream plush bone with a black paw print**. Swap the generic plush for that.
- `balls`: the basket has a **red** tennis ball, and the current KONG ones are yellow-green.
- `topper`: needs **wide** (2.5-4 in) natural burlap ribbon with black paw prints. The current link is a mixed 6-roll set; check whether it really contains that.
- `doghouse`, `paw_disc`, `bones`: currently DIY. Do a real search for bought versions that match the crops before keeping them DIY.

## Budget check
After each change, run `python3 build/build_tree.py` and watch the total. If you go over, trim quantities on low-priority items first (plaid balls, picks, extra bauble sets), never the high-priority look items.

## Rebuild the deliverables
```
npm install
npm run build
```
This writes:
- `output/HP26_Tree_Gallery_Form_Corporate_Finance.docx`: the filled Tree Gallery form with a Link column (page 2 has committee notes)
- `output/howlidays_tree_preview.html`: open it in Chrome to check. Click a few decorations and confirm the card shows the new name, price and link
- `output/howlidays_tree.html`: the same page without the html wrapper, for republishing in Claude (Cowork)

## 3D tree (`build/tree.js`)
The 3D shapes are drawn in code and keyed by item `id`. Prices, names and links come from `items.json` automatically. Only touch `tree.js` if an item's look changes in a way the preview should show, for example:
- `bandanas` → scarves: change the triangle shapes in the gift-basket section to small fringed scarf shapes
- `balls`: change `ballMat` colour to red
- `holiday_toy`: replace the green/red plush with a small cream bone with a paw (reuse the bone-pillow code)
- New item ids need a shape somewhere (copy a similar builder) or an entry in `NOT_ON_TREE` if they aren't visible.
- `DIY_HOW` holds the how-to text for DIY items.

## Finish with a report
Write `output/verification_report.md`:
- a summary line: items checked, matches, replacements, new DIY items, new total incl. GST
- a table with one row per item: id, verdict before, action (kept / replaced / DIY), final product + link, price, qty, arrives by, one-line note on what the photo shows
- anything Muntaz needs to decide or buy in person

Then tell Muntaz the files are ready. To update the published 3D page (https://claude.ai/artifact/Fjiv9yeEdoepwGzTKjSjZr), he should bring `output/howlidays_tree.html` back to the Claude (Cowork) chat, because only that chat can republish it to the same link.
