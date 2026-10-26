<?php

namespace App\Http\Controllers;

use App\Models\SchoolYear;
use App\Support\Journal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SchoolYearController extends Controller
{
    public function index(): JsonResponse
    {
        $schoolYears = SchoolYear::query()
            ->withCount('classes')
            ->orderByDesc('active')
            ->orderByDesc('debut')
            ->orderByDesc('id')
            ->get()
            ->map(fn (SchoolYear $schoolYear): array => $this->schoolYearPayload($schoolYear))
            ->values()
            ->all();

        return response()->json(['data' => $schoolYears]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateSchoolYear($request);
        $data['active'] = (bool) ($data['active'] ?? false);

        $schoolYear = DB::transaction(function () use ($data): SchoolYear {
            if ($data['active']) {
                SchoolYear::query()->where('active', true)->update(['active' => false]);
            }

            return SchoolYear::create($data);
        });

        Journal::log('Création de l’année scolaire '.$schoolYear->libelle, $schoolYear);

        return response()->json($this->schoolYearPayload($schoolYear->loadCount('classes')), 201);
    }

    public function update(Request $request, SchoolYear $schoolYear): JsonResponse
    {
        $data = $this->validateSchoolYear($request, $schoolYear);
        $data['active'] = array_key_exists('active', $data)
            ? (bool) $data['active']
            : $schoolYear->active;

        DB::transaction(function () use ($schoolYear, $data): void {
            if ($data['active']) {
                SchoolYear::query()
                    ->whereKeyNot($schoolYear->id)
                    ->where('active', true)
                    ->update(['active' => false]);
            }

            $schoolYear->update($data);
        });

        Journal::log('Modification de l’année scolaire '.$schoolYear->libelle, $schoolYear);

        return response()->json($this->schoolYearPayload($schoolYear->fresh()->loadCount('classes')));
    }

    public function activate(SchoolYear $schoolYear): JsonResponse
    {
        DB::transaction(function () use ($schoolYear): void {
            SchoolYear::query()
                ->whereKeyNot($schoolYear->id)
                ->where('active', true)
                ->update(['active' => false]);

            $schoolYear->update(['active' => true]);
        });

        Journal::log('Activation de l’année scolaire '.$schoolYear->libelle, $schoolYear);

        return response()->json([
            'message' => 'L’année scolaire a été activée.',
            'annee' => $this->schoolYearPayload($schoolYear->fresh()->loadCount('classes')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateSchoolYear(Request $request, ?SchoolYear $schoolYear = null): array
    {
        return $request->validate([
            'libelle' => [
                'required',
                'string',
                'max:255',
                Rule::unique('school_years', 'libelle')->ignore($schoolYear?->id),
            ],
            'debut' => ['required', 'date'],
            'fin' => ['required', 'date', 'after_or_equal:debut'],
            'active' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function schoolYearPayload(SchoolYear $schoolYear): array
    {
        return [
            'id' => $schoolYear->id,
            'libelle' => $schoolYear->libelle,
            'debut' => $schoolYear->debut?->format('Y-m-d'),
            'fin' => $schoolYear->fin?->format('Y-m-d'),
            'active' => (bool) $schoolYear->active,
            'classes_count' => $schoolYear->classes_count ?? null,
        ];
    }
}
