#!/usr/bin/env python3
"""
Generates popover and thumbnail files from president original images.

Popover rules:
  - Copy original → <id>-popover-<year>.<ext>
  - Set resolution to 72 DPI
  - Scale proportionally:
      - If scaling width to 1080px keeps height >= 1920px → use 1080px width
      - Otherwise → scale height to 1920px (width will be >= 1080px)

Thumbnail rules:
  - Copy popover → <id>-thumbnail-<year>.<ext> (straight copy, no cropping)

Skips files that already exist (idempotent).
"""

import re
import shutil
from pathlib import Path
from PIL import Image

IMAGES_DIR = Path("/Users/mcgaritydotme/Developer/presidents-in-time/images")

TARGET_WIDTH = 1080
TARGET_HEIGHT = 1920
DPI = 72


def make_popover(original_path: Path) -> Path:
    """Create the popover file from an original. Returns the popover path."""
    # Derive popover filename: 02-original-1765.jpg → 02-popover-1765.jpg
    name = original_path.name  # e.g. 02-original-1765.jpg
    popover_name = re.sub(r"-original-", "-popover-", name)
    popover_path = IMAGES_DIR / popover_name

    if popover_path.exists():
        print(f"  [popover] already exists, skipping: {popover_name}")
        return popover_path

    img = Image.open(original_path).convert("RGB")
    w, h = img.size

    # Determine scale
    scale_for_width = TARGET_WIDTH / w   # scale so width == 1080
    h_at_width_scale = h * scale_for_width

    if h_at_width_scale >= TARGET_HEIGHT:
        # Safe to scale to 1080px wide
        new_w = TARGET_WIDTH
        new_h = round(h_at_width_scale)
    else:
        # Scale to 1920px tall instead
        scale_for_height = TARGET_HEIGHT / h
        new_w = round(w * scale_for_height)
        new_h = TARGET_HEIGHT

    resized = img.resize((new_w, new_h), Image.LANCZOS)
    resized.save(popover_path, "JPEG", quality=92, dpi=(DPI, DPI))
    print(f"  [popover] {w}x{h} → {new_w}x{new_h} @ {DPI}dpi → {popover_name}")
    return popover_path


def make_thumbnail(popover_path: Path) -> None:
    """Copy the popover to a thumbnail file (straight copy)."""
    thumb_name = re.sub(r"-popover-", "-thumbnail-", popover_path.name)
    thumb_path = IMAGES_DIR / thumb_name

    if thumb_path.exists():
        print(f"  [thumbnail] already exists, skipping: {thumb_name}")
        return

    shutil.copy2(popover_path, thumb_path)
    print(f"  [thumbnail] copied → {thumb_name}")


def main():
    originals = sorted(IMAGES_DIR.glob("*-original-*.*"))

    if not originals:
        print("No original files found.")
        return

    for original_path in originals:
        print(f"\n{original_path.name}")
        popover_path = make_popover(original_path)
        make_thumbnail(popover_path)

    print("\nDone.")


if __name__ == "__main__":
    main()
