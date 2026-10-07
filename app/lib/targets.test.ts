import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, GROUPS, type GroupId } from "./settings";
import { SPLASH_SCREENS, TARGETS, textFiles } from "./targets";

const ALL = new Set<GroupId>(GROUPS);
const files = textFiles(ALL, DEFAULT_SETTINGS);
const file = (path: string) => files.find((f) => f.path === path)!.content;
const byPath = new Map(TARGETS.map((t) => [t.path, t]));

describe("katalog celow", () => {
  it("ma unikalne sciezki", () => {
    expect(byPath.size).toBe(TARGETS.length);
  });

  it("kazda grupa ma co najmniej jeden plik", () => {
    for (const g of ALL) expect(TARGETS.some((t) => t.group === g), g).toBe(true);
  });

  it("cele, ktore platforma odrzuca z alfa, sa kryjace", () => {
    const mustBeOpaque = TARGETS.filter(
      (t) =>
        (t.group === "ios" && !t.path.endsWith("-dark.png")) ||
        t.group === "apple" ||
        t.group === "splash" ||
        t.path === "android/play-store-512.png",
    );
    expect(mustBeOpaque.length).toBeGreaterThan(20);
    for (const t of mustBeOpaque) expect(t.opts.opaque, t.path).toBe(true);
    // Ciemna ikona iOS 18 celowo ma przezroczyste tlo — dokłada je system.
    expect(byPath.get("ios-18/AppIcon.appiconset/AppIcon-1024-dark.png")!.opts.opaque).toBeFalsy();
  });

  it("Android: piec gestosci dla kazdego rodzaju, ikona powiadomien 24 dp", () => {
    const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
    for (const [d, k] of Object.entries(densities)) {
      expect(byPath.get(`android/res/mipmap-${d}/ic_launcher.png`)!.size).toBe(48 * k);
      expect(byPath.get(`android/res/mipmap-${d}/ic_launcher_foreground.png`)!.size).toBe(108 * k);
      expect(byPath.get(`android/res/drawable-${d}/ic_stat_notification.png`)!.size).toBe(24 * k);
    }
  });
});

describe("Contents.json", () => {
  it("iOS (klasyczny): kazdy wpis wskazuje istniejacy plik o rozmiarze pt × skala", () => {
    const { images } = JSON.parse(file("ios/AppIcon.appiconset/Contents.json"));
    expect(images.length).toBeGreaterThan(15);
    for (const img of images) {
      const t = byPath.get(`ios/AppIcon.appiconset/${img.filename}`);
      expect(t, img.filename).toBeDefined();
      expect(t!.size).toBe(parseFloat(img.size) * parseInt(img.scale));
    }
  });

  it("iOS 18: jasna, ciemna i tinted w formacie single size", () => {
    const { images } = JSON.parse(file("ios-18/AppIcon.appiconset/Contents.json"));
    expect(images.map((i: { appearances?: { value: string }[] }) => i.appearances?.[0].value ?? "light")).toEqual([
      "light",
      "dark",
      "tinted",
    ]);
    for (const img of images) {
      expect(img.size).toBe("1024x1024");
      expect(byPath.get(`ios-18/AppIcon.appiconset/${img.filename}`)!.size).toBe(1024);
    }
  });

  it("macOS: kazdy wpis wskazuje istniejacy plik", () => {
    const { images } = JSON.parse(file("macos/AppIcon.appiconset/Contents.json"));
    for (const img of images) {
      expect(byPath.get(`macos/AppIcon.appiconset/${img.filename}`)!.size).toBe(parseInt(img.size) * parseInt(img.scale));
    }
  });
});

describe("pliki WWW", () => {
  it("site.webmanifest wskazuje istniejace ikony", () => {
    const manifest = JSON.parse(file("site.webmanifest"));
    for (const icon of manifest.icons) {
      const t = byPath.get(icon.src.slice(1));
      expect(t, icon.src).toBeDefined();
      expect(icon.sizes).toBe(`${t!.size}x${t!.size}`);
    }
  });

  it("ekrany startowe: piksele = punkty × gestosc, kazdy ma tag w head.html", () => {
    const head = file("head.html");
    for (const sc of SPLASH_SCREENS) {
      expect(sc.w).toBe(sc.dw * sc.ratio);
      expect(sc.h).toBe(sc.dh * sc.ratio);
      const t = byPath.get(`splash/apple-splash-${sc.w}x${sc.h}.png`)!;
      expect(t.height).toBe(sc.h);
      expect(head).toContain(`href="/${t.path}" media="(device-width: ${sc.dw}px) and (device-height: ${sc.dh}px)`);
    }
  });

  it("head.html escapuje nazwe aplikacji", () => {
    const head = textFiles(ALL, { ...DEFAULT_SETTINGS, shortName: 'A"<b>' }).find((f) => f.path === "head.html")!.content;
    expect(head).toContain('content="A&#34;&#60;b&#62;"');
  });
});
