<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Color;
use App\Models\Palette;
use App\Services\ColorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaletteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $palettes = $request->user()->palettes()
            ->withCount('colors')
            ->latest()
            ->get();

        return response()->json($palettes->map(fn($p) => $this->paletteResource($p)));
    }

    public function show(string $id): JsonResponse
    {
        $palette = Palette::with(['colors', 'user'])->findOrFail($id);
        if (!$palette->is_public) abort(403);

        return response()->json($this->paletteResource($palette, withColors: true));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64'],
            'description' => ['nullable', 'string', 'max:160'],
            'is_public' => ['boolean'],
        ]);

        $palette = $request->user()->palettes()->create($data);

        return response()->json($this->paletteResource($palette), 201);
    }

    public function addColor(Request $request, string $id): JsonResponse
    {
        $palette = Palette::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $data = $request->validate(['hex_id' => ['required', 'integer', 'min:0', 'max:16777215']]);
        $hexId = $data['hex_id'];

        ColorService::findOrCreate($hexId);

        $count = DB::table('palette_colors')->where('palette_id', $id)->count();
        if ($count >= 12) {
            return response()->json(['message' => 'Palette is full (max 12 colors)'], 422);
        }

        DB::table('palette_colors')->insertOrIgnore([
            'palette_id' => $id,
            'hex_id' => $hexId,
            'position' => $count,
            'added_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function removeColor(Request $request, string $id, int $hexId): JsonResponse
    {
        Palette::where('id', $id)->where('user_id', $request->user()->id)->firstOrFail();

        DB::table('palette_colors')
            ->where('palette_id', $id)
            ->where('hex_id', $hexId)
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        Palette::where('id', $id)->where('user_id', $request->user()->id)->firstOrFail()->delete();
        return response()->json(['message' => 'Deleted']);
    }

    private function paletteResource(Palette $p, bool $withColors = false): array
    {
        $result = [
            'id' => $p->id,
            'name' => $p->name,
            'description' => $p->description,
            'is_public' => $p->is_public,
            'colors_count' => $p->colors_count ?? $p->colors->count(),
            'created_at' => $p->created_at->toISOString(),
        ];

        if ($withColors) {
            $result['colors'] = $p->colors->map(fn($c) => array_merge(
                ColorService::toArray($c->hex_id),
                ['custom_name' => $c->custom_name]
            ));
        } else {
            // Preview: first 5 hex codes for swatch strip
            $result['preview'] = $p->colors->take(5)->map(fn($c) => $c->hex_code)->values();
        }

        return $result;
    }
}
