<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->environment('production') || $this->app->environment('development')) {
            \URL::forceScheme('https');
        }

        // Auto-run pending database migrations if expires_at column is missing
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('links') && !\Illuminate\Support\Facades\Schema::hasColumn('links', 'expires_at')) {
                \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Auto-migration error: ' . $e->getMessage());
        }
    }
}
