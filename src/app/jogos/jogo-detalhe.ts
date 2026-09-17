import { ChangeDetectorRef, Component, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { ProdutoService } from '../../shared/services/firebase/produto.service';
import { CarrinhoStore } from '../../shared/stores/carrinho.store';
import { ProdutoDTO } from '../../shared/models/produto.dto';
import { ToastService } from '../../shared/services/toast/toast.service';
import { JogosAdquiridosStore } from '../../shared/stores/jogos-adquiridos.store';

/** Abaixo desse tanto de rolagem a ficha ainda está sobreposta na capa;
 *  acima disso ela some da capa e reaparece embaixo. Baixo de propósito —
 *  a ideia é a troca acontecer assim que o usuário começa a rolar, não
 *  só depois que o hero inteiro já saiu de vista. */
const SCROLL_THRESHOLD_PX = 24;

@Component({
  selector: 'app-jogo-detalhe',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './jogo-detalhe.html',
  styleUrl: './jogo-detalhe.scss',
})
export class JogoDetalhe {
  /** Alterna a ficha sobreposta na capa pela versão que reaparece abaixo do hero. */
  isScrolled = false;

  private readonly route = inject(ActivatedRoute);
  private readonly produtoService = inject(ProdutoService);
  private readonly carrinhoStore = inject(CarrinhoStore);
  private readonly toast = inject(ToastService);

  readonly jogosAdquiridosStore = inject(JogosAdquiridosStore);

  readonly produto = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => this.produtoService.buscarPorId(params.get('idDoJogo') ?? ''))
    ),
    { initialValue: null }
  );

  constructor(private readonly cdr: ChangeDetectorRef) {}

  adicionarAoCarrinho(produto: ProdutoDTO): void {
    if (produto.estoque <= 0 || produto.emBreve) {
      return;
    }

    this.carrinhoStore.adicionarItem(produto);
    this.toast.showSuccess(`${produto.nome} foi adicionado ao carrinho.`);
  }

  /* Controlado pelo componente em vez de <details> nativo: o <details> do
     Chrome moderno tem animação interna própria que entra em conflito com
     a transição via CSS, fazendo o efeito falhar depois do primeiro uso. */
  private readonly openAccordions = signal<ReadonlySet<number>>(new Set());

  isAccordionOpen(index: number): boolean {
    return this.openAccordions().has(index);
  }

  toggleAccordion(index: number): void {
    this.openAccordions.update(open => {
      const next = new Set(open);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const isScrolled = window.scrollY > SCROLL_THRESHOLD_PX;
    if (isScrolled !== this.isScrolled) {
      this.isScrolled = isScrolled;
      this.cdr.detectChanges();
    }
  }
}
