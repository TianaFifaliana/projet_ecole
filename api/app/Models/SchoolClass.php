<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchoolClass extends Model
{
    protected $guarded = [];

    public function schoolYear()
    {
        return $this->belongsTo(SchoolYear::class);
    }

    public function professeurPrincipal()
    {
        return $this->belongsTo(Teacher::class, 'teacher_id');
    }

    public function students()
    {
        return $this->hasMany(Student::class);
    }

    public function subjects()
    {
        return $this->belongsToMany(Subject::class, 'class_subject');
    }

    public function ajouterEleve(Student $student): void
    {
        if ($this->students()->count() >= $this->capacite) {
            throw new \RuntimeException('La classe a atteint sa capacité maximale.');
        }

        $student->update(['school_class_id' => $this->id]);
    }
}
