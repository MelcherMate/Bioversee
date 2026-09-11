import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  APP_HOME_PATH,
  openSharedDeviceUrl,
  redeemShareLink,
  roleLabel,
  type RedeemResult,
} from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import "./Invite.css";

type InviteProps = {
  user: AppUser | null;
};

function Invite({ user }: InviteProps) {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);

  useEffect(() => {
    if (!user || !token) return;

    let cancelled = false;
    setStatus("working");
    setError(null);

    redeemShareLink(token)
      .then((redeemed) => {
        if (cancelled) return;
        setResult(redeemed);
        setStatus("done");
        if (redeemed.status === "already_member") {
          window.setTimeout(
            () =>
              navigate(
                openSharedDeviceUrl({
                  id: redeemed.device_id,
                  type: redeemed.type,
                }),
                { replace: true }
              ),
            700
          );
        } else {
          window.setTimeout(
            () => navigate(APP_HOME_PATH, { replace: true }),
            1200
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setError(
          err instanceof Error ? err.message : t("invite.failedBody")
        );
      });

    return () => {
      cancelled = true;
    };
  }, [user, token, navigate, t]);

  if (!user) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <p className="invite-card__eyebrow">{t("invite.title")}</p>
          <h1 className="invite-card__title">{t("invite.signInToContinue")}</h1>
          <p className="invite-card__body">
            {t("auth.subtitle")}
          </p>
          <Link className="invite-card__cta" to={`/login?next=/invite/${token ?? ""}`}>
            {t("invite.signIn")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-page">
      <div className="invite-card">
        <p className="invite-card__eyebrow">{t("invite.title")}</p>
        {status === "working" && (
          <>
            <h1 className="invite-card__title">{t("invite.opening")}</h1>
            <p className="invite-card__body">{t("invite.pendingBody")}</p>
          </>
        )}
        {status === "done" && result?.status === "pending" && (
          <>
            <h1 className="invite-card__title">{t("invite.received")}</h1>
            <p className="invite-card__body">
              {t("invite.acceptedBody", { role: roleLabel(result.role) })}
            </p>
          </>
        )}
        {status === "done" && result?.status === "already_member" && (
          <>
            <h1 className="invite-card__title">{t("invite.alreadyShared")}</h1>
            <p className="invite-card__body">{t("invite.alreadyMemberBody")}</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="invite-card__title">{t("invite.unavailable")}</h1>
            <p className="invite-card__body">{error ?? t("invite.failedBody")}</p>
            <Link className="invite-card__cta" to={APP_HOME_PATH}>
              {t("invite.backToApp")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default Invite;
