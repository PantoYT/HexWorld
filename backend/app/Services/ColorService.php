<?php

namespace App\Services;

use App\Models\Color;

class ColorService
{
    public static function hexIdFromRgb(int $r, int $g, int $b): int
    {
        return ($r << 16) | ($g << 8) | $b;
    }

    public static function rgbFromHexId(int $hexId): array
    {
        return [
            'r' => ($hexId >> 16) & 0xFF,
            'g' => ($hexId >> 8) & 0xFF,
            'b' => $hexId & 0xFF,
        ];
    }

    public static function rgbToHsl(int $r, int $g, int $b): array
    {
        $r /= 255;
        $g /= 255;
        $b /= 255;

        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $l = ($max + $min) / 2;

        if ($max === $min) {
            return ['h' => 0, 's' => 0, 'l' => round($l * 100, 2)];
        }

        $d = $max - $min;
        $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);

        $h = match ($max) {
            $r => (($g - $b) / $d + ($g < $b ? 6 : 0)) / 6,
            $g => (($b - $r) / $d + 2) / 6,
            default => (($r - $g) / $d + 4) / 6,
        };

        return [
            'h' => round($h * 360, 2),
            's' => round($s * 100, 2),
            'l' => round($l * 100, 2),
        ];
    }

    public static function hexCodeFromId(int $hexId): string
    {
        return strtoupper(str_pad(dechex($hexId), 6, '0', STR_PAD_LEFT));
    }

    /**
     * Returns Color model — creates the DB row on first access (lazy init).
     * Colors are mathematically deterministic so we never pre-populate.
     */
    public static function findOrCreate(int $hexId): Color
    {
        return Color::firstOrCreate(
            ['hex_id' => $hexId],
            self::buildAttributes($hexId)
        );
    }

    public static function buildAttributes(int $hexId): array
    {
        $rgb = self::rgbFromHexId($hexId);
        $hsl = self::rgbToHsl($rgb['r'], $rgb['g'], $rgb['b']);

        return [
            'hex_id' => $hexId,
            'hex_code' => self::hexCodeFromId($hexId),
            'r' => $rgb['r'],
            'g' => $rgb['g'],
            'b' => $rgb['b'],
            'hue' => $hsl['h'],
            'saturation' => $hsl['s'],
            'lightness' => $hsl['l'],
        ];
    }

    /**
     * Returns full color data as array (for API responses).
     * Works without a DB row — computes everything from hex_id.
     */
    public static function toArray(int $hexId): array
    {
        $rgb = self::rgbFromHexId($hexId);
        $hsl = self::rgbToHsl($rgb['r'], $rgb['g'], $rgb['b']);

        return [
            'hex_id' => $hexId,
            'hex_code' => self::hexCodeFromId($hexId),
            'r' => $rgb['r'],
            'g' => $rgb['g'],
            'b' => $rgb['b'],
            'h' => $hsl['h'],
            's' => $hsl['s'],
            'l' => $hsl['l'],
        ];
    }

    /**
     * Euclidean distance in HSL space (for similar colors).
     */
    public static function hslDistance(array $a, array $b): float
    {
        $dh = min(abs($a['h'] - $b['h']), 360 - abs($a['h'] - $b['h'])) / 180;
        $ds = ($a['s'] - $b['s']) / 100;
        $dl = ($a['l'] - $b['l']) / 100;

        return sqrt($dh ** 2 + $ds ** 2 + $dl ** 2);
    }

    /**
     * Returns N nearest colors in HSL space — deterministic.
     *
     * Instead of random sampling, we perturb the target's RGB channels across a
     * fixed grid of offsets. This produces genuinely similar colors and returns
     * the same result for the same hex_id on every call.
     */
    public static function similarColors(int $hexId, int $count = 8): array
    {
        $rgb = self::rgbFromHexId($hexId);
        $hsl = self::rgbToHsl($rgb['r'], $rgb['g'], $rgb['b']);

        // Structured offsets per channel: small + medium steps in both directions.
        $offsets = [-48, -32, -20, -10, 10, 20, 32, 48];

        $candidates = [];
        foreach ($offsets as $dr) {
            foreach ($offsets as $dg) {
                foreach ($offsets as $db) {
                    $r = max(0, min(255, $rgb['r'] + $dr));
                    $g = max(0, min(255, $rgb['g'] + $dg));
                    $b = max(0, min(255, $rgb['b'] + $db));

                    $candidateId = self::hexIdFromRgb($r, $g, $b);
                    if ($candidateId === $hexId || isset($candidates[$candidateId])) {
                        continue;
                    }

                    $cHsl = self::rgbToHsl($r, $g, $b);
                    $candidates[$candidateId] = self::hslDistance($hsl, $cHsl);
                }
            }
        }

        asort($candidates);

        return array_map(
            fn($id) => self::toArray($id),
            array_slice(array_keys($candidates), 0, $count)
        );
    }
}
