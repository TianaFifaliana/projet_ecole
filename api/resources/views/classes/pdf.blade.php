<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Liste de classe - {{ $schoolClass->nom }}</title>
    <style>
        @page {
            margin: 32px 30px;
        }

        body {
            font-family: DejaVu Sans, sans-serif;
            color: #1b2637;
            font-size: 12px;
        }

        h1 {
            margin: 0;
            font-size: 20px;
        }

        h2 {
            margin: 3px 0 0;
            color: #4b5b70;
            font-size: 14px;
            font-weight: normal;
        }

        .header {
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 2px solid #2f6fed;
        }

        .school-name {
            margin: 0 0 8px;
            color: #2f6fed;
            font-size: 13px;
            font-weight: bold;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .meta {
            width: 100%;
            margin: 14px 0 18px;
            border-collapse: collapse;
        }

        .meta td {
            width: 50%;
            padding: 4px 0;
            vertical-align: top;
        }

        .meta-label {
            color: #66758a;
        }

        table.students {
            width: 100%;
            border-collapse: collapse;
        }

        table.students th {
            padding: 8px 7px;
            border-bottom: 1px solid #cfdae8;
            background: #eef3fb;
            color: #26364b;
            font-size: 10px;
            letter-spacing: 0.05em;
            text-align: left;
            text-transform: uppercase;
        }

        table.students td {
            padding: 7px;
            border-bottom: 1px solid #e4ebf3;
        }

        table.students tr:nth-child(even) td {
            background: #f8fafc;
        }

        .empty {
            padding: 18px;
            color: #66758a;
            text-align: center;
        }

        .footer {
            position: fixed;
            right: 0;
            bottom: -18px;
            left: 0;
            color: #8a99ab;
            font-size: 9px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        @if ($setting?->nom_ecole)
            <p class="school-name">{{ $setting->nom_ecole }}</p>
        @endif
        <h1>Liste de la classe {{ $schoolClass->nom }}</h1>
        <h2>
            Année scolaire {{ $schoolClass->schoolYear?->libelle ?? '—' }}
            @if ($schoolClass->niveau)
                · Niveau {{ $schoolClass->niveau }}
            @endif
        </h2>
    </div>

    <table class="meta">
        <tr>
            <td>
                <span class="meta-label">Professeur principal :</span>
                {{ $schoolClass->professeurPrincipal
                    ? trim($schoolClass->professeurPrincipal->nom.' '.($schoolClass->professeurPrincipal->prenoms ?? ''))
                    : 'Non désigné' }}
            </td>
            <td>
                <span class="meta-label">Effectif :</span>
                {{ $students->count() }} / {{ $schoolClass->capacite }}
            </td>
        </tr>
        <tr>
            <td>
                <span class="meta-label">Matières :</span>
                {{ $schoolClass->subjects->pluck('intitule')->join(', ') ?: 'Aucune matière associée' }}
            </td>
            <td>
                <span class="meta-label">Édité le :</span>
                {{ $generatedAt->format('d/m/Y à H:i') }}
            </td>
        </tr>
    </table>

    <table class="students">
        <thead>
            <tr>
                <th style="width: 28px;">#</th>
                <th>Matricule</th>
                <th>Nom et prénoms</th>
                <th>Date de naissance</th>
                <th>Sexe</th>
                <th>Statut</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($students as $index => $student)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $student->matricule }}</td>
                    <td>{{ trim($student->nom.' '.($student->prenoms ?? '')) }}</td>
                    <td>{{ $student->date_naissance?->format('d/m/Y') ?? '—' }}</td>
                    <td>{{ $student->sexe === 'M' ? 'Masculin' : ($student->sexe === 'F' ? 'Féminin' : '—') }}</td>
                    <td>{{ ucfirst($student->statut) }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="empty">Aucun élève inscrit dans cette classe.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Document généré automatiquement par le système de gestion scolaire.
    </div>
</body>
</html>
