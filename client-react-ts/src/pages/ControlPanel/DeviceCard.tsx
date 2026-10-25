import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  type DeviceCardSnapshot,
  type DeviceType,
} from "../../lib/devices";
import { DEVICE_TYPE_META } from "../../lib/deviceIcons";
import { pathForDeviceType } from "../../lib/sharing";
import DeviceTypeGlyph from "./DeviceTypeGlyph";

const ONLINE_MS = 2 * 60 * 1000;

function formatMetricName(name: string): string {
  const n = name.toLowerCase();
  if (n === "ph" || n === "p_h") return "pH";
  if (n.includes("temp")) return "Temp";
  if (n.includes("level") || n.includes("water")) return "Level";
  if (n.includes("pressure")) return "Pressure";
  if (n.includes("do") || n.includes("oxygen")) return "DO";
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetricValue(name: string, value: number): string {
  const n = name.toLowerCase();
  if (n === "ph" || n === "p_h") return value.toFixed(2);
  if (n.includes("temp")) return `${value.toFixed(1)}°`;
  if (n.includes("level") || n.includes("percent")) return `${Math.round(value)}%`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function isOnline(snapshot: DeviceCardSnapshot): boolean {
  const times = [
    snapshot.updated_at,
    ...snapshot.metrics.map((m) => m.created_at),
  ]
    .map((t) => Date.parse(t))
    .filter((n) => !Number.isNaN(n));
  if (times.length === 0) return false;
  return Date.now() - Math.max(...times) < ONLINE_MS;
}

type DeviceCardProps = {
  snapshot: DeviceCardSnapshot;
};

export default function DeviceCard({ snapshot }: DeviceCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const type = snapshot.type as DeviceType;
  const meta = DEVICE_TYPE_META[type];
  const online = isOnline(snapshot);
  const metrics = snapshot.metrics.slice(0, 3);

  return (
    <button
      type="button"
      className="cp-card"
      onClick={() =>
        navigate(`${pathForDeviceType(type)}?device=${snapshot.id}`)
      }
    >
      <div className="cp-card__head">
        <span className="cp-card__glyph" aria-hidden>
          <DeviceTypeGlyph type={type} size={26} />
        </span>
        <div className="cp-card__titles">
          <span className="cp-card__name">{snapshot.name}</span>
          <span className="cp-card__type">
            {meta ? t(meta.labelKey) : type}
          </span>
        </div>
        <span
          className={`cp-card__pulse ${online ? "is-live" : "is-idle"}`}
          title={online ? t("controlPanel.live") : t("controlPanel.idle")}
        />
      </div>
      <div className="cp-card__metrics">
        {metrics.length === 0 ? (
          <span className="cp-card__empty-metric">
            {t("controlPanel.noMetrics")}
          </span>
        ) : (
          metrics.map((m) => (
            <div key={m.name} className="cp-card__metric">
              <span className="cp-card__metric-label">
                {formatMetricName(m.name)}
              </span>
              <span className="cp-card__metric-value">
                {formatMetricValue(m.name, m.value)}
              </span>
            </div>
          ))
        )}
      </div>
    </button>
  );
}
