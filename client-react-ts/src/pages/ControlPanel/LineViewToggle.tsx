import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIconVariant } from "./iconStem";

const assets = import.meta.glob<string>(
  "../../assets/icons/line-view/*.{png,webp}",
  { eager: true, import: "default" }
);

/** Longest clip (roll-up, 680 ms at the GIF's original speed) plus slack. */
const PLAY_MS = 750;

type Still = "open" | "rolled";
type Clip = "rollup" | "unroll";

function assetUrl(stem: string, variant: Still | Clip): string {
  const ext = variant === "open" || variant === "rolled" ? "png" : "webp";
  return assets[`../../assets/icons/line-view/${stem}-${variant}.${ext}`] ?? "";
}

type LineViewToggleProps = {
  /** True while the Line view is shown (blueprint unrolled). */
  active: boolean;
  onToggle: () => void;
};

export default function LineViewToggle({ active, onToggle }: LineViewToggleProps) {
  const { t } = useTranslation();
  const { accent, theme } = useIconVariant();
  const stem = `${accent}-${theme}`;
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const clips = useRef<Partial<Record<Clip, Blob>>>({});
  const timer = useRef<number | null>(null);
  const previous = useRef(active);

  useEffect(() => {
    let cancelled = false;
    clips.current = {};
    for (const still of ["open", "rolled"] as const) {
      new Image().src = assetUrl(stem, still);
    }
    for (const clip of ["rollup", "unroll"] as const) {
      void fetch(assetUrl(stem, clip))
        .then((res) => res.blob())
        .then((blob) => {
          if (!cancelled) clips.current[clip] = blob;
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [stem]);

  useEffect(() => {
    if (previous.current === active) return;
    previous.current = active;
    const clip: Clip = active ? "unroll" : "rollup";
    const blob = clips.current[clip];
    // Same-URL animated images share one timeline in the browser, so a
    // play-once clip only replays when it gets a fresh URL each time.
    const url = blob ? URL.createObjectURL(blob) : `${assetUrl(stem, clip)}?play=${Date.now()}`;
    setPlayingUrl(url);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlayingUrl(null), PLAY_MS);
  }, [active, stem]);

  useEffect(() => {
    if (!playingUrl?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(playingUrl);
  }, [playingUrl]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const src = playingUrl ?? assetUrl(stem, active ? "open" : "rolled");
  const label = active ? t("controlPanel.overview") : t("controlPanel.line");

  return (
    <button
      type="button"
      className={`cp-line-toggle ${active ? "is-active" : ""}`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <img src={src} alt="" width={26} height={26} draggable={false} />
    </button>
  );
}
