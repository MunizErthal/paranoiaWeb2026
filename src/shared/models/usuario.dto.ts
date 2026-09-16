/**
 * DTO (Data Transfer Object) para usuarios
 * Representa a estrutura de dados dos usuários no Firestore
 * Linked com o userId do Firebase Authentication
 */

import { Timestamp } from '@angular/fire/firestore';

export interface JogoAdquirido {
  produtoId: string;
  nome: string;
  dataCompra: string; // ISO
  compraId: string;
}

/**
 * Registro de uma partida concluída, escrito pelo sistema do jogo físico/app
 * (outro sistema que compartilha este banco) — iniciadoEm/finalizadoEm
 * chegam como Timestamp do Firestore, não como string ISO.
 */
export interface PartidaFinalizada {
  jogoId: string; // corresponde a ProdutoDTO.id
  iniciadoEm: Timestamp;
  finalizadoEm: Timestamp;
  tempoTotalDeJogo: number; // horas
}

export interface UsuarioDTO {
  id: string; // Mesmo ID do usuário no Firebase Authentication
  email: string;
  nome?: string;
  foto?: string;
  criadoEm: Date;
  ultimoLoginEm?: Date;
  ativo: boolean;
  jogosAdquiridos?: JogoAdquirido[]; // escrito só por Cloud Function
  partidasFinalizadas?: PartidaFinalizada[]; // escrito pelo sistema do jogo
  // Campos legados, compartilhados com outro sistema que usa o mesmo banco.
  // Preservados por compatibilidade — não geridos por este projeto.
  permissoes?: string[];
  partidaEmAndamento?: string;
  partidas: string[];
}
