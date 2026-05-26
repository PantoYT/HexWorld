<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Color extends Model
{
    protected $primaryKey = 'hex_id';
    public $incrementing = false;
    protected $keyType = 'integer';

    protected $fillable = [
        'hex_id',
        'hex_code',
        'r', 'g', 'b',
        'hue', 'saturation', 'lightness',
        'discovered_by',
        'discovered_at',
        'custom_name',
        'likes_count',
        'comments_count',
        'views_count',
    ];

    protected function casts(): array
    {
        return [
            'discovered_at' => 'datetime',
            'hue' => 'float',
            'saturation' => 'float',
            'lightness' => 'float',
        ];
    }

    public function discoverer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'discovered_by');
    }

    public function interactions(): HasMany
    {
        return $this->hasMany(UserColorInteraction::class, 'hex_id', 'hex_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class, 'hex_id', 'hex_id');
    }
}
