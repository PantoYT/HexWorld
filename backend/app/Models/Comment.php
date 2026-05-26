<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Comment extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'hex_id',
        'user_id',
        'body',
        'likes_count',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function color(): BelongsTo
    {
        return $this->belongsTo(Color::class, 'hex_id', 'hex_id');
    }
}
