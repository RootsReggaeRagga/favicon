import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import BrewcodeBadge from "@/components/BrewcodeBadge";
import { isGaId } from "@/lib/analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Generator ikon — favicon, app icon, PWA",
  description:
    "Favicon, ikony aplikacji Android/iOS/macOS, PWA i Windows z jednego pliku SVG lub PNG — lokalnie w przeglądarce.",
};

export const viewport: Viewport = {
  themeColor: "#1f1f1f",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // GA_MEASUREMENT_ID czytamy w runtime, nie przy buildzie (jak NEXT_PUBLIC_*):
  // zmiana albo wylaczenie GA to edycja .env i restart kontenera, bez
  // przebudowy obrazu. `connection()` przenosi render na czas zadania —
  // przy prerenderze zmienna zostalaby zamrozona w HTML-u z builda.
  await connection();
  const gaId = process.env.GA_MEASUREMENT_ID?.trim();
  return (
    <html lang="pl" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <BrewcodeBadge />
      </body>
      {isGaId(gaId) && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
