import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DEVICE_TYPE_META, DEVICE_TYPE_ORDER } from "../../lib/deviceIcons";
import {
  createMyDevice,
  isLegacyDeviceType,
  isNewDeviceType,
  type DeviceType,
} from "../../lib/devices";
import {
  isOnboardingDoneLocal,
  markOnboardingCompleted,
  notifyDevicesChanged,
  seedOnboardingSampleData,
  userOwnsAnyDevice,
} from "../../lib/onboarding";
import { pathForDeviceType } from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import { fetchUserPreferences } from "../../lib/userSettings";
import "./OnboardingModal.css";

type Step = "welcome" | "pickType" | "sampleData" | "working";

type OnboardingModalProps = {
  user: AppUser;
};

function OnboardingModal({ user }: OnboardingModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>("welcome");
  const [type, setType] = useState<DeviceType>("bioreactor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isOnboardingDoneLocal(user.id)) {
        if (!cancelled) {
          setVisible(false);
          setChecking(false);
        }
        return;
      }

      try {
        const [prefs, ownsDevice] = await Promise.all([
          fetchUserPreferences(user.id),
          userOwnsAnyDevice(),
        ]);

        if (cancelled) return;

        if (prefs?.onboardingCompleted || ownsDevice) {
          await markOnboardingCompleted(user.id);
          setVisible(false);
        } else {
          setVisible(true);
          setStep("welcome");
        }
      } catch (err) {
        console.warn("[onboarding] check failed", err);
        if (!cancelled) setVisible(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const finish = async () => {
    await markOnboardingCompleted(user.id);
    setVisible(false);
  };

  const onSkip = () => {
    void finish();
  };

  const onCreate = async (withSampleData: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStep("working");
    try {
      const deviceId = await createMyDevice({
        type,
        name: t(DEVICE_TYPE_META[type].labelKey),
      });

      if (withSampleData) {
        await seedOnboardingSampleData(deviceId, type, user.id);
      }

      await markOnboardingCompleted(user.id);
      notifyDevicesChanged();
      setVisible(false);
      navigate(`${pathForDeviceType(type)}?device=${deviceId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("onboarding.couldNotFinish")
      );
      setStep("sampleData");
    } finally {
      setBusy(false);
    }
  };

  if (checking || !visible) return null;

  return (
    <div className="onboarding" role="presentation">
      <div className="onboarding__backdrop" aria-hidden="true" />
      <div
        className="onboarding__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        {step === "welcome" && (
          <>
            <p className="onboarding__eyebrow">{t("onboarding.eyebrow")}</p>
            <h2 id="onboarding-title" className="onboarding__title">
              {t("onboarding.welcomeTitle")}
            </h2>
            <p className="onboarding__body">{t("onboarding.welcomeBody")}</p>
            <div className="onboarding__actions">
              <button
                type="button"
                className="onboarding__btn onboarding__btn--primary"
                onClick={() => setStep("pickType")}
              >
                {t("onboarding.yesHelp")}
              </button>
              <button
                type="button"
                className="onboarding__btn onboarding__btn--ghost"
                onClick={onSkip}
              >
                {t("onboarding.noThanks")}
              </button>
            </div>
          </>
        )}

        {step === "pickType" && (
          <>
            <p className="onboarding__eyebrow">{t("onboarding.eyebrow")}</p>
            <h2 id="onboarding-title" className="onboarding__title">
              {t("onboarding.pickTitle")}
            </h2>
            <p className="onboarding__body">{t("onboarding.pickBody")}</p>
            <div
              className="onboarding__types"
              role="listbox"
              aria-label={t("addDevice.type")}
            >
              {DEVICE_TYPE_ORDER.map((deviceType) => {
                const meta = DEVICE_TYPE_META[deviceType];
                const active = type === deviceType;
                return (
                  <button
                    key={deviceType}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`onboarding__type ${active ? "is-active" : ""}`}
                    onClick={() => setType(deviceType)}
                  >
                    <span className="onboarding__type-text">
                      <span className="onboarding__type-label">
                        {t(meta.labelKey)}
                      </span>
                      <span className="onboarding__type-desc">
                        {t(meta.descriptionKey)}
                      </span>
                    </span>
                    {isNewDeviceType(deviceType) ? (
                      <span className="onboarding__badge onboarding__badge--new">
                        {t("common.new")}
                      </span>
                    ) : null}
                    {isLegacyDeviceType(deviceType) ? (
                      <span className="onboarding__badge onboarding__badge--legacy">
                        {t("common.legacy")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="onboarding__actions">
              <button
                type="button"
                className="onboarding__btn onboarding__btn--primary"
                onClick={() => setStep("sampleData")}
              >
                {t("onboarding.continue")}
              </button>
              <button
                type="button"
                className="onboarding__btn onboarding__btn--ghost"
                onClick={() => setStep("welcome")}
              >
                {t("common.cancel")}
              </button>
            </div>
          </>
        )}

        {step === "sampleData" && (
          <>
            <p className="onboarding__eyebrow">{t("onboarding.eyebrow")}</p>
            <h2 id="onboarding-title" className="onboarding__title">
              {t("onboarding.sampleTitle")}
            </h2>
            <p className="onboarding__body">{t("onboarding.sampleBody")}</p>
            {error ? <p className="onboarding__error">{error}</p> : null}
            <div className="onboarding__actions">
              <button
                type="button"
                className="onboarding__btn onboarding__btn--primary"
                disabled={busy}
                onClick={() => void onCreate(true)}
              >
                {t("onboarding.sampleYes")}
              </button>
              <button
                type="button"
                className="onboarding__btn onboarding__btn--ghost"
                disabled={busy}
                onClick={() => void onCreate(false)}
              >
                {t("onboarding.sampleNo")}
              </button>
            </div>
          </>
        )}

        {step === "working" && (
          <>
            <p className="onboarding__eyebrow">{t("onboarding.eyebrow")}</p>
            <h2 id="onboarding-title" className="onboarding__title">
              {t("onboarding.workingTitle")}
            </h2>
            <p className="onboarding__body">{t("onboarding.workingBody")}</p>
            <div className="onboarding__spinner" aria-hidden="true" />
          </>
        )}
      </div>
    </div>
  );
}

export default OnboardingModal;
