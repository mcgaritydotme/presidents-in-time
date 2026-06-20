# presidents-in-time
A timeline of United States Presidents you can read in two directions.  Read down a column to follow one life across the decades — born, coming of age, rising to office, and beyond. Read across a row to see who was living, and who was leading, in any given four-year window.

---

## Portrait Research & Curation Workflow

This section documents the process for researching, selecting, and integrating portrait images for each president. Follow this workflow when picking up a new session.

---

### Overview

For each president, we work **backwards from death to birth**, one four-year block at a time. For each block we find the most historically significant portrait(s) created during that period, pick one, then write it into `presidents.json` and generate the required image files.

---

### Step 1 — Choose a president and determine the four-year blocks

The display grid uses four-year windows aligned to presidential term years (e.g. 1789–1793, 1793–1797, …). A president's portrait blocks extend beyond their term — back to birth and forward to death — using those same four-year increments.

Start from the block that contains the president's **year of death** and work backwards one block at a time until you reach the block that contains their **year of birth** (or exhaust all known likenesses).

> **Example — John Adams (born 1735, died 1826):**
> Start at 1825–1829, then 1821–1825, 1817–1821, … all the way back to 1765–1769.

---

### Step 2 — Research portraits for the current block

For each four-year block, research and present **one to three** of the most famous or historically significant representations of the president created during that period. All artwork types are equally valid candidates, including:

- Oil or watercolor paintings
- Pastel drawings
- Engravings, lithographs, or illustrated prints
- Sculptures or medallions
- Daguerreotypes or photographs
- Miniatures
- Group paintings (e.g. the Declaration of Independence scene) if the president is prominently depicted

The only criteria are that the work is a quality representation of the president and is dated as close as possible to the block's year range. Do not default to paintings — a period-accurate engraving beats an off-period painting.

Always provide either a **direct link** or the **actual image** for each candidate so the user can evaluate them visually. Do not present a candidate without a viewable image or URL.

If no strong candidate exists for a block (e.g. the period predates any surviving likenesses), say so and propose skipping it. It is fine to have gaps — the app handles missing blocks gracefully.

---

### Step 3 — User selects a candidate; Claude downloads the file

The user picks one candidate (or declines the period). Then:

1. **Claude downloads the highest-resolution version of the image** available and saves it to:

   ```
   images/<id>-original-<fromYear>.<extension>
   ```

   > **Example:** `images/03-original-1825.jpg`

   `<id>` is the zero-padded two-digit integer ID from `presidents.json`. `<fromYear>` is the **start year of the four-year block**, not the year the portrait was created.

   Use `curl` to download directly to the correct path:
   ```bash
   curl -L "<url>" -o "/Users/mcgaritydotme/Developer/presidents-in-time/images/<id>-original-<fromYear>.<ext>"
   ```

   If the source is a WordPress site or CDN, try the URL without any resize suffix (e.g. strip `-707x1024` from the filename) to get the full-resolution original.

2. **Exception:** if the user says they have already saved the file themselves, skip the download and confirm the file exists with `ls -lh` before proceeding.

3. Confirm the file downloaded correctly with `ls -lh`.

---

### Default portrait

Each president also has a `defaultPortraitUrl` and `defaultPortraitCredit` at the top of their entry — this is a single "hero" image used outside the timeline grid (e.g. a famous group scene, a posthumous depiction, or simply the most iconic likeness).

The default portrait should be the **most famous or iconic depiction** of the president that has **not already been used** in a block portrait entry. Its candidate pool has two sources, both in play every time:

1. **Leftovers** — quality candidates surfaced during block research but not selected for their block.
2. **Posthumous/retrospective works** — depictions created at any point after the president's death (commemorative paintings, sculptures, currency or postage imagery, later institutional portraits, etc.), found via a dedicated search of their own, not just whatever turns up incidentally. Apply the same research bar as block research, including the bias toward **three** quality candidates before settling for fewer.

Combine both sources, then research it the same way as block portraits — present the merged set of 1–3 (or more) candidates and wait for user selection before downloading.

**The default portrait must always be saved as a local file**, following the same pattern as other images:

```
images/<id>-default.<extension>
```

> **Example:** `images/02-default.jpg`

In `presidents.json`, set `defaultPortraitUrl` to just the filename (no path prefix):

```json
"defaultPortraitUrl": "02-default.jpg",
"defaultPortraitCredit": "John Trumbull, Declaration of Independence, 1818. Oil on canvas, 12 x 18 ft., United States Capitol Rotunda"
```

Do **not** use a remote URL (e.g. a Wikimedia link) for `defaultPortraitUrl` — download the file locally first.

---

### Step 4 — Write the JSON block and generate image files

Add a portrait entry to the president's `portraits` array in `presidents.json`. Entries **must always be in ascending `fromYear` order** — find the correct insertion point rather than appending to the end:

```json
{
  "fromYear": 1825,
  "toYear": 1829,
  "url": "02-thumbnail-1825.jpg",
  "popoverUrl": "02-popover-1825.jpg",
  "credit": "Gilbert Stuart, John Adams, 1826. Oil on canvas, 30 x 25 in., Smithsonian American Art Museum"
}
```

**File naming rules:**
- `url` → `<id>-thumbnail-<fromYear>.<extension>`
- `popoverUrl` → `<id>-popover-<fromYear>.<extension>`
- Do **not** include an `images/` prefix — `app.js` resolves the directory automatically.

**Citation format:**
```
Artist First Name Last Name, Title, Date. Medium, Dimensions (if known), Institution, Collection/Gift info (if known)
```

> **Example:** `Gilbert Stuart, John Adams, 1826. Oil on canvas, 30 x 25 in., Smithsonian American Art Museum`
>
> Use `c.` for circa dates. Omit dimensions if unknown. For group works, note the president's role: e.g. `John Trumbull, Declaration of Independence (detail), 1818.`

**Dimension formatting rules:**
- Always use **inches with common fractions** (e.g. `30 x 25 in.`, `29 3/4 x 24 15/16 in.`)
- For very large works, use **feet with fractions** (e.g. `12 x 18 ft.`)
- Convert any metric (cm) dimensions to inches before writing: 1 in. = 2.54 cm
- Use a plain lowercase `x` as the separator — never the `×` Unicode character

After writing the JSON, immediately run `generate-popover-thumbnail.py` — do not wait for the user to ask.

---

### Step 5 — Generate the popover and thumbnail (run automatically after Step 4)

Run `generate-popover-thumbnail.py` to produce the popover and thumbnail files from the original. **This should be done automatically as part of every period — do not ask the user to trigger it.**

**Popover rules:**
1. Source: `<id>-original-<fromYear>.<ext>`
2. Output: `<id>-popover-<fromYear>.<ext>` — saved to `images/`
3. Resolution: **72 DPI**
4. Scale proportionally using this logic:
   - If scaling width to **1080 px** keeps height **≥ 1920 px** → set width to 1080 px
   - Otherwise → set height to **1920 px** (width will naturally be ≥ 1080 px)

**Thumbnail rules:**
1. Source: the popover file just created
2. Output: `<id>-thumbnail-<fromYear>.<ext>` — a **straight copy** of the popover, no cropping
3. The user manually crops each thumbnail into a square between 300x300 and 1000x1000 px

The script is idempotent — it skips files that already exist.

To run:
```bash
cd /Users/mcgaritydotme/Developer/presidents-in-time
python3 generate-popover-thumbnail.py
```

---

### Batch Mode (alternative to Steps 2–3)

The per-block workflow above (research → present → pick → finalize, repeated for every four-year block) is the default. **Batch Mode** is an opt-in alternative for processing an entire president in one sitting, invoked explicitly by the user (e.g. "run all periods for Harrison"). It replaces the per-block research/pick loop with one collection pass, one review, and one finalization pass.

**Phase 1 — Collection.** Enumerate every four-year block from birth to death (per Step 1) and research candidates for all of them without pausing in between. Bias toward **three** quality candidates per block — fewer only once the search is genuinely exhausted. Same qualifying bar as Step 2: any artwork type, created within the block's span, a faithful and well-depicted likeness. Capture the same metadata as always, plus **dimensions in inches** when available, for every candidate — even ones that won't be chosen, since they may end up in the placeholder pool (see below). If a candidate's source domain isn't already trusted, don't fetch it — log it as pending and keep collecting; a domain gap should never interrupt the run.

**Phase 2 — Domain approval.** Present the list of flagged/pending domains (what's behind each, which block it affects) for a single approve/deny pass. No images are shown yet at this point — this checkpoint is about domains only.

**Phase 3 — Rerun.** Fetch everything just approved, in one batched pass, and fold the results into the candidate set.

**Phase 4 — Curation.** Present the complete contact sheet — every block, every candidate, approved-domain and newly-unlocked alike — and make every selection in one pass. This is the only point candidates are shown for picking.

**Phase 5 — Finalization.** Download, generate popovers/thumbnails, and update `presidents.json` for every selection in one batch, rather than one block at a time.

**Phase 6 — Default portrait.** Immediately after Phase 5, without waiting to be asked: research the default-portrait pool (leftover candidates from Phase 1 plus a dedicated posthumous/retrospective search — see Default Portrait section above) and present it for a pick. The run isn't done until this is resolved.

**Phase 7 — Citation lint.** After the default portrait is picked and saved, re-verify every entry just written — all block portraits plus the default — against each one's primary source record before declaring the run complete: artist attribution matches the institution's own record (including any "unverified"/"attributed to" caveats the source itself flags, don't smooth those over), dimensions are present and in inches, and the named institution matches the actual current holding record rather than an inferred one. Fix anything that fails before reporting the run done.

**Placeholder pool.** Candidates collected but not chosen for their own block remain available afterward for any gap blocks (no surviving likeness for that exact span) — pick the most famous **unused** one by eye, same as the existing Default Portrait rule, then run it through the same finalization step.

**Trusted domains** live in `.claude/settings.json`, seeded from sources already proven across earlier presidents. The list grows each time a new domain is approved during a batch run.

---

### Key file locations

| File | Purpose |
|------|---------|
| `presidents.json` | Main data file — one entry per president (Cleveland and Trump appear twice for non-consecutive terms) |
| `images/` | All image files — originals, popovers, thumbnails |
| `generate-popover-thumbnail.py` | Generates popover (resized) and thumbnail (copy) from originals |
| `download-images.py` | Original bulk-download script — used for the first pass of all 47 presidents |

---

### Important rules & gotchas

- **Always use absolute paths** in scripts. Using relative paths (`Path('images')`) caused files to be written to the wrong directory and lost. Always anchor to `/Users/mcgaritydotme/Developer/presidents-in-time/images`.
- **No `images/` prefix in JSON `url` / `popoverUrl` fields.** `app.js` prepends the directory automatically for non-absolute URLs.
- **`id` fields in `presidents.json` are integers**, not zero-padded strings. File names use zero-padded two-digit IDs (e.g. `02-`) but JSON IDs are plain integers (e.g. `2`).
- **`fromYear` drives the year in all three filenames** — original, popover, and thumbnail — regardless of when the portrait was actually painted.
- Periods with no suitable portrait are simply omitted. Gaps are fine.
- **Replacing an original doesn't refresh its popover/thumbnail.** `generate-popover-thumbnail.py` skips any output file that already exists. If you overwrite `<id>-original-<fromYear>.<ext>` for a slot that already had a popover/thumbnail (e.g. swapping out a previous pick, or replacing an old placeholder), delete the existing `<id>-popover-...` and `<id>-thumbnail-...` files first — otherwise they silently keep showing the old image.

---

### Current portrait status

| ID | President | Status |
|----|-----------|--------|
| 1 | George Washington | ✅ Complete (7 portraits) |
| 2 | John Adams | ✅ Complete (9 portraits, thumbnails need manual crop) |
| 3 | Thomas Jefferson | ✅ Complete (8 portraits, gaps 1793-1797 & 1809-1813, thumbnails need manual crop) |
| 4 | James Madison | ✅ Complete (11 portraits, gap 1793-1801, thumbnails need manual crop) |
| 5 | James Monroe | ✅ Complete (7 portraits) |
| 6 | John Quincy Adams | ✅ Complete (11 portraits) |
| 7 | Andrew Jackson | ✅ Complete (9 portraits) |
| 8 | Martin Van Buren | ✅ Complete (10 portraits) |
| 9 | William Henry Harrison | ✅ Complete (6 portraits, gaps 1773-1797, 1801-1813 & 1821-1833) |
| 10 | John Tyler | ✅ Complete (7 portraits) |
| 11 | James K. Polk | ✅ Complete (3 portraits, gaps 1793-1837) |
| 12–47 | All others | ⏳ Single auto-generated placeholder each |

