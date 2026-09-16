/**
 * Espelho de src/shared/utils/cupom.util.ts (Angular) — mesma forma,
 * operando sobre ItemComProduto em vez de ItemCarrinho porque aqui os
 * preços já vêm relidos do Firestore, nunca do cliente.
 */
import { CriterioCupomDTO, CupomDTO, TipoDeDesconto } from '../types';
import { ItemComProduto } from '../produtos';

export interface ResultadoDesconto {
  valorDescontoProdutos: number;
  valorDescontoFrete: number;
}

export interface ResultadoValidacaoCupom {
  valido: boolean;
  motivo?: string;
}

function itensElegiveis(criterios: CriterioCupomDTO[], itens: ItemComProduto[]): ItemComProduto[] {
  const aplicaATodos = criterios.length === 0 || criterios.some(criterio => criterio.produto === 'TODOS');
  if (aplicaATodos) {
    return itens;
  }

  const produtosAlvo = new Set(criterios.map(criterio => criterio.produto));
  return itens.filter(item => produtosAlvo.has(item.produto.id));
}

function valorElegivel(criterios: CriterioCupomDTO[], itens: ItemComProduto[]): number {
  return itensElegiveis(criterios, itens).reduce((soma, item) => soma + item.produto.preco * item.quantidade, 0);
}

const ESTRATEGIAS_DESCONTO: Record<
  TipoDeDesconto,
  (cupom: CupomDTO, itens: ItemComProduto[], valorFrete: number) => ResultadoDesconto
> = {
  PORCENTAGEM: (cupom, itens) => ({
    valorDescontoProdutos: valorElegivel(cupom.criterios, itens) * ((cupom.descontoEmPercent ?? 0) / 100),
    valorDescontoFrete: 0
  }),
  VALOR_FIXO: (cupom, itens) => ({
    valorDescontoProdutos: Math.min(cupom.valorFixo ?? 0, valorElegivel(cupom.criterios, itens)),
    valorDescontoFrete: 0
  }),
  FRETE: (_cupom, _itens, valorFrete) => ({
    valorDescontoProdutos: 0,
    valorDescontoFrete: valorFrete
  })
};

export function calcularDesconto(cupom: CupomDTO, itens: ItemComProduto[], valorFrete: number): ResultadoDesconto {
  return ESTRATEGIAS_DESCONTO[cupom.tipoDeDesconto](cupom, itens, valorFrete);
}

export function validarCupom(
  cupom: CupomDTO,
  contexto: { valorProdutos: number; agora: Date }
): ResultadoValidacaoCupom {
  // ativo/usosTotais tratados como opcionais na leitura: cupons cadastrados
  // manualmente no console podem não ter esses campos — ausência de "ativo"
  // não deve ser tratada como cupom desativado.
  if (cupom.ativo === false) {
    return { valido: false, motivo: 'Este cupom não está mais ativo.' };
  }
  if (cupom.validoDe && contexto.agora < new Date(cupom.validoDe)) {
    return { valido: false, motivo: 'Este cupom ainda não é válido.' };
  }
  if (cupom.validoAte && contexto.agora > new Date(cupom.validoAte)) {
    return { valido: false, motivo: 'Este cupom expirou.' };
  }
  if (cupom.valorMinimoCarrinho !== undefined && contexto.valorProdutos < cupom.valorMinimoCarrinho) {
    return { valido: false, motivo: 'O carrinho não atinge o valor mínimo exigido por este cupom.' };
  }
  if (cupom.limiteDeUsos !== undefined && (cupom.usosTotais ?? 0) >= cupom.limiteDeUsos) {
    return { valido: false, motivo: 'Este cupom atingiu o limite de usos.' };
  }
  return { valido: true };
}
