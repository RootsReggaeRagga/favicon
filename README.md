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
sekretów. Plik `.env` w roocie zawiera wyłącznie nazwę projektu, port, domenę,
ustawienia Traefika i identyfikator Google Analytics (jawny — i tak widać go
w źródle każdej strony), dlatego jest w repozytorium.

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

- **Plik:** SVG, PNG, JPG lub WebP — kliknięcie przycisku „Zmień”, przeciągnięcie
  pliku na okno albo wklejenie ze schowka (Ctrl+V).
- **Litera / emoji:** wpisujesz np. „B”, „AB” albo 🍺, wybierasz krój (Geist,
  szeryfowy, mono, zaokrąglony) i pogrubienie. Litera jest czarna, kolor nadaje
  przebarwienie; emoji zachowują swoje barwy (przebarwienie wyłącza się samo).
- SVG jest normalizowane: brakujące `width`/`height` uzupełniamy z `viewBox`
  (i odwrotnie), bo bez nich część przeglądarek rysuje SVG w canvasie jako nic.
- SVG jest też **czyszczone**: znikają skrypty, `foreignObject`, handlery `on*`,
  linki `javascript:` i odwołania do zewnętrznych zasobów (także `@import`
  i `url()` w stylach). Paczka trafia do cudzych projektów i nie powinna nic
  takiego przenosić.
- Przy rastrze mniejszym niż 512 px pojawia się ostrzeżenie, że duże rozmiary
  (512, 1024) będą rozmyte.

### Ustawienia (sidebar)

| Sekcja | Co ustawia |
| --- | --- |
| **Pozycja** | wyrównanie z siatki 3×3 (lewo / środek / prawo × góra / środek / dół), rozmiar, odstęp od krawędzi, obrót |
| **Tło** | kolor jednolity, gradient liniowy (dwa kolory + kąt) albo brak tła |
| **Kolor ikonki** | przebarwienie całej ikonki na jeden kolor (dla SVG domyślnie włączone, dla rastra działa po kanale alfa) |
| **Kształt** | zaokrąglenie 0–50% (presety: kwadrat, lekki, iOS, koło) oraz grubość i kolor obramowania |
| **Cień** | cień pod ikonką: kolor, krycie, rozmycie, przesunięcie w dół |
| **Małe rozmiary (≤ 48 px)** | osobna kompozycja dla favicon 16–48 px, `favicon.svg` i najmniejszych ikon: własny rozmiar ikonki, opcjonalnie bez ramki |
| **Tryb ciemny** | wariant `favicon.svg` dla `prefers-color-scheme: dark` (tło i kolor ikonki); kolor ikonki trafia też do ciemnej ikony iOS 18 |
| **Aplikacja** | nazwa, nazwa krótka i theme color — trafiają do `site.webmanifest` i `head.html` |
| **Paczka** | które grupy plików mają się znaleźć w ZIP-ie |
| **Projekt** | zapis i wczytanie wszystkich ustawień razem z ikoną źródłową (`brewcode-favicon.json`) |

Każdy suwak ma obok pole, w które można wpisać wartość z palca (przecinek też
działa, wartość spoza zakresu jest przycinana). Strzałki góra/dół zmieniają ją
o 1, z Shiftem o 10. Ustawienia, wybrane grupy i plik źródłowy (do 2 MB)
zostają w przeglądarce po odświeżeniu strony.

**Cofanie:** Ctrl+Z / Ctrl+Shift+Z (albo Ctrl+Y) i przyciski na pasku pod
podglądem. Zmiany w odstępie krótszym niż 0,4 s łączą się w jeden krok, więc
przeciągnięcie suwaka albo ikonki to jedno cofnięcie, a nie sto. Historia
obejmuje ustawienia (nie wymianę pliku źródłowego), do 100 kroków.

**Plik projektu:** `brewcode-favicon.json` zapisuje ustawienia, wybrane grupy
i ikonę źródłową. Ten sam plik jest w każdej paczce ZIP — żeby poprawić ikony po
czasie, wystarczy go wczytać („Wczytaj” albo upuszczenie na okno). Nieznane pola
są pomijane, brakujące uzupełniane domyślnymi.

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
- makiety: karta przeglądarki w motywie jasnym i ciemnym, ekran domowy iOS,
  iOS 18 (jasna / ciemna / tinted), Android adaptive icon (maska koła
  i squircle), powiadomienie Androida, PWA maskable ze strefą bezpieczną,
- siatka **wszystkich** generowanych plików pogrupowana platformami — kliknięcie
  kafelka pobiera pojedynczy plik, małe rozmiary są powiększone bez
  wygładzania, żeby było widać każdy piksel.

Na telefonie pełny podgląd jest pod ustawieniami, więc u góry ekranu wisi
przypięty skrót (ikonka, 16/32/48 px, cofanie), a przycisk pobierania jest
przyklejony do dołu.

## Zawartość paczki

Pliki strony WWW leżą w katalogu głównym ZIP-a (do skopiowania do `public/`),
pliki aplikacji natywnych — w katalogach platform.

| Grupa | Pliki |
| --- | --- |
| **Favicon** | `favicon.ico` (16/32/48 w jednym pliku), `favicon.svg`, `favicon-16x16.png` … `favicon-96x96.png` |
| **Apple touch icon** | `apple-touch-icon.png` 180×180 |
| **PWA** | `web-app-manifest-192x192.png`, `-512x512.png` (purpose `any`), wersje `maskable`, `site.webmanifest` |
| **Android** | `android/res/mipmap-{mdpi…xxxhdpi}/` — `ic_launcher`, `ic_launcher_round`, warstwy adaptive icon `ic_launcher_foreground`, `_background`, `_monochrome`; `mipmap-anydpi-v26/*.xml`; ikona powiadomień `drawable-{…}/ic_stat_notification.png` (24 dp, biała sylwetka); `android/play-store-512.png` |
| **iOS / App Store** | `ios-18/AppIcon.appiconset/` — format Xcode 16: 1024 px w wersji jasnej, ciemnej i tinted; `ios/AppIcon.appiconset/` — klasyczny komplet 13 rozmiarów 20–1024 px. Każdy z `Contents.json`, do projektu idzie jeden z nich |
| **macOS** | `macos/AppIcon.appiconset/` — 16–1024 px + `Contents.json` |
| **Windows** | `mstile-70x70.png`, `-150x150.png`, `-310x310.png`, `browserconfig.xml` |
| **Ekrany startowe iOS** | `splash/apple-splash-{w}x{h}.png` — 19 urządzeń (iPhone SE → 16 Pro Max, iPady), orientacja pionowa, tagi `apple-touch-startup-image` w `head.html` |
| **Ikony ogólne** | `icons/icon-16x16.png` … `icon-1024x1024.png`, `icons/icon.svg` |
| zawsze | `head.html` (tagi `<link>`/`<meta>` do wklejenia), `README.md` z instrukcją instalacji, `brewcode-favicon.json` (projekt do ponownego wczytania) |

Pełna paczka to 97 obrazów plus pliki konfiguracyjne.

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
| `monochrome` | `ic_launcher_monochrome`, `ic_stat_notification` | biała sylwetka (ikony tematyczne Androida 13+, powiadomienia) |
| `dark` | iOS 18 ciemna | ikonka na przezroczystym tle — ciemne tło dokłada system |
| `tinted` | iOS 18 tinted | ikonka w skali szarości na czerni — kolor nakłada system |
| `splash` | ekrany startowe iOS | tło na cały ekran (przy „brak tła” — theme color), ikonka na środku |

Cel może też **narzucić ustawienia** (`override`): ikona powiadomień jest zawsze
wycentrowana i wypełnia obszar 22 z 24 dp, niezależnie od kompozycji. Kompozycja
małych rozmiarów działa tak samo — renderer podmienia skalę i ramkę, gdy
rysowany rozmiar nie przekracza 48 px.

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
zaokrąglenie — `clipPath`, cień — `feDropShadow`. Wariant ciemny to blok
`@media (prefers-color-scheme: dark)` w samym pliku SVG, podmieniający
wypełnienie tła i kolor przebarwienia. Wynik zgadza się z wersją PNG (różnice
poniżej 0,1% pikseli, głównie na krawędziach cienia).

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
    │   ├── useHistory.ts      # cofanie / ponawianie ustawień
    │   ├── BrewcodeBadge.tsx
    │   └── ui/                # komponenty shadcn/ui (Radix)
    └── lib/
        ├── settings.ts        # model ustawień i grupy paczki
        ├── source.ts          # wczytywanie i normalizacja SVG/rastra
        ├── render.ts          # renderer canvas + składanie SVG
        ├── targets.ts         # katalog wszystkich plików + manifesty
        ├── encode.ts          # PNG RGB, ICO
        ├── package.ts         # eksport pojedynczego pliku, ZIP, plik projektu
        └── *.test.ts          # testy Vitest
```

Stos: Next.js 16 (App Router, `output: "standalone"`), React 19, Tailwind 4,
shadcn/ui na Radix, lucide-react, JSZip, Vitest. Menedżer pakietów: pnpm.

## Google Analytics

Opcjonalne. Identyfikator strumienia GA4 wpisujesz w `.env`:

```bash
GA_MEASUREMENT_ID=G-XXXXXXXXXX     # puste = GA wyłączone, skrypt się nie ładuje
```

Zmienna jest czytana **w runtime** (layout renderuje się na żądanie przez
`connection()`), a nie wkompilowywana przy buildzie jak `NEXT_PUBLIC_*` — po
zmianie wystarczy odtworzyć kontener (`docker compose up -d`), bez przebudowy
obrazu. Wartość musi mieć format `G-…`, inaczej GA się nie włączy.

Skrypt ładuje oficjalny komponent `GoogleAnalytics` z `@next/third-parties`.
Poza odsłonami aplikacja wysyła zdarzenia pobierania (`lib/analytics.ts`):

| Zdarzenie | Kiedy | Parametry |
| --- | --- | --- |
| `download_package` | pobranie paczki ZIP | `file_count`, `group_count`, `groups` (np. `android,favicon,ios`), `source_type`, `size_kb` |
| `download_file` | kliknięcie kafelka — pojedynczy plik | `file_name` (ścieżka w paczce), `file_group`, `source_type` |
| `download_project` | „Zapisz ustawienia” | `source_type` |

`source_type` to `svg`, `png` (raster) albo `text` (litera / emoji). Żeby
parametry były widoczne w raportach GA4, zarejestruj je w panelu jako
wymiary niestandardowe (Administracja → Definicje niestandardowe), a liczby
(`file_count`, `size_kb`) jako dane niestandardowe.

## Testy

```bash
cd app
pnpm test
```

Vitest sprawdza to, czego pomyłka kończy się odrzuceniem przez platformę albo
cichym błędem u użytkownika:

- koder PNG RGB (sygnatura, CRC chunków, brak kanału alfa, spłaszczanie
  półprzezroczystości) i kontener ICO,
- katalog rozmiarów: unikalne ścieżki, `Contents.json` iOS / iOS 18 / macOS
  wskazujące istniejące pliki o właściwych wymiarach, kryjące cele App Store,
  manifest PWA, tagi ekranów startowych w `head.html`,
- sanityzację SVG, wariant ciemny i cień w `favicon.svg`, kompozycję małych
  rozmiarów i scalanie ustawień ze starszych zapisów.

Te same testy uruchamia build obrazu Docker (`RUN pnpm test` przed
`next build`) — czerwony test zatrzymuje wdrożenie.

## Wdrożenie

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Obraz produkcyjny (target `runner`, Next standalone, ok. 40 MB RAM w pracy)
stoi za Traefikiem działającym na serwerze, pod `APP_DOMAIN` z `.env`. Pełna
instrukcja — wymagania, konfiguracja, TLS, aktualizacja, rollback, monitoring
i rozwiązywanie problemów — jest w **[DEPLOY.md](DEPLOY.md)**.
