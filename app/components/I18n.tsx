"use client";

import { createContext, useContext, type ReactNode } from "react";
import { AppError, DEFAULT_LOCALE, MESSAGES, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Jezyk wybiera serwer (Accept-Language) — klient dostaje go gotowy, bez migniecia przy hydratacji. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  return MESSAGES[useLocale()];
}

/** Tresc bledu w jezyku interfejsu; obce bledy (np. JSON.parse) przechodza bez zmian. */
export function useErrorText() {
  const t = useT();
  return (e: unknown) => (e instanceof AppError ? t.errors[e.code] : e instanceof Error ? e.message : String(e));
}
