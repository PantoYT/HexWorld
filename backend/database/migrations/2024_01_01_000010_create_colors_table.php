<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('colors', function (Blueprint $table) {
            $table->unsignedInteger('hex_id')->primary(); // 0–16777215
            $table->char('hex_code', 6)->unique();
            $table->unsignedTinyInteger('r');
            $table->unsignedTinyInteger('g');
            $table->unsignedTinyInteger('b');
            $table->float('hue')->nullable();
            $table->float('saturation')->nullable();
            $table->float('lightness')->nullable();
            $table->foreignUuid('discovered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('discovered_at')->nullable();
            $table->string('custom_name', 64)->nullable();
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->unsignedInteger('views_count')->default(0);
            $table->timestamps();

            $table->index(['hue', 'saturation', 'lightness']);
            $table->index('discovered_by');
            $table->index('likes_count');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('colors');
    }
};
