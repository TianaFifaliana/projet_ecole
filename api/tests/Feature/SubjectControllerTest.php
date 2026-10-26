<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SubjectControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_creates_updates_and_lists_subjects(): void
    {
        $user = $this->createUserWithRole();
        Sanctum::actingAs($user);

        $this->postJson('/api/subjects', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code', 'intitule', 'coefficient']);

        $response = $this->postJson('/api/subjects', [
            'code' => 'MATH',
            'intitule' => 'Mathématiques',
            'coefficient' => 3,
            'volume_horaire' => 120,
        ])
            ->assertCreated()
            ->assertJsonPath('code', 'MATH');

        $subjectId = $response->json('id');

        $this->patchJson('/api/subjects/'.$subjectId, [
            'code' => 'MATH',
            'intitule' => 'Mathématiques générales',
            'coefficient' => 4,
        ])
            ->assertOk()
            ->assertJsonPath('intitule', 'Mathématiques générales');

        $this->getJson('/api/subjects?search=Math')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_refuses_deleting_a_subject_used_by_a_class(): void
    {
        $user = $this->createUserWithRole();
        $subject = Subject::create([
            'code' => 'PHY',
            'intitule' => 'Physique',
            'coefficient' => 2,
        ]);
        $schoolClass = $this->createClass();
        $subject->classes()->attach($schoolClass->id);
        Sanctum::actingAs($user);

        $this->deleteJson('/api/subjects/'.$subject->id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('matiere');

        $this->assertDatabaseHas('subjects', ['id' => $subject->id]);
    }

    public function test_syncs_classes_for_a_subject(): void
    {
        $user = $this->createUserWithRole();
        $subject = Subject::create([
            'code' => 'SVT',
            'intitule' => 'Sciences de la vie',
            'coefficient' => 2,
        ]);
        $schoolClass = $this->createClass();
        Sanctum::actingAs($user);

        $this->postJson('/api/subjects/'.$subject->id.'/classes', [
            'class_ids' => [$schoolClass->id],
        ])
            ->assertOk()
            ->assertJsonPath('matiere.classes.0.id', $schoolClass->id);

        $this->assertDatabaseHas('class_subject', [
            'subject_id' => $subject->id,
            'school_class_id' => $schoolClass->id,
        ]);
    }

    private function createClass(): SchoolClass
    {
        $schoolYear = SchoolYear::create([
            'libelle' => '2026-2027',
            'debut' => '2026-09-01',
            'fin' => '2027-06-30',
            'active' => true,
        ]);

        return SchoolClass::create([
            'school_year_id' => $schoolYear->id,
            'nom' => '6e A',
            'capacite' => 40,
        ]);
    }

    private function createUserWithRole(): User
    {
        $role = Role::create([
            'nom' => 'secretariat',
            'permissions' => ['matieres'],
        ]);

        return User::factory()->create(['role_id' => $role->id]);
    }
}
