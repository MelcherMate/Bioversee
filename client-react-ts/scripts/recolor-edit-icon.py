"""Recolor the edit-mode barrier GIF into transparent WebP / PNG icons.

Usage: python3 scripts/recolor-edit-icon.py   (from client-react-ts/, needs Pillow)

Off state: a still of the first frame per accent preset and theme.
On state: an endlessly looping animation in the edit-mode yellow, which must
match --cp-edit in src/pages/ControlPanel/ControlPanel.css.
"""

from pathlib import Path

from PIL import Image, ImageSequence

from icon_recolor import ACCENTS, LINE, accent_for_theme, hex_rgb, recolor_frame, save_animation

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "edit-mode-barrier.gif"
OUT = ROOT.parent / "src" / "assets" / "icons" / "edit-mode"
SIZE = 96

EDIT_YELLOW = {"light": "#f2b705", "dark": "#ffd43b"}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.iterdir():
        old.unlink()
    frames = [f.copy() for f in ImageSequence.Iterator(Image.open(SOURCE))]
    durations = [f.info.get("duration", 40) for f in frames]

    for theme, line_hex in LINE.items():
        line = hex_rgb(line_hex)
        for name, hex_value in ACCENTS.items():
            accent = accent_for_theme(hex_rgb(hex_value), theme)
            still = recolor_frame(frames[0], line, accent, SIZE)
            still.save(OUT / f"{name}-{theme}-still.png", optimize=True)
            print("wrote", f"{name}-{theme}-still")

        yellow = hex_rgb(EDIT_YELLOW[theme])
        rendered = [recolor_frame(f, line, yellow, SIZE) for f in frames]
        save_animation(OUT / f"edit-{theme}-loop.webp", rendered, durations, loop=0)
        print("wrote", f"edit-{theme}-loop")


if __name__ == "__main__":
    main()
