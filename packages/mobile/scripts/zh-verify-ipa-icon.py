#!/usr/bin/env python3
"""Verify the compiled app icon inside a built iOS .ipa against the Android baseline.

Xcode writes app icon PNGs inside the bundle as Apple "CgBI" (optimized)
PNGs: a CgBI chunk precedes IHDR, IDAT holds raw deflate, and pixels are
stored BGRA premultiplied. Pillow cannot read these correctly, so this script
decodes them itself and then compares the result against the Android baseline
(`packages/mobile/assets/icon-only.png`).

The built icon is a downscaled copy of the 1024 asset, so it is compared
against a high-quality downscale of the baseline. Exact geometry (the non-white
bounding box) is the strong signal; a small residual mean diff comes only from
Xcode and Pillow using different resampling filters.

Usage:
  python zh-verify-ipa-icon.py --app <path to Payload/App.app> [--baseline ...]
"""
from __future__ import annotations

import argparse
import struct
import sys
import zlib
from pathlib import Path

from PIL import Image, ImageChops

REPO = Path(__file__).resolve().parents[3]
DEFAULT_BASELINE = REPO / "packages/mobile/assets/icon-only.png"


def read_chunks(data: bytes):
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    i = 8
    out = []
    while i < len(data):
        length = struct.unpack(">I", data[i : i + 4])[0]
        ctype = data[i + 4 : i + 8]
        out.append((ctype, data[i + 8 : i + 8 + length]))
        i += 12 + length
    return out


def decode_cgbi(path: Path) -> Image.Image:
    chunks = read_chunks(path.read_bytes())
    idat = b"".join(p for t, p in chunks if t == b"IDAT")
    ihdr = dict(chunks).get(b"IHDR")
    w, h, bitdepth, color, comp, filt, interlace = struct.unpack(">IIBBBBB", ihdr)
    bpp = 4  # color type 6, RGBA
    stride = w * bpp
    raw = zlib.decompress(idat, -15)  # raw deflate
    out = bytearray()
    prev = bytearray(stride)
    pos = 0
    for _ in range(h):
        ftype = raw[pos]; pos += 1
        line = bytearray(raw[pos : pos + stride]); pos += stride
        if ftype == 0:
            pass
        elif ftype == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 0xFF
        elif ftype == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 0xFF
        elif ftype == 3:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 0xFF
        elif ftype == 4:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 0xFF
        out += line
        prev = line
    img = Image.frombytes("RGBA", (w, h), bytes(out))
    r, g, b, a = img.split()
    return Image.merge("RGBA", (b, g, r, a))  # BGRA -> RGBA


def flatten(im: Image.Image, bg=(255, 255, 255)) -> Image.Image:
    im = im.convert("RGBA")
    base = Image.new("RGBA", im.size, bg + (255,))
    return Image.alpha_composite(base, im).convert("RGB")


def nonwhite_bbox(im: Image.Image, tol: int = 245):
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if not (r > tol and g > tol and b > tol):
                minx = min(minx, x); miny = min(miny, y)
                maxx = max(maxx, x); maxy = max(maxy, y)
    return (minx, miny, maxx, maxy)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", required=True, help="Path to Payload/App.app")
    ap.add_argument("--baseline", default=str(DEFAULT_BASELINE))
    args = ap.parse_args()

    app = Path(args.app)
    baseline = flatten(Image.open(args.baseline))
    print(f"baseline: {args.baseline} {baseline.size}")

    icons = sorted(p for p in app.glob("AppIcon*.png"))
    if not icons:
        print("ERROR: no compiled AppIcon*.png found in the app bundle", file=sys.stderr)
        return 1

    ok = True
    for p in icons:
        built = decode_cgbi(p)
        print(f"\n{p.name}: {built.size} (decoded from CgBI)")
        rgb = flatten(built)
        ref = baseline.resize(rgb.size, Image.LANCZOS)
        d = ImageChops.difference(ref, rgb)
        hist = d.histogram(); n = rgb.size[0] * rgb.size[1]
        means = [sum(i * hist[c * 256 + i] for i in range(256)) / n for c in range(3)]
        bbox = d.getbbox()
        bb_built = nonwhite_bbox(rgb)
        bb_ref = nonwhite_bbox(ref)
        print(f"  mean abs diff vs baseline(downscaled): avg={sum(means)/3:.3f} bbox={bbox}")
        print(f"  non-white bbox built : {bb_built}")
        print(f"  non-white bbox base  : {bb_ref}")
        same_geometry = bb_built == bb_ref
        print(f"  geometry match       : {same_geometry}")
        if not same_geometry:
            ok = False

    print("\nRESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
