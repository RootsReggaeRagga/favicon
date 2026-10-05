export interface IconSource {
  kind: "svg" | "png";
  name: string;
  /** Dla SVG: znormalizowany tekst dokumentu. Dla rastra: data URL. */
  data: string;
  image: HTMLImageElement;
  width: number;
  height: number;
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
    throw new Error("Plik nie jest poprawnym dokumentem SVG.");
  }
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
    img.onerror = () => reject(new Error("Nie udalo sie wczytac obrazu."));
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
  if (!file.type.startsWith("image/")) throw new Error("Obslugiwane formaty: SVG, PNG, JPG, WebP.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return sourceFromDataUrl(dataUrl, file.name);
}

export const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>`;
