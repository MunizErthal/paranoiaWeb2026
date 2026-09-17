import { EnderecoDTO } from './endereco.dto';
import { TipoDeDesconto } from './cupom.dto';

export type StatusCompra =
  | 'aguardando_pagamento'
  | 'pago'
  | 'etiqueta_gerada'
  | 'enviado'
  | 'problema_na_entrega'
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
    transportadora: string;
    prazoDias: number;
    melhorEnvioOrderId?: string;
    codigoRastreio?: string;
    urlEtiqueta?: string;
  };
  enderecoEntrega: EnderecoDTO;
  criadoEm: string;
  atualizadoEm: string;
}
