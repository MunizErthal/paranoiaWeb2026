import { Injectable } from '@angular/core';
import { environment } from '../../../environment/environment';
import { OpcaoParcelamento } from '../../models/cartao.dto';

/** O SDK MP.js não publica tipos oficiais — essa é só a fatia que usamos. */
interface MercadoPagoInstancia {
  createCardToken(dados: Record<string, unknown>): Promise<{ id: string }>;
  getPaymentMethods(dados: { bin: string }): Promise<{
    results: Array<{ id: string; issuer?: { id: number } }>;
  }>;
  getInstallments(dados: {
    amount: string;
    bin: string;
    locale: string;
  }): Promise<
    Array<{
      issuer?: { id: number };
      payer_costs: Array<{
        installments: number;
        installment_amount: number;
        total_amount: number;
        recommended_message: string;
      }>;
    }>
  >;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opcoes?: Record<string, unknown>) => MercadoPagoInstancia;
  }
}

const URL_SDK = 'https://sdk.mercadopago.com/js/v2';

/**
 * Carrega o SDK MP.js (uma vez só, mesmo com múltiplas chamadas) e expõe
 * tokenização de cartão + consulta de parcelas. Cartão salvo reusa
 * createCardToken passando { cardId, securityCode } em vez dos dados crus
 * — é o mesmo método, o SDK decide o modo pelos campos recebidos.
 */
@Injectable({ providedIn: 'root' })
export class MercadoPagoSdkService {
  private instancia: MercadoPagoInstancia | null = null;
  private carregamento: Promise<MercadoPagoInstancia> | null = null;

  private carregarScript(): Promise<void> {
    if (document.querySelector(`script[src="${URL_SDK}"]`)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = URL_SDK;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Não foi possível carregar o SDK do Mercado Pago.'));
      document.head.appendChild(script);
    });
  }

  private async obterInstancia(): Promise<MercadoPagoInstancia> {
    if (this.instancia) {
      return this.instancia;
    }
    if (!this.carregamento) {
      this.carregamento = this.carregarScript().then(() => {
        if (!window.MercadoPago) {
          throw new Error('SDK do Mercado Pago carregado, mas MercadoPago não está disponível.');
        }
        this.instancia = new window.MercadoPago(environment.mercadoPagoPublicKey, {
          locale: 'pt-BR',
          // O fingerprinting de dispositivo do Mercado Pago só funciona com
          // domínios cadastrados no painel deles — em localhost (e no domínio
          // .pages.dev, que ainda não está cadastrado) ele só gera erros de
          // CORS e cookie rejeitado no console, sem travar nada, mas também
          // sem servir pra nada. Desligado até termos domínio próprio e
          // cadastrado lá.
          advancedFraudPrevention: false,
          trackingDisabled: true
        });
        return this.instancia;
      });
    }
    return this.carregamento;
  }

  async criarTokenCartaoNovo(dados: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationNumber: string;
  }): Promise<string> {
    const mp = await this.obterInstancia();
    const token = await mp.createCardToken({
      cardNumber: dados.cardNumber,
      cardholderName: dados.cardholderName,
      cardExpirationMonth: dados.cardExpirationMonth,
      cardExpirationYear: dados.cardExpirationYear,
      securityCode: dados.securityCode,
      identificationType: 'CPF',
      identificationNumber: dados.identificationNumber
    });
    return token.id;
  }

  async criarTokenCartaoSalvo(cardId: string, securityCode: string): Promise<string> {
    const mp = await this.obterInstancia();
    const token = await mp.createCardToken({ cardId, securityCode });
    return token.id;
  }

  async identificarPaymentMethod(bin: string): Promise<{ paymentMethodId: string; issuerId: number } | null> {
    const mp = await this.obterInstancia();
    const resposta = await mp.getPaymentMethods({ bin });
    const primeiro = resposta.results?.[0];
    if (!primeiro) {
      return null;
    }
    return { paymentMethodId: primeiro.id, issuerId: primeiro.issuer?.id ?? 0 };
  }

  async buscarParcelas(bin: string, valorTotal: number): Promise<OpcaoParcelamento[]> {
    const mp = await this.obterInstancia();
    const resposta = await mp.getInstallments({
      bin,
      amount: valorTotal.toFixed(2),
      locale: 'pt-BR'
    });

    const grupo = resposta[0];
    if (!grupo) {
      return [];
    }

    return grupo.payer_costs.map(custo => ({
      parcelas: custo.installments,
      valorParcela: custo.installment_amount,
      valorTotal: custo.total_amount,
      issuerId: grupo.issuer?.id ?? 0,
      mensagem: custo.recommended_message
    }));
  }
}
