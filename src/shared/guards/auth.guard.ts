import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { AuthStateService } from '../services/firebase/auth-state.service';

/**
 * Guard para proteger rotas que requerem autenticação
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private authState: AuthStateService,
    private router: Router,
    private auth: Auth
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const autenticado = this.authState.estaAutenticado() || !!this.auth.currentUser;

    if (autenticado) {
      return true;
    }

    // Redireciona para login se não estiver autenticado
    this.router.navigate(['/login']);
    return false;
  }
}
