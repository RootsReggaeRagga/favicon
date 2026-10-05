import JSZip from "jszip";
import { canvasToPng, encodeIco, encodeOpaquePng } from "./encode";
import { buildSvg, renderCanvas } from "./render";
import { GROUPS, mergeSettings, type GroupId, type Settings } from "./settings";
import { sourceFromDataUrl, sourceFromSvgText, type IconSource, type TextSpec } from "./source";
import { TARGETS, textFiles, type Target } from "./targets";

export async function exportTarget(target: Target, src: IconSource | null, s: Settings): Promise<Blob> {
  if (target.format === "svg") return new Blob([buildSvg(src, s, { small: target.small })], { type: "image/svg+xml" });
  if (target.format === "ico") {
    const images = await Promise.all(
      (target.icoSizes ?? [16, 32, 48]).map(async (size) => ({
        size,
        png: await canvasToPng(renderCanvas(size, src, s, target.opts)),
      })),
    );
    return encodeIco(images);
  }
  const canvas = renderCanvas(target.size, src, s, target.opts, target.height ?? target.size);
  return target.opts.opaque ? encodeOpaquePng(canvas) : canvasToPng(canvas);
}

function readme(groups: Set<GroupId>): string {
  const lines = ["# Paczka ikon — brewcode-favicon", ""];
  if (groups.has("favicon") || groups.has("apple") || groups.has("pwa") || groups.has("windows") || groups.has("splash")) {
    lines.push(
      "## Strona WWW",
      "Pliki z katalogu glownego paczki skopiuj do katalogu publicznego strony (np. `public/`),",
      "a zawartosc `head.html` wklej do sekcji `<head>`.",
      "",
    );
  }
  if (groups.has("android")) {
    lines.push(
      "## Android",
      "Zawartosc `android/res` skopiuj do `app/src/main/res`. `mipmap-anydpi-v26` definiuje adaptive icon",
      "(tlo, pierwszy plan i warstwe monochromatyczna dla ikon tematycznych Androida 13+).",
      "`drawable-*/ic_stat_notification.png` to ikona powiadomien (biala sylwetka) — ustaw ja",
      "w `NotificationCompat.Builder.setSmallIcon(R.drawable.ic_stat_notification)`.",
      "`android/play-store-512.png` wgraj w Google Play Console.",
      "",
    );
  }
  if (groups.has("ios")) {
    lines.push(
      "## iOS",
      "Wybierz JEDEN z dwoch katalogow i podmien nim `AppIcon.appiconset` w `Assets.xcassets`:",
      "",
      "- `ios-18/AppIcon.appiconset` — format Xcode 16+: jeden rozmiar 1024 w wersji jasnej,",
      "  ciemnej i tinted (iOS 18). Zalecany dla nowych projektow.",
      "- `ios/AppIcon.appiconset` — klasyczny komplet 20–1024 px dla starszych wersji Xcode.",
      "",
      "Ikony jasne sa bez kanalu alfa, wiec przechodza walidacje App Store Connect.",
      "",
    );
  }
  if (groups.has("macos")) {
    lines.push("## macOS", "Katalog `macos/AppIcon.appiconset` podmien w `Assets.xcassets` projektu macOS.", "");
  }
  if (groups.has("splash")) {
    lines.push(
      "## Ekrany startowe iOS",
      "Katalog `splash/` skopiuj do katalogu publicznego strony. Tagi `apple-touch-startup-image`",
      "z `head.html` wybieraja wlasciwy plik po rozmiarze ekranu (orientacja pionowa).",
      "",
    );
  }
  lines.push(
    "## Ponowne wygenerowanie",
    "`brewcode-favicon.json` zawiera wszystkie ustawienia i plik zrodlowy. Wczytaj go w generatorze",
    "(„Wczytaj ustawienia” albo przeciagnij plik na okno), popraw i pobierz paczke od nowa.",
    "",
  );
  if (groups.has("icons")) lines.push("## Ikony ogolne", "`icons/` — PNG 16–1024 px i wektorowy `icon.svg`.", "");
  return lines.join("\n");
}

export async function buildPackage(
  groups: Set<GroupId>,
  src: IconSource | null,
  s: Settings,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const targets = TARGETS.filter((t) => groups.has(t.group));
  let done = 0;
  for (const target of targets) {
    zip.file(target.path, await exportTarget(target, src, s));
    onProgress?.(++done, targets.length);
  }
  for (const f of textFiles(groups, s)) zip.file(f.path, f.content);
  zip.file(PROJECT_FILE, JSON.stringify(projectToJson(s, groups, src), null, 2) + "\n");
  zip.file("README.md", readme(groups));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─────────────────────── projekt: zapis i odczyt JSON ─────────────────────── */

export const PROJECT_FILE = "brewcode-favicon.json";
const PROJECT_FORMAT = "brewcode-favicon";

export interface ProjectJson {
  format: typeof PROJECT_FORMAT;
  version: 1;
  settings: Settings;
  groups: GroupId[];
  source?: { kind: "svg" | "png"; name: string; data: string; text?: TextSpec };
}

export function projectToJson(s: Settings, groups: Set<GroupId>, src: IconSource | null): ProjectJson {
  const json: ProjectJson = { format: PROJECT_FORMAT, version: 1, settings: s, groups: [...groups] };
  if (src) json.source = { kind: src.kind, name: src.name, data: src.data, text: src.text };
  return json;
}

/** Odczyt pliku projektu. Nieznane pola sa pomijane, brakujace uzupelniane domyslnymi. */
export async function projectFromJson(raw: unknown): Promise<{
  settings: Settings;
  groups: Set<GroupId>;
  source: IconSource | null;
}> {
  if (!raw || typeof raw !== "object" || (raw as ProjectJson).format !== PROJECT_FORMAT) {
    throw new Error("To nie jest plik ustawień generatora ikon.");
  }
  const p = raw as Partial<ProjectJson>;
  const known = new Set<string>(GROUPS.map((g) => g.id));
  const groups = new Set((Array.isArray(p.groups) ? p.groups : []).filter((g): g is GroupId => known.has(g)));
  let source: IconSource | null = null;
  const s = p.source;
  if (s && typeof s.data === "string") {
    if (s.kind !== "svg" && !/^data:image\/(png|jpe?g|webp|gif);/i.test(s.data)) {
      throw new Error("Plik ustawień zawiera nieobsługiwany obraz źródłowy.");
    }
    source = s.kind === "svg" ? await sourceFromSvgText(s.data, s.name ?? "ikona.svg") : await sourceFromDataUrl(s.data, s.name ?? "ikona.png");
    if (s.text) source.text = s.text;
  }
  return { settings: mergeSettings(p.settings), groups, source };
}
