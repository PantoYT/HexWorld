<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('palettes', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 64);
            $table->string('description', 160)->nullable();
            $table->boolean('is_public')->default(true);
            $table->uuid('forked_from')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_public']);
        });

        Schema::create('palette_colors', function (Blueprint $table) {
            $table->foreignUuid('palette_id')->constrained('palettes')->cascadeOnDelete();
            $table->unsignedInteger('hex_id');
            $table->foreign('hex_id')->references('hex_id')->on('colors')->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->timestamp('added_at')->useCurrent();

            $table->primary(['palette_id', 'hex_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('palette_colors');
        Schema::dropIfExists('palettes');
    }
};
