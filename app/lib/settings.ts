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

  /** Cien pod ikonka (offset i rozmycie w procentach boku). */
  shadow: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetY: number;

  /**
   * Osobna kompozycja dla malych rozmiarow (do SMALL_MAX px): przy 16–48 px
   * ikonka zwykle musi byc wieksza, a ramka tylko rozmazuje sie w szary piksel.
   */
  smallEnabled: boolean;
  smallScale: number;
  smallBorder: boolean;

  /** Wariant ciemny favicon.svg (prefers-color-scheme: dark). */
  darkEnabled: boolean;
  darkBgColor: string;
  darkIconColor: string;

  appName: string;
  shortName: string;
  themeColor: string;
}

/** Granica "malych rozmiarow" dla `smallEnabled`, w pikselach. */
export const SMALL_MAX = 48;

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
  shadow: false,
  shadowColor: "#000000",
  shadowOpacity: 35,
  shadowBlur: 4,
  shadowOffsetY: 2,
  smallEnabled: false,
  smallScale: 0.8,
  smallBorder: false,
  darkEnabled: false,
  darkBgColor: "#1f1f1f",
  darkIconColor: "#f6b900",
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
  | "splash"
  | "icons";

export const GROUPS: { id: GroupId; label: string; hint: string }[] = [
  { id: "favicon", label: "Favicon", hint: "favicon.ico, favicon.svg, PNG 16–96" },
  { id: "apple", label: "Apple touch icon", hint: "180×180, pełne tło" },
  { id: "pwa", label: "PWA", hint: "192/512, maskable, site.webmanifest" },
  { id: "android", label: "Android", hint: "mipmap, adaptive icon, powiadomienia, Google Play 512" },
  { id: "ios", label: "iOS / App Store", hint: "AppIcon klasyczny + iOS 18 (jasny, ciemny, tinted)" },
  { id: "macos", label: "macOS", hint: "AppIcon.appiconset 16–1024" },
  { id: "windows", label: "Windows", hint: "mstile + browserconfig.xml" },
  { id: "splash", label: "Ekrany startowe iOS", hint: "apple-touch-startup-image, 19 urządzeń" },
  { id: "icons", label: "Ikony ogólne", hint: "PNG 16–1024 + SVG" },
];

/** Uzupelnia brakujace pola domyslnymi — zapis ze starszej wersji (albo z pliku JSON) otworzy sie bez bledu. */
export function mergeSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return out;
  const rec = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    // Tylko pola znane i tego samego typu — obcy JSON nie wstrzyknie nic dziwnego.
    if (key in rec && typeof rec[key] === typeof DEFAULT_SETTINGS[key]) {
      (out as unknown as Record<string, unknown>)[key] = rec[key];
    }
  }
  return out;
}
