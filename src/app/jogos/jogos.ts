import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-jogos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './jogos.html',
  styleUrl: './jogos.scss'
})
export class Jogos {}
