import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FirebaseBaseService } from './firebase-base.service';
import { PersonagemDTO } from '../../models/personagem.dto';

/**
 * Service específico para a coleção Evidencias (A_CIDADE_SUBMERSA/evidencias)
 * Gerencia documentos como NECROTERIO, ESCRITORIO_ARMITAGE, etc
 * Herda do FirebaseBaseService e adiciona lógica específica do domínio
 */
@Injectable({ providedIn: 'root' })
export class PersonagensService {
  private readonly COLECAO = 'topsecrets/A_CIDADE_SUBMERSA/personagens';

  constructor(private baseService: FirebaseBaseService) {}

  /**
   * Busca Local por código (campo dentro do documento)
   * @param codigo - Código do Local
   * @returns Observable com array contendo o(s) Local(is) encontrado(s)
   */
  buscarPorNome(nome: string): Observable<PersonagemDTO[]> {
    return this.baseService.buscarPorBuscaveis<PersonagemDTO>(
      this.COLECAO,
      nome.toLowerCase()
    );
  }

  buscarPorPlaca(placa: string): Observable<PersonagemDTO[]> {
    return this.baseService.buscarPersonagemPorPlaca(placa.toUpperCase(), this.COLECAO);
  }
}
