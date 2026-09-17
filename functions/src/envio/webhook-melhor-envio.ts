import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '../admin';
import { melhorEnvioClientSecret } from '../secrets';
import { REGIAO } from '../regiao';

/**
 * Recebe atualizações de etiqueta/rastreio do Melhor Envio.
 *
 * NOTA: o formato exato do payload (nomes de campo do evento e do id do
 * pedido) precisa ser confirmado no sandbox antes do go-live — ver
 * "Itens a validar em sandbox" no MD 03. A assinatura (header
 * X-ME-Signature) é HMAC-SHA256 em base64 usando o client_secret do
 * próprio app como chave — não existe um secret de webhook separado
 * (confirmado em docs.melhorenvio.com.br/docs/webhooks).
 */
export const webhookMelhorEnvio = onRequest(
  { region: REGIAO, secrets: [melhorEnvioClientSecret] },
  async (req, res) => {
    if (!validarAssinatura(req)) {
      logger.warn('Webhook do Melhor Envio com assinatura inválida.');
      res.status(401).send('Assinatura inválida.');
      return;
    }

    const orderId: string | undefined = req.body?.data?.id ?? req.body?.order_id;
    const status: string | undefined = req.body?.data?.status ?? req.body?.status;
    const rastreio: string | undefined = req.body?.data?.tracking ?? req.body?.tracking;

    if (!orderId) {
      res.status(200).send('Sem order id — ignorado.');
      return;
    }

    const query = await db
      .collection('compras')
      .where('envio.melhorEnvioOrderId', '==', orderId)
      .limit(1)
      .get();

    if (query.empty) {
      logger.warn(`Nenhuma compra encontrada para o envio ${orderId}.`);
      res.status(200).send('Envio sem pedido correspondente.');
      return;
    }

    const atualizacao: Record<string, unknown> = { atualizadoEm: new Date().toISOString() };
    if (rastreio) {
      atualizacao['envio.codigoRastreio'] = rastreio;
    }
    if (status === 'posted' || status === 'shipped') {
      atualizacao['status'] = 'enviado';
    } else if (status === 'delivered') {
      atualizacao['status'] = 'entregue';
    }

    await query.docs[0].ref.update(atualizacao);
    res.status(200).send('OK');
  }
);

type RequisicaoComRawBody = import('express').Request & { rawBody?: Buffer };

function validarAssinatura(req: RequisicaoComRawBody): boolean {
  const assinatura = req.headers['x-me-signature'];
  if (typeof assinatura !== 'string' || !req.rawBody) {
    return false;
  }

  const esperado = createHmac('sha256', melhorEnvioClientSecret.value())
    .update(req.rawBody)
    .digest('base64');

  const bufferEsperado = Buffer.from(esperado, 'base64');
  const bufferRecebido = Buffer.from(assinatura, 'base64');

  return bufferEsperado.length === bufferRecebido.length && timingSafeEqual(bufferEsperado, bufferRecebido);
}
