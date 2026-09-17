import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../admin';
import { mercadoPagoAccessToken, melhorEnvioClientId, melhorEnvioClientSecret } from '../secrets';
import { obterServicoPagamento, mapearStatusMercadoPago } from './mercado-pago-client';
import { processarCompraPaga } from './pagamento-aprovado';
import { calcularOpcoesFrete } from '../frete/cotar-frete';
import { buscarItensComProduto } from '../produtos';
import { calcularDesconto, validarCupom } from '../cupons/cupom.util';
import { cpfValido, limparCpf } from '../cpf.util';
import { CompraDTO, CupomDTO, EnderecoDTO, ItemCarrinhoEntrada, StatusCompra } from '../types';
import { REGIAO } from '../regiao';

type Metodo = 'pix' | 'cartao' | 'boleto';

/** Descontos percentuais e somas em ponto flutuante facilmente geram valores
 *  com mais de 2 casas decimais (ex.: 15% de R$1,89) — o Mercado Pago rejeita
 *  transaction_amount fora do padrão monetário com "Invalid transaction_amount". */
function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}

interface EntradaProcessarPagamento {
  itens: ItemCarrinhoEntrada[];
  enderecoId: string;
  servicoIdEscolhido: number;
  metodo: Metodo;
  cpf: string;
  emailPagador: string;
  paymentMethodId?: string; // obrigatório pra cartão/boleto (vem do SDK do MP no front)
  cardToken?: string; // obrigatório pra cartão
  parcelas?: number; // obrigatório pra cartão
  cupomNome?: string;
}

interface ResultadoProcessarPagamento {
  compraId: string;
  status: StatusCompra;
  qrCode?: string;
  qrCodeBase64?: string;
  linkBoleto?: string;
}

export const processarPagamento = onCall(
  { region: REGIAO, secrets: [mercadoPagoAccessToken, melhorEnvioClientId, melhorEnvioClientSecret] },
  async (request): Promise<ResultadoProcessarPagamento> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É preciso estar logado para finalizar a compra.');
    }
    const uid = request.auth.uid;

    const entrada = request.data as EntradaProcessarPagamento;
    const cpfLimpo = limparCpf(entrada.cpf);
    if (!cpfValido(cpfLimpo)) {
      throw new HttpsError('invalid-argument', 'CPF inválido.');
    }
    if (entrada.metodo === 'cartao' && (!entrada.cardToken || !entrada.paymentMethodId || !entrada.parcelas)) {
      throw new HttpsError('invalid-argument', 'Dados do cartão incompletos.');
    }
    if (entrada.metodo === 'boleto' && !entrada.paymentMethodId) {
      throw new HttpsError('invalid-argument', 'Método de boleto não informado.');
    }

    // 1. Preço nunca vem do cliente — relê tudo no servidor.
    const itensComProduto = await buscarItensComProduto(entrada.itens);
    const valorProdutos = itensComProduto.reduce(
      (soma, { produto, quantidade }) => soma + produto.preco * quantidade,
      0
    );

    // 2. Endereço precisa pertencer ao próprio usuário.
    const enderecoSnap = await db
      .collection('usuarios')
      .doc(uid)
      .collection('enderecos')
      .doc(entrada.enderecoId)
      .get();
    if (!enderecoSnap.exists) {
      throw new HttpsError('not-found', 'Endereço não encontrado.');
    }
    const endereco = { id: enderecoSnap.id, ...enderecoSnap.data() } as EnderecoDTO;

    // 3. Recota o frete e confirma que a opção escolhida ainda existe pelo mesmo preço.
    const opcoesFrete = await calcularOpcoesFrete(entrada.itens, endereco.cep);
    const freteConfirmado = opcoesFrete.find(opcao => opcao.servicoId === entrada.servicoIdEscolhido);
    if (!freteConfirmado) {
      throw new HttpsError(
        'failed-precondition',
        'O frete escolhido não está mais disponível. Recalcule antes de pagar.'
      );
    }

    // 4. Se veio cupom, relê do Firestore e recalcula o desconto — nunca
    // aceita valor de desconto vindo do cliente, só o nome do cupom.
    let cupomRef: FirebaseFirestore.DocumentReference | null = null;
    let cupomAplicado: CompraDTO['cupomAplicado'] = null;
    let valorDescontoProdutos = 0;
    let valorDescontoFrete = 0;

    if (entrada.cupomNome) {
      const nomeCupom = entrada.cupomNome.trim().toUpperCase();
      const cupomSnap = await db.collection('cupons').where('nome', '==', nomeCupom).limit(1).get();
      if (cupomSnap.empty) {
        throw new HttpsError('not-found', 'Cupom não encontrado.');
      }

      const cupomDoc = cupomSnap.docs[0];
      const cupom = { id: cupomDoc.id, ...cupomDoc.data() } as CupomDTO;

      const validacao = validarCupom(cupom, { valorProdutos, agora: new Date() });
      if (!validacao.valido) {
        throw new HttpsError('failed-precondition', validacao.motivo ?? 'Cupom inválido.');
      }

      const desconto = calcularDesconto(cupom, itensComProduto, freteConfirmado.preco);
      valorDescontoProdutos = arredondarMoeda(desconto.valorDescontoProdutos);
      valorDescontoFrete = arredondarMoeda(desconto.valorDescontoFrete);
      cupomRef = cupomDoc.ref;
      cupomAplicado = {
        id: cupom.id,
        nome: cupom.nome,
        tipoDeDesconto: cupom.tipoDeDesconto,
        valorDescontoProdutos,
        valorDescontoFrete
      };
    }

    const valorTotal = arredondarMoeda(
      Math.max(0, valorProdutos + freteConfirmado.preco - valorDescontoProdutos - valorDescontoFrete)
    );

    if (valorTotal <= 0) {
      throw new HttpsError('failed-precondition', 'O valor total da compra precisa ser maior que zero.');
    }

    // 5. Cria o pagamento no Mercado Pago com o valor calculado no servidor.
    const pagamentoService = obterServicoPagamento(mercadoPagoAccessToken.value());
    const resultadoPagamento = await pagamentoService.create({
      body: {
        transaction_amount: valorTotal,
        description: 'Compra Paranoia Jogos',
        payment_method_id: entrada.metodo === 'pix' ? 'pix' : entrada.paymentMethodId,
        token: entrada.metodo === 'cartao' ? entrada.cardToken : undefined,
        installments: entrada.metodo === 'cartao' ? entrada.parcelas : 1,
        payer: {
          email: entrada.emailPagador,
          identification: { type: 'CPF', number: cpfLimpo }
        },
        // Sem isso o Mercado Pago não sabe pra onde avisar quando o Pix/
        // boleto for pago — o status só atualiza se o cliente atualizar a
        // página manualmente depois, nunca sozinho.
        notification_url: `https://${REGIAO}-paranoiajogos.cloudfunctions.net/webhookMercadoPago`
      }
    });

    const status = mapearStatusMercadoPago(resultadoPagamento.status ?? 'pending');

    // 6. Grava o pedido. Cliente nunca escreve aqui diretamente (regra do Firestore).
    const compra: CompraDTO = {
      usuarioId: uid,
      itens: itensComProduto.map(({ produto, quantidade }) => ({
        produtoId: produto.id,
        nome: produto.nome,
        precoUnit: produto.preco,
        quantidade
      })),
      valorProdutos,
      valorFrete: freteConfirmado.preco,
      valorTotal,
      cupomAplicado,
      status,
      pagamento: {
        mercadoPagoId: String(resultadoPagamento.id),
        metodo: entrada.metodo,
        status: resultadoPagamento.status ?? 'pending'
      },
      envio: {
        servicoId: freteConfirmado.servicoId,
        servico: freteConfirmado.servico,
        transportadora: freteConfirmado.transportadora,
        prazoDias: freteConfirmado.prazoDias
      },
      enderecoEntrega: endereco,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    const docCompra = await db.collection('compras').add(compra);

    // Incrementa o uso do cupom só depois do pedido criado com sucesso. Não é
    // atômico fim-a-fim com a criação do pagamento (sem reserva/estorno de
    // uso) — numa race extrema no último uso disponível, dois pedidos
    // simultâneos poderiam passar. Aceitável para o volume da loja hoje.
    if (cupomRef) {
      await cupomRef.update({ usosTotais: FieldValue.increment(1) });
    }

    // Cartão pode aprovar na hora — nesse caso o webhook não vê mudança de
    // status (já chega "pago" pronto) e pula os efeitos colaterais por
    // idempotência, então dispara aqui mesmo. PIX/boleto ficam
    // "aguardando_pagamento" e são tratados só pelo webhook.
    if (status === 'pago') {
      await processarCompraPaga(uid, docCompra.id, compra);
    }

    return {
      compraId: docCompra.id,
      status,
      qrCode: resultadoPagamento.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: resultadoPagamento.point_of_interaction?.transaction_data?.qr_code_base64,
      linkBoleto: resultadoPagamento.transaction_details?.external_resource_url ?? undefined
    };
  }
);
