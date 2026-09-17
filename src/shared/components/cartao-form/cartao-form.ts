import { Component, input, output, signal } from '@angular/core';

export interface CartaoFormulario {
  numero: string;
  nomeTitular: string;
  mesValidade: string;
  anoValidade: string;
  cvv: string;
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

  readonly adicionar = output<CartaoFormulario>();
  readonly cancelar = output<void>();

  readonly numero = signal('');
  readonly nomeTitular = signal('');
  readonly validade = signal(''); // "MM/AA" — dividido em confirmar()
  readonly cvv = signal('');
  readonly salvarCartao = signal(false);

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

    this.erro.set(null);
    this.adicionar.emit({
      numero: numeroLimpo,
      nomeTitular: this.nomeTitular().trim(),
      mesValidade: mes,
      anoValidade: `20${ano}`,
      cvv: cvvLimpo,
      salvar: this.ocultarCheckboxSalvar() || this.salvarCartao()
    });
  }
}
