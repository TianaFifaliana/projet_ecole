<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    protected $guarded = [];

    protected $casts = ['permissions' => 'array'];

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function aPermission(string $permission): bool
    {
        $perms = $this->permissions ?? [];

        return in_array('*', $perms, true) || in_array($permission, $perms, true);
    }
}
