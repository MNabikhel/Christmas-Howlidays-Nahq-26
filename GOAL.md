# Goal: Home for the Howlidays

**A tree the committee can buy and build exactly as the preview shows, with every element a true match to the inspiration board, proven side by side before anything is ordered.**

Agreed with Muntaz on Nov 16, 2026. It replaces the earlier goals: their tests (rules, wow, thought through) are folded in below.

## Done means

1. **A lookbook page for every board element** (`output/lookbook.html`, data in `data/lookbook.json`). Each page shows:
   - the board crop of that element;
   - the chosen product's photo, or a true-size 3D render of the finished DIY piece;
   - at least 3 alternatives considered, each with its photo, price and the reason it lost;
   - the size we buy, compared with the size the element appears on the board, drawn at real scale against the 7.5 ft tree;
   - the 3D preview of that element next to the product photo;
   - a verdict and its verification status.
2. **Every element is `match`, or `close` with a written reason.** `match` means a casual viewer would say it is the same thing. `close` must name the difference and why it is the best available, for example "knit instead of plaid: no plaid mini stocking exists in Canada that arrives in time".
3. **Verified on the day we finalize.** Every listing is re-opened that day: price, stock, photo, and delivery to Edmonton by Nov 21. Amazon.ca blocks automated browsing from the cloud session, so the Amazon checks run in Claude Code with Claude in Chrome on Muntaz's computer. See `CLAUDE.md`.
4. **Buildable.** Every DIY piece has materials with store, price and link, quantities calculated from real dimensions with at least 10% spare, a true-size template and steps. It is built in 3D from that template before anyone cuts. Nothing depends on "maybe": no boxes we might receive, no tools we assume someone has. `build/build_plan.py` fails the build if any supply line falls short.
5. **The preview is what we buy.** Every 3D object takes its size from the listing and its look from the product photo. The opening view is compared with the board.
6. **Within the rules.**
   - Budget: at most $2,000 including GST and shipping, with at least $75 kept for price changes. Spare money goes to closer matches on the most visible elements first.
   - Delivery: everything in Edmonton by Nov 30.
   - Excluded: no lights, no tree skirt, no PCL, Oilers or other branding, and no food.
7. **Nothing hidden.** Every page says what could not be verified and why. The Tree Gallery form and the order list change only after Muntaz approves the lookbook.

## How the work runs

- **Order:** element by element, most visible first: topper, pets, doghouse ornaments, paw ornaments, bones, baubles, ribbon and bows, stockings, gold and greens, gift basket, under-tree pieces, giant doghouse.
- **Checkpoint:** stop after the first three elements and show Muntaz, so the standard can be corrected before the rest.
- **Approval:** an element is finished only when its lookbook page is complete and Muntaz has approved it.
- **Nov 16 update:** Muntaz asked for an exact match to the board and delegated the choices ("make the judgment yourself"). Every element now has a board-match default and 1-3 swap options in the 3D page; the defaults are documented judgments, each reversible, and the list, budget and Word exports follow whatever is selected.
