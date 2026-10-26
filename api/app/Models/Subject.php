<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subject extends Model
{
    protected $guarded = [];

    protected $casts = [
        'coefficient' => 'decimal:2',
        'volume_horaire' => 'integer',
    ];

    public function classes()
    {
        return $this->belongsToMany(SchoolClass::class, 'class_subject');
    }

    public function teachers()
    {
        return $this->belongsToMany(Teacher::class, 'subject_teacher');
    }

    public function lessonSessions()
    {
        return $this->hasMany(LessonSession::class);
    }
}
