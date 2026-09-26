"""Canonical package version for Bioversee Pi.

Bump VERSION (and this module) when shipping an update. Display form is vMAJOR.MINOR
(e.g. 1.1.0 → v1.1). Patch is used for semver compare only.
"""

from __future__ import annotations

from importlib import metadata
from pathlib import Path

# Source of truth for this tree (also in VERSION file + pyproject.toml).
__version__ = "1.1.2"


def display_version(version: str | None = None) -> str:
    """1.1.0 → v1.1 ; 1.1.2 → v1.1.2 if patch != 0."""
    v = (version or __version__).lstrip("vV")
    parts = v.split(".")
    while len(parts) < 3:
        parts.append("0")
    major, minor, patch = parts[0], parts[1], parts[2]
    if patch == "0" and len(parts) == 3:
        return f"v{major}.{minor}"
    return f"v{major}.{minor}.{patch}"


def parse_version(version: str) -> tuple[int, int, int]:
    v = version.strip().lstrip("vV")
    parts = v.split(".")
    nums: list[int] = []
    for part in parts[:3]:
        digits = "".join(ch for ch in part if ch.isdigit())
        nums.append(int(digits or "0"))
    while len(nums) < 3:
        nums.append(0)
    return nums[0], nums[1], nums[2]


def compare_versions(a: str, b: str) -> int:
    """Return -1 if a<b, 0 if equal, 1 if a>b."""
    pa, pb = parse_version(a), parse_version(b)
    if pa < pb:
        return -1
    if pa > pb:
        return 1
    return 0


def read_version_file(path: Path | None = None) -> str:
    file_path = path or Path(__file__).resolve().parents[1] / "VERSION"
    if file_path.exists():
        return file_path.read_text(encoding="utf-8").strip() or __version__
    try:
        return metadata.version("bioversee-pi")
    except metadata.PackageNotFoundError:
        return __version__
