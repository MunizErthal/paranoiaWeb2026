import { ItemCarrinho } from '../models/carrinho.dto';
import { CriterioCupomDTO, CupomDTO, TipoDeDesconto } from '../models/cupom.dto';

export interface ResultadoDesconto {
  valorDescontoProdutos: number;
  valorDescontoFrete: number;
}

export interface ResultadoValidacaoCupom {
  valido: boolean;
  motivo?: string;
}

/** Itens do carrinho aos quais o cupom se aplica: todos, se algum critério
 *  for "TODOS" (ou não houver critérios), senão só os produtos listados. */
export function itensElegiveis(criterios: CriterioCupomDTO[], itens: ItemCarrinho[]): ItemCarrinho[] {
  const aplicaATodos = criterios.length === 0 || criterios.some(criterio => criterio.produto === 'TODOS');
  if (aplicaATodos) {
    return itens;
  }

  const produtosAlvo = new Set(criterios.map(criterio => criterio.produto));
  return itens.filter(item => produtosAlvo.has(item.produtoId));
}

function valorElegivel(criterios: CriterioCupomDTO[], itens: ItemCarrinho[]): number {
  return itensElegiveis(criterios, itens).reduce((soma, item) => soma + item.precoUnit * item.quantidade, 0);
}

/** Uma estratégia por tipoDeDesconto — acrescentar um novo tipo não exige
 *  editar calcularDesconto, só adicionar uma entrada aqui. */
const ESTRATEGIAS_DESCONTO: Record<
  TipoDeDesconto,
  (cupom: CupomDTO, itens: ItemCarrinho[], valorFrete: number) => ResultadoDesconto
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

export function calcularDesconto(cupom: CupomDTO, itens: ItemCarrinho[], valorFrete: number): ResultadoDesconto {
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
