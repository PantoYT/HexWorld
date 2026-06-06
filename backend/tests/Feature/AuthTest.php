<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_returns_a_usable_token(): void
    {
        $res = $this->postJson('/api/v1/auth/register', [
            'username' => 'colorfan',
            'email' => 'fan@example.com',
            'password' => 'password123',
            'display_name' => 'Color Fan',
        ]);

        $res->assertCreated()
            ->assertJsonStructure(['user' => ['id', 'username', 'email'], 'token']);

        $token = $res->json('token');
        $userId = $res->json('user.id');

        // Regression guard: the id must be a real UUID, not an empty string,
        // and the freshly-issued token must authenticate against /me.
        $this->assertNotEmpty($userId);
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $userId);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJson(['id' => $userId, 'username' => 'colorfan']);
    }

    public function test_register_defaults_display_name_to_username(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'username' => 'nodisplay',
            'email' => 'nd@example.com',
            'password' => 'password123',
        ])->assertCreated()->assertJson(['user' => ['display_name' => 'nodisplay']]);
    }

    public function test_register_rejects_duplicate_username_and_email(): void
    {
        User::factory()->create(['username' => 'taken', 'email' => 'taken@example.com']);

        $this->postJson('/api/v1/auth/register', [
            'username' => 'taken',
            'email' => 'taken@example.com',
            'password' => 'password123',
        ])->assertStatus(422)->assertJsonValidationErrors(['username', 'email']);
    }

    public function test_register_rejects_short_password_and_bad_username(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'username' => 'has spaces!',
            'email' => 'x@example.com',
            'password' => 'short',
        ])->assertStatus(422)->assertJsonValidationErrors(['username', 'password']);
    }

    public function test_login_succeeds_with_correct_credentials(): void
    {
        User::factory()->create([
            'email' => 'me@example.com',
            'password' => 'password123', // hashed by the model cast
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'me@example.com',
            'password' => 'password123',
        ])->assertOk()->assertJsonStructure(['user', 'token']);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create(['email' => 'me@example.com', 'password' => 'password123']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'me@example.com',
            'password' => 'wrongpass',
        ])->assertUnauthorized();
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }
}
