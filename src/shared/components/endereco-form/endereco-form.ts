import { Component, input, output, signal, effect } from '@angular/core';
import { EnderecoDTO } from '../../models/endereco.dto';
import { cepValido, limparCep, formatarCep } from '../../utils/cep.util';

type EnderecoFormulario = Omit<EnderecoDTO, 'id' | 'padrao'>;

interface RespostaViaCep {
  erro?: boolean;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

@Component({
  selector: 'app-endereco-form',
  standalone: true,
  templateUrl: './endereco-form.html'
})
export class EnderecoForm {
  readonly enderecoInicial = input<EnderecoDTO | null>(null);
  readonly salvar = output<EnderecoFormulario>();
  readonly cancelar = output<void>();

  readonly apelido = signal('');
  readonly cep = signal('');
  readonly logradouro = signal('');
  readonly numero = signal('');
  readonly complemento = signal('');
  readonly bairro = signal('');
  readonly cidade = signal('');
  readonly estado = signal('');

  readonly buscandoCep = signal(false);
  readonly erroCep = signal<string | null>(null);
  readonly erroNumero = signal<string | null>(null);

  constructor() {
    effect(() => {
      const inicial = this.enderecoInicial();
      if (!inicial) {
        return;
      }
      this.apelido.set(inicial.apelido ?? '');
      this.cep.set(formatarCep(inicial.cep));
      this.logradouro.set(inicial.logradouro);
      this.numero.set(inicial.numero);
      this.complemento.set(inicial.complemento ?? '');
      this.bairro.set(inicial.bairro);
      this.cidade.set(inicial.cidade);
      this.estado.set(inicial.estado);
    });
  }

  async buscarCep(): Promise<void> {
    const cepLimpo = limparCep(this.cep());
    if (!cepValido(cepLimpo)) {
      this.erroCep.set('CEP inválido.');
      return;
    }

    this.buscandoCep.set(true);
    this.erroCep.set(null);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const dados = (await resposta.json()) as RespostaViaCep;

      if (dados.erro) {
        this.erroCep.set('CEP não encontrado.');
        return;
      }

      this.logradouro.set(dados.logradouro);
      this.bairro.set(dados.bairro);
      this.cidade.set(dados.localidade);
      this.estado.set(dados.uf);
    } catch {
      this.erroCep.set('Não foi possível consultar o CEP agora.');
    } finally {
      this.buscandoCep.set(false);
    }
  }

  confirmar(): void {
    this.erroNumero.set(this.numero().trim() ? null : 'Informe o número.');
    if (!cepValido(this.cep()) || this.erroNumero()) {
      return;
    }

    this.salvar.emit({
      apelido: this.apelido() || undefined,
      cep: limparCep(this.cep()),
      logradouro: this.logradouro(),
      numero: this.numero(),
      complemento: this.complemento() || undefined,
      bairro: this.bairro(),
      cidade: this.cidade(),
      estado: this.estado()
    });
  }
}
