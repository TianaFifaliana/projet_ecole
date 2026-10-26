<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Group;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $activeSchoolYearId = SchoolYear::query()
            ->where('active', true)
            ->orderByDesc('debut')
            ->value('id');

        $payload = [
            'eleves_actifs' => Student::query()->where('statut', 'actif')->count(),
            'professeurs' => Teacher::query()->count(),
            'classes' => $activeSchoolYearId
                ? SchoolClass::query()->where('school_year_id', $activeSchoolYearId)->count()
                : 0,
            'matieres' => Subject::query()->count(),
            'groupes' => Group::query()->count(),
            'presents_aujourdhui' => Attendance::query()
                ->where('statut', 'present')
                ->whereHas('lessonSession', fn (Builder $query): Builder => $query->whereDate('date', now()->toDateString()))
                ->distinct()
                ->count('student_id'),
            'activites_recentes' => $this->getRecentActivities(),
            'eleves_par_classe' => $this->getStudentsPerClass($activeSchoolYearId),
        ];

        if ($request->user()?->role?->aPermission('paiements')) {
            $payload['paiements_mois'] = (float) Payment::query()
                ->where('statut', 'valide')
                ->whereBetween('date_paiement', [
                    now()->startOfMonth()->toDateString(),
                    now()->endOfMonth()->toDateString(),
                ])
                ->sum('montant');

            $payload['encaissements_6_mois'] = $this->getMonthlyPayments();
        }

        return response()->json($payload);
    }

    /**
     * @return array<int, array{id: int, action: string, utilisateur: string, heure: string}>
     */
    private function getRecentActivities(): array
    {
        return ActivityLog::query()
            ->with('user:id,name')
            ->latest()
            ->limit(10)
            ->get(['id', 'user_id', 'action', 'created_at'])
            ->map(fn (ActivityLog $activity): array => [
                'id' => $activity->id,
                'action' => $activity->action,
                'utilisateur' => $activity->user?->name ?? 'Système',
                'heure' => $activity->created_at->format('H:i'),
            ])
            ->all();
    }

    /**
     * @return array<int, array{classe: string, nombre: int}>
     */
    private function getStudentsPerClass(?int $schoolYearId): array
    {
        if (! $schoolYearId) {
            return [];
        }

        return SchoolClass::query()
            ->select(['id', 'nom'])
            ->where('school_year_id', $schoolYearId)
            ->withCount([
                'students' => fn (Builder $query): Builder => $query->where('statut', 'actif'),
            ])
            ->orderBy('nom')
            ->get()
            ->map(fn (SchoolClass $schoolClass): array => [
                'classe' => $schoolClass->nom,
                'nombre' => $schoolClass->students_count,
            ])
            ->all();
    }

    /**
     * @return array<int, array{mois: string, montant: float}>
     */
    private function getMonthlyPayments(): array
    {
        $currentMonth = now()->startOfMonth();
        $monthExpression = $this->getPaymentMonthExpression();

        $totalsByMonth = Payment::query()
            ->toBase()
            ->where('statut', 'valide')
            ->whereBetween('date_paiement', [
                $currentMonth->copy()->subMonths(5)->toDateString(),
                now()->endOfMonth()->toDateString(),
            ])
            ->selectRaw("{$monthExpression} as mois, sum(montant) as total")
            ->groupByRaw($monthExpression)
            ->pluck('total', 'mois');

        $payments = [];

        for ($monthsAgo = 5; $monthsAgo >= 0; $monthsAgo--) {
            $month = $currentMonth->copy()->subMonths($monthsAgo);
            $monthKey = $month->format('Y-m');

            $payments[] = [
                'mois' => $monthKey,
                'montant' => (float) ($totalsByMonth[$monthKey] ?? 0),
            ];
        }

        return $payments;
    }

    private function getPaymentMonthExpression(): string
    {
        return match (DB::connection()->getDriverName()) {
            'mysql', 'mariadb' => "date_format(date_paiement, '%Y-%m')",
            'sqlite' => "strftime('%Y-%m', date_paiement)",
            default => "to_char(date_paiement, 'YYYY-MM')",
        };
    }
}
