import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { melhorEnvioClientId, melhorEnvioClientSecret } from '../secrets';
import { lojaCepOrigem } from '../params';
import { obterTokenValido, chamarMelhorEnvio } from '../envio/melhor-envio-client';
import { buscarItensComProduto } from '../produtos';
import { ItemCarrinhoEntrada } from '../types';
import { REGIAO } from '../regiao';

interface ProdutoCalculo {
  id: string;
  width: number;
  height: number;
  length: number;
  weight: number;
  insurance_value: number;
  quantity: number;
}

interface OpcaoFreteResposta {
  id: number;
  name: string;
  price: string;
  delivery_time: number;
  company?: { id: number; name: string; picture?: string };
  error?: string;
}

export interface OpcaoFrete {
  servicoId: number;
  servico: string;
  transportadora: string;
  preco: number;
  prazoDias: number;
}

const CEP_REGEX = /^\d{8}$/;

/**
 * Cota o frete para um carrinho + CEP de destino. Extraída da Cloud
 * Function para poder ser reaproveitada por processarPagamento, que
 * precisa reconferir o valor do frete escolhido antes de cobrar.
 */
export async function calcularOpcoesFrete(
  itens: ItemCarrinhoEntrada[],
  cepDestino: string
): Promise<OpcaoFrete[]> {
  const cepLimpo = (cepDestino ?? '').replace(/\D/g, '');

  if (!itens?.length) {
    throw new HttpsError('invalid-argument', 'O carrinho está vazio.');
  }
  if (!CEP_REGEX.test(cepLimpo)) {
    throw new HttpsError('invalid-argument', 'CEP de destino inválido.');
  }
  if (!lojaCepOrigem.value()) {
    throw new HttpsError(
      'failed-precondition',
      'CEP de origem da loja ainda não foi configurado (LOJA_CEP_ORIGEM).'
    );
  }

  const itensComProduto = await buscarItensComProduto(itens);
  const produtos: ProdutoCalculo[] = itensComProduto.map(({ produto, quantidade }) => ({
    id: produto.id,
    width: produto.largura,
    height: produto.altura,
    length: produto.comprimento,
    weight: produto.peso,
    insurance_value: produto.preco,
    quantity: quantidade
  }));

  const token = await obterTokenValido(melhorEnvioClientId.value(), melhorEnvioClientSecret.value());

  const resposta = await chamarMelhorEnvio<OpcaoFreteResposta[] | OpcaoFreteResposta>('/api/v2/me/shipment/calculate', token, {
    method: 'POST',
    body: {
      from: { postal_code: lojaCepOrigem.value() },
      to: { postal_code: cepLimpo },
      products: produtos
    }
  });

  // Quando só existe uma transportadora elegível para a rota e ela dá erro
  // (ex.: "Transportadora não atende este trecho"), a API devolve um único
  // objeto em vez de um array — normaliza antes de filtrar/mapear.
  const opcoes = Array.isArray(resposta) ? resposta : [resposta];

  return opcoes
    .filter(opcao => !opcao.error)
    .map(opcao => ({
      servicoId: opcao.id,
      servico: opcao.name,
      transportadora: opcao.company?.name ?? '',
      preco: Number(opcao.price),
      prazoDias: opcao.delivery_time
    }));
}

export const cotarFrete = onCall(
  { region: REGIAO, secrets: [melhorEnvioClientId, melhorEnvioClientSecret] },
  async (request): Promise<OpcaoFrete[]> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É preciso estar logado para calcular o frete.');
    }

    const { itens, cepDestino } = request.data as { itens: ItemCarrinhoEntrada[]; cepDestino: string };
    return calcularOpcoesFrete(itens, cepDestino);
  }
);
