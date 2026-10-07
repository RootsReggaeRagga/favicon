import { AppError } from "./i18n";

export interface TextSpec {
  text: string;
  font: FontId;
  bold: boolean;
}

export interface IconSource {
  kind: "svg" | "png";
  name: string;
  /** Dla SVG: znormalizowany tekst dokumentu. Dla rastra: data URL. */
  data: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  /** Zrodlo wygenerowane z litery / emoji — trzymamy parametry do dalszej edycji. */
  text?: TextSpec;
}

/* ─────────────────────────── sanityzacja SVG ─────────────────────────── */

/** Elementy, ktore moga wykonac kod albo osadzic obca tresc. */
const FORBIDDEN = new Set(["script", "foreignobject", "iframe", "object", "embed", "audio", "video", "handler", "listener"]);
/** Bezpieczne odwolania: wewnatrz dokumentu albo obraz osadzony w data URL. */
const SAFE_HREF = /^\s*(#|data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,])/i;

/**
 * Czysci wgrane SVG, zanim trafi do podgladu i do favicon.svg w paczce:
 * usuwa skrypty, foreignObject i podobne, handlery `on*`, linki `javascript:`
 * i odwolania do zewnetrznych zasobow (takze `@import`/`url()` w <style>).
 * Przegladarka i tak nie wykonuje skryptow w favicon, ale paczka trafia
 * do cudzych projektow i nie powinna nic takiego przenosic.
 */
export function sanitizeSvg(root: Element) {
  for (const el of [...root.querySelectorAll("*")]) {
    if (FORBIDDEN.has(el.localName.toLowerCase())) {
      el.remove();
      continue;
    }
  }
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if ((name === "href" || name === "xlink:href") && !SAFE_HREF.test(attr.value)) el.removeAttribute(attr.name);
      else if (name === "style" || ["fill", "stroke", "filter", "clip-path", "mask"].includes(name)) {
        const v = stripExternalUrls(attr.value);
        if (v !== attr.value) el.setAttribute(attr.name, v);
      }
    }
    if (el.localName.toLowerCase() === "style" && el.textContent) {
      el.textContent = stripExternalUrls(el.textContent.replace(/@import[^;]*;?/gi, ""));
    }
  }
}

function stripExternalUrls(css: string) {
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, _q, url: string) =>
    url.startsWith("#") || /^data:image\//i.test(url) ? m : "none",
  );
}

/**
 * SVG bez atrybutow width/height ma w czesci przegladarek naturalny rozmiar 0
 * i rysuje sie w canvasie jako nic. Uzupelniamy je z viewBox (i odwrotnie),
 * zeby obraz zawsze mial proporcje i dal sie wektorowo przeskalowac.
 */
function normalizeSvg(text: string): { svg: string; width: number; height: number } {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) {
    throw new AppError("notSvg");
  }
  sanitizeSvg(root);
  const num = (v: string | null) => {
    if (!v || v.trim().endsWith("%")) return NaN;
    return parseFloat(v);
  };
  let w = num(root.getAttribute("width"));
  let h = num(root.getAttribute("height"));
  const vb = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb.every((n) => Number.isFinite(n))) {
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      w = vb[2];
      h = vb[3];
    }
  } else {
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      w = 512;
      h = 512;
    }
    root.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  root.setAttribute("width", String(w));
  root.setAttribute("height", String(h));
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { svg: new XMLSerializer().serializeToString(root), width: w, height: h };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new AppError("imageLoad"));
    img.src = src;
  });
}

export function svgToDataUrl(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export async function sourceFromSvgText(text: string, name: string): Promise<IconSource> {
  const { svg, width, height } = normalizeSvg(text);
  const image = await loadImage(svgToDataUrl(svg));
  return { kind: "svg", name, data: svg, image, width, height };
}

export async function sourceFromDataUrl(dataUrl: string, name: string): Promise<IconSource> {
  const image = await loadImage(dataUrl);
  return {
    kind: "png",
    name,
    data: dataUrl,
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export async function sourceFromFile(file: File): Promise<IconSource> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (isSvg) return sourceFromSvgText(await file.text(), file.name);
  if (!file.type.startsWith("image/")) throw new AppError("unsupportedFormat");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return sourceFromDataUrl(dataUrl, file.name);
}

export const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>`;

/* ─────────────────────────── litera / emoji ─────────────────────────── */

export type FontId = "sans" | "serif" | "mono" | "rounded";

/** Etykiety czcionek sa w slowniku (`source.fonts`). */
export const FONTS: FontId[] = ["sans", "serif", "mono", "rounded"];

function fontFamily(id: FontId) {
  // Fonty z next/font maja zahaszowane nazwy — bierzemy je z zmiennych CSS na <html>.
  const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  switch (id) {
    case "sans":
      return cssVar("--font-geist-sans") || "system-ui, sans-serif";
    case "mono":
      return cssVar("--font-geist-mono") || "ui-monospace, monospace";
    case "serif":
      return 'Georgia, "Times New Roman", serif';
    case "rounded":
      return 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif';
  }
}

export const hasEmoji = (text: string) => /\p{Extended_Pictographic}/u.test(text);

/**
 * Litera albo emoji jako zrodlo: rysujemy na duzym canvasie i przycinamy do
 * faktycznie zamalowanych pikseli, zeby wyrownanie i rozmiar dzialaly tak samo
 * jak dla wgranego pliku. Raster 1024 px wystarcza na najwiekszy cel (1024).
 * Tekst jest czarny — kolor nadaje przebarwienie; emoji zachowuja swoje barwy.
 */
export async function sourceFromText(spec: TextSpec): Promise<IconSource> {
  const text = spec.text.trim() || "A";
  const family = fontFamily(spec.font);
  const weight = spec.bold ? 700 : 400;
  const S = 1024;
  const font = `${weight} ${S * 0.7}px ${family}`;
  try {
    await document.fonts.load(font, text);
  } catch {}
  const c = document.createElement("canvas");
  c.width = S * 2;
  c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";
  // Dluzszy tekst zmniejszamy tak, zeby zmiescil sie w szerokosci plotna.
  const width = ctx.measureText(text).width;
  if (width > c.width * 0.9) ctx.font = `${weight} ${S * 0.7 * ((c.width * 0.9) / width)}px ${family}`;
  ctx.fillText(text, c.width / 2, S / 2);

  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new AppError("noGlyph");
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  // Wynik skalujemy tak, by dluzszy bok mial 1024 px.
  const k = S / Math.max(w, h);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * k));
  out.height = Math.max(1, Math.round(h * k));
  const octx = out.getContext("2d")!;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(c, x0, y0, w, h, 0, 0, out.width, out.height);
  const src = await sourceFromDataUrl(out.toDataURL("image/png"), `Tekst „${text}”`);
  return { ...src, text: { ...spec, text } };
}
