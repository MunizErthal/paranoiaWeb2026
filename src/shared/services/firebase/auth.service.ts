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
import { environment } from '../../../environment/environment';
import { Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private auth: Auth,
    private usuarioService: UsuarioService,
    private authState: AuthStateService,
    private router: Router
  ) {}

  async register(email: string, password: string, nome = '', idade?: number): Promise<string> {
    try {
      const userCred = await createUserWithEmailAndPassword(this.auth, email, password);
      await sendEmailVerification(userCred.user);
      
      // Cria o usuário na coleção 'usuarios' após o registro
      await this.usuarioService.criarUsuario(
        userCred.user.uid,
        email,
        nome || userCred.user.displayName || '',
        userCred.user.photoURL || ''
      ).then(async (usuarioId) => {
        if (idade !== undefined) {
          await this.usuarioService.atualizarDadosCadastro(userCred.user.uid, nome, idade);
        }
        return usuarioId;
      }).catch((err) => {
        console.error('Erro ao criar usuário na coleção:', err);
        throw new Error('Erro ao criar usuário na coleção: ' + err.message);
      });

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

      // Verifica se o usuário existe na coleção 'usuarios'
      // Se não existir, cria um novo documento
      // Se existir, atualiza o último login
      await this.sincronizarUsuario(user);

      // Redireciona baseado no estado do usuário
      this.redirecionarAposLogin();

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

      // Sincroniza o usuário do Google com a coleção 'usuarios'
      await this.sincronizarUsuario(user);

      // Redireciona baseado no estado do usuário
      this.redirecionarAposLogin();

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
    // Limpa estado do usuário
    this.authState.limpar();
    
    await signOut(this.auth);
  }

  get currentUser() {
    return this.auth.currentUser;
  }

  /**
   * Sincroniza o usuário do Firebase Auth com a coleção 'usuarios'
   * Se não existir, cria um novo documento
   * Se existir, atualiza o último login
   * @param user - Usuário do Firebase Authentication
   */
  private async sincronizarUsuario(user: User): Promise<void> {
    try {
      // Busca o usuário na coleção
      let usuarioExistente = await firstValueFrom(
        this.usuarioService.buscarPorId(user.uid)
      );

      if (usuarioExistente) {
        // Usuário já existe, apenas atualiza o último login
        await this.usuarioService.atualizarUltimoLogin(user.uid);
        // Busca os dados atualizados
        usuarioExistente = await firstValueFrom(
          this.usuarioService.buscarPorId(user.uid)
        );
      } else {
        // Primeiro login - cria o usuário
        await this.usuarioService.criarUsuario(
          user.uid,
          user.email || '',
          user.displayName || '',
          user.photoURL || ''
        );
        // Busca os dados criados
        usuarioExistente = await firstValueFrom(
          this.usuarioService.buscarPorId(user.uid)
        );
      }

      // Armazena o usuário no environment e localStorage
      if (usuarioExistente) {
        environment.usuarioAtual = usuarioExistente;
        localStorage.setItem('usuarioAtual', JSON.stringify(usuarioExistente));
        
        // Atualiza partidaId se houver partida em andamento
        if (usuarioExistente.partidaEmAndamento) {
          environment.partidaId = usuarioExistente.partidaEmAndamento;
          localStorage.setItem('partidaId', usuarioExistente.partidaEmAndamento);
        }

        this.authState.setUsuario(environment.usuarioAtual);
      }
    } catch (err) {
      console.error('Erro ao sincronizar usuário:', err);
      // Não lança erro, deixa continuar mesmo com problema na sincronização
    }
  }

  /**
   * Redireciona o usuário após login baseado no estado dele
   */
  private redirecionarAposLogin(): void {
    this.router.navigate(['/selecao-de-jogo']);
  }

  private handleError(code: string): string {
    console.log(code);
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
