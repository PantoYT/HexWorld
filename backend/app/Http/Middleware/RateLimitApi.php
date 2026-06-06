<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Symfony\Component\HttpFoundation\Response;

class RateLimitApi
{
    /**
     * Limits per sliding window:
     *   - /feed/next      : 60 req / 60s per user (1/sec average)
     *   - /colors/*/like  : 120 req / 60s per user
     *   - everything else : 300 req / 60s per user
     */
    public function handle(Request $request, Closure $next, string $tier = 'default'): Response
    {
        $limits = [
            'feed'    => [60,  60],
            'like'    => [120, 60],
            'default' => [300, 60],
        ];

        [$max, $window] = $limits[$tier] ?? $limits['default'];

        $key = 'rl:' . ($request->user()?->id ?? $request->ip()) . ':' . $tier;

        $count = (int) Redis::incr($key);
        if ($count === 1) Redis::expire($key, $window);

        if ($count > $max) {
            return response()->json([
                'message' => 'Too many requests. Slow down.',
                'retry_after' => Redis::ttl($key),
            ], 429);
        }

        $response = $next($request);
        $response->headers->set('X-RateLimit-Limit', $max);
        $response->headers->set('X-RateLimit-Remaining', max(0, $max - $count));

        return $response;
    }
}
