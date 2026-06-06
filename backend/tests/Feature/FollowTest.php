<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FollowTest extends TestCase
{
    use RefreshDatabase;

    public function test_following_updates_both_counts(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create(['username' => 'target']);

        $this->actingAs($a, 'sanctum')
            ->postJson('/api/v1/users/target/follow')
            ->assertOk()->assertJson(['following' => true]);

        $this->assertEquals(1, $a->fresh()->following_count);
        $this->assertEquals(1, $b->fresh()->followers_count);
        $this->assertDatabaseHas('follows', ['follower_id' => $a->id, 'following_id' => $b->id]);
    }

    public function test_following_twice_does_not_double_count(): void
    {
        $a = User::factory()->create();
        User::factory()->create(['username' => 'target']);

        $this->actingAs($a, 'sanctum')->postJson('/api/v1/users/target/follow')->assertOk();
        $this->actingAs($a, 'sanctum')->postJson('/api/v1/users/target/follow')->assertOk();

        $this->assertEquals(1, $a->fresh()->following_count);
        $this->assertEquals(1, User::where('username', 'target')->first()->followers_count);
    }

    public function test_unfollow_decrements_counts(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create(['username' => 'target']);

        $this->actingAs($a, 'sanctum')->postJson('/api/v1/users/target/follow')->assertOk();
        $this->actingAs($a, 'sanctum')->postJson('/api/v1/users/target/unfollow')
            ->assertOk()->assertJson(['following' => false]);

        $this->assertEquals(0, $a->fresh()->following_count);
        $this->assertEquals(0, $b->fresh()->followers_count);
        $this->assertDatabaseMissing('follows', ['follower_id' => $a->id, 'following_id' => $b->id]);
    }

    public function test_unfollow_when_not_following_is_a_noop(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create(['username' => 'target']);

        $this->actingAs($a, 'sanctum')->postJson('/api/v1/users/target/unfollow')->assertOk();

        // Counts must not go negative.
        $this->assertEquals(0, $a->fresh()->following_count);
        $this->assertEquals(0, $b->fresh()->followers_count);
    }

    public function test_cannot_follow_yourself(): void
    {
        $a = User::factory()->create(['username' => 'me']);

        $this->actingAs($a, 'sanctum')
            ->postJson('/api/v1/users/me/follow')
            ->assertStatus(422);

        $this->assertEquals(0, $a->fresh()->following_count);
    }

    public function test_show_reports_is_following_for_the_viewer(): void
    {
        $a = User::factory()->create();
        User::factory()->create(['username' => 'target']);

        // Before following.
        $this->actingAs($a, 'sanctum')->getJson('/api/v1/users/target')
            ->assertJson(['is_self' => false, 'is_following' => false]);

        $this->actingAs($a, 'sanctum')->postJson('/api/v1/users/target/follow')->assertOk();

        // After following.
        $this->actingAs($a, 'sanctum')->getJson('/api/v1/users/target')
            ->assertJson(['is_following' => true]);
    }

    public function test_show_reports_is_self_on_own_profile(): void
    {
        $a = User::factory()->create(['username' => 'me']);

        $this->actingAs($a, 'sanctum')->getJson('/api/v1/users/me')
            ->assertJson(['is_self' => true, 'is_following' => false]);
    }

    public function test_follow_requires_authentication(): void
    {
        User::factory()->create(['username' => 'target']);
        $this->postJson('/api/v1/users/target/follow')->assertUnauthorized();
    }
}
