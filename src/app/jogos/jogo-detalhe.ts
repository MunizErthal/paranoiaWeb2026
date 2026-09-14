import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Abaixo desse tanto de rolagem a ficha ainda está sobreposta na capa;
 *  acima disso ela some da capa e reaparece embaixo. Baixo de propósito —
 *  a ideia é a troca acontecer assim que o usuário começa a rolar, não
 *  só depois que o hero inteiro já saiu de vista. */
const SCROLL_THRESHOLD_PX = 24;

@Component({
  selector: 'app-jogo-detalhe',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './jogo-detalhe.html',
  styleUrl: './jogo-detalhe.scss',
})
export class JogoDetalhe {
  /** Alterna a ficha sobreposta na capa pela versão que reaparece abaixo do hero. */
  isScrolled = false;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const isScrolled = window.scrollY > SCROLL_THRESHOLD_PX;
    if (isScrolled !== this.isScrolled) {
      this.isScrolled = isScrolled;
      this.cdr.detectChanges();
    }
  }
}
