import { Component, input, output, signal } from '@angular/core';
import { cpfValido, formatarCpf, limparCpf } from '../../utils/cpf.util';

export interface CartaoFormulario {
  numero: string;
  nomeTitular: string;
  mesValidade: string;
  anoValidade: string;
  cvv: string;
  cpfTitular: string;
  salvar: boolean;
}

@Component({
  selector: 'app-cartao-form',
  standalone: true,
  templateUrl: './cartao-form.html'
})
export class CartaoForm {
  /** Fora do checkout (ex.: perfil > cartões) não existe "uso único" — todo
   *  cartão adicionado ali já é pra guardar, então some com o checkbox. */
  readonly ocultarCheckboxSalvar = input(false);
  readonly processando = input(false);
  /** Pré-preenche com o CPF do pagador/perfil como sugestão — o titular do
   *  cartão pode ser outra pessoa, por isso o campo fica editável. */
  readonly cpfInicial = input('');

  readonly adicionar = output<CartaoFormulario>();
  readonly cancelar = output<void>();

  readonly numero = signal('');
  readonly nomeTitular = signal('');
  readonly validade = signal(''); // "MM/AA" — dividido em confirmar()
  readonly cvv = signal('');
  readonly cpfTitular = signal('');
  readonly salvarCartao = signal(false);

  constructor() {
    const inicial = this.cpfInicial();
    if (inicial) {
      this.cpfTitular.set(formatarCpf(inicial));
    }
  }

  readonly erro = signal<string | null>(null);

  formatarNumero(valor: string): void {
    const digitos = valor.replace(/\D/g, '').slice(0, 19);
    this.numero.set(digitos.replace(/(\d{4})(?=\d)/g, '$1 ').trim());
  }

  formatarValidade(valor: string): void {
    const digitos = valor.replace(/\D/g, '').slice(0, 4);
    this.validade.set(digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos);
  }

  formatarCvv(valor: string): void {
    this.cvv.set(valor.replace(/\D/g, '').slice(0, 4));
  }

  formatarCpfTitular(valor: string): void {
    this.cpfTitular.set(formatarCpf(valor.replace(/\D/g, '').slice(0, 11)));
  }

  confirmar(): void {
    const numeroLimpo = this.numero().replace(/\D/g, '');
    const [mes, ano] = this.validade().split('/');
    const cvvLimpo = this.cvv().replace(/\D/g, '');

    if (numeroLimpo.length < 13) {
      this.erro.set('Número do cartão inválido.');
      return;
    }
    if (!this.nomeTitular().trim()) {
      this.erro.set('Informe o nome impresso no cartão.');
      return;
    }
    if (!mes || !ano || mes.length !== 2 || ano.length !== 2) {
      this.erro.set('Validade inválida — use MM/AA.');
      return;
    }
    if (cvvLimpo.length < 3) {
      this.erro.set('CVV inválido.');
      return;
    }
    const cpfLimpo = limparCpf(this.cpfTitular());
    if (!cpfValido(cpfLimpo)) {
      this.erro.set('CPF do titular inválido.');
      return;
    }

    this.erro.set(null);
    this.adicionar.emit({
      numero: numeroLimpo,
      nomeTitular: this.nomeTitular().trim(),
      mesValidade: mes,
      anoValidade: `20${ano}`,
      cvv: cvvLimpo,
      cpfTitular: cpfLimpo,
      salvar: this.ocultarCheckboxSalvar() || this.salvarCartao()
    });
  }
}
