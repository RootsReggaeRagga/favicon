import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Obraz produkcyjny startuje z `.next/standalone` — patrz Dockerfile.
  output: "standalone",
  // Wskaznik dev zaslanial przycisk pobierania w rogu sidebara.
  devIndicators: false,
};

export default nextConfig;
