import { hasAnalyticsConsent } from "./consent";

/*
 * Zdarzenia Google Analytics 4. Skrypt gtag wstawia layout (`GoogleTagHead`)
 * tylko wtedy, gdy w .env jest GA_MEASUREMENT_ID — bez niego `window.gtag` nie
 * istnieje i `track` po cichu nic nie robi (dev, testy, instancje bez GA).
 * Bez zgody na analityke zdarzenia tez nie ida — nie czekaja nawet w kolejce
 * dataLayer na ewentualna pozniejsza zgode.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Format identyfikatora strumienia GA4. Sprawdzany, bo wartosc trafia do skryptu inline. */
export const isGaId = (id: string | undefined): id is string => !!id && /^G-[A-Z0-9]{4,20}$/.test(id);

export type TrackParams = Record<string, string | number | boolean>;

export function track(event: string, params: TrackParams) {
  if (typeof window === "undefined" || typeof window.gtag !== "function" || !hasAnalyticsConsent()) return;
  try {
    window.gtag("event", event, params);
  } catch {
    // Analityka nigdy nie moze zepsuc pobierania.
  }
}
