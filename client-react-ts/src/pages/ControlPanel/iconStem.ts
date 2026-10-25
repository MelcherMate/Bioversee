import { ACCENT_PRESETS, resolveTheme } from "../../lib/appearance";
import { useAppearance } from "../../lib/AppearanceProvider";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function nearestPresetId(accent: string): string {
  const [r, g, b] = hexToRgb(accent);
  let best: string = ACCENT_PRESETS[0].id;
  let bestDist = Infinity;
  for (const preset of ACCENT_PRESETS) {
    const [pr, pg, pb] = hexToRgb(preset.value);
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = preset.id;
    }
  }
  return best;
}

/** Accent preset + resolved theme, matching the recolored icon file names. */
export function useIconVariant(): { accent: string; theme: "light" | "dark" } {
  const { settings } = useAppearance();
  return {
    accent: nearestPresetId(settings.accent),
    theme: resolveTheme(settings.theme),
  };
}
