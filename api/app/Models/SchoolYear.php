<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchoolYear extends Model
{
    protected $guarded = [];

    protected $casts = ['debut' => 'date', 'fin' => 'date', 'active' => 'boolean'];

    public function classes()
    {
        return $this->hasMany(SchoolClass::class);
    }

    public function fees()
    {
        return $this->hasMany(Fee::class);
    }
}
