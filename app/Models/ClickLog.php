<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClickLog extends Model
{
    protected $table = 'click_logs';

    public $timestamps = false;

    protected $fillable = [
        'link_id',
        'created_at',
    ];

    public function link()
    {
        return $this->belongsTo(Link::class, 'link_id', 'id');
    }
}
