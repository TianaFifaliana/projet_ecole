<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Guardian extends Model
{
    protected $guarded = [];

    public function students()
    {
        return $this->belongsToMany(Student::class, 'guardian_student');
    }
}
