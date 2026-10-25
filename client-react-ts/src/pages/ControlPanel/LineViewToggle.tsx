import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIconVariant } from "./iconStem";

const assets = import.meta.glob<string>(
  "../../assets/icons/line-view/*.{png,webp}",
  { eager: true, import: "default" }
);

/**
 * Motion in the webp is ~600 ms; the last frame holds for ~1 s.
 * Cut during that hold so we land on the crisp PNG without waiting out the hold.
 */
const PLAY_MS = 700;

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
  /** Mirrors `active`; updated before toggle so the sync effect does not replay. */
  const previous = useRef(active);
  const stemRef = useRef(stem);
  stemRef.current = stem;

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

  const playClip = (clip: Clip) => {
    const currentStem = stemRef.current;
    const blob = clips.current[clip];
    // Same-URL animated images share one timeline in the browser, so a
    // play-once clip only replays when it gets a fresh URL each time.
    const url = blob
      ? URL.createObjectURL(blob)
      : `${assetUrl(currentStem, clip)}?play=${Date.now()}`;
    setPlayingUrl(url);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlayingUrl(null), PLAY_MS);
  };

  // External active changes (e.g. edit-title forcing Overview) still get a clip.
  useEffect(() => {
    if (previous.current === active) return;
    previous.current = active;
    playClip(active ? "unroll" : "rollup");
  }, [active]);

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

  const onClick = () => {
    const next = !active;
    // Start the clip in the same turn as the view change so the first paint
    // never flashes the destination still and then replays the whole roll.
    previous.current = next;
    playClip(next ? "unroll" : "rollup");
    onToggle();
  };

  const src = playingUrl ?? assetUrl(stem, active ? "open" : "rolled");
  const label = active ? t("controlPanel.overview") : t("controlPanel.line");

  return (
    <button
      type="button"
      className={`cp-line-toggle ${active ? "is-active" : ""}`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <img src={src} alt="" width={26} height={26} draggable={false} />
    </button>
  );
}
