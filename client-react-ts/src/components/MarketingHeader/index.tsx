import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../utils/svgs/new_logo.svg";
import "./MarketingHeader.css";

function MarketingHeader() {
  const { t } = useTranslation();

  return (
    <header className="mkt-header">
      <Link to="/" className="mkt-header__brand">
        <span className="mkt-header__mark" aria-hidden="true">
          <img src={Logo} alt="" width={28} height={28} />
        </span>
        <span className="mkt-header__name">{t("common.brand")}</span>
      </Link>
      <Link to="/login" className="mkt-header__signin">
        {t("auth.signIn")}
      </Link>
    </header>
  );
}

export default MarketingHeader;
