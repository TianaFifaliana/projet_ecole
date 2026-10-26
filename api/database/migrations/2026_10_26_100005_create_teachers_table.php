<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teachers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('nom');
            $table->string('prenoms')->nullable();
            $table->string('contact')->nullable();
            $table->string('email')->nullable();
            $table->string('diplomes')->nullable();
            $table->date('date_embauche')->nullable();
            $table->string('photo')->nullable();
            $table->string('statut')->default('actif');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teachers');
    }
};
