/**
 * DTO (Data Transfer Object) para usuarios
 * Representa a estrutura de dados dos usuários no Firestore
 * Linked com o userId do Firebase Authentication
 */

export interface JogoAdquirido {
  produtoId: string;
  nome: string;
  dataCompra: string; // ISO
  compraId: string;
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
  // Campos legados, compartilhados com outro sistema que usa o mesmo banco.
  // Preservados por compatibilidade — não geridos por este projeto.
  permissoes?: string[];
  partidaEmAndamento?: string;
  partidas: string[];
}
