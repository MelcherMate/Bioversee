import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./Footer.css";

type FooterProps = {
  showSignIn?: boolean;
};

function Footer({ showSignIn = false }: FooterProps) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__copy">
        <p>
          © {year} {t("common.brand")}. {t("footer.rights")} Mate Melcher.
        </p>
      </div>
      <nav className="site-footer__links" aria-label={t("footer.navLabel")}>
        <Link className="site-footer__link" to="/about">
          {t("footer.about")}
        </Link>
        {showSignIn ? (
          <Link className="site-footer__link" to="/login">
            {t("auth.signIn")}
          </Link>
        ) : null}
        <a
          className="site-footer__link"
          href="https://github.com/MelcherMate"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("footer.github")}
        </a>
      </nav>
    </footer>
  );
}

export default Footer;
