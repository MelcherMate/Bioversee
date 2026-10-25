import { useTranslation } from "react-i18next";
import Chart from "../Chart/index";
import type { BioreactorEquipment } from "../../lib/bioreactorGeometry";
import "./BioreactorControls.css";

type BioreactorChartsProps = {
  deviceId: string;
  equipment: BioreactorEquipment;
};

export function hasBioreactorCharts(eq: BioreactorEquipment): boolean {
  return eq.sensor_temperature || eq.sensor_ph || eq.sensor_pressure;
}

export default function BioreactorCharts({
  deviceId,
  equipment: eq,
}: BioreactorChartsProps) {
  const { t } = useTranslation();
  if (!hasBioreactorCharts(eq)) return null;

  return (
    <div className="chartBox">
      {eq.sensor_temperature ? (
        <Chart
          deviceId={deviceId}
          name="temperature"
          label={t("process.temperature")}
        />
      ) : null}
      {eq.sensor_ph ? (
        <Chart deviceId={deviceId} name="ph" label={t("process.ph")} />
      ) : null}
      {eq.sensor_pressure ? (
        <Chart
          deviceId={deviceId}
          name="pressure"
          label={t("process.pressure")}
          unit="psi"
        />
      ) : null}
    </div>
  );
}
