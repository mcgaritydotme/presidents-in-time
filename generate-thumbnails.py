#!/usr/bin/env python3
"""
Generates square face-crop thumbnails from president original images.

For each images/<id>-original.<ext>:
  - Detects the face using OpenCV Haar cascades
  - Expands the bounding box by a padding factor
  - Crops to a square and saves as images/<id>-thumbnail.jpg

Images where no face is detected are reported at the end for manual review.

Thumbnail size: THUMBNAIL_SIZE x THUMBNAIL_SIZE px
"""

import cv2
import os
from pathlib import Path
from PIL import Image

IMAGES_DIR = Path(__file__).parent / "images"
THUMBNAIL_SIZE = 400      # output square size in pixels
PADDING = 0.5             # fraction of face box to pad on each side
THUMBNAIL_SUFFIX = "-thumbnail.jpg"

# Try multiple cascade classifiers — frontalface_alt2 handles paintings better
CASCADE_PATHS = [
    cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml",
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml",
    cv2.data.haarcascades + "haarcascade_frontalface_alt.xml",
]
CASCADES = [cv2.CascadeClassifier(p) for p in CASCADE_PATHS]


def detect_face(img_bgr):
    """Return (x, y, w, h) of the largest detected face, or None."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    for cascade in CASCADES:
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(60, 60),
        )
        if len(faces) > 0:
            # Pick the largest face by area
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
            return faces[0]
    return None


def square_crop(img_pil, cx, cy, half_side):
    """Crop a square of half_side*2 centred on (cx, cy), clamped to image bounds."""
    w, h = img_pil.size
    x0 = max(0, cx - half_side)
    y0 = max(0, cy - half_side)
    x1 = min(w, cx + half_side)
    y1 = min(h, cy + half_side)

    # Re-centre if we hit a boundary
    if x1 - x0 < half_side * 2:
        if x0 == 0:
            x1 = min(w, half_side * 2)
        else:
            x0 = max(0, x1 - half_side * 2)
    if y1 - y0 < half_side * 2:
        if y0 == 0:
            y1 = min(h, half_side * 2)
        else:
            y0 = max(0, y1 - half_side * 2)

    return img_pil.crop((x0, y0, x1, y1))


def process(original_path: Path) -> bool:
    """Returns True if a face was found and thumbnail saved."""
    stem = original_path.stem.split("-")[0]  # e.g. "01"
    thumb_path = IMAGES_DIR / f"{stem}{THUMBNAIL_SUFFIX}"

    if thumb_path.exists():
        print(f"  [{stem}] thumbnail already exists, skipping")
        return True

    img_bgr = cv2.imread(str(original_path))
    if img_bgr is None:
        print(f"  [{stem}] ERROR: could not read image")
        return False

    face = detect_face(img_bgr)
    if face is None:
        print(f"  [{stem}] ✗ no face detected")
        return False

    fx, fy, fw, fh = face
    # Centre of face
    cx = fx + fw // 2
    cy = fy + fh // 2
    # Half-side with padding
    half_side = int(max(fw, fh) * (1 + PADDING) / 2)

    img_pil = Image.open(original_path).convert("RGB")
    cropped = square_crop(img_pil, cx, cy, half_side)
    thumb = cropped.resize((THUMBNAIL_SIZE, THUMBNAIL_SIZE), Image.LANCZOS)
    thumb.save(thumb_path, "JPEG", quality=90)
    print(f"  [{stem}] ✓ face at ({cx},{cy}) size {fw}x{fh} → {thumb_path.name}")
    return True


def main():
    originals = sorted(IMAGES_DIR.glob("*-original.*"))
    failed = []

    for path in originals:
        result = process(path)
        if not result:
            failed.append(path.name)

    print(f"\n{'='*50}")
    print(f"Done. {len(originals) - len(failed)}/{len(originals)} thumbnails generated.")
    if failed:
        print(f"\nNo face detected — manual crop needed for:")
        for f in failed:
            print(f"  {f}")


if __name__ == "__main__":
    main()
