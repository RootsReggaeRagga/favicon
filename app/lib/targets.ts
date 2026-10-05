import type { RenderOptions } from "./render";
import type { GroupId, Settings } from "./settings";

export interface Target {
  id: string;
  group: GroupId;
  /** Sciezka w paczce ZIP. */
  path: string;
  size: number;
  format: "png" | "ico" | "svg";
  opts: RenderOptions;
  icoSizes?: number[];
  label: string;
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

const IOS_DIR = "ios/AppIcon.appiconset";
const MACOS_DIR = "macos/AppIcon.appiconset";
const iosFile = (px: number) => `Icon-${px}.png`;
const macFile = (px: number) => `icon_${px}x${px}.png`;

export function buildTargets(): Target[] {
  const out: Target[] = [];

  // Favicon
  out.push(t({ group: "favicon", path: "favicon.ico", size: 48, format: "ico", icoSizes: [16, 32, 48], opts: { mode: "shape" }, label: "favicon.ico (16/32/48)" }));
  out.push(t({ group: "favicon", path: "favicon.svg", size: 512, format: "svg", opts: { mode: "shape" }, label: "favicon.svg" }));
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
  out.push(t({ group: "android", path: "android/play-store-512.png", size: 512, format: "png", opts: { mode: "fullbleed", opaque: true }, label: "Google Play 512" }));

  // iOS
  const iosSizes = [...new Set(IOS_ICONS.map(([, pt, sc]) => pt * sc))].sort((a, b) => a - b);
  for (const px of iosSizes) {
    out.push(t({ group: "ios", path: `${IOS_DIR}/${iosFile(px)}`, size: px, format: "png", opts: { mode: "fullbleed", opaque: true }, label: px === 1024 ? "App Store 1024" : `${px}×${px}` }));
  }

  // macOS
  const macSizes = [...new Set(MACOS_ICONS.map(([pt, sc]) => pt * sc))].sort((a, b) => a - b);
  for (const px of macSizes) {
    out.push(t({ group: "macos", path: `${MACOS_DIR}/${macFile(px)}`, size: px, format: "png", opts: { mode: "shape", pad: MACOS_PAD }, label: `${px}×${px}` }));
  }

  // Windows — kafelek ma wlasny kolor z browserconfig.xml, wiec PNG to sama ikonka.
  for (const s of [70, 150, 310]) {
    out.push(t({ group: "windows", path: `mstile-${s}x${s}.png`, size: s, format: "png", opts: { mode: "foreground", inset: 0.7 }, label: `mstile ${s}` }));
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
