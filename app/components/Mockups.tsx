"use client";

import type { ReactNode } from "react";
import type { RenderOptions } from "@/lib/render";
import type { Settings } from "@/lib/settings";
import type { IconSource } from "@/lib/source";
import IconCanvas from "./IconCanvas";

const SHAPE: RenderOptions = { mode: "shape" };
const FULL: RenderOptions = { mode: "fullbleed", opaque: true };
const MASKABLE: RenderOptions = { mode: "fullbleed", inset: 0.8 };
const FG: RenderOptions = { mode: "foreground", inset: 72 / 108 };
const BG: RenderOptions = { mode: "background" };

/** Krzywa ksztaltu ikon iOS jest superelipsa; 22.37% promienia to standardowe przyblizenie. */
const IOS_RADIUS = "22.37%";

function Card({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-xl bg-card">
      <div className="flex flex-1 items-center justify-center">{children}</div>
      <figcaption className="border-t px-3 py-2 text-xs">
        <span className="font-medium">{title}</span>
        {note && <span className="block text-muted-foreground">{note}</span>}
      </figcaption>
    </figure>
  );
}

function Placeholder({ size, radius, color }: { size: number; radius: string; color: string }) {
  return <div style={{ width: size, height: size, borderRadius: radius, background: color }} />;
}

/** Adaptive icon: warstwy 108 dp przyciete maska do widocznych 72 dp. */
function Adaptive({ src, s, size, radius }: { src: IconSource | null; s: Settings; size: number; radius: string }) {
  const full = (size * 108) / 72;
  const off = -(full - size) / 2;
  return (
    <div className="relative overflow-hidden shadow-md" style={{ width: size, height: size, borderRadius: radius }}>
      <IconCanvas size={216} display={full} src={src} settings={s} opts={BG} className="absolute" style={{ left: off, top: off }} />
      <IconCanvas size={216} display={full} src={src} settings={s} opts={FG} className="absolute" style={{ left: off, top: off }} />
    </div>
  );
}

export default function Mockups({ src, s }: { src: IconSource | null; s: Settings }) {
  const name = s.shortName || "Aplikacja";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card title="Karta przeglądarki" note="favicon 16 px (32 px na ekranach HiDPI)">
        <div className="w-full bg-[#0f0f0f] px-3 pt-6">
          <div className="flex max-w-[220px] items-center gap-2 rounded-t-lg bg-[#2b2b2b] px-3 py-2">
            <IconCanvas size={32} display={16} src={src} settings={s} opts={SHAPE} />
            <span className="truncate text-xs text-zinc-200">{s.appName || "Moja strona"}</span>
            <span className="ml-auto text-xs text-zinc-500">×</span>
          </div>
          <div className="h-10 bg-[#2b2b2b]" />
        </div>
      </Card>

      <Card title="Ekran iOS" note="apple-touch-icon / AppIcon, maska nakładana przez system">
        <div className="grid w-full grid-cols-3 justify-items-center gap-3 bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 px-4 py-5">
          <Placeholder size={52} radius={IOS_RADIUS} color="rgba(255,255,255,.35)" />
          <div className="flex flex-col items-center gap-1">
            <IconCanvas size={180} display={52} src={src} settings={s} opts={FULL} style={{ borderRadius: IOS_RADIUS }} className="shadow-md" />
            <span className="max-w-[64px] truncate text-[10px] text-white">{name}</span>
          </div>
          <Placeholder size={52} radius={IOS_RADIUS} color="rgba(255,255,255,.35)" />
        </div>
      </Card>

      <Card title="Android (adaptive)" note="ta sama ikona w masce koła i squircle">
        <div className="flex w-full items-center justify-center gap-5 bg-[#121212] px-4 py-5">
          <div className="flex flex-col items-center gap-1">
            <Adaptive src={src} s={s} size={52} radius="50%" />
            <span className="max-w-[64px] truncate text-[10px] text-white">{name}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Adaptive src={src} s={s} size={52} radius="30%" />
            <span className="max-w-[64px] truncate text-[10px] text-white">{name}</span>
          </div>
        </div>
      </Card>

      <Card title="PWA maskable" note="przerywane koło = strefa bezpieczna 80%">
        <div className="flex w-full items-center justify-center gap-5 bg-[#1a1a1a] px-4 py-5">
          <div className="relative">
            <IconCanvas size={192} display={64} src={src} settings={s} opts={MASKABLE} />
            <div className="pointer-events-none absolute inset-[10%] rounded-full border border-dashed border-white/90 mix-blend-difference" />
          </div>
          <IconCanvas size={192} display={64} src={src} settings={s} opts={MASKABLE} style={{ borderRadius: "50%" }} className="shadow-md" />
        </div>
      </Card>
    </div>
  );
}
