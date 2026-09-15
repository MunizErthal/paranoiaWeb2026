import { Injectable, signal } from '@angular/core';

/**
 * Estado de abertura da gaveta de carrinho (mini-cart), compartilhado entre
 * o botão de carrinho no cabeçalho e o próprio componente da gaveta.
 */
@Injectable({ providedIn: 'root' })
export class CarrinhoDrawerStore {
  private readonly _aberto = signal(false);

  readonly aberto = this._aberto.asReadonly();

  abrir(): void {
    this._aberto.set(true);
  }

  fechar(): void {
    this._aberto.set(false);
  }

  alternar(): void {
    this._aberto.update((aberto) => !aberto);
  }
}
