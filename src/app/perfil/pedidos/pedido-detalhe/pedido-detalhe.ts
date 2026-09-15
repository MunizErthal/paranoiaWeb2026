import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PedidoService } from '../../../../shared/services/firebase/pedido.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { StatusCompra } from '../../../../shared/models/compra.dto';

const ETAPAS: StatusCompra[] = ['aguardando_pagamento', 'pago', 'etiqueta_gerada', 'enviado', 'entregue'];

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

  readonly pedido = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => this.pedidoService.buscarPorId(params.get('idPedido') ?? ''))
    ),
    { initialValue: null }
  );

  indiceDaEtapa(status: StatusCompra): number {
    return ETAPAS.indexOf(status);
  }
}
