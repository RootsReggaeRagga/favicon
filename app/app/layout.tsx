import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BrewcodeBadge from "@/components/BrewcodeBadge";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <BrewcodeBadge />
      </body>
    </html>
  );
}
