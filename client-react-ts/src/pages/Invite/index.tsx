import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  openSharedDeviceUrl,
  redeemShareLink,
  type RedeemResult,
} from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import "./Invite.css";

type InviteProps = {
  user: AppUser | null;
};

function Invite({ user }: InviteProps) {
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
        const path = openSharedDeviceUrl({
          id: redeemed.device_id,
          type: redeemed.type,
        });
        window.setTimeout(() => navigate(path, { replace: true }), 900);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not accept invite");
      });

    return () => {
      cancelled = true;
    };
  }, [user, token, navigate]);

  if (!user) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <p className="invite-card__eyebrow">Invite</p>
          <h1 className="invite-card__title">Sign in to join this device</h1>
          <p className="invite-card__body">
            You need a Bioversee account before this invite link can add you.
          </p>
          <Link className="invite-card__cta" to={`/?next=/invite/${token ?? ""}`}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-page">
      <div className="invite-card">
        <p className="invite-card__eyebrow">Invite</p>
        {status === "working" && (
          <>
            <h1 className="invite-card__title">Joining device…</h1>
            <p className="invite-card__body">Accepting your invite link.</p>
          </>
        )}
        {status === "done" && result && (
          <>
            <h1 className="invite-card__title">You’re in</h1>
            <p className="invite-card__body">
              Joined <strong>{result.name}</strong> as {result.role}. Opening it
              now…
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="invite-card__title">Invite unavailable</h1>
            <p className="invite-card__body">{error}</p>
            <Link className="invite-card__cta" to="/bioreactor">
              Back to app
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default Invite;
