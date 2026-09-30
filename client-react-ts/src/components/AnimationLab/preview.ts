import { useEffect } from "react";
import type { AnimationPreviewId } from "./types";

export type { AnimationPreviewId } from "./types";

const PREVIEW_EVENT = "bioversee:preview-animation";

export function previewAnimation(id: AnimationPreviewId) {
  window.dispatchEvent(
    new CustomEvent(PREVIEW_EVENT, {
      detail: { id },
    })
  );
}

export function useAnimationPreview(
  handler: (id: AnimationPreviewId) => void
) {
  useEffect(() => {
    const onPreview = (event: Event) => {
      const id = (event as CustomEvent<{ id?: AnimationPreviewId }>).detail?.id;
      if (!id) return;
      handler(id);
    };
    window.addEventListener(PREVIEW_EVENT, onPreview);
    return () => window.removeEventListener(PREVIEW_EVENT, onPreview);
  }, [handler]);
}
