import { useEffect, useId, useMemo, useState } from "react";
import { VESSEL_MAX_FILL_UNITS } from "../pressure-vessel/constants";
import { PIPE_FILL, PIPE_METAL, PIPE_OD } from "../pressure-vessel/pipe-style";
import { useSpringFillUnits } from "../pressure-vessel/useSpringFillUnits";
import { VesselWaterBody } from "../pressure-vessel/VesselWaterBody";
import "./Bioreactor.css";

export type JacketMode = "idle" | "warm" | "cold";

type BioreactorCardProps = {
  rotorVal?: number;
  aeratorVal?: number;
  waterLevelVal?: number;
  jacketMode?: JacketMode;
  translateX: number;
  translateY: number;
  scale: number;
  onMouseDown: (event: React.MouseEvent) => void;
};

const CARD_WIDTH = 800;
const CARD_HEIGHT = 750;

/** Chamber outer box in wrapper coordinates (matches .reaction_chamber). */
const CHAMBER = {
  left: 20,
  top: -120,
  width: 402,
  height: 550,
  radius: 169,
} as const;

const CHAMBER_CX = CHAMBER.left + CHAMBER.width / 2;
const CHAMBER_BOTTOM = CHAMBER.top + CHAMBER.height;
const COIL_STANDOFF = 18;
const COIL_TURNS = 5.5;
const COIL_SAMPLES_PER_TURN = 36;

const JACKET_WARM = "#f59e0b";
const JACKET_COLD = "#38bdf8";

function radiusAtY(y: number): number {
  const baseRx = CHAMBER.width / 2 + COIL_STANDOFF;
  const domeStart = CHAMBER_BOTTOM - CHAMBER.radius;
  if (y <= domeStart) return baseRx;
  const dy = y - domeStart;
  if (dy >= CHAMBER.radius) return COIL_STANDOFF * 0.55;
  return Math.sqrt(Math.max(0, CHAMBER.radius ** 2 - dy ** 2)) + COIL_STANDOFF;
}

type SpiralPoint = { x: number; y: number; front: boolean };

function buildSpiralPoints(): SpiralPoint[] {
  const coilTop = CHAMBER.top + CHAMBER.height * 0.4;
  const coilBottom = CHAMBER_BOTTOM - 6;
  const samples = Math.round(COIL_TURNS * COIL_SAMPLES_PER_TURN);
  const points: SpiralPoint[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    // Start on the left (π) so supply connects cleanly; descend while winding.
    const angle = Math.PI + t * COIL_TURNS * Math.PI * 2;
    const y = coilTop + t * (coilBottom - coilTop);
    const rx = radiusAtY(y);
    const x = CHAMBER_CX + rx * Math.cos(angle);
    // sin > 0 → near face (front); sin < 0 → far face (back)
    const front = Math.sin(angle) >= 0;
    points.push({ x, y, front });
  }

  return points;
}

function pointsToPath(points: SpiralPoint[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

/** Split into contiguous front/back runs for layered drawing. */
function splitFrontBack(points: SpiralPoint[]): { front: string[]; back: string[] } {
  const front: string[] = [];
  const back: string[] = [];
  if (points.length === 0) return { front, back };

  let run: SpiralPoint[] = [points[0]];
  let isFront = points[0].front;

  const flush = () => {
    if (run.length < 2) {
      run = [];
      return;
    }
    const d = pointsToPath(run);
    if (isFront) front.push(d);
    else back.push(d);
    run = [];
  };

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.front === isFront) {
      run.push(p);
    } else {
      // include bridge point so runs meet at the silhouette edge
      run.push(p);
      flush();
      isFront = p.front;
      run = [points[i - 1], p];
    }
  }
  flush();
  return { front, back };
}

function pipeStrokePair(
  d: string,
  opts?: { opacity?: number; className?: string },
) {
  const opacity = opts?.opacity ?? 1;
  const className = opts?.className;
  return (
    <g className={className} opacity={opacity}>
      <path
        d={d}
        fill="none"
        stroke={PIPE_METAL.stroke}
        strokeWidth={PIPE_OD + 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={PIPE_FILL}
        strokeWidth={PIPE_OD - 1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

type ThermalJacketProps = {
  mode: JacketMode;
};

function ThermalJacket({ mode }: ThermalJacketProps) {
  const prefix = useId().replace(/:/g, "");
  const points = useMemo(() => buildSpiralPoints(), []);
  const fullPath = useMemo(() => pointsToPath(points), [points]);
  const { front, back } = useMemo(() => splitFrontBack(points), [points]);

  const coilTop = points[0];
  const coilEnd = points[points.length - 1];
  if (!coilTop || !coilEnd) return null;

  // Supply: left stub into coil start; discharge: outward from coil end.
  const supplyPath = `M ${coilTop.x - 110} ${coilTop.y} L ${coilTop.x} ${coilTop.y}`;
  const dischargeOut =
    coilEnd.x >= CHAMBER_CX ? coilEnd.x + 110 : coilEnd.x - 110;
  const dischargePath = `M ${coilEnd.x} ${coilEnd.y} L ${dischargeOut} ${coilEnd.y}`;

  const flowing = mode !== "idle";
  const flowColor = mode === "warm" ? JACKET_WARM : JACKET_COLD;
  const modeClass =
    mode === "warm"
      ? "thermal-jacket--warm"
      : mode === "cold"
        ? "thermal-jacket--cold"
        : "thermal-jacket--idle";

  const svgView = { left: -120, top: -140, width: 682, height: 620 };

  const shadowFilter = (
    <defs>
      <filter
        id={`${prefix}-shadow`}
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
      >
        <feDropShadow
          dx="1"
          dy="2"
          stdDeviation="1.2"
          floodColor="#000"
          floodOpacity="0.18"
        />
      </filter>
    </defs>
  );

  const flowStroke = (d: string) =>
    flowing ? (
      <path
        className="thermal-jacket__flow"
        d={d}
        fill="none"
        stroke={flowColor}
        strokeWidth={PIPE_OD - 5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : null;

  return (
    <div className={`thermal-jacket ${modeClass}`} aria-hidden>
      <svg
        className="thermal-jacket__svg thermal-jacket__svg--back"
        viewBox={`${svgView.left} ${svgView.top} ${svgView.width} ${svgView.height}`}
        aria-hidden
      >
        {shadowFilter}
        <g filter={`url(#${prefix}-shadow)`}>
          {back.map((d, i) => (
            <g key={`back-${i}`}>{pipeStrokePair(d, { opacity: 0.55 })}</g>
          ))}
        </g>
      </svg>

      <svg
        className="thermal-jacket__svg thermal-jacket__svg--front"
        viewBox={`${svgView.left} ${svgView.top} ${svgView.width} ${svgView.height}`}
        aria-hidden
      >
        <defs>
          <filter
            id={`${prefix}-shadow-front`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="1"
              dy="2"
              stdDeviation="1.2"
              floodColor="#000"
              floodOpacity="0.18"
            />
          </filter>
        </defs>
        <g filter={`url(#${prefix}-shadow-front)`}>
          {pipeStrokePair(supplyPath)}
          {front.map((d, i) => (
            <g key={`front-${i}`}>{pipeStrokePair(d)}</g>
          ))}
          {pipeStrokePair(dischargePath)}
        </g>
        {flowStroke(supplyPath)}
        {flowStroke(fullPath)}
        {flowStroke(dischargePath)}
      </svg>
    </div>
  );
}

/** L-run matching pressure-vessel pipe stroke language (no flow fill). */
function BaseAcidSupplyPipe() {
  const prefix = useId().replace(/:/g, "");
  const centerline = "M 16 16 L 264 16 L 264 273";

  return (
    <div className="base-acid-supply">
      <svg
        className="base-acid-pipe-run"
        viewBox="0 0 280 289"
        aria-hidden
        overflow="visible"
      >
        <defs>
          <filter
            id={`${prefix}-shadow`}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="280"
            height="289"
          >
            <feDropShadow
              dx="1"
              dy="2"
              stdDeviation="1.5"
              floodColor="#000"
              floodOpacity="0.2"
            />
          </filter>
        </defs>
        <g filter={`url(#${prefix}-shadow)`}>
          <path
            d={centerline}
            fill="none"
            stroke={PIPE_METAL.stroke}
            strokeWidth={PIPE_OD + 3}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d={centerline}
            fill="none"
            stroke={PIPE_FILL}
            strokeWidth={PIPE_OD}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <div className="base-acid-flange" />
    </div>
  );
}

function BioreactorCard(props: BioreactorCardProps) {
  const SLOWEST_ROTOR_SPEED = 4;
  const FASTEST_ROTOR_SPEED = 0.5;
  const rotorVal = props.rotorVal ?? 0;
  const aeratorVal = props.aeratorVal ?? 0;
  const jacketMode = props.jacketMode ?? "idle";
  const waterLevelVal = Math.min(100, Math.max(0, props.waterLevelVal ?? 92));
  const targetFillUnits = (waterLevelVal / 100) * VESSEL_MAX_FILL_UNITS;

  const [rotorSpeed, setRotorSpeed] = useState(0);
  const { displayFillUnits, fillVelocity: levelVelocity } = useSpringFillUnits(
    targetFillUnits,
    { stiffness: 120, damping: 0.68 }
  );

  useEffect(() => {
    if (rotorVal == 100) {
      setRotorSpeed(0.5);
    } else if (rotorVal == 0) {
      setRotorSpeed(0);
    } else {
      setRotorSpeed(
        SLOWEST_ROTOR_SPEED -
          ((SLOWEST_ROTOR_SPEED - FASTEST_ROTOR_SPEED) / 99) * (rotorVal - 1)
      );
    }
  }, [rotorVal]);

  const waveVelocity =
    levelVelocity + (aeratorVal / 100) * 28 + (rotorVal / 100) * 20;

  return (
    <div
      style={{
        position: "absolute",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        transform: `translate(${props.translateX}px, ${props.translateY}px) scale(${props.scale})`,
        userSelect: "none",
      }}
      onMouseDown={(event) => {
        props.onMouseDown(event);
      }}
    >
      <div className="wrapper">
        <ThermalJacket mode={jacketMode} />

        <div className="reaction_chamber"></div>

        {/* Front coil layer is inside ThermalJacket; raise chamber above back only via CSS */}

        <div className="agitator">
          <div className="agitator_stem"></div>
          <div
            className="agitator_blade0"
            style={{
              transform: "rotateY(0deg)",
              animation: `rotateProp0 ${rotorSpeed}s infinite`,
              animationTimingFunction: "linear",
            }}
          ></div>
          <div className="agitator_stem2"></div>
          <div
            className="agitator_blade90"
            style={{
              transform: "rotateY(90deg)",
              animation: `rotateProp90 ${rotorSpeed}s infinite`,
              animationTimingFunction: "linear",
            }}
          ></div>
        </div>

        <div className="br-water-clip">
          <VesselWaterBody
            fillUnits={displayFillUnits}
            fillVelocity={waveVelocity}
            showSurface={displayFillUnits / VESSEL_MAX_FILL_UNITS < 0.98}
          />
        </div>

        <div className="sensor sensor1">
          <div className="sensor_base"></div>
          <div className="sensor_stem"></div>
          <div className="sensor_head"></div>
        </div>
        <div className="sensor sensor2">
          <div className="sensor_base"></div>
          <div className="sensor_stem"></div>
          <div className="sensor_head"></div>
        </div>

        <BaseAcidSupplyPipe />

        <div className="aerator_submerged"></div>
        <div className="aerator_supply_pipe_h"></div>
        <div className="aerator_supply_pipe_v"></div>
      </div>
    </div>
  );
}

BioreactorCard.displayName = "BioreactorCard";
export default BioreactorCard;

export { CARD_WIDTH, CARD_HEIGHT };
