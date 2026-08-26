import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-jogo-detalhe',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './jogo-detalhe.html',
  styleUrls: ['./jogo-detalhe.scss', '../glitch.scss']
})
export class JogoDetalhe {}
