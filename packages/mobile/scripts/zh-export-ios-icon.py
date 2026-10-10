#!/usr/bin/env python3
"""Export the iOS AppIcon from the Android launcher icon baseline.

The Android baseline (`assets/icon-only.png`) is the flattened adaptive icon:
white background (#FFFFFF) with the logo inset 16.7%, fully opaque RGBA.
iOS app icons must be opaque (no alpha channel) and must NOT contain
pre-rounded corners, because iOS applies the mask itself.

This script therefore:
  1. loads the Android baseline,
  2. verifies every pixel is opaque (so no compositing choice is needed),
  3. writes it as a 1024x1024 RGB PNG (alpha dropped) to the iOS asset catalog.

Refuses to run if the baseline has any transparent pixel, so it can never
silently composite onto the wrong color.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[3]
BASELINE = REPO / "packages/mobile/assets/icon-only.png"
IOS_ICON = REPO / "packages/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"


def main() -> int:
    src = Image.open(BASELINE)
    print(f"baseline: {BASELINE} {src.size} {src.mode}")
    if src.size != (1024, 1024):
        print("ERROR: baseline must be 1024x1024", file=sys.stderr)
        return 1

    rgba = src.convert("RGBA")
    alpha = rgba.getchannel("A")
    amin, amax = alpha.getextrema()
    print(f"baseline alpha extrema: min={amin} max={amax}")
    if amin != 255:
        print(
            "ERROR: baseline contains transparent pixels; refusing to guess a "
            "background color. Composite explicitly and re-run.",
            file=sys.stderr,
        )
        return 1

    # Fully opaque -> straight RGB conversion, no compositing needed.
    out = rgba.convert("RGB")
    IOS_ICON.parent.mkdir(parents=True, exist_ok=True)
    out.save(IOS_ICON, format="PNG", optimize=True)
    print(f"wrote: {IOS_ICON} {out.size} {out.mode}")

    written = Image.open(IOS_ICON)
    print(f"verify: {written.size} {written.mode}")
    if written.mode != "RGB":
        print("ERROR: written icon still has an alpha channel", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
