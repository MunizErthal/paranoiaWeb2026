import { Component, DestroyRef, ElementRef, HostListener, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { CarrinhoStore } from '../../stores/carrinho.store';
import { CarrinhoDrawerStore } from '../../stores/carrinho-drawer.store';
import { AuthStateStore } from '../../stores/auth-state.store';

@Component({
  selector: 'app-carrinho-drawer',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './carrinho-drawer.html',
  styleUrl: './carrinho-drawer.scss'
})
export class CarrinhoDrawer {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateStore);
  private readonly destroyRef = inject(DestroyRef);
  private elementoAnterior: HTMLElement | null = null;

  /** Capas que falharam ao carregar — trocadas por um marcador neutro em
   *  vez de deixar o texto alternativo vazar por cima do layout. */
  private readonly capasQuebradas = signal<ReadonlySet<string>>(new Set<string>());

  readonly painel = viewChild<ElementRef<HTMLElement>>('painel');

  readonly carrinhoStore = inject(CarrinhoStore);
  readonly drawer = inject(CarrinhoDrawerStore);

  constructor() {
    // Fecha a gaveta assim que uma navegação começa (ex.: "ver carrinho
    // completo" ou finalizar compra), em vez de deixá-la aberta por cima
    // da página de destino.
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationStart && this.drawer.aberto()) {
          this.drawer.fechar();
        }
      });

    // Move o foco para o painel ao abrir e devolve pro elemento que abriu
    // a gaveta (o botão de carrinho do cabeçalho) ao fechar. Também trava
    // o scroll da página por trás enquanto a gaveta está aberta.
    effect(() => {
      if (this.drawer.aberto()) {
        this.elementoAnterior = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';
        queueMicrotask(() => this.painel()?.nativeElement.focus());
      } else {
        document.body.style.overflow = '';
        this.elementoAnterior?.focus?.();
        this.elementoAnterior = null;
      }
    });

    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.drawer.aberto()) {
      this.drawer.fechar();
    }
  }

  imagemFalhou(produtoId: string): boolean {
    return this.capasQuebradas().has(produtoId);
  }

  aoFalharImagem(produtoId: string): void {
    this.capasQuebradas.update((atual) => new Set(atual).add(produtoId));
  }

  fechar(): void {
    this.drawer.fechar();
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
    this.drawer.fechar();
    if (this.authState.estaAutenticado()) {
      this.router.navigate(['/checkout']);
    } else {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
    }
  }
}
