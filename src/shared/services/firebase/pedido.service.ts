import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FirebaseBaseService } from './firebase-base.service';
import { CompraDTO } from '../../models/compra.dto';

const COLECAO = 'compras';

/**
 * Leitura dos pedidos do usuário (compras/, filtrado por usuarioId).
 * Escrita é sempre de Cloud Function — ver firestore.rules.
 */
@Injectable({ providedIn: 'root' })
export class PedidoService {
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
}
