export type BgMode = "solid" | "gradient" | "transparent";

export type Align = "start" | "center" | "end";

export interface Settings {
  /** Rozmiar ikonki wzgledem boku plotna (1 = caly bok). */
  scale: number;
  /** Wyrownanie w poziomie (lewo/srodek/prawo) i pionie (gora/srodek/dol). */
  alignX: Align;
  alignY: Align;
  /** Odstep od krawedzi przy wyrownaniu do boku, w procentach boku. */
  margin: number;
  /** Dodatkowe przesuniecie (przeciaganie na podgladzie) w procentach boku, -50..50. */
  offsetX: number;
  offsetY: number;
  /** Obrot w stopniach. */
  rotation: number;
  /** Odbicie lustrzane w poziomie / pionie. */
  flipX: boolean;
  flipY: boolean;

  bgMode: BgMode;
  bgColor: string;
  bgColor2: string;
  /** Kat gradientu jak w CSS: 0 = do gory, 90 = w prawo. */
  bgAngle: number;

  /** Przebarwienie ikonki na jeden kolor (po kanale alfa). */
  tint: boolean;
  iconColor: string;

  /** Promien zaokraglenia w procentach boku, 0..50 (50 = kolo). */
  radius: number;
  /** Grubosc obramowania w procentach boku. */
  borderWidth: number;
  borderColor: string;

  appName: string;
  shortName: string;
  themeColor: string;
}

export const DEFAULT_SETTINGS: Settings = {
  scale: 0.6,
  alignX: "center",
  alignY: "center",
  margin: 10,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
  bgMode: "solid",
  bgColor: "#f59e0b",
  bgColor2: "#b45309",
  bgAngle: 135,
  tint: true,
  iconColor: "#ffffff",
  radius: 22,
  borderWidth: 0,
  borderColor: "#ffffff",
  appName: "Moja aplikacja",
  shortName: "Aplikacja",
  themeColor: "#f59e0b",
};

export type GroupId =
  | "favicon"
  | "apple"
  | "pwa"
  | "android"
  | "ios"
  | "macos"
  | "windows"
  | "icons";

export const GROUPS: { id: GroupId; label: string; hint: string }[] = [
  { id: "favicon", label: "Favicon", hint: "favicon.ico, favicon.svg, PNG 16–96" },
  { id: "apple", label: "Apple touch icon", hint: "180×180, pelne tlo" },
  { id: "pwa", label: "PWA", hint: "192/512, maskable, site.webmanifest" },
  { id: "android", label: "Android", hint: "mipmap, adaptive icon, Google Play 512" },
  { id: "ios", label: "iOS / App Store", hint: "AppIcon.appiconset + 1024 App Store" },
  { id: "macos", label: "macOS", hint: "AppIcon.appiconset 16–1024" },
  { id: "windows", label: "Windows", hint: "mstile + browserconfig.xml" },
  { id: "icons", label: "Ikony ogolne", hint: "PNG 16–1024 + SVG" },
];
