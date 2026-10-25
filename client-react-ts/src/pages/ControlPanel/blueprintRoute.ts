/** `/dashboard?view=blueprint` opens the full-screen Blueprint view. */
export const VIEW_PARAM = "view";
export const BLUEPRINT_VIEW = "blueprint";

export function isBlueprintSearch(search: string | URLSearchParams): boolean {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return params.get(VIEW_PARAM) === BLUEPRINT_VIEW;
}
