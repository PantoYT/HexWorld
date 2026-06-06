<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentTest extends TestCase
{
    use RefreshDatabase;

    private const HEX = 8421504; // #808080

    public function test_posting_a_comment_creates_it_and_bumps_the_count(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/colors/' . self::HEX . '/comments', ['body' => 'Lovely grey'])
            ->assertCreated()
            ->assertJson(['body' => 'Lovely grey', 'user' => ['username' => $user->username]]);

        $this->assertDatabaseHas('colors', ['hex_id' => self::HEX, 'comments_count' => 1]);
        $this->assertDatabaseHas('comments', ['hex_id' => self::HEX, 'body' => 'Lovely grey']);
    }

    public function test_comments_are_listed_newest_first(): void
    {
        $user = User::factory()->create();
        $url = '/api/v1/colors/' . self::HEX . '/comments';

        $this->actingAs($user, 'sanctum')->postJson($url, ['body' => 'first'])->assertCreated();
        $this->actingAs($user, 'sanctum')->postJson($url, ['body' => 'second'])->assertCreated();

        $res = $this->getJson($url)->assertOk();
        $this->assertEquals('second', $res->json('data.0.body'));
        $this->assertEquals('first', $res->json('data.1.body'));
        $this->assertEquals(2, $res->json('meta.total'));
    }

    public function test_deleting_own_comment_decrements_the_count(): void
    {
        $user = User::factory()->create();
        $url = '/api/v1/colors/' . self::HEX . '/comments';

        $id = $this->actingAs($user, 'sanctum')->postJson($url, ['body' => 'oops'])->json('id');
        $this->assertDatabaseHas('colors', ['hex_id' => self::HEX, 'comments_count' => 1]);

        $this->actingAs($user, 'sanctum')->deleteJson("{$url}/{$id}")->assertOk();

        $this->assertDatabaseMissing('comments', ['id' => $id]);
        $this->assertDatabaseHas('colors', ['hex_id' => self::HEX, 'comments_count' => 0]);
    }

    public function test_cannot_delete_another_users_comment(): void
    {
        $author = User::factory()->create();
        $intruder = User::factory()->create();
        $url = '/api/v1/colors/' . self::HEX . '/comments';

        $id = $this->actingAs($author, 'sanctum')->postJson($url, ['body' => 'mine'])->json('id');

        $this->actingAs($intruder, 'sanctum')->deleteJson("{$url}/{$id}")->assertNotFound();
        $this->assertDatabaseHas('comments', ['id' => $id]);
        // Count untouched.
        $this->assertDatabaseHas('colors', ['hex_id' => self::HEX, 'comments_count' => 1]);
    }

    public function test_empty_and_overlong_comments_are_rejected(): void
    {
        $user = User::factory()->create();
        $url = '/api/v1/colors/' . self::HEX . '/comments';

        $this->actingAs($user, 'sanctum')->postJson($url, ['body' => ''])->assertStatus(422);
        $this->actingAs($user, 'sanctum')->postJson($url, ['body' => str_repeat('x', 281)])->assertStatus(422);
    }

    public function test_posting_requires_authentication(): void
    {
        $this->postJson('/api/v1/colors/' . self::HEX . '/comments', ['body' => 'hi'])
            ->assertUnauthorized();
    }
}
