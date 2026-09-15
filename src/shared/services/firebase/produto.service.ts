import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FirebaseBaseService } from './firebase-base.service';
import { ProdutoDTO } from '../../models/produto.dto';

const COLECAO = 'produtos';

/**
 * Service de leitura do catálogo (coleção pública produtos/).
 * Escrita fica de fora de propósito: preço e estoque só podem ser
 * alterados por administração direta (console/Cloud Function), nunca
 * pelo cliente — ver regras em docs/planejamento/02-firestore-auth.md.
 */
@Injectable({ providedIn: 'root' })
export class ProdutoService {
  constructor(private baseService: FirebaseBaseService) {}

  listarAtivos(): Observable<ProdutoDTO[]> {
    return this.baseService.buscarPorCampo<ProdutoDTO>(COLECAO, 'ativo', true);
  }

  buscarPorId(id: string): Observable<ProdutoDTO | null> {
    return this.baseService.buscarPorId<ProdutoDTO>(COLECAO, id);
  }
}
