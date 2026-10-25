import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useIconVariant } from "./iconStem";

const assets = import.meta.glob<string>(
  "../../assets/icons/edit-mode/*.{png,webp}",
  { eager: true, import: "default" }
);

function assetUrl(name: string): string {
  return assets[`../../assets/icons/edit-mode/${name}`] ?? "";
}

type EditModeToggleProps = {
  active: boolean;
  onToggle: () => void;
};

export default function EditModeToggle({ active, onToggle }: EditModeToggleProps) {
  const { t } = useTranslation();
  const { accent, theme } = useIconVariant();
  const still = assetUrl(`${accent}-${theme}-still.png`);
  const loop = assetUrl(`edit-${theme}-loop.webp`);

  useEffect(() => {
    new Image().src = loop;
  }, [loop]);

  const label = active ? t("controlPanel.exitEditMode") : t("controlPanel.editMode");

  return (
    <button
      type="button"
      className={`cp-edit-toggle ${active ? "is-active" : ""}`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <img src={active ? loop : still} alt="" width={26} height={26} draggable={false} />
    </button>
  );
}
