# Goal: Home for the Howlidays

**Win the 2026 Tree Gallery with a tree that stops people in their tracks, matches our inspiration board item for item, and is built exactly as the 3D preview shows.**

Every change to the shopping list, the 3D preview or the Word form is checked against the six tests below, starting with test 0. A round of work is done only when all six pass.

## 0. Every item is thought through
Nothing goes on the list until someone could buy it, build it and hang it without asking a question. For every item:
- **It is what it says.** A doghouse ornament is a doghouse, not a birdhouse painted red. A look-alike product only counts if a written conversion removes every giveaway, such as a round hole or a perch peg.
- **Every DIY item has a complete build sheet:**
  - finished dimensions and a cut list or printed template;
  - every material, with quantity, store, price and link;
  - every tool;
  - the steps and the time they take.
- **Quantities are calculated from real dimensions, not guessed.** This covers paint coverage, ribbon yardage, clay volume, glue sticks, hanging cord, and bow and box counts. Each one shows its calculation and keeps at least 10% spare.
- **Nothing depends on "maybe".** Nothing relies on boxes we might receive, or on paint, tools or a printer we assume someone has. An item is bought and on the list, or it is on a named "bring from home or office" list that someone has confirmed.
- **Materials suit the surface.** Glazed ceramic needs an enamel marker, burlap needs fabric paint, and cardboard needs primer. Paint goes on both faces of anything that could warp.
- **It can hang or sit as shown.** Every ornament has a hanging method and the hardware is on the list. Heavy pieces such as the plush pets are wired to the trunk.
- **It fits:** the basket holds its contents, the display gifts and the doghouse fit around the tree base, and the jar actually looks full.
- **Test:** `output/item_audit.md` lists every item with a pass or fail on each check above, with the calculation shown. Nothing is ordered while any item fails.

## 1. Wow from across the room
A first-time viewer stops, smiles and walks over.
- **Centrepiece:** a 24 x 20 x 26" doghouse under the tree with the family dog in the doorway.
- **Ribbon waterfall:** burlap paw-print streamers that pour from the 24" topper bow to the doghouse roof.
- **Gold crown:** gold glitter sprays fanned out behind the topper bow.
- **Pets on the tree:** plush golden retrievers and tabby kittens in tartan scarves, front and centre.
- **Test:** each of these four reads clearly in the preview's opening view.

## 2. Every item matches the inspiration board
- **Listing check:** every item is opened in a browser and its listing photo compared with the board, on subject, colour, material and style.
- **Verdict:** each item gets `match` or `close`. A `close` needs a written reason and a plan to close the gap, such as a DIY touch.
- **No mismatches:** no item is bought on its title alone, and no `no` verdicts are left on the list.
- **Test:** every element on the board is on the tree, scored in `output/verification_report.md`. Target: 100% of items `match`; anything else is listed under "decide or buy in person".

## 3. Realistic and true to scale
- **Real sizes:** every item's size comes from its listing (`size_in` in `data/items.json`), and the 3D preview is built from those numbers.
- **Room scale:** the tree is 7.5 ft by about 52", in a room of real size.
- **Settings:** the preview can be shown in the living room from the board or in an office like NAHQ.
- **Person for scale:** an optional figure, adjustable from 5'0" to 6'2", with height labels.
- **Test:** what the committee builds looks like the preview at every distance. Where the preview has to use a photo cutout or a drawn approximation, the report says so.

## 4. Within the rules
- **Budget:** at most $2,000 including 5% GST (gift cards are exempt), with at least $150 kept free for shipping and price changes.
- **Delivery:** Amazon items and the Canadian Tire pickup by Nov 21; the DeSerres craft order by about Nov 26 (5-7 business days). Everything arrives before the Nov 30 cutoff, and any Edmonton Michaels is the same-day fallback for craft supplies.
- **Excluded:** no lights (the tree is pre-lit), no tree skirt, no PCL, Oilers or other branding, and no food. The auction is in 2027, so the jar holds faux biscuits.

## 5. Paperwork ready
- **Exports:** the organizers' Tree Gallery form exports from the preview page as Word, in its original layout, filled with the current items, costs and total. The committee plan exports separately.
- **No retyping:** a change to `data/items.json` flows to the 3D preview, the form, the plan and the report with one `npm run build`.

## How to use this goal
To ask for changes, state what you want in terms of these tests, for example:
- "Raise the wow: add a second centrepiece under $40."
- "Item X is only close; find a match."
- "Show the tree in our actual NAHQ lobby; here are the room's dimensions."
