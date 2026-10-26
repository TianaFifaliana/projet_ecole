<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $role = $request->user()?->role;

        if (! $role?->aPermission($permission)) {
            abort(403, "Vous n'avez pas la permission requise pour cette action.");
        }

        return $next($request);
    }
}
