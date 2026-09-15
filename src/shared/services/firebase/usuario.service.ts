import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FirebaseBaseService } from './firebase-base.service';
import { UsuarioDTO } from '../../models/usuario.dto';
import { doc, updateDoc, arrayUnion, Firestore } from '@angular/fire/firestore';

/**
 * Service para gerenciar usuários
 * Gerencia operações CRUD na coleção de usuários
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly COLECAO = 'usuarios';

  constructor(
    private baseService: FirebaseBaseService,
    private firestore: Firestore
  ) {}

  /**
   * Busca um usuário pelo ID (mesmo ID do Firebase Auth)
   * @param uid - ID do usuário no Firebase Authentication
   * @returns Observable com os dados do usuário ou null
   */
  buscarPorId(uid: string): Observable<UsuarioDTO | null> {
    return this.baseService.buscarPorId<UsuarioDTO>(this.COLECAO, uid);
  }

  /**
   * Busca um usuário pelo email
   * @param email - Email do usuário
   * @returns Observable com array de usuários encontrados
   */
  buscarPorEmail(email: string): Observable<UsuarioDTO[]> {
    return this.baseService.buscarPorCampo<UsuarioDTO>(
      this.COLECAO,
      'email',
      email
    );
  }

  /**
   * Cria um novo usuário (normalmente chamado no primeiro login)
   * @param uid - ID do usuário no Firebase Authentication
   * @param email - Email do usuário
   * @param nome - Nome do usuário (opcional)
   * @param foto - URL da foto do usuário (opcional)
   * @returns Promise<void>
   */
  criarUsuario(
    uid: string,
    email: string,
    nome?: string,
    foto?: string
  ): Promise<string> {
    const usuarioNovoDTO: any = {
      id: uid,
      email,
      nome,
      foto,
      criadoEm: new Date()?.toISOString(),
      ultimoLoginEm: new Date()?.toISOString(),
      ativo: false,
      permissoes: ['usuario'], // Permissão padrão
      partidas: [],
      partidaEmAndamento: ''
    };

    return new Promise((resolve, reject) => {
      this.baseService.criar<UsuarioDTO>(this.COLECAO, uid, usuarioNovoDTO).subscribe({
        next: (usuarioId: string) => {
          resolve(usuarioId);
        },
        error: (err) => reject(err)
      });
    });
  }

  /**
   * Atualiza a data do último login do usuário
   * @param uid - ID do usuário
   * @returns Promise<void>
   */
  atualizarUltimoLogin(uid: string): Promise<void> {
    return updateDoc(doc(this.firestore, this.COLECAO, uid), {
      ultimoLoginEm: new Date().toISOString()
    });
  }

  /**
   * Atualiza informações do usuário
   * @param uid - ID do usuário
   * @param dados - Dados a atualizar
   * @returns Promise<void>
   */
  atualizarUsuario(uid: string, dados: Partial<UsuarioDTO>, novaPartida: string): Promise<void> {
    const dadosAtualizacao: any = { ...dados };
    
    // Converter datas para string se existirem
    if (dados.criadoEm && dados.criadoEm instanceof Date) {
      dadosAtualizacao.criadoEm = dados.criadoEm.toISOString();
    }
    if (dados.ultimoLoginEm && dados.ultimoLoginEm instanceof Date) {
      dadosAtualizacao.ultimoLoginEm = dados.ultimoLoginEm.toISOString();
    }

    // 🔥 Aqui está o ponto importante
    if (novaPartida) {
        dadosAtualizacao.partidas = arrayUnion(novaPartida);
    }

    return updateDoc(doc(this.firestore, this.COLECAO, uid), dadosAtualizacao);
  }

  /**
   * Desativa um usuário (soft delete)
   * @param uid - ID do usuário
   * @returns Promise<void>
   */
  desativarUsuario(uid: string): Promise<void> {
    return updateDoc(doc(this.firestore, this.COLECAO, uid), {
      ativo: false
    });
  }
}
