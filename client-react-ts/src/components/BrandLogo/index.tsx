import type { CSSProperties } from "react";
import "./BrandLogo.css";
import { LOGO_MARK, LOGO_MARK_SMALL, LOGO_WORDMARK, LOGO_WORDMARK_SMALL, WORDMARK_RATIO } from "./logoSvgs";

/**
 * Brand rule: use EITHER the mark OR the wordmark — never both together.
 * Both render inline from the --bv-* tokens, so light/dark switch automatically.
 */
type Common = { className?: string; style?: CSSProperties; title?: string };

/** Dial + vessel mark. Below 48px the simplified small master is used. */
export function LogoMark({ size = 32, className, style, title }: Common & { size?: number }) {
  return (
    <span
      className={`bv-logo bv-logo--mark ${className ?? ""}`}
      style={{ width: size, height: size, ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: size < 48 ? LOGO_MARK_SMALL : LOGO_MARK }}
    />
  );
}

/** “Bioversee” wordmark with the mark as the ‘o’. Below 160px wide the small-size variant is used. */
export function Wordmark({ height = 24, className, style, title = "Bioversee" }: Common & { height?: number }) {
  const width = height * WORDMARK_RATIO;
  return (
    <span
      className={`bv-logo bv-logo--word ${className ?? ""}`}
      style={{ height, width, ...style }}
      role="img"
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: width < 160 ? LOGO_WORDMARK_SMALL : LOGO_WORDMARK }}
    />
  );
}
