import { Component, inject, signal } from '@angular/core';
import { AuthStateStore } from '../../../shared/stores/auth-state.store';
import { ToastService } from '../../../shared/services/toast/toast.service';
import { PerfilService } from '../../../shared/services/firebase/perfil.service';
import { CartaoService } from '../../../shared/services/firebase/cartao.service';
import { MercadoPagoSdkService } from '../../../shared/services/pagamento/mercado-pago-sdk.service';
import { CartaoForm, CartaoFormulario } from '../../../shared/components/cartao-form/cartao-form';
import { CartaoSalvoDTO } from '../../../shared/models/cartao.dto';

@Component({
  selector: 'app-cartoes',
  standalone: true,
  imports: [CartaoForm],
  templateUrl: './cartoes.html',
  styleUrl: './cartoes.scss'
})
export class Cartoes {
  private readonly authState = inject(AuthStateStore);
  private readonly toast = inject(ToastService);
  private readonly perfilService = inject(PerfilService);
  private readonly cartaoService = inject(CartaoService);
  private readonly mpSdk = inject(MercadoPagoSdkService);

  readonly cartoes = signal<CartaoSalvoDTO[]>([]);
  readonly carregando = signal(true);
  readonly mostrarForm = signal(false);
  readonly salvando = signal(false);

  /** Só uma sugestão de preenchimento — o titular do cartão pode ser outra
   *  pessoa, o campo de CPF no formulário é editável. */
  readonly cpfSugerido = signal('');

  constructor() {
    this.carregarCartoes();
    this.perfilService.buscar(this.authState.usuario()!.id).subscribe(perfil => {
      this.cpfSugerido.set(perfil?.cpf ?? '');
    });
  }

  private async carregarCartoes(): Promise<void> {
    this.carregando.set(true);
    try {
      this.cartoes.set(await this.cartaoService.listar());
    } catch {
      this.toast.showError('Não foi possível carregar seus cartões.');
    } finally {
      this.carregando.set(false);
    }
  }

  async adicionarCartao(dados: CartaoFormulario): Promise<void> {
    this.salvando.set(true);
    try {
      const token = await this.mpSdk.criarTokenCartaoNovo({
        cardNumber: dados.numero,
        cardholderName: dados.nomeTitular,
        cardExpirationMonth: dados.mesValidade,
        cardExpirationYear: dados.anoValidade,
        securityCode: dados.cvv,
        identificationNumber: dados.cpfTitular
      });
      const cartaoSalvo = await this.cartaoService.salvar(token);
      this.cartoes.update(lista => [...lista, cartaoSalvo]);
      this.mostrarForm.set(false);
      this.toast.showSuccess('Cartão salvo!');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Não foi possível salvar o cartão.');
    } finally {
      this.salvando.set(false);
    }
  }

  async remover(cartao: CartaoSalvoDTO): Promise<void> {
    try {
      await this.cartaoService.remover(cartao.id);
      this.cartoes.update(lista => lista.filter(c => c.id !== cartao.id));
      this.toast.showSuccess('Cartão removido.');
    } catch {
      this.toast.showError('Não foi possível remover o cartão.');
    }
  }
}
