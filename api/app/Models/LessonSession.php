<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonSession extends Model
{
    protected $guarded = [];

    protected $casts = ['date' => 'date'];

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    /**
     * Enregistre l'appel : $presences = [student_id => 'present'|'absent'|'retard'|'justifie'].
     */
    public function faireAppel(array $presences): void
    {
        foreach ($presences as $studentId => $statut) {
            $this->attendances()->updateOrCreate(
                ['student_id' => $studentId],
                ['statut' => $statut]
            );
        }
    }
}
