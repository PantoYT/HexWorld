<?php

namespace Database\Factories;

use App\Models\Palette;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Palette>
 */
class PaletteFactory extends Factory
{
    protected $model = Palette::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->words(2, true),
            'description' => fake()->optional()->sentence(4),
            'is_public' => true,
        ];
    }
}
