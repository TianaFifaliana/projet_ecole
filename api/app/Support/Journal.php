<?php

namespace App\Support;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

final class Journal
{
    /**
     * @param  array<string, mixed>  $details
     */
    public static function log(string $action, ?Model $entite = null, array $details = []): ActivityLog
    {
        return ActivityLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'entite' => $entite ? class_basename($entite) : null,
            'entite_id' => $entite?->getKey(),
            'details' => $details ?: null,
        ]);
    }
}
