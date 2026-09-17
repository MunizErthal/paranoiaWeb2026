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
import { CartaoService } from '../../shared/services/firebase/cartao.service';
import { MercadoPagoSdkService } from '../../shared/services/pagamento/mercado-pago-sdk.service';
import { EnderecoForm } from '../../shared/components/endereco-form/endereco-form';
import { CartaoForm, CartaoFormulario } from '../../shared/components/cartao-form/cartao-form';
import { EnderecoDTO } from '../../shared/models/endereco.dto';
import { OpcaoFrete } from '../../shared/models/frete.dto';
import { CartaoSalvoDTO, OpcaoParcelamento } from '../../shared/models/cartao.dto';
import { MetodoPagamento, ResultadoProcessarPagamento } from '../../shared/models/pagamento.dto';
import { environment } from '../../environment/environment';
import { cpfValido, limparCpf } from '../../shared/utils/cpf.util';
import { validarCupom } from '../../shared/utils/cupom.util';

type Etapa = 'endereco' | 'frete' | 'pagamento' | 'concluido';
const ORDEM_ETAPAS: Etapa[] = ['endereco', 'frete', 'pagamento'];

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, EnderecoForm, CartaoForm],
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
  private readonly cartaoService = inject(CartaoService);
  private readonly mpSdk = inject(MercadoPagoSdkService);

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

  readonly tituloConclusao = computed(() => {
    if (this.pagamentoConfirmado()) return 'Compra finalizada com sucesso!';
    if (this.pagamentoRecusado()) return 'Pagamento não aprovado';
    return 'Pedido recebido!';
  });
  readonly mensagemConclusao = computed(() => {
    if (this.pagamentoConfirmado()) return 'Pagamento aprovado — seu pedido já está sendo preparado.';
    if (this.pagamentoRecusado()) return 'O pagamento não foi aprovado. Tente novamente ou use outro método.';
    return 'Recebemos seu pedido — a confirmação do pagamento pode levar alguns instantes. Esta página atualiza sozinha assim que ele for aprovado.';
  });

  readonly codigoCupom = signal('');
  readonly aplicandoCupom = signal(false);

  /** Cartão de crédito segue a mesma ideia dos endereços: lista de cartões
   *  salvos + botão de adicionar novo. Cartão salvo pede CVV de novo pra
   *  gerar um token de cobrança fresco (o Mercado Pago não guarda CVV);
   *  cartão recém-adicionado reaproveita o CVV que o usuário acabou de
   *  digitar, sem perguntar de novo. */
  readonly cartoesSalvos = signal<CartaoSalvoDTO[]>([]);
  readonly carregandoCartoes = signal(true);
  readonly mostrarFormNovoCartao = signal(false);
  readonly cartaoSelecionadoId = signal<string | null>(null);
  readonly cvvCartaoSalvo = signal('');
  readonly tokenCartaoPronto = signal<string | null>(null);
  readonly paymentMethodIdCartao = signal<string | null>(null);
  readonly opcoesParcelamento = signal<OpcaoParcelamento[]>([]);
  readonly parcelaSelecionadaIndex = signal(0);
  readonly processandoCartao = signal(false);
  readonly erroCartao = signal<string | null>(null);

  readonly cartaoSelecionado = computed(() =>
    this.cartoesSalvos().find(c => c.id === this.cartaoSelecionadoId()) ?? null
  );
  readonly parcelaSelecionada = computed(() => this.opcoesParcelamento()[this.parcelaSelecionadaIndex()] ?? null);

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

    if (this.aceitaCartao) {
      this.carregarCartoesSalvos();
    }
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

  private async carregarCartoesSalvos(): Promise<void> {
    this.carregandoCartoes.set(true);
    try {
      this.cartoesSalvos.set(await this.cartaoService.listar());
    } catch {
      // Lista vazia não impede pagar com um cartão novo — só não mostra
      // cartões salvos até a próxima tentativa.
      this.cartoesSalvos.set([]);
    } finally {
      this.carregandoCartoes.set(false);
    }
  }

  private async carregarParcelas(bin: string): Promise<void> {
    try {
      const opcoes = await this.mpSdk.buscarParcelas(bin, this.valorTotal());
      this.opcoesParcelamento.set(opcoes);
      this.parcelaSelecionadaIndex.set(0);
    } catch {
      this.opcoesParcelamento.set([]);
    }
  }

  async selecionarCartaoSalvo(cartao: CartaoSalvoDTO): Promise<void> {
    this.cartaoSelecionadoId.set(cartao.id);
    this.tokenCartaoPronto.set(null);
    this.cvvCartaoSalvo.set('');
    this.erroCartao.set(null);
    this.paymentMethodIdCartao.set(cartao.paymentMethodId);
    await this.carregarParcelas(cartao.primeirosDigitos);
  }

  async confirmarCvvCartaoSalvo(): Promise<void> {
    const cartao = this.cartaoSelecionado();
    const cvv = this.cvvCartaoSalvo().trim();
    if (!cartao) {
      return;
    }
    if (cvv.length < 3) {
      this.erroCartao.set('CVV inválido.');
      return;
    }

    this.processandoCartao.set(true);
    this.erroCartao.set(null);
    try {
      this.tokenCartaoPronto.set(await this.mpSdk.criarTokenCartaoSalvo(cartao.id, cvv));
    } catch {
      this.erroCartao.set('Não foi possível validar o cartão. Confira o CVV.');
    } finally {
      this.processandoCartao.set(false);
    }
  }

  async adicionarNovoCartao(dados: CartaoFormulario): Promise<void> {
    this.processandoCartao.set(true);
    this.erroCartao.set(null);
    try {
      const tokenBruto = await this.mpSdk.criarTokenCartaoNovo({
        cardNumber: dados.numero,
        cardholderName: dados.nomeTitular,
        cardExpirationMonth: dados.mesValidade,
        cardExpirationYear: dados.anoValidade,
        securityCode: dados.cvv,
        identificationNumber: limparCpf(this.cpf())
      });

      const bin = dados.numero.slice(0, 6);
      const metodo = await this.mpSdk.identificarPaymentMethod(bin);
      this.paymentMethodIdCartao.set(metodo?.paymentMethodId ?? null);

      if (dados.salvar) {
        const cartaoSalvo = await this.cartaoService.salvar(tokenBruto);
        this.cartoesSalvos.update(lista => [...lista, cartaoSalvo]);
        this.cartaoSelecionadoId.set(cartaoSalvo.id);
        // O token bruto já foi consumido salvando o cartão (token do
        // Mercado Pago só serve pra uma chamada). Gera outro reaproveitando
        // o CVV que o usuário acabou de digitar, sem pedir de novo.
        this.tokenCartaoPronto.set(await this.mpSdk.criarTokenCartaoSalvo(cartaoSalvo.id, dados.cvv));
      } else {
        this.cartaoSelecionadoId.set(null);
        this.tokenCartaoPronto.set(tokenBruto);
      }

      await this.carregarParcelas(bin);
      this.mostrarFormNovoCartao.set(false);
      this.toast.showSuccess(dados.salvar ? 'Cartão salvo!' : 'Cartão pronto pra pagamento.');
    } catch (err) {
      this.erroCartao.set(err instanceof Error ? err.message : 'Não foi possível validar o cartão.');
    } finally {
      this.processandoCartao.set(false);
    }
  }

  async removerCartao(cartaoId: string): Promise<void> {
    try {
      await this.cartaoService.remover(cartaoId);
      this.cartoesSalvos.update(lista => lista.filter(c => c.id !== cartaoId));
      if (this.cartaoSelecionadoId() === cartaoId) {
        this.cartaoSelecionadoId.set(null);
        this.tokenCartaoPronto.set(null);
      }
      this.toast.showSuccess('Cartão removido.');
    } catch {
      this.toast.showError('Não foi possível remover o cartão.');
    }
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

    const parcela = this.parcelaSelecionada();
    if (this.metodo() === 'cartao' && (!this.tokenCartaoPronto() || !this.paymentMethodIdCartao() || !parcela)) {
      this.toast.showError('Selecione um cartão e a forma de parcelamento.');
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
        cupomNome: this.carrinhoStore.cupom()?.nome,
        ...(this.metodo() === 'cartao' && parcela
          ? {
              cardToken: this.tokenCartaoPronto()!,
              paymentMethodId: this.paymentMethodIdCartao()!,
              parcelas: parcela.parcelas,
              issuerId: parcela.issuerId
            }
          : {})
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
