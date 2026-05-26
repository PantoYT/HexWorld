<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Color;
use App\Models\Comment;
use App\Services\ColorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function index(int $hexId): JsonResponse
    {
        $comments = Comment::with('user')
            ->where('hex_id', $hexId)
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json([
            'data' => $comments->map(fn($c) => $this->commentResource($c)),
            'meta' => [
                'current_page' => $comments->currentPage(),
                'last_page' => $comments->lastPage(),
                'total' => $comments->total(),
            ],
        ]);
    }

    public function store(Request $request, int $hexId): JsonResponse
    {
        if ($hexId < 0 || $hexId > 16777215) {
            return response()->json(['message' => 'Invalid color'], 404);
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'min:1', 'max:280'],
        ]);

        ColorService::findOrCreate($hexId);

        $comment = Comment::create([
            'hex_id' => $hexId,
            'user_id' => $request->user()->id,
            'body' => $data['body'],
        ]);

        Color::where('hex_id', $hexId)->increment('comments_count');

        $comment->load('user');

        return response()->json($this->commentResource($comment), 201);
    }

    public function destroy(Request $request, int $hexId, string $commentId): JsonResponse
    {
        $comment = Comment::where('id', $commentId)
            ->where('hex_id', $hexId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $comment->delete();
        Color::where('hex_id', $hexId)->decrement('comments_count');

        return response()->json(['message' => 'Deleted']);
    }

    private function commentResource(Comment $comment): array
    {
        return [
            'id' => $comment->id,
            'body' => $comment->body,
            'likes_count' => $comment->likes_count,
            'created_at' => $comment->created_at->toISOString(),
            'user' => [
                'id' => $comment->user->id,
                'username' => $comment->user->username,
                'display_name' => $comment->user->display_name,
                'avatar_url' => $comment->user->avatar_url,
            ],
        ];
    }
}
