import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/firebase/auth.service';
import { ToastService } from '../../shared/services/toast/toast.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-esqueci-senha',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './esqueci-senha.html'
})
export class EsqueciSenha {
  readonly email = signal('');
  readonly carregando = signal(false);
  readonly linkEnviado = signal(false);
  readonly erroEmail = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private toast: ToastService
  ) {}

  async enviarLink(): Promise<void> {
    this.erroEmail.set(EMAIL_REGEX.test(this.email()) ? null : 'Informe um e-mail válido.');
    if (this.erroEmail()) {
      return;
    }

    this.carregando.set(true);
    try {
      await this.authService.resetPassword(this.email());
      this.linkEnviado.set(true);
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Não foi possível enviar o link.');
    } finally {
      this.carregando.set(false);
    }
  }
}
