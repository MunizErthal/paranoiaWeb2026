import { EnderecoDTO } from './endereco.dto';

export type StatusCompra =
  | 'aguardando_pagamento'
  | 'pago'
  | 'etiqueta_gerada'
  | 'enviado'
  | 'entregue'
  | 'cancelado'
  | 'recusado';

export interface ItemCompra {
  produtoId: string;
  nome: string;
  precoUnit: number;
  quantidade: number;
}

/**
 * Espelha functions/src/types.ts#CompraDTO — só leitura aqui, quem
 * escreve é sempre uma Cloud Function (ver firestore.rules).
 */
export interface CompraDTO {
  id: string;
  usuarioId: string;
  itens: ItemCompra[];
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
