# Wdrożenie

Instrukcja dla stacku produkcyjnego z `docker-compose.prod.yml`.

> **Czym ta aplikacja różni się od pozostałych projektów brewcode.**
> To najprostszy możliwy stack: jedna usługa, bez bazy, migracji, kolejek, kont,
> poczty i zadań cyklicznych. Ikony renderuje, koduje i pakuje do ZIP-a
> **przeglądarka użytkownika** — plik źródłowy nigdy nie trafia na serwer.
> Serwer tylko serwuje stronę i `/api/health`.
>
> Konsekwencje: kontener mieści się w 256 MB, **nie ma żadnych danych do
> backupu** i — inaczej niż w brewcode-maping — **nie jest potrzebny ruch
> wychodzący** w runtime. Internet jest potrzebny tylko przy buildzie (pnpm
> i fonty Geist z Google Fonts).

---

## 1. Wymagania

| Element | Wymóg |
|---|---|
| Docker | 24+ z pluginem Compose v2 |
| RAM | 256 MB limitu kontenera + zapas hosta; **build** potrzebuje ok. 1 GB |
| CPU | 1 rdzeń wystarcza |
| Dysk | min. 2 GB — obraz to ok. 380 MB, reszta to cache builda |
| Domena | rekord A/AAAA `favicon.brwcd.dev` na adres serwera |
| TLS | Let's Encrypt, wystawiany przez Traefika (§5) |
| Porty otwarte na świat | wyłącznie 80 i 443 (obsługuje je Traefik) |
| Ruch wychodzący | tylko przy buildzie: registry npm, `fonts.googleapis.com` |

Stack **nie wystawia** portu aplikacji na hosta — ruch wchodzi tylko przez
Traefika. Port `3240` istnieje wyłącznie w sieci docker.

---

## 2. Konfiguracja

```bash
git clone git@github.com:RootsReggaeRagga/favicon.git brewcode-favicon
cd brewcode-favicon
```

`.env` **jest w repozytorium** i nie ma w nim sekretów. Do sprawdzenia przed
pierwszym uruchomieniem:

```bash
COMPOSE_PROJECT_NAME=brewcode-favicon
APP_DOMAIN=favicon.brwcd.dev      # domena obsługiwana przez Traefika
# opcjonalnie, gdy Traefik na serwerze ma inne nazwy (§5):
# TRAEFIK_ENTRYPOINT=websecure
# TRAEFIK_CERT_RESOLVER=letsencrypt
# TRAEFIK_NETWORK=web
# APP_MEM_LIMIT=256m
```

- `GA_MEASUREMENT_ID` — identyfikator Google Analytics 4 (`G-…`). Puste
  wyłącza GA. Czytany w runtime, więc zmiana nie wymaga przebudowy — tylko
  odtworzenia kontenera (`docker compose -f docker-compose.prod.yml up -d`).
  Szczegóły i lista zdarzeń w README, sekcja „Google Analytics”.
- `APP_PORT` i `NODE_ENV=development` z `.env` dotyczą tylko stacku dev.
  W produkcji port nie jest publikowany, a `docker-compose.prod.yml` jawnie
  wymusza `NODE_ENV=production`.
- `COMPOSE_PROJECT_NAME` decyduje o nazwach kontenerów i sieci. Jeśli na
  jednej maszynie mają stać dwie instancje, każda musi mieć inną nazwę —
  inaczej `down` w jednym katalogu zabierze kontenery drugiego.
- Gdyby kiedyś doszedł sekret, nie dopisuj go do `.env` w repo, tylko trzymaj
  w osobnym pliku poza gitem.

---

## 3. Pierwsze uruchomienie

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

Kontener jest zdrowy, gdy `ps` pokazuje `healthy` (sonda co 30 s, pierwsza po
20 s). Sonda uderza w `http://127.0.0.1:3240/api/health` od środka kontenera,
więc nie zależy od DNS-u ani od Traefika.

### Test po wdrożeniu

```bash
APP_DOMAIN=favicon.brwcd.dev

# Sonda (spodziewane: {"ok":true})
curl -s https://$APP_DOMAIN/api/health; echo

# Strona i favicon aplikacji (spodziewane: 200 i 200)
curl -s -o /dev/null -w "strona: %{http_code}\n" https://$APP_DOMAIN/
curl -s -o /dev/null -w "ikona:  %{http_code}\n" https://$APP_DOMAIN/icon.svg

# HTTP przekierowuje na HTTPS (spodziewane: 301/308)
curl -s -o /dev/null -w "http:   %{http_code}\n" http://$APP_DOMAIN/
```

Potem w przeglądarce: otwórz domenę, kliknij **Pobierz paczkę ZIP** — paczka
powinna się pobrać w kilka sekund. Skoro generowanie dzieje się w przeglądarce,
błąd na tym etapie to błąd frontu (konsola przeglądarki), nie serwera.

---

## 4. Zależności zewnętrzne

**W runtime — żadnych po stronie serwera.** Aplikacja nie woła żadnego API,
nie pobiera fontów z zewnątrz (`next/font` osadza Geist w obrazie przy buildzie)
i działa też za zamkniętym egressem. Google Analytics (gdy ustawione
`GA_MEASUREMENT_ID`) ładuje i wysyła **przeglądarka użytkownika** prosto do
`googletagmanager.com` / `google-analytics.com` — serwer w tym nie pośredniczy.

**Przy buildzie** kontener `deps` pobiera paczki z registry npm, a `next build`
fonty z Google Fonts. Przed buildem stage `builder` uruchamia testy
(`pnpm test`) — jeśli któryś nie przejdzie, obraz nie powstaje, a działający
kontener zostaje nietknięty. Bez tego build się nie powiedzie — jeśli serwer nie ma
internetu, zbuduj obraz gdzie indziej i przenieś go `docker save` /
`docker load`.

---

## 5. Reverse proxy i TLS

Domyślnie stack **podłącza się do Traefika już działającego na serwerze** —
sam go nie uruchamia. Router i middleware nazywają się `favicon` /
`favicon-security`, więc nie kolidują z innymi projektami.

Do poprawnego wystawienia certyfikatu muszą być spełnione wszystkie warunki
naraz. Kolejność w tabeli to kolejność sprawdzania:

| Warunek | Gdzie ustawiony | Objaw braku |
|---|---|---|
| **Rekord A domeny wskazuje na serwer** | DNS, poza repo | ACME: `NXDOMAIN` / `invalid authorization` |
| Router na entrypoincie TLS | `TRAEFIK_ENTRYPOINT` | strona tylko po HTTP |
| TLS włączony na routerze | `traefik.http.routers.favicon.tls: "true"` | domyślny cert Traefika (`TRAEFIK DEFAULT CERT`) |
| Resolver o nazwie znanej Traefikowi | `TRAEFIK_CERT_RESOLVER` | j.w. — ACME nie startuje |
| Traefik ma jak dojść do kontenera | `networks: [proxy]` + `TRAEFIK_NETWORK` | 404 albo 502 |

> **Zacznij od DNS-u**, potem logi Traefika — mówią wprost, co jest nie tak:
>
> ```bash
> dig +short favicon.brwcd.dev                     # musi zwrócić IP serwera
> T=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /traefik/ {print $1; exit}')
> docker logs "$T" 2>&1 | grep -i favicon.brwcd.dev | tail -5
> ```
>
> Kontener Traefika na serwerze brewcode nazywa się `traefik-traefik-1`, nie
> `traefik` — `docker inspect traefik` trafia w **obraz** i zwraca mylący błąd
> `map has no entry for key "NetworkSettings"`. Stąd zmienna `$T` wyżej.

### Sieć

Traefik na serwerze brewcode stoi w trybie `host` i dosięga kontenerów po IP na
bridge'u, ale stack i tak dołącza się do sieci `web` (uzasadnienie w nagłówku
`docker-compose.prod.yml`). Sieć jest `external` — compose jej nie tworzy.
Sprawdzenie, gdy router zwraca 404 lub 502:

```bash
# W jakich sieciach jest Traefik
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$T"
# W jakich sieciach jest aplikacja (musi być wśród nich TRAEFIK_NETWORK)
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' \
  $(docker compose -f docker-compose.prod.yml ps -q app)
```

### Nazwy entrypointu i resolvera

Muszą zgadzać się z konfiguracją działającego Traefika:

```bash
docker inspect "$T" --format '{{range .Args}}{{println .}}{{end}}' \
  | grep -E 'entrypoints|certificatesresolvers'
```

Szukasz `--entrypoints.<NAZWA>.address=:443` oraz
`--certificatesresolvers.<NAZWA>.acme...` i wpisujesz te nazwy do
`TRAEFIK_ENTRYPOINT` i `TRAEFIK_CERT_RESOLVER`.

> Literówka w nazwie resolvera **nie jest błędem** dla Traefika — router po
> prostu nie dostaje certyfikatu. Dlatego w etykietach jest jawne `tls: "true"`:
> dostaniesz wtedy HTTPS z certyfikatem domyślnym (widoczne ostrzeżenie
> w przeglądarce) zamiast cichego HTTP.

### Weryfikacja certyfikatu

```bash
openssl s_client -connect favicon.brwcd.dev:443 -servername favicon.brwcd.dev </dev/null 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates
```

`issuer` = Let's Encrypt — w porządku. `TRAEFIK DEFAULT CERT` — ACME nie
wystartowało, wróć do tabeli wyżej. Jeśli certyfikat wystawił się źle (np. przed
poprawieniem DNS-u), Traefik nie spróbuje ponownie, dopóki wpis jest
w `acme.json` — procedura usunięcia wpisu jest w `DEPLOY.md` projektu
brewcode-maping (§5 „Wymuszenie ponownego wystawienia certyfikatu”). Uwaga:
skasowanie całego `acme.json` odnawia certyfikaty **wszystkich** aplikacji na
serwerze i liczy się do limitów Let's Encrypt.

### Gdy Traefika na serwerze nie ma

Jeśli to jedyna aplikacja na maszynie:

```bash
docker network create web          # sieć jest `external`, compose jej nie tworzy
echo 'ACME_EMAIL=ops@brwcd.dev' >> .env
docker compose -f docker-compose.prod.yml --profile own-proxy up -d --build
```

Profil dokłada kontener `traefik` z automatycznym TLS (TLS-ALPN). Zajmuje
porty 80 i 443, więc na serwerze z wieloma projektami **nie** uruchamiaj go
z tego pliku.

### Ograniczenie dostępu

Aplikacja nie ma kont — kto wejdzie na domenę, ten generuje ikony. Jeśli ma
być wewnętrzna, dołóż middleware Traefika (basic auth albo allowlista IP) do
etykiety `traefik.http.routers.favicon.middlewares` obok `favicon-security`.

---

## 6. Bezpieczeństwo

- Brak bazy, uploadu na serwer, sesji i ciasteczek. Plik wgrany przez
  użytkownika jest czytany wyłącznie w jego przeglądarce.
- Jedyna trasa serwerowa to `/api/health` — nie przyjmuje danych.
- Proces w kontenerze działa jako `node` (uid 1000), nie root.
- Identyfikator GA jest walidowany (`G-` + litery/cyfry), zanim trafi do skryptu
  inline — błędna wartość w `.env` po prostu wyłącza GA.
- Nagłówki HSTS, `nosniff`, `frameDeny` i `referrer-policy` ustawia middleware
  `favicon-security` zdefiniowany w `docker-compose.prod.yml`.

---

## 7. Aktualizacja

```bash
cd brewcode-favicon
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

Nie ma migracji ani kroku przygotowawczego — nowy kontener zastępuje stary,
przerwa to kilka sekund startu Next. Użytkownicy nie tracą ustawień, bo te są
w ich `localStorage`.

---

## 8. Rollback

```bash
git log --oneline -10                   # znajdź poprzednią wersję
git checkout <sha-lub-tag>
docker compose -f docker-compose.prod.yml up -d --build
# po naprawie wróć na gałąź:  git checkout main
```

Na serwerze nie ma stanu, więc rollback jest zawsze bezpieczny. Zapisane
w przeglądarce ustawienia są przy wczytaniu uzupełniane domyślnymi
(`{ ...DEFAULT_SETTINGS, ...zapisane }`), więc starsza wersja aplikacji otworzy
nowszy zapis bez błędu — najwyżej zignoruje nieznane pola.

---

## 9. Backup

**Nie ma czego backupować.** Żadnych wolumenów z danymi, żadnej bazy. Jedyny
wolumen to `traefik-certs` i tylko przy profilu `own-proxy` — certyfikaty i tak
wystawią się ponownie. Cały stan aplikacji to kod w repozytorium.

---

## 10. Monitoring

```bash
# Stan i zdrowie
docker compose -f docker-compose.prod.yml ps

# Zużycie zasobów
docker stats --no-stream $(docker compose -f docker-compose.prod.yml ps -q app)

# Logi (rotowane: 10 MB × 5 plików)
docker compose -f docker-compose.prod.yml logs -f --tail=100 app
```

Na co patrzeć:

- **Pamięć stale rosnąca ponad ~150 MB** — w normalnej pracy kontener zajmuje
  ok. 40 MB (zmierzone na obrazie `runner`). Serwer tylko serwuje statyczną
  stronę, więc rosnący ślad znaczy wyciek, nie obciążenie.
- **`unhealthy` przy działającej stronie** — sonda idzie na `127.0.0.1:3240`
  wewnątrz kontenera, więc to problem z samym procesem, nie z DNS-em ani proxy.

---

## 11. Checklista przed wpuszczeniem ludzi

- [ ] Rekord DNS `favicon.brwcd.dev` wskazuje na serwer
- [ ] `docker compose -f docker-compose.prod.yml ps` pokazuje `healthy`
- [ ] Testy `curl` z §3 zwracają spodziewane kody
- [ ] Certyfikat Let's Encrypt, HTTP przekierowuje na HTTPS
- [ ] W przeglądarce: podgląd się rysuje, wgranie własnego SVG działa
- [ ] **Pobierz paczkę ZIP** kończy się pobraniem pliku
- [ ] Jeśli instancja ma być wewnętrzna — middleware ograniczający dostęp (§5)

---

## 12. Rozwiązywanie problemów

| Objaw | Przyczyna | Co zrobić |
|---|---|---|
| `APP_DOMAIN jest wymagany …` przy `up` | brak `APP_DOMAIN` w `.env` | ustaw `APP_DOMAIN=favicon.brwcd.dev` |
| `network web declared as external, but could not be found` | sieć Traefika ma inną nazwę albo nie istnieje | ustaw `TRAEFIK_NETWORK` lub `docker network create web` |
| Build pada na `fonts.googleapis.com` | brak internetu przy buildzie | §4 — zbuduj gdzie indziej, `docker save`/`load` |
| Build pada z `Killed` / OOM | za mało RAM na `next build` | dołóż swap albo buduj na innej maszynie |
| `ERR_PNPM_WORKSPACE_CONFIG_MISMATCH` | brak `pnpm-workspace.yaml` w warstwie `deps` | plik musi być kopiowany razem z manifestami |
| Build pada na kroku `RUN pnpm test` | któryś test nie przechodzi — zmiana zepsuła paczkę | `cd app && pnpm test` lokalnie, popraw i wypchnij ponownie; stara wersja dalej działa |
| `"/srv/app/public": not found` | stary Dockerfile sprzed poprawki pustego `public/` | `git pull` — builder sam tworzy ten katalog |
| Traefik zwraca 404 | kontener poza siecią Traefika albo zła reguła `Host` | §5 „Sieć”, sprawdź `APP_DOMAIN` |
| Traefik zwraca 502 | zły port w `loadbalancer.server.port` | musi być `3240` |
| Certyfikat `TRAEFIK DEFAULT CERT` | zła nazwa resolvera | §5 „Nazwy entrypointu i resolvera” |
| Strona tylko po HTTP | router na złym entrypoincie | sprawdź `TRAEFIK_ENTRYPOINT` |
| ACME: `NXDOMAIN looking up A for …` | domena nie istnieje w DNS | dodaj rekord A na IP serwera |
| `docker inspect traefik` → `map has no entry for key "NetworkSettings"` | trafiłeś w obraz, nie kontener | użyj `traefik-traefik-1` / `$T` z §5 |
| Strona działa, ZIP się nie pobiera | błąd po stronie przeglądarki | konsola przeglądarki; serwer w generowaniu nie uczestniczy |
