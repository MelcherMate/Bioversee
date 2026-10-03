import { useTranslation } from "react-i18next";

/** Public Payment Link — safe to expose; never put secret keys here. */
const DONATE_URL =
  (import.meta.env.VITE_STRIPE_DONATE_URL as string | undefined)?.trim() ||
  "https://buy.stripe.com/dRm14ofbJ0eagsRgKJ2Ji00";

export function isStripeDonateConfigured(): boolean {
  return Boolean(DONATE_URL);
}

type StripeDonateButtonProps = {
  className?: string;
};

/**
 * Donate via Stripe Payment Link (customer chooses amount).
 */
export function StripeDonateButton({
  className = "landing-btn landing-btn--on-accent",
}: StripeDonateButtonProps) {
  const { t } = useTranslation();

  if (!isStripeDonateConfigured()) return null;

  return (
    <a
      className={className}
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t("about.supportDonate")}
    </a>
  );
}
