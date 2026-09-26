import { useTranslation } from "react-i18next";
import piSkeleton from "./pi-skeleton.png";
import "./RaspberryPiPreview.css";

/** Raspberry Pi landing preview — product screenshot artwork. */
function RaspberryPiPreview() {
  const { t } = useTranslation();

  return (
    <div className="pi-preview">
      <img
        className="pi-preview__img"
        src={piSkeleton}
        alt={t("about.piLabel")}
        width={292}
        height={206}
        decoding="async"
      />
      <p className="pi-preview__caption">{t("about.piCaption")}</p>
    </div>
  );
}

export default RaspberryPiPreview;
