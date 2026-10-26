<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Student;
use App\Support\Journal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    private const TYPES = ['acte_naissance', 'bulletin', 'certificat_medical', 'autre'];

    public function index(Student $student): JsonResponse
    {
        $documents = $student->documents()
            ->orderByDesc('date_ajout')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Document $document): array => $this->documentPayload($student, $document))
            ->values()
            ->all();

        return response()->json(['data' => $documents]);
    }

    public function store(Request $request, Student $student): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(self::TYPES)],
            'fichier' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $file = $request->file('fichier');
        $path = $file->store('documents/'.$student->id, 'local');

        $document = $student->documents()->create([
            'type' => $data['type'],
            'chemin_fichier' => $path,
            'nom_original' => basename($file->getClientOriginalName()),
            'mime_type' => $file->getClientMimeType(),
            'taille' => $file->getSize(),
            'date_ajout' => now()->toDateString(),
        ]);

        Journal::log('Ajout d’un document à l’élève '.$student->nom_complet, $document, [
            'type' => $document->type,
        ]);

        return response()->json($this->documentPayload($student, $document), 201);
    }

    public function download(Student $student, Document $document): StreamedResponse
    {
        $this->ensureDocumentBelongsToStudent($student, $document);

        abort_unless(
            Storage::disk('local')->exists($document->chemin_fichier),
            404,
            'Le fichier demandé est introuvable.',
        );

        return Storage::disk('local')->download(
            $document->chemin_fichier,
            $document->nom ?: basename($document->chemin_fichier),
        );
    }

    public function destroy(Student $student, Document $document): JsonResponse
    {
        $this->ensureDocumentBelongsToStudent($student, $document);

        Storage::disk('local')->delete($document->chemin_fichier);
        $document->delete();

        Journal::log('Suppression d’un document de l’élève '.$student->nom_complet, $student);

        return response()->json(['message' => 'Le document a été supprimé.']);
    }

    private function ensureDocumentBelongsToStudent(Student $student, Document $document): void
    {
        abort_unless($document->student_id === $student->id, 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function documentPayload(Student $student, Document $document): array
    {
        return [
            'id' => $document->id,
            'type' => $document->type,
            'nom' => $document->nom,
            'mime_type' => $document->mime_type,
            'taille' => $document->taille,
            'date_ajout' => $document->date_ajout?->format('Y-m-d'),
            'download_url' => '/students/'.$student->id.'/documents/'.$document->id.'/download',
        ];
    }
}
