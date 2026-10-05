/* Kodery plikow, ktorych canvas sam nie wyprodukuje. */

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function zlib(data: Uint8Array): Promise<Uint8Array> {
  // "deflate" w CompressionStream to format zlib (RFC 1950) — dokladnie ten, ktorego wymaga IDAT.
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * PNG bez kanalu alfa (typ koloru 2, RGB 8 bit).
 *
 * canvas.toBlob zawsze zapisuje RGBA, nawet gdy kazdy piksel jest kryjacy,
 * a App Store Connect odrzuca ikone 1024 z kanalem alfa niezaleznie od jego
 * zawartosci. Stad wlasny koder dla celow `opaque`.
 */
export async function encodeOpaquePng(canvas: HTMLCanvasElement): Promise<Blob> {
  const { width: w, height: h } = canvas;
  return encodeRgbPng(canvas.getContext("2d")!.getImageData(0, 0, w, h).data, w, h);
}

/** Czesc niezalezna od DOM — RGBA w pamieci na PNG RGB. Testowana w encode.test.ts. */
export async function encodeRgbPng(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Promise<Blob> {
  const raw = new Uint8Array(h * (1 + w * 3));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filtr: None
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = rgba[i + 3] / 255;
      // Na wszelki wypadek splaszczamy resztki polprzezroczystosci na biale tlo.
      raw[o++] = Math.round(rgba[i] * a + 255 * (1 - a));
      raw[o++] = Math.round(rgba[i + 1] * a + 255 * (1 - a));
      raw[o++] = Math.round(rgba[i + 2] * a + 255 * (1 - a));
    }
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", await zlib(raw)), chunk("IEND", new Uint8Array())];
  return new Blob(parts as BlobPart[], { type: "image/png" });
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Nie udalo sie zakodowac PNG."))), "image/png"),
  );
}

/** ICO z osadzonymi PNG (wspierane od Windows Vista i przez wszystkie przegladarki). */
export async function encodeIco(images: { size: number; png: Blob }[]): Promise<Blob> {
  const datas = await Promise.all(images.map(async (i) => new Uint8Array(await i.png.arrayBuffer())));
  const header = new Uint8Array(6 + 16 * images.length);
  const v = new DataView(header.buffer);
  v.setUint16(0, 0, true);
  v.setUint16(2, 1, true); // typ: ikona
  v.setUint16(4, images.length, true);
  let offset = header.length;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    header[e] = img.size >= 256 ? 0 : img.size;
    header[e + 1] = img.size >= 256 ? 0 : img.size;
    header[e + 2] = 0; // paleta
    header[e + 3] = 0;
    v.setUint16(e + 4, 1, true); // planes
    v.setUint16(e + 6, 32, true); // bpp
    v.setUint32(e + 8, datas[i].length, true);
    v.setUint32(e + 12, offset, true);
    offset += datas[i].length;
  });
  return new Blob([header, ...datas] as BlobPart[], { type: "image/x-icon" });
}
