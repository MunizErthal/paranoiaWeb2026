import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { melhorEnvioClientId, melhorEnvioClientSecret } from '../secrets';
import { trocarCodigoPorToken, renovarToken } from './melhor-envio-client';
import { defineString } from 'firebase-functions/params';
import { REGIAO } from '../regiao';

/**
 * URL desta própria função, exatamente como cadastrada no app OAuth
 * criado no painel de parceiros do Melhor Envio.
 * Preencher depois de saber a URL definitiva do deploy.
 */
const melhorEnvioRedirectUri = defineString('MELHORENVIO_REDIRECT_URI', { default: '' });

/**
 * Callback do fluxo OAuth do Melhor Envio. Acessar
 * https://melhorenvio.com.br/oauth/authorize?...&redirect_uri=<esta URL>
 * uma única vez (manualmente, logado como dono da loja) para autorizar
 * o app — a partir daí o token é renovado sozinho.
 */
export const melhorEnvioOAuthCallback = onRequest(
  { region: REGIAO, secrets: [melhorEnvioClientId, melhorEnvioClientSecret] },
  async (req, res) => {
    const code = req.query['code'];

    if (typeof code !== 'string' || !code) {
      res.status(400).send('Parâmetro "code" ausente. Inicie o fluxo pelo painel do Melhor Envio.');
      return;
    }

    if (!melhorEnvioRedirectUri.value()) {
      res.status(500).send('MELHORENVIO_REDIRECT_URI não configurado.');
      return;
    }

    try {
      await trocarCodigoPorToken(
        code,
        melhorEnvioClientId.value(),
        melhorEnvioClientSecret.value(),
        melhorEnvioRedirectUri.value()
      );
      res.status(200).send('Melhor Envio autorizado com sucesso. Pode fechar esta janela.');
    } catch (err) {
      logger.error('Falha ao autorizar Melhor Envio', err);
      res.status(500).send('Falha ao autorizar. Veja os logs da função para detalhes.');
    }
  }
);

/**
 * Renova o token proativamente uma vez por semana, para nunca depender
 * de uma chamada de cliente acontecer perto da expiração.
 */
export const renovarTokenMelhorEnvio = onSchedule(
  { region: REGIAO, schedule: 'every monday 03:00', secrets: [melhorEnvioClientId, melhorEnvioClientSecret] },
  async () => {
    await renovarToken(melhorEnvioClientId.value(), melhorEnvioClientSecret.value());
  }
);
