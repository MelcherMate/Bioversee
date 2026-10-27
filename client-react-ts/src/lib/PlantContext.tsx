import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEVICES_CHANGED_EVENT } from "./onboarding";
import {
  ensureMyDefaultPlant,
  listMyPlants,
  type Plant,
} from "./plants";

const STORAGE_KEY = "bioversee.activePlantId";

type PlantContextValue = {
  plants: Plant[];
  activePlantId: string | null;
  activePlant: Plant | null;
  loading: boolean;
  error: string | null;
  setActivePlantId: (id: string) => void;
  refreshPlants: () => Promise<Plant[]>;
};

const PlantContext = createContext<PlantContextValue | null>(null);

function readStoredPlantId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredPlantId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function PlantProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [activePlantId, setActivePlantIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refreshPlants = useCallback(async () => {
    const list = await listMyPlants();
    if (list.length === 0) {
      await ensureMyDefaultPlant();
      const again = await listMyPlants();
      setPlants(again);
      return again;
    }
    setPlants(list);
    return list;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPlants([]);
      setActivePlantIdState(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const list = await refreshPlants();
        if (cancelled) return;
        const stored = readStoredPlantId();
        const pick =
          (stored && list.find((p) => p.id === stored)?.id) ||
          list[0]?.id ||
          null;
        setActivePlantIdState(pick);
        if (pick) writeStoredPlantId(pick);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : typeof err === "object" &&
                  err &&
                  "message" in err &&
                  typeof (err as { message: unknown }).message === "string"
                ? (err as { message: string }).message
                : String(err)
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshPlants]);

  useEffect(() => {
    if (!enabled) return;
    const onChanged = () => {
      void refreshPlants().then((list) => {
        setActivePlantIdState((current) => {
          if (current && list.some((p) => p.id === current)) return current;
          const next = list[0]?.id ?? null;
          if (next) writeStoredPlantId(next);
          return next;
        });
      });
    };
    window.addEventListener(DEVICES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(DEVICES_CHANGED_EVENT, onChanged);
  }, [enabled, refreshPlants]);

  const setActivePlantId = useCallback((id: string) => {
    setActivePlantIdState(id);
    writeStoredPlantId(id);
  }, []);

  const activePlant = useMemo(
    () => plants.find((p) => p.id === activePlantId) ?? null,
    [plants, activePlantId]
  );

  const value = useMemo(
    () => ({
      plants,
      activePlantId,
      activePlant,
      loading,
      error,
      setActivePlantId,
      refreshPlants: async () => {
        const list = await refreshPlants();
        setActivePlantIdState((current) => {
          if (current && list.some((p) => p.id === current)) return current;
          const next = list[0]?.id ?? null;
          if (next) writeStoredPlantId(next);
          return next;
        });
        return list;
      },
    }),
    [
      plants,
      activePlantId,
      activePlant,
      loading,
      error,
      setActivePlantId,
      refreshPlants,
    ]
  );

  return (
    <PlantContext.Provider value={value}>{children}</PlantContext.Provider>
  );
}

export function usePlantContext(): PlantContextValue {
  const ctx = useContext(PlantContext);
  if (!ctx) {
    throw new Error("usePlantContext must be used within PlantProvider");
  }
  return ctx;
}

/** Safe for components that may render outside the provider. */
export function useOptionalPlantContext(): PlantContextValue | null {
  return useContext(PlantContext);
}
