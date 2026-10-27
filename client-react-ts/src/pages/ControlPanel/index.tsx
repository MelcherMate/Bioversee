import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { usePlantContext } from "../../lib/PlantContext";
import { renameMyPlant } from "../../lib/plants";
import type { AppUser } from "../../lib/user";
import BlueprintView from "./blueprint/BlueprintView";
import { BLUEPRINT_VIEW, isBlueprintSearch, VIEW_PARAM } from "./blueprintRoute";
import EditModeToggle from "./EditModeToggle";
import LineViewToggle from "./LineViewToggle";
import Overview from "./Overview";
import PlantSidebar from "./PlantSidebar";
import "./ControlPanel.css";

type Tab = "overview" | "blueprint";

type ControlPanelProps = {
  user: AppUser;
};

export default function ControlPanel({ user }: ControlPanelProps) {
  const { t } = useTranslation();
  const {
    plants,
    activePlantId,
    activePlant,
    loading,
    error,
    setActivePlantId,
    refreshPlants,
  } = usePlantContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = isBlueprintSearch(searchParams) ? "blueprint" : "overview";
  const setTab = (next: Tab) => {
    setSearchParams((params) => {
      const updated = new URLSearchParams(params);
      if (next === "blueprint") updated.set(VIEW_PARAM, BLUEPRINT_VIEW);
      else updated.delete(VIEW_PARAM);
      return updated;
    });
  };

  const [editing, setEditing] = useState(false);
  const [titleFocusKey, setTitleFocusKey] = useState(0);

  const editTitle = () => {
    if (tab !== "overview") setTab("overview");
    setEditing(true);
    setTitleFocusKey((key) => key + 1);
  };

  const onRename = async (name: string) => {
    if (!activePlant) return;
    await renameMyPlant(activePlant.id, name);
    await refreshPlants();
  };

  return (
    <div className={`cp ${tab === "blueprint" ? "cp--blueprint" : ""}`}>
      <div className="cp__layout">
        <PlantSidebar
          plants={plants}
          activePlantId={activePlantId}
          loading={loading}
          onSelect={setActivePlantId}
          onRefresh={refreshPlants}
          onCreated={editTitle}
        />

        <section
          className={`cp-main ${editing ? "is-editing" : ""}`}
          aria-label={t("controlPanel.controlPanel")}
        >
          <header className="cp-main__head">
            <h1 className="cp-main__title">
              {tab === "blueprint"
                ? t("controlPanel.line")
                : t("controlPanel.controlPanel")}
            </h1>
            <div className="cp-main__tools">
              <EditModeToggle
                active={editing}
                onToggle={() => setEditing((on) => !on)}
              />
              <LineViewToggle
                active={tab === "blueprint"}
                onToggle={() =>
                  setTab(tab === "blueprint" ? "overview" : "blueprint")
                }
              />
            </div>
          </header>

          {error && <p className="cp__error">{error}</p>}

          <div className="cp-main__views">
            <div
              className={`cp-main__body ${tab === "overview" ? "is-active" : ""}`}
              role="tabpanel"
              aria-hidden={tab !== "overview"}
            >
              <Overview
                plant={activePlant}
                currentUserId={user.id}
                currentUserName={user.displayName || user.email || ""}
                editing={editing}
                titleFocusKey={titleFocusKey}
                onRename={onRename}
              />
            </div>
            <div
              className={`cp-main__body ${tab === "blueprint" ? "is-active" : ""}`}
              role="tabpanel"
              aria-hidden={tab !== "blueprint"}
            >
              <BlueprintView
                plantId={activePlantId}
                user={user}
                editing={editing}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
