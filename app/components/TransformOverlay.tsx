"use client";

import { useRef, type PointerEvent as RPointerEvent } from "react";
import { iconBox } from "@/lib/render";
import type { Settings } from "@/lib/settings";
import type { IconSource } from "@/lib/source";
import { cn } from "@/lib/utils";

type Patch = (fn: (prev: Settings) => Partial<Settings>) => void;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const SCALE_MIN = 0.1;
const SCALE_MAX = 1.5;

/** Obrot do zakresu -180..180, jak suwak w sidebarze. */
const normDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

type Drag =
  | { kind: "move"; x: number; y: number; ox: number; oy: number }
  | { kind: "scale"; cx: number; cy: number; d0: number; s0: number }
  | { kind: "rotate"; cx: number; cy: number };

/**
 * Ramka przeksztalcen nad duzym podgladem, jak w edytorze grafiki:
 * przeciaganie srodka przesuwa, narozniki skaluja (rowno, od srodka),
 * uchwyt nad ramka obraca (z Shiftem co 15°).
 *
 * `size` to bok podgladu w pikselach CSS — geometria ramki liczona jest tym
 * samym `iconBox`, ktorym renderer rysuje ikonke, wiec ramka trzyma sie
 * dokladnie jej obrysu takze przy wyrownaniu do krawedzi.
 */
export default function TransformOverlay({
  size,
  src,
  s,
  selected,
  onSelect,
  patch,
}: {
  size: number;
  src: IconSource;
  s: Settings;
  selected: boolean;
  onSelect: () => void;
  patch: Patch;
}) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const { w, h, cx, cy } = iconBox(src, s, size, 1);

  const center = () => {
    const r = root.current!.getBoundingClientRect();
    return { x: r.left + cx, y: r.top + cy };
  };

  const start = (e: RPointerEvent<HTMLElement>, kind: Drag["kind"]) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const c = center();
    if (kind === "move") drag.current = { kind, x: e.clientX, y: e.clientY, ox: s.offsetX, oy: s.offsetY };
    else if (kind === "scale")
      drag.current = { kind, cx: c.x, cy: c.y, d0: Math.max(1, Math.hypot(e.clientX - c.x, e.clientY - c.y)), s0: s.scale };
    else drag.current = { kind, cx: c.x, cy: c.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "move") {
      const step = (v: number) => clamp(Math.round(v * 2) / 2, -50, 50);
      patch(() => ({
        offsetX: step(d.ox + ((e.clientX - d.x) / size) * 100),
        offsetY: step(d.oy + ((e.clientY - d.y) / size) * 100),
      }));
    } else if (d.kind === "scale") {
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
      patch(() => ({ scale: clamp(Math.round(d.s0 * (dist / d.d0) * 100) / 100, SCALE_MIN, SCALE_MAX) }));
    } else {
      // Uchwyt siedzi nad ramka (lokalnie wektor (0,-1)). Odbicie jest
      // nakladane po obrocie, wiec kierunek kursora najpierw "odbijamy"
      // z powrotem, a dopiero potem liczymy kat jak dla (sin θ, -cos θ).
      const vx = (e.clientX - d.cx) * (s.flipX ? -1 : 1);
      const vy = (e.clientY - d.cy) * (s.flipY ? -1 : 1);
      let deg = (Math.atan2(vx, -vy) * 180) / Math.PI;
      deg = e.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
      patch(() => ({ rotation: normDeg(deg) }));
    }
  };

  const end = () => {
    drag.current = null;
  };

  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  const corner = "absolute h-3 w-3 rounded-[3px] border-2 border-primary bg-background shadow";

  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      <div
        className="pointer-events-none absolute"
        style={{
          left: cx - w / 2,
          top: cy - h / 2,
          width: w,
          height: h,
          // Ta sama kolejnosc co w rendererze: odbicie, potem obrot.
          transform: `scale(${s.flipX ? -1 : 1}, ${s.flipY ? -1 : 1}) rotate(${s.rotation}deg)`,
        }}
      >
        {/* Obszar ikonki: klik zaznacza, przeciaganie przesuwa. */}
        <div
          role="button"
          tabIndex={-1}
          aria-label="Ikonka — przeciągnij, aby przesunąć"
          className={cn(
            "pointer-events-auto absolute inset-0 touch-none rounded-sm",
            selected
              ? "cursor-move outline-2 outline-primary"
              : "cursor-pointer hover:outline-1 hover:outline-dashed hover:outline-primary/70",
          )}
          onPointerDown={(e) => start(e, "move")}
          {...handlers}
        />
        {selected && (
          <>
            {(
              [
                ["-left-1.5 -top-1.5", "cursor-nwse-resize"],
                ["-right-1.5 -top-1.5", "cursor-nesw-resize"],
                ["-left-1.5 -bottom-1.5", "cursor-nesw-resize"],
                ["-right-1.5 -bottom-1.5", "cursor-nwse-resize"],
              ] as const
            ).map(([pos, cur]) => (
              <span
                key={pos}
                aria-label="Skaluj"
                className={cn(corner, pos, cur, "pointer-events-auto touch-none")}
                onPointerDown={(e) => start(e, "scale")}
                {...handlers}
              />
            ))}
            <span className="absolute -top-7 left-1/2 h-5 w-px -translate-x-1/2 bg-primary" />
            <span
              aria-label="Obróć"
              title="Obróć (Shift: co 15°)"
              className="pointer-events-auto absolute -top-9 left-1/2 h-4 w-4 -translate-x-1/2 cursor-grab touch-none rounded-full border-2 border-primary bg-background shadow active:cursor-grabbing"
              onPointerDown={(e) => start(e, "rotate")}
              {...handlers}
            />
          </>
        )}
      </div>
    </div>
  );
}
