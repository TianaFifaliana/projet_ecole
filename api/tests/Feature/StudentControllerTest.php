<?php

namespace Tests\Feature;

use App\Models\Fee;
use App\Models\Guardian;
use App\Models\Payment;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/students')->assertUnauthorized();
    }

    public function test_lists_filtered_and_paginated_students(): void
    {
        $user = $this->createUserWithRole('directeur', ['*']);
        $schoolClass = $this->createSchoolClass('6e A');
        Student::create([
            'school_class_id' => $schoolClass->id,
            'matricule' => 'E001',
            'nom' => 'Andria',
            'prenoms' => 'Jean',
            'statut' => 'actif',
        ]);
        Student::create([
            'school_class_id' => $schoolClass->id,
            'matricule' => 'E002',
            'nom' => 'Bema',
            'prenoms' => 'Lucie',
            'statut' => 'inactif',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/students?search=Bema&statut=inactif&classe_id='.$schoolClass->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.matricule', 'E002')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_validates_and_creates_a_student_with_generated_matricule(): void
    {
        $user = $this->createUserWithRole('secretariat', ['eleves']);
        $schoolClass = $this->createSchoolClass('6e A');
        Sanctum::actingAs($user);

        $this->postJson('/api/students', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('nom');

        $this->postJson('/api/students', [
            'nom' => 'Rakoto',
            'prenoms' => 'Jean',
            'date_naissance' => '2011-04-12',
            'sexe' => 'M',
            'school_class_id' => $schoolClass->id,
        ])
            ->assertCreated()
            ->assertJsonPath('nom', 'Rakoto')
            ->assertJsonPath('statut', 'actif');

        $student = Student::query()->where('nom', 'Rakoto')->firstOrFail();
        $this->assertStringStartsWith('ELV-', $student->matricule);
    }

    public function test_updates_and_archives_a_student(): void
    {
        $user = $this->createUserWithRole('secretariat', ['eleves']);
        $student = Student::create([
            'matricule' => 'E010',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
        Sanctum::actingAs($user);

        $this->patchJson('/api/students/'.$student->id, [
            'nom' => 'Andriana',
            'statut' => 'inactif',
        ])
            ->assertOk()
            ->assertJsonPath('nom', 'Andriana')
            ->assertJsonPath('statut', 'inactif');

        $this->deleteJson('/api/students/'.$student->id)
            ->assertOk()
            ->assertJsonPath('eleve.statut', 'archive');

        $this->assertDatabaseHas('students', ['id' => $student->id, 'statut' => 'archive']);
    }

    public function test_shows_a_student_with_guardians_documents_and_payment_summary(): void
    {
        $user = $this->createUserWithRole('directeur', ['*']);
        $schoolClass = $this->createSchoolClass('6e A');
        $student = Student::create([
            'school_class_id' => $schoolClass->id,
            'matricule' => 'E020',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
        $guardian = Guardian::create(['nom' => 'Mme Andria']);
        $student->guardians()->attach($guardian->id, ['lien_parente' => 'Mère']);
        $fee = Fee::create([
            'school_year_id' => $schoolClass->school_year_id,
            'type' => 'Scolarité',
            'montant' => 10000,
        ]);
        Payment::create([
            'student_id' => $student->id,
            'fee_id' => $fee->id,
            'user_id' => $user->id,
            'montant' => 4000,
            'date_paiement' => now()->toDateString(),
            'numero_recu' => 'REC-020',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/students/'.$student->id)
            ->assertOk()
            ->assertJsonPath('guardians.0.lien_parente', 'Mère')
            ->assertJsonPath('paiements.total_du', 10000)
            ->assertJsonPath('paiements.total_paye', 4000)
            ->assertJsonPath('paiements.reste_a_payer', 6000);
    }

    public function test_imports_csv_rows_and_reports_line_errors(): void
    {
        $user = $this->createUserWithRole('directeur', ['*']);
        $this->createSchoolClass('6e A');
        Sanctum::actingAs($user);

        $csv = "nom,prenoms,date_naissance,sexe,classe\n".
            "Rakoto,Jean,2010-05-04,M,6e A\n".
            "Invalide,Test,date-invalide,X,Classe inconnue\n";
        $file = UploadedFile::fake()->createWithContent('eleves.csv', $csv);

        $this->post('/api/students/import', ['fichier' => $file], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('total_lignes', 2)
            ->assertJsonPath('importes', 1)
            ->assertJsonPath('erreurs.0.ligne', 3);

        $this->assertDatabaseHas('students', ['nom' => 'Rakoto', 'sexe' => 'M']);
    }

    public function test_exports_filtered_students_as_csv(): void
    {
        $user = $this->createUserWithRole('directeur', ['*']);
        $schoolClass = $this->createSchoolClass('6e A');
        Student::create([
            'school_class_id' => $schoolClass->id,
            'matricule' => 'E030',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
        Student::create([
            'school_class_id' => $schoolClass->id,
            'matricule' => 'E031',
            'nom' => 'Bema',
            'statut' => 'archive',
        ]);
        Sanctum::actingAs($user);

        $response = $this->get('/api/students/export?statut=actif');

        $response->assertOk();
        $content = $response->streamedContent();
        $this->assertStringContainsString('matricule,nom,prenoms', $content);
        $this->assertStringContainsString('E030', $content);
        $this->assertStringNotContainsString('E031', $content);
    }

    public function test_uploads_and_resizes_a_student_photo(): void
    {
        Storage::fake('public');
        $user = $this->createUserWithRole('secretariat', ['eleves']);
        $student = Student::create([
            'matricule' => 'E040',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
        Sanctum::actingAs($user);

        $this->post('/api/students/'.$student->id.'/photo', [
            'photo' => UploadedFile::fake()->image('photo.jpg', 1200, 900),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('eleve.id', $student->id);

        $student->refresh();
        $this->assertNotNull($student->photo);
        Storage::disk('public')->assertExists($student->photo);
    }

    public function test_rejects_a_photo_over_two_megabytes(): void
    {
        Storage::fake('public');
        $user = $this->createUserWithRole('secretariat', ['eleves']);
        $student = Student::create([
            'matricule' => 'E041',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
        Sanctum::actingAs($user);

        $this->post('/api/students/'.$student->id.'/photo', [
            'photo' => UploadedFile::fake()->image('photo.jpg')->size(2049),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('photo');
    }

    private function createSchoolClass(string $name): SchoolClass
    {
        $schoolYear = SchoolYear::create([
            'libelle' => '2026-2027',
            'debut' => '2026-09-01',
            'fin' => '2027-06-30',
            'active' => true,
        ]);

        return SchoolClass::create([
            'school_year_id' => $schoolYear->id,
            'nom' => $name,
            'capacite' => 40,
        ]);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    private function createUserWithRole(string $roleName, array $permissions): User
    {
        $role = Role::create([
            'nom' => $roleName,
            'permissions' => $permissions,
        ]);

        return User::factory()->create(['role_id' => $role->id]);
    }
}
