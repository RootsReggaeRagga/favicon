"use client";

import {
  Crosshair,
  Download,
  FileDown,
  FileUp,
  ImageUp,
  Redo2,
  RotateCcw,
  RotateCw,
  // Lucide 1.x nazywa ikony od osi: pionowa linia = odbicie lewo/prawo.
  TrianglesCenterlineDashedHorizontal as FlipVerticalIcon,
  TrianglesCenterlineDashedVertical as FlipHorizontalIcon,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { track } from "@/lib/analytics";
import { localize } from "@/lib/i18n";
import { buildPackage, downloadBlob, exportTarget, PROJECT_FILE, projectFromJson, projectToJson } from "@/lib/package";
import type { RenderOptions } from "@/lib/render";
import { DEFAULT_SETTINGS, GROUPS, mergeSettings, SMALL_MAX, type Align, type BgMode, type GroupId, type Settings } from "@/lib/settings";
import {
  FONTS,
  hasEmoji,
  SAMPLE_SVG,
  sourceFromDataUrl,
  sourceFromFile,
  sourceFromSvgText,
  sourceFromText,
  type FontId,
  type IconSource,
  type TextSpec,
} from "@/lib/source";
import { TARGETS, type Target } from "@/lib/targets";
import { cn } from "@/lib/utils";
import { ColorField, Section, Segmented, Slider, Toggle } from "./controls";
import { useErrorText, useLocale, useT } from "./I18n";
import IconCanvas from "./IconCanvas";
import Mockups from "./Mockups";
import TransformOverlay from "./TransformOverlay";
import { useHistory } from "./useHistory";

const STORAGE_KEY = "brewcode-favicon:v1";
/** Wiekszego zrodla nie zapisujemy — localStorage ma zwykle ~5 MB na domene. */
const MAX_STORED_SOURCE = 2_000_000;

interface Stored {
  settings: Settings;
  groups: GroupId[];
  source?: { kind: "svg" | "png"; name: string; data: string; text?: TextSpec };
}

type SourceTab = "file" | "text";

/** Rodzaj zrodla do analityki: plik wektorowy, raster albo litera/emoji. */
const sourceType = (src: IconSource | null) => (!src ? "none" : src.text ? "text" : src.kind);

const HERO: RenderOptions = { mode: "shape" };
const HERO_SIZE = 256;
const ALL_GROUPS = GROUPS;

const RADIUS_PRESETS = [
  { key: "square", value: 0 },
  { key: "slight", value: 12 },
  { key: "ios", value: 22 },
  { key: "circle", value: 50 },
] as const;

type PreviewBg = "checker" | "light" | "dark";
const CHECKER = "bg-[conic-gradient(#2c2c2c_25%,#232323_0_50%,#2c2c2c_0_75%,#232323_0)] bg-[length:20px_20px]";
const PREVIEW_BG: Record<PreviewBg, string> = {
  checker: CHECKER,
  light: "bg-white",
  dark: "bg-black",
};

const ALIGNS: Align[] = ["start", "center", "end"];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const normDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

function AlignGrid({ x, y, onChange }: { x: Align; y: Align; onChange: (x: Align, y: Align) => void }) {
  const t = useT();
  return (
    <ToggleGroup
      type="single"
      value={`${x}:${y}`}
      onValueChange={(v) => {
        if (!v) return;
        const [ax, ay] = v.split(":") as [Align, Align];
        onChange(ax, ay);
      }}
      aria-label={t.align.label}
      className="grid w-[88px] shrink-0 grid-cols-3 gap-1 p-1"
    >
      {ALIGNS.map((ay) =>
        ALIGNS.map((ax) => (
          <ToggleGroupItem
            key={`${ax}:${ay}`}
            value={`${ax}:${ay}`}
            title={`${t.align.x[ax]} · ${t.align.y[ay]}`}
            aria-label={`${t.align.x[ax]} · ${t.align.y[ay]}`}
            className="group h-6 px-0 data-[state=on]:bg-primary"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 group-data-[state=on]:bg-primary-foreground" />
          </ToggleGroupItem>
        )),
      )}
    </ToggleGroup>
  );
}

function ToolButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Tile({ target, src, s }: { target: Target; src: IconSource | null; s: Settings }) {
  const h = target.height ?? target.size;
  const long = Math.max(target.size, h);
  // Podglad renderujemy najwyzej w 256 px na dluzszym boku — dla kafelka 96 px to az nadto.
  const k = Math.min(1, 256 / long);
  const render = Math.round(target.size * k);
  const renderH = Math.round(h * k);
  const display = Math.max(32, Math.min(long, 96));
  const [busy, setBusy] = useState(false);
  const name = target.path.split("/").pop()!;
  const t = useT();
  const locale = useLocale();
  return (
    <button
      type="button"
      title={t.download.file(target.path)}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          downloadBlob(await exportTarget(target, src, s), name);
          track("download_file", { file_name: target.path, file_group: target.group, source_type: sourceType(src) });
        } finally {
          setBusy(false);
        }
      }}
      className="group flex flex-col items-center gap-2 rounded-lg p-2 text-center transition-colors hover:bg-card"
    >
      <div className={cn("relative flex h-[104px] w-[104px] items-center justify-center rounded-md", CHECKER)}>
        <IconCanvas size={render} height={renderH} display={display} src={src} settings={s} opts={target.opts} pixelated={long < display} />
        <Download className="absolute right-1.5 bottom-1.5 h-3.5 w-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <span className="text-xs font-medium">{localize(target.label, locale)}</span>
      <span className="max-w-[120px] truncate font-mono text-[10px] text-muted-foreground group-hover:text-primary">
        {busy ? "…" : name}
      </span>
    </button>
  );
}

export default function Generator() {
  const t = useT();
  const locale = useLocale();
  const errorText = useErrorText();
  // Domyslne nazwy aplikacji w jezyku interfejsu; reszta ustawien wspolna.
  const [defaults] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, appName: t.defaults.appName, shortName: t.defaults.shortName }));
  const [settings, setSettings] = useState<Settings>(defaults);
  const [source, setSource] = useState<IconSource | null>(null);
  const [groups, setGroups] = useState<Set<GroupId>>(new Set(ALL_GROUPS));
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewBg, setPreviewBg] = useState<PreviewBg>("checker");
  const [selected, setSelected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sourceTab, setSourceTab] = useState<SourceTab>("file");
  const [textSpec, setTextSpec] = useState<TextSpec>({ text: "B", font: "sans", bold: true });
  const fileInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const history = useHistory(settings, setSettings);

  // Siatka kilkudziesieciu canvasow nie musi nadazac za kazdym ruchem suwaka.
  const deferred = useDeferredValue(settings);

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);
  const patch = useCallback((fn: (prev: Settings) => Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...fn(prev) }));
  }, []);

  // Odtworzenie stanu z localStorage — dopiero po montazu, zeby nie rozjechac hydratacji.
  useEffect(() => {
    (async () => {
      let stored: Stored | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      } catch {}
      if (stored?.settings) history.reset(mergeSettings(stored.settings, defaults));
      if (stored?.groups) setGroups(new Set(stored.groups.filter((g) => ALL_GROUPS.includes(g))));
      try {
        const s = stored?.source;
        if (s) {
          const src = s.kind === "svg" ? await sourceFromSvgText(s.data, s.name) : await sourceFromDataUrl(s.data, s.name);
          if (s.text) {
            src.text = s.text;
            setTextSpec(s.text);
            setSourceTab("text");
          }
          setSource(src);
        } else setSource(await sourceFromSvgText(SAMPLE_SVG, t.defaults.sampleName));
      } catch {
        setSource(await sourceFromSvgText(SAMPLE_SVG, t.defaults.sampleName));
      }
      setLoaded(true);
    })();
    // Tylko przy montazu; `history.reset` jest stabilne.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const data: Stored = { settings, groups: [...groups] };
    if (source && source.data.length < MAX_STORED_SOURCE) {
      data.source = { kind: source.kind, name: source.name, data: source.data, text: source.text };
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [settings, groups, source, loaded]);

  const importProject = useCallback(
    async (file: File) => {
      const p = await projectFromJson(JSON.parse(await file.text()));
      history.reset(p.settings);
      if (p.groups.size) setGroups(p.groups);
      if (p.source) {
        setSource(p.source);
        if (p.source.text) {
          setTextSpec(p.source.text);
          setSourceTab("text");
        } else setSourceTab("file");
      }
    },
    [history],
  );

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      if (file.type === "application/json" || /\.json$/i.test(file.name)) return await importProject(file);
      const src = await sourceFromFile(file);
      setSourceTab("file");
      setSource(src);
      // Raster zwykle ma juz wlasne kolory — przebarwienie wlaczamy tylko dla SVG.
      setSettings((prev) => ({ ...prev, tint: src.kind === "svg" ? prev.tint : false }));
    } catch (e) {
      setError(errorText(e));
    }
  }, [importProject, errorText]);

  // Zrodlo z litery / emoji: generowane od nowa po krotkiej przerwie w pisaniu.
  const emojiRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!loaded || sourceTab !== "text") return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const src = await sourceFromText(textSpec);
        if (cancelled) return;
        setSource(src);
        setError(null);
        // Emoji maja wlasne kolory — przy przejsciu litera ↔ emoji przelaczamy przebarwienie.
        const emoji = hasEmoji(src.text!.text);
        if (emojiRef.current !== emoji) {
          if (emojiRef.current !== null || !source?.text) setSettings((p) => ({ ...p, tint: !emoji }));
          emojiRef.current = emoji;
        }
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // `source` celowo poza zaleznosciami — efekt sam go ustawia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textSpec, sourceTab, loaded]);

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y. W polach tekstowych zostawiamy natywne cofanie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if ((e.target as HTMLElement).closest("input[type=text], textarea, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        history.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) handleFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  // Przeksztalcenia z klawiatury, gdy ikonka jest zaznaczona.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      const step = e.shiftKey ? 5 : 0.5;
      const k = e.key;
      if (k === "Escape") return setSelected(false);
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (moves[k]) {
        e.preventDefault();
        const [dx, dy] = moves[k];
        patch((p) => ({ offsetX: clamp(p.offsetX + dx, -50, 50), offsetY: clamp(p.offsetY + dy, -50, 50) }));
      } else if (k === "+" || k === "=") patch((p) => ({ scale: clamp(+(p.scale + 0.05).toFixed(2), 0.1, 1.5) }));
      else if (k === "-") patch((p) => ({ scale: clamp(+(p.scale - 0.05).toFixed(2), 0.1, 1.5) }));
      else if (k === "[" || k === "]") patch((p) => ({ rotation: normDeg(p.rotation + (k === "]" ? 1 : -1) * (e.shiftKey ? 15 : 1)) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, patch]);

  const download = async () => {
    if (!groups.size) return;
    setError(null);
    setProgress(t.download.generating);
    try {
      const blob = await buildPackage(groups, source, settings, locale, (done, total) => setProgress(`${done}/${total}`));
      downloadBlob(blob, "icons.zip");
      track("download_package", {
        file_count: fileCount,
        group_count: groups.size,
        groups: [...groups].sort().join(","),
        source_type: sourceType(source),
        size_kb: Math.round(blob.size / 1024),
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setProgress(null);
    }
  };

  const toggleGroup = (id: GroupId, on?: boolean) =>
    setGroups((prev) => {
      const next = new Set(prev);
      if (on ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  const selectIcon = () => {
    setSelected(true);
    hero.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const s = settings;
  const fileCount = TARGETS.filter((x) => groups.has(x.group)).length;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col lg:h-screen lg:flex-row"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
      }}
    >
      {/* ───────────── Sidebar ───────────── */}
      <aside className="flex w-full shrink-0 flex-col border-r bg-card lg:h-screen lg:w-[340px]">
        <header className="flex items-center gap-3 border-b px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <div>
            <h1 className="text-sm font-semibold">{t.header.title}</h1>
            <p className="text-xs text-muted-foreground">favicon · app icon · PWA · Android · iOS</p>
          </div>
        </header>

        {/* Telefon: pelny podglad jest pod ustawieniami, wiec u gory trzymamy przypiety skrot. */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card/95 px-5 py-2.5 backdrop-blur lg:hidden">
          <IconCanvas size={128} display={56} src={source} settings={deferred} opts={HERO} />
          {[16, 32, 48].map((size) => (
            <IconCanvas key={size} size={size} src={source} settings={deferred} opts={HERO} />
          ))}
          <div className="ml-auto flex">
            <ToolButton label={t.tools.undo} disabled={!history.canUndo} onClick={history.undo}>
              <Undo2 />
            </ToolButton>
            <ToolButton label={t.tools.redo} disabled={!history.canRedo} onClick={history.redo}>
              <Redo2 />
            </ToolButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Section title={t.source.title}>
            <Segmented<SourceTab>
              value={sourceTab}
              onChange={setSourceTab}
              options={[
                { value: "file", label: t.source.tabFile },
                { value: "text", label: t.source.tabText },
              ]}
            />
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border-2 border-dashed p-2.5 transition-colors",
                dragOver ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={selectIcon}
                title={t.source.selectHint}
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-md ring-offset-2 ring-offset-card transition-shadow",
                  CHECKER,
                  selected ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-primary/60",
                )}
              >
                {source && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={source.image.src}
                    alt=""
                    // Litera jest czarna (kolor nadaje przebarwienie) — na ciemnym tle by zniknela.
                    className={cn("max-h-10 max-w-10 object-contain", source.text && !hasEmoji(source.text.text) && "invert")}
                  />
                )}
              </button>
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-medium">{source ? (source.text ? t.source.textName(source.text.text) : source.name) : t.source.noFile}</div>
                <div className="text-xs text-muted-foreground">
                  {sourceTab === "file" ? t.source.dropHint : t.source.textHint}
                </div>
              </div>
              {sourceTab === "file" && (
                <Button type="button" size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                  <ImageUp /> {t.source.change}
                </Button>
              )}
            </div>
            {sourceTab === "text" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="src-text" className="font-normal">
                    {t.source.text}
                  </Label>
                  <Input
                    id="src-text"
                    value={textSpec.text}
                    maxLength={8}
                    placeholder={t.source.textPlaceholder}
                    onChange={(e) => setTextSpec((t) => ({ ...t, text: e.target.value }))}
                  />
                </div>
                <Segmented<FontId>
                  value={textSpec.font}
                  onChange={(font) => setTextSpec((t) => ({ ...t, font }))}
                  options={FONTS.map((f) => ({ value: f, label: <span className="text-xs">{t.source.fonts[f]}</span> }))}
                />
                <Toggle label={t.source.bold} checked={textSpec.bold} onChange={(bold) => setTextSpec((t) => ({ ...t, bold }))} />
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/webp,.svg"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {source && sourceTab === "file" && (
              <p className="text-xs text-muted-foreground">
                {source.kind === "svg" ? t.source.vector : t.source.raster} · {Math.round(source.width)}×{Math.round(source.height)}
                {source.kind === "png" && source.width < 512 && (
                  <span className="text-primary"> · {t.source.lowRes}</span>
                )}
              </p>
            )}
          </Section>

          <Section
            title={t.position.title}
            aside={
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  patch(() => ({ alignX: "center", alignY: "center", offsetX: 0, offsetY: 0, rotation: 0, flipX: false, flipY: false }))
                }
              >
                {t.position.center}
              </button>
            }
          >
            <div className="flex items-center gap-4">
              <AlignGrid x={s.alignX} y={s.alignY} onChange={(x, y) => patch(() => ({ alignX: x, alignY: y, offsetX: 0, offsetY: 0 }))} />
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="text-sm text-foreground">
                  {t.align.x[s.alignX]} · {t.align.y[s.alignY]}
                </div>
                {(s.offsetX !== 0 || s.offsetY !== 0) && (
                  <button type="button" className="text-primary hover:underline" onClick={() => patch(() => ({ offsetX: 0, offsetY: 0 }))}>
                    {t.position.clearOffset}
                  </button>
                )}
                <div>{t.position.hint}</div>
              </div>
            </div>
            <Slider label={t.position.size} value={Math.round(s.scale * 100)} min={10} max={150} unit="%" onChange={(v) => set("scale", v / 100)} />
            <Slider
              label={t.position.margin}
              value={s.margin}
              min={0}
              max={40}
              step={0.5}
              unit="%"
              disabled={s.alignX === "center" && s.alignY === "center"}
              onChange={(v) => set("margin", v)}
            />
            <Slider label={t.position.rotation} value={s.rotation} min={-180} max={180} unit="°" onChange={(v) => set("rotation", v)} />
          </Section>

          <Section title={t.background.title}>
            <Segmented<BgMode>
              value={s.bgMode}
              onChange={(v) => set("bgMode", v)}
              options={[
                { value: "solid", label: t.background.solid },
                { value: "gradient", label: t.background.gradient },
                { value: "transparent", label: t.background.none },
              ]}
            />
            {s.bgMode !== "transparent" && (
              <ColorField label={s.bgMode === "gradient" ? t.background.color1 : t.background.color} value={s.bgColor} onChange={(v) => set("bgColor", v)} />
            )}
            {s.bgMode === "gradient" && (
              <>
                <ColorField label={t.background.color2} value={s.bgColor2} onChange={(v) => set("bgColor2", v)} />
                <Slider label={t.background.angle} value={s.bgAngle} min={0} max={360} unit="°" onChange={(v) => set("bgAngle", v)} />
              </>
            )}
            {s.bgMode === "transparent" && (
              <p className="text-xs text-muted-foreground">
                {t.background.transparentNote}
              </p>
            )}
          </Section>

          <Section title={t.iconColor.title}>
            <Toggle
              label={t.iconColor.tint}
              hint={source?.kind === "png" ? t.iconColor.tintRaster : t.iconColor.tintSvg}
              checked={s.tint}
              onChange={(v) => set("tint", v)}
            />
            <ColorField label={t.iconColor.color} value={s.iconColor} disabled={!s.tint} onChange={(v) => set("iconColor", v)} />
          </Section>

          <Section title={t.shape.title}>
            <Slider label={t.shape.radius} value={s.radius} min={0} max={50} step={0.5} unit="%" onChange={(v) => set("radius", v)} />
            <Segmented<string>
              value={String(s.radius)}
              onChange={(v) => set("radius", Number(v))}
              options={RADIUS_PRESETS.map((p) => ({ value: String(p.value), label: <span className="text-xs">{t.shape.presets[p.key]}</span> }))}
            />
            <Slider label={t.shape.border} value={s.borderWidth} min={0} max={20} step={0.5} unit="%" onChange={(v) => set("borderWidth", v)} />
            <ColorField label={t.shape.borderColor} value={s.borderColor} disabled={s.borderWidth === 0} onChange={(v) => set("borderColor", v)} />
            <p className="text-xs text-muted-foreground">
              {t.shape.note}
            </p>
          </Section>

          <Section title={t.shadow.title}>
            <Toggle label={t.shadow.toggle} checked={s.shadow} onChange={(v) => set("shadow", v)} />
            {s.shadow && (
              <>
                <ColorField label={t.shadow.color} value={s.shadowColor} onChange={(v) => set("shadowColor", v)} />
                <Slider label={t.shadow.opacity} value={s.shadowOpacity} min={0} max={100} unit="%" onChange={(v) => set("shadowOpacity", v)} />
                <Slider label={t.shadow.blur} value={s.shadowBlur} min={0} max={20} step={0.5} unit="%" onChange={(v) => set("shadowBlur", v)} />
                <Slider label={t.shadow.offsetY} value={s.shadowOffsetY} min={-10} max={10} step={0.5} unit="%" onChange={(v) => set("shadowOffsetY", v)} />
              </>
            )}
          </Section>

          <Section title={t.small.title(SMALL_MAX)}>
            <Toggle
              label={t.small.toggle}
              hint={t.small.hint}
              checked={s.smallEnabled}
              onChange={(v) => set("smallEnabled", v)}
            />
            {s.smallEnabled && (
              <>
                <Slider label={t.small.size} value={Math.round(s.smallScale * 100)} min={10} max={150} unit="%" onChange={(v) => set("smallScale", v / 100)} />
                <Toggle label={t.small.keepBorder} checked={s.smallBorder} onChange={(v) => set("smallBorder", v)} />
              </>
            )}
          </Section>

          <Section title={t.dark.title}>
            <Toggle
              label={t.dark.toggle}
              hint={t.dark.hint}
              checked={s.darkEnabled}
              onChange={(v) => set("darkEnabled", v)}
            />
            {s.darkEnabled && (
              <>
                <ColorField
                  label={t.dark.bg}
                  value={s.darkBgColor}
                  disabled={s.bgMode === "transparent"}
                  onChange={(v) => set("darkBgColor", v)}
                />
                <ColorField label={t.dark.icon} value={s.darkIconColor} disabled={!s.tint} onChange={(v) => set("darkIconColor", v)} />
                <p className="text-xs text-muted-foreground">
                  {s.bgMode === "transparent" ? t.dark.noBgNote : ""}
                  {!s.tint ? t.dark.needsTintNote : ""}
                  {t.dark.iosNote}
                </p>
              </>
            )}
          </Section>

          <Section title={t.app.title}>
            <div className="space-y-1.5">
              <Label htmlFor="app-name" className="font-normal">
                {t.app.name}
              </Label>
              <Input id="app-name" value={s.appName} onChange={(e) => set("appName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app-short" className="font-normal">
                {t.app.shortName}
              </Label>
              <Input id="app-short" value={s.shortName} onChange={(e) => set("shortName", e.target.value)} />
            </div>
            <ColorField label={t.app.themeColor} value={s.themeColor} onChange={(v) => set("themeColor", v)} />
          </Section>

          <Section
            title={t.pack.title}
            aside={
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setGroups(groups.size === ALL_GROUPS.length ? new Set() : new Set(ALL_GROUPS))}
              >
                {groups.size === ALL_GROUPS.length ? t.pack.deselectAll : t.pack.selectAll}
              </button>
            }
          >
            {GROUPS.map((g) => (
              <div key={g} className="flex items-start gap-2.5">
                <Checkbox
                  id={`grp-${g}`}
                  checked={groups.has(g)}
                  onCheckedChange={(v) => toggleGroup(g, v === true)}
                  className="mt-0.5"
                />
                <label htmlFor={`grp-${g}`} className="text-sm leading-tight">
                  {t.groups[g].label}
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t.groups[g].hint}</span>
                </label>
              </div>
            ))}
          </Section>

          <Section title={t.project.title}>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  downloadBlob(
                    new Blob([JSON.stringify(projectToJson(settings, groups, source), null, 2)], { type: "application/json" }),
                    PROJECT_FILE,
                  );
                  track("download_project", { source_type: sourceType(source) });
                }}
              >
                <FileDown /> {t.project.save}
              </Button>
              <Button type="button" size="sm" variant="secondary" className="flex-1" onClick={() => projectInput.current?.click()}>
                <FileUp /> {t.project.load}
              </Button>
            </div>
            <input
              ref={projectInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t.project.note}
            </p>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSettings({ ...defaults, appName: s.appName, shortName: s.shortName })}
            >
              {t.project.resetDefaults}
            </button>
          </Section>
        </div>

        {/* Na telefonie przycisk przyklejony do dolu ekranu; pr-20 robi miejsce na badge. */}
        <div className="sticky bottom-0 z-10 border-t bg-card p-4 pr-20 lg:static lg:pr-4">
          {error && <p className="mb-2 rounded-md bg-destructive/15 px-3 py-2 text-xs text-destructive">{error}</p>}
          <Button type="button" className="h-10 w-full font-semibold" disabled={!groups.size || !!progress} onClick={download}>
            <Download />
            {progress ? t.download.progress(progress) : t.download.button(fileCount)}
          </Button>
        </div>
      </aside>

      {/* ───────────── Podglad ───────────── */}
      <main className="min-w-0 flex-1 overflow-y-auto lg:h-screen">
        <div className="mx-auto max-w-6xl space-y-8 p-6 pb-24">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex flex-col items-center gap-3">
              <div
                ref={hero}
                className={cn("relative flex h-[320px] w-[320px] items-center justify-center rounded-2xl", PREVIEW_BG[previewBg])}
                onPointerDown={() => setSelected(false)}
              >
                <div className="relative" style={{ width: HERO_SIZE, height: HERO_SIZE }}>
                  <IconCanvas size={512} display={HERO_SIZE} src={source} settings={s} opts={HERO} />
                  {source && (
                    <TransformOverlay
                      size={HERO_SIZE}
                      src={source}
                      s={s}
                      selected={selected}
                      onSelect={() => setSelected(true)}
                      patch={patch}
                    />
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "flex items-center gap-0.5 rounded-lg bg-card p-1 transition-opacity",
                  selected ? "opacity-100" : "opacity-60 hover:opacity-100",
                )}
              >
                <ToolButton label={t.tools.undo} disabled={!history.canUndo} onClick={history.undo}>
                  <Undo2 />
                </ToolButton>
                <ToolButton label={t.tools.redo} disabled={!history.canRedo} onClick={history.redo}>
                  <Redo2 />
                </ToolButton>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolButton label={t.tools.zoomOut} onClick={() => patch((p) => ({ scale: clamp(+(p.scale - 0.05).toFixed(2), 0.1, 1.5) }))}>
                  <ZoomOut />
                </ToolButton>
                <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">{Math.round(s.scale * 100)}%</span>
                <ToolButton label={t.tools.zoomIn} onClick={() => patch((p) => ({ scale: clamp(+(p.scale + 0.05).toFixed(2), 0.1, 1.5) }))}>
                  <ZoomIn />
                </ToolButton>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolButton label={t.tools.rotateLeft} onClick={() => patch((p) => ({ rotation: normDeg(p.rotation - 90) }))}>
                  <RotateCcw />
                </ToolButton>
                <ToolButton label={t.tools.rotateRight} onClick={() => patch((p) => ({ rotation: normDeg(p.rotation + 90) }))}>
                  <RotateCw />
                </ToolButton>
                <ToolButton label={t.tools.flipH} onClick={() => patch((p) => ({ flipX: !p.flipX }))}>
                  <FlipHorizontalIcon className={s.flipX ? "text-primary" : ""} />
                </ToolButton>
                <ToolButton label={t.tools.flipV} onClick={() => patch((p) => ({ flipY: !p.flipY }))}>
                  <FlipVerticalIcon className={s.flipY ? "text-primary" : ""} />
                </ToolButton>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolButton
                  label={t.tools.resetTransform}
                  onClick={() =>
                    patch(() => ({
                      scale: DEFAULT_SETTINGS.scale,
                      alignX: "center",
                      alignY: "center",
                      offsetX: 0,
                      offsetY: 0,
                      rotation: 0,
                      flipX: false,
                      flipY: false,
                    }))
                  }
                >
                  <Crosshair />
                </ToolButton>
              </div>

              <Segmented<PreviewBg>
                value={previewBg}
                onChange={setPreviewBg}
                className="w-full"
                options={[
                  { value: "checker", label: t.preview.checker },
                  { value: "light", label: t.preview.light },
                  { value: "dark", label: t.preview.dark },
                ]}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="text-lg font-semibold">{t.preview.title}</h2>
              <p className="text-sm text-muted-foreground">
                {t.preview.help1}
                <kbd className="font-mono">+</kbd>/<kbd className="font-mono">−</kbd>, <kbd className="font-mono">[</kbd>/
                <kbd className="font-mono">]</kbd>, Esc{t.preview.help2}
              </p>
              <div className="flex flex-wrap items-end gap-4 rounded-xl bg-card p-4">
                {[16, 32, 48, 64, 128].map((size) => (
                  <div key={size} className="flex flex-col items-center gap-1">
                    <IconCanvas size={size} src={source} settings={deferred} opts={HERO} />
                    <span className="text-[10px] text-muted-foreground">{size}px</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Mockups src={source} s={deferred} />

          {GROUPS.map((g) => {
            const items = TARGETS.filter((x) => x.group === g);
            const on = groups.has(g);
            return (
              <section key={g} className={on ? "" : "opacity-50"}>
                <div className="mb-2 flex items-baseline justify-between gap-3 border-b pb-2">
                  <h3 className="text-sm font-semibold">
                    {t.groups[g].label} <span className="font-normal text-muted-foreground">· {items.length}</span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox id={`grid-${g}`} checked={on} onCheckedChange={(v) => toggleGroup(g, v === true)} />
                    <label htmlFor={`grid-${g}`}>{t.pack.inPackage}</label>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-1">
                  {items.map((x) => (
                    <Tile key={x.id} target={x} src={source} s={deferred} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
