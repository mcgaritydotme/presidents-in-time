# Presidents in Time — Batch Collection Pipeline Design

## Purpose

Replace the current serial, babysat, one-period-at-a-time workflow with an
unattended batch run that collects image candidates for **every** four-year span
in a president's life in a single kickoff. You then review and curate the full
set at once. This document captures the design decisions reached so they can be
implemented and, where noted, migrated into `CLAUDE.md`.

## Core finding

The original instinct — parallel autonomous agents — solves the symptom but is
the wrong cure. The real bottlenecks are (1) endless permission prompts forcing
you to monitor, and (2) serial processing of one period at a time. Neither
requires an agent swarm. The fix is **pre-granted permissions + your existing
per-period logic wrapped in a loop**, producing a single review surface.

Because runs are unattended (during the workday or overnight), wall-clock time
is no longer a constraint. That removes the only real argument for parallel
subagents and lets the fragile Google discovery step stay gently human-paced.

## Architecture

Three phases, with the human review gate between collection and finalization.

### Phase 1 — Unattended collection (looped, fault-isolated)

- Enumerate **all** four-year spans from the president's own dates — birth to
  death, or birth to present for a living former president. The span count is
  per-president and driven by lifespan, not a fixed number: a centenarian like
  Carter yields many more spans than a Garfield or a Kennedy. Derive the spans
  from the dates; do not assume a constant.
- For each span, run the existing per-period collection logic unchanged.
- **Source tiering by reliability under automation.** The names below are
  *examples within tiers*, not a closed allowlist. Your full set of trusted
  institutions applies — including the White House Historical Association, NARA,
  and any other source the existing pipeline already uses — and the pipeline's
  established "try a new/unvisited source if the known ones come up short"
  fallback remains in force. New or unfamiliar sources default to the
  gentle-handling tier.
  - **Direct APIs (e.g. Smithsonian Open Access, LOC, Wikimedia)** — safe to run
    freely; clean licensing metadata.
  - **Wikimedia Commons** — safe via API; tolerable if page-fetched.
  - **Other trusted institutions (e.g. WHHA, NARA) and any novel/unvisited
    source** — treat like the discovery tier: handle gently, don't hammer.
  - **Google Images / Search** — discovery/validation layer only. Keep
    **serial and human-paced**; it is a router, not a source. It validates that
    a period-appropriate portrait plausibly exists, then drills down to the
    quality tier (Wikimedia, LOC, WHHA, NARA, etc.) for the actual licensed
    image.
- **Fault isolation is mandatory.** A failure in one span (flaky source, empty
  result) must log and move on, never kill the remaining spans. The run ends
  with a complete-as-possible contact sheet plus a short "came back empty / look
  here" list.

### Phase 2 — Morning review (human gate)

- Single contact sheet for the whole president: periods down the page,
  candidates across.
- You apply every judgment here — period accuracy, aesthetic variation,
  contextual choices — drawing on your trained eye.
- A rejection here can turn a filled period into a gap, which is why placeholder
  assignment must wait until review is complete.
- **Handoff seam.** Approval of a candidate in the contact sheet is the trigger
  that hands off to the project's **existing finalization routine** — download
  the image, generate the sized copies (e.g. thumbnail), and update the JSON
  data file that powers the grid. That logic already lives in `CLAUDE.md` and is
  unchanged by this design; this document covers only the front half
  (collection + review). The two halves meet at the moment of approval.

### Phase 3 — Placeholder resolution (post-signoff, no second collection pass)

- Gaps (periods with no qualifying image, common only for very early presidents)
  are filled from the **unused-candidate pool** — every candidate collected but
  not promoted to a real slot, carried forward with full metadata.
- Rule: most-famous **unused** likeness. Since the single most iconic portrait
  is almost always already filling a real slot, the pool of leftovers is a
  direct expression of this rule, not an approximation.
- You select placeholders by eye from the pool. No automated ranking (see
  below). A chosen placeholder flows through the **same** finalization routine
  as a primary slot (download, size copies, update JSON) — see the handoff seam
  in Phase 2.
- This is bookkeeping consumed after review — **not** a separate fetch phase.
  All fetching still happens in Phase 1.

## Key decisions (and why)

### No ranking — emit everything that qualifies

Selection is frequently **contextual and aesthetic**, not a per-image property.
Example: choosing a Jefferson life mask specifically to break up a monotonous
run of Gilbert Stuart paintings. The "best" choice depends on what sits above
and below it in the column — information that doesn't exist until the grid is
laid out. Any rank computed at collection time would be noise you'd override
constantly, and would bias toward official portraits, eroding the deliberate
variation you cultivate.

Therefore the emit step returns **everything it finds that clears the bar**,
unranked. Your eye orders it at review time with the full column visible.

### Bar for a qualifying candidate (unchanged from current CLAUDE.md)

- High quality; any medium acceptable.
- Faithful representation; subject well-depicted (e.g. looking toward the
  camera, not a complete side profile).
- Created **within** the four-year span (this is the period-accuracy guarantee
  and is verifiable from metadata).

### Metadata block per candidate (unchanged — already produced)

- Artist name
- Year (and full date if available)
- Holding institution
- Link to the highest-resolution image found
- Historical significance (e.g. official portrait, made by a friend, etc.)

This block is carried forward identically for **every** candidate, promoted or
not, so the unused pool is review-ready with zero extra capture cost.

### Bank depth

Bias collection to return **more than one** candidate in all cases unless only
one exists. Volume is desirable: it feeds both the period choice and the
placeholder pool. With everyone through Van Buren already hand-done, all
remaining presidents fall in the increasingly photographed era, so periods
reliably produce multiple candidates and the pool stays stocked.

### No cross-period dedup needed for primary slots

Each period requires an image created within its own span, so by construction no
two periods can share a primary image. The only cross-period dependency is the
placeholder "not yet used" rule, which is handled in Phase 3.

## The two prerequisites that make this work

1. **Allowlist configuration.** Pre-authorize trusted domains and the candidate
   write paths so a run never stops to ask. This is what kills the monitoring
   tax and is what makes overnight runs possible — an unattended job that hits a
   prompt at 11pm just stalls until morning.

2. **The loop with fault isolation.** Mechanical, since per-period logic already
   works; the care goes into making one span's failure non-fatal to the rest.

## Contact sheet (the interface you live in)

Now that collection emits potentially everything per period, the review view
must stay scannable at volume:

- Thumbnails large enough to judge depiction and quality by eye.
- Full metadata available but not crowding the images.
- The entire candidate set for a period visible together, so contextual calls
  (break up the Stuarts, vary the medium) are makeable at a glance.
- Quick approve/reject affordance per candidate.
- Turns the morning review into a short pass rather than a re-litigation of
  collection.

## What this explicitly is NOT

- Not an autonomous agent swarm.
- No automated ranking of candidates.
- No second collection pass for placeholders.
- No cross-period dedup logic for primary images.

Every judgment — period choice, aesthetic variation, placeholder selection —
stays with you. The pipeline's job is comprehensive collection, gentle handling
of the fragile discovery layer, and clean bookkeeping.

## Suggested CLAUDE.md migrations

- Emit rule: return **all** qualifying candidates per span, unranked; bias
  toward more than one unless only one exists.
- Reinforce the qualifying bar (quality, faithful, well-depicted, created within
  span) and the existing metadata block.
- Note that unused candidates are retained as the placeholder pool, drawn from
  by eye after signoff, honoring "most-famous unused likeness."
- Keep Google Search/Images as a serial, human-paced discovery-and-validation
  layer that drills down to quality sources for the actual image.
- Treat the named sources as examples; the trusted-source set is open-ended
  (WHHA, NARA, etc.) and novel sources are handled gently.
- The existing download / size-copies / update-JSON finalization logic stays in
  `CLAUDE.md` as-is and is triggered on approval; this design does not replace
  it.

## Implementation checklist

Mechanics below reflect Claude Code as of June 2026; verify against current docs
if releases have moved on, since headless and permission behavior can drift
between versions.

### 0. One thing to check at the computer first

Determine how the existing download/resize step fetches images, because it
decides one config line:

- **Via Claude Code's WebFetch tool** → the domain allowlist in step 3 is the
  whole story; nothing else needed.
- **Via shell `curl`/`wget`** → `deny` those in Bash and route fetching through
  WebFetch instead. Bash URL-argument patterns are bypassable, so the deny +
  WebFetch-allowlist combination is the enforceable boundary.
- **Via a script that opens URLs itself (e.g. Python)** → permission rules do
  **not** see subprocess network access. If you want it constrained, that lives
  at the OS sandbox layer, not in permission rules. For a personal project
  hitting known institutions, locking this down may not be necessary.

The tell: look at the download step and see whether it calls a shell command,
invokes a fetch tool, or runs a script.

### 1. Land the design doc

Place this file in the repo as reference (e.g. `docs/batch-pipeline-design.md`
or the vault's planning area). Keep it distinct from `CLAUDE.md`: this is the
"why," CLAUDE.md is the standing instruction.

### 2. Migrate rules into CLAUDE.md

Fold the "Suggested CLAUDE.md migrations" shortlist above into existing
instructions. Note: `CLAUDE.md` shapes what Claude *tries* to do but does **not**
grant permissions — access is governed entirely by `settings.json` rules. Keep
CLAUDE.md lean (editorial rules); put access in settings.

### 3. Write `.claude/settings.json` (committed to repo)

Permission rules evaluate **deny → ask → allow**, first match wins. Configure:

- **WebFetch allow rules** per trusted source, matched by hostname (supports
  `*.example.com` wildcards): Smithsonian, LOC, Wikimedia, WHHA, NARA, etc.
- **Scoped Edit/Write** for the candidates output path and **Read** for the
  vault, so finalization doesn't prompt. Path anchors: `/path` = project root,
  `//path` = absolute, `~/path` = home.
- **Deny shell network tools** (`Bash(curl *)`, `Bash(wget *)`) if step 0 shows
  the pipeline shells out — route through WebFetch instead.

### 4. Build the loop + contact sheet (interactive session)

Point Claude Code at this design doc and have it wrap the existing per-period
collection in a loop over all spans (enumerated from birth/death dates) with
fault isolation, and generate the contact-sheet review page. The existing
finalization routine stays untouched and fires at approval.

### 5. Wrap in headless and schedule

Once the loop works interactively, wrap it in a `claude -p "<batch prompt>"`
invocation (the `--print` flag; `--headless` is retired). Add
`--output-format json` to capture session/cost if wanted. Schedule via `cron`
or macOS `launchd` for overnight runs.

- **Critical:** an unattended run that hits a permission prompt hangs silently
  until morning. The settings.json allowlist from step 3 is what prevents this.
- On a personal Mac with the live vault, prefer the explicit allowlist over a
  blanket `--dangerously-skip-permissions` / `bypassPermissions`, which the docs
  reserve for isolated environments (containers/VMs). The allowlist gets
  unattended runs without granting a background job unsupervised broad access.

### Model and plan considerations

- **Model:** Sonnet 4.6 for both building and running. It is the daily-driver
  tier and sits in its sweet spot for this work — the build is bounded and
  well-specified, the nightly batch is mechanical. Opus is not needed here (and
  on a Pro plan is not available anyway; Opus requires Max or API billing).
- **The real Pro-plan limit is usage quota, not capability.** An unattended
  batch looping across 15+ spans, each making several tool calls, burns quota
  faster than interactive use. Before scheduling anything recurring:
  - **Measure one president end to end first** and observe how much Pro quota a
    single full run consumes.
  - Use that to decide sustainable scope: nightly across many presidents, one
    president per run, or a less frequent cadence.
  - This makes the design's efficiency choices matter more: lean on the
    API/Wikimedia tier, use Google sparingly as a router, avoid redundant
    fetches. Every avoided call is quota kept.
