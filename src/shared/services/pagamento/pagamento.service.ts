import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { EntradaProcessarPagamento, ResultadoProcessarPagamento } from '../../models/pagamento.dto';

@Injectable({ providedIn: 'root' })
export class PagamentoService {
  private readonly functions = inject(Functions);

  async processar(entrada: EntradaProcessarPagamento): Promise<ResultadoProcessarPagamento> {
    const processarPagamento = httpsCallable<EntradaProcessarPagamento, ResultadoProcessarPagamento>(
      this.functions,
      'processarPagamento'
    );
    const resultado = await processarPagamento(entrada);
    return resultado.data;
  }
}
