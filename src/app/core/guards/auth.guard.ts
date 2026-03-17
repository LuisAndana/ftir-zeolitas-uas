import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    // Verificar si hay token en localStorage
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('current_user');

    console.log('🔐 AuthGuard - Verificando autenticación:', {
      tieneToken: !!token,
      tieneUsuario: !!user
    });

    if (token && user) {
      // Usuario está autenticado
      console.log('✅ Usuario autenticado - permitir acceso');
      return true;
    }

    // Usuario NO está autenticado - redirigir a welcome
    console.log('❌ Usuario no autenticado - redirigiendo a /welcome');
    this.router.navigate(['/welcome']);
    return false;
  }
}