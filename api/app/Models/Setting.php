<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $guarded = [];

    public static function actuel(): self
    {
        return static::first() ?? static::create(['nom_ecole' => 'Mon école']);
    }
}
