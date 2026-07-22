<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Link;
use App\Models\ClickLog;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

class LinkController extends Controller
{
    // 1. Ambil daftar semua link
    public function index()
    {
        try {
            $links = Link::with(['clickLogs' => function ($query) {
                $query->where('created_at', '>=', now()->subDays(8));
            }])->orderBy('created_at', 'desc')->get();
            
            // Map kolom database snake_case ke camelCase yang diharapkan oleh React frontend
            $data = $links->map(function ($link) {
                return [
                    'id' => $link->id,
                    'longUrl' => $link->long_url,
                    'clicks' => (int) $link->clicks,
                    'createdAt' => \Carbon\Carbon::parse($link->created_at)->setTimezone('Asia/Jakarta')->toIso8601String(),
                    'expiresAt' => (isset($link->expires_at) && $link->expires_at) ? \Carbon\Carbon::parse($link->expires_at)->setTimezone('Asia/Jakarta')->toIso8601String() : null,
                    'shortUrl' => url('/r/' . $link->id),
                    'clickHistory' => $link->clickLogs->map(function ($log) {
                        return \Carbon\Carbon::parse($log->created_at)->setTimezone('Asia/Jakarta')->toIso8601String();
                    })
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengambil data link: ' . $e->getMessage()
            ], 500);
        }
    }

    // 2. Buat link pendek baru
    public function store(Request $request)
    {
        // Ganti longUrl ke long_url untuk validasi Laravel agar rapi
        $input = [
            'long_url' => $request->input('longUrl'),
            'customAlias' => $request->input('customAlias'),
            'expiry_option' => $request->input('expiryOption'),
            'custom_expiry' => $request->input('customExpiry'),
        ];

        $validator = Validator::make($input, [
            'long_url' => 'required|url',
            'customAlias' => [
                'nullable',
                'string',
                'regex:/^[a-zA-Z0-9-_]+$/',
                'unique:links,id'
            ],
            'expiry_option' => 'nullable|string|in:forever,1_hour,1_day,7_days,30_days,custom',
            'custom_expiry' => 'nullable|required_if:expiry_option,custom|date|after:now'
        ], [
            'long_url.required' => 'URL panjang wajib diisi!',
            'long_url.url' => 'Format URL tidak valid! Harap masukkan URL lengkap seperti https://example.com',
            'customAlias.regex' => 'Custom alias hanya boleh berisi huruf, angka, tanda hubung (-), dan underscore (_).',
            'customAlias.unique' => 'Custom alias sudah digunakan oleh link lain!',
            'custom_expiry.required_if' => 'Waktu kadaluarsa kustom wajib diisi jika memilih opsi kustom.',
            'custom_expiry.date' => 'Format waktu kadaluarsa kustom tidak valid.',
            'custom_expiry.after' => 'Waktu kadaluarsa kustom harus di masa depan.'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 400);
        }

        $alias = $request->input('customAlias');
        $alias = $alias ? trim($alias) : '';

        // Validasi kata kunci sistem
        if ($alias === 'api' || $alias === 'r') {
            return response()->json([
                'success' => false,
                'message' => 'Alias ini dilarang karena merupakan keyword sistem.'
            ], 400);
        }

        // Generate alias acak jika dikosongkan
        if (!$alias) {
            $attempts = 0;
            $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            do {
                $alias = '';
                for ($i = 0; $i < 6; $i++) {
                    $alias .= $characters[rand(0, strlen($characters) - 1)];
                }
                $exists = Link::find($alias);
                $attempts++;
            } while ($exists && $attempts < 5);

            if ($exists) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal membuat alias acak yang unik.'
                ], 500);
            }
        }

        // Hitung masa aktif
        $expiresAt = null;
        $expiryOption = $request->input('expiryOption', 'forever');
        if ($expiryOption === '1_hour') {
            $expiresAt = now()->setTimezone('Asia/Jakarta')->addHour();
        } elseif ($expiryOption === '1_day') {
            $expiresAt = now()->setTimezone('Asia/Jakarta')->addDay();
        } elseif ($expiryOption === '7_days') {
            $expiresAt = now()->setTimezone('Asia/Jakarta')->addDays(7);
        } elseif ($expiryOption === '30_days') {
            $expiresAt = now()->setTimezone('Asia/Jakarta')->addDays(30);
        } elseif ($expiryOption === 'custom' && $request->input('customExpiry')) {
            $rawExpiry = $request->input('customExpiry');
            if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $rawExpiry)) {
                $expiresAt = \Carbon\Carbon::createFromFormat('Y-m-d\TH:i', $rawExpiry, 'Asia/Jakarta');
            } else {
                $expiresAt = \Carbon\Carbon::parse($rawExpiry)->setTimezone('Asia/Jakarta');
            }
        }

        // Pastikan kolom expires_at sudah ada di database (auto-migrate jika belum)
        if (!\Illuminate\Support\Facades\Schema::hasColumn('links', 'expires_at')) {
            try {
                \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('Auto migration attempt in store failed: ' . $e->getMessage());
            }
        }

        try {
            $createData = [
                'id' => $alias,
                'long_url' => $input['long_url'],
                'clicks' => 0,
                'created_at' => now()->setTimezone('Asia/Jakarta'),
            ];

            if (\Illuminate\Support\Facades\Schema::hasColumn('links', 'expires_at')) {
                $createData['expires_at'] = $expiresAt;
            }

            $link = Link::create($createData);

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $link->id,
                    'longUrl' => $link->long_url,
                    'clicks' => (int) $link->clicks,
                    'createdAt' => \Carbon\Carbon::parse($link->created_at)->setTimezone('Asia/Jakarta')->toIso8601String(),
                    'expiresAt' => $link->expires_at ? \Carbon\Carbon::parse($link->expires_at)->setTimezone('Asia/Jakarta')->toIso8601String() : null,
                    'shortUrl' => url('/r/' . $link->id)
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal memperpendek link: ' . $e->getMessage()
            ], 500);
        }
    }

    // 3. Hapus link
    public function destroy($id)
    {
        try {
            $link = Link::find($id);
            if (!$link) {
                return response()->json([
                    'success' => false,
                    'message' => 'Link tidak ditemukan.'
                ], 404);
            }

            $link->delete();

            return response()->json([
                'success' => true,
                'message' => 'Link berhasil dihapus.'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menghapus link: ' . $e->getMessage()
            ], 500);
        }
    }

    // 4. Pengalihan Link Pendek (Redirect)
    public function redirect($id)
    {
        try {
            $link = Link::find($id);
            if (!$link) {
                abort(404, 'Link Tidak Ditemukan');
            }

            // Periksa jika link sudah kadaluarsa
            if (isset($link->expires_at) && $link->expires_at && now()->greaterThan(\Carbon\Carbon::parse($link->expires_at))) {
                return response()->view('expired', [], 410);
            }

            // Tambah klik/pindai
            $link->increment('clicks');

            // Catat log klik ke database
            ClickLog::create([
                'link_id' => $link->id,
                'created_at' => now(),
            ]);

            // Redirect ke URL panjang asli
            return redirect()->away($link->long_url);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan sistem: ' . $e->getMessage()
            ], 500);
        }
    }
}
