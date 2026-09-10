import { isEmpty } from "lodash";
import React, { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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

const Chart: React.FC<ChartProps> = (props) => {
  const [data, setData] = useState<
    { name: string; value: number; created_at: string }[]
  >([]);
  const [formattedData, setFormattedData] = useState<any[]>([]);
  const [minValue, setMinValue] = useState<number>(0);
  const [maxValue, setMaxValue] = useState<number>(35);
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

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

  useEffect(() => {
    if (!isEmpty(data)) {
      const lastSixData = data.slice(-6);
      const chartData = lastSixData.map((item) => ({
        time: reduceTimestampLength(item.created_at),
        [props.name]: round2(Number(item.value)),
      }));

      const values = data.map((item) => round2(Number(item.value)));
      const min = Math.min(...values);
      const max = Math.max(...values);
      const margin = (max - min) * 0.2 || 1;

      setMinValue(Math.floor(min - margin));
      setMaxValue(Math.ceil(max + margin));
      setFormattedData(chartData);
    }
  }, [data, props.name]);

  const reduceTimestampLength = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours}:${minutes < 10 ? "0" + minutes : minutes}`;
  };

  useEffect(() => {
    const updateWidth = () => {
      if (chartRef.current) {
        setWidth(chartRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  const tickFormatter = (value: number) => round2(value).toFixed(2);

  return (
    <div ref={chartRef} style={{ width: "100%" }}>
      <h3 id="title">{props.label}</h3>
      {width > 0 && (
        <LineChart
          width={width}
          height={200}
          data={formattedData}
          margin={{
            top: 0,
            right: 10,
            left: -15,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[minValue, maxValue]} tickFormatter={tickFormatter} />
          <Tooltip
            formatter={(value: number | string) => [
              Number(value).toFixed(2),
              props.label,
            ]}
          />
          <Line
            type="monotone"
            dataKey={props.name}
            stroke="#8884d8"
            activeDot={{ r: 8 }}
            isAnimationActive={true}
          />
        </LineChart>
      )}
    </div>
  );
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default Chart;
