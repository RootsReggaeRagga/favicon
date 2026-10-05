"use client";

import { useMemo, type ReactNode } from "react";
import type { RenderOptions } from "@/lib/render";
import type { Settings } from "@/lib/settings";
import type { IconSource } from "@/lib/source";
import { NOTIFICATION } from "@/lib/targets";
import IconCanvas from "./IconCanvas";

const SHAPE: RenderOptions = { mode: "shape" };
const FULL: RenderOptions = { mode: "fullbleed", opaque: true };
const MASKABLE: RenderOptions = { mode: "fullbleed", inset: 0.8 };
const FG: RenderOptions = { mode: "foreground", inset: 72 / 108 };
const BG: RenderOptions = { mode: "background" };
const IOS_DARK: RenderOptions = { mode: "dark" };
const IOS_TINTED: RenderOptions = { mode: "tinted", opaque: true };
/** Kolor, ktorym w makiecie "zabarwiamy" wariant tinted — w iOS wybiera go uzytkownik. */
const TINT_DEMO = "#f6b900";

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

function Tab({ src, s, opts, dark, title }: { src: IconSource | null; s: Settings; opts: RenderOptions; dark: boolean; title: string }) {
  return (
    <div className={`w-full px-3 pt-4 ${dark ? "bg-[#0f0f0f]" : "bg-[#dfe1e5]"}`}>
      <div className={`flex max-w-[220px] items-center gap-2 rounded-t-lg px-3 py-2 ${dark ? "bg-[#2b2b2b]" : "bg-white"}`}>
        <IconCanvas size={32} display={16} src={src} settings={s} opts={opts} />
        <span className={`truncate text-xs ${dark ? "text-zinc-200" : "text-zinc-800"}`}>{title}</span>
        <span className="ml-auto text-xs text-zinc-500">×</span>
      </div>
      <div className={`h-5 ${dark ? "bg-[#2b2b2b]" : "bg-white"}`} />
    </div>
  );
}

export default function Mockups({ src, s }: { src: IconSource | null; s: Settings }) {
  const name = s.shortName || "Aplikacja";
  // Podglad wariantu ciemnego favicon.svg: te same reguly co w buildSvg —
  // tlo jednolite w kolorze ciemnym (o ile w ogole jest tlo), ikonka w kolorze ciemnym.
  const darkTab = useMemo<RenderOptions>(
    () => ({
      mode: "shape",
      override: s.darkEnabled
        ? {
            bgMode: s.bgMode === "transparent" ? "transparent" : "solid",
            bgColor: s.darkBgColor,
            iconColor: s.tint ? s.darkIconColor : s.iconColor,
          }
        : undefined,
    }),
    [s.darkEnabled, s.bgMode, s.darkBgColor, s.darkIconColor, s.tint, s.iconColor],
  );
  const title = s.appName || "Moja strona";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card
        title="Karta przeglądarki"
        note={s.darkEnabled ? "favicon w motywie jasnym i ciemnym (favicon.svg)" : "favicon 16 px (32 px na ekranach HiDPI)"}
      >
        <div className="w-full">
          <Tab src={src} s={s} opts={SHAPE} dark={false} title={title} />
          <Tab src={src} s={s} opts={darkTab} dark title={title} />
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

      <Card title="iOS 18" note="jasna · ciemna · tinted (kolor wybiera użytkownik)">
        <div className="flex w-full items-center justify-center gap-4 bg-[#0b0b0f] px-4 py-5">
          <IconCanvas size={180} display={52} src={src} settings={s} opts={FULL} style={{ borderRadius: IOS_RADIUS }} />
          {/* Tlo trybu ciemnego dokłada system — tu jego przyblizenie. */}
          <div className="overflow-hidden bg-gradient-to-b from-[#3a3a3c] to-[#1c1c1e]" style={{ borderRadius: IOS_RADIUS }}>
            <IconCanvas size={180} display={52} src={src} settings={s} opts={IOS_DARK} />
          </div>
          {/* Tinted: skala szarosci przemnozona przez kolor wybrany w systemie. */}
          <div className="overflow-hidden" style={{ borderRadius: IOS_RADIUS, background: TINT_DEMO }}>
            <IconCanvas size={180} display={52} src={src} settings={s} opts={IOS_TINTED} style={{ mixBlendMode: "multiply" }} />
          </div>
        </div>
      </Card>

      <Card title="Powiadomienie Android" note="ic_stat_notification — biała sylwetka">
        <div className="w-full bg-[#121212] px-4 py-3">
          <div className="mb-3 flex items-center gap-1.5 text-[10px] text-zinc-300">
            <span>12:30</span>
            <IconCanvas size={48} display={14} src={src} settings={s} opts={NOTIFICATION} />
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-[#2a2a2a] px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: s.themeColor }}>
              <IconCanvas size={48} display={18} src={src} settings={s} opts={NOTIFICATION} />
            </div>
            <div className="min-w-0 text-[11px] leading-tight">
              <div className="truncate font-medium text-zinc-100">{name}</div>
              <div className="truncate text-zinc-400">Nowa wiadomość</div>
            </div>
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
