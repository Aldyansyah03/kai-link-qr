<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\LinkController;

// Load React SPA Frontend
Route::get('/{any?}', function () {
    return view('welcome');
})->where('any', '^(?!api|r).*$');

// Endpoint REST API untuk Frontend
Route::prefix('api')->group(function () {
    Route::get('/links', [LinkController::class, 'index']);
    Route::post('/shorten', [LinkController::class, 'store']);
    Route::delete('/links/{id}', [LinkController::class, 'destroy']);
});

// Pengalihan Link Pendek Utama
Route::get('/r/{id}', [LinkController::class, 'redirect']);
