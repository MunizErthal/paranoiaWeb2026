/**
 * DTO para endereços de entrega (usuarios/{uid}/enderecos/{id}).
 */
export interface EnderecoDTO {
  id: string;
  apelido?: string; // "Casa", "Trabalho"
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  padrao: boolean;
}
