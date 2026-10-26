<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('nom_original')->nullable()->after('chemin_fichier');
            $table->string('mime_type')->nullable()->after('nom_original');
            $table->unsignedBigInteger('taille')->nullable()->after('mime_type');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn(['nom_original', 'mime_type', 'taille']);
        });
    }
};
