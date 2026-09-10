import { isEmpty } from "lodash";
import React, { useEffect, useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSensorReadings } from "../../lib/actuators";
import "./Chart.css";

interface ChartProps {
  name: string;
  label: string;
}

type ChartPoint = {
  time: string;
  value: number;
  fullTime: string;
};

const Chart: React.FC<ChartProps> = (props) => {
  const gradientId = useId().replace(/:/g, "");
  const [data, setData] = useState<
    { name: string; value: number; created_at: string }[]
  >([]);

  const fetchData = () => {
    getSensorReadings(props.name)
      .then((rows) => setData(rows as any))
      .catch((error) => console.error("Fetch error:", error));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [props.name]);

  const formattedData = useMemo<ChartPoint[]>(() => {
    if (isEmpty(data)) return [];

    const lastSixData = data.slice(-6);
    const times = lastSixData.map((item) =>
      formatClock(item.created_at, false),
    );
    const needsSeconds = new Set(times).size < times.length;

    return lastSixData.map((item) => ({
      time: formatClock(item.created_at, needsSeconds),
      fullTime: formatClock(item.created_at, true),
      value: round2(Number(item.value)),
    }));
  }, [data]);

  const { minValue, maxValue, latest } = useMemo(() => {
    if (formattedData.length === 0) {
      return { minValue: 0, maxValue: 1, latest: null as number | null };
    }

    const values = formattedData.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    const pad = span === 0 ? Math.max(Math.abs(max) * 0.05, 0.5) : span * 0.18;

    return {
      minValue: round2(min - pad),
      maxValue: round2(max + pad),
      latest: values[values.length - 1] ?? null,
    };
  }, [formattedData]);

  return (
    <div className="bv-chart">
      <div className="bv-chart__meta">
        <h3 className="bv-chart__label">{props.label}</h3>
        {latest !== null && (
          <span className="bv-chart__value">{latest.toFixed(2)}</span>
        )}
      </div>

      <div className="bv-chart__plot">
        {formattedData.length === 0 ? (
          <div className="bv-chart__empty">Waiting for readings…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--bv-accent)"
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--bv-accent)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--bv-line)"
                strokeDasharray="0"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                minTickGap={28}
                tick={{
                  fill: "var(--bv-text-tertiary)",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
              <YAxis
                domain={[minValue, maxValue]}
                width={44}
                axisLine={false}
                tickLine={false}
                tickMargin={6}
                tickCount={5}
                tickFormatter={(value: number) => round2(value).toFixed(2)}
                tick={{
                  fill: "var(--bv-text-tertiary)",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
              <Tooltip
                cursor={{
                  stroke: "var(--bv-accent-bright)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
                content={<ChartTooltip labelName={props.label} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--bv-accent)"
                strokeWidth={2.25}
                fill={`url(#${gradientId})`}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: "#fff",
                  fill: "var(--bv-accent-hover)",
                }}
                dot={{
                  r: 3,
                  strokeWidth: 1.5,
                  stroke: "var(--bv-accent)",
                  fill: "#fff",
                }}
                isAnimationActive
                animationDuration={450}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

function ChartTooltip({
  active,
  payload,
  labelName,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: ChartPoint }>;
  labelName: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0];
  const value = Number(point.value);
  const time = point.payload?.fullTime ?? "";

  return (
    <div className="bv-chart__tooltip">
      <div className="bv-chart__tooltip-label">{labelName}</div>
      <div className="bv-chart__tooltip-value">{value.toFixed(2)}</div>
      {time && <div className="bv-chart__tooltip-time">{time}</div>}
    </div>
  );
}

function formatClock(timestamp: string, withSeconds: boolean) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (!withSeconds) return `${hours}:${minutes}`;
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default Chart;
