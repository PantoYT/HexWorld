<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Palette extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'name',
        'description',
        'is_public',
        'forked_from',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function colors(): BelongsToMany
    {
        return $this->belongsToMany(Color::class, 'palette_colors', 'palette_id', 'hex_id', 'id', 'hex_id')
            ->withPivot('position')
            ->orderByPivot('position');
    }
}
