export interface CartaoSalvoDTO {
  id: string;
  primeirosDigitos: string;
  ultimosDigitos: string;
  bandeira: string;
  paymentMethodId: string;
  mesValidade: number;
  anoValidade: number;
}

export interface OpcaoParcelamento {
  parcelas: number;
  valorParcela: number;
  valorTotal: number;
  issuerId: number;
  mensagem: string;
}
