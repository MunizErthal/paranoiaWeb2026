import { logger } from 'firebase-functions';
import { db } from '../admin';
import { melhorEnvioClientId, melhorEnvioClientSecret } from '../secrets';
import {
  lojaCepOrigem,
  lojaNome,
  lojaDocumento,
  lojaEndereco,
  lojaNumero,
  lojaComplemento,
  lojaBairro,
  lojaCidade,
  lojaEstado
} from '../params';
import { obterTokenValido, chamarMelhorEnvio } from './melhor-envio-client';
import { CompraDTO } from '../types';

interface RespostaAdicionarCarrinho {
  id: string; // id do "order" dentro do carrinho do Melhor Envio
}

interface RespostaGerarEtiqueta {
  [orderId: string]: { status?: string; tracking?: string };
}

interface RespostaImprimirEtiqueta {
  url: string;
}

/**
 * Compra, gera e registra a etiqueta de uma compra já paga.
 *
 * NOTA: o contrato exato de resposta de cada etapa (cart → checkout →
 * generate → print) precisa ser confirmado no sandbox do Melhor Envio
 * antes do go-live — ver "Itens a validar em sandbox" no
 * docs/planejamento/03-carrinho-pagamento-frete.md. A estrutura abaixo
 * segue a documentação oficial, mas nomes de campo podem exigir ajuste.
 */
export async function dispararCompraEtiqueta(compraId: string): Promise<void> {
  const docCompra = db.collection('compras').doc(compraId);
  const compraSnap = await docCompra.get();
  if (!compraSnap.exists) {
    logger.error(`Compra ${compraId} não encontrada ao tentar gerar etiqueta.`);
    return;
  }

  const compra = compraSnap.data() as CompraDTO;

  try {
    const token = await obterTokenValido(melhorEnvioClientId.value(), melhorEnvioClientSecret.value());

    const usuarioSnap = await db.collection('usuarios').doc(compra.usuarioId).get();
    const nomeDestinatario = (usuarioSnap.data()?.['nome'] as string | undefined) || compra.enderecoEntrega.logradouro;

    // CPF não fica salvo no pedido em si — vem do perfil (mesmo lugar que o
    // checkout grava ao finalizar a compra). Cobre tanto pedidos novos
    // quanto os antigos que já estavam presos antes desse campo existir.
    const perfilSnap = await db.collection('usuarios').doc(compra.usuarioId).collection('perfil').doc('dados').get();
    const cpfDestinatario = (perfilSnap.data()?.['cpf'] as string | undefined)?.replace(/\D/g, '') ?? '';

    const carrinho = await chamarMelhorEnvio<RespostaAdicionarCarrinho>('/api/v2/me/cart', token, {
      method: 'POST',
      body: {
        service: compra.envio.servicoId,
        from: {
          name: lojaNome.value(),
          document: lojaDocumento.value(),
          postal_code: lojaCepOrigem.value(),
          address: lojaEndereco.value(),
          number: lojaNumero.value(),
          complement: lojaComplemento.value() || undefined,
          district: lojaBairro.value(),
          city: lojaCidade.value(),
          state_abbr: lojaEstado.value()
        },
        to: {
          name: nomeDestinatario,
          document: cpfDestinatario,
          postal_code: compra.enderecoEntrega.cep.replace(/\D/g, ''),
          address: compra.enderecoEntrega.logradouro,
          number: compra.enderecoEntrega.numero,
          complement: compra.enderecoEntrega.complemento ?? '',
          district: compra.enderecoEntrega.bairro,
          city: compra.enderecoEntrega.cidade,
          state_abbr: compra.enderecoEntrega.estado
        },
        products: compra.itens.map(item => ({
          name: item.nome,
          quantity: item.quantidade,
          unitary_value: item.precoUnit
        })),
        volumes: [{ height: 1, width: 1, length: 1, weight: 1 }] // TODO: usar dimensões reais somadas do pedido
      }
    });

    const orderId = carrinho.id;

    await chamarMelhorEnvio('/api/v2/me/shipment/checkout', token, {
      method: 'POST',
      body: { orders: [orderId] }
    });

    const geracao = await chamarMelhorEnvio<RespostaGerarEtiqueta>('/api/v2/me/shipment/generate', token, {
      method: 'POST',
      body: { orders: [orderId] }
    });

    const impressao = await chamarMelhorEnvio<RespostaImprimirEtiqueta>('/api/v2/me/shipment/print', token, {
      method: 'POST',
      body: { orders: [orderId], mode: 'private' }
    });

    await docCompra.update({
      status: 'etiqueta_gerada',
      'envio.melhorEnvioOrderId': orderId,
      'envio.codigoRastreio': geracao[orderId]?.tracking ?? null,
      'envio.urlEtiqueta': impressao.url,
      atualizadoEm: new Date().toISOString()
    });
  } catch (err) {
    logger.error(`Falha ao gerar etiqueta para a compra ${compraId}`, err);
    // Pedido continua "pago" — não falha silenciosamente como se a etiqueta existisse.
    // Fica pendente de retry manual/monitoramento até esse ponto ser validado em produção.
  }
}
