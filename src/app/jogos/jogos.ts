import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProdutoService } from '../../shared/services/firebase/produto.service';

@Component({
  selector: 'app-jogos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './jogos.html',
  styleUrl: './jogos.scss'
})
export class Jogos {
  private readonly produtoService = inject(ProdutoService);

  readonly produtos = toSignal(this.produtoService.listarAtivos(), { initialValue: [] });
}
