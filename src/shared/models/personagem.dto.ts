/**
 * DTO (Data Transfer Object) para personagens
 * Representa a estrutura de dados dos personagens no Firestore
 * (topsecrets/A_CIDADE_SUBMERSA/personagens)
 */

export interface PersonagemDTO {
  id: string;
  nome: string;
  placas?: string[]; // Placas associadas ao personagem
  buscavelPor?: string[]; // Termos usados para busca (nome em lowercase, apelidos, etc)
  criadoEm?: Date;
}
