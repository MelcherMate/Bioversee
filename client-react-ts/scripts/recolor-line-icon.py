"""Recolor the Line-view blueprint GIF into transparent per-accent WebPs.

Usage: python3 scripts/recolor-line-icon.py   (from client-react-ts/, needs Pillow)

The source is black line art + one teal (#33cccc) stroke on white; see
icon_recolor.py. Output covers every accent preset in light and dark themes.

The GIF is a round trip (open -> rolled up -> open), so it is split into two
play-once animations plus a still for each end state.
"""

from pathlib import Path

from PIL import Image, ImageSequence

from icon_recolor import ACCENTS, LINE, accent_for_theme, hex_rgb, recolor_frame, save_animation

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "line-view-plan.gif"
OUT = ROOT.parent / "src" / "assets" / "icons" / "line-view"
SIZE = 96

ROLLED_FRAME = 14
# Original GIF pauses ~480 ms on the rolled frame between halves; when the
# unroll clip starts that frame is already on screen, so skip the pause.
ROLLED_HOLD_MS = 40


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.iterdir():
        old.unlink()
    frames = [f.copy() for f in ImageSequence.Iterator(Image.open(SOURCE))]
    durations = [f.info.get("duration", 40) for f in frames]
    unroll_durations = [ROLLED_HOLD_MS] + durations[ROLLED_FRAME + 1 :]

    for name, hex_value in ACCENTS.items():
        for theme, line_hex in LINE.items():
            accent = accent_for_theme(hex_rgb(hex_value), theme)
            line = hex_rgb(line_hex)
            rendered = [recolor_frame(f, line, accent, SIZE) for f in frames]
            stem = f"{name}-{theme}"
            rendered[0].save(OUT / f"{stem}-open.png", optimize=True)
            rendered[ROLLED_FRAME].save(OUT / f"{stem}-rolled.png", optimize=True)
            save_animation(
                OUT / f"{stem}-rollup.webp",
                rendered[: ROLLED_FRAME + 1],
                durations[: ROLLED_FRAME + 1],
                loop=1,
            )
            save_animation(
                OUT / f"{stem}-unroll.webp",
                rendered[ROLLED_FRAME:],
                unroll_durations,
                loop=1,
            )
            print("wrote", stem)


if __name__ == "__main__":
    main()
