import React, { useState } from "react";
import type {
  BioreactorEquipment,
  BioreactorGeometry,
} from "../../lib/bioreactorGeometry";
import type { InletFillVisualState } from "../pressure-vessel/useInletFillAnimation";
import type { DrainVisualState } from "../pressure-vessel/useDrainAnimation";
import BioreactorCard, {
  type DoseMode,
  type JacketMode,
} from "./BioreactorCard";
import "./Canvas.css";

interface Card {
  id: string;
  coordinates: { x: number; y: number };
  text: string;
}

type CanvasProps = {
  cards: Card[];
  rotorVal?: number;
  aeratorVal?: number;
  fillUnits?: number;
  inletFill?: InletFillVisualState;
  drainAnim?: DrainVisualState;
  jacketMode?: JacketMode;
  doseMode?: DoseMode;
  equipment?: Partial<BioreactorEquipment>;
  geometry?: BioreactorGeometry;
};

function Canvas(props: CanvasProps) {
  const [dragging, setDragging] = useState<boolean>(false);
  const [offset, setOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const handleMouseDown = (event: React.MouseEvent, card: Card) => {
    setCurrentCard(card);
    setOffset({
      x: event.clientX - card.coordinates.x,
      y: event.clientY - card.coordinates.y,
    });
    setDragging(true);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (dragging && currentCard) {
      currentCard.coordinates.x = event.clientX - offset.x;
      currentCard.coordinates.y = event.clientY - offset.y;
      setCurrentCard({ ...currentCard });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    setCurrentCard(null);
  };

  const handleWheel = (event: React.WheelEvent) => {
    const delta = Math.sign(event.deltaY);
    if (delta === -1) {
      setZoomLevel((prevZoom) => prevZoom * 1.05);
    } else if (delta === 1) {
      setZoomLevel((prevZoom) => prevZoom / 1.05);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prevZoom) => prevZoom * 1.15);
  };

  const handleZoomOut = () => {
    setZoomLevel((prevZoom) => prevZoom / 1.15);
  };

  return (
    <>
      <div
        className="canvas"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {props.cards.map((card) => (
          <BioreactorCard
            key={card.id}
            rotorVal={props.rotorVal}
            aeratorVal={props.aeratorVal}
            fillUnits={props.fillUnits}
            inletFill={props.inletFill}
            drainAnim={props.drainAnim}
            jacketMode={props.jacketMode}
            doseMode={props.doseMode}
            equipment={props.equipment}
            geometry={props.geometry}
            translateX={card.coordinates.x}
            translateY={card.coordinates.y}
            scale={zoomLevel}
            onMouseDown={(event) => {
              handleMouseDown(event, card);
            }}
          />
        ))}
        <div className="zoomButtons">
          <div className="zoomButton" onClick={handleZoomIn}>
            +
          </div>
          <div className="zoomButton" onClick={handleZoomOut}>
            -
          </div>
        </div>
      </div>
    </>
  );
}

export default Canvas;
