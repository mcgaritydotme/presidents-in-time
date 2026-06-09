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

For each four-year block, research and present **one to three** of the most famous or historically significant representations of the president created during that period. Candidates may include:

- Oil or watercolor paintings
- Pastel drawings
- Engravings or illustrated prints
- Sculptures or medallions
- Group paintings (e.g. the Declaration of Independence scene) if the president is prominently depicted
- Photography (for presidents from the mid-19th century onward)

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
Artist Last Name, First Name, Title, Date. Medium, Dimensions (if known), Institution, Collection/Gift info (if known)
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

---

### Current portrait status

| ID | President | Status |
|----|-----------|--------|
| 1 | George Washington | ✅ Complete (7 portraits) |
| 2 | John Adams | ✅ Complete (9 portraits, thumbnails need manual crop) |
| 3 | Thomas Jefferson | 🔄 In progress (2 portraits) |
| 4–47 | All others | ⏳ Single auto-generated placeholder each |
