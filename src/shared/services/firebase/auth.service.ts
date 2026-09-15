import { Injectable } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  Auth
} from '@angular/fire/auth';
import { UsuarioService } from './usuario.service';
import { firstValueFrom } from 'rxjs';
import { AuthStateStore } from '../../stores/auth-state.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private auth: Auth,
    private usuarioService: UsuarioService,
    private authState: AuthStateStore
  ) {}

  async register(email: string, password: string, nome = '', idade?: number): Promise<string> {
    try {
      const userCred = await createUserWithEmailAndPassword(this.auth, email, password);
      await sendEmailVerification(userCred.user);

      const usuarioId = await this.usuarioService.criarUsuario(
        userCred.user.uid,
        email,
        nome || userCred.user.displayName || '',
        userCred.user.photoURL || ''
      );

      if (idade !== undefined) {
        await this.usuarioService.atualizarDadosCadastro(userCred.user.uid, nome, idade);
      }

      return 'Verificação enviada! Confira seu e-mail.';
    } catch (err: any) {
      throw new Error(this.handleError(err.code));
    }
  }

  async login(email: string, password: string): Promise<User> {
    try {
      const userCred = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCred.user;

      if (!user.emailVerified) {
        await signOut(this.auth);
        throw new Error('Verifique seu e-mail antes de continuar.');
      }

      await this.sincronizarUsuario(user);

      return user;
    } catch (err: any) {
      const mensagem = err instanceof Error ? err.message : this.handleError(err?.code);
      throw new Error(mensagem);
    }
  }

  async loginWithGoogle(): Promise<User> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      const user = result.user;

      await this.sincronizarUsuario(user);

      return user;
    } catch (err: any) {
      const mensagem = err instanceof Error ? err.message : this.handleError(err?.code);
      throw new Error(mensagem);
    }
  }

  async resetPassword(email: string): Promise<string> {
    try {
      await sendPasswordResetEmail(this.auth, email);
      return 'E-mail de redefinição enviado! Verifique sua caixa de entrada.';
    } catch (err: any) {
      throw new Error(this.handleError(err.code));
    }
  }

  async logout(): Promise<void> {
    this.authState.limpar();
    await signOut(this.auth);
  }

  get currentUser() {
    return this.auth.currentUser;
  }

  /**
   * Sincroniza o usuário do Firebase Auth com a coleção 'usuarios'.
   * Se não existir, cria um novo documento. Se existir, atualiza o último login.
   */
  private async sincronizarUsuario(user: User): Promise<void> {
    try {
      let usuarioExistente = await firstValueFrom(
        this.usuarioService.buscarPorId(user.uid)
      );

      if (usuarioExistente) {
        await this.usuarioService.atualizarUltimoLogin(user.uid);
        usuarioExistente = await firstValueFrom(
          this.usuarioService.buscarPorId(user.uid)
        );
      } else {
        await this.usuarioService.criarUsuario(
          user.uid,
          user.email || '',
          user.displayName || '',
          user.photoURL || ''
        );
        usuarioExistente = await firstValueFrom(
          this.usuarioService.buscarPorId(user.uid)
        );
      }

      if (usuarioExistente) {
        this.authState.setUsuario(usuarioExistente);
      }
    } catch (err) {
      console.error('Erro ao sincronizar usuário:', err);
      // Não lança erro, deixa continuar mesmo com problema na sincronização
    }
  }

  private handleError(code: string): string {
    switch (code) {
      case 'auth/weak-password':
        return 'A senha deve ter pelo menos 6 caracteres.'
      case 'auth/email-already-in-use':
        return 'E-mail já cadastrado.';
      case 'auth/invalid-email':
        return 'E-mail inválido.';
      case 'auth/invalid-credential':
        return 'Credenciais inválidas.';
      case 'auth/user-not-found':
        return 'Usuário não encontrado.';
      case 'auth/wrong-password':
        return 'Senha incorreta.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Tente novamente mais tarde.';
      default:
        return 'Erro desconhecido.';
    }
  }
}
