import { describe, expect, it } from "vitest";
import { isGaId } from "./analytics";

describe("isGaId", () => {
  it("przyjmuje identyfikator strumienia GA4", () => {
    expect(isGaId("G-ABC123XYZ")).toBe(true);
  });

  it("odrzuca puste, stare UA- i wszystko, co mogloby wyjsc poza skrypt inline", () => {
    for (const bad of [undefined, "", "UA-12345-1", "g-abc123", "G-ABC'); alert(1); ('", "G-ABC 123"]) {
      expect(isGaId(bad), String(bad)).toBe(false);
    }
  });
});
