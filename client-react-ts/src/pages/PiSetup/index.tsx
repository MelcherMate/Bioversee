import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../utils/svgs/new_logo.svg";
import "./PiSetup.css";

const INSTALLER_HREF = "/downloads/Install-Bioversee.desktop";

function PiSetup() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);

  const command = `curl -fsSL ${window.location.origin}/downloads/bioversee-pi-setup.sh | bash`;

  useEffect(() => {
    // Auto-start download of the installer app icon
    const a = document.createElement("a");
    a.href = INSTALLER_HREF;
    a.download = "Install-Bioversee.desktop";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStarted(true);
  }, []);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pi-setup" data-theme="light">
      <div className="pi-setup__card">
        <img className="pi-setup__logo" src={Logo} alt="" width={72} height={72} />
        <p className="pi-setup__kicker">{t("piSetup.kicker")}</p>
        <h1 className="pi-setup__title">{t("piSetup.title")}</h1>
        <p className="pi-setup__lede">{t("piSetup.lede")}</p>

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

        <a
          className="pi-setup__btn"
          href={INSTALLER_HREF}
          download="Install-Bioversee.desktop"
        >
          {started ? t("piSetup.downloadAgain") : t("piSetup.download")}
        </a>

        <button type="button" className="pi-setup__linkish" onClick={copyCommand}>
          {copied ? t("piSetup.copied") : t("piSetup.copyCommand")}
        </button>

        <p className="pi-setup__hint">{t("piSetup.hint")}</p>
        <Link className="pi-setup__back" to="/about">
          {t("piSetup.back")}
        </Link>
      </div>
    </div>
  );
}

export default PiSetup;
