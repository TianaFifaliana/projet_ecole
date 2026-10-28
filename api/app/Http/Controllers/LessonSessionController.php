<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\LessonSession;
use App\Models\Setting;
use App\Support\Journal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LessonSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = LessonSession::query()->with(['group.students', 'subject', 'teacher.user']);

        if ($request->filled('date')) {
            $query->whereDate('date', $request->date('date'));
        }
        if ($request->filled('date_debut')) {
            $query->whereDate('date', '>=', $request->date('date_debut'));
        }
        if ($request->filled('date_fin')) {
            $query->whereDate('date', '<=', $request->date('date_fin'));
        }
        if ($request->filled('group_id')) {
            $query->where('group_id', $request->integer('group_id'));
        }
        if ($request->filled('teacher_id')) {
            $query->where('teacher_id', $request->integer('teacher_id'));
        }

        $sessions = $query->orderBy('date')->orderBy('heure_debut')->get()->map(fn (LessonSession $s) => [
            'id' => $s->id,
            'group_id' => $s->group_id,
            'subject_id' => $s->subject_id,
            'teacher_id' => $s->teacher_id,
            'date' => $s->date?->format('Y-m-d'),
            'heure_debut' => $s->heure_debut,
            'heure_fin' => $s->heure_fin,
            'salle' => $s->salle,
            'group' => $s->group ? ['id' => $s->group->id, 'nom' => $s->group->nom] : null,
            'subject' => $s->subject ? ['id' => $s->subject->id, 'nom' => $s->subject->nom] : null,
            'teacher' => $s->teacher ? ['id' => $s->teacher->id, 'nom' => $s->teacher->nom, 'prenoms' => $s->teacher->prenoms] : null,
            'students_count' => $s->group?->students?->count() ?? 0,
        ]);

        return response()->json($sessions);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'group_id' => ['required', 'integer', 'exists:groups,id'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'teacher_id' => ['nullable', 'integer', 'exists:teachers,id'],
            'date' => ['required', 'date'],
            'heure_debut' => ['required', 'date_format:H:i'],
            'heure_fin' => ['required', 'date_format:H:i', 'after:heure_debut'],
            'salle' => ['nullable', 'string', 'max:100'],
        ]);

        // Détecter les conflits : même professeur ou même salle ne peut pas avoir deux séances qui se chevauchent
        if (! empty($data['teacher_id'])) {
            $conflict = LessonSession::where('teacher_id', $data['teacher_id'])
                ->whereDate('date', $data['date'])
                ->where(function ($q) use ($data) {
                    $q->whereBetween('heure_debut', [$data['heure_debut'], $data['heure_fin']])
                        ->orWhereBetween('heure_fin', [$data['heure_debut'], $data['heure_fin']])
                        ->orWhere(function ($qq) use ($data) {
                            $qq->where('heure_debut', '<=', $data['heure_debut'])
                                ->where('heure_fin', '>=', $data['heure_fin']);
                        });
                })
                ->exists();
            if ($conflict) {
                return response()->json(['message' => 'Conflit : ce professeur a déjà une séance qui chevauche ce créneau.'], 422);
            }
        }

        if (! empty($data['salle'])) {
            $conflict = LessonSession::where('salle', $data['salle'])
                ->whereDate('date', $data['date'])
                ->where(function ($q) use ($data) {
                    $q->whereBetween('heure_debut', [$data['heure_debut'], $data['heure_fin']])
                        ->orWhereBetween('heure_fin', [$data['heure_debut'], $data['heure_fin']])
                        ->orWhere(function ($qq) use ($data) {
                            $qq->where('heure_debut', '<=', $data['heure_debut'])
                                ->where('heure_fin', '>=', $data['heure_fin']);
                        });
                })
                ->exists();
            if ($conflict) {
                return response()->json(['message' => 'Conflit : cette salle est déjà occupée sur ce créneau.'], 422);
            }
        }

        $session = LessonSession::create($data);
        $session->load(['group', 'subject', 'teacher']);

        Journal::log('Planification d\'une séance pour le groupe '.$session->group?->nom, $session);

        return response()->json([
            'id' => $session->id,
            'group_id' => $session->group_id,
            'subject_id' => $session->subject_id,
            'teacher_id' => $session->teacher_id,
            'date' => $session->date?->format('Y-m-d'),
            'heure_debut' => $session->heure_debut,
            'heure_fin' => $session->heure_fin,
            'salle' => $session->salle,
        ], 201);
    }

    public function show(LessonSession $lessonSession): JsonResponse
    {
        $lessonSession->load(['group.students', 'subject', 'teacher.user', 'attendances.student']);

        return response()->json([
            'id' => $lessonSession->id,
            'group_id' => $lessonSession->group_id,
            'subject_id' => $lessonSession->subject_id,
            'teacher_id' => $lessonSession->teacher_id,
            'date' => $lessonSession->date?->format('Y-m-d'),
            'heure_debut' => $lessonSession->heure_debut,
            'heure_fin' => $lessonSession->heure_fin,
            'salle' => $lessonSession->salle,
            'group' => $lessonSession->group,
            'subject' => $lessonSession->subject,
            'teacher' => $lessonSession->teacher,
            'students' => $lessonSession->group?->students->map(fn ($s) => [
                'id' => $s->id,
                'nom' => $s->nom,
                'prenoms' => $s->prenoms,
                'nom_complet' => $s->nom_complet,
                'matricule' => $s->matricule,
                'statut' => $lessonSession->attendances->firstWhere('student_id', $s->id)?->statut,
            ]) ?? [],
        ]);
    }

    public function update(Request $request, LessonSession $lessonSession): JsonResponse
    {
        $data = $request->validate([
            'group_id' => ['sometimes', 'integer', 'exists:groups,id'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'teacher_id' => ['nullable', 'integer', 'exists:teachers,id'],
            'date' => ['sometimes', 'date'],
            'heure_debut' => ['sometimes', 'date_format:H:i'],
            'heure_fin' => ['sometimes', 'date_format:H:i'],
            'salle' => ['nullable', 'string', 'max:100'],
        ]);

        if (isset($data['heure_fin']) && isset($data['heure_debut']) && $data['heure_fin'] <= $data['heure_debut']) {
            return response()->json(['message' => 'L\'heure de fin doit être après l\'heure de début.'], 422);
        }

        $teacherId = $data['teacher_id'] ?? $lessonSession->teacher_id;
        $date = $data['date'] ?? $lessonSession->date?->format('Y-m-d');
        $heureDebut = $data['heure_debut'] ?? $lessonSession->heure_debut;
        $heureFin = $data['heure_fin'] ?? $lessonSession->heure_fin;
        $salle = $data['salle'] ?? $lessonSession->salle;

        if (! empty($teacherId)) {
            $conflict = LessonSession::where('teacher_id', $teacherId)
                ->where('id', '!=', $lessonSession->id)
                ->whereDate('date', $date)
                ->where(function ($q) use ($heureDebut, $heureFin) {
                    $q->whereBetween('heure_debut', [$heureDebut, $heureFin])
                        ->orWhereBetween('heure_fin', [$heureDebut, $heureFin])
                        ->orWhere(function ($qq) use ($heureDebut, $heureFin) {
                            $qq->where('heure_debut', '<=', $heureDebut)
                                ->where('heure_fin', '>=', $heureFin);
                        });
                })
                ->exists();
            if ($conflict) {
                return response()->json(['message' => 'Conflit : ce professeur a déjà une séance qui chevauche ce créneau.'], 422);
            }
        }

        if (! empty($salle)) {
            $conflict = LessonSession::where('salle', $salle)
                ->where('id', '!=', $lessonSession->id)
                ->whereDate('date', $date)
                ->where(function ($q) use ($heureDebut, $heureFin) {
                    $q->whereBetween('heure_debut', [$heureDebut, $heureFin])
                        ->orWhereBetween('heure_fin', [$heureDebut, $heureFin])
                        ->orWhere(function ($qq) use ($heureDebut, $heureFin) {
                            $qq->where('heure_debut', '<=', $heureDebut)
                                ->where('heure_fin', '>=', $heureFin);
                        });
                })
                ->exists();
            if ($conflict) {
                return response()->json(['message' => 'Conflit : cette salle est déjà occupée sur ce créneau.'], 422);
            }
        }

        $lessonSession->update($data);
        Journal::log('Modification d\'une séance', $lessonSession);

        return response()->json($lessonSession->fresh());
    }

    public function destroy(LessonSession $lessonSession): JsonResponse
    {
        $lessonSession->delete();
        Journal::log('Suppression d\'une séance', $lessonSession);

        return response()->json(['message' => 'Séance supprimée']);
    }

    public function appel(Request $request, LessonSession $lessonSession): JsonResponse
    {
        $user = $request->user();
        $role = $user?->role;

        // Le professeur de la séance (rôle professeur) ne peut faire l'appel que de ses propres séances
        if ($role && $role->nom === 'professeur') {
            $teacher = $user->teacher;
            if (! $teacher || $lessonSession->teacher_id != $teacher->id) {
                abort(403, "Vous ne pouvez faire l'appel que de vos propres séances.");
            }
        }

        $lessonSession->load('group.students');
        $members = $lessonSession->group?->students->pluck('id')->map(fn ($id) => (int) $id)->all() ?? [];

        $data = $request->validate([
            'presences' => ['required', 'array'],
        ]);

        $presences = [];
        foreach ($data['presences'] as $studentId => $statut) {
            $sid = (int) $studentId;
            if (! in_array($sid, $members, true)) {
                return response()->json(['message' => 'Seuls les membres du groupe peuvent être marqués.'], 422);
            }
            if (! in_array($statut, ['present', 'absent', 'retard', 'justifie'], true)) {
                return response()->json(['message' => 'Statut invalide.'], 422);
            }
            $presences[$sid] = $statut;
        }

        $lessonSession->faireAppel($presences);
        Journal::log('Appel effectué pour la séance du '.$lessonSession->date?->format('Y-m-d'), $lessonSession);

        return response()->json(['message' => 'Appel enregistré', 'attendances' => $lessonSession->attendances()->get()]);
    }

    public function statistiques(Request $request): JsonResponse
    {
        $setting = Setting::actuel();
        $seuil = $setting->seuil_absences ?? 3;

        // Par élève
        if ($request->filled('student_id')) {
            $studentId = $request->integer('student_id');
            $query = Attendance::query()->where('student_id', $studentId);
            if ($request->filled('date_debut')) {
                $query->whereHas('lessonSession', fn ($q) => $q->whereDate('date', '>=', $request->date('date_debut')));
            }
            if ($request->filled('date_fin')) {
                $query->whereHas('lessonSession', fn ($q) => $q->whereDate('date', '<=', $request->date('date_fin')));
            }
            $total = $query->count();
            $presents = (clone $query)->whereIn('statut', ['present', 'justifie'])->count();
            $absents = (clone $query)->where('statut', 'absent')->count();
            $retards = (clone $query)->where('statut', 'retard')->count();
            $taux = $total > 0 ? round(($presents / $total) * 100, 2) : 100.0;

            return response()->json([
                'student_id' => $studentId,
                'total' => $total,
                'presents' => $presents,
                'absents' => $absents,
                'retards' => $retards,
                'taux_presence' => $taux,
                'seuil_absences' => $seuil,
                'depasse_seuil' => $absents >= $seuil,
            ]);
        }

        // Par groupe
        if ($request->filled('group_id')) {
            $groupId = $request->integer('group_id');
            $sessions = LessonSession::where('group_id', $groupId)
                ->when($request->filled('date_debut'), fn ($q) => $q->whereDate('date', '>=', $request->date('date_debut')))
                ->when($request->filled('date_fin'), fn ($q) => $q->whereDate('date', '<=', $request->date('date_fin')))
                ->pluck('id');
            $total = Attendance::whereIn('lesson_session_id', $sessions)->count();
            $presents = Attendance::whereIn('lesson_session_id', $sessions)->whereIn('statut', ['present', 'justifie'])->count();
            $absents = Attendance::whereIn('lesson_session_id', $sessions)->where('statut', 'absent')->count();
            $taux = $total > 0 ? round(($presents / $total) * 100, 2) : 100.0;

            return response()->json([
                'group_id' => $groupId,
                'total' => $total,
                'presents' => $presents,
                'absents' => $absents,
                'taux_presence' => $taux,
            ]);
        }

        // Élèves dont le nombre d'absences dépasse settings.seuil_absences
        $results = [];
        $students = \App\Models\Student::with('schoolClass')->get();
        foreach ($students as $student) {
            $query = Attendance::query()->where('student_id', $student->id)->where('statut', 'absent');
            if ($request->filled('date_debut')) {
                $query->whereHas('lessonSession', fn ($q) => $q->whereDate('date', '>=', $request->date('date_debut')));
            }
            if ($request->filled('date_fin')) {
                $query->whereHas('lessonSession', fn ($q) => $q->whereDate('date', '<=', $request->date('date_fin')));
            }
            $absents = $query->count();
            if ($absents >= $seuil) {
                $results[] = [
                    'student' => [
                        'id' => $student->id,
                        'nom_complet' => $student->nom_complet,
                        'matricule' => $student->matricule,
                        'school_class' => $student->schoolClass ? ['nom' => $student->schoolClass->nom] : null,
                    ],
                    'nb_absences' => $absents,
                    'seuil' => $seuil,
                ];
            }
        }

        return response()->json($results);
    }
}
