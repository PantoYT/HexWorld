# HexWorld

A social platform for discovering and collecting colors. The entire 24-bit RGB
space — **16,777,216 colors** — is browsable as a TikTok-style vertical feed.
Stop on a color first and you become its **discoverer**; name it, and it's yours
forever. Like, comment, build palettes, play a color-matching game, and check
the daily **Color of the Day**.

> Built as a fully free-to-run stack: local Docker for dev, free tiers
> (Fly.io + Supabase + Upstash) for production.

---

## Architecture at a glance

```
mobile/   React Native (Expo) app  ─────HTTP/JSON────►  backend/  Laravel 12 API
                                                              │
                                                  PostgreSQL 16  +  Redis 7
                                                       (docker-compose.yml)
```

### The one idea that makes it cheap

Colors are **deterministic math**, never pre-populated. A color's hex code, RGB,
and HSL are all derived from its integer `hex_id` (`0..16777215`) on the fly. A
row is written to the `colors` table **only** when a color is first interacted
with (discovered, liked, commented, saved). So the database stays tiny instead
of holding 16.7M rows — this is what keeps it inside free DB tiers.

Key backend pieces (`backend/app/Services/`):

| Service | Responsibility |
|---|---|
| `ColorService` | `hexId ↔ RGB ↔ HSL` math, lazy `findOrCreate()`, deterministic `similarColors()` |
| `FeedService` | Per-user Redis Bloom filter (no repeats), cold-start iconic colors, 3 feed modes |
| `ColorOfTheDayService` | Seeded daily pick — seasonal hue bias + diversity + undiscovered bonus |

Discovery is race-safe via an atomic Postgres
`INSERT … ON CONFLICT (hex_id) DO UPDATE … WHERE discovered_by IS NULL`, using
`xmax` to tell the first discoverer from everyone else.

---

## Prerequisites

- **Docker** (for PostgreSQL + Redis)
- **PHP 8.2+** with **`pdo_pgsql`** and **`pgsql`** extensions enabled
  (see the gotcha below) and **Composer**
- **Node.js 18+** and **npm**

### ⚠️ PHP pgsql extension gotcha

Laravel talks to Postgres through `pdo_pgsql`. On a stock XAMPP/Windows PHP it's
shipped but commented out. Enable both lines in your `php.ini`:

```ini
extension=pdo_pgsql
extension=pgsql
```

Verify:

```bash
php -m | grep pgsql      # should list both pdo_pgsql and pgsql
```

Without this you'll get `could not find driver` on the first migration.

---

## Running locally

### 1. Infrastructure (Postgres + Redis)

```bash
docker compose up -d
docker compose ps          # both containers should be "healthy"
```

### 2. Backend (Laravel API)

```bash
cd backend
composer install
cp .env.example .env       # already wired for pgsql :5432 + redis :6379
php artisan key:generate
php artisan migrate
php artisan serve --port=8000
```

API is now at `http://localhost:8000/api/v1`. Health check: `http://localhost:8000/up`.

Optional background workers:

```bash
php artisan schedule:work   # flush-likes every minute, pick CoTD daily 00:01 UTC
```

### 3. Mobile app (Expo)

```bash
cd mobile
npm install
npx expo start             # then press "w" for web, or scan the QR on a device
```

**API base URL** is auto-selected in `mobile/src/api/client.ts`:

| Target | Base URL |
|---|---|
| Web (`expo start --web`) | `http://localhost:8000` |
| Android emulator | `http://10.0.2.2:8000` |
| Physical device | change to your machine's LAN IP |

---

## API surface (`/api/v1`)

| Method | Route | Auth | Purpose |
|---|---|:--:|---|
| POST | `/auth/register`, `/auth/login` | — | Sign up / in (Sanctum token) |
| GET | `/auth/me`, POST `/auth/logout` | ✓ | Session |
| GET | `/feed/next?mode=` | ✓ | Next unseen color (Bloom-filtered) |
| GET | `/colors/{hexId}` | — | Color detail + similar colors |
| POST | `/colors/{hexId}/discover` | ✓ | Claim a color (atomic, first-wins) |
| POST | `/colors/{hexId}/like` · `/unlike` · `/save` · `/unsave` · `/view` | ✓ | Interactions |
| GET/POST/DELETE | `/colors/{hexId}/comments` | mixed | Comments |
| GET | `/search?q=` | — | Exact hex or community-name search |
| GET | `/trending`, `/discoveries/recent`, `/history` | mixed | Discovery surfaces |
| GET | `/color-of-the-day`, `/color-of-the-day/history` | — | Daily color |
| GET/POST/DELETE | `/palettes`, `/palettes/{id}/colors`, … | ✓ | Palettes (max 12 colors) |
| GET/POST | `/users/{username}`, `/users/{username}/follow`, … | mixed | Profiles & social |

Rate limits (Redis fixed-window, per user): feed 60/min, like 120/min, default 300/min.

---

## Mobile tabs

| Tab | Screen | What it does |
|---|---|---|
| ⬡ Explore | `FeedScreen` | Fullscreen swipe feed, double-tap like, 2s auto-discover prompt |
| 🔍 Search | `SearchScreen` | Hex/name search + Trending & Recently Discovered strips |
| ✦ Today | `ColorOfTheDayScreen` | Daily color, countdown, tappable past-colors history |
| 🎯 Match | `ChallengeScreen` | 5-round color-matching game scored by ΔE (CIE76) |
| ▦ Palettes | `PalettesScreen` | Create palettes, swatch grids, share/export |
| ◉ Profile | `ProfileScreen` | Avatar, stats, Discovered / Liked color grids |

---

## Tech stack

**Backend:** PHP 8.2 · Laravel 12 · Sanctum (UUID token morphs) · PostgreSQL 16 ·
Redis 7 (predis) · scheduled console commands.

**Mobile:** React Native · Expo SDK 56 · TypeScript · React Navigation
(stack + bottom tabs) · Zustand (auth) · Axios · AsyncStorage / SecureStore.

**Free production target:** Fly.io (API) · Supabase (Postgres) · Upstash (Redis) ·
Cloudflare R2 (media) · Firebase FCM (push).
