import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FirebaseBaseService } from './firebase-base.service';
import { CarrinhoDTO, ItemCarrinho } from '../../models/carrinho.dto';

const DOC_ID = 'atual';

/**
 * Espelho do carrinho no Firestore (usuarios/{uid}/carrinho/atual) —
 * só para continuidade entre dispositivos. A fonte de verdade em uso
 * é sempre o CarrinhoStore (memória + localStorage).
 */
@Injectable({ providedIn: 'root' })
export class CarrinhoService {
  constructor(private baseService: FirebaseBaseService) {}

  buscarItens(uid: string): Observable<ItemCarrinho[]> {
    return this.baseService
      .buscarPorId<CarrinhoDTO>(this.colecao(uid), DOC_ID)
      .pipe(map(carrinho => carrinho?.itens ?? []));
  }

  salvar(uid: string, itens: ItemCarrinho[]): Observable<void> {
    const dados: CarrinhoDTO = { itens, atualizadoEm: new Date().toISOString() };
    return this.baseService.salvarComMerge<CarrinhoDTO>(this.colecao(uid), DOC_ID, dados);
  }

  private colecao(uid: string): string {
    return `usuarios/${uid}/carrinho`;
  }
}
