import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./AppPhonePreview.css";

type PhoneTab = "devices" | "inbox" | "account";

function AppPhonePreview() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<PhoneTab>("devices");

  return (
    <div className="phone-preview">
      <div className="phone-preview__frame" aria-label={t("about.phoneLabel")}>
        <div className="phone-preview__bezel">
          <div className="phone-preview__island" aria-hidden="true" />
          <div className="phone-preview__screen">
            <div className="phone-preview__status" aria-hidden="true">
              <span className="phone-preview__time">9:41</span>
              <span className="phone-preview__status-icons">
                <span className="phone-preview__sig" />
                <span className="phone-preview__wifi" />
                <span className="phone-preview__bat" />
              </span>
            </div>

            <div className="phone-preview__body" data-tab={tab}>
              {tab === "devices" && <DevicesSkeleton />}
              {tab === "inbox" && <InboxSkeleton />}
              {tab === "account" && <AccountSkeleton />}
            </div>

            <nav
              className="phone-preview__tabbar"
              aria-label={t("about.phoneTabsLabel")}
            >
              <div
                className="phone-preview__tab-thumb"
                data-index={tab === "devices" ? 0 : tab === "inbox" ? 1 : 2}
                aria-hidden="true"
              />
              <TabButton
                active={tab === "devices"}
                label={t("about.phoneDevices")}
                onClick={() => setTab("devices")}
                icon="devices"
              />
              <TabButton
                active={tab === "inbox"}
                label={t("about.phoneInbox")}
                onClick={() => setTab("inbox")}
                icon="inbox"
                badge
              />
              <TabButton
                active={tab === "account"}
                label={t("about.phoneAccount")}
                onClick={() => setTab("account")}
                icon="account"
              />
            </nav>
          </div>
        </div>
      </div>
      <p className="phone-preview__caption">{t("about.phoneCaption")}</p>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
  icon,
  badge = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: "devices" | "inbox" | "account";
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      className={`phone-preview__tab${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <span className="phone-preview__tab-icon" data-icon={icon} aria-hidden="true">
        {badge ? <span className="phone-preview__tab-badge" /> : null}
      </span>
      <span className="phone-preview__tab-label">{label}</span>
    </button>
  );
}

function DevicesSkeleton() {
  return (
    <div className="phone-sk phone-sk--devices">
      <div className="phone-sk__brand-bar" aria-hidden="true">
        <span className="phone-sk__dot" />
        <span className="phone-sk__bar phone-sk__bar--brand" />
      </div>
      <div className="phone-sk__list">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="phone-sk__device" aria-hidden="true">
            <span className="phone-sk__icon" />
            <span className="phone-sk__lines">
              <span className="phone-sk__bar phone-sk__bar--title" />
              <span className="phone-sk__bar phone-sk__bar--sub" />
            </span>
            <span className="phone-sk__chevron" />
          </div>
        ))}
      </div>
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="phone-sk phone-sk--inbox">
      <div className="phone-sk__page-head" aria-hidden="true">
        <span className="phone-sk__bar phone-sk__bar--page" />
        <span className="phone-sk__pill" />
      </div>
      <div className="phone-sk__list">
        {[0, 1].map((i) => (
          <div key={i} className="phone-sk__notif" aria-hidden="true">
            <span className="phone-sk__notif-dot" />
            <span className="phone-sk__bar phone-sk__bar--eyebrow" />
            <span className="phone-sk__bar phone-sk__bar--body" />
            <span className="phone-sk__bar phone-sk__bar--body-short" />
            <span className="phone-sk__bar phone-sk__bar--meta" />
            <span className="phone-sk__actions">
              <span className="phone-sk__btn phone-sk__btn--primary" />
              <span className="phone-sk__btn phone-sk__btn--danger" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="phone-sk phone-sk--account">
      <div className="phone-sk__page-head" aria-hidden="true">
        <span className="phone-sk__bar phone-sk__bar--page" />
      </div>
      <span className="phone-sk__bar phone-sk__bar--section" aria-hidden="true" />
      <div className="phone-sk__account" aria-hidden="true">
        <span className="phone-sk__avatar" />
        <span className="phone-sk__lines">
          <span className="phone-sk__name-row">
            <span className="phone-sk__bar phone-sk__bar--title" />
            <span className="phone-sk__pill phone-sk__pill--sm" />
          </span>
          <span className="phone-sk__bar phone-sk__bar--sub" />
        </span>
        <span className="phone-sk__logout" />
      </div>
      <span className="phone-sk__add" aria-hidden="true" />
      <div className="phone-sk__icons-card" aria-hidden="true">
        <span className="phone-sk__bar phone-sk__bar--section" />
        <span className="phone-sk__bar phone-sk__bar--body" />
        <span className="phone-sk__bar phone-sk__bar--body-short" />
        <span className="phone-sk__icon-row">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="phone-sk__app-icon" data-selected={i === 0} />
          ))}
        </span>
      </div>
      <span className="phone-sk__bar phone-sk__bar--footer" aria-hidden="true" />
      <span className="phone-sk__bar phone-sk__bar--footer-short" aria-hidden="true" />
    </div>
  );
}

export default AppPhonePreview;
