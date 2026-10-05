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
  height,
  display,
  src,
  settings,
  opts,
  pixelated,
  className,
  style,
}: {
  size: number;
  /** Wysokosc w px, gdy plotno nie jest kwadratem (ekrany startowe). */
  height?: number;
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
    if (ref.current) paintCanvas(ref.current, size, src, settings, opts, height ?? size);
  }, [size, height, src, settings, opts]);
  // `display` to dluzszy bok w CSS; krotszy wynika z proporcji.
  const d = display ?? Math.max(size, height ?? size);
  const k = d / Math.max(size, height ?? size);
  return (
    <canvas
      ref={ref}
      width={size}
      height={height ?? size}
      className={className}
      style={{ width: size * k, height: (height ?? size) * k, imageRendering: pixelated ? "pixelated" : "auto", ...style }}
    />
  );
}
