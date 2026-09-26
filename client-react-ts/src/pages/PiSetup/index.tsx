import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../utils/svgs/new_logo.svg";
import "./PiSetup.css";

function PiSetup() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const command = useMemo(
    () =>
      `curl -fsSL ${window.location.origin}/downloads/bioversee-pi-setup.sh | bash`,
    []
  );

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
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

        <button
          type="button"
          className={`pi-setup__btn${copied ? " is-copied" : ""}`}
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

        <pre className="pi-setup__cmd" tabIndex={0}>
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
