import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Customer } from 'mercadopago';
import { db } from '../admin';
import { mercadoPagoAccessToken } from '../secrets';
import { obterClienteMercadoPago } from './mercado-pago-client';
import { REGIAO } from '../regiao';

export interface CartaoSalvoResposta {
  id: string;
  primeirosDigitos: string;
  ultimosDigitos: string;
  bandeira: string;
  paymentMethodId: string;
  mesValidade: number;
  anoValidade: number;
}

/**
 * Cartões salvos vivem do lado do Mercado Pago, associados a um
 * "customer" — o Firestore só guarda a referência (usuarios/{uid}.
 * mercadoPagoCustomerId) pra não duplicar cliente a cada compra.
 */
async function obterOuCriarCustomerId(uid: string, email: string, accessToken: string): Promise<string> {
  const docUsuario = db.collection('usuarios').doc(uid);
  const snap = await docUsuario.get();
  const existente = snap.data()?.['mercadoPagoCustomerId'] as string | undefined;
  if (existente) {
    return existente;
  }

  const customer = new Customer(obterClienteMercadoPago(accessToken));

  // Reaproveita um customer já existente com esse e-mail (ex.: criado numa
  // tentativa anterior que não chegou a salvar o id) antes de criar outro.
  const busca = await customer.search({ options: { email } });
  const encontrado = busca.results?.[0]?.id;
  const customerId = encontrado ?? (await customer.create({ body: { email } })).id;

  if (!customerId) {
    throw new HttpsError('internal', 'Não foi possível criar o cliente no Mercado Pago.');
  }

  await docUsuario.update({ mercadoPagoCustomerId: customerId });
  return customerId;
}

function mapearCartao(cartao: {
  id?: string;
  first_six_digits?: string;
  last_four_digits?: string;
  payment_method?: { id?: string; name?: string };
  expiration_month?: number;
  expiration_year?: number;
}): CartaoSalvoResposta {
  return {
    id: cartao.id ?? '',
    primeirosDigitos: cartao.first_six_digits ?? '',
    ultimosDigitos: cartao.last_four_digits ?? '',
    bandeira: cartao.payment_method?.name ?? '',
    paymentMethodId: cartao.payment_method?.id ?? '',
    mesValidade: cartao.expiration_month ?? 0,
    anoValidade: cartao.expiration_year ?? 0
  };
}

export const listarCartoesSalvos = onCall(
  { region: REGIAO, secrets: [mercadoPagoAccessToken] },
  async (request): Promise<CartaoSalvoResposta[]> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É preciso estar logado.');
    }

    // Nunca cria customer só de listar — evita customer vazio pra quem
    // nunca salvou um cartão.
    const snap = await db.collection('usuarios').doc(request.auth.uid).get();
    const customerId = snap.data()?.['mercadoPagoCustomerId'] as string | undefined;
    if (!customerId) {
      return [];
    }

    const customer = new Customer(obterClienteMercadoPago(mercadoPagoAccessToken.value()));
    const cartoes = await customer.listCards({ customerId });
    return cartoes.map(mapearCartao);
  }
);

export const salvarCartaoSalvo = onCall(
  { region: REGIAO, secrets: [mercadoPagoAccessToken] },
  async (request): Promise<CartaoSalvoResposta> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É preciso estar logado.');
    }
    const { cardToken } = request.data as { cardToken?: string };
    if (!cardToken) {
      throw new HttpsError('invalid-argument', 'Token do cartão não informado.');
    }
    const email = request.auth.token.email;
    if (!email) {
      throw new HttpsError('failed-precondition', 'Conta sem e-mail associado.');
    }

    const customerId = await obterOuCriarCustomerId(request.auth.uid, email, mercadoPagoAccessToken.value());
    const customer = new Customer(obterClienteMercadoPago(mercadoPagoAccessToken.value()));
    const cartao = await customer.createCard({ customerId, body: { token: cardToken } });
    return mapearCartao(cartao);
  }
);

export const removerCartaoSalvo = onCall(
  { region: REGIAO, secrets: [mercadoPagoAccessToken] },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É preciso estar logado.');
    }
    const { cartaoId } = request.data as { cartaoId?: string };
    if (!cartaoId) {
      throw new HttpsError('invalid-argument', 'Cartão não informado.');
    }

    const snap = await db.collection('usuarios').doc(request.auth.uid).get();
    const customerId = snap.data()?.['mercadoPagoCustomerId'] as string | undefined;
    if (!customerId) {
      throw new HttpsError('not-found', 'Nenhum cartão salvo pra esse usuário.');
    }

    const customer = new Customer(obterClienteMercadoPago(mercadoPagoAccessToken.value()));
    await customer.removeCard({ customerId, cardId: cartaoId });
    return { ok: true };
  }
);
