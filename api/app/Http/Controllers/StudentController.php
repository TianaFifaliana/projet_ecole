<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Support\Journal;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class StudentController extends Controller
{
    private const STATUTS = ['actif', 'inactif', 'archive'];

    public function index(Request $request): JsonResponse
    {
        $filters = $this->validateFilters($request);

        $students = $this->applyFilters(
            Student::query()->with('schoolClass:id,nom,school_year_id')->withCount('guardians'),
            $filters,
        )
            ->orderBy('nom')
            ->orderBy('prenoms')
            ->orderBy('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return response()->json([
            'data' => $students->getCollection()
                ->map(fn (Student $student): array => $this->studentPayload($student))
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

    public function show(Student $student): JsonResponse
    {
        $student->load([
            'schoolClass.schoolYear',
            'guardians',
            'documents' => fn ($query) => $query->orderByDesc('date_ajout')->orderByDesc('id'),
        ]);

        $schoolYearId = $student->schoolClass?->school_year_id;
        $totalDu = $schoolYearId
            ? (float) Fee::query()->where('school_year_id', $schoolYearId)->sum('montant')
            : 0.0;
        $totalPaye = (float) $student->payments()
            ->where('statut', 'valide')
            ->sum('montant');
        $nombrePaiements = $student->payments()->where('statut', 'valide')->count();

        $payload = $this->studentPayload($student);
        $payload['guardians'] = $student->guardians
            ->map(fn ($guardian): array => [
                'id' => $guardian->id,
                'nom' => $guardian->nom,
                'telephone' => $guardian->telephone,
                'email' => $guardian->email,
                'profession' => $guardian->profession,
                'adresse' => $guardian->adresse,
                'lien_parente' => $guardian->pivot?->lien_parente,
            ])
            ->values()
            ->all();
        $payload['documents'] = $student->documents
            ->map(fn ($document): array => $this->documentPayload($student, $document))
            ->values()
            ->all();
        $payload['paiements'] = [
            'total_du' => $totalDu,
            'total_paye' => $totalPaye,
            'reste_a_payer' => max(0.0, $totalDu - $totalPaye),
            'nombre_paiements' => $nombrePaiements,
        ];

        return response()->json($payload);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'matricule' => ['nullable', 'string', 'max:50', 'unique:students,matricule'],
            'nom' => ['required', 'string', 'max:255'],
            'prenoms' => ['nullable', 'string', 'max:255'],
            'date_naissance' => ['nullable', 'date', 'before_or_equal:today'],
            'lieu_naissance' => ['nullable', 'string', 'max:255'],
            'sexe' => ['nullable', Rule::in(['M', 'F'])],
            'adresse' => ['nullable', 'string', 'max:255'],
            'school_class_id' => ['nullable', 'integer', 'exists:school_classes,id'],
            'statut' => ['nullable', Rule::in(self::STATUTS)],
        ]);

        if (blank($data['matricule'] ?? null)) {
            $data['matricule'] = $this->generateMatricule();
        }

        $data['statut'] = $data['statut'] ?? 'actif';

        $student = Student::create($data);
        $student->load('schoolClass:id,nom,school_year_id');

        Journal::log('Création de l’élève '.$student->nom_complet, $student);

        return response()->json($this->studentPayload($student), 201);
    }

    public function update(Request $request, Student $student): JsonResponse
    {
        $data = $request->validate([
            'matricule' => [
                'sometimes',
                'string',
                'max:50',
                Rule::unique('students', 'matricule')->ignore($student->id),
            ],
            'nom' => ['sometimes', 'required', 'string', 'max:255'],
            'prenoms' => ['nullable', 'string', 'max:255'],
            'date_naissance' => ['nullable', 'date', 'before_or_equal:today'],
            'lieu_naissance' => ['nullable', 'string', 'max:255'],
            'sexe' => ['nullable', Rule::in(['M', 'F'])],
            'adresse' => ['nullable', 'string', 'max:255'],
            'school_class_id' => ['nullable', 'integer', 'exists:school_classes,id'],
            'statut' => ['sometimes', Rule::in(self::STATUTS)],
        ]);

        $student->update($data);
        $student->load('schoolClass:id,nom,school_year_id');

        Journal::log('Modification de l’élève '.$student->nom_complet, $student);

        return response()->json($this->studentPayload($student));
    }

    public function destroy(Student $student): JsonResponse
    {
        $student->update(['statut' => 'archive']);

        Journal::log('Archivage de l’élève '.$student->nom_complet, $student);

        return response()->json([
            'message' => 'L’élève a été archivé.',
            'eleve' => $this->studentPayload($student->fresh('schoolClass:id,nom,school_year_id')),
        ]);
    }

    public function uploadPhoto(Request $request, Student $student): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $file = $request->file('photo');
        $path = $this->storeResizedPhoto($file);

        if ($student->photo) {
            Storage::disk('public')->delete($student->photo);
        }

        $student->update(['photo' => $path]);

        Journal::log('Mise à jour de la photo de '.$student->nom_complet, $student);

        return response()->json([
            'message' => 'La photo a été enregistrée.',
            'photo_url' => $student->fresh()->photo_url,
            'eleve' => $this->studentPayload($student->fresh('schoolClass:id,nom,school_year_id')),
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'fichier' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $file = $request->file('fichier');
        $content = file_get_contents($file->getRealPath());

        if ($content === false) {
            throw ValidationException::withMessages([
                'fichier' => 'Impossible de lire le fichier envoyé.',
            ]);
        }

        if (! mb_check_encoding($content, 'UTF-8')) {
            $content = mb_convert_encoding($content, 'UTF-8', 'Windows-1252');
        }

        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content) ?? $content;

        $stream = fopen('php://temp', 'r+');

        if ($stream === false) {
            throw ValidationException::withMessages([
                'fichier' => 'Impossible de préparer le fichier pour l’import.',
            ]);
        }

        fwrite($stream, $content);
        rewind($stream);

        $firstLine = fgets($stream) ?: '';
        rewind($stream);
        $delimiter = $this->detectDelimiter($firstLine);
        $header = fgetcsv($stream, 0, $delimiter);
        $header = array_map(fn ($column): string => Str::slug((string) $column, '_'), $header ?: []);

        $requiredColumns = ['nom', 'prenoms', 'date_naissance', 'sexe', 'classe'];
        $missingColumns = array_diff($requiredColumns, $header);

        if ($missingColumns !== []) {
            fclose($stream);

            throw ValidationException::withMessages([
                'fichier' => 'Colonnes manquantes dans le fichier : '.implode(', ', $missingColumns).'.',
            ]);
        }

        [$classesById, $classesByName] = $this->classLookup();

        $lineNumber = 1;
        $totalLines = 0;
        $imported = 0;
        $errors = [];

        while (($row = fgetcsv($stream, 0, $delimiter)) !== false) {
            $lineNumber++;

            if ($row === [null] || $this->isEmptyRow($row)) {
                continue;
            }

            $totalLines++;
            $line = [];

            foreach ($header as $index => $column) {
                $line[$column] = trim((string) ($row[$index] ?? ''));
            }

            $rowErrors = [];
            $nom = $line['nom'] ?? '';

            if ($nom === '') {
                $rowErrors[] = 'Le nom est obligatoire.';
            }

            $dateNaissance = $this->parseDate($line['date_naissance'] ?? '');

            if ($dateNaissance === null) {
                $rowErrors[] = 'La date de naissance est invalide (format attendu : AAAA-MM-JJ).';
            }

            $sexe = $this->normalizeSexe($line['sexe'] ?? '');

            if ($sexe === null) {
                $rowErrors[] = 'Le sexe doit être M ou F.';
            }

            $class = $this->resolveClass($line['classe'] ?? '', $classesById, $classesByName);

            if ($class === null) {
                $rowErrors[] = 'La classe « '.($line['classe'] ?? '').' » est introuvable.';
            }

            if ($rowErrors !== []) {
                $errors[] = ['ligne' => $lineNumber, 'raison' => implode(' ', $rowErrors)];

                continue;
            }

            try {
                DB::transaction(function () use ($line, $nom, $dateNaissance, $sexe, $class): void {
                    Student::create([
                        'school_class_id' => $class->id,
                        'matricule' => $this->generateMatricule(),
                        'nom' => $nom,
                        'prenoms' => $line['prenoms'] ?: null,
                        'date_naissance' => $dateNaissance,
                        'sexe' => $sexe,
                        'statut' => 'actif',
                    ]);
                });

                $imported++;
            } catch (Throwable $exception) {
                Log::error('Import CSV des élèves : échec pour la ligne '.$lineNumber, [
                    'exception' => $exception,
                ]);

                $errors[] = [
                    'ligne' => $lineNumber,
                    'raison' => 'Cette ligne n’a pas pu être enregistrée.',
                ];
            }
        }

        fclose($stream);

        Journal::log('Import CSV des élèves', null, [
            'lignes_importees' => $imported,
            'lignes_en_erreur' => count($errors),
        ]);

        return response()->json([
            'total_lignes' => $totalLines,
            'importes' => $imported,
            'erreurs' => $errors,
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $filters = $this->validateFilters($request);

        $students = $this->applyFilters(
            Student::query()->with('schoolClass:id,nom'),
            $filters,
        )
            ->orderBy('nom')
            ->orderBy('prenoms')
            ->orderBy('id')
            ->get();

        $filename = 'eleves-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($students): void {
            $output = fopen('php://output', 'w');

            if ($output === false) {
                return;
            }

            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, [
                'matricule',
                'nom',
                'prenoms',
                'date_naissance',
                'sexe',
                'lieu_naissance',
                'adresse',
                'classe',
                'statut',
            ]);

            foreach ($students as $student) {
                fputcsv($output, [
                    $student->matricule,
                    $student->nom,
                    $student->prenoms,
                    $student->date_naissance?->format('Y-m-d'),
                    $student->sexe,
                    $student->lieu_naissance,
                    $student->adresse,
                    $student->schoolClass?->nom,
                    $student->statut,
                ]);
            }

            fclose($output);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateFilters(Request $request): array
    {
        return $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'classe_id' => ['nullable', 'integer', 'exists:school_classes,id'],
            'statut' => ['nullable', Rule::in(self::STATUTS)],
            'school_year_id' => ['nullable', 'integer', 'exists:school_years,id'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, array $filters): Builder
    {
        $query->when($filters['search'] ?? null, function (Builder $query, string $search): void {
            $term = '%'.trim($search).'%';

            $query->where(function (Builder $query) use ($term): void {
                $query->where('nom', 'like', $term)
                    ->orWhere('prenoms', 'like', $term)
                    ->orWhere('matricule', 'like', $term);
            });
        });

        $query->when(
            $filters['classe_id'] ?? null,
            fn (Builder $query, $classId): Builder => $query->where('school_class_id', $classId),
        );

        $query->when(
            $filters['statut'] ?? null,
            fn (Builder $query, string $statut): Builder => $query->where('statut', $statut),
        );

        $query->when(
            $filters['school_year_id'] ?? null,
            fn (Builder $query, $schoolYearId): Builder => $query->whereHas(
                'schoolClass',
                fn (Builder $query): Builder => $query->where('school_year_id', $schoolYearId),
            ),
        );

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    private function studentPayload(Student $student): array
    {
        $schoolClass = $student->relationLoaded('schoolClass') ? $student->schoolClass : null;

        return [
            'id' => $student->id,
            'matricule' => $student->matricule,
            'nom' => $student->nom,
            'prenoms' => $student->prenoms,
            'nom_complet' => $student->nom_complet,
            'date_naissance' => $student->date_naissance?->format('Y-m-d'),
            'lieu_naissance' => $student->lieu_naissance,
            'sexe' => $student->sexe,
            'adresse' => $student->adresse,
            'statut' => $student->statut,
            'photo_url' => $student->photo_url,
            'school_class_id' => $student->school_class_id,
            'school_class' => $schoolClass ? [
                'id' => $schoolClass->id,
                'nom' => $schoolClass->nom,
                'school_year_id' => $schoolClass->school_year_id,
            ] : null,
            'guardians_count' => $student->guardians_count
                ?? ($student->relationLoaded('guardians') ? $student->guardians->count() : null),
        ];
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

    private function generateMatricule(): string
    {
        $prefix = 'ELV-'.now()->format('Y').'-';
        $lastMatricule = Student::query()
            ->where('matricule', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('matricule');
        $sequence = 1;

        if (is_string($lastMatricule) && preg_match('/(\d+)$/', $lastMatricule, $matches)) {
            $sequence = (int) $matches[1] + 1;
        }

        do {
            $matricule = $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
            $sequence++;
        } while (Student::query()->where('matricule', $matricule)->exists());

        return $matricule;
    }

    private function storeResizedPhoto(UploadedFile $file): string
    {
        $directory = 'students/photos';

        if (
            ! function_exists('imagecreatefromstring')
            || ! function_exists('imagecreatetruecolor')
            || ! function_exists('imagejpeg')
        ) {
            return $file->store($directory, 'public');
        }

        $contents = file_get_contents($file->getRealPath());
        $source = $contents !== false ? @imagecreatefromstring($contents) : false;

        if ($source === false) {
            return $file->store($directory, 'public');
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $maxSize = 800;
        $scale = min(1, $maxSize / max($width, $height));
        $newWidth = max(1, (int) round($width * $scale));
        $newHeight = max(1, (int) round($height * $scale));
        $resized = imagecreatetruecolor($newWidth, $newHeight);
        $white = imagecolorallocate($resized, 255, 255, 255);
        imagefill($resized, 0, 0, $white);
        imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        $temporaryPath = tempnam(sys_get_temp_dir(), 'student_photo_');

        if ($temporaryPath === false) {
            imagedestroy($source);
            imagedestroy($resized);

            return $file->store($directory, 'public');
        }

        $jpegPath = $temporaryPath.'.jpg';
        imagejpeg($resized, $jpegPath, 85);

        imagedestroy($source);
        imagedestroy($resized);
        @unlink($temporaryPath);

        $path = $directory.'/'.Str::uuid().'.jpg';
        Storage::disk('public')->put($path, file_get_contents($jpegPath));
        @unlink($jpegPath);

        return $path;
    }

    private function detectDelimiter(string $line): string
    {
        $delimiters = [',' => substr_count($line, ','), ';' => substr_count($line, ';'), "\t" => substr_count($line, "\t")];
        arsort($delimiters);

        return (string) array_key_first($delimiters) ?: ',';
    }

    /**
     * @param  array<int, mixed>  $row
     */
    private function isEmptyRow(array $row): bool
    {
        foreach ($row as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    private function parseDate(string $value): ?string
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y'] as $format) {
            try {
                $date = Carbon::createFromFormat('!'.$format, $value);
            } catch (Throwable) {
                continue;
            }

            if ($date instanceof Carbon && $date->format($format) === $value) {
                return $date->format('Y-m-d');
            }
        }

        return null;
    }

    private function normalizeSexe(string $value): ?string
    {
        $normalized = Str::upper(Str::ascii(trim($value)));

        return match (true) {
            in_array($normalized, ['M', 'H', 'MASCULIN', 'HOMME', 'GARCON'], true) => 'M',
            in_array($normalized, ['F', 'FEMININ', 'FEMME', 'FILLE'], true) => 'F',
            default => null,
        };
    }

    /**
     * @return array{0: array<int, SchoolClass>, 1: array<string, SchoolClass>}
     */
    private function classLookup(): array
    {
        $activeYearId = SchoolYear::query()->where('active', true)->value('id');
        $classes = SchoolClass::query()->get(['id', 'nom', 'school_year_id'])
            ->sortByDesc(fn (SchoolClass $class): bool => $class->school_year_id === $activeYearId);

        $byId = [];
        $byName = [];

        foreach ($classes as $class) {
            $byId[$class->id] = $class;
            $key = Str::slug($class->nom, ' ');

            if (! isset($byName[$key])) {
                $byName[$key] = $class;
            }
        }

        return [$byId, $byName];
    }

    /**
     * @param  array<int, SchoolClass>  $classesById
     * @param  array<string, SchoolClass>  $classesByName
     */
    private function resolveClass(string $value, array $classesById, array $classesByName): ?SchoolClass
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (ctype_digit($value) && isset($classesById[(int) $value])) {
            return $classesById[(int) $value];
        }

        return $classesByName[Str::slug($value, ' ')] ?? null;
    }
}
