import { Injectable, computed, signal } from '@angular/core';
import { UsuarioDTO } from '../models/usuario.dto';

const CHAVE_LOCAL_STORAGE = 'usuarioAtual';

/**
 * Fonte de verdade do estado de sessão em tempo de execução.
 * O localStorage aqui é só cache de UI (evita tela vazia no primeiro render) —
 * nunca é usado para decisões de autorização, que dependem das regras do Firestore.
 */
@Injectable({ providedIn: 'root' })
export class AuthStateStore {
  private readonly _usuario = signal<UsuarioDTO | null>(this.carregarDoLocalStorage());

  readonly usuario = this._usuario.asReadonly();
  readonly estaAutenticado = computed(() => this._usuario() !== null);

  setUsuario(usuario: UsuarioDTO | null): void {
    this._usuario.set(usuario);

    if (usuario) {
      localStorage.setItem(CHAVE_LOCAL_STORAGE, JSON.stringify(usuario));
    } else {
      localStorage.removeItem(CHAVE_LOCAL_STORAGE);
    }
  }

  limpar(): void {
    this.setUsuario(null);
  }

  private carregarDoLocalStorage(): UsuarioDTO | null {
    const usuarioArmazenado = localStorage.getItem(CHAVE_LOCAL_STORAGE);
    if (!usuarioArmazenado) {
      return null;
    }

    try {
      return JSON.parse(usuarioArmazenado) as UsuarioDTO;
    } catch {
      localStorage.removeItem(CHAVE_LOCAL_STORAGE);
      return null;
    }
  }
}
