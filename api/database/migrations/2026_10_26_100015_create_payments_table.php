<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('fee_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('montant', 12, 2);
            $table->date('date_paiement');
            $table->string('mode')->default('especes');
            $table->string('reference')->nullable();
            $table->string('statut')->default('valide');
            $table->string('numero_recu')->unique();
            $table->string('motif_annulation')->nullable();
            $table->index(['student_id', 'statut']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
