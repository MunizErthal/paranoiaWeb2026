import { Component, computed, input } from '@angular/core';
import { StatusCompra } from '../../models/compra.dto';

const ROTULOS: Record<StatusCompra, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  etiqueta_gerada: 'Etiqueta gerada',
  enviado: 'Enviado',
  problema_na_entrega: 'Problema na entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  recusado: 'Recusado'
};

const TONS: Record<StatusCompra, 'neutro' | 'positivo' | 'negativo'> = {
  aguardando_pagamento: 'neutro',
  pago: 'positivo',
  etiqueta_gerada: 'positivo',
  enviado: 'positivo',
  problema_na_entrega: 'negativo',
  entregue: 'positivo',
  cancelado: 'negativo',
  recusado: 'negativo'
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="status-badge" [class]="'status-badge--' + tom()">{{ rotulo() }}</span>`,
  styleUrl: './status-badge.scss'
})
export class StatusBadge {
  readonly status = input.required<StatusCompra>();

  readonly rotulo = computed(() => ROTULOS[this.status()]);
  readonly tom = computed(() => TONS[this.status()]);
}
