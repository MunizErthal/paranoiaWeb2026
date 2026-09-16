/**
 * Formatos compartilhados com o app Angular (src/shared/models/*.dto.ts).
 * Duplicados aqui de propósito: Functions e Angular são projetos TypeScript
 * separados, sem build compartilhado — manter os dois em sincronia manual
 * é mais simples do que introduzir um monorepo só para isso.
 */

export interface ProdutoDTO {
  id: string;
  nome: string;
  preco: number;
  estoque: number;
  ativo: boolean;
  emBreve: boolean;
  emPreVenda: boolean;
  peso: number;
  altura: number;
  largura: number;
  comprimento: number;
}

export interface EnderecoDTO {
  id: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface ItemCarrinhoEntrada {
  produtoId: string;
  quantidade: number;
}

export type TipoDeDesconto = 'PORCENTAGEM' | 'FRETE' | 'VALOR_FIXO';

export interface CriterioCupomDTO {
  produto: string; // produtoId, ou "TODOS" para o carrinho inteiro
}

export interface CupomDTO {
  id: string;
  nome: string;
  tipoDeDesconto: TipoDeDesconto;
  descontoEmPercent?: number;
  valorFixo?: number;
  criterios: CriterioCupomDTO[];
  ativo: boolean;
  validoDe?: string;
  validoAte?: string;
  valorMinimoCarrinho?: number;
  limiteDeUsos?: number;
  usosTotais: number;
  criadoEm: string;
}

export type StatusCompra =
  | 'aguardando_pagamento'
  | 'pago'
  | 'etiqueta_gerada'
  | 'enviado'
  | 'entregue'
  | 'cancelado'
  | 'recusado';

export interface CompraDTO {
  usuarioId: string;
  itens: { produtoId: string; nome: string; precoUnit: number; quantidade: number }[];
  valorProdutos: number;
  valorFrete: number;
  valorTotal: number;
  cupomAplicado: {
    id: string;
    nome: string;
    tipoDeDesconto: TipoDeDesconto;
    valorDescontoProdutos: number;
    valorDescontoFrete: number;
  } | null;
  status: StatusCompra;
  pagamento: {
    mercadoPagoId: string;
    metodo: 'pix' | 'cartao' | 'boleto';
    status: string;
  };
  envio: {
    servicoId: number;
    servico: string;
    prazoDias: number;
    melhorEnvioOrderId?: string;
    codigoRastreio?: string;
    urlEtiqueta?: string;
  };
  enderecoEntrega: EnderecoDTO;
  criadoEm: string;
  atualizadoEm: string;
}
