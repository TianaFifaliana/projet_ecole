<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\GuardianController;
use App\Http\Controllers\SchoolClassController;
use App\Http\Controllers\SchoolYearController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\SubjectController;
use App\Http\Controllers\TeacherController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/dashboard', DashboardController::class);
    Route::get('/user', fn (Request $request) => $request->user());

    Route::get('/school-years', [SchoolYearController::class, 'index']);
    Route::post('/school-years', [SchoolYearController::class, 'store'])
        ->middleware('permission:parametres');
    Route::match(['put', 'patch'], '/school-years/{schoolYear}', [SchoolYearController::class, 'update'])
        ->middleware('permission:parametres');
    Route::post('/school-years/{schoolYear}/activate', [SchoolYearController::class, 'activate'])
        ->middleware('permission:parametres');

    Route::middleware('permission:classes')->group(function () {
        Route::get('/classes', [SchoolClassController::class, 'index']);
        Route::post('/classes', [SchoolClassController::class, 'store']);
        Route::get('/classes/{schoolClass}/students/export-pdf', [SchoolClassController::class, 'exportPdf']);
        Route::get('/classes/{schoolClass}/students', [SchoolClassController::class, 'students']);
        Route::post('/classes/{schoolClass}/students/{student}/transfer', [SchoolClassController::class, 'transferStudent']);
        Route::post('/classes/{schoolClass}/subjects', [SchoolClassController::class, 'syncSubjects']);
        Route::delete('/classes/{schoolClass}/subjects/{subject}', [SchoolClassController::class, 'detachSubject']);
        Route::get('/classes/{schoolClass}', [SchoolClassController::class, 'show']);
        Route::match(['put', 'patch'], '/classes/{schoolClass}', [SchoolClassController::class, 'update']);
        Route::delete('/classes/{schoolClass}', [SchoolClassController::class, 'destroy']);
    });

    Route::middleware('permission:professeurs')->group(function () {
        Route::get('/teachers', [TeacherController::class, 'index']);
        Route::post('/teachers', [TeacherController::class, 'store']);
        Route::get('/teachers/{teacher}', [TeacherController::class, 'show']);
        Route::match(['put', 'patch'], '/teachers/{teacher}', [TeacherController::class, 'update']);
        Route::delete('/teachers/{teacher}', [TeacherController::class, 'destroy']);
        Route::post('/teachers/{teacher}/subjects', [TeacherController::class, 'syncSubjects']);
        Route::post('/teachers/{teacher}/assign-main', [TeacherController::class, 'assignAsMainTeacher']);
        Route::post('/teachers/{teacher}/create-account', [TeacherController::class, 'createAccount']);
        Route::get('/teachers/{teacher}/planning', [TeacherController::class, 'planning']);
    });

    Route::middleware('permission:matieres')->group(function () {
        Route::get('/subjects', [SubjectController::class, 'index']);
        Route::post('/subjects', [SubjectController::class, 'store']);
        Route::post('/subjects/{subject}/classes', [SubjectController::class, 'syncClasses']);
        Route::get('/subjects/{subject}', [SubjectController::class, 'show']);
        Route::match(['put', 'patch'], '/subjects/{subject}', [SubjectController::class, 'update']);
        Route::delete('/subjects/{subject}', [SubjectController::class, 'destroy']);
    });

    Route::middleware('permission:eleves')->group(function () {
        Route::get('/students/export', [StudentController::class, 'export']);
        Route::post('/students/import', [StudentController::class, 'import']);

        Route::get('/students', [StudentController::class, 'index']);
        Route::post('/students', [StudentController::class, 'store']);
        Route::post('/students/{student}/photo', [StudentController::class, 'uploadPhoto']);

        Route::get('/students/{student}/documents', [DocumentController::class, 'index']);
        Route::post('/students/{student}/documents', [DocumentController::class, 'store']);
        Route::get('/students/{student}/documents/{document}/download', [DocumentController::class, 'download']);
        Route::delete('/students/{student}/documents/{document}', [DocumentController::class, 'destroy']);

        Route::post('/students/{student}/guardians', [GuardianController::class, 'attach']);
        Route::delete('/students/{student}/guardians/{guardian}', [GuardianController::class, 'detach']);

        Route::get('/students/{student}', [StudentController::class, 'show']);
        Route::match(['put', 'patch'], '/students/{student}', [StudentController::class, 'update']);
        Route::delete('/students/{student}', [StudentController::class, 'destroy']);

        Route::get('/guardians', [GuardianController::class, 'index']);
        Route::post('/guardians', [GuardianController::class, 'store']);
        Route::match(['put', 'patch'], '/guardians/{guardian}', [GuardianController::class, 'update']);
    });
});
