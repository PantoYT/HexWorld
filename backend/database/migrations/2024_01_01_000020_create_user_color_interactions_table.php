<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_color_interactions', function (Blueprint $table) {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('hex_id');
            $table->foreign('hex_id')->references('hex_id')->on('colors')->cascadeOnDelete();
            $table->boolean('liked')->default(false);
            $table->boolean('saved')->default(false);
            $table->timestamp('viewed_at')->nullable();
            $table->timestamps();

            $table->primary(['user_id', 'hex_id']);
            $table->index(['user_id', 'liked']);
            $table->index(['user_id', 'saved']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_color_interactions');
    }
};
