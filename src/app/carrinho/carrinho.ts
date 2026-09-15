import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CarrinhoStore } from '../../shared/stores/carrinho.store';
import { AuthStateStore } from '../../shared/stores/auth-state.store';

@Component({
  selector: 'app-carrinho',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './carrinho.html'
})
export class Carrinho {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateStore);

  readonly carrinhoStore = inject(CarrinhoStore);

  atualizarQuantidade(produtoId: string, valor: string): void {
    const quantidade = Number(valor);
    if (Number.isFinite(quantidade)) {
      this.carrinhoStore.atualizarQuantidade(produtoId, Math.trunc(quantidade));
    }
  }

  finalizarCompra(): void {
    if (this.authState.estaAutenticado()) {
      this.router.navigate(['/checkout']);
    } else {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
    }
  }
}
