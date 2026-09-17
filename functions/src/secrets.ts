import { defineSecret } from 'firebase-functions/params';

/**
 * Segredos configurados via Secret Manager (nunca no código nem no client).
 * Definir os valores reais quando as contas existirem:
 *   firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
 *   firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
 *   firebase functions:secrets:set MELHORENVIO_CLIENT_ID
 *   firebase functions:secrets:set MELHORENVIO_CLIENT_SECRET
 *
 * Não existe MELHORENVIO_WEBHOOK_SECRET: a assinatura do webhook do
 * Melhor Envio usa o próprio MELHORENVIO_CLIENT_SECRET como chave HMAC
 * (docs.melhorenvio.com.br/docs/webhooks).
 */
export const mercadoPagoAccessToken = defineSecret('MERCADOPAGO_ACCESS_TOKEN');
export const mercadoPagoWebhookSecret = defineSecret('MERCADOPAGO_WEBHOOK_SECRET');
export const melhorEnvioClientId = defineSecret('MELHORENVIO_CLIENT_ID');
export const melhorEnvioClientSecret = defineSecret('MELHORENVIO_CLIENT_SECRET');
