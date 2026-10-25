import { createContext, useContext } from "react";
import type { PushToast } from "../../../components/bioreactor/useBioreactorController";
import type { BioreactorPiping } from "../../../lib/bioreactorGeometry";
import type { AppUser } from "../../../lib/user";

export type BlueprintContextValue = {
  user: AppUser;
  /** Canvas edit mode: layout and wiring changes are allowed. */
  editing: boolean;
  selectedId: string | null;
  /** Unit whose controls fill the docks; lags selectedId while the docks slide out. */
  dockedId: string | null;
  /** Portal targets: the docked node renders its controls / charts here. */
  controlsDock: HTMLElement | null;
  chartsDock: HTMLElement | null;
  /** Applies immediately, then saves to the device config (reverts on failure). */
  setPiping: (deviceId: string, piping: BioreactorPiping) => void;
  /** Applies immediately, then saves the unit name (reverts on failure). */
  renameDevice: (deviceId: string, name: string) => void;
  /** Bumped to focus a unit's name field on the canvas (Rename in the context menu). */
  nameFocus: { id: string; key: number } | null;
  /** Connection pipe picked in edit mode; shows its remove button. */
  selectedPipeId: string | null;
  removePipe: (edgeId: string) => void;
  push: PushToast;
};

export const BlueprintContext = createContext<BlueprintContextValue | null>(null);

export function useBlueprint(): BlueprintContextValue {
  const value = useContext(BlueprintContext);
  if (!value) throw new Error("useBlueprint must be used inside BlueprintContext");
  return value;
}
