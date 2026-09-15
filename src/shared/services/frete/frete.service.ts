import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { ItemFreteEntrada, OpcaoFrete } from '../../models/frete.dto';

@Injectable({ providedIn: 'root' })
export class FreteService {
  private readonly functions = inject(Functions);

  async cotar(itens: ItemFreteEntrada[], cepDestino: string): Promise<OpcaoFrete[]> {
    const cotarFrete = httpsCallable<{ itens: ItemFreteEntrada[]; cepDestino: string }, OpcaoFrete[]>(
      this.functions,
      'cotarFrete'
    );
    const resultado = await cotarFrete({ itens, cepDestino });
    return resultado.data;
  }
}
