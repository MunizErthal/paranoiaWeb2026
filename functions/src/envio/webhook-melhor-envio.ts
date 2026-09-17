import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '../admin';
import { melhorEnvioClientSecret } from '../secrets';
import { REGIAO } from '../regiao';

/**
 * Recebe atualizações de etiqueta/rastreio do Melhor Envio.
 *
 * O payload real (confirmado em docs.melhorenvio.com.br/docs/webhooks) traz
 * o tipo do evento no campo "event" ("order.posted", "order.delivered" etc.)
 * — não existe evento de "saiu para entrega", a progressão vai direto de
 * postado pra entregue. A assinatura (header X-ME-Signature) é HMAC-SHA256
 * em base64 usando o client_secret do próprio app como chave — não existe
 * um secret de webhook separado.
 */
const EVENTOS_PROBLEMA = new Set(['order.undelivered', 'order.paused', 'order.suspended']);

export const webhookMelhorEnvio = onRequest(
  { region: REGIAO, secrets: [melhorEnvioClientSecret] },
  async (req, res) => {
    if (!validarAssinatura(req)) {
      logger.warn('Webhook do Melhor Envio com assinatura inválida.');
      res.status(401).send('Assinatura inválida.');
      return;
    }

    const evento: string | undefined = req.body?.event;
    const orderId: string | undefined = req.body?.data?.id;
    const rastreio: string | undefined = req.body?.data?.tracking ?? undefined;

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
    if (evento === 'order.posted') {
      atualizacao['status'] = 'enviado';
    } else if (evento === 'order.delivered') {
      atualizacao['status'] = 'entregue';
    } else if (evento === 'order.cancelled') {
      atualizacao['status'] = 'cancelado';
    } else if (evento && EVENTOS_PROBLEMA.has(evento)) {
      atualizacao['status'] = 'problema_na_entrega';
      logger.warn(`Problema na entrega do pedido ${query.docs[0].id} (evento ${evento}).`);
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
