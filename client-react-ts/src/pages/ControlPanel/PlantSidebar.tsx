import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AddOutline } from "react-ionicons";
import { createMyPlant, type Plant } from "../../lib/plants";

type PlantSidebarProps = {
  plants: Plant[];
  activePlantId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => Promise<unknown>;
  onCreated: (plantId: string) => void;
};

export default function PlantSidebar({
  plants,
  activePlantId,
  loading,
  onSelect,
  onRefresh,
  onCreated,
}: PlantSidebarProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdd = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createMyPlant(t("controlPanel.defaultPlantName"));
      await onRefresh();
      onSelect(id);
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cp-plants" role="navigation" aria-label={t("controlPanel.plants")}>
      <div className="cp-plants__head">
        <h2 className="cp-plants__title">{t("controlPanel.plants")}</h2>
        <div className="cp-plants__actions">
          <button
            type="button"
            className="cp-plants__icon-btn"
            aria-label={t("controlPanel.newPlant")}
            title={t("controlPanel.newPlant")}
            disabled={busy}
            onClick={() => void onAdd()}
          >
            <AddOutline color="currentColor" height="16px" width="16px" />
          </button>
        </div>
      </div>

      {error && <p className="cp-plants__error">{error}</p>}

      <ul className="cp-plants__list" role="listbox" aria-label={t("controlPanel.plants")}>
        {loading && plants.length === 0 ? (
          <li className="cp-plants__empty">{t("common.loading")}</li>
        ) : plants.length === 0 ? (
          <li className="cp-plants__empty">{t("controlPanel.noPlant")}</li>
        ) : (
          plants.map((plant) => {
            const active = plant.id === activePlantId;
            return (
              <li key={plant.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`cp-plants__item ${active ? "is-active" : ""}`}
                  onClick={() => onSelect(plant.id)}
                >
                  <span className="cp-plants__item-name">{plant.name}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
