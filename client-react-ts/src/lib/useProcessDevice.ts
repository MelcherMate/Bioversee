import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getDeviceForPage,
  listAccessibleDevices,
  type DeviceType,
  type DeviceWithAccess,
} from "./devices";
import { fallbackPathAfterLostDevice } from "./sharing";

/**
 * Load the process-page device and leave the route if `?device=` is no longer
 * accessible (e.g. left/deleted from another client). Navbar also redirects on
 * device-list refresh; this covers the first paint / remount case.
 */
export function useProcessDevice(type: DeviceType, userId: string) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preferredDeviceId = searchParams.get("device");
  const [device, setDevice] = useState<DeviceWithAccess | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    void (async () => {
      try {
        const next = await getDeviceForPage(type, preferredDeviceId);
        if (cancelled) return;

        if (preferredDeviceId && !next) {
          const list = await listAccessibleDevices();
          if (cancelled) return;
          navigate(fallbackPathAfterLostDevice(list, type), { replace: true });
          return;
        }

        setDevice(next);
      } catch (error) {
        console.error(error);
        if (!cancelled) setDevice(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, preferredDeviceId, type, navigate]);

  return { device, ready, preferredDeviceId };
}
