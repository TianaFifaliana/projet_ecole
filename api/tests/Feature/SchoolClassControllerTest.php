<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SchoolClassControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_creates_and_lists_classes_for_a_school_year(): void
    {
        $user = $this->createUserWithRole();
        $schoolYear = $this->createSchoolYear();
        $teacher = Teacher::create(['nom' => 'Rakoto', 'prenoms' => 'Jean']);
        Sanctum::actingAs($user);

        $this->postJson('/api/classes', [
            'school_year_id' => $schoolYear->id,
            'teacher_id' => $teacher->id,
            'nom' => '6e A',
            'niveau' => '6e',
            'capacite' => 40,
        ])
            ->assertCreated()
            ->assertJsonPath('nom', '6e A')
            ->assertJsonPath('professeur_principal.nom_complet', 'Rakoto Jean');

        $this->getJson('/api/classes?school_year_id='.$schoolYear->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.effectif', 0);
    }

    public function test_prevents_reducing_capacity_below_current_effectif(): void
    {
        $user = $this->createUserWithRole();
        $schoolClass = $this->createClass();
        $this->createStudents($schoolClass, 3);
        Sanctum::actingAs($user);

        $this->patchJson('/api/classes/'.$schoolClass->id, [
            'school_year_id' => $schoolClass->school_year_id,
            'nom' => $schoolClass->nom,
            'capacite' => 2,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('capacite');
    }

    public function test_transfers_a_student_and_logs_the_operation(): void
    {
        $user = $this->createUserWithRole();
        $source = $this->createClass('6e A');
        $target = $this->createClass('6e B', $source->school_year_id);
        $student = Student::create([
            'school_class_id' => $source->id,
            'matricule' => 'E300',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/classes/'.$source->id.'/students/'.$student->id.'/transfer', [
            'target_school_class_id' => $target->id,
        ])
            ->assertOk()
            ->assertJsonPath('eleve.school_class_id', $target->id);

        $this->assertDatabaseHas('students', [
            'id' => $student->id,
            'school_class_id' => $target->id,
        ]);
        $this->assertSame(
            1,
            ActivityLog::query()->where('action', 'like', 'Transfert de l’élève%')->count(),
        );
    }

    public function test_refuses_transfer_when_destination_class_is_full(): void
    {
        $user = $this->createUserWithRole();
        $source = $this->createClass('6e A');
        $target = $this->createClass('6e B', $source->school_year_id, 1);
        $student = Student::create([
            'school_class_id' => $source->id,
            'matricule' => 'E301',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
        $this->createStudents($target, 1);
        Sanctum::actingAs($user);

        $this->postJson('/api/classes/'.$source->id.'/students/'.$student->id.'/transfer', [
            'target_school_class_id' => $target->id,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('target_school_class_id');
    }

    public function test_refuses_deleting_a_class_with_students(): void
    {
        $user = $this->createUserWithRole();
        $schoolClass = $this->createClass();
        $this->createStudents($schoolClass, 1);
        Sanctum::actingAs($user);

        $this->deleteJson('/api/classes/'.$schoolClass->id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('classe');

        $this->assertDatabaseHas('school_classes', ['id' => $schoolClass->id]);
    }

    public function test_syncs_subjects_and_exports_the_class_list_as_pdf(): void
    {
        $user = $this->createUserWithRole();
        $schoolClass = $this->createClass();
        $subject = Subject::create([
            'code' => 'MATH',
            'intitule' => 'Mathématiques',
            'coefficient' => 3,
        ]);
        $this->createStudents($schoolClass, 2);
        Sanctum::actingAs($user);

        $this->postJson('/api/classes/'.$schoolClass->id.'/subjects', [
            'subject_ids' => [$subject->id],
        ])
            ->assertOk()
            ->assertJsonCount(1, 'subjects');

        $this->assertDatabaseHas('class_subject', [
            'school_class_id' => $schoolClass->id,
            'subject_id' => $subject->id,
        ]);

        $this->get('/api/classes/'.$schoolClass->id.'/students/export-pdf')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_requires_the_classes_permission(): void
    {
        $role = Role::create(['nom' => 'comptable', 'permissions' => ['paiements']]);
        $user = User::factory()->create(['role_id' => $role->id]);
        Sanctum::actingAs($user);

        $this->getJson('/api/classes')->assertForbidden();
    }

    private function createSchoolYear(): SchoolYear
    {
        return SchoolYear::create([
            'libelle' => '2026-2027',
            'debut' => '2026-09-01',
            'fin' => '2027-06-30',
            'active' => true,
        ]);
    }

    private function createClass(string $name = '6e A', ?int $schoolYearId = null, int $capacity = 40): SchoolClass
    {
        return SchoolClass::create([
            'school_year_id' => $schoolYearId ?? $this->createSchoolYear()->id,
            'nom' => $name,
            'capacite' => $capacity,
        ]);
    }

    private function createStudents(SchoolClass $schoolClass, int $count): void
    {
        for ($index = 1; $index <= $count; $index++) {
            Student::create([
                'school_class_id' => $schoolClass->id,
                'matricule' => $schoolClass->id.'-'.$index,
                'nom' => 'Eleve '.$index,
                'statut' => 'actif',
            ]);
        }
    }

    private function createUserWithRole(): User
    {
        $role = Role::create([
            'nom' => 'secretariat',
            'permissions' => ['classes', 'matieres', 'eleves'],
        ]);

        return User::factory()->create(['role_id' => $role->id]);
    }
}
