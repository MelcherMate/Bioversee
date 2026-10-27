import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  canAdminPlant,
  listMyPlants,
  type Plant,
} from "../../lib/plants";
import { roleLabel } from "../../lib/sharing";
import type { AppUser } from "../../lib/user";
import PlantShareForm from "./PlantShareForm";
import "./SharePanel.css";

type SharePanelProps = {
  user: AppUser;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
  /** Prefer this plant when the panel opens (e.g. from a device menu). */
  plantId?: string | null;
  className?: string;
};

function SharePanel({
  user,
  open,
  onClose,
  onChanged,
  plantId: initialPlantId = null,
  className,
}: SharePanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [plantId, setPlantId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = plants.find((p) => p.id === plantId) ?? null;
  const canAdmin = selected ? canAdminPlant(selected.role) : false;

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        event.target instanceof Node &&
        !panelRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    listMyPlants()
      .then((list) => {
        if (cancelled) return;
        setPlants(list);
        const preferred =
          (initialPlantId && list.find((p) => p.id === initialPlantId)) ||
          list.find((p) => canAdminPlant(p.role)) ||
          list[0];
        setPlantId(preferred?.id ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : t("share.failedLoadPlants")
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, user.id, initialPlantId, t]);

  if (!open) return null;

  const lockedPlant = Boolean(initialPlantId);
  const plantChoices = lockedPlant
    ? plants.filter((p) => p.id === plantId)
    : plants;

  return (
    <div
      className={className ? `share-panel ${className}` : "share-panel"}
      ref={panelRef}
      role="dialog"
      aria-label={t("share.title")}
    >
      <div className="share-panel__head">
        <div>
          <p className="share-panel__eyebrow">{t("share.title")}</p>
          <h2 className="share-panel__title">
            {canAdmin ? t("share.invitePeople") : t("share.peopleWithAccess")}
          </h2>
        </div>
        <button
          type="button"
          className="share-panel__close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>

      {loading ? (
        <p className="share-panel__muted">{t("share.loadingPlants")}</p>
      ) : plants.length === 0 ? (
        <p className="share-panel__muted">{t("share.noPlants")}</p>
      ) : (
        <>
          {lockedPlant && selected ? (
            <p className="share-panel__hint">{selected.name}</p>
          ) : (
            <>
              <label className="share-panel__label" htmlFor="share-plant">
                {t("share.plant")}
              </label>
              <select
                id="share-plant"
                className="share-panel__select"
                value={plantId}
                onChange={(event) => setPlantId(event.target.value)}
              >
                {plantChoices.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name}
                    {plant.role !== "owner" ? ` · ${roleLabel(plant.role)}` : ""}
                  </option>
                ))}
              </select>
            </>
          )}

          {selected ? (
            <PlantShareForm
              user={user}
              plant={selected}
              onChanged={onChanged}
              onLeft={onClose}
            />
          ) : null}
        </>
      )}

      {error ? <p className="share-panel__error">{error}</p> : null}
    </div>
  );
}

export default SharePanel;
