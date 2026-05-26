<?php

namespace App\Services;

use App\Models\Color;
use App\Models\User;
use Illuminate\Support\Facades\Redis;

class FeedService
{
    private const TOTAL_COLORS = 16777216;
    private const BLOOM_TTL = 30 * 24 * 3600; // 30 days
    private const MAX_ATTEMPTS = 50;

    // Iconic colors shown to new users (cold start)
    private const ICONIC_HEX_IDS = [
        0xFF0000, // Red
        0x00FF00, // Green
        0x0000FF, // Blue
        0xFFFFFF, // White
        0x000000, // Black
        0xFFFF00, // Yellow
        0xFF00FF, // Magenta
        0x00FFFF, // Cyan
        0xFF6B6B, // Coral
        0x6BCB77, // Mint
    ];

    public function getNext(User $user, string $mode = 'random'): array
    {
        $bloomKey = "feed:{$user->id}:bloom";
        $stateKey = "feed:{$user->id}:state";

        $state = $this->getState($stateKey, $mode);

        // Cold start: serve iconic colors first
        if ($state['served_count'] < count(self::ICONIC_HEX_IDS)) {
            $hexId = self::ICONIC_HEX_IDS[$state['served_count']];
            $this->markSeen($bloomKey, $hexId);
            $this->incrementServed($stateKey, $state, $hexId);
            return $this->buildResponse($hexId, $user);
        }

        $candidate = null;
        $attempts = 0;

        while ($candidate === null && $attempts < self::MAX_ATTEMPTS) {
            $hexId = $this->generateCandidate($state);
            if (!$this->hasSeen($bloomKey, $hexId)) {
                $candidate = $hexId;
            }
            $attempts++;
        }

        // Fallback: pick random unseen (rare case after many views)
        if ($candidate === null) {
            $candidate = $this->fallback($user);
        }

        $this->markSeen($bloomKey, $candidate);
        $this->incrementServed($stateKey, $state, $candidate);

        return $this->buildResponse($candidate, $user);
    }

    private function generateCandidate(array $state): int
    {
        return match ($state['mode']) {
            'hsl_sequence' => $this->hslSequenceCandidate($state),
            'trending' => $this->trendingCandidate(),
            default => rand(0, self::TOTAL_COLORS - 1),
        };
    }

    private function hslSequenceCandidate(array $state): int
    {
        // Walk through hue space incrementally
        $lastHexId = $state['last_hex_id'] ?? 0;
        $rgb = ColorService::rgbFromHexId($lastHexId);
        $hsl = ColorService::rgbToHsl($rgb['r'], $rgb['g'], $rgb['b']);

        $newHue = fmod($hsl['h'] + 3.6, 360); // ~100 steps per full rotation
        $s = $hsl['s'] + (rand(-5, 5));
        $l = $hsl['l'] + (rand(-5, 5));

        $s = max(20, min(80, $s));
        $l = max(20, min(80, $l));

        return $this->hslToHexId($newHue, $s, $l);
    }

    private function trendingCandidate(): int
    {
        $trending = Redis::zrevrange('trending:colors', 0, 99);
        if (empty($trending)) {
            return rand(0, self::TOTAL_COLORS - 1);
        }
        return (int) $trending[array_rand($trending)];
    }

    private function fallback(User $user): int
    {
        // Return a color liked by others that this user hasn't seen
        $popular = Color::orderByDesc('likes_count')
            ->whereNotIn('hex_id', function ($q) use ($user) {
                $q->select('hex_id')
                    ->from('user_color_interactions')
                    ->where('user_id', $user->id);
            })
            ->value('hex_id');

        return $popular ?? rand(0, self::TOTAL_COLORS - 1);
    }

    private function buildResponse(int $hexId, User $user): array
    {
        $data = ColorService::toArray($hexId);

        // Load DB row only if it exists (avoids creating rows for every viewed color)
        $color = Color::find($hexId);
        if ($color) {
            $data['custom_name'] = $color->custom_name;
            $data['likes_count'] = $color->likes_count + (int) Redis::get("color:{$hexId}:likes");
            $data['comments_count'] = $color->comments_count;
            $data['views_count'] = $color->views_count;
            $data['discovered_by'] = $color->discoverer ? [
                'id' => $color->discoverer->id,
                'username' => $color->discoverer->username,
                'display_name' => $color->discoverer->display_name,
                'avatar_url' => $color->discoverer->avatar_url,
            ] : null;
            $data['discovered_at'] = $color->discovered_at?->toISOString();
        } else {
            $data['custom_name'] = null;
            $data['likes_count'] = 0;
            $data['comments_count'] = 0;
            $data['views_count'] = 0;
            $data['discovered_by'] = null;
            $data['discovered_at'] = null;
        }

        $interaction = $user->interactions()->where('hex_id', $hexId)->first();
        $data['is_liked'] = $interaction?->liked ?? false;
        $data['is_saved'] = $interaction?->saved ?? false;

        return $data;
    }

    // --- Bloom Filter (bit-array in Redis) ---

    private function hasSeen(string $key, int $hexId): bool
    {
        // Simple bit-based bloom filter: use 3 hash positions
        foreach ($this->bloomPositions($hexId) as $pos) {
            if (!Redis::getbit($key, $pos)) {
                return false;
            }
        }
        return true;
    }

    private function markSeen(string $key, int $hexId): void
    {
        foreach ($this->bloomPositions($hexId) as $pos) {
            Redis::setbit($key, $pos, 1);
        }
        Redis::expire($key, self::BLOOM_TTL);
    }

    private function bloomPositions(int $hexId): array
    {
        // m = 2^25 (~32M bits = 4MB per user, ~1% FPR for 16.7M elements)
        $m = 33554432;
        return [
            crc32((string) $hexId) % $m,
            abs(crc32('a' . $hexId)) % $m,
            abs(crc32('b' . $hexId)) % $m,
        ];
    }

    // --- State management ---

    private function getState(string $key, string $mode): array
    {
        $raw = Redis::get($key);
        if ($raw) {
            return json_decode($raw, true);
        }
        return ['mode' => $mode, 'last_hex_id' => 0, 'served_count' => 0];
    }

    private function incrementServed(string $key, array $state, int $hexId): void
    {
        $state['last_hex_id'] = $hexId;
        $state['served_count']++;
        Redis::setex($key, 7 * 24 * 3600, json_encode($state));
    }

    private function hslToHexId(float $h, float $s, float $l): int
    {
        $s /= 100;
        $l /= 100;

        $c = (1 - abs(2 * $l - 1)) * $s;
        $x = $c * (1 - abs(fmod($h / 60, 2) - 1));
        $m = $l - $c / 2;

        [$r, $g, $b] = match (true) {
            $h < 60  => [$c, $x, 0],
            $h < 120 => [$x, $c, 0],
            $h < 180 => [0, $c, $x],
            $h < 240 => [0, $x, $c],
            $h < 300 => [$x, 0, $c],
            default  => [$c, 0, $x],
        };

        return ColorService::hexIdFromRgb(
            (int) round(($r + $m) * 255),
            (int) round(($g + $m) * 255),
            (int) round(($b + $m) * 255),
        );
    }
}
