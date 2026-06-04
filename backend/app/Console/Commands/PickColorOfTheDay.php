<?php

namespace App\Console\Commands;

use App\Services\ColorOfTheDayService;
use Illuminate\Console\Command;

class PickColorOfTheDay extends Command
{
    protected $signature = 'hexworld:cotd {--date= : Date in Y-m-d format (default: today)}';
    protected $description = 'Pick the Color of the Day';

    public function handle(): int
    {
        $date = $this->option('date')
            ? new \DateTime($this->option('date'))
            : now();

        $cotd = ColorOfTheDayService::getOrPick($date);

        $this->info("🎨 Color of the Day: #{$cotd['hex_code']}");
        $this->line("   rgb({$cotd['r']}, {$cotd['g']}, {$cotd['b']})");
        $this->line("   hsl({$cotd['h']}°, {$cotd['s']}%, {$cotd['l']}%)");
        $this->line("   score: {$cotd['score']}");

        return Command::SUCCESS;
    }
}
