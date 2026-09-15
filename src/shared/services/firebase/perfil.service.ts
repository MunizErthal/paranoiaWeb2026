import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FirebaseBaseService } from './firebase-base.service';
import { PerfilDTO } from '../../models/perfil.dto';

const DOC_ID = 'dados';

/**
 * Service para o perfil de e-commerce do usuário (usuarios/{uid}/perfil/dados).
 */
@Injectable({ providedIn: 'root' })
export class PerfilService {
  constructor(private baseService: FirebaseBaseService) {}

  buscar(uid: string): Observable<PerfilDTO | null> {
    return this.baseService.buscarPorId<PerfilDTO>(this.colecao(uid), DOC_ID);
  }

  salvar(uid: string, dados: Partial<PerfilDTO>): Observable<void> {
    return this.baseService.salvarComMerge<PerfilDTO>(this.colecao(uid), DOC_ID, dados);
  }

  private colecao(uid: string): string {
    return `usuarios/${uid}/perfil`;
  }
}
