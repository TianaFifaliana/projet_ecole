<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $guarded = [];

    protected $casts = ['montant' => 'decimal:2', 'date_paiement' => 'date'];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function fee()
    {
        return $this->belongsTo(Fee::class);
    }

    public function recuPar()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function annuler(string $motif): void
    {
        $this->update(['statut' => 'annule', 'motif_annulation' => $motif]);
    }
}
