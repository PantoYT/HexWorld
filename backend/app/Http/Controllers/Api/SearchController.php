<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Color;
use App\Services\ColorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $q = trim($request->query('q', ''));

        if (!$q) {
            return response()->json(['data' => []]);
        }

        // Exact hex match (#FF5733 or FF5733 or ff5733)
        $hex = strtoupper(ltrim($q, '#'));
        if (preg_match('/^[0-9A-F]{6}$/', $hex)) {
            $hexId = hexdec($hex);
            $data = ColorService::toArray($hexId);
            $color = Color::with('discoverer')->find($hexId);
            if ($color) {
                $data['custom_name'] = $color->custom_name;
                $data['likes_count'] = $color->likes_count;
                $data['discovered_by'] = $color->discoverer ? [
                    'id' => $color->discoverer->id,
                    'username' => $color->discoverer->username,
                    'display_name' => $color->discoverer->display_name,
                ] : null;
            }
            return response()->json(['data' => [$data], 'type' => 'exact_hex']);
        }

        // Search by custom name (community-given names)
        $colors = Color::with('discoverer')
            ->whereNotNull('custom_name')
            ->where('custom_name', 'ilike', "%{$q}%")
            ->orderByDesc('likes_count')
            ->limit(20)
            ->get();

        $results = $colors->map(function ($c) {
            $data = ColorService::toArray($c->hex_id);
            $data['custom_name'] = $c->custom_name;
            $data['likes_count'] = $c->likes_count;
            $data['discovered_by'] = $c->discoverer ? [
                'id' => $c->discoverer->id,
                'username' => $c->discoverer->username,
            ] : null;
            return $data;
        });

        return response()->json(['data' => $results, 'type' => 'name_search']);
    }
}
