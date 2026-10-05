"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { paintCanvas, type RenderOptions } from "@/lib/render";
import type { Settings } from "@/lib/settings";
import type { IconSource } from "@/lib/source";

/**
 * Canvas renderujacy ikonke w zadanej rozdzielczosci pikselowej. `display`
 * to rozmiar w CSS — male rozmiary (16, 32) celowo powiekszamy bez
 * wygladzania, zeby bylo widac, jak naprawde wyglada kazdy piksel.
 */
export default function IconCanvas({
  size,
  display,
  src,
  settings,
  opts,
  pixelated,
  className,
  style,
}: {
  size: number;
  display?: number;
  src: IconSource | null;
  settings: Settings;
  opts: RenderOptions;
  pixelated?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintCanvas(ref.current, size, src, settings, opts);
  }, [size, src, settings, opts]);
  const d = display ?? size;
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={className}
      style={{ width: d, height: d, imageRendering: pixelated ? "pixelated" : "auto", ...style }}
    />
  );
}
