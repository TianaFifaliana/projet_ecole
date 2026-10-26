<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            'directeur' => ['*'],
            'secretariat' => ['eleves', 'professeurs', 'classes', 'matieres', 'paiements', 'certificats', 'groupes'],
            'comptable' => ['paiements', 'rapports'],
            'professeur' => ['presences', 'groupes'],
        ];

        foreach ($roles as $nom => $permissions) {
            Role::updateOrCreate(['nom' => $nom], ['permissions' => $permissions]);
        }
    }
}
