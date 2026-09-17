import { Component, inject, signal, computed } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom, switchMap, of } from 'rxjs';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CarrinhoStore } from '../../shared/stores/carrinho.store';
import { AuthStateStore } from '../../shared/stores/auth-state.store';
import { JogosAdquiridosStore } from '../../shared/stores/jogos-adquiridos.store';
import { EnderecoService } from '../../shared/services/firebase/endereco.service';
import { PerfilService } from '../../shared/services/firebase/perfil.service';
import { FreteService } from '../../shared/services/frete/frete.service';
import { PagamentoService } from '../../shared/services/pagamento/pagamento.service';
import { ToastService } from '../../shared/services/toast/toast.service';
import { CupomService } from '../../shared/services/firebase/cupom.service';
import { PedidoService } from '../../shared/services/firebase/pedido.service';
import { EnderecoForm } from '../../shared/components/endereco-form/endereco-form';
import { EnderecoDTO } from '../../shared/models/endereco.dto';
import { OpcaoFrete } from '../../shared/models/frete.dto';
import { MetodoPagamento, ResultadoProcessarPagamento } from '../../shared/models/pagamento.dto';
import { environment } from '../../environment/environment';
import { cpfValido } from '../../shared/utils/cpf.util';
import { validarCupom } from '../../shared/utils/cupom.util';

type Etapa = 'endereco' | 'frete' | 'pagamento' | 'concluido';
const ORDEM_ETAPAS: Etapa[] = ['endereco', 'frete', 'pagamento'];

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, EnderecoForm],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss'
})
export class Checkout {
  private readonly enderecoService = inject(EnderecoService);
  private readonly perfilService = inject(PerfilService);
  private readonly freteService = inject(FreteService);
  private readonly pagamentoService = inject(PagamentoService);
  private readonly toast = inject(ToastService);
  private readonly authState = inject(AuthStateStore);
  private readonly cupomService = inject(CupomService);
  private readonly pedidoService = inject(PedidoService);

  readonly carrinhoStore = inject(CarrinhoStore);
  readonly jogosAdquiridosStore = inject(JogosAdquiridosStore);
  readonly aceitaCartao = !!environment.mercadoPagoPublicKey;

  readonly etapa = signal<Etapa>('endereco');

  readonly enderecos = toSignal(
    this.enderecoService.listar(this.authState.usuario()!.id),
    { initialValue: [] as EnderecoDTO[] }
  );
  readonly mostrarFormNovoEndereco = signal(false);
  readonly enderecoSelecionadoId = signal<string | null>(null);

  readonly cotandoFrete = signal(false);
  readonly opcoesFrete = signal<OpcaoFrete[]>([]);
  readonly servicoIdSelecionado = signal<number | null>(null);

  readonly cpf = signal('');
  readonly erroCpf = signal<string | null>(null);
  readonly metodo = signal<MetodoPagamento>('pix');
  readonly processando = signal(false);
  readonly resultado = signal<ResultadoProcessarPagamento | null>(null);

  /** Acompanha o status da compra em tempo real enquanto o usuário fica
   *  nesta tela — assim que o webhook do Mercado Pago confirmar o Pix/
   *  boleto, a mensagem atualiza sozinha, sem precisar dar refresh. Some
   *  automaticamente se o usuário sair da tela (toObservable/toSignal
   *  cancelam a escuta ao destruir o componente). */
  private readonly compraAoVivo = toSignal(
    toObservable(this.resultado).pipe(
      switchMap(resultado => (resultado ? this.pedidoService.ouvirCompra(resultado.compraId) : of(null)))
    ),
    { initialValue: null }
  );
  readonly statusAtual = computed(() => this.compraAoVivo()?.status ?? this.resultado()?.status ?? null);
  readonly pagamentoConfirmado = computed(() =>
    ['pago', 'etiqueta_gerada', 'enviado', 'entregue'].includes(this.statusAtual() ?? '')
  );
  readonly pagamentoRecusado = computed(() => ['recusado', 'cancelado'].includes(this.statusAtual() ?? ''));

  readonly codigoCupom = signal('');
  readonly aplicandoCupom = signal(false);

  readonly enderecoSelecionado = computed(() =>
    this.enderecos().find(e => e.id === this.enderecoSelecionadoId()) ?? null
  );
  readonly freteSelecionado = computed(() =>
    this.opcoesFrete().find(o => o.servicoId === this.servicoIdSelecionado()) ?? null
  );

  /** Uma etapa só é alcançável clicando direto se a anterior já foi
   *  concluída — evita pular pra "Pagamento" sem frete escolhido, por
   *  exemplo. Voltar para uma etapa já concluída é sempre permitido. */
  readonly etapaFreteAlcancavel = computed(() => !!this.enderecoSelecionado());
  readonly etapaPagamentoAlcancavel = computed(() => !!this.freteSelecionado());
  readonly valorProdutos = computed(() => this.carrinhoStore.valorTotal());
  readonly valorDescontoProdutos = computed(() => this.carrinhoStore.valorDesconto());
  readonly valorDescontoFrete = computed(() => {
    const cupom = this.carrinhoStore.cupom();
    return cupom?.tipoDeDesconto === 'FRETE' ? (this.freteSelecionado()?.preco ?? 0) : 0;
  });
  readonly valorTotal = computed(() =>
    Math.max(
      0,
      this.valorProdutos() +
        (this.freteSelecionado()?.preco ?? 0) -
        this.valorDescontoProdutos() -
        this.valorDescontoFrete()
    )
  );

  /** Nomes dos itens do carrinho que o usuário já comprou antes — o aviso é
   *  só informativo, recomprar continua permitido. */
  readonly nomesJaAdquiridos = computed(() =>
    this.carrinhoStore
      .itens()
      .filter((item) => this.jogosAdquiridosStore.possui(item.produtoId))
      .map((item) => item.nome)
  );

  constructor() {
    this.perfilService.buscar(this.authState.usuario()!.id).subscribe(perfil => {
      if (perfil?.cpf) {
        this.cpf.set(perfil.cpf);
      }
    });
  }

  selecionarEndereco(endereco: EnderecoDTO): void {
    this.enderecoSelecionadoId.set(endereco.id);
  }

  async salvarNovoEndereco(dados: Omit<EnderecoDTO, 'id' | 'padrao'>): Promise<void> {
    const uid = this.authState.usuario()!.id;
    const primeiroEndereco = this.enderecos().length === 0;

    this.enderecoService.criar(uid, { ...dados, padrao: primeiroEndereco }).subscribe({
      next: id => {
        this.enderecoSelecionadoId.set(id);
        this.mostrarFormNovoEndereco.set(false);
      },
      error: () => this.toast.showError('Não foi possível salvar o endereço.')
    });
  }

  async avancarParaFrete(): Promise<void> {
    const endereco = this.enderecoSelecionado();
    if (!endereco) {
      this.toast.showError('Selecione ou cadastre um endereço.');
      return;
    }

    this.etapa.set('frete');
    this.cotandoFrete.set(true);
    try {
      const itens = this.carrinhoStore.itens().map(item => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade
      }));
      const opcoes = await this.freteService.cotar(itens, endereco.cep);
      this.opcoesFrete.set(opcoes);
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Não foi possível calcular o frete.');
      this.etapa.set('endereco');
    } finally {
      this.cotandoFrete.set(false);
    }
  }

  avancarParaPagamento(): void {
    if (!this.freteSelecionado()) {
      this.toast.showError('Escolha uma opção de frete.');
      return;
    }
    this.etapa.set('pagamento');
  }

  /** Navegação direta pelos indicadores de etapa — só troca de tela se a
   *  etapa de destino já estiver alcançável (ver etapa*Alcancavel), pra não
   *  deixar pular passos que ainda faltam preencher. */
  irParaEtapa(destino: Etapa): void {
    if (destino === this.etapa()) {
      return;
    }
    if (destino === 'frete' && !this.etapaFreteAlcancavel()) {
      this.toast.showError('Selecione um endereço primeiro.');
      return;
    }
    if (destino === 'pagamento' && !this.etapaPagamentoAlcancavel()) {
      this.toast.showError('Escolha uma opção de frete primeiro.');
      return;
    }
    this.etapa.set(destino);
  }

  voltarEtapa(): void {
    const indiceAtual = ORDEM_ETAPAS.indexOf(this.etapa());
    if (indiceAtual > 0) {
      this.etapa.set(ORDEM_ETAPAS[indiceAtual - 1]);
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

  async finalizarCompra(): Promise<void> {
    if (!cpfValido(this.cpf())) {
      this.erroCpf.set('Informe um CPF válido.');
      return;
    }
    this.erroCpf.set(null);

    const endereco = this.enderecoSelecionado();
    const frete = this.freteSelecionado();
    const usuario = this.authState.usuario();
    if (!endereco || !frete || !usuario) {
      return;
    }

    this.processando.set(true);
    try {
      await firstValueFrom(this.perfilService.salvar(usuario.id, { cpf: this.cpf() }));

      const resultado = await this.pagamentoService.processar({
        itens: this.carrinhoStore.itens().map(item => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade
        })),
        enderecoId: endereco.id,
        servicoIdEscolhido: frete.servicoId,
        metodo: this.metodo(),
        cpf: this.cpf(),
        emailPagador: usuario.email,
        cupomNome: this.carrinhoStore.cupom()?.nome
      });

      this.resultado.set(resultado);
      this.carrinhoStore.limpar();
      this.etapa.set('concluido');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Não foi possível processar o pagamento.');
    } finally {
      this.processando.set(false);
    }
  }
}
