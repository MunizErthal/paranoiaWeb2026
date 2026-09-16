/**
 * DTO para produtos do catálogo (coleção produtos/, leitura pública).
 * Peso e dimensões são obrigatórios: sem eles não é possível cotar frete
 * (ver docs/planejamento/03-carrinho-pagamento-frete.md).
 */
export interface ProdutoDTO {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagemCapa: string; // foto de caixa cheia — loja e detalhe do jogo
  imagemEmblema: string; // logo/emblema — cartão em /jogos
  tags: string[];
  jogadores: string; // ex: "2-6"
  idade: string; // ex: "14+"
  duracao: string; // ex: "60-90 min"
  estoque: number;
  ativo: boolean;
  emBreve: boolean; // true bloqueia compra e mostra selo "Em breve"
  emPreVenda: boolean; // true mostra selo "Pré-venda" (mesma visualização do emBreve) mas permite comprar
  peso: number; // kg
  altura: number; // cm
  largura: number; // cm
  comprimento: number; // cm
  criadoEm: string;
}
