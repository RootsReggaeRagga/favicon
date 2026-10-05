# Build context to root repozytorium, kod aplikacji leży w app/.
#
# Podzial jest staly we wszystkich projektach: w roocie warstwa wdrozeniowa
# (Dockerfile, compose, .env, docs), w app/ cala aplikacja Next.
#
# To jest chudy obraz: aplikacja nie ma bazy, kolejki ani przegladarki po
# stronie serwera. Ikony renderuje i pakuje do ZIP-a przegladarka uzytkownika
# (canvas + JSZip), ustawienia mieszkaja w jej localStorage. Serwer tylko
# serwuje statyczna strone i /api/health — stad brak wolumenow na dane,
# brak migracji i brak wymaganego ruchu wychodzacego w runtime.
#
# Menedzer pakietow to pnpm — aplikacja ma pnpm-lock.yaml.
ARG NODE_VERSION=22-bookworm-slim

# ──────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
WORKDIR /srv/app
# Wersje pnpm bierze corepack z pola `packageManager` w package.json, wiec
# lokalnie i w obrazie instaluje dokladnie ta sama wersja.
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm

# ──────────────────────────────────────────────────────────────────────────────
# Zaleznosci w osobnej warstwie — przebudowuje sie tylko przy zmianie manifestow.
#
# pnpm-workspace.yaml jest kopiowany razem z manifestami, bo bez niego pnpm
# zglasza ERR_PNPM_WORKSPACE_CONFIG_MISMATCH przy `--frozen-lockfile`: lockfile
# powstal w kontekscie workspace'u i pamieta jego ustawienia.
FROM base AS deps
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ──────────────────────────────────────────────────────────────────────────────
# Target dla compose dev: kod montowany bindem, uruchamiany `next dev`.
#
# Dziala jako `node` (uid 1000), nie root — inaczej pliki generowane w
# kontenerze (.next, next-env.d.ts, AGENTS.md dopisywany przez `next dev`)
# ladowalyby na bind mouncie z wlascicielem root:root i lokalne `pnpm dev`
# konczyloby sie `EACCES: permission denied`.
FROM base AS dev
# PORT, a nie flaga w package.json: lokalne `pnpm dev` poza kontenerem zostaje
# przy domyslnym 3000, a w kontenerze port zgadza sie z mapowaniem w compose.
ENV NODE_ENV=development PORT=3240
# Katalog celu wolumenu musi istniec z wlasciwym wlascicielem PRZED
# zamontowaniem — Docker przenosi na wolumen nazwany uprawnienia z obrazu.
COPY --from=deps --chown=node:node /srv/app/node_modules ./node_modules
RUN mkdir -p .next && chown -R node:node /srv/app
USER node
EXPOSE 3240
CMD ["pnpm", "run", "dev"]

# ──────────────────────────────────────────────────────────────────────────────
FROM base AS builder
# pnpm buduje node_modules z symlinkow do node_modules/.pnpm. Sa relatywne
# i wewnatrz kopiowanego katalogu, wiec przenosza sie miedzy stage'ami poprawnie.
COPY --from=deps /srv/app/node_modules ./node_modules
COPY app/ ./
# public/ jest pusty (ikony aplikacji leza w app/app/), a git nie trzyma
# pustych katalogow — w swiezym klonie go nie ma i COPY w runnerze by padl.
RUN mkdir -p public
# Testy przed buildem: kodery PNG/ICO, katalog rozmiarow, sanityzacja SVG.
# Czerwony test zatrzymuje wdrozenie, zanim powstanie obraz.
RUN pnpm test
# Build pobiera fonty Geist z Google Fonts (next/font osadza je w obrazie),
# poza tym strona glowna jest prerenderowana, a /api/health dynamiczne.
RUN pnpm run build

# ──────────────────────────────────────────────────────────────────────────────
# Runner startuje wprost z czystego obrazu node, a nie z `base`: corepack i pnpm
# sa potrzebne wylacznie do instalacji i builda, w runtime bylyby balastem.
FROM node:${NODE_VERSION} AS runner
WORKDIR /srv/app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# Tryb standalone: Next wypuszcza wlasny server.js razem z presledzonymi
# zaleznosciami. `.next/static` i `public/` kopiujemy osobno, bo server.js
# ich nie zabiera.
COPY --from=builder --chown=node:node /srv/app/.next/standalone ./
COPY --from=builder --chown=node:node /srv/app/.next/static ./.next/static
COPY --from=builder --chown=node:node /srv/app/public ./public

USER node
EXPOSE 3240
ENV PORT=3240 HOSTNAME=0.0.0.0

# /api/health nie dotyka niczego poza samym serwerem — patrz komentarz w trasie.
# Sonda po stronie kontenera musi isc na 127.0.0.1, nie na domene publiczna:
# inaczej zdrowie aplikacji zalezaloby od DNS-u i dzialajacego proxy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3240/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
