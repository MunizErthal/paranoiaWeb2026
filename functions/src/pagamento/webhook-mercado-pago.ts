import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '../admin';
import { mercadoPagoAccessToken, mercadoPagoWebhookSecret } from '../secrets';
import { obterServicoPagamento, mapearStatusMercadoPago } from './mercado-pago-client';
import { CompraDTO } from '../types';
import { processarCompraPaga } from './pagamento-aprovado';
import { REGIAO } from '../regiao';

/**
 * Recebe notificações de pagamento do Mercado Pago. Nunca confia no
 * status que vem no corpo da notificação — só usa o id pra reconsultar
 * a API deles antes de marcar qualquer coisa como paga.
 */
export const webhookMercadoPago = onRequest(
  { region: REGIAO, secrets: [mercadoPagoAccessToken, mercadoPagoWebhookSecret] },
  async (req, res) => {
    if (!validarAssinatura(req)) {
      logger.warn('Webhook do Mercado Pago com assinatura inválida.');
      res.status(401).send('Assinatura inválida.');
      return;
    }

    const paymentId = req.body?.data?.id ?? req.query['data.id'];
    if (!paymentId) {
      res.status(200).send('Sem payment id — ignorado.');
      return;
    }

    try {
      const pagamentoService = obterServicoPagamento(mercadoPagoAccessToken.value());
      const pagamento = await pagamentoService.get({ id: String(paymentId) });
      const status = mapearStatusMercadoPago(pagamento.status ?? 'pending');

      const query = await db
        .collection('compras')
        .where('pagamento.mercadoPagoId', '==', String(paymentId))
        .limit(1)
        .get();

      if (query.empty) {
        logger.warn(`Nenhuma compra encontrada para o pagamento ${paymentId}.`);
        res.status(200).send('Pagamento sem pedido correspondente.');
        return;
      }

      const docCompra = query.docs[0];
      const compraAtual = docCompra.data() as CompraDTO;

      // Idempotência: se já processamos essa transição, não repete efeitos colaterais.
      if (compraAtual.status === status) {
        res.status(200).send('Sem mudança de status.');
        return;
      }

      await docCompra.ref.update({
        status,
        'pagamento.status': pagamento.status,
        atualizadoEm: new Date().toISOString()
      });

      if (status === 'pago') {
        await processarCompraPaga(compraAtual.usuarioId, docCompra.id, compraAtual);
      }

      res.status(200).send('OK');
    } catch (err) {
      logger.error('Falha ao processar webhook do Mercado Pago', err);
      res.status(500).send('Erro ao processar notificação.');
    }
  }
);

function validarAssinatura(req: import('express').Request): boolean {
  const assinatura = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  const dataId = req.query['data.id'] ?? req.body?.data?.id;

  if (typeof assinatura !== 'string' || typeof requestId !== 'string' || !dataId) {
    return false;
  }

  const partes = Object.fromEntries(
    assinatura.split(',').map(parte => {
      const [chave, valor] = parte.split('=');
      return [chave.trim(), valor?.trim()];
    })
  );

  const ts = partes['ts'];
  const v1 = partes['v1'];
  if (!ts || !v1) {
    return false;
  }

  const template = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const esperado = createHmac('sha256', mercadoPagoWebhookSecret.value()).update(template).digest('hex');

  const bufferEsperado = Buffer.from(esperado, 'utf8');
  const bufferRecebido = Buffer.from(v1, 'utf8');

  return bufferEsperado.length === bufferRecebido.length && timingSafeEqual(bufferEsperado, bufferRecebido);
}
