<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Teacher extends Model
{
    protected $guarded = [];

    protected $casts = ['date_embauche' => 'date'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function classesPrincipales()
    {
        return $this->hasMany(SchoolClass::class, 'teacher_id');
    }

    public function subjects()
    {
        return $this->belongsToMany(Subject::class, 'subject_teacher');
    }

    public function groups()
    {
        return $this->hasMany(Group::class);
    }

    public function lessonSessions()
    {
        return $this->hasMany(LessonSession::class);
    }
}
