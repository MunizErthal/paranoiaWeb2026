import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UsuarioDTO } from '../../models/usuario.dto';
import { environment } from '../../../environment/environment.prod';

/**
 * Serviço de gerenciamento de estado de autenticação
 * Monitora o estado do usuário e partida
 */
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private usuarioSubject = new BehaviorSubject<UsuarioDTO | null>(null);
  private partidaIdSubject = new BehaviorSubject<string | null>(null);
  private estaAutenticadoSubject = new BehaviorSubject<boolean>(false);

  usuario$ = this.usuarioSubject.asObservable();
  partidaId$ = this.partidaIdSubject.asObservable();
  estaAutenticado$ = this.estaAutenticadoSubject.asObservable();

  constructor() {
    this.inicializarDoLocalStorage();
  }

  /**
   * Inicializa o estado a partir do localStorage
   */
  private inicializarDoLocalStorage(): void {
    const usuarioArmazenado = localStorage.getItem('usuarioAtual');
    const partidaIdArmazenado = localStorage.getItem('partidaId');

    if (usuarioArmazenado) {
      try {
        const usuario: UsuarioDTO = JSON.parse(usuarioArmazenado);
        this.setUsuario(usuario);
      } catch (err) {
        console.error('Erro ao parsear usuário do localStorage:', err);
        localStorage.removeItem('usuarioAtual');
      }
    }
  }

  /**
   * Define o usuário atual
   */
  setUsuario(usuario: UsuarioDTO | null): void {
    this.usuarioSubject.next(usuario);
    this.estaAutenticadoSubject.next(usuario !== null);
    environment.usuarioAtual = usuario;

    if (usuario) {
      localStorage.setItem('usuarioAtual', JSON.stringify(usuario));
    } else {
      localStorage.removeItem('usuarioAtual');
    }
  }

  /**
   * Obtém o usuário atual
   */
  getUsuarioAtual(): UsuarioDTO | null {
    return this.usuarioSubject.getValue();
  }

  /**
   * Obtém o ID da partida em andamento
   */
  getPartidaId(): string | null {
    return this.partidaIdSubject.getValue();
  }

  /**
   * Verifica se o usuário está autenticado
   */
  estaAutenticado(): boolean {
    return this.estaAutenticadoSubject.getValue();
  }

  /**
   * Limpa o estado (chamado no logout)
   */
  limpar(): void {
    this.setUsuario(null);
  }
}
