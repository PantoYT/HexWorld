<?php

namespace Tests\Feature;

use App\Models\Color;
use App\Models\User;
use App\Services\ColorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class SearchAndCotdTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Redis::flushdb(); // CoTD caches in Redis, which RefreshDatabase doesn't roll back
    }

    public function test_exact_hex_search_accepts_multiple_formats(): void
    {
        foreach (['#FF5733', 'FF5733', 'ff5733'] as $q) {
            $res = $this->getJson('/api/v1/search?q=' . urlencode($q))->assertOk();
            $this->assertEquals('exact_hex', $res->json('type'));
            $this->assertEquals('FF5733', $res->json('data.0.hex_code'));
            $this->assertEquals(0xFF5733, $res->json('data.0.hex_id')); // 16734003
        }
    }

    public function test_name_search_matches_community_names_case_insensitively(): void
    {
        $user = User::factory()->create();
        // Seed a discovered, named color.
        Color::create(array_merge(ColorService::buildAttributes(255), [
            'discovered_by' => $user->id,
            'discovered_at' => now(),
            'custom_name' => 'Deep Ocean',
        ]));

        $res = $this->getJson('/api/v1/search?q=ocean')->assertOk();
        $this->assertEquals('name_search', $res->json('type'));
        $this->assertEquals('Deep Ocean', $res->json('data.0.custom_name'));
    }

    public function test_empty_query_returns_no_results(): void
    {
        $this->getJson('/api/v1/search?q=')->assertOk()->assertJson(['data' => []]);
    }

    public function test_color_of_the_day_is_deterministic_within_a_day(): void
    {
        $first = $this->getJson('/api/v1/color-of-the-day')->assertOk()->json('hex_id');
        $second = $this->getJson('/api/v1/color-of-the-day')->assertOk()->json('hex_id');

        $this->assertEquals($first, $second);
        $this->assertDatabaseHas('color_of_the_day', ['hex_id' => $first]);
    }

    public function test_color_of_the_day_history_returns_entries(): void
    {
        // Trigger today's pick so there's at least one row.
        $this->getJson('/api/v1/color-of-the-day')->assertOk();

        $this->getJson('/api/v1/color-of-the-day/history')
            ->assertOk()
            ->assertJsonStructure(['data' => [['hex_id', 'hex_code', 'cotd_date']]]);
    }
}
