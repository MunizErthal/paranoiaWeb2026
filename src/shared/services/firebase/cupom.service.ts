import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FirebaseBaseService } from './firebase-base.service';
import { CupomDTO } from '../../models/cupom.dto';

const COLECAO = 'cupons';

/**
 * Service de leitura de cupons (coleção pública cupons/). Escrita fica de
 * fora de propósito: cupons só podem ser criados/editados por administração
 * direta (console/Cloud Function) — ver docs/planejamento/06-cupons.md.
 */
@Injectable({ providedIn: 'root' })
export class CupomService {
  constructor(private baseService: FirebaseBaseService) {}

  buscarPorNome(nome: string): Observable<CupomDTO | null> {
    return this.baseService
      .buscarPorCampo<CupomDTO>(COLECAO, 'nome', nome.trim().toUpperCase())
      .pipe(map(cupons => cupons[0] ?? null));
  }
}
