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

        // Ensure the row exists (lazy-init), then attempt an atomic claim:
        // the WHERE discovered_by IS NULL guarantees only one concurrent caller
        // can ever flip an unclaimed color to claimed.
        ColorService::findOrCreate($hexId);

        $claimed = DB::table('colors')
            ->where('hex_id', $hexId)
            ->whereNull('discovered_by')
            ->update([
                'discovered_by' => $user->id,
                'discovered_at' => now(),
                'custom_name' => $data['custom_name'] ?? null,
            ]);

        // $claimed === 1 means THIS request won the color (net-new discovery).
        if ($claimed === 1) {
            $user->increment('discovered_count');
        }

        $color = Color::find($hexId);
        // True when the caller owns the color — including a no-op re-discover
        // by the same user — but discovered_count was only bumped above on the
        // net-new claim, so repeat calls never inflate it.
        $isFirstDiscoverer = $color && $color->discovered_by === $user->id;

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
        // Ensure the color row exists first — a fresh color viewed in the feed
        // has no row yet, and the interaction FK + views_count both need one.
        ColorService::findOrCreate($hexId);

        DB::table('user_color_interactions')->upsert(
            ['user_id' => $request->user()->id, 'hex_id' => $hexId, 'viewed_at' => now(), 'liked' => false, 'saved' => false, 'created_at' => now(), 'updated_at' => now()],
            ['user_id', 'hex_id'],
            ['viewed_at', 'updated_at']
        );

        Color::where('hex_id', $hexId)->increment('views_count');

        return response()->json(['ok' => true]);
    }
}
