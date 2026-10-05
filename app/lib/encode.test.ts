import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { encodeIco, encodeRgbPng } from "./encode";

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Minimalny parser PNG: lista chunkow z weryfikacja CRC. */
function chunks(png: Uint8Array) {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: { type: string; data: Uint8Array }[] = [];
  let o = 8;
  while (o < png.length) {
    const len = v.getUint32(o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    const data = png.subarray(o + 8, o + 8 + len);
    expect(v.getUint32(o + 8 + len), `CRC chunku ${type}`).toBe(crc32(png.subarray(o + 4, o + 8 + len)));
    out.push({ type, data });
    o += 12 + len;
  }
  return out;
}

describe("encodeRgbPng", () => {
  // 3×2: czerwony, zielony, niebieski / bialy, czarny, czerwony w polowie przezroczysty.
  const rgba = new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
    255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 128,
  ]);

  it("zapisuje poprawny PNG RGB bez kanalu alfa", async () => {
    const png = await bytes(await encodeRgbPng(rgba, 3, 2));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const list = chunks(png);
    expect(list.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    const ihdr = new DataView(list[0].data.buffer, list[0].data.byteOffset, 13);
    expect(ihdr.getUint32(0)).toBe(3);
    expect(ihdr.getUint32(4)).toBe(2);
    expect(list[0].data[8]).toBe(8); // bit depth
    expect(list[0].data[9]).toBe(2); // typ koloru: RGB — App Store odrzuca alfe
  });

  it("koduje piksele wiersz po wierszu i splaszcza polprzezroczystosc na bialo", async () => {
    const png = await bytes(await encodeRgbPng(rgba, 3, 2));
    const raw = inflateSync(chunks(png)[1].data);
    expect(raw.length).toBe(2 * (1 + 3 * 3));
    expect([...raw.subarray(0, 10)]).toEqual([0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    // 255,0,0 @ alfa 128 na bialym: R zostaje 255, G i B ≈ 127
    const last = [...raw.subarray(17, 20)];
    expect(last[0]).toBe(255);
    expect(last[1]).toBeGreaterThan(120);
    expect(last[1]).toBeLessThan(135);
    expect(last[1]).toBe(last[2]);
  });
});

describe("encodeIco", () => {
  it("sklada katalog ICO z osadzonymi PNG", async () => {
    const fake = (n: number, len: number) => new Blob([new Uint8Array(len).fill(n)]);
    const ico = await bytes(
      await encodeIco([
        { size: 16, png: fake(1, 10) },
        { size: 32, png: fake(2, 20) },
        { size: 256, png: fake(3, 30) },
      ]),
    );
    const v = new DataView(ico.buffer);
    expect(v.getUint16(0, true)).toBe(0);
    expect(v.getUint16(2, true)).toBe(1); // typ: ikona
    expect(v.getUint16(4, true)).toBe(3);
    const entry = (i: number) => {
      const e = 6 + 16 * i;
      return { w: ico[e], h: ico[e + 1], bpp: v.getUint16(e + 6, true), len: v.getUint32(e + 8, true), off: v.getUint32(e + 12, true) };
    };
    expect(entry(0)).toMatchObject({ w: 16, h: 16, bpp: 32, len: 10, off: 6 + 48 });
    expect(entry(1)).toMatchObject({ w: 32, len: 20, off: 6 + 48 + 10 });
    // 256 zapisuje sie w ICO jako 0
    expect(entry(2)).toMatchObject({ w: 0, h: 0, len: 30, off: 6 + 48 + 30 });
    expect(ico[entry(2).off]).toBe(3);
    expect(ico.length).toBe(6 + 48 + 60);
  });
});
