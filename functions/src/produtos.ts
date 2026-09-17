import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import { ItemCarrinhoEntrada, ProdutoDTO } from './types';

export interface ItemComProduto {
  produto: ProdutoDTO;
  quantidade: number;
}

/**
 * Busca os produtos de um carrinho direto no Firestore — nunca confia em
 * nome/preço/peso vindos do cliente, só no produtoId + quantidade.
 */
export async function buscarItensComProduto(itens: ItemCarrinhoEntrada[]): Promise<ItemComProduto[]> {
  if (!itens?.length) {
    throw new HttpsError('invalid-argument', 'O carrinho está vazio.');
  }

  const documentos = await db.getAll(
    ...itens.map(item => db.collection('produtos').doc(item.produtoId))
  );

  return documentos.map((doc, indice) => {
    if (!doc.exists) {
      throw new HttpsError('not-found', `Produto ${itens[indice].produtoId} não encontrado.`);
    }

    // doc.data() não inclui o id do documento — sem isso, produto.id fica
    // undefined e quebra a escrita da compra no Firestore mais adiante.
    const produto = { ...(doc.data() as ProdutoDTO), id: doc.id };
    if (!produto.ativo) {
      throw new HttpsError('failed-precondition', `Produto ${produto.nome} não está mais disponível.`);
    }
    if (produto.emBreve) {
      throw new HttpsError('failed-precondition', `Produto ${produto.nome} ainda não está disponível para compra.`);
    }
    if (produto.estoque < itens[indice].quantidade) {
      throw new HttpsError('failed-precondition', `Estoque insuficiente para ${produto.nome}.`);
    }

    return { produto, quantidade: itens[indice].quantidade };
  });
}
