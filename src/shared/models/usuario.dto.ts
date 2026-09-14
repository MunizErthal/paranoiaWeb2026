/**
 * DTO (Data Transfer Object) para usuarios
 * Representa a estrutura de dados dos usuários no Firestore
 * Linked com o userId do Firebase Authentication
 */

export interface UsuarioDTO {
  id: string; // Mesmo ID do usuário no Firebase Authentication
  email: string;
  nome?: string;
  idade?: number;
  foto?: string;
  criadoEm: Date;
  ultimoLoginEm?: Date;
  ativo: boolean;
  permissoes?: string[];
  partidaEmAndamento?: string; // ID da partida em andamento, se houver
  partidas: string[]; // IDs das partidas que o usuário participou
}
