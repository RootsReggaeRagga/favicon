import JSZip from "jszip";
import { canvasToPng, encodeIco, encodeOpaquePng } from "./encode";
import { buildSvg, renderCanvas } from "./render";
import type { GroupId, Settings } from "./settings";
import type { IconSource } from "./source";
import { TARGETS, textFiles, type Target } from "./targets";

export async function exportTarget(target: Target, src: IconSource | null, s: Settings): Promise<Blob> {
  if (target.format === "svg") return new Blob([buildSvg(src, s)], { type: "image/svg+xml" });
  if (target.format === "ico") {
    const images = await Promise.all(
      (target.icoSizes ?? [16, 32, 48]).map(async (size) => ({
        size,
        png: await canvasToPng(renderCanvas(size, src, s, target.opts)),
      })),
    );
    return encodeIco(images);
  }
  const canvas = renderCanvas(target.size, src, s, target.opts);
  return target.opts.opaque ? encodeOpaquePng(canvas) : canvasToPng(canvas);
}

function readme(groups: Set<GroupId>): string {
  const lines = ["# Paczka ikon — brewcode-favicon", ""];
  if (groups.has("favicon") || groups.has("apple") || groups.has("pwa") || groups.has("windows")) {
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
      "`android/play-store-512.png` wgraj w Google Play Console.",
      "",
    );
  }
  if (groups.has("ios")) {
    lines.push(
      "## iOS",
      "Katalog `ios/AppIcon.appiconset` podmien w `Assets.xcassets`. Ikony sa bez kanalu alfa,",
      "wiec `Icon-1024.png` przechodzi walidacje App Store Connect.",
      "",
    );
  }
  if (groups.has("macos")) {
    lines.push("## macOS", "Katalog `macos/AppIcon.appiconset` podmien w `Assets.xcassets` projektu macOS.", "");
  }
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
