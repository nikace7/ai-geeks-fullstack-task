import { LOGO_PATH } from "./ui/icons";

/**
 * The logo tile from <Logo> (white mark on zinc-900), drawn for next/og's ImageResponse, which
 * renders it to a PNG at build time. Used by the browser-tab icon and the iOS home-screen icon.
 * `rounded` is off for iOS, which rounds the corners itself and turns transparent pixels black.
 */
export function AppIcon({ size, rounded }: { size: number; rounded: boolean }) {
  const glyph = Math.round(size * 0.625);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#18181b",
        borderRadius: rounded ? size / 4 : 0,
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
        <path d={LOGO_PATH} />
      </svg>
    </div>
  );
}
