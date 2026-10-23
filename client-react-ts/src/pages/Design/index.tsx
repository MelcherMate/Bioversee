import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import AnimatedNumber from "../../components/AnimatedNumber";
import AppPhonePreview from "../../components/AppPhonePreview";
import ConstructionPage from "../../components/ConstructionPage";
import EmptyDeviceState from "../../components/EmptyDeviceState";
import Footer from "../../components/Footer";
import GoogleMark from "../../components/GoogleMark";
import InfoCard from "../../components/infoCard";
import Knob from "../../components/Knob";
import MarketingHeader from "../../components/MarketingHeader";
import RaspberryPiPreview from "../../components/RaspberryPiPreview";
import SegmentedControl from "../../components/SegmentedControl";
import Slider from "../../components/Slider";
import { StripeDonateButton } from "../../components/StripeDonateButton";
import Switch from "../../components/Switch";
import { ToastStack, type ToastItem } from "../../components/Toast";
import VesselShapeSkeleton from "../../components/VesselShapeSkeleton";
import WebAppPreview from "../../components/WebAppPreview";
import FacebookPng from "../../img/facebook.png";
import GithubPng from "../../img/github.png";
import GooglePng from "../../img/google.png";
import Mate from "../../img/Mate.png";
import { ACCENT_PRESETS, DEFAULT_ACCENT, LANGUAGE_OPTIONS } from "../../lib/appearance";
import { VESSEL_SHAPE_OPTIONS } from "../../lib/bioreactorGeometry";
import type { AppUser } from "../../lib/user";
import { LogoMark, Wordmark } from "../../components/BrandLogo";
import "../About/About.css";
import "../Login/Login.css";
import "./Design.css";
import { LogoBlueprintSection } from "./LogoBlueprint";
import { EmailTemplateSection, LinkedInCopySection, LinkedInGraphicSection } from "./Templates";
import {
  classNames,
  componentSources,
  cssFiles,
  declarations,
  durations,
  easings,
  gradients,
  inlineSvgFiles,
  ionicons,
  keyframes,
  literalColors,
  mediaQueries,
  pageSources,
  propsBlocks,
  tallyNumeric,
  tallyProps,
  tokenBlock,
  varUsage,
  type Tally,
} from "./cssAudit";

const SECTIONS = [
  { id: "overview", label: "Overview", group: "Design system" },
  { id: "brand", label: "Brand & logo" },
  { id: "logo-blueprint", label: "Logo blueprint" },
  { id: "colour", label: "Colour tokens" },
  { id: "accents", label: "Accent & dark mode" },
  { id: "palette", label: "Literal palette" },
  { id: "gradients", label: "Gradients" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing" },
  { id: "layout", label: "Layout & breakpoints" },
  { id: "radii", label: "Radii & borders" },
  { id: "shadows", label: "Shadows & elevation" },
  { id: "opacity", label: "Opacity & blur" },
  { id: "zindex", label: "Z-index" },
  { id: "icons", label: "Icons" },
  { id: "imagery", label: "Imagery" },
  { id: "motion", label: "Motion" },
  { id: "buttons", label: "Buttons & links" },
  { id: "forms", label: "Inputs & forms" },
  { id: "controls", label: "Controls" },
  { id: "feedback", label: "Feedback & badges" },
  { id: "cards", label: "Cards & surfaces" },
  { id: "chrome", label: "Header & footer" },
  { id: "overlays", label: "Modals & overlays" },
  { id: "previews", label: "Product previews" },
  { id: "inventory", label: "Component inventory" },
  { id: "patterns", label: "Page patterns" },
  { id: "voice", label: "Tone of voice" },
  { id: "tpl-email", label: "Company email", group: "Templates" },
  { id: "tpl-signature", label: "Email signature" },
  { id: "tpl-linkedin", label: "LinkedIn graphics" },
  { id: "tpl-linkedin-copy", label: "LinkedIn post copy" },
  { id: "gaps", label: "Not documented" },
] as { id: string; label: string; group?: string }[];

/* Placeholder identity for live demos of device-bound controls. The empty
 * device id keeps Switch / Slider / Knob from subscribing to a real device. */
const DEMO_USER = { id: "design-demo" } as unknown as AppUser;

function Section({ id, kicker, title, lede, children }: {
  id: string;
  kicker: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="ds-section" aria-labelledby={`${id}-title`}>
      <p className="landing-kicker">{kicker}</p>
      <h2 id={`${id}-title`} className="landing-title ds-section__title">{title}</h2>
      {lede ? <p className="landing-lede ds-section__lede">{lede}</p> : null}
      {children}
    </section>
  );
}

function Sub({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="ds-sub">
      <h3 className="ds-sub__title">{title}</h3>
      {note ? <p className="ds-note">{note}</p> : null}
      {children}
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="ds-code">{children}</code>;
}

/** Blocks every interaction so device-bound demos can never write to Supabase. */
function DisplayOnly({ children }: { children: ReactNode }) {
  const stop = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div
      className="ds-display-only"
      aria-disabled="true"
      onClickCapture={stop}
      onChangeCapture={stop}
      onPointerDownCapture={stop}
      onPointerUpCapture={stop}
      onWheelCapture={stop}
      onKeyDownCapture={stop}
    >
      {children}
    </div>
  );
}

function Stage({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <div className={`ds-stage${dark ? " ds-stage--dark" : ""} ${className}`}>{children}</div>;
}

function TallyTable({ rows, label, limit }: { rows: Tally[]; label: string; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th className="ds-num">Uses</th>
            <th>Files</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.value}>
              <td><Code>{row.value}</Code></td>
              <td className="ds-num">{row.count}</td>
              <td className="ds-files">{row.files.map((f) => f.replace(/^src\//, "")).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit ? (
        <p className="ds-note">Showing the {limit} most-used of {rows.length} values.</p>
      ) : null}
    </div>
  );
}

function useResolvedVar(name: string, key: string): string {
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }, [name, key]);
  return value;
}

function rgbOf(color: string): string {
  if (typeof document === "undefined" || !color) return "";
  const probe = document.createElement("span");
  probe.style.color = color;
  document.body.appendChild(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out;
}

const TOKEN_NOTES: Record<string, string> = {
  "--bv-font": "Global UI font stack (body, buttons, inputs).",
  "--bv-text": "Primary text, headings.",
  "--bv-text-secondary": "Body copy, ledes, secondary labels.",
  "--bv-text-tertiary": "Eyebrows, captions, meta.",
  "--bv-line": "Hairline dividers and 1px rings.",
  "--bv-surface": "App / page background.",
  "--bv-surface-elevated": "Raised panels on the surface.",
  "--bv-card": "Cards, popovers, menus.",
  "--bv-fill": "Neutral fills (image wells, chips).",
  "--bv-radius-lg": "Cards and large panels.",
  "--bv-radius-md": "Buttons, inputs, small cards.",
  "--bv-shadow-card": "Resting card elevation.",
  "--bv-shadow-float": "Floating menus, toasts, hover cards.",
  "--bv-overlay": "Modal backdrop scrim.",
  "--bv-user-accent": "Raw accent the user picked (unadjusted).",
  "--bv-accent": "Brand / interactive accent (theme-adjusted).",
  "--bv-accent-hover": "Accent hover, accent-coloured text.",
  "--bv-accent-bright": "Lighter accent for highlights.",
  "--bv-accent-muted": "Tinted backgrounds, focus rings.",
  "--bv-accent-soft": "Very light accent wash (hover fills).",
  "--bv-accent-border": "Accent outlines (ghost buttons, inputs).",
  "--bv-glass": "Frosted header / sheet background.",
  "--bv-glass-border": "Border on glass surfaces.",
  "--bv-cta": "Primary call-to-action fill.",
  "--bv-cta-hover": "Primary CTA hover.",
  "--bv-cta-text": "Text on CTA.",
  "--bv-input-bg": "Text-field background.",
  "--bv-danger-soft": "Error banner background.",
  "--bv-danger": "Errors, destructive actions.",
  "--bv-success": "Success text / dots.",
  "--bv-accent-glow": "Soft accent glow (rings, halos).",
  "--bv-segment-thumb": "Segmented-control thumb.",
  "--bv-control-track": "Switch / slider track.",
  "--bv-control-thumb": "Control thumb (off).",
  "--bv-control-thumb-on": "Control thumb (on).",
  "--bv-ease": "House easing curve for every transition.",
  "--bv-num-duration": "AnimatedNumber digit roll duration.",
};

const isColorToken = (name: string, value: string) =>
  !/radius|shadow|font|ease|duration/.test(name) && !/^\d+px$/.test(value);

type InventoryEntry = { name: string; dir: string; role: string; live: boolean };

const INVENTORY: InventoryEntry[] = [
  { name: "AccountMenu", dir: "AccountMenu", role: "Avatar dropdown: switch / add / sign out accounts.", live: false },
  { name: "AddDevicePanel", dir: "AddDevicePanel", role: "Header popover for creating a device (type, shape, geometry).", live: false },
  { name: "AnimatedNumber", dir: "AnimatedNumber", role: "Odometer-style rolling digits for live readouts.", live: true },
  { name: "AnimationLab", dir: "AnimationLab", role: "Dev-only motion tuning overlay (mounted globally in App).", live: false },
  { name: "AppPhonePreview", dir: "AppPhonePreview", role: "Interactive iPhone mock for the landing page.", live: true },
  { name: "AppSettingsPanel", dir: "AppSettingsPanel", role: "Theme / accent / language preferences panel.", live: false },
  { name: "Canvas (Bioreactor)", dir: "Canvas", role: "Animated bioreactor drawing, bubble field, level meter.", live: false },
  { name: "Canvas2 (WaterPurifier)", dir: "Canvas2", role: "Water-purifier process drawing.", live: false },
  { name: "Chart", dir: "Chart", role: "Recharts sensor chart card.", live: false },
  { name: "ConstructionPage", dir: "ConstructionPage", role: "Work-in-progress placeholder card.", live: true },
  { name: "ControlClock", dir: "ControlClock", role: "Live clock in the control desk.", live: false },
  { name: "DevDataPanel", dir: "DevDataPanel", role: "Hidden developer data panel (L+B shortcut).", live: false },
  { name: "DeviceContextMenu", dir: "DeviceContextMenu", role: "Right-click menu on device chips.", live: false },
  { name: "DeviceSettingsPanel", dir: "DeviceSettingsPanel", role: "Per-device settings sheet.", live: false },
  { name: "EmptyDeviceState", dir: "EmptyDeviceState", role: "Empty state with Add-device CTA.", live: true },
  { name: "EquipmentChecklist", dir: "EquipmentChecklist", role: "Toggle list of installed equipment.", live: false },
  { name: "FluidPropertiesFields", dir: "FluidPropertiesFields", role: "Fluid property inputs.", live: false },
  { name: "Footer", dir: "Footer", role: "Site footer (copyright + links). Not mounted on any route today.", live: true },
  { name: "GoogleMark", dir: "GoogleMark", role: "Multicolour Google G for social sign-in.", live: true },
  { name: "InfoCard", dir: "infoCard", role: "Image + title + copy card.", live: true },
  { name: "Knob", dir: "Knob", role: "Rotary actuator control (free-spin arc or stepped ticks).", live: true },
  { name: "MarketingHeader", dir: "MarketingHeader", role: "Landing header: brand, language, sign-in.", live: true },
  { name: "Navbar", dir: "Navbar", role: "Signed-in top bar: devices, notifications, settings, account.", live: false },
  { name: "NotificationsPanel", dir: "NotificationsPanel", role: "Inbox popover.", live: false },
  { name: "OnboardingModal", dir: "OnboardingModal", role: "First-run modal.", live: false },
  { name: "RaspberryPiPreview", dir: "RaspberryPiPreview", role: "Raspberry Pi device mock.", live: true },
  { name: "SegmentedControl", dir: "SegmentedControl", role: "Pill / rounded tab switcher with sliding thumb.", live: true },
  { name: "SharePanel", dir: "SharePanel", role: "Invite / share device panel.", live: false },
  { name: "Slider", dir: "Slider", role: "Linear actuator slider with live value.", live: true },
  { name: "StripeDonateButton", dir: "", role: "Stripe Payment Link button.", live: true },
  { name: "Switch", dir: "Switch", role: "On/off actuator toggle with status dot.", live: true },
  { name: "Toast", dir: "Toast", role: "ToastStack + useToasts hook (info / success / warning / error).", live: true },
  { name: "VesselShapeSkeleton", dir: "VesselShapeSkeleton", role: "Outline vessel silhouette for the shape picker.", live: true },
  { name: "WebAppPreview", dir: "WebAppPreview", role: "Skeleton of the web control desk.", live: true },
  { name: "membrane-bioreactor/*", dir: "membrane-bioreactor", role: "MBR process drawing + control panel.", live: false },
  { name: "pressure-vessel/*", dir: "pressure-vessel", role: "Pressure-vessel drawing, water level panel, pipe styles.", live: false },
];

const TOAST_DEMO: ToastItem[] = [
  { id: "t-info", tone: "info", title: "Syncing device", detail: "Info toasts stay until dismissed." },
  { id: "t-success", tone: "success", title: "Saved", detail: "Other tones auto-dismiss after 3.2 s." },
  { id: "t-warning", tone: "warning", title: "Sensor offline", detail: "Last reading 2 min ago." },
  { id: "t-error", tone: "error", title: "Could not save", detail: "Check your connection." },
];

function DesignSystem() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [previewAccent, setPreviewAccent] = useState<string>(DEFAULT_ACCENT);

  // noindex + title while this page is mounted.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Design system · Bioversee";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.title = prevTitle;
      meta.remove();
    };
  }, []);

  // Preview theme / accent on <html> without saving preferences; restore on leave.
  useEffect(() => {
    const root = document.documentElement;
    const prev = {
      theme: root.dataset.theme,
      scheme: root.style.colorScheme,
      accent: root.style.getPropertyValue("--bv-accent"),
      user: root.style.getPropertyValue("--bv-user-accent"),
    };
    return () => {
      if (prev.theme) root.dataset.theme = prev.theme;
      root.style.colorScheme = prev.scheme;
      root.style.setProperty("--bv-accent", prev.accent);
      root.style.setProperty("--bv-user-accent", prev.user);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = previewTheme;
    root.style.colorScheme = previewTheme;
    root.style.setProperty("--bv-accent", previewAccent);
    root.style.setProperty("--bv-user-accent", previewAccent);
  }, [previewTheme, previewAccent]);

  // Scroll-spy for the bookmark sidebar.
  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const onScroll = () => {
      const offset = window.innerWidth <= 960 ? 96 : 48;
      let current: string = SECTIONS[0].id;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top - offset <= 0) current = node.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = nodes[nodes.length - 1]?.id ?? current;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Keep the active bookmark visible inside the scrollable sidebar.
  useEffect(() => {
    const link = document.querySelector<HTMLElement>(`.ds-toc__link[data-id="${active}"]`);
    const list = link?.closest<HTMLElement>(".ds-toc__scroll");
    if (!link || !list) return;
    const top = link.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - 40) {
      list.scrollTo({ top: top - list.clientHeight / 2 });
    }
  }, [active]);

  const data = useMemo(() => {
    const light = tokenBlock(":root");
    const dark = tokenBlock(':root[data-theme="dark"]');
    const landing = tokenBlock(".landing", "src/pages/About/About.css");
    return {
      light,
      dark,
      landing,
      usage: varUsage(),
      colors: literalColors(),
      gradients: gradients(),
      fontSize: tallyNumeric(["font-size"]),
      fontSizeOther: tallyProps(["font-size"]).filter((t) => !/^-?\d*\.?\d+px$/.test(t.value)),
      fontWeight: tallyProps(["font-weight"]).sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
      lineHeight: tallyProps(["line-height"]).sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
      letterSpacing: tallyProps(["letter-spacing"]).sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
      fontFamily: tallyProps(["font-family"]),
      textTransform: tallyProps(["text-transform"]),
      spacing: tallyNumeric(["padding", "padding-top", "padding-bottom", "padding-left", "padding-right", "padding-inline", "padding-block", "margin", "margin-top", "margin-bottom", "margin-left", "margin-right", "margin-inline", "margin-block", "gap", "row-gap", "column-gap"]),
      widths: tallyProps(["max-width", "width"]).filter((t) => /min\(|^\d{3,}px$/.test(t.value)),
      grids: tallyProps(["grid-template-columns"]),
      media: mediaQueries(),
      radii: tallyProps(["border-radius"]),
      borders: tallyProps(["border", "border-top", "border-bottom", "border-left", "border-right"]),
      borderWidths: tallyNumeric(["border", "border-top", "border-bottom", "border-left", "border-right", "border-width", "outline", "stroke-width"]),
      shadows: tallyProps(["box-shadow"]),
      filters: tallyProps(["filter", "backdrop-filter", "-webkit-backdrop-filter"]),
      opacity: tallyProps(["opacity"]).sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
      zIndex: tallyProps(["z-index"]).sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
      keyframes: keyframes(),
      durations: durations(),
      easings: easings(),
      icons: ionicons(),
      svgs: inlineSvgFiles(),
    };
  }, []);

  const tokenNames = Object.keys(data.light);
  const colorTokens = tokenNames.filter((n) => isColorToken(n, data.light[n]));
  const localVars = [...data.usage.keys()].filter((n) => !tokenNames.includes(n) && !(n in data.landing)).sort();
  const breakpoints = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of data.media) {
      const re = /(max|min)-width:\s*(\d+)px/g;
      let x: RegExpExecArray | null;
      while ((x = re.exec(m.value))) {
        const key = `${x[1]}-width ${x[2]}px`;
        map.set(key, (map.get(key) ?? 0) + m.count);
      }
    }
    return [...map.entries()].sort((a, b) => parseInt(a[0].split(" ")[1]) - parseInt(b[0].split(" ")[1]));
  }, [data.media]);

  const [seg, setSeg] = useState<"signin" | "signup">("signin");
  const [seg2, setSeg2] = useState<number>(2);
  const [sw, setSw] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [sl, setSl] = useState(64);
  const [kn, setKn] = useState(40);
  const [kn2, setKn2] = useState(1.25);
  const [num, setNum] = useState(23.4);
  const [modalOpen, setModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>(TOAST_DEMO);
  const themeKey = `${previewTheme}-${previewAccent}`;
  const resolvedAccent = useResolvedVar("--bv-accent", themeKey);

  const jump = (id: string) => {
    setDrawerOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  const activeLabel = SECTIONS.find((s) => s.id === active)?.label ?? "";

  return (
    <div className="ds">
      <div className="ds-mobilebar">
        <button
          type="button"
          className="ds-mobilebar__btn"
          aria-expanded={drawerOpen}
          aria-controls="ds-toc"
          onClick={() => setDrawerOpen((o) => !o)}
        >
          <LogoMark size={22} />
          <span className="ds-mobilebar__title">Design system</span>
          <span className="ds-mobilebar__current">{activeLabel}</span>
          <span className={`ds-mobilebar__chev${drawerOpen ? " is-open" : ""}`} aria-hidden="true">▾</span>
        </button>
      </div>
      {drawerOpen ? <div className="ds-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" /> : null}

      <aside id="ds-toc" className={`ds-toc${drawerOpen ? " is-open" : ""}`} aria-label="Design system sections">
        <div className="ds-toc__brand">
          <div>
            <p className="ds-toc__name"><Wordmark height={18} /></p>
            <p className="ds-toc__meta">Design system · internal</p>
          </div>
        </div>
        <nav className="ds-toc__scroll">
          <ol className="ds-toc__list">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                {s.group ? <p className="ds-toc__group">{s.group}</p> : null}
                <a
                  href={`#${s.id}`}
                  data-id={s.id}
                  className={`ds-toc__link${active === s.id ? " is-active" : ""}`}
                  aria-current={active === s.id ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(s.id);
                  }}
                >
                  <span className="ds-toc__index">{String(i + 1).padStart(2, "0")}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="ds-toc__controls">
          <span className="ds-toc__ctl-label">Preview theme</span>
          <SegmentedControl<"light" | "dark">
            shape="pill"
            aria-label="Preview theme"
            value={previewTheme}
            onChange={setPreviewTheme}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          />
          <span className="ds-toc__ctl-label">Preview accent</span>
          <div className="ds-toc__accents">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`ds-accent-dot${previewAccent === p.value ? " is-active" : ""}`}
                style={{ background: p.value }}
                aria-label={`${p.label} accent`}
                onClick={() => setPreviewAccent(p.value)}
              />
            ))}
          </div>
        </div>
      </aside>

      <main className="ds-content">
        <section id="overview" className="ds-hero landing" aria-labelledby="overview-title">
          <div className="landing-hero__veil" aria-hidden="true" />
          <div className="ds-hero__inner">
            <LogoMark size={72} className="landing-hero__logo" />
            <p className="landing-hero__eyebrow">Internal · not linked · noindex</p>
            <h1 id="overview-title" className="landing-hero__brand">Design language</h1>
            <p className="landing-hero__headline">Calm, Apple-style surfaces with a single teal accent.</p>
            <p className="landing-hero__body">
              Everything here is rendered with the real Bioversee components and stylesheets.
              Token tables are parsed from the source CSS at build time, so they stay in sync with the code.
            </p>
            <div className="ds-stats">
              <div className="ds-stat"><AnimatedNumber value={tokenNames.length} /><span>core tokens</span></div>
              <div className="ds-stat"><AnimatedNumber value={data.colors.length} /><span>literal colours</span></div>
              <div className="ds-stat"><AnimatedNumber value={INVENTORY.length} /><span>components</span></div>
              <div className="ds-stat"><AnimatedNumber value={cssFiles.length} /><span>stylesheets</span></div>
              <div className="ds-stat"><AnimatedNumber value={data.keyframes.length} /><span>keyframes</span></div>
            </div>
            <p className="ds-note ds-hero__note">
              Stack: React 18 + Vite, plain CSS per component (BEM-style names with <Code>bv-</Code>, <Code>landing-</Code>,{" "}
              <Code>auth-</Code>, <Code>topbar__</Code> prefixes) driven by <Code>--bv-*</Code> custom properties in{" "}
              <Code>src/index.css</Code>. No Tailwind, no CSS-in-JS.
            </p>
          </div>
        </section>

        <Section id="brand" kicker="Brand" title="Logo & identity"
          lede="Two signatures, never combined: the dial + vessel mark, and the Bioversee wordmark whose ‘o’ is the same mark.">
          <Sub title="Logo set" note={<>Rule: use <b>either</b> the mark <b>or</b> the wordmark — never together. Components: <Code>{"<LogoMark size />"}</Code> and <Code>{"<Wordmark height />"}</Code> from <Code>src/components/BrandLogo</Code> (inline SVG, token colours, auto small master). Files: <Code>src/public/assets/logo/</Code>.</>}>
            <div className="ds-grid ds-grid--4">
              <Stage><LogoMark size={88} /><span className="ds-cap">Mark · light</span></Stage>
              <Stage dark><img src="/assets/logo/d-mark-dark.svg" alt="" width={88} height={88} /><span className="ds-cap">Mark · dark</span></Stage>
              <Stage><Wordmark height={30} /><span className="ds-cap">Wordmark</span></Stage>
              <Stage dark><img src="/assets/logo/g-wordmark-dark.svg" alt="" height={30} /><span className="ds-cap">Wordmark · dark</span></Stage>
            </div>
          </Sub>
          <Sub title="Placements" note="Wordmark where there is horizontal room (marketing header, signed-in navbar, auth card, About hero, emails, LinkedIn graphics). Mark alone in compact spots (≤520px marketing header, ≤640px navbar, Pi setup, favicon, app icons, avatars).">
            <Stage className="ds-row">
              {[16, 22, 28, 48, 64, 88].map((s) => (
                <span key={s} className="ds-size"><LogoMark size={s} /><span className="ds-cap">{s}px{s < 48 ? " · small" : ""}</span></span>
              ))}
            </Stage>
          </Sub>
          <Sub title="Favicon & app icons" note={<><Code>src/index.html</Code>: <Code>favicon.svg</Code> (small mark, follows prefers-color-scheme), <Code>favicon-32.png</Code>, <Code>favicon-16.png</Code>, <Code>apple-touch-icon.png</Code> (180, teal tile) and <Code>site.webmanifest</Code> with 192/512 teal tiles.</>}>
            <Stage className="ds-row">
              <span className="ds-favicon"><img src="/assets/logo/favicon-16.png" alt="" width={16} height={16} /> Bioversee</span>
              <img src="/assets/logo/apple-touch-icon.png" alt="" width={60} height={60} style={{ borderRadius: 14 }} />
            </Stage>
          </Sub>
        </Section>

        <Section id="logo-blueprint" kicker="Brand" title="Logo blueprint"
          lede="Technical drawing of the final identity: the dial-and-vessel mark and the wordmark whose ‘o’ is that mark — never used together.">
          <LogoBlueprintSection />
        </Section>

        <Section id="colour" kicker="Colour" title="Colour tokens"
          lede={<>All {colorTokens.length} <Code>--bv-*</Code> colour tokens on <Code>:root</Code> in <Code>src/index.css</Code>, with night-mode overrides from <Code>{':root[data-theme="dark"]'}</Code>. Swatches show the currently previewed theme.</>}>
          <div className="ds-swatches">
            {colorTokens.map((name) => (
              <TokenSwatch key={name} name={name} light={data.light[name]} dark={data.dark[name]} uses={data.usage.get(name) ?? 0} themeKey={themeKey} />
            ))}
          </div>
          <Sub title="Landing overrides" note={<><Code>.landing</Code> (About page) forces a light marketing palette regardless of theme and adds <Code>--bv-landing-display</Code>.</>}>
            <div className="ds-swatches ds-swatches--compact">
              {Object.entries(data.landing).map(([name, value]) => (
                <div key={name} className="ds-swatch">
                  <span className="ds-swatch__chip" style={{ background: /display/.test(name) ? "transparent" : value }} />
                  <div className="ds-swatch__body">
                    <Code>{name}</Code>
                    <span className="ds-swatch__val">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </Sub>
          {localVars.length ? (
            <Sub title="Component-scoped variables" note="Custom properties defined locally inside a component (not global tokens), with reference counts.">
              <div className="ds-chips">
                {localVars.map((v) => <span key={v} className="ds-chip"><Code>{v}</Code> ×{data.usage.get(v)}</span>)}
              </div>
            </Sub>
          ) : null}
        </Section>

        <Section id="accents" kicker="Colour" title="Accent & dark mode"
          lede={<>The accent is user-selectable (<Code>ACCENT_PRESETS</Code> in <Code>src/lib/appearance.ts</Code>). Accent tints are derived with <Code>color-mix()</Code>; in dark mode accents with luminance below 0.55 are mixed 38% toward white (<Code>accentForResolvedTheme</Code>). Use the sidebar to preview.</>}>
          <div className="ds-grid ds-grid--4">
            {ACCENT_PRESETS.map((p) => (
              <button key={p.id} type="button" className={`ds-accent-card${previewAccent === p.value ? " is-active" : ""}`} onClick={() => setPreviewAccent(p.value)}>
                <span className="ds-accent-card__chip" style={{ background: p.value }} />
                <strong>{p.label}{p.value === DEFAULT_ACCENT ? " · default" : ""}</strong>
                <Code>{p.value}</Code>
                <span className="ds-cap">{rgbOf(p.value)}</span>
              </button>
            ))}
          </div>
          <Sub title="Derived accent ramp (live)" note={<>Resolved <Code>--bv-accent</Code> right now: <Code>{resolvedAccent}</Code> ({previewTheme}).</>}>
            <div className="ds-ramp">
              {["--bv-accent-soft", "--bv-accent-muted", "--bv-accent-border", "--bv-accent-bright", "--bv-accent", "--bv-accent-hover", "--bv-accent-glow"].map((v) => (
                <div key={v} className="ds-ramp__step">
                  <span style={{ background: `var(${v})` }} />
                  <Code>{v.replace("--bv-", "")}</Code>
                </div>
              ))}
            </div>
          </Sub>
          <Sub title="Theme behaviour" note="Preference is light | dark | system (default system), stored in localStorage key bv.appearance.v1 and synced to Supabase for signed-in users. The landing page always renders light.">
            <div className="ds-grid ds-grid--2">
              <ThemeCard theme="light" />
              <ThemeCard theme="dark" />
            </div>
          </Sub>
        </Section>

        <Section id="palette" kicker="Colour" title="Literal palette"
          lede={`Every hard-coded colour literal found across ${cssFiles.length} stylesheets (token definitions excluded) — ${data.colors.length} values. Most are process-drawing colours (water, steel, pipes) and status tints. Hover a chip for its files.`}>
          <div className="ds-literals">
            {data.colors.map((c) => (
              <div key={c.value} className="ds-literal" title={c.files.join("\n")}>
                <span className="ds-literal__chip" style={{ background: c.value }} />
                <Code>{c.value}</Code>
                <span className="ds-cap">×{c.count}</span>
              </div>
            ))}
          </div>
          <Sub title="Status colours" note="Toast tones from src/components/Toast/Toast.css.">
            <div className="ds-grid ds-grid--4">
              {[
                ["info", "#f0f9ff", "#bae6fd"],
                ["success", "#ecfdf5", "#a7f3d0"],
                ["warning", "#fffbeb", "#fde68a"],
                ["error", "#fef2f2", "#fecaca"],
              ].map(([tone, bg, bd]) => (
                <div key={tone} className="ds-status" style={{ background: bg, borderColor: bd }}>
                  <strong>{tone}</strong>
                  <Code>bg {bg}</Code>
                  <Code>border {bd}</Code>
                </div>
              ))}
            </div>
          </Sub>
        </Section>

        <Section id="gradients" kicker="Colour" title="Gradients"
          lede={`${data.gradients.length} unique gradient declarations. Hero veils layer radial accent washes over a white → surface linear base; the support CTA is a teal radial.`}>
          <div className="ds-grid ds-grid--3">
            {data.gradients.map((g, i) => (
              <figure key={i} className="ds-gradient landing">
                <div className="ds-gradient__chip" style={{ background: g.value }} />
                <figcaption>
                  <span className="ds-cap">{g.file.replace(/^src\//, "")} · {g.prop}</span>
                  <pre className="ds-pre">{g.value}</pre>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>

        <Section id="typography" kicker="Typography" title="Type"
          lede={<>Two families: the system UI stack (<Code>--bv-font</Code>) for everything, and <strong>Outfit</strong> 500 / 600 / 700 (Google Fonts, imported in <Code>About.css</Code>) as <Code>--bv-landing-display</Code> for marketing headings.</>}>
          <div className="ds-grid ds-grid--2">
            <div className="ds-family">
              <p className="ds-family__sample" style={{ fontFamily: "var(--bv-font)" }}>Aa Bb 0123</p>
              <Code>--bv-font</Code>
              <p className="ds-note">{data.light["--bv-font"]}</p>
            </div>
            <div className="ds-family landing">
              <p className="ds-family__sample" style={{ fontFamily: "var(--bv-landing-display)", fontWeight: 650 }}>Aa Bb 0123</p>
              <Code>--bv-landing-display</Code>
              <p className="ds-note">{data.landing["--bv-landing-display"]} · weights 500, 600, 700</p>
            </div>
          </div>

          <Sub title="Type scale (rendered with the real classes)">
            <div className="ds-typescale landing">
              {[
                ["H1 · display", "landing-hero__brand", "Bioversee", "Outfit 700 · clamp(36px, 8vw, 64px) · lh 0.95 · ls -0.045em"],
                ["H2 · section title", "landing-title", "Control your process", "Outfit 650 · clamp(28px, 4vw, 40px) · lh 1.1 · ls -0.035em"],
                ["Headline", "landing-hero__headline", "Automation that feels like child's play", "Outfit 600 · clamp(18px, 3vw, 26px) · lh 1.25 · ls -0.03em"],
                ["H3 · team name", "landing-team-member__name", "Mate Melcher", "Outfit 650 · 24px · lh 1.15 · ls -0.03em"],
                ["H4 · list title", "landing-evidence__title-plain", "Teaching and learning", "Outfit 650 · 18px · lh 1.25 · ls -0.025em"],
                ["H5 · dialog title", "landing-pi-gate__title", "Raspberry Pi download", "System 700 · 1.15rem"],
                ["H6 · card subtitle", "infocard", "Temperature", "System 600 · 18px · ls -0.02em (InfoCard #subtitle)"],
                ["Lede", "landing-lede", "We believe industrial automation shouldn’t be complicated.", "System 400 · 16px · lh 1.55 · secondary"],
                ["Body", "landing-evidence__text", "Engineers learn when they can see how a plant behaves.", "System 400 · 15px · lh 1.6 · secondary"],
                ["Small", "landing-soon", "Early access — password required.", "System 400 · 13px · lh 1.4 · tertiary"],
                ["Caption", "landing-refs__list", "Mayer, R. E. Multimedia Learning.", "System 400 · 12.5px · lh 1.55"],
                ["Label", "landing-pi-gate__label", "Password", "System 600 · 13px · secondary"],
                ["Eyebrow / kicker", "landing-kicker", "Industrial process control", "System 700 · 11px · ls 0.12em · uppercase · accent-hover"],
              ].map(([name, cls, sample, spec]) => (
                <div key={name} className="ds-type-row">
                  <div className="ds-type-row__meta"><strong>{name}</strong><span className="ds-cap">{cls.startsWith("landing") ? `.${cls.replace("-plain", "")}` : ""}</span></div>
                  <div className="ds-type-row__sample">
                    {cls === "infocard" ? (
                      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>{sample}</span>
                    ) : cls === "landing-refs__list" ? (
                      <ol className="landing-refs__list" style={{ margin: 0 }}><li>{sample}</li></ol>
                    ) : cls === "landing-evidence__title-plain" ? (
                      <p className="landing-evidence__title ds-no-counter" style={{ margin: 0 }}>{sample}</p>
                    ) : (
                      <p className={cls} style={{ margin: 0 }}>{sample}</p>
                    )}
                    <span className="ds-cap">{spec}</span>
                  </div>
                </div>
              ))}
            </div>
          </Sub>

          <Sub title="Weights" note="550 and 650 are used as in-between weights (variable system fonts).">
            <div className="ds-weights">
              {data.fontWeight.map((w) => (
                <span key={w.value} className="ds-weight" style={{ fontWeight: Number(w.value) || undefined }}>
                  Aa <Code>{w.value}</Code> <span className="ds-cap">×{w.count}</span>
                </span>
              ))}
            </div>
          </Sub>
          <Sub title={`Every px font-size in the codebase (${data.fontSize.length})`}>
            <div className="ds-sizes">
              {data.fontSize.map((s) => (
                <span key={s.value} className="ds-fs"><span style={{ fontSize: s.value }}>Ag</span><span className="ds-cap">{s.value} ×{s.count}</span></span>
              ))}
            </div>
            <TallyTable rows={data.fontSizeOther} label="Other font-size values" />
          </Sub>
          <div className="ds-grid ds-grid--2">
            <Sub title="Line heights"><TallyTable rows={data.lineHeight} label="line-height" /></Sub>
            <Sub title="Letter spacing"><TallyTable rows={data.letterSpacing} label="letter-spacing" /></Sub>
          </div>
          <div className="ds-grid ds-grid--2">
            <Sub title="font-family declarations"><TallyTable rows={data.fontFamily} label="font-family" /></Sub>
            <Sub title="text-transform"><TallyTable rows={data.textTransform} label="text-transform" /></Sub>
          </div>
        </Section>

        <Section id="spacing" kicker="Space" title="Spacing"
          lede="There is no spacing token; spacing is written in px. Below is every px value used in padding / margin / gap — the de-facto scale clusters on 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 36, 48 and 72.">
          <div className="ds-space">
            {data.spacing.filter((s) => parseFloat(s.value) > 0).map((s) => (
              <div key={s.value} className="ds-space__row">
                <Code>{s.value}</Code>
                <span className="ds-space__bar" style={{ width: `min(${s.value}, 100%)` }} />
                <span className="ds-cap">×{s.count}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="layout" kicker="Layout" title="Layout, containers & breakpoints"
          lede="Content columns are capped with min(N px, 100%) — 640 / 720 / 760 / 960 / 1040px on the landing page. Sections use 72px vertical / 24px horizontal padding (48 / 16 under 520px).">
          <Sub title={`Breakpoints (${breakpoints.length}, from @media queries)`}>
            <div className="ds-bps">
              {breakpoints.map(([bp, n]) => {
                const px = parseInt(bp.split(" ")[1]);
                return (
                  <div key={bp} className="ds-bp">
                    <span className="ds-bp__bar"><span style={{ width: `${Math.min(100, (px / 1440) * 100)}%` }} /></span>
                    <Code>{bp}</Code><span className="ds-cap">×{n}</span>
                  </div>
                );
              })}
            </div>
            <TallyTable rows={data.media} label="@media query" />
          </Sub>
          <Sub title="Containers (width caps)"><TallyTable rows={data.widths} label="width / max-width" /></Sub>
          <Sub title="Grid templates"><TallyTable rows={data.grids} label="grid-template-columns" /></Sub>
        </Section>

        <Section id="radii" kicker="Shape" title="Radii & borders"
          lede={<>Two radius tokens (<Code>--bv-radius-lg</Code> {data.light["--bv-radius-lg"]}, <Code>--bv-radius-md</Code> {data.light["--bv-radius-md"]}) plus {data.radii.length} distinct border-radius values. Borders are nearly always 1px hairlines in <Code>--bv-line</Code> or accent-border.</>}>
          <div className="ds-radii">
            {data.radii.map((r) => (
              <div key={r.value} className="ds-radius">
                <span className="ds-radius__box" style={{ borderRadius: r.value }} />
                <Code>{r.value}</Code><span className="ds-cap">×{r.count}</span>
              </div>
            ))}
          </div>
          <div className="ds-grid ds-grid--2">
            <Sub title="Border declarations"><TallyTable rows={data.borders} label="border" limit={20} /></Sub>
            <Sub title="Border / outline / stroke widths"><TallyTable rows={data.borderWidths} label="width" /></Sub>
          </div>
        </Section>

        <Section id="shadows" kicker="Depth" title="Shadows & elevation"
          lede="Elevation = a 1px ring + a long, soft, negative-spread drop. Two tokens cover most surfaces; every other box-shadow is listed below.">
          <div className="ds-grid ds-grid--2">
            {["--bv-shadow-card", "--bv-shadow-float"].map((s) => (
              <div key={s} className="ds-elev" style={{ boxShadow: `var(${s})` }}>
                <Code>{s}</Code>
                <pre className="ds-pre">{data.light[s]}</pre>
              </div>
            ))}
          </div>
          <Sub title={`All box-shadow values (${data.shadows.length})`}>
            <div className="ds-shadow-grid">
              {data.shadows.map((s) => (
                <div key={s.value} className="ds-shadow" title={s.files.join("\n")}>
                  <span className="ds-shadow__box" style={{ boxShadow: s.value }} />
                  <Code>{s.value}</Code>
                  <span className="ds-cap">×{s.count}</span>
                </div>
              ))}
            </div>
          </Sub>
        </Section>

        <Section id="opacity" kicker="Depth" title="Opacity, filters & blur">
          <div className="ds-opacity">
            {data.opacity.map((o) => (
              <div key={o.value} className="ds-opacity__step">
                <span style={{ opacity: Number.isFinite(Number(o.value)) ? Number(o.value) : 1 }} />
                <Code>{o.value}</Code><span className="ds-cap">×{o.count}</span>
              </div>
            ))}
          </div>
          <Sub title="filter / backdrop-filter"><TallyTable rows={data.filters} label="filter" /></Sub>
        </Section>

        <Section id="zindex" kicker="Depth" title="Z-index scale"
          lede="No z-index tokens; observed layering: content 0–5, sticky chrome and popovers in the tens, dialogs at 80+, toasts at 120.">
          <TallyTable rows={data.zIndex} label="z-index" />
        </Section>

        <Section id="icons" kicker="Iconography" title="Icons"
          lede={<>Library: <Code>react-ionicons</Code> (Ionicons “Outline” set), rendered with <Code>color="currentColor"</Code> at 18–22px. Brand marks, eye toggles and all process drawings are inline SVG.</>}>
          <IoniconGrid names={data.icons.map((i) => i.value)} />
          <TallyTable rows={data.icons} label="Ionicon" />
          <Sub title="Brand & social icons (src/img + GoogleMark)">
            <Stage className="ds-row">
              {[["github.png", GithubPng], ["google.png", GooglePng], ["facebook.png", FacebookPng]].map(([n, src]) => (
                <span key={n} className="ds-size"><img src={src} alt={n} width={32} height={32} style={{ objectFit: "contain" }} /><span className="ds-cap">{n}</span></span>
              ))}
              <span className="ds-size"><GoogleMark size={32} /><span className="ds-cap">GoogleMark</span></span>
            </Stage>
          </Sub>
          <Sub title="Inline SVG count per file"><TallyTable rows={data.svgs} label="File" /></Sub>
        </Section>

        <Section id="imagery" kicker="Imagery" title="Imagery & illustration"
          lede="No stock photography. The product is shown through clean UI skeletons (web, phone, Pi) and code-drawn process diagrams (vessels, pipes, water, bubbles) in neutral greys with the accent as highlight. People photos are circular with a hairline ring.">
          <div className="ds-grid ds-grid--3">
            <Stage className="landing">
              <img className="landing-team-member__photo" src={Mate} alt="Founder portrait" />
              <span className="ds-cap">Portrait · 96px circle · 1px line ring</span>
            </Stage>
            <Stage>
              <div className="ds-vessels">
                {VESSEL_SHAPE_OPTIONS.map((s) => <VesselShapeSkeleton key={s} shape={s} height={96} />)}
              </div>
              <span className="ds-cap">VesselShapeSkeleton · {VESSEL_SHAPE_OPTIONS.join(" / ")}</span>
            </Stage>
            <Stage><span className="ds-imagery-note">Process drawings (Canvas, pressure-vessel, membrane-bioreactor) are live SVG/CSS bound to device data — see Component inventory.</span></Stage>
          </div>
        </Section>

        <Section id="motion" kicker="Motion" title="Motion"
          lede={<>One house curve — <Code>--bv-ease: {data.light["--bv-ease"]}</Code> (a soft ease-out) — with 0.2s for hover / colour and 0.25–0.7s for entrances and reveals. Landing motion respects <Code>prefers-reduced-motion</Code>.</>}>
          <MotionDemo />
          <div className="ds-grid ds-grid--2">
            <Sub title="Durations"><TallyTable rows={data.durations} label="duration" /></Sub>
            <Sub title="Easing functions"><TallyTable rows={data.easings} label="easing" /></Sub>
          </div>
          <Sub title={`Keyframes (${data.keyframes.length})`}>
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead><tr><th>Name</th><th>File</th><th>Definition</th></tr></thead>
                <tbody>
                  {data.keyframes.map((k) => (
                    <tr key={`${k.file}-${k.name}`}><td><Code>{k.name}</Code></td><td className="ds-files">{k.file.replace(/^src\//, "")}</td><td><span className="ds-kf">{k.body}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sub>
          <Sub title="AnimatedNumber (odometer)" note={<>Digits roll over <Code>--bv-num-duration</Code> ({data.light["--bv-num-duration"]}).</>}>
            <Stage className="ds-row landing">
              <span className="ds-bignum"><AnimatedNumber value={num} decimals={1} suffix=" °C" /></span>
              <button type="button" className="landing-btn landing-btn--ghost" onClick={() => setNum((n) => Math.round((n + (Math.random() * 10 - 4)) * 10) / 10)}>Randomise</button>
            </Stage>
          </Sub>
        </Section>

        <Section id="buttons" kicker="Components" title="Buttons & links"
          lede="Buttons: 12px radius, 650 weight, 14px text, 12×18px padding; hover lifts 1px over 0.2s. Primary = near-black CTA (accent in dark mode), ghost = accent outline, on-accent = white on teal.">
          <Sub title=".landing-btn · variants × states">
            <div className="ds-table-wrap landing">
              <table className="ds-table ds-states">
                <thead><tr><th>Variant</th><th>Default</th><th>Hover</th><th>Disabled</th></tr></thead>
                <tbody>
                  {(["landing-btn--primary", "landing-btn--ghost", "landing-btn--on-accent"] as const).map((v) => (
                    <tr key={v}>
                      <td><Code>.{v}</Code></td>
                      {["default", "hover", "disabled"].map((st) => (
                        <td key={st} className={v === "landing-btn--on-accent" ? "ds-on-accent" : ""}>
                          <button type="button" className={`landing-btn ${v}${st === "hover" ? ` ds-hover-${v.replace("landing-btn--", "")}` : ""}`} disabled={st === "disabled"}>
                            {st === "disabled" ? "Disabled" : "Download"}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sub>
          <Sub title="Auth buttons (src/pages/Login/Login.css)" note=".auth-cta (full-width submit), .auth-social--google (outlined social), optional .auth-last-used badge, .auth-or divider, .auth-note--link.">
            <Stage className="ds-stack ds-auth-demo">
              <button type="button" className="auth-cta">Sign in</button>
              <button type="button" className="auth-cta auth-cta--with-badge">Sign in<span className="auth-last-used">Last used</span></button>
              <button type="button" className="auth-cta" disabled>Please wait…</button>
              <div className="auth-or"><span>or</span></div>
              <button type="button" className="auth-social auth-social--google">
                <span className="auth-social__icon" aria-hidden><GoogleMark size={18} /></span>
                <span className="auth-social__label">Continue with Google</span>
              </button>
              <a className="auth-note auth-note--link" href="#buttons">Cancel and stay signed in</a>
            </Stage>
          </Sub>
          <Sub title="Other buttons" note="StripeDonateButton defaults to .landing-btn--on-accent; EmptyDeviceState uses .empty-device__add-btn.">
            <Stage className="ds-row landing">
              <StripeDonateButton className="landing-btn landing-btn--primary" />
              <span className="ds-on-accent ds-pad"><StripeDonateButton /></span>
            </Stage>
          </Sub>
          <Sub title="Links" note="Global a { color: inherit }. Footer links are secondary text at 550 weight, accent on hover (0.2s).">
            <Stage className="ds-row">
              <a className="site-footer__link" href="#buttons">Footer link</a>
              <a className="mkt-header__signin" href="#buttons">Sign in</a>
              <a href="#buttons">Inline link (inherits)</a>
            </Stage>
          </Sub>
        </Section>

        <Section id="forms" kicker="Components" title="Inputs & forms"
          lede="Two input styles: auth fields (label above, accent focus ring) and the compact dialog input (42px, 10px radius). Language select from MarketingHeader.">
          <div className="ds-grid ds-grid--2">
            <Stage className="ds-stack ds-auth-demo">
              <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
                <label className="auth-field"><span>Email</span><input type="email" placeholder="you@example.com" /></label>
                <div className="auth-field">
                  <span>Password</span>
                  <div className="auth-password"><input type="password" defaultValue="secret12" aria-label="Password" /></div>
                </div>
                <label className="auth-field"><span>Disabled</span><input type="text" placeholder="Disabled" disabled /></label>
              </form>
              <p className="auth-error">Invalid login credentials.</p>
              <p className="auth-message">Check your inbox to verify your email.</p>
            </Stage>
            <Stage className="ds-stack landing">
              <label className="landing-pi-gate__label" htmlFor="ds-pw">Password</label>
              <input id="ds-pw" className="landing-pi-gate__input" placeholder="Enter password" />
              <p className="landing-pi-gate__error" role="alert">Incorrect password.</p>
              <label className="mkt-header__lang">
                <span className="mkt-header__lang-label">Language</span>
                <select className="mkt-header__lang-select" defaultValue="en" aria-label="Language">
                  {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value.toUpperCase()}</option>)}
                </select>
              </label>
            </Stage>
          </div>
        </Section>

        <Section id="controls" kicker="Components" title="Controls"
          lede="Actuator controls from the control desk, shown display-only: interaction is blocked so these demos never subscribe to or write to a device.">
          <Sub title="SegmentedControl" note='Props: options, value, onChange, shape "pill" | "rounded" (default), accent, disabled, className, aria-label. role="tablist" — the closest thing to tabs in the codebase.'>
            <div className="ds-grid ds-grid--3">
              <Stage className="ds-stack">
                <SegmentedControl<"signin" | "signup"> shape="pill" value={seg} onChange={setSeg} aria-label="Pill" options={[{ value: "signin", label: "Sign in" }, { value: "signup", label: "Sign up" }]} />
                <span className="ds-cap">pill</span>
              </Stage>
              <Stage className="ds-stack">
                <SegmentedControl<number> value={seg2} onChange={setSeg2} accent aria-label="Rounded accent" options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n}×` }))} />
                <span className="ds-cap">rounded · accent</span>
              </Stage>
              <Stage className="ds-stack">
                <SegmentedControl<number> value={2} onChange={() => undefined} disabled aria-label="Disabled" options={[1, 2, 3].map((n) => ({ value: n, label: `${n}` }))} />
                <span className="ds-cap">disabled</span>
              </Stage>
            </div>
          </Sub>
          <Sub title="Switch" note="On, off and disabled states. Props: deviceId, name, label, val, setVal, user, disabled.">
            <div className="ds-grid ds-grid--3">
              <Stage><DisplayOnly><Switch deviceId="" name="demo-a" label="Pump · on" val={sw} setVal={setSw} user={DEMO_USER} /></DisplayOnly></Stage>
              <Stage><DisplayOnly><Switch deviceId="" name="demo-b" label="Heater · off" val={sw2} setVal={setSw2} user={DEMO_USER} /></DisplayOnly></Stage>
              <Stage><DisplayOnly><Switch deviceId="" name="demo-c" label="Disabled" val={true} setVal={() => undefined} user={DEMO_USER} disabled /></DisplayOnly></Stage>
            </div>
          </Sub>
          <Sub title="Slider" note='Props: deviceId, name, label, val, setVal, user, min = 0, max = 100, unit = "%", disabled.'>
            <div className="ds-grid ds-grid--2">
              <Stage><DisplayOnly><Slider deviceId="" name="demo-s" label="Stirrer" val={sl} setVal={setSl} user={DEMO_USER} /></DisplayOnly></Stage>
              <Stage><DisplayOnly><Slider deviceId="" name="demo-s2" label="Disabled" val={30} setVal={() => undefined} user={DEMO_USER} disabled /></DisplayOnly></Stage>
            </div>
          </Sub>
          <Sub title="Knob" note='Props: deviceId, name, label, val, setVal, user, min, max, unit = "%", decimals, step (stepped ticks; omit for free-spin arc), disabled. Drag or mouse-wheel.'>
            <div className="ds-grid ds-grid--3">
              <Stage><DisplayOnly><Knob deviceId="" name="demo-k" label="Stepped" val={kn} setVal={setKn} step={10} user={DEMO_USER} /></DisplayOnly></Stage>
              <Stage><DisplayOnly><Knob deviceId="" name="demo-k2" label="Free" val={kn2} setVal={setKn2} min={0} max={3} decimals={2} unit="L/min" user={DEMO_USER} /></DisplayOnly></Stage>
              <Stage><DisplayOnly><Knob deviceId="" name="demo-k3" label="Disabled" val={60} setVal={() => undefined} step={10} user={DEMO_USER} disabled /></DisplayOnly></Stage>
            </div>
          </Sub>
        </Section>

        <Section id="feedback" kicker="Components" title="Feedback, toasts & badges"
          lede="Toasts slide in bottom-right (z-index 120 in the app); non-info tones auto-dismiss after 3200ms with a timer bar. API: useToasts() → { toasts, push, replace, dismiss } + <ToastStack />.">
          <Stage className="ds-toast-demo landing">
            <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
            {toasts.length < TOAST_DEMO.length ? (
              <button type="button" className="landing-btn landing-btn--ghost" onClick={() => setToasts(TOAST_DEMO)}>Replay toasts</button>
            ) : null}
          </Stage>
          <Sub title="Loader" note="App boot loader: pulsing accent dot (pulse 1.2s, --bv-ease).">
            <Stage><div className="app-loader"><span className="app-loader__dot" />Loading…</div></Stage>
          </Sub>
          <Sub title="Badges & status labels">
            <Stage className="ds-row ds-auth-demo">
              <span className="auth-last-used ds-static-badge">Last used</span>
              <strong className="auth-password-strength__label auth-password-strength__label--weak">Weak</strong>
              <strong className="auth-password-strength__label auth-password-strength__label--fair">Fair</strong>
              <strong className="auth-password-strength__label auth-password-strength__label--strong">Strong</strong>
            </Stage>
          </Sub>
        </Section>

        <Section id="cards" kicker="Components" title="Cards & surfaces"
          lede="Cards use --bv-card on --bv-surface with --bv-radius-lg and --bv-shadow-card; hover swaps to --bv-shadow-float and lifts 2px.">
          <div className="ds-grid ds-grid--3">
            <Stage><InfoCard title="Sensor" subtitle="Temperature" content="Live readings every second." imagePath="/assets/logo/d-mark-light-512.png" imageContain /></Stage>
            <Stage className="ds-embed"><EmptyDeviceState /></Stage>
            <Stage className="ds-embed"><ConstructionPage /></Stage>
          </div>
          <Sub title="Auth card" note=".auth-card — the Login card header (wordmark, title, subtitle).">
            <Stage className="ds-auth-demo">
              <div className="auth-card ds-auth-card">
                <header className="auth-card__header">
                  <div className="auth-card__header-start">
                    <div className="auth-card__headline">
                      <p className="auth-card__eyebrow auth-card__eyebrow--logo"><Wordmark height={20} /></p>
                      <h3 className="auth-card__title">Welcome back</h3>
                      <p className="auth-card__subtitle">Sign in to monitor and control your Bioversee devices.</p>
                    </div>
                  </div>
                </header>
              </div>
            </Stage>
          </Sub>
        </Section>

        <Section id="chrome" kicker="Components" title="Header & footer"
          lede="MarketingHeader is used on / (signed out) and /about. The signed-in Navbar (topbar__*) needs a live session and devices, so it is documented via its class list in the inventory.">
          <Stage className="ds-embed ds-embed--flush"><MarketingHeader user={null} /></Stage>
          <Stage className="ds-embed ds-embed--flush"><Footer showSignIn /></Stage>
        </Section>

        <Section id="overlays" kicker="Components" title="Modals & overlays"
          lede={<>Dialog pattern: fixed full-screen scrim (<Code>rgba(17, 24, 22, 0.45)</Code> + 4px backdrop blur, z-index 80) with a white 18px-radius card, max 420px. App-wide scrim token: <Code>--bv-overlay</Code>.</>}>
          <Stage className="landing ds-row">
            <button type="button" className="landing-btn landing-btn--primary" onClick={() => setModalOpen(true)}>Open dialog</button>
            <span className="ds-cap">.landing-pi-gate (About page)</span>
          </Stage>
          {modalOpen ? (
            <div className="landing ds-modal-host">
              <div className="landing-pi-gate" role="dialog" aria-modal="true" aria-labelledby="ds-modal-title" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
                <div className="landing-pi-gate__card">
                  <h3 id="ds-modal-title" className="landing-pi-gate__title">Raspberry Pi download</h3>
                  <p className="landing-pi-gate__sorry">Sorry, but this part of Bioversee is still under construction.</p>
                  <div className="landing-pi-gate__actions">
                    <button type="button" className="landing-btn landing-btn--ghost" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button type="button" className="landing-btn landing-btn--primary" onClick={() => setModalOpen(false)}>Continue</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Section>

        <Section id="previews" kicker="Components" title="Product previews" lede="Skeleton mocks used on the landing page instead of screenshots.">
          <Stage className="landing ds-preview"><WebAppPreview /></Stage>
          <div className="ds-grid ds-grid--2">
            <Stage className="landing ds-preview"><AppPhonePreview /></Stage>
            <Stage className="landing ds-preview"><RaspberryPiPreview /></Stage>
          </div>
        </Section>

        <Section id="inventory" kicker="Components" title="Component inventory"
          lede={`${INVENTORY.length} entries covering every folder in src/components (${componentSources.length} source files). Props are extracted from source; class lists from each stylesheet. Click to expand.`}>
          <div className="ds-inventory">
            {INVENTORY.map((c) => <InventoryCard key={c.name} entry={c} />)}
          </div>
        </Section>

        <Section id="patterns" kicker="Patterns" title="Page patterns" lede="Landing page (src/pages/About) composition, top to bottom.">
          <div className="landing ds-patterns">
            <Pattern name="Hero" cls=".landing-hero" desc="Eyebrow → wordmark → headline → body over the radial accent veil; enters with landing-hero-in 0.7s.">
              <section className="landing-hero">
                <div className="landing-hero__veil" aria-hidden="true" />
                <div className="landing-hero__content">
                  <p className="landing-hero__eyebrow">Industrial Process Control</p>
                  <p className="landing-hero__brand"><Wordmark height={56} className="landing-hero__wordmark" /></p>
                  <p className="landing-hero__headline">Automation that feels like child's play</p>
                </div>
              </section>
            </Pattern>
            <Pattern name="Media + copy split" cls=".landing-section__inner--web / --app / --pi" desc="Two-column grid (preview + kicker / title / lede / CTA), alternating sides; stacks and centres below 860px. Sections alternate white and --muted and reveal on scroll ([data-reveal], 0.55s).">
              <section className="landing-section landing-section--muted">
                <div className="landing-section__inner landing-section__inner--pi">
                  <div className="ds-pattern-media" />
                  <div className="landing-app-copy">
                    <p className="landing-kicker">Raspberry Pi</p>
                    <p className="landing-title">Edge control on the Pi</p>
                    <p className="landing-lede">Download the Bioversee app for Raspberry Pi and control it from the website.</p>
                    <button type="button" className="landing-btn landing-btn--primary">Download</button>
                  </div>
                </div>
              </section>
            </Pattern>
            <Pattern name="Numbered evidence list" cls=".landing-evidence" desc="Ordered list with CSS counters in accent and hairline separators, followed by a references block.">
              <div className="ds-pattern-pad">
                <ol className="landing-evidence" style={{ margin: 0 }}>
                  <li className="landing-evidence__item"><p className="landing-evidence__title">Teaching and learning</p><p className="landing-evidence__text">People understand complex systems more deeply from words with pictures.</p></li>
                  <li className="landing-evidence__item"><p className="landing-evidence__title">Safety</p><p className="landing-evidence__text">Seeing process state helps operators keep plants safe.</p></li>
                </ol>
              </div>
            </Pattern>
            <Pattern name="Team member" cls=".landing-team-member" desc="96px circular photo + role eyebrow, name in Outfit, short bio.">
              <div className="ds-pattern-pad">
                <article className="landing-team-member">
                  <img className="landing-team-member__photo" src={Mate} alt="" />
                  <div className="landing-team-member__copy">
                    <p className="landing-team-member__role">Founder</p>
                    <p className="landing-team-member__name">Mate Melcher</p>
                    <p className="landing-team-member__text">Builds Bioversee.</p>
                  </div>
                </article>
              </div>
            </Pattern>
            <Pattern name="Support CTA band" cls=".landing-cta" desc="Full-bleed teal radial gradient with a centred white title, lede and on-accent button.">
              <section className="landing-cta">
                <div className="landing-cta__inner">
                  <p className="landing-title landing-title--on-accent">Support Bioversee</p>
                  <p className="landing-lede landing-lede--on-accent">Help keep the project growing.</p>
                  <button type="button" className="landing-btn landing-btn--on-accent">Donate</button>
                </div>
              </section>
            </Pattern>
          </div>
          <Sub title={`Pages in the app (${pageSources.length})`}>
            <div className="ds-chips">{pageSources.map((p) => <span key={p.path} className="ds-chip"><Code>{p.path.replace(/^src\/pages\//, "").replace(/\/index\.tsx$/, "")}</Code></span>)}</div>
          </Sub>
        </Section>

        <Section id="voice" kicker="Content" title="Tone of voice" lede="Inferred from src/i18n/locales/en.json (also shipped in German and Hungarian).">
          <div className="ds-grid ds-grid--2">
            <div className="ds-voice">
              <h3 className="ds-sub__title">Principles</h3>
              <ul>
                <li><strong>Approachable expertise.</strong> “Automation that feels like child's play.” Industrial topics, plain words.</li>
                <li><strong>Inclusive.</strong> Speaks to DIY makers, students and professionals alike.</li>
                <li><strong>Short and concrete.</strong> Titles are 3–6 words (“Edge control on the Pi”); ledes are one or two sentences.</li>
                <li><strong>Evidence-backed.</strong> The story section cites research instead of hype.</li>
                <li><strong>Honest.</strong> “Sorry, but this part of Bioversee is still under construction.”</li>
              </ul>
            </div>
            <div className="ds-voice">
              <h3 className="ds-sub__title">Mechanics</h3>
              <ul>
                <li>Sentence case for titles and buttons (“Add device”, “Continue with Google”).</li>
                <li>Kickers / eyebrows are one or two words, uppercased by CSS (“Web”, “Mobile”, “Why”).</li>
                <li>Typographic punctuation: curly apostrophes, em dashes, ellipsis (“Loading…”).</li>
                <li>Buttons are verbs: Download, Continue, Cancel, Sign in.</li>
                <li>Errors are brief and direct: “Incorrect password.”</li>
                <li>The brand is always “Bioversee” (i18n key common.brand).</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="tpl-email" kicker="Templates" title="Company email"
          lede="Branded HTML email built from inline-styled tables (Gmail / Outlook safe, no external CSS, Outfit with web-safe fallbacks). Edit the form; Copy HTML for your sending tool, or Copy rendered to paste straight into a Gmail compose window.">
          <EmailTemplateSection />
        </Section>

        <Section id="tpl-signature" kicker="Templates" title="Email signature"
          lede="Paste into Gmail → Settings → Signature with Copy rendered. Logo must be a public PNG URL.">
          <EmailTemplateSection initial="signature" />
        </Section>

        <Section id="tpl-linkedin" kicker="Templates" title="LinkedIn graphics"
          lede="Canvas-rendered post graphics in LinkedIn sizes with the brand veil, Outfit display type and accent. Download PNG exports at full resolution.">
          <LinkedInGraphicSection />
        </Section>

        <Section id="tpl-linkedin-copy" kicker="Templates" title="LinkedIn post copy"
          lede="Hook → body → call to action → hashtags. LinkedIn allows 3,000 characters and folds after roughly 210 — the preview shows where “see more” will cut.">
          <LinkedInCopySection />
        </Section>

        <Section id="gaps" kicker="Notes" title="Not documented / gaps">
          <ul className="ds-gaps">
            <li>No spacing, font-size, z-index or breakpoint tokens exist — those sections show observed values, not a defined scale.</li>
            
            <li>Signed-in chrome and data-bound widgets (Navbar, AccountMenu, AddDevicePanel, AppSettingsPanel, NotificationsPanel, SharePanel, DeviceSettingsPanel, DeviceContextMenu, OnboardingModal, DevDataPanel, AnimationLab, Chart, ControlClock, EquipmentChecklist, FluidPropertiesFields, Canvas / Canvas2 and the process drawings) need a session or device data, so they are listed with props and classes instead of rendered live.</li>
            <li>No tabs, accordion or badge components exist; SegmentedControl (role=tablist), the auth reveal (.auth-reveal) and .auth-last-used are the closest equivalents.</li>
            <li>Footer is implemented but not mounted on any route.</li>
            <li>Some colours are hard-coded rather than tokenised (dialog scrim, toast tints, #b42318 error text in About.css).</li>
          </ul>
          <p className="ds-note">Generated from {cssFiles.length} stylesheets, {componentSources.length} component sources and {declarations.length} CSS declarations.</p>
        </Section>
      </main>
    </div>
  );
}

function TokenSwatch({ name, light, dark, uses, themeKey }: { name: string; light: string; dark?: string; uses: number; themeKey: string }) {
  const resolved = useResolvedVar(name, themeKey);
  return (
    <div className="ds-swatch">
      <span className="ds-swatch__chip" style={{ background: `var(${name})` }} />
      <div className="ds-swatch__body">
        <Code>{name}</Code>
        <span className="ds-swatch__val">light: {light}</span>
        {dark ? <span className="ds-swatch__val">dark: {dark}</span> : null}
        <span className="ds-swatch__val ds-cap">resolved: {rgbOf(resolved) || resolved} · used ×{uses}</span>
        <span className="ds-swatch__note">{TOKEN_NOTES[name] ?? ""}</span>
      </div>
    </div>
  );
}

function ThemeCard({ theme }: { theme: "light" | "dark" }) {
  const block = theme === "light" ? tokenBlock(":root") : { ...tokenBlock(":root"), ...tokenBlock(':root[data-theme="dark"]') };
  const bg = block["--bv-surface"];
  const card = block["--bv-card"];
  const text = block["--bv-text"];
  const sec = block["--bv-text-secondary"];
  return (
    <div className="ds-themecard" style={{ background: bg, color: text }}>
      <div className="ds-themecard__card" style={{ background: card }}>
        <strong>{theme === "light" ? "Light" : "Night"}</strong>
        <span style={{ color: sec }}>surface {bg} · card {card}</span>
        <span style={{ color: sec }}>text {text} · secondary {sec}</span>
      </div>
    </div>
  );
}

type IconComponent = ComponentType<{ color?: string; width?: string; height?: string }>;

function IoniconGrid({ names }: { names: string[] }) {
  const [icons, setIcons] = useState<Record<string, IconComponent>>({});
  const key = names.join(",");
  useEffect(() => {
    let alive = true;
    void import("react-ionicons").then((mod) => {
      if (!alive) return;
      const lib = mod as unknown as Record<string, IconComponent>;
      const out: Record<string, IconComponent> = {};
      for (const n of key.split(",")) if (lib[n]) out[n] = lib[n];
      setIcons(out);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return (
    <div className="ds-icons">
      {names.map((n) => {
        const Icon = icons[n];
        return (
          <div key={n} className="ds-icon">
            <span className="ds-icon__glyph">{Icon ? <Icon color="currentColor" width="24px" height="24px" /> : null}</span>
            <Code>{n}</Code>
          </div>
        );
      })}
    </div>
  );
}

function MotionDemo() {
  const [on, setOn] = useState(false);
  const lanes: [string, number][] = [
    ["0.2s · hover / colour", 200],
    ["0.28s · toast in", 280],
    ["0.42s · number roll", 420],
    ["0.55s · scroll reveal", 550],
    ["0.7s · hero in", 700],
  ];
  return (
    <div className="ds-motion landing">
      <button type="button" className="landing-btn landing-btn--primary" onClick={() => setOn((v) => !v)}>{on ? "Reverse" : "Play"}</button>
      {lanes.map(([label, ms]) => (
        <div key={label} className={`ds-motion__lane${on ? " is-on" : ""}`}>
          <span className="ds-motion__track"><span className="ds-motion__dot" style={{ transitionDuration: `${ms}ms` }} /></span>
          <span className="ds-cap">{label} · var(--bv-ease)</span>
        </div>
      ))}
    </div>
  );
}

function InventoryCard({ entry }: { entry: InventoryEntry }) {
  const sources = componentSources.filter((s) =>
    entry.dir ? s.path.startsWith(`src/components/${entry.dir}/`) : s.path.endsWith(`/${entry.name}.tsx`),
  );
  const props = sources.flatMap((s) => propsBlocks(s.source));
  const css = cssFiles.filter((f) => entry.dir && f.path.startsWith(`src/components/${entry.dir}/`));
  const classes = [...new Set(css.flatMap((f) => classNames(f.path)))];
  return (
    <details className="ds-inv">
      <summary>
        <span className="ds-inv__name">{entry.name}</span>
        <span className={`ds-inv__tag${entry.live ? " is-live" : ""}`}>{entry.live ? "live demo" : "documented"}</span>
        <span className="ds-inv__role">{entry.role}</span>
      </summary>
      <div className="ds-inv__body">
        <p className="ds-cap">{sources.map((s) => s.path).join(" · ")}</p>
        {props.length ? props.map((p, i) => <pre key={i} className="ds-pre">{p}</pre>) : <p className="ds-note">No props.</p>}
        {classes.length ? (
          <div className="ds-chips">
            {classes.map((c) => <span key={c} className="ds-chip"><Code>.{c}</Code></span>)}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function Pattern({ name, cls, desc, children }: { name: string; cls: string; desc: string; children: ReactNode }) {
  return (
    <figure className="ds-pattern">
      <div className="ds-pattern__frame">{children}</div>
      <figcaption>
        <strong>{name}</strong> <Code>{cls}</Code>
        <span className="ds-note">{desc}</span>
      </figcaption>
    </figure>
  );
}

export default DesignSystem;
