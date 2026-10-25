import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const BACK_BUTTON = 3;
const FORWARD_BUTTON = 4;

/**
 * Mouse side buttons → in-app back / forward.
 * Safari on macOS ignores these buttons by default, so we handle them
 * ourselves and cancel the browser default to avoid double navigation.
 */
export function useMouseHistoryButtons(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const isSideButton = (event: MouseEvent) =>
      event.button === BACK_BUTTON || event.button === FORWARD_BUTTON;

    const onMouseDown = (event: MouseEvent) => {
      if (isSideButton(event)) event.preventDefault();
    };

    const onMouseUp = (event: MouseEvent) => {
      if (!isSideButton(event)) return;
      event.preventDefault();
      navigate(event.button === BACK_BUTTON ? -1 : 1);
    };

    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mouseup", onMouseUp, true);
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mouseup", onMouseUp, true);
    };
  }, [navigate]);
}
