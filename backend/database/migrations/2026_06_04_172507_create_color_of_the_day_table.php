<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('color_of_the_day', function (Blueprint $table) {
            $table->unsignedSmallInteger('year');
            $table->unsignedSmallInteger('month');
            $table->unsignedSmallInteger('day');
            $table->unsignedInteger('hex_id');
            $table->float('score')->default(0);
            $table->timestamps();

            $table->primary(['year', 'month', 'day']);
            $table->index('hex_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('color_of_the_day');
    }
};
