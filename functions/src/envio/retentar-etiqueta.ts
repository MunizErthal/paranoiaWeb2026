import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../admin';
import { melhorEnvioClientId, melhorEnvioClientSecret } from '../secrets';
import { dispararCompraEtiqueta } from './comprar-etiqueta';
import { CompraDTO } from '../types';
import { REGIAO } from '../regiao';

/**
 * Reprocessa a geração de etiqueta de uma compra já paga. A geração
 * automática (disparada pelo webhook do Mercado Pago) não tem retry — se
 * falhar (ex.: token do Melhor Envio sem escopo), o pedido fica "pago" pra
 * sempre sem etiqueta. Isso dá um botão manual pra tentar de novo.
 */
export const retentarEtiqueta = onCall(
  { region: REGIAO, secrets: [melhorEnvioClientId, melhorEnvioClientSecret] },
  async (request): Promise<{ sucesso: boolean }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É preciso estar logado.');
    }
    const { compraId } = request.data as { compraId?: string };
    if (!compraId) {
      throw new HttpsError('invalid-argument', 'Compra não informada.');
    }

    const snap = await db.collection('compras').doc(compraId).get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Compra não encontrada.');
    }
    const compra = snap.data() as CompraDTO;
    if (compra.usuarioId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Essa compra não pertence a você.');
    }
    if (compra.status !== 'pago') {
      throw new HttpsError(
        'failed-precondition',
        `Só é possível reprocessar etiqueta de compras pagas (status atual: ${compra.status}).`
      );
    }

    await dispararCompraEtiqueta(compraId);

    // dispararCompraEtiqueta engole os próprios erros (loga e segue), então
    // a única forma de saber se deu certo é reconferir o status depois.
    const snapDepois = await db.collection('compras').doc(compraId).get();
    const sucesso = (snapDepois.data() as CompraDTO | undefined)?.status === 'etiqueta_gerada';
    return { sucesso };
  }
);
