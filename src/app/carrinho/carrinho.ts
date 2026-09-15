import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CarrinhoStore } from '../../shared/stores/carrinho.store';
import { AuthStateStore } from '../../shared/stores/auth-state.store';

@Component({
  selector: 'app-carrinho',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './carrinho.html',
  styleUrl: './carrinho.scss'
})
export class Carrinho {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateStore);

  /** Capas que falharam ao carregar — trocadas por um marcador neutro. */
  private readonly capasQuebradas = signal<ReadonlySet<string>>(new Set<string>());

  readonly carrinhoStore = inject(CarrinhoStore);

  imagemFalhou(produtoId: string): boolean {
    return this.capasQuebradas().has(produtoId);
  }

  aoFalharImagem(produtoId: string): void {
    this.capasQuebradas.update((atual) => new Set(atual).add(produtoId));
  }

  atualizarQuantidade(produtoId: string, valor: string): void {
    const quantidade = Number(valor);
    if (Number.isFinite(quantidade)) {
      this.carrinhoStore.atualizarQuantidade(produtoId, Math.trunc(quantidade));
    }
  }

  incrementar(produtoId: string, quantidadeAtual: number): void {
    this.carrinhoStore.atualizarQuantidade(produtoId, quantidadeAtual + 1);
  }

  decrementar(produtoId: string, quantidadeAtual: number): void {
    this.carrinhoStore.atualizarQuantidade(produtoId, quantidadeAtual - 1);
  }

  finalizarCompra(): void {
    if (this.authState.estaAutenticado()) {
      this.router.navigate(['/checkout']);
    } else {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
    }
  }
}
