# Start here (for Muntaz)

This folder hands the "Home for the Howlidays" tree work over to Claude Code, so Claude can open the store pages in your Chrome and actually look at the product photos.

## What you need
- **Claude Code**, signed in with `/login` to your Claude account (Pro, Max, Team or Enterprise)
- **Google Chrome** (or Edge) with the **Claude in Chrome** extension, signed in to the same account:
  https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn
- **Node.js 18+** and **Python 3**, to rebuild the Word form and the 3D page
- Not supported inside WSL on Windows. Use regular PowerShell or Terminal.

## Steps
1. Unzip this folder somewhere, e.g. `Documents/howlidays-package`.
2. Open a terminal in that folder and run:
   ```
   claude --chrome
   ```
   The first time, press Enter on the Chrome intro screen. If Chrome isn't detected, restart Chrome and type `/chrome` → "Reconnect extension".
3. Paste this prompt:
   ```
   Read CLAUDE.md and GOAL.md. Run /chrome to confirm the browser is connected, then work through the verify lists in data/lookbook.json, element by element. Don't buy anything.
   ```
4. Claude will open tabs in a Chrome tab group. Approve the "Claude in Chrome wants to…" prompts (you can allow a site for the whole session). Leave the tabs open while it works.

## When it's done
- `output/verification_report.md`: what matched, what got replaced, the new total
- `output/HP26_Tree_Gallery_Form_Corporate_Finance.docx`: updated form with links
- `output/howlidays_tree_preview.html`: double-click to view the updated 3D tree
- To update the 3D page you already have in Claude, drop `output/howlidays_tree.html` into the Claude (Cowork) chat and ask to republish it.

## What's in here
| Path | What it is |
|---|---|
| `CLAUDE.md` | Full brief and instructions for Claude Code |
| `inputs/inspiration.png` + `inputs/crops/` | The target look, plus close-ups of each element |
| `inputs/HP26_Tree_Gallery_Form_original.pdf` | The original fillable form |
| `inputs/committee_email.md`, `inputs/kickoff_deck_notes.md` | Bruno's email and the organizer rules |
| `data/items.json` | The 37-item list with a "look" description for each, and fields to record what Claude checks |
| `build/` | Scripts that rebuild the Word form and the 3D page from `items.json` |
| `output/` | Current versions of the form and the 3D page |
