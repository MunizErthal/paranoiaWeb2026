import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CarrinhoStore } from '../../shared/stores/carrinho.store';
import { AuthStateStore } from '../../shared/stores/auth-state.store';
import { JogosAdquiridosStore } from '../../shared/stores/jogos-adquiridos.store';
import { CupomService } from '../../shared/services/firebase/cupom.service';
import { ToastService } from '../../shared/services/toast/toast.service';
import { validarCupom } from '../../shared/utils/cupom.util';

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
  private readonly cupomService = inject(CupomService);
  private readonly toast = inject(ToastService);

  /** Capas que falharam ao carregar — trocadas por um marcador neutro. */
  private readonly capasQuebradas = signal<ReadonlySet<string>>(new Set<string>());

  readonly carrinhoStore = inject(CarrinhoStore);
  readonly jogosAdquiridosStore = inject(JogosAdquiridosStore);

  readonly codigoCupom = signal('');
  readonly aplicandoCupom = signal(false);

  /** Nomes dos itens do carrinho que o usuário já comprou antes — o aviso é
   *  só informativo, recomprar continua permitido. */
  readonly nomesJaAdquiridos = computed(() =>
    this.carrinhoStore
      .itens()
      .filter((item) => this.jogosAdquiridosStore.possui(item.produtoId))
      .map((item) => item.nome)
  );

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

  async aplicarCupom(): Promise<void> {
    const codigo = this.codigoCupom().trim();
    if (!codigo) {
      return;
    }

    this.aplicandoCupom.set(true);
    try {
      const cupom = await firstValueFrom(this.cupomService.buscarPorNome(codigo));
      if (!cupom) {
        this.toast.showError('Cupom não encontrado.');
        return;
      }

      const validacao = validarCupom(cupom, {
        valorProdutos: this.carrinhoStore.valorTotal(),
        agora: new Date()
      });
      if (!validacao.valido) {
        this.toast.showError(validacao.motivo ?? 'Cupom inválido.');
        return;
      }

      this.carrinhoStore.aplicarCupom(cupom);
      this.codigoCupom.set('');
      this.toast.showSuccess('Cupom aplicado!');
    } finally {
      this.aplicandoCupom.set(false);
    }
  }

  removerCupom(): void {
    this.carrinhoStore.removerCupom();
  }
}
