import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { CartaoSalvoDTO } from '../../models/cartao.dto';

@Injectable({ providedIn: 'root' })
export class CartaoService {
  private readonly functions = inject(Functions);

  async listar(): Promise<CartaoSalvoDTO[]> {
    const listarCartoesSalvos = httpsCallable<void, CartaoSalvoDTO[]>(this.functions, 'listarCartoesSalvos');
    const resultado = await listarCartoesSalvos();
    return resultado.data;
  }

  async salvar(cardToken: string): Promise<CartaoSalvoDTO> {
    const salvarCartaoSalvo = httpsCallable<{ cardToken: string }, CartaoSalvoDTO>(
      this.functions,
      'salvarCartaoSalvo'
    );
    const resultado = await salvarCartaoSalvo({ cardToken });
    return resultado.data;
  }

  async remover(cartaoId: string): Promise<void> {
    const removerCartaoSalvo = httpsCallable<{ cartaoId: string }, { ok: true }>(
      this.functions,
      'removerCartaoSalvo'
    );
    await removerCartaoSalvo({ cartaoId });
  }
}
