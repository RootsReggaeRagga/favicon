import JSZip from "jszip";
import { AppError, MESSAGES, type Locale } from "./i18n";
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

function readme(groups: Set<GroupId>, locale: Locale): string {
  const r = MESSAGES[locale].readme;
  const lines = [r.title, ""];
  const section = (text: string[]) => lines.push(...text, "");
  if (groups.has("favicon") || groups.has("apple") || groups.has("pwa") || groups.has("windows") || groups.has("splash")) section(r.web);
  if (groups.has("android")) section(r.android);
  if (groups.has("ios")) section(r.ios);
  if (groups.has("macos")) section(r.macos);
  if (groups.has("splash")) section(r.splash);
  section(r.regenerate);
  if (groups.has("icons")) section(r.icons);
  return lines.join("\n");
}

export async function buildPackage(
  groups: Set<GroupId>,
  src: IconSource | null,
  s: Settings,
  locale: Locale,
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
  zip.file("README.md", readme(groups, locale));
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
    throw new AppError("notProject");
  }
  const p = raw as Partial<ProjectJson>;
  const known = new Set<string>(GROUPS);
  const groups = new Set((Array.isArray(p.groups) ? p.groups : []).filter((g): g is GroupId => known.has(g)));
  let source: IconSource | null = null;
  const s = p.source;
  if (s && typeof s.data === "string") {
    if (s.kind !== "svg" && !/^data:image\/(png|jpe?g|webp|gif);/i.test(s.data)) {
      throw new AppError("badProjectImage");
    }
    source = s.kind === "svg" ? await sourceFromSvgText(s.data, s.name ?? "icon.svg") : await sourceFromDataUrl(s.data, s.name ?? "icon.png");
    if (s.text) source.text = s.text;
  }
  return { settings: mergeSettings(p.settings), groups, source };
}
