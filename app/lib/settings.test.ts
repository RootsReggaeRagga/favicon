import { describe, expect, it } from "vitest";
import { effectiveSettings } from "./render";
import { DEFAULT_SETTINGS, mergeSettings, SMALL_MAX } from "./settings";

describe("mergeSettings", () => {
  it("uzupelnia brakujace pola domyslnymi (zapis ze starszej wersji)", () => {
    const s = mergeSettings({ scale: 0.9, bgColor: "#123456" });
    expect(s.scale).toBe(0.9);
    expect(s.bgColor).toBe("#123456");
    expect(s.shadow).toBe(DEFAULT_SETTINGS.shadow);
    expect(s.darkEnabled).toBe(DEFAULT_SETTINGS.darkEnabled);
  });

  it("pomija nieznane pola i wartosci zlego typu", () => {
    const s = mergeSettings({ scale: "duzo", evil: "<script>", radius: 10 }) as unknown as Record<string, unknown>;
    expect(s.scale).toBe(DEFAULT_SETTINGS.scale);
    expect(s.radius).toBe(10);
    expect("evil" in s).toBe(false);
  });

  it("dla smieci zwraca domyslne", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings("x")).toEqual(DEFAULT_SETTINGS);
  });
});

describe("effectiveSettings", () => {
  const small = { ...DEFAULT_SETTINGS, smallEnabled: true, smallScale: 0.9, borderWidth: 5, smallBorder: false };

  it("male rozmiary dostaja wlasna skale i trac ramke", () => {
    const e = effectiveSettings(small, SMALL_MAX, { mode: "shape" });
    expect(e.scale).toBe(0.9);
    expect(e.borderWidth).toBe(0);
  });

  it("powyzej progu zostaje glowna kompozycja", () => {
    const e = effectiveSettings(small, SMALL_MAX + 1, { mode: "shape" });
    expect(e.scale).toBe(DEFAULT_SETTINGS.scale);
    expect(e.borderWidth).toBe(5);
  });

  it("override celu wygrywa z kompozycja malych rozmiarow", () => {
    const e = effectiveSettings(small, 24, { mode: "monochrome", override: { scale: 1 } });
    expect(e.scale).toBe(1);
  });
});
