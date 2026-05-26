<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FeedService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedController extends Controller
{
    public function __construct(private FeedService $feed) {}

    public function next(Request $request): JsonResponse
    {
        $mode = $request->query('mode', 'random');
        if (!in_array($mode, ['random', 'hsl_sequence', 'trending'])) {
            $mode = 'random';
        }

        $color = $this->feed->getNext($request->user(), $mode);

        return response()->json($color);
    }
}
