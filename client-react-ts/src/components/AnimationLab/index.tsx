import { useEffect, useState } from "react";
import { previewAnimation } from "./preview";
import type { AnimationLabSection } from "./types";
import "./AnimationLab.css";

export type { AnimationPreviewId } from "./types";
export { previewAnimation, useAnimationPreview } from "./preview";

/** Registry of lab actions — extend this list for future tools/animations. */
const LAB_SECTIONS: AnimationLabSection[] = [
  {
    id: "auth",
    title: "Auth",
    items: [
      {
        id: "auth-verify",
        label: "Email verify scene",
        hint: "Shows the post-signup confirmation animation",
      },
      {
        id: "auth-verify-replay",
        label: "Replay verify animation",
        hint: "Restarts the mail animation",
      },
      {
        id: "auth-form",
        label: "Back to auth form",
        hint: "Hides the verify scene and returns to sign-in / sign-up",
      },
    ],
  },
];

export default function AnimationLab() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "m") {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        className={`anim-lab__veil ${open ? "is-open" : ""}`}
        aria-label="Close control menu"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`anim-lab ${open ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-labelledby="anim-lab-title"
      >
        <div className="anim-lab__handle" aria-hidden />
        <header className="anim-lab__header">
          <div>
            <p className="anim-lab__eyebrow">Developer</p>
            <h2 id="anim-lab-title" className="anim-lab__title">
              Control menu
            </h2>
          </div>
          <button
            type="button"
            className="anim-lab__close"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </header>
        <p className="anim-lab__hint">
          Toggle with <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>M</kbd>
          . Use this sheet for animation previews and future debug tools.
        </p>
        <div className="anim-lab__sections">
          {LAB_SECTIONS.map((section) => (
            <section key={section.id} className="anim-lab__section">
              <h3 className="anim-lab__section-title">{section.title}</h3>
              <div className="anim-lab__list">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="anim-lab__item"
                    onClick={() => previewAnimation(item.id)}
                  >
                    <span className="anim-lab__item-label">{item.label}</span>
                    <span className="anim-lab__item-hint">{item.hint}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
