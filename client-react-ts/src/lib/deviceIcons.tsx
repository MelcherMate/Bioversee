import type { DeviceType } from "./devices";

export const DEVICE_TYPE_META: Record<
  DeviceType,
  {
    labelKey: string;
    descriptionKey: string;
  }
> = {
  bioreactor: {
    labelKey: "devices.bioreactor",
    descriptionKey: "devices.bioreactorDesc",
  },
  pressure_vessel: {
    labelKey: "devices.pressure_vessel",
    descriptionKey: "devices.pressure_vesselDesc",
  },
  membrane_bioreactor: {
    labelKey: "devices.membrane_bioreactor",
    descriptionKey: "devices.membrane_bioreactorDesc",
  },
  water_purifier: {
    labelKey: "devices.water_purifier",
    descriptionKey: "devices.water_purifierDesc",
  },
};

export const DEVICE_TYPE_ORDER: DeviceType[] = [
  "bioreactor",
  "pressure_vessel",
  "membrane_bioreactor",
  "water_purifier",
];
