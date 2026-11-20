import { ImageResponse } from "next/og";
import { AppIcon } from "@/components/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Shown when the app is saved to an iPhone or iPad home screen. */
export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={size.width} rounded={false} />, size);
}
