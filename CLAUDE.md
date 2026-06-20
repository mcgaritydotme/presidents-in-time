# Claude-specific guidance for presidents-in-time

The full workflow is documented in README.md. This file contains behavioral rules specific to Claude Code.

## Always present candidates before acting

For every four-year block, present 1–3 candidates with images/links and **wait for the user to pick one** before downloading, writing JSON, or generating images. This applies even when only one good candidate exists. Never skip straight to the download step.

## All artwork types are equal

Do not bias toward paintings. Engravings, lithographs, daguerreotypes, photographs, sculptures, and other media are all valid — present them without apology or qualification. A period-accurate print beats an off-period oil painting. See README.md Step 2 for the full list of accepted types.

## After the user picks

Download immediately, generate popover/thumbnail, and update `presidents.json` — all without waiting to be asked. Then report what was saved and prompt for the next block.

## Batch mode

The rules above are the default, interactive, per-block workflow. When the user explicitly asks for a **batch run** on a president (e.g. "run all periods for Harrison," "batch this one"), switch to the process in README.md's Batch Mode section instead. Behavioral specifics Claude must follow:

- **Bias toward 3 candidates per period.** Actively try to find three quality candidates per four-year block; returning fewer is acceptable only once you've genuinely exhausted the search, not as a default.
- **No per-period pause.** Move from period to period without stopping for approval. Collect silently; do not narrate each block as you go.
- **Capture full metadata per candidate**, every time, even for candidates that don't end up chosen: artist, date, medium, **dimensions in inches**, institution, image link, and a one-line note on historical significance (official portrait, painted by a friend, campaign artifact, etc.).
- **Domain handling during collection:**
  - If the candidate's image is hosted on a domain already in `.claude/settings.json`'s allowlist, fetch and verify it inline as part of collection — no flag, no pause.
  - If the domain is **not** on the allowlist, do not fetch it. Log it as a pending candidate with whatever metadata you can gather without fetching (artist, date, description from search snippets), and keep collecting the rest of the run. Never let an unapproved domain interrupt the batch.
  - **The moment the user approves a new domain, add it to `.claude/settings.json` immediately** — don't just proceed with the fetch and forget to persist it. The allowlist is the whole point; it has to actually grow each run. Write the file *before* retrying the approved fetches, not after, so the retries themselves don't prompt.
- **Prefer WebFetch over Bash curl for page scraping during collection.** The domain allowlist only governs the WebFetch tool — `Bash(curl ...)` is matched per exact command, not by domain, so it still prompts even for allowlisted domains like `ids.si.edu` or `loc.gov`. Use WebFetch to verify a candidate exists and looks right during Phase 1. Reserve `Bash curl` + PIL (for exact pixel dimensions) for Phase 5, after curation, when the user is already at the keyboard approving downloads.
  - **Exception: structured JSON APIs.** Smithsonian Open Access (`api.si.edu`), LOC (`?fo=json`), Wikimedia (`commons.wikimedia.org/w/api.php`), and CONTENTdm (`dmwebservices`) return JSON, not HTML — WebFetch's prose-summarizing model handles that poorly and sometimes outright fails (403s seen on item pages WebFetch couldn't reach but curl could with proper headers). `Bash curl` against these specific JSON endpoints is fine during Phase 1 collection; it's querying metadata, not bypassing the page-scraping rule above.
- **End-of-run, two separate checkpoints, never combined:**
  1. **Domain approval only.** Present the flagged-domains list (one line each: domain, what's behind it, which period it affects) and wait for the user to approve/deny each in one pass. Do not show the contact sheet yet at this point.
  2. After any approved domains are fetched in a single batched rerun (parallel fetches, merge results), present the **complete** visual contact sheet — this is the only time the contact sheet appears, and it includes everything: originally-collected candidates plus newly unlocked ones.
- **Contact sheet format:** build it with the `mcp__visualize__show_widget` tool as an HTML grid — periods as rows in birth→death order, candidate thumbnails as columns, with artist/date/dimensions/institution as captions. Fall back to a structured text list only if the visual format proves unwieldy.
- **Curation happens once**, against the complete contact sheet, after the domain-approval rerun — never before.
- **Bulk finalization.** Once the user has picked across the whole sheet, download/resize/generate/update JSON for every selection in one pass, not one at a time.
- **Unused candidates become the placeholder pool** for any gap periods, applying the existing "most-famous-unused" rule (see README.md's Default Portrait section) — drawn from by eye, no second research pass, same finalization routine.
- **Default portrait is mandatory, not optional follow-up.** Bulk finalization is not done until the default portrait is also resolved. Immediately after the block picks are finalized, present default-portrait options and wait for a pick — don't just flag it as an open item and move on. A run isn't complete while `defaultPortraitUrl` still points at the `placehold.co` placeholder.
- **Default-portrait pool has two sources, both required.** (1) Leftover candidates from block research that didn't get picked. (2) Posthumous/retrospective depictions — created any time after the president's death — found via a dedicated search, same as if it were its own four-year block: bias toward **three** quality candidates, full metadata per candidate, before accepting fewer. Don't rely on leftovers alone; always run the posthumous-works search too, then present the combined set.
