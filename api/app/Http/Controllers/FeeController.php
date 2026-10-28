<?php

namespace App\Http\Controllers;

use App\Models\Fee;
use App\Support\Journal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Fee::query()->with('schoolYear');

        if ($request->filled('school_year_id')) {
            $query->where('school_year_id', $request->integer('school_year_id'));
        }

        $fees = $query->orderBy('school_year_id')->orderBy('type')->get()->map(fn (Fee $fee) => [
            'id' => $fee->id,
            'school_year_id' => $fee->school_year_id,
            'school_year' => $fee->schoolYear ? ['id' => $fee->schoolYear->id, 'libelle' => $fee->schoolYear->libelle] : null,
            'type' => $fee->type,
            'montant' => (float) $fee->montant,
            'periodicite' => $fee->periodicite,
            'created_at' => $fee->created_at,
            'updated_at' => $fee->updated_at,
        ]);

        return response()->json($fees);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'school_year_id' => ['required', 'integer', 'exists:school_years,id'],
            'type' => ['required', 'string', 'max:255'],
            'montant' => ['required', 'numeric', 'min:0'],
            'periodicite' => ['nullable', 'string', 'max:50'],
        ]);

        $data['periodicite'] = $data['periodicite'] ?? 'annuelle';

        $fee = Fee::create($data);
        $fee->load('schoolYear');

        Journal::log('Création du frais '.$fee->type, $fee);

        return response()->json([
            'id' => $fee->id,
            'school_year_id' => $fee->school_year_id,
            'school_year' => $fee->schoolYear ? ['id' => $fee->schoolYear->id, 'libelle' => $fee->schoolYear->libelle] : null,
            'type' => $fee->type,
            'montant' => (float) $fee->montant,
            'periodicite' => $fee->periodicite,
        ], 201);
    }

    public function show(Fee $fee): JsonResponse
    {
        $fee->load('schoolYear');

        return response()->json([
            'id' => $fee->id,
            'school_year_id' => $fee->school_year_id,
            'school_year' => $fee->schoolYear ? ['id' => $fee->schoolYear->id, 'libelle' => $fee->schoolYear->libelle] : null,
            'type' => $fee->type,
            'montant' => (float) $fee->montant,
            'periodicite' => $fee->periodicite,
        ]);
    }

    public function update(Request $request, Fee $fee): JsonResponse
    {
        $data = $request->validate([
            'school_year_id' => ['sometimes', 'integer', 'exists:school_years,id'],
            'type' => ['sometimes', 'string', 'max:255'],
            'montant' => ['sometimes', 'numeric', 'min:0'],
            'periodicite' => ['sometimes', 'string', 'max:50'],
        ]);

        $fee->update($data);
        $fee->load('schoolYear');

        Journal::log('Modification du frais '.$fee->type, $fee);

        return response()->json([
            'id' => $fee->id,
            'school_year_id' => $fee->school_year_id,
            'school_year' => $fee->schoolYear ? ['id' => $fee->schoolYear->id, 'libelle' => $fee->schoolYear->libelle] : null,
            'type' => $fee->type,
            'montant' => (float) $fee->montant,
            'periodicite' => $fee->periodicite,
        ]);
    }

    public function destroy(Fee $fee): JsonResponse
    {
        $fee->delete();
        Journal::log('Suppression du frais '.$fee->type, $fee);

        return response()->json(['message' => 'Frais supprimé']);
    }
}
