#!/usr/bin/env python3
"""Compare the iOS AppIcon against the Android launcher icon baseline.

The Android launcher icon is the visual source of truth for the Chinese fork.
Android adaptive icons composite a foreground over a background layer; the
flattened `assets/icon-only.png` is already the merge of those layers (it is the
image fed to `cap`/res generation). iOS app icons must NOT carry an alpha
channel, so we flatten the RGBA baseline onto opaque white before comparing.

Usage:
  python scripts/zh-icon-compare.py \
      --baseline ../assets/icon-only.png \
      --candidate ../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png

Exit code 0 when mean per-channel diff is below the tolerance, else 2.
"""
from __future__ import annotations

import argparse
import sys

from PIL import Image, ImageChops


def load_rgb(path: str) -> Image.Image:
    im = Image.open(path)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    return im.convert("RGB")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", required=True, help="Android flattened icon (source of truth)")
    ap.add_argument("--candidate", required=True, help="iOS AppIcon to verify")
    ap.add_argument("--tolerance", type=float, default=1.0, help="max mean abs diff per channel")
    ap.add_argument("--bbox-threshold", type=int, default=0, help="threshold for diff bbox")
    args = ap.parse_args()

    base = load_rgb(args.baseline)
    cand = load_rgb(args.candidate)

    print(f"baseline : {args.baseline} size={base.size} mode=RGB(flattened)")
    print(f"candidate: {args.candidate} size={cand.size} mode=RGB(flattened)")

    if base.size != cand.size:
        cand = cand.resize(base.size, Image.LANCZOS)
        print(f"NOTE: resized candidate to {base.size} for comparison")

    diff = ImageChops.difference(base, cand)
    hist = diff.histogram()
    total = base.size[0] * base.size[1]
    # hist layout: R(256), G(256), B(256)
    means = []
    for ch in range(3):
        s = sum(i * hist[ch * 256 + i] for i in range(256))
        means.append(s / total)

    rms = [((sum((i ** 2) * hist[ch * 256 + i] for i in range(256)) / total) ** 0.5) for ch in range(3)]
    bbox = diff.getbbox()

    print(f"mean abs diff per channel (R,G,B): {means[0]:.4f} {means[1]:.4f} {means[2]:.4f}")
    print(f"overall mean abs diff            : {sum(means)/3:.4f}")
    print(f"RMS diff per channel (R,G,B)     : {rms[0]:.4f} {rms[1]:.4f} {rms[2]:.4f}")
    print(f"diff bbox                        : {bbox}")

    # hard max diff
    mx = max(max(i for i in range(255, -1, -1) if hist[ch * 256 + i] > 0) for ch in range(3))
    print(f"max channel diff                 : {mx}")

    ok = (sum(means) / 3) <= args.tolerance
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
