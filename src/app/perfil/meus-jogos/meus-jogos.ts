import { Component, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { JogosAdquiridosStore } from '../../../shared/stores/jogos-adquiridos.store';
import { ProdutoService } from '../../../shared/services/firebase/produto.service';
import { ProdutoDTO } from '../../../shared/models/produto.dto';
import { JogoAdquirido } from '../../../shared/models/usuario.dto';

interface JogoAdquiridoComProduto extends JogoAdquirido {
  produto: ProdutoDTO | null;
}

@Component({
  selector: 'app-meus-jogos',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './meus-jogos.html',
  styleUrl: './meus-jogos.scss'
})
export class MeusJogos {
  private readonly jogosAdquiridosStore = inject(JogosAdquiridosStore);
  private readonly produtoService = inject(ProdutoService);

  /** Junta usuarios/{uid}.jogosAdquiridos com o catálogo, mais recente
   *  primeiro. Busca por produtoId (não listarAtivos) pra ainda mostrar um
   *  jogo comprado mesmo que tenha saído de catálogo depois. */
  readonly jogos = toSignal(
    toObservable(this.jogosAdquiridosStore.itens).pipe(
      switchMap((itens) => {
        if (itens.length === 0) {
          return of<JogoAdquiridoComProduto[]>([]);
        }

        return forkJoin(itens.map((item) => this.produtoService.buscarPorId(item.produtoId))).pipe(
          map((produtos) =>
            itens
              .map((item, indice): JogoAdquiridoComProduto => ({ ...item, produto: produtos[indice] }))
              .sort((a, b) => b.dataCompra.localeCompare(a.dataCompra))
          )
        );
      })
    ),
    { initialValue: [] as JogoAdquiridoComProduto[] }
  );
}
