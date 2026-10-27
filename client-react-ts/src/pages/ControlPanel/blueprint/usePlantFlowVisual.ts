import { useEffect, useState } from "react";
import {
  getActivePlantFlowVisual,
  subscribePlantFlowVisuals,
  type PlantTransferSnapshot,
} from "../../../lib/plantTransferJobs";

/** Live plant-drain snapshot for pipe water + sprinkle overlays. */
export function usePlantFlowVisual(): PlantTransferSnapshot | null {
  const [snap, setSnap] = useState<PlantTransferSnapshot | null>(() =>
    getActivePlantFlowVisual()
  );

  useEffect(() => subscribePlantFlowVisuals(setSnap), []);

  return snap;
}
