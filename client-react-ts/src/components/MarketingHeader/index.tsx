import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LANGUAGE_OPTIONS, type AppLanguage } from "../../lib/appearance";
import { useAppearance } from "../../lib/AppearanceProvider";
import Logo from "../../utils/svgs/new_logo.svg";
import "./MarketingHeader.css";

function MarketingHeader() {
  const { t } = useTranslation();
  const { settings, setLanguage } = useAppearance();

  return (
    <header className="mkt-header">
      <Link to="/" className="mkt-header__brand">
        <span className="mkt-header__mark" aria-hidden="true">
          <img src={Logo} alt="" width={28} height={28} />
        </span>
        <span className="mkt-header__name">{t("common.brand")}</span>
      </Link>
      <div className="mkt-header__actions">
        <label className="mkt-header__lang">
          <span className="mkt-header__lang-label">{t("appearance.language")}</span>
          <select
            className="mkt-header__lang-select"
            value={settings.language}
            aria-label={t("appearance.language")}
            onChange={(event) =>
              setLanguage(event.target.value as AppLanguage)
            }
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <Link to="/login" className="mkt-header__signin">
          {t("auth.signIn")}
        </Link>
      </div>
    </header>
  );
}

export default MarketingHeader;
