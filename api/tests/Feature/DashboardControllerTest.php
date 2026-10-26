<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Fee;
use App\Models\Group;
use App\Models\LessonSession;
use App\Models\Payment;
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

class DashboardControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_returns_401_when_unauthenticated(): void
    {
        $this->getJson('/api/dashboard')->assertUnauthorized();
    }

    public function test_returns_dashboard_metrics_for_a_user_who_can_view_payments(): void
    {
        $this->travelTo('2026-10-15 10:00:00');
        $user = $this->createUserWithRole('directeur', ['*']);

        $schoolYear = SchoolYear::create([
            'libelle' => '2026-2027',
            'debut' => '2026-09-01',
            'fin' => '2027-06-30',
            'active' => true,
        ]);
        $teacher = Teacher::create(['nom' => 'Rakoto']);
        $schoolClass = SchoolClass::create([
            'school_year_id' => $schoolYear->id,
            'teacher_id' => $teacher->id,
            'nom' => '6e A',
            'capacite' => 30,
        ]);
        $firstStudent = Student::create([
            'school_class_id' => $schoolClass->id,
            'matricule' => 'E001',
            'nom' => 'Andria',
            'statut' => 'actif',
        ]);
        $secondStudent = Student::create([
            'school_class_id' => $schoolClass->id,
            'matricule' => 'E002',
            'nom' => 'Bema',
            'statut' => 'actif',
        ]);
        Student::create([
            'school_class_id' => $schoolClass->id,
            'matricule' => 'E003',
            'nom' => 'Carla',
            'statut' => 'inactif',
        ]);
        Subject::create([
            'code' => 'MATH',
            'intitule' => 'Mathématiques',
        ]);
        $group = Group::create(['nom' => 'Groupe A']);
        $fee = Fee::create([
            'school_year_id' => $schoolYear->id,
            'type' => 'Scolarité',
            'montant' => 10000,
        ]);
        Payment::create([
            'student_id' => $firstStudent->id,
            'fee_id' => $fee->id,
            'user_id' => $user->id,
            'montant' => 1500,
            'date_paiement' => now()->toDateString(),
            'numero_recu' => 'REC-001',
        ]);
        Payment::create([
            'student_id' => $firstStudent->id,
            'fee_id' => $fee->id,
            'user_id' => $user->id,
            'montant' => 900,
            'date_paiement' => now()->toDateString(),
            'numero_recu' => 'REC-002',
            'statut' => 'annule',
        ]);
        Payment::create([
            'student_id' => $secondStudent->id,
            'fee_id' => $fee->id,
            'user_id' => $user->id,
            'montant' => 700,
            'date_paiement' => now()->subMonths(5)->startOfMonth()->addDays(2)->toDateString(),
            'numero_recu' => 'REC-003',
        ]);

        $todaySession = LessonSession::create([
            'group_id' => $group->id,
            'date' => now()->toDateString(),
            'heure_debut' => '08:00',
            'heure_fin' => '09:00',
        ]);
        $secondTodaySession = LessonSession::create([
            'group_id' => $group->id,
            'date' => now()->toDateString(),
            'heure_debut' => '10:00',
            'heure_fin' => '11:00',
        ]);
        $yesterdaySession = LessonSession::create([
            'group_id' => $group->id,
            'date' => now()->subDay()->toDateString(),
            'heure_debut' => '08:00',
            'heure_fin' => '09:00',
        ]);
        Attendance::create([
            'lesson_session_id' => $todaySession->id,
            'student_id' => $firstStudent->id,
            'statut' => 'present',
        ]);
        Attendance::create([
            'lesson_session_id' => $secondTodaySession->id,
            'student_id' => $firstStudent->id,
            'statut' => 'present',
        ]);
        Attendance::create([
            'lesson_session_id' => $todaySession->id,
            'student_id' => $secondStudent->id,
            'statut' => 'absent',
        ]);
        Attendance::create([
            'lesson_session_id' => $yesterdaySession->id,
            'student_id' => $secondStudent->id,
            'statut' => 'present',
        ]);

        for ($index = 1; $index <= 12; $index++) {
            ActivityLog::create([
                'user_id' => $user->id,
                'action' => "Action {$index}",
            ]);
        }

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/dashboard');

        $response->assertOk()
            ->assertJsonCount(10, 'activites_recentes')
            ->assertJsonCount(6, 'encaissements_6_mois')
            ->assertJsonPath('eleves_actifs', 2)
            ->assertJsonPath('professeurs', 1)
            ->assertJsonPath('classes', 1)
            ->assertJsonPath('matieres', 1)
            ->assertJsonPath('groupes', 1)
            ->assertJsonPath('presents_aujourdhui', 1)
            ->assertJsonPath('paiements_mois', 1500)
            ->assertJsonPath('activites_recentes.0.utilisateur', $user->name)
            ->assertJsonPath('activites_recentes.0.heure', '10:00')
            ->assertJsonPath('eleves_par_classe.0.classe', '6e A')
            ->assertJsonPath('eleves_par_classe.0.nombre', 2)
            ->assertJsonPath('encaissements_6_mois.0.mois', '2026-05')
            ->assertJsonPath('encaissements_6_mois.0.montant', 700)
            ->assertJsonPath('encaissements_6_mois.5.montant', 1500);
    }

    public function test_omits_financial_metrics_for_a_user_who_cannot_view_payments(): void
    {
        $this->travelTo('2026-10-15 10:00:00');
        $user = $this->createUserWithRole('professeur', ['presences', 'groupes']);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/dashboard');

        $response->assertOk()
            ->assertJsonStructure([
                'eleves_actifs',
                'professeurs',
                'classes',
                'matieres',
                'groupes',
                'presents_aujourdhui',
                'activites_recentes',
                'eleves_par_classe',
            ]);

        $this->assertArrayNotHasKey('paiements_mois', $response->json());
        $this->assertArrayNotHasKey('encaissements_6_mois', $response->json());
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
