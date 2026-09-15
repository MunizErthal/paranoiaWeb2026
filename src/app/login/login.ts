import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/firebase/auth.service';
import { ToastService } from '../../shared/services/toast/toast.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './login.html'
})
export class Login {
  readonly email = signal('');
  readonly senha = signal('');
  readonly carregando = signal(false);
  readonly erroEmail = signal<string | null>(null);
  readonly erroSenha = signal<string | null>(null);

  private readonly returnUrl: string;

  constructor(
    private authService: AuthService,
    private toast: ToastService,
    private router: Router,
    route: ActivatedRoute
  ) {
    this.returnUrl = route.snapshot.queryParamMap.get('returnUrl') || '/';
  }

  async entrar(): Promise<void> {
    if (!this.formularioValido()) {
      return;
    }

    this.carregando.set(true);
    try {
      await this.authService.login(this.email(), this.senha());
      this.router.navigateByUrl(this.returnUrl);
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      this.carregando.set(false);
    }
  }

  async entrarComGoogle(): Promise<void> {
    this.carregando.set(true);
    try {
      await this.authService.loginWithGoogle();
      this.router.navigateByUrl(this.returnUrl);
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Não foi possível entrar com o Google.');
    } finally {
      this.carregando.set(false);
    }
  }

  private formularioValido(): boolean {
    this.erroEmail.set(EMAIL_REGEX.test(this.email()) ? null : 'Informe um e-mail válido.');
    this.erroSenha.set(this.senha().length > 0 ? null : 'Informe sua senha.');

    return this.erroEmail() === null && this.erroSenha() === null;
  }
}
