<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Group extends Model
{
    protected $guarded = [];

    protected $table = 'groups';

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function students()
    {
        return $this->belongsToMany(Student::class, 'group_student');
    }

    public function lessonSessions()
    {
        return $this->hasMany(LessonSession::class);
    }
}
