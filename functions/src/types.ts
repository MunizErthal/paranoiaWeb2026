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
