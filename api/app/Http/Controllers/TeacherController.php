<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Journal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TeacherController extends Controller
{
    private const STATUTS = ['actif', 'inactif', 'archive'];

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'statut' => ['nullable', Rule::in(self::STATUTS)],
        ]);

        $teachers = Teacher::query()
            ->with(['user:id,name,email', 'subjects:id,intitule,code', 'classesPrincipales:id,nom,teacher_id'])
            ->withCount('subjects')
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $term = '%'.trim($search).'%';

                $query->where(function (Builder $query) use ($term): void {
                    $query->where('nom', 'like', $term)
                        ->orWhere('prenoms', 'like', $term)
                        ->orWhere('email', 'like', $term)
                        ->orWhere('contact', 'like', $term);
                });
            })
            ->when($filters['subject_id'] ?? null, function (Builder $query, int $subjectId): void {
                $query->whereHas('subjects', fn (Builder $q) => $q->where('subjects.id', $subjectId));
            })
            ->when($filters['statut'] ?? null, fn (Builder $query, string $statut): Builder => $query->where('statut', $statut))
            ->orderBy('nom')
            ->orderBy('prenoms')
            ->orderBy('id')
            ->get()
            ->map(fn (Teacher $teacher): array => $this->teacherPayload($teacher))
            ->values()
            ->all();

        return response()->json(['data' => $teachers]);
    }

    public function show(Teacher $teacher): JsonResponse
    {
        $teacher->load([
            'user:id,name,email',
            'subjects:id,intitule,code,coefficient',
            'classesPrincipales.schoolYear:id,libelle,active',
            'lessonSessions' => fn ($query) => $query
                ->with(['subject:id,intitule,code', 'group:id,nom,school_class_id'])
                ->orderBy('date')
                ->orderBy('heure_debut'),
        ]);

        $payload = $this->teacherPayload($teacher);
        $payload['classes'] = $teacher->classesPrincipales
            ->map(fn (SchoolClass $classe): array => [
                'id' => $classe->id,
                'nom' => $classe->nom,
                'school_year' => $classe->schoolYear ? [
                    'id' => $classe->schoolYear->id,
                    'libelle' => $classe->schoolYear->libelle,
                    'active' => (bool) $classe->schoolYear->active,
                ] : null,
            ])
            ->values()
            ->all();
        $payload['planning'] = $teacher->lessonSessions
            ->map(fn ($session): array => [
                'id' => $session->id,
                'date' => $session->date?->format('Y-m-d'),
                'heure_debut' => $session->heure_debut,
                'heure_fin' => $session->heure_fin,
                'duree_heures' => $session->duree_heures,
                'salle' => $session->salle,
                'statut' => $session->statut,
                'subject' => $session->subject ? [
                    'id' => $session->subject->id,
                    'intitule' => $session->subject->intitule,
                    'code' => $session->subject->code,
                ] : null,
                'group' => $session->group ? [
                    'id' => $session->group->id,
                    'nom' => $session->group->nom,
                    'school_class_id' => $session->group->school_class_id,
                ] : null,
            ])
            ->values()
            ->all();

        return response()->json($payload);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateTeacher($request);

        $teacher = Teacher::create($data);
        $teacher->load(['user:id,name,email', 'subjects:id,intitule,code']);

        Journal::log('Création du professeur '.$teacher->nom_complet, $teacher);

        return response()->json($this->teacherPayload($teacher), 201);
    }

    public function update(Request $request, Teacher $teacher): JsonResponse
    {
        $data = $this->validateTeacher($request, $teacher);
        $teacher->update($data);
        $teacher->load(['user:id,name,email', 'subjects:id,intitule,code']);

        Journal::log('Modification du professeur '.$teacher->nom_complet, $teacher);

        return response()->json($this->teacherPayload($teacher->fresh()));
    }

    public function destroy(Teacher $teacher): JsonResponse
    {
        $teacher->update(['statut' => 'archive']);

        Journal::log('Archivage du professeur '.$teacher->nom_complet, $teacher);

        return response()->json([
            'message' => 'Le professeur a été archivé.',
            'professeur' => $this->teacherPayload($teacher->fresh(['user:id,name,email', 'subjects:id,intitule,code'])),
        ]);
    }

    public function syncSubjects(Request $request, Teacher $teacher): JsonResponse
    {
        $data = $request->validate([
            'subject_ids' => ['present', 'array'],
            'subject_ids.*' => ['integer', 'exists:subjects,id'],
        ]);

        $teacher->subjects()->sync($data['subject_ids']);
        $teacher->load('subjects:id,intitule,code');

        Journal::log("Affectation des matières au professeur {$teacher->nom_complet}", $teacher);

        return response()->json([
            'message' => 'Les matières du professeur ont été mises à jour.',
            'professeur' => $this->teacherPayload($teacher),
        ]);
    }

    public function assignAsMainTeacher(Request $request, Teacher $teacher): JsonResponse
    {
        $data = $request->validate([
            'school_class_id' => ['required', 'integer', 'exists:school_classes,id'],
        ]);

        $classe = SchoolClass::findOrFail($data['school_class_id']);
        $classe->update(['teacher_id' => $teacher->id]);
        $classe->load(['professeurPrincipal:id,nom,prenoms', 'schoolYear:id,libelle,active']);

        Journal::log("Désignation du professeur {$teacher->nom_complet} comme professeur principal de {$classe->nom}", $teacher);

        return response()->json([
            'message' => 'Le professeur a été désigné comme professeur principal.',
            'classe' => [
                'id' => $classe->id,
                'nom' => $classe->nom,
                'professeur_principal' => $classe->professeurPrincipal ? [
                    'id' => $classe->professeurPrincipal->id,
                    'nom' => $classe->professeurPrincipal->nom,
                    'prenoms' => $classe->professeurPrincipal->prenoms,
                    'nom_complet' => trim($classe->professeurPrincipal->nom.' '.($classe->professeurPrincipal->prenoms ?? '')),
                ] : null,
            ],
        ]);
    }

    public function createAccount(Request $request, Teacher $teacher): JsonResponse
    {
        if ($teacher->user_id) {
            throw ValidationException::withMessages([
                'compte' => 'Ce professeur possède déjà un compte de connexion.',
            ]);
        }

        $data = $request->validate([
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
        ]);

        $email = $data['email'] ?? $teacher->email;

        if (! $email) {
            throw ValidationException::withMessages([
                'email' => "Une adresse e-mail est requise pour créer le compte de connexion.",
            ]);
        }

        if (User::where('email', $email)->exists()) {
            throw ValidationException::withMessages([
                'email' => 'Cette adresse e-mail est déjà utilisée par un autre compte.',
            ]);
        }

        $role = Role::where('nom', 'professeur')->first();

        if (! $role) {
            throw ValidationException::withMessages([
                'compte' => "Le rôle 'professeur' est introuvable.",
            ]);
        }

        $temporaryPassword = Str::random(10).'!A1';

        $user = DB::transaction(function () use ($teacher, $email, $role, $temporaryPassword) {
            $user = User::create([
                'name' => trim($teacher->nom.' '.($teacher->prenoms ?? '')),
                'email' => $email,
                'password' => Hash::make($temporaryPassword),
                'role_id' => $role->id,
                'actif' => true,
            ]);

            $teacher->update(['user_id' => $user->id]);

            return $user;
        });

        if (! $teacher->email && $email) {
            $teacher->update(['email' => $email]);
        }

        Journal::log("Création du compte de connexion pour le professeur {$teacher->nom_complet}", $teacher);

        return response()->json([
            'message' => 'Compte de connexion créé avec succès.',
            'temporary_password' => $temporaryPassword,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ], 201);
    }

    public function planning(Teacher $teacher): JsonResponse
    {
        $sessions = $teacher->lessonSessions()
            ->with(['subject:id,intitule,code', 'group:id,nom,school_class_id'])
            ->whereDate('date', '>=', now()->toDateString())
            ->orderBy('date')
            ->orderBy('heure_debut')
            ->get();

        $chargeHoraire = $sessions->sum(fn ($session) => (float) ($session->duree_heures ?? 0));

        $data = $sessions->map(fn ($session): array => [
            'id' => $session->id,
            'date' => $session->date?->format('Y-m-d'),
            'heure_debut' => $session->heure_debut,
            'heure_fin' => $session->heure_fin,
            'duree_heures' => $session->duree_heures,
            'salle' => $session->salle,
            'statut' => $session->statut,
            'subject' => $session->subject ? [
                'id' => $session->subject->id,
                'intitule' => $session->subject->intitule,
                'code' => $session->subject->code,
            ] : null,
            'group' => $session->group ? [
                'id' => $session->group->id,
                'nom' => $session->group->nom,
                'school_class_id' => $session->group->school_class_id,
            ] : null,
        ])->values()->all();

        return response()->json([
            'data' => $data,
            'charge_horaire' => round($chargeHoraire, 2),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateTeacher(Request $request, ?Teacher $teacher = null): array
    {
        return $request->validate([
            'nom' => ['required', 'string', 'max:255'],
            'prenoms' => ['nullable', 'string', 'max:255'],
            'contact' => ['nullable', 'string', 'max:255'],
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('teachers', 'email')->ignore($teacher?->id),
            ],
            'diplomes' => ['nullable', 'string', 'max:1000'],
            'date_embauche' => ['nullable', 'date'],
            'photo' => ['nullable', 'string', 'max:255'],
            'statut' => ['nullable', Rule::in(self::STATUTS)],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function teacherPayload(Teacher $teacher): array
    {
        $nomComplet = trim($teacher->nom.' '.($teacher->prenoms ?? ''));

        return [
            'id' => $teacher->id,
            'nom' => $teacher->nom,
            'prenoms' => $teacher->prenoms,
            'nom_complet' => $nomComplet,
            'contact' => $teacher->contact,
            'email' => $teacher->email,
            'diplomes' => $teacher->diplomes,
            'date_embauche' => $teacher->date_embauche?->format('Y-m-d'),
            'photo' => $teacher->photo,
            'statut' => $teacher->statut,
            'user_id' => $teacher->user_id,
            'has_account' => (bool) $teacher->user_id,
            'user' => $teacher->relationLoaded('user') && $teacher->user ? [
                'id' => $teacher->user->id,
                'name' => $teacher->user->name,
                'email' => $teacher->user->email,
            ] : null,
            'subjects' => $teacher->relationLoaded('subjects')
                ? $teacher->subjects
                    ->map(fn (Subject $subject): array => [
                        'id' => $subject->id,
                        'code' => $subject->code,
                        'intitule' => $subject->intitule,
                        'coefficient' => isset($subject->coefficient) ? (float) $subject->coefficient : null,
                    ])
                    ->values()
                    ->all()
                : [],
            'subjects_count' => $teacher->subjects_count ?? ($teacher->relationLoaded('subjects') ? $teacher->subjects->count() : 0),
            'classes_principales' => $teacher->relationLoaded('classesPrincipales')
                ? $teacher->classesPrincipales
                    ->map(fn (SchoolClass $classe): array => [
                        'id' => $classe->id,
                        'nom' => $classe->nom,
                    ])
                    ->values()
                    ->all()
                : [],
        ];
    }
}
