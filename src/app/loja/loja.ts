import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProdutoService } from '../../shared/services/firebase/produto.service';

@Component({
  selector: 'app-loja',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './loja.html',
  styleUrl: './loja.scss'
})
export class Loja {
  private readonly produtoService = inject(ProdutoService);

  readonly produtos = toSignal(this.produtoService.listarAtivos(), { initialValue: [] });
}
