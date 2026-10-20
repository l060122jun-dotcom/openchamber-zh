#!/usr/bin/env python3
"""Set the iOS app version for the Chinese fork.

Upstream's project file ships MARKETING_VERSION = 1.0 and CURRENT_PROJECT_VERSION
= 1 for every target, which makes the archived IPA indistinguishable from a first
build. This rewrites both settings across all configurations so the unsigned IPA
reports the fork's version, and it is idempotent: running it twice changes
nothing.

Each upstream release bumps the two constants below (2.3.2 -> 232, 2.5.0 -> 250);
the iOS workflow runs this script and then asserts the archived IPA reports them.
"""
import re
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1] / "ios" / "App" / "App.xcodeproj" / "project.pbxproj"

MARKETING_VERSION = "2.5.0"
CURRENT_PROJECT_VERSION = "250"


def main() -> int:
    text = PROJECT.read_text(encoding="utf-8")
    marketing, marketing_count = re.subn(
        r"MARKETING_VERSION = [^;]*;", f"MARKETING_VERSION = {MARKETING_VERSION};", text
    )
    updated, build_count = re.subn(
        r"CURRENT_PROJECT_VERSION = [^;]*;",
        f"CURRENT_PROJECT_VERSION = {CURRENT_PROJECT_VERSION};",
        marketing,
    )
    if marketing_count != 6 or build_count != 6:
        print(
            f"expected 6 configurations, found MARKETING_VERSION {marketing_count} and "
            f"CURRENT_PROJECT_VERSION {build_count}",
            file=sys.stderr,
        )
        return 1
    if updated != text:
        PROJECT.write_text(updated, encoding="utf-8")
        print(f"set {marketing_count} MARKETING_VERSION and {build_count} CURRENT_PROJECT_VERSION entries")
    else:
        print("already at the fork's version")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
