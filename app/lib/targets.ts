import type { Localized } from "./i18n";
import type { RenderOptions } from "./render";
import type { GroupId, Settings } from "./settings";

export interface Target {
  id: string;
  group: GroupId;
  /** Sciezka w paczce ZIP. */
  path: string;
  /** Szerokosc w px; dla ikon zarazem wysokosc. */
  size: number;
  /** Wysokosc, gdy cel nie jest kwadratem (ekrany startowe). */
  height?: number;
  format: "png" | "ico" | "svg";
  opts: RenderOptions;
  icoSizes?: number[];
  label: Localized;
  /** Tylko dla SVG: kompozycja malych rozmiarow (favicon.svg). */
  small?: boolean;
}

const ADAPTIVE_VISIBLE = 72 / 108;
const MASKABLE_SAFE = 0.8;
/** Szablon Apple dla macOS: ksztalt 824 px na plotnie 1024 px. */
const MACOS_PAD = 824 / 1024;

const t = (x: Omit<Target, "id">): Target => ({ ...x, id: x.path });

const ANDROID_DENSITIES: [string, number][] = [
  ["mdpi", 1],
  ["hdpi", 1.5],
  ["xhdpi", 2],
  ["xxhdpi", 3],
  ["xxxhdpi", 4],
];

/** Pary (idiom, rozmiar w pt, skala) z klasycznego AppIcon.appiconset. */
const IOS_ICONS: [string, number, number][] = [
  ["iphone", 20, 2], ["iphone", 20, 3], ["iphone", 29, 2], ["iphone", 29, 3],
  ["iphone", 40, 2], ["iphone", 40, 3], ["iphone", 60, 2], ["iphone", 60, 3],
  ["ipad", 20, 1], ["ipad", 20, 2], ["ipad", 29, 1], ["ipad", 29, 2],
  ["ipad", 40, 1], ["ipad", 40, 2], ["ipad", 76, 1], ["ipad", 76, 2],
  ["ipad", 83.5, 2], ["ios-marketing", 1024, 1],
];

const MACOS_ICONS: [number, number][] = [
  [16, 1], [16, 2], [32, 1], [32, 2], [128, 1], [128, 2], [256, 1], [256, 2], [512, 1], [512, 2],
];

/**
 * Ekrany startowe iOS (apple-touch-startup-image), pionowo: piksele,
 * rozmiar w punktach CSS i gestosc — z tego powstaje zapytanie media.
 */
export const SPLASH_SCREENS: { w: number; h: number; dw: number; dh: number; ratio: number; device: Localized }[] = [
  { w: 2048, h: 2732, dw: 1024, dh: 1366, ratio: 2, device: "iPad Pro 12.9″" },
  { w: 1668, h: 2388, dw: 834, dh: 1194, ratio: 2, device: "iPad Pro 11″" },
  { w: 1640, h: 2360, dw: 820, dh: 1180, ratio: 2, device: "iPad Air 10.9″" },
  { w: 1668, h: 2224, dw: 834, dh: 1112, ratio: 2, device: "iPad Pro 10.5″" },
  { w: 1620, h: 2160, dw: 810, dh: 1080, ratio: 2, device: "iPad 10.2″" },
  { w: 1536, h: 2048, dw: 768, dh: 1024, ratio: 2, device: "iPad 9.7″ / mini" },
  { w: 1488, h: 2266, dw: 744, dh: 1133, ratio: 2, device: "iPad mini 8.3″" },
  { w: 1320, h: 2868, dw: 440, dh: 956, ratio: 3, device: "iPhone 16 Pro Max" },
  { w: 1206, h: 2622, dw: 402, dh: 874, ratio: 3, device: "iPhone 16 Pro" },
  { w: 1290, h: 2796, dw: 430, dh: 932, ratio: 3, device: "iPhone 15 Pro Max / 16 Plus" },
  { w: 1179, h: 2556, dw: 393, dh: 852, ratio: 3, device: "iPhone 15 / 15 Pro / 16" },
  { w: 1284, h: 2778, dw: 428, dh: 926, ratio: 3, device: "iPhone 12–14 Pro Max / 14 Plus" },
  { w: 1170, h: 2532, dw: 390, dh: 844, ratio: 3, device: "iPhone 12–14" },
  { w: 1125, h: 2436, dw: 375, dh: 812, ratio: 3, device: "iPhone X / XS / 11 Pro / mini" },
  { w: 1242, h: 2688, dw: 414, dh: 896, ratio: 3, device: "iPhone XS Max / 11 Pro Max" },
  { w: 828, h: 1792, dw: 414, dh: 896, ratio: 2, device: "iPhone XR / 11" },
  { w: 1242, h: 2208, dw: 414, dh: 736, ratio: 3, device: "iPhone 8 Plus" },
  { w: 750, h: 1334, dw: 375, dh: 667, ratio: 2, device: "iPhone 8 / SE" },
  { w: 640, h: 1136, dw: 320, dh: 568, ratio: 2, device: { pl: "iPhone SE (1. gen.)", en: "iPhone SE (1st gen)" } },
];
const splashFile = (w: number, h: number) => `splash/apple-splash-${w}x${h}.png`;

/** Ikona powiadomien: 24 dp, tresc w obszarze 22 dp, zawsze wycentrowana. */
export const NOTIFICATION: RenderOptions = {
  mode: "monochrome",
  inset: 22 / 24,
  override: { scale: 1, alignX: "center", alignY: "center", offsetX: 0, offsetY: 0, shadow: false },
};

const IOS_DIR = "ios/AppIcon.appiconset";
/** iOS 18: jeden rozmiar 1024 w trzech wyglądach — format "single size" z Xcode 16. */
const IOS18_DIR = "ios-18/AppIcon.appiconset";
const MACOS_DIR = "macos/AppIcon.appiconset";
const iosFile = (px: number) => `Icon-${px}.png`;
const macFile = (px: number) => `icon_${px}x${px}.png`;

export function buildTargets(): Target[] {
  const out: Target[] = [];

  // Favicon
  out.push(t({ group: "favicon", path: "favicon.ico", size: 48, format: "ico", icoSizes: [16, 32, 48], opts: { mode: "shape" }, label: "favicon.ico (16/32/48)" }));
  out.push(t({ group: "favicon", path: "favicon.svg", size: 512, format: "svg", opts: { mode: "shape" }, label: "favicon.svg", small: true }));
  for (const s of [16, 32, 48, 96]) {
    out.push(t({ group: "favicon", path: `favicon-${s}x${s}.png`, size: s, format: "png", opts: { mode: "shape" }, label: `${s}×${s}` }));
  }

  // Apple touch icon — iOS i tak przycina rogi i zamienia przezroczystosc na czern.
  out.push(t({ group: "apple", path: "apple-touch-icon.png", size: 180, format: "png", opts: { mode: "fullbleed", opaque: true }, label: "apple-touch-icon 180" }));

  // PWA
  for (const s of [192, 512]) {
    out.push(t({ group: "pwa", path: `web-app-manifest-${s}x${s}.png`, size: s, format: "png", opts: { mode: "shape" }, label: `any ${s}` }));
  }
  for (const s of [192, 512]) {
    out.push(t({ group: "pwa", path: `web-app-manifest-maskable-${s}x${s}.png`, size: s, format: "png", opts: { mode: "fullbleed", inset: MASKABLE_SAFE }, label: `maskable ${s}` }));
  }

  // Android
  // Kolejnosc: najpierw rodzaj pliku, potem gestosc — tak czyta sie siatke podgladu.
  const mip = (d: string) => `android/res/mipmap-${d}`;
  const ANDROID_KINDS: [string, (k: number) => number, RenderOptions][] = [
    ["ic_launcher", (k) => 48 * k, { mode: "shape" }],
    ["ic_launcher_round", (k) => 48 * k, { mode: "round" }],
    ["ic_launcher_foreground", (k) => 108 * k, { mode: "foreground", inset: ADAPTIVE_VISIBLE }],
    ["ic_launcher_background", (k) => 108 * k, { mode: "background" }],
    ["ic_launcher_monochrome", (k) => 108 * k, { mode: "monochrome", inset: ADAPTIVE_VISIBLE }],
  ];
  for (const [file, px, opts] of ANDROID_KINDS) {
    for (const [d, k] of ANDROID_DENSITIES) {
      const label = `${file.replace("ic_launcher_", "").replace("ic_launcher", "launcher")} ${d}`;
      out.push(t({ group: "android", path: `${mip(d)}/${file}.png`, size: Math.round(px(k)), format: "png", opts, label }));
    }
  }
  for (const [d, k] of ANDROID_DENSITIES) {
    out.push(t({ group: "android", path: `android/res/drawable-${d}/ic_stat_notification.png`, size: Math.round(24 * k), format: "png", opts: NOTIFICATION, label: { pl: `powiadomienie ${d}`, en: `notification ${d}` } }));
  }
  out.push(t({ group: "android", path: "android/play-store-512.png", size: 512, format: "png", opts: { mode: "fullbleed", opaque: true }, label: "Google Play 512" }));

  // iOS
  const iosSizes = [...new Set(IOS_ICONS.map(([, pt, sc]) => pt * sc))].sort((a, b) => a - b);
  for (const px of iosSizes) {
    out.push(t({ group: "ios", path: `${IOS_DIR}/${iosFile(px)}`, size: px, format: "png", opts: { mode: "fullbleed", opaque: true }, label: px === 1024 ? "App Store 1024" : `${px}×${px}` }));
  }

  // iOS 18: jasny (bez alfy, jak App Store), ciemny (przezroczyste tlo — system
  // dokłada wlasne) i tinted (skala szarosci na czerni — system nakłada kolor).
  out.push(t({ group: "ios", path: `${IOS18_DIR}/AppIcon-1024.png`, size: 1024, format: "png", opts: { mode: "fullbleed", opaque: true }, label: { pl: "iOS 18 jasna", en: "iOS 18 light" } }));
  out.push(t({ group: "ios", path: `${IOS18_DIR}/AppIcon-1024-dark.png`, size: 1024, format: "png", opts: { mode: "dark" }, label: { pl: "iOS 18 ciemna", en: "iOS 18 dark" } }));
  out.push(t({ group: "ios", path: `${IOS18_DIR}/AppIcon-1024-tinted.png`, size: 1024, format: "png", opts: { mode: "tinted", opaque: true }, label: "iOS 18 tinted" }));

  // macOS
  const macSizes = [...new Set(MACOS_ICONS.map(([pt, sc]) => pt * sc))].sort((a, b) => a - b);
  for (const px of macSizes) {
    out.push(t({ group: "macos", path: `${MACOS_DIR}/${macFile(px)}`, size: px, format: "png", opts: { mode: "shape", pad: MACOS_PAD }, label: `${px}×${px}` }));
  }

  // Windows — kafelek ma wlasny kolor z browserconfig.xml, wiec PNG to sama ikonka.
  for (const s of [70, 150, 310]) {
    out.push(t({ group: "windows", path: `mstile-${s}x${s}.png`, size: s, format: "png", opts: { mode: "foreground", inset: 0.7 }, label: `mstile ${s}` }));
  }

  // Ekrany startowe iOS
  for (const sc of SPLASH_SCREENS) {
    out.push(t({ group: "splash", path: splashFile(sc.w, sc.h), size: sc.w, height: sc.h, format: "png", opts: { mode: "splash", opaque: true }, label: sc.device }));
  }

  // Ikony ogolne
  out.push(t({ group: "icons", path: "icons/icon.svg", size: 512, format: "svg", opts: { mode: "shape" }, label: "icon.svg" }));
  for (const s of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
    out.push(t({ group: "icons", path: `icons/icon-${s}x${s}.png`, size: s, format: "png", opts: { mode: "shape" }, label: `${s}×${s}` }));
  }
  return out;
}

export const TARGETS = buildTargets();

/* ─────────────────────────── pliki tekstowe ─────────────────────────── */

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

export function textFiles(groups: Set<string>, s: Settings): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const tile = s.bgMode === "transparent" ? s.themeColor : s.bgColor;

  if (groups.has("pwa")) {
    files.push({
      path: "site.webmanifest",
      content: json({
        name: s.appName,
        short_name: s.shortName,
        icons: [
          { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/web-app-manifest-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/web-app-manifest-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        theme_color: s.themeColor,
        background_color: tile,
        display: "standalone",
        start_url: "/",
      }),
    });
  }

  if (groups.has("android")) {
    const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
    files.push({ path: "android/res/mipmap-anydpi-v26/ic_launcher.xml", content: adaptive });
    files.push({ path: "android/res/mipmap-anydpi-v26/ic_launcher_round.xml", content: adaptive });
  }

  if (groups.has("ios")) {
    files.push({
      path: `${IOS_DIR}/Contents.json`,
      content: json({
        images: IOS_ICONS.map(([idiom, pt, sc]) => ({
          idiom,
          size: `${pt}x${pt}`,
          scale: `${sc}x`,
          filename: iosFile(pt * sc),
        })),
        info: { version: 1, author: "brewcode-favicon" },
      }),
    });
    files.push({
      path: `${IOS18_DIR}/Contents.json`,
      content: json({
        images: [
          { filename: "AppIcon-1024.png", idiom: "universal", platform: "ios", size: "1024x1024" },
          {
            appearances: [{ appearance: "luminosity", value: "dark" }],
            filename: "AppIcon-1024-dark.png",
            idiom: "universal",
            platform: "ios",
            size: "1024x1024",
          },
          {
            appearances: [{ appearance: "luminosity", value: "tinted" }],
            filename: "AppIcon-1024-tinted.png",
            idiom: "universal",
            platform: "ios",
            size: "1024x1024",
          },
        ],
        info: { version: 1, author: "brewcode-favicon" },
      }),
    });
  }

  if (groups.has("macos")) {
    files.push({
      path: `${MACOS_DIR}/Contents.json`,
      content: json({
        images: MACOS_ICONS.map(([pt, sc]) => ({
          idiom: "mac",
          size: `${pt}x${pt}`,
          scale: `${sc}x`,
          filename: macFile(pt * sc),
        })),
        info: { version: 1, author: "brewcode-favicon" },
      }),
    });
  }

  if (groups.has("windows")) {
    files.push({
      path: "browserconfig.xml",
      content: `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="/mstile-70x70.png"/>
      <square150x150logo src="/mstile-150x150.png"/>
      <square310x310logo src="/mstile-310x310.png"/>
      <TileColor>${tile}</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`,
    });
  }

  const head: string[] = [];
  if (groups.has("favicon")) {
    head.push(
      `<link rel="icon" href="/favicon.ico" sizes="48x48">`,
      `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
      `<link rel="icon" href="/favicon-96x96.png" sizes="96x96" type="image/png">`,
    );
  }
  if (groups.has("apple")) head.push(`<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">`);
  if (groups.has("pwa")) head.push(`<link rel="manifest" href="/site.webmanifest">`);
  if (groups.has("splash")) {
    head.push(`<meta name="apple-mobile-web-app-capable" content="yes">`);
    for (const sc of SPLASH_SCREENS) {
      head.push(
        `<link rel="apple-touch-startup-image" href="/${splashFile(sc.w, sc.h)}" media="(device-width: ${sc.dw}px) and (device-height: ${sc.dh}px) and (-webkit-device-pixel-ratio: ${sc.ratio}) and (orientation: portrait)">`,
      );
    }
  }
  if (groups.has("windows")) {
    head.push(`<meta name="msapplication-config" content="/browserconfig.xml">`, `<meta name="msapplication-TileColor" content="${tile}">`);
  }
  if (head.length) {
    const attr = (v: string) => v.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
    head.push(`<meta name="theme-color" content="${attr(s.themeColor)}">`, `<meta name="apple-mobile-web-app-title" content="${attr(s.shortName)}">`);
    files.push({ path: "head.html", content: head.join("\n") + "\n" });
  }

  return files;
}
