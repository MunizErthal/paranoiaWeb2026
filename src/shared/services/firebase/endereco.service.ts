import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { FirebaseBaseService } from './firebase-base.service';
import { EnderecoDTO } from '../../models/endereco.dto';

/**
 * Service para endereços de entrega (usuarios/{uid}/enderecos/{id}).
 */
@Injectable({ providedIn: 'root' })
export class EnderecoService {
  constructor(private baseService: FirebaseBaseService) {}

  listar(uid: string): Observable<EnderecoDTO[]> {
    return this.baseService.buscarComMultiplosConstrangimentosOuvindo<EnderecoDTO>(this.colecao(uid), []);
  }

  criar(uid: string, endereco: Omit<EnderecoDTO, 'id'>): Observable<string> {
    return this.baseService.criarSemId<Omit<EnderecoDTO, 'id'>>(this.colecao(uid), endereco);
  }

  atualizar(uid: string, enderecoId: string, dados: Partial<EnderecoDTO>): Observable<void> {
    return this.baseService.atualizar<EnderecoDTO>(this.colecao(uid), enderecoId, dados);
  }

  remover(uid: string, enderecoId: string): Observable<void> {
    return this.baseService.deletar(this.colecao(uid), enderecoId);
  }

  /**
   * Marca um endereço como padrão, desmarcando qualquer outro que já fosse.
   */
  async marcarComoPadrao(uid: string, enderecoId: string): Promise<void> {
    const enderecos = await firstValueFrom(this.listar(uid));

    await Promise.all(
      enderecos
        .filter(endereco => endereco.padrao && endereco.id !== enderecoId)
        .map(endereco => firstValueFrom(this.atualizar(uid, endereco.id, { padrao: false })))
    );

    await firstValueFrom(this.atualizar(uid, enderecoId, { padrao: true }));
  }

  private colecao(uid: string): string {
    return `usuarios/${uid}/enderecos`;
  }
}
