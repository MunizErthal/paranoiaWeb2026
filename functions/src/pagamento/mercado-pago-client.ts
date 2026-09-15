import { MercadoPagoConfig, Payment } from 'mercadopago';
import { StatusCompra } from '../types';

let clientCache: MercadoPagoConfig | null = null;

export function obterClienteMercadoPago(accessToken: string): MercadoPagoConfig {
  if (!clientCache) {
    clientCache = new MercadoPagoConfig({ accessToken });
  }
  return clientCache;
}

export function obterServicoPagamento(accessToken: string): Payment {
  return new Payment(obterClienteMercadoPago(accessToken));
}

export function mapearStatusMercadoPago(statusMp: string): StatusCompra {
  switch (statusMp) {
    case 'approved':
      return 'pago';
    case 'rejected':
      return 'recusado';
    default:
      return 'aguardando_pagamento';
  }
}
