<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ColorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function show(string $username): JsonResponse
    {
        $user = User::where('username', $username)->firstOrFail();

        // Optional auth: resolves the bearer token even on this public route.
        $viewer = auth('sanctum')->user();
        $isSelf = $viewer && $viewer->id === $user->id;
        $isFollowing = $viewer && !$isSelf
            ? $viewer->following()->where('following_id', $user->id)->exists()
            : false;

        return response()->json([
            'id' => $user->id,
            'username' => $user->username,
            'display_name' => $user->display_name,
            'avatar_url' => $user->avatar_url,
            'bio' => $user->bio,
            'discovered_count' => $user->discovered_count,
            'followers_count' => $user->followers_count,
            'following_count' => $user->following_count,
            'is_self' => $isSelf,
            'is_following' => $isFollowing,
        ]);
    }

    public function discovered(string $username): JsonResponse
    {
        $user = User::where('username', $username)->firstOrFail();

        $colors = $user->discoveredColors()
            ->orderByDesc('discovered_at')
            ->paginate(24);

        return response()->json([
            'data' => $colors->map(fn($c) => array_merge(ColorService::toArray($c->hex_id), [
                'custom_name' => $c->custom_name,
                'discovered_at' => $c->discovered_at?->toISOString(),
                'likes_count' => $c->likes_count,
            ])),
            'meta' => [
                'current_page' => $colors->currentPage(),
                'last_page' => $colors->lastPage(),
                'total' => $colors->total(),
            ],
        ]);
    }

    public function liked(Request $request, string $username): JsonResponse
    {
        $user = User::where('username', $username)->firstOrFail();

        $interactions = $user->interactions()
            ->where('liked', true)
            ->with('color')
            ->latest()
            ->paginate(24);

        return response()->json([
            'data' => $interactions->map(fn($i) => array_merge(
                ColorService::toArray($i->hex_id),
                [
                    'custom_name' => $i->color?->custom_name,
                    'likes_count' => $i->color?->likes_count ?? 0,
                ]
            )),
            'meta' => [
                'current_page' => $interactions->currentPage(),
                'last_page' => $interactions->lastPage(),
            ],
        ]);
    }

    public function follow(Request $request, string $username): JsonResponse
    {
        $target = User::where('username', $username)->firstOrFail();
        $user = $request->user();

        if ($user->id === $target->id) {
            return response()->json(['message' => 'Cannot follow yourself'], 422);
        }

        if (!$user->following()->where('following_id', $target->id)->exists()) {
            $user->following()->attach($target->id);
            $user->increment('following_count');
            $target->increment('followers_count');
        }

        return response()->json(['following' => true]);
    }

    public function unfollow(Request $request, string $username): JsonResponse
    {
        $target = User::where('username', $username)->firstOrFail();
        $user = $request->user();

        if ($user->following()->where('following_id', $target->id)->exists()) {
            $user->following()->detach($target->id);
            $user->decrement('following_count');
            $target->decrement('followers_count');
        }

        return response()->json(['following' => false]);
    }
}
