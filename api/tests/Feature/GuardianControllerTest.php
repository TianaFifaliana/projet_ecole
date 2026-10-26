<?php

namespace Tests\Feature;

use App\Models\Guardian;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GuardianControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_creates_and_updates_a_guardian(): void
    {
        $user = $this->createUserWithRole(['eleves']);
        Sanctum::actingAs($user);

        $this->postJson('/api/guardians', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('nom');

        $response = $this->postJson('/api/guardians', [
            'nom' => 'Mme Rakoto',
            'telephone' => '034 00 000 00',
            'email' => 'parent@ecole.test',
            'profession' => 'Enseignante',
        ])->assertCreated();

        $guardianId = $response->json('id');

        $this->patchJson('/api/guardians/'.$guardianId, [
            'nom' => 'Mme Rakoto',
            'telephone' => '034 11 111 11',
        ])
            ->assertOk()
            ->assertJsonPath('telephone', '034 11 111 11');
    }

    public function test_attaches_and_detaches_a_guardian_from_a_student(): void
    {
        $user = $this->createUserWithRole(['eleves']);
        $student = Student::create([
            'matricule' => 'E100',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
        $guardian = Guardian::create(['nom' => 'M. Andria']);
        Sanctum::actingAs($user);

        $this->postJson('/api/students/'.$student->id.'/guardians', [
            'guardian_id' => $guardian->id,
            'lien_parente' => 'Père',
        ])
            ->assertOk()
            ->assertJsonPath('guardian.lien_parente', 'Père');

        $this->assertDatabaseHas('guardian_student', [
            'guardian_id' => $guardian->id,
            'student_id' => $student->id,
            'lien_parente' => 'Père',
        ]);

        $this->deleteJson('/api/students/'.$student->id.'/guardians/'.$guardian->id)
            ->assertOk();

        $this->assertDatabaseMissing('guardian_student', [
            'guardian_id' => $guardian->id,
            'student_id' => $student->id,
        ]);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    private function createUserWithRole(array $permissions): User
    {
        $role = Role::create([
            'nom' => 'secretariat',
            'permissions' => $permissions,
        ]);

        return User::factory()->create(['role_id' => $role->id]);
    }
}
