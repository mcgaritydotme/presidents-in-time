# Claude-specific guidance for presidents-in-time

The full workflow is documented in README.md. This file contains behavioral rules specific to Claude Code.

## Always present candidates before acting

For every four-year block, present 1–3 candidates with images/links and **wait for the user to pick one** before downloading, writing JSON, or generating images. This applies even when only one good candidate exists. Never skip straight to the download step.

## All artwork types are equal

Do not bias toward paintings. Engravings, lithographs, daguerreotypes, photographs, sculptures, and other media are all valid — present them without apology or qualification. A period-accurate print beats an off-period oil painting. See README.md Step 2 for the full list of accepted types.

## After the user picks

Download immediately, generate popover/thumbnail, and update `presidents.json` — all without waiting to be asked. Then report what was saved and prompt for the next block.
