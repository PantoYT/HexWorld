# HexWorld — Dokumentacja Techniczna

## 1. Opis projektu

HexWorld to mobilna platforma społecznościowa oparta na mechanice odkrywania i kolekcjonowania kolorów. Aplikacja zawiera 16 777 216 unikalnych kolorów (przestrzeń barw RGB 8-bit) — każdy z nich jest indywidualnym obiektem społecznościowym, który użytkownik może odkryć, podpisać, polajkować i skomentować. Format interfejsu nawiązuje do TikToka: pionowy feed z gestami swipe.

---

## 2. Kluczowe założenia produktowe

- Każdy kolor istnieje w systemie dokładnie raz jako unikalny zasób.
- Feed główny nigdy nie powtarza kolorów — użytkownik widzi zawsze nowy kolor.
- Pierwszy użytkownik, który "odkryje" kolor (zatrzyma się na nim i wejdzie w interakcję), zostaje jego discovererem — może podpisać kolor własną nazwą lub tagline.
- Kolory nie znikają — trafią do profilu odkrywcy na zawsze i są dostępne przez history, liked i profil.
- Platforma obejmuje tryby dodatkowe: Color Matching, Color of the Day, Palettes, Challenge.

---

## 3. Architektura systemu

### 3.1 Stack technologiczny (propozycja)

| Warstwa | Technologia |
|---|---|
| Mobile app | React Native (Expo) lub Flutter |
| Backend API | Node.js + Fastify lub Go (Gin) |
| Baza danych główna | PostgreSQL |
| Cache / session | Redis |
| Kolejka zadań | BullMQ (Node) lub Temporal |
| Storage (media, avatary) | S3-compatible (AWS S3 / Cloudflare R2) |
| CDN | Cloudflare |
| Autentykacja | JWT + refresh tokens, OAuth (Google, Apple) |
| Real-time (powiadomienia, likes) | WebSockets (Socket.io) lub Server-Sent Events |
| Search | Meilisearch lub Elasticsearch (wyszukiwanie po nazwie koloru, hex) |

### 3.2 Schemat wysokopoziomowy

```
Mobile App (React Native / Flutter)
        │
        ▼
   API Gateway (REST + WebSocket)
        │
   ┌────┴────────────────┐
   │                     │
Auth Service        Color Service
   │                     │
   └──────────┬──────────┘
              │
         PostgreSQL
              │
         Redis Cache
```

---

## 4. Model danych

### 4.1 Tabela: `colors`

Centralna tabela — 16 777 216 wierszy, pre-populowana przy starcie systemu.

```sql
CREATE TABLE colors (
  hex_id        INT PRIMARY KEY,          -- 0 do 16777215 (obliczany z R*65536 + G*256 + B)
  hex_code      CHAR(6) NOT NULL UNIQUE,  -- np. "FF5733"
  r             SMALLINT NOT NULL,
  g             SMALLINT NOT NULL,
  b             SMALLINT NOT NULL,
  hue           FLOAT,                    -- obliczane przy insertach
  saturation    FLOAT,
  lightness     FLOAT,
  discovered_by UUID REFERENCES users(id),
  discovered_at TIMESTAMP,
  custom_name   VARCHAR(64),              -- nazwa nadana przez odkrywcę
  likes_count   INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  views_count   INT DEFAULT 0
);

CREATE INDEX idx_colors_hsl ON colors(hue, saturation, lightness);
CREATE INDEX idx_colors_discovered ON colors(discovered_by) WHERE discovered_by IS NOT NULL;
```

> **Uwaga implementacyjna:** 16.7M wierszy z pre-populacją to ~1.2 GB (szacunek). Indeksy HSL są kluczowe dla trybu Color Matching i algorytmu feed. Pre-populacja powinna odbywać się offline przed pierwszym deployem.

### 4.2 Tabela: `users`

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(32) UNIQUE NOT NULL,
  display_name  VARCHAR(64),
  avatar_url    TEXT,
  bio           VARCHAR(160),
  discovered_count INT DEFAULT 0,    -- denormalizacja dla szybkości
  followers_count  INT DEFAULT 0,
  following_count  INT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### 4.3 Tabela: `user_color_interactions`

```sql
CREATE TABLE user_color_interactions (
  user_id       UUID REFERENCES users(id),
  hex_id        INT REFERENCES colors(hex_id),
  liked         BOOLEAN DEFAULT FALSE,
  saved         BOOLEAN DEFAULT FALSE,
  viewed_at     TIMESTAMP,
  PRIMARY KEY (user_id, hex_id)
);
```

### 4.4 Tabela: `comments`

```sql
CREATE TABLE comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hex_id        INT REFERENCES colors(hex_id),
  user_id       UUID REFERENCES users(id),
  body          VARCHAR(280) NOT NULL,
  likes_count   INT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### 4.5 Tabela: `feed_state`

Śledzenie stanu feed dla każdego użytkownika — które kolory już widział.

```sql
CREATE TABLE feed_state (
  user_id       UUID REFERENCES users(id),
  last_hex_id   INT,                       -- ostatni wyświetlony kolor
  feed_mode     VARCHAR(32) DEFAULT 'random',  -- 'random', 'hsl_sequence', 'popular'
  updated_at    TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id)
);
```

> **Alternatywa dla feed_state:** Zamiast przechowywać pełną historię wyświetleń (kosztowne), można użyć probabilistycznej struktury danych — **Bloom Filter** w Redis. Fałszywie pozytywne pominięcia (~1%) są akceptowalne w produkcie tej skali.

---

## 5. Algorytm feedu

### 5.1 Zasada działania

Feed główny serwuje kolory nigdy niewyświetlane danemu użytkownikowi. Trzy strategie doboru:

1. **Random (default)** — losowy `hex_id` z puli niewidzianych. Prosto, ale nieefektywne przy dużym pokryciu użytkownika.
2. **HSL Sequence** — sekwencyjny spacer po przestrzeni barw (np. po hue od 0° do 360°, potem po lightness). Daje wrażenie "podróży przez kolory".
3. **Social/Trending** — premiuje kolory z wysokim wzrostem likes/views w ostatnich 24h, jeszcze nieodkryte przez użytkownika.

### 5.2 Implementacja (pseudokod)

```typescript
async function getNextColor(userId: string): Promise<Color> {
  const feedState = await redis.get(`feed:${userId}`);
  const seenFilter = await bloomFilter.get(userId);

  let candidate: Color | null = null;
  let attempts = 0;

  while (!candidate && attempts < 50) {
    const hexId = generateCandidate(feedState.mode, feedState.lastHexId);
    const alreadySeen = await seenFilter.has(hexId.toString());
    if (!alreadySeen) {
      candidate = await db.colors.findOne({ hex_id: hexId });
    }
    attempts++;
  }

  if (!candidate) {
    // fallback: likedBy others ale niewidziany
    candidate = await getFallbackColor(userId);
  }

  await seenFilter.add(candidate.hex_id.toString());
  await redis.set(`feed:${userId}`, { lastHexId: candidate.hex_id, mode: feedState.mode });

  return candidate;
}
```

### 5.3 Cold start (nowi użytkownicy)

Nowi użytkownicy nie mają historii — serwujemy:
- Pierwsze 10 kolorów: "ikoniczne" kolory (czerwony, niebieski, biały, czerń, pastele) — atrakcyjne wizualnie.
- Kolejne: random z seedem opartym na timestamp rejestracji.

---

## 6. Ekrany i nawigacja

### 6.1 Feed główny (Home)

- Fullscreen kolor (#hex_code jako tło)
- Overlay (bottom): hex code, nazwa koloru (jeśli nadana), discoverer badge
- Overlay (right): Like ♥, Comment 💬, Save 🔖, Share
- Overlay (top): profil odkrywcy + "FIRST DISCOVERY" badge jeśli to pierwsze wejście
- Gesture: swipe up = następny kolor, swipe down = poprzedni (z historii sesji), double tap = like
- Tap na hex code → kopiuje do schowka

### 6.2 Ekran szczegółowy koloru

Dostępny przez tap na "info" lub długi tap na ekranie feedu.

- Duży podgląd koloru
- Hex, RGB, HSL, CMYK (przeliczane on-the-fly)
- Discoverer: avatar, username, data odkrycia, custom name
- Similar colors: 5-8 sąsiednich kolorów (odległość euklidesowa w przestrzeni HSL)
- Palety: palety użytkowników zawierające ten kolor
- Komentarze (lazy-loaded)
- Przycisk "Add to my palette"

### 6.3 Profil użytkownika

- Header: avatar, bio, stats (discovered / followers / following)
- Tabs:
  - **Discovered** — siatka kolorów odkrytych przez użytkownika
  - **Liked** — siatka kolorów polajkowanych
  - **Palettes** — kolekcje użytkownika
- Tap na kolor w siatce → ekran szczegółowy

### 6.4 Historia

- Lista ostatnich N kolorów z bieżącej i poprzednich sesji
- Możliwość powrotu do każdego z nich
- Filtrowanie: wszystkie / tylko odkryte / tylko polajkowane

---

## 7. Tryby dodatkowe

### 7.1 Color of the Day

- Jeden kolor wybierany dziennie przez algorytm (lub kurację).
- Push notification o 9:00 czasu lokalnego użytkownika.
- Specjalny badge "CoTD" widoczny na kolorze przez 24h.
- Leaderboard komentarzy i likes dla CoTD.

**Algorytm wyboru CoTD:**
1. Losuj 100 kandydatów z nieodkrytych lub mało odkrytych kolorów.
2. Punktuj: różnorodność od wcześniejszych CoTD (odległość HSL) + sezonowość (np. ciepłe kolory latem).
3. Wybierz najwyżej punktowany.

### 7.2 Color Matching

Tryb gry: aplikacja pokazuje target color (swatch bez hex code), użytkownik musi znaleźć go w feedzie lub swipując po palecie. Scoring oparty na odległości deltaE (CIE76 lub CIE2000).

```typescript
function colorDistance(a: RGB, b: RGB): number {
  // Konwersja RGB → Lab, następnie deltaE CIE76
  const labA = rgbToLab(a);
  const labB = rgbToLab(b);
  return Math.sqrt(
    Math.pow(labA.L - labB.L, 2) +
    Math.pow(labA.a - labB.a, 2) +
    Math.pow(labA.b - labB.b, 2)
  );
}
```

Warianty:
- **Timed Match** — jak najbliżej w 30 sekund
- **Gradient Challenge** — ułóż 5 kolorów w kolejności gradientu
- **Name It** — pokaż hex, użytkownik zgaduje nazwę (Pantone, CSS, własne nazwy społeczności)

### 7.3 Palettes

Użytkownicy mogą tworzyć kolekcje kolorów (max 12 per paleta). Palety są publiczne lub prywatne. Funkcjonalność:
- Eksport: PNG swatch strip, JSON (`{ hex: string, name?: string }[]`)
- Integracja z Figma przez URL scheme
- "Remix" cudzej palety (fork z attribution)

---

## 8. System odkrywania (Discovery)

### 8.1 Warunki odkrycia

Kolor uznaje się za "odkryty" przez użytkownika gdy:
1. Kolor pojawił się w jego feedzie ORAZ
2. Użytkownik spędził na nim ≥ 2 sekundy LUB wykonał interakcję (like, komentarz, save)

To zapobiega przypadkowym odkryciom przez szybkie swipowanie.

### 8.2 First Discovery Flow

```
Użytkownik spełnił warunki odkrycia koloru nieodkrytego wcześniej
        ↓
Animacja "🎉 You discovered #A3F2BC!"
        ↓
Prompt: "Name this color (optional)"  [pole tekstowe, max 32 znaki]
        ↓
[Zapisz] → kolor.discovered_by = userId, kolor.custom_name = input
        ↓
Kolor pojawia się w profilu użytkownika w zakładce "Discovered"
        ↓
Opcjonalny push do followersów: "@username discovered #A3F2BC"
```

### 8.3 Re-discovery

Kolor już odkryty przez kogoś innego: brak specjalnej animacji, ale użytkownik widzi discoverer badge i może "visit" jego profil. Kolor trafia do historii przeglądania użytkownika.

---

## 9. API (REST)

### 9.1 Feed

```
GET /v1/feed/next
  Headers: Authorization: Bearer <token>
  Response: {
    hex_id: number,
    hex_code: string,
    r, g, b, h, s, l: number,
    custom_name: string | null,
    discovered_by: UserSummary | null,
    discovered_at: ISO8601 | null,
    likes_count: number,
    comments_count: number,
    is_liked: boolean,
    is_saved: boolean
  }
```

### 9.2 Interakcje

```
POST /v1/colors/:hexId/like
POST /v1/colors/:hexId/unlike
POST /v1/colors/:hexId/save
POST /v1/colors/:hexId/discover   body: { custom_name?: string }
GET  /v1/colors/:hexId/comments   query: { page, limit }
POST /v1/colors/:hexId/comments   body: { body: string }
```

### 9.3 Profil

```
GET /v1/users/:username
GET /v1/users/:username/discovered  query: { page, limit }
GET /v1/users/:username/liked       query: { page, limit }
GET /v1/users/:username/palettes
```

### 9.4 Tryby dodatkowe

```
GET /v1/color-of-the-day
GET /v1/matching/challenge          query: { mode: 'timed'|'gradient'|'name' }
POST /v1/matching/submit            body: { challenge_id, hex_id }
```

---

## 10. Wydajność i skalowalność

### 10.1 Kluczowe wyzwania

| Problem | Rozwiązanie |
|---|---|
| 16.7M wierszy w `colors` | Indeksy na hex_id (PK int), HSL; pre-populacja offline |
| Feed bez powtórzeń | Bloom Filter w Redis (~20 MB / user przy 16.7M bitach) |
| Like counter hotspot | Batched updates: Redis INCR → flush do PG co 30s |
| Cold start | 10 hard-coded "iconic" colors dla nowych użytkowników |
| Push notifications w skali | Firebase Cloud Messaging (FCM) |
| Wyszukiwanie po nazwie koloru | Meilisearch indeksujący `custom_name + hex_code` |

### 10.2 Szacunek pamięci Bloom Filter

```
n = 16 777 216 (elementy)
p = 0.01 (pożądany false positive rate 1%)
m = ceil(-n * ln(p) / (ln(2)^2)) ≈ 160 MB / user

# Przy 1% FPR:
# 1000 aktywnych userów = ~160 GB — za dużo

# Alternatywa: Scalable Bloom Filter (SBF) który startuje mały
# i rośnie tylko gdy potrzeba. Przy typowym użytkowniku
# (1000-10000 kolorów) zajmuje < 200 KB.
```

### 10.3 Strategia cachowania

```
Redis key patterns:
  color:{hexId}:meta          → TTL 1h   (dane koloru)
  color:{hexId}:likes         → TTL 5min (licznik, flush do PG)
  feed:{userId}:bloom         → TTL 30d  (Scalable Bloom Filter)
  feed:{userId}:state         → TTL 7d   (tryb, ostatni hex)
  cotd:current                → TTL do końca dnia UTC
```

---

## 11. Bezpieczeństwo

- JWT access token: TTL 15 min; refresh token: TTL 30d, httpOnly cookie
- Rate limiting: `/feed/next` max 10 req/s per user (anti-scraping)
- Odkrycie koloru: idempotentne (powielone requesty nie tworzą duplikatów) — unikalny constraint na `(discovered_by, hex_id)` nie jest potrzebny, wystarczy atomowy UPDATE z `WHERE discovered_by IS NULL`
- Moderacja komentarzy: OpenAI Moderation API lub własny classifier

```sql
-- Atomowe odkrycie koloru:
UPDATE colors
SET discovered_by = $userId, discovered_at = NOW(), custom_name = $name
WHERE hex_id = $hexId AND discovered_by IS NULL
RETURNING *;
-- Jeśli RETURNING jest puste → ktoś był szybszy, zwracamy aktualnego odkrywcę
```

---

## 12. Monetyzacja (opcjonalna warstwa)

| Feature | Model |
|---|---|
| HexWorld Pro | Subskrypcja: nieograniczone palety, eksport, statystyki profilu |
| Featured Colors | Sponsorowane kolory brandów (np. Coca-Cola Red, Tiffany Blue) |
| Color NFT | Opcjonalnie: mint odkrytego koloru jako NFT (ERC-1155) |
| Figma/Adobe plugin | Freemium: podstawowy eksport free, zaawansowany Pro |

---

## 13. Kolejność implementacji (MVP)

### Faza 1 — Core (8-12 tygodni)
1. Pre-populacja bazy 16.7M kolorów
2. Auth (rejestracja, login, OAuth)
3. Feed API z Bloom Filterem
4. Ekran feedu (fullscreen color + swipe)
5. System odkrycia (first discovery flow)
6. Like / Save / History
7. Profil użytkownika + zakładka Discovered

### Faza 2 — Social (4-6 tygodni)
1. Komentarze
2. Follow / Followers
3. Push notifications (CoTD, odkrycia followowanych)
4. Wyszukiwanie kolorów (hex, nazwa)

### Faza 3 — Tryby dodatkowe (6-8 tygodni)
1. Color of the Day
2. Color Matching
3. Palettes (tworzenie, eksport, remix)
4. Leaderboards

### Faza 4 — Monetyzacja i skalowalność
1. HexWorld Pro
2. Featured Colors
3. Horizontal scaling, CDN optymalizacja
4. Analytics dashboard

---

## 14. Otwarte pytania do decyzji

1. **Nazwa kolorów** — czy chcemy bazę nazw (CSS, Pantone, NCS) jako punkt startowy, czy czysto community-driven nazewnictwo?
2. **Usuwanie komentarzy** — czy odkrywca może moderować komentarze pod swoim kolorem?
3. **Transferowalność** — czy odkrycie można "przekazać" innemu użytkownikowi (np. jeśli konto jest usunięte)?
4. **Powtarzanie w feedzie po wyczerpaniu** — co gdy użytkownik odkryje wszystkie 16.7M kolorów? (Hipotetyczne, ale warte przemyślenia.)
5. **Web app** — czy MVP obejmuje wersję przeglądarkową, czy tylko mobile?
