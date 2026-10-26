<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\SchoolYear;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        Setting::firstOrCreate([], [
            'nom_ecole' => 'Nom de l\'école',
            'sous_titre' => 'Gestion Scolaire',
            'devise' => 'Ar',
        ]);

        SchoolYear::firstOrCreate(['libelle' => '2026-2027'], [
            'debut' => '2026-09-01',
            'fin' => '2027-06-30',
            'active' => true,
        ]);

        // Compte directeur de départ : CHANGEZ le mot de passe dès la première connexion.
        User::firstOrCreate(['email' => 'directeur@ecole.test'], [
            'name' => 'Directeur',
            'password' => 'Directeur@2026',
            'role_id' => Role::where('nom', 'directeur')->value('id'),
            'actif' => true,
        ]);
    }
}
