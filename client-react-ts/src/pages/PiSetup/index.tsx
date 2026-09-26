import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../utils/svgs/new_logo.svg";
import "./PiSetup.css";

const SETUP_HREF = "/downloads/bioversee-pi-setup.sh";
const SETUP_FILENAME = "bioversee-pi-setup.sh";

function PiSetup() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const command = useMemo(
    () =>
      `curl -fsSL ${window.location.origin}${SETUP_HREF} | bash`,
    []
  );

  const triggerDownload = () => {
    // Force a file download (Vercel also sends Content-Disposition: attachment).
    const a = document.createElement("a");
    a.href = SETUP_HREF;
    a.download = SETUP_FILENAME;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2500);
  };

  const copyCommand = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(command);
      } else {
        throw new Error("clipboard unavailable");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for Pi browsers / non-secure contexts where clipboard is blocked.
      const pre = document.getElementById("pi-setup-cmd");
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      window.prompt(t("piSetup.copyFallback"), command);
    }
  };

  return (
    <div className="pi-setup" data-theme="light">
      <div className="pi-setup__card">
        <img className="pi-setup__logo" src={Logo} alt="" width={72} height={72} />
        <p className="pi-setup__kicker">{t("piSetup.kicker")}</p>
        <h1 className="pi-setup__title">{t("piSetup.title")}</h1>
        <p className="pi-setup__lede">{t("piSetup.lede")}</p>

        <button
          type="button"
          className={`pi-setup__btn${downloaded ? " is-copied" : ""}`}
          onClick={triggerDownload}
        >
          {downloaded ? t("piSetup.downloaded") : t("piSetup.download")}
        </button>

        <button
          type="button"
          className={`pi-setup__btn pi-setup__btn--ghost${copied ? " is-copied" : ""}`}
          onClick={copyCommand}
        >
          {copied ? t("piSetup.copied") : t("piSetup.copyCommand")}
        </button>

        <ol className="pi-setup__steps">
          <li>
            <strong>{t("piSetup.step1Title")}</strong>
            <span>{t("piSetup.step1Body")}</span>
          </li>
          <li>
            <strong>{t("piSetup.step2Title")}</strong>
            <span>{t("piSetup.step2Body")}</span>
          </li>
          <li>
            <strong>{t("piSetup.step3Title")}</strong>
            <span>{t("piSetup.step3Body")}</span>
          </li>
        </ol>

        <pre className="pi-setup__cmd" id="pi-setup-cmd" tabIndex={0}>
          {command}
        </pre>

        <p className="pi-setup__hint">{t("piSetup.hint")}</p>
        <Link className="pi-setup__back" to="/about">
          {t("piSetup.back")}
        </Link>
      </div>
    </div>
  );
}

export default PiSetup;
