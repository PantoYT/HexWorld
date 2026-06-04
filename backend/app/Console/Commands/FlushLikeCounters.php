<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class FlushLikeCounters extends Command
{
    protected $signature = 'hexworld:flush-likes';
    protected $description = 'Flush Redis like counters to PostgreSQL';

    public function handle(): int
    {
        $keys = Redis::keys('color:*:likes');
        $flushed = 0;

        foreach ($keys as $key) {
            // key format: color:{hexId}:likes
            preg_match('/color:(\d+):likes/', $key, $m);
            if (!isset($m[1])) continue;

            $hexId = (int) $m[1];
            $delta = (int) Redis::getdel($key);
            if ($delta === 0) continue;

            DB::table('colors')
                ->where('hex_id', $hexId)
                ->increment('likes_count', $delta);

            $flushed++;
        }

        if ($flushed > 0) {
            $this->line("Flushed {$flushed} like counter(s) to DB.");
        }

        return Command::SUCCESS;
    }
}
