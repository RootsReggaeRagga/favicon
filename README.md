# Generator ikon — favicon, app icon, PWA

Narzędzie do robienia kompletu ikon z jednego pliku. Wgrywasz SVG albo PNG,
ustawiasz tło, kolor, zaokrąglenie, ramkę i położenie ikonki, oglądasz efekt na
makietach platform i pobierasz gotową paczkę ZIP: favicon, ikony PWA, Android,
iOS / App Store, macOS i Windows razem z plikami konfiguracyjnymi i fragmentem
`<head>` do wklejenia.

**Wszystko dzieje się w przeglądarce.** Plik źródłowy nie trafia na serwer.
Renderowanie (canvas), kodowanie PNG/ICO i pakowanie ZIP-a robi przeglądarka
użytkownika, a ustawienia zapisują się w jej `localStorage`. Serwer tylko
serwuje stronę i `/api/health`, więc aplikacja nie ma bazy, kluczy API ani
sekretów. Plik `.env` w roocie zawiera wyłącznie nazwę projektu, port, domenę
i ustawienia Traefika i dlatego jest w repozytorium.

Produkcyjnie: **https://favicon.brwcd.dev**

## Uruchomienie

Kod aplikacji leży w `app/`, w roocie jest warstwa wdrożeniowa (Dockerfile,
compose, `.env`). Najprościej w Dockerze — ten sam obraz co na produkcji,
target `dev`, z hot reloadem:

```bash
docker compose up -d            # http://localhost:3240
docker compose logs -f app
```

Bez Dockera:

```bash
cd app
pnpm install
pnpm dev                        # http://localhost:3000
```

> **Nowa zależność w `package.json`?** W kontenerze dev `node_modules` leży na
> wolumenie nazwanym, który nie odświeża się sam przy przebudowie obrazu.
> Doinstaluj w działającym kontenerze i zrestartuj go. `--store-dir` trzyma
> cache pnpm poza bind mountem — inaczej ląduje w `app/.pnpm-store` na hoście.
>
> ```bash
> docker compose exec -e CI=true app pnpm install --frozen-lockfile --store-dir /home/node/.pnpm-store
> docker compose restart app
> ```

## Co potrafi

### Źródło

- SVG, PNG, JPG lub WebP: kliknięcie przycisku „Zmień”, przeciągnięcie pliku
  na okno albo wklejenie ze schowka (Ctrl+V).
- SVG jest normalizowane: brakujące `width`/`height` uzupełniamy z `viewBox`
  (i odwrotnie), bo bez nich część przeglądarek rysuje SVG w canvasie jako nic.
- Przy rastrze mniejszym niż 512 px pojawia się ostrzeżenie, że duże rozmiary
  (512, 1024) będą rozmyte.

### Ustawienia (sidebar)

| Sekcja | Co ustawia |
| --- | --- |
| **Pozycja** | wyrównanie z siatki 3×3 (lewo / środek / prawo × góra / środek / dół), rozmiar, odstęp od krawędzi, obrót |
| **Tło** | kolor jednolity, gradient liniowy (dwa kolory + kąt) albo brak tła |
| **Kolor ikonki** | przebarwienie całej ikonki na jeden kolor (dla SVG domyślnie włączone, dla rastra działa po kanale alfa) |
| **Kształt** | zaokrąglenie 0–50% (presety: kwadrat, lekki, iOS, koło) oraz grubość i kolor obramowania |
| **Aplikacja** | nazwa, nazwa krótka i theme color — trafiają do `site.webmanifest` i `head.html` |
| **Paczka** | które grupy plików mają się znaleźć w ZIP-ie |

Każdy suwak ma obok pole, w które można wpisać wartość z palca (przecinek też
działa, wartość spoza zakresu jest przycinana). Strzałki góra/dół zmieniają ją
o 1, z Shiftem o 10. Ustawienia, wybrane grupy i plik źródłowy (do 2 MB)
zostają w przeglądarce po odświeżeniu strony.

### Przekształcenia na podglądzie

Kliknięcie ikonki na dużym podglądzie (albo jej miniatury w sidebarze) pokazuje
ramkę jak w edytorze grafiki:

- przeciągnięcie środka — przesunięcie,
- narożniki — skalowanie od środka,
- uchwyt nad ramką — obrót (z Shiftem co 15°),
- pasek pod podglądem — zoom −/+, obrót o ±90°, odbicie w poziomie i w pionie,
  reset,
- klawiatura — strzałki (z Shiftem większy krok), `+`/`−`, `[`/`]`, Esc.

Odbicie działa w układzie ekranu: „w poziomie” zawsze znaczy lewo/prawo, także
przy obróconej ikonce.

### Podgląd

- duży podgląd na szachownicy, jasnym lub czarnym tle,
- rząd rozmiarów 16–128 px w skali 1:1,
- makiety: karta przeglądarki, ekran domowy iOS, Android adaptive icon (maska
  koła i squircle), PWA maskable ze strefą bezpieczną,
- siatka **wszystkich** generowanych plików pogrupowana platformami — kliknięcie
  kafelka pobiera pojedynczy plik, małe rozmiary są powiększone bez
  wygładzania, żeby było widać każdy piksel.

## Zawartość paczki

Pliki strony WWW leżą w katalogu głównym ZIP-a (do skopiowania do `public/`),
pliki aplikacji natywnych — w katalogach platform.

| Grupa | Pliki |
| --- | --- |
| **Favicon** | `favicon.ico` (16/32/48 w jednym pliku), `favicon.svg`, `favicon-16x16.png` … `favicon-96x96.png` |
| **Apple touch icon** | `apple-touch-icon.png` 180×180 |
| **PWA** | `web-app-manifest-192x192.png`, `-512x512.png` (purpose `any`), wersje `maskable`, `site.webmanifest` |
| **Android** | `android/res/mipmap-{mdpi…xxxhdpi}/` — `ic_launcher`, `ic_launcher_round`, warstwy adaptive icon `ic_launcher_foreground`, `_background`, `_monochrome`; `mipmap-anydpi-v26/*.xml`; `android/play-store-512.png` |
| **iOS / App Store** | `ios/AppIcon.appiconset/` — 13 rozmiarów od 20 do 1024 px + `Contents.json` |
| **macOS** | `macos/AppIcon.appiconset/` — 16–1024 px + `Contents.json` |
| **Windows** | `mstile-70x70.png`, `-150x150.png`, `-310x310.png`, `browserconfig.xml` |
| **Ikony ogólne** | `icons/icon-16x16.png` … `icon-1024x1024.png`, `icons/icon.svg` |
| zawsze | `head.html` (tagi `<link>`/`<meta>` do wklejenia), `README.md` z instrukcją instalacji |

Pełna paczka to 70 obrazów plus pliki konfiguracyjne.

## Jak to działa

**Jeden renderer, różne tryby.** Każdy plik w paczce to wpis w katalogu celów
(`lib/targets.ts`): ścieżka, rozmiar, format i *tryb renderowania*. Tryb mówi,
jak dana platforma traktuje ustawienia użytkownika:

| Tryb | Gdzie | Zachowanie |
| --- | --- | --- |
| `shape` | favicon, PWA `any`, ikony ogólne, launcher Androida, macOS | kształt użytkownika: zaokrąglenie, ramka, przezroczyste rogi |
| `round` | `ic_launcher_round` | jak `shape`, ale zawsze koło |
| `fullbleed` | iOS, App Store, apple-touch-icon, Google Play, PWA maskable | pełny kwadrat bez rogów i ramki — maskę nakłada system |
| `foreground` / `background` | warstwy adaptive icon, kafelki Windows | sama ikonka na przezroczystym tle / samo tło |
| `monochrome` | `ic_launcher_monochrome` | sylwetka ikonki dla ikon tematycznych Androida 13+ |

**Strefy bezpieczne.** Maskable PWA trzyma treść w kole 80% boku, a adaptive
icon Androida pokazuje 72 z 108 dp. Renderer dostaje skalę treści (`inset`)
i układa ikonkę w tym polu — również wyrównanie do krawędzi, więc ikonka
przyklejona do lewej nadal nie wypada poza widoczny obszar. macOS dostaje
kształt 824 px na płótnie 1024 px, zgodnie z szablonem Apple.

**PNG bez kanału alfa.** `canvas.toBlob` zawsze zapisuje RGBA, nawet gdy każdy
piksel jest kryjący, a App Store Connect odrzuca ikonę 1024 z kanałem alfa
niezależnie od jego zawartości. Dla celów nieprzezroczystych (iOS, App Store,
apple-touch-icon, Google Play) aplikacja ma własny koder PNG RGB
(`lib/encode.ts`), kompresujący przez natywne `CompressionStream`. Przy tle
„brak” te pliki dostają białe tło.

**ICO.** `favicon.ico` to kontener z trzema osadzonymi PNG (16, 32, 48) —
format obsługiwany przez wszystkie przeglądarki i Windows od Visty.

**SVG.** `favicon.svg` i `icon.svg` są składane jako wektor, a nie rastrowane:
źródłowe SVG wchodzi inline jako zagnieżdżony `<svg>` (favicon SVG działa
w trybie „secure static”, w którym zewnętrzne zasoby i tak by się nie
załadowały), przebarwienie realizuje filtr `feFlood` + `feComposite`,
zaokrąglenie — `clipPath`. Wynik zgadza się z wersją PNG co do piksela.

## Struktura

```
.
├── Dockerfile                 # targety: dev, builder, runner (standalone)
├── docker-compose.yml         # dev: bind mount + hot reload, port 3240
├── docker-compose.prod.yml    # produkcja za Traefikiem
├── .env                       # nazwa projektu, port, domena (bez sekretów)
└── app/                       # aplikacja Next.js 16
    ├── app/
    │   ├── layout.tsx         # motyw ciemny, pływający badge brewcode
    │   ├── page.tsx
    │   ├── icon.svg           # favicon samej aplikacji (logo z badge'a)
    │   ├── apple-icon.png
    │   └── api/health/        # sonda healthchecka
    ├── components/
    │   ├── Generator.tsx      # sidebar, podgląd, siatka plików
    │   ├── TransformOverlay.tsx  # ramka przekształceń na podglądzie
    │   ├── Mockups.tsx        # makiety przeglądarki, iOS, Androida, PWA
    │   ├── IconCanvas.tsx     # canvas renderujacy jeden cel
    │   ├── controls.tsx       # suwak z polem liczbowym, kolor, przełącznik
    │   ├── BrewcodeBadge.tsx
    │   └── ui/                # komponenty shadcn/ui (Radix)
    └── lib/
        ├── settings.ts        # model ustawień i grupy paczki
        ├── source.ts          # wczytywanie i normalizacja SVG/rastra
        ├── render.ts          # renderer canvas + składanie SVG
        ├── targets.ts         # katalog wszystkich plików + manifesty
        ├── encode.ts          # PNG RGB, ICO
        └── package.ts         # eksport pojedynczego pliku i ZIP
```

Stos: Next.js 16 (App Router, `output: "standalone"`), React 19, Tailwind 4,
shadcn/ui na Radix, lucide-react, JSZip. Menedżer pakietów: pnpm.

## Wdrożenie

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Obraz produkcyjny to target `runner`: Next w trybie standalone, proces jako
użytkownik `node`, limit pamięci 256 MB, healthcheck na
`http://127.0.0.1:3240/api/health`. Kontener nie wystawia portu — ruch wchodzi
przez Traefika, który już działa na serwerze. Wymagane w `.env`:

| Zmienna | Domyślnie | Znaczenie |
| --- | --- | --- |
| `APP_DOMAIN` | — (wymagana) | domena w regule routingu Traefika, obecnie `favicon.brwcd.dev` |
| `TRAEFIK_ENTRYPOINT` | `websecure` | entrypoint HTTPS Traefika |
| `TRAEFIK_CERT_RESOLVER` | `letsencrypt` | resolver certyfikatów |
| `TRAEFIK_NETWORK` | `web` | sieć Traefika (`external`, musi istnieć) |
| `COMPOSE_PROJECT_NAME` | `brewcode-favicon` | nazwa projektu compose |

Domena musi mieć rekord DNS wskazujący na serwer. Jeśli na maszynie nie ma
jeszcze Traefika, można go uruchomić z tego samego pliku profilem `own-proxy`
(wcześniej `docker network create web`). Build pobiera fonty Geist z Google
Fonts; w runtime aplikacja nie potrzebuje ruchu wychodzącego.
