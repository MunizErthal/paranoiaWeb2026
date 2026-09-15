import { Component, input } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CompraDTO } from '../../models/compra.dto';
import { StatusBadge } from '../status-badge/status-badge';

@Component({
  selector: 'app-pedido-card',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusBadge],
  templateUrl: './pedido-card.html',
  styleUrl: './pedido-card.scss'
})
export class PedidoCard {
  readonly pedido = input.required<CompraDTO>();
}
