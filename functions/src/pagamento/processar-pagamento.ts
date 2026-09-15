import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../admin';
import { mercadoPagoAccessToken } from '../secrets';
import { obterServicoPagamento, mapearStatusMercadoPago } from './mercado-pago-client';
import { calcularOpcoesFrete } from '../frete/cotar-frete';
import { buscarItensComProduto } from '../produtos';
import { cpfValido, limparCpf } from '../cpf.util';
import { CompraDTO, EnderecoDTO, ItemCarrinhoEntrada, StatusCompra } from '../types';
import { REGIAO } from '../regiao';

type Metodo = 'pix' | 'cartao' | 'boleto';

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
}

interface ResultadoProcessarPagamento {
  compraId: string;
  status: StatusCompra;
  qrCode?: string;
  qrCodeBase64?: string;
  linkBoleto?: string;
}

export const processarPagamento = onCall(
  { region: REGIAO, secrets: [mercadoPagoAccessToken] },
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

    const valorTotal = valorProdutos + freteConfirmado.preco;

    // 4. Cria o pagamento no Mercado Pago com o valor calculado no servidor.
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
        }
      }
    });

    const status = mapearStatusMercadoPago(resultadoPagamento.status ?? 'pending');

    // 5. Grava o pedido. Cliente nunca escreve aqui diretamente (regra do Firestore).
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
      status,
      pagamento: {
        mercadoPagoId: String(resultadoPagamento.id),
        metodo: entrada.metodo,
        status: resultadoPagamento.status ?? 'pending'
      },
      envio: {
        servicoId: freteConfirmado.servicoId,
        servico: freteConfirmado.servico,
        prazoDias: freteConfirmado.prazoDias
      },
      enderecoEntrega: endereco,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    const docCompra = await db.collection('compras').add(compra);

    return {
      compraId: docCompra.id,
      status,
      qrCode: resultadoPagamento.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: resultadoPagamento.point_of_interaction?.transaction_data?.qr_code_base64,
      linkBoleto: resultadoPagamento.transaction_details?.external_resource_url ?? undefined
    };
  }
);
