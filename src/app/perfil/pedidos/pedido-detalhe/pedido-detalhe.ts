import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PedidoService } from '../../../../shared/services/firebase/pedido.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { StatusCompra } from '../../../../shared/models/compra.dto';

const ETAPAS: StatusCompra[] = ['aguardando_pagamento', 'pago', 'etiqueta_gerada', 'enviado', 'entregue'];

/** Passos do rastreio de entrega — mesma progressão de ETAPAS, mas sem
 *  "aguardando_pagamento" (não faz sentido mostrar rastreio antes de pagar). */
const ETAPAS_ENVIO: { status: StatusCompra; rotulo: string }[] = [
  { status: 'pago', rotulo: 'Pedido confirmado' },
  { status: 'etiqueta_gerada', rotulo: 'Etiqueta gerada' },
  { status: 'enviado', rotulo: 'Enviado' },
  { status: 'entregue', rotulo: 'Entregue' }
];

@Component({
  selector: 'app-pedido-detalhe',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusBadge],
  templateUrl: './pedido-detalhe.html',
  styleUrl: './pedido-detalhe.scss'
})
export class PedidoDetalhe {
  private readonly route = inject(ActivatedRoute);
  private readonly pedidoService = inject(PedidoService);

  readonly etapas = ETAPAS;
  readonly etapasEnvio = ETAPAS_ENVIO;

  readonly pedido = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => this.pedidoService.buscarPorId(params.get('idPedido') ?? ''))
    ),
    { initialValue: null }
  );

  indiceDaEtapa(status: StatusCompra): number {
    if (status === 'problema_na_entrega') {
      return ETAPAS.indexOf('enviado');
    }
    return ETAPAS.indexOf(status);
  }

  /** "problema_na_entrega" não é um passo próprio na linha do tempo — é um
   *  alerta sobre o último passo real alcançado (sempre depois de
   *  "enviado", já que o Melhor Envio só avisa isso pra encomendas
   *  postadas). Mostra o rastreio congelado em "Enviado" nesse caso. */
  indiceDaEtapaEnvio(status: StatusCompra): number {
    if (status === 'problema_na_entrega') {
      return ETAPAS_ENVIO.findIndex(etapa => etapa.status === 'enviado');
    }
    return ETAPAS_ENVIO.findIndex(etapa => etapa.status === status);
  }

  mensagemStatusFinal(status: StatusCompra): string {
    switch (status) {
      case 'cancelado':
        return 'Este pedido foi cancelado.';
      case 'recusado':
        return 'O pagamento deste pedido foi recusado.';
      default:
        return '';
    }
  }
}
