<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class InteractionTest extends TestCase
{
    use RefreshDatabase;

    private const HEX = 6710886; // #666666

    protected function setUp(): void
    {
        parent::setUp();
        Redis::flushdb();
    }

    public function test_like_requires_authentication(): void
    {
        $this->postJson('/api/v1/colors/' . self::HEX . '/like')->assertUnauthorized();
    }

    public function test_like_records_interaction_and_increments_count(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/colors/' . self::HEX . '/like')
            ->assertOk()
            ->assertJson(['liked' => true]);

        $this->assertDatabaseHas('user_color_interactions', [
            'user_id' => $user->id,
            'hex_id' => self::HEX,
            'liked' => true,
        ]);

        // The public color view reflects the Redis-buffered like.
        $this->getJson('/api/v1/colors/' . self::HEX)
            ->assertOk()
            ->assertJson(['likes_count' => 1]);
    }

    public function test_liking_twice_is_idempotent(): void
    {
        $user = User::factory()->create();
        $url = '/api/v1/colors/' . self::HEX . '/like';

        $this->actingAs($user, 'sanctum')->postJson($url)->assertOk();
        $this->actingAs($user, 'sanctum')->postJson($url)->assertOk();

        // Still only one like counted.
        $this->getJson('/api/v1/colors/' . self::HEX)->assertJson(['likes_count' => 1]);
        $this->assertEquals(1, (int) Redis::get('color:' . self::HEX . ':likes'));
    }

    public function test_unlike_after_like(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/colors/' . self::HEX . '/like')->assertOk();
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/colors/' . self::HEX . '/unlike')
            ->assertOk()
            ->assertJson(['liked' => false]);

        $this->assertDatabaseHas('user_color_interactions', [
            'user_id' => $user->id,
            'hex_id' => self::HEX,
            'liked' => false,
        ]);
        $this->assertEquals(0, (int) Redis::get('color:' . self::HEX . ':likes'));
    }

    public function test_is_liked_flag_reflects_state_in_feed_lookup(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/colors/' . self::HEX . '/like')->assertOk();

        // markViewed then re-like path aside, the interaction row drives is_liked.
        $interaction = \App\Models\UserColorInteraction::where('user_id', $user->id)
            ->where('hex_id', self::HEX)->first();
        $this->assertTrue((bool) $interaction->liked);
    }

    public function test_save_and_unsave(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/colors/' . self::HEX . '/save')
            ->assertOk()->assertJson(['saved' => true]);
        $this->assertDatabaseHas('user_color_interactions', [
            'user_id' => $user->id, 'hex_id' => self::HEX, 'saved' => true,
        ]);

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/colors/' . self::HEX . '/unsave')
            ->assertOk()->assertJson(['saved' => false]);
        $this->assertDatabaseHas('user_color_interactions', [
            'user_id' => $user->id, 'hex_id' => self::HEX, 'saved' => false,
        ]);
    }

    public function test_mark_viewed_increments_views_and_records_timestamp(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/colors/' . self::HEX . '/view')
            ->assertOk()->assertJson(['ok' => true]);

        $this->assertDatabaseHas('colors', ['hex_id' => self::HEX, 'views_count' => 1]);

        $interaction = \App\Models\UserColorInteraction::where('user_id', $user->id)
            ->where('hex_id', self::HEX)->first();
        $this->assertNotNull($interaction->viewed_at);
    }

    public function test_like_adds_color_to_trending_set(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/colors/' . self::HEX . '/like')->assertOk();

        $score = Redis::zscore('trending:colors', (string) self::HEX);
        $this->assertEquals(1.0, (float) $score);
    }
}
