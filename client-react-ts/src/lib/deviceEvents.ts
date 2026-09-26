/** Lightweight cross-component notify when a device row/config changes. */

const EVENT = "bv-device-updated";

export function notifyDeviceUpdated(deviceId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(EVENT, { detail: { deviceId } }),
  );
}

export function subscribeDeviceUpdated(
  handler: (deviceId: string) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ deviceId: string }>).detail;
    if (detail?.deviceId) handler(detail.deviceId);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
