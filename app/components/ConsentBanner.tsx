"use client";

import { ChevronDown, ChevronUp, Cookie, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import {
  buildConsent,
  DEFAULT_CONSENT,
  FULL_CONSENT,
  pushGtagConsent,
  readConsentCookie,
  sendGtagPageView,
  writeConsentCookie,
} from "@/lib/consent";
import { cn } from "@/lib/utils";
import { useT } from "./I18n";

/*
 * Baner zgod — dzialanie jak w hopedii (ConsentBanner.tsx), kolory brewcode-landing
 * (papier #f2f0eb, tusz #000, akcent #f6b900), zaokraglony ksztalt jak w brewcode-maping.
 */
const BTN =
  "inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border-2 border-black transition-colors hover:bg-black hover:text-[#f2f0eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6b900]";
const PRIMARY = "w-full bg-[#f6b900] py-2.5 text-sm font-bold text-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#f2f0eb]";
const SECONDARY = "flex-1 py-2 text-xs font-semibold";

export default function ConsentBanner() {
  const t = useT().consent;
  const [visible, setVisible] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);

  // Cookie czytamy dopiero po montazu — inaczej rozjechalaby sie hydratacja.
  useEffect(() => {
    const stored = readConsentCookie();
    queueMicrotask(() => {
      if (!stored) setVisible(true);
      else {
        setHasConsent(true);
        setAnalyticsOn(stored.analytics_storage === "granted");
      }
    });
  }, []);

  // Pierwsze wyswietlenie (brak decyzji) blokuje przewijanie strony pod spodem.
  useEffect(() => {
    document.body.style.overflow = visible && !hasConsent ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [visible, hasConsent]);

  const close = () => {
    setVisible(false);
    setHasConsent(true);
    setExpanded(false);
  };

  function accept() {
    writeConsentCookie(FULL_CONSENT);
    pushGtagConsent("update", FULL_CONSENT);
    sendGtagPageView();
    setAnalyticsOn(true);
    close();
  }

  function reject() {
    writeConsentCookie(DEFAULT_CONSENT);
    pushGtagConsent("update", DEFAULT_CONSENT);
    setAnalyticsOn(false);
    close();
  }

  function saveCustom() {
    const consent = buildConsent(analyticsOn);
    writeConsentCookie(consent);
    pushGtagConsent("update", consent);
    if (analyticsOn) sendGtagPageView();
    close();
  }

  function openSettings() {
    setAnalyticsOn(readConsentCookie()?.analytics_storage === "granted");
    setExpanded(true);
    setVisible(true);
  }

  return (
    <>
      {/* Ponowne otwarcie ustawien — nad znaczkiem brewcode (prawy dolny rog). */}
      {!visible && hasConsent && (
        <button
          type="button"
          onClick={openSettings}
          title={t.settings}
          aria-label={t.settings}
          className="fixed right-[30px] bottom-[84px] z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#f2f0eb] text-black shadow-lg transition-colors hover:bg-[#f6b900]"
        >
          <Cookie className="h-4 w-4" />
        </button>
      )}

      {visible && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-end justify-center sm:items-center",
            !hasConsent ? "bg-black/50 backdrop-blur-sm" : "pointer-events-none",
          )}
        >
          <div
            role="dialog"
            aria-modal={!hasConsent}
            aria-labelledby="consent-title"
            className="pointer-events-auto mx-auto w-full rounded-t-2xl border-2 border-black bg-[#f2f0eb] text-black shadow-2xl shadow-black/40 sm:mx-4 sm:max-w-lg sm:rounded-2xl"
          >
            <div className="space-y-4 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-[#f6b900]">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <p id="consent-title" className="text-sm leading-snug font-bold">
                    {t.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-black/70">{t.description}</p>
                </div>
              </div>

              {expanded && (
                <div className="space-y-3 border-t-2 border-black/10 pt-3">
                  <p className="text-[10px] font-bold tracking-widest text-black/60 uppercase">{t.settings}</p>
                  <ConsentRow id="consent-necessary" label={t.necessary} description={t.necessaryDesc} checked disabled />
                  <ConsentRow
                    id="consent-analytics"
                    label={t.analytics}
                    description={t.analyticsDesc}
                    checked={analyticsOn}
                    onChange={setAnalyticsOn}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={expanded ? saveCustom : accept}
                  className={cn(BTN, PRIMARY)}
                >
                  {expanded ? t.save : t.acceptAll}
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={reject} className={cn(BTN, SECONDARY)}>
                    {t.rejectAll}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    className={cn(BTN, SECONDARY)}
                  >
                    {t.customize}
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
                {/* Zamknij bez zmian — tylko przy edycji istniejacej decyzji. */}
                {hasConsent && (
                  <button
                    type="button"
                    onClick={() => {
                      setVisible(false);
                      setExpanded(false);
                    }}
                    className="w-full cursor-pointer py-2 text-xs text-black/60 transition-colors hover:text-black"
                  >
                    {t.close}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConsentRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className={cn("text-sm font-semibold", disabled ? "text-black/60" : "cursor-pointer")}>
          {label}
        </label>
        <p className="mt-0.5 text-[11px] leading-relaxed text-black/70">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6b900]",
          disabled ? "cursor-not-allowed bg-[#f6b900]" : checked ? "cursor-pointer bg-[#f6b900]" : "cursor-pointer bg-[#a8a49b]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
