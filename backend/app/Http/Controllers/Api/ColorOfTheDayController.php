<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ColorOfTheDayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ColorOfTheDayController extends Controller
{
    public function today(): JsonResponse
    {
        $cotd = ColorOfTheDayService::getOrPick();
        return response()->json($cotd);
    }

    public function history(): JsonResponse
    {
        $rows = DB::table('color_of_the_day')
            ->orderByRaw('year DESC, month DESC, day DESC')
            ->limit(30)
            ->get();

        $data = $rows->map(function ($row) {
            $base = \App\Services\ColorService::toArray($row->hex_id);
            $base['cotd_date'] = "{$row->year}-{$row->month}-{$row->day}";
            return $base;
        });

        return response()->json(['data' => $data]);
    }
}
