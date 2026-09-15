import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../shared/services/firebase/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss'
})
export class Perfil {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  async sair(): Promise<void> {
    await this.authService.logout();
    this.router.navigateByUrl('/');
  }
}
