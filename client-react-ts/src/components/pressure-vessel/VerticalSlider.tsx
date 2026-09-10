import { useCallback, useRef } from "react";
import "./WaterLevelPanel.css";

const THUMB_INSET = 9;

type VerticalSliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
  className?: string;
};

export function VerticalSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  "aria-label": ariaLabel,
  className = "",
}: VerticalSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const clamp = useCallback(
    (next: number) => {
      const bounded = Math.min(max, Math.max(min, next));
      if (step <= 0) return bounded;
      return Math.round(bounded / step) * step;
    },
    [max, min, step],
  );

  const valueFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return value;

      const rect = track.getBoundingClientRect();
      const travelTop = rect.top + THUMB_INSET;
      const travelBottom = rect.bottom - THUMB_INSET;
      const travelHeight = travelBottom - travelTop;
      const ratio =
        travelHeight <= 0
          ? 0
          : Math.min(1, Math.max(0, 1 - (clientY - travelTop) / travelHeight));

      return clamp(min + ratio * (max - min));
    },
    [clamp, max, min, value],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    trackRef.current?.setPointerCapture(event.pointerId);
    onChange(valueFromClientY(event.clientY));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    onChange(valueFromClientY(event.clientY));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (trackRef.current?.hasPointerCapture(event.pointerId)) {
      trackRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-orientation="vertical"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowRight") {
          event.preventDefault();
          onChange(clamp(value + step));
        } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
          event.preventDefault();
          onChange(clamp(value - step));
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`bv-vslider${className ? ` ${className}` : ""}`}
    >
      <div className="bv-vslider__track" />
      <div
        className="bv-vslider__fill"
        style={{
          height: `calc((100% - ${THUMB_INSET * 2}px) * ${percent / 100})`,
        }}
      />
      <div
        className="bv-vslider__thumb"
        style={{
          top: `calc(${THUMB_INSET}px + (100% - ${THUMB_INSET * 2}px) * ${(100 - percent) / 100})`,
        }}
      />
    </div>
  );
}
