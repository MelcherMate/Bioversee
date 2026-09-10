import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const APP_CALLBACK = "com.bioversee.app://login-callback";

/**
 * Bridge for the native iOS app Google/OAuth flow.
 * Supabase redirects here (https), then we deep-link into the app scheme
 * so ASWebAuthenticationSession / Safari can hand control back to Bioversee.
 */
function IosAuthBridge() {
  const { t } = useTranslation();
  const [manualHref, setManualHref] = useState<string | null>(null);

  const target = useMemo(() => {
    const { search, hash } = window.location;
    if (!search && !hash) return null;
    return `${APP_CALLBACK}${search}${hash}`;
  }, []);

  useEffect(() => {
    if (!target) return;
    setManualHref(target);
    // Give the OS a beat, then hand off to the native app.
    const handle = window.setTimeout(() => {
      window.location.replace(target);
    }, 150);
    return () => window.clearTimeout(handle);
  }, [target]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bv-surface)",
        color: "var(--bv-text)",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 360 }}>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--bv-text-tertiary)",
          }}
        >
          Bioversee
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 650 }}>
          {t("iosAuth.title")}
        </h1>
        <p style={{ margin: "0 0 18px", color: "var(--bv-text-secondary)", lineHeight: 1.45 }}>
          {target ? t("iosAuth.body") : t("iosAuth.missing")}
        </p>
        {manualHref ? (
          <a
            href={manualHref}
            style={{
              display: "inline-block",
              padding: "12px 16px",
              borderRadius: 12,
              background: "var(--bv-cta)",
              color: "#fff",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("iosAuth.openApp")}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default IosAuthBridge;
