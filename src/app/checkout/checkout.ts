import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CarrinhoStore } from '../../shared/stores/carrinho.store';
import { AuthStateStore } from '../../shared/stores/auth-state.store';
import { EnderecoService } from '../../shared/services/firebase/endereco.service';
import { PerfilService } from '../../shared/services/firebase/perfil.service';
import { FreteService } from '../../shared/services/frete/frete.service';
import { PagamentoService } from '../../shared/services/pagamento/pagamento.service';
import { ToastService } from '../../shared/services/toast/toast.service';
import { EnderecoForm } from '../../shared/components/endereco-form/endereco-form';
import { EnderecoDTO } from '../../shared/models/endereco.dto';
import { OpcaoFrete } from '../../shared/models/frete.dto';
import { MetodoPagamento, ResultadoProcessarPagamento } from '../../shared/models/pagamento.dto';
import { environment } from '../../environment/environment';
import { cpfValido } from '../../shared/utils/cpf.util';

type Etapa = 'endereco' | 'frete' | 'pagamento' | 'concluido';

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

  readonly carrinhoStore = inject(CarrinhoStore);
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

  readonly enderecoSelecionado = computed(() =>
    this.enderecos().find(e => e.id === this.enderecoSelecionadoId()) ?? null
  );
  readonly freteSelecionado = computed(() =>
    this.opcoesFrete().find(o => o.servicoId === this.servicoIdSelecionado()) ?? null
  );
  readonly valorProdutos = computed(() => this.carrinhoStore.valorTotal());
  readonly valorTotal = computed(() => this.valorProdutos() + (this.freteSelecionado()?.preco ?? 0));

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
        emailPagador: usuario.email
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
