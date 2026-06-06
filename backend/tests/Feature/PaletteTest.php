<?php

namespace Tests\Feature;

use App\Models\Palette;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaletteTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_a_palette(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/palettes', ['name' => 'Sunsets', 'description' => 'warm tones'])
            ->assertCreated()
            ->assertJson(['name' => 'Sunsets', 'colors_count' => 0]);

        $this->assertDatabaseHas('palettes', ['user_id' => $user->id, 'name' => 'Sunsets']);
    }

    public function test_can_add_and_remove_colors(): void
    {
        $user = User::factory()->create();
        $palette = Palette::factory()->for($user)->create();

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/palettes/{$palette->id}/colors", ['hex_id' => 16711680])
            ->assertOk();
        $this->assertDatabaseHas('palette_colors', ['palette_id' => $palette->id, 'hex_id' => 16711680]);

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/v1/palettes/{$palette->id}/colors/16711680")
            ->assertOk();
        $this->assertDatabaseMissing('palette_colors', ['palette_id' => $palette->id, 'hex_id' => 16711680]);
    }

    public function test_palette_is_capped_at_twelve_colors(): void
    {
        $user = User::factory()->create();
        $palette = Palette::factory()->for($user)->create();

        for ($i = 0; $i < 12; $i++) {
            $this->actingAs($user, 'sanctum')
                ->postJson("/api/v1/palettes/{$palette->id}/colors", ['hex_id' => 1000 + $i])
                ->assertOk();
        }

        // The 13th must be rejected.
        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/palettes/{$palette->id}/colors", ['hex_id' => 9999])
            ->assertStatus(422);

        $this->assertEquals(12, \DB::table('palette_colors')->where('palette_id', $palette->id)->count());
    }

    public function test_adding_same_color_twice_is_idempotent(): void
    {
        $user = User::factory()->create();
        $palette = Palette::factory()->for($user)->create();

        $this->actingAs($user, 'sanctum')->postJson("/api/v1/palettes/{$palette->id}/colors", ['hex_id' => 255])->assertOk();
        $this->actingAs($user, 'sanctum')->postJson("/api/v1/palettes/{$palette->id}/colors", ['hex_id' => 255])->assertOk();

        $this->assertEquals(1, \DB::table('palette_colors')->where('palette_id', $palette->id)->count());
    }

    public function test_cannot_modify_another_users_palette(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $palette = Palette::factory()->for($owner)->create();

        $this->actingAs($intruder, 'sanctum')
            ->postJson("/api/v1/palettes/{$palette->id}/colors", ['hex_id' => 100])
            ->assertNotFound();

        $this->actingAs($intruder, 'sanctum')
            ->deleteJson("/api/v1/palettes/{$palette->id}")
            ->assertNotFound();
    }

    public function test_private_palette_is_not_publicly_viewable(): void
    {
        $owner = User::factory()->create();
        $palette = Palette::factory()->for($owner)->create(['is_public' => false]);

        $this->getJson("/api/v1/palettes/{$palette->id}")->assertForbidden();
    }

    public function test_owner_can_delete_palette(): void
    {
        $user = User::factory()->create();
        $palette = Palette::factory()->for($user)->create();

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/v1/palettes/{$palette->id}")
            ->assertOk();

        $this->assertDatabaseMissing('palettes', ['id' => $palette->id]);
    }
}
