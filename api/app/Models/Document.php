<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    protected $guarded = [];

    protected $casts = ['date_ajout' => 'date'];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}
