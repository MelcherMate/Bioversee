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
    label: string;
    description: string;
    Icon: ComponentType<IonIconProps>;
  }
> = {
  bioreactor: {
    label: "Bioreactor",
    description: "Culture vessel with rotor and aerator controls",
    Icon: BeakerOutline,
  },
  pressure_vessel: {
    label: "Pressure Vessel",
    description: "Fill and drain level control",
    Icon: CubeOutline,
  },
  membrane_bioreactor: {
    label: "Membrane MBR",
    description: "Membrane filtration with aeration",
    Icon: FunnelOutline,
  },
  water_purifier: {
    label: "Water Purifier",
    description: "Legacy water treatment process",
    Icon: ColorFilterOutline,
  },
};

export const DEVICE_TYPE_ORDER: DeviceType[] = [
  "bioreactor",
  "pressure_vessel",
  "membrane_bioreactor",
  "water_purifier",
];
