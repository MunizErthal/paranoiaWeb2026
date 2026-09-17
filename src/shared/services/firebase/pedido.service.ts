import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { FirebaseBaseService } from './firebase-base.service';
import { CompraDTO } from '../../models/compra.dto';

const COLECAO = 'compras';

/**
 * Leitura dos pedidos do usuário (compras/, filtrado por usuarioId).
 * Escrita é sempre de Cloud Function — ver firestore.rules.
 */
@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly functions = inject(Functions);

  constructor(private baseService: FirebaseBaseService) {}

  listarDoUsuarioOuvindo(uid: string): Observable<CompraDTO[]> {
    return this.baseService.buscarPorCampoOuvindo<CompraDTO>(COLECAO, 'usuarioId', uid);
  }

  buscarPorId(id: string): Observable<CompraDTO | null> {
    return this.baseService.buscarPorId<CompraDTO>(COLECAO, id);
  }

  /** Acompanha o status de uma compra em tempo real — usado na tela de
   *  checkout pra avisar assim que o pagamento (Pix/boleto) for confirmado,
   *  sem precisar dar refresh. */
  ouvirCompra(id: string): Observable<CompraDTO | null> {
    return this.baseService.buscarPorIdOuvindo<CompraDTO>(COLECAO, id);
  }

  /** Reprocessa a geração de etiqueta de uma compra paga — a geração
   *  automática não tem retry, então isso cobre o caso de ela ter falhado
   *  (ex.: token do Melhor Envio sem escopo, saldo insuficiente etc.). */
  async retentarEtiqueta(compraId: string): Promise<boolean> {
    const retentar = httpsCallable<{ compraId: string }, { sucesso: boolean }>(
      this.functions,
      'retentarEtiqueta'
    );
    const resultado = await retentar({ compraId });
    return resultado.data.sucesso;
  }
}
