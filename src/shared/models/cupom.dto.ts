export type TipoDeDesconto = 'PORCENTAGEM' | 'FRETE' | 'VALOR_FIXO';

export interface CriterioCupomDTO {
  produto: string; // produtoId, ou "TODOS" para o carrinho inteiro
}

/**
 * DTO para cupons de desconto (coleção cupons/, leitura pública, escrita só
 * por Cloud Function). O desconto exibido no carrinho é só preview — quem
 * decide de fato é processarPagamento, que relê este documento no servidor
 * (ver docs/planejamento/06-cupons.md).
 */
export interface CupomDTO {
  id: string;
  nome: string; // código, ex: "PARANOIA30" — sempre normalizado p/ maiúsculas
  tipoDeDesconto: TipoDeDesconto;
  descontoEmPercent?: number; // usado quando tipoDeDesconto === 'PORCENTAGEM'
  valorFixo?: number; // usado quando tipoDeDesconto === 'VALOR_FIXO'
  criterios: CriterioCupomDTO[];
  ativo: boolean;
  validoDe?: string; // ISO date
  validoAte?: string; // ISO date
  valorMinimoCarrinho?: number;
  limiteDeUsos?: number;
  usosTotais: number;
  criadoEm: string;
}
