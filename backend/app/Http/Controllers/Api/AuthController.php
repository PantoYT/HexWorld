<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:32', 'unique:users', 'regex:/^[a-zA-Z0-9_]+$/'],
            'email' => ['required', 'email', 'unique:users'],
            'password' => ['required', Password::min(8)],
            'display_name' => ['nullable', 'string', 'max:64'],
        ]);

        $user = User::create([
            'username' => $data['username'],
            'email' => $data['email'],
            'password' => $data['password'],
            'display_name' => $data['display_name'] ?? $data['username'],
        ]);

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'user' => $this->userResource($user),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'user' => $this->userResource($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->userResource($request->user()));
    }

    private function userResource(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'display_name' => $user->display_name,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
            'bio' => $user->bio,
            'discovered_count' => $user->discovered_count,
            'followers_count' => $user->followers_count,
            'following_count' => $user->following_count,
            'created_at' => $user->created_at->toISOString(),
        ];
    }
}
