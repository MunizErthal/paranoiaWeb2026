import { Routes } from '@angular/router';
import { Contato } from './contato/contato';
import { Home } from './home/home';
import { Jogos } from './jogos/jogos';
import { JogoDetalhe } from './jogos/jogo-detalhe';
import { Loja } from './loja/loja';
import { Sobre } from './sobre/sobre';

export const routes: Routes = [
	{ path: '', component: Home },
	{ path: 'jogos', component: Jogos },
	{ path: 'jogos/:idDoJogo', component: JogoDetalhe },
	{ path: 'sobre', component: Sobre },
	{ path: 'loja', component: Loja },
	{ path: 'contato', component: Contato },
	{ path: '**', redirectTo: '' }
];
