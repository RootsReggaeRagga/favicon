// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildSvg } from "./render";
import { DEFAULT_SETTINGS } from "./settings";
import { sanitizeSvg, type IconSource } from "./source";

function clean(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  sanitizeSvg(doc.documentElement);
  return new XMLSerializer().serializeToString(doc.documentElement);
}

describe("sanitizeSvg", () => {
  it("usuwa skrypty, foreignObject i handlery zdarzen", () => {
    const out = clean(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><foreignObject><div>x</div></foreignObject><rect onclick="alert(3)" width="1" height="1"/></svg>`,
    );
    expect(out).not.toMatch(/script|foreignObject|onload|onclick|alert/i);
    expect(out).toContain("<rect");
  });

  it("usuwa linki javascript: i zewnetrzne zasoby, zostawia odwolania wewnetrzne i data:image", () => {
    const out = clean(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
        `<a href="javascript:alert(1)"><text>x</text></a>` +
        `<image href="https://evil.example/track.png"/>` +
        `<image href="data:image/png;base64,AAAA"/>` +
        `<use xlink:href="#shape"/>` +
        `<rect fill="url(https://evil.example/x.svg#p)" stroke="url(#grad)"/>` +
        `</svg>`,
    );
    expect(out).not.toMatch(/javascript:|evil\.example/);
    expect(out).toContain("data:image/png;base64,AAAA");
    expect(out).toContain('xlink:href="#shape"');
    expect(out).toContain('stroke="url(#grad)"');
  });

  it("czysci @import i url() w <style>", () => {
    const out = clean(
      `<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/a.css); rect{fill:url(https://evil.example/p)} circle{fill:url(#ok)}</style></svg>`,
    );
    expect(out).not.toContain("evil.example");
    expect(out).toContain("url(#ok)");
  });
});

describe("buildSvg", () => {
  const src = {
    kind: "svg",
    name: "t.svg",
    data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><rect width="10" height="10"/></svg>`,
    image: null as unknown as HTMLImageElement,
    width: 10,
    height: 10,
  } satisfies IconSource;

  const nestedWidth = (svg: string) => Number(svg.match(/<svg[^>]*viewBox="0 0 10 10"[^>]*width="([\d.]+)"/)![1]);

  it("bez wariantu ciemnego nie dodaje stylu", () => {
    expect(buildSvg(src, DEFAULT_SETTINGS)).not.toContain("prefers-color-scheme");
  });

  it("wariant ciemny podmienia tlo i kolor przebarwienia", () => {
    const svg = buildSvg(src, { ...DEFAULT_SETTINGS, darkEnabled: true, darkBgColor: "#101010", darkIconColor: "#abcdef" });
    expect(svg).toContain("@media (prefers-color-scheme: dark){#bcfi-bgr{fill:#101010}#bcfi-flood{flood-color:#abcdef}}");
    expect(svg).toContain('id="bcfi-bgr"');
    expect(svg).toContain('id="bcfi-flood"');
  });

  it("cien jako feDropShadow na grupie poza obrotem", () => {
    const svg = buildSvg(src, { ...DEFAULT_SETTINGS, shadow: true, rotation: 45 });
    expect(svg).toContain("<feDropShadow");
    expect(svg.indexOf('filter="url(#bcfi-shadow)"')).toBeLessThan(svg.indexOf("rotate(45)"));
  });

  it("favicon.svg uzywa kompozycji malych rozmiarow, icon.svg glownej", () => {
    const s = { ...DEFAULT_SETTINGS, smallEnabled: true, smallScale: 0.9, scale: 0.5 };
    expect(nestedWidth(buildSvg(src, s, { small: true }))).toBeCloseTo(512 * 0.9);
    expect(nestedWidth(buildSvg(src, s))).toBeCloseTo(512 * 0.5);
  });
});
