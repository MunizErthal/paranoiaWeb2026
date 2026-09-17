import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProdutoService } from '../../shared/services/firebase/produto.service';
import { CarrinhoStore } from '../../shared/stores/carrinho.store';
import { ToastService } from '../../shared/services/toast/toast.service';
import { JogosAdquiridosStore } from '../../shared/stores/jogos-adquiridos.store';
import { ProdutoDTO } from '../../shared/models/produto.dto';

/** Tempo que o botão de um item mostra "Adicionado" antes de voltar ao normal. */
const DURACAO_FEEDBACK_MS = 1600;

@Component({
  selector: 'app-loja',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './loja.html',
  styleUrl: './loja.scss'
})
export class Loja {
  private readonly produtoService = inject(ProdutoService);
  private readonly carrinhoStore = inject(CarrinhoStore);
  private readonly toast = inject(ToastService);

  readonly jogosAdquiridosStore = inject(JogosAdquiridosStore);

  readonly produtos = toSignal(this.produtoService.listarAtivos(), { initialValue: [] });

  private readonly _filtro = signal<string | null>(null);
  private readonly _recemAdicionados = signal<ReadonlySet<string>>(new Set());

  readonly filtro = this._filtro.asReadonly();

  /** Tags únicas do catálogo atual, para montar os chips de filtro. */
  readonly categorias = computed(() => {
    const tags = new Set<string>();
    for (const produto of this.produtos()) {
      for (const tag of produto.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly produtosFiltrados = computed(() => {
    const filtro = this._filtro();
    const produtos = this.produtos();
    return filtro ? produtos.filter(produto => produto.tags.includes(filtro)) : produtos;
  });

  selecionarFiltro(tag: string | null): void {
    this._filtro.update(atual => (atual === tag ? null : tag));
  }

  foiAdicionadoRecentemente(produtoId: string): boolean {
    return this._recemAdicionados().has(produtoId);
  }

  adicionarAoCarrinho(produto: ProdutoDTO): void {
    if (produto.estoque <= 0 || produto.emBreve) {
      return;
    }

    this.carrinhoStore.adicionarItem(produto);
    this.toast.showSuccess(`${produto.nome} foi adicionado ao carrinho.`);

    this._recemAdicionados.update(atual => new Set(atual).add(produto.id));
    setTimeout(() => {
      this._recemAdicionados.update(atual => {
        const proximo = new Set(atual);
        proximo.delete(produto.id);
        return proximo;
      });
    }, DURACAO_FEEDBACK_MS);
  }
}
