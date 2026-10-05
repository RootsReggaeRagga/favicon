"use client";

import {
  Crosshair,
  Download,
  ImageUp,
  RotateCcw,
  RotateCw,
  // Lucide 1.x nazywa ikony od osi: pionowa linia = odbicie lewo/prawo.
  TrianglesCenterlineDashedHorizontal as FlipVerticalIcon,
  TrianglesCenterlineDashedVertical as FlipHorizontalIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildPackage, downloadBlob, exportTarget } from "@/lib/package";
import type { RenderOptions } from "@/lib/render";
import { DEFAULT_SETTINGS, GROUPS, type Align, type BgMode, type GroupId, type Settings } from "@/lib/settings";
import {
  SAMPLE_SVG,
  sourceFromDataUrl,
  sourceFromFile,
  sourceFromSvgText,
  type IconSource,
} from "@/lib/source";
import { TARGETS, type Target } from "@/lib/targets";
import { cn } from "@/lib/utils";
import { ColorField, Section, Segmented, Slider, Toggle } from "./controls";
import IconCanvas from "./IconCanvas";
import Mockups from "./Mockups";
import TransformOverlay from "./TransformOverlay";

const STORAGE_KEY = "brewcode-favicon:v1";
/** Wiekszego zrodla nie zapisujemy — localStorage ma zwykle ~5 MB na domene. */
const MAX_STORED_SOURCE = 2_000_000;

interface Stored {
  settings: Settings;
  groups: GroupId[];
  source?: { kind: "svg" | "png"; name: string; data: string };
}

const HERO: RenderOptions = { mode: "shape" };
const HERO_SIZE = 256;
const ALL_GROUPS = GROUPS.map((g) => g.id);

const RADIUS_PRESETS = [
  { label: "Kwadrat", value: 0 },
  { label: "Lekki", value: 12 },
  { label: "iOS", value: 22 },
  { label: "Koło", value: 50 },
];

type PreviewBg = "checker" | "light" | "dark";
const CHECKER = "bg-[conic-gradient(#2c2c2c_25%,#232323_0_50%,#2c2c2c_0_75%,#232323_0)] bg-[length:20px_20px]";
const PREVIEW_BG: Record<PreviewBg, string> = {
  checker: CHECKER,
  light: "bg-white",
  dark: "bg-black",
};

const ALIGNS: Align[] = ["start", "center", "end"];
const ALIGN_LABEL = {
  x: { start: "Lewo", center: "Środek", end: "Prawo" } as Record<Align, string>,
  y: { start: "Góra", center: "Środek", end: "Dół" } as Record<Align, string>,
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const normDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

function AlignGrid({ x, y, onChange }: { x: Align; y: Align; onChange: (x: Align, y: Align) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={`${x}:${y}`}
      onValueChange={(v) => {
        if (!v) return;
        const [ax, ay] = v.split(":") as [Align, Align];
        onChange(ax, ay);
      }}
      aria-label="Wyrównanie"
      className="grid w-[88px] shrink-0 grid-cols-3 gap-1 p-1"
    >
      {ALIGNS.map((ay) =>
        ALIGNS.map((ax) => (
          <ToggleGroupItem
            key={`${ax}:${ay}`}
            value={`${ax}:${ay}`}
            title={`${ALIGN_LABEL.x[ax]} · ${ALIGN_LABEL.y[ay]}`}
            aria-label={`${ALIGN_LABEL.x[ax]} · ${ALIGN_LABEL.y[ay]}`}
            className="group h-6 px-0 data-[state=on]:bg-primary"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 group-data-[state=on]:bg-primary-foreground" />
          </ToggleGroupItem>
        )),
      )}
    </ToggleGroup>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title={label} aria-label={label} onClick={onClick}>
      {children}
    </Button>
  );
}

function Tile({ target, src, s }: { target: Target; src: IconSource | null; s: Settings }) {
  const render = Math.min(target.size, 256);
  const display = Math.max(32, Math.min(target.size, 96));
  const [busy, setBusy] = useState(false);
  const name = target.path.split("/").pop()!;
  return (
    <button
      type="button"
      title={`Pobierz ${target.path}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          downloadBlob(await exportTarget(target, src, s), name);
        } finally {
          setBusy(false);
        }
      }}
      className="group flex flex-col items-center gap-2 rounded-lg p-2 text-center transition-colors hover:bg-card"
    >
      <div className={cn("relative flex h-[104px] w-[104px] items-center justify-center rounded-md", CHECKER)}>
        <IconCanvas size={render} display={display} src={src} settings={s} opts={target.opts} pixelated={target.size < display} />
        <Download className="absolute right-1.5 bottom-1.5 h-3.5 w-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <span className="text-xs font-medium">{target.label}</span>
      <span className="max-w-[120px] truncate font-mono text-[10px] text-muted-foreground group-hover:text-primary">
        {busy ? "…" : name}
      </span>
    </button>
  );
}

export default function Generator() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [source, setSource] = useState<IconSource | null>(null);
  const [groups, setGroups] = useState<Set<GroupId>>(new Set(ALL_GROUPS));
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewBg, setPreviewBg] = useState<PreviewBg>("checker");
  const [selected, setSelected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const hero = useRef<HTMLDivElement>(null);

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
      if (stored?.settings) setSettings({ ...DEFAULT_SETTINGS, ...stored.settings });
      if (stored?.groups) setGroups(new Set(stored.groups));
      try {
        const s = stored?.source;
        if (s) setSource(s.kind === "svg" ? await sourceFromSvgText(s.data, s.name) : await sourceFromDataUrl(s.data, s.name));
        else setSource(await sourceFromSvgText(SAMPLE_SVG, "przykład.svg"));
      } catch {
        setSource(await sourceFromSvgText(SAMPLE_SVG, "przykład.svg"));
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const data: Stored = { settings, groups: [...groups] };
    if (source && source.data.length < MAX_STORED_SOURCE) {
      data.source = { kind: source.kind, name: source.name, data: source.data };
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [settings, groups, source, loaded]);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const src = await sourceFromFile(file);
      setSource(src);
      // Raster zwykle ma juz wlasne kolory — przebarwienie wlaczamy tylko dla SVG.
      setSettings((prev) => ({ ...prev, tint: src.kind === "svg" ? prev.tint : false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

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
    setProgress("Generowanie…");
    try {
      const blob = await buildPackage(groups, source, settings, (done, total) => setProgress(`${done}/${total}`));
      downloadBlob(blob, "icons.zip");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
  const fileCount = TARGETS.filter((t) => groups.has(t.group)).length;

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
            <h1 className="text-sm font-semibold">Generator ikon</h1>
            <p className="text-xs text-muted-foreground">favicon · app icon · PWA · Android · iOS</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Section title="Ikona źródłowa">
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border-2 border-dashed p-2.5 transition-colors",
                dragOver ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={selectIcon}
                title="Zaznacz ikonkę na podglądzie — pokaże uchwyty przekształceń"
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-md ring-offset-2 ring-offset-card transition-shadow",
                  CHECKER,
                  selected ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-primary/60",
                )}
              >
                {source && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={source.image.src} alt="" className="max-h-10 max-w-10 object-contain" />
                )}
              </button>
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-medium">{source?.name ?? "Brak pliku"}</div>
                <div className="text-xs text-muted-foreground">Upuść lub wklej (Ctrl+V)</div>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                <ImageUp /> Zmień
              </Button>
            </div>
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
            {source && (
              <p className="text-xs text-muted-foreground">
                {source.kind === "svg" ? "Wektor" : "Raster"} · {Math.round(source.width)}×{Math.round(source.height)}
                {source.kind === "png" && source.width < 512 && (
                  <span className="text-primary"> · mała rozdzielczość, duże rozmiary będą rozmyte</span>
                )}
              </p>
            )}
          </Section>

          <Section
            title="Pozycja"
            aside={
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  patch(() => ({ alignX: "center", alignY: "center", offsetX: 0, offsetY: 0, rotation: 0, flipX: false, flipY: false }))
                }
              >
                Wyśrodkuj
              </button>
            }
          >
            <div className="flex items-center gap-4">
              <AlignGrid x={s.alignX} y={s.alignY} onChange={(x, y) => patch(() => ({ alignX: x, alignY: y, offsetX: 0, offsetY: 0 }))} />
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="text-sm text-foreground">
                  {ALIGN_LABEL.x[s.alignX]} · {ALIGN_LABEL.y[s.alignY]}
                </div>
                {(s.offsetX !== 0 || s.offsetY !== 0) && (
                  <button type="button" className="text-primary hover:underline" onClick={() => patch(() => ({ offsetX: 0, offsetY: 0 }))}>
                    Usuń ręczne przesunięcie
                  </button>
                )}
                <div>Kliknij ikonkę na podglądzie, by ją przesuwać, skalować i obracać.</div>
              </div>
            </div>
            <Slider label="Rozmiar" value={Math.round(s.scale * 100)} min={10} max={150} unit="%" onChange={(v) => set("scale", v / 100)} />
            <Slider
              label="Odstęp od krawędzi"
              value={s.margin}
              min={0}
              max={40}
              step={0.5}
              unit="%"
              disabled={s.alignX === "center" && s.alignY === "center"}
              onChange={(v) => set("margin", v)}
            />
            <Slider label="Obrót" value={s.rotation} min={-180} max={180} unit="°" onChange={(v) => set("rotation", v)} />
          </Section>

          <Section title="Tło">
            <Segmented<BgMode>
              value={s.bgMode}
              onChange={(v) => set("bgMode", v)}
              options={[
                { value: "solid", label: "Kolor" },
                { value: "gradient", label: "Gradient" },
                { value: "transparent", label: "Brak" },
              ]}
            />
            {s.bgMode !== "transparent" && (
              <ColorField label={s.bgMode === "gradient" ? "Kolor 1" : "Kolor tła"} value={s.bgColor} onChange={(v) => set("bgColor", v)} />
            )}
            {s.bgMode === "gradient" && (
              <>
                <ColorField label="Kolor 2" value={s.bgColor2} onChange={(v) => set("bgColor2", v)} />
                <Slider label="Kąt" value={s.bgAngle} min={0} max={360} unit="°" onChange={(v) => set("bgAngle", v)} />
              </>
            )}
            {s.bgMode === "transparent" && (
              <p className="text-xs text-muted-foreground">
                iOS, App Store i Google Play nie przyjmują przezroczystości — tam tło będzie białe.
              </p>
            )}
          </Section>

          <Section title="Kolor ikonki">
            <Toggle
              label="Przebarwij ikonkę"
              hint={source?.kind === "png" ? "Raster: kolor nakładany na kształt (kanał alfa)" : "Jeden kolor dla całego SVG"}
              checked={s.tint}
              onChange={(v) => set("tint", v)}
            />
            <ColorField label="Kolor" value={s.iconColor} disabled={!s.tint} onChange={(v) => set("iconColor", v)} />
          </Section>

          <Section title="Kształt">
            <Slider label="Zaokrąglenie" value={s.radius} min={0} max={50} step={0.5} unit="%" onChange={(v) => set("radius", v)} />
            <Segmented<string>
              value={String(s.radius)}
              onChange={(v) => set("radius", Number(v))}
              options={RADIUS_PRESETS.map((p) => ({ value: String(p.value), label: <span className="text-xs">{p.label}</span> }))}
            />
            <Slider label="Obramowanie" value={s.borderWidth} min={0} max={20} step={0.5} unit="%" onChange={(v) => set("borderWidth", v)} />
            <ColorField label="Kolor obramowania" value={s.borderColor} disabled={s.borderWidth === 0} onChange={(v) => set("borderColor", v)} />
            <p className="text-xs text-muted-foreground">
              Zaokrąglenie i ramka dotyczą favicon, PWA „any”, ikon ogólnych i launchera Androida. iOS, App Store,
              Google Play i maskable dostają pełny kwadrat — maskę nakłada system.
            </p>
          </Section>

          <Section title="Aplikacja">
            <div className="space-y-1.5">
              <Label htmlFor="app-name" className="font-normal">
                Nazwa
              </Label>
              <Input id="app-name" value={s.appName} onChange={(e) => set("appName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app-short" className="font-normal">
                Nazwa krótka
              </Label>
              <Input id="app-short" value={s.shortName} onChange={(e) => set("shortName", e.target.value)} />
            </div>
            <ColorField label="Theme color" value={s.themeColor} onChange={(v) => set("themeColor", v)} />
          </Section>

          <Section
            title="Paczka"
            aside={
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setGroups(groups.size === ALL_GROUPS.length ? new Set() : new Set(ALL_GROUPS))}
              >
                {groups.size === ALL_GROUPS.length ? "Odznacz" : "Zaznacz"} wszystko
              </button>
            }
          >
            {GROUPS.map((g) => (
              <div key={g.id} className="flex items-start gap-2.5">
                <Checkbox
                  id={`grp-${g.id}`}
                  checked={groups.has(g.id)}
                  onCheckedChange={(v) => toggleGroup(g.id, v === true)}
                  className="mt-0.5"
                />
                <label htmlFor={`grp-${g.id}`} className="text-sm leading-tight">
                  {g.label}
                  <span className="mt-0.5 block text-xs text-muted-foreground">{g.hint}</span>
                </label>
              </div>
            ))}
          </Section>

          <div className="px-5 pb-4">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSettings({ ...DEFAULT_SETTINGS, appName: s.appName, shortName: s.shortName })}
            >
              Przywróć domyślne ustawienia
            </button>
          </div>
        </div>

        <div className="border-t p-4">
          {error && <p className="mb-2 rounded-md bg-destructive/15 px-3 py-2 text-xs text-destructive">{error}</p>}
          <Button type="button" className="h-10 w-full font-semibold" disabled={!groups.size || !!progress} onClick={download}>
            <Download />
            {progress ? `Generowanie ${progress}` : `Pobierz paczkę ZIP (${fileCount} ikon)`}
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
                <ToolButton label="Pomniejsz (−)" onClick={() => patch((p) => ({ scale: clamp(+(p.scale - 0.05).toFixed(2), 0.1, 1.5) }))}>
                  <ZoomOut />
                </ToolButton>
                <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">{Math.round(s.scale * 100)}%</span>
                <ToolButton label="Powiększ (+)" onClick={() => patch((p) => ({ scale: clamp(+(p.scale + 0.05).toFixed(2), 0.1, 1.5) }))}>
                  <ZoomIn />
                </ToolButton>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolButton label="Obróć w lewo o 90°" onClick={() => patch((p) => ({ rotation: normDeg(p.rotation - 90) }))}>
                  <RotateCcw />
                </ToolButton>
                <ToolButton label="Obróć w prawo o 90°" onClick={() => patch((p) => ({ rotation: normDeg(p.rotation + 90) }))}>
                  <RotateCw />
                </ToolButton>
                <ToolButton label="Odbij w poziomie" onClick={() => patch((p) => ({ flipX: !p.flipX }))}>
                  <FlipHorizontalIcon className={s.flipX ? "text-primary" : ""} />
                </ToolButton>
                <ToolButton label="Odbij w pionie" onClick={() => patch((p) => ({ flipY: !p.flipY }))}>
                  <FlipVerticalIcon className={s.flipY ? "text-primary" : ""} />
                </ToolButton>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolButton
                  label="Resetuj przekształcenia"
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
                  { value: "checker", label: "Szachownica" },
                  { value: "light", label: "Jasne" },
                  { value: "dark", label: "Czarne" },
                ]}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="text-lg font-semibold">Podgląd</h2>
              <p className="text-sm text-muted-foreground">
                Kliknij ikonkę, żeby ją zaznaczyć: przeciągnij, by przesunąć, narożniki skalują, uchwyt u góry obraca
                (Shift — co 15°). Z klawiatury: strzałki, <kbd className="font-mono">+</kbd>/<kbd className="font-mono">−</kbd>,{" "}
                <kbd className="font-mono">[</kbd>/<kbd className="font-mono">]</kbd>, Esc. Kliknięcie kafelka poniżej pobiera
                pojedynczy plik.
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
            const items = TARGETS.filter((t) => t.group === g.id);
            const on = groups.has(g.id);
            return (
              <section key={g.id} className={on ? "" : "opacity-50"}>
                <div className="mb-2 flex items-baseline justify-between gap-3 border-b pb-2">
                  <h3 className="text-sm font-semibold">
                    {g.label} <span className="font-normal text-muted-foreground">· {items.length}</span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox id={`grid-${g.id}`} checked={on} onCheckedChange={(v) => toggleGroup(g.id, v === true)} />
                    <label htmlFor={`grid-${g.id}`}>w paczce</label>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-1">
                  {items.map((t) => (
                    <Tile key={t.id} target={t} src={source} s={deferred} />
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
