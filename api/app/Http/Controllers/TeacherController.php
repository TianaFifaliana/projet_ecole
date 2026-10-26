<?php

namespace App\Http\Controllers;

use App\Models\Teacher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeacherController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $teachers = Teacher::query()
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $term = '%'.trim($search).'%';

                $query->where(function (Builder $query) use ($term): void {
                    $query->where('nom', 'like', $term)
                        ->orWhere('prenoms', 'like', $term);
                });
            })
            ->orderBy('nom')
            ->orderBy('prenoms')
            ->orderBy('id')
            ->get(['id', 'nom', 'prenoms', 'statut'])
            ->map(fn (Teacher $teacher): array => [
                'id' => $teacher->id,
                'nom' => $teacher->nom,
                'prenoms' => $teacher->prenoms,
                'nom_complet' => trim($teacher->nom.' '.($teacher->prenoms ?? '')),
                'statut' => $teacher->statut,
            ])
            ->values()
            ->all();

        return response()->json(['data' => $teachers]);
    }
}
