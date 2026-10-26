<?php

namespace App\Http\Controllers;

use App\Models\SchoolClass;
use App\Models\Subject;
use App\Support\Journal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SubjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $subjects = Subject::query()
            ->with('classes:id,nom,school_year_id')
            ->withCount('classes')
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $term = '%'.trim($search).'%';

                $query->where(function (Builder $query) use ($term): void {
                    $query->where('code', 'like', $term)
                        ->orWhere('intitule', 'like', $term);
                });
            })
            ->orderBy('intitule')
            ->orderBy('id')
            ->get()
            ->map(fn (Subject $subject): array => $this->subjectPayload($subject))
            ->values()
            ->all();

        return response()->json(['data' => $subjects]);
    }

    public function show(Subject $subject): JsonResponse
    {
        $subject->load('classes:id,nom,school_year_id')->loadCount('classes');

        return response()->json($this->subjectPayload($subject));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateSubject($request);
        $subject = Subject::create($data);

        Journal::log('Création de la matière '.$subject->intitule, $subject);

        return response()->json($this->subjectPayload($subject->loadCount('classes')), 201);
    }

    public function update(Request $request, Subject $subject): JsonResponse
    {
        $data = $this->validateSubject($request, $subject);
        $subject->update($data);

        Journal::log('Modification de la matière '.$subject->intitule, $subject);

        return response()->json($this->subjectPayload($subject->fresh()->loadCount('classes')));
    }

    public function destroy(Subject $subject): JsonResponse
    {
        $classesCount = $subject->classes()->count();

        if ($classesCount > 0) {
            throw ValidationException::withMessages([
                'matiere' => "Impossible de supprimer cette matière : elle est associée à {$classesCount} classe(s).",
            ]);
        }

        Journal::log('Suppression de la matière '.$subject->intitule, $subject);
        $subject->delete();

        return response()->json(['message' => 'La matière a été supprimée.']);
    }

    public function syncClasses(Request $request, Subject $subject): JsonResponse
    {
        $data = $request->validate([
            'class_ids' => ['present', 'array'],
            'class_ids.*' => ['integer', 'exists:school_classes,id'],
        ]);

        $subject->classes()->sync($data['class_ids']);

        Journal::log('Affectation de la matière '.$subject->intitule.' aux classes', $subject);

        return response()->json([
            'message' => 'Les classes associées à la matière ont été mises à jour.',
            'matiere' => $this->subjectPayload(
                $subject->fresh()->load('classes:id,nom,school_year_id')->loadCount('classes'),
            ),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateSubject(Request $request, ?Subject $subject = null): array
    {
        return $request->validate([
            'code' => [
                'required',
                'string',
                'max:30',
                Rule::unique('subjects', 'code')->ignore($subject?->id),
            ],
            'intitule' => ['required', 'string', 'max:255'],
            'coefficient' => ['required', 'numeric', 'min:0.5', 'max:20'],
            'volume_horaire' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function subjectPayload(Subject $subject): array
    {
        return [
            'id' => $subject->id,
            'code' => $subject->code,
            'intitule' => $subject->intitule,
            'coefficient' => (float) $subject->coefficient,
            'volume_horaire' => $subject->volume_horaire,
            'classes_count' => $subject->classes_count
                ?? ($subject->relationLoaded('classes') ? $subject->classes->count() : null),
            'classes' => $subject->relationLoaded('classes')
                ? $subject->classes
                    ->map(fn (SchoolClass $schoolClass): array => [
                        'id' => $schoolClass->id,
                        'nom' => $schoolClass->nom,
                        'school_year_id' => $schoolClass->school_year_id,
                    ])
                    ->values()
                    ->all()
                : [],
        ];
    }
}
