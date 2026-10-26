<?php

namespace App\Http\Controllers;

use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\Setting;
use App\Models\Student;
use App\Models\Subject;
use App\Support\Journal;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class SchoolClassController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'school_year_id' => ['nullable', 'integer', 'exists:school_years,id'],
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $schoolYearId = $filters['school_year_id']
            ?? SchoolYear::query()->where('active', true)->value('id');

        $classes = SchoolClass::query()
            ->with(['professeurPrincipal:id,nom,prenoms', 'schoolYear:id,libelle,active'])
            ->withCount([
                'students as effectif' => fn (Builder $query): Builder => $query->where('statut', '!=', 'archive'),
                'subjects',
            ])
            ->when(
                $schoolYearId,
                fn (Builder $query, $yearId): Builder => $query->where('school_year_id', $yearId),
            )
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $term = '%'.trim($search).'%';

                $query->where(function (Builder $query) use ($term): void {
                    $query->where('nom', 'like', $term)
                        ->orWhere('niveau', 'like', $term);
                });
            })
            ->orderBy('nom')
            ->orderBy('id')
            ->get()
            ->map(fn (SchoolClass $schoolClass): array => $this->classPayload($schoolClass))
            ->values()
            ->all();

        return response()->json(['data' => $classes]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateClass($request);
        $schoolClass = SchoolClass::create($data);
        $schoolClass->load(['professeurPrincipal:id,nom,prenoms', 'schoolYear:id,libelle,active']);
        $schoolClass->loadCount([
            'students as effectif' => fn (Builder $query): Builder => $query->where('statut', '!=', 'archive'),
            'subjects',
        ]);

        Journal::log('Création de la classe '.$schoolClass->nom, $schoolClass);

        return response()->json($this->classPayload($schoolClass), 201);
    }

    public function show(SchoolClass $schoolClass): JsonResponse
    {
        $schoolClass->load([
            'professeurPrincipal:id,nom,prenoms',
            'schoolYear:id,libelle,active',
            'subjects' => fn ($query) => $query->orderBy('intitule'),
            'students' => fn ($query) => $query
                ->where('statut', '!=', 'archive')
                ->orderBy('nom')
                ->orderBy('prenoms')
                ->orderBy('id'),
        ]);

        $payload = $this->classPayload($schoolClass);
        $payload['effectif'] = $schoolClass->students->count();
        $payload['students'] = $schoolClass->students
            ->map(fn (Student $student): array => $this->studentSummary($student))
            ->values()
            ->all();
        $payload['subjects'] = $schoolClass->subjects
            ->map(fn (Subject $subject): array => $this->subjectPayload($subject))
            ->values()
            ->all();

        return response()->json($payload);
    }

    public function update(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        $data = $this->validateClass($request, $schoolClass);

        if (array_key_exists('capacite', $data)) {
            $effectif = $schoolClass->students()->where('statut', '!=', 'archive')->count();

            if ((int) $data['capacite'] < $effectif) {
                throw ValidationException::withMessages([
                    'capacite' => "La capacité ne peut pas être inférieure à l’effectif actuel ({$effectif} élèves).",
                ]);
            }
        }

        $schoolClass->update($data);
        $schoolClass->load(['professeurPrincipal:id,nom,prenoms', 'schoolYear:id,libelle,active']);
        $schoolClass->loadCount([
            'students as effectif' => fn (Builder $query): Builder => $query->where('statut', '!=', 'archive'),
            'subjects',
        ]);

        Journal::log('Modification de la classe '.$schoolClass->nom, $schoolClass);

        return response()->json($this->classPayload($schoolClass));
    }

    public function destroy(SchoolClass $schoolClass): JsonResponse
    {
        $effectif = $schoolClass->students()->where('statut', '!=', 'archive')->count();

        if ($effectif > 0) {
            throw ValidationException::withMessages([
                'classe' => "Impossible de supprimer cette classe : {$effectif} élève(s) y sont encore inscrits.",
            ]);
        }

        Journal::log('Suppression de la classe '.$schoolClass->nom, $schoolClass);
        $schoolClass->delete();

        return response()->json(['message' => 'La classe a été supprimée.']);
    }

    public function students(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $students = $schoolClass->students()
            ->where('statut', '!=', 'archive')
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $term = '%'.trim($search).'%';

                $query->where(function (Builder $query) use ($term): void {
                    $query->where('nom', 'like', $term)
                        ->orWhere('prenoms', 'like', $term)
                        ->orWhere('matricule', 'like', $term);
                });
            })
            ->orderBy('nom')
            ->orderBy('prenoms')
            ->orderBy('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return response()->json([
            'data' => $students->getCollection()
                ->map(fn (Student $student): array => $this->studentSummary($student))
                ->values()
                ->all(),
            'meta' => [
                'current_page' => $students->currentPage(),
                'last_page' => $students->lastPage(),
                'per_page' => $students->perPage(),
                'total' => $students->total(),
                'from' => $students->firstItem(),
                'to' => $students->lastItem(),
            ],
            'links' => [
                'first' => $students->url(1),
                'prev' => $students->previousPageUrl(),
                'next' => $students->nextPageUrl(),
                'last' => $students->url($students->lastPage()),
            ],
        ]);
    }

    public function transferStudent(Request $request, SchoolClass $schoolClass, Student $student): JsonResponse
    {
        abort_unless($student->school_class_id === $schoolClass->id, 404);

        $data = $request->validate([
            'target_school_class_id' => ['required', 'integer', 'exists:school_classes,id'],
        ]);

        $target = SchoolClass::findOrFail($data['target_school_class_id']);

        if ($target->id === $schoolClass->id) {
            throw ValidationException::withMessages([
                'target_school_class_id' => 'L’élève est déjà inscrit dans cette classe.',
            ]);
        }

        $effectif = $target->students()->where('statut', '!=', 'archive')->count();

        if ($effectif >= $target->capacite) {
            throw ValidationException::withMessages([
                'target_school_class_id' => "La classe de destination a atteint sa capacité maximale ({$target->capacite}).",
            ]);
        }

        $sourceId = $schoolClass->id;
        $sourceName = $schoolClass->nom;

        DB::transaction(function () use ($student, $target, $sourceId, $sourceName): void {
            $student->update(['school_class_id' => $target->id]);

            Journal::log(
                'Transfert de l’élève '.$student->nom_complet.' de '.$sourceName.' vers '.$target->nom,
                $student,
                [
                    'classe_source_id' => $sourceId,
                    'classe_destination_id' => $target->id,
                    'classe_source' => $sourceName,
                    'classe_destination' => $target->nom,
                ],
            );
        });

        return response()->json([
            'message' => 'L’élève a été transféré dans la classe '.$target->nom.'.',
            'eleve' => $this->studentSummary($student->fresh()),
        ]);
    }

    public function syncSubjects(Request $request, SchoolClass $schoolClass): JsonResponse
    {
        $data = $request->validate([
            'subject_ids' => ['present', 'array'],
            'subject_ids.*' => ['integer', 'exists:subjects,id'],
        ]);

        $schoolClass->subjects()->sync($data['subject_ids']);

        Journal::log('Mise à jour des matières de la classe '.$schoolClass->nom, $schoolClass);

        $subjects = $schoolClass->subjects()
            ->orderBy('intitule')
            ->get()
            ->map(fn (Subject $subject): array => $this->subjectPayload($subject))
            ->values()
            ->all();

        return response()->json(['subjects' => $subjects]);
    }

    public function detachSubject(SchoolClass $schoolClass, Subject $subject): JsonResponse
    {
        $schoolClass->subjects()->detach($subject->id);

        return response()->json(['message' => 'La matière a été retirée de la classe.']);
    }

    public function exportPdf(SchoolClass $schoolClass): Response
    {
        $schoolClass->load([
            'professeurPrincipal:id,nom,prenoms',
            'schoolYear:id,libelle',
            'subjects' => fn ($query) => $query->orderBy('intitule'),
            'students' => fn ($query) => $query
                ->where('statut', '!=', 'archive')
                ->orderBy('nom')
                ->orderBy('prenoms')
                ->orderBy('id'),
        ]);

        $setting = Setting::query()->first();
        $pdf = Pdf::loadView('classes.pdf', [
            'schoolClass' => $schoolClass,
            'setting' => $setting,
            'students' => $schoolClass->students,
            'generatedAt' => now(),
        ])->setPaper('a4', 'portrait');

        $filename = 'classe-'.$schoolClass->nom.'-'.$schoolClass->schoolYear?->libelle;

        return $pdf->download(Str::slug($filename).'.pdf');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateClass(Request $request, ?SchoolClass $schoolClass = null): array
    {
        $schoolYearId = $request->input('school_year_id', $schoolClass?->school_year_id);

        return $request->validate([
            'school_year_id' => ['required', 'integer', 'exists:school_years,id'],
            'teacher_id' => ['nullable', 'integer', 'exists:teachers,id'],
            'nom' => [
                'required',
                'string',
                'max:255',
                Rule::unique('school_classes', 'nom')
                    ->where(fn ($query) => $query->where('school_year_id', $schoolYearId))
                    ->ignore($schoolClass?->id),
            ],
            'niveau' => ['nullable', 'string', 'max:255'],
            'capacite' => ['required', 'integer', 'min:1', 'max:1000'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function classPayload(SchoolClass $schoolClass): array
    {
        $effectif = $schoolClass->effectif
            ?? ($schoolClass->relationLoaded('students')
                ? $schoolClass->students->count()
                : null);
        $capacite = (int) $schoolClass->capacite;

        return [
            'id' => $schoolClass->id,
            'nom' => $schoolClass->nom,
            'niveau' => $schoolClass->niveau,
            'capacite' => $capacite,
            'effectif' => $effectif,
            'taux_remplissage' => $effectif !== null && $capacite > 0
                ? min(100, (int) round(($effectif / $capacite) * 100))
                : 0,
            'teacher_id' => $schoolClass->teacher_id,
            'professeur_principal' => $schoolClass->professeurPrincipal ? [
                'id' => $schoolClass->professeurPrincipal->id,
                'nom_complet' => trim(
                    $schoolClass->professeurPrincipal->nom.' '.($schoolClass->professeurPrincipal->prenoms ?? ''),
                ),
            ] : null,
            'school_year_id' => $schoolClass->school_year_id,
            'school_year' => $schoolClass->schoolYear ? [
                'id' => $schoolClass->schoolYear->id,
                'libelle' => $schoolClass->schoolYear->libelle,
                'active' => (bool) $schoolClass->schoolYear->active,
            ] : null,
            'subjects_count' => $schoolClass->subjects_count
                ?? ($schoolClass->relationLoaded('subjects') ? $schoolClass->subjects->count() : null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function studentSummary(Student $student): array
    {
        return [
            'id' => $student->id,
            'matricule' => $student->matricule,
            'nom' => $student->nom,
            'prenoms' => $student->prenoms,
            'nom_complet' => $student->nom_complet,
            'date_naissance' => $student->date_naissance?->format('Y-m-d'),
            'sexe' => $student->sexe,
            'statut' => $student->statut,
            'photo_url' => $student->photo_url,
            'school_class_id' => $student->school_class_id,
        ];
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
        ];
    }
}
