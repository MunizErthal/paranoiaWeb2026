import { db } from '../admin';
import { melhorEnvioBaseUrl, melhorEnvioUserAgent } from '../params';

const DOC_TOKEN = db.collection('sistema').doc('melhorEnvio');

/** Margem de segurança antes de considerar o token expirado. */
const MARGEM_EXPIRACAO_MS = 5 * 60 * 1000;

interface TokenArmazenado {
  accessToken: string;
  refreshToken: string;
  expiraEm: string; // ISO
}

interface RespostaToken {
  access_token: string;
  refresh_token: string;
  expires_in: number; // segundos
}

/**
 * Troca o código OAuth pelo primeiro par de tokens e os salva.
 * Chamado uma única vez, pelo callback de autorização.
 */
export async function trocarCodigoPorToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<void> {
  const resposta = await fetch(`${melhorEnvioBaseUrl.value()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code
    })
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao trocar código por token: ${resposta.status} ${await resposta.text()}`);
  }

  const dados = (await resposta.json()) as RespostaToken;
  await salvarToken(dados);
}

async function salvarToken(dados: RespostaToken): Promise<void> {
  const expiraEm = new Date(Date.now() + dados.expires_in * 1000).toISOString();
  const token: TokenArmazenado = {
    accessToken: dados.access_token,
    refreshToken: dados.refresh_token,
    expiraEm
  };
  await DOC_TOKEN.set(token);
}

export async function renovarToken(clientId: string, clientSecret: string): Promise<string> {
  const doc = await DOC_TOKEN.get();
  const atual = doc.data() as TokenArmazenado | undefined;

  if (!atual) {
    throw new Error(
      'Nenhum token do Melhor Envio encontrado. É preciso autorizar o app uma vez (melhorEnvioOAuthCallback) antes de usar a API.'
    );
  }

  const resposta = await fetch(`${melhorEnvioBaseUrl.value()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: atual.refreshToken
    })
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao renovar token do Melhor Envio: ${resposta.status} ${await resposta.text()}`);
  }

  const dados = (await resposta.json()) as RespostaToken;
  await salvarToken(dados);
  return dados.access_token;
}

/**
 * Devolve um access token válido, renovando automaticamente se estiver
 * perto de expirar.
 */
export async function obterTokenValido(clientId: string, clientSecret: string): Promise<string> {
  const doc = await DOC_TOKEN.get();
  const atual = doc.data() as TokenArmazenado | undefined;

  if (!atual) {
    throw new Error(
      'Nenhum token do Melhor Envio encontrado. É preciso autorizar o app uma vez (melhorEnvioOAuthCallback) antes de usar a API.'
    );
  }

  const expiraEm = new Date(atual.expiraEm).getTime();
  if (expiraEm - Date.now() > MARGEM_EXPIRACAO_MS) {
    return atual.accessToken;
  }

  return renovarToken(clientId, clientSecret);
}

/**
 * Chamada genérica autenticada à API do Melhor Envio.
 */
export async function chamarMelhorEnvio<T>(
  caminho: string,
  token: string,
  opcoes: { method?: string; body?: unknown } = {}
): Promise<T> {
  const resposta = await fetch(`${melhorEnvioBaseUrl.value()}${caminho}`, {
    method: opcoes.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': melhorEnvioUserAgent.value()
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
  });

  if (!resposta.ok) {
    throw new Error(`Erro na API do Melhor Envio (${caminho}): ${resposta.status} ${await resposta.text()}`);
  }

  return (await resposta.json()) as T;
}
