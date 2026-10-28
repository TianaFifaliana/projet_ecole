<?php

namespace App\Http\Controllers;

use App\Models\Fee;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\Setting;
use App\Models\Student;
use App\Support\Journal;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Payment::query()->with(['student.schoolClass', 'fee', 'recuPar']);

        if ($request->filled('date_debut')) {
            $query->whereDate('date_paiement', '>=', $request->date('date_debut'));
        }
        if ($request->filled('date_fin')) {
            $query->whereDate('date_paiement', '<=', $request->date('date_fin'));
        }
        if ($request->filled('classe_id')) {
            $query->whereHas('student', function ($q) use ($request) {
                $q->where('school_class_id', $request->integer('classe_id'));
            });
        }
        if ($request->filled('mode')) {
            $query->where('mode', $request->string('mode'));
        }
        if ($request->filled('statut')) {
            $query->where('statut', $request->string('statut'));
        }
        if ($request->filled('student_id')) {
            $query->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('fee_id')) {
            $query->where('fee_id', $request->integer('fee_id'));
        }

        $payments = $query->orderByDesc('date_paiement')->orderByDesc('id')->paginate((int) ($request->integer('per_page') ?: 15))->withQueryString();

        $data = $payments->getCollection()->map(fn (Payment $payment) => [
            'id' => $payment->id,
            'numero_recu' => $payment->numero_recu,
            'student' => $payment->student ? [
                'id' => $payment->student->id,
                'nom' => $payment->student->nom,
                'prenoms' => $payment->student->prenoms,
                'nom_complet' => $payment->student->nom_complet,
                'matricule' => $payment->student->matricule,
                'school_class' => $payment->student->schoolClass ? ['id' => $payment->student->schoolClass->id, 'nom' => $payment->student->schoolClass->nom] : null,
            ] : null,
            'fee' => $payment->fee ? ['id' => $payment->fee->id, 'type' => $payment->fee->type, 'montant' => (float) $payment->fee->montant] : null,
            'montant' => (float) $payment->montant,
            'date_paiement' => $payment->date_paiement?->format('Y-m-d'),
            'mode' => $payment->mode,
            'reference' => $payment->reference,
            'statut' => $payment->statut,
            'motif_annulation' => $payment->motif_annulation,
            'recu_par' => $payment->recuPar ? ['id' => $payment->recuPar->id, 'name' => $payment->recuPar->name] : null,
        ])->values()->all();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $payments->currentPage(),
                'last_page' => $payments->lastPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'from' => $payments->firstItem(),
                'to' => $payments->lastItem(),
            ],
            'links' => [
                'first' => $payments->url(1),
                'prev' => $payments->previousPageUrl(),
                'next' => $payments->nextPageUrl(),
                'last' => $payments->url($payments->lastPage()),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'student_id' => ['required', 'integer', 'exists:students,id'],
            'fee_id' => ['required', 'integer', 'exists:fees,id'],
            'montant' => ['required', 'numeric', 'min:0.01'],
            'date_paiement' => ['required', 'date'],
            'mode' => ['required', 'string', Rule::in(['especes', 'virement', 'mobile_money', 'cheque'])],
            'reference' => ['nullable', 'string', 'max:255'],
        ]);

        $student = Student::with('schoolClass')->findOrFail($data['student_id']);
        $fee = Fee::findOrFail($data['fee_id']);

        // Vérifier que le frais appartient à l'année scolaire de la classe de l'élève si possible
        if ($student->schoolClass && $student->schoolClass->school_year_id && $fee->school_year_id != $student->schoolClass->school_year_id) {
            // On autorise quand même selon l'énoncé? On vérifie juste le reste dû
        }

        $totalDu = (float) Fee::where('school_year_id', $fee->school_year_id)->sum('montant');
        // Calculer le total dû pour CETTE inscription/frais globalement pour l'année? L'énoncé dit "Refuser un montant supérieur au reste dû pour ces frais."
        // Interprétation: reste dû pour ce frais (fee_id) ou reste dû global lié à l'élève/année? On va calculer reste dû pour ce fee spécifique
        $totalPayePourCeFrais = (float) Payment::where('student_id', $student->id)
            ->where('fee_id', $fee->id)
            ->where('statut', 'valide')
            ->sum('montant');
        $resteDuPourCeFrais = max(0.0, (float) $fee->montant - $totalPayePourCeFrais);

        if ((float) $data['montant'] > $resteDuPourCeFrais + 1e-9) {
            return response()->json(['message' => 'Montant supérieur au reste dû pour ces frais.'], 422);
        }

        $payment = DB::transaction(function () use ($data, $student, $fee) {
            $year = Carbon::now()->year;
            // Générer un numéro de reçu unique et séquentiel (format REC-YYYY-000001)
            $numeroRecu = null;
            $last = Payment::lockForUpdate()
                ->whereYear('created_at', $year)
                ->orWhere('numero_recu', 'like', "REC-{$year}-%")
                ->orderByDesc('id')
                ->first();
            $next = 1;
            if ($last && $last->numero_recu && preg_match('/REC-\d{4}-(\d+)/', $last->numero_recu, $m)) {
                $next = intval($m[1]) + 1;
            } else {
                // Compter pour être sûr
                $count = Payment::where('numero_recu', 'like', "REC-{$year}-%")->count();
                $next = $count + 1;
            }
            $numeroRecu = sprintf('REC-%d-%06d', $year, $next);

            // S'assurer qu'il n'existe pas (au cas où)
            while (Payment::where('numero_recu', $numeroRecu)->exists()) {
                $next++;
                $numeroRecu = sprintf('REC-%d-%06d', $year, $next);
            }

            $payment = Payment::create([
                'student_id' => $student->id,
                'fee_id' => $fee->id,
                'user_id' => Auth::id(),
                'montant' => $data['montant'],
                'date_paiement' => $data['date_paiement'],
                'mode' => $data['mode'],
                'reference' => $data['reference'] ?? null,
                'statut' => 'valide',
                'numero_recu' => $numeroRecu,
            ]);

            Journal::log('Enregistrement d\'un paiement '.$numeroRecu.' pour '.$student->nom_complet, $payment, [
                'montant' => $payment->montant,
                'fee_id' => $fee->id,
            ]);

            return $payment;
        });

        $payment->load(['student.schoolClass', 'fee', 'recuPar']);

        return response()->json([
            'id' => $payment->id,
            'numero_recu' => $payment->numero_recu,
            'student' => $payment->student ? [
                'id' => $payment->student->id,
                'nom_complet' => $payment->student->nom_complet,
                'matricule' => $payment->student->matricule,
                'school_class' => $payment->student->schoolClass ? ['nom' => $payment->student->schoolClass->nom] : null,
            ] : null,
            'fee' => $payment->fee ? ['type' => $payment->fee->type] : null,
            'montant' => (float) $payment->montant,
            'date_paiement' => $payment->date_paiement?->format('Y-m-d'),
            'mode' => $payment->mode,
            'reference' => $payment->reference,
            'statut' => $payment->statut,
        ], 201);
    }

    public function show(Payment $payment): JsonResponse
    {
        $payment->load(['student.schoolClass', 'fee', 'recuPar']);

        return response()->json([
            'id' => $payment->id,
            'numero_recu' => $payment->numero_recu,
            'student' => $payment->student,
            'fee' => $payment->fee,
            'montant' => (float) $payment->montant,
            'date_paiement' => $payment->date_paiement?->format('Y-m-d'),
            'mode' => $payment->mode,
            'reference' => $payment->reference,
            'statut' => $payment->statut,
            'motif_annulation' => $payment->motif_annulation,
            'recu_par' => $payment->recuPar,
        ]);
    }

    public function annuler(Request $request, Payment $payment): JsonResponse
    {
        $user = $request->user();
        $role = $user?->role;
        // Seul le directeur peut annuler un paiement
        if (! $role || ($role->nom !== 'directeur' && ! $role->aPermission('*'))) {
            abort(403, "Seul le directeur peut annuler un paiement.");
        }

        if ($payment->statut === 'annule') {
            return response()->json(['message' => 'Ce paiement est déjà annulé.'], 422);
        }

        $data = $request->validate([
            'motif' => ['required', 'string', 'max:1000'],
        ]);

        $payment->update([
            'statut' => 'annule',
            'motif_annulation' => $data['motif'],
        ]);

        Journal::log('Annulation du paiement '.$payment->numero_recu.' - motif : '.$data['motif'], $payment, [
            'motif' => $data['motif'],
        ]);

        return response()->json(['message' => 'Paiement annulé', 'payment' => $payment->fresh()]);
    }

    public function recu(Payment $payment)
    {
        $payment->load(['student.schoolClass', 'fee', 'recuPar']);
        $setting = Setting::actuel();

        $student = $payment->student;
        $fee = $payment->fee;
        $schoolYearId = $student?->schoolClass?->school_year_id;
        // Reste à payer global pour l'élève (sur l'année scolaire de sa classe)
        $totalDu = $schoolYearId ? (float) Fee::where('school_year_id', $schoolYearId)->sum('montant') : (float) ($fee?->montant ?? 0);
        $totalPaye = $student ? (float) $student->payments()->where('statut', 'valide')->sum('montant') : 0.0;
        $resteAPayer = max(0.0, $totalDu - $totalPaye);

        $data = [
            'setting' => $setting,
            'payment' => $payment,
            'student' => $student,
            'fee' => $fee,
            'reste_a_payer' => $resteAPayer,
            'total_du' => $totalDu,
            'total_paye' => $totalPaye,
        ];

        $pdf = Pdf::loadView('receipts.payment', $data)->setPaper('A4');
        $filename = 'recu_'.$payment->numero_recu.'.pdf';

        return $pdf->download($filename);
    }

    public function impayes(Request $request): JsonResponse
    {
        $queryClasse = $request->integer('classe_id');
        $feeId = $request->integer('fee_id');

        $students = Student::query()
            ->with('schoolClass.schoolYear')
            ->when($queryClasse, fn ($q) => $q->where('school_class_id', $queryClasse))
            ->get();

        $result = [];
        foreach ($students as $student) {
            $schoolYearId = $student->schoolClass?->school_year_id;
            if (! $schoolYearId) {
                continue;
            }
            $totalDuQuery = Fee::query()->where('school_year_id', $schoolYearId);
            if ($feeId) {
                $totalDuQuery->where('id', $feeId);
            }
            $totalDu = (float) $totalDuQuery->sum('montant');
            if ($totalDu <= 0) {
                continue;
            }
            $totalPaye = (float) $student->payments()
                ->where('statut', 'valide')
                ->when($feeId, fn ($q) => $q->where('fee_id', $feeId))
                ->sum('montant');
            if ($totalPaye < $totalDu - 1e-9) {
                $result[] = [
                    'student' => [
                        'id' => $student->id,
                        'nom' => $student->nom,
                        'prenoms' => $student->prenoms,
                        'nom_complet' => $student->nom_complet,
                        'matricule' => $student->matricule,
                        'school_class' => $student->schoolClass ? ['id' => $student->schoolClass->id, 'nom' => $student->schoolClass->nom] : null,
                    ],
                    'total_du' => $totalDu,
                    'total_paye' => $totalPaye,
                    'reste_a_payer' => round(max(0.0, $totalDu - $totalPaye), 2),
                ];
            }
        }

        return response()->json($result);
    }

    public function rapports(Request $request): JsonResponse
    {
        $type = $request->string('type')->toString(); // journal, mensuel
        $date = $request->input('date') ? Carbon::parse($request->input('date')) : Carbon::today();
        $mois = $request->integer('mois') ?: $date->month;
        $annee = $request->integer('annee') ?: $date->year;
        $format = $request->string('format')->toString(); // excel, csv

        if ($type === 'journal' || $request->has('date') && ! $request->has('mois')) {
            $payments = Payment::with(['student', 'fee'])
                ->whereDate('date_paiement', $date->toDateString())
                ->where('statut', 'valide')
                ->orderBy('date_paiement')
                ->orderBy('id')
                ->get();

            $total = $payments->sum(fn ($p) => (float) $p->montant);

            if ($format === 'csv') {
                $csv = "date,numero_recu,eleve,fee,montant,mode\n";
                foreach ($payments as $p) {
                    $eleve = str_replace('"', '""', $p->student?->nom_complet ?? '');
                    $fee = str_replace('"', '""', $p->fee?->type ?? '');
                    $csv .= $p->date_paiement->format('Y-m-d').",".$p->numero_recu.",\"".$eleve."\",\"".$fee."\"," . $p->montant . "," . $p->mode . "\n";
                }
                return response($csv, 200, [
                    'Content-Type' => 'text/csv; charset=UTF-8',
                    'Content-Disposition' => 'attachment; filename="journal_caisse_'.$date->format('Y-m-d').'.csv"',
                ]);
            }
            if ($format === 'excel') {
                $csv = "date\tNumero_recu\tEleve\tFrais\tMontant\tMode\n";
                foreach ($payments as $p) {
                    $eleve = str_replace(["\t", "\n", "\r"], ' ', $p->student?->nom_complet ?? '');
                    $fee = str_replace(["\t", "\n", "\r"], ' ', $p->fee?->type ?? '');
                    $csv .= $p->date_paiement->format('Y-m-d')."\t".$p->numero_recu."\t".$eleve."\t".$fee."\t".$p->montant."\t".$p->mode."\n";
                }
                return response($csv, 200, [
                    'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
                    'Content-Disposition' => 'attachment; filename="journal_caisse_'.$date->format('Y-m-d').'.xls"',
                ]);
            }

            return response()->json([
                'type' => 'journal',
                'date' => $date->toDateString(),
                'total' => $total,
                'paiements' => $payments->map(fn ($p) => [
                    'id' => $p->id,
                    'numero_recu' => $p->numero_recu,
                    'eleve' => $p->student?->nom_complet,
                    'fee' => $p->fee?->type,
                    'montant' => (float) $p->montant,
                    'mode' => $p->mode,
                    'heure' => $p->created_at?->format('H:i'),
                ]),
            ]);
        }

        // état mensuel
        $payments = Payment::with(['student', 'fee'])
            ->whereMonth('date_paiement', $mois)
            ->whereYear('date_paiement', $annee)
            ->where('statut', 'valide')
            ->orderBy('date_paiement')
            ->orderBy('id')
            ->get();

        $total = $payments->sum(fn ($p) => (float) $p->montant);
        $parMode = $payments->groupBy('mode')->map(fn ($g) => $g->sum(fn ($p) => (float) $p->montant));

        if ($format === 'csv') {
            $csv = "date,numero_recu,eleve,fee,montant,mode\n";
            foreach ($payments as $p) {
                $eleve = str_replace('"', '""', $p->student?->nom_complet ?? '');
                $fee = str_replace('"', '""', $p->fee?->type ?? '');
                $csv .= $p->date_paiement->format('Y-m-d').",".$p->numero_recu.",\"".$eleve."\",\"".$fee."\"," . $p->montant . "," . $p->mode . "\n";
            }
            return response($csv, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="etat_mensuel_'.$annee.'_'.$mois.'.csv"',
            ]);
        }
        if ($format === 'excel') {
            $csv = "date\tNumero_recu\tEleve\tFrais\tMontant\tMode\n";
            foreach ($payments as $p) {
                $eleve = str_replace(["\t", "\n", "\r"], ' ', $p->student?->nom_complet ?? '');
                $fee = str_replace(["\t", "\n", "\r"], ' ', $p->fee?->type ?? '');
                $csv .= $p->date_paiement->format('Y-m-d')."\t".$p->numero_recu."\t".$eleve."\t".$fee."\t".$p->montant."\t".$p->mode."\n";
            }
            return response($csv, 200, [
                'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="etat_mensuel_'.$annee.'_'.$mois.'.xls"',
            ]);
        }

        return response()->json([
            'type' => 'mensuel',
            'mois' => $mois,
            'annee' => $annee,
            'total' => $total,
            'par_mode' => $parMode,
            'nombre' => $payments->count(),
            'paiements' => $payments->take(200)->map(fn ($p) => [
                'id' => $p->id,
                'date_paiement' => $p->date_paiement?->format('Y-m-d'),
                'numero_recu' => $p->numero_recu,
                'eleve' => $p->student?->nom_complet,
                'fee' => $p->fee?->type,
                'montant' => (float) $p->montant,
                'mode' => $p->mode,
            ]),
        ]);
    }
}
