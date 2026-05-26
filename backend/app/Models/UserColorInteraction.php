<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserColorInteraction extends Model
{
    public $incrementing = false;
    protected $primaryKey = null;

    protected $fillable = [
        'user_id',
        'hex_id',
        'liked',
        'saved',
        'viewed_at',
    ];

    protected function casts(): array
    {
        return [
            'liked' => 'boolean',
            'saved' => 'boolean',
            'viewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function color(): BelongsTo
    {
        return $this->belongsTo(Color::class, 'hex_id', 'hex_id');
    }
}
