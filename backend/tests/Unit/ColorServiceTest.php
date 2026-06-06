<?php

namespace Tests\Unit;

use App\Services\ColorService;
use PHPUnit\Framework\TestCase;

/**
 * Pure-math tests for ColorService. No database — every method under test is
 * static and derives its result from the integer hex_id alone. This is the
 * foundation the entire app relies on (lazy color init), so it's worth locking
 * down hard.
 */
class ColorServiceTest extends TestCase
{
    // ── hex_id ↔ RGB ──────────────────────────────────────────────────────────

    public function test_hex_id_from_rgb_packs_channels(): void
    {
        $this->assertSame(0xFF0000, ColorService::hexIdFromRgb(255, 0, 0));
        $this->assertSame(0x00FF00, ColorService::hexIdFromRgb(0, 255, 0));
        $this->assertSame(0x0000FF, ColorService::hexIdFromRgb(0, 0, 255));
        $this->assertSame(0xFFFFFF, ColorService::hexIdFromRgb(255, 255, 255));
        $this->assertSame(0x000000, ColorService::hexIdFromRgb(0, 0, 0));
    }

    public function test_rgb_from_hex_id_unpacks_channels(): void
    {
        $this->assertSame(['r' => 255, 'g' => 87, 'b' => 51], ColorService::rgbFromHexId(0xFF5733));
        $this->assertSame(['r' => 0, 'g' => 0, 'b' => 0], ColorService::rgbFromHexId(0x000000));
        $this->assertSame(['r' => 255, 'g' => 255, 'b' => 255], ColorService::rgbFromHexId(0xFFFFFF));
    }

    public function test_rgb_hexid_roundtrip_is_lossless(): void
    {
        foreach ([0, 1, 0x123456, 0xABCDEF, 0xFF5733, 16777215] as $id) {
            $rgb = ColorService::rgbFromHexId($id);
            $this->assertSame($id, ColorService::hexIdFromRgb($rgb['r'], $rgb['g'], $rgb['b']));
        }
    }

    // ── hex code formatting ───────────────────────────────────────────────────

    public function test_hex_code_is_uppercase_and_zero_padded(): void
    {
        $this->assertSame('000000', ColorService::hexCodeFromId(0));
        $this->assertSame('0000FF', ColorService::hexCodeFromId(255));
        $this->assertSame('FF5733', ColorService::hexCodeFromId(0xFF5733));
        $this->assertSame('FFFFFF', ColorService::hexCodeFromId(16777215));
        // Always 6 chars
        $this->assertSame(6, strlen(ColorService::hexCodeFromId(0xABC)));
    }

    // ── RGB → HSL ─────────────────────────────────────────────────────────────

    public function test_rgb_to_hsl_known_values(): void
    {
        $red = ColorService::rgbToHsl(255, 0, 0);
        $this->assertSame(0.0, $red['h']);
        $this->assertSame(100.0, $red['s']);
        $this->assertSame(50.0, $red['l']);

        $green = ColorService::rgbToHsl(0, 255, 0);
        $this->assertSame(120.0, $green['h']);

        $blue = ColorService::rgbToHsl(0, 0, 255);
        $this->assertSame(240.0, $blue['h']);

        // Greys have zero saturation
        $grey = ColorService::rgbToHsl(128, 128, 128);
        $this->assertSame(0.0, $grey['s']);

        // White and black sit at the lightness extremes
        $this->assertSame(100.0, ColorService::rgbToHsl(255, 255, 255)['l']);
        $this->assertSame(0.0, ColorService::rgbToHsl(0, 0, 0)['l']);
    }

    // ── toArray ───────────────────────────────────────────────────────────────

    public function test_to_array_is_db_free_and_complete(): void
    {
        $data = ColorService::toArray(0xFF5733);

        $this->assertSame(0xFF5733, $data['hex_id']);
        $this->assertSame('FF5733', $data['hex_code']);
        $this->assertSame(255, $data['r']);
        $this->assertSame(87, $data['g']);
        $this->assertSame(51, $data['b']);
        $this->assertArrayHasKey('h', $data);
        $this->assertArrayHasKey('s', $data);
        $this->assertArrayHasKey('l', $data);
    }

    // ── hslDistance ───────────────────────────────────────────────────────────

    public function test_hsl_distance_is_zero_for_identical_colors(): void
    {
        $hsl = ColorService::rgbToHsl(123, 45, 67);
        $this->assertSame(0.0, ColorService::hslDistance($hsl, $hsl));
    }

    public function test_hsl_distance_is_symmetric(): void
    {
        $a = ColorService::rgbToHsl(255, 0, 0);
        $b = ColorService::rgbToHsl(0, 0, 255);
        $this->assertEqualsWithDelta(
            ColorService::hslDistance($a, $b),
            ColorService::hslDistance($b, $a),
            1e-9
        );
    }

    public function test_hsl_distance_wraps_hue_circularly(): void
    {
        // Hue 359 and hue 1 are 2° apart, not 358°.
        $near359 = ['h' => 359, 's' => 50, 'l' => 50];
        $near1   = ['h' => 1,   's' => 50, 'l' => 50];
        $near180 = ['h' => 180, 's' => 50, 'l' => 50];

        $this->assertLessThan(
            ColorService::hslDistance($near359, $near180),
            ColorService::hslDistance($near359, $near1)
        );
    }

    // ── similarColors (the determinism fix) ───────────────────────────────────

    public function test_similar_colors_is_deterministic(): void
    {
        $a = ColorService::similarColors(0xFF5733, 8);
        $b = ColorService::similarColors(0xFF5733, 8);

        $idsA = array_column($a, 'hex_id');
        $idsB = array_column($b, 'hex_id');

        $this->assertSame($idsA, $idsB, 'similarColors must return the same result every call');
    }

    public function test_similar_colors_returns_requested_count(): void
    {
        $this->assertCount(8, ColorService::similarColors(0xFF5733, 8));
        $this->assertCount(5, ColorService::similarColors(0x336699, 5));
    }

    public function test_similar_colors_excludes_the_target(): void
    {
        $ids = array_column(ColorService::similarColors(0xFF5733, 8), 'hex_id');
        $this->assertNotContains(0xFF5733, $ids);
    }

    public function test_similar_colors_are_actually_near_in_hsl(): void
    {
        $targetHsl = ColorService::rgbToHsl(255, 87, 51); // #FF5733
        foreach (ColorService::similarColors(0xFF5733, 8) as $c) {
            $hsl = ['h' => $c['h'], 's' => $c['s'], 'l' => $c['l']];
            // Every neighbour should be comfortably closer than a random far color.
            $this->assertLessThan(0.6, ColorService::hslDistance($targetHsl, $hsl));
        }
    }
}
