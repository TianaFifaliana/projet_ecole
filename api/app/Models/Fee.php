<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Fee extends Model
{
    protected $guarded = [];

    protected $casts = ['montant' => 'decimal:2'];

    public function schoolYear()
    {
        return $this->belongsTo(SchoolYear::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }
}
