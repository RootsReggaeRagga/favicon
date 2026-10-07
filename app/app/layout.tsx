import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { connection } from "next/server";
import BrewcodeBadge from "@/components/BrewcodeBadge";
import ConsentBanner from "@/components/ConsentBanner";
import GoogleTagHead from "@/components/GoogleTagHead";
import { I18nProvider } from "@/components/I18n";
import { isGaId } from "@/lib/analytics";
import { MESSAGES, pickLocale } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Jezyk strony: polski dla przegladarek po polsku, dla reszty angielski. */
async function requestLocale() {
  return pickLocale((await headers()).get("accept-language"));
}

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = MESSAGES[await requestLocale()];
  return { title: meta.title, description: meta.description };
}

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
  const locale = await requestLocale();
  return (
    <html lang={locale} className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <GoogleTagHead gaId={gaId} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider locale={locale}>
          {children}
          {/* Bez GA nie ma ciasteczek, wiec nie ma tez o co pytac. */}
          {isGaId(gaId) && <ConsentBanner />}
        </I18nProvider>
        <BrewcodeBadge />
      </body>
    </html>
  );
}
