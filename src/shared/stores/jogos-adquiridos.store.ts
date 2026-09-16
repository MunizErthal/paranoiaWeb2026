import { Injectable, effect, inject, signal } from '@angular/core';
import { JogoAdquirido } from '../models/usuario.dto';
import { UsuarioService } from '../services/firebase/usuario.service';
import { AuthStateStore } from './auth-state.store';

/**
 * Quais jogos o usuário logado já comprou (usuarios/{uid}.jogosAdquiridos),
 * disponível pra loja, ficha do jogo, carrinho e checkout marcarem "já
 * adquirido" sem cada tela repetir a busca no Firestore.
 *
 * Não impede recompra — é só informativo (ver perfil "Meus jogos" e o aviso
 * no carrinho/checkout).
 */
@Injectable({ providedIn: 'root' })
export class JogosAdquiridosStore {
  private readonly authState = inject(AuthStateStore);
  private readonly usuarioService = inject(UsuarioService);

  private readonly _itens = signal<JogoAdquirido[]>([]);
  private readonly _idsAdquiridos = signal<ReadonlySet<string>>(new Set());

  readonly itens = this._itens.asReadonly();
  readonly idsAdquiridos = this._idsAdquiridos.asReadonly();

  constructor() {
    effect(() => {
      const uid = this.authState.usuario()?.id;
      if (!uid) {
        this._itens.set([]);
        this._idsAdquiridos.set(new Set());
        return;
      }

      this.usuarioService.buscarPorId(uid).subscribe((usuario) => {
        const itens = usuario?.jogosAdquiridos ?? [];
        this._itens.set(itens);
        this._idsAdquiridos.set(new Set(itens.map((item) => item.produtoId)));
      });
    });
  }

  possui(produtoId: string): boolean {
    return this._idsAdquiridos().has(produtoId);
  }
}
