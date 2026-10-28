<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\Student;
use App\Support\Journal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $groups = Group::query()
            ->with(['teacher.user', 'students'])
            ->withCount('students')
            ->orderBy('nom')
            ->get()
            ->map(fn (Group $group) => [
                'id' => $group->id,
                'nom' => $group->nom,
                'type' => $group->type,
                'capacite' => $group->capacite,
                'teacher_id' => $group->teacher_id,
                'teacher' => $group->teacher ? [
                    'id' => $group->teacher->id,
                    'nom' => $group->teacher->nom,
                    'prenoms' => $group->teacher->prenoms,
                ] : null,
                'students_count' => $group->students_count,
                'students' => $group->students->map(fn ($s) => [
                    'id' => $s->id,
                    'nom' => $s->nom,
                    'prenoms' => $s->prenoms,
                    'nom_complet' => $s->nom_complet,
                    'matricule' => $s->matricule,
                ]),
            ]);

        return response()->json($groups);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nom' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:50'],
            'capacite' => ['nullable', 'integer', 'min:1'],
            'teacher_id' => ['nullable', 'integer', 'exists:teachers,id'],
        ]);

        $group = Group::create($data);
        $group->load(['teacher.user']);

        Journal::log('Création du groupe '.$group->nom, $group);

        return response()->json([
            'id' => $group->id,
            'nom' => $group->nom,
            'type' => $group->type,
            'capacite' => $group->capacite,
            'teacher_id' => $group->teacher_id,
        ], 201);
    }

    public function show(Group $group): JsonResponse
    {
        $group->load(['teacher.user', 'students']);

        return response()->json([
            'id' => $group->id,
            'nom' => $group->nom,
            'type' => $group->type,
            'capacite' => $group->capacite,
            'teacher_id' => $group->teacher_id,
            'teacher' => $group->teacher,
            'students' => $group->students->map(fn ($s) => [
                'id' => $s->id,
                'nom' => $s->nom,
                'prenoms' => $s->prenoms,
                'nom_complet' => $s->nom_complet,
                'matricule' => $s->matricule,
            ]),
        ]);
    }

    public function update(Request $request, Group $group): JsonResponse
    {
        $data = $request->validate([
            'nom' => ['sometimes', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:50'],
            'capacite' => ['nullable', 'integer', 'min:1'],
            'teacher_id' => ['nullable', 'integer', 'exists:teachers,id'],
        ]);

        $group->update($data);
        Journal::log('Modification du groupe '.$group->nom, $group);

        return response()->json(['id' => $group->id, 'nom' => $group->nom, 'type' => $group->type, 'capacite' => $group->capacite, 'teacher_id' => $group->teacher_id]);
    }

    public function destroy(Group $group): JsonResponse
    {
        $group->delete();
        Journal::log('Suppression du groupe '.$group->nom, $group);

        return response()->json(['message' => 'Groupe supprimé']);
    }

    public function attachStudent(Request $request, Group $group): JsonResponse
    {
        $data = $request->validate([
            'student_id' => ['required', 'integer', 'exists:students,id'],
        ]);

        if ($group->capacite) {
            $count = $group->students()->count();
            if ($count >= $group->capacite) {
                return response()->json(['message' => 'Capacité du groupe atteinte.'], 422);
            }
        }

        if ($group->students()->where('student_id', $data['student_id'])->exists()) {
            return response()->json(['message' => 'Cet élève est déjà dans le groupe.'], 422);
        }

        $group->students()->attach($data['student_id']);
        Journal::log('Ajout d\'un élève au groupe '.$group->nom, $group);

        return response()->json(['message' => 'Élève ajouté au groupe']);
    }

    public function detachStudent(Group $group, Student $student): JsonResponse
    {
        $group->students()->detach($student->id);
        Journal::log('Retrait d\'un élève du groupe '.$group->nom, $group);

        return response()->json(['message' => 'Élève retiré du groupe']);
    }
}
