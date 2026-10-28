<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Reçu {{ $payment->numero_recu }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; }
        .header { text-align: center; margin-bottom: 20px; }
        .logo { max-height: 80px; margin-bottom: 10px; }
        .title { font-size: 18px; font-weight: bold; margin: 10px 0; }
        .info { margin: 10px 0; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .table th { background-color: #f2f2f2; }
        .right { text-align: right; }
        .footer { margin-top: 40px; text-align: right; }
    </style>
</head>
<body>
    <div class="header">
        @if(isset($setting->logo) && $setting->logo)
            <img src="{{ public_path('storage/'.$setting->logo) }}" class="logo" alt="Logo">
        @endif
        <div class="title">{{ $setting->nom_ecole ?? "Établissement Scolaire" }}</div>
        @if(isset($setting->adresse))<div>{{ $setting->adresse }}</div>@endif
        @if(isset($setting->telephone))<div>Tél: {{ $setting->telephone }}</div>@endif
    </div>

    <h2 style="text-align:center;">REÇU DE PAIEMENT</h2>

    <div class="info">
        <strong>N° Reçu :</strong> {{ $payment->numero_recu }}<br>
        <strong>Date :</strong> {{ $payment->date_paiement?->format('d/m/Y') }}<br>
        <strong>Reçu par :</strong> {{ $payment->recuPar?->name ?? '-' }}
    </div>

    <div class="info">
        <strong>Élève :</strong> {{ $student?->nom_complet }}<br>
        <strong>Matricule :</strong> {{ $student?->matricule }}<br>
        @if($student?->schoolClass)
            <strong>Classe :</strong> {{ $student->schoolClass->nom }}<br>
        @endif
    </div>

    <table class="table">
        <thead>
            <tr>
                <th>Désignation</th>
                <th>Mode de paiement</th>
                <th class="right">Montant (FCFA/XAF)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $fee?->type ?? 'Frais scolaire' }}</td>
                <td>{{ ucfirst($payment->mode) }} @if($payment->reference) (Réf: {{ $payment->reference }}) @endif</td>
                <td class="right">{{ number_format($payment->montant, 2, ',', ' ') }}</td>
            </tr>
        </tbody>
        <tfoot>
            <tr>
                <th colspan="2" class="right">Montant versé en chiffres</th>
                <th class="right">{{ number_format($payment->montant, 2, ',', ' ') }}</th>
            </tr>
        </tfoot>
    </table>

    <div class="info" style="margin-top:20px;">
        <strong>Total dû :</strong> {{ number_format($total_du, 2, ',', ' ') }}<br>
        <strong>Total payé :</strong> {{ number_format($total_paye, 2, ',', ' ') }}<br>
        <strong>Reste à payer :</strong> {{ number_format($reste_a_payer, 2, ',', ' ') }}
    </div>

    <div class="footer">
        <p>Le Caissier/Comptable</p>
        <br><br>
        <p>________________________</p>
    </div>
</body>
</html>
