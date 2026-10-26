<?php

use App\Http\Controllers\DashboardController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/dashboard', DashboardController::class);
    Route::get('/user', fn (Request $request) => $request->user());
});
