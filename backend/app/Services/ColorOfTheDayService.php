<?php

namespace App\Services;

use App\Models\Color;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class ColorOfTheDayService
{
    /**
     * Returns today's Color of the Day.
     * If not yet selected, picks one automatically.
     */
    public static function getOrPick(\DateTimeInterface $date = null): array
    {
        $date = $date ?? now();
        $y = (int) $date->format('Y');
        $m = (int) $date->format('n');
        $d = (int) $date->format('j');

        // Check Redis cache first (TTL until midnight)
        $cacheKey = "cotd:{$y}-{$m}-{$d}";
        $cached = Redis::get($cacheKey);
        if ($cached) return json_decode($cached, true);

        // Check DB
        $row = DB::table('color_of_the_day')
            ->where(['year' => $y, 'month' => $m, 'day' => $d])
            ->first();

        if (!$row) {
            $hexId = self::pick($y, $m, $d);
            $row = DB::table('color_of_the_day')
                ->where(['year' => $y, 'month' => $m, 'day' => $d])
                ->first();
        }

        $data = ColorService::toArray($row->hex_id);
        $color = Color::with('discoverer')->find($row->hex_id);
        if ($color) {
            $data['custom_name'] = $color->custom_name;
            $data['likes_count'] = $color->likes_count;
            $data['discovered_by'] = $color->discoverer
                ? ['id' => $color->discoverer->id, 'username' => $color->discoverer->username]
                : null;
        }
        $data['cotd_date'] = "{$y}-{$m}-{$d}";
        $data['score'] = $row->score;

        // Cache until midnight UTC
        $secondsUntilMidnight = strtotime('tomorrow') - time();
        Redis::setex($cacheKey, $secondsUntilMidnight, json_encode($data));

        return $data;
    }

    /**
     * Scoring algorithm:
     * - Prefers colors not picked recently (HSL distance from last 7 days)
     * - Seasonal bias: warmer hues in summer months, cooler in winter
     * - Slight preference for undiscovered colors (virginity bonus)
     */
    public static function pick(int $year, int $month, int $day): int
    {
        // Get last 7 CoTDs to avoid repetition
        $recent = DB::table('color_of_the_day')
            ->orderByRaw('year DESC, month DESC, day DESC')
            ->limit(7)
            ->pluck('hex_id')
            ->toArray();

        // Season: northern hemisphere
        $seasonalHue = match(true) {
            $month >= 3 && $month <= 5  => 80,   // Spring: greens/yellows
            $month >= 6 && $month <= 8  => 30,   // Summer: warm oranges
            $month >= 9 && $month <= 11 => 20,   // Autumn: reds/oranges
            default                     => 210,  // Winter: blues/purples
        };

        // Generate 200 candidates and score them
        $best = null;
        $bestScore = -1;

        for ($i = 0; $i < 200; $i++) {
            // Seeded random so same day always produces same result
            $seed = crc32("{$year}-{$month}-{$day}-{$i}") & 0x7FFFFFFF;
            $hexId = $seed % 16777216;

            if (in_array($hexId, $recent)) continue;

            $rgb = ColorService::rgbFromHexId($hexId);
            $hsl = ColorService::rgbToHsl($rgb['r'], $rgb['g'], $rgb['b']);

            // Skip very dark or very light colors
            if ($hsl['l'] < 15 || $hsl['l'] > 85) continue;
            // Skip very desaturated
            if ($hsl['s'] < 20) continue;

            // Seasonal score: closer hue to season = higher score
            $hueDiff = min(abs($hsl['h'] - $seasonalHue), 360 - abs($hsl['h'] - $seasonalHue));
            $seasonScore = 1 - ($hueDiff / 180);

            // Diversity score: distance from recent picks
            $diversityScore = 1.0;
            foreach ($recent as $recentId) {
                $rRgb = ColorService::rgbFromHexId($recentId);
                $rHsl = ColorService::rgbToHsl($rRgb['r'], $rRgb['g'], $rRgb['b']);
                $dist = ColorService::hslDistance($hsl, $rHsl);
                $diversityScore = min($diversityScore, $dist);
            }

            // Undiscovered bonus
            $isDiscovered = Color::where('hex_id', $hexId)->whereNotNull('discovered_by')->exists();
            $discoveryBonus = $isDiscovered ? 0 : 0.2;

            $score = ($seasonScore * 0.4) + ($diversityScore * 0.4) + $discoveryBonus;

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $hexId;
            }
        }

        $hexId = $best ?? rand(0, 16777215);

        DB::table('color_of_the_day')->insertOrIgnore([
            'year' => $year, 'month' => $month, 'day' => $day,
            'hex_id' => $hexId, 'score' => $bestScore,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $hexId;
    }
}
