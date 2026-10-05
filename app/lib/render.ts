import { SMALL_MAX, type Align, type Settings } from "./settings";
import type { IconSource } from "./source";

/**
 * Jak dany cel interpretuje ustawienia:
 *  - shape      ksztalt uzytkownika: zaokraglenie, obramowanie, przezroczyste rogi,
 *  - round      jak shape, ale zawsze kolo (Android ic_launcher_round),
 *  - fullbleed  pelny kwadrat bez rogow i ramki — platforma naklada maske sama
 *               (iOS, App Store, Google Play, PWA maskable),
 *  - foreground sama ikonka na przezroczystym tle (warstwa adaptive icon),
 *  - background samo tlo (warstwa adaptive icon),
 *  - monochrome sylwetka ikonki w jednym kolorze (Android 13 themed icon,
 *               ikona powiadomien),
 *  - dark       iOS 18 w trybie ciemnym: ikonka na przezroczystym tle, tlo
 *               dokłada system,
 *  - tinted     iOS 18 "tinted": ikonka w skali szarosci na czarnym tle,
 *               kolor nakłada system,
 *  - splash     ekran startowy iOS: tlo na caly ekran, ikonka na srodku
 *               (jedyny tryb z prostokatnym plotnem).
 */
export type RenderMode =
  | "shape"
  | "round"
  | "fullbleed"
  | "foreground"
  | "background"
  | "monochrome"
  | "dark"
  | "tinted"
  | "splash";

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
  /** Ustawienia narzucone przez cel, np. ikona powiadomien zawsze wycentrowana i duza. */
  override?: Partial<Settings>;
}

const OPAQUE_FALLBACK = "#ffffff";
/** Bok kwadratu z ikonka na ekranie startowym, wzgledem krotszego boku ekranu. */
export const SPLASH_ICON = 0.4;

/** Ustawienia, ktorymi faktycznie rysujemy dany cel w danym rozmiarze. */
export function effectiveSettings(s: Settings, size: number, opts: RenderOptions): Settings {
  let e = s;
  if (s.smallEnabled && size <= SMALL_MAX && opts.mode !== "splash") {
    e = { ...e, scale: s.smallScale, borderWidth: s.smallBorder ? s.borderWidth : 0 };
  }
  if (opts.override) e = { ...e, ...opts.override };
  return e;
}

export function gradientPoints(w: number, h: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  // Jak w CSS: linia gradientu przechodzi przez srodek i siega rogow prostokata.
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}

function radiusPx(s: Settings, size: number, mode: RenderMode) {
  if (mode === "round") return size / 2;
  if (mode === "shape") return (Math.min(50, Math.max(0, s.radius)) / 100) * size;
  return 0;
}

function hasBorder(s: Settings, mode: RenderMode) {
  return (mode === "shape" || mode === "round") && s.borderWidth > 0;
}

function hasShadow(s: Settings, mode: RenderMode) {
  return s.shadow && mode !== "monochrome" && mode !== "tinted" && mode !== "background";
}

function rgba(hex: string, opacity: number) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${Math.max(0, Math.min(1, opacity))})`;
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

/** Ikonka w zadanym rozmiarze: przebarwiona, w skali szarosci albo oryginalna. */
function iconImage(src: IconSource, w: number, h: number, color: string | null, gray: boolean): CanvasImageSource {
  if (!color && !gray) return src.image;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src.image, 0, 0, c.width, c.height);
  if (color) {
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  if (gray) {
    // Recznie zamiast ctx.filter — filtr canvasu nie wszedzie jest dostepny.
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = l;
    }
    ctx.putImageData(img, 0, 0);
  }
  return c;
}

function bgFill(ctx: CanvasRenderingContext2D, w: number, h: number, s: Settings, fallback: string | null) {
  if (s.bgMode === "solid") return s.bgColor;
  if (s.bgMode === "gradient") {
    const p = gradientPoints(w, h, s.bgAngle);
    const g = ctx.createLinearGradient(p.x1, p.y1, p.x2, p.y2);
    g.addColorStop(0, s.bgColor);
    g.addColorStop(1, s.bgColor2);
    return g;
  }
  return fallback;
}

/** Rysuje kwadrat `size`×`size` od (0,0). Nie czysci plotna — robi to wolajacy. */
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const r = radiusPx(s, size, mode);
  ctx.beginPath();
  if (r > 0) ctx.roundRect(0, 0, size, size, r);
  else ctx.rect(0, 0, size, size);
  ctx.clip();

  // Tlo
  if (mode === "tinted") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
  } else if (mode !== "foreground" && mode !== "monochrome" && mode !== "dark") {
    const fill = bgFill(ctx, size, size, s, opts.opaque ? OPAQUE_FALLBACK : null);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, size, size);
    }
  }

  // Ikonka
  if (src && mode !== "background") {
    const { w, h, cx, cy } = iconBox(src, s, size, inset);
    let color: string | null = s.tint ? s.iconColor : null;
    if (mode === "monochrome") color = "#ffffff";
    else if (mode === "tinted") color = s.tint ? "#ffffff" : null;
    else if (mode === "dark" && s.tint && s.darkEnabled) color = s.darkIconColor;
    const img = iconImage(src, w * 2, h * 2, color, mode === "tinted" && !s.tint);
    ctx.save();
    if (hasShadow(s, mode)) {
      // Cien w ukladzie plotna (shadowOffset nie podlega transformacji),
      // wiec zawsze pada w dol, takze przy obroconej ikonce.
      ctx.shadowColor = rgba(s.shadowColor, s.shadowOpacity / 100);
      ctx.shadowBlur = (s.shadowBlur / 100) * size;
      ctx.shadowOffsetY = (s.shadowOffsetY / 100) * size;
    }
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
    ctx.roundRect(bw / 2, bw / 2, size - bw, size - bw, Math.max(0, r - bw / 2));
    ctx.lineWidth = bw;
    ctx.strokeStyle = s.borderColor;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Maluje cel na podanym canvasie. `height` rozni sie od `width` tylko dla
 * ekranow startowych; wszystkie ikony sa kwadratowe.
 */
export function paintCanvas(
  c: HTMLCanvasElement,
  width: number,
  src: IconSource | null,
  settings: Settings,
  opts: RenderOptions,
  height = width,
) {
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const s = effectiveSettings(settings, Math.min(width, height), opts);

  if (opts.mode === "splash") {
    // Tlo na caly ekran; przy "brak tla" bierzemy theme color, bo ekran
    // startowy musi byc kryjacy, a biel z OPAQUE_FALLBACK razi na ciemnych markach.
    ctx.fillStyle = bgFill(ctx, width, height, s, s.themeColor)!;
    ctx.fillRect(0, 0, width, height);
    const box = Math.min(width, height) * SPLASH_ICON;
    ctx.translate((width - box) / 2, (height - box) / 2);
    drawIcon(ctx, box, src, s, { mode: "foreground" });
  } else if (opts.pad && opts.pad < 1) {
    const inner = width * opts.pad;
    ctx.translate((width - inner) / 2, (width - inner) / 2);
    drawIcon(ctx, inner, src, s, opts);
  } else drawIcon(ctx, width, src, s, opts);
  return c;
}

export function renderCanvas(size: number, src: IconSource | null, s: Settings, opts: RenderOptions, height = size) {
  return paintCanvas(document.createElement("canvas"), size, src, s, opts, height);
}

/* ───────────────────────────── SVG ───────────────────────────── */

const esc = (v: string) => v.replace(/[<>&"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const n = (v: number) => +v.toFixed(3);

/**
 * Wektorowy odpowiednik `drawIcon` w trybie `shape`. Zrodlo SVG jest
 * wstawiane inline jako zagniezdzony <svg> (favicon SVG w przegladarce dziala
 * w trybie "secure static" — zewnetrzne zasoby i tak by sie nie zaladowaly),
 * raster trafia jako data URL.
 *
 * `small` — uzyj kompozycji dla malych rozmiarow (favicon.svg wyswietla sie
 * glownie w 16–32 px na karcie przegladarki).
 */
export function buildSvg(src: IconSource | null, settings: Settings, { small = false } = {}): string {
  const S = 512;
  const s = effectiveSettings(settings, small ? SMALL_MAX : S, { mode: "shape" });
  const r = radiusPx(s, S, "shape");
  const defs: string[] = [`<clipPath id="bcfi-clip"><rect width="${S}" height="${S}" rx="${n(r)}"/></clipPath>`];
  const css: string[] = [];
  let bg = "";
  if (s.bgMode === "solid") bg = `<rect id="bcfi-bgr" width="${S}" height="${S}" fill="${esc(s.bgColor)}"/>`;
  else if (s.bgMode === "gradient") {
    const p = gradientPoints(S, S, s.bgAngle);
    defs.push(
      `<linearGradient id="bcfi-bg" gradientUnits="userSpaceOnUse" x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}"><stop offset="0" stop-color="${esc(s.bgColor)}"/><stop offset="1" stop-color="${esc(s.bgColor2)}"/></linearGradient>`,
    );
    bg = `<rect id="bcfi-bgr" width="${S}" height="${S}" fill="url(#bcfi-bg)"/>`;
  }
  // Wariant ciemny: CSS w SVG nadpisuje atrybuty prezentacyjne, wiec wystarczy
  // podmienic wypelnienie tla i kolor przebarwienia. Przy "brak tla" tlo
  // zostaje przezroczyste rowniez w trybie ciemnym.
  if (s.darkEnabled) {
    if (bg) css.push(`#bcfi-bgr{fill:${s.darkBgColor}}`);
    if (s.tint) css.push(`#bcfi-flood{flood-color:${s.darkIconColor}}`);
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
    // Region filtrow w userSpaceOnUse, nie w bbox: bbox nie obejmuje grubosci
    // obrysu, wiec ikony rysowane strokiem mialyby uciete krawedzie.
    const region = `filterUnits="userSpaceOnUse" x="-${S * 2}" y="-${S * 2}" width="${S * 5}" height="${S * 5}" color-interpolation-filters="sRGB"`;
    let tint = "";
    if (s.tint) {
      defs.push(
        `<filter id="bcfi-tint" ${region}><feFlood id="bcfi-flood" flood-color="${esc(s.iconColor)}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`,
      );
      tint = ` filter="url(#bcfi-tint)"`;
    }
    let shadow = "";
    if (s.shadow) {
      // Na zewnetrznej grupie, poza obrotem — cien pada w dol jak w canvasie.
      // shadowBlur canvasu odpowiada mniej wiecej 2× odchyleniu standardowemu.
      defs.push(
        `<filter id="bcfi-shadow" ${region}><feDropShadow dx="0" dy="${n((s.shadowOffsetY / 100) * S)}" stdDeviation="${n(((s.shadowBlur / 100) * S) / 2)}" flood-color="${esc(s.shadowColor)}" flood-opacity="${n(s.shadowOpacity / 100)}"/></filter>`,
      );
      shadow = ` filter="url(#bcfi-shadow)"`;
    }
    icon = `<g${shadow}><g transform="translate(${n(cx)} ${n(cy)}) scale(${s.flipX ? -1 : 1} ${s.flipY ? -1 : 1}) rotate(${n(s.rotation)})"><g${tint}>${inner}</g></g></g>`;
  }

  let border = "";
  if (hasBorder(s, "shape")) {
    const bw = (s.borderWidth / 100) * S;
    border = `<rect x="${n(bw / 2)}" y="${n(bw / 2)}" width="${n(S - bw)}" height="${n(S - bw)}" rx="${n(Math.max(0, r - bw / 2))}" fill="none" stroke="${esc(s.borderColor)}" stroke-width="${n(bw)}"/>`;
  }

  const style = css.length ? `<style>@media (prefers-color-scheme: dark){${css.join("")}}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${style}<defs>${defs.join("")}</defs><g clip-path="url(#bcfi-clip)">${bg}${icon}</g>${border}</svg>`;
}
