import { useTranslation } from "react-i18next";
import {
  PIPE_DIRECTION_OPTIONS,
  type PipeDirection,
} from "../../../lib/bioreactorGeometry";

export type PipeEnd = "inlet" | "outlet";

/** 20×20 glyphs: the pipe meets the vessel wall, drawn as a faint bar. */
const PIPE_PATHS: Record<PipeEnd, Record<PipeDirection, string>> = {
  inlet: {
    left: "M3 6H10V16",
    straight: "M10 2.5V16",
    right: "M17 6H10V16",
  },
  outlet: {
    left: "M10 4V14H3",
    straight: "M10 4V17.5",
    right: "M10 4V14H17",
  },
};

const WALL_PATHS: Record<PipeEnd, string> = {
  inlet: "M4 18H16",
  outlet: "M4 2H16",
};

const LABEL_KEYS: Record<PipeEnd, Record<PipeDirection, string>> = {
  inlet: {
    left: "controlPanel.pipeInletLeft",
    straight: "controlPanel.pipeInletStraight",
    right: "controlPanel.pipeInletRight",
  },
  outlet: {
    left: "controlPanel.pipeOutletLeft",
    straight: "controlPanel.pipeOutletStraight",
    right: "controlPanel.pipeOutletRight",
  },
};

type PipeDirectionPickerProps = {
  end: PipeEnd;
  value: PipeDirection;
  onChange: (next: PipeDirection) => void;
};

export default function PipeDirectionPicker({
  end,
  value,
  onChange,
}: PipeDirectionPickerProps) {
  const { t } = useTranslation();
  const title = t(
    end === "inlet" ? "controlPanel.pipingInlet" : "controlPanel.pipingOutlet",
  );

  return (
    <div className="bp-piping" role="radiogroup" aria-label={title}>
      <span className="bp-piping__label">{title}</span>
      {PIPE_DIRECTION_OPTIONS.map((direction) => {
        const active = direction === value;
        const label = t(LABEL_KEYS[end][direction]);
        return (
          <button
            key={direction}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            className={`bp-piping__option ${active ? "is-active" : ""}`}
            onClick={() => {
              if (!active) onChange(direction);
            }}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
              <path className="bp-piping__wall" d={WALL_PATHS[end]} />
              <path className="bp-piping__pipe" d={PIPE_PATHS[end][direction]} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
