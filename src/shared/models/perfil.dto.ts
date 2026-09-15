/**
 * DTO para o perfil de e-commerce do usuário (usuarios/{uid}/perfil/dados).
 * Separado de UsuarioDTO para manter o CPF fora da identidade básica —
 * é opcional até o checkout exigir (ver docs/planejamento/02-firestore-auth.md).
 */
export interface PerfilDTO {
  nomeCompleto?: string;
  cpf?: string;
  telefone?: string;
  dataNascimento?: string; // ISO
}
