/*
 * Google Consent Mode v2 — przeniesione z hopedii (src/lib/consent.ts).
 *
 * Kolejnosc: `consent default` (wszystko denied) leci z <head> zawsze, a gtag.js
 * pobiera sie WYLACZNIE po zapisanej zgodzie na analityke. Bez zgody nie ma
 * zadnego ruchu do Google — takze cookieless pings.
 */

export const CONSENT_COOKIE = "brewcode_favicon_consent";
export const CONSENT_VERSION = 2;

export type ConsentState = "granted" | "denied";

export type ConsentChoices = {
  analytics_storage: ConsentState;
  ad_storage: ConsentState;
  ad_user_data: ConsentState;
  ad_personalization: ConsentState;
  functionality_storage: ConsentState;
  personalization_storage: ConsentState;
  security_storage: ConsentState;
};

export type StoredConsent = ConsentChoices & { version: number };

/** Domyslnie wszystko denied (poza security) — zgodne z GCM v2. */
export const DEFAULT_CONSENT: ConsentChoices = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
};

/** Zgoda z wlaczona analityka albo bez; reklam serwis nie ma, wiec ad_* zawsze denied. */
export function buildConsent(analyticsGranted: boolean): ConsentChoices {
  return {
    analytics_storage: analyticsGranted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    functionality_storage: "granted",
    personalization_storage: analyticsGranted ? "granted" : "denied",
    security_storage: "granted",
  };
}

export const FULL_CONSENT = buildConsent(true);

export function parseConsent(cookie: string): StoredConsent | null {
  try {
    const match = cookie.split("; ").find((r) => r.startsWith(`${CONSENT_COOKIE}=`));
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match.slice(CONSENT_COOKIE.length + 1))) as StoredConsent;
  } catch {
    return null;
  }
}

export function readConsentCookie(): StoredConsent | null {
  if (typeof document === "undefined") return null;
  return parseConsent(document.cookie);
}

export const hasAnalyticsConsent = () => readConsentCookie()?.analytics_storage === "granted";

export function writeConsentCookie(consent: ConsentChoices) {
  const payload: StoredConsent = { ...consent, version: CONSENT_VERSION };
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(payload))};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

type GtagWindow = { gtag?: (...args: unknown[]) => void; __GA_ID?: string; dataLayer?: unknown[] };

/**
 * Tworzy `window.dataLayer` i stub `window.gtag`, jesli jeszcze nie istnieja.
 * Tak dziala gtag: wywolania laduja w `dataLayer`, a biblioteka po zaladowaniu
 * przetwarza kolejke od poczatku — sygnal zgody mozna wyslac, zanim gtag.js
 * w ogole sie pobierze.
 */
export function ensureGtagStub(): ((...args: unknown[]) => void) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as GtagWindow;
  w.dataLayer = w.dataLayer ?? [];
  if (typeof w.gtag !== "function") {
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      (w.dataLayer as unknown[]).push(arguments);
    };
  }
  return w.gtag;
}

/** Laduje gtag.js (jesli jeszcze go nie ma) i wysyla odslone — wolane po akceptacji. */
export function sendGtagPageView() {
  if (typeof window === "undefined") return;
  const gaId = (window as unknown as GtagWindow).__GA_ID;
  if (!gaId) return;
  const gtag = ensureGtagStub()!;
  if (!document.querySelector(`script[src*="googletagmanager.com/gtag"]`)) {
    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    script.async = true;
    document.head.appendChild(script);
  }
  gtag("js", new Date());
  gtag("config", gaId, { page_location: window.location.href, page_title: document.title });
}

export function pushGtagConsent(type: "default" | "update", consent: ConsentChoices) {
  // Stub zamiast straznika `typeof gtag === "function"` — przy pierwszej akceptacji
  // gtag.js jeszcze nie istnieje, a sygnal zgody musi trafic do kolejki.
  ensureGtagStub()?.("consent", type, consent);
}

/**
 * Skrypt inline do <head>: dataLayer + stub, `consent default` denied, a przy
 * zapisanej zgodzie na analityke — `consent update`, `config` i gtag.js.
 * `gaId` musi byc wczesniej zwalidowane (`isGaId`), bo trafia doslownie do skryptu.
 */
export function gtagInitScript(gaId: string): string {
  const d = JSON.stringify(DEFAULT_CONSENT);
  return `
window.__GA_ID='${gaId}';
(function(){try{
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=window.gtag||gtag;
window.gtag('consent','default',${d});
var m=document.cookie.match(/(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)/);
if(!m)return;
var c=JSON.parse(decodeURIComponent(m[1]));
if(c.analytics_storage!=='granted')return;
window.gtag('consent','update',{ad_storage:c.ad_storage||'denied',ad_user_data:c.ad_user_data||'denied',ad_personalization:c.ad_personalization||'denied',analytics_storage:c.analytics_storage,functionality_storage:c.functionality_storage||'denied',personalization_storage:c.personalization_storage||'denied',security_storage:'granted'});
window.gtag('js',new Date());
window.gtag('config','${gaId}');
var s=document.createElement('script');
s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${gaId}';
document.head.appendChild(s);
}catch(e){}})();
`.trim();
}
