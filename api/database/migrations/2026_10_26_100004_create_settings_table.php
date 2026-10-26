<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('nom_ecole');
            $table->string('sous_titre')->nullable();
            $table->string('logo')->nullable();
            $table->string('cachet')->nullable();
            $table->string('signature')->nullable();
            $table->string('adresse')->nullable();
            $table->string('contact')->nullable();
            $table->string('devise', 10)->default('Ar');
            $table->unsignedSmallInteger('seuil_absences')->default(3);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
