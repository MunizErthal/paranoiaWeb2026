import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../shared/services/firebase/auth.service';
import { AuthStateStore } from '../../shared/stores/auth-state.store';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, DatePipe],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss'
})
export class Perfil {
  private readonly authService = inject(AuthService);
  private readonly authState = inject(AuthStateStore);
  private readonly router = inject(Router);

  readonly usuario = this.authState.usuario;

  readonly iniciais = computed(() => {
    const usuario = this.usuario();
    const fonte = usuario?.nome?.trim() || usuario?.email || '';
    return fonte.charAt(0).toUpperCase() || '?';
  });

  async sair(): Promise<void> {
    await this.authService.logout();
    this.router.navigateByUrl('/');
  }
}
