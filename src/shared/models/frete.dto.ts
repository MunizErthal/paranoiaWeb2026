export interface ItemFreteEntrada {
  produtoId: string;
  quantidade: number;
}

export interface OpcaoFrete {
  servicoId: number;
  servico: string;
  preco: number;
  prazoDias: number;
}
