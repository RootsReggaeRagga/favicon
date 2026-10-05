import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Domyslnie node; testy potrzebujace DOM-u deklaruja jsdom w naglowku pliku.
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
