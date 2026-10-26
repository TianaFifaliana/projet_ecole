<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    protected $guarded = [];

    protected $appends = ['nom'];

    protected $casts = [
        'date_ajout' => 'date',
        'taille' => 'integer',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    protected function nom(): Attribute
    {
        return Attribute::get(
            fn (): string => $this->nom_original ?: basename((string) $this->chemin_fichier),
        );
    }
}
