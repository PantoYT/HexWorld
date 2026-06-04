<?php

use Illuminate\Support\Facades\Schedule;

// Flush Redis like counters → PostgreSQL every minute
Schedule::command('hexworld:flush-likes')->everyMinute();

// Pick Color of the Day at 00:01 UTC
Schedule::command('hexworld:cotd')->dailyAt('00:01');
