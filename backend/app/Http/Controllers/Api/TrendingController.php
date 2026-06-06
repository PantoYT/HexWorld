<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Color;
use App\Services\ColorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class TrendingController extends Controller
{
    /**
     * Top trending colors by Redis sorted set (likes velocity).
     * Falls back to DB most-liked if Redis is empty.
     */
    public function trending(): JsonResponse
    {
        $hexIds = Redis::zrevrange('trending:colors', 0, 23);

        if (count($hexIds) >= 6) {
            $colors = collect($hexIds)->map(function ($hexId) {
                $data = ColorService::toArray((int) $hexId);
                $color = Color::with('discoverer')->find((int) $hexId);
                if ($color) {
                    $data['custom_name'] = $color->custom_name;
                    $data['likes_count'] = $color->likes_count + (int) Redis::get("color:{$hexId}:likes");
                    $data['discovered_by'] = $color->discoverer
                        ? ['id' => $color->discoverer->id, 'username' => $color->discoverer->username]
                        : null;
                }
                return $data;
            });
        } else {
            // Fallback: most liked from DB
            $colors = Color::with('discoverer')
                ->where('likes_count', '>', 0)
                ->orderByDesc('likes_count')
                ->limit(24)
                ->get()
                ->map(function ($c) {
                    $data = ColorService::toArray($c->hex_id);
                    $data['custom_name'] = $c->custom_name;
                    $data['likes_count'] = $c->likes_count;
                    $data['discovered_by'] = $c->discoverer
                        ? ['id' => $c->discoverer->id, 'username' => $c->discoverer->username]
                        : null;
                    return $data;
                });
        }

        return response()->json(['data' => $colors]);
    }

    /**
     * Current user's recently viewed colors.
     */
    public function history(Request $request): JsonResponse
    {
        $interactions = $request->user()
            ->interactions()
            ->whereNotNull('viewed_at')
            ->orderByDesc('viewed_at')
            ->limit(48)
            ->get();

        $data = $interactions->map(fn($i) => ColorService::toArray($i->hex_id));

        return response()->json(['data' => $data]);
    }

    /**
     * Recent discoveries by users the authenticated user follows.
     */
    public function followingDiscoveries(Request $request): JsonResponse
    {
        $followingIds = $request->user()->following()->pluck('users.id');

        if ($followingIds->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $colors = Color::with('discoverer')
            ->whereIn('discovered_by', $followingIds)
            ->orderByDesc('discovered_at')
            ->limit(24)
            ->get()
            ->map(function ($c) {
                $data = ColorService::toArray($c->hex_id);
                $data['custom_name'] = $c->custom_name;
                $data['likes_count'] = $c->likes_count;
                $data['discovered_at'] = $c->discovered_at?->toISOString();
                $data['discovered_by'] = $c->discoverer
                    ? ['id' => $c->discoverer->id, 'username' => $c->discoverer->username]
                    : null;
                return $data;
            });

        return response()->json(['data' => $colors]);
    }

    /**
     * Newly discovered colors (recently discovered, any user).
     */
    public function recentDiscoveries(): JsonResponse
    {
        $colors = Color::with('discoverer')
            ->whereNotNull('discovered_by')
            ->orderByDesc('discovered_at')
            ->limit(24)
            ->get()
            ->map(function ($c) {
                $data = ColorService::toArray($c->hex_id);
                $data['custom_name'] = $c->custom_name;
                $data['likes_count'] = $c->likes_count;
                $data['discovered_at'] = $c->discovered_at?->toISOString();
                $data['discovered_by'] = $c->discoverer
                    ? ['id' => $c->discoverer->id, 'username' => $c->discoverer->username]
                    : null;
                return $data;
            });

        return response()->json(['data' => $colors]);
    }
}
