<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Certificate extends Model
{
    protected $guarded = [];

    protected $casts = ['date_emission' => 'date'];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function emisPar()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
