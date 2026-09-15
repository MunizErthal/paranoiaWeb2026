import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/firebase/auth.service';
import { ToastService } from '../../shared/services/toast/toast.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAMANHO_MINIMO_SENHA = 6;

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cadastro.html'
})
export class Cadastro {
  readonly nome = signal('');
  readonly email = signal('');
  readonly senha = signal('');
  readonly confirmarSenha = signal('');
  readonly aceiteTermos = signal(false);
  readonly carregando = signal(false);
  readonly cadastroConcluido = signal(false);

  readonly erroNome = signal<string | null>(null);
  readonly erroEmail = signal<string | null>(null);
  readonly erroSenha = signal<string | null>(null);
  readonly erroConfirmarSenha = signal<string | null>(null);
  readonly erroTermos = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private toast: ToastService
  ) {}

  async cadastrar(): Promise<void> {
    if (!this.formularioValido()) {
      return;
    }

    this.carregando.set(true);
    try {
      await this.authService.register(this.email(), this.senha(), this.nome());
      this.cadastroConcluido.set(true);
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Não foi possível criar sua conta.');
    } finally {
      this.carregando.set(false);
    }
  }

  private formularioValido(): boolean {
    this.erroNome.set(this.nome().trim().length > 0 ? null : 'Informe seu nome.');
    this.erroEmail.set(EMAIL_REGEX.test(this.email()) ? null : 'Informe um e-mail válido.');
    this.erroSenha.set(
      this.senha().length >= TAMANHO_MINIMO_SENHA
        ? null
        : `A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`
    );
    this.erroConfirmarSenha.set(
      this.confirmarSenha() === this.senha() ? null : 'As senhas não coincidem.'
    );
    this.erroTermos.set(this.aceiteTermos() ? null : 'É preciso aceitar os termos para continuar.');

    return (
      this.erroNome() === null &&
      this.erroEmail() === null &&
      this.erroSenha() === null &&
      this.erroConfirmarSenha() === null &&
      this.erroTermos() === null
    );
  }
}
