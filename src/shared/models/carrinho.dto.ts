/**
 * Item do carrinho. Guarda uma cópia dos dados de exibição do produto no
 * momento em que foi adicionado — o preço cobrado de fato é sempre
 * recalculado no servidor no momento do pagamento (ver MD 03), nunca
 * confiado ao que está aqui.
 */
export interface ItemCarrinho {
  produtoId: string;
  nome: string;
  precoUnit: number;
  imagemCapa: string;
  imagemEmblema: string;
  quantidade: number;
}

/**
 * Espelho do carrinho no Firestore (usuarios/{uid}/carrinho/atual),
 * usado só para continuar a compra em outro dispositivo.
 */
export interface CarrinhoDTO {
  itens: ItemCarrinho[];
  atualizadoEm: string;
}
