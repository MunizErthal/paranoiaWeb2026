import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthStateStore } from '../../../shared/stores/auth-state.store';
import { PedidoService } from '../../../shared/services/firebase/pedido.service';
import { PedidoCard } from '../../../shared/components/pedido-card/pedido-card';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [PedidoCard, RouterLink],
  templateUrl: './pedidos.html'
})
export class Pedidos {
  private readonly authState = inject(AuthStateStore);
  private readonly pedidoService = inject(PedidoService);

  readonly pedidos = toSignal(
    this.pedidoService.listarDoUsuarioOuvindo(this.authState.usuario()!.id),
    { initialValue: [] }
  );
}
