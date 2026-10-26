<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Student extends Model
{
    protected $guarded = [];

    protected $appends = ['nom_complet', 'photo_url'];

    protected $casts = ['date_naissance' => 'date'];

    public function schoolClass()
    {
        return $this->belongsTo(SchoolClass::class);
    }

    public function guardians()
    {
        return $this->belongsToMany(Guardian::class, 'guardian_student')
            ->withPivot('lien_parente')
            ->withTimestamps();
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function groups()
    {
        return $this->belongsToMany(Group::class, 'group_student');
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    public function certificates()
    {
        return $this->hasMany(Certificate::class);
    }

    protected function nomComplet(): Attribute
    {
        return Attribute::get(
            fn (): string => trim($this->nom.' '.($this->prenoms ?? '')),
        );
    }

    protected function photoUrl(): Attribute
    {
        return Attribute::get(
            fn (): ?string => $this->photo
                ? Storage::disk('public')->url($this->photo)
                : null,
        );
    }

    /**
     * Reste à payer = frais de l'année scolaire de la classe - paiements valides.
     * (Version simple : à affiner si des remises ou exonérations sont ajoutées.)
     */
    public function calculerResteAPayer(): float
    {
        $annee = $this->schoolClass?->school_year_id;
        $du = $annee ? (float) Fee::where('school_year_id', $annee)->sum('montant') : 0.0;
        $paye = (float) $this->payments()->where('statut', 'valide')->sum('montant');

        return max(0.0, $du - $paye);
    }
}
