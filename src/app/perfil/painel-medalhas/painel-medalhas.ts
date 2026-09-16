import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { AuthStateStore } from '../../../shared/stores/auth-state.store';
import { UsuarioService } from '../../../shared/services/firebase/usuario.service';
import { ProdutoService } from '../../../shared/services/firebase/produto.service';
import { ProdutoDTO } from '../../../shared/models/produto.dto';
import { PartidaFinalizada } from '../../../shared/models/usuario.dto';

interface PartidaFinalizadaComProduto extends PartidaFinalizada {
  produto: ProdutoDTO | null;
}

@Component({
  selector: 'app-painel-medalhas',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './painel-medalhas.html',
  styleUrl: './painel-medalhas.scss'
})
export class PainelMedalhas {
  private readonly authState = inject(AuthStateStore);
  private readonly usuarioService = inject(UsuarioService);
  private readonly produtoService = inject(ProdutoService);

  private readonly uid = this.authState.usuario()!.id;

  readonly usuario = toSignal(this.usuarioService.buscarPorId(this.uid), { initialValue: null });

  /** Junta usuarios/{uid}.partidasFinalizadas com o catálogo, mais recente
   *  primeiro. Busca por jogoId (não listarAtivos) pra ainda mostrar a
   *  medalha mesmo que o jogo tenha saído de catálogo depois. */
  readonly medalhas = toSignal(
    toObservable(this.usuario).pipe(
      switchMap((usuario) => {
        const itens = usuario?.partidasFinalizadas ?? [];
        if (itens.length === 0) {
          return of<PartidaFinalizadaComProduto[]>([]);
        }

        return forkJoin(itens.map((item) => this.produtoService.buscarPorId(item.jogoId))).pipe(
          map((produtos) =>
            itens
              .map((item, indice): PartidaFinalizadaComProduto => ({ ...item, produto: produtos[indice] }))
              .sort((a, b) => b.finalizadoEm.toMillis() - a.finalizadoEm.toMillis())
          )
        );
      })
    ),
    { initialValue: [] as PartidaFinalizadaComProduto[] }
  );

  readonly tempoTotalHoras = computed(() =>
    this.medalhas().reduce((soma, medalha) => soma + medalha.tempoTotalDeJogo, 0)
  );

  paraData(timestamp: PartidaFinalizada['finalizadoEm']): Date {
    return timestamp.toDate();
  }

  formatarDuracao(horas: number): string {
    const totalMinutos = Math.round(horas * 60);
    const dias = Math.floor(totalMinutos / (60 * 24));
    const h = Math.floor((totalMinutos % (60 * 24)) / 60);
    const min = totalMinutos % 60;

    const partes: string[] = [];
    if (dias > 0) partes.push(`${dias}d`);
    if (h > 0) partes.push(`${h}h`);
    if (min > 0 || partes.length === 0) partes.push(`${min}min`);

    return partes.join(' ');
  }
}
