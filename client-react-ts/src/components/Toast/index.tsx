import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./Toast.css";

export type ToastTone = "info" | "success" | "error";

export type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
};

type ToastStackProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

const AUTO_MS = 3200;

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="bv-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (toast.tone === "info") return;
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  return (
    <div className={`bv-toast bv-toast--${toast.tone}`}>
      <div className="bv-toast__body">
        <p className="bv-toast__title">{toast.title}</p>
        {toast.detail && <p className="bv-toast__detail">{toast.detail}</p>}
      </div>
      <button
        type="button"
        className="bv-toast__dismiss"
        onClick={() => onDismiss(toast.id)}
        aria-label={t("common.dismiss")}
      >
        ×
      </button>
      {toast.tone !== "info" && <span className="bv-toast__timer" />}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const push = (tone: ToastTone, title: string, detail?: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, tone, title, detail }]);
    return id;
  };

  const replace = (
    id: string,
    tone: ToastTone,
    title: string,
    detail?: string
  ) => {
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, tone, title, detail } : toast
      )
    );
  };

  return { toasts, push, replace, dismiss };
}
