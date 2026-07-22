<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Link extends Model
{
    protected $table = 'links';
    
    // Matikan auto-incrementing id karena kita menggunakan custom alias string (misal: tiket-mudik)
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';
    
    // Matikan updated_at bawaan Laravel karena tabel ini hanya memakai created_at
    public $timestamps = false;
    
    protected $fillable = [
        'id',
        'long_url',
        'clicks',
        'created_at',
        'expires_at'
    ];

    public function clickLogs()
    {
        return $this->hasMany(ClickLog::class, 'link_id', 'id');
    }
}
