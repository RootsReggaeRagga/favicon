import type { Align, Settings } from "./settings";
import type { IconSource } from "./source";

/**
 * Jak dany cel interpretuje ustawienia:
 *  - shape      ksztalt uzytkownika: zaokraglenie, obramowanie, przezroczyste rogi,
 *  - round      jak shape, ale zawsze kolo (Android ic_launcher_round),
 *  - fullbleed  pelny kwadrat bez rogow i ramki — platforma naklada maske sama
 *               (iOS, App Store, Google Play, PWA maskable),
 *  - foreground sama ikonka na przezroczystym tle (warstwa adaptive icon),
 *  - background samo tlo (warstwa adaptive icon),
 *  - monochrome sylwetka ikonki w jednym kolorze (Android 13 themed icon).
 */
export type RenderMode = "shape" | "round" | "fullbleed" | "foreground" | "background" | "monochrome";

export interface RenderOptions {
  mode: RenderMode;
  /**
   * Skala zawartosci wzgledem plotna. Uzywana do safe zone: maskable PWA trzyma
   * tresc w kole 80%, warstwa adaptive icon Androida pokazuje 72 z 108 dp.
   */
  inset?: number;
  /** Cel nie moze miec przezroczystosci (App Store odrzuca kanal alfa). */
  opaque?: boolean;
  /** Ksztalt zajmuje tylko srodek plotna (macOS: 824 z 1024 px), reszta przezroczysta. */
  pad?: number;
}

const OPAQUE_FALLBACK = "#ffffff";

export function gradientPoints(size: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (size / 2) * (Math.abs(dx) + Math.abs(dy));
  const c = size / 2;
  return { x1: c - dx * half, y1: c - dy * half, x2: c + dx * half, y2: c + dy * half };
}

function radiusPx(s: Settings, size: number, mode: RenderMode) {
  if (mode === "round") return size / 2;
  if (mode === "shape") return (Math.min(50, Math.max(0, s.radius)) / 100) * size;
  return 0;
}

function hasBorder(s: Settings, mode: RenderMode) {
  return (mode === "shape" || mode === "round") && s.borderWidth > 0;
}

/** Prostokat ikonki (przed obrotem) wpisany w pole scale×inset z zachowaniem proporcji. */
export function iconBox(src: IconSource, s: Settings, size: number, inset: number) {
  const box = size * s.scale * inset;
  const ratio = src.width / src.height;
  const w = ratio >= 1 ? box : box * ratio;
  const h = ratio >= 1 ? box / ratio : box;
  // Wyrownanie liczone w polu tresci (size×inset), zeby safe zone maskable
  // i adaptive icon nadal trzymaly ikonke w widocznym obszarze.
  const area = size * inset;
  const a0 = (size - area) / 2;
  const m = (s.margin / 100) * area;
  const place = (align: Align, len: number) =>
    align === "start" ? a0 + m + len / 2 : align === "end" ? a0 + area - m - len / 2 : size / 2;
  const cx = place(s.alignX, w) + (s.offsetX / 100) * area;
  const cy = place(s.alignY, h) + (s.offsetY / 100) * area;
  return { w, h, cx, cy };
}

function tinted(src: IconSource, w: number, h: number, color: string): CanvasImageSource {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src.image, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  size: number,
  src: IconSource | null,
  s: Settings,
  opts: RenderOptions,
) {
  const { mode } = opts;
  const inset = opts.inset ?? 1;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const r = radiusPx(s, size, mode);
  const shapePath = () => {
    ctx.beginPath();
    if (r > 0) ctx.roundRect(0, 0, size, size, r);
    else ctx.rect(0, 0, size, size);
  };

  shapePath();
  ctx.clip();

  // Tlo
  if (mode !== "foreground" && mode !== "monochrome") {
    let fill: string | CanvasGradient | null = null;
    if (s.bgMode === "solid") fill = s.bgColor;
    else if (s.bgMode === "gradient") {
      const p = gradientPoints(size, s.bgAngle);
      const g = ctx.createLinearGradient(p.x1, p.y1, p.x2, p.y2);
      g.addColorStop(0, s.bgColor);
      g.addColorStop(1, s.bgColor2);
      fill = g;
    } else if (opts.opaque) fill = OPAQUE_FALLBACK;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, size, size);
    }
  }

  // Ikonka
  if (src && mode !== "background") {
    const { w, h, cx, cy } = iconBox(src, s, size, inset);
    const color = mode === "monochrome" ? "#ffffff" : s.tint ? s.iconColor : null;
    const img = color ? tinted(src, w * 2, h * 2, color) : src.image;
    ctx.save();
    ctx.translate(cx, cy);
    // Odbicie przed obrotem, czyli w ukladzie ekranu: "w poziomie" zawsze
    // znaczy lewo/prawo, niezaleznie od tego, o ile ikonka jest obrocona.
    ctx.scale(s.flipX ? -1 : 1, s.flipY ? -1 : 1);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // Obramowanie — rysowane do srodka, zeby nie wychodzilo poza ksztalt.
  if (hasBorder(s, mode)) {
    const bw = (s.borderWidth / 100) * size;
    ctx.beginPath();
    const ir = Math.max(0, r - bw / 2);
    ctx.roundRect(bw / 2, bw / 2, size - bw, size - bw, ir);
    ctx.lineWidth = bw;
    ctx.strokeStyle = s.borderColor;
    ctx.stroke();
  }
  ctx.restore();
}

export function renderCanvas(size: number, src: IconSource | null, s: Settings, opts: RenderOptions) {
  return paintCanvas(document.createElement("canvas"), size, src, s, opts);
}

export function paintCanvas(
  c: HTMLCanvasElement,
  size: number,
  src: IconSource | null,
  s: Settings,
  opts: RenderOptions,
) {
  if (c.width !== size) c.width = size;
  if (c.height !== size) c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (opts.pad && opts.pad < 1) {
    const inner = size * opts.pad;
    ctx.translate((size - inner) / 2, (size - inner) / 2);
    drawIcon(ctx, inner, src, s, opts);
  } else drawIcon(ctx, size, src, s, opts);
  return c;
}

/* ───────────────────────────── SVG ───────────────────────────── */

const esc = (v: string) => v.replace(/[<>&"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const n = (v: number) => +v.toFixed(3);

/**
 * Wektorowy odpowiednik `drawIcon` w trybie `shape`. Zrodlo SVG jest
 * wstawiane inline jako zagniezdzony <svg> (favicon SVG w przegladarce dziala
 * w trybie "secure static" — zewnetrzne zasoby i tak by sie nie zaladowaly),
 * raster trafia jako data URL.
 */
export function buildSvg(src: IconSource | null, s: Settings): string {
  const S = 512;
  const r = radiusPx(s, S, "shape");
  const defs: string[] = [`<clipPath id="bcfi-clip"><rect width="${S}" height="${S}" rx="${n(r)}"/></clipPath>`];
  let bg = "";
  if (s.bgMode === "solid") bg = `<rect width="${S}" height="${S}" fill="${esc(s.bgColor)}"/>`;
  else if (s.bgMode === "gradient") {
    const p = gradientPoints(S, s.bgAngle);
    defs.push(
      `<linearGradient id="bcfi-bg" gradientUnits="userSpaceOnUse" x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}"><stop offset="0" stop-color="${esc(s.bgColor)}"/><stop offset="1" stop-color="${esc(s.bgColor2)}"/></linearGradient>`,
    );
    bg = `<rect width="${S}" height="${S}" fill="url(#bcfi-bg)"/>`;
  }

  let icon = "";
  if (src) {
    const { w, h, cx, cy } = iconBox(src, s, S, 1);
    let inner: string;
    if (src.kind === "svg") {
      const doc = new DOMParser().parseFromString(src.data, "image/svg+xml");
      const root = doc.documentElement;
      root.setAttribute("x", String(n(-w / 2)));
      root.setAttribute("y", String(n(-h / 2)));
      root.setAttribute("width", String(n(w)));
      root.setAttribute("height", String(n(h)));
      inner = new XMLSerializer().serializeToString(root);
    } else {
      inner = `<image href="${src.data}" x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    let filter = "";
    // Region filtra w userSpaceOnUse, nie w bbox: bbox nie obejmuje grubosci
    // obrysu, wiec ikony rysowane strokiem mialyby ucięte krawedzie.
    if (s.tint) {
      defs.push(
        `<filter id="bcfi-tint" filterUnits="userSpaceOnUse" x="-${S * 2}" y="-${S * 2}" width="${S * 4}" height="${S * 4}" color-interpolation-filters="sRGB"><feFlood flood-color="${esc(s.iconColor)}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`,
      );
      filter = ` filter="url(#bcfi-tint)"`;
    }
    icon = `<g transform="translate(${n(cx)} ${n(cy)}) scale(${s.flipX ? -1 : 1} ${s.flipY ? -1 : 1}) rotate(${n(s.rotation)})"><g${filter}>${inner}</g></g>`;
  }

  let border = "";
  if (hasBorder(s, "shape")) {
    const bw = (s.borderWidth / 100) * S;
    border = `<rect x="${n(bw / 2)}" y="${n(bw / 2)}" width="${n(S - bw)}" height="${n(S - bw)}" rx="${n(Math.max(0, r - bw / 2))}" fill="none" stroke="${esc(s.borderColor)}" stroke-width="${n(bw)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><defs>${defs.join("")}</defs><g clip-path="url(#bcfi-clip)">${bg}${icon}</g>${border}</svg>`;
}
