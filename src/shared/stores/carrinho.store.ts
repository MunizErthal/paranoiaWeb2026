import { Injectable, computed, effect, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CarrinhoService } from '../services/firebase/carrinho.service';
import { ItemCarrinho } from '../models/carrinho.dto';
import { ProdutoDTO } from '../models/produto.dto';
import { CupomDTO } from '../models/cupom.dto';
import { calcularDesconto } from '../utils/cupom.util';

const CHAVE_LOCAL_STORAGE = 'carrinho';
const CHAVE_LOCAL_STORAGE_CUPOM = 'cupomAplicado';

@Injectable({ providedIn: 'root' })
export class CarrinhoStore {
  private readonly _itens = signal<ItemCarrinho[]>(this.carregarDoLocalStorage());
  private readonly _cupom = signal<CupomDTO | null>(this.carregarCupomDoLocalStorage());

  readonly itens = this._itens.asReadonly();
  readonly cupom = this._cupom.asReadonly();
  readonly quantidadeTotal = computed(() =>
    this._itens().reduce((soma, item) => soma + item.quantidade, 0)
  );
  readonly valorTotal = computed(() =>
    this._itens().reduce((soma, item) => soma + item.precoUnit * item.quantidade, 0)
  );
  /** Só a parte do desconto que depende de produtos (PORCENTAGEM/VALOR_FIXO).
   *  O desconto de frete depende do frete escolhido, que só existe no
   *  checkout — ver Checkout.valorDescontoFrete. */
  readonly valorDesconto = computed(() => {
    const cupom = this._cupom();
    return cupom ? calcularDesconto(cupom, this._itens(), 0).valorDescontoProdutos : 0;
  });

  constructor(private carrinhoService: CarrinhoService) {
    effect(() => {
      localStorage.setItem(CHAVE_LOCAL_STORAGE, JSON.stringify(this._itens()));
    });
    effect(() => {
      const cupom = this._cupom();
      if (cupom) {
        localStorage.setItem(CHAVE_LOCAL_STORAGE_CUPOM, JSON.stringify(cupom));
      } else {
        localStorage.removeItem(CHAVE_LOCAL_STORAGE_CUPOM);
      }
    });
  }

  aplicarCupom(cupom: CupomDTO): void {
    this._cupom.set(cupom);
  }

  removerCupom(): void {
    this._cupom.set(null);
  }

  adicionarItem(produto: ProdutoDTO, quantidade = 1): void {
    this._itens.update(itens => {
      const existente = itens.find(item => item.produtoId === produto.id);

      if (existente) {
        return itens.map(item =>
          item.produtoId === produto.id
            ? { ...item, quantidade: item.quantidade + quantidade }
            : item
        );
      }

      const novoItem: ItemCarrinho = {
        produtoId: produto.id,
        nome: produto.nome,
        precoUnit: produto.preco,
        imagemCapa: produto.imagemCapa,
        imagemEmblema: produto.imagemEmblema,
        quantidade
      };
      return [...itens, novoItem];
    });
  }

  removerItem(produtoId: string): void {
    this._itens.update(itens => itens.filter(item => item.produtoId !== produtoId));
  }

  atualizarQuantidade(produtoId: string, quantidade: number): void {
    if (quantidade <= 0) {
      this.removerItem(produtoId);
      return;
    }

    this._itens.update(itens =>
      itens.map(item => (item.produtoId === produtoId ? { ...item, quantidade } : item))
    );
  }

  limpar(): void {
    this._itens.set([]);
    this._cupom.set(null);
  }

  /**
   * Mescla o carrinho local com o que estiver salvo na conta (soma
   * quantidades de itens repetidos, sem duplicar) e sincroniza o
   * resultado nos dois lugares. Chamado no login.
   */
  async mesclarComFirestore(uid: string): Promise<void> {
    const itensRemotos = await firstValueFrom(this.carrinhoService.buscarItens(uid));
    const itensLocais = this._itens();

    const mesclados = [...itensLocais];
    for (const remoto of itensRemotos) {
      const local = mesclados.find(item => item.produtoId === remoto.produtoId);
      if (local) {
        local.quantidade += remoto.quantidade;
      } else {
        mesclados.push(remoto);
      }
    }

    this._itens.set(mesclados);
    await firstValueFrom(this.carrinhoService.salvar(uid, mesclados));
  }

  private carregarDoLocalStorage(): ItemCarrinho[] {
    const armazenado = localStorage.getItem(CHAVE_LOCAL_STORAGE);
    if (!armazenado) {
      return [];
    }

    try {
      return JSON.parse(armazenado) as ItemCarrinho[];
    } catch {
      localStorage.removeItem(CHAVE_LOCAL_STORAGE);
      return [];
    }
  }

  private carregarCupomDoLocalStorage(): CupomDTO | null {
    const armazenado = localStorage.getItem(CHAVE_LOCAL_STORAGE_CUPOM);
    if (!armazenado) {
      return null;
    }

    try {
      return JSON.parse(armazenado) as CupomDTO;
    } catch {
      localStorage.removeItem(CHAVE_LOCAL_STORAGE_CUPOM);
      return null;
    }
  }
}
