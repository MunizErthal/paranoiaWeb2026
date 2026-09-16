import { db } from '../admin';
import { CompraDTO } from '../types';
import { dispararCompraEtiqueta } from '../envio/comprar-etiqueta';

/**
 * Efeitos colaterais de uma compra que virou "pago": marca os jogos como
 * adquiridos e dispara a compra da etiqueta. Chamado tanto no momento da
 * criação (pagamento já aprovado na hora, ex: cartão) quanto pelo webhook
 * (pagamento que muda de status depois, ex: PIX/boleto) — nunca os dois
 * para a mesma compra, ver comentário de idempotência no webhook.
 */
export async function processarCompraPaga(usuarioId: string, compraId: string, compra: CompraDTO): Promise<void> {
  await adicionarJogosAdquiridos(usuarioId, compraId, compra);
  await dispararCompraEtiqueta(compraId);
}

async function adicionarJogosAdquiridos(usuarioId: string, compraId: string, compra: CompraDTO): Promise<void> {
  const jogosAdquiridos = compra.itens.map(item => ({
    produtoId: item.produtoId,
    nome: item.nome,
    dataCompra: new Date().toISOString(),
    compraId
  }));

  const { FieldValue } = await import('firebase-admin/firestore');
  await db
    .collection('usuarios')
    .doc(usuarioId)
    .update({ jogosAdquiridos: FieldValue.arrayUnion(...jogosAdquiridos) });
}
