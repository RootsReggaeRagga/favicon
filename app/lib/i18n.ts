import type { GroupId } from "./settings";

export type Locale = "pl" | "en";
export const LOCALES: Locale[] = ["pl", "en"];
export const DEFAULT_LOCALE: Locale = "en";

/** Tekst zalezny od jezyka tam, gdzie nie oplaca sie klucz w slowniku (etykiety celow). */
export type Localized = string | Record<Locale, string>;
export const localize = (v: Localized, locale: Locale) => (typeof v === "string" ? v : v[locale]);

/**
 * Jezyk z naglowka Accept-Language: polski, jesli przegladarka stawia go
 * wyzej niz angielski; wszystko inne (takze brak naglowka) — angielski.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const prefs = acceptLanguage
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1, i };
    })
    .filter((p) => p.lang && Number.isFinite(p.q) && p.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  const hit = prefs.find((p) => (LOCALES as string[]).includes(p.lang));
  return (hit?.lang as Locale | undefined) ?? DEFAULT_LOCALE;
}

/** Bledy z `lib/` niosa kod, a tresc dobiera interfejs w jezyku uzytkownika. */
export type ErrorCode = "notSvg" | "unsupportedFormat" | "imageLoad" | "pngEncode" | "noGlyph" | "notProject" | "badProjectImage";

export class AppError extends Error {
  constructor(public code: ErrorCode) {
    super(MESSAGES.pl.errors[code]);
  }
}

const pl = {
  meta: {
    title: "Generator ikon — favicon, app icon, PWA",
    description:
      "Favicon, ikony aplikacji Android/iOS/macOS, PWA i Windows z jednego pliku SVG lub PNG — lokalnie w przeglądarce.",
  },
  errors: {
    notSvg: "Plik nie jest poprawnym dokumentem SVG.",
    unsupportedFormat: "Obsługiwane formaty: SVG, PNG, JPG, WebP.",
    imageLoad: "Nie udało się wczytać obrazu.",
    pngEncode: "Nie udało się zakodować PNG.",
    noGlyph: "Ten znak nie ma kształtu w wybranej czcionce.",
    notProject: "To nie jest plik ustawień generatora ikon.",
    badProjectImage: "Plik ustawień zawiera nieobsługiwany obraz źródłowy.",
  } satisfies Record<ErrorCode, string>,
  defaults: { appName: "Moja aplikacja", shortName: "Aplikacja", sampleName: "przykład.svg" },
  header: { title: "Generator ikon" },
  tools: {
    undo: "Cofnij (Ctrl+Z)",
    redo: "Ponów (Ctrl+Shift+Z)",
    zoomOut: "Pomniejsz (−)",
    zoomIn: "Powiększ (+)",
    rotateLeft: "Obróć w lewo o 90°",
    rotateRight: "Obróć w prawo o 90°",
    flipH: "Odbij w poziomie",
    flipV: "Odbij w pionie",
    resetTransform: "Resetuj przekształcenia",
  },
  align: {
    label: "Wyrównanie",
    x: { start: "Lewo", center: "Środek", end: "Prawo" },
    y: { start: "Góra", center: "Środek", end: "Dół" },
  },
  source: {
    title: "Ikona źródłowa",
    tabFile: "Plik",
    tabText: "Litera / emoji",
    selectHint: "Zaznacz ikonkę na podglądzie — pokaże uchwyty przekształceń",
    noFile: "Brak pliku",
    dropHint: "Upuść lub wklej (Ctrl+V)",
    textHint: "Kolor nadaje przebarwienie",
    change: "Zmień",
    text: "Tekst",
    textPlaceholder: "np. B, AB albo 🍺",
    textName: (text: string) => `Tekst „${text}”`,
    bold: "Pogrubienie",
    vector: "Wektor",
    raster: "Raster",
    lowRes: "mała rozdzielczość, duże rozmiary będą rozmyte",
    fonts: { sans: "Geist", serif: "Szeryfowa", mono: "Mono", rounded: "Zaokrąglona" },
  },
  position: {
    title: "Pozycja",
    center: "Wyśrodkuj",
    clearOffset: "Usuń ręczne przesunięcie",
    hint: "Kliknij ikonkę na podglądzie, by ją przesuwać, skalować i obracać.",
    size: "Rozmiar",
    margin: "Odstęp od krawędzi",
    rotation: "Obrót",
  },
  background: {
    title: "Tło",
    solid: "Kolor",
    gradient: "Gradient",
    none: "Brak",
    color1: "Kolor 1",
    color: "Kolor tła",
    color2: "Kolor 2",
    angle: "Kąt",
    transparentNote: "iOS, App Store i Google Play nie przyjmują przezroczystości — tam tło będzie białe.",
  },
  iconColor: {
    title: "Kolor ikonki",
    tint: "Przebarwij ikonkę",
    tintRaster: "Raster: kolor nakładany na kształt (kanał alfa)",
    tintSvg: "Jeden kolor dla całego SVG",
    color: "Kolor",
  },
  shape: {
    title: "Kształt",
    radius: "Zaokrąglenie",
    presets: { square: "Kwadrat", slight: "Lekki", ios: "iOS", circle: "Koło" },
    border: "Obramowanie",
    borderColor: "Kolor obramowania",
    note: "Zaokrąglenie i ramka dotyczą favicon, PWA „any”, ikon ogólnych i launchera Androida. iOS, App Store, Google Play i maskable dostają pełny kwadrat — maskę nakłada system.",
  },
  shadow: {
    title: "Cień",
    toggle: "Cień pod ikonką",
    color: "Kolor cienia",
    opacity: "Krycie",
    blur: "Rozmycie",
    offsetY: "Przesunięcie w dół",
  },
  small: {
    title: (px: number) => `Małe rozmiary (≤ ${px} px)`,
    toggle: "Osobna kompozycja",
    hint: "Favicon 16–48 px, favicon.svg i najmniejsze ikony — zwykle większa ikonka, bez ramki",
    size: "Rozmiar",
    keepBorder: "Zachowaj obramowanie",
  },
  dark: {
    title: "Tryb ciemny (favicon.svg)",
    toggle: "Wariant ciemny",
    hint: "favicon.svg zmienia kolory w motywie ciemnym systemu (prefers-color-scheme)",
    bg: "Tło",
    icon: "Ikonka",
    noBgNote: "Przy braku tła zmienia się tylko kolor ikonki. ",
    needsTintNote: "Kolor ikonki wymaga włączonego przebarwienia. ",
    iosNote: "Ten sam kolor ikonki trafia do ciemnej wersji ikony iOS 18.",
  },
  app: { title: "Aplikacja", name: "Nazwa", shortName: "Nazwa krótka", themeColor: "Theme color" },
  pack: { title: "Paczka", selectAll: "Zaznacz wszystko", deselectAll: "Odznacz wszystko", inPackage: "w paczce" },
  groups: {
    favicon: { label: "Favicon", hint: "favicon.ico, favicon.svg, PNG 16–96" },
    apple: { label: "Apple touch icon", hint: "180×180, pełne tło" },
    pwa: { label: "PWA", hint: "192/512, maskable, site.webmanifest" },
    android: { label: "Android", hint: "mipmap, adaptive icon, powiadomienia, Google Play 512" },
    ios: { label: "iOS / App Store", hint: "AppIcon klasyczny + iOS 18 (jasny, ciemny, tinted)" },
    macos: { label: "macOS", hint: "AppIcon.appiconset 16–1024" },
    windows: { label: "Windows", hint: "mstile + browserconfig.xml" },
    splash: { label: "Ekrany startowe iOS", hint: "apple-touch-startup-image, 19 urządzeń" },
    icons: { label: "Ikony ogólne", hint: "PNG 16–1024 + SVG" },
  } satisfies Record<GroupId, { label: string; hint: string }>,
  project: {
    title: "Projekt",
    save: "Zapisz ustawienia",
    load: "Wczytaj",
    note: "Plik .json z ustawieniami i ikoną źródłową — ten sam trafia do każdej paczki ZIP. Można go też upuścić na okno.",
    resetDefaults: "Przywróć domyślne ustawienia",
  },
  download: {
    generating: "Generowanie…",
    progress: (p: string) => `Generowanie ${p}`,
    button: (n: number) => `Pobierz paczkę ZIP (${n} ikon)`,
    file: (path: string) => `Pobierz ${path}`,
  },
  preview: {
    checker: "Szachownica",
    light: "Jasne",
    dark: "Czarne",
    title: "Podgląd",
    // Tekst z klawiszami <kbd> — fragmenty skladane w komponencie.
    help1: "Kliknij ikonkę, żeby ją zaznaczyć: przeciągnij, by przesunąć, narożniki skalują, uchwyt u góry obraca (Shift — co 15°). Z klawiatury: strzałki, ",
    help2: ". Kliknięcie kafelka poniżej pobiera pojedynczy plik.",
  },
  overlay: { icon: "Ikonka — przeciągnij, aby przesunąć", scale: "Skaluj", rotate: "Obróć", rotateTitle: "Obróć (Shift: co 15°)" },
  mockups: {
    siteTitle: "Moja strona",
    appName: "Aplikacja",
    tab: "Karta przeglądarki",
    tabNoteDark: "favicon w motywie jasnym i ciemnym (favicon.svg)",
    tabNote: "favicon 16 px (32 px na ekranach HiDPI)",
    ios: "Ekran iOS",
    iosNote: "apple-touch-icon / AppIcon, maska nakładana przez system",
    android: "Android (adaptive)",
    androidNote: "ta sama ikona w masce koła i squircle",
    ios18: "iOS 18",
    ios18Note: "jasna · ciemna · tinted (kolor wybiera użytkownik)",
    notification: "Powiadomienie Android",
    notificationNote: "ic_stat_notification — biała sylwetka",
    newMessage: "Nowa wiadomość",
    maskable: "PWA maskable",
    maskableNote: "przerywane koło = strefa bezpieczna 80%",
  },
  readme: {
    title: "# Paczka ikon — brewcode-favicon",
    web: [
      "## Strona WWW",
      "Pliki z katalogu głównego paczki skopiuj do katalogu publicznego strony (np. `public/`),",
      "a zawartość `head.html` wklej do sekcji `<head>`.",
    ],
    android: [
      "## Android",
      "Zawartość `android/res` skopiuj do `app/src/main/res`. `mipmap-anydpi-v26` definiuje adaptive icon",
      "(tło, pierwszy plan i warstwę monochromatyczną dla ikon tematycznych Androida 13+).",
      "`drawable-*/ic_stat_notification.png` to ikona powiadomień (biała sylwetka) — ustaw ją",
      "w `NotificationCompat.Builder.setSmallIcon(R.drawable.ic_stat_notification)`.",
      "`android/play-store-512.png` wgraj w Google Play Console.",
    ],
    ios: [
      "## iOS",
      "Wybierz JEDEN z dwóch katalogów i podmień nim `AppIcon.appiconset` w `Assets.xcassets`:",
      "",
      "- `ios-18/AppIcon.appiconset` — format Xcode 16+: jeden rozmiar 1024 w wersji jasnej,",
      "  ciemnej i tinted (iOS 18). Zalecany dla nowych projektów.",
      "- `ios/AppIcon.appiconset` — klasyczny komplet 20–1024 px dla starszych wersji Xcode.",
      "",
      "Ikony jasne są bez kanału alfa, więc przechodzą walidację App Store Connect.",
    ],
    macos: ["## macOS", "Katalog `macos/AppIcon.appiconset` podmień w `Assets.xcassets` projektu macOS."],
    splash: [
      "## Ekrany startowe iOS",
      "Katalog `splash/` skopiuj do katalogu publicznego strony. Tagi `apple-touch-startup-image`",
      "z `head.html` wybierają właściwy plik po rozmiarze ekranu (orientacja pionowa).",
    ],
    regenerate: [
      "## Ponowne wygenerowanie",
      "`brewcode-favicon.json` zawiera wszystkie ustawienia i plik źródłowy. Wczytaj go w generatorze",
      "(„Wczytaj” w sekcji Projekt albo przeciągnij plik na okno), popraw i pobierz paczkę od nowa.",
    ],
    icons: ["## Ikony ogólne", "`icons/` — PNG 16–1024 px i wektorowy `icon.svg`."],
  },
};

export type Messages = typeof pl;

const en: Messages = {
  meta: {
    title: "Icon generator — favicon, app icon, PWA",
    description:
      "Favicons, Android/iOS/macOS app icons, PWA and Windows icons from a single SVG or PNG — locally in your browser.",
  },
  errors: {
    notSvg: "The file is not a valid SVG document.",
    unsupportedFormat: "Supported formats: SVG, PNG, JPG, WebP.",
    imageLoad: "Could not load the image.",
    pngEncode: "Could not encode the PNG.",
    noGlyph: "This character has no shape in the selected font.",
    notProject: "This is not an icon generator settings file.",
    badProjectImage: "The settings file contains an unsupported source image.",
  },
  defaults: { appName: "My App", shortName: "App", sampleName: "sample.svg" },
  header: { title: "Icon generator" },
  tools: {
    undo: "Undo (Ctrl+Z)",
    redo: "Redo (Ctrl+Shift+Z)",
    zoomOut: "Zoom out (−)",
    zoomIn: "Zoom in (+)",
    rotateLeft: "Rotate left 90°",
    rotateRight: "Rotate right 90°",
    flipH: "Flip horizontally",
    flipV: "Flip vertically",
    resetTransform: "Reset transform",
  },
  align: {
    label: "Alignment",
    x: { start: "Left", center: "Center", end: "Right" },
    y: { start: "Top", center: "Middle", end: "Bottom" },
  },
  source: {
    title: "Source icon",
    tabFile: "File",
    tabText: "Letter / emoji",
    selectHint: "Select the icon in the preview to show transform handles",
    noFile: "No file",
    dropHint: "Drop or paste (Ctrl+V)",
    textHint: "Color comes from the tint",
    change: "Change",
    text: "Text",
    textPlaceholder: "e.g. B, AB or 🍺",
    textName: (text: string) => `Text “${text}”`,
    bold: "Bold",
    vector: "Vector",
    raster: "Raster",
    lowRes: "low resolution, large sizes will be blurry",
    fonts: { sans: "Geist", serif: "Serif", mono: "Mono", rounded: "Rounded" },
  },
  position: {
    title: "Position",
    center: "Center",
    clearOffset: "Remove manual offset",
    hint: "Click the icon in the preview to move, scale and rotate it.",
    size: "Size",
    margin: "Edge margin",
    rotation: "Rotation",
  },
  background: {
    title: "Background",
    solid: "Color",
    gradient: "Gradient",
    none: "None",
    color1: "Color 1",
    color: "Background color",
    color2: "Color 2",
    angle: "Angle",
    transparentNote: "iOS, the App Store and Google Play don't accept transparency — the background will be white there.",
  },
  iconColor: {
    title: "Icon color",
    tint: "Tint the icon",
    tintRaster: "Raster: color applied to the shape (alpha channel)",
    tintSvg: "One color for the whole SVG",
    color: "Color",
  },
  shape: {
    title: "Shape",
    radius: "Corner radius",
    presets: { square: "Square", slight: "Slight", ios: "iOS", circle: "Circle" },
    border: "Border",
    borderColor: "Border color",
    note: "Corner radius and border apply to favicons, PWA “any”, generic icons and the Android launcher. iOS, the App Store, Google Play and maskable icons get a full square — the system applies the mask.",
  },
  shadow: {
    title: "Shadow",
    toggle: "Drop shadow",
    color: "Shadow color",
    opacity: "Opacity",
    blur: "Blur",
    offsetY: "Offset down",
  },
  small: {
    title: (px: number) => `Small sizes (≤ ${px} px)`,
    toggle: "Separate layout",
    hint: "Favicons 16–48 px, favicon.svg and the smallest icons — usually a larger icon, no border",
    size: "Size",
    keepBorder: "Keep border",
  },
  dark: {
    title: "Dark mode (favicon.svg)",
    toggle: "Dark variant",
    hint: "favicon.svg switches colors in the system dark theme (prefers-color-scheme)",
    bg: "Background",
    icon: "Icon",
    noBgNote: "With no background only the icon color changes. ",
    needsTintNote: "The icon color requires tinting to be on. ",
    iosNote: "The same icon color is used for the dark iOS 18 icon.",
  },
  app: { title: "App", name: "Name", shortName: "Short name", themeColor: "Theme color" },
  pack: { title: "Package", selectAll: "Select all", deselectAll: "Deselect all", inPackage: "in package" },
  groups: {
    favicon: { label: "Favicon", hint: "favicon.ico, favicon.svg, PNG 16–96" },
    apple: { label: "Apple touch icon", hint: "180×180, full background" },
    pwa: { label: "PWA", hint: "192/512, maskable, site.webmanifest" },
    android: { label: "Android", hint: "mipmap, adaptive icon, notifications, Google Play 512" },
    ios: { label: "iOS / App Store", hint: "Classic AppIcon + iOS 18 (light, dark, tinted)" },
    macos: { label: "macOS", hint: "AppIcon.appiconset 16–1024" },
    windows: { label: "Windows", hint: "mstile + browserconfig.xml" },
    splash: { label: "iOS splash screens", hint: "apple-touch-startup-image, 19 devices" },
    icons: { label: "Generic icons", hint: "PNG 16–1024 + SVG" },
  },
  project: {
    title: "Project",
    save: "Save settings",
    load: "Load",
    note: "A .json file with the settings and source icon — the same one is included in every ZIP package. You can also drop it onto the window.",
    resetDefaults: "Restore default settings",
  },
  download: {
    generating: "Generating…",
    progress: (p: string) => `Generating ${p}`,
    button: (n: number) => `Download ZIP package (${n} icons)`,
    file: (path: string) => `Download ${path}`,
  },
  preview: {
    checker: "Checkerboard",
    light: "Light",
    dark: "Black",
    title: "Preview",
    help1: "Click the icon to select it: drag to move, corners scale, the top handle rotates (Shift — 15° steps). Keyboard: arrows, ",
    help2: ". Clicking a tile below downloads a single file.",
  },
  overlay: { icon: "Icon — drag to move", scale: "Scale", rotate: "Rotate", rotateTitle: "Rotate (Shift: 15° steps)" },
  mockups: {
    siteTitle: "My website",
    appName: "App",
    tab: "Browser tab",
    tabNoteDark: "favicon in light and dark theme (favicon.svg)",
    tabNote: "favicon 16 px (32 px on HiDPI screens)",
    ios: "iOS home screen",
    iosNote: "apple-touch-icon / AppIcon, mask applied by the system",
    android: "Android (adaptive)",
    androidNote: "the same icon in a circle and squircle mask",
    ios18: "iOS 18",
    ios18Note: "light · dark · tinted (color chosen by the user)",
    notification: "Android notification",
    notificationNote: "ic_stat_notification — white silhouette",
    newMessage: "New message",
    maskable: "PWA maskable",
    maskableNote: "dashed circle = 80% safe zone",
  },
  readme: {
    title: "# Icon package — brewcode-favicon",
    web: [
      "## Website",
      "Copy the files from the package root into your site's public directory (e.g. `public/`)",
      "and paste the contents of `head.html` into the `<head>` section.",
    ],
    android: [
      "## Android",
      "Copy the contents of `android/res` into `app/src/main/res`. `mipmap-anydpi-v26` defines the adaptive icon",
      "(background, foreground and the monochrome layer for Android 13+ themed icons).",
      "`drawable-*/ic_stat_notification.png` is the notification icon (white silhouette) — set it",
      "with `NotificationCompat.Builder.setSmallIcon(R.drawable.ic_stat_notification)`.",
      "Upload `android/play-store-512.png` in the Google Play Console.",
    ],
    ios: [
      "## iOS",
      "Pick ONE of the two directories and replace `AppIcon.appiconset` in `Assets.xcassets` with it:",
      "",
      "- `ios-18/AppIcon.appiconset` — Xcode 16+ format: a single 1024 size in light,",
      "  dark and tinted versions (iOS 18). Recommended for new projects.",
      "- `ios/AppIcon.appiconset` — the classic 20–1024 px set for older Xcode versions.",
      "",
      "Light icons have no alpha channel, so they pass App Store Connect validation.",
    ],
    macos: ["## macOS", "Use the `macos/AppIcon.appiconset` directory to replace the one in your macOS project's `Assets.xcassets`."],
    splash: [
      "## iOS splash screens",
      "Copy the `splash/` directory into your site's public directory. The `apple-touch-startup-image` tags",
      "from `head.html` pick the right file by screen size (portrait orientation).",
    ],
    regenerate: [
      "## Regenerating",
      "`brewcode-favicon.json` holds all settings and the source file. Load it in the generator",
      "(“Load” in the Project section, or drop the file onto the window), adjust and download the package again.",
    ],
    icons: ["## Generic icons", "`icons/` — PNG 16–1024 px and a vector `icon.svg`."],
  },
};

export const MESSAGES: Record<Locale, Messages> = { pl, en };
