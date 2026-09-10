import type { ComponentType } from "react";
import {
  BeakerOutline,
  ColorFilterOutline,
  CubeOutline,
  FunnelOutline,
} from "react-ionicons";
import type { DeviceType } from "../lib/devices";

type IonIconProps = {
  color?: string;
  height?: string;
  width?: string;
  title?: string;
};

export const DEVICE_TYPE_META: Record<
  DeviceType,
  {
    labelKey: string;
    descriptionKey: string;
    Icon: ComponentType<IonIconProps>;
  }
> = {
  bioreactor: {
    labelKey: "devices.bioreactor",
    descriptionKey: "devices.bioreactorDesc",
    Icon: BeakerOutline,
  },
  pressure_vessel: {
    labelKey: "devices.pressure_vessel",
    descriptionKey: "devices.pressure_vesselDesc",
    Icon: CubeOutline,
  },
  membrane_bioreactor: {
    labelKey: "devices.membrane_bioreactor",
    descriptionKey: "devices.membrane_bioreactorDesc",
    Icon: FunnelOutline,
  },
  water_purifier: {
    labelKey: "devices.water_purifier",
    descriptionKey: "devices.water_purifierDesc",
    Icon: ColorFilterOutline,
  },
};

export const DEVICE_TYPE_ORDER: DeviceType[] = [
  "bioreactor",
  "pressure_vessel",
  "membrane_bioreactor",
  "water_purifier",
];
