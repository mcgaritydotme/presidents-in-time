#!/usr/bin/env python3
"""
Downloads president portrait images, saves originals, and creates resized defaults.

Output files per president:
  images/<id:02d>-original.<ext>   — full-res download
  images/<id:02d>-default.<ext>    — copy resized to fit within bounds if needed

Bounds for -default:
  Width:  600–1600 px
  Height: 800–1920 px
"""

import json
import os
import shutil
import time
import urllib.request
from pathlib import Path
from PIL import Image

IMAGES_DIR = Path(__file__).parent / "images"
SOURCE_JSON = Path.home() / "Downloads/president-images.json"

WIDTH_MIN, WIDTH_MAX = 600, 1600
HEIGHT_MIN, HEIGHT_MAX = 800, 1920

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; presidents-in-time-downloader/1.0)"}


def extension_from_url(url: str) -> str:
    path = url.split("?")[0].split("#")[0]
    ext = os.path.splitext(path)[1].lower()
    return ext if ext in {".jpg", ".jpeg", ".png", ".gif", ".webp"} else ".jpg"


DOWNLOAD_DELAY = 5.0    # base pause between requests
MAX_RETRIES = 5
RETRY_BACKOFF = 15.0    # extra seconds to wait per retry attempt


def download(url: str, dest: Path) -> None:
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                dest.write_bytes(resp.read())
            time.sleep(DOWNLOAD_DELAY)
            return
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF * (attempt + 1)
                print(f"    rate-limited, waiting {wait:.0f}s before retry {attempt + 1}/{MAX_RETRIES - 1}…")
                time.sleep(wait)
            else:
                raise


def resize_to_fit(src: Path, dest: Path) -> None:
    img = Image.open(src)
    w, h = img.size

    needs_resize = (
        w < WIDTH_MIN or w > WIDTH_MAX or
        h < HEIGHT_MIN or h > HEIGHT_MAX
    )

    if not needs_resize:
        shutil.copy2(src, dest)
        return

    # Scale so width is in [WIDTH_MIN, WIDTH_MAX] and height is in [HEIGHT_MIN, HEIGHT_MAX]
    scale_w_min = WIDTH_MIN / w
    scale_w_max = WIDTH_MAX / w
    scale_h_min = HEIGHT_MIN / h
    scale_h_max = HEIGHT_MAX / h

    # Must satisfy both axes simultaneously — find a valid scale
    scale_min = max(scale_w_min, scale_h_min)  # must be at least this big
    scale_max = min(scale_w_max, scale_h_max)  # must be no bigger than this

    if scale_min <= scale_max:
        # Prefer scale closest to 1.0 (i.e. least change)
        if scale_min <= 1.0 <= scale_max:
            scale = 1.0  # already in bounds on the constrained axis
        elif scale_min > 1.0:
            scale = scale_min  # need to scale up
        else:
            scale = scale_max  # need to scale down
    else:
        # Conflict: prioritise fitting within the max bounds (don't exceed limits)
        scale = scale_max

    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    resized.save(dest)
    print(f"    resized {w}x{h} → {new_w}x{new_h}  (scale {scale:.3f})")


def main() -> None:
    IMAGES_DIR.mkdir(exist_ok=True)

    with open(SOURCE_JSON) as f:
        presidents = json.load(f)

    for p in presidents:
        pid = p["id"]
        name = p["name"]
        url = p["fullResUrl"]
        ext = extension_from_url(url)

        id_str = f"{pid:02d}"
        original_path = IMAGES_DIR / f"{id_str}-original{ext}"
        default_path = IMAGES_DIR / f"{id_str}-default{ext}"

        print(f"[{id_str}] {name}")

        if original_path.exists():
            print(f"    original already exists, skipping download")
        else:
            print(f"    downloading {url}")
            try:
                download(url, original_path)
                print(f"    saved → {original_path.name}")
            except Exception as e:
                print(f"    ERROR downloading: {e}")
                continue

        if default_path.exists():
            print(f"    default already exists, skipping resize")
        else:
            try:
                resize_to_fit(original_path, default_path)
                print(f"    saved → {default_path.name}")
            except Exception as e:
                print(f"    ERROR creating default: {e}")


if __name__ == "__main__":
    main()
