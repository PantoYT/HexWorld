<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class FeedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Redis::flushdb(); // isolated test DB (REDIS_DB=15)
    }

    public function test_feed_requires_authentication(): void
    {
        $this->getJson('/api/v1/feed/next')->assertUnauthorized();
    }

    public function test_cold_start_serves_iconic_colors_first(): void
    {
        $user = User::factory()->create();

        // First three cold-start colors are red, green, blue.
        $expected = ['FF0000', '00FF00', '0000FF'];
        foreach ($expected as $hex) {
            $this->actingAs($user, 'sanctum')
                ->getJson('/api/v1/feed/next')
                ->assertOk()
                ->assertJson(['hex_code' => $hex]);
        }
    }

    public function test_feed_never_repeats_a_color(): void
    {
        $user = User::factory()->create();
        $seen = [];

        // Past the 10 cold-start colors into random territory.
        for ($i = 0; $i < 40; $i++) {
            $hexId = $this->actingAs($user, 'sanctum')
                ->getJson('/api/v1/feed/next')
                ->assertOk()
                ->json('hex_id');

            $this->assertArrayNotHasKey($hexId, $seen, "Feed repeated hex_id {$hexId} at iteration {$i}");
            $seen[$hexId] = true;
        }

        $this->assertCount(40, $seen);
    }

    public function test_feed_response_has_the_expected_shape(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/feed/next')
            ->assertOk()
            ->assertJsonStructure([
                'hex_id', 'hex_code', 'r', 'g', 'b', 'h', 's', 'l',
                'custom_name', 'likes_count', 'comments_count', 'views_count',
                'discovered_by', 'discovered_at', 'is_liked', 'is_saved',
            ]);
    }

    public function test_two_users_have_independent_feeds(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();

        // Both are cold-start, so both should see red first — feeds are per-user.
        $this->actingAs($a, 'sanctum')->getJson('/api/v1/feed/next')->assertJson(['hex_code' => 'FF0000']);
        $this->actingAs($b, 'sanctum')->getJson('/api/v1/feed/next')->assertJson(['hex_code' => 'FF0000']);
    }
}
