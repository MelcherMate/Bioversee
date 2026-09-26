import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppPhonePreview from "../../components/AppPhonePreview";
import RaspberryPiPreview from "../../components/RaspberryPiPreview";
import WebAppPreview from "../../components/WebAppPreview";
import Mate from "../../img/Mate.png";
import Logo from "../../utils/svgs/new_logo.svg";
import "./About.css";

function useRevealOnScroll() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nodes = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return rootRef;
}

function About() {
  const { t } = useTranslation();
  const rootRef = useRevealOnScroll();

  return (
    <div className="landing" ref={rootRef} data-theme="light">
      <section className="landing-hero" aria-labelledby="landing-brand">
        <div className="landing-hero__veil" aria-hidden="true" />
        <div className="landing-hero__content">
          <img
            className="landing-hero__logo"
            src={Logo}
            alt=""
            width={88}
            height={88}
          />
          <p className="landing-hero__eyebrow">{t("about.eyebrow")}</p>
          <h1 id="landing-brand" className="landing-hero__brand">
            {t("common.brand")}
          </h1>
          <p className="landing-hero__headline">{t("about.headline")}</p>
          <p className="landing-hero__body">{t("about.heroBody")}</p>
        </div>
      </section>

      <section
        id="product"
        className="landing-section landing-section--web-peek"
        aria-labelledby="product-title"
      >
        <div className="landing-section__inner landing-section__inner--web">
          <WebAppPreview />
          <div className="landing-app-copy">
            <p className="landing-kicker">{t("about.webKicker")}</p>
            <h2 id="product-title" className="landing-title">
              {t("about.webTitle")}
            </h2>
            <p className="landing-lede">{t("about.webBody")}</p>
          </div>
        </div>
      </section>

      <section
        id="app"
        className="landing-section landing-section--muted"
        data-reveal
        aria-labelledby="app-title"
      >
        <div className="landing-section__inner landing-section__inner--app">
          <div className="landing-app-copy">
            <p className="landing-kicker">{t("about.productKicker")}</p>
            <h2 id="app-title" className="landing-title">
              {t("about.productTitle")}
            </h2>
            <p className="landing-lede">{t("about.productBody")}</p>
          </div>
          <AppPhonePreview />
        </div>
      </section>

      <section
        id="raspberry-pi"
        className="landing-section"
        data-reveal
        aria-labelledby="pi-title"
      >
        <div className="landing-section__inner landing-section__inner--pi">
          <RaspberryPiPreview />
          <div className="landing-app-copy">
            <p className="landing-kicker">{t("about.piKicker")}</p>
            <h2 id="pi-title" className="landing-title">
              {t("about.piTitle")}
            </h2>
            <p className="landing-lede">{t("about.piBody")}</p>
            <a
              className="landing-btn landing-btn--primary"
              href="https://github.com/MelcherMate/Bioversee_Webapp/tree/main/raspberry-pi-app#install-on-a-raspberry-pi"
              target="_blank"
              rel="noreferrer"
            >
              {t("about.piDownload")}
            </a>
            <p className="landing-soon">{t("about.piDownloadHint")}</p>
          </div>
        </div>
      </section>

      <section
        id="about"
        className="landing-section landing-section--muted"
        data-reveal
        aria-labelledby="story-title"
      >
        <div className="landing-section__inner">
          <p className="landing-kicker">{t("about.storyKicker")}</p>
          <h2 id="story-title" className="landing-title">
            {t("about.storyTitle")}
          </h2>
          <div className="landing-story">
            <article className="landing-story__block">
              <img
                className="landing-story__media landing-story__photo"
                src={Mate}
                alt={t("about.founderName")}
                width={96}
                height={96}
              />
              <div className="landing-story__copy">
                <p className="landing-story__role">{t("about.founder")}</p>
                <h3 className="landing-story__name">{t("about.founderName")}</h3>
                <p className="landing-story__text">{t("about.founderBody")}</p>
              </div>
            </article>
            <article className="landing-story__block">
              <span
                className="landing-story__media landing-story__logo-wrap"
                aria-hidden="true"
              >
                <img src={Logo} alt="" width={48} height={48} />
              </span>
              <div className="landing-story__copy">
                <p className="landing-story__role">{t("about.company")}</p>
                <h3 className="landing-story__name">{t("common.brand")}</h3>
                <p className="landing-story__text">{t("about.companyBody")}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-cta" data-reveal aria-labelledby="cta-title">
        <div className="landing-cta__inner">
          <h2 id="cta-title" className="landing-title landing-title--on-accent">
            {t("about.ctaTitle")}
          </h2>
          <p className="landing-lede landing-lede--on-accent">
            {t("about.ctaBody")}
          </p>
          <Link to="/login" className="landing-btn landing-btn--on-accent">
            {t("auth.signIn")}
          </Link>
        </div>
      </section>
    </div>
  );
}

export default About;
