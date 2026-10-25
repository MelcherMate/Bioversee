"""Shared helpers for recoloring the black + teal (#33cccc) animated icons.

Each pixel is decomposed into line / accent coverage so the output has real
alpha, then re-tinted. Accent presets mirror ACCENT_PRESETS in
src/lib/appearance.ts.
"""

from PIL import Image

SRC_TEAL = (51, 204, 204)

ACCENTS = {
    "green": "#0d9488",
    "yellow": "#ffe15d",
    "red": "#ff6b6b",
    "blue": "#5b9fff",
}

LINE = {"light": "#1d1d1f", "dark": "#e4e4e8"}


def hex_rgb(value: str) -> tuple[int, int, int]:
    n = int(value.lstrip("#"), 16)
    return (n >> 16) & 255, (n >> 8) & 255, n & 255


def luminance(rgb: tuple[int, int, int]) -> float:
    def lin(c: int) -> float:
        s = c / 255
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def accent_for_theme(rgb: tuple[int, int, int], theme: str) -> tuple[int, int, int]:
    """Mirror accentForResolvedTheme: brighten dark accents in night mode."""
    if theme == "light" or luminance(rgb) >= 0.55:
        return rgb
    return tuple(round(c + (255 - c) * 0.38) for c in rgb)  # type: ignore[return-value]


def recolor_frame(
    frame: Image.Image,
    line: tuple[int, int, int],
    accent: tuple[int, int, int],
    size: int,
) -> Image.Image:
    src = frame.convert("RGB")
    out = Image.new("RGBA", src.size)
    teal_span = SRC_TEAL[1] - SRC_TEAL[0]
    pixels = []
    for r, g, b in src.get_flattened_data():
        a_teal = max(0.0, min(1.0, ((g + b) / 2 - r) / teal_span))
        a_line = max(0.0, min(1.0 - a_teal, (255 - g - a_teal * (255 - SRC_TEAL[1])) / 255))
        alpha = a_line + a_teal
        if alpha <= 0.002:
            pixels.append((0, 0, 0, 0))
            continue
        color = tuple(
            round((a_line * line[i] + a_teal * accent[i]) / alpha) for i in range(3)
        )
        pixels.append((*color, round(alpha * 255)))
    out.putdata(pixels)
    return out.resize((size, size), Image.Resampling.LANCZOS)


def save_animation(
    path,
    frames: list[Image.Image],
    durations: list[int],
    loop: int,
) -> None:
    """loop=0 repeats forever; loop=1 plays once and holds the last frame."""
    if loop == 1:
        durations = durations[:-1] + [1000]
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=loop,
        quality=88,
        alpha_quality=100,
        method=6,
    )
