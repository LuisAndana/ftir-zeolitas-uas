import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthBackendService } from '../services/auth-backend.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthBackendService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/welcome']);
  }

  if (auth.isAdmin()) {
    return true;
  }

  // Si no es admin, redirigir al dashboard (sin acceso)
  return router.createUrlTree(['/dashboard/cargar']);
};
