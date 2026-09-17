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
 * sempre sem etiqueta. Isso dá um jeito manual de tentar de novo.
 *
 * Só admin — é uma ação operacional/de "loja", não algo que o cliente final
 * deva poder disparar sozinho.
 */
export const retentarEtiqueta = onCall(
  { region: REGIAO, secrets: [melhorEnvioClientId, melhorEnvioClientSecret] },
  async (request): Promise<{ sucesso: boolean }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É preciso estar logado.');
    }

    const usuarioSnap = await db.collection('usuarios').doc(request.auth.uid).get();
    const permissoes = (usuarioSnap.data()?.['permissoes'] as string[] | undefined) ?? [];
    if (!permissoes.includes('admin')) {
      throw new HttpsError('permission-denied', 'Só administradores podem reprocessar etiquetas.');
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
