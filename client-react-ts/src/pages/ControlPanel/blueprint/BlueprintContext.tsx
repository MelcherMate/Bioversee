import { createContext, useContext } from "react";
import type { PushToast } from "../../../components/bioreactor/useBioreactorController";
import type { AppUser } from "../../../lib/user";

export type BlueprintContextValue = {
  user: AppUser;
  selectedId: string | null;
  /** Unit whose controls fill the docks; lags selectedId while the docks slide out. */
  dockedId: string | null;
  /** Portal targets: the docked node renders its controls / charts here. */
  controlsDock: HTMLElement | null;
  chartsDock: HTMLElement | null;
  /** Tells the view whether the selected unit has anything for the charts dock. */
  setHasCharts: (deviceId: string, hasCharts: boolean) => void;
  push: PushToast;
};

export const BlueprintContext = createContext<BlueprintContextValue | null>(null);

export function useBlueprint(): BlueprintContextValue {
  const value = useContext(BlueprintContext);
  if (!value) throw new Error("useBlueprint must be used inside BlueprintContext");
  return value;
}
