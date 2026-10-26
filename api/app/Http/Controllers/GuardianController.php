<?php

namespace App\Http\Controllers;

use App\Models\Guardian;
use App\Models\Student;
use App\Support\Journal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GuardianController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $guardians = Guardian::query()
            ->withCount('students')
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $term = '%'.trim($search).'%';

                $query->where(function (Builder $query) use ($term): void {
                    $query->where('nom', 'like', $term)
                        ->orWhere('telephone', 'like', $term)
                        ->orWhere('email', 'like', $term);
                });
            })
            ->orderBy('nom')
            ->orderBy('id')
            ->limit(100)
            ->get()
            ->map(fn (Guardian $guardian): array => $this->guardianPayload($guardian))
            ->values()
            ->all();

        return response()->json(['data' => $guardians]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateGuardian($request);
        $guardian = Guardian::create($data);

        Journal::log('Création du parent '.$guardian->nom, $guardian);

        return response()->json($this->guardianPayload($guardian), 201);
    }

    public function update(Request $request, Guardian $guardian): JsonResponse
    {
        $data = $this->validateGuardian($request);
        $guardian->update($data);

        Journal::log('Modification du parent '.$guardian->nom, $guardian);

        return response()->json($this->guardianPayload($guardian));
    }

    public function attach(Request $request, Student $student): JsonResponse
    {
        $data = $request->validate([
            'guardian_id' => ['required', 'integer', 'exists:guardians,id'],
            'lien_parente' => ['nullable', 'string', 'max:100'],
        ]);

        $guardian = Guardian::findOrFail($data['guardian_id']);
        $lien = $data['lien_parente'] ?? null;

        if ($student->guardians()->whereKey($guardian->id)->exists()) {
            $student->guardians()->updateExistingPivot($guardian->id, ['lien_parente' => $lien]);
        } else {
            $student->guardians()->attach($guardian->id, ['lien_parente' => $lien]);
        }

        Journal::log(
            'Rattachement du parent '.$guardian->nom.' à l’élève '.$student->nom_complet,
            $student,
            ['lien_parente' => $lien],
        );

        return response()->json([
            'message' => 'Le parent a été rattaché à l’élève.',
            'guardian' => [
                ...$this->guardianPayload($guardian),
                'lien_parente' => $lien,
            ],
        ]);
    }

    public function detach(Student $student, Guardian $guardian): JsonResponse
    {
        $student->guardians()->detach($guardian->id);

        Journal::log(
            'Détachement du parent '.$guardian->nom.' de l’élève '.$student->nom_complet,
            $student,
        );

        return response()->json(['message' => 'Le parent a été détaché de l’élève.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateGuardian(Request $request): array
    {
        return $request->validate([
            'nom' => ['required', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'profession' => ['nullable', 'string', 'max:255'],
            'adresse' => ['nullable', 'string', 'max:255'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function guardianPayload(Guardian $guardian): array
    {
        return [
            'id' => $guardian->id,
            'nom' => $guardian->nom,
            'telephone' => $guardian->telephone,
            'email' => $guardian->email,
            'profession' => $guardian->profession,
            'adresse' => $guardian->adresse,
            'enfants_count' => $guardian->students_count ?? null,
        ];
    }
}
