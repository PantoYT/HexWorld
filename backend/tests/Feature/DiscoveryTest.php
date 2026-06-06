<?php

namespace Tests\Feature;

use App\Models\Color;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DiscoveryTest extends TestCase
{
    use RefreshDatabase;

    private const HEX = 3368601; // #336699

    public function test_user_can_discover_an_undiscovered_color(): void
    {
        $user = User::factory()->create();

        $res = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/colors/" . self::HEX . "/discover", ['custom_name' => 'Ocean']);

        $res->assertOk()
            ->assertJson([
                'is_first_discoverer' => true,
                'color' => ['hex_code' => '336699', 'custom_name' => 'Ocean'],
            ]);

        $this->assertDatabaseHas('colors', [
            'hex_id' => self::HEX,
            'discovered_by' => $user->id,
            'custom_name' => 'Ocean',
        ]);

        $this->assertEquals(1, $user->fresh()->discovered_count);
    }

    public function test_second_user_cannot_steal_an_already_discovered_color(): void
    {
        $first = User::factory()->create();
        $second = User::factory()->create();

        // First user claims it.
        $this->actingAs($first, 'sanctum')
            ->postJson("/api/v1/colors/" . self::HEX . "/discover", ['custom_name' => 'Mine'])
            ->assertOk()
            ->assertJson(['is_first_discoverer' => true]);

        // Second user attempts the same color.
        $res = $this->actingAs($second, 'sanctum')
            ->postJson("/api/v1/colors/" . self::HEX . "/discover", ['custom_name' => 'Stolen']);

        $res->assertOk()->assertJson(['is_first_discoverer' => false]);

        // Ownership and name are unchanged; second user's count stays 0.
        $color = Color::find(self::HEX);
        $this->assertEquals($first->id, $color->discovered_by);
        $this->assertEquals('Mine', $color->custom_name);
        $this->assertEquals(0, $second->fresh()->discovered_count);
        $this->assertEquals(1, $first->fresh()->discovered_count);
    }

    public function test_rediscovering_your_own_color_does_not_double_count(): void
    {
        $user = User::factory()->create();
        $url = "/api/v1/colors/" . self::HEX . "/discover";

        $this->actingAs($user, 'sanctum')->postJson($url, ['custom_name' => 'First'])->assertOk();
        // Same user hits discover again — must not inflate discovered_count.
        $this->actingAs($user, 'sanctum')->postJson($url, ['custom_name' => 'Second'])
            ->assertOk()
            ->assertJson(['is_first_discoverer' => true]);

        $this->assertEquals(1, $user->fresh()->discovered_count);
        // The original name is preserved (you can't rename on re-discover).
        $this->assertEquals('First', Color::find(self::HEX)->custom_name);
    }

    public function test_discovery_requires_authentication(): void
    {
        $this->postJson("/api/v1/colors/" . self::HEX . "/discover")
            ->assertUnauthorized();
    }

    public function test_invalid_hex_id_is_rejected(): void
    {
        $user = User::factory()->create();
        // 16777216 is one past the valid range (0..16777215); route is whereNumber.
        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/colors/16777216/discover")
            ->assertNotFound();
    }
}
