import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./ControlClock.css";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function ControlClock() {
  const { i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const weekday = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
  })
    .format(now)
    .toUpperCase();

  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());

  return (
    <div className="bv-control-clock" aria-live="polite">
      <span className="bv-control-clock__day">{weekday}</span>
      <span className="bv-control-clock__time">
        <span className="bv-control-clock__hours">{hours}</span>
        <span className="bv-control-clock__colon" aria-hidden="true">
          :
        </span>
        <span className="bv-control-clock__minutes">{minutes}</span>
      </span>
    </div>
  );
}

ControlClock.displayName = "ControlClock";
export default ControlClock;
