<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    protected $guarded = [];

    public function lessonSession()
    {
        return $this->belongsTo(LessonSession::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}
