<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ColorController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\FeedController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Public auth routes
Route::prefix('v1/auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Public color info (no auth needed to view)
Route::prefix('v1')->group(function () {
    Route::get('/colors/{hexId}', [ColorController::class, 'show'])->whereNumber('hexId');
    Route::get('/colors/{hexId}/comments', [CommentController::class, 'index'])->whereNumber('hexId');
    Route::get('/users/{username}', [UserController::class, 'show']);
    Route::get('/users/{username}/discovered', [UserController::class, 'discovered']);
    Route::get('/users/{username}/liked', [UserController::class, 'liked']);
});

// Authenticated routes
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Feed
    Route::get('/feed/next', [FeedController::class, 'next']);

    // Color interactions
    Route::post('/colors/{hexId}/discover', [ColorController::class, 'discover'])->whereNumber('hexId');
    Route::post('/colors/{hexId}/like', [ColorController::class, 'like'])->whereNumber('hexId');
    Route::post('/colors/{hexId}/unlike', [ColorController::class, 'unlike'])->whereNumber('hexId');
    Route::post('/colors/{hexId}/save', [ColorController::class, 'save'])->whereNumber('hexId');
    Route::post('/colors/{hexId}/unsave', [ColorController::class, 'unsave'])->whereNumber('hexId');
    Route::post('/colors/{hexId}/view', [ColorController::class, 'markViewed'])->whereNumber('hexId');

    // Comments
    Route::post('/colors/{hexId}/comments', [CommentController::class, 'store'])->whereNumber('hexId');
    Route::delete('/colors/{hexId}/comments/{commentId}', [CommentController::class, 'destroy'])->whereNumber('hexId');

    // Social
    Route::post('/users/{username}/follow', [UserController::class, 'follow']);
    Route::post('/users/{username}/unfollow', [UserController::class, 'unfollow']);
});
