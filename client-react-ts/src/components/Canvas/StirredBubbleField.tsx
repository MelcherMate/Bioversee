import { useEffect, useRef } from "react";
import "./StirredBubbleField.css";

type Particle = {
  x: number; // 0–1 left→right
  y: number; // 0–1 bottom→top within the water column
  vx: number;
  vy: number;
  r: number;
  age: number;
  life: number;
  /** Per-bubble phase so wander isn't identical across the plume. */
  phase: number;
};

type StirredBubbleFieldProps = {
  /** 0–100 aerator. */
  aeratorVal: number;
  /** 0–1 impeller speed. */
  rotorNorm: number;
  /** 0–1 water fill. */
  fillRatio: number;
  /** Sparger height as % of water column from bottom. */
  spawnBottomPct: number;
  /** Horizontal sparger band as % of width. */
  spawnLeftRange?: [number, number];
  /** Impeller disc offsets from water-clip bottom (px). */
  impellerLowerFromBottom?: number;
  impellerUpperFromBottom?: number;
  /** Water-clip height at full fill (px). */
  clipHeightPx?: number;
  /** Fluid motion scales vs water (= 1). */
  bubbleSpeed?: number;
  bubbleWander?: number;
  bubbleSize?: number;
  bubbleFollow?: number;
};

const MAX_PARTICLES = 720;
/** Steady-state count at 100% air ≈ this many in the column. */
const TARGET_AT_FULL_AIR = 320;
/**
 * Cavitation bubbles that escape into the tank flow at full RPM.
 * Blade-local foam is the CSS cloud on the agitator.
 */
const TARGET_CAVITATION_AT_FULL = 280;
/** Long enough to ride a full wall→center→down→out loop. */
const MEAN_LIFE_S = 5.2;

type ImpellerPlanes = {
  yLo: number;
  yHi: number;
  yMid: number;
  singleDisc: boolean;
};

/**
 * Water-column height of each Rushton disc (y=0 bottom, y=1 surface).
 * Offsets scale with fill because the filled column grows from the bottom.
 */
function impellerPlanes(
  fill: number,
  lowerFromBottom: number,
  upperFromBottom: number,
  clipHeight: number,
): ImpellerPlanes {
  const f = Math.max(0.2, fill);
  const h = Math.max(1, clipHeight);
  const yLo = Math.min(0.85, lowerFromBottom / (f * h));
  const yHi = Math.min(0.92, upperFromBottom / (f * h));
  const singleDisc = Math.abs(yHi - yLo) < 0.03;
  return {
    yLo,
    yHi,
    yMid: singleDisc ? yLo : (yLo + yHi) * 0.5,
    singleDisc,
  };
}

function planeKernel(y: number, yPlane: number, halfWidth = 0.07): number {
  const t = (y - yPlane) / halfWidth;
  return Math.exp(-(t * t));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Smooth 0→1 ramp between a and b. */
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/**
 * Dual-Rushton side-view field — one readable recirculation cell per half:
 *   sides UP → surface IN to shaft → center DOWN → impeller OUT to sides again.
 *
 * At low rpm (~40) stirring is almost off so the sparger plume just rises.
 * The full loop only locks in toward mid/high tip speed.
 */
function stirredVelocity(
  x: number,
  y: number,
  rpmNorm: number,
  tSec: number,
  planes: ImpellerPlanes,
): { vx: number; vy: number } {
  const shaft = 0.5;
  const dx = x - shaft;
  const side = dx >= 0 ? 1 : -1;
  const r = Math.abs(dx);
  const { yLo, yHi, yMid, singleDisc } = planes;

  // 40 rpm ≈ 0.13 → stir≈0; ~120 rpm → rising; 300 rpm → 1
  const stir = smoothstep(0.12, 0.62, rpmNorm);
  const stir2 = stir * stir;

  let vx = 0;
  let vy = 0;

  const lo = planeKernel(y, yLo, 0.11);
  const hi = singleDisc ? 0 : planeKernel(y, yHi, 0.11);

  // Mild blade nudge even at low speed — not a full loop yet
  const tipBoost = Math.max(0, 1 - Math.abs(r - 0.22) * 3.2);
  const soft = rpmNorm * (1 - stir) * 0.22;
  vx += side * lo * soft * (0.4 + tipBoost * 0.3);
  vx += side * hi * soft * (0.35 + tipBoost * 0.25);

  // --- Full recirculation (ramps in with stir) ---
  if (stir > 0.01) {
    // 1) Radial discharge — broader blade sweep band
    vx += side * lo * stir * (0.75 + tipBoost * 0.55);
    vx += side * hi * stir * (0.65 + tipBoost * 0.5);

    // 2) Wall riser — corridor along each side (reaches near the walls)
    const wall = clamp01((r - 0.12) / 0.36);
    if (wall > 0) {
      if (y >= yLo - 0.04) {
        vy += wall * stir * (0.5 + 0.4 * clamp01((y - yLo) / 0.55));
      } else {
        vy -= wall * stir * 0.18;
        vx += -side * wall * stir * 0.12;
      }
    }

    // 3) Surface inward — thicker free-surface layer
    const surface = clamp01((y - 0.65) / 0.28);
    if (surface > 0) {
      vx += -side * surface * stir * (0.55 + r * 0.45);
      vy += surface * stir * (r > 0.14 ? 0.04 : -0.1);
    }

    // 4) Center downwelling — wider shaft core
    const core = clamp01(1 - r / 0.28);
    if (core > 0) {
      if (y > yHi) {
        vy -= core * stir * (0.45 + surface * 0.45);
      }
      if (y > yLo && y <= yHi) {
        vy -= core * stir * 0.28;
      }
      if (y < yLo) {
        vy += core * stir * 0.2;
      }
    }

    // 5) Split at mid disc height
    const split = planeKernel(y, yMid, 0.14) * clamp01(1 - r / 0.3);
    vx += side * split * stir * 0.4;
  }

  // Buoyancy owns the low-rpm plume; fades as the loop takes over
  vy += 0.1 * (1 - stir2) + 0.02 * stir2;

  // Gentle sparger plume sway at low speed
  if (stir < 0.35) {
    const sway = (1 - stir / 0.35) * 0.05;
    vx += Math.sin(tSec * 1.6 + y * 6) * sway * (0.5 + r);
  }

  // Broader coherent eddies + fine jitter so paths fill out.
  // Deterministic noise (no Math.random) keeps motion smooth under load.
  if (stir > 0.05) {
    const phase = tSec * (1.2 + stir * 2.2);
    const eddyX =
      Math.sin((x * 5.2 + y * 4.1) * Math.PI + phase) *
      Math.cos((y * 4.6 - x * 2.8) * Math.PI + phase * 0.7);
    const eddyY =
      Math.cos((x * 4.8 - y * 3.6) * Math.PI + phase * 1.05) *
      Math.sin((y * 5.5 + x * 2.2) * Math.PI - phase * 0.5);
    const mix = 0.25 + stir2 * 0.75;
    vx += eddyX * mix * 0.55;
    vy += eddyY * mix * 0.48;
    vx += Math.sin(tSec * 17.3 + x * 41 + y * 13) * mix * 0.21;
    vy += Math.cos(tSec * 14.7 - x * 29 + y * 19) * mix * 0.16;
  }

  if (x < 0.02) vx += 0.35;
  if (x > 0.98) vx -= 0.35;
  if (y < 0.03) vy += 0.35;
  if (y > 0.98) vy -= 0.2 * stir;

  return { vx, vy };
}

/**
 * Canvas bubble plume for the bioreactor: spawn from the sparger, advect with
 * a dual-impeller stirred-tank field. Own rAF — not tied to React spin frames.
 */
export function StirredBubbleField({
  aeratorVal,
  rotorNorm,
  fillRatio,
  spawnBottomPct,
  spawnLeftRange = [26, 74],
  impellerLowerFromBottom = 103,
  impellerUpperFromBottom = 176,
  clipHeightPx = 510,
  bubbleSpeed = 1,
  bubbleWander = 1,
  bubbleSize = 1,
  bubbleFollow = 1,
}: StirredBubbleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const aeratorRef = useRef(aeratorVal);
  const rotorRef = useRef(rotorNorm);
  const spawnBottomRef = useRef(spawnBottomPct);
  const leftRangeRef = useRef(spawnLeftRange);
  const fillRef = useRef(fillRatio);
  const impellerLoRef = useRef(impellerLowerFromBottom);
  const impellerHiRef = useRef(impellerUpperFromBottom);
  const clipHRef = useRef(clipHeightPx);
  const speedRef = useRef(bubbleSpeed);
  const wanderRef = useRef(bubbleWander);
  const sizeRef = useRef(bubbleSize);
  const followRef = useRef(bubbleFollow);

  aeratorRef.current = aeratorVal;
  rotorRef.current = rotorNorm;
  spawnBottomRef.current = spawnBottomPct;
  leftRangeRef.current = spawnLeftRange;
  fillRef.current = fillRatio;
  impellerLoRef.current = impellerLowerFromBottom;
  impellerHiRef.current = impellerUpperFromBottom;
  clipHRef.current = clipHeightPx;
  speedRef.current = bubbleSpeed;
  wanderRef.current = bubbleWander;
  sizeRef.current = bubbleSize;
  followRef.current = bubbleFollow;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let frame = 0;
    let last = performance.now();
    let spawnDebt = 0;
    let cavitationDebt = 0;
    let foamAmt = 0;
    let disposed = false;
    const t0 = performance.now();
    // Logical CSS pixels (after DPR transform).
    let viewW = 1;
    let viewH = 1;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      // Match .stirred-bubble-field CSS overhang (±20px) so both walls are covered.
      // Keep full clip height — map particles into the filled band each frame so
      // springing water level never reallocates the canvas buffer.
      const overhang = 20;
      const w = Math.max(1, Math.floor(rect.width + overhang * 2));
      const h = Math.max(1, Math.floor(rect.height));
      if (w === viewW && h === viewH && canvas.width > 0) return;
      viewW = w;
      viewH = h;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const pushParticle = (
      x: number,
      y: number,
      vx: number,
      vy: number,
    ) => {
      const list = particlesRef.current;
      if (list.length >= MAX_PARTICLES) return;
      const size = sizeRef.current;
      const speed = speedRef.current;
      list.push({
        x: Math.min(0.95, Math.max(0.05, x)),
        y: Math.min(0.95, Math.max(0.02, y)),
        vx: vx * speed,
        vy: vy * speed,
        r: (0.95 + Math.random() * 1.7) * size,
        age: 0,
        // Viscous fluids hold bubbles longer in the column.
        life:
          (MEAN_LIFE_S / Math.max(0.35, speed)) * (0.75 + Math.random() * 0.5),
        phase: Math.random() * Math.PI * 2,
      });
    };

    const spawnSpargerOne = () => {
      const [l0, l1] = leftRangeRef.current;
      const x =
        (l0 + Math.random() * (l1 - l0) + (Math.random() - 0.5) * 2) / 100;
      const y =
        (spawnBottomRef.current + (Math.random() - 0.5) * 1.4) / 100;
      // Keep spawn on the sparger plane (no low-y clamp — that slid the plume
      // down when the filled column shrank and the sparger sat higher in %).
      pushParticle(
        x,
        Math.min(0.92, Math.max(0.02, y)),
        (Math.random() - 0.5) * 0.06,
        0.03 + Math.random() * 0.03,
      );
    };

    /** Shed near blade tips, then ride the same recirculation as aerator bubbles. */
    const spawnCavitationOne = (planes: ImpellerPlanes) => {
      const fill = Math.max(0.05, fillRef.current);
      if (fill < 0.4) return;
      const plane = Math.random() < 0.5 ? planes.yLo : planes.yHi;
      const side = Math.random() < 0.5 ? -1 : 1;
      // Start on the tip, fling hard into the wall riser so they leave the foam
      const tipR = 0.18 + Math.random() * 0.1;
      const x = 0.5 + side * tipR + (Math.random() - 0.5) * 0.03;
      const y = plane + (Math.random() - 0.5) * 0.04;
      pushParticle(
        x,
        y,
        side * (0.28 + Math.random() * 0.22),
        0.06 + Math.random() * 0.14,
      );
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const tSec = (now - t0) / 1000;

      const air = Math.max(0, Math.min(1, aeratorRef.current / 100));
      const rpm = Math.max(0, Math.min(1, rotorRef.current));
      const fill = Math.max(0, fillRef.current);

      // Keep the rAF loop alive across drain→refill; just pause spawning
      // when the column is essentially empty.
      if (fill < 0.005) {
        particlesRef.current.length = 0;
        ctx.clearRect(0, 0, viewW, viewH);
        frame = requestAnimationFrame(tick);
        return;
      }

      const planes = impellerPlanes(
        fill,
        impellerLoRef.current,
        impellerHiRef.current,
        clipHRef.current,
      );

      const target = air * TARGET_AT_FULL_AIR;
      const spawnPerSec = target <= 0 ? 0 : target / MEAN_LIFE_S;

      // Sparger plume
      spawnDebt += spawnPerSec * dt;
      while (spawnDebt >= 1 && particlesRef.current.length < MAX_PARTICLES) {
        spawnDebt -= 1;
        spawnSpargerOne();
      }
      if (spawnDebt > 4) spawnDebt = 4;

      // Impeller cavitation — only above half speed and ≥40% fill
      const cavitation =
        fill >= 0.4 && rpm > 0.5
          ? Math.min(1, (rpm - 0.5) / 0.5)
          : 0;
      const cavTarget = cavitation * TARGET_CAVITATION_AT_FULL;
      const cavPerSec = cavTarget <= 0 ? 0 : cavTarget / MEAN_LIFE_S;
      cavitationDebt += cavPerSec * dt;
      while (
        cavitationDebt >= 1 &&
        particlesRef.current.length < MAX_PARTICLES
      ) {
        cavitationDebt -= 1;
        spawnCavitationOne(planes);
      }
      if (cavitationDebt > 4) cavitationDebt = 4;

      // Slightly looser lock so bubbles wander within the wider bands
      const stir = Math.min(
        1,
        Math.max(0, (rpm - 0.12) / (0.62 - 0.12)),
      );
      const stirSmooth = stir * stir * (3 - 2 * stir);
      const fluidSpeed = speedRef.current;
      const fluidWander = wanderRef.current;
      const fluidFollow = followRef.current;
      const follow = (1.35 + stirSmooth * 2.6) * fluidFollow;
      // Higher viscosity → stronger velocity damping (stickier fluid).
      const dampX = (1.15 - stirSmooth * 0.25) / Math.max(0.4, fluidSpeed);
      const dampY = (1.05 - stirSmooth * 0.25) / Math.max(0.4, fluidSpeed);
      const wanderAmp = (0.06 + stirSmooth * 0.14) * fluidWander;
      // Buoyancy residual: denser liquid → stronger upward bias for gas bubbles.
      const buoyancy = 0.012 * fluidSpeed;
      const dampXFactor = 1 - dampX * dt;
      const dampYFactor = 1 - dampY * dt;
      const followDt = dt * follow;

      const list = particlesRef.current;
      let write = 0;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.age += dt;
        // Keep them alive through a full loop; only cull past freeboard
        if (p.age > p.life || p.y > 1.08) continue;

        const { vx: fx, vy: fy } = stirredVelocity(
          p.x,
          p.y,
          rpm,
          tSec,
          planes,
        );
        // Per-bubble wander so neighbors don't share the same track
        const wx =
          Math.sin(tSec * 2.1 + p.phase + p.y * 8) * wanderAmp;
        const wy =
          Math.cos(tSec * 1.7 + p.phase * 1.3 - p.x * 6) * wanderAmp * 0.7;

        p.vx = p.vx * dampXFactor + (fx * fluidSpeed + wx) * followDt;
        p.vy =
          p.vy * dampYFactor +
          (fy * fluidSpeed + wy + buoyancy) * followDt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.x < 0.008) {
          p.x = 0.008;
          p.vx = Math.abs(p.vx) * 0.4;
        } else if (p.x > 0.992) {
          p.x = 0.992;
          p.vx = -Math.abs(p.vx) * 0.4;
        }
        if (p.y < 0.01) {
          p.y = 0.01;
          p.vy = Math.max(0.02, Math.abs(p.vy) * 0.3);
        } else if (p.y > 0.99) {
          // Bounce slightly below free surface so they can turn inward
          p.y = 0.99;
          p.vy = Math.min(-0.02, -Math.abs(p.vy) * 0.35);
        }

        list[write++] = p;
      }
      list.length = write;

      const waterH = viewH * Math.min(1, fill);
      const waterTop = viewH - waterH;
      ctx.clearRect(0, 0, viewW, viewH);

      // Foam: high RPM bleaches bubbles toward white (eased so RPM jumps don't flash)
      const foamTarget = rpm * rpm * (3 - 2 * rpm);
      const foamEase = 1 - Math.exp(-dt * 2.8);
      foamAmt += (foamTarget - foamAmt) * foamEase;
      const foam = foamAmt;
      const br = (150 + (255 - 150) * foam) | 0;
      const bg = (210 + (255 - 210) * foam) | 0;
      const bb = (245 + (255 - 245) * foam) | 0;
      const hr = (210 + (255 - 210) * foam) | 0;
      const hg = (236 + (255 - 236) * foam) | 0;

      // Two passes keep fillStyle stable (cheaper than per-bubble rgba strings).
      ctx.fillStyle = `rgb(${br},${bg},${bb})`;
      for (let i = 0; i < write; i++) {
        const p = list[i];
        ctx.globalAlpha = Math.max(0.12, 0.18 + 0.52 * (1 - p.age / p.life));
        ctx.beginPath();
        ctx.arc(p.x * viewW, waterTop + (1 - p.y) * waterH, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Specular only on larger bubbles — skips most of the plume.
      ctx.fillStyle = `rgb(${hr},${hg},255)`;
      for (let i = 0; i < write; i++) {
        const p = list[i];
        if (p.r < 1.35) continue;
        const px = p.x * viewW;
        const py = waterTop + (1 - p.y) * waterH;
        ctx.globalAlpha =
          Math.max(0.12, 0.18 + 0.52 * (1 - p.age / p.life)) * 0.5;
        ctx.beginPath();
        ctx.arc(px - p.r * 0.28, py - p.r * 0.28, p.r * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="stirred-bubble-field"
      aria-hidden
    />
  );
}
