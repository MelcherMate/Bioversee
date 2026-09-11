import React, { useState } from "react";
import BioreactorCard from "./BioreactorCard";
import "./Canvas.css";

interface Card {
  id: string;
  coordinates: { x: number; y: number };
  text: string;
}

function Canvas(props) {
  const [dragging, setDragging] = useState<boolean>(false);
  const [offset, setOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Mouse down event handler
  const handleMouseDown = (event: React.MouseEvent, card: Card) => {
    setCurrentCard(card);
    // console.log(card);
    setOffset({
      x: event.clientX - card.coordinates.x,
      y: event.clientY - card.coordinates.y,
    });
    setDragging(true);
  };

  // Mouse move event handler
  const handleMouseMove = (event: React.MouseEvent) => {
    if (dragging && currentCard) {
      currentCard.coordinates.x = event.clientX - offset.x;
      currentCard.coordinates.y = event.clientY - offset.y;
      setCurrentCard({ ...currentCard });
    }
  };

  // Mouse up event handler
  const handleMouseUp = () => {
    setDragging(false);
    setCurrentCard(null);
  };

  // Wheel event handler
  const handleWheel = (event: React.WheelEvent) => {
    const delta = Math.sign(event.deltaY); // Positive or negative value depending on the direction of the scroll
    if (delta === -1) {
      // Scroll up: zoom in
      setZoomLevel((prevZoom) => prevZoom * 1.05); // zoom in
    } else if (delta === 1) {
      // Scroll down: zoom out
      setZoomLevel((prevZoom) => prevZoom / 1.05); // zoom out
    }
  };

  // Zoom in button handler
  const handleZoomIn = () => {
    setZoomLevel((prevZoom) => prevZoom * 1.15);
  };

  // Zoom out button handler
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
