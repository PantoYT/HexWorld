<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Color;
use App\Models\UserColorInteraction;
use App\Services\ColorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class ColorController extends Controller
{
    public function show(int $hexId): JsonResponse
    {
        if ($hexId < 0 || $hexId > 16777215) {
            return response()->json(['message' => 'Invalid color'], 404);
        }

        $data = ColorService::toArray($hexId);
        $color = Color::with('discoverer')->find($hexId);

        if ($color) {
            $data['custom_name'] = $color->custom_name;
            $data['likes_count'] = $color->likes_count + (int) Redis::get("color:{$hexId}:likes");
            $data['comments_count'] = $color->comments_count;
            $data['views_count'] = $color->views_count;
            $data['discovered_by'] = $color->discoverer ? [
                'id' => $color->discoverer->id,
                'username' => $color->discoverer->username,
                'display_name' => $color->discoverer->display_name,
                'avatar_url' => $color->discoverer->avatar_url,
                'discovered_at' => $color->discovered_at?->toISOString(),
            ] : null;
        } else {
            $data['custom_name'] = null;
            $data['likes_count'] = 0;
            $data['comments_count'] = 0;
            $data['views_count'] = 0;
            $data['discovered_by'] = null;
        }

        $data['similar'] = ColorService::similarColors($hexId, 8);

        return response()->json($data);
    }

    public function discover(Request $request, int $hexId): JsonResponse
    {
        if ($hexId < 0 || $hexId > 16777215) {
            return response()->json(['message' => 'Invalid color'], 404);
        }

        $data = $request->validate([
            'custom_name' => ['nullable', 'string', 'max:32'],
        ]);

        $user = $request->user();

        // Atomic discovery — only succeeds if not yet discovered
        $attrs = ColorService::buildAttributes($hexId);
        $attrs['discovered_by'] = $user->id;
        $attrs['discovered_at'] = now();
        $attrs['custom_name'] = $data['custom_name'] ?? null;

        $updated = DB::statement(
            'INSERT INTO colors (hex_id, hex_code, r, g, b, hue, saturation, lightness, discovered_by, discovered_at, custom_name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON CONFLICT (hex_id) DO UPDATE SET
               discovered_by = CASE WHEN colors.discovered_by IS NULL THEN EXCLUDED.discovered_by ELSE colors.discovered_by END,
               discovered_at = CASE WHEN colors.discovered_by IS NULL THEN EXCLUDED.discovered_at ELSE colors.discovered_at END,
               custom_name   = CASE WHEN colors.discovered_by IS NULL THEN EXCLUDED.custom_name   ELSE colors.custom_name   END,
               updated_at    = NOW()
             RETURNING (xmax = 0 OR (xmax <> 0 AND discovered_by = ?)) AS is_first_discoverer',
            [
                $attrs['hex_id'], $attrs['hex_code'], $attrs['r'], $attrs['g'], $attrs['b'],
                $attrs['hue'], $attrs['saturation'], $attrs['lightness'],
                $user->id, now(), $attrs['custom_name'],
                $user->id,
            ]
        );

        $color = Color::find($hexId);
        $isFirstDiscoverer = $color && $color->discovered_by === $user->id;

        if ($isFirstDiscoverer) {
            $user->increment('discovered_count');
        }

        return response()->json([
            'is_first_discoverer' => $isFirstDiscoverer,
            'color' => array_merge(ColorService::toArray($hexId), [
                'custom_name' => $color?->custom_name,
                'discovered_by' => $color?->discoverer ? [
                    'id' => $color->discoverer->id,
                    'username' => $color->discoverer->username,
                ] : null,
                'discovered_at' => $color?->discovered_at?->toISOString(),
            ]),
        ]);
    }

    public function like(Request $request, int $hexId): JsonResponse
    {
        ColorService::findOrCreate($hexId);

        $interaction = UserColorInteraction::where([
            'user_id' => $request->user()->id,
            'hex_id' => $hexId,
        ])->first();

        if (!$interaction) {
            DB::table('user_color_interactions')->insert([
                'user_id' => $request->user()->id,
                'hex_id' => $hexId,
                'liked' => true,
                'saved' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            Redis::incr("color:{$hexId}:likes");
            $score = (float) (Redis::zscore('trending:colors', (string) $hexId) ?? 0);
            Redis::zadd('trending:colors', $score + 1, (string) $hexId);
        } elseif (!$interaction->liked) {
            $interaction->update(['liked' => true]);
            Redis::incr("color:{$hexId}:likes");
            $score = (float) (Redis::zscore('trending:colors', (string) $hexId) ?? 0);
            Redis::zadd('trending:colors', $score + 1, (string) $hexId);
        }

        return response()->json(['liked' => true]);
    }

    public function unlike(Request $request, int $hexId): JsonResponse
    {
        $interaction = UserColorInteraction::where([
            'user_id' => $request->user()->id,
            'hex_id' => $hexId,
        ])->first();

        if ($interaction?->liked) {
            $interaction->update(['liked' => false]);
            Redis::decr("color:{$hexId}:likes");
        }

        return response()->json(['liked' => false]);
    }

    public function save(Request $request, int $hexId): JsonResponse
    {
        ColorService::findOrCreate($hexId);

        DB::table('user_color_interactions')->upsert(
            ['user_id' => $request->user()->id, 'hex_id' => $hexId, 'saved' => true, 'liked' => false, 'created_at' => now(), 'updated_at' => now()],
            ['user_id', 'hex_id'],
            ['saved', 'updated_at']
        );

        return response()->json(['saved' => true]);
    }

    public function unsave(Request $request, int $hexId): JsonResponse
    {
        DB::table('user_color_interactions')->where([
            'user_id' => $request->user()->id,
            'hex_id' => $hexId,
        ])->update(['saved' => false, 'updated_at' => now()]);

        return response()->json(['saved' => false]);
    }

    public function markViewed(Request $request, int $hexId): JsonResponse
    {
        DB::table('user_color_interactions')->upsert(
            ['user_id' => $request->user()->id, 'hex_id' => $hexId, 'viewed_at' => now(), 'liked' => false, 'saved' => false, 'created_at' => now(), 'updated_at' => now()],
            ['user_id', 'hex_id'],
            ['viewed_at', 'updated_at']
        );

        Color::where('hex_id', $hexId)->increment('views_count');

        return response()->json(['ok' => true]);
    }
}
