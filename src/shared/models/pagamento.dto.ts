import { ItemFreteEntrada } from './frete.dto';

export type MetodoPagamento = 'pix' | 'cartao' | 'boleto';

export interface EntradaProcessarPagamento {
  itens: ItemFreteEntrada[];
  enderecoId: string;
  servicoIdEscolhido: number;
  metodo: MetodoPagamento;
  cpf: string;
  emailPagador: string;
  paymentMethodId?: string;
  cardToken?: string;
  parcelas?: number;
  issuerId?: number;
  cupomNome?: string;
}

export interface ResultadoProcessarPagamento {
  compraId: string;
  status: string;
  qrCode?: string;
  qrCodeBase64?: string;
  linkBoleto?: string;
}
