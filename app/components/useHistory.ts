"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

const LIMIT = 100;
/** Zmiany w tym oknie czasu laczymy w jeden krok — przeciagniecie suwaka to jedno Ctrl+Z, nie sto. */
const COALESCE_MS = 400;

/**
 * Historia cofania dla stanu trzymanego w `useState`. Nie owija settera —
 * obserwuje wartosc i po chwili bezczynnosci zapisuje poprzedni stan jako krok.
 * Dzieki temu kazde miejsce, ktore zmienia ustawienia (suwak, ramka na
 * podgladzie, klawiatura), trafia do historii bez dodatkowego kodu.
 */
export function useHistory<T>(value: T, setValue: Dispatch<SetStateAction<T>>) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const committed = useRef(value);
  const latest = useRef(value);
  const skip = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  // Stan przyciskow trzymamy osobno — refow nie wolno czytac podczas renderu.
  const [flags, setFlags] = useState({ canUndo: false, canRedo: false });
  const sync = useCallback(() => {
    const next = {
      canUndo: past.current.length > 0 || timer.current !== undefined,
      canRedo: future.current.length > 0,
    };
    setFlags((f) => (f.canUndo === next.canUndo && f.canRedo === next.canRedo ? f : next));
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (latest.current === committed.current) return;
    past.current.push(committed.current);
    if (past.current.length > LIMIT) past.current.shift();
    committed.current = latest.current;
    future.current = [];
    sync();
  }, [sync]);

  useEffect(() => {
    latest.current = value;
    if (skip.current) {
      skip.current = false;
      committed.current = value;
      return;
    }
    if (value === committed.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, COALESCE_MS);
    sync();
  }, [value, flush, sync]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const jump = useCallback(
    (from: T[], to: T[]) => {
      flush();
      const target = from.pop();
      if (target === undefined) return;
      to.push(committed.current);
      committed.current = target;
      skip.current = true;
      setValue(target);
      sync();
    },
    [flush, setValue, sync],
  );

  const undo = useCallback(() => jump(past.current, future.current), [jump]);
  const redo = useCallback(() => jump(future.current, past.current), [jump]);

  /** Ustawia wartosc bez wpisu w historii i czysci ja (wczytanie zapisu, import). */
  const reset = useCallback(
    (next: T) => {
      window.clearTimeout(timer.current);
      timer.current = undefined;
      past.current = [];
      future.current = [];
      committed.current = next;
      latest.current = next;
      skip.current = true;
      setValue(next);
      sync();
    },
    [setValue, sync],
  );

  return useMemo(() => ({ undo, redo, reset, ...flags }), [undo, redo, reset, flags]);
}
