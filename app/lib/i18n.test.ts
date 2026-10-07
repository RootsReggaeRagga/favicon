import { describe, expect, it } from "vitest";
import { AppError, MESSAGES, pickLocale } from "./i18n";

describe("pickLocale", () => {
  it("polski, gdy przegladarka stawia go najwyzej", () => {
    expect(pickLocale("pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("pl");
    expect(pickLocale("PL")).toBe("pl");
  });

  it("angielski dla innych jezykow i bez naglowka", () => {
    expect(pickLocale("en-US,en;q=0.9,pl;q=0.8")).toBe("en");
    expect(pickLocale("de-DE,de;q=0.9")).toBe("en");
    expect(pickLocale("")).toBe("en");
    expect(pickLocale(null)).toBe("en");
  });

  it("liczy sie waga q, nie kolejnosc", () => {
    expect(pickLocale("en;q=0.5,pl")).toBe("pl");
    expect(pickLocale("pl;q=0,en;q=0.1")).toBe("en");
  });

  it("nieobslugiwany jezyk na czele nie blokuje polskiego dalej", () => {
    expect(pickLocale("de,pl;q=0.8")).toBe("pl");
  });
});

describe("slowniki", () => {
  it("angielski ma te same klucze co polski", () => {
    const keys = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(MESSAGES.en).sort()).toEqual(keys(MESSAGES.pl).sort());
  });

  it("AppError niesie kod bledu", () => {
    expect(new AppError("notSvg").code).toBe("notSvg");
  });
});
