<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\SchoolYear;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SchoolYearControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_creates_a_year_and_deactivates_previous_active_years(): void
    {
        $user = $this->createUserWithRole();
        $previous = SchoolYear::create([
            'libelle' => '2025-2026',
            'debut' => '2025-09-01',
            'fin' => '2026-06-30',
            'active' => true,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/school-years', [
            'libelle' => '2026-2027',
            'debut' => '2026-09-01',
            'fin' => '2027-06-30',
            'active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('libelle', '2026-2027')
            ->assertJsonPath('active', true);

        $this->assertFalse($previous->fresh()->active);
        $this->assertSame(1, SchoolYear::query()->where('active', true)->count());
    }

    public function test_activates_a_single_year(): void
    {
        $user = $this->createUserWithRole();
        $oldYear = SchoolYear::create([
            'libelle' => '2025-2026',
            'debut' => '2025-09-01',
            'fin' => '2026-06-30',
            'active' => true,
        ]);
        $newYear = SchoolYear::create([
            'libelle' => '2026-2027',
            'debut' => '2026-09-01',
            'fin' => '2027-06-30',
            'active' => false,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/school-years/'.$newYear->id.'/activate')
            ->assertOk()
            ->assertJsonPath('annee.active', true);

        $this->assertFalse($oldYear->fresh()->active);
        $this->assertTrue($newYear->fresh()->active);
    }

    public function test_requires_the_settings_permission_to_create_a_year(): void
    {
        $role = Role::create(['nom' => 'secretariat', 'permissions' => ['eleves']]);
        $user = User::factory()->create(['role_id' => $role->id]);
        Sanctum::actingAs($user);

        $this->postJson('/api/school-years', [
            'libelle' => '2026-2027',
            'debut' => '2026-09-01',
            'fin' => '2027-06-30',
        ])->assertForbidden();
    }

    private function createUserWithRole(): User
    {
        $role = Role::create([
            'nom' => 'directeur',
            'permissions' => ['*'],
        ]);

        return User::factory()->create(['role_id' => $role->id]);
    }
}
